// ============================================================================
// ARCHIVO: js/1-admin/admin.controller.js
// DESCRIPCIÓN: Controlador Maestro del Panel de Administración. Verifica
//              permisos, gestiona KPIs de Firestore, coordina sub-pestañas y
//              orquesta los 6 subcomponentes de la carpeta js/1-admin/.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin
} from "../2-core/state.store.js";

// Importación por espacio de nombres (sin duplicados)
import * as AdminBackups from "./admin.backups.js";
import * as AdminPayments from "./admin.payments.js";
import * as AdminQuestions from "./admin.questions.js";
import * as AdminSinaptico from "./admin.sinaptico.js";
import * as AdminMaterials from "./admin.materials.js";
import * as AdminTutors from "./admin.tutors.js";

// Control de estado interno del panel administrativo
let adminControllerInitialized = false;
let currentAdminSubTab = "all";

// Diccionario de nombres de colecciones con respaldo seguro
const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    PAYMENTS: COLLECTIONS?.PAYMENTS || "solicitudes_pago",
    QUESTIONS: COLLECTIONS?.QUESTIONS || "preguntas_caces",
    SINAPTICO: COLLECTIONS?.SINAPTICO || "tarjetas_sinaptico",
    MATERIALS: COLLECTIONS?.MATERIALS || "materiales_estudio"
};

// ============================================================================
// 1. VALIDACIÓN DE SEGURIDAD Y ACCESOS MAESTROS
// ============================================================================

/**
 * Verifica si la sesión actual pertenece a uno de los Administradores Maestros
 * (anthonnyvelastegui@gmail.com | aavemakaihc@gmail.com).
 * @returns {boolean}
 */
export function verifyAdminPermissions() {
    const activeEmail =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";

    return isMasterAdmin(activeEmail);
}

/**
 * Muestra u oculta los botones de acceso al Panel Admin en la barra lateral
 * y en la cabecera superior de dashboard.html según los permisos del usuario.
 */
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
        if (adminView && !adminView.classList.contains("hidden")) {
            adminView.classList.add("hidden");
            adminView.classList.remove("active");
        }
    }
}

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL CONTROLADOR DE ADMINISTRACIÓN
// ============================================================================

/**
 * Inicializa el Panel de Administración completo, inyecta la barra de mando,
 * enlaza las sub-pestañas y despierta los subcomponentes de js/1-admin/.
 */
export async function initAdmin() {
    syncAdminNavigationVisibility();

    if (!verifyAdminPermissions()) {
        return;
    }

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    // 1. Renderizar la Cabecera de Mando, KPIs y Selector de Sub-Pestañas
    renderAdminCommandHeader();

    // 2. Inicializar los subcomponentes modulares de js/1-admin/
    initSubmodulesSafely();

    // 3. Enlazar accesos rápidos desde la cabecera y barra lateral de dashboard.html
    bindHeaderAdminShortcut();

    // 4. Cargar métricas globales de las 5 colecciones en tiempo real
    await refreshAdminKPIs();

    adminControllerInitialized = true;
}

// Alias exportado para máxima compatibilidad con app.orchestrator.js
export const initAdminController = initAdmin;

/**
 * Ejecuta de forma segura los inicializadores de cada subcomponente de js/1-admin/
 * verificando primero que la función exista en el módulo importado.
 */
function initSubmodulesSafely() {
    // 1. Bóveda de Respaldos (.JSON y .CSV Excel) -> admin.backups.js
    if (typeof AdminBackups.initAdminBackups === "function") {
        AdminBackups.initAdminBackups();
    }

    // 2. Bandeja de Verificación de Pagos -> admin.payments.js
    if (typeof AdminPayments.initAdminPayments === "function") {
        AdminPayments.initAdminPayments();
    } else if (typeof AdminPayments.loadPaymentRequests === "function") {
        AdminPayments.loadPaymentRequests();
    }

    // 3. Gestor de Reactivos CACES y Carreras -> admin.questions.js
    if (typeof AdminQuestions.initAdminQuestions === "function") {
        AdminQuestions.initAdminQuestions();
    } else {
        initLegacyQuestionsFallback();
    }

    // 4. Gestor de Tarjetas Sináptico v4.4 -> admin.sinaptico.js
    if (typeof AdminSinaptico.initAdminSinaptico === "function") {
        AdminSinaptico.initAdminSinaptico();
    }

    // 5. Gestor de Materiales y Guías PDF -> admin.materials.js
    if (typeof AdminMaterials.initAdminMaterials === "function") {
        AdminMaterials.initAdminMaterials();
    }

    // 6. Reclutamiento de Tutores y Comisiones Tesis ($10) -> admin.tutors.js
    if (typeof AdminTutors.initAdminTutors === "function") {
        AdminTutors.initAdminTutors();
    }
}

// ============================================================================
// 3. CABECERA TÁCTICA, KPIS EN TIEMPO REAL Y NAVEGACIÓN DE SUB-PESTAÑAS
// ============================================================================

/**
 * Inyecta el centro de comando con indicadores KPI y pestañas de filtrado
 * en la parte superior de #view-admin.
 */
function renderAdminCommandHeader() {
    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-command-center")) return;

    const activeEmail =
        auth.currentUser?.email ||
        appState.currentUserData?.email ||
        MASTER_ADMINS[0];

    const commandCenter = document.createElement("div");
    commandCenter.id = "admin-command-center";
    commandCenter.className = "mb-8 space-y-5";

    commandCenter.innerHTML = `
        <!-- BARRA SUPERIOR DE ESTADO DEL ADMINISTRADOR -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,229,255,0.08)]">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="inline-block w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                        <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold">
                            Centro de Comando ALICIZATION • Arquitectura Modular 8D
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

            <!-- TARJETAS DE MÉTRICAS GLOBALES (5 COLECCIONES OFICIALES) -->
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

            <!-- NAVEGACIÓN DE SUB-PESTAÑAS DEL PANEL ADMIN -->
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
            </div>
        </div>
    `;

    // Insertar al principio de #view-admin
    adminView.insertBefore(commandCenter, adminView.firstChild);

    // Enlazar botón de sincronización general
    const refreshBtn = document.getElementById("btn-admin-refresh-all");
    refreshBtn?.addEventListener("click", async () => {
        await refreshAdminKPIs();
        if (typeof AdminPayments.loadPaymentRequests === "function") {
            await AdminPayments.loadPaymentRequests();
        }
    });

    // Enlazar botones de sub-pestañas
    const tabBtns = commandCenter.querySelectorAll(".admin-subtab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            switchAdminSubTab(btn.dataset.adminTab);
        });
    });
}

/**
 * Consulta en paralelo las 5 colecciones oficiales de Firestore para actualizar
 * los indicadores numéricos de la cabecera del Administrador.
 */
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

/**
 * Filtra visualmente las secciones dentro de #view-admin según la sub-pestaña elegida.
 * @param {string} tabId - "all" | "respaldos" | "pagos" | "reactivos" | "sinaptico" | "materiales" | "docentes"
 */
export function switchAdminSubTab(tabId = "all") {
    currentAdminSubTab = tabId;

    // 1. Actualizar estado visual de los botones de sub-pestaña
    const tabBtns = document.querySelectorAll(".admin-subtab-btn");
    tabBtns.forEach(btn => {
        if (btn.dataset.adminTab === tabId) {
            btn.className = "admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,229,255,0.25)]";
        } else {
            btn.className = "admin-subtab-btn px-3.5 py-2 rounded-xl text-xs font-extrabold bg-surface text-gray-300 hover:text-white border border-surface-high transition-all flex items-center gap-1.5";
        }
    });

    // 2. Identificar contenedores de cada subcomponente dentro de #view-admin
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
// 4. ENLACES DE NAVEGACIÓN Y RESPALDO DE FORMULARIO DE REACTIVOS
// ============================================================================

/**
 * Conecta los botones #header-admin-btn y #admin-nav-btn para que abran
 * directamente #view-admin y refresquen las métricas del panel.
 */
function bindHeaderAdminShortcut() {
    const headerAdminBtn = document.getElementById("header-admin-btn");
    const sideAdminBtn = document.getElementById("admin-nav-btn");

    const openAdminPanel = () => {
        if (!verifyAdminPermissions()) return;

        document.querySelectorAll(".tab-content").forEach(el => {
            el.classList.remove("active");
            el.classList.add("hidden");
        });

        const adminView = document.getElementById("view-admin");
        if (adminView) {
            adminView.classList.remove("hidden");
            adminView.classList.add("active");
        }

        appState.currentActiveView = "view-admin";
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
}

/**
 * Mantiene operativo el selector de carreras/materias en #admin-form en caso de que
 * admin.questions.js aún sea un archivo semilla vacío durante la migración.
 */
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
