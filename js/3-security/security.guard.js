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
    setDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

// Configuración del Sistema Estilo Netflix / Crunchyroll (1 PC + 1 Celular)
const DEVICE_ID_STORAGE_KEY = "makai_hardware_device_id_v1";
const SESSION_TOKEN_STORAGE_KEY = "makai_active_session_token_v1";
const MAX_SELF_SWAPS_PER_MONTH = 2;
let activeDeviceUnsubscribe = null;

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

    // Caso 2: Cuenta Maestra de Administración (Pase directo total sin límite de dispositivos)
    if (verifyMasterAdminAccess(user)) {
        await verifyAndRegisterUserDevice(user);
        if (view === "index") {
            window.location.href = "dashboard.html";
            return false;
        }
        if (view === "dashboard") {
            await auditUserSessionIntegrity(user);
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

    // Caso 4: Verificar límite de 2 dispositivos (Slot 1: PC + Slot 2: Móvil) en index.html y dashboard.html
    const deviceCheck = await verifyAndRegisterUserDevice(user);
    if (!deviceCheck.allowed) {
        // Si hay conflicto de 3.er dispositivo, se muestra el modal interactivo y se detiene el paso
        return false;
    }

    // Caso 5: Usuario autenticado, verificado y con dispositivo autorizado que abre index.html -> llevar al Dashboard
    if (view === "index") {
        window.location.href = "dashboard.html";
        return false;
    }

    // Caso 6: Auditar integridad de suscripción y carreras habilitadas al entrar a dashboard.html
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

        // Sincronizar con state.store.js y con el selector de carreras del Dashboard
        setSessionState(activeUser, remoteData);
        enforceAdminVaultLock(activeUser);

        if (typeof window !== "undefined" && typeof window.MakaiDashboardUI?.applyFirestoreUserCareerProfile === "function") {
            window.MakaiDashboardUI.applyFirestoreUserCareerProfile(remoteData);
        }

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

// ============================================================================
// 9. IDENTIFICACIÓN INTELIGENTE DE DISPOSITIVOS (1 PC + 1 CELULAR)
//    Slot 1: Computadora (desktop) | Slot 2: Teléfono / Móvil (mobile)
//    Guarda en Firestore: usuarios/{uid}.dispositivosRegistrados
// ============================================================================

/**
 * Analiza el navegador y clasifica el equipo en:
 * - Slot 1 ("desktop"): Windows, Mac o Linux (ej. Chrome en Windows 10/11)
 * - Slot 2 ("mobile"): Android o iOS (ej. Safari en iPhone o Chrome en Samsung)
 */
export function detectDeviceEnvironment() {
    const ua = navigator.userAgent || "";
    const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();

    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const isIPadOS = platform.includes("mac") && navigator.maxTouchPoints > 1;
    const category = (isMobileUA || isIPadOS) ? "mobile" : "desktop";

    let osName = "Sistema Operativo";
    if (/Windows NT 10\.0/i.test(ua)) osName = "Windows 10/11";
    else if (/Windows/i.test(ua)) osName = "Windows";
    else if (/iPhone/i.test(ua)) osName = "iPhone (iOS)";
    else if (/iPad/i.test(ua) || isIPadOS) osName = "iPad (iPadOS)";
    else if (/Android/i.test(ua)) {
        const match = ua.match(/Android\s([0-9.]+)/i);
        osName = match ? `Android ${match[1]}` : "Android";
    } else if (/Mac OS X|Macintosh/i.test(ua)) osName = "macOS";
    else if (/Linux/i.test(ua)) osName = "Linux";

    let browserName = "Navegador";
    if (/Edg\//i.test(ua)) browserName = "Edge";
    else if (/OPR\/|Opera/i.test(ua)) browserName = "Opera";
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browserName = "Chrome";
    else if (/Firefox\//i.test(ua)) browserName = "Firefox";
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browserName = "Safari";

    const slotLabel = category === "desktop" ? "PC/Laptop" : "Móvil";
    return {
        category, // "desktop" (Slot 1) | "mobile" (Slot 2)
        osName,
        browserName,
        label: `${slotLabel}: ${browserName} en ${osName}`
    };
}

/**
 * Crea o recupera la Huella Única de Dispositivo (deviceId) para este navegador.
 */
export function getOrCreateDeviceId() {
    const env = detectDeviceEnvironment();
    const prefix = env.category === "desktop" ? "MK-DESK" : "MK-MOB";

    try {
        const saved = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (saved && saved.startsWith(prefix)) {
            return saved;
        }
    } catch (e) {}

    const traits = [
        navigator.userAgent || "",
        navigator.language || "",
        screen?.width || 0,
        screen?.height || 0,
        screen?.colorDepth || 0,
        navigator.hardwareConcurrency || 0,
        Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    ].join("|");

    let hash = 2166136261;
    for (let i = 0; i < traits.length; i++) {
        hash ^= traits.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const hwHex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");

    const rand = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(rand);
    } else {
        rand[0] = Math.floor(Math.random() * 0xffffffff);
    }
    const randHex = (rand[0] >>> 0).toString(16).toUpperCase().padStart(6, "0").slice(0, 6);

    const newId = `${prefix}-${hwHex}-${randHex}`;
    try {
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    } catch (e) {}

    return newId;
}

function getOrCreateSessionToken() {
    let token = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (!token) {
        token = `SES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
    return token;
}

function buildCurrentDevicePayload() {
    const env = detectDeviceEnvironment();
    const deviceId = getOrCreateDeviceId();
    const sessionToken = getOrCreateSessionToken();
    const nowIso = new Date().toISOString();
    const nowReadable = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });

    return {
        deviceId,
        slot: env.category, // "desktop" o "mobile"
        etiqueta: env.label,
        sistemaOperativo: env.osName,
        navegador: env.browserName,
        resolucion: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        sessionToken,
        ultimoAcceso: nowIso,
        ultimoAccesoLegible: nowReadable
    };
}

/**
 * Valida y registra el dispositivo en `usuarios/{uid}.dispositivosRegistrados`.
 * - Cuentas maestras (anthonnyvelastegui@gmail.com / aavemakaihc@gmail.com): Pase libre sin límite.
 * - Estudiantes: Máximo 1 Computadora (desktop) + 1 Celular (mobile).
 */
export async function verifyAndRegisterUserDevice(user) {
    if (!user || !user.uid) return { allowed: false };

    const usersCollection = COLLECTIONS?.USERS || "usuarios";
    const userRef = doc(db, usersCollection, user.uid);
    const isAdmin = verifyMasterAdminAccess(user);
    const currentDevice = buildCurrentDevicePayload();
    const slotKey = currentDevice.slot; // "desktop" | "mobile"

    // 1. PASE LIBRE ILIMITADO PARA TUS 2 CUENTAS MAESTRAS
    if (isAdmin) {
        try {
            await setDoc(userRef, {
                dispositivosRegistrados: {
                    [slotKey]: {
                        ...currentDevice,
                        vinculadoEn: currentDevice.ultimoAcceso,
                        modoAdministradorMaestro: true
                    },
                    politicaDispositivos: "ADMIN_ILIMITADO"
                }
            }, { merge: true });
        } catch (e) {}

        renderProfileDevicesSummary({
            desktop: slotKey === "desktop" ? currentDevice : null,
            mobile: slotKey === "mobile" ? currentDevice : null,
            isMaster: true
        });
        return { allowed: true, isMaster: true };
    }

    // 2. CONTROL DE 2 SLOTS (1 PC + 1 CELULAR) PARA ALUMNOS
    try {
        const snap = await getDoc(userRef);
        const userData = snap.exists() ? snap.data() : {};
        const registeredMap = userData.dispositivosRegistrados || {};
        const existingSlotDevice = registeredMap[slotKey] || null;

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const swapStats = registeredMap.controlReemplazos || { mes: currentMonthKey, usados: 0 };
        if (swapStats.mes !== currentMonthKey) {
            swapStats.mes = currentMonthKey;
            swapStats.usados = 0;
        }

        // CASO A: El Slot (desktop o mobile) está vacío -> Registrar automáticamente
        if (!existingSlotDevice || !existingSlotDevice.deviceId) {
            const updatedDevices = {
                ...registeredMap,
                [slotKey]: {
                    ...currentDevice,
                    vinculadoEn: currentDevice.ultimoAcceso
                },
                controlReemplazos: swapStats,
                maxDispositivosPermitidos: 2
            };

            await setDoc(userRef, { dispositivosRegistrados: updatedDevices }, { merge: true });
            startRealtimeDeviceWatchdog(user.uid, slotKey, currentDevice.deviceId, currentDevice.sessionToken);
            renderProfileDevicesSummary(updatedDevices);
            return { allowed: true, status: "registered_new_slot" };
        }

        // CASO B: Coincide con el dispositivo ya registrado en ese Slot -> Permitir acceso
        if (existingSlotDevice.deviceId === currentDevice.deviceId) {
            const updatedDevices = {
                ...registeredMap,
                [slotKey]: {
                    ...existingSlotDevice,
                    ...currentDevice,
                    vinculadoEn: existingSlotDevice.vinculadoEn || currentDevice.ultimoAcceso
                },
                controlReemplazos: swapStats,
                maxDispositivosPermitidos: 2
            };

            await setDoc(userRef, { dispositivosRegistrados: updatedDevices }, { merge: true });
            startRealtimeDeviceWatchdog(user.uid, slotKey, currentDevice.deviceId, currentDevice.sessionToken);
            renderProfileDevicesSummary(updatedDevices);
            return { allowed: true, status: "matched_existing_slot" };
        }

        // CASO C: Intenta abrir un 2.º PC o un 2.º Celular distinto -> Mostrar Modal de Conflicto
        showDeviceLimitConflictModal({
            user,
            slotKey,
            existingDevice: existingSlotDevice,
            newDevice: currentDevice,
            registeredMap,
            swapStats
        });

        return { allowed: false, status: "slot_conflict" };
    } catch (err) {
        console.warn("[MakaiSecurityGuard] Aviso verificando dispositivos en Firestore:", err);
        return { allowed: true, status: "offline_fallback" };
    }
}

/**
 * Escucha cambios en vivo sobre `usuarios/{uid}` para expulsar en <1s al equipo
 * anterior si se autoriza un reemplazo desde otro dispositivo del mismo tipo.
 */
function startRealtimeDeviceWatchdog(uid, slotKey, myDeviceId, mySessionToken) {
    if (activeDeviceUnsubscribe) {
        try { activeDeviceUnsubscribe(); } catch (e) {}
    }

    const usersCollection = COLLECTIONS?.USERS || "usuarios";
    const userRef = doc(db, usersCollection, uid);

    activeDeviceUnsubscribe = onSnapshot(userRef, async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (verifyMasterAdminAccess(data.email)) return;

        const map = data.dispositivosRegistrados || {};
        const activeSlot = map[slotKey];

        renderProfileDevicesSummary(map);

        if (activeSlot && activeSlot.deviceId && activeSlot.deviceId !== myDeviceId) {
            if (activeDeviceUnsubscribe) {
                activeDeviceUnsubscribe();
                activeDeviceUnsubscribe = null;
            }
            await forceSignOutByRemoteDevice(activeSlot);
        } else if (activeSlot && activeSlot.sessionToken && activeSlot.sessionToken !== mySessionToken) {
            if (activeDeviceUnsubscribe) {
                activeDeviceUnsubscribe();
                activeDeviceUnsubscribe = null;
            }
            await forceSignOutByRemoteDevice(activeSlot);
        }
    }, () => {});
}

async function forceSignOutByRemoteDevice(newActiveDevice) {
    disableExamAntiCheatGuard();
    try { await signOut(auth); } catch (e) {}

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 font-sans";
    overlay.innerHTML = `
        <div class="bg-[#111722] border-2 border-[#ff4d4d] rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div class="w-14 h-14 rounded-2xl bg-[#ff4d4d]/15 border border-[#ff4d4d] text-[#ff4d4d] flex items-center justify-center mx-auto text-2xl">
                🔒
            </div>
            <span class="inline-block px-3 py-1 rounded-full bg-[#ff4d4d]/15 text-[#ff4d4d] text-[10px] font-mono font-extrabold uppercase">
                SESIÓN ABIERTA EN OTRO DISPOSITIVO
            </span>
            <h3 class="text-xl font-extrabold text-white">Se transfirió tu acceso</h3>
            <p class="text-xs text-gray-300 leading-relaxed">
                Tu cuenta permite máximo <strong>1 Computadora + 1 Teléfono Móvil</strong>. Se ha iniciado sesión en:
            </p>
            <div class="p-3 rounded-xl bg-[#06090e] border border-gray-800 text-xs font-mono text-[#00e5ff]">
                ${newActiveDevice.etiqueta || "Nuevo dispositivo"}
            </div>
            <button type="button"
                    onclick="window.location.href='index.html'"
                    class="w-full py-3 rounded-xl bg-[#00e5ff] text-[#06090e] font-extrabold text-xs uppercase tracking-wider">
                Volver al Login
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showDeviceLimitConflictModal({ user, slotKey, existingDevice, newDevice, registeredMap, swapStats }) {
    document.getElementById("makai-device-conflict-modal")?.remove();

    const slotTitle = slotKey === "desktop" ? "COMPUTADORA (SLOT 1)" : "TELÉFONO MÓVIL (SLOT 2)";
    const remainingSwaps = Math.max(0, MAX_SELF_SWAPS_PER_MONTH - (swapStats.usados || 0));
    const canSelfSwap = remainingSwaps > 0;
    const usersCollection = COLLECTIONS?.USERS || "usuarios";

    const modal = document.createElement("div");
    modal.id = "makai-device-conflict-modal";
    modal.className = "fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-sans";
    modal.innerHTML = `
        <div class="bg-[#111722] border-2 border-[#ffbe0b] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div>
                <span class="px-2.5 py-1 rounded-full bg-[#ffbe0b]/15 border border-[#ffbe0b]/40 text-[#ffbe0b] text-[10px] font-mono font-extrabold uppercase">
                    🛡️ LÍMITE DE 2 DISPOSITIVOS (1 PC + 1 CELULAR)
                </span>
                <h3 class="text-lg sm:text-xl font-extrabold text-white mt-2">
                    Espacio ocupado en ${slotTitle}
                </h3>
                <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                    Tu cuenta ya tiene vinculado un equipo en la categoría <strong>${slotTitle}</strong>:
                </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div class="p-3.5 rounded-xl bg-[#06090e] border border-gray-800 space-y-1">
                    <span class="text-[10px] text-gray-400 uppercase block">EQUIPO VINCULADO ACTUAL</span>
                    <strong class="text-white block">${existingDevice.etiqueta || "Equipo registrado"}</strong>
                    <span class="text-[10px] text-gray-500 block">ID: ${existingDevice.deviceId}</span>
                </div>
                <div class="p-3.5 rounded-xl bg-[#06090e] border border-[#00e5ff]/50 space-y-1">
                    <span class="text-[10px] text-[#00e5ff] uppercase block">ESTE DISPOSITIVO NUEVO</span>
                    <strong class="text-white block">${newDevice.etiqueta}</strong>
                    <span class="text-[10px] text-gray-500 block">ID: ${newDevice.deviceId}</span>
                </div>
            </div>

            ${canSelfSwap ? `
                <div class="p-3 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-xs text-gray-200">
                    ⚡ Tienes <strong>${remainingSwaps} cambio(s) disponible(s) este mes</strong>. Si vinculas este equipo, se cerrará automáticamente la sesión en el anterior.
                </div>
            ` : `
                <div class="p-3 rounded-xl bg-[#ff4d4d]/15 border border-[#ff4d4d]/40 text-xs text-gray-200">
                    🔒 Has alcanzado el límite mensual de cambios de dispositivo. Solicita la desvinculación al Administrador Maestro para autorizar este nuevo equipo.
                </div>
            `}

            <div id="device-conflict-feedback" class="hidden p-3 rounded-xl text-xs font-mono"></div>

            <div class="flex flex-col sm:flex-row justify-end gap-2.5 pt-2">
                <button type="button" id="btn-cancel-device-login" class="px-4 py-2.5 rounded-xl bg-[#06090e] border border-gray-700 text-xs font-bold text-gray-300">
                    Cerrar Sesión Aquí
                </button>
                ${canSelfSwap ? `
                    <button type="button" id="btn-replace-slot-device" class="px-5 py-2.5 rounded-xl bg-[#00e5ff] text-[#06090e] font-extrabold text-xs uppercase">
                        Vincular Este Equipo y Cerrar el Anterior →
                    </button>
                ` : `
                    <button type="button" id="btn-request-admin-device-reset" class="px-5 py-2.5 rounded-xl bg-[#ffbe0b] text-[#06090e] font-extrabold text-xs uppercase">
                        Notificar al Administrador Maestro
                    </button>
                `}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-cancel-device-login")?.addEventListener("click", () => {
        secureSignOut("Inicio de sesión cancelado por límite de dispositivos.");
    });

    document.getElementById("btn-replace-slot-device")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Vinculando...";

        try {
            const updatedDevices = {
                ...registeredMap,
                [slotKey]: {
                    ...newDevice,
                    vinculadoEn: newDevice.ultimoAcceso,
                    reemplazoAnteriorId: existingDevice.deviceId
                },
                controlReemplazos: {
                    mes: swapStats.mes,
                    usados: (swapStats.usados || 0) + 1
                },
                maxDispositivosPermitidos: 2
            };

            await setDoc(doc(db, usersCollection, user.uid), {
                dispositivosRegistrados: updatedDevices
            }, { merge: true });

            modal.remove();
            startRealtimeDeviceWatchdog(user.uid, slotKey, newDevice.deviceId, newDevice.sessionToken);
            renderProfileDevicesSummary(updatedDevices);

            if (detectCurrentPageType() === "index") {
                window.location.href = "dashboard.html";
            }
        } catch (err) {
            btn.disabled = false;
        }
    });

    document.getElementById("btn-request-admin-device-reset")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            await setDoc(doc(db, usersCollection, user.uid), {
                dispositivosRegistrados: {
                    ...registeredMap,
                    solicitudResetPendiente: {
                        solicitadoEn: new Date().toISOString(),
                        slotSolicitado: slotKey,
                        nuevoDispositivo: newDevice
                    }
                }
            }, { merge: true });

            const fb = document.getElementById("device-conflict-feedback");
            if (fb) {
                fb.className = "p-3 rounded-xl border border-[#94de2d] bg-[#94de2d]/15 text-[#94de2d] text-xs font-mono";
                fb.textContent = "✅ Solicitud enviada al Administrador Maestro.";
                fb.classList.remove("hidden");
            }
        } catch (err) {
            btn.disabled = false;
        }
    });
}

function renderProfileDevicesSummary(devicesMap = {}) {
    const profileView = document.getElementById("view-profile");
    if (!profileView) return;

    let box = document.getElementById("profile-devices-security-card");
    if (!box) {
        box = document.createElement("div");
        box.id = "profile-devices-security-card";
        box.className = "bg-surface-container border border-primary/40 rounded-2xl p-6 space-y-4 mt-6";
        profileView.appendChild(box);
    }

    const desktopSlot = devicesMap.desktop || null;
    const mobileSlot = devicesMap.mobile || null;
    const currentId = getOrCreateDeviceId();

    box.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
            <div>
                <span class="text-[10px] font-mono text-primary uppercase font-extrabold">PROTECCIÓN ANTI-PRÉSTAMO • MÁXIMO 2 DISPOSITIVOS</span>
                <h3 class="text-lg font-extrabold text-white mt-0.5">Mis Dispositivos Vinculados (1 PC + 1 Celular)</h3>
            </div>
            <span class="px-3 py-1 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary font-mono text-xs font-bold">
                ${devicesMap.isMaster ? "⚡ ADMIN MAESTRO (SIN LÍMITE)" : "1 Computadora + 1 Móvil"}
            </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div class="p-4 rounded-xl bg-surface border ${desktopSlot ? 'border-primary/50' : 'border-surface-high'} space-y-1">
                <div class="flex items-center justify-between">
                    <span class="text-primary font-extrabold">💻 SLOT 1 • COMPUTADORA (DESKTOP)</span>
                    ${desktopSlot?.deviceId === currentId ? '<span class="text-secondary font-bold">● ACTIVO AQUÍ</span>' : ''}
                </div>
                ${desktopSlot ? `
                    <p class="text-white font-bold">${desktopSlot.etiqueta}</p>
                    <p class="text-gray-400 text-[11px]">ID: ${desktopSlot.deviceId}</p>
                    <p class="text-gray-500 text-[10px]">Último acceso: ${desktopSlot.ultimoAccesoLegible || desktopSlot.ultimoAcceso}</p>
                ` : `<p class="text-gray-400">Libre • Se registrará al abrir sesión en tu computadora.</p>`}
            </div>

            <div class="p-4 rounded-xl bg-surface border ${mobileSlot ? 'border-secondary/50' : 'border-surface-high'} space-y-1">
                <div class="flex items-center justify-between">
                    <span class="text-secondary font-extrabold">📱 SLOT 2 • TELÉFONO / CELULAR (MOBILE)</span>
                    ${mobileSlot?.deviceId === currentId ? '<span class="text-secondary font-bold">● ACTIVO AQUÍ</span>' : ''}
                </div>
                ${mobileSlot ? `
                    <p class="text-white font-bold">${mobileSlot.etiqueta}</p>
                    <p class="text-gray-400 text-[11px]">ID: ${mobileSlot.deviceId}</p>
                    <p class="text-gray-500 text-[10px]">Último acceso: ${mobileSlot.ultimoAccesoLegible || mobileSlot.ultimoAcceso}</p>
                ` : `<p class="text-gray-400">Libre • Se registrará al abrir sesión en tu teléfono móvil.</p>`}
            </div>
        </div>
    `;
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
        showSecurityToast,
        detectDeviceEnvironment,
        getOrCreateDeviceId,
        verifyAndRegisterUserDevice
    };
}
