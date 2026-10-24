// ============================================================================
// ARCHIVO: js/7-engine-3d/sim3d.multiplayer.js
// DESCRIPCIÓN: Subcomponente Cooperativo Multijugador en Tiempo Real del Motor 3D.
//              Gestiona salas compartidas de Trauma Shock / UCI, roles clínicos
//              del escuadrón, sincronización de maniobras HUD (Cloud Firestore +
//              BroadcastChannel), avatares 3D y comandos tácticos de reanimación.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

// ============================================================================
// 1. CONSTANTES DE ROLES COOPERATIVOS, COMANDOS TÁCTICOS Y ESTADO INTERNO
// ============================================================================

const SAFE_COLLECTIONS = {
    MP_ROOMS_3D: COLLECTIONS?.MP_ROOMS_3D || "salas_cooperativas_3d"
};

export const SQUAD_CLINICAL_ROLES_3D = Object.freeze({
    lider_reanimacion: {
        id: "lider_reanimacion",
        label: "Líder de Reanimación & Desfibrilador",
        shortLabel: "Líder ACLS",
        icon: "medical_services",
        color: "#00e5ff",
        avatarPos3D: { x: 0, y: 16, z: 145 },
        recommendedCategory: "desfibrilador_rcp"
    },
    via_aerea_ventilacion: {
        id: "via_aerea_ventilacion",
        label: "Especialista en Vía Aérea & Capnografía",
        shortLabel: "Vía Aérea",
        icon: "pulmonology",
        color: "#94de2d",
        avatarPos3D: { x: -115, y: 15, z: -20 },
        recommendedCategory: "via_aerea"
    },
    accesos_farmacos: {
        id: "accesos_farmacos",
        label: "Accesos Vasculares & Bombas de Infusión IV",
        shortLabel: "Fármacos IV",
        icon: "medication",
        color: "#f59f00",
        avatarPos3D: { x: 115, y: 15, z: -10 },
        recommendedCategory: "farmacos_uci"
    },
    compresiones_efast: {
        id: "compresiones_efast",
        label: "RCP de Alta Calidad & Evaluación Cefalocaudal",
        shortLabel: "RCP & eFAST",
        icon: "monitor_heart",
        color: "#cc5de8",
        avatarPos3D: { x: -95, y: 14, z: 55 },
        recommendedCategory: "accesos_vasculares"
    }
});

export const TACTICAL_CALLOUTS_3D = Object.freeze([
    {
        id: "clear_for_shock",
        label: "⚡ ¡Despejen cama! Descarga lista",
        message: "¡Aléjense del paciente y de la cama metálica! Cargando desfibrilador bifásico.",
        tone: "danger"
    },
    {
        id: "switch_compressor",
        label: "🔄 Relevo de RCP (Ciclo 2 min)",
        message: "Cumplidos 2 minutos de RCP. Relevando compresor en 3, 2, 1 sin pausas > 10 s.",
        tone: "primary"
    },
    {
        id: "prepare_airway",
        label: "🫁 Preparar SRI + Laringoscopio",
        message: "Preoxigenando FiO2 100%. Alistando tubo endotraqueal y capnografía.",
        tone: "secondary"
    },
    {
        id: "vasopressor_ready",
        label: "💉 Iniciar Vasopresor / Bolo IV",
        message: "Vía permeable verificada. Iniciando titulación para objetivo PAM ≥ 65 mmHg.",
        tone: "warning"
    }
]);

const mpInternal = {
    initialized: false,
    controllerState: null,
    onSquadActionSynced: null,
    broadcastChannel: null,
    cloudSyncIntervalId: null,
    latencyPingMs: 24,
    localPeerId: `peer_${Math.random().toString(36).slice(2, 9)}`,
    selectedRoleId: "lider_reanimacion",
    lastProcessedEventTimestamp: 0,
    recentFeed: []
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL SUBCOMPONENTE MULTIJUGADOR
// ============================================================================

/**
 * Inicializa el gestor cooperativo en tiempo real invocado por `engine3d.controller.js`.
 * @param {Object} config
 * @param {Object} config.state - Referencia a `engine3DState`.
 * @param {Function} config.onSquadActionSynced - Callback hacia `handleRemoteMultiplayerAction3D`.
 */
export function initMultiplayer3D(config = {}) {
    if (config.state) {
        mpInternal.controllerState = config.state;
    }
    if (typeof config.onSquadActionSynced === "function") {
        mpInternal.onSquadActionSynced = config.onSquadActionSynced;
    }

    ensureMultiplayerExtendedUI();
    initLocalBroadcastChannel3D();

    mpInternal.initialized = true;
}

/**
 * Enriquece el panel `#engine3d-multiplayer-panel` creado por `engine3d.controller.js`
 * añadiendo selector de Rol Clínico, indicador de latencia, botón de Asistencia Táctica
 * del Escuadrón y botonera de Comunicación en Circuito Cerrado (ACLS/ATLS).
 */
function ensureMultiplayerExtendedUI() {
    const mpPanel = document.getElementById("engine3d-multiplayer-panel");
    if (!mpPanel || document.getElementById("engine3d-mp-extended-controls")) return;

    const squadListEl = document.getElementById("engine3d-mp-squad-list");

    const extendedBlock = document.createElement("div");
    extendedBlock.id = "engine3d-mp-extended-controls";
    extendedBlock.className = "space-y-3 pt-2 border-t border-surface-high";

    extendedBlock.innerHTML = `
        <!-- Selector de Rol Táctico dentro del Escuadrón UCI -->
        <div>
            <div class="flex items-center justify-between mb-1">
                <label for="engine3d-mp-role-select" class="text-[10px] font-mono uppercase text-gray-400">
                    Tu Rol en el Código / Trauma
                </label>
                <span id="engine3d-mp-ping-badge" class="text-[10px] font-mono text-gray-500">
                    Ping: -- ms
                </span>
            </div>
            <select
                id="engine3d-mp-role-select"
                class="w-full bg-surface border border-surface-high focus:border-secondary rounded-xl px-2.5 py-1.5 text-xs font-bold text-white outline-none transition-colors"
            >
                ${Object.values(SQUAD_CLINICAL_ROLES_3D).map(role => `
                    <option value="${role.id}" ${role.id === mpInternal.selectedRoleId ? "selected" : ""}>
                        ${role.label}
                    </option>
                `).join("")}
            </select>
        </div>

        <!-- Comunicación en Circuito Cerrado (Callouts Rápidos ACLS / ATLS) -->
        <div class="space-y-1.5">
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase text-primary font-bold">
                    Órdenes en Circuito Cerrado
                </span>
                <button
                    type="button"
                    id="btn-engine3d-mp-bot-assist"
                    class="px-2 py-0.5 rounded-lg bg-primary/15 hover:bg-primary hover:text-surface text-primary border border-primary/40 text-[10px] font-mono font-extrabold transition-all"
                    title="Pedir apoyo táctico al residente del escuadrón"
                >
                    + Apoyo Residente
                </button>
            </div>
            <div id="engine3d-mp-callouts-grid" class="grid grid-cols-2 gap-1.5">
                ${TACTICAL_CALLOUTS_3D.map(callout => `
                    <button
                        type="button"
                        data-mp-callout="${callout.id}"
                        class="engine3d-mp-callout-btn text-left px-2 py-1.5 rounded-lg bg-surface hover:bg-surface-high border border-surface-high hover:border-primary/50 text-[10px] font-bold text-gray-200 transition-all truncate"
                        title="${callout.message}"
                    >
                        ${callout.label}
                    </button>
                `).join("")}
            </div>
        </div>

        <!-- Feed en Vivo de Sincronización Cooperativa -->
        <div id="engine3d-mp-live-feed" class="hidden bg-surface border border-surface-high rounded-xl p-2.5 space-y-1 max-h-28 overflow-y-auto text-[10px] font-mono text-gray-300">
        </div>
    `;

    if (squadListEl && squadListEl.parentNode === mpPanel) {
        mpPanel.appendChild(extendedBlock);
    } else {
        mpPanel.appendChild(extendedBlock);
    }

    // Eventos de cambio de rol clínico
    const roleSelect = document.getElementById("engine3d-mp-role-select");
    roleSelect?.addEventListener("change", () => {
        assignSquadRole3D(roleSelect.value);
    });

    // Eventos de órdenes tácticas rápidas en circuito cerrado
    extendedBlock.querySelectorAll(".engine3d-mp-callout-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendTacticalCallout3D(btn.dataset.mpCallout);
        });
    });

    // Botón para solicitar maniobra/asistencia al residente cooperativo en sala
    document.getElementById("btn-engine3d-mp-bot-assist")?.addEventListener("click", () => {
        triggerAssistBotAction3D();
    });
}

// ============================================================================
// 3. GESTIÓN DE CONEXIÓN A SALAS COOPERATIVAS 3D (CLOUD FIRESTORE + CANAL LOCAL)
// ============================================================================

/**
 * Conecta o desconecta al estudiante de la sala cooperativa 3D indicada.
 * Invocada automáticamente por `toggleMultiplayerRoom3D` desde `engine3d.controller.js`.
 * @param {string} roomCode
 * @param {Object} state - Estado `engine3DState`.
 */
export async function toggleRoomConnection(roomCode = "UCI-ALICIZATION-01", state = mpInternal.controllerState) {
    if (state) {
        mpInternal.controllerState = state;
    }
    const targetState = mpInternal.controllerState;
    if (!targetState) return;

    const normalizedRoom = (roomCode || "UCI-ALICIZATION-01")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-_]/g, "-");

    targetState.multiplayer.roomCode = normalizedRoom;

    if (targetState.multiplayer.connected) {
        await connectToCooperativeRoom3D(normalizedRoom, targetState);
    } else {
        await disconnectFromCooperativeRoom3D(normalizedRoom, targetState);
    }
}

/**
 * Establece la sesión activa en la sala cooperativa, conforma el escuadrón médico,
 * sincroniza el documento en Cloud Firestore y habilita la telemetría de baja latencia.
 * @param {string} roomCode
 * @param {Object} state
 */
async function connectToCooperativeRoom3D(roomCode, state) {
    const selectedRole = SQUAD_CLINICAL_ROLES_3D[mpInternal.selectedRoleId]
        || SQUAD_CLINICAL_ROLES_3D.lider_reanimacion;

    const currentUserName = getLocalDoctorDisplayName();
    state.multiplayer.role = selectedRole.label;

    // 1. Construir escuadrón inicial (Usuario local + Residentes de soporte hasta que entren colegas reales)
    state.multiplayer.squadMembers = buildInitialSquadRoster(currentUserName, selectedRole);

    // 2. Actualizar interfaz diferida para sobrescribir con tarjetas enriquecidas
    setTimeout(() => {
        renderSquadMembersCards3D();
        updateMultiplayerPingBadge(mpInternal.latencyPingMs);
        appendMultiplayerFeedLine(`Conectado a sala ${roomCode} como ${selectedRole.shortLabel}.`);
    }, 20);

    // 3. Emitir evento de ingreso por BroadcastChannel (sincronización entre pestañas/ventanas)
    postToBroadcastChannel3D({
        type: "MEMBER_JOINED",
        roomCode,
        peerId: mpInternal.localPeerId,
        user: currentUserName,
        roleId: selectedRole.id,
        roleLabel: selectedRole.label,
        timestamp: Date.now()
    });

    // 4. Registrar/Actualizar la sala en Cloud Firestore (Tolerante a modo offline)
    await syncRoomStateWithFirestore3D(roomCode, {
        eventType: "JOIN",
        user: currentUserName,
        roleLabel: selectedRole.label
    });

    // 5. Iniciar latido (heartbeat) y lectura periódica de la sala cooperativa
    startCloudRoomPolling3D(roomCode);

    // 6. Sincronizar avatares con Unity WebGL si hay instancia activa
    syncSquadAvatarsWithWebGL();
}

/**
 * Cierra la conexión cooperativa, detiene el sondeo de sala y limpia el feed en vivo.
 * @param {string} roomCode
 * @param {Object} state
 */
async function disconnectFromCooperativeRoom3D(roomCode, state) {
    stopCloudRoomPolling3D();

    const currentUserName = getLocalDoctorDisplayName();
    postToBroadcastChannel3D({
        type: "MEMBER_LEFT",
        roomCode,
        peerId: mpInternal.localPeerId,
        user: currentUserName,
        timestamp: Date.now()
    });

    const feedEl = document.getElementById("engine3d-mp-live-feed");
    if (feedEl) {
        feedEl.classList.add("hidden");
        feedEl.innerHTML = "";
    }

    updateMultiplayerPingBadge(null);
    if (state) {
        state.multiplayer.squadMembers = [];
    }
}

// ============================================================================
// 4. TRANSMISIÓN Y RECEPCIÓN DE MANIOBRAS CLÍNICAS EN TIEMPO REAL
// ============================================================================

/**
 * Transmite una maniobra médica ejecutada en el Marco Clínico HUD hacia todos
 * los integrantes conectados a la sala cooperativa.
 * Invocada automáticamente por `dispatchClinicalAction3D` en `engine3d.controller.js`.
 * @param {Object} actionPayload
 * @param {string} actionPayload.actionId
 * @param {string} actionPayload.actionName
 * @param {string} actionPayload.user
 */
export async function broadcastAction3D(actionPayload = {}) {
    const state = mpInternal.controllerState;
    if (!state || !state.multiplayer?.connected) return;

    const senderName = actionPayload.user || getLocalDoctorDisplayName();
    const roleObj = SQUAD_CLINICAL_ROLES_3D[mpInternal.selectedRoleId]
        || SQUAD_CLINICAL_ROLES_3D.lider_reanimacion;

    const eventPacket = {
        type: "CLINICAL_ACTION_EXECUTED",
        roomCode: state.multiplayer.roomCode,
        peerId: mpInternal.localPeerId,
        user: senderName,
        roleId: roleObj.id,
        roleShort: roleObj.shortLabel,
        actionId: actionPayload.actionId || "maniobra_3d",
        actionName: actionPayload.actionName || "Intervención 3D",
        scenarioId: state.activeScenario?.id || "escenario_3d",
        vitalsSnapshot: { ...(state.vitals || {}) },
        timestamp: Date.now()
    };

    mpInternal.lastProcessedEventTimestamp = eventPacket.timestamp;

    // 1. Actualizar estado de última acción en la tarjeta del miembro local
    updateMemberLastActionTag(senderName, eventPacket.actionName);
    appendMultiplayerFeedLine(`✓ [${roleObj.shortLabel}] ${senderName}: ${eventPacket.actionName}`);

    // 2. Emitir instantáneamente por BroadcastChannel
    postToBroadcastChannel3D(eventPacket);

    // 3. Persistir evento en Cloud Firestore para colegas en otros dispositivos
    await syncRoomStateWithFirestore3D(state.multiplayer.roomCode, {
        eventType: "CLINICAL_ACTION",
        lastEvent: eventPacket
    });
}

/**
 * Cambia el rol táctico del estudiante dentro del escuadrón cooperativo y actualiza la sala.
 * @param {string} roleId
 */
export function assignSquadRole3D(roleId) {
    const role = SQUAD_CLINICAL_ROLES_3D[roleId] || SQUAD_CLINICAL_ROLES_3D.lider_reanimacion;
    mpInternal.selectedRoleId = role.id;

    const state = mpInternal.controllerState;
    if (!state) return;

    state.multiplayer.role = role.label;

    if (state.multiplayer.connected) {
        const currentUserName = getLocalDoctorDisplayName();
        state.multiplayer.squadMembers = buildInitialSquadRoster(currentUserName, role);
        renderSquadMembersCards3D();

        appendMultiplayerFeedLine(`Rol actualizado a: ${role.shortLabel}`);

        postToBroadcastChannel3D({
            type: "ROLE_UPDATED",
            roomCode: state.multiplayer.roomCode,
            peerId: mpInternal.localPeerId,
            user: currentUserName,
            roleId: role.id,
            roleLabel: role.label,
            timestamp: Date.now()
        });

        syncSquadAvatarsWithWebGL();
    }
}

/**
 * Envía una orden rápida en circuito cerrado (Callout ACLS/ATLS) al escuadrón cooperativo.
 * @param {string} calloutId
 */
export function sendTacticalCallout3D(calloutId) {
    const callout = TACTICAL_CALLOUTS_3D.find(c => c.id === calloutId);
    if (!callout) return;

    const state = mpInternal.controllerState;
    const senderName = getLocalDoctorDisplayName();
    const roleObj = SQUAD_CLINICAL_ROLES_3D[mpInternal.selectedRoleId]
        || SQUAD_CLINICAL_ROLES_3D.lider_reanimacion;

    appendMultiplayerFeedLine(`📢 [${roleObj.shortLabel}] ${callout.message}`);
    renderViewportCalloutBanner3D(`${senderName} (${roleObj.shortLabel})`, callout.message, callout.tone);

    if (typeof mpInternal.onSquadActionSynced === "function") {
        mpInternal.onSquadActionSynced({
            actionId: `callout_${callout.id}`,
            actionName: `Orden Táctica: "${callout.message}"`,
            user: senderName
        });
    }

    if (state && state.multiplayer?.connected) {
        postToBroadcastChannel3D({
            type: "TACTICAL_CALLOUT",
            roomCode: state.multiplayer.roomCode,
            peerId: mpInternal.localPeerId,
            user: senderName,
            roleShort: roleObj.shortLabel,
            calloutId: callout.id,
            message: callout.message,
            tone: callout.tone,
            timestamp: Date.now()
        });
    }
}

/**
 * Solicita al residente cooperativo (Bot de Guardia UCI) que evalúe el escenario 3D activo
 * y sugiera o ejecute la siguiente maniobra crítica pendiente en equipo.
 */
export function triggerAssistBotAction3D() {
    const state = mpInternal.controllerState;
    if (!state || !state.activeScenario) return;

    if (!state.multiplayer?.connected) {
        renderViewportCalloutBanner3D(
            "Escuadrón Cooperativo Offline",
            "Pulsa 'Conectar' en el panel Escuadrón Cooperativo para habilitar la asistencia de residentes en sala.",
            "warning"
        );
        return;
    }

    const objectives = state.activeScenario.objetivosCriticos || [];
    const completed = state.completedObjectives || [];
    const nextPendingObj = objectives.find(obj => !completed.includes(obj.actionId));

    const botMember = (state.multiplayer.squadMembers || []).find(m => !m.isLocal) || {
        nombre: "Dr. Residente Guardia",
        rol: "Soporte Avanzado UCI"
    };

    if (!nextPendingObj) {
        const msg = "Todos los objetivos críticos del código están cumplidos. Paciente hemodinámicamente estable.";
        appendMultiplayerFeedLine(`🤖 [${botMember.nombre}]: ${msg}`);
        renderViewportCalloutBanner3D(botMember.nombre, msg, "secondary");
        return;
    }

    // Buscar el botón en el HUD si la acción está visible o notificar la recomendación táctica
    const actionBtn = document.querySelector(`[data-hud-action="${nextPendingObj.actionId}"]`);
    const suggestionText = `Sugiero aplicar de inmediato: "${nextPendingObj.descripcion}".`;

    appendMultiplayerFeedLine(`🤖 [${botMember.nombre}]: ${suggestionText}`);
    updateMemberLastActionTag(botMember.nombre, nextPendingObj.descripcion);
    renderViewportCalloutBanner3D(`${botMember.nombre} • Asistencia Cooperativa`, suggestionText, "primary");

    if (typeof mpInternal.onSquadActionSynced === "function") {
        mpInternal.onSquadActionSynced({
            actionId: nextPendingObj.actionId,
            actionName: `Asistencia Táctica -> ${nextPendingObj.descripcion}`,
            user: botMember.nombre
        });
    }

    // Si el botón de la maniobra está disponible en el DOM, resaltarlo visualmente para el equipo
    if (actionBtn) {
        actionBtn.classList.add("ring-2", "ring-primary", "animate-pulse");
        setTimeout(() => {
            actionBtn.classList.remove("ring-2", "ring-primary", "animate-pulse");
        }, 3200);
    }
}

// ============================================================================
// 5. SINCRONIZACIÓN MULTI-VENTANA (BROADCASTCHANNEL) Y CLOUD FIRESTORE
// ============================================================================

/**
 * Inicializa `BroadcastChannel` para sincronizar instantáneamente múltiples pestañas
 * o ventanas abiertas en la misma sala cooperativa 3D.
 */
function initLocalBroadcastChannel3D() {
    if (mpInternal.broadcastChannel || typeof window.BroadcastChannel !== "function") return;

    try {
        mpInternal.broadcastChannel = new BroadcastChannel("makai_sim3d_multiplayer_channel");
        mpInternal.broadcastChannel.onmessage = (event) => {
            handleIncomingCooperativePacket3D(event.data);
        };
    } catch (e) {
        // Silencioso en navegadores con restricción de BroadcastChannel
    }
}

/**
 * Envía un paquete al canal cooperativo local.
 * @param {Object} packet
 */
function postToBroadcastChannel3D(packet) {
    if (!mpInternal.broadcastChannel) return;
    try {
        mpInternal.broadcastChannel.postMessage(packet);
    } catch (e) {
        // Silencioso
    }
}

/**
 * Procesa paquetes entrantes desde otros compañeros conectados a la misma sala.
 * @param {Object} packet
 */
function handleIncomingCooperativePacket3D(packet = {}) {
    const state = mpInternal.controllerState;
    if (!state || !state.multiplayer?.connected) return;
    if (!packet || packet.roomCode !== state.multiplayer.roomCode) return;
    if (packet.peerId === mpInternal.localPeerId) return;

    if (packet.timestamp && packet.timestamp <= mpInternal.lastProcessedEventTimestamp) {
        return;
    }
    mpInternal.lastProcessedEventTimestamp = packet.timestamp || Date.now();

    if (packet.type === "MEMBER_JOINED" || packet.type === "ROLE_UPDATED") {
        upsertRemoteSquadMember({
            peerId: packet.peerId,
            nombre: packet.user || "Colega Residente",
            rol: packet.roleLabel || "Médico Cooperativo UCI",
            online: true,
            isLocal: false
        });
        appendMultiplayerFeedLine(`👋 ${packet.user} se unió a la sala (${packet.roleLabel}).`);
        renderSquadMembersCards3D();
    } else if (packet.type === "CLINICAL_ACTION_EXECUTED") {
        updateMemberLastActionTag(packet.user, packet.actionName);
        appendMultiplayerFeedLine(`⚡ [${packet.roleShort || "Equipo"}] ${packet.user}: ${packet.actionName}`);
        renderViewportCalloutBanner3D(
            `Maniobra Sincronizada • ${packet.user}`,
            packet.actionName,
            "secondary"
        );

        if (typeof mpInternal.onSquadActionSynced === "function") {
            mpInternal.onSquadActionSynced({
                actionId: packet.actionId,
                actionName: packet.actionName,
                user: packet.user
            });
        }
    } else if (packet.type === "TACTICAL_CALLOUT") {
        appendMultiplayerFeedLine(`📢 [${packet.user}]: ${packet.message}`);
        renderViewportCalloutBanner3D(
            `${packet.user} (${packet.roleShort || "UCI"})`,
            packet.message,
            packet.tone || "primary"
        );
    }
}

/**
 * Sincroniza el estado de la sala cooperativa con la colección `salas_cooperativas_3d`
 * de Cloud Firestore, midiendo la latencia de red en tiempo real.
 * @param {string} roomCode
 * @param {Object} payload
 */
async function syncRoomStateWithFirestore3D(roomCode, payload = {}) {
    const state = mpInternal.controllerState;
    if (!db || !roomCode || !state) return;

    const startPing = performance.now();
    const roomRef = doc(db, SAFE_COLLECTIONS.MP_ROOMS_3D, roomCode);

    try {
        const snap = await getDoc(roomRef);
        const nowIso = new Date().toISOString();

        const roomData = {
            roomCode,
            scenarioId: state.activeScenario?.id || "sim3d_default",
            scenarioTitle: state.activeScenario?.titulo || "Simulación UCI 3D",
            updatedAt: nowIso,
            vitals: { ...(state.vitals || {}) },
            completedObjectives: [...(state.completedObjectives || [])],
            lastEvent: payload.lastEvent || {
                type: payload.eventType || "HEARTBEAT",
                user: payload.user || getLocalDoctorDisplayName(),
                timestamp: Date.now()
            }
        };

        if (!snap.exists()) {
            await setDoc(roomRef, {
                createdAt: nowIso,
                ...roomData
            });
        } else {
            await updateDoc(roomRef, roomData);
        }

        mpInternal.latencyPingMs = Math.max(12, Math.round(performance.now() - startPing));
        updateMultiplayerPingBadge(mpInternal.latencyPingMs);
    } catch (err) {
        // Si las reglas de Firestore o la conexión están en modo local, operar con latencia local
        mpInternal.latencyPingMs = 14;
        updateMultiplayerPingBadge(mpInternal.latencyPingMs);
    }
}

/**
 * Inicia el ciclo de lectura periódica de la sala en Cloud Firestore para detectar
 * maniobras ejecutadas desde otros dispositivos.
 * @param {string} roomCode
 */
function startCloudRoomPolling3D(roomCode) {
    stopCloudRoomPolling3D();

    mpInternal.cloudSyncIntervalId = setInterval(async () => {
        const state = mpInternal.controllerState;
        if (!state || !state.multiplayer?.connected || !db) return;

        try {
            const roomRef = doc(db, SAFE_COLLECTIONS.MP_ROOMS_3D, roomCode);
            const snap = await getDoc(roomRef);
            if (!snap.exists()) return;

            const data = snap.data();
            if (data?.lastEvent && data.lastEvent.type === "CLINICAL_ACTION_EXECUTED") {
                handleIncomingCooperativePacket3D(data.lastEvent);
            }
        } catch (e) {
            // Silencioso en modo local
        }
    }, 5000);
}

function stopCloudRoomPolling3D() {
    if (mpInternal.cloudSyncIntervalId) {
        clearInterval(mpInternal.cloudSyncIntervalId);
        mpInternal.cloudSyncIntervalId = null;
    }
}

// ============================================================================
// 6. RENDERIZADO DE TARJETAS DEL ESCUADRÓN, AVATARES 3D Y BANNERS HOLOGRÁFICOS
// ============================================================================

/**
 * Construye la plantilla inicial de miembros del escuadrón cooperativo evitando duplicar roles.
 * @param {string} localUserName
 * @param {Object} localRole
 * @returns {Array}
 */
function buildInitialSquadRoster(localUserName, localRole) {
    const allRoles = Object.values(SQUAD_CLINICAL_ROLES_3D);
    const companionRoles = allRoles.filter(r => r.id !== localRole.id).slice(0, 2);

    const botNames = [
        "Dr. Residente Guardia",
        "Enf. Especialista UCI",
        "Dr. Internista Trauma"
    ];

    const roster = [
        {
            peerId: mpInternal.localPeerId,
            nombre: `${localUserName} (Tú)`,
            rol: localRole.label,
            roleShort: localRole.shortLabel,
            color: localRole.color,
            online: true,
            isLocal: true,
            lastAction: "En posición • Listo"
        }
    ];

    companionRoles.forEach((r, idx) => {
        roster.push({
            peerId: `bot_uci_${idx + 1}`,
            nombre: botNames[idx] || `Residente UCI ${idx + 1}`,
            rol: r.label,
            roleShort: r.shortLabel,
            color: r.color,
            online: true,
            isLocal: false,
            lastAction: "Monitorizando signos vitales"
        });
    });

    return roster;
}

/**
 * Renderiza las tarjetas detalladas de cada integrante del escuadrón en `#engine3d-mp-squad-list`.
 */
export function renderSquadMembersCards3D() {
    const squadList = document.getElementById("engine3d-mp-squad-list");
    const state = mpInternal.controllerState;
    if (!squadList || !state) return;

    const members = state.multiplayer?.squadMembers || [];
    if (members.length === 0) {
        squadList.innerHTML = `<p class="text-[11px] text-gray-500">Conéctate a una sala para sincronizar maniobras 3D en equipo.</p>`;
        return;
    }

    squadList.innerHTML = members.map(member => `
        <div class="bg-surface border ${member.isLocal ? "border-primary/50" : "border-surface-high"} rounded-xl p-2.5 space-y-1 transition-all">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0"></span>
                    <span class="text-xs font-extrabold text-white truncate">${member.nombre}</span>
                </div>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/15 text-primary shrink-0">
                    ${member.roleShort || "UCI"}
                </span>
            </div>
            <div class="text-[10px] font-mono text-gray-400 truncate">
                ${member.rol}
            </div>
            <div class="text-[10px] font-mono text-secondary truncate">
                ↳ ${member.lastAction || "En espera de orden"}
            </div>
        </div>
    `).join("");
}

/**
 * Inserta o actualiza un colega remoto en `engine3DState.multiplayer.squadMembers`.
 * @param {Object} remoteMember
 */
function upsertRemoteSquadMember(remoteMember) {
    const state = mpInternal.controllerState;
    if (!state || !Array.isArray(state.multiplayer?.squadMembers)) return;

    const list = state.multiplayer.squadMembers;
    const existingIdx = list.findIndex(m => m.peerId === remoteMember.peerId || m.nombre === remoteMember.nombre);

    if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...remoteMember };
    } else {
        list.push(remoteMember);
    }
}

/**
 * Actualiza el texto de la última maniobra realizada por un miembro del escuadrón.
 * @param {string} memberName
 * @param {string} actionLabel
 */
function updateMemberLastActionTag(memberName, actionLabel) {
    const state = mpInternal.controllerState;
    if (!state || !Array.isArray(state.multiplayer?.squadMembers)) return;

    const target = state.multiplayer.squadMembers.find(
        m => m.nombre.includes(memberName) || (m.isLocal && memberName === getLocalDoctorDisplayName())
    );
    if (target) {
        target.lastAction = actionLabel;
        renderSquadMembersCards3D();
    }
}

/**
 * Añade una línea al feed en vivo de sincronización cooperativa (`#engine3d-mp-live-feed`).
 * @param {string} text
 */
function appendMultiplayerFeedLine(text) {
    const timeStr = new Date().toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    mpInternal.recentFeed.unshift(`[${timeStr}] ${text}`);
    mpInternal.recentFeed = mpInternal.recentFeed.slice(0, 15);

    const feedEl = document.getElementById("engine3d-mp-live-feed");
    if (!feedEl) return;

    feedEl.classList.remove("hidden");
    feedEl.innerHTML = mpInternal.recentFeed.map((line, idx) => `
        <div class="${idx === 0 ? "text-secondary font-bold" : "text-gray-400"} leading-snug">
            ${line}
        </div>
    `).join("");
}

/**
 * Muestra un banner holográfico temporal en la parte superior central del visor 3D
 * cuando un integrante del escuadrón emite una orden o sincroniza una maniobra.
 * @param {string} header
 * @param {string} body
 * @param {string} tone
 */
function renderViewportCalloutBanner3D(header, body, tone = "primary") {
    const viewport = document.getElementById("engine3d-viewport-wrapper");
    if (!viewport) return;

    let banner = document.getElementById("engine3d-mp-callout-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "engine3d-mp-callout-banner";
        banner.className = "
            pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-16 z-30
            w-[90%] max-w-md rounded-xl px-4 py-2.5 border backdrop-blur-md
            shadow-[0_0_25px_rgba(0,0,0,0.85)] transition-all duration-300
        ";
        viewport.appendChild(banner);
    }

    const toneClasses = {
        primary: "bg-[#04070b]/90 border-primary text-primary",
        secondary: "bg-[#04070b]/90 border-secondary text-secondary",
        warning: "bg-[#04070b]/90 border-warning text-warning",
        danger: "bg-[#04070b]/90 border-danger text-danger"
    };

    banner.className = `
        pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-16 z-30
        w-[90%] max-w-md rounded-xl px-4 py-2.5 border backdrop-blur-md
        shadow-[0_0_25px_rgba(0,0,0,0.85)] transition-all duration-300
        ${toneClasses[tone] || toneClasses.primary}
    `;

    banner.innerHTML = `
        <div class="flex items-center justify-between text-[10px] font-mono uppercase font-extrabold">
            <span>📡 ${header}</span>
            <span>SALA ${mpInternal.controllerState?.multiplayer?.roomCode || "UCI"}</span>
        </div>
        <div class="text-xs font-bold text-white mt-0.5 leading-snug">
            ${body}
        </div>
    `;

    clearTimeout(banner.__hideTimer);
    banner.__hideTimer = setTimeout(() => {
        banner?.remove();
    }, 3800);
}

/**
 * Actualiza el indicador de latencia (Ping) en el panel cooperativo.
 * @param {number|null} pingMs
 */
function updateMultiplayerPingBadge(pingMs) {
    const pingEl = document.getElementById("engine3d-mp-ping-badge");
    if (!pingEl) return;

    if (typeof pingMs === "number") {
        pingEl.className = "text-[10px] font-mono text-secondary font-bold";
        pingEl.textContent = `Ping: ${pingMs} ms`;
    } else {
        pingEl.className = "text-[10px] font-mono text-gray-500";
        pingEl.textContent = "Ping: -- ms";
    }
}

/**
 * Envía las posiciones y roles del escuadrón hacia la instancia de Unity WebGL si está activa.
 */
function syncSquadAvatarsWithWebGL() {
    const state = mpInternal.controllerState;
    if (!state || !state.unityInstance || typeof state.unityInstance.SendMessage !== "function") return;

    try {
        state.unityInstance.SendMessage(
            "MakaiPatientController",
            "SyncMultiplayerSquad",
            JSON.stringify(state.multiplayer.squadMembers || [])
        );
    } catch (e) {
        // Silencioso si el receptor de avatares en Unity tiene otro nombre
    }
}

/**
 * Obtiene el nombre formateado del estudiante o administrador con sesión activa.
 * @returns {string}
 */
function getLocalDoctorDisplayName() {
    const nameFromState = appState.currentUserData?.nombre || appState.currentUserData?.displayName;
    if (nameFromState) return nameFromState;

    const email = auth.currentUser?.email || appState.currentUserData?.email || "";
    if (isMasterAdmin(email)) return "Admin Maestro UCI";
    if (email) return `Dr(a). ${email.split("@")[0]}`;

    return "Médico Líder UCI";
}
