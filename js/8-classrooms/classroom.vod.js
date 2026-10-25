// ============================================================================
// ARCHIVO: js/8-classrooms/classroom.vod.js
// DESCRIPCIÓN: Subcomponente de Reproducción de Clases Grabadas bajo Demanda (VOD)
//              conectado a Google Cloud Storage y Bóveda Multimedia Local.
//              Incluye controles tácticos HUD, línea de tiempo con capítulos
//              clínicos, velocidad variable (0.75x - 2.0x), repetición de bucle
//              A-B, marcadores personales del estudiante, historial colapsable
//              de visualización y sincronización de progreso en Cloud Firestore.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
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

import * as ClassroomDRM from "./classroom.drm.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA Y ESTADO REACTIVO DEL REPRODUCTOR VOD
// ============================================================================

const SAFE_COLLECTIONS = Object.freeze({
    CLASSROOMS: COLLECTIONS?.CLASSROOMS || "aulas_virtuales",
    USERS: COLLECTIONS?.USERS || "usuarios",
    VOD_PROGRESS: COLLECTIONS?.VOD_PROGRESS || "progreso_aulas_vod"
});

const VOD_STORAGE_KEYS = Object.freeze({
    WATCH_HISTORY: "makai_vod_watch_history_v1",
    BOOKMARKS: "makai_vod_student_bookmarks_v1",
    PREFERENCES: "makai_vod_player_prefs_v1"
});

export const VOD_PLAYBACK_RATES = Object.freeze([0.75, 1.0, 1.25, 1.5, 1.75, 2.0]);

const FALLBACK_POSTER_PATH = "assets/8-multimedia-aulas/portadas-clases/portada-medicina-interna-caces.jpg";
const FALLBACK_STREAM_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

/**
 * Estado interno del motor VOD de MakaiAcademy.
 */
export const classroomVODState = {
    initialized: false,
    mountElement: null,
    activeClass: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    bufferedPercent: 0,
    playbackRate: 1.0,
    volume: 1.0,
    isMuted: false,
    activeChapterIndex: -1,
    isHistoryDrawerOpen: false,
    isBookmarksOpen: false,
    loopAB: {
        active: false,
        pointA: null,
        pointB: null
    },
    watchHistory: {},
    studentBookmarks: {},
    progressSyncIntervalId: null,
    controlsHideTimeoutId: null
};

// Referencias para limpieza de eventos globales
let boundKeyboardShortcutsHandler = null;
let boundDRMBlackoutListener = null;

// ============================================================================
// 2. INICIALIZADOR Y RENDERIZADOR PRINCIPAL DEL ESCENARIO VOD (renderVODPlayer)
// ============================================================================

/**
 * Monta y configura el reproductor de Clases Grabadas (VOD) dentro de `#classroom-vod-stage-mount`.
 * Invocado automáticamente por `classroom.controller.js` (`mountVODStageSubmodule`).
 * Tolera invocación como `(classItem, mountEl)` o `(mountEl, classItem)`.
 * @param {Object|HTMLElement} arg1
 * @param {HTMLElement|Object} arg2
 * @returns {Promise<Object>}
 */
export async function renderVODPlayer(arg1, arg2) {
    // Resolución flexible de parámetros para máxima compatibilidad
    let classItem = null;
    let mountEl = null;

    if (arg1 instanceof HTMLElement) {
        mountEl = arg1;
        classItem = arg2;
    } else {
        classItem = arg1;
        mountEl = arg2 || document.getElementById("classroom-vod-stage-mount");
    }

    if (!mountEl) {
        mountEl = document.getElementById("classroom-vod-stage-mount");
    }
    if (!mountEl || !classItem) return classroomVODState;

    // Verificar acceso por nivel de suscripción antes de montar el stream
    if (!verifyVODSubscriptionPermission(classItem)) {
        renderVODLockedPaywall(mountEl, classItem);
        return classroomVODState;
    }

    // Limpiar instancia previa si existía
    clearVODTimersAndListeners();

    classroomVODState.mountElement = mountEl;
    classroomVODState.activeClass = classItem;
    classroomVODState.currentTime = 0;
    classroomVODState.duration = parseDurationStringToSeconds(classItem.duracion) || 0;
    classroomVODState.activeChapterIndex = -1;
    classroomVODState.loopAB = { active: false, pointA: null, pointB: null };

    // 1. Cargar preferencias del reproductor, historial y marcadores desde almacenamiento local + nube
    loadLocalVODStorageData();
    await syncStudentVODProgressFromCloud(classItem.id);

    // 2. Construir el lienzo HTML5 + HUD Táctico en #classroom-vod-stage-mount
    buildVODStageDOM(mountEl, classItem);

    // 3. Vincular el elemento <video id="classroom-vod-video"> con el escudo DRM
    const videoEl = document.getElementById("classroom-vod-video");
    if (videoEl) {
        if (typeof ClassroomDRM.hardenClassroomVideoElement === "function") {
            await ClassroomDRM.hardenClassroomVideoElement(videoEl, {
                encrypted: Boolean(classItem.drmProtected)
            });
        }
        if (typeof ClassroomDRM.updateDRMWatermark === "function") {
            ClassroomDRM.updateDRMWatermark(classItem);
        }
    }

    // 4. Enlazar eventos del elemento <video>, controles HUD, capítulos y atajos de teclado
    bindVODVideoElementEvents(videoEl, classItem);
    bindVODHUDControlEvents(videoEl, classItem);
    bindGlobalVODKeyboardAndDRMEvents();

    // 5. Iniciar temporizador de guardado automático de progreso cada 12 segundos
    startVODProgressAutoSave();

    // 6. Sincronizar insignias de progreso en la barra lateral de catálogo (#classroom-catalog-list)
    decorateSidebarCatalogWithWatchProgress();

    classroomVODState.initialized = true;
    return classroomVODState;
}

// Alias oficiales requeridos por `classroom.controller.js` y `app.orchestrator.js`
export const initClassroomVOD = renderVODPlayer;
export const loadVODSession = renderVODPlayer;
export const mountVODPlayer = renderVODPlayer;

// ============================================================================
// 3. CONSTRUCCIÓN DEL DOM DEL REPRODUCTOR VOD Y CAJÓN LATERAL COLAPSABLE
// ============================================================================

/**
 * Construye la interfaz del reproductor `#classroom-vod-video`, la barra de tiempo con
 * marcadores de capítulos clínicos, el banner de reanudación automática y los paneles
 * colapsables de Historial de Clases y Marcadores Personales.
 * @param {HTMLElement} mountEl
 * @param {Object} classItem
 */
function buildVODStageDOM(mountEl, classItem) {
    const posterUrl = classItem.portadaUrl || FALLBACK_POSTER_PATH;
    const videoSourceUrl = resolveCloudStorageStreamUrl(classItem.videoUrl);
    const savedProgress = classroomVODState.watchHistory[classItem.id];
    const hasResumePoint = savedProgress && savedProgress.lastSecond > 15 && !savedProgress.completed;
    const isAdmin = isCurrentMasterAdmin();

    mountEl.innerHTML = `
        <div
            id="classroom-vod-wrapper"
            class="relative w-full h-full bg-black flex flex-col justify-between overflow-hidden group select-none"
        >
            <!-- ============================================================ -->
            <!-- ELEMENTO DE VIDEO PRINCIPAL (#classroom-vod-video)           -->
            <!-- ============================================================ -->
            <video
                id="classroom-vod-video"
                class="w-full h-full object-contain bg-black cursor-pointer"
                playsinline
                preload="metadata"
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                crossorigin="anonymous"
                poster="${escapeHtml(posterUrl)}"
            >
                <source src="${escapeHtml(videoSourceUrl)}" type="video/mp4">
                Tu navegador no soporta reproducción de video HTML5.
            </video>

            <!-- ============================================================ -->
            <!-- CAPA SUPERIOR: INDICADOR DE CAPÍTULO ACTIVO Y ACCIONES VOD   -->
            <!-- ============================================================ -->
            <div
                id="vod-top-hud-bar"
                class="absolute top-0 inset-x-0 z-10 p-3 md:p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            >
                <div class="flex items-center gap-2 pointer-events-auto min-w-0">
                    <span class="px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary text-[10px] font-mono font-extrabold uppercase shrink-0">
                        CLOUD VOD HD
                    </span>
                    <span
                        id="vod-active-chapter-pill"
                        class="px-2.5 py-0.5 rounded-full bg-surface/90 border border-surface-high text-gray-200 text-[11px] font-bold truncate"
                    >
                        ▶ ${escapeHtml(classItem.capitulos?.[0]?.titulo || "Sesión Magistral Completa")}
                    </span>
                </div>

                <div class="flex items-center gap-1.5 pointer-events-auto shrink-0">
                    <!-- Botón para agregar Marcador Clínico Personal en el segundo actual -->
                    <button
                        type="button"
                        id="btn-vod-toggle-bookmarks"
                        class="px-2.5 py-1 rounded-lg bg-surface/90 hover:bg-surface-high border border-surface-high text-[11px] font-bold text-gray-200 hover:text-primary transition-all flex items-center gap-1"
                        title="Mis marcadores y notas de tiempo en esta clase"
                    >
                        <span class="material-symbols-outlined text-sm text-primary">bookmark_add</span>
                        <span class="hidden sm:inline">Notas</span>
                    </button>

                    <!-- Botón para abrir la Barra Lateral Colapsable de Historial Grabado -->
                    <button
                        type="button"
                        id="btn-vod-toggle-history-drawer"
                        class="px-2.5 py-1 rounded-lg bg-surface/90 hover:bg-surface-high border border-surface-high text-[11px] font-bold text-gray-200 hover:text-secondary transition-all flex items-center gap-1"
                        title="Abrir historial de clases grabadas y progreso"
                    >
                        <span class="material-symbols-outlined text-sm text-secondary">history</span>
                        <span class="hidden sm:inline">Historial VOD</span>
                    </button>

                    ${isAdmin ? `
                        <button
                            type="button"
                            id="btn-vod-admin-chapters"
                            class="px-2.5 py-1 rounded-lg bg-secondary/20 hover:bg-secondary border border-secondary/40 text-[11px] font-extrabold text-secondary hover:text-surface transition-all flex items-center gap-1"
                            title="Editar capítulos clínicos o stream (Administrador Maestro)"
                        >
                            <span class="material-symbols-outlined text-sm">edit_note</span>
                            <span class="hidden md:inline">Capítulos</span>
                        </button>
                    ` : ""}
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- SPINNER CENTRAL DE CARGA / BOTÓN GIGANTE DE PLAY             -->
            <!-- ============================================================ -->
            <div
                id="vod-center-overlay"
                class=" absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            >
                <button
                    type="button"
                    id="btn-vod-big-play"
                    class="pointer-events-auto w-16 h-16 rounded-full bg-primary/90 hover:bg-primary text-surface flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.45)] transition-transform hover:scale-105"
                    title="Reproducir Clase Magistral (Espacio)"
                >
                    <span id="vod-big-play-icon" class="material-symbols-outlined text-4xl">play_arrow</span>
                </button>
            </div>

            <!-- ============================================================ -->
            <!-- BANNER FLOTANTE PARA REANUDAR DONDE EL ESTUDIANTE SE QUEDÓ   -->
            <!-- ============================================================ -->
            <div
                id="vod-resume-banner"
                class="${hasResumePoint ? "flex" : "hidden"} absolute bottom-20 left-4 z-20 bg-surface-container/95 backdrop-blur-md border border-primary/50 rounded-xl p-3 items-center gap-3 shadow-2xl max-w-xs sm:max-w-sm"
            >
                <span class="material-symbols-outlined text-primary text-xl shrink-0">restore</span>
                <div class="text-[11px] leading-tight">
                    <div class="font-extrabold text-white">Progreso guardado detectado</div>
                    <div class="text-gray-400">
                        Quedaste en el minuto <span id="vod-resume-time-label" class="text-primary font-mono font-bold">${formatSecondsToMMSS(savedProgress?.lastSecond || 0)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        id="btn-vod-confirm-resume"
                        class="px-2.5 py-1 rounded-lg bg-primary text-surface font-extrabold text-[11px] hover:bg-opacity-90"
                    >
                        Reanudar
                    </button>
                    <button
                        type="button"
                        id="btn-vod-dismiss-resume"
                        class="px-1.5 py-1 text-gray-400 hover:text-white text-xs font-bold"
                        title="Empezar desde el inicio"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- CAJÓN LATERAL COLAPSABLE: HISTORIAL DE CLASES GRABADAS       -->
            <!-- ============================================================ -->
            <aside
                id="vod-history-drawer"
                class="hidden absolute top-0 right-0 bottom-14 z-20 w-72 sm:w-80 bg-surface-container/95 backdrop-blur-xl border-l border-surface-high flex flex-col shadow-2xl"
            >
                <div class="p-3 bg-surface border-b border-surface-high flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-secondary text-base">history</span>
                        <h4 class="text-xs font-extrabold text-white uppercase tracking-wider">
                            Historial de Clases Vistas
                        </h4>
                    </div>
                    <button
                        type="button"
                        id="btn-vod-close-history-drawer"
                        class="text-gray-400 hover:text-white text-xs font-bold px-1.5"
                    >
                        ✕
                    </button>
                </div>
                <div id="vod-history-drawer-list" class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                </div>
            </aside>

            <!-- ============================================================ -->
            <!-- CAJÓN LATERAL COLAPSABLE: MARCADORES CLÍNICOS DEL ALUMNO     -->
            <!-- ============================================================ -->
            <aside
                id="vod-bookmarks-drawer"
                class="hidden absolute top-0 left-0 bottom-14 z-20 w-72 sm:w-80 bg-surface-container/95 backdrop-blur-xl border-r border-surface-high flex flex-col shadow-2xl"
            >
                <div class="p-3 bg-surface border-b border-surface-high flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-base">bookmarks</span>
                        <h4 class="text-xs font-extrabold text-white uppercase tracking-wider">
                            Notas de Tiempo en Video
                        </h4>
                    </div>
                    <button
                        type="button"
                        id="btn-vod-close-bookmarks-drawer"
                        class="text-gray-400 hover:text-white text-xs font-bold px-1.5"
                    >
                        ✕
                    </button>
                </div>

                <form id="form-vod-new-bookmark" class="p-2.5 bg-surface/60 border-b border-surface-high flex gap-1.5">
                    <input
                        type="text"
                        id="input-vod-bookmark-note"
                        placeholder="Ej: Dosis de carga Sulfato Mg..."
                        class="flex-1 bg-surface border border-surface-high focus:border-primary rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none"
                        required
                    >
                    <button
                        type="submit"
                        class="px-2.5 py-1.5 rounded-lg bg-primary text-surface font-extrabold text-[11px] shrink-0"
                        title="Guardar nota en el segundo actual"
                    >
                        + Guardar
                    </button>
                </form>

                <div id="vod-bookmarks-drawer-list" class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                </div>
            </aside>

            <!-- ============================================================ -->
            <!-- BARRA INFERIOR DE CONTROLES TÁCTICOS HUD + LÍNEA DE TIEMPO   -->
            <!-- ============================================================ -->
            <div
                id="vod-bottom-controls-bar"
                class="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 pb-2.5 px-3 md:px-4 space-y-2 opacity-95 group-hover:opacity-100 transition-opacity"
            >
                <!-- Línea de Tiempo Interactiva con Puntos de Capítulos Clínicos -->
                <div class="relative flex items-center group/timeline">
                    <input
                        type="range"
                        id="vod-timeline-slider"
                        min="0"
                        max="100"
                        step="0.1"
                        value="0"
                        class="w-full h-1.5 bg-surface-high rounded-lg appearance-none cursor-pointer accent-[#00e5ff] z-10"
                    >
                    <!-- Capa de Marcadores Visuales de Capítulos sobre la Barra -->
                    <div
                        id="vod-timeline-chapter-markers"
                        class="pointer-events-none absolute inset-x-0 h-1.5 flex items-center"
                    ></div>
                </div>

                <!-- Botonera Principal del Reproductor -->
                <div class="flex items-center justify-between gap-2 text-xs text-white">
                    <!-- Controles Izquierdos: Play/Pause, -10s, +10s, Volumen, Reloj -->
                    <div class="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            id="btn-vod-play-pause"
                            class="hover:text-primary transition-colors flex items-center"
                            title="Reproducir / Pausar (Espacio)"
                        >
                            <span id="vod-play-pause-icon" class="material-symbols-outlined text-xl">play_arrow</span>
                        </button>

                        <button
                            type="button"
                            id="btn-vod-rewind-10"
                            class="hover:text-primary transition-colors flex items-center text-gray-300"
                            title="Retroceder 10 segundos (Flecha Izquierda)"
                        >
                            <span class="material-symbols-outlined text-lg">replay_10</span>
                        </button>

                        <button
                            type="button"
                            id="btn-vod-forward-10"
                            class="hover:text-primary transition-colors flex items-center text-gray-300"
                            title="Adelantar 10 segundos (Flecha Derecha)"
                        >
                            <span class="material-symbols-outlined text-lg">forward_10</span>
                        </button>

                        <!-- Control de Volumen -->
                        <div class="hidden sm:flex items-center gap-1.5">
                            <button
                                type="button"
                                id="btn-vod-mute"
                                class="hover:text-primary transition-colors flex items-center text-gray-300"
                                title="Silenciar / Activar Audio (M)"
                            >
                                <span id="vod-volume-icon" class="material-symbols-outlined text-lg">volume_up</span>
                            </button>
                            <input
                                type="range"
                                id="vod-volume-slider"
                                min="0"
                                max="1"
                                step="0.05"
                                value="${classroomVODState.volume}"
                                class="w-16 h-1 bg-surface-high rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
                            >
                        </div>

                        <!-- Indicador Numérico de Tiempo (Actual / Total) -->
                        <div class="font-mono text-[11px] text-gray-300">
                            <span id="vod-current-time-text" class="text-white font-bold">00:00</span>
                            <span class="text-gray-500"> / </span>
                            <span id="vod-total-duration-text">${escapeHtml(classItem.duracion || "00:00")}</span>
                        </div>
                    </div>

                    <!-- Controles Derechos: Repetición A-B, Velocidad (1x-2x), Pantalla Completa Segura -->
                    <div class="flex items-center gap-2">
                        <!-- Botón de Bucle Clínico A-B -->
                        <button
                            type="button"
                            id="btn-vod-loop-ab"
                            class="px-2 py-0.5 rounded bg-surface/80 hover:bg-surface-high border border-surface-high text-[10px] font-mono font-bold text-gray-300 transition-all"
                            title="Repetir fragmento clínico en bucle (Punto A -> Punto B)"
                        >
                            LOOP A-B
                        </button>

                        <!-- Selector de Velocidad Académica -->
                        <button
                            type="button"
                            id="btn-vod-speed-cycle"
                            class="px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary text-[11px] font-mono font-extrabold transition-all"
                            title="Cambiar velocidad de reproducción"
                        >
                            ${classroomVODState.playbackRate}x
                        </button>

                        <!-- Pantalla Completa Protegida (Mantiene Marca de Agua DRM) -->
                        <button
                            type="button"
                            id="btn-vod-fullscreen"
                            class="hover:text-primary transition-colors flex items-center text-gray-200"
                            title="Pantalla completa con escudo DRM (F)"
                        >
                            <span id="vod-fullscreen-icon" class="material-symbols-outlined text-lg">fullscreen</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    renderTimelineChapterDots(classItem);
    renderVODBookmarksList(classItem.id);
    renderVODHistoryDrawerList();
}

// ============================================================================
// 4. EVENTOS DEL ELEMENTO <VIDEO>, CAPÍTULOS Y CONTROLES DEL REPRODUCTOR
// ============================================================================

/**
 * Enlaza los eventos nativos del elemento `<video id="classroom-vod-video">` para
 * sincronizar el deslizador de tiempo, capítulos activos y detección de fin de clase.
 * @param {HTMLVideoElement} videoEl
 * @param {Object} classItem
 */
function bindVODVideoElementEvents(videoEl, classItem) {
    if (!videoEl) return;

    // Aplicar velocidad y volumen preferidos por el estudiante
    videoEl.playbackRate = classroomVODState.playbackRate;
    videoEl.volume = classroomVODState.volume;
    videoEl.muted = classroomVODState.isMuted;

    videoEl.addEventListener("loadedmetadata", () => {
        if (videoEl.duration && !isNaN(videoEl.duration)) {
            classroomVODState.duration = Math.floor(videoEl.duration);
            const durText = document.getElementById("vod-total-duration-text");
            if (durText) {
                durText.textContent = formatSecondsToMMSS(classroomVODState.duration);
            }
            const headerDur = document.getElementById("active-class-duration");
            if (headerDur) {
                headerDur.textContent = formatSecondsToMMSS(classroomVODState.duration);
            }
            renderTimelineChapterDots(classItem);
        }
        videoEl.playbackRate = classroomVODState.playbackRate;
    });

    videoEl.addEventListener("play", () => {
        classroomVODState.isPlaying = true;
        updatePlayPauseUI(true);
    });

    videoEl.addEventListener("pause", () => {
        classroomVODState.isPlaying = false;
        updatePlayPauseUI(false);
        saveVODWatchProgress(false);
    });

    videoEl.addEventListener("timeupdate", () => {
        const currentSec = Math.floor(videoEl.currentTime || 0);
        classroomVODState.currentTime = currentSec;

        // Verificar bucle clínico A-B si está activo
        if (
            classroomVODState.loopAB.active &&
            classroomVODState.loopAB.pointA !== null &&
            classroomVODState.loopAB.pointB !== null &&
            videoEl.currentTime >= classroomVODState.loopAB.pointB
        ) {
            videoEl.currentTime = classroomVODState.loopAB.pointA;
        }

        // Actualizar etiqueta de tiempo y barra deslizante
        const currentText = document.getElementById("vod-current-time-text");
        if (currentText) {
            currentText.textContent = formatSecondsToMMSS(currentSec);
        }

        const slider = document.getElementById("vod-timeline-slider");
        const totalDur = videoEl.duration || classroomVODState.duration || 1;
        if (slider && totalDur > 0) {
            slider.value = String(((videoEl.currentTime / totalDur) * 100).toFixed(2));
        }

        // Resaltar el capítulo clínico actual según el segundo de reproducción
        syncActiveChapterIndicator(currentSec, classItem);
    });

    videoEl.addEventListener("ended", () => {
        classroomVODState.isPlaying = false;
        updatePlayPauseUI(false);
        markCurrentVODClassAsCompleted();
    });

    // Conmutar automáticamente al stream de respaldo si el enlace de Cloud Storage falla
    videoEl.addEventListener("error", () => {
        if (videoEl.dataset.fallbackApplied === "true") return;
        videoEl.dataset.fallbackApplied = "true";
        videoEl.src = FALLBACK_STREAM_URL;
        videoEl.load();
    });
}

/**
 * Enlaza los botones interactivos del HUD (Play, -10s, +10s, Velocidad, Loop A-B,
 * Pantalla Completa Segura, Reanudación, Historial y Marcadores).
 * @param {HTMLVideoElement} videoEl
 * @param {Object} classItem
 */
function bindVODHUDControlEvents(videoEl, classItem) {
    if (!videoEl) return;

    const togglePlay = () => {
        if (videoEl.paused) {
            videoEl.play().catch(() => {});
        } else {
            videoEl.pause();
        }
    };

    document.getElementById("btn-vod-play-pause")?.addEventListener("click", togglePlay);
    document.getElementById("btn-vod-big-play")?.addEventListener("click", togglePlay);
    videoEl.addEventListener("click", togglePlay);

    // Salto rápido -10s y +10s
    document.getElementById("btn-vod-rewind-10")?.addEventListener("click", () => {
        seekVODVideo(Math.max(0, videoEl.currentTime - 10), !videoEl.paused);
    });

    document.getElementById("btn-vod-forward-10")?.addEventListener("click", () => {
        const maxDur = videoEl.duration || classroomVODState.duration || 3600;
        seekVODVideo(Math.min(maxDur, videoEl.currentTime + 10), !videoEl.paused);
    });

    // Barra deslizante de línea de tiempo
    const timelineSlider = document.getElementById("vod-timeline-slider");
    timelineSlider?.addEventListener("input", (e) => {
        const pct = Number(e.target.value || 0);
        const totalDur = videoEl.duration || classroomVODState.duration || 0;
        if (totalDur > 0) {
            const targetSec = Math.floor((pct / 100) * totalDur);
            videoEl.currentTime = targetSec;
        }
    });

    // Volumen y silencio
    document.getElementById("btn-vod-mute")?.addEventListener("click", () => {
        videoEl.muted = !videoEl.muted;
        classroomVODState.isMuted = videoEl.muted;
        updateVolumeUI(videoEl.volume, videoEl.muted);
    });

    document.getElementById("vod-volume-slider")?.addEventListener("input", (e) => {
        const vol = Number(e.target.value ?? 1);
        videoEl.volume = vol;
        videoEl.muted = vol === 0;
        classroomVODState.volume = vol;
        classroomVODState.isMuted = videoEl.muted;
        updateVolumeUI(vol, videoEl.muted);
        saveVODPreferences();
    });

    // Selector cíclico de velocidad (0.75x -> 1x -> 1.25x -> 1.5x -> 1.75x -> 2x)
    document.getElementById("btn-vod-speed-cycle")?.addEventListener("click", () => {
        const currentIndex = VOD_PLAYBACK_RATES.indexOf(classroomVODState.playbackRate);
        const nextIndex = (currentIndex + 1) % VOD_PLAYBACK_RATES.length;
        setVODPlaybackRate(VOD_PLAYBACK_RATES[nextIndex]);
    });

    // Bucle de repetición A-B para segmentos complejos de clase
    document.getElementById("btn-vod-loop-ab")?.addEventListener("click", () => {
        handleLoopABButtonClick(videoEl);
    });

    // Pantalla completa sobre #classroom-player-viewport (para conservar la marca de agua DRM)
    document.getElementById("btn-vod-fullscreen")?.addEventListener("click", () => {
        toggleSecureDRMFullscreen();
    });

    // Banner de reanudación de progreso guardado
    document.getElementById("btn-vod-confirm-resume")?.addEventListener("click", () => {
        const saved = classroomVODState.watchHistory[classItem.id];
        if (saved && saved.lastSecond > 0) {
            seekVODVideo(saved.lastSecond, true);
        }
        document.getElementById("vod-resume-banner")?.classList.add("hidden");
    });

    document.getElementById("btn-vod-dismiss-resume")?.addEventListener("click", () => {
        document.getElementById("vod-resume-banner")?.classList.add("hidden");
    });

    // Cajón lateral de Historial de Clases Vistas
    document.getElementById("btn-vod-toggle-history-drawer")?.addEventListener("click", () => {
        toggleVODHistoryDrawer();
    });
    document.getElementById("btn-vod-close-history-drawer")?.addEventListener("click", () => {
        toggleVODHistoryDrawer(false);
    });

    // Cajón lateral de Marcadores Clínicos Personales
    document.getElementById("btn-vod-toggle-bookmarks")?.addEventListener("click", () => {
        toggleVODBookmarksDrawer();
    });
    document.getElementById("btn-vod-close-bookmarks-drawer")?.addEventListener("click", () => {
        toggleVODBookmarksDrawer(false);
    });

    document.getElementById("form-vod-new-bookmark")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const inputEl = document.getElementById("input-vod-bookmark-note");
        const noteText = inputEl?.value?.trim();
        if (noteText) {
            addStudentVODBookmark(noteText);
            inputEl.value = "";
        }
    });

    // Editor de capítulos para Administradores Maestros
    document.getElementById("btn-vod-admin-chapters")?.addEventListener("click", () => {
        openAdminVODChaptersModal(classItem);
    });
}

// ============================================================================
// 5. FUNCIONES PÚBLICAS DE CONTROL DE TIEMPO, VELOCIDAD Y CAPÍTULOS
// ============================================================================

/**
 * Salta al segundo exacto del reproductor `#classroom-vod-video`.
 * Invocada directamente por `classroom.controller.js` (`seekActiveClassroomVideo`)
 * y por los timestamps de `classroom.chat.js`.
 * @param {number} seconds
 * @param {boolean} [autoPlay=true]
 */
export function seekVODVideo(seconds = 0, autoPlay = true) {
    const safeSec = Math.max(0, Math.floor(Number(seconds) || 0));
    const videoEl = document.getElementById("classroom-vod-video");
    if (!videoEl) return;

    videoEl.currentTime = safeSec;
    classroomVODState.currentTime = safeSec;

    if (autoPlay) {
        videoEl.play().catch(() => {});
    }

    if (classroomVODState.activeClass) {
        syncActiveChapterIndicator(safeSec, classroomVODState.activeClass);
    }
}

/**
 * Devuelve el segundo actual de reproducción en `#classroom-vod-video`.
 * Invocada por `classroom.controller.js` (`getActiveVideoTimeSeconds`).
 * @returns {number}
 */
export function getCurrentVODTimeSeconds() {
    const videoEl = document.getElementById("classroom-vod-video");
    if (videoEl && typeof videoEl.currentTime === "number" && !isNaN(videoEl.currentTime)) {
        return Math.floor(videoEl.currentTime);
    }
    return classroomVODState.currentTime || 0;
}

/**
 * Cambia la velocidad de reproducción del video (`0.75x` a `2.0x`).
 * @param {number} rate
 */
export function setVODPlaybackRate(rate = 1.0) {
    const validRate = VOD_PLAYBACK_RATES.includes(Number(rate)) ? Number(rate) : 1.0;
    classroomVODState.playbackRate = validRate;

    const videoEl = document.getElementById("classroom-vod-video");
    if (videoEl) {
        videoEl.playbackRate = validRate;
    }

    const speedBtn = document.getElementById("btn-vod-speed-cycle");
    if (speedBtn) {
        speedBtn.textContent = `${validRate}x`;
    }

    saveVODPreferences();
}

/**
 * Pinta los puntos indicadores de cada capítulo clínico sobre la línea de tiempo
 * del reproductor para visualizar dónde inicia cada subtema.
 * @param {Object} classItem
 */
function renderTimelineChapterDots(classItem) {
    const markersContainer = document.getElementById("vod-timeline-chapter-markers");
    if (!markersContainer) return;

    const chapters = Array.isArray(classItem?.capitulos) ? classItem.capitulos : [];
    const totalDur = classroomVODState.duration || parseDurationStringToSeconds(classItem?.duracion) || 3600;

    if (chapters.length === 0 || totalDur <= 0) {
        markersContainer.innerHTML = "";
        return;
    }

    markersContainer.innerHTML = chapters.map((ch) => {
        const sec = Math.max(0, Number(ch.segundo) || 0);
        const leftPct = Math.min(98, Math.max(1, ((sec / totalDur) * 100).toFixed(2)));
        return `
            <span
                class="absolute w-2 h-2 rounded-full bg-secondary shadow-[0_0_6px_#00e676] -translate-x-1/2"
                style="left: ${leftPct}%;"
                title="${escapeHtml(ch.tiempo || formatSecondsToMMSS(sec))} • ${escapeHtml(ch.titulo)}"
            ></span>
        `;
    }).join("");
}

/**
 * Identifica qué capítulo clínico corresponde al segundo actual de reproducción,
 * actualiza la píldora superior del reproductor y resalta el botón en `#active-class-chapters-bar`.
 * @param {number} currentSeconds
 * @param {Object} classItem
 */
function syncActiveChapterIndicator(currentSeconds, classItem) {
    const chapters = Array.isArray(classItem?.capitulos) ? classItem.capitulos : [];
    if (chapters.length === 0) return;

    let matchedIdx = 0;
    for (let i = 0; i < chapters.length; i++) {
        const chSec = Number(chapters[i].segundo) || 0;
        if (currentSeconds >= chSec) {
            matchedIdx = i;
        }
    }

    if (matchedIdx === classroomVODState.activeChapterIndex) return;
    classroomVODState.activeChapterIndex = matchedIdx;

    const activeChapter = chapters[matchedIdx];
    const pill = document.getElementById("vod-active-chapter-pill");
    if (pill && activeChapter) {
        pill.textContent = `▶ ${activeChapter.titulo}`;
    }

    // Sincronizar el resaltado visual con los botones de capítulos en classroom.controller.js
    const chapterButtons = document.querySelectorAll("#active-class-chapters-bar .classroom-chapter-btn");
    chapterButtons.forEach((btn, idx) => {
        if (idx === matchedIdx) {
            btn.classList.add("border-primary", "bg-primary/20", "text-white");
        } else {
            btn.classList.remove("border-primary", "bg-primary/20", "text-white");
        }
    });
}

// ============================================================================
// 6. HISTORIAL COLAPSABLE DE CLASES GRABADAS Y MARCADORES DEL ESTUDIANTE
// ============================================================================

/**
 * Abre o cierra el cajón lateral colapsable con el historial de clases grabadas vistas.
 * @param {boolean} [forceState]
 */
export function toggleVODHistoryDrawer(forceState) {
    const drawer = document.getElementById("vod-history-drawer");
    if (!drawer) return;

    const nextState = typeof forceState === "boolean"
        ? forceState
        : drawer.classList.contains("hidden");

    classroomVODState.isHistoryDrawerOpen = nextState;
    drawer.classList.toggle("hidden", !nextState);

    if (nextState) {
        // Cerrar cajón de marcadores si estaba abierto para no solapar
        document.getElementById("vod-bookmarks-drawer")?.classList.add("hidden");
        renderVODHistoryDrawerList();
    }
}

/**
 * Abre o cierra el cajón lateral de marcadores clínicos personales del estudiante.
 * @param {boolean} [forceState]
 */
export function toggleVODBookmarksDrawer(forceState) {
    const drawer = document.getElementById("vod-bookmarks-drawer");
    if (!drawer) return;

    const nextState = typeof forceState === "boolean"
        ? forceState
        : drawer.classList.contains("hidden");

    classroomVODState.isBookmarksOpen = nextState;
    drawer.classList.toggle("hidden", !nextState);

    if (nextState) {
        document.getElementById("vod-history-drawer")?.classList.add("hidden");
        if (classroomVODState.activeClass) {
            renderVODBookmarksList(classroomVODState.activeClass.id);
        }
    }
}

/**
 * Agrega un marcador personal en el segundo actual de la clase activa.
 * @param {string} noteText
 */
export function addStudentVODBookmark(noteText) {
    const activeClass = classroomVODState.activeClass;
    if (!activeClass || !noteText) return null;

    const currentSec = getCurrentVODTimeSeconds();
    const classBookmarks = Array.isArray(classroomVODState.studentBookmarks[activeClass.id])
        ? classroomVODState.studentBookmarks[activeClass.id]
        : [];

    const newBookmark = {
        id: `bm_${Date.now()}`,
        second: currentSec,
        timeFormatted: formatSecondsToMMSS(currentSec),
        note: String(noteText).trim(),
        createdAt: new Date().toISOString()
    };

    classBookmarks.push(newBookmark);
    classBookmarks.sort((a, b) => a.second - b.second);
    classroomVODState.studentBookmarks[activeClass.id] = classBookmarks;

    persistVODBookmarksData();
    renderVODBookmarksList(activeClass.id);
    return newBookmark;
}

/**
 * Renderiza la lista de marcadores personales del alumno dentro del cajón lateral.
 * @param {string} classId
 */
function renderVODBookmarksList(classId) {
    const listEl = document.getElementById("vod-bookmarks-drawer-list");
    if (!listEl) return;

    const bookmarks = classroomVODState.studentBookmarks[classId] || [];
    if (bookmarks.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-gray-400 space-y-1">
                <span class="material-symbols-outlined text-2xl text-gray-500">bookmark_border</span>
                <p class="text-[11px]">
                    Aún no tienes notas de tiempo en esta clase. Escribe arriba para anclar un concepto al minuto actual.
                </p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = bookmarks.map((bm) => `
        <div class="p-2.5 rounded-xl bg-surface border border-surface-high hover:border-primary/50 transition-all flex items-start justify-between gap-2">
            <button
                type="button"
                data-seek-bm="${bm.second}"
                class="vod-bookmark-jump text-left flex-1 min-w-0 space-y-0.5"
            >
                <span class="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-extrabold">
                    ▶ ${escapeHtml(bm.timeFormatted)}
                </span>
                <p class="text-xs text-gray-200 font-bold leading-snug break-words pt-0.5">
                    ${escapeHtml(bm.note)}
                </p>
            </button>
            <button
                type="button"
                data-delete-bm="${bm.id}"
                class="vod-bookmark-delete text-gray-500 hover:text-danger text-xs font-bold px-1"
                title="Eliminar marcador"
            >
                ✕
            </button>
        </div>
    `).join("");

    listEl.querySelectorAll(".vod-bookmark-jump").forEach((btn) => {
        btn.addEventListener("click", () => {
            seekVODVideo(Number(btn.dataset.seekBm || 0), true);
        });
    });

    listEl.querySelectorAll(".vod-bookmark-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
            const bmId = btn.dataset.deleteBm;
            classroomVODState.studentBookmarks[classId] = (classroomVODState.studentBookmarks[classId] || [])
                .filter((item) => item.id !== bmId);
            persistVODBookmarksData();
            renderVODBookmarksList(classId);
        });
    });
}

/**
 * Renderiza el historial de clases grabadas vistas por el estudiante con barra de porcentaje.
 */
function renderVODHistoryDrawerList() {
    const listEl = document.getElementById("vod-history-drawer-list");
    if (!listEl) return;

    const entries = Object.values(classroomVODState.watchHistory || {})
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    if (entries.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-gray-400 space-y-1">
                <span class="material-symbols-outlined text-2xl text-gray-500">history_toggle_off</span>
                <p class="text-[11px]">
                    Tu historial de reproducción aparecerá aquí conforme avances en las clases grabadas.
                </p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = entries.map((item) => {
        const pct = Math.min(100, Math.max(0, Number(item.watchPercentage) || 0));
        return `
            <button
                type="button"
                data-history-class-id="${escapeHtml(item.classId)}"
                data-history-sec="${item.lastSecond || 0}"
                class="vod-history-item w-full text-left p-2.5 rounded-xl bg-surface border border-surface-high hover:border-secondary/50 transition-all space-y-1.5"
            >
                <div class="flex items-center justify-between text-[10px] font-mono">
                    <span class="${item.completed ? "text-secondary" : "text-primary"} font-extrabold">
                        ${item.completed ? "✓ COMPLETADA" : `⏱ Min ${formatSecondsToMMSS(item.lastSecond || 0)}`}
                    </span>
                    <span class="text-gray-400">${pct}% visto</span>
                </div>
                <div class="text-xs font-extrabold text-white line-clamp-2 leading-snug">
                    ${escapeHtml(item.title || item.classId)}
                </div>
                <div class="w-full h-1 bg-surface-high rounded-full overflow-hidden">
                    <div class="h-full ${item.completed ? "bg-secondary" : "bg-primary"}" style="width: ${pct}%;"></div>
                </div>
            </button>
        `;
    }).join("");

    listEl.querySelectorAll(".vod-history-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetClassId = btn.dataset.historyClassId;
            const targetSec = Number(btn.dataset.historySec || 0);

            if (classroomVODState.activeClass?.id === targetClassId) {
                seekVODVideo(targetSec, true);
                toggleVODHistoryDrawer(false);
            } else {
                // Si es otra clase del catálogo lateral, disparar clic en la tarjeta correspondiente
                const sidebarBtn = document.querySelector(`[data-select-class-id="${targetClassId}"]`);
                if (sidebarBtn) {
                    sidebarBtn.click();
                }
            }
        });
    });
}

// ============================================================================
// 7. PERSISTENCIA DE PROGRESO EN LOCALSTORAGE Y CLOUD FIRESTORE
// ============================================================================

/**
 * Guarda el progreso actual del estudiante en `localStorage` y opcionalmente en Cloud Firestore.
 * @param {boolean} [forceCloudSync=false]
 */
export async function saveVODWatchProgress(forceCloudSync = false) {
    const activeClass = classroomVODState.activeClass;
    if (!activeClass) return;

    const currentSec = getCurrentVODTimeSeconds();
    const totalDur = classroomVODState.duration || parseDurationStringToSeconds(activeClass.duracion) || 1;
    const pct = Math.min(100, Math.round((currentSec / totalDur) * 100));

    const prevRecord = classroomVODState.watchHistory[activeClass.id] || {};
    const isCompleted = Boolean(prevRecord.completed || pct >= 92);

    const updatedRecord = {
        classId: activeClass.id,
        title: activeClass.titulo,
        materia: activeClass.materia,
        lastSecond: currentSec,
        durationSeconds: totalDur,
        watchPercentage: Math.max(pct, prevRecord.watchPercentage || 0),
        completed: isCompleted,
        updatedAt: new Date().toISOString()
    };

    classroomVODState.watchHistory[activeClass.id] = updatedRecord;

    try {
        localStorage.setItem(
            VOD_STORAGE_KEYS.WATCH_HISTORY,
            JSON.stringify(classroomVODState.watchHistory)
        );
    } catch (e) {
        // Silencioso si localStorage está restringido
    }

    decorateSidebarCatalogWithWatchProgress();

    if (forceCloudSync && db && auth?.currentUser?.uid) {
        try {
            const uid = auth.currentUser.uid;
            await setDoc(
                doc(db, SAFE_COLLECTIONS.VOD_PROGRESS, `${uid}_${activeClass.id}`),
                {
                    uid,
                    ...updatedRecord
                },
                { merge: true }
            );
        } catch (e) {
            // Respaldo conservado en localStorage
        }
    }
}

/**
 * Marca la clase actual como 100% completada al finalizar el video.
 */
function markCurrentVODClassAsCompleted() {
    const activeClass = classroomVODState.activeClass;
    if (!activeClass) return;

    classroomVODState.watchHistory[activeClass.id] = {
        ...(classroomVODState.watchHistory[activeClass.id] || {}),
        classId: activeClass.id,
        title: activeClass.titulo,
        materia: activeClass.materia,
        lastSecond: 0,
        watchPercentage: 100,
        completed: true,
        updatedAt: new Date().toISOString()
    };

    saveVODWatchProgress(true);
    renderVODHistoryDrawerList();
}

/**
 * Recupera desde Cloud Firestore el progreso previo del estudiante para la clase seleccionada.
 * @param {string} classId
 */
async function syncStudentVODProgressFromCloud(classId) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || !classId) return;

    try {
        const snap = await getDoc(doc(db, SAFE_COLLECTIONS.VOD_PROGRESS, `${uid}_${classId}`));
        if (snap.exists()) {
            const cloudData = snap.data() || {};
            const localData = classroomVODState.watchHistory[classId];
            if (!localData || (cloudData.updatedAt || "") > (localData.updatedAt || "")) {
                classroomVODState.watchHistory[classId] = cloudData;
            }
        }
    } catch (e) {
        // Continúa con el registro local si opera en modo offline
    }
}

/**
 * Añade indicadores visuales de avance (`✓ Vista` o `%`) a las tarjetas del catálogo
 * lateral (`#classroom-catalog-list`) renderizadas por `classroom.controller.js`.
 */
function decorateSidebarCatalogWithWatchProgress() {
    const catalogButtons = document.querySelectorAll("#classroom-catalog-list .classroom-catalog-item");
    catalogButtons.forEach((btn) => {
        const classId = btn.dataset.selectClassId;
        const progress = classroomVODState.watchHistory[classId];
        if (!progress) return;

        let badge = btn.querySelector(".vod-sidebar-progress-pill");
        if (!badge) {
            badge = document.createElement("div");
            badge.className = "vod-sidebar-progress-pill pt-1 flex items-center justify-between text-[9px] font-mono";
            btn.appendChild(badge);
        }

        const pct = Math.min(100, Number(progress.watchPercentage) || 0);
        badge.innerHTML = `
            <span class="${progress.completed ? "text-secondary font-extrabold" : "text-primary"}">
                ${progress.completed ? "✓ Clase Completada" : `En progreso (${pct}%)`}
            </span>
            <span class="text-gray-500">${formatSecondsToMMSS(progress.lastSecond || 0)}</span>
        `;
    });
}

// ============================================================================
// 8. HERRAMIENTAS DE ADMINISTRADOR MAESTRO Y MODAL DE CAPÍTULOS EN VIVO
// ============================================================================

/**
 * Exclusivo para Administradores Maestros (`anthonnyvelastegui@gmail.com` y `aavemakaihc@gmail.com`):
 * Permite agregar capítulos clínicos en el segundo actual del video y actualizar Firestore.
 * @param {Object} classItem
 */
export function openAdminVODChaptersModal(classItem) {
    if (!isCurrentMasterAdmin() || !classItem) return;

    const currentSec = getCurrentVODTimeSeconds();
    let modal = document.getElementById("vod-admin-chapters-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "vod-admin-chapters-modal";
        modal.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-surface-container border border-secondary/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                        Editor VOD • Administrador Maestro
                    </span>
                    <h3 class="text-sm font-extrabold text-white">
                        Agregar Capítulo Clínico en ${formatSecondsToMMSS(currentSec)}
                    </h3>
                </div>
                <button type="button" id="btn-close-vod-admin-modal" class="text-gray-400 hover:text-white text-sm font-bold">
                    ✕
                </button>
            </div>

            <form id="form-vod-admin-add-chapter" class="p-4 space-y-3 text-xs">
                <div>
                    <label class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                        Título del Capítulo Clínico
                    </label>
                    <input
                        type="text"
                        id="input-admin-chapter-title"
                        placeholder="Ej: 04. Interpretación Gasométrica y Lactato"
                        class="w-full bg-surface border border-surface-high focus:border-secondary rounded-xl px-3 py-2 text-white outline-none"
                        required
                    >
                </div>
                <div>
                    <label class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                        Segundo de Inicio (mm:ss = ${formatSecondsToMMSS(currentSec)})
                    </label>
                    <input
                        type="number"
                        id="input-admin-chapter-sec"
                        value="${currentSec}"
                        min="0"
                        class="w-full bg-surface border border-surface-high focus:border-secondary rounded-xl px-3 py-2 text-white font-mono outline-none"
                        required
                    >
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        id="btn-cancel-vod-admin-modal"
                        class="px-4 py-2 rounded-xl bg-surface-high text-gray-300 font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 rounded-xl bg-secondary text-surface font-extrabold"
                    >
                        Guardar Capítulo
                    </button>
                </div>
            </form>
        </div>
    `;

    const closeModal = () => modal.remove();
    document.getElementById("btn-close-vod-admin-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-vod-admin-modal")?.addEventListener("click", closeModal);

    document.getElementById("form-vod-admin-add-chapter")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("input-admin-chapter-title")?.value?.trim();
        const sec = Math.max(0, Number(document.getElementById("input-admin-chapter-sec")?.value || 0));
        if (!title) return;

        if (!Array.isArray(classItem.capitulos)) {
            classItem.capitulos = [];
        }

        classItem.capitulos.push({
            titulo: title,
            segundo: sec,
            tiempo: formatSecondsToMMSS(sec)
        });
        classItem.capitulos.sort((a, b) => (Number(a.segundo) || 0) - (Number(b.segundo) || 0));

        renderTimelineChapterDots(classItem);

        // Actualizar también la barra de capítulos inferior de classroom.controller.js
        const chaptersBar = document.getElementById("active-class-chapters-bar");
        if (chaptersBar) {
            chaptersBar.innerHTML = classItem.capitulos.map((ch) => `
                <button
                    type="button"
                    data-chapter-sec="${ch.segundo || 0}"
                    class="classroom-chapter-btn px-3 py-1.5 rounded-xl bg-surface-container hover:bg-primary/15 border border-surface-high hover:border-primary text-xs text-gray-200 hover:text-white font-bold transition-all flex items-center gap-1.5"
                >
                    <span class="text-primary font-mono text-[11px]">▶ ${escapeHtml(ch.tiempo || "00:00")}</span>
                    <span>${escapeHtml(ch.titulo)}</span>
                </button>
            `).join("");

            chaptersBar.querySelectorAll(".classroom-chapter-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    seekVODVideo(Number(btn.dataset.chapterSec || 0), true);
                });
            });
        }

        if (db) {
            try {
                await updateDoc(doc(db, SAFE_COLLECTIONS.CLASSROOMS, classItem.id), {
                    capitulos: classItem.capitulos
                });
            } catch (err) {
                // Conservado en sesión local
            }
        }

        closeModal();
    });
}

// ============================================================================
// 9. UTILIDADES AUXILIARES, BUCLE A-B, PANTALLA COMPLETA DRM Y DESTRUCTOR
// ============================================================================

/**
 * Configura el bucle de repetición clínica A-B en 3 pasos: Fijar A -> Fijar B -> Desactivar.
 * @param {HTMLVideoElement} videoEl
 */
function handleLoopABButtonClick(videoEl) {
    const btn = document.getElementById("btn-vod-loop-ab");
    if (!videoEl || !btn) return;

    const loop = classroomVODState.loopAB;

    if (loop.pointA === null) {
        loop.pointA = Math.floor(videoEl.currentTime || 0);
        loop.pointB = null;
        loop.active = false;
        btn.textContent = `A: ${formatSecondsToMMSS(loop.pointA)} -> B?`;
        btn.className = "px-2 py-0.5 rounded bg-warning/20 border border-warning text-[10px] font-mono font-extrabold text-warning transition-all";
    } else if (loop.pointB === null) {
        const candidateB = Math.floor(videoEl.currentTime || 0);
        if (candidateB <= loop.pointA + 2) {
            loop.pointB = loop.pointA + 10;
        } else {
            loop.pointB = candidateB;
        }
        loop.active = true;
        btn.textContent = `🔁 ${formatSecondsToMMSS(loop.pointA)}-${formatSecondsToMMSS(loop.pointB)}`;
        btn.className = "px-2 py-0.5 rounded bg-secondary/20 border border-secondary text-[10px] font-mono font-extrabold text-secondary transition-all";
    } else {
        loop.pointA = null;
        loop.pointB = null;
        loop.active = false;
        btn.textContent = "LOOP A-B";
        btn.className = "px-2 py-0.5 rounded bg-surface/80 hover:bg-surface-high border border-surface-high text-[10px] font-mono font-bold text-gray-300 transition-all";
    }
}

/**
 * Solicita pantalla completa sobre `#classroom-player-viewport` (y no sobre el `<video>` suelto)
 * para garantizar que `#classroom-drm-watermark-layer` y `#classroom-drm-blackout-curtain`
 * sigan protegiendo la transmisión en modo pantalla completa.
 */
function toggleSecureDRMFullscreen() {
    const viewport = document.getElementById("classroom-player-viewport") ||
        document.getElementById("classroom-vod-wrapper");
    if (!viewport) return;

    const icon = document.getElementById("vod-fullscreen-icon");

    if (!document.fullscreenElement) {
        viewport.requestFullscreen?.().then(() => {
            if (icon) icon.textContent = "fullscreen_exit";
        }).catch(() => {});
    } else {
        document.exitFullscreen?.().then(() => {
            if (icon) icon.textContent = "fullscreen";
        }).catch(() => {});
    }
}

/**
 * Escucha atajos de teclado de reproducción cuando el alumno está en `#view-classrooms`
 * sin el foco en un campo de texto, y reacciona ante alertas del escudo DRM.
 */
function bindGlobalVODKeyboardAndDRMEvents() {
    boundKeyboardShortcutsHandler = (e) => {
        const view = document.getElementById("view-classrooms");
        if (!view || view.classList.contains("hidden")) return;

        const activeTag = (document.activeElement?.tagName || "").toUpperCase();
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;

        const videoEl = document.getElementById("classroom-vod-video");
        if (!videoEl) return;

        if (e.code === "Space" || e.key === "k") {
            e.preventDefault();
            if (videoEl.paused) videoEl.play().catch(() => {});
            else videoEl.pause();
        } else if (e.key === "ArrowLeft" || e.key === "j") {
            e.preventDefault();
            seekVODVideo(Math.max(0, videoEl.currentTime - 10), !videoEl.paused);
        } else if (e.key === "ArrowRight" || e.key === "l") {
            e.preventDefault();
            seekVODVideo(videoEl.currentTime + 10, !videoEl.paused);
        } else if (e.key === "m" || e.key === "M") {
            e.preventDefault();
            document.getElementById("btn-vod-mute")?.click();
        } else if (e.key === "f" || e.key === "F") {
            e.preventDefault();
            toggleSecureDRMFullscreen();
        }
    };

    boundDRMBlackoutListener = () => {
        const videoEl = document.getElementById("classroom-vod-video");
        videoEl?.pause?.();
        updatePlayPauseUI(false);
    };

    window.addEventListener("keydown", boundKeyboardShortcutsHandler);
    window.addEventListener("makai:drmBlackoutActivated", boundDRMBlackoutListener);
}

/**
 * Inicia el temporizador de guardado periódico del progreso de reproducción.
 */
function startVODProgressAutoSave() {
    if (classroomVODState.progressSyncIntervalId) {
        clearInterval(classroomVODState.progressSyncIntervalId);
    }

    classroomVODState.progressSyncIntervalId = setInterval(() => {
        if (classroomVODState.isPlaying) {
            saveVODWatchProgress(true);
        }
    }, 12000);
}

/**
 * Limpia intervalos y escuchadores activos del reproductor VOD.
 */
function clearVODTimersAndListeners() {
    if (classroomVODState.progressSyncIntervalId) {
        clearInterval(classroomVODState.progressSyncIntervalId);
        classroomVODState.progressSyncIntervalId = null;
    }
    if (boundKeyboardShortcutsHandler) {
        window.removeEventListener("keydown", boundKeyboardShortcutsHandler);
        boundKeyboardShortcutsHandler = null;
    }
    if (boundDRMBlackoutListener) {
        window.removeEventListener("makai:drmBlackoutActivated", boundDRMBlackoutListener);
        boundDRMBlackoutListener = null;
    }
}

/**
 * Destruye la sesión activa del reproductor VOD al salir de la vista o cambiar a modo Live.
 */
export function destroyClassroomVOD() {
    saveVODWatchProgress(true);
    clearVODTimersAndListeners();
    const videoEl = document.getElementById("classroom-vod-video");
    videoEl?.pause?.();
    classroomVODState.initialized = false;
}

/**
 * Actualiza los íconos de Play/Pause en la barra inferior y el botón central.
 * @param {boolean} isPlaying
 */
function updatePlayPauseUI(isPlaying) {
    const bottomIcon = document.getElementById("vod-play-pause-icon");
    const bigPlayBtn = document.getElementById("btn-vod-big-play");

    if (bottomIcon) {
        bottomIcon.textContent = isPlaying ? "pause" : "play_arrow";
    }
    if (bigPlayBtn) {
        bigPlayBtn.classList.toggle("opacity-0", isPlaying);
        bigPlayBtn.classList.toggle("pointer-events-none", isPlaying);
    }
}

/**
 * Actualiza el ícono de volumen según el nivel actual o estado de silencio.
 * @param {number} volume
 * @param {boolean} isMuted
 */
function updateVolumeUI(volume, isMuted) {
    const icon = document.getElementById("vod-volume-icon");
    if (!icon) return;

    if (isMuted || volume === 0) {
        icon.textContent = "volume_off";
    } else if (volume < 0.5) {
        icon.textContent = "volume_down";
    } else {
        icon.textContent = "volume_up";
    }
}

/**
 * Carga preferencias de velocidad, volumen, historial y marcadores desde `localStorage`.
 */
function loadLocalVODStorageData() {
    try {
        const rawHistory = localStorage.getItem(VOD_STORAGE_KEYS.WATCH_HISTORY);
        if (rawHistory) {
            classroomVODState.watchHistory = JSON.parse(rawHistory) || {};
        }

        const rawBookmarks = localStorage.getItem(VOD_STORAGE_KEYS.BOOKMARKS);
        if (rawBookmarks) {
            classroomVODState.studentBookmarks = JSON.parse(rawBookmarks) || {};
        }

        const rawPrefs = localStorage.getItem(VOD_STORAGE_KEYS.PREFERENCES);
        if (rawPrefs) {
            const prefs = JSON.parse(rawPrefs) || {};
            if (VOD_PLAYBACK_RATES.includes(Number(prefs.playbackRate))) {
                classroomVODState.playbackRate = Number(prefs.playbackRate);
            }
            if (typeof prefs.volume === "number") {
                classroomVODState.volume = Math.min(1, Math.max(0, prefs.volume));
            }
        }
    } catch (e) {
        // Valores por defecto en memoria
    }
}

/**
 * Guarda los marcadores personales del estudiante en `localStorage`.
 */
function persistVODBookmarksData() {
    try {
        localStorage.setItem(
            VOD_STORAGE_KEYS.BOOKMARKS,
            JSON.stringify(classroomVODState.studentBookmarks)
        );
    } catch (e) {
        // Silencioso
    }
}

/**
 * Guarda las preferencias de velocidad y volumen del estudiante.
 */
function saveVODPreferences() {
    try {
        localStorage.setItem(
            VOD_STORAGE_KEYS.PREFERENCES,
            JSON.stringify({
                playbackRate: classroomVODState.playbackRate,
                volume: classroomVODState.volume
            })
        );
    } catch (e) {
        // Silencioso
    }
}

/**
 * Normaliza enlaces de video de Google Cloud Storage o rutas locales hacia `assets/`.
 * @param {string} rawUrl
 * @returns {string}
 */
function resolveCloudStorageStreamUrl(rawUrl = "") {
    const clean = String(rawUrl || "").trim();
    if (!clean) return FALLBACK_STREAM_URL;
    if (clean.startsWith("gs://")) {
        const bucketPath = clean.replace("gs://", "");
        const slashIdx = bucketPath.indexOf("/");
        if (slashIdx > 0) {
            const bucket = bucketPath.slice(0, slashIdx);
            const objectPath = encodeURIComponent(bucketPath.slice(slashIdx + 1));
            return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectPath}?alt=media`;
        }
    }
    return clean;
}

/**
 * Verifica si el estudiante posee el nivel de suscripción requerido para reproducir el VOD.
 * @param {Object} classItem
 * @returns {boolean}
 */
function verifyVODSubscriptionPermission(classItem) {
    if (!classItem) return false;
    if (isCurrentMasterAdmin()) return true;

    const requiredTier = classItem.nivelSuscripcion || "Básico";
    if (typeof canAccessBySubscription === "function") {
        return canAccessBySubscription(requiredTier);
    }

    const userTier = appState?.currentUserData?.subscriptionLevel || "Básico";
    const rank = { "Básico": 1, "PRO": 2, "VIP": 3 };
    return (rank[userTier] || 1) >= (rank[requiredTier] || 1);
}

/**
 * Renderiza una pantalla de bloqueo dentro del escenario VOD si el estudiante no tiene el plan requerido.
 * @param {HTMLElement} mountEl
 * @param {Object} classItem
 */
function renderVODLockedPaywall(mountEl, classItem) {
    const requiredTier = classItem?.nivelSuscripcion || "PRO";
    const planParam = requiredTier === "VIP" ? "vip" : "pro_anual";

    mountEl.innerHTML = `
        <div class="w-full h-full bg-[#060a10] flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-warning/15 border border-warning/40 flex items-center justify-center text-warning">
                <span class="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div class="max-w-md space-y-1">
                <span class="px-2.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-mono font-extrabold uppercase">
                    Clase Grabada Exclusiva • Plan ${escapeHtml(requiredTier)}
                </span>
                <h4 class="text-base font-extrabold text-white">
                    ${escapeHtml(classItem?.titulo || "Sesión Clínica MakaiAcademy")}
                </h4>
                <p class="text-xs text-gray-400">
                    Desbloquea el catálogo completo de clases grabadas en alta definición con tu suscripción Makai ${escapeHtml(requiredTier)}.
                </p>
            </div>
            <a
                href="registro.html?plan=${planParam}&pago=qr"
                class="px-5 py-2.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all"
            >
                Actualizar a Plan ${escapeHtml(requiredTier)}
            </a>
        </div>
    `;
}

/**
 * Convierte una cadena de duración (`"58:20"` o `"01:12:45"`) en segundos totales.
 * @param {string} durationStr
 * @returns {number}
 */
function parseDurationStringToSeconds(durationStr = "") {
    const parts = String(durationStr || "").trim().split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Formatea segundos numéricos a formato reloj `MM:SS` o `HH:MM:SS`.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToMMSS(totalSeconds = 0) {
    const secNum = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(secNum / 3600);
    const minutes = Math.floor((secNum % 3600) / 60);
    const seconds = secNum % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Comprueba si el usuario actual posee privilegios de Administrador Maestro.
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
