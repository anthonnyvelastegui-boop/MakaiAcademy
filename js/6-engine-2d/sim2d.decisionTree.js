// ============================================================================
// ARCHIVO: js/6-engine-2d/sim2d.decisionTree.js
// DESCRIPCIÓN: Subcomponente de Árboles de Decisión Clínica Ramificados 2D.
//              Gestiona la navegación por nodos clínicos paso a paso,
//              la auditoría de exploración instrumental previa, el despliegue
//              de impacto hemodinámico (vitalsDelta), el Racional CACES y el
//              Debriefing Clínico final en #view-sim2d.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

// ============================================================================
// 1. ESTADO INTERNO Y REFERENCIAS DEL SUBCOMPONENTE DE ÁRBOLES 2D
// ============================================================================

const decisionTreeContext = {
    initialized: false,
    stateRef: null,
    onSelectDecisionCallback: null,
    keyboardBound: false,
    lastSelectedOption: null
};

// ============================================================================
// 2. INICIALIZACIÓN Y CONEXIÓN CON ENGINE2D.CONTROLLER.JS
// ============================================================================

/**
 * Inicializa el motor de Árboles de Decisión 2D y enlaza los callbacks con
 * `js/6-engine-2d/engine2d.controller.js`.
 * @param {Object} options
 * @param {Object} options.state - Referencia directa a `engine2DState`
 * @param {Function} options.onSelectDecision - Callback `handleDecisionNodeChoice2D`
 */
export function initDecisionTree2D(options = {}) {
    if (options.state) {
        decisionTreeContext.stateRef = options.state;
    }
    if (typeof options.onSelectDecision === "function") {
        decisionTreeContext.onSelectDecisionCallback = options.onSelectDecision;
    }

    bindDecisionTreeKeyboardShortcuts();
    decisionTreeContext.initialized = true;

    return {
        module: "sim2d.decisionTree",
        status: "online"
    };
}

/**
 * Alias de compatibilidad arquitectónica.
 */
export const initSim2DDecisionTree = initDecisionTree2D;

/**
 * Registra atajos de teclado (teclas 1-4 o A-D) para seleccionar opciones
 * del árbol de decisión cuando la vista `#view-sim2d` está visible en pantalla.
 */
function bindDecisionTreeKeyboardShortcuts() {
    if (decisionTreeContext.keyboardBound) return;
    decisionTreeContext.keyboardBound = true;

    document.addEventListener("keydown", (e) => {
        const sim2dView = document.getElementById("view-sim2d");
        if (!sim2dView || sim2dView.classList.contains("hidden")) return;

        // Ignorar si el usuario escribe en un input, textarea o select
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

        const state = decisionTreeContext.stateRef;
        if (!state || !state.activeCase || state.isCaseFinished) return;

        const currentNode = (state.activeCase.nodes || {})[state.currentNodeId];
        if (!currentNode || !Array.isArray(currentNode.opciones)) return;

        const key = e.key.toUpperCase();
        const keyMap = {
            "1": 0, "A": 0,
            "2": 1, "B": 1,
            "3": 2, "C": 2,
            "4": 3, "D": 3
        };

        if (Object.prototype.hasOwnProperty.call(keyMap, key)) {
            const targetIndex = keyMap[key];
            const targetOption = currentNode.opciones[targetIndex];
            if (targetOption && targetOption.id) {
                e.preventDefault();
                evaluateDecisionOption2D(targetOption.id, state);
            }
        }
    });
}

// ============================================================================
// 3. RENDERIZADO DEL NODO CLÍNICO ACTIVO Y LÍNEA DE TIEMPO RAMIFICADA
// ============================================================================

/**
 * Renderiza el nodo actual del Árbol de Decisión Clínica en `#engine2d-decision-body`.
 * Es invocada automáticamente por `renderCurrentDecisionNode2D()` desde `engine2d.controller.js`.
 * @param {HTMLElement} container - Contenedor `#engine2d-decision-body`
 * @param {Object} state - Estado reactivo `engine2DState`
 */
export function renderDecisionNode(container, state = decisionTreeContext.stateRef) {
    const targetContainer = container || document.getElementById("engine2d-decision-body");
    if (!targetContainer || !state || !state.activeCase) return;

    decisionTreeContext.stateRef = state;
    enrichCaseDecisionNodes2D(state.activeCase);

    const nodes = state.activeCase.nodes || {};
    const currentNode = nodes[state.currentNodeId];
    const stepBadge = document.getElementById("engine2d-step-badge");

    // Si el caso ya terminó o no existe el nodo, mostrar el Debriefing Clínico 2D
    if (state.isCaseFinished || !currentNode) {
        if (stepBadge) {
            stepBadge.textContent = "Desenlace Clínico";
        }
        renderCaseDebriefing2D(targetContainer, state);
        return;
    }

    if (stepBadge) {
        stepBadge.textContent = currentNode.etapaLabel || `Nodo Clínico • ${state.currentNodeId}`;
    }

    const timelineHTML = renderDecisionPathwayTimeline(state.activeCase, state);
    const explorationStatusHTML = renderPriorExplorationHint(currentNode, state);
    const optionsHTML = (currentNode.opciones || []).map((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const wasTriedFailed = Array.isArray(state.actionsHistory) &&
            state.actionsHistory.some(h => h.nodeId === state.currentNodeId && h.optionId === opt.id && !h.esCorrecta);

        return `
            <button
                type="button"
                data-decision-opt="${escapeAttr(opt.id)}"
                class="engine2d-decision-opt group w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    wasTriedFailed
                        ? "bg-danger/10 border-danger/50 text-gray-300"
                        : "bg-surface hover:bg-surface-high border-surface-high hover:border-primary shadow-sm"
                }"
            >
                <div class="flex items-start gap-3">
                    <span class="px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold transition-colors ${
                        wasTriedFailed
                            ? "bg-danger/20 text-danger border border-danger/40"
                            : "bg-primary/15 text-primary border border-primary/30 group-hover:bg-primary group-hover:text-surface"
                    }">
                        ${letter}
                    </span>
                    <div class="space-y-1">
                        <span class="block text-xs text-gray-100 font-semibold leading-relaxed">
                            ${escapeHTML(opt.texto)}
                        </span>
                        ${
                            wasTriedFailed
                                ? `<span class="inline-block text-[10px] font-mono text-danger font-bold">
                                    ⚠ Conducta evaluada previamente con deterioro clínico
                                   </span>`
                                : ""
                        }
                    </div>
                </div>
                <span class="text-[10px] font-mono text-gray-500 group-hover:text-primary shrink-0 hidden sm:inline-block">
                    [${letter}]
                </span>
            </button>
        `;
    }).join("");

    targetContainer.innerHTML = `
        <div class="space-y-3.5">
            <!-- Mapa de Progreso de Nodos del Caso -->
            ${timelineHTML}

            <!-- Indicador de Exploración Instrumental en Lienzo -->
            ${explorationStatusHTML}

            <!-- Pregunta Clínica del Nodo Actual -->
            <div class="bg-surface p-4 rounded-xl border border-surface-high space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">clinical_notes</span>
                        <span>Punto de Decisión Terapéutica / Diagnóstica</span>
                    </span>
                    <span class="text-[10px] font-mono text-gray-400">
                        Atajos: [A-D] o [1-4]
                    </span>
                </div>
                <p class="text-xs font-bold text-white leading-relaxed">
                    ${escapeHTML(currentNode.pregunta)}
                </p>
            </div>

            <!-- Opciones de Conducta Clínica -->
            <div class="space-y-2.5">
                ${optionsHTML}
            </div>
        </div>
    `;

    targetContainer.querySelectorAll(".engine2d-decision-opt").forEach(btn => {
        btn.addEventListener("click", () => {
            const optionId = btn.dataset.decisionOpt;
            evaluateDecisionOption2D(optionId, state);
        });
    });
}

/**
 * Construye el indicador visual de etapas (Nodos del Árbol de Decisión) para que el
 * estudiante visualice en qué eslabón del protocolo clínico se encuentra.
 * @param {Object} activeCase
 * @param {Object} state
 * @returns {string}
 */
export function renderDecisionPathwayTimeline(activeCase, state) {
    const nodeKeys = Object.keys(activeCase?.nodes || {});
    if (nodeKeys.length === 0) return "";

    const currentIdx = Math.max(0, nodeKeys.indexOf(state.currentNodeId));

    const stepsMarkup = nodeKeys.map((nodeKey, idx) => {
        const isCompleted = idx < currentIdx || state.isCaseFinished;
        const isCurrent = idx === currentIdx && !state.isCaseFinished;

        let badgeClass = "bg-surface border-surface-high text-gray-500";
        if (isCompleted) {
            badgeClass = "bg-secondary/15 border-secondary/50 text-secondary";
        } else if (isCurrent) {
            badgeClass = "bg-primary/15 border-primary text-primary shadow-[0_0_10px_rgba(0,229,255,0.2)]";
        }

        return `
            <div class="flex items-center gap-1.5">
                <span class="px-2.5 py-1 rounded-lg border text-[10px] font-mono font-extrabold ${badgeClass}">
                    ${isCompleted ? "✓ " : ""}Paso ${idx + 1}
                </span>
                ${
                    idx < nodeKeys.length - 1
                        ? `<span class="text-gray-600 font-mono text-xs">→</span>`
                        : ""
                }
            </div>
        `;
    }).join("");

    return `
        <div class="flex flex-wrap items-center justify-between gap-2 bg-surface px-3 py-2 rounded-xl border border-surface-high">
            <div class="flex flex-wrap items-center gap-1.5">
                ${stepsMarkup}
            </div>
            <span class="text-[10px] font-mono text-gray-400">
                Hallazgos en lienzo: <strong class="text-primary">${(state.discoveredFindings || []).length}</strong>
            </span>
        </div>
    `;
}

/**
 * Muestra una recomendación clínica si el estudiante aún no ha utilizado el instrumental 2D
 * sobre el paciente antes de tomar la primera decisión terapéutica.
 * @param {Object} currentNode
 * @param {Object} state
 * @returns {string}
 */
function renderPriorExplorationHint(currentNode, state) {
    const findingsCount = Array.isArray(state.discoveredFindings) ? state.discoveredFindings.length : 0;

    if (findingsCount === 0) {
        return `
            <div class="bg-warning/10 border border-warning/40 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-warning text-base">stethoscope</span>
                    <span class="text-[11px] text-gray-200 leading-tight">
                        <strong class="text-warning">Sugerencia Semiológica:</strong> Ausculta o aplica el instrumental en el lienzo 2D para recolectar signos antes de decidir.
                    </span>
                </div>
            </div>
        `;
    }

    return `
        <div class="bg-secondary/10 border border-secondary/30 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono text-secondary font-bold flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                <span>Exploración 2D registrada (${findingsCount} maniobra${findingsCount === 1 ? "" : "s"})</span>
            </span>
            <span class="text-[10px] font-mono text-gray-300">Correlación clínica lista</span>
        </div>
    `;
}

// ============================================================================
// 4. EVALUACIÓN DE DECISIONES, IMPACTO HEMODINÁMICO Y RETROALIMENTACIÓN CACES
// ============================================================================

/**
 * Procesa la elección de una opción en el nodo actual, registra la auditoría en
 * `state.actionsHistory`, coordina con `engine2d.controller.js` y enriquece la
 * caja de retroalimentación `#engine2d-decision-feedback` con los cambios hemodinámicos.
 * @param {string} optionId
 * @param {Object} state
 */
export function evaluateDecisionOption2D(optionId, state = decisionTreeContext.stateRef) {
    if (!state || !state.activeCase || state.isCaseFinished) return;

    const currentNodeId = state.currentNodeId;
    const currentNode = (state.activeCase.nodes || {})[currentNodeId];
    if (!currentNode) return;

    const chosenOpt = (currentNode.opciones || []).find(o => o.id === optionId);
    if (!chosenOpt) return;

    // Guardar copia de los signos vitales previos para calcular los deltas fisiológicos
    const previousVitals = { ...(state.vitals || {}) };

    // Registrar en el historial cronológico del caso 2D
    if (!Array.isArray(state.actionsHistory)) {
        state.actionsHistory = [];
    }

    state.actionsHistory.push({
        nodeId: currentNodeId,
        etapaLabel: currentNode.etapaLabel || currentNodeId,
        optionId: chosenOpt.id,
        texto: chosenOpt.texto,
        esCorrecta: Boolean(chosenOpt.esCorrecta),
        racional: chosenOpt.racional || "",
        vitalsDelta: chosenOpt.vitalsDelta || null,
        timestamp: new Date().toLocaleTimeString()
    });

    decisionTreeContext.lastSelectedOption = chosenOpt;

    // Delegar la mutación de estado, puntaje y signos vitales al controlador principal 2D
    if (typeof decisionTreeContext.onSelectDecisionCallback === "function") {
        decisionTreeContext.onSelectDecisionCallback(optionId);
    }

    // Enriquecer el panel #engine2d-decision-feedback con el desglose hemodinámico detallado
    renderDetailedFeedbackBox2D(chosenOpt, previousVitals, state.vitals);

    // Si la opción no cambió de nodo (por ejemplo, conducta incorrecta que permanece en el mismo nodo),
    // refrescar el nodo para marcar visualmente la opción fallida
    if (!state.isCaseFinished && state.currentNodeId === currentNodeId) {
        const container = document.getElementById("engine2d-decision-body");
        if (container) {
            renderDecisionNode(container, state);
        }
    }
}

/**
 * Construye el bloque visual de retroalimentación clínica (`#engine2d-decision-feedback`)
 * incluyendo el Racional CACES y las insignias de impacto en signos vitales.
 * @param {Object} chosenOpt
 * @param {Object} prevVitals
 * @param {Object} newVitals
 */
export function renderDetailedFeedbackBox2D(chosenOpt, prevVitals = {}, newVitals = {}) {
    const feedbackBox = document.getElementById("engine2d-decision-feedback");
    if (!feedbackBox || !chosenOpt) return;

    const deltaBadges = buildHemodynamicDeltaBadges(prevVitals, newVitals, chosenOpt.vitalsDelta);

    feedbackBox.classList.remove(
        "hidden",
        "bg-secondary/15",
        "border-secondary",
        "text-secondary",
        "bg-danger/15",
        "border-danger",
        "text-danger"
    );

    if (chosenOpt.esCorrecta) {
        feedbackBox.classList.add("bg-secondary/15", "border-secondary", "text-gray-100");
        feedbackBox.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <strong class="text-secondary font-extrabold flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base">verified</span>
                        <span>Conducta Clínica Óptima (Protocolo CACES)</span>
                    </strong>
                    <span class="px-2 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[10px] font-bold">
                        Estabilidad +
                    </span>
                </div>
                <p class="text-xs text-gray-200 leading-relaxed">
                    ${escapeHTML(chosenOpt.racional || "Intervención clínica acertada. Los parámetros hemodinámicos evolucionan favorablemente.")}
                </p>
                ${deltaBadges ? `<div class="pt-1 flex flex-wrap gap-1.5">${deltaBadges}</div>` : ""}
            </div>
        `;
    } else {
        const penalty = typeof chosenOpt.scoreDelta === "number" ? chosenOpt.scoreDelta : -15;
        feedbackBox.classList.add("bg-danger/15", "border-danger", "text-gray-100");
        feedbackBox.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <strong class="text-danger font-extrabold flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base">warning</span>
                        <span>Alerta de Seguridad del Paciente (${penalty} pts)</span>
                    </strong>
                    <span class="px-2 py-0.5 rounded bg-danger/20 text-danger font-mono text-[10px] font-bold">
                        Riesgo Iatrogénico
                    </span>
                </div>
                <p class="text-xs text-gray-200 leading-relaxed">
                    ${escapeHTML(chosenOpt.racional || "Esta conducta deteriora la condición hemodinámica del paciente. Selecciona la intervención prioritaria.")}
                </p>
                ${deltaBadges ? `<div class="pt-1 flex flex-wrap gap-1.5">${deltaBadges}</div>` : ""}
            </div>
        `;
    }
}

/**
 * Genera insignias compactas con los cambios en FC, PA, SpO2 y FR tras una decisión.
 * @param {Object} prevVitals
 * @param {Object} newVitals
 * @param {Object} rawDelta
 * @returns {string}
 */
function buildHemodynamicDeltaBadges(prevVitals = {}, newVitals = {}, rawDelta = null) {
    if (!rawDelta && !newVitals) return "";

    const badges = [];

    if (typeof newVitals.hr === "number" && prevVitals.hr !== newVitals.hr) {
        const diff = newVitals.hr - (prevVitals.hr || newVitals.hr);
        const sign = diff > 0 ? `+${diff}` : `${diff}`;
        badges.push(`FC: ${newVitals.hr} lpm (${sign})`);
    }

    if (typeof newVitals.bpSys === "number" && (prevVitals.bpSys !== newVitals.bpSys || prevVitals.bpDia !== newVitals.bpDia)) {
        badges.push(`PA: ${newVitals.bpSys}/${newVitals.bpDia} mmHg`);
    }

    if (typeof newVitals.spo2 === "number" && prevVitals.spo2 !== newVitals.spo2) {
        const diff = newVitals.spo2 - (prevVitals.spo2 || newVitals.spo2);
        const sign = diff > 0 ? `+${diff}%` : `${diff}%`;
        badges.push(`SpO2: ${newVitals.spo2}% (${sign})`);
    }

    if (typeof newVitals.rr === "number" && prevVitals.rr !== newVitals.rr) {
        badges.push(`FR: ${newVitals.rr} rpm`);
    }

    return badges.map(label => `
        <span class="px-2 py-0.5 rounded-md bg-surface border border-surface-high font-mono text-[10px] text-primary font-bold">
            ${escapeHTML(label)}
        </span>
    `).join("");
}

// ============================================================================
// 5. DEBRIEFING CLÍNICO FINAL Y AUDITORÍA DEL ÁRBOL DE DECISIÓN
// ============================================================================

/**
 * Renderiza el informe final de desempeño (*Debriefing Clínico 2D*) cuando el
 * estudiante alcanza el desenlace del árbol de decisiones (`FIN_EXITO` o `FIN`).
 * @param {HTMLElement} container
 * @param {Object} state
 */
export function renderCaseDebriefing2D(container, state = decisionTreeContext.stateRef) {
    if (!container || !state) return;

    const history = Array.isArray(state.actionsHistory) ? state.actionsHistory : [];
    const mistakesCount = history.filter(item => !item.esCorrecta).length;
    const findingsCount = Array.isArray(state.discoveredFindings) ? state.discoveredFindings.length : 0;
    const v = state.vitals || {};

    const historyRows = history.map((item, idx) => `
        <div class="p-2.5 rounded-xl bg-surface border ${
            item.esCorrecta ? "border-secondary/40" : "border-danger/40"
        } flex items-start justify-between gap-2 text-left">
            <div class="space-y-0.5">
                <span class="block text-[10px] font-mono ${
                    item.esCorrecta ? "text-secondary" : "text-danger"
                } font-bold">
                    ${idx + 1}. ${escapeHTML(item.etapaLabel || "Nodo Clínico")} • ${item.esCorrecta ? "Óptima" : "Iatrogénica"}
                </span>
                <p class="text-xs text-gray-200 leading-snug">${escapeHTML(item.texto)}</p>
            </div>
            <span class="text-[10px] font-mono text-gray-500 shrink-0">${escapeHTML(item.timestamp || "")}</span>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="bg-surface border border-secondary/50 rounded-2xl p-5 space-y-4">
            <div class="text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-secondary">military_tech</span>
                <h4 class="text-base font-extrabold text-white">
                    Debriefing Clínico 2D • Caso Resuelto
                </h4>
                <p class="text-xs text-gray-300">
                    Desempeño Clínico Final:
                    <strong class="text-secondary font-mono text-sm">${state.score} / 100 pts</strong>
                </p>
            </div>

            <!-- Resumen de Signos Vitales al Alta / Estabilización -->
            <div class="grid grid-cols-3 gap-2 text-center bg-surface-container p-3 rounded-xl border border-surface-high">
                <div>
                    <span class="block text-[10px] font-mono text-gray-400 uppercase">Signos Finales</span>
                    <span class="text-xs font-mono font-bold text-primary">
                        FC ${v.hr || "--"} • SpO2 ${v.spo2 || "--"}%
                    </span>
                </div>
                <div>
                    <span class="block text-[10px] font-mono text-gray-400 uppercase">Maniobras 2D</span>
                    <span class="text-xs font-mono font-bold text-secondary">
                        ${findingsCount} exploraciones
                    </span>
                </div>
                <div>
                    <span class="block text-[10px] font-mono text-gray-400 uppercase">Alertas Clínicas</span>
                    <span class="text-xs font-mono font-bold ${mistakesCount === 0 ? "text-secondary" : "text-warning"}">
                        ${mistakesCount} error${mistakesCount === 1 ? "" : "es"}
                    </span>
                </div>
            </div>

            <!-- Bitácora de Decisiones Tomadas en el Árbol -->
            ${
                historyRows
                    ? `<div class="space-y-2">
                        <span class="block text-[10px] font-mono uppercase text-gray-400 font-bold">
                            Ruta de Decisiones Tomadas (${history.length})
                        </span>
                        <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            ${historyRows}
                        </div>
                       </div>`
                    : ""
            }

            <div class="pt-1 flex items-center justify-center">
                <button
                    type="button"
                    id="btn-engine2d-repeat-finished"
                    class="w-full py-2.5 px-4 rounded-xl bg-primary text-surface text-xs font-extrabold hover:bg-opacity-90 transition-all flex items-center justify-center gap-1.5"
                >
                    <span class="material-symbols-outlined text-sm">replay</span>
                    <span>Repetir Simulación Clínica 2D</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById("btn-engine2d-repeat-finished")?.addEventListener("click", () => {
        const restartBtn = document.getElementById("btn-engine2d-restart");
        if (restartBtn) {
            restartBtn.click();
        }
    });
}

// ============================================================================
// 6. NORMALIZACIÓN DE NODOS CLÍNICOS Y UTILIDADES SEGURAS
// ============================================================================

/**
 * Garantiza que un caso clínico 2D proveniente de Firestore o del banco semilla
 * tenga su diccionario `nodes` e `initialNodeId` correctamente estructurados.
 * @param {Object} caseItem
 * @returns {Object}
 */
export function enrichCaseDecisionNodes2D(caseItem) {
    if (!caseItem || typeof caseItem !== "object") return caseItem;

    if (!caseItem.initialNodeId) {
        const firstKey = Object.keys(caseItem.nodes || {})[0] || "node_1";
        caseItem.initialNodeId = firstKey;
    }

    const nodes = caseItem.nodes || {};
    const keys = Object.keys(nodes);
    keys.forEach((key, idx) => {
        const node = nodes[key];
        if (node && !node.etapaLabel) {
            node.etapaLabel = `Nodo ${idx + 1} de ${keys.length} • Decisión Clínica`;
        }
    });

    return caseItem;
}

function escapeHTML(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(str = "") {
    return escapeHTML(str);
}
