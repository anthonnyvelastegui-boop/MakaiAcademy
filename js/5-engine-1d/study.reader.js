// ============================================================================
// ARCHIVO: js/5-engine-1d/study.reader.js
// DESCRIPCIÓN: Motor de Lectura Lineal 1D, Biblioteca de Guías de Práctica
//              Clínica (GPC), Bóveda Offline Cifrada (IndexedDB estilo Allango)
//              y Visor Multimedia en Modo Oscuro con Escudo DRM Anti-Descarga.
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
// 1. CONSTANTES DE LA BÓVEDA OFFLINE (INDEXEDDB) Y ESTADO DEL LECTOR 1D
// ============================================================================

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios"
};

const OFFLINE_VAULT_CONFIG = Object.freeze({
    DB_NAME: "makai_offline_vault_v1",
    DB_VERSION: 1,
    STORE_NAME: "encrypted_materials_1d"
});

const READER_WATERMARK_POSITIONS = Object.freeze([
    { top: "12%", left: "8%", rotate: "-10deg" },
    { top: "16%", left: "56%", rotate: "8deg" },
    { top: "44%", left: "28%", rotate: "-12deg" },
    { top: "66%", left: "54%", rotate: "10deg" },
    { top: "70%", left: "12%", rotate: "-8deg" }
]);

export const readerState = {
    initialized: false,
    controllerStateRef: null,
    currentMaterials: [],
    lastContainerEl: null,
    searchQuery: "",
    activeTypeFilter: "todos", // "todos" | "pdf" | "infografia" | "video" | "favoritos" | "offline"
    activeMaterial: null,
    activeEphemeralBlobUrl: null,
    activeSourceIsOffline: false,
    viewerZoom: 100,
    viewerRotation: 0,
    pdfNightFilter: false,
    textFontSize: 15,
    completedIds: new Set(),
    favoriteIds: new Set(),
    offlineIds: new Set(),
    offlineMetaMap: new Map(), // materialId -> { sizeBytes, savedAt, mimeType }
    downloadingIds: new Map(), // materialId -> progress (0..100)
    drmWatermarkIndex: 0,
    drmWatermarkTimer: null,
    isDrmBlackoutActive: false
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL LECTOR 1D Y PROTECCIÓN ANTI-IMPRESIÓN
// ============================================================================

/**
 * Inicializa el subcomponente study.reader.js enlazándolo con engine1d.controller.js,
 * sincroniza el catálogo de la Bóveda Offline (IndexedDB) y activa los escudos DRM.
 * @param {Object} controllerState - Referencia a engine1DState
 */
export async function initStudyReader(controllerState = null) {
    if (controllerState) {
        readerState.controllerStateRef = controllerState;
    }

    loadUserReaderPreferences();
    injectAntiPrintStylesheet();
    bindReaderGlobalShortcutsAndDRM();
    await refreshOfflineVaultIndex();

    readerState.initialized = true;
}

/**
 * Inyecta una hoja de estilos que impide imprimir o exportar a PDF desde el navegador
 * cualquier documento abierto en el Visor Clínico 1D.
 */
function injectAntiPrintStylesheet() {
    if (document.getElementById("makai-reader-antiprint-style")) return;
    const style = document.createElement("style");
    style.id = "makai-reader-antiprint-style";
    style.textContent = `
        @media print {
            body * {
                display: none !important;
                visibility: hidden !important;
            }
            body::after {
                content: "DOCUMENTO PROTEGIDO POR MAKAIACADEMY DRM • IMPRESIÓN Y DESCARGA DESHABILITADAS";
                display: block !important;
                visibility: visible !important;
                font-family: monospace;
                font-size: 18px;
                font-weight: bold;
                text-align: center;
                padding: 80px 20px;
                color: #ef4444;
            }
        }
    `;
    document.head.appendChild(style);
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
// 3. MOTOR DE BÓVEDA OFFLINE CIFRADA (INDEXEDDB ESTILO ALLANGO)
// ============================================================================

/**
 * Abre la conexión con la base de datos interna IndexedDB del navegador.
 * @returns {Promise<IDBDatabase>}
 */
function openOfflineVaultDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB no está disponible en este navegador."));
            return;
        }

        const request = indexedDB.open(OFFLINE_VAULT_CONFIG.DB_NAME, OFFLINE_VAULT_CONFIG.DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(OFFLINE_VAULT_CONFIG.STORE_NAME)) {
                const store = dbInstance.createObjectStore(OFFLINE_VAULT_CONFIG.STORE_NAME, {
                    keyPath: "vaultKey"
                });
                store.createIndex("by_uid", "uid", { unique: false });
                store.createIndex("by_material", "materialId", { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Genera la clave de almacenamiento única por usuario y documento.
 */
function getVaultRecordKey(materialId) {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    return `${uid}::${materialId}`;
}

/**
 * Ofusca y desofusca en memoria los bytes del documento usando una llave derivada del UID
 * del alumno. Impide que el archivo guardado en IndexedDB tenga una cabecera PDF/MP4 directa.
 * @param {ArrayBuffer} buffer
 * @param {string} secretSeed
 * @returns {Uint8Array}
 */
function xorTransformBuffer(buffer, secretSeed = "MAKAI-ALICIZATION-DRM") {
    const view = new Uint8Array(buffer);
    const out = new Uint8Array(view.length);
    const keyBytes = new TextEncoder().encode(`MK-DRM-${secretSeed}-2026`);
    const keyLen = keyBytes.length;

    // Cifrar/descifrar los primeros 64 KB (cabeceras de archivo y tabla de referencias PDF/MP4)
    // más muestreo periódico para mantener velocidad instantánea en libros grandes.
    const fullCryptLimit = Math.min(view.length, 65536);

    for (let i = 0; i < fullCryptLimit; i++) {
        out[i] = view[i] ^ keyBytes[i % keyLen];
    }
    for (let i = fullCryptLimit; i < view.length; i++) {
        out[i] = (i % 16 === 0) ? (view[i] ^ keyBytes[i % keyLen]) : view[i];
    }

    return out;
}

/**
 * Sincroniza la lista de materiales que el usuario actual ya tiene guardados en la Bóveda Offline.
 */
export async function refreshOfflineVaultIndex() {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    readerState.offlineIds.clear();
    readerState.offlineMetaMap.clear();

    try {
        const dbInstance = await openOfflineVaultDB();
        await new Promise((resolve) => {
            const tx = dbInstance.transaction(OFFLINE_VAULT_CONFIG.STORE_NAME, "readonly");
            const store = tx.objectStore(OFFLINE_VAULT_CONFIG.STORE_NAME);
            const cursorReq = store.openCursor();

            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                const record = cursor.value;
                if (record && record.uid === uid && record.materialId) {
                    readerState.offlineIds.add(String(record.materialId));
                    readerState.offlineMetaMap.set(String(record.materialId), {
                        sizeBytes: record.sizeBytes || 0,
                        savedAt: record.savedAt || "",
                        mimeType: record.mimeType || "application/pdf"
                    });
                }
                cursor.continue();
            };
            cursorReq.onerror = () => resolve();
        });
    } catch (e) {
        // Si el navegador está en modo incógnito restringido, continúa sin romper
    }
}

/**
 * Descarga un libro/PDF/infografía/video dentro de la Bóveda Interna del navegador (IndexedDB)
 * sin exponer el archivo en la carpeta de Descargas del sistema operativo.
 * @param {Object} materialItem
 */
export async function saveMaterialToOfflineVault(materialItem) {
    if (!materialItem || !materialItem.id) return false;

    const requiredPlan = materialItem.planRequerido || "Básico";
    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    const isAdmin = isMasterAdmin(userEmail);

    if (!isAdmin && !canAccessBySubscription(requiredPlan)) {
        const freemiumModal = document.getElementById("freemium-modal");
        if (freemiumModal) {
            freemiumModal.classList.remove("hidden");
            freemiumModal.classList.add("flex");
        } else {
            alert(`Necesitas el Plan ${requiredPlan} para guardar este libro en tu Bóveda Offline.`);
        }
        return false;
    }

    const matId = String(materialItem.id);
    if (readerState.downloadingIds.has(matId)) return false;

    const sourceUrl = resolveMaterialSourceUrl(materialItem);
    if (!sourceUrl && !materialItem.contenidoTexto) {
        alert("Este recurso aún no tiene un archivo vinculado para sincronización offline.");
        return false;
    }

    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";
    readerState.downloadingIds.set(matId, 10);
    if (readerState.lastContainerEl) {
        renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
    }

    try {
        let rawBuffer;
        let mimeType = inferMimeType(materialItem, sourceUrl);

        if (sourceUrl.startsWith("data:")) {
            const response = await fetch(sourceUrl);
            const blob = await response.blob();
            mimeType = blob.type || mimeType;
            rawBuffer = await blob.arrayBuffer();
        } else if (sourceUrl) {
            const response = await fetch(sourceUrl, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`No se pudo obtener el recurso (${response.status})`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType) mimeType = contentType.split(";")[0].trim();

            // Lectura con progreso si el servidor informa Content-Length
            const contentLength = Number(response.headers.get("content-length")) || 0;
            if (response.body && contentLength > 0) {
                const reader = response.body.getReader();
                const chunks = [];
                let receivedLength = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                    const percent = Math.min(95, Math.round((receivedLength / contentLength) * 100));
                    readerState.downloadingIds.set(matId, percent);
                    updateCardDownloadProgressUI(matId, percent);
                }

                const combined = new Uint8Array(receivedLength);
                let position = 0;
                for (const chunk of chunks) {
                    combined.set(chunk, position);
                    position += chunk.length;
                }
                rawBuffer = combined.buffer;
            } else {
                const blob = await response.blob();
                rawBuffer = await blob.arrayBuffer();
            }
        } else {
            const encoder = new TextEncoder();
            rawBuffer = encoder.encode(materialItem.contenidoTexto || "").buffer;
            mimeType = "text/plain;charset=utf-8";
        }

        // Ofuscar los bytes con la firma del estudiante antes de guardar en IndexedDB
        const encryptedBytes = xorTransformBuffer(rawBuffer, uid);

        const vaultRecord = {
            vaultKey: getVaultRecordKey(matId),
            uid,
            materialId: matId,
            titulo: materialItem.titulo || "Documento Clínico 1D",
            materia: materialItem.materia || "General",
            planRequerido: requiredPlan,
            mimeType,
            sizeBytes: encryptedBytes.byteLength,
            savedAt: new Date().toISOString(),
            encryptedBuffer: encryptedBytes.buffer
        };

        const dbInstance = await openOfflineVaultDB();
        await new Promise((resolve, reject) => {
            const tx = dbInstance.transaction(OFFLINE_VAULT_CONFIG.STORE_NAME, "readwrite");
            const store = tx.objectStore(OFFLINE_VAULT_CONFIG.STORE_NAME);
            const req = store.put(vaultRecord);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        readerState.downloadingIds.delete(matId);
        readerState.offlineIds.add(matId);
        readerState.offlineMetaMap.set(matId, {
            sizeBytes: encryptedBytes.byteLength,
            savedAt: vaultRecord.savedAt,
            mimeType
        });

        if (readerState.lastContainerEl) {
            renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
        }
        return true;
    } catch (error) {
        console.warn("No se pudo guardar en la Bóveda Offline:", error);
        readerState.downloadingIds.delete(matId);
        if (readerState.lastContainerEl) {
            renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
        }
        alert("No se pudo sincronizar el archivo para lectura sin conexión. Verifica que el archivo exista en assets/5-multimedia-1d/ y que tengas conexión a internet.");
        return false;
    }
}

/**
 * Elimina un documento de la Bóveda Offline para liberar espacio en el dispositivo.
 * @param {string} materialId
 */
export async function removeMaterialFromOfflineVault(materialId) {
    if (!materialId) return;
    const matId = String(materialId);

    try {
        const dbInstance = await openOfflineVaultDB();
        await new Promise((resolve, reject) => {
            const tx = dbInstance.transaction(OFFLINE_VAULT_CONFIG.STORE_NAME, "readwrite");
            const store = tx.objectStore(OFFLINE_VAULT_CONFIG.STORE_NAME);
            const req = store.delete(getVaultRecordKey(matId));
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {}

    readerState.offlineIds.delete(matId);
    readerState.offlineMetaMap.delete(matId);

    if (readerState.lastContainerEl) {
        renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
    }
}

/**
 * Recupera y desofusca en memoria RAM un documento guardado en la Bóveda Offline,
 * devolviendo un ObjectURL efímero válido únicamente mientras el visor está abierto.
 * @param {Object} materialItem
 * @returns {Promise<string|null>}
 */
export async function getOfflineMaterialBlobUrl(materialItem) {
    if (!materialItem || !materialItem.id) return null;
    const matId = String(materialItem.id);
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || "guest";

    try {
        const dbInstance = await openOfflineVaultDB();
        const record = await new Promise((resolve) => {
            const tx = dbInstance.transaction(OFFLINE_VAULT_CONFIG.STORE_NAME, "readonly");
            const store = tx.objectStore(OFFLINE_VAULT_CONFIG.STORE_NAME);
            const req = store.get(getVaultRecordKey(matId));
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });

        if (!record || !record.encryptedBuffer) return null;

        // Validar que el usuario siga teniendo la suscripción requerida para leerlo offline
        const requiredPlan = record.planRequerido || materialItem.planRequerido || "Básico";
        const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
        if (!isMasterAdmin(userEmail) && !canAccessBySubscription(requiredPlan)) {
            return null;
        }

        // Desofuscar en memoria RAM y crear Blob efímero
        const decryptedBytes = xorTransformBuffer(record.encryptedBuffer, uid);
        const blob = new Blob([decryptedBytes], { type: record.mimeType || "application/pdf" });
        return URL.createObjectURL(blob);
    } catch (e) {
        return null;
    }
}

/**
 * Revoca cualquier URL temporal en RAM para impedir que pueda reutilizarse.
 */
function revokeActiveEphemeralBlobUrl() {
    if (readerState.activeEphemeralBlobUrl) {
        try {
            URL.revokeObjectURL(readerState.activeEphemeralBlobUrl);
        } catch (e) {}
        readerState.activeEphemeralBlobUrl = null;
    }
    readerState.activeSourceIsOffline = false;
}

// ============================================================================
// 4. RENDERIZADO DEL CATÁLOGO DE BIBLIOTECA Y FILTROS 1D
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
    const totalOfflineMB = calculateTotalOfflineVaultSizeMB();
    const isNetworkOffline = typeof navigator !== "undefined" && navigator.onLine === false;

    targetContainer.innerHTML = `
        <!-- BARRA SUPERIOR DE BÚSQUEDA, PROGRESO DE LECTURA, ESTADO OFFLINE Y FILTROS -->
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
                        placeholder="Buscar libro, GPC, protocolo MSP, algoritmo o tema clínico..."
                        class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                    />
                </div>

                <!-- Indicador de Bóveda Offline (Estilo Allango) -->
                <div class="flex items-center gap-2.5 bg-surface border ${isNetworkOffline ? "border-warning/60" : "border-surface-high"} rounded-xl px-3.5 py-2">
                    <span class="material-symbols-outlined text-base ${isNetworkOffline ? "text-warning animate-pulse" : "text-primary"}">
                        ${isNetworkOffline ? "wifi_off" : "cloud_done"}
                    </span>
                    <div>
                        <span class="block text-[10px] font-mono ${isNetworkOffline ? "text-warning" : "text-gray-400"} uppercase">
                            ${isNetworkOffline ? "Modo Sin Conexión Activo" : "Bóveda Offline (Sin Descarga)"}
                        </span>
                        <span class="text-xs font-mono font-extrabold text-white">
                            ${countOfflineInCurrent()} guardados • <span class="text-primary">${totalOfflineMB} MB</span>
                        </span>
                    </div>
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

            <!-- Píldoras de filtro por tipo de recurso 1D + Disponibles Offline -->
            <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-high">
                ${renderFilterPill("todos", "apps", "Todos los Recursos", readerState.currentMaterials.length)}
                ${renderFilterPill("pdf", "picture_as_pdf", "Guías PDF / Libros", countByType("pdf"))}
                ${renderFilterPill("infografia", "account_tree", "Infografías & Algoritmos", countByType("infografia"))}
                ${renderFilterPill("video", "smart_display", "Micro-Videos 1D", countByType("video"))}
                ${renderFilterPill("favoritos", "bookmark", "Mis Favoritos", countFavoritesInCurrent())}
                ${renderFilterPill("offline", "offline_pin", "Disponibles Offline", countOfflineInCurrent())}
            </div>
        </div>

        <!-- CONTENEDOR DEL VISOR CLÍNICO 1D EN MODO OSCURO CON ESCUDO DRM -->
        <div id="engine1d-inline-viewer" class="${readerState.activeMaterial ? "" : "hidden"}"></div>

        <!-- GRILLA DE MATERIALES CLÍNICOS 1D -->
        <div id="reader-materials-grid">
            ${filteredList.length === 0 ? renderEmptyMaterialsState() : renderMaterialCardsGrid(filteredList)}
        </div>
    `;

    bindMaterialsCatalogEvents(targetContainer);

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
                const matId = String(item.id);
                const normalizedType = normalizeMaterialType(item);
                const typeBadge = getMaterialTypeMeta(normalizedType);
                const requiredPlan = item.planRequerido || "Básico";
                const hasAccess = isAdmin || canAccessBySubscription(requiredPlan);
                const isCompleted = readerState.completedIds.has(item.id);
                const isFavorite = readerState.favoriteIds.has(item.id);
                const isOfflineSaved = readerState.offlineIds.has(matId);
                const downloadProgress = readerState.downloadingIds.get(matId);
                const isDownloading = typeof downloadProgress === "number";
                const offlineMeta = readerState.offlineMetaMap.get(matId);
                const sizeLabel = offlineMeta?.sizeBytes
                    ? `${(offlineMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                    : "";
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
                                    ${isOfflineSaved ? `
                                        <span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/40 text-[10px] font-mono font-extrabold flex items-center gap-1" title="Guardado en la Bóveda Offline de este dispositivo">
                                            <span class="material-symbols-outlined text-xs">offline_pin</span>
                                            <span>Offline ${escapeHtml(sizeLabel)}</span>
                                        </span>
                                    ` : ""}

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

                        <!-- Pie de tarjeta con acciones: Marcar Leído + Guardar Offline + Abrir en Visor 1D -->
                        <div class="mt-4 pt-3 border-t border-surface-high flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap items-center gap-1.5">
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

                                <!-- Botón Bóveda Offline (Estilo Allango) -->
                                <button
                                    type="button"
                                    data-offline-toggle="${escapeHtml(item.id)}"
                                    data-offline-card-btn="${escapeHtml(item.id)}"
                                    title="${isOfflineSaved ? "Eliminar de la memoria offline de este dispositivo" : "Guardar en Bóveda Offline para visualizar sin internet (sin descarga de archivo)"}"
                                    class="btn-offline-vault-1d px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                                        isDownloading
                                            ? "bg-primary/20 text-primary border border-primary/50 animate-pulse"
                                            : isOfflineSaved
                                            ? "bg-primary/15 text-primary border border-primary/40 hover:bg-danger/15 hover:text-danger hover:border-danger/40"
                                            : "bg-surface text-gray-300 border border-surface-high hover:border-primary hover:text-primary"
                                    }"
                                >
                                    <span class="material-symbols-outlined text-sm">
                                        ${isDownloading ? "sync" : isOfflineSaved ? "cloud_done" : "download_for_offline"}
                                    </span>
                                    <span data-offline-label="${escapeHtml(item.id)}">
                                        ${isDownloading ? `Sincronizando ${downloadProgress}%` : isOfflineSaved ? "Guardado Offline" : "Guardar Offline"}
                                    </span>
                                </button>
                            </div>

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
 * Actualiza en tiempo real el porcentaje del botón mientras se sincroniza un libro grande.
 */
function updateCardDownloadProgressUI(materialId, percent) {
    const labelEl = document.querySelector(`[data-offline-label="${CSS.escape(String(materialId))}"]`);
    if (labelEl) {
        labelEl.textContent = `Sincronizando ${percent}%`;
    }
}

/**
 * Estado vacío cuando no existen materiales para el filtro o búsqueda actual.
 */
function renderEmptyMaterialsState() {
    const isOfflineFilter = readerState.activeTypeFilter === "offline";
    return `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-gray-500">
                ${isOfflineFilter ? "cloud_off" : "menu_book"}
            </span>
            <p class="text-sm font-extrabold text-white mt-2">
                ${isOfflineFilter
                    ? "Aún no has guardado libros ni guías en tu Bóveda Offline"
                    : "No se encontraron guías clínicas, esquemas o PDFs con este filtro"}
            </p>
            <p class="text-xs text-gray-400 mt-1 max-w-lg mx-auto">
                ${isOfflineFilter
                    ? "Pulsa el botón 'Guardar Offline' en cualquier guía PDF, libro o infografía cuando tengas internet para poder visualizarlo sin conexión desde aquí."
                    : "Prueba limpiando el buscador, seleccionando 'Todos los Recursos' o cambiando la materia activa."}
            </p>
        </div>
    `;
}

/**
 * Enlaza los eventos del buscador, filtros por tipo, favoritos, completados, Bóveda Offline y apertura del visor.
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

    containerEl.querySelectorAll(".btn-offline-vault-1d").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const matId = String(btn.dataset.offlineToggle || "");
            const found = readerState.currentMaterials.find(m => String(m.id) === matId);
            if (!found) return;

            if (readerState.offlineIds.has(matId)) {
                if (confirm(`¿Deseas quitar "${found.titulo}" de la memoria sin conexión de este dispositivo? (Tus apuntes y progreso se conservarán).`)) {
                    await removeMaterialFromOfflineVault(matId);
                }
            } else {
                await saveMaterialToOfflineVault(found);
            }
        });
    });
}

// ============================================================================
// 5. VISOR CLÍNICO 1D EN MODO OSCURO CON ESCUDO DRM Y LECTURA OFFLINE
// ============================================================================

/**
 * Abre un recurso en el Visor Clínico 1D tras verificar la suscripción del estudiante.
 * Si el archivo existe en la Bóveda Offline (IndexedDB), lo descifra en memoria RAM
 * y lo muestra incluso sin conexión a internet.
 * @param {Object} materialItem
 */
export async function openMaterialViewer(materialItem) {
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

    // Limpiar cualquier Blob URL anterior antes de abrir el nuevo documento
    revokeActiveEphemeralBlobUrl();

    readerState.activeMaterial = materialItem;
    readerState.viewerZoom = 100;
    readerState.viewerRotation = 0;
    readerState.isDrmBlackoutActive = false;

    if (readerState.controllerStateRef) {
        readerState.controllerStateRef.activeMaterial = materialItem;
    }

    // 1. Verificar si está en la Bóveda Offline para abrirlo instantáneamente desde IndexedDB
    const matId = String(materialItem.id);
    if (readerState.offlineIds.has(matId)) {
        const offlineBlobUrl = await getOfflineMaterialBlobUrl(materialItem);
        if (offlineBlobUrl) {
            readerState.activeEphemeralBlobUrl = offlineBlobUrl;
            readerState.activeSourceIsOffline = true;
        }
    }

    renderInlineMaterialViewer(materialItem);
    startReaderWatermarkCycle();

    const viewerBox = document.getElementById("engine1d-inline-viewer");
    viewerBox?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Cierra el Visor Clínico 1D, destruye el Blob efímero en RAM y detiene el ciclo DRM.
 */
export function closeMaterialViewer() {
    revokeActiveEphemeralBlobUrl();
    stopReaderWatermarkCycle();

    readerState.activeMaterial = null;
    readerState.isDrmBlackoutActive = false;

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
 * Renderiza el reproductor/visor adecuado según el tipo de material con protección anti-descarga.
 * @param {Object} materialItem
 */
function renderInlineMaterialViewer(materialItem) {
    const viewerBox = document.getElementById("engine1d-inline-viewer");
    if (!viewerBox || !materialItem) return;

    const matId = String(materialItem.id);
    const normalizedType = normalizeMaterialType(materialItem);
    const typeMeta = getMaterialTypeMeta(normalizedType);
    const effectiveSourceUrl = readerState.activeEphemeralBlobUrl || resolveMaterialSourceUrl(materialItem);
    const isCompleted = readerState.completedIds.has(materialItem.id);
    const isOfflineSaved = readerState.offlineIds.has(matId);
    const savedNote = getSavedMaterialNote(materialItem.id);

    viewerBox.classList.remove("hidden");
    viewerBox.innerHTML = `
        <div
            id="reader-viewer-shell"
            class="bg-surface-container border-2 border-primary/60 rounded-2xl p-4 md:p-5 shadow-[0_0_30px_rgba(0,229,255,0.12)] space-y-4 select-none"
        >
            <!-- BARRA DE HERRAMIENTAS DEL VISOR 1D PROTEGIDO -->
            <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-high">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary flex-shrink-0">
                        <span class="material-symbols-outlined">${typeMeta.icon}</span>
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[10px] font-mono text-primary uppercase tracking-wider font-extrabold">
                                Visor Protegido 1D • ${typeMeta.label}
                            </span>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase flex items-center gap-1 ${
                                readerState.activeSourceIsOffline
                                    ? "bg-secondary/15 text-secondary border border-secondary/40"
                                    : "bg-primary/15 text-primary border border-primary/40"
                            }">
                                <span class="material-symbols-outlined text-[11px]">
                                    ${readerState.activeSourceIsOffline ? "offline_pin" : "verified_user"}
                                </span>
                                <span>${readerState.activeSourceIsOffline ? "Bóveda Offline • Sin Descarga" : "DRM Activo • Solo Lectura"}</span>
                            </span>
                        </div>
                        <h3 class="text-base md:text-lg font-extrabold text-white mt-0.5">
                            ${escapeHtml(materialItem.titulo || "Recurso Clínico")}
                        </h3>
                    </div>
                </div>

                <!-- Controles tácticos del visor (Sin botón de descarga ni Nueva Pestaña) -->
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
                            <button type="button" id="btn-reader-rotate" class="px-2 py-1 rounded-lg hover:bg-surface-high text-gray-300 text-xs font-mono font-bold flex items-center" title="Rotar 90°">
                                <span class="material-symbols-outlined text-sm">rotate_right</span>
                            </button>
                        </div>
                    ` : ""}

                    <!-- Botón rápido para guardar/quitar de Bóveda Offline desde dentro del visor -->
                    <button
                        type="button"
                        id="btn-viewer-offline-vault"
                        class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isOfflineSaved
                                ? "bg-secondary/20 text-secondary border-secondary"
                                : "bg-surface text-gray-300 border-surface-high hover:border-primary hover:text-primary"
                        }"
                        title="${isOfflineSaved ? "Este libro ya está disponible para ver sin conexión" : "Guardar libro en el navegador para ver sin internet"}"
                    >
                        <span class="material-symbols-outlined text-sm">${isOfflineSaved ? "offline_pin" : "download_for_offline"}</span>
                        <span>${isOfflineSaved ? "Disponible Offline" : "Guardar Offline"}</span>
                    </button>

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

            <!-- CUERPO DIVIDIDO: LIENZO MULTIMEDIA PROTEGIDO (8 COLS) + CUADERNO DE APUNTES CLÍNICOS (4 COLS) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <!-- Lienzo Principal con Capa de Marca de Agua Forense y Cortina Anti-Captura -->
                <div
                    id="reader-protected-viewport"
                    class="lg:col-span-8 bg-surface border border-surface-high rounded-xl overflow-hidden flex flex-col relative"
                >
                    ${renderMediaCanvasByType(normalizedType, effectiveSourceUrl, materialItem)}

                    <!-- CAPA DE MARCA DE AGUA FORENSE DINÁMICA (ANTI-FOTO / ANTI-CAPTURA) -->
                    <div
                        id="reader-drm-watermark-layer"
                        class="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none"
                    >
                        ${renderReaderWatermarkInnerHtml(materialItem)}
                    </div>

                    <!-- CORTINA NEGRA ANTI-CAPTURA (SE ACTIVA ANTE PRINTSCREEN / CTRL+P) -->
                    <div
                        id="reader-drm-blackout-curtain"
                        class="${readerState.isDrmBlackoutActive ? "flex" : "hidden"} absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex-col items-center justify-center p-6 text-center"
                    >
                        <div class="max-w-md w-full bg-surface-container border border-danger/50 rounded-2xl p-6 space-y-3 shadow-2xl">
                            <div class="w-12 h-12 rounded-2xl bg-danger/15 border border-danger/40 flex items-center justify-center text-danger mx-auto">
                                <span class="material-symbols-outlined text-3xl">gpp_bad</span>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-full bg-danger/20 text-danger text-[10px] font-mono font-extrabold uppercase">
                                Escudo DRM Biblioteca 1D • Acción Bloqueada
                            </span>
                            <h4 class="text-sm font-extrabold text-white uppercase">
                                Descarga, Impresión y Captura Deshabilitadas
                            </h4>
                            <p id="reader-drm-blackout-reason" class="text-xs text-gray-300 leading-relaxed">
                                Este libro está habilitado exclusivamente para visualización dentro de MakaiAcademy (online y offline).
                            </p>
                            <button
                                type="button"
                                id="btn-reader-resume-drm"
                                class="w-full py-2.5 px-4 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all"
                            >
                                Volver a la Lectura Segura
                            </button>
                        </div>
                    </div>
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
                                Tus notas sobre esta guía (funcionan sin conexión)
                            </label>
                            <textarea
                                id="reader-personal-notes"
                                rows="9"
                                placeholder="Escribe aquí dosis clave, puntos de corte, criterios de referencia o nemotecnias..."
                                class="w-full bg-surface-container border border-surface-high focus:border-primary rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none resize-y font-mono leading-relaxed select-text"
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
 * Construye el lienzo interno según el formato del recurso aplicando parámetros anti-descarga.
 */
function renderMediaCanvasByType(normalizedType, sourceUrl, materialItem) {
    if (!sourceUrl && !materialItem.contenidoTexto) {
        return `
            <div class="h-[65vh] flex flex-col items-center justify-center p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-warning">warning</span>
                <p class="text-sm font-bold text-white mt-2">Archivo pendiente de vinculación en la bóveda</p>
                <p class="text-xs text-gray-400 mt-1 max-w-md">
                    Verifica que el archivo exista en <code class="text-primary">assets/5-multimedia-1d/</code> o sincronízalo primero con conexión a internet.
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
                    draggable="false"
                    style="transform: scale(${readerState.viewerZoom / 100}) rotate(${readerState.viewerRotation}deg); transform-origin: center center; -webkit-user-drag: none;"
                    class="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200 shadow-2xl pointer-events-none select-none"
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
                        allow="accelerometer; autoplay; encrypted-media; gyroscope"
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
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    crossorigin="anonymous"
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

    // Visor PDF Protegido (Oculta barra de descarga/impresión nativa con #toolbar=0&navpanes=0)
    const nightFilterStyle = readerState.pdfNightFilter
        ? "filter: invert(0.92) hue-rotate(180deg) contrast(1.05);"
        : "";
    const hardenedPdfUrl = appendPdfHardeningParams(sourceUrl);

    return `
        <div class="w-full h-[68vh] bg-[#090d14] relative select-none">
            <iframe
                id="reader-pdf-iframe"
                src="${escapeHtml(hardenedPdfUrl)}"
                style="${nightFilterStyle}"
                class="w-full h-full border-0 transition-all duration-300"
                title="${escapeHtml(materialItem.titulo || "Guía PDF 1D")}"
            ></iframe>
        </div>
    `;
}

/**
 * Añade los parámetros de ocultamiento de barra de herramientas, descarga e impresión
 * a cualquier URL de PDF (remota o Blob efímero en RAM).
 */
function appendPdfHardeningParams(url = "") {
    if (!url) return "";
    const base = url.split("#")[0];
    return `${base}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
}

/**
 * Enlaza los controles interactivos del visor activo y el escudo DRM sobre el lienzo.
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

    document.getElementById("btn-viewer-offline-vault")?.addEventListener("click", async () => {
        const matId = String(materialItem.id);
        if (readerState.offlineIds.has(matId)) {
            if (confirm(`¿Deseas eliminar "${materialItem.titulo}" de la memoria offline de este dispositivo?`)) {
                await removeMaterialFromOfflineVault(matId);
                renderInlineMaterialViewer(materialItem);
            }
        } else {
            const ok = await saveMaterialToOfflineVault(materialItem);
            if (ok) renderInlineMaterialViewer(materialItem);
        }
    });

    document.getElementById("btn-reader-resume-drm")?.addEventListener("click", () => {
        resumeReaderDRMBlackout();
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

    // Bloquear clic derecho y arrastre en el lienzo protegido
    const protectedViewport = document.getElementById("reader-protected-viewport");
    protectedViewport?.addEventListener("contextmenu", (e) => e.preventDefault());
    protectedViewport?.addEventListener("dragstart", (e) => e.preventDefault());

    // Endurecer reproductor de video 1D si existe
    const videoEl = document.getElementById("reader-video-player");
    if (videoEl) {
        videoEl.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };
        videoEl.addEventListener("enterpictureinpicture", () => {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            }
            activateReaderDRMBlackout("El modo Picture-in-Picture externo está deshabilitado en recursos protegidos.");
        });
    }

    // Velocidad de micro-videos 1D
    document.querySelectorAll(".btn-reader-video-speed").forEach(btn => {
        btn.addEventListener("click", () => {
            const player = document.getElementById("reader-video-player");
            const rate = parseFloat(btn.dataset.videoSpeed || "1");
            if (player && !isNaN(rate)) {
                player.playbackRate = rate;
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
// 6. ESCUDO DRM DEL LECTOR 1D (MARCA DE AGUA FORENSE Y CORTINA NEGRA)
// ============================================================================

/**
 * Construye el HTML de la marca de agua forense dinámica sobre el documento.
 */
function renderReaderWatermarkInnerHtml(materialItem) {
    const email = auth.currentUser?.email || appState.currentUserData?.email || "estudiante@makai.ec";
    const uid = String(auth.currentUser?.uid || appState.currentUserData?.uid || "MAKAI-1D").slice(0, 8).toUpperCase();
    const tier = appState.currentUserData?.subscriptionLevel || materialItem?.planRequerido || "Básico";
    const pos = READER_WATERMARK_POSITIONS[readerState.drmWatermarkIndex % READER_WATERMARK_POSITIONS.length];
    const timeStr = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    return `
        <div class="w-full h-full relative flex flex-col justify-between p-3 select-none pointer-events-none">
            <div class="flex items-center justify-between text-[9px] font-mono text-white/25 tracking-wider">
                <span>MAKAI DRM • ${escapeHtml(email)}</span>
                <span>UID: ${escapeHtml(uid)} • SOLO LECTURA</span>
            </div>

            <div
                class="absolute transition-all duration-1000 ease-in-out px-3 py-1 rounded-lg border border-white/10 bg-black/15"
                style="top: ${pos.top}; left: ${pos.left}; transform: rotate(${pos.rotate});"
            >
                <div class="text-[10px] font-mono font-extrabold text-white/30 uppercase tracking-widest">
                    ${escapeHtml(email)} • ${escapeHtml(uid)}
                </div>
                <div class="text-[8px] font-mono text-primary/35 flex items-center justify-between gap-2">
                    <span>PLAN ${escapeHtml(tier.toUpperCase())}</span>
                    <span>${escapeHtml(timeStr)} ECT</span>
                </div>
            </div>

            <div class="flex items-center justify-between text-[9px] font-mono text-white/25 tracking-wider">
                <span>PROHIBIDA SU DESCARGA O IMPRESIÓN</span>
                <span>${escapeHtml(materialItem?.id || "LIBRO-1D")}</span>
            </div>
        </div>
    `;
}

/**
 * Rota periódicamente la posición de la marca de agua sobre el PDF/libro abierto.
 */
function startReaderWatermarkCycle() {
    stopReaderWatermarkCycle();
    readerState.drmWatermarkTimer = setInterval(() => {
        if (!readerState.activeMaterial) return;
        readerState.drmWatermarkIndex = (readerState.drmWatermarkIndex + 1) % READER_WATERMARK_POSITIONS.length;
        const wmLayer = document.getElementById("reader-drm-watermark-layer");
        if (wmLayer) {
            wmLayer.innerHTML = renderReaderWatermarkInnerHtml(readerState.activeMaterial);
        }
    }, 10000);
}

function stopReaderWatermarkCycle() {
    if (readerState.drmWatermarkTimer) {
        clearInterval(readerState.drmWatermarkTimer);
        readerState.drmWatermarkTimer = null;
    }
}

/**
 * Activa la cortina negra de seguridad sobre el visor de libros si se detecta un intento
 * de captura de pantalla, impresión o extracción.
 * @param {string} reason
 */
export function activateReaderDRMBlackout(
    reason = "Se detectó un intento de captura de pantalla, impresión o guardado no autorizado."
) {
    if (!readerState.activeMaterial) return;
    readerState.isDrmBlackoutActive = true;

    const videoEl = document.getElementById("reader-video-player");
    videoEl?.pause?.();

    const pdfIframe = document.getElementById("reader-pdf-iframe");
    if (pdfIframe) pdfIframe.style.filter = "brightness(0) blur(20px)";

    const imgEl = document.getElementById("reader-zoomable-image");
    if (imgEl) imgEl.style.filter = "brightness(0) blur(20px)";

    const curtain = document.getElementById("reader-drm-blackout-curtain");
    const reasonEl = document.getElementById("reader-drm-blackout-reason");
    if (reasonEl) reasonEl.textContent = reason;
    if (curtain) {
        curtain.classList.remove("hidden");
        curtain.classList.add("flex");
    }
}

/**
 * Restaura la lectura cuando el estudiante confirma la alerta DRM.
 */
export function resumeReaderDRMBlackout() {
    readerState.isDrmBlackoutActive = false;

    const pdfIframe = document.getElementById("reader-pdf-iframe");
    if (pdfIframe) {
        pdfIframe.style.filter = readerState.pdfNightFilter
            ? "invert(0.92) hue-rotate(180deg) contrast(1.05)"
            : "";
    }

    const imgEl = document.getElementById("reader-zoomable-image");
    if (imgEl) imgEl.style.filter = "";

    const curtain = document.getElementById("reader-drm-blackout-curtain");
    if (curtain) {
        curtain.classList.add("hidden");
        curtain.classList.remove("flex");
    }
}

// ============================================================================
// 7. FUNCIONES DE CONTROL ÓPTICO, PROGRESO Y APUNTES
// ============================================================================

/**
 * Alterna el filtro nocturno inteligente para documentos PDF con fondo blanco.
 */
export function toggleReaderNightFilter() {
    readerState.pdfNightFilter = !readerState.pdfNightFilter;
    const iframe = document.getElementById("reader-pdf-iframe");
    const btn = document.getElementById("btn-reader-night-filter");

    if (iframe && !readerState.isDrmBlackoutActive) {
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
 * Exporta los apuntes clínicos del estudiante en un archivo .TXT (permitido porque son
 * notas propias del alumno, no el libro protegido).
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
// 8. UTILIDADES INTERNAS, CONTADORES OFFLINE Y ATAJOS DE SEGURIDAD
// ============================================================================

function getFilteredMaterialsByReaderControls(materials) {
    const query = readerState.searchQuery.trim().toLowerCase();
    const typeFilter = readerState.activeTypeFilter;

    return materials.filter(item => {
        const normalizedType = normalizeMaterialType(item);

        if (typeFilter === "favoritos" && !readerState.favoriteIds.has(item.id)) {
            return false;
        } else if (typeFilter === "offline" && !readerState.offlineIds.has(String(item.id))) {
            return false;
        } else if (
            typeFilter !== "todos" &&
            typeFilter !== "favoritos" &&
            typeFilter !== "offline" &&
            normalizedType !== typeFilter
        ) {
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

function inferMimeType(item = {}, sourceUrl = "") {
    const type = normalizeMaterialType(item);
    const lower = sourceUrl.toLowerCase();
    if (type === "infografia") {
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return "image/jpeg";
    }
    if (type === "video") {
        if (lower.endsWith(".webm")) return "video/webm";
        return "video/mp4";
    }
    return "application/pdf";
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
        label: "Guía PDF / Libro",
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

function countOfflineInCurrent() {
    return readerState.currentMaterials.filter(m => readerState.offlineIds.has(String(m.id))).length;
}

function calculateTotalOfflineVaultSizeMB() {
    let totalBytes = 0;
    readerState.offlineMetaMap.forEach(meta => {
        totalBytes += Number(meta?.sizeBytes || 0);
    });
    return (totalBytes / (1024 * 1024)).toFixed(1);
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Registra los atajos de lectura (Esc, +, -) y los bloqueadores DRM contra impresión
 * (Ctrl+P), guardado de página (Ctrl+S) y captura de pantalla (PrintScreen) mientras el visor está activo.
 */
function bindReaderGlobalShortcutsAndDRM() {
    if (window.__makaiStudyReaderKeybound) return;
    window.__makaiStudyReaderKeybound = true;

    document.addEventListener("keydown", (e) => {
        if (!readerState.activeMaterial) return;

        const key = (e.key || "").toLowerCase();
        const isPrintAttempt = (e.ctrlKey || e.metaKey) && key === "p";
        const isSaveAttempt = (e.ctrlKey || e.metaKey) && key === "s";
        const isPrintScreen = e.key === "PrintScreen" || e.keyCode === 44;
        const isSnipShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && (key === "s" || key === "3" || key === "4");

        // Bloquear Ctrl+P (Imprimir / Guardar como PDF) y Ctrl+S (Guardar archivo)
        if (isPrintAttempt || isSaveAttempt) {
            e.preventDefault();
            e.stopPropagation();
            activateReaderDRMBlackout(
                "La impresión y descarga directa de libros o guías PDF están deshabilitadas. Utiliza el botón 'Guardar Offline' para leer sin conexión dentro de la plataforma."
            );
            return;
        }

        // Bloquear teclas de captura de pantalla
        if (isPrintScreen || isSnipShortcut) {
            e.preventDefault();
            activateReaderDRMBlackout(
                "Se detectó un atajo de captura de pantalla sobre un documento protegido por MakaiAcademy DRM."
            );
            return;
        }

        const activeTag = document.activeElement?.tagName || "";
        if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

        if (e.key === "Escape") {
            closeMaterialViewer();
        } else if (e.key === "+" || e.key === "=") {
            setViewerZoom(readerState.viewerZoom + 25);
        } else if (e.key === "-") {
            setViewerZoom(readerState.viewerZoom - 25);
        }
    }, true);

    // Sincronizar también con el evento global emitido por classroom.drm.js si está activo
    window.addEventListener("makai:drmBlackoutActivated", (e) => {
        if (readerState.activeMaterial) {
            activateReaderDRMBlackout(e.detail?.reason || "Alerta DRM detectada en la sesión.");
        }
    });

    // Actualizar el indicador de red (Online / Offline) automáticamente cuando caiga o vuelva el Wi-Fi
    window.addEventListener("online", () => {
        if (readerState.lastContainerEl) {
            renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
        }
    });
    window.addEventListener("offline", () => {
        if (readerState.lastContainerEl) {
            renderStudyMaterialsList(readerState.currentMaterials, readerState.lastContainerEl);
        }
    });
}
