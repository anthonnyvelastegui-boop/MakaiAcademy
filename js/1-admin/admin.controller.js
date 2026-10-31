// ============================================================================
// ARCHIVO: js/1-admin/admin.controller.js
// DESCRIPCIÓN: Controlador Maestro del Panel de Administración (Blindado con
//              carga dinámica anticaídas). Gestiona KPIs, sub-pestañas y los
//              6 subcomponentes de js/1-admin/ (incluyendo Tutores y Tesis).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    updateDoc,
    setDoc,
    doc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin
} from "../2-core/state.store.js";

// Referencias en memoria a los submódulos cargados dinámicamente
const loadedSubmodules = {
    backups: null,
    payments: null,
    questions: null,
    sinaptico: null,
    materials: null,
    tutors: null,
    users: null
};

let adminControllerInitialized = false;
let currentAdminSubTab = "all";
let currentWorkspaceMode = sessionStorage.getItem("makai_admin_workspace_mode") || "admin"; // "admin" | "user"

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    PAYMENTS: COLLECTIONS?.PAYMENTS || "solicitudes_pago",
    QUESTIONS: COLLECTIONS?.QUESTIONS || "preguntas_caces",
    SINAPTICO: COLLECTIONS?.SINAPTICO || "tarjetas_sinaptico",
    MATERIALS: COLLECTIONS?.MATERIALS || "materiales_estudio",
    CAREER_REQUESTS: "solicitudes_cambio_carrera"
};

// ============================================================================
// 1. VALIDACIÓN DE SEGURIDAD Y CONTENEDOR GARANTIZADO (#view-admin)
// ============================================================================

export function verifyAdminPermissions() {
    const activeEmail =
        auth.currentUser?.email ||
        appState?.currentUser?.email ||
        appState?.currentUserData?.email ||
        window.makaiCurrentUser?.email ||
        "";

    return isMasterAdmin(activeEmail);
}

/**
 * Garantiza que exista el contenedor #view-admin dentro del área principal de dashboard.html
 */
function ensureAdminViewContainer() {
    let adminView = document.getElementById("view-admin");
    if (adminView) return adminView;

    const mainContainer =
        document.getElementById("views-container") ||
        document.querySelector("main") ||
        document.body;

    adminView = document.createElement("div");
    adminView.id = "view-admin";
    adminView.className = "tab-content hidden max-w-6xl mx-auto p-6";
    mainContainer.appendChild(adminView);
    return adminView;
}

export function syncAdminNavigationVisibility() {
    const isAuthorized = verifyAdminPermissions();
    const sideNavBtn = document.getElementById("admin-nav-btn");
    const headerBtn = document.getElementById("header-admin-btn");
    const adminView = document.getElementById("view-admin");

    if (isAuthorized) {
        sideNavBtn?.classList.remove("hidden");
        headerBtn?.classList.remove("hidden");
    } else {
        sideNavBtn?.classList.add("hidden");
        headerBtn?.classList.add("hidden");
        if (adminView) {
            adminView.classList.add("hidden");
            adminView.classList.remove("active");
            adminView.style.display = "none";
        }
    }
}

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL CON CARGA DINÁMICA ANTICAÍDAS
// ============================================================================

async function safeImportSubmodule(relativePath) {
    try {
        return await import(relativePath);
    } catch (err) {
        console.warn(`[AdminController] Aviso al importar ${relativePath}:`, err.message || err);
        return null;
    }
}

export async function initAdmin() {
    syncAdminNavigationVisibility();
    bindHeaderAdminShortcut();

    if (!verifyAdminPermissions()) {
        return;
    }

    const adminView = ensureAdminViewContainer();
    if (!adminView) return;

    // 1. Construir el Menú Lateral Izquierdo de Administrador + Conmutador Bóveda Usuario / Admin
    setupAdminLeftSidebarWorkspace();

    // 2. Renderizar la Cabecera de Mando y KPIs en tiempo real
    renderAdminCommandHeader();

    // 3. Inicializar los 7 subcomponentes de js/1-admin/ de forma aislada
    await initSubmodulesSafely();

    // 4. Cargar métricas globales de Firestore
    await refreshAdminKPIs();

    // 5. Arrancar directamente en Modo Administrador (o restaurar el último modo elegido en la sesión)
    setAdminWorkspaceMode(currentWorkspaceMode);

    adminControllerInitialized = true;
}

export const initAdminController = initAdmin;

async function initSubmodulesSafely() {
    const [
        backupsMod,
        paymentsMod,
        questionsMod,
        sinapticoMod,
        materialsMod,
        tutorsMod,
        usersMod
    ] = await Promise.all([
        safeImportSubmodule("./admin.backups.js"),
        safeImportSubmodule("./admin.payments.js"),
        safeImportSubmodule("./admin.questions.js"),
        safeImportSubmodule("./admin.sinaptico.js"),
        safeImportSubmodule("./admin.materials.js"),
        safeImportSubmodule("./admin.tutors.js"),
        safeImportSubmodule("./admin.users.js")
    ]);

    loadedSubmodules.backups = backupsMod;
    loadedSubmodules.payments = paymentsMod;
    loadedSubmodules.questions = questionsMod;
    loadedSubmodules.sinaptico = sinapticoMod;
    loadedSubmodules.materials = materialsMod;
    loadedSubmodules.tutors = tutorsMod;
    loadedSubmodules.users = usersMod;

    // 1. Bóveda de Respaldos
    try {
        if (typeof backupsMod?.initAdminBackups === "function") {
            backupsMod.initAdminBackups();
        }
    } catch (e) { console.warn("Error en admin.backups:", e); }

    // 2. Bandeja de Pagos
    try {
        if (typeof paymentsMod?.initAdminPayments === "function") {
            paymentsMod.initAdminPayments();
        } else if (typeof paymentsMod?.loadPaymentRequests === "function") {
            paymentsMod.loadPaymentRequests();
        }
    } catch (e) { console.warn("Error en admin.payments:", e); }

    // 3. Gestor de Reactivos CACES / Carreras
    try {
        if (typeof questionsMod?.initAdminQuestions === "function") {
            questionsMod.initAdminQuestions();
        } else {
            initLegacyQuestionsFallback();
        }
    } catch (e) { console.warn("Error en admin.questions:", e); }

    // 4. Gestor de Tarjetas Sináptico v4.4
    try {
        if (typeof sinapticoMod?.initAdminSinaptico === "function") {
            sinapticoMod.initAdminSinaptico();
        }
    } catch (e) { console.warn("Error en admin.sinaptico:", e); }

    // 5. Gestor de Materiales y PDFs
    try {
        if (typeof materialsMod?.initAdminMaterials === "function") {
            materialsMod.initAdminMaterials();
        }
    } catch (e) { console.warn("Error en admin.materials:", e); }

    // 6. Reclutamiento de Tutores y Comisiones Tesis ($10)
    try {
        if (typeof tutorsMod?.initAdminTutors === "function") {
            tutorsMod.initAdminTutors();
        }
    } catch (e) { console.warn("Error en admin.tutors:", e); }

    if (!document.getElementById("admin-tutors-section")) {
        initAdminTutorsFallback();
    }

    // 7. Carreras por Alumno, Suscripciones y Dispositivos (1+1) -> admin.users.js
    try {
        if (typeof usersMod?.initAdminUsers === "function") {
            usersMod.initAdminUsers();
        }
    } catch (e) { console.warn("Error en admin.users:", e); }
}
// ============================================================================
// 3. CABECERA TÁCTICA, KPIS EN TIEMPO REAL Y NAVEGACIÓN DE SUB-PESTAÑAS
// ============================================================================

function renderAdminCommandHeader() {
    const adminView = ensureAdminViewContainer();
    if (!adminView || document.getElementById("admin-command-center")) return;

    const activeEmail =
        auth.currentUser?.email ||
        appState?.currentUserData?.email ||
        MASTER_ADMINS[0];

    const commandCenter = document.createElement("div");
    commandCenter.id = "admin-command-center";
    commandCenter.className = "mb-8 space-y-5";

    commandCenter.innerHTML = `
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,229,255,0.08)]">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="inline-block w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                        <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold">
                            Centro de Comando ALICIZATION • Arquitectura Modular
                        </span>
                    </div>
                    <h2 class="text-2xl font-extrabold text-white mt-1 flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">admin_panel_settings</span>
                        Bóveda de Administración Maestra
                    </h2>
                    <p class="text-xs text-gray-400 font-mono mt-0.5">
                        Sesión autorizada: <strong class="text-secondary">${activeEmail}</strong>
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button type="button" id="btn-admin-refresh-all" class="px-4 py-2.5 bg-surface-high border border-primary/50 text-primary hover:bg-primary hover:text-surface font-extrabold text-xs rounded-xl transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-base" id="icon-admin-refresh">refresh</span>
                        <span>Sincronizar Firestore</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                <div class="bg-surface border border-surface-high rounded-xl p-3.5">
                    <span class="text-[10px] font-mono text-gray-400 uppercase block">Alumnos Registrados</span>
                    <div class="text-2xl font-extrabold text-white mt-1 font-mono" id="kpi-admin-users">--</div>
                    <span class="text-[10px] text-primary font-mono">Colección: usuarios</span>
                </div>

                <div class="bg-surface border border-warning/40 rounded-xl p-3.5">
                    <span class="text-[10px] font-mono text-warning uppercase block">Pagos Pendientes</span>
                    <div class="text-2xl font-extrabold text-warning mt-1 font-mono" id="kpi-admin-payments">--</div>
                    <span class="text-[10px] text-gray-400 font-mono" id="kpi-admin-payments-total">Total solicitudes: --</span>
                </div>

                <div class="bg-surface border border-surface-high rounded-xl p-3.5">
                    <span class="text-[10px] font-mono text-gray-400 uppercase block">Reactivos CACES</span>
                    <div class="text-2xl font-extrabold text-secondary mt-1 font-mono" id="kpi-admin-questions">--</div>
                    <span class="text-[10px] text-gray-400 font-mono">preguntas_caces</span>
                </div>

                <div class="bg-surface border border-surface-high rounded-xl p-3.5">
                    <span class="text-[10px] font-mono text-gray-400 uppercase block">Mazos Sináptico</span>
                    <div class="text-2xl font-extrabold text-primary mt-1 font-mono" id="kpi-admin-sinaptico">--</div>
                    <span class="text-[10px] text-gray-400 font-mono">tarjetas_sinaptico</span>
                </div>

                <div class="bg-surface border border-surface-high rounded-xl p-3.5 col-span-2 sm:col-span-1">
                    <span class="text-[10px] font-mono text-gray-400 uppercase block">Guías y PDFs</span>
                    <div class="text-2xl font-extrabold text-white mt-1 font-mono" id="kpi-admin-materials">--</div>
                    <span class="text-[10px] text-gray-400 font-mono">materiales_estudio</span>
                </div>
            </div>

            </div>
    `;

    adminView.insertBefore(commandCenter, adminView.firstChild);

    document.getElementById("btn-admin-refresh-all")?.addEventListener("click", async () => {
        await refreshAdminKPIs();
        if (typeof loadedSubmodules.payments?.loadPaymentRequests === "function") {
            await loadedSubmodules.payments.loadPaymentRequests();
        }
        if (typeof loadedSubmodules.users?.loadAdminAccessAndDevicesData === "function") {
            await loadedSubmodules.users.loadAdminAccessAndDevicesData();
        }
    });
}

export async function refreshAdminKPIs() {
    if (!verifyAdminPermissions()) return;

    const iconRefresh = document.getElementById("icon-admin-refresh");
    iconRefresh?.classList.add("animate-spin");

    try {
        const [
            usersSnap,
            paymentsSnap,
            questionsSnap,
            sinapticoSnap,
            materialsSnap
        ] = await Promise.all([
            getDocs(collection(db, SAFE_COLLECTIONS.USERS)),
            getDocs(collection(db, SAFE_COLLECTIONS.PAYMENTS)),
            getDocs(collection(db, SAFE_COLLECTIONS.QUESTIONS)),
            getDocs(collection(db, SAFE_COLLECTIONS.SINAPTICO)),
            getDocs(collection(db, SAFE_COLLECTIONS.MATERIALS))
        ]);

        let pendingPayments = 0;
        paymentsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.estado || data.estado === "pendiente") {
                pendingPayments++;
            }
        });

        const setKPI = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };

        setKPI("kpi-admin-users", usersSnap.size);
        setKPI("kpi-admin-payments", pendingPayments);
        setKPI("kpi-admin-questions", questionsSnap.size);
        setKPI("kpi-admin-sinaptico", sinapticoSnap.size);
        setKPI("kpi-admin-materials", materialsSnap.size);

        // Actualizar globo de pagos pendientes en la barra lateral izquierda
        const payBadge = document.getElementById("badge-pending-payments-sidebar");
        if (payBadge) {
            payBadge.textContent = String(pendingPayments);
            payBadge.classList.toggle("hidden", pendingPayments === 0);
        }

        const totalPayEl = document.getElementById("kpi-admin-payments-total");
        if (totalPayEl) {
            totalPayEl.textContent = `Total solicitudes: ${paymentsSnap.size}`;
        }
    } catch (err) {
        console.warn("Aviso al actualizar KPIs de Firestore en Admin:", err);
    } finally {
        iconRefresh?.classList.remove("animate-spin");
    }
}

export function switchAdminSubTab(tabId = "all") {
    currentAdminSubTab = tabId;

    // 1. Actualizar botones del menú lateral izquierdo de Administrador (#sidebar-admin-menu)
    document.querySelectorAll(".admin-sidebar-tab-btn").forEach(btn => {
        const isActive = btn.dataset.adminTab === tabId;
        if (isActive) {
            btn.className = "admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-primary text-surface shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all";
        } else {
            btn.className = "admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high border border-transparent transition-all";
        }
    });

    // 2. Mostrar/ocultar los contenedores de los 7 subcomponentes dentro de #view-admin
    const sectionMap = {
        respaldos: document.getElementById("admin-backup-vault"),
        pagos: document.getElementById("admin-payments-section") || document.getElementById("admin-payments-inbox"),
        reactivos: document.getElementById("admin-questions-section") || document.getElementById("admin-form")?.closest(".grid") || document.getElementById("admin-form")?.parentElement,
        sinaptico: document.getElementById("admin-sinaptico-section"),
        materiales: document.getElementById("admin-materials-section"),
        docentes: document.getElementById("admin-tutors-section"),
        accesos: document.getElementById("admin-access-devices-section")
    };

    Object.entries(sectionMap).forEach(([key, element]) => {
        if (!element) return;
        if (tabId === "all" || tabId === key) {
            element.classList.remove("hidden");
        } else {
            element.classList.add("hidden");
        }
    });
}

// ============================================================================
// 4. BARRA LATERAL IZQUIERDA EXCLUSIVA DE ADMIN Y CONMUTADOR "BÓVEDA USUARIO"
// ============================================================================

const SIMULATOR_CAREERS = [
    { id: "medicina", label: "01 • Medicina Humana" },
    { id: "enfermeria", label: "02 • Enfermería" },
    { id: "odontologia", label: "03 • Odontología" },
    { id: "obstetricia", label: "04 • Obstetricia" },
    { id: "nutricion", label: "05 • Nutrición" },
    { id: "fisioterapia", label: "06 • Fisioterapia" },
    { id: "laboratorio", label: "07 • Laboratorio Clínico" },
    { id: "imagenologia", label: "08 • Imagenología" },
    { id: "farmacia", label: "09 • Bioquímica y Farmacia" },
    { id: "psicologia_clinica", label: "10 • Psicología Clínica" },
    { id: "paramedicina", label: "11 • Atención Prehospitalaria" },
    { id: "preuniversitario_salud", label: "🎓 Preuniversitario de Salud" }
];

/**
 * Inyecta en la barra lateral izquierda (<aside>) las 8 opciones de Administrador
 * y el botón "BÓVEDA USUARIO" para alternar entre el Panel Admin y la Visión de Alumno.
 */
function setupAdminLeftSidebarWorkspace() {
    if (!verifyAdminPermissions()) return;

    const sidebarNav = document.querySelector("aside nav") || document.querySelector("#main-sidebar nav");
    if (!sidebarNav || document.getElementById("sidebar-admin-menu")) return;

    // 1. Crear contenedor de las 8 opciones administrativas en la barra lateral izquierda
    const adminMenu = document.createElement("div");
    adminMenu.id = "sidebar-admin-menu";
    adminMenu.className = "space-y-1.5 pb-3 border-b border-surface-high";

    adminMenu.innerHTML = `
        <div class="px-3 py-1.5 flex items-center justify-between">
            <span class="text-[10px] font-mono uppercase tracking-widest text-warning font-extrabold">
                ⚡ MODO ADMINISTRADOR
            </span>
            <span class="px-1.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[9px] font-bold">
                MASTER
            </span>
        </div>

        <button type="button" data-admin-tab="all" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-primary text-surface shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base">dashboard</span>
                <span class="truncate">Vista Completa</span>
            </div>
            <span class="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface/30">ALL</span>
        </button>

        <button type="button" data-admin-tab="respaldos" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-primary">cloud_download</span>
                <span class="truncate">1. Bóveda de Respaldos</span>
            </div>
        </button>

        <button type="button" data-admin-tab="pagos" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-warning">receipt_long</span>
                <span class="truncate">2. Bandeja Bancaria</span>
            </div>
            <span id="badge-pending-payments-sidebar" class="hidden px-1.5 py-0.5 rounded-full bg-warning text-surface text-[10px] font-mono font-extrabold">0</span>
        </button>

        <button type="button" data-admin-tab="reactivos" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-secondary">quiz</span>
                <span class="truncate">3. Reactivos CACES</span>
            </div>
        </button>

        <button type="button" data-admin-tab="sinaptico" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-primary">psychology</span>
                <span class="truncate">4. Tarjetas Sináptico</span>
            </div>
        </button>

        <button type="button" data-admin-tab="materiales" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-gray-300">picture_as_pdf</span>
                <span class="truncate">5. Materiales y PDFs</span>
            </div>
        </button>

        <button type="button" data-admin-tab="docentes" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-secondary">school</span>
                <span class="truncate">6. Tutores y Tesis</span>
            </div>
        </button>

        <button type="button" data-admin-tab="accesos" class="admin-sidebar-tab-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface-high transition-all">
            <div class="flex items-center gap-2.5 truncate">
                <span class="material-symbols-outlined text-base text-warning">manage_accounts</span>
                <span class="truncate">7. Alumnos y Equipos (1+1)</span>
            </div>
            <span id="badge-pending-career-reqs" class="badge-pending-career-reqs hidden px-1.5 py-0.5 rounded-full bg-danger text-white text-[10px] font-mono font-extrabold">0</span>
        </button>

        <!-- BOTÓN PARA PASAR A LA VISIÓN DE USUARIO -->
        <button type="button" id="user-vision-nav-btn" class="w-full flex items-center justify-between px-3.5 py-3 text-xs font-extrabold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all mt-3 border border-primary/40">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base">visibility</span>
                <span>BÓVEDA USUARIO</span>
            </div>
            <span class="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-primary text-surface">
                VISIÓN ALUMNO
            </span>
        </button>
    `;

    sidebarNav.insertBefore(adminMenu, sidebarNav.firstChild);

    // Enlazar clic en cada una de las 8 opciones de la barra izquierda
    adminMenu.querySelectorAll(".admin-sidebar-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (currentWorkspaceMode !== "admin") {
                setAdminWorkspaceMode("admin");
            }
            switchAdminSubTab(btn.dataset.adminTab);
        });
    });

    // Enlazar botón "BÓVEDA USUARIO" para pasar a la Visión de Alumno
    document.getElementById("user-vision-nav-btn")?.addEventListener("click", () => {
        setAdminWorkspaceMode("user");
    });

    // Crear la barra flotante superior de Simulación de Carrera y Plan cuando estés en Visión de Usuario
    ensureUserVisionSimulatorBar();
}

/**
 * Crea una barra superior exclusiva para que cuando estés en "Bóveda Usuario"
 * puedas cambiar libremente entre las 12 carreras y simular los Planes Básico, PRO o VIP.
 */
function ensureUserVisionSimulatorBar() {
    if (document.getElementById("admin-user-vision-bar")) return;

    const mainArea = document.querySelector("main") || document.getElementById("views-container")?.parentElement;
    if (!mainArea) return;

    const simBar = document.createElement("div");
    simBar.id = "admin-user-vision-bar";
    simBar.className = "hidden bg-surface-container border-b border-primary/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30";

    const currentCareer = appState?.currentUserData?.carrera || "medicina";
    const currentPlan = appState?.currentUserData?.subscriptionLevel || "VIP";

    simBar.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span class="text-[11px] font-mono font-extrabold text-primary uppercase">
                👁️ MODO VISIÓN DE USUARIO (SIMULADOR ADMIN EN VIVO)
            </span>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex items-center gap-1.5">
                <label class="text-[10px] font-mono text-gray-400 uppercase">Simular Carrera:</label>
                <select id="admin-sim-career-select" class="bg-surface border border-primary/50 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none">
                    ${SIMULATOR_CAREERS.map(c => `<option value="${c.id}" ${c.id === currentCareer ? "selected" : ""}>${c.label}</option>`).join("")}
                </select>
            </div>

            <div class="flex items-center gap-1.5">
                <label class="text-[10px] font-mono text-gray-400 uppercase">Simular Plan:</label>
                <select id="admin-sim-plan-select" class="bg-surface border border-secondary/50 rounded-lg px-2.5 py-1 text-xs text-secondary font-bold focus:outline-none">
                    <option value="Básico" ${currentPlan === "Básico" ? "selected" : ""}>🔓 Plan Básico</option>
                    <option value="PRO" ${currentPlan === "PRO" ? "selected" : ""}>⚡ Plan PRO</option>
                    <option value="VIP" ${currentPlan === "VIP" ? "selected" : ""}>👑 Plan VIP</option>
                </select>
            </div>

            <button type="button" id="btn-return-to-admin-vault" class="px-3 py-1 rounded-lg bg-warning text-surface font-extrabold text-xs flex items-center gap-1 hover:opacity-90 transition-all">
                <span class="material-symbols-outlined text-sm">bolt</span>
                <span>Volver a Bóveda Admin</span>
            </button>
        </div>
    `;

    mainArea.insertBefore(simBar, mainArea.firstChild);

    // Cambiar de carrera en vivo mientras estás en Visión de Usuario
    document.getElementById("admin-sim-career-select")?.addEventListener("change", (e) => {
        const selectedCareer = e.target.value;
        if (appState?.currentUserData) {
            appState.currentUserData.carrera = selectedCareer;
            appState.currentUserData.esPreuniversitarioExclusivo = (selectedCareer === "preuniversitario_salud");
        }
        const headerCareerSwitcher = document.getElementById("header-career-switcher");
        if (headerCareerSwitcher) {
            headerCareerSwitcher.value = selectedCareer;
            headerCareerSwitcher.dispatchEvent(new Event("change"));
        }
        window.dispatchEvent(new CustomEvent("makai:careerChanged", { detail: { career: selectedCareer } }));
    });

    // Cambiar de Plan (Básico / PRO / VIP) en vivo para probar candados
    document.getElementById("admin-sim-plan-select")?.addEventListener("change", (e) => {
        const selectedPlan = e.target.value;
        if (appState?.currentUserData) {
            appState.currentUserData.subscriptionLevel = selectedPlan;
        }
        const userPlanEl = document.getElementById("user-plan");
        if (userPlanEl) userPlanEl.textContent = `Plan ${selectedPlan}`;
        window.dispatchEvent(new CustomEvent("makai:planChanged", { detail: { plan: selectedPlan } }));
    });

    document.getElementById("btn-return-to-admin-vault")?.addEventListener("click", () => {
        setAdminWorkspaceMode("admin");
    });
}

/**
 * Alterna toda la plataforma entre:
 * - "admin": Barra izquierda con las 8 opciones administrativas y #view-admin abierto.
 * - "user": Barra izquierda con los botones de estudiante (MI CARRERA, CACES, RURAL...) y simulador de carreras activo.
 */
export function setAdminWorkspaceMode(mode = "admin") {
    if (!verifyAdminPermissions()) return;

    currentWorkspaceMode = mode === "user" ? "user" : "admin";
    sessionStorage.setItem("makai_admin_workspace_mode", currentWorkspaceMode);

    const sidebarNav = document.querySelector("aside nav") || document.querySelector("#main-sidebar nav");
    const adminMenu = document.getElementById("sidebar-admin-menu");
    const adminNavBtn = document.getElementById("admin-nav-btn");
    const simBar = document.getElementById("admin-user-vision-bar");
    const adminView = ensureAdminViewContainer();

    // Botones de estudiante dentro del sidebar (todos los hijos directos de nav excepto #sidebar-admin-menu)
    const studentButtons = sidebarNav
        ? Array.from(sidebarNav.children).filter(el => el.id !== "sidebar-admin-menu")
        : [];

    if (currentWorkspaceMode === "admin") {
        // 1. Mostrar menú lateral Admin y ocultar botones de estudiante
        adminMenu?.classList.remove("hidden");
        studentButtons.forEach(el => el.classList.add("hidden"));
        simBar?.classList.add("hidden");

        // 2. Ocultar todas las vistas de alumno y mostrar #view-admin
        document.querySelectorAll(".tab-content, .view-section, main > div[id^='view-'], #views-container > div[id^='view-']").forEach(el => {
            if (el.id !== "view-admin") {
                el.classList.remove("active");
                el.classList.add("hidden");
                el.style.display = "none";
            }
        });

        adminView.classList.remove("hidden");
        adminView.classList.add("active");
        adminView.style.display = "block";

        if (appState) appState.currentActiveView = "view-admin";
        switchAdminSubTab(currentAdminSubTab || "all");
        refreshAdminKPIs();
    } else {
        // MODO VISIÓN DE USUARIO (ALUMNO)
        // 1. Ocultar menú lateral Admin y mostrar los botones de estudiante + botón BÓVEDA ADMIN
        adminMenu?.classList.add("hidden");
        studentButtons.forEach(el => el.classList.remove("hidden"));
        adminNavBtn?.classList.remove("hidden");
        simBar?.classList.remove("hidden");

        // 2. Ocultar #view-admin y abrir la vista principal de estudiante (#view-launcher o la primera pestaña)
        adminView.classList.add("hidden");
        adminView.classList.remove("active");
        adminView.style.display = "none";

        document.querySelectorAll(".tab-content, .view-section, main > div[id^='view-'], #views-container > div[id^='view-']").forEach(el => {
            if (el.id !== "view-admin") {
                el.style.display = "";
            }
        });

        const firstStudentBtn = document.querySelector("aside .nav-btn:not(#admin-nav-btn)");
        if (firstStudentBtn) {
            firstStudentBtn.click();
        } else {
            const launcherView = document.getElementById("view-launcher") || document.getElementById("view-career");
            launcherView?.classList.remove("hidden");
        }
    }
}

function bindHeaderAdminShortcut() {
    const headerAdminBtn = document.getElementById("header-admin-btn");
    const sideAdminBtn = document.getElementById("admin-nav-btn");

    const openAdminPanel = async (e) => {
        if (!verifyAdminPermissions()) return;
        if (e) e.stopPropagation();

        setupAdminLeftSidebarWorkspace();

        if (!document.getElementById("admin-command-center")) {
            renderAdminCommandHeader();
            await initSubmodulesSafely();
        }

        setAdminWorkspaceMode("admin");
    };

    if (headerAdminBtn && !headerAdminBtn.dataset.adminBound) {
        headerAdminBtn.dataset.adminBound = "1";
        headerAdminBtn.addEventListener("click", openAdminPanel);
    }

    if (sideAdminBtn && !sideAdminBtn.dataset.adminBound) {
        sideAdminBtn.dataset.adminBound = "1";
        sideAdminBtn.addEventListener("click", openAdminPanel);
    }
}

function initAdminTutorsFallback() {
    const adminView = ensureAdminViewContainer();
    if (!adminView || document.getElementById("admin-tutors-section")) return;

    const tutorsSection = document.createElement("div");
    tutorsSection.id = "admin-tutors-section";
    tutorsSection.className = "mb-10 space-y-6";

    tutorsSection.innerHTML = `
        <div class="bg-surface-container border-2 border-secondary/50 rounded-2xl p-6 shadow-2xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-surface-high">
                <div>
                    <h3 class="text-xl font-extrabold text-secondary flex items-center gap-2">
                        <span class="material-symbols-outlined">school</span>
                        6. Reclutamiento y Postulaciones de Docentes
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">Activa a los candidatos como "Tutores Verificados de Tesis" o "Docentes de Aulas Virtuales".</p>
                </div>
                <button type="button" id="btn-refresh-tutors" class="px-4 py-2 bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all">
                    ↻ Actualizar Solicitudes
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Fecha / Candidato</th>
                            <th class="px-4 py-3">Especialidad / Título</th>
                            <th class="px-4 py-3">Contacto</th>
                            <th class="px-4 py-3">Estado</th>
                            <th class="px-4 py-3">Acciones de Activación</th>
                        </tr>
                    </thead>
                    <tbody id="admin-tutors-tbody">
                        <tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">Sin postulaciones pendientes.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    adminView.appendChild(tutorsSection);
}

function initLegacyQuestionsFallback() {
    const adminCarrera = document.getElementById("admin-carrera");
    const adminMateria = document.getElementById("admin-materia");
    const data = window.makaiData;

    if (!adminCarrera || !adminMateria || !data?.carreras || adminCarrera.dataset.fallbackBound) {
        return;
    }

    adminCarrera.dataset.fallbackBound = "1";
    adminCarrera.addEventListener("change", () => {
        adminMateria.innerHTML = "";
        const selectedCareer = data.carreras.find(c => c.id === adminCarrera.value);
        if (selectedCareer && Array.isArray(selectedCareer.materias)) {
            selectedCareer.materias.forEach(materia => {
                const opt = document.createElement("option");
                opt.value = materia;
                opt.textContent = materia;
                adminMateria.appendChild(opt);
            });
        }
    });

    adminCarrera.dispatchEvent(new Event("change"));
}
