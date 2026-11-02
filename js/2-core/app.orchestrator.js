// ============================================================================
// ARCHIVO: js/2-core/app.orchestrator.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Director de Orquesta, RBAC, Auto-Degradación de Planes,
//                  Embudo Universitario y Carga Dinámica de los 10 Dominios.
// ============================================================================

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
} from "./firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin,
    setSessionState
} from "./state.store.js";

let appBootstrapped = false;
let dashboardBootstrapped = false;

/**
 * Verifica si un correo pertenece al Olimpo (Administrador Maestro).
 */
export function checkMasterAdmin(email) {
    return isMasterAdmin(email);
}

/**
 * Detecta en cuál de las 3 pantallas principales se encuentra el navegador.
 */
export function detectCurrentPage() {
    const path = (window.location.pathname || "").toLowerCase();
    const hasAuthForm = !!document.getElementById("auth-form");
    const hasRegisterForm = !!document.getElementById("full-register-form") || !!document.getElementById("registration-card");
    const hasDashboardContainer = !!document.getElementById("views-container");

    const isDashboardPage = hasDashboardContainer || path.endsWith("/dashboard.html") || path.endsWith("dashboard.html");
    const isRegisterPage = (!isDashboardPage && hasRegisterForm) || path.endsWith("/registro.html") || path.endsWith("registro.html");
    const isIndexPage = (!isDashboardPage && !isRegisterPage) || hasAuthForm || path.endsWith("/index.html") || path.endsWith("/makaiacademy/");

    let pageName = "index";
    if (isDashboardPage) pageName = "dashboard";
    else if (isRegisterPage) pageName = "registro";

    return { isIndexPage, isRegisterPage, isDashboardPage, pageName };
}

/**
 * Importador dinámico anticaídas (Tolerante a archivos en construcción).
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
        console.warn(`[Orchestrator] Módulo en espera (${modulePath}):`, err.message || err);
        return null;
    }
}

/**
 * Carga el diccionario curricular base para las 11 carreras de salud.
 */
async function ensureCurriculumDataLoaded() {
    const curriculumMod = await safeLoadModule("./curriculum.data.js", ["initCurriculumData"]);

    if (curriculumMod?.makaiData && !window.makaiData) {
        window.makaiData = curriculumMod.makaiData;
    }

    if (!window.makaiData || !Array.isArray(window.makaiData.carreras)) {
        window.makaiData = {
            carreras: [
                { id: "medicina", nombre: "Medicina Humana", caces: true, activa: true, materias: ["Medicina Interna", "Pediatría", "Ginecología y Obstetricia", "Cirugía General", "Salud Pública y Bioética", "Urgencias y Cuidados Críticos"] },
                { id: "enfermeria", nombre: "Enfermería", caces: true, activa: true, materias: ["Enfermería Clínico-Quirúrgica", "Enfermería Materno-Infantil", "Salud Comunitaria", "Farmacología Aplicada", "Gestión en Enfermería", "Cuidados Intensivos"] },
                { id: "odontologia", nombre: "Odontología", caces: true, activa: true, materias: ["Patología Oral", "Cirugía Maxilofacial", "Endodoncia y Periodoncia", "Rehabilitación Oral", "Odontopediatría", "Farmacología Odontológica"] },
                { id: "obstetricia", nombre: "Obstetricia", caces: true, activa: true, materias: ["Obstetricia Fisiológica y Alto Riesgo", "Ginecología y Salud Sexual", "Neonatología", "Salud Pública MSP", "Farmacología Obstétrica", "Claves Obstétricas"] },
                { id: "fisioterapia", nombre: "Fisioterapia", caces: false, activa: true, materias: ["Biomecánica", "Rehabilitación Neurológica", "Fisioterapia Deportiva", "Terapia Respiratoria"] },
                { id: "laboratorio", nombre: "Laboratorio Clínico", caces: false, activa: true, materias: ["Hematología", "Microbiología Clínica", "Bioquímica Clínica", "Inmunología"] },
                { id: "psicologia", nombre: "Psicología Clínica", caces: false, activa: true, materias: ["Psicopatología", "Evaluación Psicológica", "Psicoterapia", "Neuropsicología"] },
                { id: "nutricion", nombre: "Nutrición y Dietética", caces: false, activa: true, materias: ["Dietoterapia", "Evaluación Nutricional", "Bioquímica de la Nutrición"] },
                { id: "bioquimica", nombre: "Bioquímica y Farmacia", caces: false, activa: true, materias: ["Farmacología Clínica", "Toxicología", "Química Farmacéutica"] },
                { id: "imagenologia", nombre: "Imagenología y Radiología", caces: false, activa: true, materias: ["Radiodiagnóstico", "Tomografía y RMN", "Protección Radiológica"] },
                { id: "prehospitalaria", nombre: "Atención Prehospitalaria", caces: false, activa: true, materias: ["Soporte Vital Básico y Avanzado", "Trauma Prehospitalario", "Desastres y Triage"] }
            ],
            semillaCasos: []
        };
    }
}

/**
 * Comprueba la verificación de correo (Pase directo para Master Admins).
 */
export async function verifyUserAccessStatus(user) {
    if (!user) return false;
    if (checkMasterAdmin(user.email)) return true;

    const isGoogleProvider = user.providerData?.some(p => p.providerId === "google.com");
    if (isGoogleProvider) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
            if (snap.exists() && snap.data().correoConfirmadoMakai === true) return true;
        } catch (err) {}
        if (localStorage.getItem(`makai_gmail_verified_${user.uid}`) === "true") return true;
        return !!user.emailVerified;
    }

    return !!user.emailVerified;
}

/**
 * Sincroniza el expediente con Firestore y ejecuta la AUTO-DEGRADACIÓN DE PLANES VENCIDOS.
 */
export async function syncUserProfileWithFirestore(user) {
    const isMaster = checkMasterAdmin(user.email);
    const now = new Date();
    const nowIso = now.toISOString();

    const fallbackProfile = {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || user.email.split("@")[0],
        primerNombre: (user.displayName || user.email.split("@")[0]).split(" ")[0],
        rol: isMaster ? "master" : "estudiante",
        subscriptionLevel: isMaster ? "PRO" : "Básico",
        estadoPago: isMaster ? "activo_verificado" : "activo_gratis",
        carrera: "medicina",
        semestreActual: 1,
        correoConfirmadoMakai: true,
        casesUsedThisMonth: 0,
        totalExamsCompleted: 0,
        globalAverage: 0,
        fechaVencimientoPlan: null,
        createdAt: nowIso,
        lastLoginAt: nowIso
    };

    try {
        const userRef = doc(db, COLLECTIONS.USERS, user.uid);
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

        // 1. BLINDAJE OLIMPO (Administradores Maestros)
        if (isMaster) {
            mergedData.rol = "master";
            mergedData.subscriptionLevel = "PRO";
            mergedData.estadoPago = "activo_verificado";
            mergedData.correoConfirmadoMakai = true;

            if (existingData.rol !== "master" || existingData.subscriptionLevel !== "PRO") {
                await updateDoc(userRef, {
                    rol: "master",
                    subscriptionLevel: "PRO",
                    estadoPago: "activo_verificado",
                    correoConfirmadoMakai: true,
                    lastLoginAt: nowIso
                }).catch(() => {});
            }
            return mergedData;
        }

        // 2. RIEL DE ACERO: AUTO-DEGRADACIÓN DE CUENTAS VENCIDAS
        if (mergedData.fechaVencimientoPlan && mergedData.subscriptionLevel !== "Básico") {
            const expDate = new Date(mergedData.fechaVencimientoPlan);
            if (!isNaN(expDate.getTime()) && now > expDate) {
                mergedData.subscriptionLevel = "Básico";
                mergedData.estadoPago = "vencido";
                await updateDoc(userRef, {
                    subscriptionLevel: "Básico",
                    estadoPago: "vencido",
                    degradadoAutomaticamenteEn: nowIso
                }).catch(() => {});
            }
        }

        return mergedData;
    } catch (fireErr) {
        console.warn("[Orchestrator] Operando con perfil en memoria por latencia de red:", fireErr);
        return fallbackProfile;
    }
}

/**
 * Conmutador de vistas SPA con verificación de privilegios.
 */
export function switchView(viewId) {
    if (!viewId) return;

    // Bloquear acceso a #view-admin si es un estudiante común
    const staffRoles = ["master", "secretaria", "dev_3d"];
    if (viewId === "view-admin" && !staffRoles.includes(appState.role)) {
        console.warn("[Orchestrator] Acceso denegado a Bóveda Admin para rol:", appState.role);
        return;
    }

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

    appState.currentActiveView = viewId;

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
 * EL EMBUDO UNIVERSITARIO: Aísla al estudiante únicamente en su carrera registrada
 * y aplica bloqueo estratégico al CACES si está en semestres iniciales.
 */
export function applyStudentCareerTunnel(userData) {
    if (appState.role !== "estudiante") return;

    const studentCareer = (userData?.carrera || "medicina").toLowerCase();
    const studentSemester = Number(userData?.semestreActual || 1);

    // 1. Ocultar cualquier botón de otra carrera en el menú lateral
    const careerItems = document.querySelectorAll("[data-career]");
    careerItems.forEach(item => {
        const itemCareer = (item.dataset.career || "").toLowerCase();
        if (itemCareer && itemCareer !== studentCareer) {
            item.classList.add("hidden");
        } else {
            item.classList.remove("hidden");
        }
    });

    // 2. Renombrar etiqueta de menú "Carreras de Salud" a "MI CARRERA"
    const careerMenuLabel = document.getElementById("label-carreras-salud");
    if (careerMenuLabel) {
        careerMenuLabel.textContent = "MI CARRERA";
    }

    // 3. Bloqueo estratégico de CACES para semestres inferiores a Internado (1° a 8° semestre)
    const cacesNavBtn = document.querySelector('[data-target="view-launcher"]');
    if (cacesNavBtn && studentSemester < 9 && userData?.etapaAcademica !== "egresado" && userData?.etapaAcademica !== "internado") {
        cacesNavBtn.dataset.cacesLockedBySemester = "true";
    }
}

/**
 * Inicializa el Dashboard aplicando Ceguera por Diseño según el Rol (RBAC).
 */
export async function initDashboardOrchestration(user, userData) {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;

    const role = appState.role; // "master" | "secretaria" | "dev_3d" | "docente" | "estudiante"
    const isStaffWithAdminVault = ["master", "secretaria", "dev_3d"].includes(role);

    // 1. Poblar cabecera de usuario
    const nameEl = document.getElementById("user-name");
    const avatarEl = document.getElementById("user-avatar");
    const planEl = document.getElementById("user-plan");

    const displayName = userData.nombre || user.displayName || user.email;
    const avatarInitial = (userData.primerNombre || displayName || "M").trim().charAt(0).toUpperCase();

    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = avatarInitial;

    const roleBadges = {
        master: "ADMIN MAESTRO • OLIMPO",
        secretaria: "AUDITORÍA & SECRETARÍA",
        dev_3d: "INGENIERÍA & CONTENIDO",
        docente: "ESPECIALISTA VIP",
        estudiante: `Plan ${userData.subscriptionLevel || "Básico"}`
    };
    if (planEl) planEl.textContent = roleBadges[role] || roleBadges.estudiante;

    // 2. Visibilidad del botón de Bóveda / Estación de Trabajo
    const adminNavBtn = document.getElementById("admin-nav-btn");
    const headerAdminBtn = document.getElementById("header-admin-btn");

    if (isStaffWithAdminVault) {
        adminNavBtn?.classList.remove("hidden");
        headerAdminBtn?.classList.remove("hidden");
        if (role !== "master" && adminNavBtn) {
            adminNavBtn.innerHTML = `🛠️ Estación de Trabajo`;
        }
    } else {
        adminNavBtn?.classList.add("hidden");
        headerAdminBtn?.classList.add("hidden");
    }

    // 3. Aplicar Embudo Universitario a estudiantes
    applyStudentCareerTunnel(userData);

    // 4. Botón Cerrar Sesión
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.boundLogout) {
        logoutBtn.dataset.boundLogout = "1";
        logoutBtn.addEventListener("click", async () => {
            if (appState.isExamActive && !confirm("Tienes un simulacro en curso. ¿Deseas cerrar sesión?")) return;
            await signOut(auth);
            window.location.href = "index.html";
        });
    }

    // 5. Navegación por pestañas
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.dataset.boundNav) return;
        btn.dataset.boundNav = "1";
        btn.addEventListener("click", () => {
            const targetView = btn.dataset.target;
            if (!targetView) return;

            if (btn.dataset.cacesLockedBySemester === "true" && role === "estudiante") {
                window.MakaiSecurityGuard?.showSecurityToast?.(
                    "🔒 Módulo CACES exclusivo para Internado Rotativo y Egresados. Continúa en el túnel de tu semestre.",
                    "warning"
                );
                return;
            }

            if (appState.isExamActive && targetView !== "view-simulator") {
                if (!confirm("Tienes un simulacro activo. ¿Abandonar el intento actual?")) return;
                appState.isExamActive = false;
            }
            switchView(targetView);
        });
    });

    if (headerAdminBtn && !headerAdminBtn.dataset.boundAdminHeader) {
        headerAdminBtn.dataset.boundAdminHeader = "1";
        headerAdminBtn.addEventListener("click", () => {
            if (isStaffWithAdminVault) switchView("view-admin");
        });
    }

    // 6. Cargar Diccionario Curricular y Router SPA
    await ensureCurriculumDataLoaded();
    await safeLoadModule("./router.spa.js", ["initRouterSPA", "initRouter"], user, userData);

    // 7. Despertar Guardia de Seguridad y Paywall
    await Promise.all([
        safeLoadModule("../3-security/security.guard.js", ["initSecurityGuard"], user, userData),
        safeLoadModule("../3-security/paywall.traffic.js", ["initPaywallTraffic", "initPaywall"], userData)
    ]);

    // 8. Despertar los Dominios Académicos y Clínicos (Carpetas 4 a 10)
    await Promise.all([
        safeLoadModule("../4-exams/exam.controller.js", ["initExamController", "initSimulator", "initLauncher"], userData),
        safeLoadModule("../5-engine-1d/engine1d.controller.js", ["initEngine1D", "initSpacedRepetition"], userData),
        safeLoadModule("../6-engine-2d/engine2d.controller.js", ["initEngine2DController", "initSim2D"], userData),
        safeLoadModule("../7-engine-3d/sim3d.controller.js", ["initSim3DController", "initSim3D"], userData),
        safeLoadModule("../8-classrooms/classroom.controller.js", ["initClassroomController", "initClassrooms"], userData),
        safeLoadModule("../9-graduation/graduation.controller.js", ["initGraduationController"], userData),
        safeLoadModule("../10-professionals/professionals.controller.js", ["initProfessionalsController"], userData)
    ]);

    // 9. Despertar Bóveda Admin / Estación de Trabajo según el Rol exacto
    if (isStaffWithAdminVault) {
        await safeLoadModule("../1-admin/admin.controller.js", ["initAdminController", "initAdmin"], role);
        // Si entra una secretaria o un dev_3d, llevarlos directo a su estación de trabajo
        if (role === "secretaria" || role === "dev_3d") {
            switchView("view-admin");
        }
    } else if (role === "docente") {
        // Si entra un docente especialista, llevarlo directo a sus Aulas Virtuales / Mentorías
        switchView("view-classrooms");
    }
}

/**
 * Arranque maestro de la aplicación.
 */
export async function initApp() {
    if (appBootstrapped) return;
    appBootstrapped = true;

    const { isIndexPage, isRegisterPage, isDashboardPage, pageName } = detectCurrentPage();

    if (isIndexPage) {
        await safeLoadModule("../3-security/auth.login.js", ["initAuthLogin", "initAuthUI"]);
    }

    if (isRegisterPage) {
        await Promise.all([
            safeLoadModule("../3-security/auth.register.js", ["initAuthRegister", "initRegisterUI"]),
            safeLoadModule("../3-security/auth.verifier.js", ["initAuthVerifier"])
        ]);
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            setSessionState(null, null);
            if (isDashboardPage) window.location.href = "index.html";
            return;
        }

        const isVerified = await verifyUserAccessStatus(user);
        if (!isVerified) {
            if (isDashboardPage) {
                window.location.href = "registro.html?verify=pending";
                return;
            }
            if (isRegisterPage) {
                const verifierMod = await safeLoadModule("../3-security/auth.verifier.js");
                verifierMod?.showVerificationPendingScreen?.(user);
            }
            return;
        }

        const userData = await syncUserProfileWithFirestore(user);
        setSessionState(user, userData);

        window.makaiCurrentUser = user;
        window.makaiCurrentUserData = userData;

        const isMaster = checkMasterAdmin(user.email);

        if (isIndexPage) {
            const pendingPlan = sessionStorage.getItem("makai_selected_plan");
            const pendingBilling = sessionStorage.getItem("makai_selected_billing") || "annual";

            if (pendingPlan && pendingPlan !== "Básico" && !isMaster) {
                sessionStorage.removeItem("makai_selected_plan");
                window.location.href = `registro.html?plan=${encodeURIComponent(pendingPlan)}&billing=${encodeURIComponent(pendingBilling)}`;
            } else {
                window.location.href = "dashboard.html";
            }
            return;
        }

        if (isRegisterPage) {
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has("plan") && !urlParams.has("pago")) {
                window.location.href = "dashboard.html";
                return;
            }
        }

        if (isDashboardPage) {
            await initDashboardOrchestration(user, userData);
        }
    });

    console.info(`[MakaiOrchestrator] Rieles de Acero activos en vista: ${pageName.toUpperCase()}`);
}

window.MakaiOrchestrator = {
    initApp,
    detectCurrentPage,
    switchView,
    safeLoadModule,
    checkMasterAdmin,
    verifyUserAccessStatus,
    syncUserProfileWithFirestore,
    applyStudentCareerTunnel
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
