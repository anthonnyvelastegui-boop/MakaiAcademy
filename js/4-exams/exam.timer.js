/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — SUBCOMPONENTE DE CRONÓMETRO CACES
 * Archivo: js/4-exams/exam.timer.js
 * Propósito: Control aislado del cronómetro regresivo (#exam-timer),
 *            sincronización anti-desfase en segundo plano, alertas visuales
 *            de tiempo crítico y disparo automático de calificación al expirar.
 * ============================================================================
 */

import {
    appState,
    setExamSessionState
} from "../2-core/state.store.js";

// --- CONFIGURACIÓN OFICIAL DE TIEMPOS POR MODALIDAD (EN SEGUNDOS) ---
export const EXAM_TIME_LIMITS = Object.freeze({
    standard: 150 * 60, // 150 minutos (9000 s) — Modo Estándar CACES (100 reactivos)
    tutor: 30 * 60,     // 30 minutos  (1800 s) — Práctica Rápida / Modo Tutor (20 reactivos)
    critical: 45 * 60   // 45 minutos  (2700 s) — Refuerzo Crítico (30 reactivos)
});

// --- UMBRALES DE ALERTA VISUAL (EN SEGUNDOS) ---
const WARNING_THRESHOLD_SECONDS = 15 * 60; // 15 minutos restantes
const DANGER_THRESHOLD_SECONDS = 5 * 60;   // 5 minutos restantes

// --- ESTADO INTERNO DEL SUBCOMPONENTE ---
let timerInitialized = false;
let activeIntervalId = null;
let targetEndTimestamp = null;
let initialDurationSeconds = 0;
let remainingSeconds = 0;
let isTimerPaused = false;
let timeExpiredCallback = null;
let warningNotified15m = false;
let warningNotified5m = false;

/**
 * Inicializa el subcomponente del cronómetro y registra callbacks opcionales.
 * @param {Object} options - Opciones de configuración ({ onTimeUp: Function })
 */
export function initExamTimer(options = {}) {
    if (typeof options.onTimeUp === "function") {
        timeExpiredCallback = options.onTimeUp;
    }

    if (!timerInitialized) {
        // Sincronizar inmediatamente cuando el usuario regresa a la pestaña del navegador
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && activeIntervalId && !isTimerPaused) {
                syncRemainingTimeFromClock();
            }
        });

        // Exponer utilidades en el espacio global para coordinación entre módulos de 4-exams
        window.MakaiExamTimer = {
            initExamTimer,
            startExamTimer,
            stopExamTimer,
            pauseExamTimer,
            resumeExamTimer,
            resetExamTimerDisplay,
            getExamTimeStats,
            formatSecondsToHMS,
            registerTimeUpCallback
        };

        timerInitialized = true;
    }

    // Mostrar estado inicial limpio en el DOM si no hay examen activo
    if (!appState.isExamActive) {
        updateTimerDOM(appState.examTimeRemaining || 0, "idle");
    }
}

/**
 * Registra la función que se ejecutará automáticamente cuando el reloj llegue a 00:00:00.
 * @param {Function} callback - Función de cierre/calificación (ej. submitExam)
 */
export function registerTimeUpCallback(callback) {
    if (typeof callback === "function") {
        timeExpiredCallback = callback;
    }
}

/**
 * Resuelve el límite de segundos según el modo ("standard", "tutor", "critical") o número directo.
 * @param {string|number} modeOrSeconds
 * @returns {number} Segundos totales asignados
 */
export function resolveModeDurationSeconds(modeOrSeconds) {
    if (typeof modeOrSeconds === "number" && Number.isFinite(modeOrSeconds) && modeOrSeconds > 0) {
        return Math.floor(modeOrSeconds);
    }

    const modeKey = String(modeOrSeconds || appState.currentMode || "tutor").toLowerCase().trim();
    return EXAM_TIME_LIMITS[modeKey] || EXAM_TIME_LIMITS.tutor;
}

/**
 * Inicia el cronómetro regresivo del simulacro activo.
 * @param {string|number} modeOrSeconds - Modo ("standard", "tutor", "critical") o segundos personalizados
 * @param {Function} [onTimeUpCallback] - Callback opcional al agotarse el tiempo
 * @returns {number} Segundos iniciales configurados
 */
export function startExamTimer(modeOrSeconds = null, onTimeUpCallback = null) {
    // 1. Limpiar cualquier intervalo previo para evitar relojes duplicados
    stopExamTimer();

    if (typeof onTimeUpCallback === "function") {
        timeExpiredCallback = onTimeUpCallback;
    }

    // 2. Determinar duración total según modalidad activa
    initialDurationSeconds = resolveModeDurationSeconds(modeOrSeconds);
    remainingSeconds = initialDurationSeconds;
    isTimerPaused = false;
    warningNotified15m = false;
    warningNotified5m = false;

    // 3. Fijar marca de tiempo exacta de expiración (protección contra pestañas en segundo plano)
    targetEndTimestamp = Date.now() + (remainingSeconds * 1000);

    // 4. Pintar inmediatamente el segundo inicial (ej. 02:30:00, 00:30:00 o 00:45:00)
    updateTimerDOM(remainingSeconds);

    // 5. Crear intervalo principal cada 1000 ms
    activeIntervalId = setInterval(() => {
        if (isTimerPaused) return;
        syncRemainingTimeFromClock();
    }, 1000);

    // 6. Sincronizar con state.store.js
    setExamSessionState({
        examTimerInterval: activeIntervalId,
        examTimeRemaining: remainingSeconds
    });

    // Disparar evento informativo para otros módulos (HUD, telemetría)
    window.dispatchEvent(new CustomEvent("makai:examTimerStarted", {
        detail: {
            mode: appState.currentMode,
            initialSeconds: initialDurationSeconds,
            targetEndTimestamp
        }
    }));

    return initialDurationSeconds;
}

/**
 * Calcula el tiempo real restante usando el reloj del sistema y actualiza la interfaz.
 */
function syncRemainingTimeFromClock() {
    if (!targetEndTimestamp) return;

    const now = Date.now();
    const diffSeconds = Math.max(0, Math.ceil((targetEndTimestamp - now) / 1000));
    remainingSeconds = diffSeconds;

    // Actualizar memoria global en state.store.js
    appState.examTimeRemaining = remainingSeconds;

    // Pintar en #exam-timer
    updateTimerDOM(remainingSeconds);

    // Verificar umbrales de advertencia (solo en simulacros que duren más que el umbral)
    checkTimeThresholds(remainingSeconds);

    // Si el tiempo llegó a cero, cerrar y calificar automáticamente
    if (remainingSeconds <= 0) {
        handleTimeExpired();
    }
}

/**
 * Detiene por completo el cronómetro activo y limpia los intervalos en memoria.
 */
export function stopExamTimer() {
    if (activeIntervalId !== null) {
        clearInterval(activeIntervalId);
        activeIntervalId = null;
    }

    if (appState.examTimerInterval) {
        clearInterval(appState.examTimerInterval);
    }

    isTimerPaused = false;
    targetEndTimestamp = null;

    setExamSessionState({
        examTimerInterval: null,
        examTimeRemaining: remainingSeconds
    });
}

/**
 * Pausa temporalmente el cronómetro conservando los segundos restantes.
 * @returns {number} Segundos restantes al momento de pausar
 */
export function pauseExamTimer() {
    if (!activeIntervalId || isTimerPaused) return remainingSeconds;

    // Calcular con exactitud antes de congelar
    if (targetEndTimestamp) {
        remainingSeconds = Math.max(0, Math.ceil((targetEndTimestamp - Date.now()) / 1000));
    }

    isTimerPaused = true;
    targetEndTimestamp = null;
    updateTimerDOM(remainingSeconds, "paused");

    window.dispatchEvent(new CustomEvent("makai:examTimerPaused", {
        detail: { remainingSeconds }
    }));

    return remainingSeconds;
}

/**
 * Reanuda el cronómetro desde los segundos restantes almacenados.
 * @returns {number} Segundos restantes al reanudar
 */
export function resumeExamTimer() {
    if (!activeIntervalId || !isTimerPaused || remainingSeconds <= 0) return remainingSeconds;

    targetEndTimestamp = Date.now() + (remainingSeconds * 1000);
    isTimerPaused = false;
    updateTimerDOM(remainingSeconds);

    window.dispatchEvent(new CustomEvent("makai:examTimerResumed", {
        detail: { remainingSeconds, targetEndTimestamp }
    }));

    return remainingSeconds;
}

/**
 * Reinicia visualmente el marcador #exam-timer a 00:00:00 y restaura su color original.
 */
export function resetExamTimerDisplay() {
    stopExamTimer();
    initialDurationSeconds = 0;
    remainingSeconds = 0;
    updateTimerDOM(0, "idle");
}

/**
 * Convierte segundos totales al formato estándar HH:MM:SS.
 * @param {number} totalSeconds
 * @returns {string} Cadena formateada (ej. "02:30:00")
 */
export function formatSecondsToHMS(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(safeSeconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, "0");
    const s = (safeSeconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/**
 * Actualiza exclusivamente el nodo #exam-timer y el color de su contenedor táctico
 * sin alterar ningún otro elemento de la vista del simulador.
 * @param {number} seconds
 * @param {string} [forcedState] - "idle" | "paused" | null
 */
export function updateTimerDOM(seconds, forcedState = null) {
    const timerEl = document.getElementById("exam-timer");
    if (!timerEl) return;

    timerEl.textContent = formatSecondsToHMS(seconds);

    // Localizar contenedor e ícono de reloj adyacente para feedback visual
    const badgeContainer = timerEl.parentElement;
    const iconEl = badgeContainer?.querySelector(".material-symbols-outlined");

    // Determinar estado cromático según el tiempo restante
    let visualState = forcedState;
    if (!visualState) {
        if (seconds <= 0) {
            visualState = "danger";
        } else if (seconds <= DANGER_THRESHOLD_SECONDS) {
            visualState = "danger";
        } else if (seconds <= WARNING_THRESHOLD_SECONDS && initialDurationSeconds > WARNING_THRESHOLD_SECONDS) {
            visualState = "warning";
        } else {
            visualState = "normal";
        }
    }

    // Limpiar clases previas de color en el texto del cronómetro
    timerEl.classList.remove("text-primary", "text-warning", "text-danger", "text-gray-400", "animate-pulse");

    if (iconEl) {
        iconEl.classList.remove("text-primary", "text-warning", "text-danger", "text-gray-400", "animate-pulse");
    }

    if (badgeContainer) {
        badgeContainer.classList.remove(
            "border-primary/30",
            "border-warning/60",
            "border-danger",
            "border-gray-600",
            "bg-danger/10",
            "bg-warning/10"
        );
    }

    // Aplicar paleta Cyber-Medical según el estado
    if (visualState === "danger") {
        timerEl.classList.add("text-danger", "animate-pulse");
        iconEl?.classList.add("text-danger", "animate-pulse");
        badgeContainer?.classList.add("border-danger", "bg-danger/10");
        if (iconEl) iconEl.textContent = "alarm";
    } else if (visualState === "warning") {
        timerEl.classList.add("text-warning");
        iconEl?.classList.add("text-warning");
        badgeContainer?.classList.add("border-warning/60", "bg-warning/10");
        if (iconEl) iconEl.textContent = "schedule";
    } else if (visualState === "paused") {
        timerEl.classList.add("text-gray-400");
        iconEl?.classList.add("text-gray-400");
        badgeContainer?.classList.add("border-gray-600");
        if (iconEl) iconEl.textContent = "pause_circle";
    } else {
        // Estado normal o idle (Cian Neón #00e5ff)
        timerEl.classList.add("text-primary");
        iconEl?.classList.add("text-primary");
        badgeContainer?.classList.add("border-primary/30");
        if (iconEl) iconEl.textContent = "timer";
    }
}

/**
 * Emite avisos tácticos no intrusivos cuando restan 15 minutos y 5 minutos.
 * @param {number} seconds
 */
function checkTimeThresholds(seconds) {
    if (
        !warningNotified15m &&
        initialDurationSeconds > WARNING_THRESHOLD_SECONDS &&
        seconds === WARNING_THRESHOLD_SECONDS
    ) {
        warningNotified15m = true;
        window.dispatchEvent(new CustomEvent("makai:examTimerWarning", {
            detail: { minutesLeft: 15, remainingSeconds: seconds }
        }));
    }

    if (
        !warningNotified5m &&
        initialDurationSeconds > DANGER_THRESHOLD_SECONDS &&
        seconds === DANGER_THRESHOLD_SECONDS
    ) {
        warningNotified5m = true;
        window.dispatchEvent(new CustomEvent("makai:examTimerCritical", {
            detail: { minutesLeft: 5, remainingSeconds: seconds }
        }));
    }
}

/**
 * Se ejecuta automáticamente cuando el cronómetro llega a 00:00:00.
 * Detiene el reloj y dispara la entrega y calificación del simulacro.
 */
function handleTimeExpired() {
    stopExamTimer();
    remainingSeconds = 0;
    updateTimerDOM(0, "danger");

    // Emitir evento global de expiración para cualquier módulo suscrito
    window.dispatchEvent(new CustomEvent("makai:examTimeExpired", {
        detail: {
            mode: appState.currentMode,
            career: appState.currentCareer,
            totalQuestions: (appState.examQuestions || []).length,
            answeredCount: Object.keys(appState.userAnswers || {}).length
        }
    }));

    // Ejecutar callback directo de calificación (submitExam)
    if (typeof timeExpiredCallback === "function") {
        timeExpiredCallback();
    } else if (typeof window.MakaiExams?.submitExam === "function") {
        window.MakaiExams.submitExam();
    } else if (typeof window.MakaiGrader?.submitExam === "function") {
        window.MakaiGrader.submitExam();
    }
}

/**
 * Devuelve las métricas de tiempo empleadas en el simulacro actual o recién concluido.
 * Ideal para enriquecer el reporte final en exam.grader.js.
 * @returns {Object} Estadísticas de tiempo del examen
 */
export function getExamTimeStats() {
    const elapsedSeconds = Math.max(0, initialDurationSeconds - remainingSeconds);
    const answeredCount = Object.keys(appState.userAnswers || {}).length;
    const avgSecondsPerQuestion = answeredCount > 0
        ? Math.round(elapsedSeconds / answeredCount)
        : 0;

    return {
        mode: appState.currentMode,
        initialDurationSeconds,
        remainingSeconds,
        elapsedSeconds,
        formattedInitial: formatSecondsToHMS(initialDurationSeconds),
        formattedRemaining: formatSecondsToHMS(remainingSeconds),
        formattedElapsed: formatSecondsToHMS(elapsedSeconds),
        avgSecondsPerQuestion,
        isPaused: isTimerPaused,
        isRunning: activeIntervalId !== null && !isTimerPaused
    };
}
