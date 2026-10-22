/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — ESTRUCTURA OFICIAL
 * Archivo: js/3-security/security.guard.js
 * Dominio: 3-security (Guardia de Seguridad, Accesos, Rutas y Blindaje DOM)
 * Proyecto Firebase: makai-academy-f8039 (SDK Modular v13.0.0)
 * ============================================================================
 */

import {
    auth,
    db,
    COLLECTIONS,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    SUBSCRIPTION_TIERS,
    FREEMIUM_MONTHLY_CASE_LIMIT,
    isMasterAdmin,
    isCurrentUserAdmin,
    setSessionState,
    canAccessBySubscription,
    hasRemainingFreemiumCases,
    resetExamSessionState
} from "../2-core/state.store.js";

import {
    checkIsVerifiedUser
} from "./auth.verifier.js";

// ============================================================================
// 1. ESTADO INTERNO DEL GUARDIA DE SEGURIDAD Y CONFIGURACIÓN
// ============================================================================
let guardInitialized = false;
let domAdminObserver = null;
let examAntiCheatBound = false;
let focusLostCounter = 0;

/**
 * Carreras con candado "(Próximamente)" para cuentas estándar,
 * pero 100% desbloqueadas para Administradores Maestros.
 */
const COMING_SOON_CAREERS = Object.freeze([
    "odontologia",
    "obstetricia"
]);

/**
 * Modos de evaluación que exigen suscripción PRO o VIP activa.
 */
const PRO_ONLY_EXAM_MODES = Object.freeze([
    "estandar",
    "standard",
    "critico",
    "refuerzo_critico"
]);

// ============================================================================
// 2. PUNTO DE ENTRADA DEL MÓDULO (initSecurityGuard)
// ============================================================================

/**
 * Inicializa el Guardia de Seguridad en la vista actual (index.html,
 * registro.html o dashboard.html), verifica la sesión activa, protege
 * la Bóveda Admin en el DOM y suscribe los escudos de navegación.
 *
 * @param {object} [passedUser] Objeto User de Firebase Auth inyectado por app.orchestrator.js
 * @param {object} [passedUserData] Expediente de Firestore inyectado por app.orchestrator.js
 * @returns {Promise<boolean>} true si el acceso a la vista actual es válido
 */
export async function initSecurityGuard(passedUser = null, passedUserData = null) {
    const currentViewType = detectCurrentPageType();
    const activeUser = passedUser || auth.currentUser || appState.currentUser;
    const activeUserData = passedUserData || appState.currentUserData;

    // 1. Si ya tenemos usuario inyectado por el Orquestador, validar de inmediato
    if (activeUser) {
        const allowed = await enforceRouteProtection(activeUser, activeUserData, currentViewType);
        if (!allowed) return false;
    } else if (currentViewType === "dashboard") {
        // Si estamos en dashboard.html y Firebase Auth aún está restaurando el estado
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = "index.html";
                return;
            }
            await enforceRouteProtection(user, appState.currentUserData, "dashboard");
        });
    }

    // 2. En dashboard.html, activar blindaje del Panel Admin y escuchadores de seguridad
    if (currentViewType === "dashboard") {
        enforceAdminVaultLock(activeUser);
        startAdminDomMutationGuard();
        bindGlobalSecurityListeners();
    }

    guardInitialized = true;
    return true;
}

// Alias compatible con cargadores dinámicos (safeLoadModule en app.orchestrator.js)
export const initGuard = initSecurityGuard;

// ============================================================================
// 3. PROTECCIÓN DE RUTAS ENTRE INDEX.HTML, REGISTRO.HTML Y DASHBOARD.HTML
// ============================================================================

/**
 * Detecta en cuál de los 3 documentos HTML se encuentra el navegador.
 *
 * @returns {"index"|"registro"|"dashboard"|"unknown"}
 */
export function detectCurrentPageType() {
    if (typeof document === "undefined") return "unknown";

    const path = (window.location.pathname || "").toLowerCase();

    if (document.getElementById("views-container") || path.endsWith("dashboard.html")) {
        return "dashboard";
    }
    if (
        document.getElementById("full-register-form") ||
        document.getElementById("verification-card") ||
        path.endsWith("registro.html")
    ) {
        return "registro";
    }
    if (document.getElementById("auth-form") || path.endsWith("index.html") || path.endsWith("/")) {
        return "index";
    }

    return "unknown";
}

/**
 * Ejecuta las reglas de acceso según la pantalla actual y el estado de verificación
 * de la cuenta autenticada. Aplica bypass inmediato para Administradores Maestros.
 *
 * @param {object} user Objeto User de Firebase Auth
 * @param {object} [userData] Datos del perfil en Firestore
 * @param {string} [pageType] Tipo de página actual
 * @returns {Promise<boolean>} true si el usuario puede permanecer en la página
 */
export async function enforceRouteProtection(user, userData = null, pageType = null) {
    const view = pageType || detectCurrentPageType();

    // Caso 1: Sin sesión activa intentando abrir dashboard.html
    if (!user) {
        if (view === "dashboard") {
            window.location.href = "index.html";
            return false;
        }
        return true;
    }

    // Caso 2: Cuenta Maestra de Administración (Pase directo total)
    if (verifyMasterAdminAccess(user)) {
        if (view === "index") {
            window.location.href = "dashboard.html";
            return false;
        }
        return true;
    }

    // Caso 3: Comprobar verificación de correo electrónico (Email o Google OAuth)
    const isVerified = await checkIsVerifiedUser(user);

    if (!isVerified) {
        if (view === "dashboard" || view === "index") {
            const savedPlan = sessionStorage.getItem("makai_selected_plan") || userData?.planSolicitado || "basico";
            const savedPay = sessionStorage.getItem("makai_selected_payment") || userData?.metodoPagoPreferido || "ninguno";
            window.location.href = `registro.html?verify=pending&plan=${encodeURIComponent(savedPlan)}&pago=${encodeURIComponent(savedPay)}`;
            return false;
        }
        return true;
    }

    // Caso 4: Usuario autenticado y verificado que abre index.html -> llevar al Dashboard
    if (view === "index") {
        window.location.href = "dashboard.html";
        return false;
    }

    // Caso 5: Auditar integridad de suscripción al entrar a dashboard.html
    if (view === "dashboard") {
        await auditUserSessionIntegrity(user);
    }

    return true;
}

// ============================================================================
// 4. BLINDAJE DE CUENTAS MAESTRAS Y BÓVEDA DE ADMINISTRADORES (#view-admin)
// ============================================================================

/**
 * Verifica si el usuario proporcionado o activo en sesión corresponde a una
 * de las cuentas maestras autorizadas (anthonnyvelastegui@gmail.com o aavemakaihc@gmail.com).
 *
 * @param {object|string} [userOrEmail] Objeto User de Firebase o cadena de correo
 * @returns {boolean}
 */
export function verifyMasterAdminAccess(userOrEmail = null) {
    if (!userOrEmail) {
        return isCurrentUserAdmin();
    }
    if (typeof userOrEmail === "string") {
        return isMasterAdmin(userOrEmail);
    }
    const email = userOrEmail.email || appState.currentUser?.email || appState.currentUserData?.email;
    return isMasterAdmin(email);
}

/**
 * Desbloquea los controles de administración si el usuario es Admin Maestro,
 * o los oculta y purga del alcance de cuentas estándar en dashboard.html.
 *
 * @param {object} [user] Usuario actual
 */
export function enforceAdminVaultLock(user = null) {
    const activeUser = user || auth.currentUser || appState.currentUser;
    const isAdmin = verifyMasterAdminAccess(activeUser);

    const adminNavBtn = document.getElementById("admin-nav-btn");
    const headerAdminBtn = document.getElementById("header-admin-btn");
    const adminView = document.getElementById("view-admin");

    if (isAdmin) {
        adminNavBtn?.classList.remove("hidden");
        headerAdminBtn?.classList.remove("hidden");
        unlockAdminCareerButtons();
    } else {
        adminNavBtn?.classList.add("hidden");
        headerAdminBtn?.classList.add("hidden");

        if (adminView && !adminView.classList.contains("hidden")) {
            adminView.classList.add("hidden");
            const launcherView = document.getElementById("view-launcher");
            launcherView?.classList.remove("hidden");
            showSecurityToast("Acceso restringido exclusivamente a cuentas maestras de administración.", "danger");
        }
    }
}

/**
 * Desbloquea visualmente las 4 carreras oficiales del CACES (incluyendo Odontología
 * y Obstetricia) cuando inicia sesión una cuenta maestra de administración.
 */
function unlockAdminCareerButtons() {
    const careerButtons = document.querySelectorAll("[data-career]");
    careerButtons.forEach((btn) => {
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-60", "cursor-not-allowed");
        btn.dataset.adminUnlocked = "true";
    });
}

/**
 * Vigila mediante MutationObserver que un usuario no administrador no pueda
 * quitar la clase `.hidden` de `#view-admin` desde las herramientas de desarrollador.
 */
function startAdminDomMutationGuard() {
    if (domAdminObserver || typeof MutationObserver === "undefined") return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    domAdminObserver = new MutationObserver(() => {
        if (!verifyMasterAdminAccess() && !adminView.classList.contains("hidden")) {
            adminView.classList.add("hidden");
            adminView.innerHTML = "";
            const launcherView = document.getElementById("view-launcher");
            launcherView?.classList.remove("hidden");
            showSecurityToast("Operación bloqueada por el Guardia de Seguridad de MakaiAcademy.", "danger");
        }
    });

    domAdminObserver.observe(adminView, {
        attributes: true,
        attributeFilter: ["class", "style"]
    });
}

// ============================================================================
// 5. AUDITORÍA DE INTEGRIDAD DE PERFIL Y SUSCRIPCIÓN EN FIRESTORE
// ============================================================================

/**
 * Contrasta el estado de suscripción en memoria (`appState.currentUserData`)
 * contra el expediente real en Cloud Firestore (`usuarios`) para evitar la
 * falsificación local de planes PRO/VIP o del contador `casesUsedThisMonth`.
 *
 * @param {object} [user] Objeto User de Firebase Auth
 * @returns {Promise<object|null>} Expediente verificado y sincronizado
 */
export async function auditUserSessionIntegrity(user = null) {
    const activeUser = user || auth.currentUser || appState.currentUser;
    if (!activeUser) return null;

    const usersCollection = COLLECTIONS?.USERS || "usuarios";

    try {
        const userRef = doc(db, usersCollection, activeUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return appState.currentUserData;
        }

        const remoteData = snap.data();
        const isAdmin = verifyMasterAdminAccess(activeUser);

        // Garantizar blindaje automático en Firestore para Administradores Maestros
        if (isAdmin && (remoteData.rol !== "admin" || remoteData.subscriptionLevel !== "PRO")) {
            await updateDoc(userRef, {
                rol: "admin",
                subscriptionLevel: "PRO",
                estadoPago: "activo_verificado",
                correoConfirmadoMakai: true
            });
            remoteData.rol = "admin";
            remoteData.subscriptionLevel = "PRO";
            remoteData.estadoPago = "activo_verificado";
            remoteData.correoConfirmadoMakai = true;
        }

        // Si un estudiante no es admin y su pago no ha sido verificado aún, su nivel efectivo es Básico
        if (!isAdmin && remoteData.estadoPago === "pendiente_verificacion" && remoteData.subscriptionLevel !== "Básico") {
            remoteData.subscriptionLevel = "Básico";
        }

        // Sincronizar con state.store.js
        setSessionState(activeUser, remoteData);
        enforceAdminVaultLock(activeUser);

        return remoteData;
    } catch (err) {
        console.warn("[MakaiSecurityGuard] Aviso en auditoría de sesión con Firestore:", err);
        return appState.currentUserData;
    }
}

// ============================================================================
// 6. CONTROL DE ACCESO A CARRERAS, MODOS DE SIMULACRO Y CUOTA FREEMIUM
// ============================================================================

/**
 * Evalúa si el usuario actual puede acceder a una función, carrera, modo de
 * examen, guía PDF o aula virtual específica.
 *
 * @param {object} featureConfig Configuración del recurso solicitado
 * @param {string} [featureConfig.requiredLevel="Básico"] Nivel mínimo ("Básico", "PRO", "VIP")
 * @param {string} [featureConfig.careerId] ID de la carrera ("medicina", "enfermeria", "odontologia", "obstetricia")
 * @param {string} [featureConfig.examMode] Modo de examen ("tutor", "estandar", "critico")
 * @param {boolean} [featureConfig.requiresCaseQuota=false] Si consume casos de la cuota mensual Freemium
 * @returns {{ allowed: boolean, reason: string, action: "none"|"toast"|"paywall"|"admin_only" }}
 */
export function canUserAccessFeature(featureConfig = {}) {
    const {
        requiredLevel = SUBSCRIPTION_TIERS.BASIC,
        careerId = null,
        examMode = null,
        requiresCaseQuota = false,
        adminOnly = false
    } = featureConfig;

    // 1. Administradores Maestros tienen acceso total e ilimitado a toda la plataforma
    if (verifyMasterAdminAccess()) {
        return { allowed: true, reason: "Acceso Maestro Autorizado", action: "none" };
    }

    // 2. Bloqueo de vistas exclusivas de administración
    if (adminOnly) {
        return {
            allowed: false,
            reason: "Esta sección es exclusiva para Administradores Maestros.",
            action: "admin_only"
        };
    }

    // 3. Verificar si la carrera seleccionada está marcada como "(Próximamente)" para alumnos
    if (careerId && COMING_SOON_CAREERS.includes(careerId.trim().toLowerCase())) {
        return {
            allowed: false,
            reason: "Módulo en calibración final • Disponible próximamente",
            action: "toast"
        };
    }

    // 4. Verificar si el modo de simulacro exige plan PRO (ej. Modo Estándar de 100 reactivos)
    if (examMode && PRO_ONLY_EXAM_MODES.includes(examMode.trim().toLowerCase())) {
        if (!canAccessBySubscription(SUBSCRIPTION_TIERS.PRO)) {
            return {
                allowed: false,
                reason: "El Simulacro Estándar CACES (100 reactivos) y el Refuerzo Crítico requieren el plan Makai PRO CACES.",
                action: "paywall"
            };
        }
    }

    // 5. Verificar jerarquía de suscripción requerida por el recurso (Básico, PRO, VIP)
    if (!canAccessBySubscription(requiredLevel)) {
        return {
            allowed: false,
            reason: `Este recurso clínico requiere una suscripción activa nivel ${requiredLevel}.`,
            action: "paywall"
        };
    }

    // 6. Verificar límite mensual de 15 casos gratuitos para usuarios en Plan Básico
    if (requiresCaseQuota && !hasRemainingFreemiumCases()) {
        return {
            allowed: false,
            reason: `Has alcanzado tu límite mensual de ${FREEMIUM_MONTHLY_CASE_LIMIT} casos gratuitos en el Plan Básico. Actualiza a Makai PRO CACES para acceso ilimitado.`,
            action: "paywall"
        };
    }

    return { allowed: true, reason: "Acceso permitido", action: "none" };
}

/**
 * Guardia previo al arranque de un simulacro en `js/4-exams/exam.controller.js`.
 * Si el estudiante no cumple los requisitos, muestra automáticamente el Toast
 * o dispara el modal de actualización a PRO (`paywall.traffic.js`).
 *
 * @param {string} [examMode] Modo seleccionado ("tutor", "estandar", "critico")
 * @param {string} [careerId] Carrera seleccionada
 * @returns {boolean} true si el simulacro puede iniciar
 */
export function guardExamLaunch(examMode = null, careerId = null) {
    const modeToCheck = examMode || appState.currentMode || "tutor";
    const careerToCheck = careerId || appState.currentCareer || "medicina";

    const verdict = canUserAccessFeature({
        careerId: careerToCheck,
        examMode: modeToCheck,
        requiresCaseQuota: true
    });

    if (verdict.allowed) {
        return true;
    }

    if (verdict.action === "toast") {
        showSecurityToast(verdict.reason, "info");
    } else if (verdict.action === "paywall") {
        triggerPaywallIntervention(verdict.reason, modeToCheck);
    } else {
        showSecurityToast(verdict.reason, "danger");
    }

    return false;
}

/**
 * Emite el evento global de bloqueo Freemium o delega directamente a
 * `window.MakaiPaywall` (`js/3-security/paywall.traffic.js`).
 *
 * @param {string} reason Mensaje explicativo del bloqueo
 * @param {string} [contextSource="simulator"] Origen del evento
 */
export function triggerPaywallIntervention(reason, contextSource = "simulator") {
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("makai:triggerPaywall", {
                detail: {
                    reason,
                    source: contextSource,
                    casesUsed: appState.currentUserData?.casesUsedThisMonth || 0,
                    limit: FREEMIUM_MONTHLY_CASE_LIMIT
                }
            })
        );

        if (typeof window.MakaiPaywall?.openPaywallModal === "function") {
            window.MakaiPaywall.openPaywallModal(reason);
            return;
        }
    }

    // Respaldo nativo si el modal de paywall.traffic.js está en proceso de carga
    const existingModal = document.getElementById("paywall-modal");
    if (existingModal) {
        existingModal.classList.remove("hidden");
        const reasonNode = document.getElementById("paywall-reason-text");
        if (reasonNode) reasonNode.textContent = reason;
    } else {
        showSecurityToast(reason, "warning");
    }
}

// ============================================================================
// 7. ESCUDO ANTI-COPIA Y PROTECCIÓN DE SIMULACROS EN CURSO
// ============================================================================

/**
 * Activa las protecciones de seguridad mientras `appState.isExamActive === true`:
 * - Evita el cierre o recarga accidental de la pestaña (`beforeunload`).
 * - Protege el contenedor del caso clínico contra copia de texto o menú contextual
 *   para preservar la integridad del banco `preguntas_caces`.
 */
export function enableExamAntiCheatGuard() {
    focusLostCounter = 0;
    if (examAntiCheatBound || typeof window === "undefined") return;

    window.addEventListener("beforeunload", handleBeforeUnloadExam);
    document.addEventListener("copy", handleProtectedClinicalCopy);
    document.addEventListener("contextmenu", handleProtectedContextMenu);
    document.addEventListener("visibilitychange", handleExamVisibilityChange);

    examAntiCheatBound = true;
}

/**
 * Desactiva las restricciones de examen al concluir o salir del simulacro.
 */
export function disableExamAntiCheatGuard() {
    if (!examAntiCheatBound || typeof window === "undefined") return;

    window.removeEventListener("beforeunload", handleBeforeUnloadExam);
    document.removeEventListener("copy", handleProtectedClinicalCopy);
    document.removeEventListener("contextmenu", handleProtectedContextMenu);
    document.removeEventListener("visibilitychange", handleExamVisibilityChange);

    examAntiCheatBound = false;
}

function handleBeforeUnloadExam(event) {
    if (!appState.isExamActive) return;
    event.preventDefault();
    event.returnValue = "Tienes un simulacro CACES en curso. Si recargas o cierras la pestaña perderás tu progreso actual.";
    return event.returnValue;
}

function handleProtectedClinicalCopy(event) {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;

    const simulatorView = document.getElementById("view-simulator");
    if (simulatorView && !simulatorView.classList.contains("hidden")) {
        event.preventDefault();
        showSecurityToast("El banco de reactivos clínicos de MakaiAcademy está protegido contra copia durante el simulacro.", "warning");
    }
}

function handleProtectedContextMenu(event) {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;

    const simulatorView = document.getElementById("view-simulator");
    if (simulatorView && !simulatorView.classList.contains("hidden") && simulatorView.contains(event.target)) {
        event.preventDefault();
    }
}

function handleExamVisibilityChange() {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;

    if (document.hidden) {
        focusLostCounter += 1;
        if (focusLostCounter >= 2) {
            showSecurityToast(
                `Aviso de Integridad CACES: Se ha detectado salida de la ventana del examen (${focusLostCounter} veces).`,
                "warning"
            );
        }
    }
}

// ============================================================================
// 8. CIERRE DE SESIÓN SEGURO Y UTILIDADES VISUALES
// ============================================================================

/**
 * Cierra la sesión actual de forma limpia, purga los datos temporales de
 * exámenes en curso y redirige al portal principal (`index.html`).
 *
 * @param {string} [reason] Motivo opcional del cierre de sesión
 */
export async function secureSignOut(reason = null) {
    disableExamAntiCheatGuard();
    resetExamSessionState();

    try {
        sessionStorage.removeItem("makai_active_exam_backup");
        await signOut(auth);
    } catch (err) {
        console.warn("[MakaiSecurityGuard] Aviso al cerrar sesión en Firebase:", err);
    }

    if (reason) {
        sessionStorage.setItem("makai_signout_notice", reason);
    }

    window.location.href = "index.html";
}

/**
 * Escucha cambios globales de estado (`makai:stateChanged`) para activar o
 * desactivar automáticamente el escudo de examen y el candado de administrador.
 */
function bindGlobalSecurityListeners() {
    if (typeof window === "undefined") return;

    window.addEventListener("makai:stateChanged", (event) => {
        const reason = event.detail?.reason || "";

        if (reason === "sessionUpdated") {
            enforceAdminVaultLock(appState.currentUser);
        }

        if (appState.isExamActive) {
            enableExamAntiCheatGuard();
        } else {
            disableExamAntiCheatGuard();
        }
    });
}

/**
 * Muestra una notificación emergente en `#toast` o construye una alerta
 * flotante con estética Cyber-Medical Dark Mode si no existe el nodo base.
 *
 * @param {string} message Mensaje a mostrar
 * @param {"info"|"warning"|"danger"|"success"} [type="info"] Estilo visual
 */
export function showSecurityToast(message, type = "info") {
    const existingToast = document.getElementById("toast");
    const toastMsg = document.getElementById("toast-msg");

    if (existingToast) {
        if (toastMsg) {
            toastMsg.textContent = message;
        } else {
            existingToast.textContent = message;
        }
        existingToast.classList.remove("hidden", "opacity-0", "translate-y-4");
        clearTimeout(existingToast._hideTimer);
        existingToast._hideTimer = setTimeout(() => {
            existingToast.classList.add("hidden");
        }, 3600);
        return;
    }

    // Fallback flotante si la vista actual no incluye #toast en el HTML
    let fallbackToast = document.getElementById("makai-security-toast-fallback");
    if (!fallbackToast) {
        fallbackToast = document.createElement("div");
        fallbackToast.id = "makai-security-toast-fallback";
        document.body.appendChild(fallbackToast);
    }

    const borderPalette = {
        info: "border-primary text-primary",
        warning: "border-warning text-warning",
        danger: "border-danger text-danger",
        success: "border-secondary text-secondary"
    };

    fallbackToast.className = `fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 rounded-xl bg-surface-container border ${borderPalette[type] || borderPalette.info} shadow-2xl font-mono text-xs transition-all duration-300`;
    fallbackToast.textContent = message;

    clearTimeout(fallbackToast._hideTimer);
    fallbackToast._hideTimer = setTimeout(() => {
        fallbackToast.remove();
    }, 3600);
}

// Exposición global controlada para interoperabilidad entre las 8 carpetas
if (typeof window !== "undefined") {
    window.MakaiSecurityGuard = {
        initSecurityGuard,
        initGuard,
        enforceRouteProtection,
        verifyMasterAdminAccess,
        enforceAdminVaultLock,
        auditUserSessionIntegrity,
        canUserAccessFeature,
        guardExamLaunch,
        triggerPaywallIntervention,
        enableExamAntiCheatGuard,
        disableExamAntiCheatGuard,
        secureSignOut,
        showSecurityToast
    };
}
