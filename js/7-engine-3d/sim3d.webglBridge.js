// ============================================================================
// ARCHIVO: js/7-engine-3d/sim3d.webglBridge.js
// DESCRIPCIÓN: Puente Bidireccional JavaScript <-> Unity WebGL, Gestor de Carga
//              de Paquetes (.loader.js, .data, .framework.js, .wasm), Cola de
//              Comandos C#, Reproductor de Cinemáticas Clínicas 3D y Emulador
//              de Telemetría Fisiológica para el Visor Táctico en Canvas.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { appState, isMasterAdmin } from "../2-core/state.store.js";

// ============================================================================
// 1. CONSTANTES DE BÓVEDA MULTIMEDIA 3D Y CONFIGURACIÓN DEL PUENTE
// ============================================================================

export const DEFAULT_ASSETS_3D_PATHS = Object.freeze({
    BUILDS_WEBGL: "assets/7-multimedia-3d/builds-webgl/",
    HUD_ICONS: "assets/7-multimedia-3d/hud-iconos/",
    CINEMATICS: "assets/7-multimedia-3d/videos-cinematicas/"
});

export const UNITY_GAME_OBJECTS = Object.freeze({
    PATIENT: "MakaiPatientController",
    CAMERA: "MakaiCameraRig",
    MONITOR: "MakaiMonitorController",
    SQUAD: "MakaiSquadManager"
});

// Diccionario de respuestas fisiológicas y animaciones para el Emulador del Puente
const CLINICAL_COMMAND_RESPONSES = Object.freeze({
    Airway_Suction: {
        message: "Vía aérea superior aspirada. Visualización glótica Cormack-Lehane I despejada.",
        cameraFocus: "cuello_via_aerea",
        vitalsPatch: { spo2: +3 }
    },
    Airway_Preoxygenate: {
        message: "Mascarilla con reservorio a 15 L/min acoplada (FiO2 100%). Desnitrogenación alveolar en curso.",
        cameraFocus: "cuello_via_aerea",
        vitalsPatch: { spo2: +6 }
    },
    Airway_Intubate: {
        message: "Tubo endotraqueal 7.5 mm colocado a 22 cm de la comisura labial. Curva capnográfica cuadrada (EtCO2 38 mmHg).",
        cameraFocus: "cuello_via_aerea",
        vitalsPatch: { spo2: 98, etco2: 38, rr: 16 }
    },
    Vascular_Peripheral16G: {
        message: "Doble vía periférica antecubital 16G permeable y fijada.",
        cameraFocus: "extremidades"
    },
    Vascular_CrystalloidBolus: {
        message: "Infusión rápida de 500 ml de Lactato de Ringer en curso por vía 16G.",
        cameraFocus: "extremidades"
    },
    Vascular_CentralLine: {
        message: "Catéter Venoso Central yugular interno derecho de 3 lúmenes colocado bajo guía ecográfica.",
        cameraFocus: "cuello_via_aerea"
    },
    Drug_Amiodarone: {
        message: "Bolo IV de Amiodarona administrado. Monitoreando intervalo QT y frecuencia ventricular.",
        cameraFocus: "torax"
    },
    Drug_Norepinephrine: {
        message: "Bomba de infusión continua de Noradrenalina activa a 0.12 mcg/kg/min por lumen distal.",
        cameraFocus: "torax"
    },
    Drug_Epinephrine: {
        message: "Adrenalina 1 mg IV administrada seguida de lavado con 20 ml de SSN 0.9%.",
        cameraFocus: "torax"
    },
    Drug_TranexamicAcid: {
        message: "Ácido Tranexámico 1 g IV infundiéndose en 10 minutos (Protocolo CRASH-2).",
        cameraFocus: "abdomen_pelvis"
    },
    CPR_StartChestCompressions: {
        message: "Ciclo de compresiones torácicas de alta calidad activo (110 cpm, profundidad 5.5 cm, EtCO2 > 18 mmHg).",
        cameraFocus: "torax",
        triggerCprWave: true
    },
    Defib_SynchronizedCardioversion: {
        message: "Descarga bifásica sincronizada con complejo QRS entregada. Reevaluando ritmo y pulso carotídeo.",
        cameraFocus: "torax",
        triggerShockFlash: true
    },
    Defib_Shock200J: {
        message: "Descarga bifásica no sincronizada de 200 J entregada. Reiniciando compresiones inmediatamente.",
        cameraFocus: "torax",
        triggerShockFlash: true
    }
});

// Estado reactivo interno del puente WebGL
export const webglBridgeRuntime = {
    initialized: false,
    stateRef: null,
    assetsPath: { ...DEFAULT_ASSETS_3D_PATHS },
    onTelemetryEvent: null,
    activeBuildSlug: null,
    isLoadingBuild: false,
    loadProgress: 0,
    mode: "tactical_canvas", // "tactical_canvas" | "unity_webgl"
    commandQueue: [],
    commandHistory: [],
    loadedScriptUrls: new Set(),
    fpsMonitor: {
        fps: 60,
        frames: 0,
        lastSampleTime: performance.now(),
        rafId: null
    }
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL PUENTE WEBGL (initWebGLBridge3D)
// ============================================================================

/**
 * Inicializa el subcomponente `sim3d.webglBridge.js` invocado por `engine3d.controller.js`.
 * @param {Object} config
 * @param {Object} config.state - Referencia a `engine3DState`
 * @param {Object} config.assetsPath - Rutas hacia `assets/7-multimedia-3d/`
 * @param {Function} config.onTelemetryEvent - Callback `handleUnityTelemetryEvent3D`
 */
export function initWebGLBridge3D(config = {}) {
    webglBridgeRuntime.stateRef = config.state || webglBridgeRuntime.stateRef;
    if (config.assetsPath) {
        webglBridgeRuntime.assetsPath = {
            ...DEFAULT_ASSETS_3D_PATHS,
            ...config.assetsPath
        };
    }
    if (typeof config.onTelemetryEvent === "function") {
        webglBridgeRuntime.onTelemetryEvent = config.onTelemetryEvent;
    }

    registerGlobalBridgeCallbacks();
    injectBridgeViewportOverlays();
    bindWebGLContextRecoveryEvents();
    startBridgeFpsTelemetryMonitor();

    webglBridgeRuntime.initialized = true;
}

/**
 * Expone la API global `window.MakaiWebGLBridge` y `window.onUnitySim3DEvent`
 * para que los plugins `.jslib` compilados dentro de Unity C# se comuniquen con JS.
 */
function registerGlobalBridgeCallbacks() {
    window.onUnitySim3DEvent = (rawPayload) => {
        dispatchUnityTelemetryToJS(rawPayload);
    };

    window.MakaiWebGLBridge = {
        emitTelemetry: (rawPayload) => dispatchUnityTelemetryToJS(rawPayload),
        sendToUnity: (gameObject, methodName, payload) => sendToUnity(gameObject, methodName, payload),
        notifySceneReady: (sceneName = "UCI_Trauma_Scene") => {
            flushQueuedUnityCommands();
            dispatchUnityTelemetryToJS({
                message: `Escena Unity 3D '${sceneName}' sincronizada con MakaiAcademy.`
            });
        },
        playCinematic: (slug, opts) => playClinicalCinematic3D(slug, opts),
        unloadBuild: () => unloadActiveUnityBuild(),
        getStatus: () => ({
            mode: webglBridgeRuntime.mode,
            activeBuildSlug: webglBridgeRuntime.activeBuildSlug,
            fps: webglBridgeRuntime.fpsMonitor.fps,
            queuedCommands: webglBridgeRuntime.commandQueue.length,
            totalCommandsSent: webglBridgeRuntime.commandHistory.length
        })
    };
}

// ============================================================================
// 3. CARGA DINÁMICA DE PAQUETES UNITY WEBGL (loadUnityBuild)
// ============================================================================

/**
 * Carga y monta un paquete compilado de Unity WebGL desde `assets/7-multimedia-3d/builds-webgl/`.
 * Si los binarios `.loader.js` / `.wasm` aún no existen en el repositorio, mantiene
 * activo el Visor 3D Táctico en Canvas sin arrojar errores 404.
 * @param {Object} scenario - Escenario 3D activo (`activeScenario`)
 * @param {Object} state - Referencia a `engine3DState`
 */
export async function loadUnityBuild(scenario = null, state = webglBridgeRuntime.stateRef) {
    if (state) webglBridgeRuntime.stateRef = state;
    const activeScenario = scenario || webglBridgeRuntime.stateRef?.activeScenario;
    const buildSlug = sanitizeBuildSlug(activeScenario?.webglBuildName || "uci_trauma_3d");
    const basePath = webglBridgeRuntime.assetsPath.BUILDS_WEBGL || DEFAULT_ASSETS_3D_PATHS.BUILDS_WEBGL;

    const statusBadge = document.getElementById("engine3d-bridge-status");
    const unityMount = document.getElementById("engine3d-unity-mount");
    const loadBtn = document.getElementById("btn-engine3d-load-webgl");

    if (webglBridgeRuntime.isLoadingBuild) return;

    // Si ya está cargado exactamente el mismo paquete WebGL, sincronizar el escenario
    if (
        webglBridgeRuntime.stateRef?.isWebGLNativeLoaded &&
        webglBridgeRuntime.stateRef?.unityInstance &&
        webglBridgeRuntime.activeBuildSlug === buildSlug
    ) {
        sendToUnity(UNITY_GAME_OBJECTS.PATIENT, "LoadClinicalScenario", {
            scenarioId: activeScenario?.id || "default",
            vitals: webglBridgeRuntime.stateRef?.vitals || {}
        });
        return;
    }

    webglBridgeRuntime.isLoadingBuild = true;
    webglBridgeRuntime.loadProgress = 0;
    updateBridgeStatusBadge(`Verificando paquete WebGL (${buildSlug})...`, "loading");

    const loaderUrl = `${basePath}${buildSlug}.loader.js`;

    try {
        const loaderAvailable = await checkAssetExists(loaderUrl);
        if (!loaderAvailable) {
            activateTacticalCanvasFallback(
                buildSlug,
                `Visor 3D Táctico Activo • Puente JS Listo (${buildSlug})`
            );
            return;
        }

        // Si había una instancia previa de otro escenario, desmontarla primero
        if (webglBridgeRuntime.stateRef?.unityInstance) {
            await unloadActiveUnityBuild();
        }

        showUnityLoadingOverlay(buildSlug, 10, "Cargando script .loader.js...");
        await injectUnityLoaderScript(loaderUrl);

        if (typeof window.createUnityInstance !== "function") {
            activateTacticalCanvasFallback(
                buildSlug,
                "Visor 3D Táctico Activo (createUnityInstance no expuesto)"
            );
            return;
        }

        // Detectar si los archivos .data, .framework.js y .wasm están sin comprimir o en .gz / .br
        const resolvedFiles = await resolveUnityBuildFileUrls(basePath, buildSlug);

        if (unityMount) {
            unityMount.classList.remove("hidden");
            unityMount.innerHTML = `
                <canvas id="engine3d-unity-native-canvas" class="w-full h-full block bg-[#04070b]" tabindex="-1"></canvas>
            `;
        }

        const unityCanvas = document.getElementById("engine3d-unity-native-canvas");
        const unityConfig = {
            dataUrl: resolvedFiles.dataUrl,
            frameworkUrl: resolvedFiles.frameworkUrl,
            codeUrl: resolvedFiles.codeUrl,
            streamingAssetsUrl: "StreamingAssets",
            companyName: "MakaiAcademy",
            productName: "ALICIZATION_3D_UCI",
            productVersion: "4.4"
        };

        const unityInstance = await window.createUnityInstance(
            unityCanvas,
            unityConfig,
            (progress) => {
                const pct = Math.min(100, Math.round((progress || 0) * 100));
                webglBridgeRuntime.loadProgress = pct;
                showUnityLoadingOverlay(buildSlug, pct, `Descomprimiendo WebAssembly (.wasm): ${pct}%`);
            }
        );

        hideUnityLoadingOverlay();

        if (webglBridgeRuntime.stateRef) {
            webglBridgeRuntime.stateRef.unityInstance = unityInstance;
            webglBridgeRuntime.stateRef.isWebGLNativeLoaded = true;
        }

        webglBridgeRuntime.activeBuildSlug = buildSlug;
        webglBridgeRuntime.mode = "unity_webgl";
        webglBridgeRuntime.isLoadingBuild = false;

        updateBridgeStatusBadge(`Unity WebGL Conectado (${buildSlug}) • ${webglBridgeRuntime.fpsMonitor.fps} FPS`, "connected");

        if (loadBtn) {
            loadBtn.innerHTML = `
                <span class="material-symbols-outlined text-sm">check_circle</span>
                <span>WebGL Nativo Activo</span>
            `;
        }

        // Enviar estado inicial del escenario y vaciar cola de comandos pendientes
        sendToUnity(UNITY_GAME_OBJECTS.PATIENT, "LoadClinicalScenario", {
            scenarioId: activeScenario?.id || "default",
            vitals: webglBridgeRuntime.stateRef?.vitals || {}
        });
        flushQueuedUnityCommands();

        dispatchUnityTelemetryToJS({
            message: `Paquete Unity WebGL '${buildSlug}' acoplado con éxito en #engine3d-unity-mount.`
        });
    } catch (error) {
        console.warn("Conmutando al Visor 3D Táctico Integrado:", error);
        activateTacticalCanvasFallback(
            buildSlug,
            "Visor 3D Táctico Nativo + Emulador C# Activo"
        );
    } finally {
        webglBridgeRuntime.isLoadingBuild = false;
        hideUnityLoadingOverlay();
    }
}

/**
 * Desmonta de forma limpia la instancia activa de Unity WebGL y restaura el Visor 3D Táctico en Canvas.
 */
export async function unloadActiveUnityBuild() {
    const state = webglBridgeRuntime.stateRef;
    const instance = state?.unityInstance;

    if (instance && typeof instance.Quit === "function") {
        try {
            await instance.Quit();
        } catch (e) {
            // Silencioso si el contexto ya fue liberado
        }
    }

    if (state) {
        state.unityInstance = null;
        state.isWebGLNativeLoaded = false;
    }

    const unityMount = document.getElementById("engine3d-unity-mount");
    if (unityMount) {
        unityMount.innerHTML = "";
        unityMount.classList.add("hidden");
    }

    webglBridgeRuntime.activeBuildSlug = null;
    webglBridgeRuntime.mode = "tactical_canvas";
    updateBridgeStatusBadge("Visor 3D Táctico + Puente WebGL Listo", "tactical");
}

// ============================================================================
// 4. ENVÍO Y RECEPCIÓN DE COMANDOS JS <-> UNITY C# (sendToUnity)
// ============================================================================

/**
 * Envía un comando desde JavaScript hacia un GameObject en Unity WebGL (`SendMessage`).
 * Si el motor está operando en modo Visor 3D Táctico (sin binario `.wasm` externo),
 * ejecuta el emulador fisiológico C# integrado para mantener respuesta clínica total.
 * @param {string} gameObjectName - Nombre del GameObject en la escena (ej. `MakaiPatientController`)
 * @param {string} methodName - Nombre del método C# (ej. `ExecuteClinicalAction`, `FocusCameraOnRegion`)
 * @param {Object|string} payload - Datos JSON o cadena serializada
 */
export function sendToUnity(
    gameObjectName = UNITY_GAME_OBJECTS.PATIENT,
    methodName = "ExecuteClinicalAction",
    payload = {}
) {
    const targetObject = gameObjectName || UNITY_GAME_OBJECTS.PATIENT;
    const serializedPayload = typeof payload === "string" ? payload : JSON.stringify(payload || {});
    let parsedPayload = {};

    try {
        parsedPayload = typeof payload === "string" ? JSON.parse(payload) : (payload || {});
    } catch (e) {
        parsedPayload = { raw: payload };
    }

    const commandEntry = {
        timestamp: new Date().toISOString(),
        gameObject: targetObject,
        method: methodName,
        payload: parsedPayload
    };

    webglBridgeRuntime.commandHistory.unshift(commandEntry);
    if (webglBridgeRuntime.commandHistory.length > 40) {
        webglBridgeRuntime.commandHistory.pop();
    }

    updateBridgeDiagnosticTelemetryBar(commandEntry);

    // 1. Si se está descargando un build de Unity en este instante, guardar en cola
    if (webglBridgeRuntime.isLoadingBuild) {
        webglBridgeRuntime.commandQueue.push({
            gameObject: targetObject,
            method: methodName,
            serialized: serializedPayload
        });
        return;
    }

    // 2. Si existe una instancia nativa de Unity WebGL cargada, invocar SendMessage
    const unityInstance = webglBridgeRuntime.stateRef?.unityInstance;
    if (webglBridgeRuntime.stateRef?.isWebGLNativeLoaded && unityInstance && typeof unityInstance.SendMessage === "function") {
        try {
            unityInstance.SendMessage(targetObject, methodName, serializedPayload);
            return;
        } catch (err) {
            console.warn(`Aviso SendMessage (${targetObject}.${methodName}):`, err);
        }
    }

    // 3. Emulador del Puente C# cuando opera sobre el Visor 3D Táctico Nativo en Canvas
    emulateUnityCSharpExecution(targetObject, methodName, parsedPayload);
}

/**
 * Vacía y envía en orden cronológico todos los comandos acumulados mientras cargaba el paquete `.wasm`.
 */
function flushQueuedUnityCommands() {
    const unityInstance = webglBridgeRuntime.stateRef?.unityInstance;
    if (!unityInstance || typeof unityInstance.SendMessage !== "function") {
        webglBridgeRuntime.commandQueue = [];
        return;
    }

    while (webglBridgeRuntime.commandQueue.length > 0) {
        const cmd = webglBridgeRuntime.commandQueue.shift();
        try {
            unityInstance.SendMessage(cmd.gameObject, cmd.method, cmd.serialized);
        } catch (e) {
            // Continuar con el siguiente comando de la cola
        }
    }
}

/**
 * Emula la respuesta del controlador C# `MakaiPatientController` cuando el usuario
 * interactúa con el Visor 3D Táctico Nativo (sin requerir el archivo `.wasm` pesado).
 * @param {string} gameObject
 * @param {string} methodName
 * @param {Object} parsedPayload
 */
function emulateUnityCSharpExecution(gameObject, methodName, parsedPayload = {}) {
    const state = webglBridgeRuntime.stateRef;

    if (methodName === "ExecuteClinicalAction") {
        const unityCmd = parsedPayload.unityCommand;
        const spec = CLINICAL_COMMAND_RESPONSES[unityCmd];

        if (spec) {
            if (spec.triggerCprWave && state) {
                state.cprCompressionPhase = Math.max(state.cprCompressionPhase || 0, 22);
            }
            if (spec.triggerShockFlash) {
                triggerDefibrillationViewportFlash();
            }
            if (spec.cameraFocus && state) {
                state.activeBodyRegion = spec.cameraFocus;
            }

            dispatchUnityTelemetryToJS({
                unityCommand: unityCmd,
                message: spec.message
            });
        }
        return;
    }

    if (methodName === "FocusCameraOnRegion" && parsedPayload.regionId) {
        pulseViewportFocusReticle();
        return;
    }

    if (methodName === "SyncMultiplayerSquad" && Array.isArray(parsedPayload.squadMembers)) {
        if (state && state.multiplayer) {
            state.multiplayer.squadMembers = parsedPayload.squadMembers;
        }
    }
}

/**
 * Entrega telemetría entrante desde Unity WebGL (o desde el emulador C#) hacia `engine3d.controller.js`.
 * @param {Object|string} rawEventData
 */
export function dispatchUnityTelemetryToJS(rawEventData) {
    if (!rawEventData) return;

    let parsed = rawEventData;
    if (typeof rawEventData === "string") {
        try {
            parsed = JSON.parse(rawEventData);
        } catch (e) {
            parsed = { message: rawEventData };
        }
    }

    if (typeof webglBridgeRuntime.onTelemetryEvent === "function") {
        webglBridgeRuntime.onTelemetryEvent(parsed);
    }

    window.dispatchEvent(
        new CustomEvent("makai:sim3dTelemetry", {
            detail: parsed
        })
    );
}

// ============================================================================
// 5. REPRODUCTOR DE CINEMÁTICAS CLÍNICAS 3D (assets/7-multimedia-3d/videos-cinematicas/)
// ============================================================================

/**
 * Reproduce un video de introducción de urgencias o cinemática de procedimiento invasivo
 * desde `assets/7-multimedia-3d/videos-cinematicas/` dentro del visor `#engine3d-viewport-wrapper`.
 * Si el archivo `.mp4` aún no se ha subido al repositorio, despliega una secuencia
 * holográfica de briefing táctico para no interrumpir la experiencia ni causar error 404.
 * @param {string} cinematicSlug - Nombre del archivo o identificador del escenario
 * @param {Object} options - `{ title, subtitle, durationMs }`
 */
export async function playClinicalCinematic3D(cinematicSlug = "", options = {}) {
    const viewport = document.getElementById("engine3d-viewport-wrapper");
    if (!viewport) return;

    const state = webglBridgeRuntime.stateRef;
    const scenario = state?.activeScenario;
    const rawSlug = cinematicSlug || scenario?.cinematicSlug || scenario?.webglBuildName || "uci_trauma_intro";
    const cleanSlug = sanitizeBuildSlug(rawSlug);
    const cinematicsDir = webglBridgeRuntime.assetsPath.CINEMATICS || DEFAULT_ASSETS_3D_PATHS.CINEMATICS;
    const videoUrl = cleanSlug.endsWith(".mp4") || cleanSlug.endsWith(".webm")
        ? `${cinematicsDir}${cleanSlug}`
        : `${cinematicsDir}${cleanSlug}.mp4`;

    let overlay = document.getElementById("engine3d-cinematic-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "engine3d-cinematic-overlay";
        viewport.appendChild(overlay);
    }

    const titleText = options.title || scenario?.titulo || "Cinemática de Ingreso a Trauma Shock 3D";
    const vignetteText = options.subtitle || scenario?.enunciadoInicial || "Preparando monitorización hemodinámica y equipo de alto rendimiento.";

    const videoExists = await checkAssetExists(videoUrl);

    overlay.className = "absolute inset-0 z-40 bg-[#04070b]/95 backdrop-blur-md flex flex-col justify-between p-5 transition-opacity duration-300";

    if (videoExists) {
        overlay.innerHTML = `
            <div class="flex items-center justify-between z-10">
                <span class="px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-mono font-extrabold text-primary uppercase">
                    Cinemática Clínica 3D • En Reproducción
                </span>
                <button
                    type="button"
                    id="btn-engine3d-skip-cinematic"
                    class="px-3 py-1 rounded-lg bg-surface hover:bg-danger text-white text-xs font-mono font-bold border border-surface-high transition-all"
                >
                    Omitir Intro ⏭
                </button>
            </div>
            <video
                id="engine3d-cinematic-video"
                src="${videoUrl}"
                class="w-full h-[360px] object-cover rounded-xl border border-primary/30 my-auto"
                autoplay
                playsinline
            ></video>
            <div class="text-xs text-gray-300 font-mono truncate">${escapeHtmlBridge(titleText)}</div>
        `;

        const videoEl = overlay.querySelector("#engine3d-cinematic-video");
        const closeCinematic = () => {
            if (videoEl) {
                videoEl.pause();
                videoEl.removeAttribute("src");
            }
            overlay.classList.add("hidden");
        };

        overlay.querySelector("#btn-engine3d-skip-cinematic")?.addEventListener("click", closeCinematic);
        videoEl?.addEventListener("ended", closeCinematic);
        videoEl?.addEventListener("error", closeCinematic);
    } else {
        // Briefing Holográfico Táctico cuando el archivo .mp4 aún está como semilla en GitHub
        overlay.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-mono font-extrabold text-primary uppercase flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                    <span>Briefing Holográfico de Ingreso UCI 3D</span>
                </span>
                <button
                    type="button"
                    id="btn-engine3d-skip-cinematic"
                    class="px-3 py-1 rounded-lg bg-surface hover:bg-primary hover:text-surface text-gray-200 text-xs font-mono font-bold border border-surface-high transition-all"
                >
                    Entrar al Box 3D ⏭
                </button>
            </div>

            <div class="my-auto max-w-lg mx-auto text-center space-y-3 p-5 rounded-2xl bg-surface/80 border border-primary/30 shadow-[0_0_30px_rgba(0,229,255,0.12)]">
                <span class="material-symbols-outlined text-4xl text-primary">emergency</span>
                <h4 class="text-base font-extrabold text-white">${escapeHtmlBridge(titleText)}</h4>
                <p class="text-xs text-gray-300 leading-relaxed">${escapeHtmlBridge(vignetteText)}</p>
                <div class="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-secondary">
                    <span class="px-2.5 py-1 rounded-lg bg-secondary/10 border border-secondary/30">
                        FC: ${state?.vitals?.hr || 132} lpm
                    </span>
                    <span class="px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/30 text-warning">
                        PA: ${state?.vitals?.bpSys || 82}/${state?.vitals?.bpDia || 46} mmHg
                    </span>
                    <span class="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary">
                        SpO2: ${state?.vitals?.spo2 || 85}%
                    </span>
                </div>
            </div>

            <div class="text-center text-[10px] font-mono text-gray-500">
                Ruta multimedia vinculada: ${escapeHtmlBridge(videoUrl)}
            </div>
        `;

        const closeBriefing = () => overlay.classList.add("hidden");
        overlay.querySelector("#btn-engine3d-skip-cinematic")?.addEventListener("click", closeBriefing);
        setTimeout(closeBriefing, options.durationMs || 4200);
    }
}

/**
 * Sincroniza los avatares del escuadrón cooperativo (`sim3d.multiplayer.js`) con Unity WebGL.
 * @param {Array} squadMembers
 */
export function syncSquadAvatarsToWebGL(squadMembers = []) {
    sendToUnity(UNITY_GAME_OBJECTS.SQUAD, "SyncMultiplayerSquad", {
        squadMembers
    });
}

// ============================================================================
// 6. OVERLAYS DE CARGA, DIAGNÓSTICO DE RENDIMIENTO Y RECUPERACIÓN WEBGL
// ============================================================================

/**
 * Inyecta los controles de Cinemática 3D y la barra inferior de telemetría del puente
 * dentro del visor `#engine3d-viewport-wrapper` sin alterar el diseño de `engine3d.controller.js`.
 */
function injectBridgeViewportOverlays() {
    const viewport = document.getElementById("engine3d-viewport-wrapper");
    if (!viewport) return;

    // 1. Botón de Briefing / Cinemática junto al botón de carga WebGL
    const loadWebglBtn = document.getElementById("btn-engine3d-load-webgl");
    if (loadWebglBtn && loadWebglBtn.parentElement && !document.getElementById("btn-engine3d-play-cinematic")) {
        const cinematicBtn = document.createElement("button");
        cinematicBtn.type = "button";
        cinematicBtn.id = "btn-engine3d-play-cinematic";
        cinematicBtn.className = "px-2.5 py-1.5 rounded-lg bg-surface/90 border border-surface-high text-gray-200 hover:border-secondary hover:text-secondary text-[11px] font-mono font-bold transition-all flex items-center gap-1";
        cinematicBtn.title = "Reproducir Cinemática / Briefing del Caso 3D";
        cinematicBtn.innerHTML = `
            <span class="material-symbols-outlined text-sm">movie</span>
            <span>Intro 3D</span>
        `;
        cinematicBtn.addEventListener("click", () => playClinicalCinematic3D());
        loadWebglBtn.parentElement.insertBefore(cinematicBtn, loadWebglBtn);
    }

    // 2. Contenedor de Progreso de Descarga Unity WebGL (.wasm / .data)
    if (!document.getElementById("engine3d-bridge-loader-modal")) {
        const loaderModal = document.createElement("div");
        loaderModal.id = "engine3d-bridge-loader-modal";
        loaderModal.className = "hidden absolute inset-0 z-30 bg-[#04070b]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center";
        viewport.appendChild(loaderModal);
    }

    // 3. Efecto Flash para Desfibrilación / Cardioversión y Retícula de Enfoque
    if (!document.getElementById("engine3d-bridge-fx-layer")) {
        const fxLayer = document.createElement("div");
        fxLayer.id = "engine3d-bridge-fx-layer";
        fxLayer.className = "pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 opacity-0";
        viewport.appendChild(fxLayer);
    }

    // 4. Indicador compacto de telemetría del puente (FPS y último comando C#)
    if (!document.getElementById("engine3d-bridge-telemetry-pill")) {
        const pill = document.createElement("div");
        pill.id = "engine3d-bridge-telemetry-pill";
        pill.className = "pointer-events-none absolute left-4 bottom-14 z-20 px-2.5 py-1 rounded-lg bg-[#04070b]/80 border border-surface-high text-[10px] font-mono text-gray-400 flex items-center gap-2";
        pill.innerHTML = `
            <span id="engine3d-bridge-fps-label" class="text-secondary font-bold">60 FPS</span>
            <span>•</span>
            <span id="engine3d-bridge-last-cmd" class="truncate max-w-[260px]">Puente C# en espera</span>
        `;
        viewport.appendChild(pill);
    }
}

function showUnityLoadingOverlay(buildSlug, percent = 0, stepText = "Cargando...") {
    const modal = document.getElementById("engine3d-bridge-loader-modal");
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.innerHTML = `
        <div class="w-full max-w-sm bg-surface-container border border-primary/40 rounded-2xl p-5 space-y-3 shadow-2xl">
            <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-primary font-extrabold uppercase">Unity WebGL Loader</span>
                <span class="text-secondary font-bold">${percent}%</span>
            </div>
            <div class="w-full h-2 bg-surface rounded-full overflow-hidden border border-surface-high">
                <div class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-200" style="width: ${percent}%"></div>
            </div>
            <p class="text-[11px] font-mono text-gray-300 truncate">${escapeHtmlBridge(stepText)}</p>
            <span class="block text-[10px] font-mono text-gray-500">Paquete: assets/7-multimedia-3d/builds-webgl/${escapeHtmlBridge(buildSlug)}</span>
        </div>
    `;
}

function hideUnityLoadingOverlay() {
    const modal = document.getElementById("engine3d-bridge-loader-modal");
    if (modal) modal.classList.add("hidden");
}

function activateTacticalCanvasFallback(buildSlug, statusText) {
    if (webglBridgeRuntime.stateRef) {
        webglBridgeRuntime.stateRef.isWebGLNativeLoaded = false;
        webglBridgeRuntime.stateRef.unityInstance = null;
    }
    webglBridgeRuntime.mode = "tactical_canvas";
    webglBridgeRuntime.activeBuildSlug = buildSlug;

    const unityMount = document.getElementById("engine3d-unity-mount");
    if (unityMount) unityMount.classList.add("hidden");

    updateBridgeStatusBadge(statusText, "tactical");
    dispatchUnityTelemetryToJS({
        message: `Visor 3D Táctico Nativo sincronizado para '${buildSlug}'. Emulador de puente C# activo.`
    });
}

function updateBridgeStatusBadge(text, stateTone = "tactical") {
    const statusBadge = document.getElementById("engine3d-bridge-status");
    if (!statusBadge) return;

    statusBadge.textContent = text;
    if (stateTone === "connected") {
        statusBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-secondary/20 text-secondary border border-secondary/50";
    } else if (stateTone === "loading") {
        statusBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-warning/20 text-warning border border-warning/50 animate-pulse";
    } else {
        statusBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-primary/15 text-primary border border-primary/40";
    }
}

function updateBridgeDiagnosticTelemetryBar(commandEntry) {
    const cmdLabel = document.getElementById("engine3d-bridge-last-cmd");
    if (!cmdLabel || !commandEntry) return;

    const actionSub = commandEntry.payload?.unityCommand || commandEntry.payload?.regionId || commandEntry.payload?.scenarioId || "";
    cmdLabel.textContent = actionSub
        ? `${commandEntry.method} → ${actionSub}`
        : `${commandEntry.gameObject}.${commandEntry.method}()`;
}

function triggerDefibrillationViewportFlash() {
    const fxLayer = document.getElementById("engine3d-bridge-fx-layer");
    if (!fxLayer) return;

    fxLayer.className = "pointer-events-none absolute inset-0 z-20 bg-warning/35 transition-opacity duration-150 opacity-100";
    setTimeout(() => {
        fxLayer.className = "pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 opacity-0";
    }, 180);
}

function pulseViewportFocusReticle() {
    const fxLayer = document.getElementById("engine3d-bridge-fx-layer");
    if (!fxLayer) return;

    fxLayer.className = "pointer-events-none absolute inset-0 z-20 border-4 border-secondary/50 rounded-2xl transition-opacity duration-200 opacity-100";
    setTimeout(() => {
        fxLayer.className = "pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 opacity-0";
    }, 260);
}

/**
 * Escucha eventos de pérdida de contexto WebGL (`webglcontextlost`) para restaurar
 * automáticamente el renderizador sin dejar la pantalla negra.
 */
function bindWebGLContextRecoveryEvents() {
    const canvas = document.getElementById("engine3d-webgl-canvas");
    if (!canvas || canvas.__makaiWebGLContextBound) return;
    canvas.__makaiWebGLContextBound = true;

    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        updateBridgeStatusBadge("Recuperando contexto gráfico 3D...", "loading");
    });

    canvas.addEventListener("webglcontextrestored", () => {
        updateBridgeStatusBadge("Contexto 3D Restaurado • 60 FPS", "tactical");
    });
}

/**
 * Monitorea los cuadros por segundo (FPS) mientras la vista `#view-sim3d` está activa.
 */
function startBridgeFpsTelemetryMonitor() {
    if (webglBridgeRuntime.fpsMonitor.rafId) {
        cancelAnimationFrame(webglBridgeRuntime.fpsMonitor.rafId);
    }

    const sampleLoop = (now) => {
        webglBridgeRuntime.fpsMonitor.frames += 1;
        const elapsed = now - webglBridgeRuntime.fpsMonitor.lastSampleTime;

        if (elapsed >= 1000) {
            const currentFps = Math.min(60, Math.max(24, Math.round((webglBridgeRuntime.fpsMonitor.frames * 1000) / elapsed)));
            webglBridgeRuntime.fpsMonitor.fps = currentFps;
            webglBridgeRuntime.fpsMonitor.frames = 0;
            webglBridgeRuntime.fpsMonitor.lastSampleTime = now;

            const fpsEl = document.getElementById("engine3d-bridge-fps-label");
            if (fpsEl) {
                fpsEl.textContent = `${currentFps} FPS`;
            }
        }

        webglBridgeRuntime.fpsMonitor.rafId = requestAnimationFrame(sampleLoop);
    };

    webglBridgeRuntime.fpsMonitor.rafId = requestAnimationFrame(sampleLoop);
}

// ============================================================================
// 7. UTILIDADES DE VERIFICACIÓN DE ARCHIVOS .WASM / .DATA EN GITHUB PAGES
// ============================================================================

/**
 * Verifica si un recurso existe en el servidor mediante `fetch(..., { method: "HEAD" })`.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function checkAssetExists(url) {
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
        if (!res.ok) return false;
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        // Evitar falsos positivos si el servidor devuelve una página HTML 404 personalizada con status 200
        if (contentType.includes("text/html")) return false;
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Inyecta dinámicamente el archivo `<buildSlug>.loader.js` de Unity si aún no fue cargado.
 * @param {string} loaderUrl
 * @returns {Promise<void>}
 */
function injectUnityLoaderScript(loaderUrl) {
    if (webglBridgeRuntime.loadedScriptUrls.has(loaderUrl) && typeof window.createUnityInstance === "function") {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = loaderUrl;
        script.async = true;
        script.onload = () => {
            webglBridgeRuntime.loadedScriptUrls.add(loaderUrl);
            resolve();
        };
        script.onerror = () => reject(new Error(`No se pudo cargar ${loaderUrl}`));
        document.head.appendChild(script);
    });
}

/**
 * Detecta automáticamente si los archivos compilados de Unity en `builds-webgl/`
 * tienen extensión estándar (`.data`, `.framework.js`, `.wasm`) o comprimida (`.gz` / `.br`).
 * @param {string} basePath
 * @param {string} buildSlug
 */
async function resolveUnityBuildFileUrls(basePath, buildSlug) {
    const prefix = `${basePath}${buildSlug}`;

    const resolveCandidate = async (extensions) => {
        for (const ext of extensions) {
            const candidate = `${prefix}${ext}`;
            if (await checkAssetExists(candidate)) {
                return candidate;
            }
        }
        return `${prefix}${extensions[0]}`;
    };

    const [dataUrl, frameworkUrl, codeUrl] = await Promise.all([
        resolveCandidate([".data", ".data.gz", ".data.br"]),
        resolveCandidate([".framework.js", ".framework.js.gz", ".framework.js.br"]),
        resolveCandidate([".wasm", ".wasm.gz", ".wasm.br"])
    ]);

    return { dataUrl, frameworkUrl, codeUrl };
}

function sanitizeBuildSlug(rawSlug = "") {
    return String(rawSlug)
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function escapeHtmlBridge(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
