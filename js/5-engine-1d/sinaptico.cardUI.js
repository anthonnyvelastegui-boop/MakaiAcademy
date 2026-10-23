// ============================================================================
// ARCHIVO: js/5-engine-1d/sinaptico.cardUI.js
// DESCRIPCIÓN: Subcomponente Visual de Flashcards para Repetición Espaciada •
//              Sináptico v4.4. Controla el renderizado clínico, animaciones de
//              volteo, insignias de intervalos (<10m, 1d, 4d+), visor de imágenes
//              diagnósticas, contadores de sesión y atajos de teclado.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    getPreviewIntervalsForCard,
    estimateCardRetentionProbability,
    getDeckRetentionAnalytics
} from "./sinaptico.algorithm.js";

// ============================================================================
// 1. ESTADO INTERNO DE INTERFAZ Y CALLBACKS DEL CONTROLADOR 1D
// ============================================================================

const cardUIState = {
    initialized: false,
    isFlipping: false,
    currentCard: null,
    controllerState: null,
    onShowAnswerCallback: null,
    onRateCardCallback: null
};

// ============================================================================
// 2. INICIALIZACIÓN DE LA INTERFAZ VISUAL SINÁPTICO V4.4
// ============================================================================

/**
 * Inicializa el subcomponente visual de Flashcards y conecta los callbacks
 * proporcionados por `engine1d.controller.js`.
 * @param {Object} options
 * @param {Function} options.onShowAnswer - Callback al revelar la respuesta
 * @param {Function} options.onRateCard - Callback al calificar ("hard" | "good" | "easy")
 */
export function initSinapticoCardUI(options = {}) {
    if (typeof options.onShowAnswer === "function") {
        cardUIState.onShowAnswerCallback = options.onShowAnswer;
    }
    if (typeof options.onRateCard === "function") {
        cardUIState.onRateCardCallback = options.onRateCard;
    }

    ensureSinapticoUIEnhancements();
    bindCardUIInteractiveEvents();

    cardUIState.initialized = true;
    return {
        component: "sinaptico.cardUI",
        version: "4.4",
        status: "ready"
    };
}

/**
 * Inyecta los elementos visuales enriquecidos dentro de `#flashcard-container` y
 * `#view-spaced` respetando todos los IDs originales de `dashboard.html`
 * (`#fc-category`, `#fc-front`, `#fc-back`, `#fc-answer`, `#btn-show-answer`, `#fc-controls`).
 */
function ensureSinapticoUIEnhancements() {
    const flashcardContainer = document.getElementById("flashcard-container");
    if (!flashcardContainer) return;

    // 1. Barra superior de telemetría del mazo (encima de #flashcard-container)
    const parentStage = flashcardContainer.parentElement;
    if (parentStage && !document.getElementById("sinaptico-telemetry-strip")) {
        const telemetryStrip = document.createElement("div");
        telemetryStrip.id = "sinaptico-telemetry-strip";
        telemetryStrip.className = "w-full max-w-2xl mb-4 bg-surface border border-surface-high rounded-xl p-3.5 shadow-lg";
        telemetryStrip.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono mb-2">
                <div class="flex items-center gap-3">
                    <span class="flex items-center gap-1 text-primary font-bold" title="Tarjetas nuevas en este mazo">
                        <span class="w-2 h-2 rounded-full bg-primary"></span>
                        Nuevas: <strong id="fc-stat-new">0</strong>
                    </span>
                    <span class="flex items-center gap-1 text-danger font-bold" title="Tarjetas vencidas o en refuerzo <10m">
                        <span class="w-2 h-2 rounded-full bg-danger"></span>
                        Urgentes: <strong id="fc-stat-due">0</strong>
                    </span>
                    <span class="flex items-center gap-1 text-warning font-bold" title="Tarjetas en aprendizaje activo">
                        <span class="w-2 h-2 rounded-full bg-warning"></span>
                        En Repaso: <strong id="fc-stat-learning">0</strong>
                    </span>
                    <span class="flex items-center gap-1 text-secondary font-bold" title="Tarjetas consolidadas (14+ días)">
                        <span class="w-2 h-2 rounded-full bg-secondary"></span>
                        Dominadas: <strong id="fc-stat-mastered">0</strong>
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">Retención Sináptica:</span>
                    <span id="fc-stat-retention" class="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-extrabold">100%</span>
                </div>
            </div>
            <div class="w-full h-1.5 bg-surface-high rounded-full overflow-hidden">
                <div id="fc-progress-bar" class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300" style="width: 0%"></div>
            </div>
        `;
        parentStage.insertBefore(telemetryStrip, flashcardContainer);
    }

    // 2. Cabecera interna de metadatos de la tarjeta (Dificultad, Estado de Memoria, Facilidad)
    const fcCategory = document.getElementById("fc-category");
    if (fcCategory && !document.getElementById("fc-meta-badges")) {
        const metaRow = document.createElement("div");
        metaRow.id = "fc-meta-badges";
        metaRow.className = "flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-surface-high/80";
        metaRow.innerHTML = `
            <span id="fc-state-pill" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/30">
                Nueva • Sináptico v4.4
            </span>
            <div class="flex items-center gap-2">
                <span id="fc-difficulty-pill" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-surface-high text-gray-300">
                    Dificultad Media
                </span>
                <span id="fc-retention-pill" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-high text-secondary">
                    EF 2.50
                </span>
            </div>
        `;
        flashcardContainer.insertBefore(metaRow, fcCategory);
    }

    // 3. Contenedor para imagen clínica en el frente de la tarjeta (si el caso incluye imagen)
    const fcFront = document.getElementById("fc-front");
    if (fcFront && !document.getElementById("fc-media-wrapper")) {
        const mediaWrapper = document.createElement("div");
        mediaWrapper.id = "fc-media-wrapper";
        mediaWrapper.className = "hidden mb-6 flex flex-col items-center";
        mediaWrapper.innerHTML = `
            <div class="relative group cursor-zoom-in rounded-xl overflow-hidden border border-surface-high bg-surface-container max-h-60">
                <img id="fc-clinical-image" src="" alt="Hallazgo Clínico Sináptico" class="max-h-56 w-auto object-contain mx-auto transition-transform duration-300 group-hover:scale-105" />
                <div class="absolute bottom-2 right-2 bg-surface/90 border border-primary/40 text-primary text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">zoom_in</span>
                    <span>Ampliar hallazgo</span>
                </div>
            </div>
        `;
        fcFront.insertAdjacentElement("afterend", mediaWrapper);

        mediaWrapper.addEventListener("click", () => {
            const imgEl = document.getElementById("fc-clinical-image");
            if (imgEl && imgEl.src) {
                openSinapticoImageModal(imgEl.src, cardUIState.currentCard?.materia || "Hallazgo Clínico");
            }
        });
    }

    // 4. Bloque de Racional Clínico y Perla CACES dentro de #fc-back
    const fcBack = document.getElementById("fc-back");
    if (fcBack && !document.getElementById("fc-rational-box")) {
        const rationalBox = document.createElement("div");
        rationalBox.id = "fc-rational-box";
        rationalBox.className = "hidden mt-5 bg-surface-container/90 border border-primary/30 rounded-xl p-4 text-left";
        rationalBox.innerHTML = `
            <div class="flex items-center gap-1.5 text-[11px] font-mono font-extrabold text-primary uppercase tracking-wider mb-1.5">
                <span class="material-symbols-outlined text-sm">clinical_notes</span>
                <span>Sustento & Racional Clínico CACES</span>
            </div>
            <p id="fc-rational-text" class="text-xs text-gray-300 leading-relaxed"></p>
        `;
        fcBack.appendChild(rationalBox);
    }

    // 5. Pie de ayuda de atajos de teclado debajo de #fc-controls
    const controls = document.getElementById("fc-controls");
    if (controls && !document.getElementById("fc-shortcuts-hint")) {
        const hint = document.createElement("div");
        hint.id = "fc-shortcuts-hint";
        hint.className = "mt-3 text-center text-[11px] font-mono text-gray-500 flex items-center justify-center gap-4";
        hint.innerHTML = `
            <span><kbd class="px-1.5 py-0.5 bg-surface border border-surface-high rounded text-gray-300">Espacio</kbd> Mostrar respuesta</span>
            <span><kbd class="px-1.5 py-0.5 bg-surface border border-surface-high rounded text-danger">1</kbd> Difícil</span>
            <span><kbd class="px-1.5 py-0.5 bg-surface border border-surface-high rounded text-primary">2</kbd> Bueno</span>
            <span><kbd class="px-1.5 py-0.5 bg-surface border border-surface-high rounded text-secondary">3</kbd> Fácil</span>
        `;
        controls.parentElement?.appendChild(hint);
    }
}

// ============================================================================
// 3. RENDERIZADO PRINCIPAL DE LA TARJETA Y TELEMETRÍA
// ============================================================================

/**
 * Pinta en pantalla la tarjeta actual y actualiza las insignias algorítmicas
 * de Repetición Espaciada • Sináptico v4.4.
 * Es invocada automáticamente por `engine1d.controller.js`.
 * @param {Object|null} card - Tarjeta activa del mazo
 * @param {Object} engine1DState - Estado actual del controlador 1D
 */
export function renderCard(card, engine1DState = {}) {
    ensureSinapticoUIEnhancements();

    cardUIState.currentCard = card || null;
    cardUIState.controllerState = engine1DState || null;

    const flashcardContainer = document.getElementById("flashcard-container");
    const fcCategory = document.getElementById("fc-category");
    const fcFront = document.getElementById("fc-front");
    const fcBack = document.getElementById("fc-back");
    const fcAnswer = document.getElementById("fc-answer");
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");
    const mediaWrapper = document.getElementById("fc-media-wrapper");
    const rationalBox = document.getElementById("fc-rational-box");
    const metaBadges = document.getElementById("fc-meta-badges");

    if (!fcCategory || !fcFront || !fcBack || !fcAnswer || !btnShow || !controls) {
        return;
    }

    // Actualizar la barra superior de métricas del mazo
    renderDeckTelemetryBar(engine1DState);

    // Caso sin tarjetas en el filtro actual
    if (!card) {
        const careerLabel = (engine1DState.career || "medicina").toUpperCase();
        fcCategory.textContent = `${careerLabel} • MAZO SIN TARJETAS EN ESTE FILTRO`;
        fcFront.textContent = "No se encontraron tarjetas registradas para esta asignatura. Selecciona 'Todas las materias' en la barra superior o añade nuevas tarjetas desde la Bóveda Admin.";
        fcBack.classList.add("hidden");
        btnShow.classList.add("hidden");
        controls.classList.add("hidden");
        mediaWrapper?.classList.add("hidden");
        rationalBox?.classList.add("hidden");
        metaBadges?.classList.add("hidden");
        return;
    }

    metaBadges?.classList.remove("hidden");

    const deck = Array.isArray(engine1DState.filteredDeck) ? engine1DState.filteredDeck : [card];
    const currentIndex = Number(engine1DState.currentCardIndex || 0);
    const totalCards = deck.length;

    // Animación sutil de entrada al cambiar de tarjeta
    if (flashcardContainer) {
        flashcardContainer.classList.remove("border-primary", "shadow-[0_0_30px_rgba(0,229,255,0.12)]");
        flashcardContainer.classList.add("border-gray-700");
    }

    // 1. Categoría y posición en el mazo
    const careerName = (card.carrera || engine1DState.career || "medicina").toUpperCase();
    const subjectName = card.materia || "General";
    fcCategory.textContent = `${careerName} • ${subjectName} (${currentIndex + 1}/${totalCards})`;

    // 2. Insignias de estado sináptico, dificultad CACES y Ease Factor
    updateCardHeaderBadges(card);

    // 3. Enunciado principal (Frente)
    fcFront.textContent = card.frente || card.enunciado || "¿Pregunta clínica?";

    // 4. Imagen diagnóstica opcional (ECG, RX, TAC, Dermatología)
    const imgEl = document.getElementById("fc-clinical-image");
    if (card.imagenUrl && imgEl && mediaWrapper) {
        imgEl.src = card.imagenUrl;
        mediaWrapper.classList.remove("hidden");
    } else if (mediaWrapper) {
        mediaWrapper.classList.add("hidden");
    }

    // 5. Respuesta principal y Racional CACES (Reverso)
    fcAnswer.textContent = card.reverso || card.respuesta || "Sin respuesta registrada.";

    const rationalTextEl = document.getElementById("fc-rational-text");
    const cleanRational = (card.racional || "").trim();
    const answerAlreadyContainsRational = cleanRational && (card.reverso || "").includes(cleanRational);

    if (cleanRational && !answerAlreadyContainsRational && rationalBox && rationalTextEl) {
        rationalTextEl.textContent = cleanRational;
        rationalBox.classList.remove("hidden");
    } else if (rationalBox) {
        rationalBox.classList.add("hidden");
    }

    // 6. Actualizar intervalos previstos (<10m, 1d, 4d+) en los 3 botones de retención
    updateRetentionButtonsPreview(card);

    // 7. Restablecer vista a Frente ocultando Reverso y controles de calificación
    fcBack.classList.add("hidden");
    btnShow.classList.remove("hidden");
    controls.classList.add("hidden");
}

/**
 * Revela el reverso de la tarjeta activa con transición visual Cyber-Medical,
 * oculta el botón `#btn-show-answer` y despliega los 3 botones `#fc-controls`.
 */
export function revealCardAnswer() {
    const flashcardContainer = document.getElementById("flashcard-container");
    const fcBack = document.getElementById("fc-back");
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    if (!fcBack || !btnShow || !controls) return;

    cardUIState.isFlipping = true;

    if (flashcardContainer) {
        flashcardContainer.classList.remove("border-gray-700");
        flashcardContainer.classList.add("border-primary", "shadow-[0_0_30px_rgba(0,229,255,0.12)]");
    }

    fcBack.classList.remove("hidden");
    btnShow.classList.add("hidden");
    controls.classList.remove("hidden");

    setTimeout(() => {
        cardUIState.isFlipping = false;
    }, 180);
}

// ============================================================================
// 4. INSIGNIAS DINÁMICAS, INTERVALOS Y BARRA DE TELEMETRÍA
// ============================================================================

/**
 * Actualiza las píldoras superiores de la tarjeta:
 * - Estado de memoria (Nueva, Urgente <10m, En Aprendizaje, Consolidada)
 * - Nivel de dificultad clínica (Básica, Media, Alta, Élite)
 * - Factor de facilidad (EF) y probabilidad de recuerdo Ebbinghaus
 * @param {Object} card
 */
function updateCardHeaderBadges(card = {}) {
    const statePill = document.getElementById("fc-state-pill");
    const diffPill = document.getElementById("fc-difficulty-pill");
    const retentionPill = document.getElementById("fc-retention-pill");

    const now = Date.now();
    const due = Number(card.nextReviewAt || 0);
    const interval = Number(card.intervalDays || 0);
    const reps = Number(card.repetitions || 0);
    const ease = Number(card.easeFactor || 2.5).toFixed(2);

    if (statePill) {
        if (due === 0 && reps === 0) {
            statePill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/30";
            statePill.textContent = "Nueva • Sináptico v4.4";
        } else if (due > 0 && due <= now) {
            statePill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-danger/15 text-danger border border-danger/30";
            statePill.textContent = interval < 0.5 ? "Refuerzo Inmediato (<10m)" : "Repaso Vencido Hoy";
        } else if (interval >= 14) {
            statePill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-secondary/15 text-secondary border border-secondary/30";
            statePill.textContent = `Consolidada • Intervalo ${Math.round(interval)}d`;
        } else {
            statePill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-warning/15 text-warning border border-warning/30";
            statePill.textContent = `En Aprendizaje • Rep #${reps}`;
        }
    }

    if (diffPill) {
        const rawDiff = String(card.dificultad || "Media");
        const lowerDiff = rawDiff.toLowerCase();
        if (lowerDiff.includes("élite") || lowerDiff.includes("elite") || lowerDiff.includes("alta") || lowerDiff.includes("avanzad")) {
            diffPill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-danger/15 text-danger border border-danger/30";
        } else if (lowerDiff.includes("baja") || lowerDiff.includes("básic") || lowerDiff.includes("basic")) {
            diffPill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-secondary/15 text-secondary border border-secondary/30";
        } else {
            diffPill.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-surface-high text-gray-300";
        }
        diffPill.textContent = `Complejidad: ${rawDiff}`;
    }

    if (retentionPill) {
        const prob = estimateCardRetentionProbability(card);
        retentionPill.textContent = prob > 0 ? `Retención ${prob}% • EF ${ease}` : `EF ${ease}`;
    }
}

/**
 * Sincroniza las etiquetas de tiempo (<10m, 1d, 4d+) de los 3 botones en `#fc-controls`
 * usando `getPreviewIntervalsForCard(card)` de `sinaptico.algorithm.js`.
 * @param {Object} card
 */
export function updateRetentionButtonsPreview(card = {}) {
    const controls = document.getElementById("fc-controls");
    if (!controls) return;

    const intervals = getPreviewIntervalsForCard(card);
    const buttons = controls.querySelectorAll("button");
    if (buttons.length < 3) return;

    const buttonConfigs = [
        {
            quality: "hard",
            title: "Difícil",
            badge: intervals.hardLabel || "<10m",
            colorClass: "border-danger/50 text-danger hover:bg-danger hover:text-white"
        },
        {
            quality: "good",
            title: "Bueno",
            badge: intervals.goodLabel || "1d",
            colorClass: "border-primary/50 text-primary hover:bg-primary hover:text-surface"
        },
        {
            quality: "easy",
            title: "Fácil",
            badge: intervals.easyLabel || "4d",
            colorClass: "border-secondary/50 text-secondary hover:bg-secondary hover:text-surface"
        }
    ];

    buttons.forEach((btn, idx) => {
        const cfg = buttonConfigs[idx];
        if (!cfg) return;
        btn.dataset.quality = cfg.quality;
        btn.innerHTML = `
            <span class="block text-sm font-extrabold">${cfg.title} (${cfg.badge})</span>
        `;
    });
}

/**
 * Actualiza la barra superior de telemetría del mazo activo con los datos
 * matemáticos provistos por `getDeckRetentionAnalytics(deck)`.
 * @param {Object} engine1DState
 */
export function renderDeckTelemetryBar(engine1DState = {}) {
    const deck = Array.isArray(engine1DState?.filteredDeck) ? engine1DState.filteredDeck : [];
    const analytics = getDeckRetentionAnalytics(deck);

    const newEl = document.getElementById("fc-stat-new");
    const dueEl = document.getElementById("fc-stat-due");
    const learningEl = document.getElementById("fc-stat-learning");
    const masteredEl = document.getElementById("fc-stat-mastered");
    const retentionEl = document.getElementById("fc-stat-retention");
    const progressBar = document.getElementById("fc-progress-bar");

    if (newEl) newEl.textContent = String(analytics.newCount);
    if (dueEl) dueEl.textContent = String(analytics.dueNowCount);
    if (learningEl) learningEl.textContent = String(analytics.learningCount);
    if (masteredEl) masteredEl.textContent = String(analytics.masteredCount);

    if (retentionEl) {
        const ret = analytics.totalCards > 0 ? analytics.globalRetentionPercent : 100;
        retentionEl.textContent = `${ret}%`;
    }

    if (progressBar) {
        if (deck.length === 0) {
            progressBar.style.width = "0%";
        } else {
            const currentPos = Math.min(deck.length, Number(engine1DState.currentCardIndex || 0) + 1);
            const pct = Math.round((currentPos / deck.length) * 100);
            progressBar.style.width = `${pct}%`;
        }
    }
}

// ============================================================================
// 5. VISOR MODAL DE ALTA RESOLUCIÓN PARA IMÁGENES CLÍNICAS SINÁPTICO
// ============================================================================

/**
 * Abre un visor modal oscuro para inspeccionar radiografías, ECGs o esquemas
 * adjuntos a una tarjeta Sináptico v4.4.
 * @param {string} imageSrc
 * @param {string} title
 */
export function openSinapticoImageModal(imageSrc, title = "Hallazgo Clínico") {
    if (!imageSrc) return;

    let modal = document.getElementById("sinaptico-image-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "sinaptico-image-modal";
        modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/85 backdrop-blur-sm p-4";
        modal.innerHTML = `
            <div class="bg-surface-container border border-primary/40 rounded-2xl max-w-4xl w-full p-4 shadow-2xl space-y-3">
                <div class="flex items-center justify-between border-b border-surface-high pb-2.5">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">radiology</span>
                        <h4 id="sinaptico-modal-title" class="text-sm font-extrabold text-white font-mono uppercase"></h4>
                    </div>
                    <button type="button" id="btn-close-sinaptico-modal" class="px-3 py-1 rounded-lg bg-surface-high text-gray-300 hover:text-white text-xs font-bold">
                        ✕ Cerrar (Esc)
                    </button>
                </div>
                <div class="max-h-[75vh] overflow-auto flex items-center justify-center bg-surface rounded-xl p-3">
                    <img id="sinaptico-modal-img" src="" alt="Imagen Clínica Ampliada" class="max-h-[70vh] w-auto object-contain rounded-lg" />
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal || e.target.id === "btn-close-sinaptico-modal") {
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }
        });
    }

    const titleEl = document.getElementById("sinaptico-modal-title");
    const imgEl = document.getElementById("sinaptico-modal-img");

    if (titleEl) titleEl.textContent = title;
    if (imgEl) imgEl.src = imageSrc;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

// ============================================================================
// 6. EVENTOS INTERACTIVOS Y ATAJOS DE TECLADO (ESPACIO, 1, 2, 3)
// ============================================================================

/**
 * Enlaza los clics sobre `#btn-show-answer`, los 3 botones de `#fc-controls`
 * y el clic directo sobre el frente de la tarjeta si aún no han sido enlazados
 * por `engine1d.controller.js`.
 */
function bindCardUIInteractiveEvents() {
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    if (btnShow && !btnShow.dataset.engine1dBound && !btnShow.dataset.cardUiBound) {
        btnShow.dataset.cardUiBound = "1";
        btnShow.addEventListener("click", () => {
            if (typeof cardUIState.onShowAnswerCallback === "function") {
                cardUIState.onShowAnswerCallback();
            } else {
                revealCardAnswer();
            }
        });
    }

    if (controls && !controls.dataset.engine1dBound && !controls.dataset.cardUiBound) {
        controls.dataset.cardUiBound = "1";
        const qualityBtns = controls.querySelectorAll("button");
        qualityBtns.forEach((btn, idx) => {
            btn.addEventListener("click", () => {
                const rawQuality = btn.dataset.quality || (idx === 0 ? "hard" : idx === 2 ? "easy" : "good");
                if (typeof cardUIState.onRateCardCallback === "function") {
                    cardUIState.onRateCardCallback(rawQuality);
                }
            });
        });
    }
}
