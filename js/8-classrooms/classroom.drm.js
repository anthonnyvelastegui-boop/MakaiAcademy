// ============================================================================
// ARCHIVO: js/8-classrooms/classroom.drm.js
// DESCRIPCIÓN: Subcomponente de Protección DRM (Widevine / EME + HTML5 Shield),
//              Marca de Agua Forense Dinámica en Movimiento, Cortina Negra
//              Anti-Captura de Pantalla, Vigilante Anti-Sabotaje DOM y
//              Auditoría de Seguridad en Cloud Firestore para Aulas Virtuales.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    addDoc,
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
// 1. CONSTANTES DE SEGURIDAD, COLECCIONES Y ESTADO INTERNO DEL MOTOR DRM
// ============================================================================

const SAFE_COLLECTIONS = Object.freeze({
    DRM_AUDIT_LOGS: COLLECTIONS?.DRM_AUDIT || "auditoria_drm_aulas",
    USERS: COLLECTIONS?.USERS || "usuarios"
});

/**
 * Coordenadas porcentuales precalculadas para rotar el sello forense flotante
 * por distintas zonas del reproductor sin obstruir los controles inferiores.
 */
const WATERMARK_FLOAT_POSITIONS = Object.freeze([
    { top: "10%", left: "8%", rotate: "-10deg" },
    { top: "14%", left: "58%", rotate: "8deg" },
    { top: "42%", left: "26%", rotate: "-14deg" },
    { top: "64%", left: "60%", rotate: "11deg" },
    { top: "68%", left: "10%", rotate: "-8deg" },
    { top: "24%", left: "34%", rotate: "12deg" }
]);

/**
 * Estado reactivo del escudo DRM de Aulas Virtuales.
 */
export const classroomDRMState = {
    initialized: false,
    shieldActive: true,
    isBlackoutTriggered: false,
    lastViolationReason: null,
    violationCount: 0,
    violationHistory: [],
    sessionLicenseToken: generateForensicSessionToken(),
    emeCapabilities: {
        checked: false,
        widevineSupported: false,
        clearKeySupported: false,
        securityLevel: "HTML5-Forensic-Shield"
    },
    domIds: {
        viewportId: "classroom-player-viewport",
        watermarkId: "classroom-drm-watermark-layer",
        curtainId: "classroom-drm-blackout-curtain",
        statusPillId: "classroom-drm-status-pill",
        videoId: "classroom-vod-video"
    },
    activeClassMeta: {
        id: "aula_caces_med_interna_01",
        titulo: "Sesión Magistral MakaiAcademy",
        nivelSuscripcion: "Básico"
    },
    floatPositionIndex: 0,
    watermarkIntervalId: null,
    videoMutationObserver: null,
    watermarkTamperObserver: null,
    isInternalWatermarkUpdate: false,
    strictBlurLockEnabled: false
};

// Referencias a manejadores de eventos para limpieza segura
let boundKeyDownHandler = null;
let boundKeyUpHandler = null;
let boundVisibilityHandler = null;
let boundWindowBlurHandler = null;
let boundCopyCutHandler = null;

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL SUBCOMPONENTE DRM (initClassroomDRM)
// ============================================================================

/**
 * Inicializa el sistema integral de protección DRM en el reproductor de Aulas Virtuales.
 * Invocado automáticamente por `classroom.controller.js` (`initDRMSubmodule`).
 * @param {Object} [options]
 * @param {string} [options.viewportId="classroom-player-viewport"]
 * @param {string} [options.watermarkId="classroom-drm-watermark-layer"]
 * @param {string} [options.curtainId="classroom-drm-blackout-curtain"]
 * @param {Object} [options.activeClass]
 * @returns {Promise<Object>}
 */
export async function initClassroomDRM(options = {}) {
    classroomDRMState.domIds = {
        ...classroomDRMState.domIds,
        ...(options.viewportId ? { viewportId: options.viewportId } : {}),
        ...(options.watermarkId ? { watermarkId: options.watermarkId } : {}),
        ...(options.curtainId ? { curtainId: options.curtainId } : {})
    };

    if (options.activeClass && typeof options.activeClass === "object") {
        classroomDRMState.activeClassMeta = {
            ...classroomDRMState.activeClassMeta,
            ...options.activeClass
        };
    }

    // 1. Verificar capacidades de cifrado por hardware/navegador (Widevine / ClearKey)
    await verifyEMEDRMSupport();

    // 2. Asegurar existencia y estructura de la cortina negra y capa de marca de agua
    ensureDRMContainersReady();

    // 3. Pintar la marca de agua forense inicial e iniciar su rotación posicional
    updateDRMWatermark(classroomDRMState.activeClassMeta);
    startWatermarkPositionCycle();

    // 4. Endurecer el elemento <video> actual y observar futuros montajes VOD/Live
    const currentVideo = document.getElementById(classroomDRMState.domIds.videoId);
    if (currentVideo) {
        hardenClassroomVideoElement(currentVideo);
    }
    startViewportVideoObserver();

    // 5. Iniciar el vigilante anti-sabotaje del DOM sobre la marca de agua
    startWatermarkTamperObserver();

    // 6. Enlazar los bloqueadores de teclado, captura de pantalla y pérdida de foco
    bindDRMSecurityEventListeners();

    // 7. Enlazar el botón de diagnóstico en la píldora #classroom-drm-status-pill
    bindDRMStatusPillUI();

    classroomDRMState.initialized = true;
    updateDRMStatusPillBadge("secure");

    return classroomDRMState;
}

// Alias oficial requerido por `classroom.controller.js`
export const initDRMProtection = initClassroomDRM;

// ============================================================================
// 3. MARCA DE AGUA FORENSE DINÁMICA EN MOVIMIENTO (ANTI-CÁMARA EXTERNA)
// ============================================================================

/**
 * Actualiza y dibuja la marca de agua forense multicapa sobre `#classroom-drm-watermark-layer`
 * con el correo, UID, licencia forense, ID de sesión y hora actual.
 * @param {Object} [classItem]
 * @param {Object} [customIdentity]
 */
export function updateDRMWatermark(classItem = null, customIdentity = null) {
    if (classItem && typeof classItem === "object") {
        classroomDRMState.activeClassMeta = {
            ...classroomDRMState.activeClassMeta,
            ...classItem
        };
    }

    const layer = document.getElementById(classroomDRMState.domIds.watermarkId);
    if (!layer) return;

    const identity = customIdentity || resolveStudentForensicIdentity();
    const classId = classroomDRMState.activeClassMeta?.id || "AULA-MAKAI";
    const tier = classroomDRMState.activeClassMeta?.nivelSuscripcion || identity.subscriptionTier || "PRO";
    const timeStampStr = new Date().toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const floatPos = WATERMARK_FLOAT_POSITIONS[
        classroomDRMState.floatPositionIndex % WATERMARK_FLOAT_POSITIONS.length
    ];

    classroomDRMState.isInternalWatermarkUpdate = true;

    // Forzar estilos de visibilidad de seguridad por si intentaron alterarlos con CSS externo
    layer.style.setProperty("display", "block", "important");
    layer.style.setProperty("visibility", "visible", "important");
    layer.style.setProperty("opacity", "1", "important");
    layer.style.setProperty("pointer-events", "none", "important");
    layer.style.setProperty("z-index", "20", "important");

    layer.innerHTML = `
        <div class="w-full h-full relative flex flex-col justify-between p-3.5 md:p-5 select-none pointer-events-none overflow-hidden">
            <!-- Franja Forense Superior -->
            <div class="flex items-center justify-between text-[9px] md:text-[10px] font-mono text-white/30 tracking-wider">
                <span>MAKAI DRM • ${escapeHtml(identity.email)}</span>
                <span>LIC: ${escapeHtml(classroomDRMState.sessionLicenseToken)} • UID: ${escapeHtml(identity.uidShort)}</span>
            </div>

            <!-- Sello Forense Flotante Dinámico (Cambia de coordenadas periódicamente) -->
            <div
                id="classroom-drm-floating-stamp"
                class="absolute transition-all duration-1000 ease-in-out px-3 py-1.5 rounded-lg border border-white/10 bg-black/15 backdrop-blur-[1px]"
                style="top: ${floatPos.top}; left: ${floatPos.left}; transform: rotate(${floatPos.rotate});"
            >
                <div class="text-[10px] md:text-xs font-mono font-extrabold text-white/35 tracking-widest uppercase">
                    ${escapeHtml(identity.email)} • ${escapeHtml(identity.uidShort)}
                </div>
                <div class="text-[8px] md:text-[9px] font-mono text-primary/40 flex items-center justify-between gap-3">
                    <span>${escapeHtml(classId.toUpperCase())}</span>
                    <span>PLAN ${escapeHtml(tier.toUpperCase())}</span>
                    <span>${escapeHtml(timeStampStr)} ECT</span>
                </div>
            </div>

            <!-- Malla Diagonal Sutil de Propiedad Intelectual -->
            <div class="self-center text-[10px] md:text-xs font-mono text-white/20 rotate-[-12deg] tracking-widest text-center">
                PROPIEDAD INTELECTUAL MAKAIACADEMY • PROHIBIDA SU CAPTURA O DISTRIBUCIÓN
            </div>

            <!-- Franja Forense Inferior -->
            <div class="flex items-center justify-between text-[9px] md:text-[10px] font-mono text-white/30 tracking-wider">
                <span>${escapeHtml(classId)} • ${escapeHtml( classroomDRMState.emeCapabilities.securityLevel )}</span>
                <span>TRAZABILIDAD ACTIVA: ${escapeHtml(identity.email)}</span>
            </div>
        </div>
    `;

    setTimeout(() => {
        classroomDRMState.isInternalWatermarkUpdate = false;
    }, 30);
}

// Alias de compatibilidad directa con `classroom.controller.js`
export const refreshDRMWatermarkOverlay = updateDRMWatermark;

/**
 * Rota periódicamente las coordenadas de la marca de agua flotante cada 9 segundos
 * para impedir su recorte o difuminado estático en editores de video.
 */
function startWatermarkPositionCycle() {
    if (classroomDRMState.watermarkIntervalId) {
        clearInterval(classroomDRMState.watermarkIntervalId);
    }

    classroomDRMState.watermarkIntervalId = setInterval(() => {
        if (!classroomDRMState.shieldActive) return;
        classroomDRMState.floatPositionIndex =
            (classroomDRMState.floatPositionIndex + 1) % WATERMARK_FLOAT_POSITIONS.length;
        updateDRMWatermark();
    }, 9000);
}

// ============================================================================
// 4. CORTINA NEGRA ANTI-CAPTURA Y BLOQUEO INSTANTÁNEO DE REPRODUCCIÓN
// ============================================================================

/**
 * Activa inmediatamente la cortina negra (`#classroom-drm-blackout-curtain`),
 * pausa el reproductor VOD, silencia el flujo y registra el incidente de seguridad.
 * @param {string} [reason="Se detectó un intento de captura de pantalla o pérdida de foco seguro."]
 * @param {Object} [metadata={}]
 */
export function activateDRMBlackoutCurtain(
    reason = "Se detectó un intento de captura de pantalla o acción restringida sobre el reproductor.",
    metadata = {}
) {
    classroomDRMState.isBlackoutTriggered = true;
    classroomDRMState.lastViolationReason = reason;
    classroomDRMState.violationCount += 1;

    // 1. Pausar de inmediato cualquier elemento <video> o <audio> dentro del Aula Virtual
    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    const videos = viewport
        ? viewport.querySelectorAll("video, audio")
        : document.querySelectorAll("#view-classrooms video, #view-classrooms audio");

    videos.forEach(mediaEl => {
        try {
            mediaEl.pause();
            if (mediaEl.tagName === "VIDEO") {
                mediaEl.style.filter = "brightness(0) blur(24px)";
            }
        } catch (e) {
            // Silencioso
        }
    });

    // 2. Mostrar la cortina negra de bloqueo y detallar la alerta forense
    const curtain = document.getElementById(classroomDRMState.domIds.curtainId);
    if (curtain) {
        curtain.classList.remove("hidden");
        renderDynamicBlackoutCurtainContent(curtain, reason);
    }

    // 3. Actualizar la insignia superior de estado DRM a modo alerta
    updateDRMStatusPillBadge("alert");

    // 4. Registrar el incidente en el historial y en Cloud Firestore
    logDRMSecurityIncident(reason, metadata);

    // 5. Emitir evento global para que `classroom.vod.js` o `classroom.live.js` reaccionen
    window.dispatchEvent(new CustomEvent("makai:drmBlackoutActivated", {
        detail: {
            reason,
            violationCount: classroomDRMState.violationCount,
            classId: classroomDRMState.activeClassMeta?.id,
            timestamp: new Date().toISOString()
        }
    }));
}

/**
 * Desactiva la cortina negra de bloqueo cuando el estudiante confirma la reanudación
 * segura de la sesión, restaurando la visibilidad del reproductor.
 */
export function resumeFromDRMBlackout() {
    classroomDRMState.isBlackoutTriggered = false;

    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    const videos = viewport
        ? viewport.querySelectorAll("video")
        : document.querySelectorAll("#view-classrooms video");

    videos.forEach(videoEl => {
        videoEl.style.filter = "none";
    });

    const curtain = document.getElementById(classroomDRMState.domIds.curtainId);
    if (curtain) {
        curtain.classList.add("hidden");
    }

    // Regenerar marca de agua por seguridad y restaurar píldora de estado
    updateDRMWatermark();
    updateDRMStatusPillBadge("secure");

    const mainVideo = document.getElementById(classroomDRMState.domIds.videoId);
    mainVideo?.play?.().catch(() => {});
}

/**
 * Actualiza el contenido visual de `#classroom-drm-blackout-curtain` preservando el
 * botón `#btn-resume-drm-curtain` utilizado por `classroom.controller.js`.
 * @param {HTMLElement} curtainEl
 * @param {string} reasonText
 */
function renderDynamicBlackoutCurtainContent(curtainEl, reasonText) {
    if (!curtainEl) return;

    const identity = resolveStudentForensicIdentity();

    curtainEl.innerHTML = `
        <div class="max-w-md w-full bg-surface-container/95 border border-danger/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(255,82,82,0.25)] space-y-3">
            <div class="w-12 h-12 rounded-2xl bg-danger/15 border border-danger/40 flex items-center justify-center text-danger mx-auto">
                <span class="material-symbols-outlined text-3xl">gpp_bad</span>
            </div>

            <div class="space-y-1">
                <span class="px-2.5 py-0.5 rounded-full bg-danger/20 text-danger text-[10px] font-mono font-extrabold uppercase tracking-wider">
                    Escudo Anti-Grabación Activado • Alerta #${classroomDRMState.violationCount}
                </span>
                <h4 class="text-sm md:text-base font-extrabold text-white uppercase tracking-wide pt-1">
                    Reproducción Pausada por Seguridad DRM
                </h4>
                <p class="text-xs text-gray-300 leading-relaxed">
                    ${escapeHtml(reasonText)}
                </p>
            </div>

            <div class="p-2.5 rounded-xl bg-surface border border-surface-high text-[10px] font-mono text-gray-400 text-left space-y-0.5">
                <div>• Licencia Asociada: <span class="text-white font-bold">${escapeHtml(identity.email)}</span></div>
                <div>• Token Forense: <span class="text-primary font-bold">${escapeHtml(classroomDRMState.sessionLicenseToken)}</span></div>
                <div>• Sesión: <span class="text-secondary">${escapeHtml(classroomDRMState.activeClassMeta?.id || "AULA-VIRTUAL")}</span></div>
            </div>

            <div class="pt-2">
                <button
                    type="button"
                    id="btn-resume-drm-curtain"
                    class="w-full py-2.5 px-4 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)] flex items-center justify-center gap-1.5"
                >
                    <span class="material-symbols-outlined text-sm">play_arrow</span>
                    <span>Reanudar Reproducción Segura</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById("btn-resume-drm-curtain")?.addEventListener("click", () => {
        resumeFromDRMBlackout();
    });
}

// ============================================================================
// 5. ENDURECIMIENTO DE VIDEO HTML5 Y NEGOCIACIÓN EME (WIDEVINE / CLEARKEY)
// ============================================================================

/**
 * Verifica mediante la API estándar W3C Encrypted Media Extensions (EME) si el
 * navegador del estudiante soporta descifrado por hardware/CDM (Google Widevine o ClearKey).
 * @returns {Promise<Object>}
 */
export async function verifyEMEDRMSupport() {
    if (typeof navigator === "undefined" || typeof navigator.requestMediaKeySystemAccess !== "function") {
        classroomDRMState.emeCapabilities = {
            checked: true,
            widevineSupported: false,
            clearKeySupported: false,
            securityLevel: "HTML5-Forensic-Shield"
        };
        return classroomDRMState.emeCapabilities;
    }

    const emeConfig = [{
        initDataTypes: ["cenc", "webm", "keyids"],
        videoCapabilities: [
            { contentType: 'video/mp4; codecs="avc1.42E01E"' },
            { contentType: 'video/webm; codecs="vp9"' }
        ]
    }];

    let widevine = false;
    let clearkey = false;

    try {
        await navigator.requestMediaKeySystemAccess("com.widevine.alpha", emeConfig);
        widevine = true;
    } catch (e) {
        widevine = false;
    }

    try {
        await navigator.requestMediaKeySystemAccess("org.w3.clearkey", emeConfig);
        clearkey = true;
    } catch (e) {
        clearkey = false;
    }

    classroomDRMState.emeCapabilities = {
        checked: true,
        widevineSupported: widevine,
        clearKeySupported: clearkey,
        securityLevel: widevine
            ? "Widevine-CDM + Forensic-WM"
            : clearkey
                ? "W3C-ClearKey + Forensic-WM"
                : "HTML5-Hardened + Forensic-WM"
    };

    return classroomDRMState.emeCapabilities;
}

/**
 * Aplica todos los candados contra descarga, extracción de stream, Picture-in-Picture
 * y clic derecho a un elemento `<video>` del Aula Virtual.
 * @param {HTMLVideoElement} videoEl
 * @param {Object} [drmConfig]
 */
export async function hardenClassroomVideoElement(videoEl, drmConfig = {}) {
    if (!videoEl || videoEl.tagName !== "VIDEO") return;

    // 1. Atributos nativos de bloqueo de descarga y reproducción externa
    videoEl.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback");
    videoEl.setAttribute("disablePictureInPicture", "true");
    videoEl.setAttribute("disableRemotePlayback", "true");
    videoEl.setAttribute("crossorigin", "anonymous");
    videoEl.disablePictureInPicture = true;
    videoEl.disableRemotePlayback = true;

    // 2. Bloquear menú contextual y arrastre directo del video
    videoEl.oncontextmenu = (e) => {
        e.preventDefault();
        return false;
    };
    videoEl.ondragstart = (e) => {
        e.preventDefault();
        return false;
    };

    // 3. Interceptar apertura forzada de Picture-in-Picture por extensiones externas
    if (!videoEl.dataset.makaiDrmBound) {
        videoEl.dataset.makaiDrmBound = "true";

        videoEl.addEventListener("enterpictureinpicture", () => {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            }
            activateDRMBlackoutCurtain(
                "El modo Picture-in-Picture externo está deshabilitado para proteger la marca de agua forense de la sesión.",
                { trigger: "enterpictureinpicture" }
            );
        });

        videoEl.addEventListener("play", () => {
            updateDRMWatermark();
        });
    }

    // 4. Si la clase proporciona llaves ClearKey/Widevine EME, inicializar MediaKeys
    if (drmConfig.encrypted && classroomDRMState.emeCapabilities.clearKeySupported) {
        try {
            const access = await navigator.requestMediaKeySystemAccess("org.w3.clearkey", [{
                initDataTypes: ["keyids"],
                videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }]
            }]);
            const mediaKeys = await access.createMediaKeys();
            await videoEl.setMediaKeys(mediaKeys);
        } catch (e) {
            // Continúa con protección HTML5 + Marca de Agua Forense
        }
    }
}

// ============================================================================
// 6. OBSERVADORES ANTI-SABOTAJE DOM (MutationObserver) Y ESCUCHADORES
// ============================================================================

/**
 * Observa `#classroom-player-viewport` para endurecer automáticamente cualquier nuevo
 * elemento `<video>` inyectado al cambiar de clase en `classroom.controller.js` o `classroom.vod.js`.
 */
function startViewportVideoObserver() {
    if (classroomDRMState.videoMutationObserver) {
        classroomDRMState.videoMutationObserver.disconnect();
    }

    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    if (!viewport || typeof MutationObserver !== "function") return;

    classroomDRMState.videoMutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                if (node.tagName === "VIDEO") {
                    hardenClassroomVideoElement(node);
                } else if (typeof node.querySelectorAll === "function") {
                    node.querySelectorAll("video").forEach(v => hardenClassroomVideoElement(v));
                }
            });
        }
    });

    classroomDRMState.videoMutationObserver.observe(viewport, {
        childList: true,
        subtree: true
    });
}

/**
 * Vigila el contenedor `#classroom-drm-watermark-layer`. Si el usuario intenta
 * borrar el nodo o alterar sus estilos inline desde las DevTools del navegador,
 * restaura la marca de agua al instante y activa la cortina negra de seguridad.
 */
export function startWatermarkTamperObserver() {
    if (classroomDRMState.watermarkTamperObserver) {
        classroomDRMState.watermarkTamperObserver.disconnect();
    }

    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    if (!viewport || typeof MutationObserver !== "function") return;

    classroomDRMState.watermarkTamperObserver = new MutationObserver((mutations) => {
        if (classroomDRMState.isInternalWatermarkUpdate) return;

        const watermarkLayer = document.getElementById(classroomDRMState.domIds.watermarkId);

        // Caso 1: Intentaron eliminar el nodo #classroom-drm-watermark-layer del DOM
        if (!watermarkLayer) {
            ensureDRMContainersReady();
            updateDRMWatermark();
            activateDRMBlackoutCurtain(
                "Se detectó una manipulación no autorizada de la capa de protección DRM en el árbol DOM.",
                { trigger: "dom_watermark_removed" }
            );
            return;
        }

        // Caso 2: Intentaron ocultar la marca de agua mediante atributos style o class
        for (const mutation of mutations) {
            if (
                mutation.target === watermarkLayer &&
                (mutation.type === "attributes" || mutation.type === "childList")
            ) {
                const isHiddenClass = watermarkLayer.classList.contains("hidden") ||
                    watermarkLayer.classList.contains("invisible");
                const inlineOpacity = watermarkLayer.style.opacity;
                const inlineDisplay = watermarkLayer.style.display;

                if (isHiddenClass || inlineOpacity === "0" || inlineDisplay === "none") {
                    watermarkLayer.classList.remove("hidden", "invisible");
                    updateDRMWatermark();
                    activateDRMBlackoutCurtain(
                        "Se detectó un intento de ocultamiento de la marca de agua forense.",
                        { trigger: "dom_watermark_style_tamper" }
                    );
                    break;
                }
            }
        }
    });

    classroomDRMState.watermarkTamperObserver.observe(viewport, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden"],
        childList: true,
        subtree: true
    });
}

/**
 * Registra los interceptores de atajos de captura de pantalla, herramientas de
 * inspección y cambios de visibilidad mientras el Aula Virtual está en pantalla.
 */
function bindDRMSecurityEventListeners() {
    unbindDRMSecurityEventListeners();

    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    viewport?.addEventListener("contextmenu", (e) => e.preventDefault());

    // 1. Interceptor de combinaciones de teclas de captura o extracción de código
    boundKeyDownHandler = (e) => {
        if (!isClassroomViewCurrentlyVisible()) return;

        const key = (e.key || "").toLowerCase();
        const isPrintScreen = e.key === "PrintScreen" || e.keyCode === 44;
        const isMacScreenshot = e.metaKey && e.shiftKey && (key === "3" || key === "4" || key === "5" || key === "s");
        const isWinSnipTool = (e.metaKey || e.ctrlKey) && e.shiftKey && key === "s";
        const isSavePage = (e.ctrlKey || e.metaKey) && key === "s";
        const isViewSource = (e.ctrlKey || e.metaKey) && key === "u";

        if (isPrintScreen || isMacScreenshot || isWinSnipTool) {
            e.preventDefault();
            clearClipboardOnCaptureAttempt();
            activateDRMBlackoutCurtain(
                "Se ha detectado un atajo de captura o grabación de pantalla sobre el Aula Virtual protegida.",
                { trigger: "keyboard_screenshot_shortcut", key: e.key }
            );
            return;
        }

        if (isSavePage || isViewSource) {
            e.preventDefault();
        }
    };

    boundKeyUpHandler = (e) => {
        if (!isClassroomViewCurrentlyVisible()) return;
        if (e.key === "PrintScreen" || e.keyCode === 44) {
            clearClipboardOnCaptureAttempt();
            activateDRMBlackoutCurtain(
                "Tecla de captura de pantalla (PrintScreen) detectada durante la reproducción.",
                { trigger: "keyup_printscreen" }
            );
        }
    };

    // 2. Pausa preventiva cuando la pestaña se oculta o se minimiza durante reproducción activa
    boundVisibilityHandler = () => {
        if (!isClassroomViewCurrentlyVisible()) return;
        const videoEl = document.getElementById(classroomDRMState.domIds.videoId);
        if (document.hidden && videoEl && !videoEl.paused) {
            videoEl.pause();
        }
    };

    // 3. Opcional: Bloqueo por pérdida de foco si el modo estricto está habilitado
    boundWindowBlurHandler = () => {
        if (!isClassroomViewCurrentlyVisible()) return;
        if (classroomDRMState.strictBlurLockEnabled) {
            const videoEl = document.getElementById(classroomDRMState.domIds.videoId);
            if (videoEl && !videoEl.paused) {
                activateDRMBlackoutCurtain(
                    "Modo Estricto DRM: La ventana perdió el foco activo durante la transmisión clínica.",
                    { trigger: "window_blur_strict" }
                );
            }
        }
    };

    // 4. Impedir copiado de metadatos internos dentro del visor del reproductor
    boundCopyCutHandler = (e) => {
        const target = e.target;
        if (viewport && viewport.contains(target)) {
            e.preventDefault();
        }
    };

    window.addEventListener("keydown", boundKeyDownHandler, true);
    window.addEventListener("keyup", boundKeyUpHandler, true);
    document.addEventListener("visibilitychange", boundVisibilityHandler);
    window.addEventListener("blur", boundWindowBlurHandler);
    document.addEventListener("copy", boundCopyCutHandler);
}

/**
 * Limpia los escuchadores globales para evitar fugas de memoria.
 */
function unbindDRMSecurityEventListeners() {
    if (boundKeyDownHandler) window.removeEventListener("keydown", boundKeyDownHandler, true);
    if (boundKeyUpHandler) window.removeEventListener("keyup", boundKeyUpHandler, true);
    if (boundVisibilityHandler) document.removeEventListener("visibilitychange", boundVisibilityHandler);
    if (boundWindowBlurHandler) window.removeEventListener("blur", boundWindowBlurHandler);
    if (boundCopyCutHandler) document.removeEventListener("copy", boundCopyCutHandler);
}

// ============================================================================
// 7. AUDITORÍA EN CLOUD FIRESTORE Y MODAL DE DIAGNÓSTICO DRM
// ============================================================================

/**
 * Registra en Cloud Firestore (`auditoria_drm_aulas`) cualquier intento de captura
 * o manipulación del DOM para trazabilidad académica.
 * @param {string} reason
 * @param {Object} [extraData]
 */
export async function logDRMSecurityIncident(reason, extraData = {}) {
    const identity = resolveStudentForensicIdentity();
    const incidentRecord = {
        classId: classroomDRMState.activeClassMeta?.id || "aula_general",
        classTitle: classroomDRMState.activeClassMeta?.titulo || "Sesión Clínica",
        userEmail: identity.email,
        userUid: identity.uid,
        subscriptionTier: identity.subscriptionTier,
        sessionLicenseToken: classroomDRMState.sessionLicenseToken,
        reason,
        violationNumber: classroomDRMState.violationCount,
        metadata: extraData,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        createdAt: new Date().toISOString()
    };

    classroomDRMState.violationHistory.unshift(incidentRecord);

    if (!db) return incidentRecord;

    try {
        await addDoc(collection(db, SAFE_COLLECTIONS.DRM_AUDIT_LOGS), incidentRecord);
    } catch (e) {
        // Conservado en el registro de memoria de la sesión si opera en modo offline
    }

    return incidentRecord;
}

/**
 * Enlaza la píldora `#classroom-drm-status-pill` de la cabecera del Aula Virtual
 * para abrir el modal de diagnóstico y configuración DRM al hacer clic.
 */
function bindDRMStatusPillUI() {
    const pill = document.getElementById(classroomDRMState.domIds.statusPillId);
    if (!pill) return;

    pill.classList.add("cursor-pointer", "hover:bg-secondary/25", "transition-all");
    pill.title = "Haz clic para inspeccionar el certificado de licencia DRM y estado anti-grabación";

    if (!pill.dataset.drmModalBound) {
        pill.dataset.drmModalBound = "true";
        pill.addEventListener("click", () => {
            openDRMStatusDiagnosticsModal();
        });
    }

    const resumeBtn = document.getElementById("btn-resume-drm-curtain");
    resumeBtn?.addEventListener("click", () => {
        resumeFromDRMBlackout();
    });
}

/**
 * Actualiza el diseño e indicador de la insignia `#classroom-drm-status-pill`.
 * @param {"secure"|"alert"} status
 */
function updateDRMStatusPillBadge(status = "secure") {
    const pill = document.getElementById(classroomDRMState.domIds.statusPillId);
    if (!pill) return;

    if (status === "alert") {
        pill.className = "px-2.5 py-0.5 rounded-full bg-danger/20 border border-danger text-danger text-[10px] font-mono font-extrabold uppercase flex items-center gap-1 cursor-pointer animate-pulse";
        pill.innerHTML = `
            <span class="material-symbols-outlined text-xs">gpp_bad</span>
            <span>Alerta DRM (${classroomDRMState.violationCount})</span>
        `;
    } else {
        pill.className = "px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/40 text-secondary text-[10px] font-mono font-extrabold uppercase flex items-center gap-1 cursor-pointer hover:bg-secondary/25 transition-all";
        pill.innerHTML = `
            <span class="material-symbols-outlined text-xs">verified_user</span>
            <span>Escudo DRM Activo</span>
        `;
    }
}

/**
 * Abre un modal con el estado técnico del escudo DRM, compatibilidad EME/Widevine,
 * licencia forense del alumno y controles de bloqueo estricto.
 */
export function openDRMStatusDiagnosticsModal() {
    let modal = document.getElementById("classroom-drm-diagnostics-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "classroom-drm-diagnostics-modal";
        modal.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    const identity = resolveStudentForensicIdentity();
    const isAdmin = isCurrentMasterAdmin();
    const eme = classroomDRMState.emeCapabilities;

    modal.innerHTML = `
        <div class="bg-surface-container border border-primary/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary text-xl">verified_user</span>
                    <div>
                        <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                            Seguridad Audiovisual • MakaiAcademy DRM
                        </span>
                        <h3 class="text-sm font-extrabold text-white">
                            Certificado de Licencia Forense y Protección EME
                        </h3>
                    </div>
                </div>
                <button
                    type="button"
                    id="btn-close-drm-diagnostics"
                    class="text-gray-400 hover:text-white text-sm font-bold px-2 py-1"
                >
                    ✕
                </button>
            </div>

            <div class="p-4 space-y-4 text-xs">
                <!-- Estado de Licencia del Estudiante -->
                <div class="p-3 rounded-xl bg-surface border border-surface-high space-y-1.5 font-mono text-[11px]">
                    <div class="flex justify-between">
                        <span class="text-gray-400">Titular de Licencia:</span>
                        <span class="text-white font-bold">${escapeHtml(identity.email)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Token Forense de Sesión:</span>
                        <span class="text-primary font-bold">${escapeHtml(classroomDRMState.sessionLicenseToken)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Nivel de Motor DRM:</span>
                        <span class="text-secondary font-bold">${escapeHtml(eme.securityLevel)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">CDM Google Widevine:</span>
                        <span class="${eme.widevineSupported ? "text-secondary" : "text-warning"} font-bold">
                            ${eme.widevineSupported ? "✓ Activo por Hardware/Navegador" : "Respaldo HTML5 + Marca Forense"}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Incidentes en esta sesión:</span>
                        <span class="${classroomDRMState.violationCount > 0 ? "text-danger" : "text-secondary"} font-bold">
                            ${classroomDRMState.violationCount} alertas registradas
                        </span>
                    </div>
                </div>

                <!-- Control de Modo Estricto Anti-Pérdida de Foco -->
                <div class="p-3 rounded-xl bg-surface border border-surface-high flex items-center justify-between gap-3">
                    <div>
                        <div class="font-extrabold text-white">Bloqueo Estricto al Perder Foco de Ventana</div>
                        <p class="text-[11px] text-gray-400">
                            Activa la cortina negra automáticamente si se cambia a otra aplicación o capturadora externa.
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        id="toggle-drm-strict-blur"
                        class="w-4 h-4 accent-[#00e5ff] rounded cursor-pointer shrink-0"
                        ${classroomDRMState.strictBlurLockEnabled ? "checked" : ""}
                    >
                </div>

                ${isAdmin ? `
                    <div class="p-3 rounded-xl bg-primary/10 border border-primary/30 space-y-2">
                        <div class="text-[10px] font-mono uppercase text-primary font-extrabold">
                            Herramientas de Prueba • Administrador Maestro
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                id="btn-test-drm-curtain"
                                class="px-3 py-1.5 rounded-lg bg-danger/20 border border-danger/40 text-danger font-extrabold text-[11px] hover:bg-danger hover:text-white transition-all"
                            >
                                Simular Intento de Captura
                            </button>
                            <button
                                type="button"
                                id="btn-rotate-drm-watermark-now"
                                class="px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary font-extrabold text-[11px] hover:bg-primary hover:text-surface transition-all"
                            >
                                Rotar Marca Forense Ahora
                            </button>
                        </div>
                    </div>
                ` : ""}
            </div>

            <div class="p-3 bg-surface border-t border-surface-high flex justify-end">
                <button
                    type="button"
                    id="btn-ok-drm-diagnostics"
                    class="px-4 py-2 rounded-xl bg-primary text-surface font-extrabold text-xs"
                >
                    Entendido
                </button>
            </div>
        </div>
    `;

    const closeModal = () => modal.remove();
    document.getElementById("btn-close-drm-diagnostics")?.addEventListener("click", closeModal);
    document.getElementById("btn-ok-drm-diagnostics")?.addEventListener("click", closeModal);

    document.getElementById("toggle-drm-strict-blur")?.addEventListener("change", (e) => {
        classroomDRMState.strictBlurLockEnabled = Boolean(e.target.checked);
    });

    document.getElementById("btn-test-drm-curtain")?.addEventListener("click", () => {
        closeModal();
        activateDRMBlackoutCurtain(
            "Simulación de prueba ejecutada por el Administrador Maestro para verificar la cortina anti-grabación.",
            { trigger: "admin_diagnostic_test" }
        );
    });

    document.getElementById("btn-rotate-drm-watermark-now")?.addEventListener("click", () => {
        classroomDRMState.floatPositionIndex =
            (classroomDRMState.floatPositionIndex + 1) % WATERMARK_FLOAT_POSITIONS.length;
        updateDRMWatermark();
    });
}

// ============================================================================
// 8. DESTRUCTOR Y UTILIDADES INTERNAS DEL SUBCOMPONENTE
// ============================================================================

/**
 * Desactiva intervalos, observadores DOM y escuchadores cuando se desmonta el módulo.
 */
export function destroyClassroomDRM() {
    if (classroomDRMState.watermarkIntervalId) {
        clearInterval(classroomDRMState.watermarkIntervalId);
        classroomDRMState.watermarkIntervalId = null;
    }
    if (classroomDRMState.videoMutationObserver) {
        classroomDRMState.videoMutationObserver.disconnect();
        classroomDRMState.videoMutationObserver = null;
    }
    if (classroomDRMState.watermarkTamperObserver) {
        classroomDRMState.watermarkTamperObserver.disconnect();
        classroomDRMState.watermarkTamperObserver = null;
    }
    unbindDRMSecurityEventListeners();
    classroomDRMState.initialized = false;
}

/**
 * Verifica que `#classroom-drm-watermark-layer` y `#classroom-drm-blackout-curtain`
 * existan dentro de `#classroom-player-viewport`, regenerándolos si fueron eliminados.
 */
function ensureDRMContainersReady() {
    const viewport = document.getElementById(classroomDRMState.domIds.viewportId);
    if (!viewport) return;

    let watermarkLayer = document.getElementById(classroomDRMState.domIds.watermarkId);
    if (!watermarkLayer) {
        watermarkLayer = document.createElement("div");
        watermarkLayer.id = classroomDRMState.domIds.watermarkId;
        watermarkLayer.className = "pointer-events-none absolute inset-0 z-20 overflow-hidden";
        viewport.appendChild(watermarkLayer);
    }

    let curtainLayer = document.getElementById(classroomDRMState.domIds.curtainId);
    if (!curtainLayer) {
        curtainLayer = document.createElement("div");
        curtainLayer.id = classroomDRMState.domIds.curtainId;
        curtainLayer.className = "hidden absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center";
        viewport.appendChild(curtainLayer);
    }
}

/**
 * Intenta sobrescribir el portapapeles del sistema cuando el usuario presiona `PrintScreen`.
 */
function clearClipboardOnCaptureAttempt() {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(
            "Contenido protegido por MakaiAcademy DRM. Captura de pantalla deshabilitada."
        ).catch(() => {});
    }
}

/**
 * Comprueba si la vista `#view-classrooms` se encuentra actualmente activa en el DOM.
 * @returns {boolean}
 */
function isClassroomViewCurrentlyVisible() {
    const view = document.getElementById("view-classrooms");
    if (!view) return false;
    return !view.classList.contains("hidden");
}

/**
 * Obtiene los datos forenses del usuario autenticado para la marca de agua y registros.
 * @returns {Object}
 */
function resolveStudentForensicIdentity() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "licencia@makai.ec";
    const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid || "MAKAI-USER";
    const uidShort = String(uid).slice(0, 8).toUpperCase();
    const subscriptionTier = appState?.currentUserData?.subscriptionLevel || "Básico";

    return {
        email,
        uid,
        uidShort,
        subscriptionTier
    };
}

/**
 * Genera un código alfanumérico único de licencia forense por sesión.
 * @returns {string}
 */
function generateForensicSessionToken() {
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timePart = Date.now().toString(36).slice(-4).toUpperCase();
    return `MK-${timePart}-${randomPart}`;
}

/**
 * Comprueba si el usuario actual es Administrador Maestro.
 * @returns {boolean}
 */
function isCurrentMasterAdmin() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(email) || appState?.currentUserData?.rol === "admin";
}

/**
 * Escapa caracteres HTML para evitar inyecciones XSS en la marca de agua y modales.
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
