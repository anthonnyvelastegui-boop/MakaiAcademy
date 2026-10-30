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
    tutors: null
};

let adminControllerInitialized = false;
let currentAdminSubTab = "all";

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

    // 1. Renderizar la Cabecera de Mando, KPIs y Selector de 6 Sub-Pestañas
    renderAdminCommandHeader();

    // 2. Inicializar los 6 subcomponentes de forma aislada (si uno falla, los demás cargan igual)
    await initSubmodulesSafely();

    // 3. Cargar métricas globales de Firestore
    await refreshAdminKPIs();

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
        tutorsMod
    ] = await Promise.all([
        safeImportSubmodule("./admin.backups.js"),
        safeImportSubmodule("./admin.payments.js"),
        safeImportSubmodule("./admin.questions.js"),
        safeImportSubmodule("./admin.sinaptico.js"),
        safeImportSubmodule("./admin.materials.js"),
        safeImportSubmodule("./admin.tutors.js")
    ]);

    loadedSubmodules.backups = backupsMod;
    loadedSubmodules.payments = paymentsMod;
    loadedSubmodules.questions = questionsMod;
    loadedSubmodules.sinaptico = sinapticoMod;
    loadedSubmodules.materials = materialsMod;
    loadedSubmodules.tutors = tutorsMod;

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

    // Si por caché o ruta no se inyectó #admin-tutors-section, activar respaldo integrado
    if (!document.getElementById("admin-tutors-section")) {
        initAdminTutorsFallback();
    }

    // 7. Inicializar Centro de Control de Carreras Habilitadas y Dispositivos (1 PC + 1 Móvil)
    initAdminAccessAndDevicesManager();
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

            <div class="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-surface-high" id="admin-subtabs-bar">
                <button type="button" data-admin-tab="all" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">dashboard</span>
                    <span>Vista Completa</span>
                </button>
                <button type="button" data-admin-tab="respaldos" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">cloud_download</span>
                    <span>1. Bóveda de Respaldos</span>
                </button>
                <button type="button" data-admin-tab="pagos" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">receipt_long</span>
                    <span>2. Bandeja Bancaria</span>
                </button>
                <button type="button" data-admin-tab="reactivos" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">quiz</span>
                    <span>3. Reactivos CACES / Carreras</span>
                </button>
                <button type="button" data-admin-tab="sinaptico" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">psychology</span>
                    <span>4. Tarjetas Sináptico</span>
                </button>
                <button type="button" data-admin-tab="materiales" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
                    <span>5. Materiales y PDFs</span>
                </button>
                <button type="button" data-admin-tab="docentes" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">school</span>
                    <span>6. Tutores y Tesis</span>
                </button>
                <button type="button" data-admin-tab="accesos" class="admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-warning hover:text-white border border-warning/50 transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">manage_accounts</span>
                    <span>7. Carreras por Alumno y Dispositivos (1+1)</span>
                    <span id="badge-pending-career-reqs" class="hidden px-1.5 py-0.5 rounded-full bg-danger text-white text-[10px] font-mono font-extrabold">0</span>
                </button>
            </div>
        </div>
    `;

    adminView.insertBefore(commandCenter, adminView.firstChild);

    document.getElementById("btn-admin-refresh-all")?.addEventListener("click", async () => {
        await refreshAdminKPIs();
        if (typeof loadedSubmodules.payments?.loadPaymentRequests === "function") {
            await loadedSubmodules.payments.loadPaymentRequests();
        }
    });

    commandCenter.querySelectorAll(".admin-subtab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchAdminSubTab(btn.dataset.adminTab);
        });
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

    document.querySelectorAll(".admin-subtab-btn").forEach(btn => {
        if (btn.dataset.adminTab === tabId) {
            btn.className = "admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,229,255,0.25)]";
        } else {
            btn.className = "admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5";
        }
    });

    const sectionMap = {
        respaldos: document.getElementById("admin-backup-vault"),
        pagos: document.getElementById("admin-payments-section") || document.getElementById("admin-payments-inbox"),
        reactivos: document.getElementById("admin-questions-section") || document.getElementById("admin-form")?.closest(".grid") || document.getElementById("admin-form")?.parentElement,
        sinaptico: document.getElementById("admin-sinaptico-section"),
        materiales: document.getElementById("admin-materials-section"),
        docentes: document.getElementById("admin-tutors-section")
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
// 4. APERTURA FORZADA DE #view-admin Y RESPALDO INTEGRADO DE TUTORES
// ============================================================================

function bindHeaderAdminShortcut() {
    const headerAdminBtn = document.getElementById("header-admin-btn");
    const sideAdminBtn = document.getElementById("admin-nav-btn");

    const openAdminPanel = async (e) => {
        if (!verifyAdminPermissions()) return;
        if (e) e.stopPropagation();

        const adminView = ensureAdminViewContainer();

        // Si aún no se había renderizado la cabecera de mando, inicializar ahora mismo
        if (!document.getElementById("admin-command-center")) {
            renderAdminCommandHeader();
            await initSubmodulesSafely();
        }

        // Ocultar todas las demás vistas del área principal
        document.querySelectorAll(".tab-content, .view-section, main > div[id^='view-'], #views-container > div[id^='view-']").forEach(el => {
            if (el.id !== "view-admin") {
                el.classList.remove("active");
                el.classList.add("hidden");
                el.style.display = "none";
            }
        });

        // Forzar visibilidad de #view-admin
        adminView.classList.remove("hidden");
        adminView.classList.add("active");
        adminView.style.display = "block";

        if (appState) appState.currentActiveView = "view-admin";
        refreshAdminKPIs();
    };

    if (headerAdminBtn && !headerAdminBtn.dataset.adminBound) {
        headerAdminBtn.dataset.adminBound = "1";
        headerAdminBtn.addEventListener("click", openAdminPanel);
    }

    if (sideAdminBtn && !sideAdminBtn.dataset.adminBound) {
        sideAdminBtn.dataset.adminBound = "1";
        sideAdminBtn.addEventListener("click", openAdminPanel);
    }

    // Al pulsar cualquier otro botón del menú lateral, restaurar visibilidad normal y ocultar #view-admin
    document.querySelectorAll(".nav-btn, aside button").forEach(btn => {
        if (btn.id === "admin-nav-btn" || btn.id === "btn-logout" || btn.dataset.adminLeaveBound) return;
        btn.dataset.adminLeaveBound = "1";
        btn.addEventListener("click", () => {
            const adminView = document.getElementById("view-admin");
            if (adminView) {
                adminView.classList.add("hidden");
                adminView.classList.remove("active");
                adminView.style.display = "none";
            }
            document.querySelectorAll(".tab-content, .view-section, main > div[id^='view-'], #views-container > div[id^='view-']").forEach(el => {
                if (el.id !== "view-admin") {
                    el.style.display = "";
                }
            });
        });
    });
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
