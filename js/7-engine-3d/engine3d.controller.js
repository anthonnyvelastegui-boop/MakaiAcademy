// ============================================================================
// ARCHIVO: js/7-engine-3d/engine3d.controller.js
// DESCRIPCIÓN: Controlador General del Motor 3D (Visor WebGL en Primera Persona
//              UCI, Puente JS <-> Unity, Marco Clínico HUD Cefalocaudal y
//              Simulación Cooperativa Multijugador en Tiempo Real).
//              Coordina sim3d.webglBridge.js, sim3d.hud.js y sim3d.multiplayer.js.
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
// semilla vacíos mientras se desarrollan los subcomponentes de js/7-engine-3d/.
import * as Sim3DWebGLBridge from "./sim3d.webglBridge.js";
import * as Sim3DHud from "./sim3d.hud.js";
import * as Sim3DMultiplayer from "./sim3d.multiplayer.js";

// ============================================================================
// 1. RUTAS MULTIMEDIA 3D Y ESTADO INTERNO DEL MOTOR
// ============================================================================

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    SCENARIOS_3D: COLLECTIONS?.SCENARIOS_3D || "escenarios_simulacion_3d"
};

export const ASSETS_3D_PATHS = Object.freeze({
    BUILDS_WEBGL: "assets/7-multimedia-3d/builds-webgl/",
    HUD_ICONS: "assets/7-multimedia-3d/hud-iconos/",
    CINEMATICS: "assets/7-multimedia-3d/videos-cinematicas/"
});

export const engine3DState = {
    initialized: false,
    career: "medicina",
    stage: "general",
    subject: "todas",
    allScenarios: [],
    filteredScenarios: [],
    activeScenario: null,
    unityInstance: null,
    isWebGLNativeLoaded: false,
    activeHudCategory: "via_aerea",
    activeBodyRegion: "torax",
    cameraOrbit: {
        yaw: 0,
        pitch: 14,
        zoom: 1.0,
        autoRotate: false
    },
    isScenarioFinished: false,
    score: 100,
    elapsedSeconds: 0,
    timerIntervalId: null,
    viewportAnimationId: null,
    cprCompressionPhase: 0,
    completedObjectives: [],
    chronologicalLog: [],
    cephalocaudalFindings: {},
    multiplayer: {
        connected: false,
        roomCode: "UCI-ALICIZATION-01",
        role: "Líder de Reanimación",
        squadMembers: []
    },
    vitals: {
        hr: 132,
        bpSys: 82,
        bpDia: 46,
        map: 58,
        spo2: 85,
        etco2: 28,
        rr: 30,
        temp: 36.4,
        gcs: 9,
        rhythm: "taquicardia_ventricular_con_pulso"
    }
};

// Categorías y Maniobras del Marco Clínico HUD 3D
export const HUD_ACTION_CATEGORIES_3D = Object.freeze({
    via_aerea: {
        id: "via_aerea",
        label: "Vía Aérea & O2",
        icon: "pulmonology",
        actions: [
            {
                id: "aspirar_secreciones",
                nombre: "Aspiración de Secreciones Orofaríngeas",
                efecto: "Despeja vía aérea superior y optimiza visualización glótica.",
                vitalsDelta: { spo2: +3 },
                unityCommand: "Airway_Suction"
            },
            {
                id: "oxigeno_reservorio",
                nombre: "Mascarilla con Reservorio 15 L/min (FiO2 100%)",
                efecto: "Preoxigenación de alto flujo previa a manejo avanzado de vía aérea.",
                vitalsDelta: { spo2: +7, rr: -4 },
                unityCommand: "Airway_Preoxygenate"
            },
            {
                id: "intubacion_iot",
                nombre: "Secuencia Rápida de Intubación (SRI) + Capnografía",
                efecto: "Asegura vía aérea definitiva con tubo endotraqueal y confirma EtCO2.",
                vitalsDelta: { spo2: +11, etco2: 38, rr: 16 },
                unityCommand: "Airway_Intubate"
            }
        ]
    },
    accesos_vasculares: {
        id: "accesos_vasculares",
        label: "Accesos & Fluidos",
        icon: "water_drop",
        actions: [
            {
                id: "doble_via_16g",
                nombre: "Canalizar Doble Vía Periférica 16G / 18G",
                efecto: "Habilita administración rápida de cristaloides, hemoderivados y fármacos.",
                vitalsDelta: { bpSys: +6, bpDia: +4 },
                unityCommand: "Vascular_Peripheral16G"
            },
            {
                id: "cristaloides_bolo",
                nombre: "Cristaloides Balanceados 500 ml IV en Bolo",
                efecto: "Expansión controlada de volumen intravascular.",
                vitalsDelta: { bpSys: +12, bpDia: +8, hr: -8 },
                unityCommand: "Vascular_CrystalloidBolus"
            },
            {
                id: "cateter_venoso_central",
                nombre: "Catéter Venoso Central Yugular Interno Ecoguiado",
                efecto: "Acceso central seguro para infusión continua de vasoactivos.",
                vitalsDelta: { bpSys: +4 },
                unityCommand: "Vascular_CentralLine"
            }
        ]
    },
    farmacos_uci: {
        id: "farmacos_uci",
        label: "Fármacos UCI",
        icon: "medication",
        actions: [
            {
                id: "amiodarona_iv",
                nombre: "Amiodarona 150 mg IV en 10 min / 300 mg en Paro",
                efecto: "Antiarrítmico clase III para control de arritmias ventriculares.",
                vitalsDelta: { hr: -24 },
                unityCommand: "Drug_Amiodarone"
            },
            {
                id: "noradrenalina_bic",
                nombre: "Noradrenalina en Bomba de Infusión Continua (0.1 mcg/kg/min)",
                efecto: "Vasopresor de primera elección para restaurar PAM ≥ 65 mmHg.",
                vitalsDelta: { bpSys: +22, bpDia: +14 },
                unityCommand: "Drug_Norepinephrine"
            },
            {
                id: "adrenalina_1mg",
                nombre: "Adrenalina 1 mg IV (Protocolo ACLS / Anafilaxia)",
                efecto: "Incrementa presión de perfusión coronaria y cerebral.",
                vitalsDelta: { hr: +15, bpSys: +25, bpDia: +15 },
                unityCommand: "Drug_Epinephrine"
            },
            {
                id: "acido_tranexamico",
                nombre: "Ácido Tranexámico 1 g IV en 10 min (Protocolo Trauma/PPH)",
                efecto: "Antifibrinolítico precoz dentro de las primeras 3 horas.",
                vitalsDelta: { bpSys: +6 },
                unityCommand: "Drug_TranexamicAcid"
            }
        ]
    },
    desfibrilador_rcp: {
        id: "desfibrilador_rcp",
        label: "Desfibrilador & RCP",
        icon: "bolt",
        actions: [
            {
                id: "rcp_alta_calidad",
                nombre: "Ciclo de Compresiones Torácicas (100-120 cpm, 5-6 cm)",
                efecto: "Mantiene gasto cardíaco mínimo y EtCO2 > 15 mmHg durante el paro.",
                vitalsDelta: { etco2: +8, bpSys: +10 },
                unityCommand: "CPR_StartChestCompressions"
            },
            {
                id: "cardioversion_sincronizada",
                nombre: "Cardioversión Eléctrica Sincronizada (100 J Bifásico)",
                efecto: "Revierte taquiarritmias inestables con pulso hacia ritmo sinusal.",
                vitalsDelta: { hr: 86, bpSys: +18, bpDia: +12, rhythm: "ritmo_sinusal_estable" },
                unityCommand: "Defib_SynchronizedCardioversion"
            },
            {
                id: "desfibrilacion_200j",
                nombre: "Descarga Bifásica No Sincronizada 200 J (FV / TVSP)",
                efecto: "Despolarización miocárdica total en ritmos desfibrilables sin pulso.",
                vitalsDelta: { hr: 92, bpSys: 108, bpDia: 68, spo2: 96, rhythm: "ritmo_sinusal_post_rce" },
                unityCommand: "Defib_Shock200J"
            }
        ]
    }
});

// Regiones Anatómicas para el Examen Físico Cefalocaudal en 3D
export const CEPHALOCAUDAL_REGIONS_3D = Object.freeze([
    {
        id: "cabeza_neuro",
        label: "1. Cabeza & Neurológico",
        cameraPreset: { yaw: 0, pitch: 24, zoom: 1.25 },
        defaultFinding: "Pupilas isocóricas normorreactivas (3 mm), Glasgow evaluado, sin signos de fractura de base de cráneo."
    },
    {
        id: "cuello_via_aerea",
        label: "2. Cuello & Vía Aérea",
        cameraPreset: { yaw: -12, pitch: 20, zoom: 1.2 },
        defaultFinding: "Tráquea central, evaluación de ingurgitación yugular y permeabilidad laringotraqueal."
    },
    {
        id: "torax",
        label: "3. Tórax & Precordio",
        cameraPreset: { yaw: 8, pitch: 15, zoom: 1.1 },
        defaultFinding: "Expansibilidad torácica simétrica, auscultación cardiopulmonar y monitoreo precordial 3D."
    },
    {
        id: "abdomen_pelvis",
        label: "4. Abdomen & Pelvis (eFAST)",
        cameraPreset: { yaw: -10, pitch: 12, zoom: 1.08 },
        defaultFinding: "Abdomen blando, ventana ecográfica hepatorenal (Morrison) y esplenorrenal evaluadas."
    },
    {
        id: "extremidades",
        label: "5. Extremidades & Perfusión",
        cameraPreset: { yaw: 18, pitch: 10, zoom: 0.96 },
        defaultFinding: "Pulsos distales palpables, llenado capilar e inspección de accesos vasculares."
    }
]);

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL CONTROLADOR 3D
// ============================================================================

/**
 * Inicializa el Motor 3D completo dentro de `#view-sim3d` en `dashboard.html`:
 * construye el centro de simulación WebGL + HUD Cefalocaudal + Panel Cooperativo,
 * inicializa los 3 subcomponentes hermanos y carga el catálogo de escenarios 3D.
 */
export async function initEngine3DController() {
    const sim3dView = ensureSim3DViewContainer();
    if (!sim3dView) return;

    engine3DState.career = appState.currentCareer || appState.currentUserData?.carrera || "medicina";
    engine3DState.stage = appState.currentStage || "general";
    engine3DState.subject = appState.currentSubject || "todas";

    // 1. Construir la interfaz completa de Centro de Trauma / UCI 3D en #view-sim3d
    renderEngine3DWorkspace(sim3dView);

    // 2. Inicializar de forma tolerante a fallos los 3 subcomponentes de js/7-engine-3d/
    initEngine3DSubmodules();

    // 3. Registrar receptor global de eventos enviados desde Unity WebGL hacia JS
    registerGlobalUnityCallbackReceiver();

    // 4. Escuchar cambios globales de carrera y materia desde router.spa.js / state.store.js
    bindGlobalCurriculumEvents3D();

    // 5. Cargar catálogo de escenarios clínicos 3D (Firestore + Semilla local)
    await loadEngine3DScenarios({
        career: engine3DState.career,
        subject: engine3DState.subject
    });

    engine3DState.initialized = true;
}

// Alias exportados para compatibilidad directa con app.orchestrator.js y router.spa.js
export const initSim3D = initEngine3DController;
export const initEngine3D = initEngine3DController;

/**
 * Garantiza que exista el contenedor `#view-sim3d` dentro de `#views-container` en `dashboard.html`.
 * @returns {HTMLElement|null}
 */
function ensureSim3DViewContainer() {
    let sim3dView = document.getElementById("view-sim3d") || document.getElementById("view-engine3d");
    if (sim3dView) return sim3dView;

    const viewsContainer = document.getElementById("views-container");
    if (!viewsContainer) return null;

    sim3dView = document.createElement("section");
    sim3dView.id = "view-sim3d";
    sim3dView.className = "hidden space-y-6";
    viewsContainer.appendChild(sim3dView);
    return sim3dView;
}

/**
 * Despierta los 3 subcomponentes de la carpeta `js/7-engine-3d/` si ya cuentan con funciones exportadas.
 */
function initEngine3DSubmodules() {
    if (typeof Sim3DWebGLBridge.initWebGLBridge3D === "function") {
        Sim3DWebGLBridge.initWebGLBridge3D({
            state: engine3DState,
            assetsPath: ASSETS_3D_PATHS,
            onTelemetryEvent: handleUnityTelemetryEvent3D
        });
    }

    if (typeof Sim3DHud.initClinicalHud3D === "function") {
        Sim3DHud.initClinicalHud3D({
            state: engine3DState,
            categories: HUD_ACTION_CATEGORIES_3D,
            regions: CEPHALOCAUDAL_REGIONS_3D,
            onExecuteAction: dispatchClinicalAction3D,
            onInspectRegion: performCephalocaudalExam3D
        });
    }

    if (typeof Sim3DMultiplayer.initMultiplayer3D === "function") {
        Sim3DMultiplayer.initMultiplayer3D({
            state: engine3DState,
            onSquadActionSynced: handleRemoteMultiplayerAction3D
        });
    }
}

// ============================================================================
// 3. CONSTRUCCIÓN DEL CENTRO DE COMANDO 3D, VISOR WEBGL Y HUD (#view-sim3d)
// ============================================================================

/**
 * Inyecta la arquitectura visual del Motor 3D UCI en `#view-sim3d`:
 * - Barra Superior: Selectores de Carrera, Materia, Escenario 3D, Cronómetro de Reanimación y Puntaje.
 * - Columna Izquierda (3 Cols): Marco Clínico HUD de Intervenciones por Categorías + Examen Físico Cefalocaudal.
 * - Columna Central (6 Cols): Visor Central Negro WebGL / 3D Interactivo + Telemetría UCI Superpuesta + Controles de Cámara 3D.
 * - Columna Derecha (3 Cols): Objetivos Críticos del Caso, Bitácora Cronológica y Sala Cooperativa Multijugador.
 * @param {HTMLElement} sim3dView
 */
function renderEngine3DWorkspace(sim3dView) {
    if (document.getElementById("engine3d-workspace-root")) {
        populateEngine3DSelectors();
        return;
    }

    sim3dView.innerHTML = `
        <div id="engine3d-workspace-root" class="space-y-6">
            <!-- BARRA SUPERIOR DE COMANDO 3D UCI -->
            <div class="bg-surface-container border border-primary/30 rounded-2xl p-5 shadow-[0_0_28px_rgba(0,229,255,0.08)] space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                            <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold">
                                Motor 3D • Entorno WebGL en Primera Persona & Cooperativo UCI
                            </span>
                        </div>
                        <h2 class="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary">view_in_ar</span>
                            <span>Quirófano & Trauma Shock 3D • Puente WebGL + Marco Clínico HUD</span>
                        </h2>
                    </div>

                    <!-- Reloj de Reanimación, Puntaje y Reinicio -->
                    <div class="flex flex-wrap items-center gap-3">
                        <div class="bg-surface border border-surface-high rounded-xl px-3.5 py-2 text-center">
                            <span class="block text-[10px] font-mono text-gray-400 uppercase">Tiempo Código</span>
                            <span id="engine3d-timer-badge" class="text-sm font-extrabold font-mono text-primary">00:00</span>
                        </div>
                        <div class="bg-surface border border-surface-high rounded-xl px-3.5 py-2 text-right">
                            <span class="block text-[10px] font-mono text-gray-400 uppercase">Precisión 3D</span>
                            <span id="engine3d-score-badge" class="text-sm font-extrabold font-mono text-secondary">100 / 100 pts</span>
                        </div>
                        <button
                            type="button"
                            id="btn-engine3d-fullscreen"
                            class="px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high hover:border-primary text-gray-200 hover:text-primary text-xs font-bold transition-all flex items-center gap-1"
                            title="Expandir Visor 3D"
                        >
                            <span class="material-symbols-outlined text-sm">fullscreen</span>
                            <span>Pantalla Completa</span>
                        </button>
                        <button
                            type="button"
                            id="btn-engine3d-restart"
                            class="px-4 py-2.5 rounded-xl bg-surface-high hover:bg-primary hover:text-surface text-white text-xs font-extrabold transition-all flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-sm">restart_alt</span>
                            <span>Reiniciar Escenario</span>
                        </button>
                    </div>
                </div>

                <!-- SELECTORES DE CARRERA, MATERIA Y ESCENARIO 3D -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div class="md:col-span-4">
                        <label for="engine3d-career-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Carrera / Especialidad
                        </label>
                        <select id="engine3d-career-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                        </select>
                    </div>

                    <div class="md:col-span-4">
                        <label for="engine3d-subject-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Materia / Rotación Hospitalaria
                        </label>
                        <select id="engine3d-subject-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                            <option value="todas">Todas las rotaciones</option>
                        </select>
                    </div>

                    <div class="md:col-span-4">
                        <label for="engine3d-scenario-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Escenario Clínico 3D (WebGL / UCI)
                        </label>
                        <select id="engine3d-scenario-select" class="w-full bg-surface border border-primary/50 focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-primary outline-none transition-colors">
                        </select>
                    </div>
                </div>
            </div>

            <!-- ARQUITECTURA DE 3 COLUMNAS: HUD IZQUIERDO (3) + VISOR CENTRAL 3D (6) + PANEL COOPERATIVO Y BITÁCORA (3) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <!-- COLUMNA IZQUIERDA (3 COLS): MARCO CLÍNICO HUD Y EXAMEN CEFALOCAUDAL -->
                <div class="lg:col-span-3 space-y-4">
                    <!-- Menú de Acciones Médicas por Categorías (sim3d.hud.js) -->
                    <div id="engine3d-hud-actions-panel" class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2.5">
                            <span class="text-xs font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">medical_information</span>
                                <span>Marco Clínico HUD</span>
                            </span>
                            <span class="text-[10px] font-mono text-gray-400">Intervenciones</span>
                        </div>

                        <!-- Pestañas de Categoría HUD -->
                        <div id="engine3d-hud-tabs" class="grid grid-cols-2 gap-1.5"></div>

                        <!-- Lista de Maniobras de la Categoría Activa -->
                        <div id="engine3d-hud-actions-list" class="space-y-2 max-h-[260px] overflow-y-auto pr-1"></div>
                    </div>

                    <!-- Examen Físico Cefalocaudal 3D -->
                    <div id="engine3d-cephalocaudal-panel" class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <span class="text-xs font-mono uppercase text-secondary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">accessibility_new</span>
                                <span>Examen Cefalocaudal 3D</span>
                            </span>
                            <span class="text-[10px] font-mono text-gray-400">Enfoque Cámara</span>
                        </div>

                        <div id="engine3d-cephalocaudal-buttons" class="space-y-1.5"></div>

                        <div id="engine3d-cephalocaudal-output" class="bg-surface border border-surface-high rounded-xl p-3 text-xs text-gray-300 leading-relaxed">
                            Selecciona un segmento anatómico para enfocar la cámara 3D e inspeccionar hallazgos semiológicos.
                        </div>
                    </div>
                </div>

                <!-- COLUMNA CENTRAL (6 COLS): VISOR NEGRO WEBGL / 3D + TELEMETRÍA FLOTANTE -->
                <div class="lg:col-span-6 space-y-4">
                    <div
                        id="engine3d-viewport-wrapper"
                        class="relative w-full h-[540px] bg-[#04070b] border-2 border-primary/40 rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.85)] flex flex-col justify-between select-none"
                    >
                        <!-- Lienzo WebGL / Perspectiva 3D Interactiva -->
                        <canvas id="engine3d-webgl-canvas" width="820" height="540" class="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"></canvas>

                        <!-- Contenedor para Instancia Nativa de Unity WebGL cuando exista build en assets/7-multimedia-3d/builds-webgl/ -->
                        <div id="engine3d-unity-mount" class="hidden absolute inset-0 w-full h-full z-10"></div>

                        <!-- Overlay Superior del Visor 3D: Datos del Caso + Signos Vitales Holográficos -->
                        <div class="relative z-20 p-4 bg-gradient-to-b from-[#04070b]/95 via-[#04070b]/60 to-transparent space-y-3 pointer-events-none">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <span id="engine3d-scenario-badge" class="text-[10px] font-mono uppercase text-primary font-bold tracking-wider">
                                        BOX UCI 3D • MOTOR WEBGL ACTIVO
                                    </span>
                                    <h3 id="engine3d-scenario-title" class="text-base font-extrabold text-white">
                                        Cargando escenario clínico 3D...
                                    </h3>
                                </div>
                                <span id="engine3d-bridge-status" class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-primary/15 text-primary border border-primary/40">
                                    Visor 3D Táctico + Puente WebGL Listo
                                </span>
                            </div>

                            <!-- Barra Holográfica de Signos Vitales en Tiempo Real -->
                            <div class="grid grid-cols-5 gap-2 text-center">
                                <div class="bg-surface/85 backdrop-blur-md border border-secondary/40 rounded-xl p-2">
                                    <span class="block text-[9px] font-mono text-secondary uppercase font-bold">FC (lpm)</span>
                                    <span id="sim3d-vital-hr" class="text-base font-mono font-extrabold text-secondary">132</span>
                                </div>
                                <div class="bg-surface/85 backdrop-blur-md border border-warning/40 rounded-xl p-2">
                                    <span class="block text-[9px] font-mono text-warning uppercase font-bold">PA / PAM</span>
                                    <span id="sim3d-vital-bp" class="text-xs font-mono font-extrabold text-warning">82/46 (58)</span>
                                </div>
                                <div class="bg-surface/85 backdrop-blur-md border border-primary/40 rounded-xl p-2">
                                    <span class="block text-[9px] font-mono text-primary uppercase font-bold">SpO2 (%)</span>
                                    <span id="sim3d-vital-spo2" class="text-base font-mono font-extrabold text-primary">85%</span>
                                </div>
                                <div class="bg-surface/85 backdrop-blur-md border border-purple-400/40 rounded-xl p-2">
                                    <span class="block text-[9px] font-mono text-purple-300 uppercase font-bold">EtCO2</span>
                                    <span id="sim3d-vital-etco2" class="text-sm font-mono font-extrabold text-purple-300">28 mmHg</span>
                                </div>
                                <div class="bg-surface/85 backdrop-blur-md border border-gray-500/40 rounded-xl p-2">
                                    <span class="block text-[9px] font-mono text-gray-300 uppercase font-bold">FR / GCS</span>
                                    <span id="sim3d-vital-rr-gcs" class="text-xs font-mono font-extrabold text-white">30 • GCS 9</span>
                                </div>
                            </div>
                        </div>

                        <!-- Overlay Inferior del Visor 3D: Controles de Cámara Orbital + Botón de Carga Unity Build -->
                        <div class="relative z-20 p-3.5 bg-gradient-to-t from-[#04070b]/95 via-[#04070b]/70 to-transparent flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5">
                                <button type="button" id="btn-cam3d-left" class="px-2.5 py-1.5 rounded-lg bg-surface/90 hover:bg-primary hover:text-surface border border-surface-high text-xs font-mono font-bold text-gray-200 transition-all" title="Rotar cámara a la izquierda">
                                    ⟲ Giro Izq
                                </button>
                                <button type="button" id="btn-cam3d-center" class="px-2.5 py-1.5 rounded-lg bg-surface/90 hover:bg-primary hover:text-surface border border-surface-high text-xs font-mono font-bold text-gray-200 transition-all" title="Centrar cámara en box UCI">
                                    🎯 Centrar
                                </button>
                                <button type="button" id="btn-cam3d-right" class="px-2.5 py-1.5 rounded-lg bg-surface/90 hover:bg-primary hover:text-surface border border-surface-high text-xs font-mono font-bold text-gray-200 transition-all" title="Rotar cámara a la derecha">
                                    Giro Der ⟳
                                </button>
                                <button type="button" id="btn-cam3d-orbit" class="px-2.5 py-1.5 rounded-lg bg-surface/90 hover:bg-secondary hover:text-surface border border-surface-high text-xs font-mono font-bold text-gray-200 transition-all">
                                    Órbita Auto
                                </button>
                            </div>

                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    id="btn-engine3d-load-webgl"
                                    class="px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/50 text-primary hover:bg-primary hover:text-surface text-[11px] font-mono font-extrabold transition-all flex items-center gap-1"
                                >
                                    <span class="material-symbols-outlined text-sm">deployed_code</span>
                                    <span>Conectar Paquete Unity WebGL</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Viñeta Clínica y Estado de Retroalimentación Inmediata -->
                    <div class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-mono uppercase text-primary font-bold">
                                Contexto de Ingreso a Trauma Shock / UCI 3D
                            </span>
                            <span id="engine3d-rhythm-badge" class="text-[11px] font-mono text-warning font-extrabold">
                                Ritmo: Taquicardia Ventricular
                            </span>
                        </div>
                        <p id="engine3d-scenario-vignette" class="text-xs text-gray-300 leading-relaxed"></p>
                        <div id="engine3d-action-feedback" class="hidden rounded-xl p-3 border text-xs leading-relaxed"></div>
                    </div>
                </div>

                <!-- COLUMNA DERECHA (3 COLS): OBJETIVOS CRÍTICOS, BITÁCORA Y SALA COOPERATIVA -->
                <div class="lg:col-span-3 space-y-4">
                    <!-- Checklist de Objetivos Clínicos del Escenario 3D -->
                    <div class="bg-surface-container border border-primary/30 rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <span class="text-xs font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">fact_check</span>
                                <span>Objetivos Críticos 3D</span>
                            </span>
                            <span id="engine3d-objectives-progress" class="text-[11px] font-mono font-extrabold text-secondary">
                                0 / 3
                            </span>
                        </div>
                        <div id="engine3d-objectives-list" class="space-y-2"></div>
                    </div>

                    <!-- Panel Cooperativo Multijugador (sim3d.multiplayer.js) -->
                    <div id="engine3d-multiplayer-panel" class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <span class="text-xs font-mono uppercase text-secondary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">groups</span>
                                <span>Escuadrón Cooperativo</span>
                            </span>
                            <span id="engine3d-mp-status-dot" class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface text-gray-400 border border-surface-high">
                                Offline
                            </span>
                        </div>

                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                id="engine3d-mp-room-input"
                                value="UCI-ALICIZATION-01"
                                class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                                placeholder="Código de sala UCI"
                            />
                            <button
                                type="button"
                                id="btn-engine3d-mp-toggle"
                                class="px-3 py-1.5 rounded-xl bg-secondary text-surface text-xs font-extrabold hover:bg-opacity-90 transition-all whitespace-nowrap"
                            >
                                Conectar
                            </button>
                        </div>

                        <div id="engine3d-mp-squad-list" class="space-y-1.5 text-xs text-gray-400">
                            <p class="text-[11px] text-gray-500">Conéctate a una sala para sincronizar maniobras 3D en equipo con otros residentes.</p>
                        </div>
                    </div>

                    <!-- Historial Cronológico de Decisiones 3D -->
                    <div class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-2.5">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <span class="text-xs font-mono uppercase text-gray-300 font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm text-primary">history</span>
                                <span>Bitácora Cronológica UCI</span>
                            </span>
                        </div>
                        <div id="engine3d-chronological-log" class="space-y-1.5 max-h-44 overflow-y-auto text-[11px] font-mono text-gray-300 pr-1">
                            <p class="text-gray-500">Esperando primera maniobra en el quirófano 3D...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    populateEngine3DSelectors();
    renderHudCategoryTabs3D();
    renderHudActionsList3D();
    renderCephalocaudalButtons3D();
    bindEngine3DWorkspaceEvents();
    startViewport3DRenderLoop();
}

/**
 * Rellena los selectores de Carrera y Materia del Motor 3D leyendo `window.makaiData`.
 */
function populateEngine3DSelectors() {
    const careerSelect = document.getElementById("engine3d-career-select");
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
        if (c.id === engine3DState.career) opt.selected = true;
        careerSelect.appendChild(opt);
    });

    updateEngine3DSubjectOptions(engine3DState.career);
}

/**
 * Actualiza las materias disponibles para la carrera seleccionada en el Motor 3D.
 * @param {string} careerId
 */
function updateEngine3DSubjectOptions(careerId) {
    const subjectSelect = document.getElementById("engine3d-subject-select");
    if (!subjectSelect) return;

    const data = window.makaiData || {};
    const foundCareer = (data.carreras || []).find(c => c.id === careerId);
    const subjects = foundCareer?.materias || [];

    subjectSelect.innerHTML = `<option value="todas">Todas las rotaciones (${subjects.length || "General"})</option>`;
    subjects.forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        if (mat === engine3DState.subject) opt.selected = true;
        subjectSelect.appendChild(opt);
    });
}

// ============================================================================
// 4. CARGA Y FILTRADO DE ESCENARIOS CLÍNICOS 3D (FIRESTORE + SEMILLA LOCAL)
// ============================================================================

/**
 * Carga los escenarios tridimensionales desde Firestore (`escenarios_simulacion_3d`)
 * y los combina con los escenarios semilla locales para funcionamiento inmediato.
 * @param {Object} filters
 */
export async function loadEngine3DScenarios(filters = {}) {
    if (filters.career) engine3DState.career = filters.career;
    if (filters.subject) engine3DState.subject = filters.subject;

    const seedScenarios = getSeedScenarios3D();
    const combined = [...seedScenarios];

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.SCENARIOS_3D));
        snap.forEach(docSnap => {
            const raw = docSnap.data();
            if (raw && raw.titulo) {
                combined.push({
                    id: docSnap.id,
                    ...raw
                });
            }
        });
    } catch (err) {
        console.warn("Motor 3D operando con catálogo semilla local:", err);
    }

    engine3DState.allScenarios = combined;
    filterEngine3DScenarios();
}

/**
 * Filtra los escenarios 3D según la carrera y materia seleccionadas y lanza el primero.
 */
export function filterEngine3DScenarios() {
    const targetCareer = (engine3DState.career || "medicina").toLowerCase();
    const targetSubject = (engine3DState.subject || "todas").toLowerCase();

    let matching = engine3DState.allScenarios.filter(s => {
        const matchCareer = !targetCareer || (s.carrera || "medicina").toLowerCase() === targetCareer;
        const matchSubject =
            targetSubject === "todas" ||
            (s.materia || "").toLowerCase() === targetSubject;
        return matchCareer && matchSubject;
    });

    if (matching.length === 0) {
        matching = engine3DState.allScenarios.filter(
            s => (s.carrera || "medicina").toLowerCase() === targetCareer
        );
    }
    if (matching.length === 0) {
        matching = engine3DState.allScenarios;
    }

    engine3DState.filteredScenarios = matching;

    const scenarioSelect = document.getElementById("engine3d-scenario-select");
    if (scenarioSelect) {
        scenarioSelect.innerHTML = matching.map(s => `
            <option value="${s.id}">
                [${(s.materia || "UCI 3D").slice(0, 20)}] ${s.titulo}
            </option>
        `).join("");
    }

    if (matching.length > 0) {
        launchScenario3D(matching[0].id);
    }
}

// ============================================================================
// 5. LANZAMIENTO DE ESCENARIO 3D, PUENTE UNITY WEBGL Y MANIOBRAS HUD
// ============================================================================

/**
 * Inicia o reinicia un escenario clínico 3D por su ID.
 * Verifica permisos de suscripción, reinicia el reloj de código azul/trauma,
 * carga los signos vitales iniciales y actualiza el visor 3D.
 * @param {string} scenarioId
 */
export function launchScenario3D(scenarioId) {
    const scenario = engine3DState.filteredScenarios.find(s => s.id === scenarioId)
        || engine3DState.allScenarios.find(s => s.id === scenarioId)
        || engine3DState.allScenarios[0];

    if (!scenario) return;

    const requiredPlan = scenario.planRequerido || "Básico";
    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    if (!isMasterAdmin(userEmail) && !canAccessBySubscription(requiredPlan)) {
        const freemiumModal = document.getElementById("freemium-modal");
        if (freemiumModal) {
            freemiumModal.classList.remove("hidden");
            freemiumModal.classList.add("flex");
        }
        return;
    }

    engine3DState.activeScenario = scenario;
    engine3DState.isScenarioFinished = false;
    engine3DState.score = 100;
    engine3DState.elapsedSeconds = 0;
    engine3DState.completedObjectives = [];
    engine3DState.chronologicalLog = [];
    engine3DState.cephalocaudalFindings = { ...(scenario.examenCefalocaudal || {}) };
    engine3DState.vitals = {
        ...(scenario.initialVitals || {
            hr: 132,
            bpSys: 82,
            bpDia: 46,
            map: 58,
            spo2: 85,
            etco2: 28,
            rr: 30,
            temp: 36.4,
            gcs: 9,
            rhythm: "taquicardia_ventricular_con_pulso"
        })
    };

    // Actualizar textos del escenario en el visor 3D
    const badgeEl = document.getElementById("engine3d-scenario-badge");
    const titleEl = document.getElementById("engine3d-scenario-title");
    const vignetteEl = document.getElementById("engine3d-scenario-vignette");
    const feedbackEl = document.getElementById("engine3d-action-feedback");

    if (badgeEl) {
        badgeEl.textContent = `${scenario.carrera.toUpperCase()} • ${scenario.materia.toUpperCase()} • PLAN ${requiredPlan.toUpperCase()}`;
    }
    if (titleEl) titleEl.textContent = scenario.titulo;
    if (vignetteEl) vignetteEl.textContent = scenario.enunciadoInicial;
    feedbackEl?.classList.add("hidden");

    startScenarioTimer3D();
    updateEngine3DScoreUI();
    updateTelemetryVitals3D(engine3DState.vitals);
    renderScenarioObjectives3D();
    appendChronologicalLog3D(`Escenario 3D iniciado: ${scenario.titulo}`);
    performCephalocaudalExam3D("torax", { silentLog: true });

    // Si hay una instancia Unity WebGL activa o subcomponente puente, sincronizar escenario
    sendCommandToUnityBridge("LoadClinicalScenario", {
        scenarioId: scenario.id,
        vitals: engine3DState.vitals
    });
}

/**
 * Monta un paquete compilado de Unity WebGL alojado en `assets/7-multimedia-3d/builds-webgl/`
 * delegando en `sim3d.webglBridge.js` o en el cargador nativo `createUnityInstance`.
 * Si el archivo `.loader.js` aún no se ha subido al repositorio, mantiene el visor 3D táctico activo.
 * @param {Object} scenario
 */
export async function mountUnityWebGLBuild(scenario = engine3DState.activeScenario) {
    const statusBadge = document.getElementById("engine3d-bridge-status");
    const unityMount = document.getElementById("engine3d-unity-mount");

    if (typeof Sim3DWebGLBridge.loadUnityBuild === "function") {
        await Sim3DWebGLBridge.loadUnityBuild(scenario, engine3DState);
        return;
    }

    const buildSlug = scenario?.webglBuildName || "uci_trauma_3d";
    const loaderUrl = `${ASSETS_3D_PATHS.BUILDS_WEBGL}${buildSlug}.loader.js`;

    if (statusBadge) {
        statusBadge.textContent = `Verificando build WebGL (${buildSlug})...`;
    }

    try {
        const checkResponse = await fetch(loaderUrl, { method: "HEAD" });
        if (!checkResponse.ok || typeof window.createUnityInstance !== "function") {
            if (statusBadge) {
                statusBadge.textContent = "Visor 3D Táctico Nativo Activo (Sin paquete .wasm externo)";
            }
            appendChronologicalLog3D("Visor 3D Táctico operando en modo nativo de alto rendimiento.");
            return;
        }

        unityMount?.classList.remove("hidden");
        const unityCanvas = document.createElement("canvas");
        unityCanvas.className = "w-full h-full block";
        unityMount.innerHTML = "";
        unityMount.appendChild(unityCanvas);

        const config = {
            dataUrl: `${ASSETS_3D_PATHS.BUILDS_WEBGL}${buildSlug}.data`,
            frameworkUrl: `${ASSETS_3D_PATHS.BUILDS_WEBGL}${buildSlug}.framework.js`,
            codeUrl: `${ASSETS_3D_PATHS.BUILDS_WEBGL}${buildSlug}.wasm`,
            streamingAssetsUrl: "StreamingAssets",
            companyName: "MakaiAcademy",
            productName: "ALICIZATION_3D_UCI",
            productVersion: "4.4"
        };

        engine3DState.unityInstance = await window.createUnityInstance(unityCanvas, config);
        engine3DState.isWebGLNativeLoaded = true;
        if (statusBadge) {
            statusBadge.textContent = "Unity WebGL Conectado • 60 FPS";
        }
        appendChronologicalLog3D("Instancia Unity WebGL acoplada con éxito al puente JS.");
    } catch (err) {
        if (statusBadge) {
            statusBadge.textContent = "Visor 3D Táctico Nativo Activo";
        }
        appendChronologicalLog3D("Operando con el renderizador 3D táctico integrado en Canvas.");
    }
}

/**
 * Envía un comando desde JavaScript hacia el paciente virtual en Unity WebGL
 * a través de `sim3d.webglBridge.js` o `unityInstance.SendMessage`.
 * @param {string} methodName
 * @param {Object|string} payload
 */
export function sendCommandToUnityBridge(methodName, payload = {}) {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);

    if (typeof Sim3DWebGLBridge.sendToUnity === "function") {
        Sim3DWebGLBridge.sendToUnity("MakaiPatientController", methodName, serialized);
        return;
    }

    if (engine3DState.unityInstance && typeof engine3DState.unityInstance.SendMessage === "function") {
        try {
            engine3DState.unityInstance.SendMessage("MakaiPatientController", methodName, serialized);
        } catch (e) {
            // Silencioso si el GameObject tiene otro nombre en la escena
        }
    }
}

/**
 * Registra el callback global `window.onUnitySim3DEvent` para que los paquetes
 * Unity WebGL puedan enviar telemetría y puntajes de vuelta hacia MakaiAcademy.
 */
function registerGlobalUnityCallbackReceiver() {
    window.onUnitySim3DEvent = (eventJson) => {
        try {
            const parsed = typeof eventJson === "string" ? JSON.parse(eventJson) : eventJson;
            handleUnityTelemetryEvent3D(parsed);
        } catch (err) {
            console.warn("Evento WebGL recibido:", eventJson);
        }
    };
}

/**
 * Procesa los eventos entrantes desde Unity WebGL (`sim3d.webglBridge.js`).
 * @param {Object} eventData
 */
export function handleUnityTelemetryEvent3D(eventData = {}) {
    if (!eventData) return;

    if (eventData.vitals) {
        updateTelemetryVitals3D(eventData.vitals);
    }
    if (eventData.actionId) {
        evaluateActionAgainstScenarioObjectives(eventData.actionId);
    }
    if (eventData.message) {
        appendChronologicalLog3D(`[WebGL]: ${eventData.message}`);
    }
}

// ============================================================================
// 6. MARCO CLÍNICO HUD Y EXAMEN FÍSICO CEFALOCAUDAL 3D
// ============================================================================

/**
 * Renderiza las pestañas de categorías del Marco Clínico HUD (`via_aerea`,
 * `accesos_vasculares`, `farmacos_uci`, `desfibrilador_rcp`).
 */
function renderHudCategoryTabs3D() {
    const tabsContainer = document.getElementById("engine3d-hud-tabs");
    if (!tabsContainer) return;

    if (typeof Sim3DHud.renderHudTabs === "function") {
        Sim3DHud.renderHudTabs(tabsContainer, HUD_ACTION_CATEGORIES_3D, engine3DState);
        return;
    }

    const categories = Object.values(HUD_ACTION_CATEGORIES_3D);
    tabsContainer.innerHTML = categories.map(cat => {
        const isActive = engine3DState.activeHudCategory === cat.id;
        return `
            <button
                type="button"
                data-hud-cat="${cat.id}"
                class="engine3d-hud-cat-btn p-2 rounded-xl border text-left transition-all flex items-center gap-1.5 ${
                    isActive
                        ? "bg-primary/15 border-primary text-primary font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                        : "bg-surface border-surface-high text-gray-300 hover:border-gray-500 hover:text-white font-bold"
                }"
            >
                <span class="material-symbols-outlined text-base">${cat.icon}</span>
                <span class="text-[11px] leading-tight truncate">${cat.label}</span>
            </button>
        `;
    }).join("");

    tabsContainer.querySelectorAll(".engine3d-hud-cat-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            engine3DState.activeHudCategory = btn.dataset.hudCat;
            renderHudCategoryTabs3D();
            renderHudActionsList3D();
        });
    });
}

/**
 * Renderiza la lista de maniobras clínicas disponibles en la categoría activa del HUD.
 */
function renderHudActionsList3D() {
    const listContainer = document.getElementById("engine3d-hud-actions-list");
    if (!listContainer) return;

    if (typeof Sim3DHud.renderHudActions === "function") {
        Sim3DHud.renderHudActions(listContainer, HUD_ACTION_CATEGORIES_3D, engine3DState);
        return;
    }

    const activeCategory = HUD_ACTION_CATEGORIES_3D[engine3DState.activeHudCategory]
        || HUD_ACTION_CATEGORIES_3D.via_aerea;

    listContainer.innerHTML = (activeCategory.actions || []).map(action => {
        const isDone = engine3DState.completedObjectives.includes(action.id);
        return `
            <button
                type="button"
                data-hud-action="${action.id}"
                class="engine3d-hud-action-btn w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                    isDone
                        ? "bg-secondary/10 border-secondary/50 text-white"
                        : "bg-surface hover:bg-surface-high border-surface-high hover:border-primary text-gray-200"
                }"
            >
                <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-extrabold text-white leading-snug">${action.nombre}</span>
                    ${
                        isDone
                            ? `<span class="text-[10px] font-mono font-extrabold text-secondary">✓ Aplicado</span>`
                            : `<span class="material-symbols-outlined text-sm text-primary">play_arrow</span>`
                    }
                </div>
                <span class="text-[11px] text-gray-400 leading-tight">${action.efecto}</span>
            </button>
        `;
    }).join("");

    listContainer.querySelectorAll(".engine3d-hud-action-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            dispatchClinicalAction3D(engine3DState.activeHudCategory, btn.dataset.hudAction);
        });
    });
}

/**
 * Ejecuta una maniobra médica seleccionada en el Marco Clínico HUD:
 * - Envía la orden al puente WebGL (`sendCommandToUnityBridge`).
 * - Actualiza signos vitales tridimensionales (`updateTelemetryVitals3D`).
 * - Evalúa si la acción forma parte de los objetivos críticos del escenario o si es contraindicada.
 * - Sincroniza la maniobra con la sala cooperativa multijugador si está activa.
 * @param {string} categoryId
 * @param {string} actionId
 */
export function dispatchClinicalAction3D(categoryId, actionId) {
    if (engine3DState.isScenarioFinished) return;

    const category = HUD_ACTION_CATEGORIES_3D[categoryId]
        || Object.values(HUD_ACTION_CATEGORIES_3D).find(cat =>
            (cat.actions || []).some(a => a.id === actionId)
        );
    const action = (category?.actions || []).find(a => a.id === actionId);
    if (!action) return;

    // 1. Animación visual en el visor 3D (ej. compresiones torácicas o descarga)
    if (action.id === "rcp_alta_calidad") {
        engine3DState.cprCompressionPhase = 18;
    }

    // 2. Enviar comando al motor Unity WebGL
    sendCommandToUnityBridge("ExecuteClinicalAction", {
        categoryId: category.id,
        actionId: action.id,
        unityCommand: action.unityCommand
    });

    // 3. Aplicar cambios hemodinámicos
    if (action.vitalsDelta) {
        const v = { ...engine3DState.vitals };
        if (typeof action.vitalsDelta.hr === "number") {
            v.hr = action.id.includes("cardioversion") || action.id.includes("desfibrilacion")
                ? action.vitalsDelta.hr
                : Math.max(40, Math.min(190, v.hr + action.vitalsDelta.hr));
        }
        if (typeof action.vitalsDelta.bpSys === "number") {
            v.bpSys = action.id === "desfibrilacion_200j"
                ? action.vitalsDelta.bpSys
                : Math.max(50, Math.min(180, v.bpSys + action.vitalsDelta.bpSys));
        }
        if (typeof action.vitalsDelta.bpDia === "number") {
            v.bpDia = action.id === "desfibrilacion_200j"
                ? action.vitalsDelta.bpDia
                : Math.max(30, Math.min(115, v.bpDia + action.vitalsDelta.bpDia));
        }
        if (typeof action.vitalsDelta.spo2 === "number") {
            v.spo2 = Math.max(60, Math.min(100, v.spo2 + action.vitalsDelta.spo2));
        }
        if (typeof action.vitalsDelta.etco2 === "number") {
            v.etco2 = action.id === "intubacion_iot"
                ? action.vitalsDelta.etco2
                : Math.max(10, Math.min(55, v.etco2 + action.vitalsDelta.etco2));
        }
        if (typeof action.vitalsDelta.rr === "number") {
            v.rr = action.id === "intubacion_iot"
                ? action.vitalsDelta.rr
                : Math.max(10, Math.min(40, v.rr + action.vitalsDelta.rr));
        }
        if (action.vitalsDelta.rhythm) {
            v.rhythm = action.vitalsDelta.rhythm;
        }
        v.map = Math.round((v.bpSys + 2 * v.bpDia) / 3);
        updateTelemetryVitals3D(v);
    }

    // 4. Evaluar contra los objetivos críticos del escenario activo
    evaluateActionAgainstScenarioObjectives(action.id, action.nombre);

    // 5. Registrar en bitácora y notificar al escuadrón cooperativo
    appendChronologicalLog3D(`[HUD • ${category.label}]: ${action.nombre}`);
    renderHudActionsList3D();

    if (engine3DState.multiplayer.connected && typeof Sim3DMultiplayer.broadcastAction3D === "function") {
        Sim3DMultiplayer.broadcastAction3D({
            actionId: action.id,
            actionName: action.nombre,
            user: appState.currentUserData?.nombre || "Médico Líder"
        });
    }
}

/**
 * Evalúa si la maniobra ejecutada cumple un objetivo crítico del escenario 3D
 * o si activa una alerta clínica con racional CACES.
 * @param {string} actionId
 * @param {string} actionLabel
 */
function evaluateActionAgainstScenarioObjectives(actionId, actionLabel = "") {
    const scenario = engine3DState.activeScenario;
    if (!scenario) return;

    const requiredObjectives = scenario.objetivosCriticos || [];
    const matchedObjective = requiredObjectives.find(obj => obj.actionId === actionId);
    const feedbackEl = document.getElementById("engine3d-action-feedback");

    if (matchedObjective) {
        if (!engine3DState.completedObjectives.includes(actionId)) {
            engine3DState.completedObjectives.push(actionId);
        }

        if (feedbackEl) {
            feedbackEl.className = "rounded-xl p-3 border text-xs leading-relaxed bg-secondary/15 border-secondary text-gray-100";
            feedbackEl.innerHTML = `<strong class="text-secondary block mb-0.5">✓ Objetivo Clínico 3D Cumplido:</strong> ${matchedObjective.racional || matchedObjective.descripcion}`;
        }
    } else if ((scenario.accionesPenalizadas || {})[actionId]) {
        const penaltyInfo = scenario.accionesPenalizadas[actionId];
        engine3DState.score = Math.max(0, engine3DState.score - (penaltyInfo.puntos || 15));
        updateEngine3DScoreUI();

        if (feedbackEl) {
            feedbackEl.className = "rounded-xl p-3 border text-xs leading-relaxed bg-danger/15 border-danger text-gray-100";
            feedbackEl.innerHTML = `<strong class="text-danger block mb-0.5">⚠ Alerta Iatrogénica (-${penaltyInfo.puntos || 15} pts):</strong> ${penaltyInfo.racional}`;
        }
    } else if (feedbackEl && actionLabel) {
        feedbackEl.className = "rounded-xl p-3 border text-xs leading-relaxed bg-primary/10 border-primary/40 text-gray-200";
        feedbackEl.innerHTML = `<strong class="text-primary">Maniobra ejecutada en paciente 3D:</strong> ${actionLabel}. Verifica los objetivos críticos restantes en el panel derecho.`;
    }

    renderScenarioObjectives3D();

    // Si todos los objetivos críticos se han completado, cerrar el escenario con éxito
    const allCompleted = requiredObjectives.length > 0 &&
        requiredObjectives.every(obj => engine3DState.completedObjectives.includes(obj.actionId));

    if (allCompleted && !engine3DState.isScenarioFinished) {
        engine3DState.isScenarioFinished = true;
        completeScenario3D({
            scenarioId: scenario.id,
            score: engine3DState.score,
            elapsedSeconds: engine3DState.elapsedSeconds
        });
    }
}

/**
 * Renderiza los botones de exploración física cefalocaudal en `#engine3d-cephalocaudal-buttons`.
 */
function renderCephalocaudalButtons3D() {
    const container = document.getElementById("engine3d-cephalocaudal-buttons");
    if (!container) return;

    container.innerHTML = CEPHALOCAUDAL_REGIONS_3D.map(region => {
        const isSelected = engine3DState.activeBodyRegion === region.id;
        return `
            <button
                type="button"
                data-region-3d="${region.id}"
                class="w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                    isSelected
                        ? "bg-secondary/15 border-secondary text-secondary"
                        : "bg-surface border-surface-high text-gray-300 hover:border-gray-500 hover:text-white"
                }"
            >
                <span>${region.label}</span>
                <span class="material-symbols-outlined text-sm">center_focus_strong</span>
            </button>
        `;
    }).join("");

    container.querySelectorAll("[data-region-3d]").forEach(btn => {
        btn.addEventListener("click", () => {
            performCephalocaudalExam3D(btn.dataset.region3d);
        });
    });
}

/**
 * Enfoca la cámara 3D sobre la región anatómica seleccionada y muestra los hallazgos
 * del examen físico cefalocaudal del paciente.
 * @param {string} regionId
 * @param {Object} options
 */
export function performCephalocaudalExam3D(regionId, options = {}) {
    const region = CEPHALOCAUDAL_REGIONS_3D.find(r => r.id === regionId) || CEPHALOCAUDAL_REGIONS_3D[2];
    engine3DState.activeBodyRegion = region.id;

    // Ajustar ángulo y zoom de la cámara 3D hacia el segmento anatómico
    if (region.cameraPreset) {
        engine3DState.cameraOrbit.yaw = region.cameraPreset.yaw;
        engine3DState.cameraOrbit.pitch = region.cameraPreset.pitch;
        engine3DState.cameraOrbit.zoom = region.cameraPreset.zoom;
    }

    const customFinding = engine3DState.cephalocaudalFindings[region.id] || region.defaultFinding;
    const outputEl = document.getElementById("engine3d-cephalocaudal-output");
    if (outputEl) {
        outputEl.innerHTML = `
            <strong class="text-secondary block mb-1">${region.label}:</strong>
            <span>${customFinding}</span>
        `;
    }

    renderCephalocaudalButtons3D();
    sendCommandToUnityBridge("FocusCameraOnRegion", { regionId: region.id });

    if (!options.silentLog) {
        appendChronologicalLog3D(`[Examen Cefalocaudal • ${region.label}]: ${customFinding}`);
    }
}

// ============================================================================
// 7. MOTOR DE RENDERIZADO 3D TÁCTICO EN PERSPECTIVA (CANVAS 3D VIEWPORT)
// ============================================================================

/**
 * Inicia el bucle de renderizado tridimensional en `#engine3d-webgl-canvas`
 * para dibujar el Box de UCI en perspectiva 3D, la camilla quirúrgica,
 * el paciente articulado por regiones anatómicas, las torres de monitoreo y los vectores de cámara.
 */
function startViewport3DRenderLoop() {
    if (engine3DState.viewportAnimationId) {
        cancelAnimationFrame(engine3DState.viewportAnimationId);
    }

    const renderLoop = () => {
        const sim3dView = document.getElementById("view-sim3d");
        const canvas = document.getElementById("engine3d-webgl-canvas");
        if (canvas && sim3dView && !sim3dView.classList.contains("hidden") && !engine3DState.isWebGLNativeLoaded) {
            drawInteractive3DViewportFrame(canvas);
        }
        engine3DState.viewportAnimationId = requestAnimationFrame(renderLoop);
    };

    engine3DState.viewportAnimationId = requestAnimationFrame(renderLoop);
}

/**
 * Proyecta un punto 3D $(x, y, z)$ a coordenadas 2D de pantalla con rotación de cámara (Yaw, Pitch y Zoom).
 */
function project3DPoint(x, y, z, width, height, orbit) {
    const yawRad = (orbit.yaw * Math.PI) / 180;
    const pitchRad = (orbit.pitch * Math.PI) / 180;

    // Rotación en eje Y (Yaw)
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const rx = x * cosY - z * sinY;
    const rz1 = x * sinY + z * cosY;

    // Rotación en eje X (Pitch)
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const ry = y * cosP - rz1 * sinP;
    const rz = y * sinP + rz1 * cosP + 420;

    const fov = 520 * (orbit.zoom || 1.0);
    const scale = fov / Math.max(80, rz);

    return {
        x: width * 0.5 + rx * scale,
        y: height * 0.56 - ry * scale,
        scale
    };
}

/**
 * Renderiza el cuadro actual del Quirófano / Box UCI en perspectiva 3D interactiva.
 * @param {HTMLCanvasElement} canvas
 */
function drawInteractive3DViewportFrame(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const orbit = engine3DState.cameraOrbit;

    if (orbit.autoRotate) {
        orbit.yaw = ((orbit.yaw + 0.35 + 180) % 360) - 180;
    }

    ctx.fillStyle = "#04070b";
    ctx.fillRect(0, 0, w, h);

    // 1. Piso de Grilla Espacial 3D del Quirófano / Box UCI
    ctx.strokeStyle = "rgba(0, 229, 255, 0.11)";
    ctx.lineWidth = 1;

    for (let gx = -240; gx <= 240; gx += 40) {
        const p1 = project3DPoint(gx, -75, -180, w, h, orbit);
        const p2 = project3DPoint(gx, -75, 180, w, h, orbit);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    for (let gz = -180; gz <= 180; gz += 40) {
        const p1 = project3DPoint(-240, -75, gz, w, h, orbit);
        const p2 = project3DPoint(240, -75, gz, w, h, orbit);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    // 2. Cama Clínica UCI 3D (Prisma Rectangular Proyectado)
    const bedCornersTop = [
        project3DPoint(-75, -18, -135, w, h, orbit),
        project3DPoint(75, -18, -135, w, h, orbit),
        project3DPoint(75, -18, 135, w, h, orbit),
        project3DPoint(-75, -18, 135, w, h, orbit)
    ];

    ctx.fillStyle = "rgba(18, 28, 42, 0.90)";
    ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    bedCornersTop.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Paciente 3D Segmentado por Regiones Cefalocaudales sobre la Cama UCI
    const timeSec = performance.now() * 0.004;
    const breathLift = Math.sin(timeSec * (engine3DState.vitals.rr / 14)) * 3.5;
    const cprOffset = engine3DState.cprCompressionPhase > 0
        ? Math.sin(timeSec * 18) * 6
        : 0;
    if (engine3DState.cprCompressionPhase > 0) {
        engine3DState.cprCompressionPhase -= 0.25;
    }

    const segments3D = [
        { id: "cabeza_neuro", label: "Cabeza", x: 0, y: 6, z: -98, radius: 22 },
        { id: "cuello_via_aerea", label: "Vía Aérea", x: 0, y: 2, z: -68, radius: 14 },
        { id: "torax", label: "Tórax / Corazón", x: 0, y: 6 + breathLift - cprOffset, z: -22, radius: 34 },
        { id: "abdomen_pelvis", label: "Abdomen / Pelvis", x: 0, y: 3, z: 32, radius: 30 },
        { id: "extremidades", label: "Extremidades / Vías", x: 0, y: 0, z: 92, radius: 26 }
    ];

    segments3D.forEach(seg => {
        const pt = project3DPoint(seg.x, seg.y, seg.z, w, h, orbit);
        const r = seg.radius * pt.scale;
        const isFocused = engine3DState.activeBodyRegion === seg.id;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isFocused
            ? "rgba(0, 229, 255, 0.28)"
            : "rgba(148, 222, 45, 0.14)";
        ctx.strokeStyle = isFocused ? "#00e5ff" : "rgba(148, 222, 45, 0.65)";
        ctx.lineWidth = isFocused ? 2.6 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Etiqueta holográfica 3D del segmento enfocado
        if (isFocused) {
            ctx.fillStyle = "#00e5ff";
            ctx.font = "bold 11px 'JetBrains Mono', monospace";
            ctx.fillText(`▶ ${seg.label}`, pt.x + r + 8, pt.y + 4);
        }
        ctx.restore();
    });

    // 4. Indicador de Tubo Endotraqueal / Oxígeno o Accesos si ya se aplicaron en el HUD
    const done = engine3DState.completedObjectives;
    if (done.includes("intubacion_iot") || done.includes("oxigeno_reservorio")) {
        const airwayPt = project3DPoint(0, 18, -68, w, h, orbit);
        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText("[VÍA AÉREA ASEGURADA]", airwayPt.x - 62, airwayPt.y - 18);
    }

    // 5. Avatares Cooperativos alrededor de la Cama UCI si el Modo Multijugador está conectado
    if (engine3DState.multiplayer.connected) {
        const squadPositions = [
            { x: -115, y: 15, z: -20, name: "Dr. Residente 1 (Vía Aérea)" },
            { x: 115, y: 15, z: -10, name: "Lic. UCI 2 (Fármacos IV)" }
        ];
        squadPositions.forEach(member => {
            const mpPt = project3DPoint(member.x, member.y, member.z, w, h, orbit);
            ctx.fillStyle = "rgba(148, 222, 45, 0.25)";
            ctx.strokeStyle = "#94de2d";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mpPt.x, mpPt.y, 14 * mpPt.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#94de2d";
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillText(member.name, mpPt.x - 55, mpPt.y - 16);
        });
    }
}

// ============================================================================
// 8. COOPERATIVO MULTIJUGADOR, TELEMETRÍA, CRONÓMETRO Y PERSISTENCIA
// ============================================================================

/**
 * Conecta o desconecta la sala cooperativa multijugador en tiempo real (`sim3d.multiplayer.js`).
 * @param {string} roomCode
 */
export function toggleMultiplayerRoom3D(roomCode = "UCI-ALICIZATION-01") {
    const statusDot = document.getElementById("engine3d-mp-status-dot");
    const toggleBtn = document.getElementById("btn-engine3d-mp-toggle");
    const squadList = document.getElementById("engine3d-mp-squad-list");

    engine3DState.multiplayer.connected = !engine3DState.multiplayer.connected;
    engine3DState.multiplayer.roomCode = roomCode.trim() || "UCI-ALICIZATION-01";

    if (typeof Sim3DMultiplayer.toggleRoomConnection === "function") {
        Sim3DMultiplayer.toggleRoomConnection(engine3DState.multiplayer.roomCode, engine3DState);
    }

    if (engine3DState.multiplayer.connected) {
        const leaderName = appState.currentUserData?.nombre || auth.currentUser?.email || "Tú (Líder UCI)";
        engine3DState.multiplayer.squadMembers = [
            { nombre: leaderName, rol: "Líder de Reanimación & Desfibrilador", online: true },
            { nombre: "Dr. Residente Guardia", rol: "Manejo de Vía Aérea 3D", online: true },
            { nombre: "Enf. Especialista UCI", rol: "Accesos Vasculares & Bombas IV", online: true }
        ];

        if (statusDot) {
            statusDot.className = "px-2 py-0.5 rounded-full text-[10px] font-mono bg-secondary/20 text-secondary border border-secondary/40 font-extrabold";
            statusDot.textContent = "En Línea • 3 en Sala";
        }
        if (toggleBtn) {
            toggleBtn.textContent = "Salir";
            toggleBtn.className = "px-3 py-1.5 rounded-xl bg-danger text-white text-xs font-extrabold hover:bg-opacity-90 transition-all whitespace-nowrap";
        }
        if (squadList) {
            squadList.innerHTML = engine3DState.multiplayer.squadMembers.map(m => `
                <div class="bg-surface border border-surface-high rounded-xl p-2 flex items-center justify-between">
                    <div>
                        <span class="block text-xs font-bold text-white">${m.nombre}</span>
                        <span class="block text-[10px] font-mono text-primary">${m.rol}</span>
                    </div>
                    <span class="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                </div>
            `).join("");
        }
        appendChronologicalLog3D(`[Cooperativo 3D]: Conectado a sala ${engine3DState.multiplayer.roomCode} con 3 integrantes.`);
    } else {
        engine3DState.multiplayer.squadMembers = [];
        if (statusDot) {
            statusDot.className = "px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface text-gray-400 border border-surface-high";
            statusDot.textContent = "Offline";
        }
        if (toggleBtn) {
            toggleBtn.textContent = "Conectar";
            toggleBtn.className = "px-3 py-1.5 rounded-xl bg-secondary text-surface text-xs font-extrabold hover:bg-opacity-90 transition-all whitespace-nowrap";
        }
        if (squadList) {
            squadList.innerHTML = `<p class="text-[11px] text-gray-500">Sesión cooperativa desconectada. Modo individual activo.</p>`;
        }
        appendChronologicalLog3D("[Cooperativo 3D]: Sala desconectada.");
    }
}

/**
 * Procesa una maniobra recibida desde otro miembro del escuadrón cooperativo.
 * @param {Object} remoteEvent
 */
function handleRemoteMultiplayerAction3D(remoteEvent = {}) {
    if (!remoteEvent || !remoteEvent.actionId) return;
    appendChronologicalLog3D(`[Escuadrón • ${remoteEvent.user || "Colega"}]: ${remoteEvent.actionName || remoteEvent.actionId}`);
}

/**
 * Actualiza los indicadores hemodinámicos en la superposición holográfica del visor 3D.
 * @param {Object} vitalsPatch
 */
export function updateTelemetryVitals3D(vitalsPatch = {}) {
    engine3DState.vitals = {
        ...engine3DState.vitals,
        ...vitalsPatch
    };

    const v = engine3DState.vitals;
    v.map = Math.round((v.bpSys + 2 * v.bpDia) / 3);

    const hrEl = document.getElementById("sim3d-vital-hr");
    const bpEl = document.getElementById("sim3d-vital-bp");
    const spo2El = document.getElementById("sim3d-vital-spo2");
    const etco2El = document.getElementById("sim3d-vital-etco2");
    const rrGcsEl = document.getElementById("sim3d-vital-rr-gcs");
    const rhythmEl = document.getElementById("engine3d-rhythm-badge");

    if (hrEl) hrEl.textContent = String(v.hr);
    if (bpEl) bpEl.textContent = `${v.bpSys}/${v.bpDia} (${v.map})`;
    if (spo2El) spo2El.textContent = `${v.spo2}%`;
    if (etco2El) etco2El.textContent = `${v.etco2} mmHg`;
    if (rrGcsEl) rrGcsEl.textContent = `${v.rr} • GCS ${v.gcs}`;
    if (rhythmEl) {
        rhythmEl.textContent = `Ritmo: ${(v.rhythm || "sinusal").replace(/_/g, " ").toUpperCase()}`;
    }
}

/**
 * Renderiza el checklist de objetivos clínicos críticos del escenario activo.
 */
function renderScenarioObjectives3D() {
    const listEl = document.getElementById("engine3d-objectives-list");
    const progressEl = document.getElementById("engine3d-objectives-progress");
    if (!listEl || !engine3DState.activeScenario) return;

    const objectives = engine3DState.activeScenario.objetivosCriticos || [];
    const doneCount = objectives.filter(o => engine3DState.completedObjectives.includes(o.actionId)).length;

    if (progressEl) {
        progressEl.textContent = `${doneCount} / ${objectives.length}`;
    }

    listEl.innerHTML = objectives.map((obj, idx) => {
        const isCompleted = engine3DState.completedObjectives.includes(obj.actionId);
        return `
            <div class="p-2.5 rounded-xl border text-xs flex items-start gap-2 transition-all ${
                isCompleted
                    ? "bg-secondary/15 border-secondary/50 text-white"
                    : "bg-surface border-surface-high text-gray-300"
            }">
                <span class="material-symbols-outlined text-base ${isCompleted ? "text-secondary" : "text-gray-500"}">
                    ${isCompleted ? "check_circle" : "radio_button_unchecked"}
                </span>
                <div>
                    <span class="font-bold block">${idx + 1}. ${obj.descripcion}</span>
                    ${
                        isCompleted && obj.racional
                            ? `<span class="text-[11px] text-secondary block mt-0.5">${obj.racional}</span>`
                            : ""
                    }
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Finaliza el escenario 3D cuando el estudiante cumple todos los objetivos críticos
 * y persiste el resultado en la colección `usuarios` de Cloud Firestore.
 * @param {Object} summary
 */
export async function completeScenario3D(summary = {}) {
    if (engine3DState.timerIntervalId) {
        clearInterval(engine3DState.timerIntervalId);
    }

    const feedbackEl = document.getElementById("engine3d-action-feedback");
    if (feedbackEl) {
        feedbackEl.className = "rounded-xl p-4 border border-secondary bg-secondary/15 text-xs text-white space-y-2";
        feedbackEl.innerHTML = `
            <div class="flex items-center justify-between">
                <strong class="text-secondary text-sm flex items-center gap-1.5">
                    <span class="material-symbols-outlined">military_tech</span>
                    <span>¡Paciente Estabilizado en Quirófano / UCI 3D!</span>
                </strong>
                <span class="font-mono font-extrabold text-secondary">${engine3DState.score} / 100 pts</span>
            </div>
            <p class="text-gray-200">
                Has completado todos los objetivos críticos del protocolo en <strong>${formatSecondsMMSS(engine3DState.elapsedSeconds)}</strong>.
            </p>
        `;
    }

    appendChronologicalLog3D(`✓ ESCENARIO 3D RESUELTO CON ÉXITO (${engine3DState.score}/100 pts).`);

    const uid = auth.currentUser?.uid || appState.currentUser?.uid;
    if (!uid) return;

    try {
        await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            lastSim3DCompletedAt: new Date().toISOString(),
            lastSim3DScore: engine3DState.score,
            lastSim3DScenarioId: summary.scenarioId || engine3DState.activeScenario?.id || "escenario_3d"
        });
    } catch (e) {
        // Silencioso en caso de modo offline temporal
    }
}

function startScenarioTimer3D() {
    if (engine3DState.timerIntervalId) {
        clearInterval(engine3DState.timerIntervalId);
    }
    const timerBadge = document.getElementById("engine3d-timer-badge");
    if (timerBadge) timerBadge.textContent = "00:00";

    engine3DState.timerIntervalId = setInterval(() => {
        if (engine3DState.isScenarioFinished) return;
        engine3DState.elapsedSeconds += 1;
        if (timerBadge) {
            timerBadge.textContent = formatSecondsMMSS(engine3DState.elapsedSeconds);
        }
    }, 1000);
}

function formatSecondsMMSS(totalSeconds) {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

function updateEngine3DScoreUI() {
    const badge = document.getElementById("engine3d-score-badge");
    if (badge) badge.textContent = `${engine3DState.score} / 100 pts`;
}

function appendChronologicalLog3D(entryText) {
    const stamp = formatSecondsMMSS(engine3DState.elapsedSeconds);
    engine3DState.chronologicalLog.unshift(`[${stamp}] ${entryText}`);

    const logEl = document.getElementById("engine3d-chronological-log");
    if (!logEl) return;

    logEl.innerHTML = engine3DState.chronologicalLog
        .slice(0, 12)
        .map((line, idx) => `
            <div class="${idx === 0 ? "text-primary font-bold" : "text-gray-400"}">
                • ${line}
            </div>
        `)
        .join("");
}

function bindEngine3DWorkspaceEvents() {
    const careerSelect = document.getElementById("engine3d-career-select");
    const subjectSelect = document.getElementById("engine3d-subject-select");
    const scenarioSelect = document.getElementById("engine3d-scenario-select");

    careerSelect?.addEventListener("change", () => {
        engine3DState.career = careerSelect.value;
        engine3DState.subject = "todas";
        updateEngine3DSubjectOptions(engine3DState.career);
        setCurriculumSelection({
            career: engine3DState.career,
            subject: "todas"
        });
        filterEngine3DScenarios();
    });

    subjectSelect?.addEventListener("change", () => {
        engine3DState.subject = subjectSelect.value;
        filterEngine3DScenarios();
    });

    scenarioSelect?.addEventListener("change", () => {
        launchScenario3D(scenarioSelect.value);
    });

    document.getElementById("btn-engine3d-restart")?.addEventListener("click", () => {
        if (engine3DState.activeScenario) {
            launchScenario3D(engine3DState.activeScenario.id);
        }
    });

    document.getElementById("btn-engine3d-fullscreen")?.addEventListener("click", () => {
        const wrapper = document.getElementById("engine3d-viewport-wrapper");
        if (!wrapper) return;
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    });

    // Controles de cámara orbital 3D (Botones y Arrastre con Mouse)
    document.getElementById("btn-cam3d-left")?.addEventListener("click", () => {
        engine3DState.cameraOrbit.autoRotate = false;
        engine3DState.cameraOrbit.yaw -= 15;
    });

    document.getElementById("btn-cam3d-right")?.addEventListener("click", () => {
        engine3DState.cameraOrbit.autoRotate = false;
        engine3DState.cameraOrbit.yaw += 15;
    });

    document.getElementById("btn-cam3d-center")?.addEventListener("click", () => {
        engine3DState.cameraOrbit.autoRotate = false;
        engine3DState.cameraOrbit.yaw = 0;
        engine3DState.cameraOrbit.pitch = 14;
        engine3DState.cameraOrbit.zoom = 1.0;
    });

    document.getElementById("btn-cam3d-orbit")?.addEventListener("click", () => {
        engine3DState.cameraOrbit.autoRotate = !engine3DState.cameraOrbit.autoRotate;
    });

    document.getElementById("btn-engine3d-load-webgl")?.addEventListener("click", () => {
        mountUnityWebGLBuild(engine3DState.activeScenario);
    });

    document.getElementById("btn-engine3d-mp-toggle")?.addEventListener("click", () => {
        const roomInput = document.getElementById("engine3d-mp-room-input");
        toggleMultiplayerRoom3D(roomInput?.value || "UCI-ALICIZATION-01");
    });

    // Rotación libre arrastrando sobre el lienzo 3D
    const canvas = document.getElementById("engine3d-webgl-canvas");
    if (canvas) {
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener("mousedown", (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            engine3DState.cameraOrbit.autoRotate = false;
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            engine3DState.cameraOrbit.yaw += dx * 0.45;
            engine3DState.cameraOrbit.pitch = Math.max(-5, Math.min(45, engine3DState.cameraOrbit.pitch + dy * 0.25));
        });

        window.addEventListener("mouseup", () => {
            dragging = false;
        });
    }
}

function bindGlobalCurriculumEvents3D() {
    if (window.__makaiEngine3DCurriculumBound) return;
    window.__makaiEngine3DCurriculumBound = true;

    window.addEventListener("makai:curriculumChanged", (e) => {
        const detail = e.detail || {};
        if (detail.career && detail.career !== engine3DState.career) {
            engine3DState.career = detail.career;
            const careerSelect = document.getElementById("engine3d-career-select");
            if (careerSelect) careerSelect.value = detail.career;
            updateEngine3DSubjectOptions(detail.career);
        }

        if (detail.subject) {
            engine3DState.subject = detail.subject;
            const subjectSelect = document.getElementById("engine3d-subject-select");
            if (subjectSelect) subjectSelect.value = detail.subject;
        }

        filterEngine3DScenarios();
    });
}

// ============================================================================
// 9. BANCO SEMILLA DE ESCENARIOS CLÍNICOS 3D (UCI, TRAUMA Y CÓDIGO ROJO)
// ============================================================================

function getSeedScenarios3D() {
    return [
        {
            id: "sim3d_med_acls_tv_inestable_uci",
            carrera: "medicina",
            materia: "Medicina Interna",
            titulo: "Código Azul UCI 3D: Taquicardia Ventricular Monomórfica Inestable",
            planRequerido: "Básico",
            webglBuildName: "uci_acls_tv",
            enunciadoInicial: "Paciente masculino de 64 años en unidad coronaria presenta deterioro súbito del sensorio (GCS 9), diaforesis fría, dolor torácico opresivo, PA 82/46 mmHg (PAM 58) y FC 168 lpm con QRS ancho regular en el monitor 3D. Ejecuta la secuencia de estabilización avanzada en el HUD.",
            initialVitals: {
                hr: 168,
                bpSys: 82,
                bpDia: 46,
                map: 58,
                spo2: 86,
                etco2: 29,
                rr: 28,
                temp: 36.5,
                gcs: 9,
                rhythm: "taquicardia_ventricular_con_pulso"
            },
            examenCefalocaudal: {
                cabeza_neuro: "Paciente somnoliento (GCS 9: O2 V3 M4), pupilas isocóricas de 3 mm, piel fría y diaforética por hipoperfusión.",
                cuello_via_aerea: "Vía aérea permeable pero con taquipnea superficial; leve ingurgitación yugular.",
                torax: "Ruidos cardíacos extremadamente rápidos y regulares (168 lpm); estertores finos bibasales.",
                abdomen_pelvis: "Abdomen blando, sin signos de irritación peritoneal.",
                extremidades: "Pulsos periféricos débiles pero presentes (taquicardia con pulso); llenado capilar de 4 segundos."
            },
            objetivosCriticos: [
                {
                    actionId: "oxigeno_reservorio",
                    descripcion: "Administrar Oxígeno suplementario de alto flujo (Mascarilla con reservorio 15 L/min)",
                    racional: "Corrige la hipoxemia tisular antes de la sedoanalgesia y cardioversión eléctrica."
                },
                {
                    actionId: "doble_via_16g",
                    descripcion: "Canalizar acceso venoso periférico permeable (16G/18G)",
                    racional: "Asegura vía intravascular para sedación breve y administración de antiarrítmicos."
                },
                {
                    actionId: "cardioversion_sincronizada",
                    descripcion: "Ejecutar Cardioversión Eléctrica Sincronizada (100 J Bifásico)",
                    racional: "En toda taquicardia de complejo ancho regular con inestabilidad hemodinámica (hipotensión, alteración mental, dolor isquémico) y pulso presente, el tratamiento de elección inmediato según ACLS es la cardioversión eléctrica sincronizada."
                }
            ],
            accionesPenalizadas: {
                desfibrilacion_200j: {
                    puntos: 20,
                    racional: "El paciente TIENE pulso. Una descarga no sincronizada (desfibrilación) en TV con pulso puede caer sobre el período refractario relativo (onda T) e inducir Fibrilación Ventricular."
                }
            }
        },
        {
            id: "sim3d_med_atls_politrauma_via_aerea",
            carrera: "medicina",
            materia: "Cirugía General",
            titulo: "Trauma Shock 3D (ATLS): TCE Grave + Choque Hemorrágico Grado III",
            planRequerido: "Básico",
            webglBuildName: "trauma_bay_atls",
            enunciadoInicial: "Ingresa a sala de choque 3D paciente de 29 años tras colisión vehicular de alta energía. Glasgow 7 (O2 V1 M4), estridor por secreciones hemáticas, PA 80/48 mmHg, FC 136 lpm y SpO2 82%. Sigue la revisión primaria ABCDE del protocolo ATLS.",
            initialVitals: {
                hr: 136,
                bpSys: 80,
                bpDia: 48,
                map: 59,
                spo2: 82,
                etco2: 31,
                rr: 32,
                temp: 35.8,
                gcs: 7,
                rhythm: "taquicardia_sinusal_hipovolemica"
            },
            examenCefalocaudal: {
                cabeza_neuro: "Glasgow 7/15 (< 8 exige asegurar vía aérea definitiva). Herida contusa frontal, pupilas reactivas.",
                cuello_via_aerea: "Collarín cervical rígido colocado; abundantes secreciones en orofaringe que comprometen permeabilidad.",
                torax: "Murmullo vesicular conservado bilateralmente, taquicardia sinusal compensatoria.",
                abdomen_pelvis: "Ventana eFAST positiva con líquido libre en espacio de Morrison.",
                extremidades: "Extremidades pálidas y frías, taquisfigmia radial."
            },
            objetivosCriticos: [
                {
                    actionId: "aspirar_secreciones",
                    descripcion: "A (Airway): Aspirar secreciones orofaríngeas bajo control cervical",
                    racional: "Despeja la vía aérea antes de la laringoscopia."
                },
                {
                    actionId: "intubacion_iot",
                    descripcion: "A/B: Realizar Secuencia Rápida de Intubación (GCS ≤ 8) con capnografía",
                    racional: "Todo paciente politraumatizado con escala de coma de Glasgow ≤ 8 requiere protección definitiva de la vía aérea mediante intubación endotraqueal."
                },
                {
                    actionId: "doble_via_16g",
                    descripcion: "C (Circulation): Canalizar doble vía periférica gruesa (16G)",
                    racional: "Permite reanimación hemostática y administración temprana de ácido tranexámico."
                },
                {
                    actionId: "acido_tranexamico",
                    descripcion: "C: Administrar Ácido Tranexámico 1 g IV en 10 min (< 3 horas del trauma)",
                    racional: "El estudio CRASH-2 demostró reducción de mortalidad por sangrado al administrar ácido tranexámico dentro de las primeras 3 horas del trauma hemorrágico."
                }
            ]
        },
        {
            id: "sim3d_enf_uci_intubacion_vasopresor",
            carrera: "enfermeria",
            materia: "Enfermería de Cuidados Críticos y Urgencias",
            titulo: "UCI 3D: Manejo de Paciente Crítico Intubado y Titulación de Noradrenalina",
            planRequerido: "Básico",
            webglBuildName: "uci_nursing_3d",
            enunciadoInicial: "Paciente en unidad de cuidados intensivos con insuficiencia respiratoria aguda hipoxémica (SpO2 84%) e hipotensión refractaria a cristaloides (PA 76/42 mmHg, PAM 53 mmHg). Coordina la preparación de vía aérea avanzada y soporte vasopresor.",
            initialVitals: {
                hr: 126,
                bpSys: 76,
                bpDia: 42,
                map: 53,
                spo2: 84,
                etco2: 26,
                rr: 32,
                temp: 38.6,
                gcs: 11,
                rhythm: "taquicardia_sinusal"
            },
            objetivosCriticos: [
                {
                    actionId: "oxigeno_reservorio",
                    descripcion: "Preoxigenar al paciente con FiO2 al 100%",
                    racional: "Incrementa la reserva de oxígeno funcional residual antes de instrumentar la vía aérea."
                },
                {
                    actionId: "cateter_venoso_central",
                    descripcion: "Asistir y habilitar acceso venoso central para infusión vasoactiva",
                    racional: "Garantiza infusión segura de aminas vasoactivas."
                },
                {
                    actionId: "noradrenalina_bic",
                    descripcion: "Iniciar Noradrenalina en bomba de infusión continua para PAM ≥ 65 mmHg",
                    racional: "Restaura la presión de perfusión tisular en el paciente crítico hipotenso."
                }
            ]
        }
    ];
}
