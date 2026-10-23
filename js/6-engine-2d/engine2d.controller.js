// ============================================================================
// ARCHIVO: js/6-engine-2d/engine2d.controller.js
// DESCRIPCIÓN: Controlador General del Motor 2D (Simulación Clínica Interactiva
//              en Lienzo HTML5 Canvas, Árboles de Decisión, Instrumental 2D y
//              Monitor Multiparámetro en Tiempo Real).
//              Coordina sim2d.decisionTree.js, sim2d.interactiveTools.js y
//              sim2d.vitalsMonitor.js.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    doc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    canAccessBySubscription,
    setCurriculumSelection
} from "../2-core/state.store.js";

// Importación por espacio de nombres (Namespace Imports) para tolerar archivos
// semilla vacíos mientras se desarrollan los subcomponentes de js/6-engine-2d/.
import * as Sim2DDecisionTree from "./sim2d.decisionTree.js";
import * as Sim2DInteractiveTools from "./sim2d.interactiveTools.js";
import * as Sim2DVitalsMonitor from "./sim2d.vitalsMonitor.js";

// ============================================================================
// 1. RUTAS MULTIMEDIA 2D Y ESTADO INTERNO DEL MOTOR
// ============================================================================

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    CASES_2D: COLLECTIONS?.CASES_2D || "casos_simulacion_2d"
};

export const ASSETS_2D_PATHS = Object.freeze({
    PATIENTS: "assets/6-multimedia-2d/pacientes-capas/",
    TOOLS: "assets/6-multimedia-2d/instrumental-sprites/",
    MONITORS: "assets/6-multimedia-2d/monitores-2d/",
    AUDIOS: "assets/6-multimedia-2d/audios-auscultacion/"
});

export const engine2DState = {
    initialized: false,
    career: "medicina",
    stage: "general",
    subject: "todas",
    allCases: [],
    filteredCases: [],
    activeCase: null,
    currentNodeId: "node_start",
    selectedToolId: "fonendoscopio",
    selectedHotspotId: "foco_mitral",
    isCaseFinished: false,
    score: 100,
    actionsHistory: [],
    discoveredFindings: [],
    vitals: {
        hr: 118,          // Frecuencia cardíaca (lpm)
        bpSys: 88,        // Presión arterial sistólica (mmHg)
        bpDia: 54,        // Presión arterial diastólica (mmHg)
        spo2: 91,         // Saturación de oxígeno (%)
        rr: 26,           // Frecuencia respiratoria (rpm)
        temp: 38.4,       // Temperatura (°C)
        rhythm: "taquicardia_sinusal",
        heartSound: "S1-S2 taquicárdicos, S3 galope en foco mitral",
        lungSound: "Crepitantes bibasales húmedos"
    },
    ecgAnimationId: null,
    ecgPhase: 0,
    audioCtx: null
};

// Instrumental médico 2D oficial disponible en el lienzo
export const CLINICAL_TOOLS_2D = [
    {
        id: "fonendoscopio",
        nombre: "Fonendoscopio 2D",
        icono: "stethoscope",
        sprite: `${ASSETS_2D_PATHS.TOOLS}fonendoscopio.png`,
        instruccion: "Arrastra o selecciona un foco anatómico en el paciente para auscultar ruidos cardíacos y pulmonares."
    },
    {
        id: "ecg12",
        nombre: "Derivaciones ECG",
        icono: "monitor_heart",
        sprite: `${ASSETS_2D_PATHS.TOOLS}derivaciones-ecg.png`,
        instruccion: "Coloca los electrodos precordiales sobre el tórax para obtener el trazado electrocardiográfico de 12 derivaciones."
    },
    {
        id: "oxigeno",
        nombre: "Oxigenoterapia",
        icono: "air",
        sprite: `${ASSETS_2D_PATHS.TOOLS}mascarilla-o2.png`,
        instruccion: "Aplica soporte de oxígeno suplementario sobre la vía aérea superior para corregir la hipoxemia."
    },
    {
        id: "acceso_venoso",
        nombre: "Acceso Venoso / Líquidos",
        icono: "vaccines",
        sprite: `${ASSETS_2D_PATHS.TOOLS}cateter-venoso.png`,
        instruccion: "Canaliza vía periférica en miembro superior para infusión de cristaloides o fármacos vasoactivos."
    },
    {
        id: "desfibrilador",
        nombre: "Palas / Cardioversión",
        icono: "bolt",
        sprite: `${ASSETS_2D_PATHS.TOOLS}desfibrilador-palas.png`,
        instruccion: "Posiciona las palas en ápex y región infraclavicular derecha para cardioversión o desfibrilación."
    }
];

// Focos anatómicos interactivos sobre el lienzo 2D del paciente
export const PATIENT_HOTSPOTS_2D = [
    { id: "via_aerea", label: "Vía Aérea / O2", xPercent: 50, yPercent: 18, color: "#00e5ff" },
    { id: "foco_aortico", label: "Foco Aórtico (2° EIC Der)", xPercent: 43, yPercent: 34, color: "#ffbe0b" },
    { id: "foco_pulmonar", label: "Foco Pulmonar (2° EIC Izq)", xPercent: 57, yPercent: 34, color: "#ffbe0b" },
    { id: "foco_tricuspideo", label: "Foco Tricuspídeo (Ap. Xifoides)", xPercent: 49, yPercent: 45, color: "#ffbe0b" },
    { id: "foco_mitral", label: "Foco Mitral / Ápex (5° EIC LMC)", xPercent: 60, yPercent: 47, color: "#ff4d4d" },
    { id: "base_pulmonar", label: "Bases Pulmonares", xPercent: 38, yPercent: 50, color: "#94de2d" },
    { id: "acceso_braquial", label: "Acceso Venoso Periférico", xPercent: 26, yPercent: 56, color: "#00e5ff" }
];

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL CONTROLADOR 2D
// ============================================================================

/**
 * Inicializa el Motor 2D dentro de `#view-sim2d` en `dashboard.html`.
 * Construye el centro de mando 2D, inicializa los 3 subcomponentes hermanos,
 * carga los casos interactivos y arranca el lienzo del paciente y monitor de signos.
 */
export async function initEngine2DController() {
    const sim2dView = ensureSim2DViewContainer();
    if (!sim2dView) return;

    engine2DState.career = appState.currentCareer || appState.currentUserData?.carrera || "medicina";
    engine2DState.stage = appState.currentStage || "general";
    engine2DState.subject = appState.currentSubject || "todas";

    // 1. Construir la estructura visual completa en #view-sim2d
    renderEngine2DWorkspace(sim2dView);

    // 2. Inicializar de forma segura los 3 subcomponentes de js/6-engine-2d/
    initEngine2DSubmodules();

    // 3. Escuchar cambios globales de carrera y materia desde router.spa.js / state.store.js
    bindGlobalCurriculumEvents2D();

    // 4. Cargar catálogo de casos clínicos 2D (Firestore + Semilla local)
    await loadEngine2DCases({
        career: engine2DState.career,
        subject: engine2DState.subject
    });

    engine2DState.initialized = true;
}

// Alias exportados para compatibilidad directa con app.orchestrator.js y router.spa.js
export const initSim2D = initEngine2DController;
export const initEngine2D = initEngine2DController;

/**
 * Garantiza que exista el contenedor `#view-sim2d` dentro de `#views-container` en `dashboard.html`.
 * @returns {HTMLElement|null}
 */
function ensureSim2DViewContainer() {
    let sim2dView = document.getElementById("view-sim2d");
    if (sim2dView) return sim2dView;

    const viewsContainer = document.getElementById("views-container");
    if (!viewsContainer) return null;

    sim2dView = document.createElement("section");
    sim2dView.id = "view-sim2d";
    sim2dView.className = "hidden space-y-6";
    viewsContainer.appendChild(sim2dView);
    return sim2dView;
}

/**
 * Despierta los 3 subcomponentes de la carpeta `js/6-engine-2d/` si ya tienen sus funciones exportadas.
 */
function initEngine2DSubmodules() {
    if (typeof Sim2DDecisionTree.initDecisionTree2D === "function") {
        Sim2DDecisionTree.initDecisionTree2D({
            state: engine2DState,
            onSelectDecision: handleDecisionNodeChoice2D
        });
    }

    if (typeof Sim2DInteractiveTools.initInteractiveTools2D === "function") {
        Sim2DInteractiveTools.initInteractiveTools2D({
            state: engine2DState,
            tools: CLINICAL_TOOLS_2D,
            hotspots: PATIENT_HOTSPOTS_2D,
            onApplyTool: applyInstrumentalTool2D
        });
    }

    if (typeof Sim2DVitalsMonitor.initVitalsMonitor2D === "function") {
        Sim2DVitalsMonitor.initVitalsMonitor2D({
            state: engine2DState,
            assetsPath: ASSETS_2D_PATHS
        });
    }
}

// ============================================================================
// 3. CONSTRUCCIÓN DEL LIENZO Y CENTRO DE SIMULACIÓN 2D (#view-sim2d)
// ============================================================================

/**
 * Inyecta la interfaz completa del Simulador Clínico 2D en `#view-sim2d`:
 * - Barra de comando con selectores de Carrera, Materia y Caso Clínico.
 * - Columna Izquierda/Central: Barra de Instrumental 2D (Drag & Drop / Clic) + Lienzo HTML5 de Exploración del Paciente.
 * - Columna Derecha: Monitor Multiparámetro 2D en tiempo real (ECG, SpO2, PA) + Árbol de Decisión Clínica Ramificado.
 * @param {HTMLElement} sim2dView
 */
function renderEngine2DWorkspace(sim2dView) {
    if (document.getElementById("engine2d-workspace-root")) {
        populateEngine2DSelectors();
        return;
    }

    sim2dView.innerHTML = `
        <div id="engine2d-workspace-root" class="space-y-6">
            <!-- BARRA SUPERIOR DE COMANDO 2D -->
            <div class="bg-surface-container border border-primary/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,229,255,0.06)] space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold">
                                Motor 2D • Simulación Clínica Interactiva en Lienzo
                            </span>
                        </div>
                        <h2 class="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary">vital_signs</span>
                            <span>Laboratorio de Casos Ramificados, Auscultación & Monitor Multiparámetro</span>
                        </h2>
                    </div>

                    <!-- Indicador de Puntaje Clínico y Botón de Reinicio -->
                    <div class="flex items-center gap-3">
                        <div class="bg-surface border border-surface-high rounded-xl px-4 py-2 text-right">
                            <span class="block text-[10px] font-mono text-gray-400 uppercase">Desempeño Clínico 2D</span>
                            <span id="engine2d-score-badge" class="text-base font-extrabold font-mono text-secondary">100 / 100 pts</span>
                        </div>
                        <button
                            type="button"
                            id="btn-engine2d-restart"
                            class="px-4 py-2.5 rounded-xl bg-surface-high hover:bg-primary hover:text-surface text-white text-xs font-extrabold transition-all flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-sm">restart_alt</span>
                            <span>Reiniciar Caso</span>
                        </button>
                    </div>
                </div>

                <!-- SELECTORES DE CARRERA, MATERIA Y CASO CLÍNICO INTERACTIVO 2D -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div class="md:col-span-4">
                        <label for="engine2d-career-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Carrera / Dominio Clínico
                        </label>
                        <select id="engine2d-career-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                        </select>
                    </div>

                    <div class="md:col-span-4">
                        <label for="engine2d-subject-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Materia / Área Clínica
                        </label>
                        <select id="engine2d-subject-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                            <option value="todas">Todas las materias</option>
                        </select>
                    </div>

                    <div class="md:col-span-4">
                        <label for="engine2d-case-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Caso Clínico Interactivo 2D
                        </label>
                        <select id="engine2d-case-select" class="w-full bg-surface border border-primary/50 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-primary outline-none transition-colors">
                        </select>
                    </div>
                </div>
            </div>

            <!-- CUERPO PRINCIPAL DE SIMULACIÓN 2D (12 COLUMNAS) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- COLUMNA IZQUIERDA/CENTRAL (7 COLS): INSTRUMENTAL 2D + LIENZO DEL PACIENTE -->
                <div class="lg:col-span-7 space-y-4">
                    <!-- Barra de Instrumental Médico 2D (Drag & Drop y Selección) -->
                    <div class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">medical_services</span>
                                <span>Instrumental Clínico 2D (Arrastra al paciente o selecciona y haz clic en un foco)</span>
                            </span>
                            <span id="engine2d-active-tool-badge" class="text-[11px] font-mono text-secondary font-bold">
                                Activo: Fonendoscopio 2D
                            </span>
                        </div>

                        <div id="engine2d-tools-bar" class="grid grid-cols-2 sm:grid-cols-5 gap-2"></div>

                        <p id="engine2d-tool-hint" class="text-xs text-gray-400 bg-surface rounded-xl px-3.5 py-2 border border-surface-high">
                            Selecciona un instrumento médico y aplícalo sobre los puntos anatómicos del lienzo del paciente.
                        </p>
                    </div>

                    <!-- Lienzo 2D del Paciente con Focos Anatómicos Interactivos -->
                    <div class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <span id="engine2d-case-tag" class="text-[10px] font-mono uppercase text-primary font-bold">
                                    ESCENARIO 2D ACTIVO
                                </span>
                                <h3 id="engine2d-case-title" class="text-base font-extrabold text-white">
                                    Cargando caso clínico 2D...
                                </h3>
                            </div>
                            <span id="engine2d-patient-stability" class="px-3 py-1 rounded-full text-[11px] font-mono font-extrabold bg-warning/15 text-warning border border-warning/40">
                                Inestable • Requiere Intervención
                            </span>
                        </div>

                        <p id="engine2d-case-vignette" class="text-xs text-gray-300 leading-relaxed bg-surface p-3.5 rounded-xl border border-surface-high">
                        </p>

                        <!-- Escenario Interactivo HTML5 Canvas + Hotspots Anatómicos -->
                        <div
                            id="engine2d-patient-stage"
                            class="relative w-full h-[390px] bg-[#070b10] border border-surface-high rounded-2xl overflow-hidden select-none flex items-center justify-center"
                        >
                            <canvas id="engine2d-patient-canvas" width="680" height="390" class="w-full h-full object-contain"></canvas>
                            <div id="engine2d-hotspots-layer" class="absolute inset-0"></div>
                        </div>

                        <!-- Bandeja de Hallazgos de Exploración Física y Auscultación -->
                        <div class="bg-surface border border-surface-high rounded-xl p-3.5 space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-[11px] font-mono uppercase text-primary font-bold flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm">clinical_notes</span>
                                    <span>Bitácora de Exploración e Instrumental Aplicado</span>
                                </span>
                                <button
                                    type="button"
                                    id="btn-engine2d-play-sound"
                                    class="px-3 py-1 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-surface text-[11px] font-mono font-extrabold transition-all flex items-center gap-1"
                                >
                                    <span class="material-symbols-outlined text-sm">volume_up</span>
                                    <span>Escuchar Foco Activo</span>
                                </button>
                            </div>
                            <div id="engine2d-findings-log" class="text-xs text-gray-300 font-mono space-y-1 max-h-28 overflow-y-auto">
                                <p class="text-gray-500">Aplica el fonendoscopio o instrumental sobre el paciente para registrar hallazgos.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUMNA DERECHA (5 COLS): MONITOR MULTIPARÁMETRO 2D + ÁRBOL DE DECISIÓN CLÍNICA -->
                <div class="lg:col-span-5 space-y-4">
                    <!-- Monitor Multiparámetro 2D en Tiempo Real -->
                    <div id="engine2d-vitals-container" class="bg-[#06090e] border-2 border-surface-high rounded-2xl p-4 shadow-2xl space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <div class="flex items-center gap-2">
                                <span class="inline-block w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
                                <span class="text-xs font-mono font-extrabold text-white uppercase tracking-wider">
                                    Monitor Multiparámetro 2D • ICU-ALICIZATION
                                </span>
                            </div>
                            <span id="engine2d-rhythm-label" class="text-[11px] font-mono text-secondary font-bold">
                                Taquicardia Sinusal
                            </span>
                        </div>

                        <!-- Curvas 2D en Tiempo Real (ECG DII y Plestimografía SpO2) -->
                        <div class="bg-[#030508] border border-surface-high rounded-xl p-2">
                            <canvas id="engine2d-vitals-canvas" width="460" height="130" class="w-full h-[130px] block"></canvas>
                        </div>

                        <!-- Parámetros Hemodinámicos Numéricos -->
                        <div class="grid grid-cols-4 gap-2 text-center">
                            <div class="bg-surface-container border border-surface-high rounded-xl p-2.5">
                                <span class="block text-[10px] font-mono text-secondary uppercase font-bold">FC (lpm)</span>
                                <span id="vital-hr-val" class="text-xl font-mono font-extrabold text-secondary">118</span>
                            </div>
                            <div class="bg-surface-container border border-surface-high rounded-xl p-2.5">
                                <span class="block text-[10px] font-mono text-primary uppercase font-bold">SpO2 (%)</span>
                                <span id="vital-spo2-val" class="text-xl font-mono font-extrabold text-primary">91%</span>
                            </div>
                            <div class="bg-surface-container border border-surface-high rounded-xl p-2.5">
                                <span class="block text-[10px] font-mono text-warning uppercase font-bold">PA (mmHg)</span>
                                <span id="vital-bp-val" class="text-base font-mono font-extrabold text-warning">88/54</span>
                            </div>
                            <div class="bg-surface-container border border-surface-high rounded-xl p-2.5">
                                <span class="block text-[10px] font-mono text-gray-300 uppercase font-bold">FR / Temp</span>
                                <span id="vital-rr-val" class="text-sm font-mono font-extrabold text-white">26 • 38.4°</span>
                            </div>
                        </div>
                    </div>

                    <!-- Árbol de Decisión Clínica Ramificado -->
                    <div id="engine2d-decision-container" class="bg-surface-container border border-primary/40 rounded-2xl p-5 space-y-4">
                        <div class="flex items-center justify-between border-b border-surface-high pb-3">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary">account_tree</span>
                                <h4 class="text-sm font-extrabold text-white uppercase tracking-wide">
                                    Árbol de Decisión Clínica Paso a Paso
                                </h4>
                            </div>
                            <span id="engine2d-step-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/15 text-primary">
                                Nodo 1
                            </span>
                        </div>

                        <div id="engine2d-decision-body" class="space-y-3"></div>

                        <!-- Retroalimentación / Racional CACES 2D -->
                        <div id="engine2d-decision-feedback" class="hidden rounded-xl p-3.5 border text-xs leading-relaxed"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    populateEngine2DSelectors();
    renderInteractiveToolsBar2D();
    bindEngine2DWorkspaceEvents();
    startVitalsWaveformLoop2D();
}

/**
 * Rellena los selectores de Carrera y Materia del Motor 2D leyendo `window.makaiData`.
 */
function populateEngine2DSelectors() {
    const careerSelect = document.getElementById("engine2d-career-select");
    if (!careerSelect) return;

    const data = window.makaiData || {};
    const careersList = Array.isArray(data.carreras) && data.carreras.length > 0
        ? data.carreras
        : [
            { id: "medicina", nombre: "Medicina Humana (FCS-EC)", activa: true, materias: [] },
            { id: "enfermeria", nombre: "Enfermería & Cuidados Críticos", activa: true, materias: [] },
            { id: "odontologia", nombre: "Odontología Clínica", activa: false, materias: [] },
            { id: "obstetricia", nombre: "Obstetricia & Salud Materna", activa: false, materias: [] }
        ];

    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    const isAdmin = isMasterAdmin(userEmail);

    careerSelect.innerHTML = "";
    careersList.forEach(c => {
        const isLocked = c.activa === false && !isAdmin;
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.disabled = isLocked;
        opt.textContent = isLocked ? `${c.nombre} (Próximamente)` : c.nombre;
        if (c.id === engine2DState.career) opt.selected = true;
        careerSelect.appendChild(opt);
    });

    updateEngine2DSubjectOptions(engine2DState.career);
}

/**
 * Actualiza las materias disponibles para la carrera seleccionada en el Motor 2D.
 * @param {string} careerId
 */
function updateEngine2DSubjectOptions(careerId) {
    const subjectSelect = document.getElementById("engine2d-subject-select");
    if (!subjectSelect) return;

    const data = window.makaiData || {};
    const foundCareer = (data.carreras || []).find(c => c.id === careerId);
    const subjects = foundCareer?.materias || [];

    subjectSelect.innerHTML = `<option value="todas">Todas las materias (${subjects.length || "General"})</option>`;
    subjects.forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        if (mat === engine2DState.subject) opt.selected = true;
        subjectSelect.appendChild(opt);
    });
}

// ============================================================================
// 4. CATÁLOGO DE CASOS CLÍNICOS INTERACTIVOS 2D (SEMILLA + FIRESTORE)
// ============================================================================

/**
 * Obtiene los casos clínicos ramificados 2D desde Firestore (`casos_simulacion_2d`)
 * y los combina con el banco semilla local para operación inmediata.
 * @param {Object} filters
 */
export async function loadEngine2DCases(filters = {}) {
    if (filters.career) engine2DState.career = filters.career;
    if (filters.subject) engine2DState.subject = filters.subject;

    const seedCases2D = getSeedInteractiveCases2D();
    const loadedCases = [...seedCases2D];

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.CASES_2D));
        snap.forEach(docSnap => {
            const raw = docSnap.data();
            if (raw && raw.titulo) {
                loadedCases.push({
                    id: docSnap.id,
                    ...raw
                });
            }
        });
    } catch (err) {
        console.warn("Motor 2D operando con catálogo semilla local:", err);
    }

    engine2DState.allCases = loadedCases;
    filterEngine2DCases();
}

/**
 * Filtra los casos 2D según la carrera y materia seleccionadas y carga el primer caso activo.
 */
export function filterEngine2DCases() {
    const targetCareer = (engine2DState.career || "medicina").toLowerCase();
    const targetSubject = (engine2DState.subject || "todas").toLowerCase();

    let matching = engine2DState.allCases.filter(c => {
        const matchCareer = !targetCareer || (c.carrera || "medicina").toLowerCase() === targetCareer;
        const matchSubject =
            targetSubject === "todas" ||
            (c.materia || "").toLowerCase() === targetSubject;
        return matchCareer && matchSubject;
    });

    if (matching.length === 0) {
        matching = engine2DState.allCases.filter(
            c => (c.carrera || "medicina").toLowerCase() === targetCareer
        );
    }
    if (matching.length === 0) {
        matching = engine2DState.allCases;
    }

    engine2DState.filteredCases = matching;

    const caseSelect = document.getElementById("engine2d-case-select");
    if (caseSelect) {
        caseSelect.innerHTML = matching.map(c => `
            <option value="${c.id}">
                [${(c.materia || "Clínica").slice(0, 22)}] ${c.titulo}
            </option>
        `).join("");
    }

    if (matching.length > 0) {
        startInteractiveCase2D(matching[0].id);
    }
}

// ============================================================================
// 5. EJECUCIÓN DE CASO CLÍNICO 2D, INSTRUMENTAL Y ÁRBOL DE DECISIÓN
// ============================================================================

/**
 * Inicia o reinicia un caso clínico interactivo 2D por su ID.
 * @param {string} caseId
 */
export function startInteractiveCase2D(caseId) {
    const foundCase = engine2DState.filteredCases.find(c => c.id === caseId)
        || engine2DState.allCases.find(c => c.id === caseId)
        || engine2DState.allCases[0];

    if (!foundCase) return;

    const requiredPlan = foundCase.planRequerido || "Básico";
    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    if (!isMasterAdmin(userEmail) && !canAccessBySubscription(requiredPlan)) {
        const freemiumModal = document.getElementById("freemium-modal");
        if (freemiumModal) {
            freemiumModal.classList.remove("hidden");
            freemiumModal.classList.add("flex");
        }
        return;
    }

    engine2DState.activeCase = foundCase;
    engine2DState.currentNodeId = foundCase.initialNodeId || "node_1";
    engine2DState.isCaseFinished = false;
    engine2DState.score = 100;
    engine2DState.actionsHistory = [];
    engine2DState.discoveredFindings = [];
    engine2DState.vitals = {
        ...(foundCase.initialVitals || {
            hr: 118,
            bpSys: 88,
            bpDia: 54,
            spo2: 91,
            rr: 26,
            temp: 38.4,
            rhythm: "taquicardia_sinusal",
            heartSound: "Ruidos cardíacos taquicárdicos, S3 en ápex",
            lungSound: "Murmullo vesicular disminuido con crepitantes basales"
        })
    };

    // Actualizar encabezados del caso
    const tagEl = document.getElementById("engine2d-case-tag");
    const titleEl = document.getElementById("engine2d-case-title");
    const vignetteEl = document.getElementById("engine2d-case-vignette");
    const findingsLog = document.getElementById("engine2d-findings-log");
    const feedbackBox = document.getElementById("engine2d-decision-feedback");

    if (tagEl) tagEl.textContent = `${foundCase.carrera.toUpperCase()} • ${foundCase.materia.toUpperCase()} • PLAN ${requiredPlan.toUpperCase()}`;
    if (titleEl) titleEl.textContent = foundCase.titulo;
    if (vignetteEl) vignetteEl.textContent = foundCase.enunciadoInicial;
    if (findingsLog) {
        findingsLog.innerHTML = `<p class="text-gray-400">▶ Caso iniciado. Selecciona un instrumento 2D y explora los focos anatómicos del paciente.</p>`;
    }
    feedbackBox?.classList.add("hidden");

    updateEngine2DScoreUI();
    updatePatientVitals2D(engine2DState.vitals);
    drawPatientCanvas2D();
    renderPatientHotspots2D();
    renderCurrentDecisionNode2D();
}

/**
 * Renderiza la barra de instrumental médico 2D con soporte para clic y Drag & Drop HTML5.
 */
function renderInteractiveToolsBar2D() {
    const toolsBar = document.getElementById("engine2d-tools-bar");
    if (!toolsBar) return;

    if (typeof Sim2DInteractiveTools.renderToolsBar === "function") {
        Sim2DInteractiveTools.renderToolsBar(toolsBar, CLINICAL_TOOLS_2D, engine2DState);
        return;
    }

    toolsBar.innerHTML = CLINICAL_TOOLS_2D.map(tool => {
        const isSelected = engine2DState.selectedToolId === tool.id;
        return `
            <button
                type="button"
                draggable="true"
                data-tool-id="${tool.id}"
                class="engine2d-tool-btn p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing ${
                    isSelected
                        ? "bg-primary/15 border-primary text-primary shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                        : "bg-surface border-surface-high text-gray-300 hover:border-gray-500 hover:text-white"
                }"
            >
                <span class="material-symbols-outlined text-xl">${tool.icono}</span>
                <span class="text-[11px] font-extrabold text-center leading-tight">${tool.nombre}</span>
            </button>
        `;
    }).join("");

    toolsBar.querySelectorAll(".engine2d-tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            selectClinicalTool2D(btn.dataset.toolId);
        });

        btn.addEventListener("dragstart", (e) => {
            const toolId = btn.dataset.toolId;
            selectClinicalTool2D(toolId);
            e.dataTransfer?.setData("text/plain", toolId);
        });
    });
}

/**
 * Selecciona una herramienta clínica 2D activa y muestra su guía de uso.
 * @param {string} toolId
 */
export function selectClinicalTool2D(toolId) {
    const found = CLINICAL_TOOLS_2D.find(t => t.id === toolId);
    if (!found) return;

    engine2DState.selectedToolId = found.id;

    const badge = document.getElementById("engine2d-active-tool-badge");
    const hint = document.getElementById("engine2d-tool-hint");
    if (badge) badge.textContent = `Activo: ${found.nombre}`;
    if (hint) hint.textContent = found.instruccion;

    renderInteractiveToolsBar2D();
}

/**
 * Renderiza los puntos anatómicos (hotspots) sobre el lienzo del paciente para recibir
 * tanto clics como eventos `drop` de instrumental médico.
 */
function renderPatientHotspots2D() {
    const layer = document.getElementById("engine2d-hotspots-layer");
    if (!layer) return;

    layer.innerHTML = PATIENT_HOTSPOTS_2D.map(spot => {
        const isSelected = engine2DState.selectedHotspotId === spot.id;
        return `
            <button
                type="button"
                data-hotspot-id="${spot.id}"
                title="${spot.label}"
                style="left: ${spot.xPercent}%; top: ${spot.yPercent}%;"
                class="engine2d-hotspot-btn -translate-x-1/2 -translate-y-1/2 absolute group flex items-center justify-center"
            >
                <span class="w-6 h-6 rounded-full flex items-center justify-center border-2 transition-transform ${
                    isSelected ? "scale-125 bg-primary/30 border-primary" : "bg-surface/80 border-warning hover:scale-110"
                }">
                    <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                </span>
                <span class="hidden group-hover:block absolute left-7 whitespace-nowrap px-2 py-0.5 rounded bg-surface-container border border-primary/40 text-[10px] font-mono text-white shadow-lg z-10">
                    ${spot.label}
                </span>
            </button>
        `;
    }).join("");

    layer.querySelectorAll(".engine2d-hotspot-btn").forEach(btn => {
        const spotId = btn.dataset.hotspotId;

        btn.addEventListener("click", () => {
            applyInstrumentalTool2D(engine2DState.selectedToolId, spotId);
        });

        btn.addEventListener("dragover", (e) => {
            e.preventDefault();
            btn.classList.add("scale-125");
        });

        btn.addEventListener("dragleave", () => {
            btn.classList.remove("scale-125");
        });

        btn.addEventListener("drop", (e) => {
            e.preventDefault();
            btn.classList.remove("scale-125");
            const droppedToolId = e.dataTransfer?.getData("text/plain") || engine2DState.selectedToolId;
            applyInstrumentalTool2D(droppedToolId, spotId);
        });
    });
}

/**
 * Aplica el instrumento médico seleccionado sobre un foco anatómico del paciente 2D,
 * registrando hallazgos clínicos, reproduciendo auscultación o mejorando signos vitales.
 * @param {string} toolId
 * @param {string} hotspotId
 */
export function applyInstrumentalTool2D(toolId, hotspotId) {
    engine2DState.selectedHotspotId = hotspotId;

    if (typeof Sim2DInteractiveTools.handleToolOnHotspot === "function") {
        Sim2DInteractiveTools.handleToolOnHotspot(toolId, hotspotId, engine2DState);
        return;
    }

    const activeCase = engine2DState.activeCase;
    const spot = PATIENT_HOTSPOTS_2D.find(s => s.id === hotspotId);
    const tool = CLINICAL_TOOLS_2D.find(t => t.id === toolId);
    if (!spot || !tool) return;

    let findingMessage = "";

    if (toolId === "fonendoscopio") {
        const customAuscultation = activeCase?.auscultacionPorFoco?.[hotspotId];
        if (customAuscultation) {
            findingMessage = `[Auscultación • ${spot.label}]: ${customAuscultation}`;
        } else if (hotspotId === "base_pulmonar") {
            findingMessage = `[Auscultación • ${spot.label}]: ${engine2DState.vitals.lungSound}`;
        } else {
            findingMessage = `[Auscultación • ${spot.label}]: ${engine2DState.vitals.heartSound}`;
        }
        playClinicalAuscultationTone(hotspotId);
    } else if (toolId === "ecg12") {
        findingMessage = `[ECG 12 Derivaciones en ${spot.label}]: Ritmo actual ${engine2DState.vitals.rhythm.replace(/_/g, " ").toUpperCase()} • FC ${engine2DState.vitals.hr} lpm.`;
    } else if (toolId === "oxigeno" && hotspotId === "via_aerea") {
        const newSpo2 = Math.min(99, engine2DState.vitals.spo2 + 5);
        const newRr = Math.max(16, engine2DState.vitals.rr - 4);
        updatePatientVitals2D({ spo2: newSpo2, rr: newRr });
        findingMessage = `[Oxigenoterapia en ${spot.label}]: Se administra O2 suplementario. SpO2 sube a ${newSpo2}% y FR desciende a ${newRr} rpm.`;
    } else if (toolId === "acceso_venoso" && hotspotId === "acceso_braquial") {
        const newSys = Math.min(120, engine2DState.vitals.bpSys + 8);
        const newDia = Math.min(80, engine2DState.vitals.bpDia + 5);
        updatePatientVitals2D({ bpSys: newSys, bpDia: newDia });
        findingMessage = `[Acceso Venoso Periférico]: Vía permeable calibre 18G canalizada en miembro superior. PA mejora a ${newSys}/${newDia} mmHg.`;
    } else if (toolId === "desfibrilador") {
        findingMessage = `[Monitor / Palas en ${spot.label}]: Lectura de impedancia torácica lista. Verifica en el árbol de decisión si el ritmo requiere descarga o fármacos.`;
    } else {
        findingMessage = `[${tool.nombre} → ${spot.label}]: Maniobra registrada. Evalúa el foco anatómico más específico para este instrumento.`;
    }

    appendFindingToLog2D(findingMessage);
    renderPatientHotspots2D();
    drawPatientCanvas2D();
}

/**
 * Añade una entrada cronológica a la bitácora de exploración 2D.
 * @param {string} text
 */
function appendFindingToLog2D(text) {
    engine2DState.discoveredFindings.unshift(text);
    const logEl = document.getElementById("engine2d-findings-log");
    if (!logEl) return;

    logEl.innerHTML = engine2DState.discoveredFindings
        .slice(0, 8)
        .map((line, idx) => `
            <div class="${idx === 0 ? "text-primary font-bold" : "text-gray-400"}">
                • ${line}
            </div>
        `)
        .join("");
}

/**
 * Renderiza el nodo actual del Árbol de Decisión Clínica en `#engine2d-decision-body`.
 */
export function renderCurrentDecisionNode2D() {
    const container = document.getElementById("engine2d-decision-body");
    const stepBadge = document.getElementById("engine2d-step-badge");
    if (!container || !engine2DState.activeCase) return;

    if (typeof Sim2DDecisionTree.renderDecisionNode === "function") {
        Sim2DDecisionTree.renderDecisionNode(container, engine2DState);
        return;
    }

    const nodes = engine2DState.activeCase.nodes || {};
    const currentNode = nodes[engine2DState.currentNodeId];

    if (!currentNode) {
        container.innerHTML = `
            <div class="bg-surface rounded-xl p-4 border border-secondary/50 text-center space-y-3">
                <span class="material-symbols-outlined text-3xl text-secondary">verified</span>
                <h5 class="text-sm font-extrabold text-white">Simulación Clínica 2D Completada</h5>
                <p class="text-xs text-gray-300">Puntaje final obtenido: <strong class="text-secondary">${engine2DState.score}/100 puntos</strong>.</p>
            </div>
        `;
        return;
    }

    if (stepBadge) {
        stepBadge.textContent = currentNode.etapaLabel || "Decisión Clínica";
    }

    container.innerHTML = `
        <p class="text-xs font-bold text-white leading-relaxed bg-surface p-3.5 rounded-xl border border-surface-high">
            ${currentNode.pregunta}
        </p>
        <div class="space-y-2">
            ${(currentNode.opciones || []).map((opt, idx) => `
                <button
                    type="button"
                    data-decision-opt="${opt.id}"
                    class="engine2d-decision-opt w-full text-left p-3 rounded-xl bg-surface hover:bg-surface-high border border-surface-high hover:border-primary transition-all flex items-start gap-2.5"
                >
                    <span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-xs font-extrabold">
                        ${String.fromCharCode(65 + idx)}
                    </span>
                    <span class="text-xs text-gray-200 font-medium leading-snug">${opt.texto}</span>
                </button>
            `).join("")}
        </div>
    `;

    container.querySelectorAll(".engine2d-decision-opt").forEach(btn => {
        btn.addEventListener("click", () => {
            handleDecisionNodeChoice2D(btn.dataset.decisionOpt);
        });
    });
}

/**
 * Procesa la decisión clínica elegida por el estudiante en el nodo actual,
 * altera los signos vitales del paciente, muestra el Racional CACES y avanza al siguiente nodo.
 * @param {string} optionId
 */
export function handleDecisionNodeChoice2D(optionId) {
    const activeCase = engine2DState.activeCase;
    if (!activeCase || engine2DState.isCaseFinished) return;

    const currentNode = (activeCase.nodes || {})[engine2DState.currentNodeId];
    if (!currentNode) return;

    const chosenOpt = (currentNode.opciones || []).find(o => o.id === optionId);
    if (!chosenOpt) return;

    // 1. Aplicar cambios hemodinámicos en los signos vitales del paciente
    if (chosenOpt.vitalsDelta) {
        const nextVitals = { ...engine2DState.vitals };
        if (typeof chosenOpt.vitalsDelta.hr === "number") nextVitals.hr = chosenOpt.vitalsDelta.hr;
        if (typeof chosenOpt.vitalsDelta.bpSys === "number") nextVitals.bpSys = chosenOpt.vitalsDelta.bpSys;
        if (typeof chosenOpt.vitalsDelta.bpDia === "number") nextVitals.bpDia = chosenOpt.vitalsDelta.bpDia;
        if (typeof chosenOpt.vitalsDelta.spo2 === "number") nextVitals.spo2 = chosenOpt.vitalsDelta.spo2;
        if (typeof chosenOpt.vitalsDelta.rr === "number") nextVitals.rr = chosenOpt.vitalsDelta.rr;
        if (chosenOpt.vitalsDelta.rhythm) nextVitals.rhythm = chosenOpt.vitalsDelta.rhythm;
        updatePatientVitals2D(nextVitals);
    }

    // 2. Ajustar puntaje clínico según si la decisión fue óptima o iatrogénica
    const scoreDelta = typeof chosenOpt.scoreDelta === "number"
        ? chosenOpt.scoreDelta
        : (chosenOpt.esCorrecta ? 0 : -15);
    engine2DState.score = Math.max(0, Math.min(100, engine2DState.score + scoreDelta));
    updateEngine2DScoreUI();

    // 3. Mostrar caja de retroalimentación clínica (Racional CACES 2D)
    const feedbackBox = document.getElementById("engine2d-decision-feedback");
    if (feedbackBox) {
        feedbackBox.classList.remove("hidden", "bg-secondary/15", "border-secondary", "text-secondary", "bg-danger/15", "border-danger", "text-danger");
        if (chosenOpt.esCorrecta) {
            feedbackBox.classList.add("bg-secondary/15", "border-secondary", "text-gray-100");
            feedbackBox.innerHTML = `<strong class="text-secondary block mb-1">✓ Conducta Clínica Correcta:</strong> ${chosenOpt.racional || "Excelente intervención hemodinámica."}`;
        } else {
            feedbackBox.classList.add("bg-danger/15", "border-danger", "text-gray-100");
            feedbackBox.innerHTML = `<strong class="text-danger block mb-1">⚠ Alerta Clínica (-15 pts):</strong> ${chosenOpt.racional || "Esta conducta deteriora la estabilidad del paciente. Revisa el protocolo CACES."}`;
        }
    }

    appendFindingToLog2D(`[Decisión Tomada]: ${chosenOpt.texto}`);

    // 4. Avanzar al siguiente nodo si la opción lo permite o finalizar el caso
    if (chosenOpt.nextNodeId === "FIN_EXITO" || chosenOpt.nextNodeId === "FIN") {
        engine2DState.isCaseFinished = true;
        completeInteractiveCase2D({
            caseId: activeCase.id,
            score: engine2DState.score,
            success: true
        });
    } else if (chosenOpt.nextNodeId) {
        engine2DState.currentNodeId = chosenOpt.nextNodeId;
        renderCurrentDecisionNode2D();
    }
}

// ============================================================================
// 6. MONITOR MULTIPARÁMETRO 2D, LIENZO HTML5 Y AUSCULTACIÓN SINTETIZADA
// ============================================================================

/**
 * Actualiza los parámetros vitales del paciente en estado, UI y subcomponente `sim2d.vitalsMonitor.js`.
 * @param {Object} vitalsPatch
 */
export function updatePatientVitals2D(vitalsPatch = {}) {
    engine2DState.vitals = {
        ...engine2DState.vitals,
        ...vitalsPatch
    };

    if (typeof Sim2DVitalsMonitor.updateMonitorVitals === "function") {
        Sim2DVitalsMonitor.updateMonitorVitals(engine2DState.vitals);
    }

    const v = engine2DState.vitals;
    const hrEl = document.getElementById("vital-hr-val");
    const spo2El = document.getElementById("vital-spo2-val");
    const bpEl = document.getElementById("vital-bp-val");
    const rrEl = document.getElementById("vital-rr-val");
    const rhythmEl = document.getElementById("engine2d-rhythm-label");
    const stabilityEl = document.getElementById("engine2d-patient-stability");

    if (hrEl) hrEl.textContent = String(v.hr);
    if (spo2El) spo2El.textContent = `${v.spo2}%`;
    if (bpEl) bpEl.textContent = `${v.bpSys}/${v.bpDia}`;
    if (rrEl) rrEl.textContent = `${v.rr} • ${v.temp}°`;
    if (rhythmEl) rhythmEl.textContent = (v.rhythm || "sinusal").replace(/_/g, " ").toUpperCase();

    if (stabilityEl) {
        const isStable = v.hr >= 60 && v.hr <= 100 && v.spo2 >= 94 && v.bpSys >= 100;
        stabilityEl.className = isStable
            ? "px-3 py-1 rounded-full text-[11px] font-mono font-extrabold bg-secondary/15 text-secondary border border-secondary/40"
            : "px-3 py-1 rounded-full text-[11px] font-mono font-extrabold bg-warning/15 text-warning border border-warning/40";
        stabilityEl.textContent = isStable
            ? "Paciente Estabilizado • Hemodinamia Óptima"
            : "Inestable • Requiere Intervención";
    }
}

/**
 * Dibuja la silueta clínica por capas y las grillas de exploración en `#engine2d-patient-canvas`.
 */
function drawPatientCanvas2D() {
    const canvas = document.getElementById("engine2d-patient-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Cuadrícula médica de fondo Cyber-Medical
    ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // 2. Silueta anatómica toraco-braquial en 2D
    ctx.save();
    ctx.strokeStyle = "rgba(0, 229, 255, 0.55)";
    ctx.fillStyle = "rgba(21, 25, 34, 0.85)";
    ctx.lineWidth = 2.2;

    // Cabeza y cuello
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.14, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tórax y hombros
    ctx.beginPath();
    ctx.roundRect(w * 0.33, h * 0.24, w * 0.34, h * 0.52, 28);
    ctx.fill();
    ctx.stroke();

    // Miembro superior derecho del paciente (acceso braquial)
    ctx.beginPath();
    ctx.roundRect(w * 0.21, h * 0.28, w * 0.1, h * 0.45, 18);
    ctx.fill();
    ctx.stroke();

    // Miembro superior izquierdo
    ctx.beginPath();
    ctx.roundRect(w * 0.69, h * 0.28, w * 0.1, h * 0.45, 18);
    ctx.fill();
    ctx.stroke();

    // Campos pulmonares esquemáticos
    ctx.fillStyle = "rgba(148, 222, 45, 0.10)";
    ctx.strokeStyle = "rgba(148, 222, 45, 0.35)";
    ctx.beginPath();
    ctx.ellipse(w * 0.43, h * 0.43, 36, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(w * 0.57, h * 0.43, 36, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Silueta cardíaca en precordio izquierdo
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.strokeStyle = "rgba(255, 77, 77, 0.7)";
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.46, 26, 32, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Etiqueta del foco actualmente seleccionado
    const currentSpot = PATIENT_HOTSPOTS_2D.find(s => s.id === engine2DState.selectedHotspotId);
    if (currentSpot) {
        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.fillText(`Foco Activo: ${currentSpot.label}`, 18, h - 16);
    }

    ctx.restore();
}

/**
 * Inicia el bucle de animación en HTML5 Canvas para las ondas en vivo de ECG y SpO2.
 */
function startVitalsWaveformLoop2D() {
    if (engine2DState.ecgAnimationId) {
        cancelAnimationFrame(engine2DState.ecgAnimationId);
    }

    const renderFrame = () => {
        const canvas = document.getElementById("engine2d-vitals-canvas");
        if (canvas && !document.getElementById("view-sim2d")?.classList.contains("hidden")) {
            drawVitalsWaveformsFrame(canvas);
        }
        engine2DState.ecgAnimationId = requestAnimationFrame(renderFrame);
    };

    engine2DState.ecgAnimationId = requestAnimationFrame(renderFrame);
}

/**
 * Dibuja las ondas dinámicas de ECG (verde neón) y pletismografía SpO2 (cian neón).
 * @param {HTMLCanvasElement} canvas
 */
function drawVitalsWaveformsFrame(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const hr = engine2DState.vitals.hr || 80;
    const speed = Math.max(0.04, (hr / 60) * 0.065);
    engine2DState.ecgPhase += speed;

    ctx.fillStyle = "#030508";
    ctx.fillRect(0, 0, w, h);

    // Grilla clínica del monitor
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    // 1. Curva Superior: Electrocardiograma (Derivación II)
    ctx.strokeStyle = "#94de2d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
        const t = (x * 0.055 + engine2DState.ecgPhase) % (Math.PI * 2);
        let yOffset = 0;
        // Complejo P-QRS-T sintético
        if (t > 1.0 && t < 1.3) yOffset = -4 * Math.sin((t - 1.0) * 10);
        else if (t >= 2.0 && t < 2.12) yOffset = 5;
        else if (t >= 2.12 && t < 2.28) yOffset = -26;
        else if (t >= 2.28 && t < 2.42) yOffset = 9;
        else if (t >= 3.0 && t < 3.6) yOffset = -7 * Math.sin((t - 3.0) * 5.2);

        const y = 42 + yOffset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Curva Inferior: Onda Pletismográfica de SpO2
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
        const t = (x * 0.04 + engine2DState.ecgPhase * 0.85);
        const wave = Math.sin(t) * 10 + Math.sin(t * 2) * 4;
        const y = 102 - wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

/**
 * Reproduce el sonido de auscultación del foco seleccionado utilizando el archivo en
 * `assets/6-multimedia-2d/audios-auscultacion/` o el sintetizador acústico Web Audio API de respaldo.
 * @param {string} hotspotId
 */
export function playClinicalAuscultationTone(hotspotId = "foco_mitral") {
    if (typeof Sim2DVitalsMonitor.playAuscultationAudio === "function") {
        Sim2DVitalsMonitor.playAuscultationAudio(hotspotId, engine2DState);
        return;
    }

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!engine2DState.audioCtx) {
            engine2DState.audioCtx = new AudioContextClass();
        }
        const ctx = engine2DState.audioCtx;
        if (ctx.state === "suspended") ctx.resume();

        // Sintetizar doble tono cardíaco Lub-Dub (S1-S2) acorde a la FC actual
        const now = ctx.currentTime;
        const playBeat = (startTime, freq, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        // S1 (Lub) y S2 (Dub)
        playBeat(now, 65, 0.09);
        playBeat(now + 0.18, 90, 0.07);
        if (hotspotId === "foco_mitral" && engine2DState.vitals.hr > 105) {
            // Galope S3 si hay taquicardia/insuficiencia
            playBeat(now + 0.31, 55, 0.06);
        }
    } catch (e) {
        // Silencioso si el navegador bloquea el audio antes de interacción
    }
}

// ============================================================================
// 7. CIERRE DE CASO, PERSISTENCIA EN FIRESTORE Y EVENTOS
// ============================================================================

/**
 * Registra la finalización del caso 2D y guarda el desempeño en Cloud Firestore.
 * @param {Object} outcome
 */
export async function completeInteractiveCase2D(outcome = {}) {
    const container = document.getElementById("engine2d-decision-body");
    if (container) {
        container.innerHTML = `
            <div class="bg-surface border border-secondary/50 rounded-2xl p-5 text-center space-y-3">
                <span class="material-symbols-outlined text-4xl text-secondary">military_tech</span>
                <h4 class="text-base font-extrabold text-white">Caso Clínico 2D Resuelto con Éxito</h4>
                <p class="text-xs text-gray-300">
                    Has estabilizado los parámetros hemodinámicos del paciente con un desempeño de
                    <strong class="text-secondary font-mono">${engine2DState.score}/100 pts</strong>.
                </p>
                <button
                    type="button"
                    id="btn-engine2d-repeat-finished"
                    class="px-4 py-2 rounded-xl bg-primary text-surface text-xs font-extrabold hover:bg-opacity-90 transition-all"
                >
                    Repetir Simulación 2D
                </button>
            </div>
        `;
        document.getElementById("btn-engine2d-repeat-finished")?.addEventListener("click", () => {
            if (engine2DState.activeCase) {
                startInteractiveCase2D(engine2DState.activeCase.id);
            }
        });
    }

    const uid = auth.currentUser?.uid || appState.currentUser?.uid;
    if (!uid) return;

    try {
        await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            lastSim2DCompletedAt: new Date().toISOString(),
            lastSim2DScore: engine2DState.score,
            lastSim2DCaseId: outcome.caseId || engine2DState.activeCase?.id || "caso_2d"
        });
    } catch (e) {
        // Silencioso en caso de modo offline temporal
    }
}

function updateEngine2DScoreUI() {
    const scoreBadge = document.getElementById("engine2d-score-badge");
    if (!scoreBadge) return;
    scoreBadge.textContent = `${engine2DState.score} / 100 pts`;
}

function bindEngine2DWorkspaceEvents() {
    const careerSelect = document.getElementById("engine2d-career-select");
    const subjectSelect = document.getElementById("engine2d-subject-select");
    const caseSelect = document.getElementById("engine2d-case-select");

    careerSelect?.addEventListener("change", async () => {
        engine2DState.career = careerSelect.value;
        engine2DState.subject = "todas";
        updateEngine2DSubjectOptions(engine2DState.career);
        setCurriculumSelection({
            career: engine2DState.career,
            subject: "todas"
        });
        filterEngine2DCases();
    });

    subjectSelect?.addEventListener("change", () => {
        engine2DState.subject = subjectSelect.value;
        filterEngine2DCases();
    });

    caseSelect?.addEventListener("change", () => {
        startInteractiveCase2D(caseSelect.value);
    });

    document.getElementById("btn-engine2d-restart")?.addEventListener("click", () => {
        if (engine2DState.activeCase) {
            startInteractiveCase2D(engine2DState.activeCase.id);
        }
    });

    document.getElementById("btn-engine2d-play-sound")?.addEventListener("click", () => {
        playClinicalAuscultationTone(engine2DState.selectedHotspotId);
    });
}

function bindGlobalCurriculumEvents2D() {
    if (window.__makaiEngine2DCurriculumBound) return;
    window.__makaiEngine2DCurriculumBound = true;

    window.addEventListener("makai:curriculumChanged", (e) => {
        const detail = e.detail || {};
        if (detail.career && detail.career !== engine2DState.career) {
            engine2DState.career = detail.career;
            const careerSelect = document.getElementById("engine2d-career-select");
            if (careerSelect) careerSelect.value = detail.career;
            updateEngine2DSubjectOptions(detail.career);
        }

        if (detail.subject) {
            engine2DState.subject = detail.subject;
            const subjectSelect = document.getElementById("engine2d-subject-select");
            if (subjectSelect) subjectSelect.value = detail.subject;
        }

        filterEngine2DCases();
    });
}

// ============================================================================
// 8. BANCO SEMILLA DE CASOS CLÍNICOS RAMIFICADOS 2D
// ============================================================================

function getSeedInteractiveCases2D() {
    return [
        {
            id: "sim2d_med_edema_agudo_pulmon",
            carrera: "medicina",
            materia: "Medicina Interna",
            titulo: "Insuficiencia Cardíaca Aguda y Edema Agudo de Pulmón",
            planRequerido: "Básico",
            enunciadoInicial: "Paciente masculino de 68 años acude a urgencias por disnea paroxística nocturna, ortopnea e intolerancia al decúbito. Utiliza el fonendoscopio y el monitor en el lienzo 2D antes de tomar tu primera decisión terapéutica.",
            initialNodeId: "node_1",
            initialVitals: {
                hr: 124,
                bpSys: 168,
                bpDia: 102,
                spo2: 86,
                rr: 32,
                temp: 36.8,
                rhythm: "taquicardia_sinusal",
                heartSound: "Taquicardia con ritmo de galope por tercer ruido (S3) en foco mitral",
                lungSound: "Crepitantes húmedos en marea ascendente en ambos campos pulmonares"
            },
            auscultacionPorFoco: {
                foco_mitral: "S1-S2 taquicárdicos + Galope ventricular S3 audible en ápex (sobrecarga de volumen).",
                base_pulmonar: "Estertores crepitantes bilaterales hasta campos medios pulmonares."
            },
            nodes: {
                node_1: {
                    etapaLabel: "Nodo 1 de 2 • Estabilización Inicial",
                    pregunta: "Tras auscultar el galope S3 y crepitantes bilaterales con PA 168/102 mmHg y SpO2 86%, ¿cuál es la conducta inicial prioritaria?",
                    opciones: [
                        {
                            id: "opt_1a",
                            texto: "Posición semifowler, oxigenoterapia / VNI, Furosemida IV y Nitroglicerina IV titulable.",
                            esCorrecta: true,
                            scoreDelta: 0,
                            vitalsDelta: { hr: 102, bpSys: 138, bpDia: 86, spo2: 94, rr: 22 },
                            racional: "En el edema agudo de pulmón hipertensivo (perfil caliente y húmedo), el diurético de asa IV + vasodilatador (nitroglicerina) y soporte ventilatorio reducen la precarga y poscarga de forma inmediata.",
                            nextNodeId: "node_2"
                        },
                        {
                            id: "opt_1b",
                            texto: "Administrar carga rápida de solución salina 0.9% 1000 ml IV en bolo.",
                            esCorrecta: false,
                            scoreDelta: -20,
                            vitalsDelta: { hr: 134, spo2: 82, rr: 36 },
                            racional: "Contraindicado: una carga de cristaloides agrava la congestión alveolocapilar y empeora la hipoxemia.",
                            nextNodeId: "node_1"
                        }
                    ]
                },
                node_2: {
                    etapaLabel: "Nodo 2 de 2 • Control Hemodinámico",
                    pregunta: "La SpO2 sube a 94% y la PA desciende a 138/86 mmHg. ¿Qué estudio complementario en cama confirma la etiología estructural y fracción de eyección?",
                    opciones: [
                        {
                            id: "opt_2a",
                            texto: "Ecocardiograma transtorácico + control seriado de Péptido Natriurético (NT-proBNP) y electrolitos.",
                            esCorrecta: true,
                            scoreDelta: 0,
                            vitalsDelta: { hr: 88, bpSys: 124, bpDia: 78, spo2: 97, rr: 18, rhythm: "ritmo_sinusal_estable" },
                            racional: "El ecocardiograma evalúa la FEVI y valvulopatías agudas, mientras el monitoreo de potasio y función renal guía la terapia descongestiva.",
                            nextNodeId: "FIN_EXITO"
                        },
                        {
                            id: "opt_2b",
                            texto: "Suspender el oxígeno inmediatamente y dar el alta domiciliaria sin estudios.",
                            esCorrecta: false,
                            scoreDelta: -15,
                            racional: "El paciente requiere hospitalización, titulación de terapia fundacional y estudio ecocardiográfico antes del egreso.",
                            nextNodeId: "node_2"
                        }
                    ]
                }
            }
        },
        {
            id: "sim2d_enf_shock_septico_uci",
            carrera: "enfermeria",
            materia: "Enfermería de Cuidados Críticos y Urgencias",
            titulo: "Paquete Hora-1 en Shock Séptico de Foco Urinario",
            planRequerido: "Básico",
            enunciadoInicial: "Paciente de 72 años en UCI con fiebre (38.9°C), obnubilación, oliguria y PA 78/44 mmHg (PAM 55 mmHg). Canaliza vía periférica en el lienzo 2D y ejecuta el paquete Surviving Sepsis.",
            initialNodeId: "node_1",
            initialVitals: {
                hr: 128,
                bpSys: 78,
                bpDia: 44,
                spo2: 90,
                rr: 28,
                temp: 38.9,
                rhythm: "taquicardia_sinusal",
                heartSound: "Ruidos cardíacos hiperdinámicos taquicárdicos sin soplos",
                lungSound: "Taquipnea compensatoria con murmullo vesicular conservado"
            },
            nodes: {
                node_1: {
                    etapaLabel: "Nodo 1 de 2 • Paquete Hora-1",
                    pregunta: "¿Cuál es la secuencia prioritaria de enfermería y cuidados críticos dentro de la primera hora?",
                    opciones: [
                        {
                            id: "opt_enf_1a",
                            texto: "Medir lactato sérico, tomar 2 sets de hemocultivos antes del antibiótico de amplio espectro e iniciar cristaloides 30 ml/kg IV.",
                            esCorrecta: true,
                            scoreDelta: 0,
                            vitalsDelta: { hr: 110, bpSys: 90, bpDia: 58, spo2: 95, rr: 22 },
                            racional: "El paquete Hora-1 exige lactato, hemocultivos previos sin retrasar la antibioticoterapia intravenosa y reanimación hídrica con cristaloides balanceados.",
                            nextNodeId: "node_2"
                        },
                        {
                            id: "opt_enf_1b",
                            texto: "Diferir antibióticos y cultivos hasta tener el reporte definitivo de urocultivo en 48 horas.",
                            esCorrecta: false,
                            scoreDelta: -20,
                            racional: "Cada hora de retraso en la administración del antimicrobiano en shock séptico incrementa significativamente la mortalidad.",
                            nextNodeId: "node_1"
                        }
                    ]
                },
                node_2: {
                    etapaLabel: "Nodo 2 de 2 • Titulación de Vasopresor",
                    pregunta: "Pese a la carga de cristaloides, la PAM persiste en 58 mmHg (<65 mmHg). ¿Qué vasopresor de primera elección se prepara e inicia?",
                    opciones: [
                        {
                            id: "opt_enf_2a",
                            texto: "Noradrenalina en infusión continua titulada para alcanzar una PAM ≥ 65 mmHg.",
                            esCorrecta: true,
                            scoreDelta: 0,
                            vitalsDelta: { hr: 92, bpSys: 112, bpDia: 72, spo2: 97, rr: 18, rhythm: "ritmo_sinusal_estable" },
                            racional: "La Noradrenalina es el vasopresor de primera línea en el shock séptico para restaurar la presión arterial media ≥ 65 mmHg.",
                            nextNodeId: "FIN_EXITO"
                        },
                        {
                            id: "opt_enf_2b",
                            texto: "Administrar Furosemida en bolo sin soporte vasopresor.",
                            esCorrecta: false,
                            scoreDelta: -15,
                            racional: "Un diurético de asa en un paciente hipotenso con shock distributivo agrava la hipoperfusión tisular.",
                            nextNodeId: "node_2"
                        }
                    ]
                }
            }
        }
    ];
}
