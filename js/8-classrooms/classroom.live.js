// ============================================================================
// ARCHIVO: js/8-classrooms/classroom.live.js
// DESCRIPCIÓN: Subcomponente de Transmisiones Interactivas en Vivo, Integración
//              con Google Meet / Zoom Video SDK / Stream Incrustado, Fila de
//              Participación (Levantar la Mano), Sondeos Clínicos en Tiempo Real
//              y Consola de Dirección Docente para Aulas Virtuales y Mentoría VIP.
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
    canAccessBySubscription
} from "../2-core/state.store.js";

import * as ClassroomChat from "./classroom.chat.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA (assets/8-multimedia-aulas/) Y ESTADO INTERNO
// ============================================================================

const SAFE_COLLECTIONS = Object.freeze({
    LIVE_SESSIONS: COLLECTIONS?.CLASSROOM_LIVE || "sesiones_vivo_aulas",
    LIVE_ATTENDANCE: COLLECTIONS?.CLASSROOM_ATTENDANCE || "asistencia_aulas_vivo",
    CLASSROOMS: COLLECTIONS?.CLASSROOMS || "aulas_virtuales"
});

export const LIVE_ASSET_PATHS = Object.freeze({
    DEFAULT_BG: "assets/8-multimedia-aulas/fondos-transmision/fondo-estandar-aula.jpg",
    VIP_BG: "assets/8-multimedia-aulas/fondos-transmision/fondo-transmision-vip.jpg",
    DEFAULT_COVER: "assets/8-multimedia-aulas/portadas-clases/portada-mentoria-elite-vip.jpg"
});

/**
 * Reacciones rápidas de escenario en vivo (animación flotante + sincronización).
 */
export const LIVE_STAGE_REACTIONS = Object.freeze([
    { id: "understand", emoji: "🧠", label: "Concepto Claro" },
    { id: "key_pearl", emoji: "💎", label: "Perla CACES" },
    { id: "critical", emoji: "⚡", label: "Dato Crítico" },
    { id: "applause", emoji: "🩺", label: "Excelente Caso" }
]);

/**
 * Sondeo clínico semilla en vivo para demostración inmediata e interacción docente.
 */
const DEFAULT_LIVE_CLINICAL_POLL = {
    id: "poll_caces_live_01",
    active: true,
    question: "Reactivo en Vivo • Paciente gestante de 34 semanas con TA 168/114 mmHg, cefalea intensa y escotomas. ¿Cuál es la conducta farmacológica inmediata según Clave Azul MSP?",
    options: [
        { key: "A", text: "Sulfato de Magnesio 4 g IV en impregnación + Nifedipino 10 mg VO", votes: 18 },
        { key: "B", text: "Observación en sala de espera durante 4 horas y control ambulatorio", votes: 1 },
        { key: "C", text: "IECA (Enalapril 20 mg VO) de primera línea como monoterapia", votes: 2 },
        { key: "D", text: "Alta médica con restricción absoluta de sodio en la dieta", votes: 0 }
    ],
    correctKey: "A",
    createdBy: "Dr. Especialista Makai"
};

/**
 * Estado reactivo del subcomponente de transmisión en vivo.
 */
export const liveClassroomState = {
    initialized: false,
    mountContainer: null,
    activeClass: null,
    viewMode: "lobby", // "lobby" | "stream_stage" | "sdk_iframe" | "whiteboard"
    broadcastStatus: "en_vivo", // "en_vivo" | "sala_espera" | "finalizada"
    liveProvider: "zoom_sdk", // "zoom_sdk" | "meet" | "hls_stream"
    connectedStudentsCount: 24,
    elapsedSeconds: 0,
    isHandRaised: false,
    handRaiseQueue: [
        {
            id: "hr_seed_1",
            studentName: "Md. Carlos A. (Internado)",
            studentEmail: "carlos@makai.ec",
            tier: "VIP",
            topic: "Duda sobre dosis de mantenimiento en insuficiencia renal",
            timestamp: "Hace 2 min"
        }
    ],
    activePoll: { ...DEFAULT_LIVE_CLINICAL_POLL },
    userVotedPollOption: null,
    showPollOverlay: false,
    micMuted: true,
    camMuted: true,
    broadcastChannel: null,
    timerIntervalId: null,
    whiteboardCtx: null,
    isDrawingWhiteboard: false
};

// ============================================================================
// 2. PUNTOS DE ENTRADA PRINCIPALES (INVOCADOS POR classroom.controller.js)
// ============================================================================

/**
 * Monta y renderiza la Sala Interactiva en Vivo dentro del contenedor `#classroom-live-stage-mount`.
 * Invocado directamente por `mountLiveStageSubmodule()` en `classroom.controller.js`.
 * @param {Object} classItem - Objeto de la clase activa seleccionada en el catálogo.
 * @param {HTMLElement|string} [mountEl] - Contenedor DOM donde renderizar la transmisión.
 */
export async function renderLiveClassroom(classItem = {}, mountEl = null) {
    const resolvedMount = resolveLiveStageMountElement(mountEl);
    if (!resolvedMount) return null;

    liveClassroomState.mountContainer = resolvedMount;
    liveClassroomState.activeClass = normalizeLiveClassItem(classItem);
    liveClassroomState.liveProvider = liveClassroomState.activeClass.liveProvider;

    // 1. Inicializar canal de tiempo real entre pestañas y temporizador de sesión
    initLiveBroadcastChannel();
    startLiveSessionTimer();

    // 2. Sincronizar estado de la sala en vivo desde Cloud Firestore
    await syncLiveSessionStateFromFirestore(liveClassroomState.activeClass.id);

    // 3. Registrar asistencia del estudiante en la sesión en vivo
    registerStudentLiveAttendance(liveClassroomState.activeClass);

    // 4. Construir la interfaz visual del escenario en vivo
    renderLiveStageLayout();

    liveClassroomState.initialized = true;
    return liveClassroomState;
}

// Alias oficiales requeridos por `classroom.controller.js`
export const initClassroomLive = renderLiveClassroom;
export const mountLiveSession = renderLiveClassroom;

/**
 * Localiza el contenedor `#classroom-live-stage-mount` dentro de `#view-classrooms`.
 * @param {HTMLElement|string|null} customMount
 * @returns {HTMLElement|null}
 */
function resolveLiveStageMountElement(customMount) {
    if (customMount instanceof HTMLElement) return customMount;
    if (typeof customMount === "string") {
        const found = document.getElementById(customMount) || document.querySelector(customMount);
        if (found) return found;
    }
    return (
        document.getElementById("classroom-live-stage-mount") ||
        document.getElementById("classroom-player-viewport")
    );
}

/**
 * Normaliza los metadatos de la clase activa garantizando valores seguros para transmisión en vivo.
 * @param {Object} rawClass
 * @returns {Object}
 */
function normalizeLiveClassItem(rawClass = {}) {
    const isVip = (rawClass.nivelSuscripcion || "VIP") === "VIP";
    return {
        id: rawClass.id || "aula_vip_mentoria_en_vivo_03",
        titulo: rawClass.titulo || "Mentoría Élite VIP en Vivo • Simulacro Clínico CACES Comentado",
        descripcion: rawClass.descripcion || "Sesión interactiva en directo con resolución de casos clínicos y ronda abierta de preguntas con el especialista.",
        carrera: rawClass.carrera || appState?.currentCareer || "medicina",
        etapa: rawClass.etapa || "caces",
        materia: rawClass.materia || "Medicina Interna",
        especialista: rawClass.especialista || "Director Académico Makai",
        nivelSuscripcion: rawClass.nivelSuscripcion || "VIP",
        fechaSesion: rawClass.fechaSesion || "Hoy • 20:00 ECT",
        duracion: rawClass.duracion || "EN VIVO • 90 min",
        portadaUrl: rawClass.portadaUrl || LIVE_ASSET_PATHS.DEFAULT_COVER,
        fondoTransmisionUrl: rawClass.fondoTransmisionUrl || (isVip ? LIVE_ASSET_PATHS.VIP_BG : LIVE_ASSET_PATHS.DEFAULT_BG),
        videoUrl: rawClass.videoUrl || "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        liveProvider: rawClass.liveProvider || "zoom_sdk",
        liveRoomUrl: rawClass.liveRoomUrl || "https://meet.google.com/",
        liveMeetingId: rawClass.liveMeetingId || "MAKAI-VIP-2026"
    };
}

// ============================================================================
// 3. RENDERIZADO PRINCIPAL DEL ESCENARIO EN VIVO (LOBBY / STREAM / SDK / PIZARRA)
// ============================================================================

/**
 * Construye el escenario completo de la Sala en Vivo según el `viewMode` activo:
 * - Barra Superior de Telemetría en Vivo (Estado, ID de Sala, Contador de Alumnos, Reloj).
 * - Lienzo Central (`lobby` | `stream_stage` | `sdk_iframe` | `whiteboard`).
 * - Superposición de Sondeo Clínico en Vivo y Fila de Manos Levantadas.
 * - Barra Inferior de Controles del Estudiante y Consola de Dirección Docente (Admin).
 */
export function renderLiveStageLayout() {
    const mountEl = liveClassroomState.mountContainer;
    const cls = liveClassroomState.activeClass;
    if (!mountEl || !cls) return;

    const isAdmin = isCurrentUserMasterAdmin();
    const statusBadge = getBroadcastStatusBadgeConfig(liveClassroomState.broadcastStatus);

    mountEl.innerHTML = `
        <div class="relative w-full h-full bg-[#04070c] flex flex-col justify-between overflow-hidden select-none text-white">

            <!-- ============================================================ -->
            <!-- 1. BARRA SUPERIOR DE TELEMETRÍA DE TRANSMISIÓN EN VIVO       -->
            <!-- ============================================================ -->
            <div class="relative z-20 px-3.5 py-2.5 bg-black/75 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusBadge.classes} text-[10px] font-mono font-extrabold uppercase tracking-wider">
                        <span class="w-2 h-2 rounded-full ${statusBadge.dotClass}"></span>
                        <span>${escapeHtml(statusBadge.label)}</span>
                    </span>

                    <span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-high/90 border border-white/10 text-[10px] font-mono text-gray-300">
                        <span class="material-symbols-outlined text-xs text-primary">hub</span>
                        <span>ID: ${escapeHtml(cls.liveMeetingId)}</span>
                    </span>

                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 border border-primary/30 text-[10px] font-mono text-primary font-bold">
                        <span class="material-symbols-outlined text-xs">groups</span>
                        <span id="live-connected-counter">${liveClassroomState.connectedStudentsCount}</span>
                        <span class="hidden md:inline">en sala</span>
                    </span>
                </div>

                <!-- Selector Rápido de Vista del Escenario en Vivo -->
                <div class="flex items-center gap-1.5">
                    <div class="inline-flex bg-surface/90 p-0.5 rounded-xl border border-white/10 text-[10px] font-extrabold">
                        <button
                            type="button"
                            data-live-view-mode="lobby"
                            class="live-view-mode-btn px-2 py-1 rounded-lg transition-all ${
                                liveClassroomState.viewMode === "lobby"
                                    ? "bg-primary text-surface"
                                    : "text-gray-300 hover:text-white"
                            }"
                        >
                            Antesala
                        </button>
                        <button
                            type="button"
                            data-live-view-mode="stream_stage"
                            class="live-view-mode-btn px-2 py-1 rounded-lg transition-all ${
                                liveClassroomState.viewMode === "stream_stage"
                                    ? "bg-primary text-surface"
                                    : "text-gray-300 hover:text-white"
                            }"
                        >
                            Transmisión HD
                        </button>
                        <button
                            type="button"
                            data-live-view-mode="whiteboard"
                            class="live-view-mode-btn px-2 py-1 rounded-lg transition-all ${
                                liveClassroomState.viewMode === "whiteboard"
                                    ? "bg-primary text-surface"
                                    : "text-gray-300 hover:text-white"
                            }"
                        >
                            Pizarra Clínica
                        </button>
                    </div>

                    <span id="live-elapsed-clock" class="px-2 py-1 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono text-secondary font-bold">
                        ${formatSecondsToHHMMSS(liveClassroomState.elapsedSeconds)}
                    </span>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- 2. CUERPO CENTRAL DEL ESCENARIO EN VIVO                      -->
            <!-- ============================================================ -->
            <div id="live-stage-central-body" class="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
                ${renderCentralStageByViewMode(cls, isAdmin)}

                <!-- Capa de Reacciones Flotantes en Tiempo Real -->
                <div id="live-floating-reactions-layer" class="pointer-events-none absolute inset-0 z-20 overflow-hidden"></div>

                <!-- Superposición de Sondeo Clínico Activo (Live Poll) -->
                ${liveClassroomState.showPollOverlay ? renderLivePollOverlayHTML(isAdmin) : ""}
            </div>

            <!-- ============================================================ -->
            <!-- 3. BARRA INFERIOR DE PARTICIPACIÓN Y CONTROL EN VIVO         -->
            <!-- ============================================================ -->
            <div class="relative z-20 px-3.5 py-2.5 bg-black/85 backdrop-blur-md border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <!-- Reacciones Rápidas + Botón Levantar la Mano -->
                <div class="flex items-center gap-1.5 overflow-x-auto">
                    <button
                        type="button"
                        id="btn-live-raise-hand"
                        class="px-3 py-1.5 rounded-xl font-extrabold text-[11px] flex items-center gap-1.5 transition-all shrink-0 ${
                            liveClassroomState.isHandRaised
                                ? "bg-warning text-surface shadow-[0_0_15px_rgba(255,171,0,0.4)]"
                                : "bg-surface-high hover:bg-warning/20 text-gray-200 hover:text-warning border border-white/10"
                        }"
                    >
                        <span class="material-symbols-outlined text-sm">front_hand</span>
                        <span>${liveClassroomState.isHandRaised ? "Mano Levantada (En Fila)" : "Levantar Mano"}</span>
                        <span class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
                            ${liveClassroomState.handRaiseQueue.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        id="btn-live-toggle-poll"
                        class="px-2.5 py-1.5 rounded-xl bg-surface-high hover:bg-primary/20 border border-white/10 hover:border-primary/40 text-[11px] font-bold text-primary flex items-center gap-1 transition-all shrink-0"
                    >
                        <span class="material-symbols-outlined text-sm">poll</span>
                        <span>Reactivo en Vivo</span>
                    </button>

                    <div class="hidden md:flex items-center gap-1 pl-1 border-l border-white/10">
                        ${LIVE_STAGE_REACTIONS.map(r => `
                            <button
                                type="button"
                                data-live-stage-reaction="${r.id}"
                                class="live-stage-reaction-btn px-2 py-1 rounded-lg bg-surface/80 hover:bg-primary/20 border border-white/5 text-[11px] transition-all"
                                title="Reacción en vivo: ${r.label}"
                            >
                                ${r.emoji}
                            </button>
                        `).join("")}
                    </div>
                </div>

                <!-- Botones de Acción de Sala / Conmutación a VOD / Consola Docente -->
                <div class="flex items-center gap-1.5 shrink-0">
                    ${isAdmin ? `
                        <button
                            type="button"
                            id="btn-live-admin-console"
                            class="px-2.5 py-1.5 rounded-xl bg-secondary/20 hover:bg-secondary text-secondary hover:text-surface border border-secondary/40 text-[11px] font-mono font-extrabold transition-all flex items-center gap-1"
                            title="Abrir consola de control de transmisión (Solo Admin Maestro)"
                        >
                            <span class="material-symbols-outlined text-sm">tune</span>
                            <span class="hidden sm:inline">Control Docente</span>
                        </button>
                    ` : ""}

                    <button
                        type="button"
                        id="btn-switch-back-to-vod"
                        class="px-3 py-1.5 rounded-xl bg-surface-high hover:bg-surface text-gray-300 hover:text-white border border-white/10 text-[11px] font-bold transition-all flex items-center gap-1"
                    >
                        <span class="material-symbols-outlined text-sm">movie</span>
                        <span>Respaldo VOD</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    bindLiveStageEvents();

    if (liveClassroomState.viewMode === "whiteboard") {
        initClinicalWhiteboardCanvas();
    }
}

/**
 * Renderiza el contenido interior del escenario según el modo de visualización seleccionado:
 * `lobby` (Antesala interactiva), `stream_stage` (Transmisión en pantalla de baja latencia)
 * o `whiteboard` (Pizarra clínica de esquemas y algoritmos en vivo).
 * @param {Object} cls
 * @param {boolean} isAdmin
 * @returns {string}
 */
function renderCentralStageByViewMode(cls, isAdmin) {
    // MODO 1: TRANSMISIÓN EN PANTALLA (STREAM DE BAJA LATENCIA / VIDEO EN DIRECTO)
    if (liveClassroomState.viewMode === "stream_stage") {
        return `
            <div class="relative w-full h-full bg-black flex items-center justify-center">
                <video
                    id="classroom-live-video-stream"
                    class="w-full h-full object-contain bg-black"
                    autoplay
                    playsinline
                    controls
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    oncontextmenu="return false;"
                    poster="${escapeHtml(cls.portadaUrl)}"
                >
                    <source src="${escapeHtml(cls.videoUrl)}" type="video/mp4">
                    Tu navegador no soporta transmisión de video HTML5 en directo.
                </video>

                <!-- Etiqueta flotante del Especialista en Vivo -->
                <div class="absolute bottom-14 left-4 z-10 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-primary/40 flex items-center gap-2 pointer-events-none">
                    <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    <div>
                        <div class="text-[11px] font-extrabold text-white">${escapeHtml(cls.especialista)}</div>
                        <div class="text-[9px] font-mono text-primary uppercase">${escapeHtml(cls.materia)} • Señal Encriptada Makai</div>
                    </div>
                </div>
            </div>
        `;
    }

    // MODO 2: PIZARRA CLÍNICA INTERACTIVA DEL ESPECIALISTA
    if (liveClassroomState.viewMode === "whiteboard") {
        return `
            <div class="relative w-full h-full bg-[#070d16] flex flex-col">
                <div class="px-3 py-1.5 bg-surface/90 border-b border-white/10 flex items-center justify-between text-[11px]">
                    <span class="font-mono text-primary font-bold flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">draw</span>
                        <span>Pizarra de Algoritmos y Esquemas Clínicos en Vivo</span>
                    </span>
                    <div class="flex items-center gap-2">
                        <button type="button" id="btn-whiteboard-clear" class="px-2 py-0.5 rounded bg-surface-high hover:bg-danger/20 text-gray-300 hover:text-danger font-mono text-[10px]">
                            Limpiar Pizarra
                        </button>
                    </div>
                </div>
                <canvas
                    id="classroom-live-whiteboard-canvas"
                    class="flex-1 w-full h-full cursor-crosshair"
                ></canvas>
            </div>
        `;
    }

    // MODO 3 (POR DEFECTO): ANTESALA DE TRANSMISIÓN EN VIVO (MEET / ZOOM SDK / STREAM)
    const providerLabel = (cls.liveProvider || "ZOOM / MEET").toUpperCase();

    return `
        <div
            class="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-cover bg-center relative"
            style="background-image: linear-gradient(rgba(4, 8, 15, 0.86), rgba(4, 8, 15, 0.96)), url('${escapeHtml(cls.fondoTransmisionUrl)}');"
        >
            <div class="max-w-xl space-y-3.5">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-danger/20 border border-danger/40 text-danger text-[11px] font-mono font-extrabold">
                    <span class="w-2 h-2 rounded-full bg-danger animate-ping"></span>
                    <span>SALA INTERACTIVA EN VIVO • ${escapeHtml(providerLabel)}</span>
                </div>

                <h3 class="text-base md:text-xl font-extrabold text-white leading-snug">
                    ${escapeHtml(cls.titulo)}
                </h3>

                <p class="text-xs text-gray-300 leading-relaxed max-w-lg mx-auto">
                    Docente en sala: <strong class="text-primary">${escapeHtml(cls.especialista)}</strong> •
                    Horario: <span class="font-mono text-secondary">${escapeHtml(cls.fechaSesion)}</span> •
                    Ruta: <span class="font-mono uppercase text-warning">${escapeHtml(cls.nivelSuscripcion)}</span>
                </p>

                <!-- Botones Principales de Conexión a la Transmisión -->
                <div class="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                        type="button"
                        id="btn-join-embedded-live-stream"
                        class="px-5 py-2.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)] flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-base">live_tv</span>
                        <span>Conectar Transmisión en Pantalla</span>
                    </button>

                    <button
                        type="button"
                        id="btn-open-external-bridge-room"
                        class="px-4 py-2.5 rounded-xl bg-secondary/15 hover:bg-secondary text-secondary hover:text-surface border border-secondary/40 font-extrabold text-xs transition-all flex items-center gap-1.5"
                    >
                        <span class="material-symbols-outlined text-base">video_call</span>
                        <span>Abrir Sala Interactiva (${escapeHtml(providerLabel)})</span>
                    </button>
                </div>

                <!-- Mini-Fila de Participación (Manos Levantadas en Vivo) -->
                ${liveClassroomState.handRaiseQueue.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-white/10 max-w-md mx-auto text-left">
                        <div class="flex items-center justify-between text-[10px] font-mono text-warning uppercase font-extrabold mb-1.5">
                            <span>✋ Fila de Intervención con el Especialista</span>
                            <span>${liveClassroomState.handRaiseQueue.length} en turno</span>
                        </div>
                        <div class="space-y-1 max-h-20 overflow-y-auto">
                            ${liveClassroomState.handRaiseQueue.slice(0, 3).map((item, idx) => `
                                <div class="px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 flex items-center justify-between gap-2 text-[11px]">
                                    <span class="truncate text-gray-200">
                                        <strong class="text-warning">#${idx + 1}</strong> ${escapeHtml(item.studentName)}:
                                        <em class="text-gray-400">${escapeHtml(item.topic)}</em>
                                    </span>
                                    ${isAdmin ? `
                                        <button
                                            type="button"
                                            data-resolve-hand-id="${item.id}"
                                            class="live-resolve-hand-btn text-[10px] font-mono text-secondary hover:underline shrink-0"
                                        >
                                            ✓ Atender
                                        </button>
                                    ` : `
                                        <span class="text-[9px] font-mono text-primary shrink-0">${escapeHtml(item.tier)}</span>
                                    `}
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ""}
            </div>
        </div>
    `;
}

/**
 * Renderiza la ventana flotante del Reactivo / Sondeo Clínico en Vivo dentro del escenario.
 * @param {boolean} isAdmin
 * @returns {string}
 */
function renderLivePollOverlayHTML(isAdmin) {
    const poll = liveClassroomState.activePoll;
    if (!poll) return "";

    const totalVotes = poll.options.reduce((acc, opt) => acc + (Number(opt.votes) || 0), 0) || 1;
    const userChoice = liveClassroomState.userVotedPollOption;

    return `
        <div class="absolute inset-x-4 bottom-4 md:inset-x-auto md:right-4 md:bottom-4 md:w-96 z-30 bg-surface-container/95 backdrop-blur-xl border border-primary/50 rounded-2xl p-4 shadow-2xl space-y-3">
            <div class="flex items-center justify-between gap-2">
                <span class="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-mono font-extrabold uppercase">
                    📊 Reactivo Clínico en Vivo (${totalVotes} votos)
                </span>
                <button
                    type="button"
                    id="btn-close-live-poll-overlay"
                    class="text-gray-400 hover:text-white text-xs font-bold"
                >
                    ✕
                </button>
            </div>

            <p class="text-xs font-extrabold text-white leading-relaxed">
                ${escapeHtml(poll.question)}
            </p>

            <div class="space-y-1.5">
                ${poll.options.map(opt => {
                    const pct = Math.round(((Number(opt.votes) || 0) / totalVotes) * 100);
                    const isSelected = userChoice === opt.key;
                    const isCorrect = Boolean(userChoice) && opt.key === poll.correctKey;

                    return `
                        <button
                            type="button"
                            data-live-poll-option="${opt.key}"
                            class="live-poll-option-btn w-full text-left p-2 rounded-xl border transition-all relative overflow-hidden ${
                                isCorrect
                                    ? "bg-secondary/15 border-secondary text-white"
                                    : isSelected
                                        ? "bg-primary/20 border-primary text-white"
                                        : "bg-surface border-surface-high hover:border-primary/40 text-gray-200"
                            }"
                        >
                            <div class="flex items-center justify-between gap-2 text-xs relative z-10">
                                <span class="font-bold">
                                    <strong class="text-primary font-mono mr-1">${escapeHtml(opt.key)})</strong>
                                    ${escapeHtml(opt.text)}
                                </span>
                                ${userChoice ? `
                                    <span class="text-[10px] font-mono font-extrabold text-secondary shrink-0">
                                        ${pct}%
                                    </span>
                                ` : ""}
                            </div>
                        </button>
                    `;
                }).join("")}
            </div>

            ${userChoice ? `
                <div class="text-[11px] font-mono text-secondary pt-1">
                    ✓ Respuesta registrada. Clave oficial del especialista: Opción ${escapeHtml(poll.correctKey)}.
                </div>
            ` : `
                <div class="text-[10px] font-mono text-gray-400">
                    Selecciona la opción correcta para comparar tu razonamiento con la sala en directo.
                </div>
            `}
        </div>
    `;
}

// ============================================================================
// 4. EVENTOS Y ACCIONES INTERACTIVAS DE LA SALA EN VIVO
// ============================================================================

/**
 * Enlaza todos los botones y controles interactivos del escenario en vivo.
 */
function bindLiveStageEvents() {
    const mountEl = liveClassroomState.mountContainer;
    if (!mountEl) return;

    // 1. Selector de modo de vista (Antesala / Transmisión HD / Pizarra Clínica)
    mountEl.querySelectorAll(".live-view-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetMode = btn.dataset.liveViewMode || "lobby";
            connectToEmbeddedLiveStream(targetMode);
        });
    });

    // 2. Botón principal "Conectar Transmisión en Pantalla"
    document.getElementById("btn-join-embedded-live-stream")?.addEventListener("click", () => {
        connectToEmbeddedLiveStream("stream_stage");
    });

    // 3. Botón "Abrir Sala Interactiva (Google Meet / Zoom)" con validación segura
    document.getElementById("btn-open-external-bridge-room")?.addEventListener("click", () => {
        openVerifiedExternalMeetingBridge();
    });

    // 4. Botón "Levantar Mano" para fila de intervención con el especialista
    document.getElementById("btn-live-raise-hand")?.addEventListener("click", () => {
        toggleStudentHandRaise();
    });

    // 5. Mostrar / ocultar superposición de Reactivo Clínico en Vivo
    document.getElementById("btn-live-toggle-poll")?.addEventListener("click", () => {
        liveClassroomState.showPollOverlay = !liveClassroomState.showPollOverlay;
        renderLiveStageLayout();
    });

    document.getElementById("btn-close-live-poll-overlay")?.addEventListener("click", () => {
        liveClassroomState.showPollOverlay = false;
        renderLiveStageLayout();
    });

    // 6. Votar en opción del Reactivo Clínico en Vivo
    mountEl.querySelectorAll(".live-poll-option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            voteOnActiveLivePoll(btn.dataset.livePollOption);
        });
    });

    // 7. Reacciones flotantes en vivo sobre el escenario
    mountEl.querySelectorAll(".live-stage-reaction-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const reactionId = btn.dataset.liveStageReaction;
            const found = LIVE_STAGE_REACTIONS.find(r => r.id === reactionId);
            if (found) {
                triggerFloatingStageReaction(found.emoji, found.label);
            }
        });
    });

    // 8. Atender mano levantada (Exclusivo Admin Maestro)
    mountEl.querySelectorAll(".live-resolve-hand-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            resolveRaisedHandItem(btn.dataset.resolveHandId);
        });
    });

    // 9. Abrir Consola Docente de Transmisión (Exclusivo Admin Maestro)
    document.getElementById("btn-live-admin-console")?.addEventListener("click", () => {
        openAdminLiveDirectorModal();
    });

    // 10. Conmutar de regreso al reproductor de Clases Grabadas (VOD)
    document.getElementById("btn-switch-back-to-vod")?.addEventListener("click", () => {
        const vodBtn = document.getElementById("btn-stage-mode-vod");
        if (vodBtn) {
            vodBtn.click();
        } else {
            window.dispatchEvent(new CustomEvent("makai:switchClassroomStageMode", {
                detail: { mode: "vod" }
            }));
        }
    });
}

/**
 * Conmuta el escenario en vivo al modo solicitado (`stream_stage`, `whiteboard` o `lobby`)
 * e inicia la reproducción de baja latencia cuando corresponde.
 * @param {"lobby"|"stream_stage"|"whiteboard"} mode
 */
export function connectToEmbeddedLiveStream(mode = "stream_stage") {
    const validModes = ["lobby", "stream_stage", "whiteboard"];
    liveClassroomState.viewMode = validModes.includes(mode) ? mode : "stream_stage";

    renderLiveStageLayout();

    if (liveClassroomState.viewMode === "stream_stage") {
        const videoEl = document.getElementById("classroom-live-video-stream");
        videoEl?.play?.().catch(() => {});
    }
}

/**
 * Abre la sala interactiva externa (Google Meet o Zoom) en ventana acoplada verificando
 * primero que el estudiante posea permiso de suscripción.
 */
function openVerifiedExternalMeetingBridge() {
    const cls = liveClassroomState.activeClass;
    if (!cls) return;

    const requiredTier = cls.nivelSuscripcion || "VIP";
    if (!isCurrentUserMasterAdmin() && typeof canAccessBySubscription === "function") {
        if (!canAccessBySubscription(requiredTier)) {
            alert(`La sala interactiva en directo requiere el Plan ${requiredTier}.`);
            return;
        }
    }

    const roomUrl = cls.liveRoomUrl || "https://meet.google.com/";
    window.open(roomUrl, "_blank", "noopener,noreferrer");

    if (typeof ClassroomChat.sendLiveChatMessage === "function") {
        ClassroomChat.sendLiveChatMessage("🎥 Se unió a la sala de videollamada en directo.", {
            attachTimestamp: false
        });
    }
}

/**
 * Permite al estudiante levantar o bajar la mano en la fila de participación en vivo,
 * sincronizando la solicitud con Cloud Firestore, `BroadcastChannel` y el chat lateral.
 * @param {string} [customTopic]
 */
export async function toggleStudentHandRaise(customTopic = "") {
    const identity = getCurrentStudentIdentity();

    if (liveClassroomState.isHandRaised) {
        liveClassroomState.isHandRaised = false;
        liveClassroomState.handRaiseQueue = liveClassroomState.handRaiseQueue.filter(
            item => item.studentEmail !== identity.email
        );
        renderLiveStageLayout();
        return;
    }

    const topicText = customTopic ||
        prompt("Indica brevemente el tema de tu duda para el especialista (ej. Dosis de Labetalol IV):", "Consulta sobre el caso clínico en pantalla");

    if (topicText === null) return;

    const handEntry = {
        id: `hr_${Date.now()}`,
        classId: liveClassroomState.activeClass?.id || "aula_live",
        studentName: identity.name,
        studentEmail: identity.email,
        tier: identity.tier,
        topic: String(topicText || "Duda clínica en directo").trim(),
        timestamp: "Ahora"
    };

    liveClassroomState.isHandRaised = true;
    liveClassroomState.handRaiseQueue.push(handEntry);
    renderLiveStageLayout();

    // Sincronizar con otras pestañas
    postLiveBroadcastPacket({
        type: "HAND_RAISED",
        classId: handEntry.classId,
        payload: handEntry
    });

    // Publicar aviso automático en el chat lateral de la clase
    if (typeof ClassroomChat.sendLiveChatMessage === "function") {
        await ClassroomChat.sendLiveChatMessage(`✋ Levantó la mano en sala: "${handEntry.topic}"`, {
            attachTimestamp: true
        });
    }
}

/**
 * Permite al Administrador Maestro dar por atendida una mano levantada de la fila.
 * @param {string} handId
 */
function resolveRaisedHandItem(handId) {
    if (!isCurrentUserMasterAdmin()) return;

    liveClassroomState.handRaiseQueue = liveClassroomState.handRaiseQueue.filter(item => item.id !== handId);
    renderLiveStageLayout();

    postLiveBroadcastPacket({
        type: "HAND_RESOLVED",
        classId: liveClassroomState.activeClass?.id,
        payload: { handId }
    });
}

/**
 * Registra el voto del estudiante en el Reactivo Clínico en Vivo y actualiza las barras de porcentaje.
 * @param {string} optionKey - "A" | "B" | "C" | "D"
 */
export function voteOnActiveLivePoll(optionKey) {
    if (!optionKey || !liveClassroomState.activePoll) return;
    if (liveClassroomState.userVotedPollOption) return;

    const targetOpt = liveClassroomState.activePoll.options.find(o => o.key === optionKey);
    if (!targetOpt) return;

    targetOpt.votes = (Number(targetOpt.votes) || 0) + 1;
    liveClassroomState.userVotedPollOption = optionKey;

    renderLiveStageLayout();

    postLiveBroadcastPacket({
        type: "LIVE_POLL_VOTE",
        classId: liveClassroomState.activeClass?.id,
        payload: { optionKey }
    });
}

/**
 * Lanza una reacción animada flotante sobre el escenario en vivo.
 * @param {string} emoji
 * @param {string} label
 * @param {Object} [options]
 */
export function triggerFloatingStageReaction(emoji = "🧠", label = "Concepto Claro", options = {}) {
    const layer = document.getElementById("live-floating-reactions-layer");
    if (layer) {
        const bubble = document.createElement("div");
        const randomLeft = Math.floor(15 + Math.random() * 70);
        bubble.className = "absolute bottom-4 px-2.5 py-1 rounded-full bg-black/70 border border-primary/40 text-xs font-extrabold text-white flex items-center gap-1 transition-all duration-1000 ease-out pointer-events-none";
        bubble.style.left = `${randomLeft}%`;
        bubble.innerHTML = `<span>${escapeHtml(emoji)}</span><span class="text-[10px] font-mono text-primary">${escapeHtml(label)}</span>`;
        layer.appendChild(bubble);

        requestAnimationFrame(() => {
            bubble.style.transform = "translateY(-180px) scale(1.08)";
            bubble.style.opacity = "0";
        });

        setTimeout(() => bubble.remove(), 1050);
    }

    if (!options.fromBroadcast) {
        postLiveBroadcastPacket({
            type: "STAGE_REACTION",
            classId: liveClassroomState.activeClass?.id,
            payload: { emoji, label }
        });
    }
}

// ============================================================================
// 5. PIZARRA CLÍNICA INTERACTIVA (HTML5 CANVAS PARA ESQUEMAS EN VIVO)
// ============================================================================

/**
 * Inicializa el lienzo HTML5 de la Pizarra Clínica cuando el escenario está en modo `whiteboard`.
 */
function initClinicalWhiteboardCanvas() {
    const canvas = document.getElementById("classroom-live-whiteboard-canvas");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(640, Math.floor(rect.width || 800));
    canvas.height = Math.max(340, Math.floor(rect.height || 420));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    liveClassroomState.whiteboardCtx = ctx;

    // Dibujar cuadrícula táctica y esquema clínico inicial
    drawDefaultWhiteboardAlgorithm(ctx, canvas.width, canvas.height);

    const getCoords = (evt) => {
        const r = canvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        return {
            x: ((clientX - r.left) / r.width) * canvas.width,
            y: ((clientY - r.top) / r.height) * canvas.height
        };
    };

    const startDraw = (evt) => {
        liveClassroomState.isDrawingWhiteboard = true;
        const { x, y } = getCoords(evt);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const moveDraw = (evt) => {
        if (!liveClassroomState.isDrawingWhiteboard) return;
        evt.preventDefault?.();
        const { x, y } = getCoords(evt);
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const endDraw = () => {
        liveClassroomState.isDrawingWhiteboard = false;
    };

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);

    canvas.addEventListener("touchstart", startDraw, { passive: true });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    window.addEventListener("touchend", endDraw);

    document.getElementById("btn-whiteboard-clear")?.addEventListener("click", () => {
        drawDefaultWhiteboardAlgorithm(ctx, canvas.width, canvas.height);
    });
}

/**
 * Pinta la plantilla clínica base sobre la pizarra en vivo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawDefaultWhiteboardAlgorithm(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#070d16";
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula sutil
    ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Encabezado del algoritmo del especialista
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 13px monospace";
    ctx.fillText(
        `PIZARRA DOCENTE EN VIVO • ${(liveClassroomState.activeClass?.materia || "ALGORITMO CLÍNICO").toUpperCase()}`,
        20,
        28
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px sans-serif";
    ctx.fillText(
        "Traza libremente sobre el lienzo con el cursor o pantalla táctil para resaltar puntos clave de la sesión.",
        20,
        48
    );
}

// ============================================================================
// 6. CONSOLA DE DIRECCIÓN EN VIVO PARA ADMINISTRADORES MAESTROS
// ============================================================================

/**
 * Abre la consola de control en directo exclusiva para Administradores Maestros
 * (`anthonnyvelastegui@gmail.com` y `aavemakaihc@gmail.com`).
 */
export function openAdminLiveDirectorModal() {
    if (!isCurrentUserMasterAdmin()) return;

    let modal = document.getElementById("admin-live-director-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "admin-live-director-modal";
        modal.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    const cls = liveClassroomState.activeClass || {};

    modal.innerHTML = `
        <div class="bg-surface-container border border-primary/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-xs">
            <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        Consola de Dirección en Vivo • Admin Maestro
                    </span>
                    <h3 class="text-sm font-extrabold text-white">
                        Controlar Transmisión y Sondeos Clínicos
                    </h3>
                </div>
                <button type="button" id="btn-close-live-director-modal" class="text-gray-400 hover:text-white font-bold">
                    ✕
                </button>
            </div>

            <form id="form-admin-live-director" class="p-4 space-y-3">
                <div class="grid grid-cols-2 gap-2.5">
                    <div>
                        <label class="block text-[10px] font-mono uppercase text-gray-400 mb-1">Estado de la Sala</label>
                        <select id="admin-live-status" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white font-bold outline-none">
                            <option value="en_vivo" ${liveClassroomState.broadcastStatus === "en_vivo" ? "selected" : ""}>🔴 EN VIVO (Transmisión Activa)</option>
                            <option value="sala_espera" ${liveClassroomState.broadcastStatus === "sala_espera" ? "selected" : ""}>⏳ Sala de Espera (Por Iniciar)</option>
                            <option value="finalizada" ${liveClassroomState.broadcastStatus === "finalizada" ? "selected" : ""}>✓ Sesión Finalizada (Pasar a VOD)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono uppercase text-gray-400 mb-1">Proveedor en Vivo</label>
                        <select id="admin-live-provider" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white font-bold outline-none">
                            <option value="zoom_sdk" ${cls.liveProvider === "zoom_sdk" ? "selected" : ""}>Zoom Video SDK</option>
                            <option value="meet" ${cls.liveProvider === "meet" ? "selected" : ""}>Google Meet Clínica</option>
                            <option value="hls_stream" ${cls.liveProvider === "hls_stream" ? "selected" : ""}>Stream Directo HLS/MP4</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-mono uppercase text-gray-400 mb-1">Enlace de Sala (Google Meet / Zoom / Stream)</label>
                    <input
                        type="text"
                        id="admin-live-room-url"
                        value="${escapeHtml(cls.liveRoomUrl || "https://meet.google.com/")}"
                        class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-white outline-none"
                    >
                </div>

                <div class="pt-2 border-t border-surface-high space-y-2">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                        Lanzar Nuevo Reactivo en Vivo a los Alumnos
                    </span>
                    <textarea
                        id="admin-live-poll-question"
                        rows="2"
                        placeholder="Escribe una pregunta clínica rápida para proyectar en la pantalla de todos los alumnos..."
                        class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-white outline-none resize-none"
                    >${escapeHtml(liveClassroomState.activePoll?.question || "")}</textarea>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        id="btn-cancel-live-director"
                        class="px-4 py-2 rounded-xl bg-surface-high text-gray-300 font-bold"
                    >
                        Cerrar
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 rounded-xl bg-primary text-surface font-extrabold"
                    >
                        Aplicar Cambios en Vivo
                    </button>
                </div>
            </form>
        </div>
    `;

    const closeModal = () => modal.remove();
    document.getElementById("btn-close-live-director-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-live-director")?.addEventListener("click", closeModal);

    document.getElementById("form-admin-live-director")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nextStatus = document.getElementById("admin-live-status")?.value || "en_vivo";
        const nextProvider = document.getElementById("admin-live-provider")?.value || "zoom_sdk";
        const nextRoomUrl = document.getElementById("admin-live-room-url")?.value?.trim() || "https://meet.google.com/";
        const nextPollQuestion = document.getElementById("admin-live-poll-question")?.value?.trim();

        await updateLiveSessionBroadcastState({
            broadcastStatus: nextStatus,
            liveProvider: nextProvider,
            liveRoomUrl: nextRoomUrl
        });

        if (nextPollQuestion && nextPollQuestion !== liveClassroomState.activePoll?.question) {
            await launchAdminLiveClinicalPoll({
                question: nextPollQuestion
            });
        }

        closeModal();
    });
}

/**
 * Actualiza el estado de la transmisión en vivo y lo sincroniza con Cloud Firestore y `BroadcastChannel`.
 * @param {Object} updates
 */
export async function updateLiveSessionBroadcastState(updates = {}) {
    if (!isCurrentUserMasterAdmin()) return null;

    if (updates.broadcastStatus) {
        liveClassroomState.broadcastStatus = updates.broadcastStatus;
    }
    if (updates.liveProvider && liveClassroomState.activeClass) {
        liveClassroomState.activeClass.liveProvider = updates.liveProvider;
        liveClassroomState.liveProvider = updates.liveProvider;
    }
    if (updates.liveRoomUrl && liveClassroomState.activeClass) {
        liveClassroomState.activeClass.liveRoomUrl = updates.liveRoomUrl;
    }

    renderLiveStageLayout();

    postLiveBroadcastPacket({
        type: "LIVE_STATE_UPDATED",
        classId: liveClassroomState.activeClass?.id,
        payload: {
            broadcastStatus: liveClassroomState.broadcastStatus,
            liveProvider: liveClassroomState.liveProvider,
            liveRoomUrl: liveClassroomState.activeClass?.liveRoomUrl
        }
    });

    const classId = liveClassroomState.activeClass?.id;
    if (db && classId) {
        try {
            await setDoc(doc(db, SAFE_COLLECTIONS.LIVE_SESSIONS, classId), {
                classId,
                broadcastStatus: liveClassroomState.broadcastStatus,
                liveProvider: liveClassroomState.liveProvider,
                liveRoomUrl: liveClassroomState.activeClass?.liveRoomUrl || "",
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            // Conservado en sesión local
        }
    }

    return liveClassroomState;
}

/**
 * Publica un nuevo reactivo clínico en vivo en la pantalla de todos los estudiantes conectados.
 * @param {Object} pollData
 */
export async function launchAdminLiveClinicalPoll(pollData = {}) {
    if (!isCurrentUserMasterAdmin()) return null;

    const newPoll = {
        id: `poll_${Date.now()}`,
        active: true,
        question: pollData.question || DEFAULT_LIVE_CLINICAL_POLL.question,
        options: Array.isArray(pollData.options) && pollData.options.length > 0
            ? pollData.options
            : DEFAULT_LIVE_CLINICAL_POLL.options.map(o => ({ ...o, votes: 1 })),
        correctKey: pollData.correctKey || "A",
        createdBy: getCurrentStudentIdentity().name
    };

    liveClassroomState.activePoll = newPoll;
    liveClassroomState.userVotedPollOption = null;
    liveClassroomState.showPollOverlay = true;

    renderLiveStageLayout();

    postLiveBroadcastPacket({
        type: "NEW_LIVE_POLL",
        classId: liveClassroomState.activeClass?.id,
        payload: newPoll
    });

    return newPoll;
}

// ============================================================================
// 7. SINCRONIZACIÓN CON FIRESTORE, BROADCASTCHANNEL Y UTILIDADES
// ============================================================================

/**
 * Sincroniza el estado de la transmisión en vivo desde Cloud Firestore (`sesiones_vivo_aulas`).
 * @param {string} classId
 */
async function syncLiveSessionStateFromFirestore(classId) {
    if (!db || !classId) return;

    try {
        const snap = await getDoc(doc(db, SAFE_COLLECTIONS.LIVE_SESSIONS, classId));
        if (snap.exists()) {
            const data = snap.data() || {};
            if (data.broadcastStatus) liveClassroomState.broadcastStatus = data.broadcastStatus;
            if (data.liveProvider && liveClassroomState.activeClass) {
                liveClassroomState.activeClass.liveProvider = data.liveProvider;
            }
            if (data.liveRoomUrl && liveClassroomState.activeClass) {
                liveClassroomState.activeClass.liveRoomUrl = data.liveRoomUrl;
            }
        }
    } catch (e) {
        // Continúa con valores semilla en modo offline
    }
}

/**
 * Registra silenciosamente la asistencia del estudiante en la sesión en vivo actual.
 * @param {Object} classObj
 */
async function registerStudentLiveAttendance(classObj) {
    if (!db || !classObj?.id) return;
    const identity = getCurrentStudentIdentity();

    try {
        await addDoc(collection(db, SAFE_COLLECTIONS.LIVE_ATTENDANCE), {
            classId: classObj.id,
            classTitle: classObj.titulo,
            studentEmail: identity.email,
            studentName: identity.name,
            subscriptionTier: identity.tier,
            joinedAt: new Date().toISOString()
        });
    } catch (e) {
        // Silencioso en modo offline
    }
}

/**
 * Inicializa `BroadcastChannel` para sincronizar manos levantadas, reacciones y encuestas
 * entre pestañas en tiempo real (0 ms).
 */
function initLiveBroadcastChannel() {
    if (liveClassroomState.broadcastChannel || typeof window.BroadcastChannel !== "function") return;

    try {
        liveClassroomState.broadcastChannel = new BroadcastChannel("makai_classroom_live_stage_channel");
        liveClassroomState.broadcastChannel.onmessage = (event) => {
            const packet = event.data;
            if (!packet || packet.classId !== liveClassroomState.activeClass?.id) return;

            if (packet.type === "HAND_RAISED" && packet.payload) {
                const exists = liveClassroomState.handRaiseQueue.some(h => h.id === packet.payload.id);
                if (!exists) {
                    liveClassroomState.handRaiseQueue.push(packet.payload);
                    renderLiveStageLayout();
                }
            } else if (packet.type === "HAND_RESOLVED" && packet.payload) {
                liveClassroomState.handRaiseQueue = liveClassroomState.handRaiseQueue.filter(
                    h => h.id !== packet.payload.handId
                );
                renderLiveStageLayout();
            } else if (packet.type === "STAGE_REACTION" && packet.payload) {
                triggerFloatingStageReaction(packet.payload.emoji, packet.payload.label, {
                    fromBroadcast: true
                });
            } else if (packet.type === "NEW_LIVE_POLL" && packet.payload) {
                liveClassroomState.activePoll = packet.payload;
                liveClassroomState.userVotedPollOption = null;
                liveClassroomState.showPollOverlay = true;
                renderLiveStageLayout();
            } else if (packet.type === "LIVE_STATE_UPDATED" && packet.payload) {
                liveClassroomState.broadcastStatus = packet.payload.broadcastStatus || "en_vivo";
                if (liveClassroomState.activeClass && packet.payload.liveRoomUrl) {
                    liveClassroomState.activeClass.liveRoomUrl = packet.payload.liveRoomUrl;
                }
                renderLiveStageLayout();
            }
        };
    } catch (e) {
        // Silencioso
    }
}

function postLiveBroadcastPacket(packet) {
    if (!liveClassroomState.broadcastChannel) return;
    try {
        liveClassroomState.broadcastChannel.postMessage(packet);
    } catch (e) {
        // Silencioso
    }
}

/**
 * Inicia el cronómetro de duración de la sesión en vivo.
 */
function startLiveSessionTimer() {
    if (liveClassroomState.timerIntervalId) {
        clearInterval(liveClassroomState.timerIntervalId);
    }

    liveClassroomState.timerIntervalId = setInterval(() => {
        liveClassroomState.elapsedSeconds += 1;
        const clockEl = document.getElementById("live-elapsed-clock");
        if (clockEl) {
            clockEl.textContent = formatSecondsToHHMMSS(liveClassroomState.elapsedSeconds);
        }
    }, 1000);
}

/**
 * Limpia los recursos y temporizadores de la transmisión en vivo al desmontar la vista.
 */
export function destroyClassroomLiveSession() {
    if (liveClassroomState.timerIntervalId) {
        clearInterval(liveClassroomState.timerIntervalId);
        liveClassroomState.timerIntervalId = null;
    }
    const videoEl = document.getElementById("classroom-live-video-stream");
    videoEl?.pause?.();
}

/**
 * Devuelve la configuración visual de la insignia de estado de transmisión.
 * @param {string} status
 */
function getBroadcastStatusBadgeConfig(status = "en_vivo") {
    if (status === "sala_espera") {
        return {
            label: "Sala de Espera • Por Iniciar",
            classes: "bg-warning/20 border border-warning/40 text-warning",
            dotClass: "bg-warning animate-pulse"
        };
    }
    if (status === "finalizada") {
        return {
            label: "Transmisión Finalizada • Grabación Disponible",
            classes: "bg-secondary/20 border border-secondary/40 text-secondary",
            dotClass: "bg-secondary"
        };
    }
    return {
        label: "En Vivo • Señal Directa",
        classes: "bg-danger/20 border border-danger/40 text-danger",
        dotClass: "bg-danger animate-ping"
    };
}

/**
 * Verifica si el usuario actual es un Administrador Maestro autorizado.
 * @returns {boolean}
 */
function isCurrentUserMasterAdmin() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(email) || appState?.currentUserData?.rol === "admin";
}

/**
 * Obtiene la identidad y nivel de suscripción del estudiante actual.
 */
function getCurrentStudentIdentity() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "estudiante@makai.ec";
    const isAdmin = isCurrentUserMasterAdmin();
    const rawName = appState?.currentUserData?.nombre ||
        appState?.currentUserData?.nickname ||
        auth?.currentUser?.displayName ||
        email.split("@")[0];

    return {
        name: isAdmin ? `Dr. ${rawName} (Especialista)` : rawName,
        email,
        tier: isAdmin ? "VIP" : (appState?.currentUserData?.subscriptionLevel || "Básico")
    };
}

/**
 * Formatea segundos en cadena `hh:mm:ss` o `mm:ss`.
 * @param {number} totalSec
 * @returns {string}
 */
function formatSecondsToHHMMSS(totalSec = 0) {
    const secNum = Math.max(0, Math.floor(Number(totalSec) || 0));
    const hrs = Math.floor(secNum / 3600);
    const mins = Math.floor((secNum % 3600) / 60).toString().padStart(2, "0");
    const secs = (secNum % 60).toString().padStart(2, "0");
    return hrs > 0 ? `${hrs.toString().padStart(2, "0")}:${mins}:${secs}` : `${mins}:${secs}`;
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
