// ============================================================================
// ARCHIVO: js/2-core/app.orchestrator.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Director de Orquesta Principal, Ciclo de Vida de Sesión,
//                  Enrutamiento entre Páginas y Carga Dinámica Anticaídas.
// ============================================================================

import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "./firebase.service.js";

import * as StateStore from "./state.store.js";

// --- LISTA OFICIAL DE ADMINISTRADORES MAESTROS (RESPALDO DE SEGURIDAD) ---
const FALLBACK_MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

// Bandera interna para evitar múltiples inicializaciones del DOM
let appBootstrapped = false;
let dashboardBootstrapped = false;

/**
 * Verifica si un correo pertenece a una cuenta maestra de administración.
 * Utiliza `isMasterAdmin` de state.store.js con respaldo local garantizado.
 * @param {string} email
 * @returns {boolean}
 */
export function checkMasterAdmin(email) {
    if (!email) return false;
    if (typeof StateStore.isMasterAdmin === "function") {
        return StateStore.isMasterAdmin(email);
    }
    return FALLBACK_MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Actualiza de forma segura el estado global en `state.store.js`
 * sin importar cómo esté estructurado el archivo en este momento.
 * @param {Object|null} user - Objeto User de Firebase Auth
 * @param {Object|null} userData - Documento del usuario desde Firestore
 */
function updateGlobalSessionState(user, userData) {
    if (typeof StateStore.setSessionState === "function") {
        StateStore.setSessionState(user, userData);
    }
    if (StateStore.appState) {
        StateStore.appState.currentUser = user;
        StateStore.appState.currentUserData = userData;
        if (userData?.carrera) {
            StateStore.appState.currentCareer = userData.carrera;
        }
    }
    // Exposición global de lectura rápida para módulos complementarios
    window.makaiCurrentUser = user;
    window.makaiCurrentUserData = userData;
}

/**
 * Detecta en cuál de las 3 pantallas principales se encuentra el navegador.
 * Compatible con GitHub Pages (/MakaiAcademy/) y servidores locales.
 * @returns {{ isIndexPage: boolean, isRegisterPage: boolean, isDashboardPage: boolean, pageName: string }}
 */
export function detectCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    const hasAuthForm = !!document.getElementById("auth-form");
    const hasRegisterForm = !!document.getElementById("full-register-form") || !!document.getElementById("registration-card");
    const hasDashboardContainer = !!document.getElementById("views-container");

    const isDashboardPage = hasDashboardContainer || path.endsWith("/dashboard.html") || path.endsWith("dashboard.html");
    const isRegisterPage = (!isDashboardPage && hasRegisterForm) || path.endsWith("/registro.html") || path.endsWith("registro.html");
    const isIndexPage = (!isDashboardPage && !isRegisterPage) || hasAuthForm || path.endsWith("/index.html") || path.endsWith("/makaiacademy/");

    let pageName = "index";
    if (isDashboardPage) pageName = "dashboard";
    else if (isRegisterPage) pageName = "registro";

    return {
        isIndexPage,
        isRegisterPage,
        isDashboardPage,
        pageName
    };
}

/**
 * Importa dinámicamente un módulo ES6 y ejecuta su función de inicio si existe.
 * Si el archivo aún está vacío (archivo semilla en GitHub), captura el aviso
 * silenciosamente sin detener la plataforma.
 * @param {string} modulePath - Ruta relativa al módulo desde js/2-core/
 * @param {string|string[]} initFnNames - Nombre(s) de la función a invocar
 * @param  {...any} args - Argumentos opcionales para pasar a la función
 * @returns {Promise<Object|null>}
 */
export async function safeLoadModule(modulePath, initFnNames = [], ...args) {
    try {
        const mod = await import(modulePath);
        const candidates = Array.isArray(initFnNames) ? initFnNames : [initFnNames];

        for (const fnName of candidates) {
            if (fnName && typeof mod[fnName] === "function") {
                await mod[fnName](...args);
                break;
            }
        }
        return mod;
    } catch (err) {
        console.warn(`[Orchestrator] Módulo en espera o semilla (${modulePath}):`, err.message || err);
        return null;
    }
}

/**
 * Carga el diccionario curricular (`curriculum.data.js`) y asegura que
 * `window.makaiData` tenga una estructura base válida para evitar fallos en
 * selectores de carreras y materias.
 */
async function ensureCurriculumDataLoaded() {
    const curriculumMod = await safeLoadModule("./curriculum.data.js", ["initCurriculumData"]);

    if (curriculumMod?.makaiData && !window.makaiData) {
        window.makaiData = curriculumMod.makaiData;
    }

    // Semilla de respaldo mínima en caso de que curriculum.data.js aún esté vacío
    if (!window.makaiData || !Array.isArray(window.makaiData.carreras)) {
        window.makaiData = {
            carreras: [
                {
                    id: "medicina",
                    nombre: "Medicina Humana (FCS-EC)",
                    activa: true,
                    materias: [
                        "Medicina Interna",
                        "Pediatría",
                        "Ginecología y Obstetricia",
                        "Cirugía General",
                        "Salud Pública y Bioética",
                        "Urgencias y Cuidados Críticos"
                    ]
                },
                {
                    id: "enfermeria",
                    nombre: "Enfermería & Cuidados Críticos",
                    activa: true,
                    materias: [
                        "Enfermería Clínico-Quirúrgica",
                        "Enfermería Materno-Infantil",
                        "Salud Comunitaria y Epidemiología",
                        "Farmacología Aplicada",
                        "Gestión y Bioética en Enfermería",
                        "Cuidados Intensivos y Emergencias"
                    ]
                },
                {
                    id: "odontologia",
                    nombre: "Odontología Clínica",
                    activa: false,
                    materias: [
                        "Patología y Diagnóstico Oral",
                        "Cirugía Oral y Maxilofacial",
                        "Endodoncia y Periodoncia",
                        "Rehabilitación y Operatoria Dental",
                        "Odontopediatría y Ortodoncia",
                        "Farmacología y Bioseguridad Odontológica"
                    ]
                },
                {
                    id: "obstetricia",
                    nombre: "Obstetricia & Salud Materna",
                    activa: false,
                    materias: [
                        "Obstetricia Fisiológica y Alto Riesgo",
                        "Ginecología y Salud Sexual",
                        "Neonatología e Inmunizaciones",
                        "Salud Pública y Normativa MSP",
                        "Farmacología Obstétrica",
                        "Emergencias Obstétricas (Clave Roja/Azul/Amarilla)"
                    ]
                }
            ],
            semillaCasos: []
        };
    }
}

/**
 * Verifica si el usuario autenticado cumple con la validación de correo electrónico.
 * Los administradores maestros tienen pase directo automático.
 * @param {Object} user - Usuario de Firebase Authentication
 * @returns {Promise<boolean>}
 */
export async function verifyUserAccessStatus(user) {
    if (!user) return false;

    // 1. Pase directo para cuentas maestras de administración
    if (checkMasterAdmin(user.email)) {
        return true;
    }

    // 2. Verificación para cuentas autenticadas con Google
    const isGoogleProvider = user.providerData?.some(p => p.providerId === "google.com");
    if (isGoogleProvider) {
        try {
            const snap = await getDoc(doc(db, "usuarios", user.uid));
            if (snap.exists() && snap.data().correoConfirmadoMakai === true) {
                return true;
            }
        } catch (err) {
            console.warn("[Orchestrator] Consulta de verificación Gmail en espera:", err);
        }
        if (localStorage.getItem(`makai_gmail_verified_${user.uid}`) === "true") {
            return true;
        }
        // Si el token de Google ya reporta emailVerified, permitir acceso
        return !!user.emailVerified;
    }

    // 3. Verificación estándar por enlace de correo
    return !!user.emailVerified;
}

/**
 * Sincroniza el perfil del usuario autenticado con la colección `usuarios` en Cloud Firestore.
 * Garantiza que los administradores maestros tengan siempre `rol: "admin"` y `subscriptionLevel: "PRO"`.
 * @param {Object} user - Usuario activo de Firebase Authentication
 * @returns {Promise<Object>} Datos consolidados del usuario
 */
export async function syncUserProfileWithFirestore(user) {
    const isAdmin = checkMasterAdmin(user.email);
    const nowIso = new Date().toISOString();

    const fallbackProfile = {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || user.email.split("@")[0],
        primerNombre: (user.displayName || user.email.split("@")[0]).split(" ")[0],
        rol: isAdmin ? "admin" : "estudiante",
        subscriptionLevel: isAdmin ? "PRO" : "Básico",
        estadoPago: isAdmin ? "activo_verificado" : "activo_gratis",
        carrera: "medicina",
        correoConfirmadoMakai: true,
        casesUsedThisMonth: 0,
        totalExamsCompleted: 0,
        globalAverage: 0,
        createdAt: nowIso,
        lastLoginAt: nowIso
    };

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            await setDoc(userRef, fallbackProfile);
            return fallbackProfile;
        }

        const existingData = snap.data();
        const mergedData = {
            ...fallbackProfile,
            ...existingData,
            uid: user.uid,
            email: user.email,
            lastLoginAt: nowIso
        };

        // Blindaje permanente para las cuentas maestras de administración
        if (isAdmin) {
            mergedData.rol = "admin";
            mergedData.subscriptionLevel = "PRO";
            mergedData.estadoPago = "activo_verificado";
            mergedData.correoConfirmadoMakai = true;

            if (existingData.rol !== "admin" || existingData.subscriptionLevel !== "PRO") {
                await updateDoc(userRef, {
                    rol: "admin",
                    subscriptionLevel: "PRO",
                    estadoPago: "activo_verificado",
                    correoConfirmadoMakai: true,
                    lastLoginAt: nowIso
                }).catch(() => {});
            }
        }

        return mergedData;
    } catch (fireErr) {
        console.warn("[Orchestrator] Usando perfil en memoria mientras responde Cloud Firestore:", fireErr);
        return fallbackProfile;
    }
}

/**
 * Conmutador de vistas SPA para `dashboard.html`.
 * Si `router.spa.js` ya está programado, delega la navegación a ese módulo;
 * de lo contrario, ejecuta el cambio visual directamente sobre `.tab-content`.
 * @param {string} viewId - ID del contenedor de vista (ej: "view-launcher", "view-admin")
 */
export function switchView(viewId) {
    if (!viewId) return;

    const allTabs = document.querySelectorAll(".tab-content");
    allTabs.forEach(tab => {
        tab.classList.remove("active");
        tab.classList.add("hidden");
    });

    const targetTab = document.getElementById(viewId);
    if (targetTab) {
        targetTab.classList.remove("hidden");
        targetTab.classList.add("active");
    }

    if (StateStore.appState) {
        StateStore.appState.currentActiveView = viewId;
    }

    // Actualizar estado visual de los botones del menú lateral
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.dataset.target === viewId) {
            btn.classList.remove("text-gray-400", "hover:bg-surface-high");
            btn.classList.add("bg-primary", "text-surface-container");
        } else {
            btn.classList.remove("bg-primary", "text-surface-container");
            btn.classList.add("text-gray-400");
            if (!btn.id?.includes("admin")) {
                btn.classList.add("hover:bg-surface-high");
            }
        }
    });
}

/**
 * Configura los controles esenciales del Dashboard (Cabecera de perfil,
 * botón de Cerrar Sesión, navegación base y avisos Toast) y despierta
 * ordenadamente a todos los controladores de las carpetas `1-admin` a `8-classrooms`.
 * @param {Object} user - Usuario autenticado en Firebase
 * @param {Object} userData - Datos del perfil desde Firestore
 */
export async function initDashboardOrchestration(user, userData) {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;

    const isAdmin = checkMasterAdmin(user.email);

    // 1. Poblar información del estudiante / administrador en la barra superior
    const nameEl = document.getElementById("user-name");
    const avatarEl = document.getElementById("user-avatar");
    const planEl = document.getElementById("user-plan");

    const displayName = userData.nombre || userData.nickname || user.displayName || user.email;
    const avatarInitial = (userData.primerNombre || displayName || "M").trim().charAt(0).toUpperCase();

    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = avatarInitial;
    if (planEl) {
        planEl.textContent = isAdmin
            ? "ADMIN MAESTRO • PRO"
            : `Plan ${userData.subscriptionLevel || "Básico"}`;
    }

    // 2. Desbloquear botones del Panel de Administración para cuentas maestras
    const adminNavBtn = document.getElementById("admin-nav-btn");
    const headerAdminBtn = document.getElementById("header-admin-btn");

    if (isAdmin) {
        adminNavBtn?.classList.remove("hidden");
        headerAdminBtn?.classList.remove("hidden");
    } else {
        adminNavBtn?.classList.add("hidden");
        headerAdminBtn?.classList.add("hidden");
    }

    // 3. Enlazar botón de Cerrar Sesión (#btn-logout)
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.boundLogout) {
        logoutBtn.dataset.boundLogout = "1";
        logoutBtn.addEventListener("click", async () => {
            if (StateStore.appState?.isExamActive) {
                if (!confirm("Tienes un simulacro en curso. ¿Deseas cerrar sesión y salir?")) return;
            }
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (err) {
                console.error("[Orchestrator] Error al cerrar sesión:", err);
            }
        });
    }

    // 4. Enlazar navegación base por pestañas (.nav-btn y #header-admin-btn)
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.dataset.boundNav) return;
        btn.dataset.boundNav = "1";
        btn.addEventListener("click", () => {
            const targetView = btn.dataset.target;
            if (!targetView) return;

            if (StateStore.appState?.isExamActive && targetView !== "view-simulator") {
                if (!confirm("Tienes un simulacro activo. ¿Deseas abandonar el examen actual?")) {
                    return;
                }
                StateStore.appState.isExamActive = false;
            }
            switchView(targetView);
        });
    });

    if (headerAdminBtn && !headerAdminBtn.dataset.boundAdminHeader) {
        headerAdminBtn.dataset.boundAdminHeader = "1";
        headerAdminBtn.addEventListener("click", () => {
            if (isAdmin) switchView("view-admin");
        });
    }

    // 5. Enlazar botones con sello "(Próximamente)" y notificación Toast
    const upcomingBtns = document.querySelectorAll(".upcoming-feature");
    const toastEl = document.getElementById("toast");
    upcomingBtns.forEach(btn => {
        if (btn.dataset.boundToast) return;
        btn.dataset.boundToast = "1";
        btn.addEventListener("click", () => {
            if (!toastEl) return;
            toastEl.classList.remove("translate-y-24", "opacity-0");
            setTimeout(() => {
                toastEl.classList.add("translate-y-24", "opacity-0");
            }, 3000);
        });
    });

    // 6. Cargar Diccionario Curricular (js/2-core/curriculum.data.js)
    await ensureCurriculumDataLoaded();

    // 7. Despertar Router SPA (js/2-core/router.spa.js)
    await safeLoadModule("./router.spa.js", ["initRouterSPA", "initRouter"], user, userData);

    // 8. Despertar Guardia de Seguridad y Paywall Freemium (js/3-security/)
    await Promise.all([
        safeLoadModule("../3-security/security.guard.js", ["initSecurityGuard"], user, userData),
        safeLoadModule("../3-security/paywall.traffic.js", ["initPaywallTraffic", "initPaywall"], userData)
    ]);

    // 9. Despertar Motores Académicos y Clínicos (Carpetas 4, 5, 6, 7 y 8)
    await Promise.all([
        safeLoadModule("../4-exams/exam.controller.js", ["initExamController", "initSimulator", "initLauncher"], userData),
        safeLoadModule("../5-engine-1d/engine1d.controller.js", ["initEngine1D", "initSpacedRepetition"], userData),
        safeLoadModule("../6-engine-2d/sim2d.controller.js", ["initSim2DController", "initSim2D"], userData),
        safeLoadModule("../7-engine-3d/sim3d.controller.js", ["initSim3DController", "initSim3D"], userData),
        safeLoadModule("../8-classrooms/classroom.controller.js", ["initClassroomController", "initClassrooms"], userData)
    ]);

    // 10. Actualizar tarjeta rápida de Métricas si existen los indicadores en el DOM
    const metricAvg = document.getElementById("metric-avg");
    const metricExams = document.getElementById("metric-exams");
    const metricCases = document.getElementById("metric-cases");

    if (metricAvg) metricAvg.textContent = `${Number(userData.globalAverage || 0).toFixed(1)}%`;
    if (metricExams) metricExams.textContent = String(userData.totalExamsCompleted || 0);
    if (metricCases) {
        metricCases.textContent = isAdmin || userData.subscriptionLevel !== "Básico"
            ? `${userData.casesUsedThisMonth || 0} / ∞`
            : `${userData.casesUsedThisMonth || 0} / 15`;
    }

    // 11. Despertar Bóveda de Administración (js/1-admin/admin.controller.js) exclusivamente para Cuentas Maestras
    if (isAdmin) {
        await safeLoadModule("../1-admin/admin.controller.js", ["initAdminController", "initAdmin"]);
    }
}

/**
 * Punto de entrada principal del Director de Orquesta (`initApp`).
 * Coordina la inicialización de `index.html`, `registro.html` y `dashboard.html`.
 */
export async function initApp() {
    if (appBootstrapped) return;
    appBootstrapped = true;

    const { isIndexPage, isRegisterPage, isDashboardPage, pageName } = detectCurrentPage();

    // 1. Si estamos en index.html, activar inmediatamente la interfaz de Login y Planes
    if (isIndexPage) {
        await safeLoadModule("../3-security/auth.login.js", ["initAuthLogin", "initAuthUI"]);
    }

    // 2. Si estamos en registro.html, activar el formulario de expedientes, pagos QR y verificador
    if (isRegisterPage) {
        await Promise.all([
            safeLoadModule("../3-security/auth.register.js", ["initAuthRegister", "initRegisterUI"]),
            safeLoadModule("../3-security/auth.verifier.js", ["initAuthVerifier"])
        ]);
    }

    // 3. Escuchar en tiempo real el estado de sesión en Firebase Authentication
    onAuthStateChanged(auth, async (user) => {
        // CASO A: No hay sesión iniciada
        if (!user) {
            updateGlobalSessionState(null, null);

            // Proteger dashboard.html contra accesos sin sesión
            if (isDashboardPage) {
                window.location.href = "index.html";
            }
            return;
        }

        // CASO B: Usuario autenticado -> Comprobar verificación de correo
        const isVerified = await verifyUserAccessStatus(user);

        if (!isVerified) {
            if (isDashboardPage) {
                window.location.href = "registro.html?verify=pending";
                return;
            }
            if (isRegisterPage) {
                const verifierMod = await safeLoadModule("../3-security/auth.verifier.js");
                if (verifierMod && typeof verifierMod.showVerificationPendingScreen === "function") {
                    verifierMod.showVerificationPendingScreen(user);
                }
            }
            return;
        }

        // CASO C: Usuario autenticado y verificado -> Sincronizar con Cloud Firestore
        const userData = await syncUserProfileWithFirestore(user);
        updateGlobalSessionState(user, userData);

        const isAdmin = checkMasterAdmin(user.email);

        // Redirección inteligente si el usuario acaba de iniciar sesión en index.html
        if (isIndexPage) {
            const pendingPlan = sessionStorage.getItem("makai_selected_plan");
            const pendingBilling = sessionStorage.getItem("makai_selected_billing") || "annual";

            if (pendingPlan && (pendingPlan === "PRO" || pendingPlan === "VIP") && !isAdmin) {
                sessionStorage.removeItem("makai_selected_plan");
                window.location.href = `registro.html?plan=${pendingPlan}&billing=${pendingBilling}`;
            } else {
                window.location.href = "dashboard.html";
            }
            return;
        }

        // Si el usuario ya verificado entra a registro.html sin estar subiendo un nuevo comprobante
        if (isRegisterPage) {
            const urlParams = new URLSearchParams(window.location.search);
            const hasActivePlanUpgrade = urlParams.has("plan") || urlParams.has("pago");

            if (!hasActivePlanUpgrade) {
                window.location.href = "dashboard.html";
                return;
            }
        }

        // Inicializar todos los módulos del lienzo principal si estamos en dashboard.html
        if (isDashboardPage) {
            await initDashboardOrchestration(user, userData);
        }
    });

    console.info(`[MakaiOrchestrator] Sistema inicializado en vista: ${pageName.toUpperCase()}`);
}

// Exponer utilidades del Orquestador en window para comunicación entre módulos
window.MakaiOrchestrator = {
    initApp,
    detectCurrentPage,
    switchView,
    safeLoadModule,
    checkMasterAdmin,
    verifyUserAccessStatus,
    syncUserProfileWithFirestore
};

// Auto-arranque al cargar el DOM en index.html, registro.html o dashboard.html
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
