// ============================================================================
// ARCHIVO: js/9-graduation/graduation.controller.js
// DESCRIPCIÓN: Controlador General de Titulación y Fin de Carrera (Carpeta 9).
//              Orquesta las 2 rutas oficiales de graduación para las 11
//              Carreras de Ciencias de la Salud:
//              1) Bootcamp Examen Complexivo (complexivo.bootcamp.js)
//              2) Tesis 1 a 1: Marketplace de Tutores ($10 USD comisión Makai)
//              3) Toolkit Metodológico: PICO, Tamaño de Muestra y Plantillas
//              4) Simulador de Nota Final de Grado y Checklist Universitario
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { appState, isMasterAdmin } from "../2-core/state.store.js";
import { db, auth } from "../2-core/firebase.service.js";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA Y CATÁLOGO DE LAS 11 CARRERAS DE SALUD
// ============================================================================

export const GRADUATION_ASSETS = Object.freeze({
    avatarsPath: "assets/9-multimedia-titulacion/avatares-tutores/",
    templatesPath: "assets/9-multimedia-titulacion/plantillas-tesis/",
    complexivoGuidesPath: "assets/9-multimedia-titulacion/guias-complexivo/"
});

const MASTER_ADMIN_EMAILS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

export const HEALTH_CAREERS_CATALOG = Object.freeze([
    { id: "medicina", nombre: "Medicina Humana", icono: "medical_services", ultimoNivel: "Internado Rotativo (11.° y 12.° Semestre)" },
    { id: "enfermeria", nombre: "Enfermería", icono: "vaccines", ultimoNivel: "Internado Rotativo (8.° y 9.° Semestre)" },
    { id: "odontologia", nombre: "Odontología", icono: "dentistry", ultimoNivel: "Clínica Integral / 9.° y 10.° Semestre" },
    { id: "obstetricia", nombre: "Obstetricia y Puericultura", icono: "pregnant_woman", ultimoNivel: "Internado Rotativo (8.° y 9.° Semestre)" },
    { id: "fisioterapia", nombre: "Fisioterapia y Terapia Física", icono: "accessibility_new", ultimoNivel: "Unidad de Titulación (7.° y 8.° Semestre)" },
    { id: "laboratorio_clinico", nombre: "Laboratorio Clínico", icono: "biotech", ultimoNivel: "Unidad de Titulación (7.° y 8.° Semestre)" },
    { id: "psicologia_clinica", nombre: "Psicología Clínica", icono: "psychology", ultimoNivel: "Prácticas de Titulación (8.° y 9.° Semestre)" },
    { id: "nutricion_dietetica", nombre: "Nutrición y Dietética", icono: "nutrition", ultimoNivel: "Internado / Titulación (8.° Semestre)" },
    { id: "bioquimica_farmacia", nombre: "Bioquímica y Farmacia", icono: "medication", ultimoNivel: "Unidad de Titulación (9.° y 10.° Semestre)" },
    { id: "imagenologia_radiologia", nombre: "Imagenología y Radiología", icono: "radiology", ultimoNivel: "Unidad de Titulación (7.° y 8.° Semestre)" },
    { id: "atencion_prehospitalaria", nombre: "Atención Prehospitalaria y Emergencias", icono: "ambulance", ultimoNivel: "Unidad de Titulación (7.° y 8.° Semestre)" }
]);

// Directorio Semilla de Tutores Verificados por Administración
export const VERIFIED_TUTORS_SEED = Object.freeze([
    {
        id: "tutor_med_01",
        nombre: "Dr. Carlos Andrés Mendoza, MSc. Epidemiología",
        carrera: "medicina",
        carrerasCompatibles: ["medicina", "obstetricia", "atencion_prehospitalaria"],
        especialidad: "Investigación Clínica, Estudios Analíticos, Cohortes y Revisión Sistemática PRISMA",
        universidadesExperiencia: ["UCE", "UG", "UCUENCA", "PUCE", "USFQ", "UTA", "ESPOCH", "UTPL"],
        tesisAprobadas: 48,
        calificacion: 4.95,
        tarifaReferencialTutor: "$180 - $320 USD (Negociable directo con el tutor)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593991234567",
        avatarFile: "tutor_mendoza.png",
        insignia: "TUTOR ÉLITE VERIFICADO"
    },
    {
        id: "tutor_enf_02",
        nombre: "Lic. Valeria Paredes, Mgtr. Gestión del Cuidado y Salud Pública",
        carrera: "enfermeria",
        carrerasCompatibles: ["enfermeria", "obstetricia", "nutricion_dietetica", "fisioterapia"],
        especialidad: "Taxonomía NANDA-NIC-NOC, Estudios Cuasi-Experimentales, MAIS-FCI y SPSS",
        universidadesExperiencia: ["UCE", "UNACH", "ESPOCH", "UTA", "UTN", "UNEMI", "ULEAM"],
        tesisAprobadas: 39,
        calificacion: 4.92,
        tarifaReferencialTutor: "$150 - $260 USD (Negociable directo con la tutora)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593987654321",
        avatarFile: "tutora_paredes.png",
        insignia: "ESPECIALISTA PAE & SPSS"
    },
    {
        id: "tutor_odo_03",
        nombre: "Od. Esp. Sebastián Villacreses, MSc. Ciencias Odontológicas",
        carrera: "odontologia",
        carrerasCompatibles: ["odontologia", "imagenologia_radiologia"],
        especialidad: "Estudios In Vitro, Biomateriales Dentales, Tomografía Cone-Beam y Bioestadística",
        universidadesExperiencia: ["UCE", "UG", "UDLA", "USFQ", "UCUENCA", "UNACH"],
        tesisAprobadas: 31,
        calificacion: 4.90,
        tarifaReferencialTutor: "$160 - $290 USD (Negociable directo con el tutor)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593998877665",
        avatarFile: "tutor_villacreses.png",
        insignia: "EXPERTO IN VITRO & CLÍNICO"
    },
    {
        id: "tutor_multi_04",
        nombre: "Dra. Elena Santamaría, PhD. Bioestadística y Ciencias Diagnósticas",
        carrera: "laboratorio_clinico",
        carrerasCompatibles: [
            "laboratorio_clinico",
            "bioquimica_farmacia",
            "psicologia_clinica",
            "fisioterapia",
            "nutricion_dietetica",
            "imagenologia_radiologia",
            "medicina"
        ],
        especialidad: "Validación de Pruebas Diagnósticas (Curvas ROC), Psicometría (Alfa de Cronbach), R-Studio y SPSS",
        universidadesExperiencia: ["Todas las Universidades Públicas y Privadas del Ecuador"],
        tesisAprobadas: 64,
        calificacion: 4.98,
        tarifaReferencialTutor: "$170 - $310 USD (Negociable directo con la tutora)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593994433221",
        avatarFile: "tutora_santamaria.png",
        insignia: "BIOESTADÍSTICA & CURVAS ROC"
    }
]);

// Plantillas Oficiales de Titulación (assets/9-multimedia-titulacion/plantillas-tesis/)
export const THESIS_TEMPLATES_LIBRARY = Object.freeze([
    {
        id: "tpl_anteproyecto_universal",
        titulo: "Plantilla Maestra de Anteproyecto / Perfil de Tesis (Formato Universal CES)",
        archivo: "plantilla_anteproyecto_salud_2026.pdf",
        categoria: "Anteproyecto & Protocolo",
        paginas: 28,
        resumenPuntos: [
            "Estructura normativa: Planteamiento del problema, formulación PICO, justificación, objetivos e hipótesis.",
            "Matriz de operacionalización de variables (independiente, dependiente, intervinientes, indicadores y escala).",
            "Consideraciones bioéticas (Declaración de Helsinki, consentimiento informado y confidencialidad de historias clínicas)."
        ]
    },
    {
        id: "tpl_vancouver_citas",
        titulo: "Guía Práctica de Normas Vancouver + Gestores Zotero / Mendeley en Ciencias de la Salud",
        archivo: "guia_normas_vancouver_salud_2026.pdf",
        categoria: "Citado & Bibliografía",
        paginas: 34,
        resumenPuntos: [
            "Citado numérico en superíndice o entre paréntesis por orden de aparición según el Comité Internacional de Editores de Revistas Médicas (ICMJE).",
            "Ejemplos exactos para artículos de PubMed/Scielo, Guías de Práctica Clínica del MSP, OMS/OPS y tesis de repositorio.",
            "Checklist anti-plagio (Turnitin / Urkund < 5% de similitud) y parafraseo científico."
        ]
    },
    {
        id: "tpl_prisma_spss",
        titulo: "Manual de Pruebas Estadísticas en SPSS (Chi-Cuadrado, T-Student, OR, RR) y Flujograma PRISMA",
        archivo: "manual_bioestadistica_spss_prisma.pdf",
        categoria: "Bioestadística & PRISMA",
        paginas: 42,
        resumenPuntos: [
            "Árbol de decisión estadística: pruebas paramétricas (Kolmogorov-Smirnov / Shapiro-Wilk > 0.05) vs. no paramétricas.",
            "Interpretación clínica de Valor p (< 0.05), Intervalo de Confianza al 95% (IC 95%), Odds Ratio (OR) y Riesgo Relativo (RR).",
            "Diagrama de flujo PRISMA 2020 de 4 fases (Identificación, Cribado, Elegibilidad e Inclusión)."
        ]
    }
]);

// ============================================================================
// 2. ESTADO REACTIVO DEL CONTROLADOR DE TITULACIÓN
// ============================================================================

export const graduationState = {
    initialized: false,
    mountElement: null,
    selectedCareer: "medicina",
    activeModule: "complexivo", // "complexivo" | "marketplace" | "toolkit" | "readiness"
    tutors: [...VERIFIED_TUTORS_SEED],
    unlockedTutorIds: new Set(),
    pendingTutorIds: new Set(),
    activeTutorForModal: null,
    receiptBase64: null,
    receiptFileName: "",
    // Estado del Toolkit PICO y Muestra
    picoData: {
        p: "Pacientes adultos con hipertensión arterial refractaria atendidos en el Hospital General...",
        i: "Esquema combinado de terapia antihipertensiva triple más seguimiento tele-médico...",
        c: "Manejo farmacológico convencional sin monitoreo domiciliario...",
        o: "Reducción de crisis hipertensivas y control de presión arterial < 130/80 mmHg a los 6 meses",
        design: "Analítico, Observacional, de Cohorte Retrospectiva"
    },
    sampleCalc: {
        isFinite: true,
        populationN: 450,
        confidenceZ: 1.96, // 95%
        pExpected: 0.5,
        marginError: 0.05,
        lastResultN: 208
    },
    // Estado de Requisitos y Simulador de Nota Final
    readiness: {
        recordScore: 8.6, // Sobre 10
        graduationExamOrThesisScore: 88, // Sobre 100
        recordWeightPct: 60,
        graduationWeightPct: 40,
        checklist: {
            inglesB1B2: true,
            vinculacionSociedad: true,
            practicasPreprofesionales: true,
            internadoRotativo: false,
            certificadoNoAdeudar: false,
            aprobacionComiteEtica: false
        }
    }
};

// ============================================================================
// 3. VERIFICACIÓN DE PERMISOS Y CUENTAS MAESTRAS
// ============================================================================

function isCurrentUserMasterAdmin() {
    const email = (
        appState?.currentUserData?.email ||
        auth?.currentUser?.email ||
        ""
    ).toLowerCase().trim();

    if (MASTER_ADMIN_EMAILS.includes(email)) return true;
    if (typeof isMasterAdmin === "function" && isMasterAdmin(email)) return true;
    return false;
}

// ============================================================================
// 4. INICIALIZADOR PRINCIPAL (initGraduationController)
// ============================================================================

/**
 * Inicializa el Controlador General de Fin de Carrera y Titulación (Carpeta 9).
 * @param {Object} options - `{ mountSelector, defaultCareer, defaultModule }`
 */
export async function initGraduationController(options = {}) {
    loadGraduationLocalState();

    // Sincronizar carrera activa del usuario
    const candidateCareer =
        options.defaultCareer ||
        appState?.currentCareer ||
        appState?.currentUserData?.carrera ||
        graduationState.selectedCareer;

    if (HEALTH_CAREERS_CATALOG.some((c) => c.id === candidateCareer)) {
        graduationState.selectedCareer = candidateCareer;
    }

    if (options.defaultModule) {
        graduationState.activeModule = options.defaultModule;
    }

    const mountEl = ensureGraduationViewInDOM(options.mountSelector);
    if (!mountEl) return;

    graduationState.mountElement = mountEl;
    graduationState.initialized = true;

    bindSidebarAndCurriculumListeners();
    renderGraduationMasterHub();

    // Sincronizar tutores y desbloqueos en segundo plano desde Firestore
    await syncTutorsAndUnlocksFromFirestore();
    if (graduationState.activeModule === "marketplace") {
        renderGraduationModuleContent();
    }

    exposeGlobalGraduationAPI();
}

// Alias de compatibilidad para safeLoadModule en app.orchestrator.js
export const initGraduation = initGraduationController;

function ensureGraduationViewInDOM(customSelector) {
    if (customSelector) {
        const customEl = document.querySelector(customSelector);
        if (customEl) return customEl;
    }

    let existingView = document.getElementById("view-graduation");
    if (existingView) return existingView;

    const viewsContainer =
        document.getElementById("views-container") ||
        document.querySelector("main");

    if (viewsContainer) {
        existingView = document.createElement("section");
        existingView.id = "view-graduation";
        existingView.className = "tab-content hidden space-y-6 p-4 md:p-6";
        viewsContainer.appendChild(existingView);
        return existingView;
    }

    return null;
}

function bindSidebarAndCurriculumListeners() {
    if (window.__makaiGraduationListenersBound) return;
    window.__makaiGraduationListenersBound = true;

    // Escuchar cambios de carrera/semestre desde router.spa.js
    window.addEventListener("makai:curriculumChanged", (ev) => {
        const detail = ev?.detail || {};
        if (detail.careerId && HEALTH_CAREERS_CATALOG.some((c) => c.id === detail.careerId)) {
            graduationState.selectedCareer = detail.careerId;
            saveGraduationLocalState();
        }

        // Si el alumno selecciona el último nivel / Internado / Titulación en CARRERA,
        // ofrece o abre el módulo de Titulación
        const stageStr = String(detail.stageId || detail.stageName || "").toLowerCase();
        if (
            stageStr.includes("titulacion") ||
            stageStr.includes("complexivo") ||
            stageStr.includes("tesis")
        ) {
            openGraduationView({ careerId: graduationState.selectedCareer });
        }
    });

    // Conectar cualquier botón con data-target="view-graduation" o data-open-graduation
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-target='view-graduation'], [data-open-graduation]");
        if (!trigger) return;

        const targetModule = trigger.dataset.openGraduation || graduationState.activeModule;
        const targetCareer = trigger.dataset.careerId || graduationState.selectedCareer;
        openGraduationView({ careerId: targetCareer, moduleId: targetModule });
    });
}

export function openGraduationView(options = {}) {
    if (options.careerId && HEALTH_CAREERS_CATALOG.some((c) => c.id === options.careerId)) {
        graduationState.selectedCareer = options.careerId;
    }
    if (options.moduleId) {
        graduationState.activeModule = options.moduleId;
    }

    // Ocultar otras pestañas SPA y mostrar #view-graduation
    document.querySelectorAll(".tab-content").forEach((el) => {
        el.classList.add("hidden");
    });

    const viewEl = ensureGraduationViewInDOM();
    if (viewEl) {
        viewEl.classList.remove("hidden");
    }

    renderGraduationMasterHub();
}

function exposeGlobalGraduationAPI() {
    window.MakaiGraduationController = {
        open: (opts) => openGraduationView(opts),
        switchModule: (modId, careerId) => switchGraduationModule(modId, careerId),
        openTutorModal: (tutorId) => openThesisMatchModal(tutorId),
        navigateFixedRightButton: (targetView) => navigateToDashboardView(targetView)
    };
}

// ============================================================================
// 5. NAVEGACIÓN A BOTONES FIJOS DERECHOS (AULAS VIRTUALES & MIS MÉTRICAS)
// ============================================================================

function navigateToDashboardView(viewId) {
    if (typeof window.switchView === "function") {
        window.switchView(viewId);
        return;
    }

    const navBtn = document.querySelector(`[data-target="${viewId}"], [data-view="${viewId}"]`);
    if (navBtn) {
        navBtn.click();
        return;
    }

    const targetEl = document.getElementById(viewId);
    if (targetEl) {
        document.querySelectorAll(".tab-content").forEach((sec) => sec.classList.add("hidden"));
        targetEl.classList.remove("hidden");
    }
}

// ============================================================================
// 6. RENDERIZADO DEL CENTRO DE MANDO DE TITULACIÓN (CYBER-MEDICAL HUD)
// ============================================================================

export function switchGraduationModule(moduleId, careerId = null) {
    if (careerId && HEALTH_CAREERS_CATALOG.some((c) => c.id === careerId)) {
        graduationState.selectedCareer = careerId;
    }
    graduationState.activeModule = moduleId;
    saveGraduationLocalState();
    renderGraduationMasterHub();
}

function renderGraduationMasterHub() {
    const mount = graduationState.mountElement;
    if (!mount) return;

    const currentCareerObj =
        HEALTH_CAREERS_CATALOG.find((c) => c.id === graduationState.selectedCareer) ||
        HEALTH_CAREERS_CATALOG[0];

    const finalGradeCalc = calculateFinalGraduationGrade(graduationState.readiness);

    mount.innerHTML = `
        <div class="space-y-6">
            <!-- CABECERA SUPERIOR CON BOTONES FIJOS SIEMPRE VISIBLES A LA DERECHA -->
            <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(0,229,255,0.08)]">
                <div class="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-surface-high">
                    <div class="space-y-1.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/40">
                                CARPETA 9 • UNIDAD DE TITULACIÓN E INTERNADO
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/40">
                                ${escapeHtml(currentCareerObj.ultimoNivel)}
                            </span>
                        </div>
                        <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary text-3xl">${currentCareerObj.icono}</span>
                            <span>Centro de Titulación: Tesis 1 a 1 & Examen Complexivo</span>
                        </h1>
                        <p class="text-xs text-gray-400 max-w-3xl">
                            Selecciona cualquiera de las 11 carreras de Ciencias de la Salud para entrenar en el Bootcamp Complexivo, vincular un Tutor de Tesis Verificado ($10 USD comisión Makai) o estructurar tu protocolo con el Toolkit Bioestadístico.
                        </p>
                    </div>

                    <!-- BOTONES FIJOS OBLIGATORIOS A LA DERECHA: AULAS VIRTUALES Y MIS MÉTRICAS -->
                    <div class="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            id="btn-grad-fixed-classrooms"
                            class="px-4 py-2.5 rounded-xl bg-surface hover:bg-primary hover:text-[#06090e] text-primary border border-primary/40 text-xs font-extrabold font-mono transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.12)]"
                        >
                            <span>🎥 Aulas Virtuales</span>
                        </button>
                        <button
                            type="button"
                            id="btn-grad-fixed-metrics"
                            class="px-4 py-2.5 rounded-xl bg-surface hover:bg-secondary hover:text-[#06090e] text-secondary border border-secondary/40 text-xs font-extrabold font-mono transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,230,118,0.12)]"
                        >
                            <span>📊 Mis Métricas</span>
                        </button>
                    </div>
                </div>

                <!-- BARRA DE SELECCIÓN DE LAS 11 CARRERAS Y TELEMETRÍA DE TITULACIÓN -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-5 items-center">
                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3.5">
                        <label for="grad-master-career-select" class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                            Carrera de Ciencias de la Salud (11 Áreas Oficiales)
                        </label>
                        <select
                            id="grad-master-career-select"
                            class="w-full bg-transparent text-sm font-extrabold text-primary focus:outline-none cursor-pointer"
                        >
                            ${HEALTH_CAREERS_CATALOG.map(
                                (c) => `
                                <option value="${c.id}" class="bg-[#06090e] text-white" ${c.id === graduationState.selectedCareer ? "selected" : ""}>
                                    ${escapeHtml(c.nombre)} — ${escapeHtml(c.ultimoNivel)}
                                </option>
                            `
                            ).join("")}
                        </select>
                    </div>

                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3.5 flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-mono text-gray-400 uppercase">Tutores Disponibles (${escapeHtml(currentCareerObj.nombre)})</span>
                            <span class="text-sm font-extrabold text-white">
                                ${getFilteredTutorsForCareer(graduationState.selectedCareer).length} Especialistas Verificados
                            </span>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-mono text-xs font-extrabold border border-primary/30">
                            Match $10 USD
                        </span>
                    </div>

                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3.5 flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-mono text-gray-400 uppercase">Proyección Nota de Grado</span>
                            <span class="text-sm font-extrabold text-secondary font-mono">
                                ${finalGradeCalc.finalScoreOver10.toFixed(2)} / 10 pts (${finalGradeCalc.completedReqs}/${finalGradeCalc.totalReqs} Requisitos)
                            </span>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg bg-secondary/15 text-secondary font-mono text-xs font-extrabold border border-secondary/30">
                            ${finalGradeCalc.statusLabel}
                        </span>
                    </div>
                </div>

                <!-- NAVEGACIÓN PRINCIPAL DE LOS 4 PILARES DE LA CARPETA 9 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-5 border-t border-surface-high">
                    <button
                        type="button"
                        data-grad-mod="complexivo"
                        class="grad-mod-btn p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                            graduationState.activeModule === "complexivo"
                                ? "bg-primary text-[#06090e] border-primary shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                                : "bg-[#06090e] text-gray-300 border-surface-high hover:border-primary/50"
                        }"
                    >
                        <span class="material-symbols-outlined text-2xl">school</span>
                        <div>
                            <div class="text-xs font-extrabold font-mono uppercase">1. Examen Complexivo</div>
                            <div class="text-[11px] opacity-80">Bootcamp 4 Semanas + ECOE</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-grad-mod="marketplace"
                        class="grad-mod-btn p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                            graduationState.activeModule === "marketplace"
                                ? "bg-primary text-[#06090e] border-primary shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                                : "bg-[#06090e] text-gray-300 border-surface-high hover:border-primary/50"
                        }"
                    >
                        <span class="material-symbols-outlined text-2xl">handshake</span>
                        <div>
                            <div class="text-xs font-extrabold font-mono uppercase">2. Tutores Tesis 1 a 1</div>
                            <div class="text-[11px] opacity-80">Directorio & Match ($10 USD)</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-grad-mod="toolkit"
                        class="grad-mod-btn p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                            graduationState.activeModule === "toolkit"
                                ? "bg-primary text-[#06090e] border-primary shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                                : "bg-[#06090e] text-gray-300 border-surface-high hover:border-primary/50"
                        }"
                    >
                        <span class="material-symbols-outlined text-2xl">calculate</span>
                        <div>
                            <div class="text-xs font-extrabold font-mono uppercase">3. Toolkit de Tesis</div>
                            <div class="text-[11px] opacity-80">PICO, Muestra & Vancouver</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        data-grad-mod="readiness"
                        class="grad-mod-btn p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                            graduationState.activeModule === "readiness"
                                ? "bg-primary text-[#06090e] border-primary shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                                : "bg-[#06090e] text-gray-300 border-surface-high hover:border-primary/50"
                        }"
                    >
                        <span class="material-symbols-outlined text-2xl">fact_check</span>
                        <div>
                            <div class="text-xs font-extrabold font-mono uppercase">4. Nota & Requisitos</div>
                            <div class="text-[11px] opacity-80">Ponderación y Checklist</div>
                        </div>
                    </button>
                </div>
            </div>

            <!-- LIENZO DINÁMICO DEL SUBMÓDULO ACTIVO -->
            <div id="graduation-dynamic-stage"></div>

            <!-- MODAL DE VINCULACIÓN DE TUTOR DE TESIS ($10 USD COMISIÓN MAKAI) -->
            <div id="graduation-tutor-match-modal" class="hidden"></div>
        </div>
    `;

    // Eventos de los botones fijos superiores a la derecha
    mount.querySelector("#btn-grad-fixed-classrooms")?.addEventListener("click", () => {
        navigateToDashboardView("view-classrooms");
    });

    mount.querySelector("#btn-grad-fixed-metrics")?.addEventListener("click", () => {
        navigateToDashboardView("view-metrics");
    });

    // Evento del selector maestro de las 11 carreras
    mount.querySelector("#grad-master-career-select")?.addEventListener("change", (e) => {
        graduationState.selectedCareer = e.target.value;
        saveGraduationLocalState();
        renderGraduationMasterHub();
    });

    // Eventos de cambio entre los 4 pilares de titulación
    mount.querySelectorAll(".grad-mod-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            switchGraduationModule(btn.dataset.gradMod);
        });
    });

    renderGraduationModuleContent();
}

async function renderGraduationModuleContent() {
    const stage = document.getElementById("graduation-dynamic-stage");
    if (!stage) return;

    const mod = graduationState.activeModule;

    if (mod === "complexivo") {
        await mountComplexivoBootcampModule(stage);
    } else if (mod === "marketplace") {
        await mountThesisMarketplaceModule(stage);
    } else if (mod === "toolkit") {
        await mountThesisToolkitModule(stage);
    } else if (mod === "readiness") {
        renderGraduationReadinessModule(stage);
    }
}

// ============================================================================
// 7. PILAR 1: CONEXIÓN CON complexivo.bootcamp.js
// ============================================================================

async function mountComplexivoBootcampModule(stage) {
    stage.innerHTML = `<div id="complexivo-bootcamp-mount"></div>`;

    try {
        const complexivoModule = await import("./complexivo.bootcamp.js");
        if (typeof complexivoModule.initComplexivoBootcamp === "function") {
            complexivoModule.initComplexivoBootcamp({
                mountSelector: "#complexivo-bootcamp-mount",
                defaultCareer: graduationState.selectedCareer
            });
            return;
        }
    } catch (err) {
        console.warn("Cargando interfaz de respaldo para Complexivo Bootcamp:", err);
    }

    // Respaldo inmediato si aún no se ha subido complexivo.bootcamp.js
    stage.innerHTML = `
        <div class="bg-[#0c1118] border border-surface-high rounded-2xl p-6 text-center space-y-3">
            <span class="material-symbols-outlined text-primary text-4xl">school</span>
            <h3 class="text-lg font-extrabold text-white">Motor Complexivo Bootcamp Listo para Conectar</h3>
            <p class="text-xs text-gray-400 max-w-xl mx-auto">
                Verifica que el archivo <code class="text-primary">js/9-graduation/complexivo.bootcamp.js</code> esté guardado en tu repositorio para desplegar el plan de 4 semanas, el simulador escrito por ejes y las estaciones ECOE.
            </p>
        </div>
    `;
}

// ============================================================================
// 8. PILAR 2: DIRECTORIO DE TUTORES 1 A 1 Y COBRO DE $10 USD (solicitudes_tesis)
// ============================================================================

async function mountThesisMarketplaceModule(stage) {
    // Si existe un módulo externo thesis.marketplace.js con su propio renderizador, lo sincroniza
    try {
        const marketMod = await import("./thesis.marketplace.js");
        if (typeof marketMod.initThesisMarketplace === "function") {
            stage.innerHTML = `<div id="thesis-marketplace-mount"></div>`;
            marketMod.initThesisMarketplace({
                mountSelector: "#thesis-marketplace-mount",
                defaultCareer: graduationState.selectedCareer
            });
            return;
        }
    } catch (e) {
        // Continúa con el motor integrado de Marketplace 1 a 1
    }

    const filteredTutors = getFilteredTutorsForCareer(graduationState.selectedCareer);
    const careerObj =
        HEALTH_CAREERS_CATALOG.find((c) => c.id === graduationState.selectedCareer) ||
        HEALTH_CAREERS_CATALOG[0];

    stage.innerHTML = `
        <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        MARKETPLACE DE TITULACIÓN 1 A 1 • COMISIÓN DE VINCULACIÓN $10 USD
                    </span>
                    <h2 class="text-xl font-extrabold text-white mt-0.5">
                        Tutores de Tesis Verificados para ${escapeHtml(careerObj.nombre)}
                    </h2>
                    <p class="text-xs text-gray-400">
                        Abona únicamente <strong>$10 USD de comisión a Makai Academy</strong> para desbloquear el WhatsApp y sala privada con el tutor elegido. El honorario total de asesoría lo negocias directamente con el especialista sin recargos ocultos.
                    </p>
                </div>

                ${
                    isCurrentUserMasterAdmin()
                        ? `
                    <span class="px-3 py-1.5 rounded-xl bg-secondary/15 border border-secondary text-secondary font-mono text-xs font-extrabold">
                        ⚡ MODO ADMIN MAESTRO: Contacto Directo Desbloqueado
                    </span>
                `
                        : ""
                }
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                ${filteredTutors
                    .map((tutor) => {
                        const isUnlocked =
                            isCurrentUserMasterAdmin() ||
                            graduationState.unlockedTutorIds.has(tutor.id);
                        const isPending = graduationState.pendingTutorIds.has(tutor.id);

                        return `
                            <div class="bg-[#06090e] border border-surface-high hover:border-primary/50 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
                                <div class="space-y-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="flex items-center gap-3">
                                            <div class="w-12 h-12 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary font-extrabold text-lg font-mono">
                                                ${escapeHtml(tutor.nombre.slice(0, 2).toUpperCase())}
                                            </div>
                                            <div>
                                                <span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-extrabold uppercase">
                                                    ${escapeHtml(tutor.insignia)}
                                                </span>
                                                <h3 class="text-sm font-extrabold text-white mt-1">${escapeHtml(tutor.nombre)}</h3>
                                            </div>
                                        </div>
                                        <div class="text-right font-mono">
                                            <span class="text-xs font-extrabold text-warning">★ ${tutor.calificacion}</span>
                                            <span class="block text-[10px] text-gray-400">${tutor.tesisAprobadas} tesis</span>
                                        </div>
                                    </div>

                                    <p class="text-xs text-gray-300 leading-relaxed">
                                        <strong>Líneas de Dominio:</strong> ${escapeHtml(tutor.especialidad)}
                                    </p>

                                    <div class="flex flex-wrap gap-1.5">
                                        ${tutor.universidadesExperiencia
                                            .map(
                                                (u) => `
                                            <span class="px-2 py-0.5 rounded bg-surface border border-surface-high text-[10px] font-mono text-gray-300">
                                                ${escapeHtml(u)}
                                            </span>
                                        `
                                            )
                                            .join("")}
                                    </div>

                                    <div class="p-3 rounded-xl bg-surface border border-surface-high text-xs space-y-1">
                                        <div class="flex items-center justify-between">
                                            <span class="text-gray-400">Honorario referencial del tutor:</span>
                                            <span class="font-bold text-white">${escapeHtml(tutor.tarifaReferencialTutor)}</span>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-gray-400">Derecho de vinculación Makai Academy:</span>
                                            <span class="font-mono font-extrabold text-secondary">$${tutor.comisionMakaiUSD}.00 USD (Pago único)</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-surface-high flex items-center justify-between gap-3">
                                    ${
                                        isUnlocked
                                            ? `
                                        <a
                                            href="https://wa.me/${tutor.whatsappDirecto}?text=${encodeURIComponent(
                                                `Hola ${tutor.nombre}, desbloqueé tu contacto verificado en Makai Academy para asesoría de Tesis 1 a 1 en la carrera de ${careerObj.nombre}.`
                                            )}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="w-full py-2.5 px-4 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs text-center hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span class="material-symbols-outlined text-base">chat</span>
                                            <span>Abrir WhatsApp Directo con el Tutor</span>
                                        </a>
                                    `
                                            : isPending
                                            ? `
                                        <div class="w-full py-2.5 px-4 rounded-xl bg-warning/15 border border-warning/50 text-warning font-mono text-xs font-extrabold text-center">
                                            ⏳ Comprobante de $10 USD en Verificación Admin
                                        </div>
                                    `
                                            : `
                                        <button
                                            type="button"
                                            data-unlock-tutor="${tutor.id}"
                                            class="w-full py-2.5 px-4 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                                        >
                                            <span class="material-symbols-outlined text-base">lock_open</span>
                                            <span>Vincular Tutor 1 a 1 ($10 USD Comisión Makai)</span>
                                        </button>
                                    `
                                    }
                                </div>
                            </div>
                        `;
                    })
                    .join("")}
            </div>
        </div>
    `;

    stage.querySelectorAll("[data-unlock-tutor]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openThesisMatchModal(btn.dataset.unlockTutor);
        });
    });
}

export function loadVerifiedTutorsByCareer(careerId = graduationState.selectedCareer) {
    return getFilteredTutorsForCareer(careerId);
}

function getFilteredTutorsForCareer(careerId) {
    const matched = graduationState.tutors.filter(
        (t) =>
            t.carrera === careerId ||
            (Array.isArray(t.carrerasCompatibles) && t.carrerasCompatibles.includes(careerId))
    );
    return matched.length > 0 ? matched : graduationState.tutors;
}

export function openThesisMatchModal(tutorId) {
    const tutor =
        graduationState.tutors.find((t) => t.id === tutorId) ||
        graduationState.tutors[0];

    graduationState.activeTutorForModal = tutor;
    graduationState.receiptBase64 = null;
    graduationState.receiptFileName = "";

    const modal = document.getElementById("graduation-tutor-match-modal");
    if (!modal) return;

    modal.className =
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4";
    modal.innerHTML = `
        <div class="bg-[#0c1118] border-2 border-primary/50 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div class="flex items-start justify-between gap-3 pb-3 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        VINCULACIÓN DE TESIS 1 A 1 • COLECCIÓN solicitudes_tesis
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Desbloquear Tutor: ${escapeHtml(tutor.nombre)}
                    </h3>
                </div>
                <button type="button" id="btn-close-tutor-modal" class="text-gray-400 hover:text-white text-sm font-mono">
                    ✕
                </button>
            </div>

            <div class="p-3.5 rounded-xl bg-[#06090e] border border-surface-high text-xs text-gray-300 space-y-1.5">
                <div class="flex justify-between">
                    <span>Derecho de vinculación Makai Academy:</span>
                    <strong class="text-secondary font-mono">$10.00 USD</strong>
                </div>
                <p class="text-[11px] text-gray-400">
                    Una vez que el Administrador Maestro verifique tu comprobante de $10 USD en la Bóveda Admin, se habilitará el botón directo al WhatsApp del tutor.
                </p>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        1. Tema Tentativo o Línea de Investigación de tu Tesis
                    </label>
                    <input
                        type="text"
                        id="thesis-match-topic"
                        placeholder="Ej: Factores asociados a preeclampsia severa en gestantes adolescentes..."
                        class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                    />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            2. Método de Pago ($10 USD)
                        </label>
                        <select
                            id="thesis-match-method"
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white font-bold"
                        >
                            <option value="Deuna! QR Pichincha">Deuna! QR Banco Pichincha</option>
                            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                            <option value="PayPhone">PayPhone</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            3. N.° de Comprobante
                        </label>
                        <input
                            type="text"
                            id="thesis-match-voucher-num"
                            placeholder="Ej: 09481234"
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        4. Subir Captura del Comprobante de $10 USD (JPG / PNG)
                    </label>
                    <input
                        type="file"
                        id="thesis-match-file"
                        accept="image/*,.pdf"
                        class="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-[#06090e] hover:file:bg-opacity-90"
                    />
                    <div id="thesis-match-file-status" class="text-[11px] font-mono text-gray-400 mt-1"></div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-surface-high">
                <button
                    type="button"
                    id="btn-cancel-tutor-modal"
                    class="px-4 py-2 rounded-xl bg-surface text-gray-300 hover:text-white text-xs font-bold"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    id="btn-submit-tutor-match"
                    class="px-5 py-2.5 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    Enviar Solicitud de $10 USD →
                </button>
            </div>
        </div>
    `;

    const closeModal = () => {
        modal.className = "hidden";
        modal.innerHTML = "";
    };

    modal.querySelector("#btn-close-tutor-modal")?.addEventListener("click", closeModal);
    modal.querySelector("#btn-cancel-tutor-modal")?.addEventListener("click", closeModal);

    modal.querySelector("#thesis-match-file")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const statusEl = modal.querySelector("#thesis-match-file-status");
        if (statusEl) statusEl.textContent = "Comprimiendo comprobante...";
        graduationState.receiptBase64 = await compressVoucherToBase64(file);
        graduationState.receiptFileName = file.name;
        if (statusEl) statusEl.textContent = `✓ Comprobante listo: ${file.name}`;
    });

    modal.querySelector("#btn-submit-tutor-match")?.addEventListener("click", async () => {
        const topic = modal.querySelector("#thesis-match-topic")?.value?.trim() || "Por definir con el tutor";
        const method = modal.querySelector("#thesis-match-method")?.value || "Deuna! QR Pichincha";
        const voucherNum = modal.querySelector("#thesis-match-voucher-num")?.value?.trim() || "";

        if (!voucherNum) {
            alert("Ingresa el número de comprobante de $10 USD para registrar tu vinculación.");
            return;
        }

        await submitThesisMatchRequest({
            tutorId: tutor.id,
            tutorNombre: tutor.nombre,
            carrera: graduationState.selectedCareer,
            temaTentativo: topic,
            metodoPago: method,
            numeroComprobante: voucherNum,
            comprobanteBase64: graduationState.receiptBase64 || "",
            montoComisionUSD: 10
        });

        closeModal();
        renderGraduationModuleContent();
    });
}

export async function submitThesisMatchRequest(payload = {}) {
    const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid || "alumno_local";
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    const nombreEstudiante =
        appState?.currentUserData?.nombre ||
        auth?.currentUser?.displayName ||
        email ||
        "Estudiante Makai";

    graduationState.pendingTutorIds.add(payload.tutorId);
    saveGraduationLocalState();

    if (db) {
        try {
            await addDoc(collection(db, "solicitudes_tesis"), {
                uidEstudiante: uid,
                emailEstudiante: email,
                nombreEstudiante,
                tutorId: payload.tutorId,
                tutorNombre: payload.tutorNombre,
                carrera: payload.carrera,
                temaTentativo: payload.temaTentativo,
                metodoPago: payload.metodoPago,
                numeroComprobante: payload.numeroComprobante,
                comprobanteBase64: payload.comprobanteBase64 || "",
                montoUSD: 10,
                estado: isCurrentUserMasterAdmin() ? "APROBADO" : "PENDIENTE",
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            console.warn("Solicitud de tesis registrada localmente:", err);
        }
    }

    if (isCurrentUserMasterAdmin()) {
        graduationState.unlockedTutorIds.add(payload.tutorId);
        saveGraduationLocalState();
    }
}

async function syncTutorsAndUnlocksFromFirestore() {
    if (!db) return;

    try {
        // 1. Cargar tutores adicionales aprobados en Firestore si existen
        const tutorsSnap = await getDocs(collection(db, "tutores_verificados"));
        const remoteTutors = [];
        tutorsSnap.forEach((docSnap) => {
            remoteTutors.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (remoteTutors.length > 0) {
            const existingIds = new Set(remoteTutors.map((t) => t.id));
            const merged = [
                ...remoteTutors,
                ...VERIFIED_TUTORS_SEED.filter((s) => !existingIds.has(s.id))
            ];
            graduationState.tutors = merged;
        }

        // 2. Verificar solicitudes de $10 USD ya aprobadas para el alumno actual
        const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid;
        if (!uid) return;

        const q = query(
            collection(db, "solicitudes_tesis"),
            where("uidEstudiante", "==", uid)
        );
        const reqSnap = await getDocs(q);
        reqSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.tutorId) return;
            const st = String(data.estado || "").toUpperCase();
            if (st === "APROBADO" || st === "VERIFICADO") {
                graduationState.unlockedTutorIds.add(data.tutorId);
                graduationState.pendingTutorIds.delete(data.tutorId);
            } else if (st === "PENDIENTE") {
                graduationState.pendingTutorIds.add(data.tutorId);
            }
        });
        saveGraduationLocalState();
    } catch (e) {
        // Continúa con datos en memoria si la colección aún no tiene documentos
    }
}

// ============================================================================
// 9. PILAR 3: TOOLKIT METODOLÓGICO (PICO, TAMAÑO DE MUESTRA Y VANCOUVER)
// ============================================================================

async function mountThesisToolkitModule(stage) {
    try {
        const toolkitMod = await import("./thesis.toolkit.js");
        if (typeof toolkitMod.initThesisToolkit === "function") {
            stage.innerHTML = `<div id="thesis-toolkit-mount"></div>`;
            toolkitMod.initThesisToolkit({
                mountSelector: "#thesis-toolkit-mount",
                defaultCareer: graduationState.selectedCareer
            });
            return;
        }
    } catch (e) {
        // Usa el Toolkit Metodológico y Bioestadístico nativo
    }

    const pico = graduationState.picoData;
    const sc = graduationState.sampleCalc;
    const generatedPico = buildPicoOutput(pico);

    stage.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- COLUMNA IZQUIERDA: GENERADOR DE PREGUNTA PICO + OBJETIVOS -->
            <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 space-y-4">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        HERRAMIENTA 1 • METODOLOGÍA DE LA INVESTIGACIÓN
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Estructurador Automático de Pregunta PICO y Objetivos
                    </h3>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-mono text-primary font-bold mb-1">P — Población / Paciente / Problema</label>
                        <input id="tk-pico-p" type="text" value="${escapeHtml(pico.p)}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-primary font-bold mb-1">I — Intervención / Exposición Principal</label>
                        <input id="tk-pico-i" type="text" value="${escapeHtml(pico.i)}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-primary font-bold mb-1">C — Comparador / Grupo Control</label>
                        <input id="tk-pico-c" type="text" value="${escapeHtml(pico.c)}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-primary font-bold mb-1">O — Outcome / Resultado Clínico Esperado</label>
                        <input id="tk-pico-o" type="text" value="${escapeHtml(pico.o)}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white" />
                    </div>
                </div>

                <button
                    type="button"
                    id="btn-tk-generate-pico"
                    class="w-full py-2.5 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    Generar Matriz PICO y Objetivos de Tesis
                </button>

                <div class="p-4 rounded-xl bg-[#06090e] border border-surface-high space-y-2 text-xs text-gray-200">
                    <div><strong class="text-primary">Pregunta PICO Formulada:</strong> ${escapeHtml(generatedPico.question)}</div>
                    <div><strong class="text-secondary">Objetivo General:</strong> ${escapeHtml(generatedPico.generalObjective)}</div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: CALCULADORA BIOESTADÍSTICA DE TAMAÑO DE MUESTRA -->
            <div class="bg-[#0c1118] border border-secondary/30 rounded-2xl p-6 space-y-4">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        HERRAMIENTA 2 • BIOESTADÍSTICA CLÍNICA
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Calculadora de Tamaño de Muestra ($n$)
                    </h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Población Universo ($N$)</label>
                        <input id="tk-sample-n" type="number" min="10" value="${sc.populationN}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Nivel de Confianza ($Z_{1-\\alpha/2}$)</label>
                        <select id="tk-sample-z" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono">
                            <option value="1.96" ${sc.confidenceZ === 1.96 ? "selected" : ""}>95% (Z = 1.96) • Estándar</option>
                            <option value="2.576" ${sc.confidenceZ === 2.576 ? "selected" : ""}>99% (Z = 2.58) • Alta precisión</option>
                            <option value="1.645" ${sc.confidenceZ === 1.645 ? "selected" : ""}>90% (Z = 1.645) • Exploratorio</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Prevalencia Esperada ($p$)</label>
                        <input id="tk-sample-p" type="number" step="0.01" min="0.01" max="0.99" value="${sc.pExpected}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Margen de Error ($e$)</label>
                        <input id="tk-sample-e" type="number" step="0.01" min="0.01" max="0.20" value="${sc.marginError}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                    </div>
                </div>

                <button
                    type="button"
                    id="btn-tk-calc-sample"
                    class="w-full py-2.5 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    Calcular Tamaño Muestral Exacto
                </button>

                <div class="p-4 rounded-xl bg-[#06090e] border border-secondary/40 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] font-mono uppercase text-gray-400 block">Muestra Mínima Requerida ($n$)</span>
                        <span class="text-xs text-gray-300">Con ajuste para población finita ($N = ${sc.populationN}$)</span>
                    </div>
                    <span class="text-2xl font-mono font-extrabold text-secondary">${sc.lastResultN} sujetos</span>
                </div>

                <!-- BÓVEDA DE PLANTILLAS DE TESIS -->
                <div class="pt-3 border-t border-surface-high space-y-2.5">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                        Bóveda de Plantillas • ${GRADUATION_ASSETS.templatesPath}
                    </span>
                    ${THESIS_TEMPLATES_LIBRARY.map(
                        (tpl) => `
                        <div class="p-3 rounded-xl bg-[#06090e] border border-surface-high flex items-center justify-between gap-2">
                            <div>
                                <div class="text-xs font-bold text-white">${escapeHtml(tpl.titulo)}</div>
                                <div class="text-[10px] font-mono text-gray-400">${escapeHtml(tpl.categoria)} • ${tpl.paginas} págs.</div>
                            </div>
                            <button
                                type="button"
                                data-open-tpl="${tpl.id}"
                                class="px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-[#06090e] text-xs font-mono font-bold transition-all"
                            >
                                Ver Guía
                            </button>
                        </div>
                    `
                    ).join("")}
                    <div id="tk-template-preview-box" class="hidden"></div>
                </div>
            </div>
        </div>
    `;

    stage.querySelector("#btn-tk-generate-pico")?.addEventListener("click", () => {
        graduationState.picoData.p = stage.querySelector("#tk-pico-p")?.value || "";
        graduationState.picoData.i = stage.querySelector("#tk-pico-i")?.value || "";
        graduationState.picoData.c = stage.querySelector("#tk-pico-c")?.value || "";
        graduationState.picoData.o = stage.querySelector("#tk-pico-o")?.value || "";
        saveGraduationLocalState();
        mountThesisToolkitModule(stage);
    });

    stage.querySelector("#btn-tk-calc-sample")?.addEventListener("click", () => {
        const N = Math.max(10, Number(stage.querySelector("#tk-sample-n")?.value) || 450);
        const Z = Number(stage.querySelector("#tk-sample-z")?.value) || 1.96;
        const p = Math.min(0.99, Math.max(0.01, Number(stage.querySelector("#tk-sample-p")?.value) || 0.5));
        const e = Math.min(0.2, Math.max(0.01, Number(stage.querySelector("#tk-sample-e")?.value) || 0.05));

        runGraduationToolkitAction("sample_size", { N, Z, p, e });
        mountThesisToolkitModule(stage);
    });

    stage.querySelectorAll("[data-open-tpl]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openThesisTemplateResource(btn.dataset.openTpl);
        });
    });
}

export function runGraduationToolkitAction(toolType, params = {}) {
    if (toolType === "sample_size") {
        const { N = 450, Z = 1.96, p = 0.5, e = 0.05 } = params;
        const q = 1 - p;
        const numerator = N * Math.pow(Z, 2) * p * q;
        const denominator = Math.pow(e, 2) * (N - 1) + Math.pow(Z, 2) * p * q;
        const n = Math.ceil(numerator / denominator);

        graduationState.sampleCalc = {
            isFinite: true,
            populationN: N,
            confidenceZ: Z,
            pExpected: p,
            marginError: e,
            lastResultN: n
        };
        saveGraduationLocalState();
        return n;
    }
    return null;
}

function buildPicoOutput(pico) {
    return {
        question: `¿En ${pico.p}, la aplicación de ${pico.i} en comparación con ${pico.c} permite lograr ${pico.o}?`,
        generalObjective: `Determinar la efectividad de ${pico.i} frente a ${pico.c} para alcanzar ${pico.o} en ${pico.p}.`
    };
}

async function openThesisTemplateResource(tplId) {
    const tpl =
        THESIS_TEMPLATES_LIBRARY.find((t) => t.id === tplId) ||
        THESIS_TEMPLATES_LIBRARY[0];

    const url = `${GRADUATION_ASSETS.templatesPath}${tpl.archivo}`;
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (res.ok && ct.includes("pdf")) {
            window.open(url, "_blank");
            return;
        }
    } catch (e) {}

    const box = document.getElementById("tk-template-preview-box");
    if (!box) return;
    box.className = "p-4 rounded-xl bg-surface border border-primary/50 space-y-2 mt-2";
    box.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-extrabold text-primary">${escapeHtml(tpl.titulo)}</span>
            <button type="button" id="btn-close-tpl-box" class="text-xs text-gray-400 hover:text-white">✕</button>
        </div>
        <ul class="space-y-1 text-xs text-gray-300">
            ${tpl.resumenPuntos.map((pt) => `<li>• ${escapeHtml(pt)}</li>`).join("")}
        </ul>
    `;
    box.querySelector("#btn-close-tpl-box")?.addEventListener("click", () => {
        box.className = "hidden";
    });
}

// ============================================================================
// 10. PILAR 4: SIMULADOR DE NOTA DE GRADO Y CHECKLIST DE REQUISITOS
// ============================================================================

function renderGraduationReadinessModule(stage) {
    const r = graduationState.readiness;
    const calc = calculateFinalGraduationGrade(r);

    const reqLabels = {
        inglesB1B2: "Suficiencia de Idioma Extranjero (Inglés B1/B2 según reglamento universitario)",
        vinculacionSociedad: "Horas de Vinculación con la Sociedad Completadas y Certificadas",
        practicasPreprofesionales: "Prácticas Preprofesionales / Horas Asistenciales Aprobadas",
        internadoRotativo: "Cohorte de Internado Rotativo / Rotaciones Clínicas Completadas",
        certificadoNoAdeudar: "Certificado de No Adeudar a Biblioteca, Laboratorios y Tesorería",
        aprobacionComiteEtica: "Aprobación de Tema / Inscripción en Unidad de Integración Curricular"
    };

    stage.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- SIMULADOR DE PONDERACIÓN DE NOTA DE TITULACIÓN -->
            <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 space-y-4">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        SIMULADOR DE CALIFICACIÓN DE GRADO
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Cálculo Ponderado: Récord Académico + Examen Complexivo / Tesis
                    </h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            Promedio Récord Académico (0 a 10)
                        </label>
                        <input id="rd-record-score" type="number" step="0.01" min="0" max="10" value="${r.recordScore}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white font-mono" />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            Nota Complexivo o Tesis (0 a 100)
                        </label>
                        <input id="rd-grad-score" type="number" step="0.5" min="0" max="100" value="${r.graduationExamOrThesisScore}" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white font-mono" />
                    </div>
                </div>

                <button
                    type="button"
                    id="btn-rd-recalc"
                    class="w-full py-2.5 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    Actualizar Proyección de Nota de Grado
                </button>

                <div class="p-4 rounded-xl bg-[#06090e] border border-secondary/40 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] font-mono uppercase text-gray-400 block">Nota Final de Titulación Estimada</span>
                        <span class="text-xs text-gray-300">Ponderación 60% Récord + 40% Titulación</span>
                    </div>
                    <div class="text-right font-mono">
                        <span class="text-2xl font-extrabold text-secondary">${calc.finalScoreOver10.toFixed(2)} / 10</span>
                        <span class="block text-[11px] text-primary">${calc.finalScoreOver100.toFixed(1)} / 100 pts</span>
                    </div>
                </div>
            </div>

            <!-- CHECKLIST DE REQUISITOS UNIVERSITARIOS PREVIOS -->
            <div class="bg-[#0c1118] border border-surface-high rounded-2xl p-6 space-y-4">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        AUDITORÍA DE EXPEDIENTE UNIVERSITARIO
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Checklist de Requisitos Previos a la Defensa / Examen
                    </h3>
                </div>

                <div class="space-y-2.5">
                    ${Object.entries(reqLabels)
                        .map(([key, label]) => {
                            const checked = Boolean(r.checklist[key]);
                            return `
                                <label class="p-3 rounded-xl border ${
                                    checked
                                        ? "bg-secondary/10 border-secondary/40"
                                        : "bg-[#06090e] border-surface-high"
                                } flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        data-req-check="${key}"
                                        class="w-4 h-4 accent-secondary rounded"
                                        ${checked ? "checked" : ""}
                                    />
                                    <span class="text-xs text-gray-200 ${checked ? "line-through text-gray-400" : ""}">
                                        ${escapeHtml(label)}
                                    </span>
                                </label>
                            `;
                        })
                        .join("")}
                </div>
            </div>
        </div>
    `;

    stage.querySelector("#btn-rd-recalc")?.addEventListener("click", () => {
        r.recordScore = Math.min(10, Math.max(0, Number(stage.querySelector("#rd-record-score")?.value) || 8.5));
        r.graduationExamOrThesisScore = Math.min(
            100,
            Math.max(0, Number(stage.querySelector("#rd-grad-score")?.value) || 85)
        );
        saveGraduationLocalState();
        renderGraduationMasterHub();
    });

    stage.querySelectorAll("[data-req-check]").forEach((chk) => {
        chk.addEventListener("change", () => {
            const key = chk.dataset.reqCheck;
            r.checklist[key] = chk.checked;
            saveGraduationLocalState();
            renderGraduationMasterHub();
        });
    });
}

export function calculateFinalGraduationGrade(readinessObj = graduationState.readiness) {
    const rec10 = Number(readinessObj.recordScore) || 0;
    const grad10 = (Number(readinessObj.graduationExamOrThesisScore) || 0) / 10;
    const wRec = (Number(readinessObj.recordWeightPct) || 60) / 100;
    const wGrad = (Number(readinessObj.graduationWeightPct) || 40) / 100;

    const finalScoreOver10 = rec10 * wRec + grad10 * wGrad;
    const finalScoreOver100 = finalScoreOver10 * 10;

    const entries = Object.values(readinessObj.checklist || {});
    const completedReqs = entries.filter(Boolean).length;
    const totalReqs = entries.length || 6;

    return {
        finalScoreOver10,
        finalScoreOver100,
        completedReqs,
        totalReqs,
        statusLabel: finalScoreOver10 >= 7.0 ? "APTO GRADO" : "EN REFUERZO"
    };
}

// ============================================================================
// 11. PERSISTENCIA LOCAL Y UTILIDADES DE COMPRESIÓN / FORMATO
// ============================================================================

function loadGraduationLocalState() {
    try {
        const raw = localStorage.getItem("makai_graduation_controller_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);

        if (parsed.selectedCareer) graduationState.selectedCareer = parsed.selectedCareer;
        if (parsed.activeModule) graduationState.activeModule = parsed.activeModule;
        if (Array.isArray(parsed.unlockedTutorIds)) {
            graduationState.unlockedTutorIds = new Set(parsed.unlockedTutorIds);
        }
        if (Array.isArray(parsed.pendingTutorIds)) {
            graduationState.pendingTutorIds = new Set(parsed.pendingTutorIds);
        }
        if (parsed.picoData) {
            graduationState.picoData = { ...graduationState.picoData, ...parsed.picoData };
        }
        if (parsed.sampleCalc) {
            graduationState.sampleCalc = { ...graduationState.sampleCalc, ...parsed.sampleCalc };
        }
        if (parsed.readiness) {
            graduationState.readiness = { ...graduationState.readiness, ...parsed.readiness };
        }
    } catch (e) {}
}

function saveGraduationLocalState() {
    try {
        localStorage.setItem(
            "makai_graduation_controller_v1",
            JSON.stringify({
                selectedCareer: graduationState.selectedCareer,
                activeModule: graduationState.activeModule,
                unlockedTutorIds: Array.from(graduationState.unlockedTutorIds),
                pendingTutorIds: Array.from(graduationState.pendingTutorIds),
                picoData: graduationState.picoData,
                sampleCalc: graduationState.sampleCalc,
                readiness: graduationState.readiness
            })
        );
    } catch (e) {}
}

function compressVoucherToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = String(ev.target?.result || "");
            if (!file.type.startsWith("image/")) {
                resolve(result);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const maxW = 900;
                const scale = Math.min(1, maxW / (img.width || maxW));
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            img.onerror = () => resolve(result);
            img.src = result;
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
