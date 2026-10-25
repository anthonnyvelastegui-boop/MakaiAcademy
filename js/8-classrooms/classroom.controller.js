// ============================================================================
// ARCHIVO: js/8-classrooms/classroom.controller.js
// DESCRIPCIÓN: Controlador General de Aulas Virtuales, Clases por Semestre
//              y Sesiones de Mentoría Élite VIP. Coordina el catálogo curricular
//              (CACES y CARRERA), los permisos de suscripción (Básico, PRO, VIP)
//              y los 4 subcomponentes: classroom.live.js, classroom.vod.js,
//              classroom.drm.js y classroom.chat.js.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    canAccessBySubscription,
    setCurriculumSelection
} from "../2-core/state.store.js";

// Importaciones modulares tolerantes a archivos semilla de los 4 subcomponentes
import * as ClassroomLive from "./classroom.live.js";
import * as ClassroomVOD from "./classroom.vod.js";
import * as ClassroomDRM from "./classroom.drm.js";
import * as ClassroomChat from "./classroom.chat.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA (assets/8-multimedia-aulas/) Y CATÁLOGO SEMILLA
// ============================================================================

const SAFE_COLLECTIONS = Object.freeze({
    CLASSROOMS: COLLECTIONS?.CLASSROOMS || "aulas_virtuales",
    MATERIALS: COLLECTIONS?.MATERIALS || "materiales_estudio"
});

/**
 * Rutas oficiales hacia la Bóveda Multimedia de Aulas Virtuales sin espacios ni tildes.
 */
export const CLASSROOM_ASSET_PATHS = Object.freeze({
    COVERS: "assets/8-multimedia-aulas/portadas-clases/",
    BACKGROUNDS: "assets/8-multimedia-aulas/fondos-transmision/",
    GUIDES_PDF: "assets/5-multimedia-1d/guias-pdf/",
    INFOGRAPHICS: "assets/5-multimedia-1d/infografias-y-algoritmos/"
});

/**
 * Catálogo semilla de respaldo para garantizar operatividad inmediata en CACES y CARRERA.
 */
export const DEFAULT_CLASSROOMS_CATALOG = [
    {
        id: "aula_caces_med_interna_01",
        titulo: "Sesión Magistral • Integración Clínica y Algoritmo de Choque Séptico (CACES)",
        descripcion: "Resolución comentada de casos clínicos de alta complejidad sobre sepsis, soporte hemodinámico e interpretación gasométrica bajo normativa GPC del MSP.",
        rutaAcademica: "caces",
        carrera: "medicina",
        etapa: "caces",
        materia: "Medicina Interna",
        especialista: "Dr. Especialista Makai",
        modalidad: "vod", // "vod" | "live"
        nivelSuscripcion: "Básico",
        duracion: "58:20",
        fechaSesion: "2026-10-15",
        portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-medicina-interna-caces.jpg`,
        fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        liveProvider: "meet",
        liveRoomUrl: "https://meet.google.com/",
        drmProtected: true,
        capitulos: [
            { titulo: "01. Criterios qSOFA y SOFA en Guardia", segundo: 0, tiempo: "00:00" },
            { titulo: "02. Reanimación Inicial y Cristaloides", segundo: 255, tiempo: "04:15" },
            { titulo: "03. Elección de Vasopresores en Preguntas CACES", segundo: 380, tiempo: "06:20" }
        ],
        materiales: [
            {
                id: "mat_caces_med_01",
                titulo: "GPC Sepsis y Choque Séptico • Resumen CACES",
                tipo: "pdf",
                formato: "PDF • Descarga Directa",
                tamano: "2.4 MB",
                nivelRequerido: "Básico",
                url: `${CLASSROOM_ASSET_PATHS.GUIDES_PDF}gpc-resumen-clase.pdf`,
                descripcion: "Algoritmo diagnóstico y metas de PAM en la primera hora."
            }
        ]
    },
    {
        id: "aula_caces_gineco_preeclampsia_02",
        titulo: "Clase Magistral • Trastornos Hipertensivos del Embarazo y Clave Azul MSP",
        descripcion: "Desglose completo del Score MAMÁ, criterios de severidad en preeclampsia, esquema de Zuspan e intoxicación por sulfato de magnesio.",
        rutaAcademica: "caces",
        carrera: "medicina",
        etapa: "caces",
        materia: "Ginecología y Obstetricia",
        especialista: "Dra. Especialista Gineco-Obstetricia",
        modalidad: "vod",
        nivelSuscripcion: "PRO",
        duracion: "01:12:45",
        fechaSesion: "2026-10-18",
        portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-clave-azul-msp.jpg`,
        fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        liveProvider: "zoom",
        liveRoomUrl: "",
        drmProtected: true,
        capitulos: [
            { titulo: "01. Clasificación de Estados Hipertensivos", segundo: 0, tiempo: "00:00" },
            { titulo: "02. Activación de Clave Azul y Sulfato de Magnesio", segundo: 180, tiempo: "03:00" },
            { titulo: "03. Antídoto: Gluconato de Calcio al 10%", segundo: 420, tiempo: "07:00" }
        ],
        materiales: [
            {
                id: "mat_caces_gineco_01",
                titulo: "Protocolo Clave Azul y Roja Obstétrica MSP",
                tipo: "pdf",
                formato: "PDF • Alta Resolución",
                tamano: "3.6 MB",
                nivelRequerido: "PRO",
                url: `${CLASSROOM_ASSET_PATHS.GUIDES_PDF}gpc-resumen-clase.pdf`,
                descripcion: "Dosificación exacta de hidralazina, nifedipino, labetalol y sulfato de magnesio."
            }
        ]
    },
    {
        id: "aula_vip_mentoria_en_vivo_03",
        titulo: "Mentoría Élite VIP en Vivo • Simulacro Clínico CACES Comentado en Tiempo Real",
        descripcion: "Sesión interactiva en directo con resolución de reactivos filtro, análisis de distractores oficiales y ronda abierta de preguntas con el especialista.",
        rutaAcademica: "caces",
        carrera: "medicina",
        etapa: "caces",
        materia: "Pediatría",
        especialista: "Director Académico Makai",
        modalidad: "live",
        nivelSuscripcion: "VIP",
        duracion: "EN VIVO • 90 min",
        fechaSesion: "Hoy • 20:00 ECT",
        portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-mentoria-elite-vip.jpg`,
        fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-transmision-vip.jpg`,
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        liveProvider: "zoom_sdk",
        liveRoomUrl: "https://meet.google.com/",
        liveMeetingId: "MAKAI-VIP-2026",
        drmProtected: true,
        capitulos: [
            { titulo: "01. Triángulo de Evaluación Pediátrica (TEP)", segundo: 0, tiempo: "00:00" },
            { titulo: "02. Reanimación Neonatal y APGAR", segundo: 300, tiempo: "05:00" }
        ],
        materiales: [
            {
                id: "mat_vip_dossier_01",
                titulo: "Dossier Exclusivo de Reactivos Élite VIP",
                tipo: "dossier_vip",
                formato: "PDF • Bóveda VIP",
                tamano: "4.2 MB",
                nivelRequerido: "VIP",
                url: `${CLASSROOM_ASSET_PATHS.COVERS}dossier-casos-vip.pdf`,
                descripcion: " Cuadernillo reservado para alumnos de Mentoría Élite VIP."
            }
        ]
    },
    {
        id: "aula_carrera_semestre_morfofuncion_04",
        titulo: "Aula Universitaria • Electrofisiología Cardíaca y Lectura Sistemática del ECG",
        descripcion: "Clase estructurada por semestre para ciencias de la salud: potencial de acción transmembrana, vectores de despolarización y bloqueos de rama.",
        rutaAcademica: "carrera",
        carrera: "medicina",
        etapa: "semestre_3",
        materia: "Fisiología y Morfofunción",
        especialista: "Dr. Especialista Cardiólogo",
        modalidad: "vod",
        nivelSuscripcion: "PRO",
        duracion: "49:10",
        fechaSesion: "2026-10-12",
        portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-ecg-semestre.jpg`,
        fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        liveProvider: "meet",
        liveRoomUrl: "",
        drmProtected: true,
        capitulos: [
            { titulo: "01. Fases 0 a 4 del Potencial de Acción", segundo: 0, tiempo: "00:00" },
            { titulo: "02. Cálculo de Frecuencia y Eje Eléctrico", segundo: 210, tiempo: "03:30" }
        ],
        materiales: []
    },
    {
        id: "aula_caces_enfermeria_05",
        titulo: "CACES Enfermería • Proceso de Atención de Enfermería (PAE) y Taxonomía NANDA-NIC-NOC",
        descripcion: "Aplicación táctica de diagnósticos enfermeros, administración segura de medicamentos de alto riesgo y escalas de valoración (Norton, Braden, Morse).",
        rutaAcademica: "caces",
        carrera: "enfermeria",
        etapa: "caces",
        materia: "Enfermería Clínico-Quirúrgica",
        especialista: "Lcda. Especialista UCI Makai",
        modalidad: "vod",
        nivelSuscripcion: "Básico",
        duracion: "54:00",
        fechaSesion: "2026-10-14",
        portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-enfermeria-caces.jpg`,
        fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        liveProvider: "meet",
        liveRoomUrl: "",
        drmProtected: true,
        capitulos: [
            { titulo: "01. Estructura del Diagnóstico NANDA", segundo: 0, tiempo: "00:00" },
            { titulo: "02. Escalas de Riesgo de Úlceras y Caídas", segundo: 240, tiempo: "04:00" }
        ],
        materiales: []
    }
];

/**
 * Estado interno del controlador de Aulas Virtuales.
 */
export const classroomControllerState = {
    initialized: false,
    catalog: [...DEFAULT_CLASSROOMS_CATALOG],
    filteredCatalog: [...DEFAULT_CLASSROOMS_CATALOG],
    activeClass: DEFAULT_CLASSROOMS_CATALOG[0],
    activeStageMode: "vod", // "vod" | "live"
    isPlaylistCollapsed: false,
    drmShieldActive: true,
    filters: {
        track: "all",       // "all" | "caces" | "carrera"
        career: "all",      // "all" | "medicina" | "enfermeria" | "odontologia" | "obstetricia" | ...
        modality: "all",    // "all" | "vod" | "live"
        tier: "all",        // "all" | "Básico" | "PRO" | "VIP"
        searchQuery: ""
    }
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DE AULAS VIRTUALES (initClassroomController)
// ============================================================================

/**
 * Inicializa el módulo completo de Aulas Virtuales dentro de `#view-classrooms`.
 * Invocado automáticamente por `js/2-core/app.orchestrator.js`.
 * @param {Object} options
 */
export async function initClassroomController(options = {}) {
    const viewContainer = document.getElementById("view-classrooms");
    if (!viewContainer) return null;

    // Sincronizar filtros iniciales con el estado curricular activo si se solicita
    if (options.syncWithAppState && appState?.currentCareer) {
        classroomControllerState.filters.career = appState.currentCareer;
    }

    // 1. Construir la estructura visual del Aula Virtual en #view-classrooms
    buildClassroomMainLayout(viewContainer);

    // 2. Cargar el catálogo de clases desde Cloud Firestore + Semilla
    await loadClassroomsCatalog();

    // 3. Inicializar subcomponente de protección anti-grabación (classroom.drm.js)
    initDRMSubmodule();

    // 4. Seleccionar la primera clase disponible según filtros activos
    const initialClass = classroomControllerState.filteredCatalog[0] || DEFAULT_CLASSROOMS_CATALOG[0];
    await selectClassroomSession(initialClass.id, { skipPaywallAlertOnInit: true });

    // 5. Inicializar el subcomponente de interacción docente (classroom.chat.js)
    const chatSidebarContainer = document.getElementById("classroom-chat-panel");
    const chatInitFn = ClassroomChat.initClassroomChat || ClassroomChat.initChatSubcomponent;
    if (typeof chatInitFn === "function") {
        await chatInitFn({
            container: chatSidebarContainer,
            activeClass: classroomControllerState.activeClass,
            getVideoCurrentTime: () => getActiveVideoTimeSeconds(),
            onSeekVideo: (seconds) => seekActiveClassroomVideo(seconds),
            onResourceOpened: (resource, mode) => {
                registerStudentClassroomActivity("recurso_abierto", {
                    classId: classroomControllerState.activeClass?.id,
                    resourceId: resource?.id,
                    mode
                });
            }
        });
    }

    // 6. Escuchar eventos globales de navegación curricular y saltos de video
    bindGlobalClassroomEvents();

    classroomControllerState.initialized = true;
    return classroomControllerState;
}

// Alias de compatibilidad para `app.orchestrator.js` y `router.spa.js`
export const initClassrooms = initClassroomController;
export const initVirtualClassrooms = initClassroomController;

// ============================================================================
// 3. CONSTRUCCIÓN DE LA INTERFAZ PRINCIPAL EN #view-classrooms
// ============================================================================

/**
 * Renderiza el diseño completo del Aula Virtual dentro de `#view-classrooms`:
 * Cabecera de filtros + Columna Izquierda (Catálogo colapsable) + Escenario Central
 * (Reproductor VOD / Sala Live + Escudo DRM) + Columna Derecha (`#classroom-chat-panel`).
 * @param {HTMLElement} container
 */
function buildClassroomMainLayout(container) {
    const isAdmin = isCurrentMasterAdmin();

    container.innerHTML = `
        <div class="space-y-5">
            <!-- ============================================================ -->
            <!-- CABECERA TÁCTICA Y BARRA DE FILTROS DEL AULA VIRTUAL         -->
            <!-- ============================================================ -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/40 text-primary text-[10px] font-mono font-extrabold uppercase tracking-wider">
                                Módulo 8 • Aulas Virtuales & VOD
                            </span>
                            <span id="classroom-drm-status-pill" class="px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/40 text-secondary text-[10px] font-mono font-extrabold uppercase flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">verified_user</span>
                                <span>Escudo DRM Activo</span>
                            </span>
                        </div>
                        <h2 class="text-lg md:text-xl font-extrabold text-white mt-1">
                            Centro de Clases Magistrales, Semestres y Mentoría Élite VIP
                        </h2>
                        <p class="text-xs text-gray-400">
                            Transmisiones interactivas en vivo, grabaciones en alta definición con capítulos clínicos y contacto directo con especialistas.
                        </p>
                    </div>

                    <!-- Conmutador de Escenario (VOD vs EN VIVO) + Botón Docente Admin -->
                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        <div class="inline-flex bg-surface p-1 rounded-xl border border-surface-high">
                            <button
                                type="button"
                                id="btn-stage-mode-vod"
                                class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all bg-primary text-surface flex items-center gap-1.5"
                            >
                                <span class="material-symbols-outlined text-sm">play_circle</span>
                                <span>Clases Grabadas (VOD)</span>
                            </button>
                            <button
                                type="button"
                                id="btn-stage-mode-live"
                                class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-gray-400 hover:text-white flex items-center gap-1.5"
                            >
                                <span class="w-2 h-2 rounded-full bg-danger animate-ping"></span>
                                <span>Sala en Vivo / VIP</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            id="btn-toggle-classroom-playlist"
                            class="px-3 py-2 rounded-xl bg-surface hover:bg-surface-high border border-surface-high text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1"
                            title="Mostrar u ocultar el catálogo lateral de clases"
                        >
                            <span class="material-symbols-outlined text-sm">view_sidebar</span>
                            <span class="hidden sm:inline">Catálogo</span>
                        </button>

                        ${isAdmin ? `
                            <button
                                type="button"
                                id="btn-admin-new-classroom"
                                class="px-3.5 py-2 rounded-xl bg-secondary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all flex items-center gap-1 shadow-[0_0_15px_rgba(0,230,118,0.25)]"
                            >
                                <span class="material-symbols-outlined text-sm">add_to_queue</span>
                                <span>+ Publicar Clase (Admin)</span>
                            </button>
                        ` : ""}
                    </div>
                </div>

                <!-- BARRA DE FILTROS CURRICULARES (RUTA / CARRERA / MODALIDAD / BUSCADOR) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-surface-high">
                    <!-- Filtro 1: Ruta Académica (CACES vs CARRERA) -->
                    <select
                        id="classroom-filter-track"
                        class="bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                    >
                        <option value="all">Todas las Rutas (CACES + Carrera)</option>
                        <option value="caces">🎯 Preparación Oficial CACES</option>
                        <option value="carrera">🏛️ Semestres de Carrera / Pre / Internado</option>
                    </select>

                    <!-- Filtro 2: Carrera de Salud -->
                    <select
                        id="classroom-filter-career"
                        class="bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                    >
                        <option value="all">Todas las Carreras</option>
                        <option value="medicina">Medicina</option>
                        <option value="enfermeria">Enfermería</option>
                        <option value="odontologia">Odontología</option>
                        <option value="obstetricia">Obstetricia</option>
                        <option value="nutricion">Nutrición y Dietética</option>
                        <option value="fisioterapia">Fisioterapia</option>
                        <option value="laboratorio">Laboratorio Clínico</option>
                        <option value="psicologia">Psicología Clínica</option>
                    </select>

                    <!-- Filtro 3: Modalidad -->
                    <select
                        id="classroom-filter-modality"
                        class="bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                    >
                        <option value="all">Modalidad: Todas (VOD + En Vivo)</option>
                        <option value="vod">🎬 Clases Grabadas (VOD HD)</option>
                        <option value="live">🔴 Transmisiones en Vivo</option>
                    </select>

                    <!-- Filtro 4: Nivel de Plan -->
                    <select
                        id="classroom-filter-tier"
                        class="bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                    >
                        <option value="all">Todos los Planes (Básico / PRO / VIP)</option>
                        <option value="Básico">Plan Básico ($0)</option>
                        <option value="PRO">Plan Makai PRO</option>
                        <option value="VIP">Mentoría Élite VIP</option>
                    </select>

                    <!-- Filtro 5: Buscador por tema, patología o especialista -->
                    <div class="relative">
                        <input
                            type="text"
                            id="classroom-filter-search"
                            placeholder="Buscar clase, patología o docente..."
                            class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl pl-3 pr-8 py-2 text-xs text-white outline-none"
                        >
                        <span class="material-symbols-outlined text-sm text-gray-400 absolute right-2.5 top-2.5 pointer-events-none">
                            search
                        </span>
                    </div>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- CUERPO DEL AULA VIRTUAL: 3 COLUMNAS SINCRONIZADAS            -->
            <!-- ============================================================ -->
            <div class="flex flex-col xl:flex-row gap-5 items-stretch">

                <!-- COLUMNA 1: CATÁLOGO LATERAL DE CLASES (COLAPSABLE) -->
                <aside
                    id="classroom-catalog-sidebar"
                    class="w-full xl:w-80 shrink-0 bg-surface-container border border-surface-high rounded-2xl flex flex-col overflow-hidden shadow-xl max-h-[680px]"
                >
                    <div class="p-3.5 bg-surface border-b border-surface-high flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-base">video_library</span>
                            <h3 class="text-xs font-extrabold text-white uppercase tracking-wider">
                                Catálogo de Sesiones
                            </h3>
                        </div>
                        <span id="classroom-catalog-count-badge" class="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold">
                            0 clases
                        </span>
                    </div>

                    <div id="classroom-catalog-list" class="flex-1 overflow-y-auto p-3 space-y-2.5">
                    </div>
                </aside>

                <!-- COLUMNA 2: ESCENARIO CENTRAL MULTIMEDIA (VOD / LIVE + DRM + CAPÍTULOS) -->
                <div class="flex-1 min-w-0 flex flex-col gap-4">
                    <div
                        id="classroom-main-stage-card"
                        class="bg-surface-container border border-surface-high rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                    >
                        <!-- Marco del Reproductor VOD o Sala En Vivo con Escudo Anti-Grabación DRM -->
                        <div
                            id="classroom-player-viewport"
                            class="relative w-full aspect-video bg-[#04070b] flex items-center justify-center overflow-hidden select-none"
                        >
                            <!-- Contenedor para Reproductor VOD (classroom.vod.js) -->
                            <div id="classroom-vod-stage-mount" class="w-full h-full"></div>

                            <!-- Contenedor para Sala en Vivo (classroom.live.js) -->
                            <div id="classroom-live-stage-mount" class="hidden w-full h-full"></div>

                            <!-- Capa de Marca de Agua Dinámica y Escudo DRM (classroom.drm.js) -->
                            <div
                                id="classroom-drm-watermark-layer"
                                class="pointer-events-none absolute inset-0 z-20 overflow-hidden"
                            ></div>

                            <!-- Cortina Negra de Bloqueo Anti-Captura DRM -->
                            <div
                                id="classroom-drm-blackout-curtain"
                                class="hidden absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                            >
                                <span class="material-symbols-outlined text-4xl text-danger mb-2">gpp_bad</span>
                                <h4 class="text-sm font-extrabold text-white uppercase tracking-wider">
                                    Protección Anti-Grabación Activada (Widevine / Makai DRM)
                                </h4>
                                <p class="text-xs text-gray-400 max-w-md mt-1">
                                    El video se ha pausado y oscurecido por seguridad al detectar pérdida de foco o intento de captura de pantalla. Haz clic abajo para reanudar la sesión.
                                </p>
                                <button
                                    type="button"
                                    id="btn-resume-drm-curtain"
                                    class="mt-4 px-4 py-2 rounded-xl bg-primary text-surface font-extrabold text-xs"
                                >
                                    Reanudar Reproducción Segura
                                </button>
                            </div>
                        </div>

                        <!-- Metadatos de la Clase Activa y Línea de Tiempo de Capítulos Clínicos -->
                        <div class="p-4 md:p-5 space-y-4 bg-surface">
                            <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                <div class="space-y-1 min-w-0">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span id="active-class-modality-badge" class="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-mono font-extrabold uppercase">
                                            VOD HD
                                        </span>
                                        <span id="active-class-subject-badge" class="px-2 py-0.5 rounded bg-surface-high text-gray-300 text-[10px] font-mono font-bold">
                                            Medicina Interna
                                        </span>
                                        <span id="active-class-tier-badge" class="px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-mono font-extrabold">
                                            Plan Básico
                                        </span>
                                    </div>
                                    <h3 id="active-class-title" class="text-base md:text-lg font-extrabold text-white leading-snug">
                                        Cargando sesión clínica...
                                    </h3>
                                    <p id="active-class-description" class="text-xs text-gray-400 leading-relaxed">
                                    </p>
                                </div>

                                <div class="flex items-center gap-2 shrink-0">
                                    <div class="px-3 py-2 rounded-xl bg-surface-container border border-surface-high text-right">
                                        <div class="text-[10px] font-mono text-gray-400 uppercase">Docente Especialista</div>
                                        <div id="active-class-specialist" class="text-xs font-extrabold text-primary">
                                            Dr. Especialista Makai
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Marcadores de Capítulos Clínicos para Salto Rápido -->
                            <div class="pt-3 border-t border-surface-high">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold">
                                        ⏱ Capítulos y Momentos Clave de la Sesión (Clic para saltar)
                                    </span>
                                    <span id="active-class-duration" class="text-[10px] font-mono text-primary font-bold">
                                        00:00
                                    </span>
                                </div>
                                <div id="active-class-chapters-bar" class="flex flex-wrap gap-2">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUMNA 3: PANEL DE INTERACCIÓN DOCENTE (MONTADO POR classroom.chat.js) -->
                <aside
                    id="classroom-chat-panel"
                    class="w-full xl:w-96 shrink-0 bg-surface-container border border-surface-high rounded-2xl flex flex-col overflow-hidden shadow-2xl max-h-[680px]"
                ></aside>
            </div>
        </div>
    `;

    bindClassroomControllerUIEvents();
}

/**
 * Enlaza los controles interactivos de filtros, conmutador VOD/Live y botones de administración.
 */
function bindClassroomControllerUIEvents() {
    // Conmutador entre modo VOD y modo Sala en Vivo
    document.getElementById("btn-stage-mode-vod")?.addEventListener("click", () => {
        switchClassroomStageMode("vod");
    });

    document.getElementById("btn-stage-mode-live")?.addEventListener("click", () => {
        switchClassroomStageMode("live");
    });

    // Botón para colapsar/expandir la barra lateral del catálogo
    document.getElementById("btn-toggle-classroom-playlist")?.addEventListener("click", () => {
        const sidebar = document.getElementById("classroom-catalog-sidebar");
        if (!sidebar) return;
        classroomControllerState.isPlaylistCollapsed = !classroomControllerState.isPlaylistCollapsed;
        sidebar.classList.toggle("hidden", classroomControllerState.isPlaylistCollapsed);
    });

    // Botón para reanudar reproducción tras activación de cortina DRM
    document.getElementById("btn-resume-drm-curtain")?.addEventListener("click", () => {
        const curtain = document.getElementById("classroom-drm-blackout-curtain");
        curtain?.classList.add("hidden");
        const videoEl = document.getElementById("classroom-vod-video");
        videoEl?.play?.().catch(() => {});
    });

    // Botón exclusivo de Administrador Maestro para publicar nueva clase
    document.getElementById("btn-admin-new-classroom")?.addEventListener("click", () => {
        openAdminCreateClassroomModal();
    });

    // Filtros curriculares en tiempo real
    const trackSelect = document.getElementById("classroom-filter-track");
    const careerSelect = document.getElementById("classroom-filter-career");
    const modalitySelect = document.getElementById("classroom-filter-modality");
    const tierSelect = document.getElementById("classroom-filter-tier");
    const searchInput = document.getElementById("classroom-filter-search");

    const triggerFilterUpdate = () => {
        filterClassroomsCatalog({
            track: trackSelect?.value || "all",
            career: careerSelect?.value || "all",
            modality: modalitySelect?.value || "all",
            tier: tierSelect?.value || "all",
            searchQuery: searchInput?.value || ""
        });
    };

    trackSelect?.addEventListener("change", triggerFilterUpdate);
    careerSelect?.addEventListener("change", triggerFilterUpdate);
    modalitySelect?.addEventListener("change", triggerFilterUpdate);
    tierSelect?.addEventListener("change", triggerFilterUpdate);
    searchInput?.addEventListener("input", triggerFilterUpdate);
}

// ============================================================================
// 4. CARGA Y FILTRADO DEL CATÁLOGO DE CLASES (FIRESTORE + SEMILLA)
// ============================================================================

/**
 * Carga el catálogo de clases virtuales desde Cloud Firestore (`aulas_virtuales`)
 * y lo combina con las clases semilla sin duplicar IDs.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function loadClassroomsCatalog(forceRefresh = false) {
    const mergedMap = new Map();

    // 1. Sembrar catálogo base garantizado
    DEFAULT_CLASSROOMS_CATALOG.forEach(item => {
        mergedMap.set(item.id, { ...item });
    });

    // 2. Consultar Cloud Firestore si está disponible
    if (db) {
        try {
            const snap = await getDocs(collection(db, SAFE_COLLECTIONS.CLASSROOMS));
            snap.forEach(docSnap => {
                const data = docSnap.data() || {};
                const classId = docSnap.id;
                mergedMap.set(classId, {
                    id: classId,
                    titulo: data.titulo || "Sesión Clínica MakaiAcademy",
                    descripcion: data.descripcion || "Clase magistral del programa académico.",
                    rutaAcademica: data.rutaAcademica || "caces",
                    carrera: data.carrera || "medicina",
                    etapa: data.etapa || "caces",
                    materia: data.materia || "General",
                    especialista: data.especialista || "Dr. Especialista Makai",
                    modalidad: data.modalidad || "vod",
                    nivelSuscripcion: data.nivelSuscripcion || "PRO",
                    duracion: data.duracion || "45:00",
                    fechaSesion: data.fechaSesion || "Reciente",
                    portadaUrl: data.portadaUrl || `${CLASSROOM_ASSET_PATHS.COVERS}portada-medicina-interna-caces.jpg`,
                    fondoTransmisionUrl: data.fondoTransmisionUrl || `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
                    videoUrl: data.videoUrl || "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    liveProvider: data.liveProvider || "meet",
                    liveRoomUrl: data.liveRoomUrl || "",
                    liveMeetingId: data.liveMeetingId || "",
                    drmProtected: data.drmProtected !== false,
                    capitulos: Array.isArray(data.capitulos) ? data.capitulos : [],
                    materiales: Array.isArray(data.materiales) ? data.materiales : []
                });
            });
        } catch (e) {
            // Conserva el catálogo semilla si Firestore está en modo local u offline
        }
    }

    classroomControllerState.catalog = Array.from(mergedMap.values());
    filterClassroomsCatalog(classroomControllerState.filters);

    return classroomControllerState.catalog;
}

/**
 * Filtra las clases disponibles por ruta (`caces` vs `carrera`), carrera, modalidad,
 * plan de suscripción y término de búsqueda, actualizando la barra lateral.
 * @param {Object} criteria
 * @returns {Array}
 */
export function filterClassroomsCatalog(criteria = {}) {
    classroomControllerState.filters = {
        ...classroomControllerState.filters,
        ...criteria
    };

    const { track, career, modality, tier, searchQuery } = classroomControllerState.filters;
    const cleanQuery = String(searchQuery || "").trim().toLowerCase();

    classroomControllerState.filteredCatalog = classroomControllerState.catalog.filter(item => {
        const matchTrack = track === "all" || item.rutaAcademica === track;
        const matchCareer = career === "all" || item.carrera === career;
        const matchModality = modality === "all" || item.modalidad === modality;
        const matchTier = tier === "all" || item.nivelSuscripcion === tier;

        const searchableText = [
            item.titulo,
            item.descripcion,
            item.materia,
            item.especialista,
            item.carrera
        ].join(" ").toLowerCase();

        const matchSearch = !cleanQuery || searchableText.includes(cleanQuery);

        return matchTrack && matchCareer && matchModality && matchTier && matchSearch;
    });

    renderClassroomCatalogSidebar();
    return classroomControllerState.filteredCatalog;
}

/**
 * Renderiza la lista de tarjetas de clases en el panel izquierdo (`#classroom-catalog-list`).
 */
export function renderClassroomCatalogSidebar() {
    const listEl = document.getElementById("classroom-catalog-list");
    const countBadge = document.getElementById("classroom-catalog-count-badge");
    if (!listEl) return;

    const list = classroomControllerState.filteredCatalog;
    if (countBadge) {
        countBadge.textContent = `${list.length} ${list.length === 1 ? "clase" : "clases"}`;
    }

    if (list.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-10 px-3 space-y-2">
                <span class="material-symbols-outlined text-3xl text-gray-500">videocam_off</span>
                <p class="text-xs text-gray-400 font-mono">
                    No se encontraron clases para este filtro curricular.
                </p>
                <button
                    type="button"
                    id="btn-reset-classroom-filters"
                    class="px-3 py-1.5 rounded-xl bg-primary/15 text-primary text-xs font-extrabold hover:bg-primary hover:text-surface transition-all"
                >
                    Restablecer Filtros
                </button>
            </div>
        `;
        document.getElementById("btn-reset-classroom-filters")?.addEventListener("click", () => {
            const ids = ["classroom-filter-track", "classroom-filter-career", "classroom-filter-modality", "classroom-filter-tier"];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "all";
            });
            const searchEl = document.getElementById("classroom-filter-search");
            if (searchEl) searchEl.value = "";
            filterClassroomsCatalog({ track: "all", career: "all", modality: "all", tier: "all", searchQuery: "" });
        });
        return;
    }

    const activeId = classroomControllerState.activeClass?.id;

    listEl.innerHTML = list.map(cls => {
        const isSelected = cls.id === activeId;
        const isUnlocked = verifyClassroomAccess(cls, { silent: true });
        const isLive = cls.modalidad === "live";

        const tierColor = cls.nivelSuscripcion === "VIP"
            ? "bg-warning/20 text-warning border-warning/40"
            : cls.nivelSuscripcion === "PRO"
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-secondary/20 text-secondary border-secondary/40";

        return `
            <button
                type="button"
                data-select-class-id="${cls.id}"
                class="classroom-catalog-item w-full text-left rounded-xl p-3 border transition-all space-y-1.5 ${
                    isSelected
                        ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                        : "bg-surface border-surface-high hover:border-primary/40"
                }"
            >
                <div class="flex items-center justify-between gap-1.5">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase ${
                        isLive ? "bg-danger/20 text-danger" : "bg-surface-high text-gray-300"
                    }">
                        ${isLive ? "🔴 EN VIVO" : `🎬 ${escapeHtml(cls.duracion || "VOD")}`}
                    </span>
                    <span class="px-1.5 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase ${tierColor}">
                        ${isUnlocked ? "✓" : "🔒"} ${escapeHtml(cls.nivelSuscripcion || "Básico")}
                    </span>
                </div>

                <h4 class="text-xs font-extrabold ${isSelected ? "text-primary" : "text-white"} line-clamp-2 leading-snug">
                    ${escapeHtml(cls.titulo)}
                </h4>

                <div class="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1">
                    <span class="truncate">${escapeHtml(cls.materia)}</span>
                    <span class="shrink-0 text-gray-500">${escapeHtml(cls.especialista)}</span>
                </div>
            </button>
        `;
    }).join("");

    listEl.querySelectorAll(".classroom-catalog-item").forEach(btn => {
        btn.addEventListener("click", () => {
            selectClassroomSession(btn.dataset.selectClassId);
        });
    });
}

// ============================================================================
// 5. SELECCIÓN DE CLASE, VERIFICACIÓN DE SUSCRIPCIÓN Y MONTAJE DEL ESCENARIO
// ============================================================================

/**
 * Selecciona una clase del catálogo, verifica los permisos de suscripción del estudiante
 * y coordina el montaje del escenario VOD/Live, DRM y panel de chat.
 * @param {string} classId
 * @param {Object} [options]
 */
export async function selectClassroomSession(classId, options = {}) {
    const targetClass = classroomControllerState.catalog.find(c => c.id === classId) ||
        classroomControllerState.catalog[0];
    if (!targetClass) return null;

    // 1. Verificar permisos del plan del estudiante (Básico, PRO, VIP o Admin Maestro)
    const hasAccess = verifyClassroomAccess(targetClass, {
        silent: Boolean(options.skipPaywallAlertOnInit)
    });

    if (!hasAccess && !options.skipPaywallAlertOnInit) {
        return null;
    }

    classroomControllerState.activeClass = targetClass;
    renderClassroomCatalogSidebar();

    // 2. Actualizar metadatos y capítulos en la tarjeta central
    renderActiveClassMetadata(targetClass, hasAccess);

    // 3. Conmutar al modo correspondiente ("live" o "vod") y montar el reproductor
    const targetMode = targetClass.modalidad === "live" ? "live" : "vod";
    switchClassroomStageMode(targetMode, { hasAccess });

    // 4. Actualizar marca de agua dinámica anti-grabación DRM
    refreshDRMWatermarkOverlay(targetClass);

    // 5. Sincronizar el panel lateral de Chat en Vivo, Buzón al Especialista y Materiales
    if (typeof ClassroomChat.loadClassroomChatSession === "function") {
        await ClassroomChat.loadClassroomChatSession(targetClass);
    }

    return targetClass;
}

/**
 * Verifica si la suscripción del estudiante actual permite acceder a la clase seleccionada.
 * Las cuentas maestras (`anthonnyvelastegui@gmail.com` y `aavemakaihc@gmail.com`) tienen pase total.
 * @param {Object} classItem
 * @param {Object} [options]
 * @returns {boolean}
 */
export function verifyClassroomAccess(classItem, options = { silent: false }) {
    if (!classItem) return false;
    if (isCurrentMasterAdmin()) return true;

    const requiredLevel = classItem.nivelSuscripcion || "Básico";

    let allowed = false;
    if (typeof canAccessBySubscription === "function") {
        allowed = canAccessBySubscription(requiredLevel);
    } else {
        const currentTier = appState?.currentUserData?.subscriptionLevel || "Básico";
        const rank = { "Básico": 1, "PRO": 2, "VIP": 3 };
        allowed = (rank[currentTier] || 1) >= (rank[requiredLevel] || 1);
    }

    if (!allowed && !options.silent) {
        promptClassroomSubscriptionUpgrade(classItem);
    }

    return allowed;
}

/**
 * Conmuta el escenario central entre el reproductor de Clases Grabadas (`vod`)
 * y la sala interactiva de Transmisión en Vivo (`live`).
 * @param {"vod"|"live"} mode
 * @param {Object} [options]
 */
export function switchClassroomStageMode(mode = "vod", options = {}) {
    const cleanMode = mode === "live" ? "live" : "vod";
    classroomControllerState.activeStageMode = cleanMode;

    const vodMount = document.getElementById("classroom-vod-stage-mount");
    const liveMount = document.getElementById("classroom-live-stage-mount");
    const vodBtn = document.getElementById("btn-stage-mode-vod");
    const liveBtn = document.getElementById("btn-stage-mode-live");

    if (vodBtn && liveBtn) {
        if (cleanMode === "vod") {
            vodBtn.className = "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all bg-primary text-surface flex items-center gap-1.5";
            liveBtn.className = "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-gray-400 hover:text-white flex items-center gap-1.5";
        } else {
            liveBtn.className = "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all bg-danger text-white flex items-center gap-1.5";
            vodBtn.className = "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-gray-400 hover:text-white flex items-center gap-1.5";
        }
    }

    const activeClass = classroomControllerState.activeClass;
    const hasAccess = options.hasAccess !== undefined
        ? options.hasAccess
        : verifyClassroomAccess(activeClass, { silent: true });

    if (cleanMode === "live") {
        vodMount?.classList.add("hidden");
        liveMount?.classList.remove("hidden");
        pauseActiveVODVideo();
        mountLiveStageSubmodule(liveMount, activeClass, hasAccess);
    } else {
        liveMount?.classList.add("hidden");
        vodMount?.classList.remove("hidden");
        mountVODStageSubmodule(vodMount, activeClass, hasAccess);
    }
}

/**
 * Actualiza los títulos, insignias y botones de capítulos clínicos debajo del reproductor.
 * @param {Object} classItem
 * @param {boolean} hasAccess
 */
function renderActiveClassMetadata(classItem, hasAccess = true) {
    const modBadge = document.getElementById("active-class-modality-badge");
    const subjBadge = document.getElementById("active-class-subject-badge");
    const tierBadge = document.getElementById("active-class-tier-badge");
    const titleEl = document.getElementById("active-class-title");
    const descEl = document.getElementById("active-class-description");
    const specEl = document.getElementById("active-class-specialist");
    const durEl = document.getElementById("active-class-duration");
    const chaptersBar = document.getElementById("active-class-chapters-bar");

    if (modBadge) {
        modBadge.textContent = classItem.modalidad === "live" ? "🔴 EN VIVO INTERACTIVO" : "🎬 CLASE GRABADA HD";
    }
    if (subjBadge) subjBadge.textContent = `${classItem.materia} • ${(classItem.carrera || "medicina").toUpperCase()}`;
    if (tierBadge) tierBadge.textContent = `Plan ${classItem.nivelSuscripcion || "Básico"}`;
    if (titleEl) titleEl.textContent = classItem.titulo;
    if (descEl) descEl.textContent = classItem.descripcion;
    if (specEl) specEl.textContent = classItem.especialista || "Dr. Especialista Makai";
    if (durEl) durEl.textContent = classItem.duracion || "45:00";

    if (chaptersBar) {
        const chapters = Array.isArray(classItem.capitulos) ? classItem.capitulos : [];
        if (chapters.length === 0) {
            chaptersBar.innerHTML = `
                <span class="text-xs text-gray-500 font-mono">
                    Reproducción continua sin marcadores intermedios.
                </span>
            `;
        } else {
            chaptersBar.innerHTML = chapters.map(ch => `
                <button
                    type="button"
                    data-chapter-sec="${ch.segundo || 0}"
                    class="classroom-chapter-btn px-3 py-1.5 rounded-xl bg-surface-container hover:bg-primary/15 border border-surface-high hover:border-primary text-xs text-gray-200 hover:text-white font-bold transition-all flex items-center gap-1.5"
                >
                    <span class="text-primary font-mono text-[11px]">▶ ${escapeHtml(ch.tiempo || "00:00")}</span>
                    <span>${escapeHtml(ch.titulo)}</span>
                </button>
            `).join("");

            chaptersBar.querySelectorAll(".classroom-chapter-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!hasAccess) {
                        promptClassroomSubscriptionUpgrade(classItem);
                        return;
                    }
                    seekActiveClassroomVideo(Number(btn.dataset.chapterSec || 0));
                });
            });
        }
    }
}

// ============================================================================
// 6. COORDINACIÓN CON SUBCOMPONENTES: VOD, LIVE Y DRM (CON RESPALDO NATIVO)
// ============================================================================

/**
 * Monta el reproductor de Clases Grabadas delegando en `classroom.vod.js` o activando
 * el reproductor HTML5 seguro de respaldo con `#classroom-vod-video`.
 * @param {HTMLElement} mountEl
 * @param {Object} classItem
 * @param {boolean} hasAccess
 */
function mountVODStageSubmodule(mountEl, classItem, hasAccess) {
    if (!mountEl || !classItem) return;

    if (!hasAccess) {
        renderLockedStageOverlay(mountEl, classItem);
        return;
    }

    // Si `classroom.vod.js` ya está programado y exporta su inicializador, delegar en él
    const externalVodRender = ClassroomVOD.renderVODPlayer || ClassroomVOD.initClassroomVOD || ClassroomVOD.loadVODSession;
    if (typeof externalVodRender === "function") {
        externalVodRender(classItem, mountEl);
        return;
    }

    // Reproductor VOD nativo de respaldo conectado al ID `#classroom-vod-video` requerido por `classroom.chat.js`
    mountEl.innerHTML = `
        <div class="relative w-full h-full bg-black flex items-center justify-center">
            <video
                id="classroom-vod-video"
                class="w-full h-full object-contain bg-black"
                controls
                controlsList="nodownload"
                disablePictureInPicture
                oncontextmenu="return false;"
                poster="${escapeHtml(classItem.portadaUrl || "")}"
            >
                <source src="${escapeHtml(classItem.videoUrl)}" type="video/mp4">
                Tu navegador no soporta reproducción de video HTML5.
            </video>
        </div>
    `;
}

/**
 * Monta el escenario de Videollamada en Vivo delegando en `classroom.live.js`
 * o mostrando la sala incrustada de respaldo (Google Meet / Zoom SDK).
 * @param {HTMLElement} mountEl
 * @param {Object} classItem
 * @param {boolean} hasAccess
 */
function mountLiveStageSubmodule(mountEl, classItem, hasAccess) {
    if (!mountEl || !classItem) return;

    if (!hasAccess) {
        renderLockedStageOverlay(mountEl, classItem);
        return;
    }

    const externalLiveRender = ClassroomLive.renderLiveClassroom || ClassroomLive.initClassroomLive || ClassroomLive.mountLiveSession;
    if (typeof externalLiveRender === "function") {
        externalLiveRender(classItem, mountEl);
        return;
    }

    // Escenario en vivo nativo de respaldo
    mountEl.innerHTML = `
        <div
            class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-cover bg-center relative"
            style="background-image: linear-gradient(rgba(5, 9, 15, 0.88), rgba(5, 9, 15, 0.95)), url('${escapeHtml(classItem.fondoTransmisionUrl || "")}');"
        >
            <div class="max-w-lg space-y-4">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-danger/20 border border-danger/40 text-danger text-xs font-mono font-extrabold">
                    <span class="w-2.5 h-2.5 rounded-full bg-danger animate-ping"></span>
                    <span>SALA INTERACTIVA EN VIVO • ${escapeHtml((classItem.liveProvider || "MEET / ZOOM").toUpperCase())}</span>
                </div>
                <h3 class="text-lg md:text-xl font-extrabold text-white">
                    ${escapeHtml(classItem.titulo)}
                </h3>
                <p class="text-xs text-gray-300 leading-relaxed">
                    Docente en sala: <strong class="text-primary">${escapeHtml(classItem.especialista)}</strong> • Horario: <span class="font-mono text-secondary">${escapeHtml(classItem.fechaSesion || "En directo")}</span>
                </p>
                <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                        type="button"
                        id="btn-join-embedded-live-stream"
                        class="px-5 py-2.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)] flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-base">videocam</span>
                        <span>Conectar Transmisión en Pantalla</span>
                    </button>
                    <button
                        type="button"
                        id="btn-switch-back-to-vod"
                        class="px-4 py-2.5 rounded-xl bg-surface-high text-gray-200 hover:text-white font-bold text-xs transition-all"
                    >
                        Ver Grabación de Respaldo (VOD)
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("btn-switch-back-to-vod")?.addEventListener("click", () => {
        switchClassroomStageMode("vod");
    });

    document.getElementById("btn-join-embedded-live-stream")?.addEventListener("click", () => {
        switchClassroomStageMode("vod");
        const videoEl = document.getElementById("classroom-vod-video");
        videoEl?.play?.().catch(() => {});
    });
}

/**
 * Inicializa el escudo de protección anti-grabación delegando en `classroom.drm.js`
 * o activando los candados nativos de interfaz y marca de agua dinámica.
 */
function initDRMSubmodule() {
    const externalDRMInit = ClassroomDRM.initClassroomDRM || ClassroomDRM.initDRMProtection;
    if (typeof externalDRMInit === "function") {
        externalDRMInit({
            viewportId: "classroom-player-viewport",
            watermarkId: "classroom-drm-watermark-layer",
            curtainId: "classroom-drm-blackout-curtain"
        });
        return;
    }

    // Respaldo nativo anti-captura y bloqueo de clic derecho sobre el reproductor
    const viewport = document.getElementById("classroom-player-viewport");
    viewport?.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keyup", (e) => {
        if (e.key === "PrintScreen") {
            activateDRMBlackoutCurtain();
        }
    });
}

/**
 * Pinta una marca de agua forense dinámica sobre el video con el correo/UID del alumno
 * para disuadir grabaciones externas de pantalla.
 * @param {Object} classItem
 */
function refreshDRMWatermarkOverlay(classItem) {
    const layer = document.getElementById("classroom-drm-watermark-layer");
    if (!layer) return;

    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "licencia@makai.ec";
    const uidShort = (auth?.currentUser?.uid || "MAKAI-DRM").slice(0, 8).toUpperCase();

    layer.innerHTML = `
        <div class="w-full h-full flex flex-col justify-between p-4 opacity-25 select-none">
            <div class="flex justify-between text-[10px] font-mono text-white">
                <span>MAKAI DRM • ${escapeHtml(email)}</span>
                <span>ID: ${escapeHtml(uidShort)}</span>
            </div>
            <div class="self-center text-xs font-mono text-white/40 rotate-[-12deg]">
                PROPIEDAD INTELECTUAL MAKAIACADEMY • ${escapeHtml(email)}
            </div>
            <div class="flex justify-between text-[10px] font-mono text-white">
                <span>${escapeHtml(classItem?.id || "AULA-VIRTUAL")}</span>
                <span>PROHIBIDA SU REPRODUCCIÓN</span>
            </div>
        </div>
    `;
}

/**
 * Oscurece el reproductor y pausa el video cuando se detecta intento de captura.
 */
function activateDRMBlackoutCurtain() {
    pauseActiveVODVideo();
    const curtain = document.getElementById("classroom-drm-blackout-curtain");
    curtain?.classList.remove("hidden");
}

/**
 * Muestra la pantalla de bloqueo por suscripción dentro del reproductor cuando
 * un alumno con Plan Básico intenta abrir una clase exclusiva PRO o VIP.
 * @param {HTMLElement} mountEl
 * @param {Object} classItem
 */
function renderLockedStageOverlay(mountEl, classItem) {
    const requiredTier = classItem.nivelSuscripcion || "PRO";
    const targetPlanParam = requiredTier === "VIP" ? "vip" : "pro_anual";

    mountEl.innerHTML = `
        <div class="w-full h-full bg-[#060a10] flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-warning/15 border border-warning/40 flex items-center justify-center text-warning">
                <span class="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div class="max-w-md space-y-1.5">
                <span class="px-2.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-mono font-extrabold uppercase">
                    Contenido Exclusivo • Plan ${escapeHtml(requiredTier)}
                </span>
                <h4 class="text-base font-extrabold text-white">
                    ${escapeHtml(classItem.titulo)}
                </h4>
                <p class="text-xs text-gray-400">
                    Actualiza tu expediente a Makai ${escapeHtml(requiredTier)} para desbloquear todas las clases magistrales, simulacros ilimitados y material descargable de apoyo.
                </p>
            </div>
            <a
                href="registro.html?plan=${targetPlanParam}&pago=qr"
                class="px-5 py-2.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)]"
            >
                Desbloquear con Plan ${escapeHtml(requiredTier)}
            </a>
        </div>
    `;
}

/**
 * Despliega el modal Freemium o redirige a la pasarela de activación bancaria.
 * @param {Object} classItem
 */
function promptClassroomSubscriptionUpgrade(classItem) {
    const requiredTier = classItem?.nivelSuscripcion || "PRO";
    const freemiumModal = document.getElementById("freemium-modal");
    if (freemiumModal) {
        freemiumModal.classList.remove("hidden");
        freemiumModal.classList.add("flex");
        return;
    }

    const targetPlanParam = requiredTier === "VIP" ? "vip" : "pro_anual";
    if (confirm(`Esta sesión ("${classItem?.titulo}") requiere el Plan ${requiredTier}. ¿Deseas abrir la pasarela de activación?`)) {
        window.location.href = `registro.html?plan=${targetPlanParam}&pago=qr`;
    }
}

// ============================================================================
// 7. CONTROL DE TIEMPO DEL VIDEO Y MODAL DOCENTE PARA ADMINISTRADORES MAESTROS
// ============================================================================

/**
 * Obtiene el segundo actual del reproductor `#classroom-vod-video`.
 * Pasado como callback `getVideoCurrentTime` hacia `classroom.chat.js`.
 * @returns {number}
 */
export function getActiveVideoTimeSeconds() {
    if (typeof ClassroomVOD.getCurrentVODTimeSeconds === "function") {
        return Number(ClassroomVOD.getCurrentVODTimeSeconds()) || 0;
    }

    const videoEl = document.getElementById("classroom-vod-video");
    if (videoEl && typeof videoEl.currentTime === "number") {
        return Math.floor(videoEl.currentTime);
    }
    return 0;
}

/**
 * Salta al segundo indicado del video activo cuando el estudiante hace clic en un
 * capítulo o en un timestamp (`mm:ss`) del chat en vivo / buzón del especialista.
 * @param {number} seconds
 */
export function seekActiveClassroomVideo(seconds = 0) {
    const safeSec = Math.max(0, Math.floor(Number(seconds) || 0));

    if (classroomControllerState.activeStageMode !== "vod") {
        switchClassroomStageMode("vod");
    }

    if (typeof ClassroomVOD.seekVODVideo === "function") {
        ClassroomVOD.seekVODVideo(safeSec);
        return;
    }

    const videoEl = document.getElementById("classroom-vod-video");
    if (videoEl) {
        videoEl.currentTime = safeSec;
        videoEl.play?.().catch(() => {});
    }
}

/**
 * Pausa el reproductor VOD si está activo.
 */
function pauseActiveVODVideo() {
    const videoEl = document.getElementById("classroom-vod-video");
    videoEl?.pause?.();
}

/**
 * Exclusivo para Administradores Maestros (`anthonnyvelastegui@gmail.com` y `aavemakaihc@gmail.com`):
 * Abre un modal para publicar una nueva clase grabada o sesión en vivo en Cloud Firestore.
 */
export function openAdminCreateClassroomModal() {
    if (!isCurrentMasterAdmin()) return;

    let modal = document.getElementById("admin-create-classroom-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "admin-create-classroom-modal";
        modal.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-surface-container border border-primary/50 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        Bóveda Docente • Administrador Maestro
                    </span>
                    <h3 class="text-sm font-extrabold text-white">
                        Publicar Nueva Aula Virtual (VOD / En Vivo)
                    </h3>
                </div>
                <button type="button" id="btn-close-admin-classroom-modal" class="text-gray-400 hover:text-white text-sm font-bold">
                    ✕
                </button>
            </div>

            <form id="form-admin-new-classroom" class="p-4 space-y-3 text-xs">
                <input
                    type="text"
                    id="new-class-title"
                    placeholder="Título de la clase (ej. Magistral CACES • Manejo de Cetoacidosis Diabética)"
                    class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-white outline-none"
                    required
                >
                <div class="grid grid-cols-2 gap-2.5">
                    <select id="new-class-track" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none">
                        <option value="caces">Ruta: CACES Oficial</option>
                        <option value="carrera">Ruta: Semestres de Carrera</option>
                    </select>
                    <select id="new-class-career" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none">
                        <option value="medicina">Medicina</option>
                        <option value="enfermeria">Enfermería</option>
                        <option value="odontologia">Odontología</option>
                        <option value="obstetricia">Obstetricia</option>
                    </select>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                    <input
                        type="text"
                        id="new-class-subject"
                        placeholder="Materia (ej. Pediatría)"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none"
                        required
                    >
                    <select id="new-class-modality" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none">
                        <option value="vod">🎬 Grabada (VOD)</option>
                        <option value="live">🔴 En Vivo (Live)</option>
                    </select>
                    <select id="new-class-tier" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none">
                        <option value="PRO">Plan PRO</option>
                        <option value="VIP">Plan Élite VIP</option>
                        <option value="Básico">Plan Básico</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                    <input
                        type="text"
                        id="new-class-specialist"
                        placeholder="Docente (ej. Dr. Especialista Makai)"
                        value="Dr. Especialista Makai"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none"
                    >
                    <input
                        type="text"
                        id="new-class-duration"
                        placeholder="Duración (ej. 55:00)"
                        value="50:00"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-white outline-none"
                    >
                </div>
                <input
                    type="text"
                    id="new-class-video-url"
                    placeholder="URL de Video MP4 en Cloud Storage o enlace de Sala Meet/Zoom"
                    value="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-white outline-none"
                    required
                >
                <textarea
                    id="new-class-desc"
                    rows="2"
                    placeholder="Descripción clínica de los temas abordados en la sesión..."
                    class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-white outline-none resize-none"
                    required
                ></textarea>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        id="btn-cancel-admin-classroom"
                        class="px-4 py-2 rounded-xl bg-surface-high text-gray-300 font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 rounded-xl bg-secondary text-surface font-extrabold"
                    >
                        Guardar y Publicar Aula
                    </button>
                </div>
            </form>
        </div>
    `;

    const closeModal = () => modal.remove();
    document.getElementById("btn-close-admin-classroom-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-admin-classroom")?.addEventListener("click", closeModal);

    document.getElementById("form-admin-new-classroom")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newClassObj = {
            id: `aula_${Date.now()}`,
            titulo: document.getElementById("new-class-title")?.value?.trim() || "Nueva Sesión Clínica",
            rutaAcademica: document.getElementById("new-class-track")?.value || "caces",
            carrera: document.getElementById("new-class-career")?.value || "medicina",
            etapa: "caces",
            materia: document.getElementById("new-class-subject")?.value?.trim() || "Medicina Interna",
            modalidad: document.getElementById("new-class-modality")?.value || "vod",
            nivelSuscripcion: document.getElementById("new-class-tier")?.value || "PRO",
            especialista: document.getElementById("new-class-specialist")?.value?.trim() || "Dr. Especialista Makai",
            duracion: document.getElementById("new-class-duration")?.value?.trim() || "50:00",
            videoUrl: document.getElementById("new-class-video-url")?.value?.trim() || "",
            descripcion: document.getElementById("new-class-desc")?.value?.trim() || "",
            portadaUrl: `${CLASSROOM_ASSET_PATHS.COVERS}portada-medicina-interna-caces.jpg`,
            fondoTransmisionUrl: `${CLASSROOM_ASSET_PATHS.BACKGROUNDS}fondo-estandar-aula.jpg`,
            fechaSesion: new Date().toISOString().slice(0, 10),
            drmProtected: true,
            capitulos: [{ titulo: "01. Inicio de la Sesión Magistral", segundo: 0, tiempo: "00:00" }],
            materiales: []
        };

        classroomControllerState.catalog.unshift(newClassObj);
        filterClassroomsCatalog(classroomControllerState.filters);
        await selectClassroomSession(newClassObj.id);

        if (db) {
            try {
                await setDoc(doc(db, SAFE_COLLECTIONS.CLASSROOMS, newClassObj.id), newClassObj);
            } catch (err) {
                // Conservado en memoria local
            }
        }

        closeModal();
    });
}

// ============================================================================
// 8. ESCUCHADORES GLOBALES Y UTILIDADES INTERNAS
// ============================================================================

/**
 * Escucha cambios curriculares emitidos por `router.spa.js` (`makai:curriculumChanged`)
 * para filtrar automáticamente el catálogo de clases de la carrera seleccionada.
 */
function bindGlobalClassroomEvents() {
    window.addEventListener("makai:curriculumChanged", (event) => {
        const detail = event.detail || {};
        if (!classroomControllerState.initialized) return;

        const nextCareer = detail.career || appState?.currentCareer || "all";
        const careerSelect = document.getElementById("classroom-filter-career");
        if (careerSelect && Array.from(careerSelect.options).some(opt => opt.value === nextCareer)) {
            careerSelect.value = nextCareer;
        }

        filterClassroomsCatalog({
            career: nextCareer
        });
    });
}

/**
 * Registra de forma silenciosa la actividad del alumno en el Aula Virtual.
 * @param {string} actionType
 * @param {Object} metadata
 */
async function registerStudentClassroomActivity(actionType, metadata = {}) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return;

    try {
        await updateDoc(doc(db, COLLECTIONS?.USERS || "usuarios", uid), {
            ultimaActividadAula: {
                tipo: actionType,
                ...metadata,
                fecha: new Date().toISOString()
            }
        });
    } catch (e) {
        // Silencioso en modo offline
    }
}

/**
 * Verifica si el usuario actual posee privilegios de Administrador Maestro.
 * @returns {boolean}
 */
function isCurrentMasterAdmin() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(email) || appState?.currentUserData?.rol === "admin";
}

/**
 * Escapa caracteres HTML para prevenir inyecciones XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
