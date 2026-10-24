// ============================================================================
// ARCHIVO: js/7-engine-3d/sim3d.hud.js
// DESCRIPCIÓN: Marco Clínico HUD (Heads-Up Display) para el Motor 3D.
//              Gestiona las pestañas de intervención médica (Vía Aérea, Accesos,
//              Fármacos UCI, Desfibrilador/RCP), el inspector semiológico
//              cefalocaudal 3D, el metrónomo de RCP (110 cpm), el selector de
//              energía bifásica y las alertas holográficas sobre el visor WebGL.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { appState } from "../2-core/state.store.js";

// ============================================================================
// 1. CONFIGURACIÓN INTERNA Y RUTAS A BÓVEDA MULTIMEDIA (hud-iconos)
// ============================================================================

export const HUD_ICONS_BASE_PATH = "assets/7-multimedia-3d/hud-iconos/";

const CATEGORY_ICON_ASSETS = Object.freeze({
    via_aerea: `${HUD_ICONS_BASE_PATH}hud-via-aerea.svg`,
    accesos_vasculares: `${HUD_ICONS_BASE_PATH}hud-accesos-vasculares.svg`,
    farmacos_uci: `${HUD_ICONS_BASE_PATH}hud-farmacos-uci.svg`,
    desfibrilador_rcp: `${HUD_ICONS_BASE_PATH}hud-desfibrilador-rcp.svg`
});

const hudRuntime = {
    initialized: false,
    stateRef: null,
    categoriesRef: null,
    regionsRef: null,
    onExecuteAction: null,
    onInspectRegion: null,
    searchQuery: "",
    selectedDefibJoules: 200,
    defibSyncMode: true,
    inspectedRegionsSet: new Set(["torax"]),
    actionExecutionCounts: {},
    cprMetronome: {
        active: false,
        bpm: 110,
        intervalId: null,
        audioCtx: null,
        beatCount: 0
    },
    toastTimeoutId: null
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL MARCO CLÍNICO HUD 3D
// ============================================================================

/**
 * Inicializa el subcomponente HUD 3D y lo enlaza con `engine3d.controller.js`.
 * @param {Object} config
 * @param {Object} config.state - Referencia a `engine3DState`
 * @param {Object} config.categories - Diccionario `HUD_ACTION_CATEGORIES_3D`
 * @param {Array}  config.regions - Lista `CEPHALOCAUDAL_REGIONS_3D`
 * @param {Function} config.onExecuteAction - Callback `dispatchClinicalAction3D(categoryId, actionId)`
 * @param {Function} config.onInspectRegion - Callback `performCephalocaudalExam3D(regionId)`
 */
export function initClinicalHud3D(config = {}) {
    hudRuntime.stateRef = config.state || hudRuntime.stateRef;
    hudRuntime.categoriesRef = config.categories || hudRuntime.categoriesRef;
    hudRuntime.regionsRef = config.regions || hudRuntime.regionsRef;
    hudRuntime.onExecuteAction = typeof config.onExecuteAction === "function"
        ? config.onExecuteAction
        : hudRuntime.onExecuteAction;
    hudRuntime.onInspectRegion = typeof config.onInspectRegion === "function"
        ? config.onInspectRegion
        : hudRuntime.onInspectRegion;

    injectHudToolbarAndSearch();
    injectViewportHolographicToastContainer();
    renderCephalocaudalHud(hudRuntime.regionsRef, hudRuntime.stateRef);
    bindHudKeyboardShortcuts();

    const tabsContainer = document.getElementById("engine3d-hud-tabs");
    const listContainer = document.getElementById("engine3d-hud-actions-list");

    if (tabsContainer && hudRuntime.categoriesRef && hudRuntime.stateRef) {
        renderHudTabs(tabsContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
    }
    if (listContainer && hudRuntime.categoriesRef && hudRuntime.stateRef) {
        renderHudActions(listContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
    }

    hudRuntime.initialized = true;
}

// ============================================================================
// 3. RENDERIZADO DE PESTAÑAS DE CATEGORÍAS DEL HUD (#engine3d-hud-tabs)
// ============================================================================

/**
 * Renderiza las pestañas de categorías clínicas en `#engine3d-hud-tabs`.
 * Invocada directamente por `engine3d.controller.js` o internamente al cambiar de pestaña.
 * @param {HTMLElement} tabsContainer
 * @param {Object} categoriesMap
 * @param {Object} state
 */
export function renderHudTabs(tabsContainer, categoriesMap = hudRuntime.categoriesRef, state = hudRuntime.stateRef) {
    if (!tabsContainer || !categoriesMap || !state) return;

    hudRuntime.categoriesRef = categoriesMap;
    hudRuntime.stateRef = state;

    const categories = Object.values(categoriesMap);
    const completedIds = Array.isArray(state.completedObjectives) ? state.completedObjectives : [];

    tabsContainer.innerHTML = categories.map((cat, index) => {
        const isActive = state.activeHudCategory === cat.id;
        const catActions = Array.isArray(cat.actions) ? cat.actions : [];
        const appliedInCat = catActions.filter(a => completedIds.includes(a.id)).length;
        const customIconUrl = CATEGORY_ICON_ASSETS[cat.id] || "";

        return `
            <button
                type="button"
                data-hud-cat="${cat.id}"
                title="Atajo rápido: Alt + ${index + 1}"
                class="engine3d-hud-cat-btn group relative p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                    isActive
                        ? "bg-primary/15 border-primary text-primary font-extrabold shadow-[0_0_14px_rgba(0,229,255,0.22)]"
                        : "bg-surface border-surface-high text-gray-300 hover:border-gray-500 hover:text-white font-bold"
                }"
            >
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="relative flex items-center justify-center w-5 h-5 shrink-0">
                        <img
                            src="${customIconUrl}"
                            alt=""
                            class="w-4 h-4 object-contain hidden"
                            onload="this.classList.remove('hidden'); this.nextElementSibling.classList.add('hidden');"
                            onerror="this.remove();"
                        />
                        <span class="material-symbols-outlined text-base">${cat.icon || "medical_services"}</span>
                    </span>
                    <span class="text-[11px] leading-tight truncate">${cat.label}</span>
                </div>
                ${
                    appliedInCat > 0
                        ? `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold bg-secondary/20 text-secondary border border-secondary/40 shrink-0">${appliedInCat}</span>`
                        : `<span class="text-[9px] font-mono text-gray-500 group-hover:text-gray-300 shrink-0">Alt+${index + 1}</span>`
                }
            </button>
        `;
    }).join("");

    tabsContainer.querySelectorAll(".engine3d-hud-cat-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const selectedCat = btn.dataset.hudCat;
            if (!selectedCat) return;
            state.activeHudCategory = selectedCat;
            renderHudTabs(tabsContainer, categoriesMap, state);

            const listContainer = document.getElementById("engine3d-hud-actions-list");
            if (listContainer) {
                renderHudActions(listContainer, categoriesMap, state);
            }
        });
    });
}

// ============================================================================
// 4. RENDERIZADO DE MANIOBRAS CLÍNICAS Y CONSOLA TÁCTICA (#engine3d-hud-actions-list)
// ============================================================================

/**
 * Renderiza la lista de intervenciones médicas dentro de `#engine3d-hud-actions-list`,
 * incluyendo previsualización de impacto hemodinámico, contador de dosis/ciclos
 * y controles especializados para Desfibrilación / RCP.
 * @param {HTMLElement} listContainer
 * @param {Object} categoriesMap
 * @param {Object} state
 */
export function renderHudActions(listContainer, categoriesMap = hudRuntime.categoriesRef, state = hudRuntime.stateRef) {
    if (!listContainer || !categoriesMap || !state) return;

    hudRuntime.categoriesRef = categoriesMap;
    hudRuntime.stateRef = state;

    const activeCategory = categoriesMap[state.activeHudCategory] || Object.values(categoriesMap)[0];
    if (!activeCategory) return;

    const query = (hudRuntime.searchQuery || "").trim().toLowerCase();

    // Si hay búsqueda activa, filtrar en todas las categorías para velocidad en Código Azul
    let actionsToRender = [];
    if (query.length > 0) {
        Object.values(categoriesMap).forEach(cat => {
            (cat.actions || []).forEach(act => {
                const haystack = `${act.nombre} ${act.efecto} ${cat.label}`.toLowerCase();
                if (haystack.includes(query)) {
                    actionsToRender.push({ ...act, _catId: cat.id, _catLabel: cat.label });
                }
            });
        });
    } else {
        actionsToRender = (activeCategory.actions || []).map(act => ({
            ...act,
            _catId: activeCategory.id,
            _catLabel: activeCategory.label
        }));
    }

    // Bloque especial superior si estamos en la pestaña "desfibrilador_rcp"
    const defibConsoleHtml = activeCategory.id === "desfibrilador_rcp" && query.length === 0
        ? buildDefibrillatorAndCprSubconsoleHtml()
        : "";

    if (actionsToRender.length === 0) {
        listContainer.innerHTML = `
            ${defibConsoleHtml}
            <div class="p-3 rounded-xl bg-surface border border-surface-high text-center text-xs text-gray-400">
                No se encontraron maniobras para "<span class="text-white font-bold">${escapeHtmlHud(hudRuntime.searchQuery)}</span>".
            </div>
        `;
        bindDefibSubconsoleEvents(listContainer);
        return;
    }

    const completedIds = Array.isArray(state.completedObjectives) ? state.completedObjectives : [];

    listContainer.innerHTML = `
        ${defibConsoleHtml}
        ${actionsToRender.map(action => {
            const isDone = completedIds.includes(action.id);
            const count = hudRuntime.actionExecutionCounts[action.id] || 0;
            const deltaBadges = formatVitalsDeltaBadges(action.vitalsDelta);

            return `
                <button
                    type="button"
                    data-hud-action="${action.id}"
                    data-hud-cat="${action._catId}"
                    class="engine3d-hud-action-btn group w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        isDone
                            ? "bg-secondary/10 border-secondary/50 text-white shadow-[0_0_12px_rgba(148,222,45,0.12)]"
                            : "bg-surface hover:bg-surface-high border-surface-high hover:border-primary text-gray-200"
                    }"
                >
                    <div class="flex items-start justify-between gap-2">
                        <span class="text-xs font-extrabold text-white group-hover:text-primary transition-colors leading-snug">
                            ${action.nombre}
                        </span>
                        <div class="flex items-center gap-1 shrink-0">
                            ${
                                count > 0
                                    ? `<span class="px-1.5 py-0.5 rounded-md bg-surface-high text-[9px] font-mono text-gray-300">x${count}</span>`
                                    : ""
                            }
                            ${
                                isDone
                                    ? `<span class="text-[10px] font-mono font-extrabold text-secondary">✓ Objetivo</span>`
                                    : `<span class="material-symbols-outlined text-sm text-primary group-hover:translate-x-0.5 transition-transform">play_arrow</span>`
                            }
                        </div>
                    </div>

                    <span class="text-[11px] text-gray-400 leading-tight">${action.efecto}</span>

                    ${
                        deltaBadges
                            ? `<div class="flex flex-wrap items-center gap-1 pt-0.5">${deltaBadges}</div>`
                            : ""
                    }
                </button>
            `;
        }).join("")}
    `;

    bindDefibSubconsoleEvents(listContainer);

    listContainer.querySelectorAll(".engine3d-hud-action-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const actionId = btn.dataset.hudAction;
            const categoryId = btn.dataset.hudCat || state.activeHudCategory;
            executeHudActionWithFeedback(categoryId, actionId, btn);
        });
    });
}

/**
 * Ejecuta la maniobra clínica invocando el callback de `engine3d.controller.js`,
 * registra el conteo de dosis/ciclos y dispara la notificación holográfica en el visor 3D.
 * @param {string} categoryId
 * @param {string} actionId
 * @param {HTMLElement} buttonEl
 */
function executeHudActionWithFeedback(categoryId, actionId, buttonEl) {
    const state = hudRuntime.stateRef;
    if (!state || state.isScenarioFinished) return;

    hudRuntime.actionExecutionCounts[actionId] = (hudRuntime.actionExecutionCounts[actionId] || 0) + 1;

    // Efecto visual táctico en el botón presionado
    if (buttonEl) {
        buttonEl.classList.add("ring-2", "ring-primary");
        setTimeout(() => buttonEl.classList.remove("ring-2", "ring-primary"), 320);
    }

    // Buscar datos de la acción para el toast holográfico
    const category = hudRuntime.categoriesRef?.[categoryId];
    const actionObj = (category?.actions || []).find(a => a.id === actionId);

    // Si es RCP de alta calidad y el metrónomo está apagado, encender pulso guía breve
    if (actionId === "rcp_alta_calidad" && !hudRuntime.cprMetronome.active) {
        playSingleMetronomeClick();
    }

    // Delegar ejecución fisiológica y de puntaje a engine3d.controller.js
    if (typeof hudRuntime.onExecuteAction === "function") {
        hudRuntime.onExecuteAction(categoryId, actionId);
    }

    // Mostrar notificación holográfica superpuesta en el visor 3D
    if (actionObj) {
        const extraNote = (actionId.includes("cardioversion") || actionId.includes("desfibrilacion"))
            ? ` • Carga: ${hudRuntime.selectedDefibJoules} J (${hudRuntime.defibSyncMode ? "Sincrónico" : "No Sincrónico"})`
            : "";
        showHudFloatingAlert3D(
            `${category?.label || "Intervención 3D"}: ${actionObj.nombre}`,
            `${actionObj.efecto}${extraNote}`,
            "primary"
        );
    }

    // Refrescar pestañas para actualizar el contador de acciones completadas
    const tabsContainer = document.getElementById("engine3d-hud-tabs");
    if (tabsContainer) {
        renderHudTabs(tabsContainer, hudRuntime.categoriesRef, state);
    }
}

// ============================================================================
// 5. SUBCONSOLA DE DESFIBRILACIÓN BIFÁSICA Y METRÓNOMO DE RCP (110 CPM)
// ============================================================================

/**
 * Construye el panel compacto de selección de Joules (50-200 J) y Metrónomo de RCP (110 cpm)
 * cuando el estudiante abre la categoría `desfibrilador_rcp`.
 */
function buildDefibrillatorAndCprSubconsoleHtml() {
    const joulesOptions = [50, 100, 150, 200];
    const isMetronomeOn = hudRuntime.cprMetronome.active;

    return `
        <div class="p-2.5 rounded-xl bg-surface border border-warning/40 space-y-2 mb-2">
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase font-extrabold text-warning flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">bolt</span>
                    <span>Consola Bifásica & Metrónomo ACLS</span>
                </span>
                <button
                    type="button"
                    id="btn-hud-cpr-metronome"
                    class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-extrabold border transition-all ${
                        isMetronomeOn
                            ? "bg-secondary text-surface border-secondary animate-pulse"
                            : "bg-surface-container text-gray-300 border-surface-high hover:border-primary hover:text-primary"
                    }"
                >
                    ${isMetronomeOn ? "🔊 Metrónomo 110 cpm ON" : "⏱ Metrónomo RCP (110 cpm)"}
                </button>
            </div>

            <div class="flex items-center justify-between gap-1">
                <span class="text-[10px] font-mono text-gray-400">Energía (J):</span>
                <div class="flex items-center gap-1">
                    ${joulesOptions.map(j => `
                        <button
                            type="button"
                            data-defib-joules="${j}"
                            class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all ${
                                hudRuntime.selectedDefibJoules === j
                                    ? "bg-warning/20 border-warning text-warning font-extrabold"
                                    : "bg-surface-container border-surface-high text-gray-400 hover:text-white"
                            }"
                        >
                            ${j}J
                        </button>
                    `).join("")}
                </div>
            </div>
        </div>
    `;
}

function bindDefibSubconsoleEvents(container) {
    if (!container) return;

    const metronomeBtn = container.querySelector("#btn-hud-cpr-metronome");
    metronomeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCprMetronomeHud();
        renderHudActions(container, hudRuntime.categoriesRef, hudRuntime.stateRef);
    });

    container.querySelectorAll("[data-defib-joules]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            hudRuntime.selectedDefibJoules = Number(btn.dataset.defibJoules) || 200;
            showHudFloatingAlert3D(
                `Desfibrilador Bifásico Cargado: ${hudRuntime.selectedDefibJoules} J`,
                "Asegura que nadie toque la cama UCI antes de ejecutar la descarga eléctrica.",
                "warning"
            );
            renderHudActions(container, hudRuntime.categoriesRef, hudRuntime.stateRef);
        });
    });
}

/**
 * Activa o desactiva el metrónomo acústico-visual de RCP a 110 compresiones por minuto.
 * @param {boolean} [forceState]
 */
export function toggleCprMetronomeHud(forceState) {
    const nextState = typeof forceState === "boolean"
        ? forceState
        : !hudRuntime.cprMetronome.active;

    if (hudRuntime.cprMetronome.intervalId) {
        clearInterval(hudRuntime.cprMetronome.intervalId);
        hudRuntime.cprMetronome.intervalId = null;
    }

    hudRuntime.cprMetronome.active = nextState;

    if (nextState) {
        const intervalMs = Math.round((60 / hudRuntime.cprMetronome.bpm) * 1000);
        playSingleMetronomeClick();
        hudRuntime.cprMetronome.intervalId = setInterval(() => {
            const sim3dView = document.getElementById("view-sim3d");
            if (!sim3dView || sim3dView.classList.contains("hidden") || hudRuntime.stateRef?.isScenarioFinished) {
                toggleCprMetronomeHud(false);
                return;
            }
            playSingleMetronomeClick();
            if (hudRuntime.stateRef) {
                hudRuntime.stateRef.cprCompressionPhase = 6;
            }
        }, intervalMs);

        showHudFloatingAlert3D(
            "Metrónomo ACLS Activo (110 compresiones/min)",
            "Mantén una profundidad de 5 a 6 cm permitiendo la reexpansión torácica completa.",
            "secondary"
        );
    }
}

function playSingleMetronomeClick() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!hudRuntime.cprMetronome.audioCtx) {
            hudRuntime.cprMetronome.audioCtx = new AudioContextClass();
        }
        const ctx = hudRuntime.cprMetronome.audioCtx;
        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        hudRuntime.cprMetronome.beatCount = (hudRuntime.cprMetronome.beatCount + 1) % 30;

        // Cada compresión #30 emite un tono ligeramente más agudo para recordar la relación 30:2 si no está intubado
        osc.type = "triangle";
        osc.frequency.value = hudRuntime.cprMetronome.beatCount === 0 ? 980 : 660;

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
    } catch (e) {
        // Silencioso si el navegador bloquea audio antes de interacción
    }
}

// ============================================================================
// 6. INSPECTOR SEMIOLÓGICO CEFALOCAUDAL 3D (#engine3d-cephalocaudal-panel)
// ============================================================================

/**
 * Renderiza y enriquece los botones de exploración física cefalocaudal en 3D,
 * mostrando qué segmentos anatómicos ya fueron inspeccionados y enfocando la cámara.
 * @param {Array} regionsList
 * @param {Object} state
 */
export function renderCephalocaudalHud(regionsList = hudRuntime.regionsRef, state = hudRuntime.stateRef) {
    const container = document.getElementById("engine3d-cephalocaudal-buttons");
    if (!container || !Array.isArray(regionsList) || !state) return;

    hudRuntime.regionsRef = regionsList;
    hudRuntime.stateRef = state;

    container.innerHTML = regionsList.map((region, idx) => {
        const isSelected = state.activeBodyRegion === region.id;
        const wasInspected = hudRuntime.inspectedRegionsSet.has(region.id);

        return `
            <button
                type="button"
                data-region-3d="${region.id}"
                title="Enfocar cámara 3D en ${region.label}"
                class="w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                    isSelected
                        ? "bg-secondary/15 border-secondary text-secondary shadow-[0_0_12px_rgba(148,222,45,0.18)]"
                        : "bg-surface border-surface-high text-gray-300 hover:border-gray-500 hover:text-white"
                }"
            >
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0 ${
                        isSelected
                            ? "bg-secondary animate-ping"
                            : wasInspected
                            ? "bg-secondary/70"
                            : "bg-gray-600"
                    }"></span>
                    <span class="truncate">${region.label}</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    ${
                        wasInspected
                            ? `<span class="text-[9px] font-mono text-secondary uppercase">Explorado</span>`
                            : `<span class="text-[9px] font-mono text-gray-500">F${idx + 1}</span>`
                    }
                    <span class="material-symbols-outlined text-sm">center_focus_strong</span>
                </div>
            </button>
        `;
    }).join("");

    container.querySelectorAll("[data-region-3d]").forEach(btn => {
        btn.addEventListener("click", () => {
            const regionId = btn.dataset.region3d;
            if (!regionId) return;

            hudRuntime.inspectedRegionsSet.add(regionId);
            if (typeof hudRuntime.onInspectRegion === "function") {
                hudRuntime.onInspectRegion(regionId);
            }
            renderCephalocaudalHud(regionsList, state);

            const regionObj = regionsList.find(r => r.id === regionId);
            const findingText = state.cephalocaudalFindings?.[regionId] || regionObj?.defaultFinding || "";
            if (regionObj) {
                showHudFloatingAlert3D(
                    `Enfoque Semiológico 3D • ${regionObj.label}`,
                    findingText,
                    "secondary"
                );
            }
        });
    });
}

// ============================================================================
// 7. BUSCADOR RÁPIDO HUD, NOTIFICACIONES HOLOGRÁFICAS Y ATAJOS TÁCTICOS
// ============================================================================

/**
 * Inyecta un buscador rápido de intervenciones clínicas dentro de `#engine3d-hud-actions-panel`
 * para filtrar fármacos, tubos o accesos en menos de 1 segundo.
 */
function injectHudToolbarAndSearch() {
    const hudPanel = document.getElementById("engine3d-hud-actions-panel");
    const tabsContainer = document.getElementById("engine3d-hud-tabs");
    if (!hudPanel || !tabsContainer || document.getElementById("engine3d-hud-search-wrap")) return;

    const searchWrap = document.createElement("div");
    searchWrap.id = "engine3d-hud-search-wrap";
    searchWrap.className = "relative";
    searchWrap.innerHTML = `
        <span class="material-symbols-outlined text-sm text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
        </span>
        <input
            type="text"
            id="engine3d-hud-search-input"
            placeholder="Buscar maniobra o fármaco UCI..."
            class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 outline-none transition-colors"
        />
        <button
            type="button"
            id="btn-engine3d-hud-search-clear"
            class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-mono"
            title="Limpiar búsqueda"
        >
            ✕
        </button>
    `;

    hudPanel.insertBefore(searchWrap, tabsContainer);

    const searchInput = document.getElementById("engine3d-hud-search-input");
    const clearBtn = document.getElementById("btn-engine3d-hud-search-clear");

    searchInput?.addEventListener("input", () => {
        hudRuntime.searchQuery = searchInput.value || "";
        if (clearBtn) {
            clearBtn.classList.toggle("hidden", hudRuntime.searchQuery.length === 0);
        }
        const listContainer = document.getElementById("engine3d-hud-actions-list");
        if (listContainer) {
            renderHudActions(listContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
        }
    });

    clearBtn?.addEventListener("click", () => {
        if (!searchInput) return;
        searchInput.value = "";
        hudRuntime.searchQuery = "";
        clearBtn.classList.add("hidden");
        const listContainer = document.getElementById("engine3d-hud-actions-list");
        if (listContainer) {
            renderHudActions(listContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
        }
    });
}

/**
 * Inyecta el contenedor de notificaciones holográficas dentro del visor `#engine3d-viewport-wrapper`.
 */
function injectViewportHolographicToastContainer() {
    const viewport = document.getElementById("engine3d-viewport-wrapper");
    if (!viewport || document.getElementById("engine3d-hud-floating-toast")) return;

    const toastEl = document.createElement("div");
    toastEl.id = "engine3d-hud-floating-toast";
    toastEl.className = "hidden absolute left-1/2 -translate-x-1/2 bottom-16 z-30 max-w-md w-[92%] pointer-events-none transition-all duration-200";
    viewport.appendChild(toastEl);
}

/**
 * Muestra una alerta holográfica flotante sobre el visor 3D cuando el médico
 * ejecuta una acción o inspecciona un segmento cefalocaudal.
 * @param {string} title
 * @param {string} detail
 * @param {"primary"|"secondary"|"warning"|"danger"} tone
 */
export function showHudFloatingAlert3D(title, detail = "", tone = "primary") {
    injectViewportHolographicToastContainer();
    const toastEl = document.getElementById("engine3d-hud-floating-toast");
    if (!toastEl) return;

    if (hudRuntime.toastTimeoutId) {
        clearTimeout(hudRuntime.toastTimeoutId);
    }

    const toneStyles = {
        primary: "border-primary/70 bg-[#06101a]/90 text-primary",
        secondary: "border-secondary/70 bg-[#08150c]/90 text-secondary",
        warning: "border-warning/70 bg-[#191206]/90 text-warning",
        danger: "border-danger/70 bg-[#1c080b]/90 text-danger"
    };
    const chosenStyle = toneStyles[tone] || toneStyles.primary;

    toastEl.className = `absolute left-1/2 -translate-x-1/2 bottom-16 z-30 max-w-md w-[92%] pointer-events-none rounded-xl border px-3.5 py-2.5 backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.75)] ${chosenStyle}`;
    toastEl.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono font-extrabold uppercase tracking-wide truncate">${escapeHtmlHud(title)}</span>
            <span class="text-[9px] font-mono text-gray-400 shrink-0">${ escapeHtmlHud(appState.currentUserData?.nombre || "HUD 3D") }</span>
        </div>
        ${
            detail
                ? `<p class="text-[11px] text-gray-200 mt-0.5 leading-snug">${escapeHtmlHud(detail)}</p>`
                : ""
        }
    `;

    toastEl.classList.remove("hidden");
    hudRuntime.toastTimeoutId = setTimeout(() => {
        toastEl.classList.add("hidden");
    }, 3400);
}

/**
 * Genera insignias compactas con el efecto esperado sobre los signos vitales.
 * @param {Object} vitalsDelta
 * @returns {string}
 */
function formatVitalsDeltaBadges(vitalsDelta = {}) {
    if (!vitalsDelta || typeof vitalsDelta !== "object") return "";
    const badges = [];

    if (typeof vitalsDelta.spo2 === "number") {
        const sign = vitalsDelta.spo2 > 0 ? "+" : "";
        badges.push(`<span class="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-[9px] font-mono text-primary">SpO2 ${sign}${vitalsDelta.spo2}%</span>`);
    }
    if (typeof vitalsDelta.bpSys === "number") {
        const sign = vitalsDelta.bpSys > 0 && vitalsDelta.bpSys < 50 ? "+" : "";
        badges.push(`<span class="px-1.5 py-0.5 rounded bg-warning/10 border border-warning/30 text-[9px] font-mono text-warning">PAS ${sign}${vitalsDelta.bpSys}</span>`);
    }
    if (typeof vitalsDelta.hr === "number") {
        const sign = vitalsDelta.hr > 0 && vitalsDelta.hr < 50 ? "+" : "";
        badges.push(`<span class="px-1.5 py-0.5 rounded bg-secondary/10 border border-secondary/30 text-[9px] font-mono text-secondary">FC ${sign}${vitalsDelta.hr}</span>`);
    }
    if (typeof vitalsDelta.etco2 === "number") {
        badges.push(`<span class="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-400/30 text-[9px] font-mono text-purple-300">EtCO2 ${vitalsDelta.etco2}</span>`);
    }
    if (vitalsDelta.rhythm) {
        badges.push(`<span class="px-1.5 py-0.5 rounded bg-secondary/15 border border-secondary/40 text-[9px] font-mono text-secondary">Ritmo Sinusal</span>`);
    }

    return badges.join("");
}

/**
 * Registra atajos de teclado tácticos cuando la vista `#view-sim3d` está activa:
 * - `Alt + 1..4`: Cambiar categoría del Marco Clínico HUD.
 */
function bindHudKeyboardShortcuts() {
    if (window.__makaiSim3DHudShortcutsBound) return;
    window.__makaiSim3DHudShortcutsBound = true;

    window.addEventListener("keydown", (e) => {
        const sim3dView = document.getElementById("view-sim3d");
        if (!sim3dView || sim3dView.classList.contains("hidden")) return;

        // Alt + 1..4 cambia rápidamente entre las 4 categorías del HUD
        if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
            const categories = Object.keys(hudRuntime.categoriesRef || {});
            const targetCat = categories[Number(e.key) - 1];
            if (targetCat && hudRuntime.stateRef) {
                e.preventDefault();
                hudRuntime.stateRef.activeHudCategory = targetCat;
                const tabsContainer = document.getElementById("engine3d-hud-tabs");
                const listContainer = document.getElementById("engine3d-hud-actions-list");
                if (tabsContainer) renderHudTabs(tabsContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
                if (listContainer) renderHudActions(listContainer, hudRuntime.categoriesRef, hudRuntime.stateRef);
            }
        }
    });
}

function escapeHtmlHud(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
