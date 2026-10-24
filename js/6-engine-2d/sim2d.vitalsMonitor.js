// ============================================================================
// ARCHIVO: js/6-engine-2d/sim2d.vitalsMonitor.js
// DESCRIPCIÓN: Subcomponente de Monitor Multiparámetro UCI en Tiempo Real
//              (Curvas 2D de ECG Derivación II, Pletismografía SpO2,
//              Impedancia Respiratoria, Cálculo de PAM, Alertas Hemodinámicas
//              y Motor de Audio de Auscultación Cardiopulmonar).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

// ============================================================================
// 1. ESTADO INTERNO Y MAPEO DE AUDIOS CLÍNICOS (assets/6-multimedia-2d/)
// ============================================================================

const vitalsMonitorContext = {
    initialized: false,
    stateRef: null,
    assetsPath: {
        PATIENTS: "assets/6-multimedia-2d/pacientes-capas/",
        TOOLS: "assets/6-multimedia-2d/instrumental-sprites/",
        MONITORS: "assets/6-multimedia-2d/monitores-2d/",
        AUDIOS: "assets/6-multimedia-2d/audios-auscultacion/"
    },
    animationFrameId: null,
    isFrozen: false,
    isBeepEnabled: false,
    sweepX: 0,
    phaseECG: 0,
    phaseSpO2: 0,
    phaseResp: 0,
    lastBeatTimestamp: 0,
    activeAudioElement: null,
    audioCache: {},
    currentVitals: {
        hr: 118,
        bpSys: 88,
        bpDia: 54,
        map: 65,
        spo2: 91,
        rr: 26,
        temp: 38.4,
        rhythm: "taquicardia_sinusal",
        heartSound: "S1-S2 taquicárdicos, S3 galope en foco mitral",
        lungSound: "Crepitantes bibasales húmedos"
    }
};

// Catálogo de archivos de audio en assets/6-multimedia-2d/audios-auscultacion/
const AUSCULTATION_AUDIO_FILES = Object.freeze({
    foco_aortico: "foco-aortico-normal.mp3",
    foco_pulmonar: "foco-pulmonar-normal.mp3",
    foco_tricuspideo: "foco-tricuspideo-normal.mp3",
    foco_mitral_galope: "s3-galope-mitral.mp3",
    foco_mitral_normal: "foco-mitral-normal.mp3",
    base_pulmonar_crepitantes: "crepitantes-bibasales.mp3",
    base_pulmonar_normal: "murmullo-vesicular-normal.mp3"
});

// Diccionario de nombres legibles y colores por tipo de ritmo cardíaco
const RHYTHM_PROFILES = Object.freeze({
    taquicardia_sinusal: {
        label: "Taquicardia Sinusal",
        colorClass: "text-warning",
        irregularity: 0.02,
        hasPWave: true,
        wideQRS: false
    },
    ritmo_sinusal_estable: {
        label: "Ritmo Sinusal Normal",
        colorClass: "text-secondary",
        irregularity: 0.01,
        hasPWave: true,
        wideQRS: false
    },
    sinusal: {
        label: "Ritmo Sinusal",
        colorClass: "text-secondary",
        irregularity: 0.01,
        hasPWave: true,
        wideQRS: false
    },
    fibrilacion_auricular: {
        label: "Fibrilación Auricular",
        colorClass: "text-warning",
        irregularity: 0.28,
        hasPWave: false,
        wideQRS: false
    },
    taquicardia_ventricular: {
        label: "Taquicardia Ventricular",
        colorClass: "text-danger",
        irregularity: 0.04,
        hasPWave: false,
        wideQRS: true
    },
    bradicardia_sinusal: {
        label: "Bradicardia Sinusal",
        colorClass: "text-primary",
        irregularity: 0.02,
        hasPWave: true,
        wideQRS: false
    }
});

// ============================================================================
// 2. INICIALIZACIÓN Y CONEXIÓN CON ENGINE2D.CONTROLLER.JS
// ============================================================================

/**
 * Inicializa el Subcomponente de Monitor Multiparámetro 2D y toma el control
 * del lienzo `#engine2d-vitals-canvas` y del sistema de auscultación.
 * Es invocada automáticamente por `initEngine2DSubmodules()` en `engine2d.controller.js`.
 * @param {Object} options
 * @param {Object} options.state - Referencia a `engine2DState`
 * @param {Object} options.assetsPath - Rutas `ASSETS_2D_PATHS`
 */
export function initVitalsMonitor2D(options = {}) {
    if (options.state) {
        vitalsMonitorContext.stateRef = options.state;
        // Detener el bucle básico de respaldo de engine2d.controller.js para usar el motor avanzado
        if (options.state.ecgAnimationId) {
            cancelAnimationFrame(options.state.ecgAnimationId);
            options.state.ecgAnimationId = null;
        }
    }

    if (options.assetsPath) {
        vitalsMonitorContext.assetsPath = {
            ...vitalsMonitorContext.assetsPath,
            ...options.assetsPath
        };
    }

    injectMonitorICUControls2D();

    if (vitalsMonitorContext.stateRef?.vitals) {
        updateMonitorVitals(vitalsMonitorContext.stateRef.vitals);
    }

    startMonitorWaveformLoop2D();
    vitalsMonitorContext.initialized = true;

    return {
        module: "sim2d.vitalsMonitor",
        status: "online"
    };
}

/**
 * Alias de compatibilidad arquitectónica.
 */
export const initSim2DVitalsMonitor = initVitalsMonitor2D;

/**
 * Inyecta la barra de herramientas interactiva del Monitor Multiparámetro UCI
 * (Indicador de PAM en vivo, botón de congelar trazo ECG y botón de Beep QRS).
 */
function injectMonitorICUControls2D() {
    const monitorContainer = document.getElementById("engine2d-vitals-container");
    if (!monitorContainer || document.getElementById("engine2d-icu-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.id = "engine2d-icu-toolbar";
    toolbar.className = "flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-high text-[11px] font-mono";

    toolbar.innerHTML = `
        <div class="flex items-center gap-2">
            <span id="vital-map-badge" class="px-2.5 py-1 rounded-lg bg-surface border border-surface-high text-warning font-bold">
                PAM: 65 mmHg
            </span>
            <span id="vital-alarm-badge" class="px-2.5 py-1 rounded-lg bg-warning/15 border border-warning/40 text-warning font-bold">
                vigilancia hemodinámica
            </span>
        </div>

        <div class="flex items-center gap-1.5">
            <button
                type="button"
                id="btn-vitals-freeze"
                class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-high border border-surface-high text-gray-300 hover:text-white transition-all flex items-center gap-1"
                title="Congelar o reanudar el barrido del electrocardiograma"
            >
                <span class="material-symbols-outlined text-xs">pause_circle</span>
                <span id="label-vitals-freeze">Congelar ECG</span>
            </button>

            <button
                type="button"
                id="btn-vitals-beep"
                class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-high border border-surface-high text-gray-400 hover:text-primary transition-all flex items-center gap-1"
                title="Activar o silenciar el tono acústico de pulso QRS"
            >
                <span id="icon-vitals-beep" class="material-symbols-outlined text-xs">volume_off</span>
                <span id="label-vitals-beep">Beep UCI: OFF</span>
            </button>
        </div>
    `;

    monitorContainer.appendChild(toolbar);

    document.getElementById("btn-vitals-freeze")?.addEventListener("click", () => {
        toggleWaveformFreeze2D();
    });

    document.getElementById("btn-vitals-beep")?.addEventListener("click", () => {
        toggleMonitorBeepAudio2D();
    });
}

// ============================================================================
// 3. ACTUALIZACIÓN DE PARÁMETROS HEMODINÁMICOS Y ALERTAS CLÍNICAS
// ============================================================================

/**
 * Actualiza los parámetros vitales del monitor multiparámetro, calcula la
 * Presión Arterial Media (PAM = (PAS + 2*PAD)/3) y evalúa las alarmas clínicas.
 * Es invocada automáticamente por `updatePatientVitals2D()` desde `engine2d.controller.js`.
 * @param {Object} vitals
 */
export function updateMonitorVitals(vitals = {}) {
    const merged = {
        ...vitalsMonitorContext.currentVitals,
        ...vitals
    };

    const sys = Number(merged.bpSys || 110);
    const dia = Number(merged.bpDia || 70);
    merged.map = Math.round((sys + 2 * dia) / 3);

    vitalsMonitorContext.currentVitals = merged;

    if (vitalsMonitorContext.stateRef) {
        vitalsMonitorContext.stateRef.vitals = {
            ...vitalsMonitorContext.stateRef.vitals,
            ...merged
        };
    }

    // Asegurar que la barra de controles UCI esté presente si el DOM se reconstruyó
    injectMonitorICUControls2D();

    // 1. Actualizar valores numéricos en las tarjetas del monitor
    const hrEl = document.getElementById("vital-hr-val");
    const spo2El = document.getElementById("vital-spo2-val");
    const bpEl = document.getElementById("vital-bp-val");
    const rrEl = document.getElementById("vital-rr-val");
    const rhythmEl = document.getElementById("engine2d-rhythm-label");
    const mapBadge = document.getElementById("vital-map-badge");
    const alarmBadge = document.getElementById("vital-alarm-badge");

    if (hrEl) {
        hrEl.textContent = String(merged.hr);
        hrEl.className = `text-xl font-mono font-extrabold ${
            merged.hr > 120 || merged.hr < 50 ? "text-danger animate-pulse" : "text-secondary"
        }`;
    }

    if (spo2El) {
        spo2El.textContent = `${merged.spo2}%`;
        spo2El.className = `text-xl font-mono font-extrabold ${
            merged.spo2 < 90 ? "text-danger animate-pulse" : merged.spo2 < 94 ? "text-warning" : "text-primary"
        }`;
    }

    if (bpEl) {
        bpEl.textContent = `${sys}/${dia}`;
        bpEl.className = `text-base font-mono font-extrabold ${
            merged.map < 65 || sys > 160 ? "text-danger" : "text-warning"
        }`;
    }

    if (rrEl) {
        rrEl.textContent = `${merged.rr} • ${Number(merged.temp || 37.0).toFixed(1)}°`;
    }

    // 2. Actualizar etiqueta de ritmo cardíaco
    const rhythmKey = (merged.rhythm || "sinusal").toLowerCase();
    const profile = RHYTHM_PROFILES[rhythmKey] || {
        label: rhythmKey.replace(/_/g, " ").toUpperCase(),
        colorClass: "text-secondary"
    };

    if (rhythmEl) {
        rhythmEl.textContent = profile.label;
        rhythmEl.className = `text-[11px] font-mono font-bold ${profile.colorClass}`;
    }

    // 3. Actualizar PAM (Presión Arterial Media) y estado de alarma UCI
    if (mapBadge) {
        mapBadge.textContent = `PAM: ${merged.map} mmHg`;
        mapBadge.className = `px-2.5 py-1 rounded-lg bg-surface border font-bold ${
            merged.map < 65
                ? "border-danger/60 text-danger"
                : merged.map > 110
                    ? "border-warning/60 text-warning"
                    : "border-secondary/50 text-secondary"
        }`;
    }

    if (alarmBadge) {
        const alerts = [];
        if (merged.spo2 < 90) alerts.push("Hipoxemia Crítica");
        if (merged.map < 65) alerts.push("Hipotensión / Hipoperfusión (PAM < 65)");
        if (sys >= 160) alerts.push("Crisis Hipertensiva");
        if (merged.hr >= 120) alerts.push("Taquicardia");
        if (merged.rr >= 28) alerts.push("Taquipnea");

        if (alerts.length === 0) {
            alarmBadge.className = "px-2.5 py-1 rounded-lg bg-secondary/15 border border-secondary/40 text-secondary font-bold";
            alarmBadge.textContent = "✓ Parámetros en Rango Meta";
        } else {
            const isCritical = merged.spo2 < 88 || merged.map < 60 || merged.hr >= 130;
            alarmBadge.className = isCritical
                ? "px-2.5 py-1 rounded-lg bg-danger/15 border border-danger/50 text-danger font-bold animate-pulse"
                : "px-2.5 py-1 rounded-lg bg-warning/15 border border-warning/40 text-warning font-bold";
            alarmBadge.textContent = `⚠ ${alerts.slice(0, 2).join(" • ")}`;
        }
    }
}

// ============================================================================
// 4. RENDERIZADO DE ONDAS 2D EN TIEMPO REAL (#engine2d-vitals-canvas)
// ============================================================================

/**
 * Inicia el bucle de animación de alta precisión para dibujar las 3 curvas del
 * monitor multiparámetro (ECG DII, Pletismografía SpO2 y Respiración).
 */
export function startMonitorWaveformLoop2D() {
    stopMonitorWaveformLoop2D();

    const renderTick = (timestamp) => {
        const sim2dView = document.getElementById("view-sim2d");
        const canvas = document.getElementById("engine2d-vitals-canvas");

        // Detener cualquier bucle residual del controlador general si se reactivó
        if (vitalsMonitorContext.stateRef?.ecgAnimationId) {
            cancelAnimationFrame(vitalsMonitorContext.stateRef.ecgAnimationId);
            vitalsMonitorContext.stateRef.ecgAnimationId = null;
        }

        if (canvas && sim2dView && !sim2dView.classList.contains("hidden")) {
            if (!vitalsMonitorContext.isFrozen) {
                drawMonitorWaveforms2D(canvas, timestamp);
            }
        }

        vitalsMonitorContext.animationFrameId = requestAnimationFrame(renderTick);
    };

    vitalsMonitorContext.animationFrameId = requestAnimationFrame(renderTick);
}

/**
 * Detiene el bucle de animación del monitor multiparámetro.
 */
export function stopMonitorWaveformLoop2D() {
    if (vitalsMonitorContext.animationFrameId) {
        cancelAnimationFrame(vitalsMonitorContext.animationFrameId);
        vitalsMonitorContext.animationFrameId = null;
    }
}

/**
 * Dibuja las grillas clínicas, leyendas de derivación y las 3 curvas fisiológicas
 * dinámicas en `#engine2d-vitals-canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {number} timestamp
 */
function drawMonitorWaveforms2D(canvas, timestamp = performance.now()) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const v = vitalsMonitorContext.currentVitals;

    const hr = Math.max(30, Math.min(220, Number(v.hr || 80)));
    const rr = Math.max(6, Math.min(50, Number(v.rr || 18)));
    const spo2 = Math.max(50, Math.min(100, Number(v.spo2 || 96)));
    const rhythmKey = (v.rhythm || "sinusal").toLowerCase();
    const profile = RHYTHM_PROFILES[rhythmKey] || RHYTHM_PROFILES.sinusal;

    // Avanzar fases proporcionalmente a la FC y FR reales del paciente
    const ecgStep = (hr / 60) * 0.068;
    const respStep = (rr / 60) * 0.045;
    vitalsMonitorContext.phaseECG += ecgStep;
    vitalsMonitorContext.phaseSpO2 += ecgStep * 0.92;
    vitalsMonitorContext.phaseResp += respStep;
    vitalsMonitorContext.sweepX = (vitalsMonitorContext.sweepX + 2.2) % w;

    // Disparar beep acústico sincronizado con cada latido (complejo R) si está activo
    const beatIntervalMs = (60 / hr) * 1000;
    if (
        vitalsMonitorContext.isBeepEnabled &&
        timestamp - vitalsMonitorContext.lastBeatTimestamp >= beatIntervalMs
    ) {
        vitalsMonitorContext.lastBeatTimestamp = timestamp;
        triggerQRSMonitorBeep(spo2);
    }

    // 1. Fondo oscuro clínico del monitor UCI
    ctx.fillStyle = "#030508";
    ctx.fillRect(0, 0, w, h);

    // 2. Cuadrícula milimetrada de calibración hospitalaria
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // 3. Curva 1 (Superior): Electrocardiograma Derivación II (Verde Neón #94de2d)
    ctx.strokeStyle = "#94de2d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
        const cycle = (x * 0.058 + vitalsMonitorContext.phaseECG) % (Math.PI * 2);
        const yOffset = computeECGWaveOffset(cycle, profile);
        const y = 34 + yOffset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Curva 2 (Media): Onda Pletismográfica de SpO2 con Incisura Dícrota (Cian #00e5ff)
    const plethAmplitude = Math.max(0.35, (spo2 - 60) / 40);
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
        const t = (x * 0.052 + vitalsMonitorContext.phaseSpO2) % (Math.PI * 2);
        const systolicPeak = Math.exp(-Math.pow((t - 1.8) / 0.42, 2)) * 16;
        const dicroticWave = Math.exp(-Math.pow((t - 2.65) / 0.35, 2)) * 6.5;
        const y = 84 - (systolicPeak + dicroticWave) * plethAmplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Curva 3 (Inferior): Impedancia Respiratoria / Capnografía (Ámbar #ffbe0b)
    ctx.strokeStyle = "rgba(255, 190, 11, 0.85)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
        const rPhase = x * 0.025 + vitalsMonitorContext.phaseResp;
        const respWave = Math.sin(rPhase) * 6.5;
        const y = 115 - respWave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 6. Barra de barrido en tiempo real (efecto osciloscopio UCI)
    const barX = vitalsMonitorContext.sweepX;
    ctx.fillStyle = "rgba(3, 5, 8, 0.78)";
    ctx.fillRect(barX, 0, 14, h);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(barX, 0);
    ctx.lineTo(barX, h);
    ctx.stroke();

    // 7. Etiquetas técnicas de derivación y velocidad de barrido en las esquinas
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94de2d";
    ctx.fillText("ECG DII • 25 mm/s", 8, 12);

    ctx.fillStyle = "#00e5ff";
    ctx.fillText(`PLETH SpO2 (${spo2}%)`, 8, 62);

    ctx.fillStyle = "#ffbe0b";
    ctx.fillText(`RESP (${rr} rpm)`, 8, 106);
}

/**
 * Calcula la deflexión vertical del complejo P-QRS-T según el perfil del ritmo actual.
 * @param {number} t - Fase entre 0 y 2*PI
 * @param {Object} profile - Configuración del ritmo
 * @returns {number}
 */
function computeECGWaveOffset(t, profile) {
    // Si es Taquicardia Ventricular: complejo ancho monomórfico rápido
    if (profile.wideQRS) {
        return Math.sin(t * 2) * 18 + Math.cos(t * 4) * 5;
    }

    let y = 0;

    // Onda P (ausente en Fibrilación Auricular, reemplazada por ondas f basales)
    if (profile.hasPWave) {
        if (t > 0.95 && t < 1.35) {
            y -= 4.5 * Math.sin(((t - 0.95) / 0.4) * Math.PI);
        }
    } else {
        y += Math.sin(t * 11) * 1.6;
    }

    // Complejo QRS estrecho de alta pendiente
    if (t >= 1.95 && t < 2.08) {
        y += 5; // Onda Q
    } else if (t >= 2.08 && t < 2.24) {
        y -= 26; // Pico R
    } else if (t >= 2.24 && t < 2.38) {
        y += 8.5; // Onda S
    }

    // Onda T de repolarización ventricular
    if (t >= 2.95 && t < 3.65) {
        y -= 7.2 * Math.sin(((t - 2.95) / 0.7) * Math.PI);
    }

    return y;
}

/**
 * Congela o reanuda el trazado del monitor multiparámetro para inspección visual.
 * @returns {boolean} Estado `isFrozen`
 */
export function toggleWaveformFreeze2D() {
    vitalsMonitorContext.isFrozen = !vitalsMonitorContext.isFrozen;

    const btn = document.getElementById("btn-vitals-freeze");
    const label = document.getElementById("label-vitals-freeze");

    if (btn && label) {
        if (vitalsMonitorContext.isFrozen) {
            btn.className = "px-2.5 py-1 rounded-lg bg-primary/20 border border-primary text-primary font-bold transition-all flex items-center gap-1";
            label.textContent = "Reanudar ECG";
        } else {
            btn.className = "px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-high border border-surface-high text-gray-300 hover:text-white transition-all flex items-center gap-1";
            label.textContent = "Congelar ECG";
        }
    }

    return vitalsMonitorContext.isFrozen;
}

/**
 * Activa o silencia el sonido de pulso sincronizado con el QRS del monitor UCI.
 * @param {boolean} [forceState]
 * @returns {boolean}
 */
export function toggleMonitorBeepAudio2D(forceState) {
    vitalsMonitorContext.isBeepEnabled =
        typeof forceState === "boolean" ? forceState : !vitalsMonitorContext.isBeepEnabled;

    const btn = document.getElementById("btn-vitals-beep");
    const icon = document.getElementById("icon-vitals-beep");
    const label = document.getElementById("label-vitals-beep");

    if (btn && icon && label) {
        if (vitalsMonitorContext.isBeepEnabled) {
            btn.className = "px-2.5 py-1 rounded-lg bg-secondary/20 border border-secondary text-secondary font-bold transition-all flex items-center gap-1";
            icon.textContent = "volume_up";
            label.textContent = "Beep UCI: ON";
        } else {
            btn.className = "px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-high border border-surface-high text-gray-400 hover:text-primary transition-all flex items-center gap-1";
            icon.textContent = "volume_off";
            label.textContent = "Beep UCI: OFF";
        }
    }

    return vitalsMonitorContext.isBeepEnabled;
}

// ============================================================================
// 5. MOTOR DE AUDIO DE AUSCULTACIÓN CARDIOPULMONAR Y SÍNTESIS ACÚSTICA
// ============================================================================

/**
 * Reproduce el sonido clínico de auscultación correspondiente al foco anatómico
 * seleccionado (`foco_aortico`, `foco_pulmonar`, `foco_tricuspideo`, `foco_mitral`,
 * `base_pulmonar`).
 * Intenta cargar primero el archivo MP3 desde `assets/6-multimedia-2d/audios-auscultacion/`
 * y, si aún es un archivo semilla vacío, activa el sintetizador acústico Web Audio API
 * con simulación realista de S1-S2, galope S3 y estertores crepitantes pulmonares.
 *
 * Es invocada automáticamente por `playClinicalAuscultationTone()` en `engine2d.controller.js`.
 * @param {string} hotspotId
 * @param {Object} state
 */
export function playAuscultationAudio(
    hotspotId = "foco_mitral",
    state = vitalsMonitorContext.stateRef
) {
    if (state?.vitals) {
        vitalsMonitorContext.currentVitals = {
            ...vitalsMonitorContext.currentVitals,
            ...state.vitals
        };
    }

    const v = vitalsMonitorContext.currentVitals;
    const audioFilename = resolveAuscultationFilename(hotspotId, v);
    const fullAudioUrl = `${vitalsMonitorContext.assetsPath.AUDIOS}${audioFilename}`;

    try {
        if (vitalsMonitorContext.activeAudioElement) {
            vitalsMonitorContext.activeAudioElement.pause();
            vitalsMonitorContext.activeAudioElement.currentTime = 0;
        }

        const audio = new Audio(fullAudioUrl);
        audio.volume = 0.85;
        vitalsMonitorContext.activeAudioElement = audio;

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
                // Si el archivo aún está como semilla en GitHub, ejecutar síntesis acústica
                synthesizeCardiopulmonarySound2D(hotspotId, v);
            });
        }
    } catch (err) {
        synthesizeCardiopulmonarySound2D(hotspotId, v);
    }
}

/**
 * Determina qué archivo de `assets/6-multimedia-2d/audios-auscultacion/` corresponde
 * según el foco anatómico y el estado clínico actual del paciente.
 * @param {string} hotspotId
 * @param {Object} vitals
 * @returns {string}
 */
function resolveAuscultationFilename(hotspotId, vitals = {}) {
    const heartDesc = (vitals.heartSound || "").toLowerCase();
    const lungDesc = (vitals.lungSound || "").toLowerCase();

    if (hotspotId === "base_pulmonar") {
        return lungDesc.includes("crepitante") || lungDesc.includes("estertor")
            ? AUSCULTATION_AUDIO_FILES.base_pulmonar_crepitantes
            : AUSCULTATION_AUDIO_FILES.base_pulmonar_normal;
    }

    if (hotspotId === "foco_mitral") {
        return heartDesc.includes("s3") || heartDesc.includes("galope") || Number(vitals.hr) > 108
            ? AUSCULTATION_AUDIO_FILES.foco_mitral_galope
            : AUSCULTATION_AUDIO_FILES.foco_mitral_normal;
    }

    return AUSCULTATION_AUDIO_FILES[hotspotId] || AUSCULTATION_AUDIO_FILES.foco_mitral_normal;
}

/**
 * Obtiene o inicializa la instancia compartida de `AudioContext`.
 * @returns {AudioContext|null}
 */
function getSharedAudioContext2D() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    const state = vitalsMonitorContext.stateRef;
    if (state && state.audioCtx) {
        if (state.audioCtx.state === "suspended") state.audioCtx.resume();
        return state.audioCtx;
    }

    if (!vitalsMonitorContext.localAudioCtx) {
        vitalsMonitorContext.localAudioCtx = new AudioCtx();
    }
    if (vitalsMonitorContext.localAudioCtx.state === "suspended") {
        vitalsMonitorContext.localAudioCtx.resume();
    }
    if (state) {
        state.audioCtx = vitalsMonitorContext.localAudioCtx;
    }

    return vitalsMonitorContext.localAudioCtx;
}

/**
 * Sintetiza con precisión semiológica los ruidos cardíacos (ciclo de 3 latidos
 * con S1-S2 y tercer ruido S3 de galope cuando aplica) o ruidos respiratorios
 * (murmullo vesicular e inspiración con estertores crepitantes finos).
 * @param {string} hotspotId
 * @param {Object} vitals
 */
function synthesizeCardiopulmonarySound2D(hotspotId, vitals = {}) {
    try {
        const ctx = getSharedAudioContext2D();
        if (!ctx) return;

        const now = ctx.currentTime;
        const hr = Math.max(45, Math.min(180, Number(vitals.hr || 90)));
        const beatPeriod = 60 / hr;

        // A. AUSCULTACIÓN PULMONAR (Bases Pulmonares / Vía Aérea)
        if (hotspotId === "base_pulmonar" || hotspotId === "via_aerea") {
            const hasCrackles = (vitals.lungSound || "").toLowerCase().includes("crepitante");
            synthesizeBreathAndCrackles(ctx, now, hasCrackles);
            return;
        }

        // B. AUSCULTACIÓN CARDÍACA (Focos Aórtico, Pulmonar, Tricuspídeo y Mitral)
        const isBaseFocus = hotspotId === "foco_aortico" || hotspotId === "foco_pulmonar";
        const hasS3Gallop =
            hotspotId === "foco_mitral" &&
            ((vitals.heartSound || "").toLowerCase().includes("s3") ||
                (vitals.heartSound || "").toLowerCase().includes("galope") ||
                hr > 108);

        // Reproducir una secuencia de 3 ciclos cardíacos consecutivos al ritmo real de la FC
        for (let i = 0; i < 3; i++) {
            const cycleStart = now + i * beatPeriod;

            // S1 (Lub): más intenso en foco mitral y tricuspídeo
            const s1Gain = isBaseFocus ? 0.22 : 0.34;
            playHeartValveTone(ctx, cycleStart, 62, 0.095, s1Gain);

            // S2 (Dub): más intenso y agudo en focos de la base (aórtico/pulmonar)
            const s2Gain = isBaseFocus ? 0.32 : 0.24;
            playHeartValveTone(ctx, cycleStart + 0.19, 92, 0.075, s2Gain);

            // S3 (Galope ventricular protodiastólico en foco mitral si hay sobrecarga/IC)
            if (hasS3Gallop) {
                playHeartValveTone(ctx, cycleStart + 0.32, 52, 0.065, 0.20);
            }
        }
    } catch (e) {
        // Silencioso si el navegador restringe el contexto de audio
    }
}

/**
 * Genera un tono valvular filtrado de baja frecuencia (S1, S2 o S3).
 */
function playHeartValveTone(ctx, startTime, freq, duration, maxGain = 0.28) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, startTime + duration);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

/**
 * Sintetiza un ciclo inspiratorio de murmullo vesicular y añade micro-impulsos
 * acústicos al final de la inspiración si existen estertores crepitantes.
 */
function synthesizeBreathAndCrackles(ctx, startTime, includeCrackles = true) {
    const duration = 1.25;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const envelope = Math.sin(progress * Math.PI);
        // Ruido blanco suave para murmullo vesicular
        let sample = (Math.random() * 2 - 1) * 0.08 * envelope;

        // Añadir crepitantes teleinspiratorios (entre 45% y 85% del ciclo)
        if (includeCrackles && progress > 0.45 && progress < 0.85 && Math.random() < 0.0035) {
            sample += (Math.random() > 0.5 ? 1 : -1) * 0.45;
        }
        data[i] = sample;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(includeCrackles ? 680 : 380, startTime);
    filter.Q.setValueAtTime(1.2, startTime);

    noiseSource.connect(filter);
    filter.connect(ctx.destination);
    noiseSource.start(startTime);
}

/**
 * Emite el beep corto del monitor UCI cuyo tono (frecuencia en Hz) desciende
 * cuando cae la saturación de oxígeno (SpO2), idéntico a los monitores reales.
 * @param {number} spo2
 */
function triggerQRSMonitorBeep(spo2 = 96) {
    try {
        const ctx = getSharedAudioContext2D();
        if (!ctx) return;

        const now = ctx.currentTime;
        // Modulación de tono por SpO2: 98% -> ~860Hz, 85% -> ~580Hz
        const pitchHz = Math.max(440, Math.min(920, 400 + (spo2 - 75) * 20));

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(pitchHz, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.055);
    } catch (e) {
        // Silencioso
    }
}
