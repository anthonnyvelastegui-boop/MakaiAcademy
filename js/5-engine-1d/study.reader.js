// ============================================================================
// ARCHIVO: js/5-engine-1d/study.reader.js
// DESCRIPCIÓN: Motor de Lectura Lineal 1D, Biblioteca de Guías de Práctica
//              Clínica (GPC) y Visor Multimedia en Modo Oscuro (PDFs,
//              Infografías de Alta Resolución y Micro-Videos 1D).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    doc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    canAccessBySubscription
} from "../2-core/state.store.js";

// ============================================================================
// 1. ESTADO INTERNO DEL LECTOR CLÍNICO 1D
// ============================================================================

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios"
};

export const readerState = {
    initialized: false,
    controllerStateRef: null,
    currentMaterials: [],
    lastContainerEl: null,
    searchQuery: "",
    activeTypeFilter: "todos", // "todos" | "pdf" | "infografia" | "video" | "favoritos"
    activeMaterial: null,
    viewerZoom: 100,
    viewerRotation: 0,
    pdfNightFilter: false,
    textFontSize: 15,
    completedIds: new Set(),
    favoriteIds: new Set()
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL LECTOR 1D
// ============================================================================

/**
 * Inicializa el subcomponente study.reader.js enlazándolo con engine1d.controller.js.
 * @param {Object} controllerState - Referencia a engine1DState
 */
export function initStudyReader(controllerState = null) {
    if (controllerState) {
        readerState.controllerStateRef = controllerState;
    }

    loadUserReaderPreferences();
    bindReaderGlobalShortcuts();
    readerState.initialized = true;
}

/**
 * Carga desde localStorage los documentos marcados como leídos o favoritos por el usuario.
 */
function loadUserReaderPreferences() {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    try {
        const savedCompleted = JSON.parse(localStorage.getItem(`makai_reader_completed_${uid}`) || "[]");
        const savedFavorites = JSON.parse(localStorage.getItem(`makai_reader_favorites_${uid}`) || "[]");
        readerState.completedIds = new Set(Array.isArray(savedCompleted) ? savedCompleted : []);
        readerState.favoriteIds = new Set(Array.isArray(savedFavorites) ? savedFavorites : []);
    } catch (e) {
        readerState.completedIds = new Set();
        readerState.favoriteIds = new Set();
    }
}

/**
 * Guarda en localStorage el estado de lectura y favoritos del estudiante.
 */
function persistUserReaderPreferences() {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    try {
        localStorage.setItem(
            `makai_reader_completed_${uid}`,
            JSON.stringify(Array.from(readerState.completedIds))
        );
        localStorage.setItem(
            `makai_reader_favorites_${uid}`,
            JSON.stringify(Array.from(readerState.favoriteIds))
        );
    } catch (e) {
        // Silencioso en caso de cuota excedida en navegador
    }
}

// ============================================================================
// 3. RENDERIZADO DEL CATÁLOGO DE BIBLIOTECA Y FILTROS 1D
// ============================================================================

/**
 * Renderiza la interfaz completa de Biblioteca & Lectura Lineal 1D dentro del contenedor
 * indicado por engine1d.controller.js (#engine1d-reader-container).
 * @param {Array} materials - Lista de materiales filtrados por carrera y materia
 * @param {HTMLElement} containerEl - Contenedor DOM (#engine1d-reader-container)
 */
export function renderStudyMaterialsList(materials = [], containerEl = null) {
    const targetContainer = containerEl || readerState.lastContainerEl || document.getElementById("engine1d-reader-container");
    if (!targetContainer) return;

    readerState.currentMaterials = Array.isArray(materials) ? materials : [];
    readerState.lastContainerEl = targetContainer;

    loadUserReaderPreferences();

    const filteredList = getFilteredMaterialsByReaderControls(readerState.currentMaterials);
    const totalCount = readerState.currentMaterials.length;
    const completedCount = readerState.currentMaterials.filter(m => readerState.completedIds.has(m.id)).length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    targetContainer.innerHTML = `
        <!-- BARRA SUPERIOR DE BÚSQUEDA, PROGRESO DE LECTURA Y FILTROS DE FORMATO -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-4 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <!-- Buscador instantáneo -->
                <div class="relative flex-1 min-w-[240px]">
                    <span class="material-symbols-outlined text-gray-500 text-base absolute left-3.5 top-1/2 -translate-y-1/2">
                        search
                    </span>
                    <input
                        type="text"
                        id="reader-search-input"
                        value="${escapeHtml(readerState.searchQuery)}"
                        placeholder="Buscar GPC, protocolo MSP, algoritmo o tema clínico..."
                        class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                    />
                </div>

                <!-- Indicador de progreso de lectura del filtro actual -->
                <div class="flex items-center gap-3 bg-surface border border-surface-high rounded-xl px-3.5 py-2">
                    <div>
                        <span class="block text-[10px] font-mono text-gray-400 uppercase">Progreso de Lectura 1D</span>
                        <div class="flex items-center gap-2 mt-0.5">
                            <div class="w-24 h-1.5 bg-surface-high rounded-full overflow-hidden">
                                <div class="h-full bg-secondary transition-all duration-300" style="width: ${progressPercent}%"></div>
                            </div>
                            <span class="text-xs font-mono font-extrabold text-secondary">${completedCount}/${totalCount} (${progressPercent}%)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Píldoras de filtro por tipo de recurso 1D -->
            <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-high">
                ${renderFilterPill("todos", "apps", "Todos los Recursos", readerState.currentMaterials.length)}
                ${renderFilterPill("pdf", "picture_as_pdf", "Guías PDF / GPC", countByType("pdf"))}
                ${renderFilterPill("infografia", "account_tree", "Infografías & Algoritmos", countByType("infografia"))}
                ${renderFilterPill("video", "smart_display", "Micro-Videos 1D", countByType("video"))}
                ${renderFilterPill("favoritos", "bookmark", "Mis Favoritos", countFavoritesInCurrent())}
            </div>
        </div>

        <!-- CONTENEDOR DEL VISOR CLÍNICO 1D EN MODO OSCURO (SE DESPLIEGA AL ABRIR UN RECURSO) -->
        <div id="engine1d-inline-viewer" class="${readerState.activeMaterial ? "" : "hidden"}"></div>

        <!-- GRILLA DE MATERIALES CLÍNICOS 1D -->
        <div id="reader-materials-grid">
            ${filteredList.length === 0 ? renderEmptyMaterialsState() : renderMaterialCardsGrid(filteredList)}
        </div>
    `;

    bindMaterialsCatalogEvents(targetContainer);

    // Si había un material abierto y sigue perteneciendo al catálogo, mantener el visor
    if (readerState.activeMaterial) {
        renderInlineMaterialViewer(readerState.activeMaterial);
    }
}

/**
 * Genera el HTML de un botón de filtro por tipo de documento.
 */
function renderFilterPill(typeKey, iconName, label, count) {
    const isActive = readerState.activeTypeFilter === typeKey;
    const classes = isActive
        ? "bg-primary text-surface border-primary font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.25)]"
        : "bg-surface text-gray-400 border-surface-high hover:text-white hover:border-gray-600 font-bold";

    return `
        <button
            type="button"
            data-reader-filter="${typeKey}"
            class="reader-filter-pill px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-1.5 ${classes}"
        >
            <span class="material-symbols-outlined text-sm">${iconName}</span>
            <span>${label}</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? "bg-surface/20 text-surface" : "bg-surface-high text-gray-300"}">
                ${count}
            </span>
        </button>
    `;
}

/**
 * Renderiza la grilla de tarjetas de recursos bibliográficos y multimedia 1D.
 */
function renderMaterialCardsGrid(materialsList) {
    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    const isAdmin = isMasterAdmin(userEmail);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${materialsList.map(item => {
                const normalizedType = normalizeMaterialType(item);
                const typeBadge = getMaterialTypeMeta(normalizedType);
                const requiredPlan = item.planRequerido || "Básico";
                const hasAccess = isAdmin || canAccessBySubscription(requiredPlan);
                const isCompleted = readerState.completedIds.has(item.id);
                const isFavorite = readerState.favoriteIds.has(item.id);
                const isCurrentlyOpen = readerState.activeMaterial?.id === item.id;

                return `
                    <div class="bg-surface-container border ${isCurrentlyOpen ? "border-primary shadow-[0_0_20px_rgba(0,229,255,0.12)]" : "border-surface-high hover:border-primary/60"} rounded-2xl p-5 flex flex-col justify-between transition-all">
                        <div>
                            <!-- Cabecera de metadatos y estado -->
                            <div class="flex items-center justify-between gap-2 mb-3">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${typeBadge.badgeClass}">
                                    <span class="material-symbols-outlined text-xs">${typeBadge.icon}</span>
                                    <span>${typeBadge.label} • ${escapeHtml(item.materia || "General")}</span>
                                </span>

                                <div class="flex items-center gap-1.5">
                                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                                        requiredPlan === "VIP"
                                            ? "bg-warning/15 text-warning border border-warning/40"
                                            : requiredPlan === "PRO"
                                            ? "bg-primary/15 text-primary border border-primary/40"
                                            : "bg-secondary/15 text-secondary border border-secondary/40"
                                    }">
                                        ${hasAccess ? `Plan ${escapeHtml(requiredPlan)}` : `🔒 Plan ${escapeHtml(requiredPlan)}`}
                                    </span>

                                    <button
                                        type="button"
                                        data-fav-material="${escapeHtml(item.id)}"
                                        title="${isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}"
                                        class="btn-fav-material-1d p-1 rounded-lg hover:bg-surface-high transition-colors ${isFavorite ? "text-warning" : "text-gray-500 hover:text-gray-300"}"
                                    >
                                        <span class="material-symbols-outlined text-base">${isFavorite ? "bookmark_added" : "bookmark"}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Título y descripción -->
                            <h4 class="text-base font-extrabold text-white leading-snug">
                                ${escapeHtml(item.titulo || "Documento Clínico 1D")}
                            </h4>
                            <p class="text-xs text-gray-400 mt-1.5 line-clamp-2">
                                ${escapeHtml(item.descripcion || "Recurso oficial de estudio secuencial 1D y repaso clínico.")}
                            </p>
                        </div>

                        <!-- Pie de tarjeta con acciones -->
                        <div class="mt-4 pt-3 border-t border-surface-high flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                data-complete-material="${escapeHtml(item.id)}"
                                class="btn-complete-material-1d px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                                    isCompleted
                                        ? "bg-secondary/15 text-secondary border border-secondary/40"
                                        : "bg-surface text-gray-400 border border-surface-high hover:text-white"
                                }"
                            >
                                <span class="material-symbols-outlined text-sm">${isCompleted ? "check_circle" : "radio_button_unchecked"}</span>
                                <span>${isCompleted ? "Leído" : "Marcar leído"}</span>
                            </button>

                            <button
                                type="button"
                                data-open-material="${escapeHtml(item.id)}"
                                class="btn-open-material-1d px-4 py-2 rounded-xl ${
                                    hasAccess
                                        ? "bg-primary text-surface hover:bg-opacity-90"
                                        : "bg-surface-high text-warning border border-warning/50 hover:bg-warning hover:text-surface"
                                } text-xs font-extrabold transition-all flex items-center gap-1.5"
                            >
                                <span class="material-symbols-outlined text-sm">${hasAccess ? "visibility" : "lock"}</span>
                                <span>${isCurrentlyOpen ? "Viendo en Visor 1D" : hasAccess ? "Abrir en Visor 1D" : `Desbloquear (${requiredPlan})`}</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

/**
 * Estado vacío cuando no existen materiales para el filtro o búsqueda actual.
 */
function renderEmptyMaterialsState() {
    return `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-gray-500">menu_book</span>
            <p class="text-sm font-extrabold text-white mt-2">
                No se encontraron guías clínicas, esquemas o PDFs con este filtro
            </p>
            <p class="text-xs text-gray-400 mt-1 max-w-lg mx-auto">
                Prueba limpiando el buscador, seleccionando "Todos los Recursos" o cambiando la materia activa. Los administradores pueden cargar nuevos archivos desde el Panel Admin (Materiales y PDFs).
            </p>
        </div>
    `;
}

/**
 * Enlaza los eventos del buscador, filtros por tipo, favoritos, completados y apertura del visor.
 */
function bindMaterialsCatalogEvents(containerEl) {
    const searchInput = containerEl.querySelector("#reader-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            readerState.searchQuery = e.target.value || "";
            const pos = searchInput.selectionStart || readerState.searchQuery.length;
            renderStudyMaterialsList(readerState.currentMaterials, containerEl);
            const refreshedInput = containerEl.querySelector("#reader-search-input");
            if (refreshedInput) {
                refreshedInput.focus();
                refreshedInput.setSelectionRange(pos, pos);
            }
        });
    }

    containerEl.querySelectorAll(".reader-filter-pill").forEach(btn => {
        btn.addEventListener("click", () => {
            readerState.activeTypeFilter = btn.dataset.readerFilter || "todos";
            renderStudyMaterialsList(readerState.currentMaterials, containerEl);
        });
    });

    containerEl.querySelectorAll(".btn-open-material-1d").forEach(btn => {
        btn.addEventListener("click", () => {
            const matId = btn.dataset.openMaterial;
            const found = readerState.currentMaterials.find(m => String(m.id) === String(matId));
            if (found) openMaterialViewer(found);
        });
    });

    containerEl.querySelectorAll(".btn-fav-material-1d").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleMaterialFavorite(btn.dataset.favMaterial);
        });
    });

    containerEl.querySelectorAll(".btn-complete-material-1d").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleMaterialCompleted(btn.dataset.completeMaterial);
        });
    });
}

// ============================================================================
// 4. VISOR CLÍNICO 1D EN MODO OSCURO (PDF, INFOGRAFÍA, VIDEO Y APUNTES)
// ============================================================================

/**
 * Abre un recurso en el Visor Clínico 1D tras verificar la suscripción del estudiante.
 * @param {Object} materialItem
 */
export function openMaterialViewer(materialItem) {
    if (!materialItem) return;

    const requiredPlan = materialItem.planRequerido || "Básico";
    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    const isAdmin = isMasterAdmin(userEmail);

    if (!isAdmin && !canAccessBySubscription(requiredPlan)) {
        const freemiumModal = document.getElementById("freemium-modal");
        if (freemiumModal) {
            freemiumModal.classList.remove("hidden");
            freemiumModal.classList.add("flex");
        } else {
            alert(`Este recurso clínico requiere el Plan ${requiredPlan}. Actualiza tu cuenta para desbloquearlo.`);
        }
        return;
    }

    readerState.activeMaterial = materialItem;
    readerState.viewerZoom = 100;
    readerState.viewerRotation = 0;

    if (readerState.controllerStateRef) {
        readerState.controllerStateRef.activeMaterial = materialItem;
    }

    renderInlineMaterialViewer(materialItem);

    // Desplazar suavemente hacia el visor
    const viewerBox = document.getElementById("engine1d-inline-viewer");
    viewerBox?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Cierra el Visor Clínico 1D y limpia su estado activo.
 */
export function closeMaterialViewer() {
    readerState.activeMaterial = null;
    if (readerState.controllerStateRef) {
        readerState.controllerStateRef.activeMaterial = null;
    }

    const viewerBox = document.getElementById("engine1d-inline-viewer");
    if (viewerBox) {
        viewerBox.classList.add("hidden");
        viewerBox.innerHTML = "";
    }

    if (readerState.lastContainerEl) {
        renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
    }
}

/**
 * Renderiza el reproductor/visor adecuado según el tipo de material (PDF, Infografía, Video o Resumen).
 * @param {Object} materialItem
 */
function renderInlineMaterialViewer(materialItem) {
    const viewerBox = document.getElementById("engine1d-inline-viewer");
    if (!viewerBox || !materialItem) return;

    const normalizedType = normalizeMaterialType(materialItem);
    const typeMeta = getMaterialTypeMeta(normalizedType);
    const sourceUrl = resolveMaterialSourceUrl(materialItem);
    const isCompleted = readerState.completedIds.has(materialItem.id);
    const savedNote = getSavedMaterialNote(materialItem.id);

    viewerBox.classList.remove("hidden");
    viewerBox.innerHTML = `
        <div id="reader-viewer-shell" class="bg-surface-container border-2 border-primary/60 rounded-2xl p-4 md:p-5 shadow-[0_0_30px_rgba(0,229,255,0.12)] space-y-4">
            <!-- BARRA DE HERRAMIENTAS DEL VISOR 1D -->
            <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-high">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary flex-shrink-0">
                        <span class="material-symbols-outlined">${typeMeta.icon}</span>
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[10px] font-mono text-primary uppercase tracking-wider font-extrabold">
                                Visor Clínico 1D • ${typeMeta.label}
                            </span>
                            <span class="text-[10px] font-mono text-gray-400">
                                • ${escapeHtml(materialItem.materia || "General")}
                            </span>
                        </div>
                        <h3 class="text-base md:text-lg font-extrabold text-white mt-0.5">
                            ${escapeHtml(materialItem.titulo || "Recurso Clínico")}
                        </h3>
                    </div>
                </div>

                <!-- Controles tácticos del visor -->
                <div class="flex flex-wrap items-center gap-2">
                    ${normalizedType === "pdf" ? `
                        <button
                            type="button"
                            id="btn-reader-night-filter"
                            title="Invertir colores del PDF para lectura nocturna sin fatiga visual"
                            class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                readerState.pdfNightFilter
                                    ? "bg-primary text-surface border-primary"
                                    : "bg-surface text-gray-300 border-surface-high hover:border-primary"
                            }"
                        >
                            <span class="material-symbols-outlined text-sm">dark_mode</span>
                            <span>Filtro Nocturno</span>
                        </button>
                    ` : ""}

                    ${normalizedType === "infografia" ? `
                        <div class="flex items-center bg-surface border border-surface-high rounded-xl p-1 gap-1">
                            <button type="button" id="btn-reader-zoom-out" class="px-2 py-1 rounded-lg hover:bg-surface-high text-gray-300 text-xs font-mono font-bold" title="Alejar (-)">-</button>
                            <span id="reader-zoom-label" class="px-2 text-xs font-mono font-bold text-primary">${readerState.viewerZoom}%</span>
                            <button type="button" id="btn-reader-zoom-in" class="px-2 py-1 rounded-lg hover:bg-surface-high text-gray-300 text-xs font-mono font-bold" title="Acercar (+)">+</button>
                            <button type="button" id="btn-reader-rotate" class="px-2 py-1 rounded-lg hover:bg-surface-high text-gray-300 text-xs font-bold flex items-center" title="Rotar 90°">
                                <span class="material-symbols-outlined text-sm">rotate_right</span>
                            </button>
                        </div>
                    ` : ""}

                    <button
                        type="button"
                        id="btn-reader-toggle-complete"
                        class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                            isCompleted
                                ? "bg-secondary/20 text-secondary border-secondary"
                                : "bg-surface text-gray-300 border-surface-high hover:text-white"
                        }"
                    >
                        <span class="material-symbols-outlined text-sm">${isCompleted ? "task_alt" : "check_circle"}</span>
                        <span>${isCompleted ? "Completado" : "Marcar Leído"}</span>
                    </button>

                    ${sourceUrl ? `
                        <a
                            href="${escapeHtml(sourceUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-3 py-1.5 rounded-xl bg-surface border border-surface-high hover:border-primary text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                            title="Abrir archivo original en nueva pestaña"
                        >
                            <span class="material-symbols-outlined text-sm">open_in_new</span>
                            <span>Nueva Pestaña</span>
                        </a>
                    ` : ""}

                    <button
                        type="button"
                        id="btn-reader-fullscreen"
                        class="px-2.5 py-1.5 rounded-xl bg-surface border border-surface-high hover:border-primary text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center"
                        title="Pantalla completa"
                    >
                        <span class="material-symbols-outlined text-sm">fullscreen</span>
                    </button>

                    <button
                        type="button"
                        id="btn-close-inline-viewer"
                        class="px-3 py-1.5 rounded-xl bg-danger/15 border border-danger/40 text-danger hover:bg-danger hover:text-white text-xs font-extrabold transition-all"
                    >
                        ✕ Cerrar
                    </button>
                </div>
            </div>

            <!-- CUERPO DIVIDIDO: LIENZO MULTIMEDIA 1D (8 COLS) + CUADERNO DE APUNTES CLÍNICOS (4 COLS) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <!-- Lienzo Principal del Documento / Infografía / Video -->
                <div class="lg:col-span-8 bg-surface border border-surface-high rounded-xl overflow-hidden flex flex-col">
                    ${renderMediaCanvasByType(normalizedType, sourceUrl, materialItem)}
                </div>

                <!-- Panel Lateral de Resumen Clave y Bloc de Notas Clínicas -->
                <div class="lg:col-span-4 bg-surface border border-surface-high rounded-xl p-4 flex flex-col justify-between space-y-4">
                    <div class="space-y-3">
                        <div class="flex items-center justify-between border-b border-surface-high pb-2">
                            <span class="text-[11px] font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">edit_note</span>
                                <span>Apuntes Clínicos Personales</span>
                            </span>
                            <span id="reader-note-status" class="text-[10px] font-mono text-gray-500">Guardado local</span>
                        </div>

                        <div class="bg-surface-container rounded-xl p-3 border border-surface-high">
                            <span class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Síntesis / Perla CACES</span>
                            <p class="text-xs text-gray-300 leading-relaxed">
                                ${escapeHtml(materialItem.descripcion || "Analiza los criterios diagnósticos, escalas de severidad y fármacos de primera elección de este documento.")}
                            </p>
                        </div>

                        <div>
                            <label for="reader-personal-notes" class="block text-[10px] font-mono text-gray-400 uppercase mb-1.5">
                                Tus notas sobre esta guía (se guardan automáticamente)
                            </label>
                            <textarea
                                id="reader-personal-notes"
                                rows="9"
                                placeholder="Escribe aquí dosis clave, puntos de corte, criterios de referencia o nemotecnias..."
                                class="w-full bg-surface-container border border-surface-high focus:border-primary rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none resize-y font-mono leading-relaxed"
                            >${escapeHtml(savedNote)}</textarea>
                        </div>
                    </div>

                    <div class="pt-2 border-t border-surface-high flex items-center justify-between gap-2">
                        <button
                            type="button"
                            id="btn-reader-clear-note"
                            class="px-3 py-1.5 rounded-lg bg-surface-high text-gray-400 hover:text-white text-xs font-bold transition-colors"
                        >
                            Limpiar nota
                        </button>
                        <button
                            type="button"
                            id="btn-reader-export-note"
                            class="px-3.5 py-1.5 rounded-lg bg-primary/15 border border-primary/50 text-primary hover:bg-primary hover:text-surface text-xs font-extrabold transition-all flex items-center gap-1"
                        >
                            <span class="material-symbols-outlined text-sm">download</span>
                            <span>Descargar Apuntes (.TXT)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindActiveViewerEvents(materialItem);
}

/**
 * Construye el lienzo interno según el formato del recurso (PDF, Infografía, Micro-Video o Texto).
 */
function renderMediaCanvasByType(normalizedType, sourceUrl, materialItem) {
    if (!sourceUrl && !materialItem.contenidoTexto) {
        return `
            <div class="h-[65vh] flex flex-col items-center justify-center p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-warning">warning</span>
                <p class="text-sm font-bold text-white mt-2">Archivo pendiente de vinculación en la bóveda</p>
                <p class="text-xs text-gray-400 mt-1 max-w-md">
                    Verifica que el archivo exista en <code class="text-primary">assets/5-multimedia-1d/</code> o actualiza su URL desde el Panel de Administración.
                </p>
            </div>
        `;
    }

    if (normalizedType === "infografia") {
        return `
            <div id="reader-image-stage" class="w-full h-[68vh] overflow-auto flex items-center justify-center p-4 bg-[#05080c] select-none">
                <img
                    id="reader-zoomable-image"
                    src="${escapeHtml(sourceUrl)}"
                    alt="${escapeHtml(materialItem.titulo || "Infografía Clínica")}"
                    style="transform: scale(${readerState.viewerZoom / 100}) rotate(${readerState.viewerRotation}deg); transform-origin: center center;"
                    class="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200 shadow-2xl"
                />
            </div>
        `;
    }

    if (normalizedType === "video") {
        const isEmbed = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be") || sourceUrl.includes("vimeo.com");
        if (isEmbed) {
            return `
                <div class="w-full h-[68vh] bg-black">
                    <iframe
                        src="${escapeHtml(sourceUrl)}"
                        class="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        title="${escapeHtml(materialItem.titulo || "Micro-Video 1D")}"
                    ></iframe>
                </div>
            `;
        }

        return `
            <div class="w-full h-[68vh] bg-black flex flex-col justify-between">
                <video
                    id="reader-video-player"
                    src="${escapeHtml(sourceUrl)}"
                    controls
                    controlsList="nodownload"
                    class="w-full h-[60vh] object-contain bg-black"
                ></video>
                <div class="px-4 py-2 bg-surface-container border-t border-surface-high flex items-center justify-between">
                    <span class="text-[11px] font-mono text-gray-400">Velocidad de reproducción clínica:</span>
                    <div class="flex items-center gap-1.5">
                        ${[0.75, 1, 1.25, 1.5, 2].map(speed => `
                            <button
                                type="button"
                                data-video-speed="${speed}"
                                class="btn-reader-video-speed px-2.5 py-1 rounded bg-surface border border-surface-high hover:border-primary text-[11px] font-mono font-bold text-gray-300"
                            >
                                ${speed}x
                            </button>
                        `).join("")}
                    </div>
                </div>
            </div>
        `;
    }

    // Por defecto: Visor PDF con soporte para Filtro Nocturno
    const nightFilterStyle = readerState.pdfNightFilter
        ? "filter: invert(0.92) hue-rotate(180deg) contrast(1.05);"
        : "";

    return `
        <div class="w-full h-[68vh] bg-[#090d14] relative">
            <iframe
                id="reader-pdf-iframe"
                src="${escapeHtml(sourceUrl)}"
                style="${nightFilterStyle}"
                class="w-full h-full border-0 transition-all duration-300"
                title="${escapeHtml(materialItem.titulo || "Guía PDF 1D")}"
            ></iframe>
        </div>
    `;
}

/**
 * Enlaza los controles interactivos del visor activo (Zoom, Rotación, Filtro Nocturno, Notas y Pantalla Completa).
 */
function bindActiveViewerEvents(materialItem) {
    document.getElementById("btn-close-inline-viewer")?.addEventListener("click", () => {
        closeMaterialViewer();
    });

    document.getElementById("btn-reader-night-filter")?.addEventListener("click", () => {
        toggleReaderNightFilter();
    });

    document.getElementById("btn-reader-zoom-in")?.addEventListener("click", () => {
        setViewerZoom(readerState.viewerZoom + 25);
    });

    document.getElementById("btn-reader-zoom-out")?.addEventListener("click", () => {
        setViewerZoom(readerState.viewerZoom - 25);
    });

    document.getElementById("btn-reader-rotate")?.addEventListener("click", () => {
        rotateViewerImage();
    });

    document.getElementById("btn-reader-toggle-complete")?.addEventListener("click", () => {
        toggleMaterialCompleted(materialItem.id);
    });

    document.getElementById("btn-reader-fullscreen")?.addEventListener("click", () => {
        const shell = document.getElementById("reader-viewer-shell");
        if (!shell) return;
        if (!document.fullscreenElement) {
            shell.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    });

    // Velocidad de micro-videos 1D
    document.querySelectorAll(".btn-reader-video-speed").forEach(btn => {
        btn.addEventListener("click", () => {
            const videoEl = document.getElementById("reader-video-player");
            const rate = parseFloat(btn.dataset.videoSpeed || "1");
            if (videoEl && !isNaN(rate)) {
                videoEl.playbackRate = rate;
            }
        });
    });

    // Guardado automático de notas personales
    const notesTextarea = document.getElementById("reader-personal-notes");
    const noteStatus = document.getElementById("reader-note-status");

    notesTextarea?.addEventListener("input", () => {
        saveMaterialNote(materialItem.id, notesTextarea.value);
        if (noteStatus) {
            noteStatus.textContent = "✓ Guardado";
            noteStatus.className = "text-[10px] font-mono text-secondary";
        }
    });

    document.getElementById("btn-reader-clear-note")?.addEventListener("click", () => {
        if (!notesTextarea || !notesTextarea.value.trim()) return;
        if (!confirm("¿Deseas borrar tus apuntes de este documento?")) return;
        notesTextarea.value = "";
        saveMaterialNote(materialItem.id, "");
    });

    document.getElementById("btn-reader-export-note")?.addEventListener("click", () => {
        exportMaterialNoteTxt(materialItem);
    });
}

// ============================================================================
// 5. FUNCIONES DE CONTROL ÓPTICO, PROGRESO Y APUNTES
// ============================================================================

/**
 * Alterna el filtro nocturno inteligente para documentos PDF con fondo blanco.
 */
export function toggleReaderNightFilter() {
    readerState.pdfNightFilter = !readerState.pdfNightFilter;
    const iframe = document.getElementById("reader-pdf-iframe");
    const btn = document.getElementById("btn-reader-night-filter");

    if (iframe) {
        iframe.style.filter = readerState.pdfNightFilter
            ? "invert(0.92) hue-rotate(180deg) contrast(1.05)"
            : "";
    }

    if (btn) {
        if (readerState.pdfNightFilter) {
            btn.classList.add("bg-primary", "text-surface", "border-primary");
            btn.classList.remove("bg-surface", "text-gray-300", "border-surface-high");
        } else {
            btn.classList.remove("bg-primary", "text-surface", "border-primary");
            btn.classList.add("bg-surface", "text-gray-300", "border-surface-high");
        }
    }
}

/**
 * Ajusta el nivel de zoom entre 50% y 250% para infografías y algoritmos clínicos.
 * @param {number} zoomLevel
 */
export function setViewerZoom(zoomLevel = 100) {
    readerState.viewerZoom = Math.max(50, Math.min(250, zoomLevel));
    updateImageTransformUI();
}

/**
 * Rota 90 grados en sentido horario la infografía o algoritmo activo.
 */
export function rotateViewerImage() {
    readerState.viewerRotation = (readerState.viewerRotation + 90) % 360;
    updateImageTransformUI();
}

function updateImageTransformUI() {
    const img = document.getElementById("reader-zoomable-image");
    const label = document.getElementById("reader-zoom-label");
    if (img) {
        img.style.transform = `scale(${readerState.viewerZoom / 100}) rotate(${readerState.viewerRotation}deg)`;
    }
    if (label) {
        label.textContent = `${readerState.viewerZoom}%`;
    }
}

/**
 * Marca o desmarca un documento como completado/leído y sincroniza el avance en Firestore.
 * @param {string} materialId
 */
export async function toggleMaterialCompleted(materialId) {
    if (!materialId) return;

    if (readerState.completedIds.has(materialId)) {
        readerState.completedIds.delete(materialId);
    } else {
        readerState.completedIds.add(materialId);
    }

    persistUserReaderPreferences();

    if (readerState.lastContainerEl) {
        renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
    }

    const uid = auth.currentUser?.uid || appState.currentUser?.uid;
    if (uid) {
        try {
            await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
                materialsReadCount: readerState.completedIds.size,
                lastMaterialReadAt: new Date().toISOString()
            });
        } catch (e) {
            // Silencioso en modo offline
        }
    }
}

/**
 * Agrega o quita un documento de la lista de favoritos del estudiante.
 * @param {string} materialId
 */
export function toggleMaterialFavorite(materialId) {
    if (!materialId) return;

    if (readerState.favoriteIds.has(materialId)) {
        readerState.favoriteIds.delete(materialId);
    } else {
        readerState.favoriteIds.add(materialId);
    }

    persistUserReaderPreferences();

    if (readerState.lastContainerEl) {
        renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
    }
}

/**
 * Obtiene la nota guardada por el estudiante para un documento específico.
 * @param {string} materialId
 * @returns {string}
 */
export function getSavedMaterialNote(materialId) {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    return localStorage.getItem(`makai_reader_note_${uid}_${materialId}`) || "";
}

/**
 * Guarda la nota personal del estudiante asociada a un documento 1D.
 * @param {string} materialId
 * @param {string} noteText
 */
export function saveMaterialNote(materialId, noteText = "") {
    if (!materialId) return;
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    try {
        localStorage.setItem(`makai_reader_note_${uid}_${materialId}`, noteText);
    } catch (e) {}
}

/**
 * Exporta los apuntes clínicos del documento activo en un archivo .TXT descargable.
 * @param {Object} materialItem
 */
export function exportMaterialNoteTxt(materialItem) {
    if (!materialItem) return;
    const noteText = getSavedMaterialNote(materialItem.id).trim();
    const header = [
        "====================================================================",
        "MAKAI ACADEMY (PROYECTO ALICIZATION) • APUNTES CLÍNICOS 1D",
        `DOCUMENTO: ${materialItem.titulo || "Guía Clínica"}`,
        `MATERIA:   ${materialItem.materia || "General"} (${(materialItem.carrera || "medicina").toUpperCase()})`,
        `FECHA:     ${new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}`,
        "====================================================================",
        "",
        "SÍNTESIS OFICIAL DEL RECURSO:",
        materialItem.descripcion || "Sin descripción adicional.",
        "",
        "APUNTES PERSONALES DEL ESTUDIANTE:",
        noteText || "(Sin apuntes registrados aún)",
        ""
    ].join("\n");

    const blob = new Blob([header], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (materialItem.titulo || "apuntes_1d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 40);
    a.href = url;
    a.download = `Apuntes_${safeName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// 6. UTILIDADES INTERNAS Y ATAJOS DE TECLADO
// ============================================================================

function getFilteredMaterialsByReaderControls(materials) {
    const query = readerState.searchQuery.trim().toLowerCase();
    const typeFilter = readerState.activeTypeFilter;

    return materials.filter(item => {
        const normalizedType = normalizeMaterialType(item);

        if (typeFilter === "favoritos" && !readerState.favoriteIds.has(item.id)) {
            return false;
        } else if (typeFilter !== "todos" && typeFilter !== "favoritos" && normalizedType !== typeFilter) {
            return false;
        }

        if (!query) return true;

        const haystack = `${item.titulo || ""} ${item.descripcion || ""} ${item.materia || ""} ${item.tipo || ""}`.toLowerCase();
        return haystack.includes(query);
    });
}

function normalizeMaterialType(item = {}) {
    const rawType = (item.tipo || "").toLowerCase();
    const rawPath = (item.url || item.ruta || "").toLowerCase();

    if (rawType.includes("infografia") || rawType.includes("algoritmo") || rawType.includes("imagen") || /\.(png|jpg|jpeg|webp|svg)$/.test(rawPath)) {
        return "infografia";
    }
    if (rawType.includes("video") || /\.(mp4|webm|ogg)$/.test(rawPath) || rawPath.includes("youtube.com") || rawPath.includes("vimeo.com")) {
        return "video";
    }
    return "pdf";
}

function getMaterialTypeMeta(normalizedType) {
    if (normalizedType === "infografia") {
        return {
            label: "Infografía / Algoritmo",
            icon: "account_tree",
            badgeClass: "bg-secondary/15 text-secondary"
        };
    }
    if (normalizedType === "video") {
        return {
            label: "Micro-Video 1D",
            icon: "smart_display",
            badgeClass: "bg-warning/15 text-warning"
        };
    }
    return {
        label: "Guía PDF / GPC",
        icon: "picture_as_pdf",
        badgeClass: "bg-primary/15 text-primary"
    };
}

function resolveMaterialSourceUrl(item = {}) {
    return item.url || item.ruta || item.base64Data || item.archivoBase64 || "";
}

function countByType(targetType) {
    return readerState.currentMaterials.filter(m => normalizeMaterialType(m) === targetType).length;
}

function countFavoritesInCurrent() {
    return readerState.currentMaterials.filter(m => readerState.favoriteIds.has(m.id)).length;
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function bindReaderGlobalShortcuts() {
    if (window.__makaiStudyReaderKeybound) return;
    window.__makaiStudyReaderKeybound = true;

    document.addEventListener("keydown", (e) => {
        if (!readerState.activeMaterial) return;

        const activeTag = document.activeElement?.tagName || "";
        if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

        if (e.key === "Escape") {
            closeMaterialViewer();
        } else if (e.key === "+" || e.key === "=") {
            setViewerZoom(readerState.viewerZoom + 25);
        } else if (e.key === "-") {
            setViewerZoom(readerState.viewerZoom - 25);
        }
    });
}
