// ============================================================================
// ARCHIVO: js/6-engine-2d/sim2d.interactiveTools.js
// DESCRIPCIÓN: Subcomponente de Instrumental Médico 2D, Mecánicas Drag & Drop
//              (Escritorio y Táctil), Colocación de Derivaciones ECG, Accesos
//              Vasculares, Oxigenoterapia y Focos de Auscultación sobre el
//              Lienzo HTML5 Canvas del Paciente (#view-sim2d).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    ASSETS_2D_PATHS,
    CLINICAL_TOOLS_2D,
    PATIENT_HOTSPOTS_2D,
    updatePatientVitals2D,
    playClinicalAuscultationTone
} from "./engine2d.controller.js";

// ============================================================================
// 1. ESTADO INTERNO Y MAPA DE AFINIDAD ANATÓMICA DEL INSTRUMENTAL 2D
// ============================================================================

const interactiveToolsContext = {
    initialized: false,
    stateRef: null,
    toolsList: CLINICAL_TOOLS_2D,
    hotspotsList: PATIENT_HOTSPOTS_2D,
    onApplyToolCallback: null,
    draggingToolId: null,
    appliedDevicesOnPatient: {}, // { via_aerea: "oxigeno", acceso_braquial: "acceso_venoso", ecg_placed: true }
    preloadedSprites: {},
    lastCaseIdTracked: null,
    shortcutsBound: false
};

// Mapa de compatibilidad anatómica para resaltar focos recomendados según herramienta
const TOOL_HOTSPOT_AFFINITY = Object.freeze({
    fonendoscopio: [
        "foco_aortico",
        "foco_pulmonar",
        "foco_tricuspideo",
        "foco_mitral",
        "base_pulmonar"
    ],
    ecg12: [
        "foco_aortico",
        "foco_pulmonar",
        "foco_tricuspideo",
        "foco_mitral"
    ],
    oxigeno: [
        "via_aerea"
    ],
    acceso_venoso: [
        "acceso_braquial"
    ],
    desfibrilador: [
        "foco_aortico",
        "foco_mitral"
    ]
});

// ============================================================================
// 2. INICIALIZACIÓN Y CONEXIÓN CON ENGINE2D.CONTROLLER.JS
// ============================================================================

/**
 * Inicializa el subcomponente de Instrumental 2D y sincroniza sus referencias
 * con `js/6-engine-2d/engine2d.controller.js`.
 * @param {Object} options
 * @param {Object} options.state - Referencia a `engine2DState`
 * @param {Array} options.tools - Catálogo `CLINICAL_TOOLS_2D`
 * @param {Array} options.hotspots - Puntos anatómicos `PATIENT_HOTSPOTS_2D`
 * @param {Function} options.onApplyTool - Callback `applyInstrumentalTool2D`
 */
export function initInteractiveTools2D(options = {}) {
    if (options.state) {
        interactiveToolsContext.stateRef = options.state;
    }
    if (Array.isArray(options.tools) && options.tools.length > 0) {
        interactiveToolsContext.toolsList = options.tools;
    }
    if (Array.isArray(options.hotspots) && options.hotspots.length > 0) {
        interactiveToolsContext.hotspotsList = options.hotspots;
    }
    if (typeof options.onApplyTool === "function") {
        interactiveToolsContext.onApplyToolCallback = options.onApplyTool;
    }

    preloadInstrumentalSprites2D();
    bindStageDropAndTouchZones2D();
    bindInstrumentalKeyboardShortcuts2D();

    const toolsBar = document.getElementById("engine2d-tools-bar");
    if (toolsBar && interactiveToolsContext.stateRef) {
        renderToolsBar(toolsBar, interactiveToolsContext.toolsList, interactiveToolsContext.stateRef);
    }

    renderInteractiveHotspotsLayer(interactiveToolsContext.stateRef);
    interactiveToolsContext.initialized = true;

    return {
        module: "sim2d.interactiveTools",
        status: "online"
    };
}

/**
 * Alias de compatibilidad arquitectónica.
 */
export const initSim2DInteractiveTools = initInteractiveTools2D;

/**
 * Precarga de forma silenciosa y tolerante a fallos los sprites alojados en
 * `assets/6-multimedia-2d/instrumental-sprites/`.
 */
function preloadInstrumentalSprites2D() {
    (interactiveToolsContext.toolsList || []).forEach(tool => {
        if (!tool.sprite || interactiveToolsContext.preloadedSprites[tool.id]) return;
        const img = new Image();
        img.onload = () => {
            interactiveToolsContext.preloadedSprites[tool.id] = {
                loaded: true,
                image: img
            };
        };
        img.onerror = () => {
            interactiveToolsContext.preloadedSprites[tool.id] = {
                loaded: false,
                image: null
            };
        };
        img.src = tool.sprite;
    });
}

// ============================================================================
// 3. RENDERIZADO DE LA BARRA DE INSTRUMENTAL 2D (#engine2d-tools-bar)
// ============================================================================

/**
 * Renderiza los botones de instrumental médico 2D con soporte para Drag & Drop,
 * selección táctil, vista previa de sprites de `assets/6-multimedia-2d/instrumental-sprites/`
 * y contador de uso en el caso clínico activo.
 * Es invocada automáticamente por `renderInteractiveToolsBar2D()` desde `engine2d.controller.js`.
 * @param {HTMLElement} container - Contenedor `#engine2d-tools-bar`
 * @param {Array} tools - Lista `CLINICAL_TOOLS_2D`
 * @param {Object} state - Estado `engine2DState`
 */
export function renderToolsBar(
    container,
    tools = interactiveToolsContext.toolsList,
    state = interactiveToolsContext.stateRef
) {
    const targetContainer = container || document.getElementById("engine2d-tools-bar");
    if (!targetContainer) return;

    if (state) {
        interactiveToolsContext.stateRef = state;
        syncCaseResetIfChanged(state);
    }
    if (Array.isArray(tools) && tools.length > 0) {
        interactiveToolsContext.toolsList = tools;
    }

    const activeToolId = state?.selectedToolId || "fonendoscopio";

    targetContainer.innerHTML = (interactiveToolsContext.toolsList || []).map((tool, index) => {
        const isSelected = activeToolId === tool.id;
        const isApplied = isToolCurrentlyAppliedOnPatient(tool.id);

        return `
            <button
                type="button"
                draggable="true"
                data-tool-id="${escapeAttr(tool.id)}"
                title="${escapeAttr(tool.instruccion || tool.nombre)}"
                class="engine2d-tool-btn relative p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing select-none ${
                    isSelected
                        ? "bg-primary/15 border-primary text-primary shadow-[0_0_16px_rgba(0,229,255,0.22)] scale-[1.02]"
                        : "bg-surface border-surface-high text-gray-300 hover:border-primary/50 hover:text-white"
                }"
            >
                <!-- Insignia de estado (Colocado o Tecla rápida) -->
                <div class="w-full flex items-center justify-between px-0.5">
                    <span class="text-[9px] font-mono ${isSelected ? "text-primary font-bold" : "text-gray-500"}">
                        [F${index + 1}]
                    </span>
                    ${
                        isApplied
                            ? `<span class="px-1.5 py-0.2 rounded bg-secondary/20 border border-secondary/40 text-secondary text-[9px] font-mono font-extrabold">
                                Activo
                               </span>`
                            : `<span class="w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary" : "bg-surface-high"}"></span>`
                    }
                </div>

                <!-- Icono Material + Miniatura Sprite 2D con Fallback Limpio -->
                <div class="relative w-9 h-9 rounded-lg bg-surface-container border border-surface-high flex items-center justify-center overflow-hidden">
                    <img
                        src="${escapeAttr(tool.sprite || `${ASSETS_2D_PATHS.TOOLS}${tool.id}.png`)}"
                        alt="${escapeAttr(tool.nombre)}"
                        class="w-6 h-6 object-contain hidden"
                        onload="this.classList.remove('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.add('hidden');"
                        onerror="this.classList.add('hidden');"
                    />
                    <span class="material-symbols-outlined text-xl ${isSelected ? "text-primary" : "text-gray-200"}">
                        ${escapeHTML(tool.icono || "medical_services")}
                    </span>
                </div>

                <!-- Nombre del Instrumento -->
                <span class="text-[11px] font-extrabold text-center leading-tight">
                    ${escapeHTML(tool.nombre)}
                </span>
            </button>
        `;
    }).join("");

    // Enlazar eventos de selección y arrastre (Drag & Drop)
    targetContainer.querySelectorAll(".engine2d-tool-btn").forEach(btn => {
        const toolId = btn.dataset.toolId;

        btn.addEventListener("click", () => {
            selectToolById2D(toolId);
        });

        btn.addEventListener("dragstart", (e) => {
            interactiveToolsContext.draggingToolId = toolId;
            selectToolById2D(toolId);
            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", toolId);
                e.dataTransfer.effectAllowed = "copyMove";
            }
            btn.classList.add("opacity-70");
        });

        btn.addEventListener("dragend", () => {
            interactiveToolsContext.draggingToolId = null;
            btn.classList.remove("opacity-70");
        });
    });

    renderInteractiveHotspotsLayer(state);
}

/**
 * Selecciona un instrumento médico 2D por su ID, actualiza las etiquetas de ayuda
 * y resalta en el lienzo los focos anatómicos compatibles.
 * @param {string} toolId
 */
export function selectToolById2D(toolId) {
    const state = interactiveToolsContext.stateRef;
    const foundTool = (interactiveToolsContext.toolsList || []).find(t => t.id === toolId);
    if (!foundTool || !state) return;

    state.selectedToolId = foundTool.id;

    const badge = document.getElementById("engine2d-active-tool-badge");
    const hint = document.getElementById("engine2d-tool-hint");

    if (badge) {
        badge.textContent = `Activo: ${foundTool.nombre}`;
    }
    if (hint) {
        const compatibleSpots = getRecommendedHotspotsForTool(foundTool.id)
            .map(s => s.label)
            .join(" • ");
        hint.innerHTML = `
            <span class="text-primary font-bold">${escapeHTML(foundTool.nombre)}:</span>
            <span>${escapeHTML(foundTool.instruccion)}</span>
            ${
                compatibleSpots
                    ? `<span class="block text-[11px] font-mono text-secondary mt-1">
                        ▶ Focos recomendados: ${escapeHTML(compatibleSpots)}
                       </span>`
                    : ""
            }
        `;
    }

    const toolsBar = document.getElementById("engine2d-tools-bar");
    if (toolsBar) {
        renderToolsBar(toolsBar, interactiveToolsContext.toolsList, state);
    }
}

// ============================================================================
// 4. FOCOS ANATÓMICOS INTERACTIVOS (#engine2d-hotspots-layer)
// ============================================================================

/**
 * Renderiza los puntos anatómicos sobre el lienzo del paciente con indicadores de
 * afinidad para la herramienta seleccionada, estado de exploración y soporte Drop/Clic.
 * @param {Object} state
 */
export function renderInteractiveHotspotsLayer(state = interactiveToolsContext.stateRef) {
    const layer = document.getElementById("engine2d-hotspots-layer");
    if (!layer || !state) return;

    syncCaseResetIfChanged(state);

    const activeToolId = state.selectedToolId || "fonendoscopio";
    const recommendedIds = TOOL_HOTSPOT_AFFINITY[activeToolId] || [];

    layer.innerHTML = (interactiveToolsContext.hotspotsList || []).map(spot => {
        const isSelected = state.selectedHotspotId === spot.id;
        const isRecommended = recommendedIds.includes(spot.id);
        const appliedToolOnSpot = interactiveToolsContext.appliedDevicesOnPatient[spot.id];

        let ringClass = "bg-surface/85 border-gray-500 text-gray-300";
        if (isSelected) {
            ringClass = "scale-125 bg-primary/30 border-primary text-primary shadow-[0_0_15px_rgba(0,229,255,0.45)]";
        } else if (appliedToolOnSpot) {
            ringClass = "bg-secondary/25 border-secondary text-secondary shadow-[0_0_12px_rgba(148,222,45,0.35)]";
        } else if (isRecommended) {
            ringClass = "bg-warning/20 border-warning text-warning hover:scale-110";
        }

        return `
            <button
                type="button"
                data-hotspot-id="${escapeAttr(spot.id)}"
                title="${escapeAttr(spot.label)}"
                style="left: ${Number(spot.xPercent)}%; top: ${Number(spot.yPercent)}%;"
                class="engine2d-hotspot-btn -translate-x-1/2 -translate-y-1/2 absolute group flex items-center justify-center focus:outline-none z-10"
            >
                <span class="w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${ringClass}">
                    <span class="w-2 h-2 rounded-full ${
                        appliedToolOnSpot
                            ? "bg-secondary"
                            : isRecommended
                                ? "bg-primary animate-ping"
                                : "bg-gray-400"
                    }"></span>
                </span>

                <!-- Etiqueta flotante del foco anatómico -->
                <span class="hidden group-hover:flex items-center gap-1.5 absolute left-8 whitespace-nowrap px-2.5 py-1 rounded-lg bg-surface-container/95 border border-primary/40 text-[10px] font-mono text-white shadow-xl z-20">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    <span>${escapeHTML(spot.label)}</span>
                    ${
                        appliedToolOnSpot
                            ? `<strong class="text-secondary">[${escapeHTML(appliedToolOnSpot.toUpperCase())}]</strong>`
                            : ""
                    }
                </span>
            </button>
        `;
    }).join("");

    layer.querySelectorAll(".engine2d-hotspot-btn").forEach(btn => {
        const spotId = btn.dataset.hotspotId;

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleToolOnHotspot(state.selectedToolId || "fonendoscopio", spotId, state);
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
            e.stopPropagation();
            btn.classList.remove("scale-125");
            const droppedToolId =
                e.dataTransfer?.getData("text/plain") ||
                interactiveToolsContext.draggingToolId ||
                state.selectedToolId ||
                "fonendoscopio";
            handleToolOnHotspot(droppedToolId, spotId, state);
        });
    });
}

// ============================================================================
// 5. APLICACIÓN CLÍNICA DEL INSTRUMENTAL SOBRE EL PACIENTE 2D
// ============================================================================

/**
 * Ejecuta la lógica clínica cuando un instrumento (`toolId`) se aplica o suelta
 * sobre un punto anatómico (`hotspotId`) del paciente 2D:
 * - Evalúa afinidad semiológica/terapéutica.
 * - Actualiza signos vitales (`updatePatientVitals2D`).
 * - Dispara el audio de auscultación (`playClinicalAuscultationTone`).
 * - Registra el hallazgo cronológico en `#engine2d-findings-log`.
 * - Dibuja la superposición visual del dispositivo en `#engine2d-patient-canvas`.
 *
 * Es invocada automáticamente por `applyInstrumentalTool2D()` en `engine2d.controller.js`.
 * @param {string} toolId
 * @param {string} hotspotId
 * @param {Object} state
 */
export function handleToolOnHotspot(
    toolId,
    hotspotId,
    state = interactiveToolsContext.stateRef
) {
    if (!state) return;
    interactiveToolsContext.stateRef = state;
    syncCaseResetIfChanged(state);

    const spot = (interactiveToolsContext.hotspotsList || []).find(s => s.id === hotspotId);
    const tool = (interactiveToolsContext.toolsList || []).find(t => t.id === toolId);
    if (!spot || !tool) return;

    state.selectedToolId = tool.id;
    state.selectedHotspotId = spot.id;

    const activeCase = state.activeCase || {};
    let findingMessage = "";
    let statusTone = "info"; // "success" | "warning" | "info"

    // 1. FONENDOSCOPIO 2D (Auscultación Cardíaca y Pulmonar por Foco)
    if (tool.id === "fonendoscopio") {
        interactiveToolsContext.appliedDevicesOnPatient.last_auscultated = spot.id;
        const customFocoText = activeCase?.auscultacionPorFoco?.[spot.id];

        if (customFocoText) {
            findingMessage = `[Auscultación • ${spot.label}]: ${customFocoText}`;
            statusTone = "success";
        } else if (spot.id === "base_pulmonar") {
            findingMessage = `[Auscultación Pulmonar • ${spot.label}]: ${state.vitals?.lungSound || "Murmullo vesicular conservado."}`;
            statusTone = "success";
        } else if (spot.id.startsWith("foco_")) {
            const heartMap = {
                foco_aortico: `2° EIC Derecho: ${state.vitals?.heartSound || "Ruidos rítmicos"}, segundo ruido (A2) conservado.`,
                foco_pulmonar: `2° EIC Izquierdo: Componente pulmonar (P2) audible. ${state.vitals?.heartSound || ""}`,
                foco_tricuspideo: `Borde paraesternal inferior: Sin roce pericárdico. ${state.vitals?.heartSound || ""}`,
                foco_mitral: `Ápex (5° EIC LMC): ${state.vitals?.heartSound || "S1-S2 audibles"}.`
            };
            findingMessage = `[Auscultación Cardíaca • ${spot.label}]: ${heartMap[spot.id] || state.vitals?.heartSound}`;
            statusTone = "success";
        } else {
            findingMessage = `[Fonendoscopio en ${spot.label}]: Zona no óptima para auscultación cardiopulmonar. Desplaza la campana hacia los 4 focos precordiales o bases pulmonares.`;
            statusTone = "warning";
        }

        playClinicalAuscultationTone(spot.id);
    }

    // 2. DERIVACIONES ECG (Electrocardiograma de 12 Derivaciones)
    else if (tool.id === "ecg12") {
        if (spot.id.startsWith("foco_") || spot.id === "base_pulmonar") {
            interactiveToolsContext.appliedDevicesOnPatient.ecg_placed = true;
            interactiveToolsContext.appliedDevicesOnPatient[spot.id] = "ecg12";
            const rhythmFormatted = (state.vitals?.rhythm || "sinusal").replace(/_/g, " ").toUpperCase();
            findingMessage = `[ECG 12 Derivaciones conectado en Precordio (${spot.label})]: Trazo continuo activo en Monitor ICU • Ritmo: ${rhythmFormatted} • FC: ${state.vitals?.hr || 80} lpm • QRS estrecho.`;
            statusTone = "success";
        } else {
            findingMessage = `[Derivaciones ECG → ${spot.label}]: Coloca los electrodos sobre la región precordial (focos torácicos) para obtener un registro adecuado.`;
            statusTone = "warning";
        }
    }

    // 3. OXIGENOTERAPIA (Soporte Ventilatorio en Vía Aérea)
    else if (tool.id === "oxigeno") {
        if (spot.id === "via_aerea") {
            const alreadyApplied = interactiveToolsContext.appliedDevicesOnPatient.via_aerea === "oxigeno";
            interactiveToolsContext.appliedDevicesOnPatient.via_aerea = "oxigeno";

            const currentSpo2 = Number(state.vitals?.spo2 || 90);
            const currentRr = Number(state.vitals?.rr || 24);
            const nextSpo2 = alreadyApplied ? currentSpo2 : Math.min(99, currentSpo2 + 5);
            const nextRr = alreadyApplied ? currentRr : Math.max(16, currentRr - 4);

            updatePatientVitals2D({ spo2: nextSpo2, rr: nextRr });
            findingMessage = alreadyApplied
                ? `[Oxigenoterapia en ${spot.label}]: Mascarilla de O2 permeable mantendo SpO2 en ${nextSpo2}% y FR en ${nextRr} rpm.`
                : `[Oxigenoterapia Aplicada • ${spot.label}]: Soporte de O2 suplementario titulado. SpO2 mejora a ${nextSpo2}% y FR desciende a ${nextRr} rpm.`;
            statusTone = "success";
        } else {
            findingMessage = `[Oxigenoterapia → ${spot.label}]: La mascarilla o cánula de oxígeno debe posicionarse directamente en la Vía Aérea Superior.`;
            statusTone = "warning";
        }
    }

    // 4. ACCESO VENOSO PERIFÉRICO / LÍQUIDOS
    else if (tool.id === "acceso_venoso") {
        if (spot.id === "acceso_braquial") {
            const alreadyCannulated = interactiveToolsContext.appliedDevicesOnPatient.acceso_braquial === "acceso_venoso";
            interactiveToolsContext.appliedDevicesOnPatient.acceso_braquial = "acceso_venoso";

            const currentSys = Number(state.vitals?.bpSys || 90);
            const currentDia = Number(state.vitals?.bpDia || 55);
            const nextSys = alreadyCannulated ? currentSys : Math.min(125, currentSys + 8);
            const nextDia = alreadyCannulated ? currentDia : Math.min(82, currentDia + 5);

            updatePatientVitals2D({ bpSys: nextSys, bpDia: nextDia });
            findingMessage = alreadyCannulated
                ? `[Acceso Venoso Periférico]: Vía braquial 18G permeable y lista para administración de fármacos del árbol de decisión (PA ${nextSys}/${nextDia} mmHg).`
                : `[Acceso Venoso Canalizado • ${spot.label}]: Catéter periférico 18G permeable en miembro superior. PA responde a ${nextSys}/${nextDia} mmHg.`;
            statusTone = "success";
        } else {
            findingMessage = `[Acceso Venoso → ${spot.label}]: Selecciona el punto 'Acceso Venoso Periférico' en el miembro superior para canalizar la vía.`;
            statusTone = "warning";
        }
    }

    // 5. PALAS DE DESFIBRILACIÓN / CARDIOVERSIÓN ELÉCTRICA
    else if (tool.id === "desfibrilador") {
        if (spot.id === "foco_mitral" || spot.id === "foco_aortico") {
            interactiveToolsContext.appliedDevicesOnPatient.pads_placed = true;
            interactiveToolsContext.appliedDevicesOnPatient[spot.id] = "desfibrilador";
            const currentRhythm = (state.vitals?.rhythm || "sinusal").replace(/_/g, " ").toUpperCase();
            findingMessage = `[Palas / Parches en ${spot.label}]: Impedancia torácica óptima. Ritmo detectado: ${currentRhythm} (${state.vitals?.hr || 80} lpm). Confirma la conducta eléctrica o farmacológica en el Árbol de Decisión.`;
            statusTone = "success";
        } else {
            findingMessage = `[Palas / Cardioversión → ${spot.label}]: Posiciona las palas en región infraclavicular derecha (Foco Aórtico) y Ápex (Foco Mitral).`;
            statusTone = "warning";
        }
    }

    // Registrar hallazgo en el estado y en la bitácora visual
    recordInstrumentalFinding2D(findingMessage, statusTone, state);

    // Actualizar UI de barra de herramientas, hotspots y superposición en el Canvas
    const toolsBar = document.getElementById("engine2d-tools-bar");
    if (toolsBar) {
        renderToolsBar(toolsBar, interactiveToolsContext.toolsList, state);
    }
    renderInteractiveHotspotsLayer(state);
    drawAppliedToolsOverlay2D(document.getElementById("engine2d-patient-canvas"), state);
}

/**
 * Añade el hallazgo clínico a `state.discoveredFindings` y actualiza `#engine2d-findings-log`.
 * @param {string} findingText
 * @param {"success"|"warning"|"info"} tone
 * @param {Object} state
 */
function recordInstrumentalFinding2D(findingText, tone = "info", state = interactiveToolsContext.stateRef) {
    if (!state || !findingText) return;

    if (!Array.isArray(state.discoveredFindings)) {
        state.discoveredFindings = [];
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const entry = `${timestamp} • ${findingText}`;
    state.discoveredFindings.unshift(entry);

    const logEl = document.getElementById("engine2d-findings-log");
    if (!logEl) return;

    logEl.innerHTML = state.discoveredFindings
        .slice(0, 10)
        .map((line, idx) => {
            let colorClass = "text-gray-400";
            if (idx === 0) {
                colorClass = tone === "warning" ? "text-warning font-bold" : "text-primary font-bold";
            }
            return `
                <div class="${colorClass} py-0.5 border-b border-surface-high/40 last:border-0">
                    ▶ ${escapeHTML(line)}
                </div>
            `;
        })
        .join("");
}

// ============================================================================
// 6. DIBUJO DE DISPOSITIVOS APLICADOS SOBRE EL CANVAS (#engine2d-patient-canvas)
// ============================================================================

/**
 * Dibuja sobre `#engine2d-patient-canvas` las representaciones visuales de los
 * instrumentos colocados por el estudiante (mascarilla de O2, vía periférica,
 * electrodos de ECG, membrana del fonendoscopio y parches de desfibrilación).
 * @param {HTMLCanvasElement|null} canvas
 * @param {Object} state
 */
export function drawAppliedToolsOverlay2D(
    canvas = document.getElementById("engine2d-patient-canvas"),
    state = interactiveToolsContext.stateRef
) {
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const devices = interactiveToolsContext.appliedDevicesOnPatient || {};

    ctx.save();

    // 1. Si hay Oxigenoterapia aplicada en Vía Aérea, dibujar mascarilla y línea de flujo O2
    if (devices.via_aerea === "oxigeno") {
        const x = w * 0.50;
        const y = h * 0.18;
        ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText("O2 ACTIVO", x + 22, y + 4);
    }

    // 2. Si hay Acceso Venoso canalizado en región braquial, dibujar catéter y línea IV
    if (devices.acceso_braquial === "acceso_venoso") {
        const x = w * 0.26;
        const y = h * 0.56;
        ctx.strokeStyle = "#94de2d";
        ctx.fillStyle = "rgba(148, 222, 45, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - 14, y - 10, 28, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#94de2d";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText("VÍA IV 18G", x - 34, y + 26);
    }

    // 3. Si las Derivaciones de ECG están colocadas, trazar vectores precordiales
    if (devices.ecg_placed) {
        const leads = [
            { x: w * 0.43, y: h * 0.34, label: "RA" },
            { x: w * 0.57, y: h * 0.34, label: "LA" },
            { x: w * 0.60, y: h * 0.47, label: "V4-V6" }
        ];
        ctx.strokeStyle = "rgba(148, 222, 45, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        leads.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx. closePath();
        ctx.stroke();
    }

    // 4. Resaltar con ondas acústicas el foco que se acaba de auscultar
    const activeSpot = (interactiveToolsContext.hotspotsList || []).find(
        s => s.id === state.selectedHotspotId
    );
    if (activeSpot && state.selectedToolId === "fonendoscopio") {
        const sx = (activeSpot.xPercent / 100) * w;
        const sy = (activeSpot.yPercent / 100) * h;

        ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx, sy, 22, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

// ============================================================================
// 7. SOPORTE DROP EN LIENZO GENERAL, TÁCTIL Y ATAJOS DE TECLADO
// ============================================================================

/**
 * Permite soltar una herramienta en cualquier punto del escenario `#engine2d-patient-stage`
 * calculando automáticamente el foco anatómico más cercano a las coordenadas del cursor.
 */
function bindStageDropAndTouchZones2D() {
    const stage = document.getElementById("engine2d-patient-stage");
    if (!stage || stage.dataset.toolsStageBound) return;
    stage.dataset.toolsStageBound = "1";

    stage.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    stage.addEventListener("drop", (e) => {
        e.preventDefault();
        const state = interactiveToolsContext.stateRef;
        if (!state) return;

        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        const nearestSpot = findNearestHotspotByCoords(xPercent, yPercent);
        if (!nearestSpot) return;

        const droppedToolId =
            e.dataTransfer?.getData("text/plain") ||
            interactiveToolsContext.draggingToolId ||
            state.selectedToolId ||
            "fonendoscopio";

        handleToolOnHotspot(droppedToolId, nearestSpot.id, state);
    });
}

/**
 * Registra atajos de teclado (`F1`-`F5` o `Shift + 1..5`) para alternar rápidamente
 * entre el Fonendoscopio, ECG, Oxigenoterapia, Acceso Venoso y Desfibrilador.
 */
function bindInstrumentalKeyboardShortcuts2D() {
    if (interactiveToolsContext.shortcutsBound) return;
    interactiveToolsContext.shortcutsBound = true;

    document.addEventListener("keydown", (e) => {
        const sim2dView = document.getElementById("view-sim2d");
        if (!sim2dView || sim2dView.classList.contains("hidden")) return;

        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

        const fKeyMap = {
            F1: 0,
            F2: 1,
            F3: 2,
            F4: 3,
            F5: 4
        };

        if (Object.prototype.hasOwnProperty.call(fKeyMap, e.key)) {
            const idx = fKeyMap[e.key];
            const targetTool = (interactiveToolsContext.toolsList || [])[idx];
            if (targetTool) {
                e.preventDefault();
                selectToolById2D(targetTool.id);
            }
        }
    });
}

// ============================================================================
// 8. UTILIDADES INTERNAS Y LIMPIEZA ENTRE CASOS CLÍNICOS
// ============================================================================

/**
 * Reinicia los dispositivos colocados sobre el paciente cuando el estudiante
 * cambia de caso clínico o pulsa "Reiniciar Caso".
 * @param {Object} state
 */
function syncCaseResetIfChanged(state) {
    if (!state) return;
    const currentCaseId = state.activeCase?.id || null;
    const findingsCount = Array.isArray(state.discoveredFindings) ? state.discoveredFindings.length : 0;

    if (
        interactiveToolsContext.lastCaseIdTracked !== currentCaseId ||
        findingsCount === 0
    ) {
        interactiveToolsContext.lastCaseIdTracked = currentCaseId;
        interactiveToolsContext.appliedDevicesOnPatient = {};
    }
}

function isToolCurrentlyAppliedOnPatient(toolId) {
    const devices = interactiveToolsContext.appliedDevicesOnPatient || {};
    if (toolId === "ecg12") return Boolean(devices.ecg_placed);
    if (toolId === "desfibrilador") return Boolean(devices.pads_placed);
    if (toolId === "fonendoscopio") return Boolean(devices.last_auscultated);
    return Object.values(devices).includes(toolId);
}

function getRecommendedHotspotsForTool(toolId) {
    const allowedIds = TOOL_HOTSPOT_AFFINITY[toolId] || [];
    return (interactiveToolsContext.hotspotsList || []).filter(s => allowedIds.includes(s.id));
}

function findNearestHotspotByCoords(xPercent, yPercent) {
    let bestSpot = null;
    let minDistance = Infinity;

    (interactiveToolsContext.hotspotsList || []).forEach(spot => {
        const dx = (spot.xPercent || 0) - xPercent;
        const dy = (spot.yPercent || 0) - yPercent;
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
            minDistance = dist;
            bestSpot = spot;
        }
    });

    return bestSpot;
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
