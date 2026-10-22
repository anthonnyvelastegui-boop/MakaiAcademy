/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — SUBCOMPONENTE DE MATRIZ DE REACTIVOS
 * Archivo: js/4-exams/exam.matrix.js
 * Propósito: Gestión de la cuadrícula de navegación rápida (#matrix-grid),
 *            código de colores por estado (respondido, pendiente, revisión),
 *            banderas de duda clínica (markedForReview) y salto entre casos.
 * ============================================================================
 */

import {
    appState,
    setExamSessionState,
    subscribeToState
} from "../2-core/state.store.js";

// --- ESTADO INTERNO DEL SUBCOMPONENTE DE MATRIZ ---
let matrixFilterMode = "all"; // "all" | "pending" | "review" | "answered"
let externalQuestionRenderer = null;
let matrixEventsBound = false;
let stateUnsubscribe = null;

/**
 * Normaliza y asegura que `markedForReview` sea siempre una instancia de Set
 * tanto en memoria local como en `appState`.
 * @returns {Set<number>}
 */
function ensureMarkedSet() {
    if (!(appState.markedForReview instanceof Set)) {
        const initialArray = Array.isArray(appState.markedForReview)
            ? appState.markedForReview
            : [];
        appState.markedForReview = new Set(initialArray);
    }
    return appState.markedForReview;
}

/**
 * Obtiene la lista de reactivos activos del simulacro desde `appState`.
 * @returns {Array<Object>}
 */
function getActiveQuestions() {
    return Array.isArray(appState.examQuestions) ? appState.examQuestions : [];
}

/**
 * Obtiene el mapa de respuestas del estudiante desde `appState`.
 * @returns {Object}
 */
function getActiveUserAnswers() {
    return appState.userAnswers && typeof appState.userAnswers === "object"
        ? appState.userAnswers
        : {};
}

/**
 * Registra una función callback externa (p. ej. `renderExamQuestion` desde
 * `exam.renderer.js` o `exam.controller.js`) para ejecutarse al saltar de pregunta.
 * @param {Function} renderFn
 */
export function registerQuestionRendererCallback(renderFn) {
    if (typeof renderFn === "function") {
        externalQuestionRenderer = renderFn;
    }
}

/**
 * Dispara la actualización visual de la pregunta clínica activa a través del
 * callback registrado, función global o evento personalizado `makai:questionChanged`.
 * @param {number} index
 */
function triggerQuestionRender(index) {
    if (typeof externalQuestionRenderer === "function") {
        externalQuestionRenderer(index);
    } else if (typeof window.renderExamQuestion === "function") {
        window.renderExamQuestion(index);
    }

    window.dispatchEvent(
        new CustomEvent("makai:questionChanged", {
            detail: {
                questionIndex: index,
                question: getActiveQuestions()[index] || null
            }
        })
    );
}

/**
 * Calcula en tiempo real las métricas de avance de la matriz de reactivos.
 * @returns {{
 *   total: number,
 *   answered: number,
 *   pending: number,
 *   review: number,
 *   correctTutor: number,
 *   incorrectTutor: number,
 *   percentage: number
 * }}
 */
export function getMatrixProgressSummary() {
    const questions = getActiveQuestions();
    const answers = getActiveUserAnswers();
    const markedSet = ensureMarkedSet();

    const total = questions.length;
    let answered = 0;
    let correctTutor = 0;
    let incorrectTutor = 0;

    for (let i = 0; i < total; i++) {
        const ans = answers[i];
        if (ans !== undefined && ans !== null && ans.chosen) {
            answered++;
            if (ans.isCorrect === true) correctTutor++;
            if (ans.isCorrect === false) incorrectTutor++;
        }
    }

    const pending = Math.max(0, total - answered);
    const review = markedSet.size;
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
        total,
        answered,
        pending,
        review,
        correctTutor,
        incorrectTutor,
        percentage
    };
}

/**
 * Inyecta (si no existen en `dashboard.html`) los controles tácticos de la matriz:
 * - Botón para Marcar/Desmarcar reactivo para revisión (`#btn-mark-review`)
 * - Barra de progreso y contadores rápidos (Respondidas / Pendientes / Revisión)
 * - Píldoras de filtrado rápido y botón de salto a siguiente pendiente
 */
function ensureMatrixAuxiliaryUI() {
    const grid = document.getElementById("matrix-grid");
    if (!grid || !grid.parentElement) return;

    const parentPanel = grid.parentElement;

    // 1. Inyectar cabecera de estadísticas y filtros antes de #matrix-grid
    if (!document.getElementById("matrix-tactical-toolbar")) {
        const toolbar = document.createElement("div");
        toolbar.id = "matrix-tactical-toolbar";
        toolbar.className = "mb-3 space-y-2.5 text-xs font-mono";
        toolbar.innerHTML = `
            <!-- Barra de Progreso del Simulacro -->
            <div class="bg-surface p-2.5 rounded-xl border border-surface-high">
                <div class="flex items-center justify-between text-[11px] mb-1.5">
                    <span class="text-gray-400 uppercase tracking-wider">Avance Matriz</span>
                    <span id="matrix-progress-label" class="text-primary font-bold">0 / 0 (0%)</span>
                </div>
                <div class="w-full h-1.5 bg-surface-high rounded-full overflow-hidden">
                    <div id="matrix-progress-bar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
                </div>
                <!-- Contadores de Estado -->
                <div class="grid grid-cols-3 gap-1.5 mt-2.5 text-[10px] text-center">
                    <button type="button" data-matrix-filter="answered" class="matrix-filter-btn p-1.5 rounded-lg bg-surface-container border border-surface-high hover:border-primary transition-colors">
                        <span class="block text-primary font-extrabold text-xs" id="matrix-count-answered">0</span>
                        <span class="text-gray-400">Listas</span>
                    </button>
                    <button type="button" data-matrix-filter="pending" class="matrix-filter-btn p-1.5 rounded-lg bg-surface-container border border-surface-high hover:border-gray-400 transition-colors">
                        <span class="block text-gray-200 font-extrabold text-xs" id="matrix-count-pending">0</span>
                        <span class="text-gray-400">Pendientes</span>
                    </button>
                    <button type="button" data-matrix-filter="review" class="matrix-filter-btn p-1.5 rounded-lg bg-surface-container border border-surface-high hover:border-warning transition-colors">
                        <span class="block text-warning font-extrabold text-xs" id="matrix-count-review">0</span>
                        <span class="text-gray-400">Revisión</span>
                    </button>
                </div>
            </div>

            <!-- Acciones Rápidas: Marcar para Revisión y Saltar a Pendiente -->
            <div class="flex items-center gap-2">
                <button type="button" id="btn-mark-review" class="flex-1 py-2 px-2.5 rounded-xl border border-surface-high bg-surface text-gray-300 hover:border-warning hover:text-warning transition-all flex items-center justify-center gap-1.5 text-[11px] font-bold">
                    <span class="material-symbols-outlined text-sm" id="icon-mark-review">flag</span>
                    <span id="label-mark-review">Marcar Revisión</span>
                </button>
                <button type="button" id="btn-jump-pending" title="Ir al siguiente reactivo sin responder o en revisión" class="py-2 px-2.5 rounded-xl border border-surface-high bg-surface text-primary hover:bg-primary/10 hover:border-primary transition-all flex items-center justify-center text-[11px] font-bold">
                    <span class="material-symbols-outlined text-sm">skip_next</span>
                </button>
            </div>

            <!-- Indicador de filtro activo -->
            <div id="matrix-active-filter-banner" class="hidden items-center justify-between px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-[10px] text-primary">
                <span id="matrix-active-filter-text">Filtro activo: Todos</span>
                <button type="button" id="btn-clear-matrix-filter" class="underline font-bold hover:text-white">Ver todos</button>
            </div>
        `;

        parentPanel.insertBefore(toolbar, grid);

        // Eventos de botones de filtro
        toolbar.querySelectorAll(".matrix-filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const chosenFilter = btn.dataset.matrixFilter || "all";
                const nextFilter = matrixFilterMode === chosenFilter ? "all" : chosenFilter;
                filterMatrixView(nextFilter);
            });
        });

        document.getElementById("btn-clear-matrix-filter")?.addEventListener("click", () => {
            filterMatrixView("all");
        });

        document.getElementById("btn-jump-pending")?.addEventListener("click", () => {
            jumpToNextUnansweredOrReview();
        });
    }

    // 2. Enlazar el botón #btn-mark-review (sea el inyectado o uno existente en el HTML)
    const markBtn = document.getElementById("btn-mark-review");
    if (markBtn && !markBtn.dataset.boundMatrix) {
        markBtn.dataset.boundMatrix = "1";
        markBtn.addEventListener("click", () => {
            toggleMarkForReview(appState.currentQuestionIndex);
        });
    }
}

/**
 * Actualiza los contadores superiores, la barra de progreso y el estado del
 * botón "Marcar Revisión" según el reactivo actual.
 */
function updateMatrixAuxCounters() {
    const summary = getMatrixProgressSummary();
    const markedSet = ensureMarkedSet();
    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const isCurrentMarked = markedSet.has(currentIndex);

    const progressLabel = document.getElementById("matrix-progress-label");
    const progressBar = document.getElementById("matrix-progress-bar");
    const countAnswered = document.getElementById("matrix-count-answered");
    const countPending = document.getElementById("matrix-count-pending");
    const countReview = document.getElementById("matrix-count-review");

    if (progressLabel) {
        progressLabel.textContent = `${summary.answered} / ${summary.total} (${summary.percentage}%)`;
    }
    if (progressBar) {
        progressBar.style.width = `${summary.percentage}%`;
    }
    if (countAnswered) countAnswered.textContent = String(summary.answered);
    if (countPending) countPending.textContent = String(summary.pending);
    if (countReview) countReview.textContent = String(summary.review);

    // Actualizar apariencia del botón de Marcar para Revisión
    const markBtn = document.getElementById("btn-mark-review");
    const markLabel = document.getElementById("label-mark-review");
    if (markBtn) {
        if (isCurrentMarked) {
            markBtn.className =
                "flex-1 py-2 px-2.5 rounded-xl border border-warning bg-warning/20 text-warning transition-all flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-[0_0_12px_rgba(255,190,11,0.2)]";
            if (markLabel) markLabel.textContent = "En Revisión ✓";
        } else {
            markBtn.className =
                "flex-1 py-2 px-2.5 rounded-xl border border-surface-high bg-surface text-gray-300 hover:border-warning hover:text-warning transition-all flex items-center justify-center gap-1.5 text-[11px] font-bold";
            if (markLabel) markLabel.textContent = "Marcar Revisión";
        }
    }

    // Actualizar banner de filtro activo
    const filterBanner = document.getElementById("matrix-active-filter-banner");
    const filterText = document.getElementById("matrix-active-filter-text");
    if (filterBanner && filterText) {
        if (matrixFilterMode === "all") {
            filterBanner.classList.add("hidden");
            filterBanner.classList.remove("flex");
        } else {
            const labels = {
                answered: "Respondidas",
                pending: "Pendientes",
                review: "En Revisión"
            };
            filterText.textContent = `Filtro: ${labels[matrixFilterMode] || "Todos"}`;
            filterBanner.classList.remove("hidden");
            filterBanner.classList.add("flex");
        }
    }
}

/**
 * Renderiza la cuadrícula de navegación rápida (`#matrix-grid`) coloreando cada
 * reactivo según su estado actual (Respondido, En Revisión, Pendiente o Activo).
 */
export function renderMatrix() {
    const grid = document.getElementById("matrix-grid");
    if (!grid) return;

    ensureMatrixAuxiliaryUI();

    const questions = getActiveQuestions();
    const answers = getActiveUserAnswers();
    const markedSet = ensureMarkedSet();
    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const isTutorMode = appState.currentMode === "tutor";

    grid.innerHTML = "";

    for (let i = 0; i < questions.length; i++) {
        const answerObj = answers[i];
        const isAnswered = answerObj !== undefined && answerObj !== null && Boolean(answerObj.chosen);
        const isMarked = markedSet.has(i);
        const isCurrent = i === currentIndex;

        // Evaluar si el botón coincide con el filtro activo de la cuadrícula
        const matchesFilter =
            matrixFilterMode === "all" ||
            (matrixFilterMode === "answered" && isAnswered) ||
            (matrixFilterMode === "pending" && !isAnswered) ||
            (matrixFilterMode === "review" && isMarked);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.questionIndex = String(i);
        btn.textContent = String(i + 1);

        let classes =
            "relative w-full aspect-square rounded font-bold text-xs flex items-center justify-center transition-all border select-none ";

        // 1. Indicador del reactivo actualmente visible en pantalla
        if (isCurrent) {
            classes += "ring-2 ring-white z-10 scale-105 ";
        }

        // 2. Coloreado según estado de respuesta / modo / revisión
        if (isAnswered) {
            if (isTutorMode) {
                // En Modo Tutor se distingue acierto (secondary) o fallo (danger)
                if (answerObj.isCorrect) {
                    classes += "bg-secondary text-surface-container border-secondary ";
                } else {
                    classes += "bg-danger text-white border-danger ";
                }
            } else {
                // En Modo Estándar (100) y Crítico (30) se ilumina en cian neón (primary)
                classes += "bg-primary text-surface-container border-primary ";
            }
        } else if (isMarked) {
            // Marcado para revisión aún sin responder
            classes += "bg-warning text-surface-container border-warning ";
        } else {
            // Pendiente de responder
            classes += "bg-surface text-gray-400 border-surface-high hover:border-gray-500 ";
        }

        // 3. Atenuar si no coincide con el filtro visual seleccionado
        if (!matchesFilter) {
            classes += "opacity-20 pointer-events-none ";
        }

        btn.className = classes.trim();

        // Tooltip informativo para el estudiante
        const statusLabel = isAnswered
            ? `Respondida (${answerObj.chosen})`
            : isMarked
            ? "Marcada para revisión"
            : "Pendiente";
        btn.title = `Reactivo ${i + 1} • ${statusLabel}`;

        // Si está respondida Y además marcada para revisión, añadir punto indicador ámbar en la esquina
        if (isAnswered && isMarked) {
            const badge = document.createElement("span");
            badge.className =
                "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning border border-surface-container shadow";
            btn.appendChild(badge);
        }

        btn.addEventListener("click", () => {
            navigateToQuestion(i);
        });

        grid.appendChild(btn);
    }

    updateMatrixAuxCounters();

    // Asegurar que el botón activo sea visible dentro del scroll de #matrix-grid
    const activeBtn = grid.querySelector(`button[data-question-index="${currentIndex}"]`);
    if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
        activeBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
}

/**
 * Navega directamente hacia un reactivo específico de la matriz.
 * @param {number} targetIndex
 */
export function navigateToQuestion(targetIndex) {
    const questions = getActiveQuestions();
    if (questions.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(Number(targetIndex) || 0, questions.length - 1));

    setExamSessionState({
        currentQuestionIndex: boundedIndex
    });

    triggerQuestionRender(boundedIndex);
    renderMatrix();
}

/**
 * Alterna la marca de revisión (`markedForReview`) para el reactivo indicado
 * o para el reactivo actualmente en pantalla.
 * @param {number} [questionIndex]
 * @returns {boolean} `true` si quedó marcado para revisión, `false` si se desmarcó.
 */
export function toggleMarkForReview(questionIndex = appState.currentQuestionIndex) {
    const questions = getActiveQuestions();
    if (questions.length === 0) return false;

    const index = Number(questionIndex ?? appState.currentQuestionIndex) || 0;
    const markedSet = ensureMarkedSet();

    let isNowMarked = false;
    if (markedSet.has(index)) {
        markedSet.delete(index);
        isNowMarked = false;
    } else {
        markedSet.add(index);
        isNowMarked = true;
    }

    setExamSessionState({
        markedForReview: markedSet
    });

    renderMatrix();
    return isNowMarked;
}

/**
 * Filtra visualmente la matriz de reactivos según el criterio elegido:
 * `"all"` | `"pending"` | `"answered"` | `"review"`.
 * @param {string} filterMode
 */
export function filterMatrixView(filterMode = "all") {
    const validModes = ["all", "pending", "answered", "review"];
    matrixFilterMode = validModes.includes(filterMode) ? filterMode : "all";
    renderMatrix();
}

/**
 * Salta automáticamente al siguiente reactivo pendiente de respuesta o,
 * si todos fueron respondidos, al siguiente reactivo marcado para revisión.
 * @returns {number|null} Índice al que se saltó o `null` si no hay pendientes/revisión.
 */
export function jumpToNextUnansweredOrReview() {
    const questions = getActiveQuestions();
    const answers = getActiveUserAnswers();
    const markedSet = ensureMarkedSet();
    const total = questions.length;
    if (total === 0) return null;

    const startIdx = Number(appState.currentQuestionIndex) || 0;

    // 1. Buscar el siguiente reactivo sin responder (búsqueda circular)
    for (let offset = 1; offset <= total; offset++) {
        const candidate = (startIdx + offset) % total;
        if (!answers[candidate] || !answers[candidate].chosen) {
            navigateToQuestion(candidate);
            return candidate;
        }
    }

    // 2. Si todos están respondidos, buscar el siguiente marcado para revisión
    if (markedSet.size > 0) {
        for (let offset = 1; offset <= total; offset++) {
            const candidate = (startIdx + offset) % total;
            if (markedSet.has(candidate)) {
                navigateToQuestion(candidate);
                return candidate;
            }
        }
    }

    return null;
}

/**
 * Reinicia el filtro y el estado visual de la matriz al comenzar o cerrar un simulacro.
 */
export function resetMatrixView() {
    matrixFilterMode = "all";
    renderMatrix();
}

/**
 * Inicializa el Subcomponente de Matriz de Reactivos (`exam.matrix.js`),
 * enlazando atajos de teclado durante el simulacro y suscribiéndose al estado global.
 * @param {Object} [options={}]
 * @param {Function} [options.onQuestionSelect] Callback opcional al seleccionar un reactivo
 */
export function initExamMatrix(options = {}) {
    if (typeof options.onQuestionSelect === "function") {
        registerQuestionRendererCallback(options.onQuestionSelect);
    }

    ensureMarkedSet();
    ensureMatrixAuxiliaryUI();
    renderMatrix();

    // Atajos de teclado tácticos exclusivos mientras el simulador CACES está activo
    if (!matrixEventsBound) {
        matrixEventsBound = true;

        document.addEventListener("keydown", (e) => {
            if (!appState.isExamActive || appState.currentActiveView !== "view-simulator") {
                return;
            }

            // Ignorar si el usuario escribe en un input o textarea
            const tag = (e.target?.tagName || "").toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") {
                return;
            }

            if (e.key === "ArrowRight") {
                e.preventDefault();
                const nextIdx = Math.min(
                    getActiveQuestions().length - 1,
                    (Number(appState.currentQuestionIndex) || 0) + 1
                );
                navigateToQuestion(nextIdx);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prevIdx = Math.max(0, (Number(appState.currentQuestionIndex) || 0) - 1);
                navigateToQuestion(prevIdx);
            } else if (e.key.toLowerCase() === "m") {
                e.preventDefault();
                toggleMarkForReview(appState.currentQuestionIndex);
            }
        });
    }

    // Suscribirse a cambios en `state.store.js` para mantener la matriz sincronizada
    if (!stateUnsubscribe && typeof subscribeToState === "function") {
        stateUnsubscribe = subscribeToState((updatedState, changedKeys) => {
            if (!updatedState.isExamActive) return;
            const relevantKeys = [
                "examQuestions",
                "currentQuestionIndex",
                "userAnswers",
                "markedForReview",
                "currentMode"
            ];
            if (
                !Array.isArray(changedKeys) ||
                changedKeys.some(k => relevantKeys.includes(k))
            ) {
                renderMatrix();
            }
        });
    }

    // Exponer utilidades en `window.MakaiExamMatrix` para interoperabilidad inmediata
    window.MakaiExamMatrix = {
        initExamMatrix,
        renderMatrix,
        navigateToQuestion,
        toggleMarkForReview,
        getMatrixProgressSummary,
        filterMatrixView,
        jumpToNextUnansweredOrReview,
        resetMatrixView,
        registerQuestionRendererCallback
    };
    window.renderMatrix = renderMatrix;
}

export default {
    initExamMatrix,
    renderMatrix,
    navigateToQuestion,
    toggleMarkForReview,
    getMatrixProgressSummary,
    filterMatrixView,
    jumpToNextUnansweredOrReview,
    resetMatrixView,
    registerQuestionRendererCallback
};
