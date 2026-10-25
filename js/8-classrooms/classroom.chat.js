// ============================================================================
// ARCHIVO: js/8-classrooms/classroom.chat.js
// DESCRIPCIÓN: Subcomponente de Interacción Docente para Aulas Virtuales.
//              Gestiona el panel lateral de Chat en Vivo, el Buzón de Preguntas
//              Directas al Especialista y la Descarga de Material de Apoyo
//              (Guías PDF, Diapositivas y Algoritmos) por clase y semestre.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    canAccessBySubscription
} from "../2-core/state.store.js";

// ============================================================================
// 1. COLECCIONES SEGURAS, SEMILLAS Y ESTADO INTERNO DEL SUBCOMPONENTE
// ============================================================================

const SAFE_COLLECTIONS = Object.freeze({
    CHAT_MESSAGES: COLLECTIONS?.CLASSROOM_CHAT || "chat_aulas_virtuales",
    SPECIALIST_QA: COLLECTIONS?.CLASSROOM_QA || "buzon_especialista_aulas",
    STUDY_MATERIALS: COLLECTIONS?.MATERIALS || "materiales_estudio"
});

/**
 * Reacciones rápidas clínicas para sesiones en vivo y clases grabadas.
 */
export const CLASSROOM_QUICK_REACTIONS = Object.freeze([
    { id: "understand", emoji: "🧠", label: "Concepto Claro" },
    { id: "key_pearl", emoji: "💎", label: "Perla CACES" },
    { id: "question", emoji: "✋", label: "Duda Clínica" },
    { id: "ecg_alert", emoji: "⚡", label: "Signo Crítico" }
]);

/**
 * Mensajes semilla por defecto para garantizar experiencia inmediata en modo local/offline.
 */
const DEFAULT_SEED_CHAT_MESSAGES = [
    {
        id: "seed_msg_1",
        classId: "default_class",
        authorName: "Dr. Especialista Makai",
        authorEmail: "anthonnyvelastegui@gmail.com",
        authorRole: "admin",
        subscriptionTier: "VIP",
        message: "Bienvenidos al Aula Virtual de MakaiAcademy. Pueden dejar sus dudas en el chat en vivo o enviarlas al Buzón del Especialista indicando el minuto del video.",
        videoTimestampSec: 0,
        videoTimestampFormatted: "00:00",
        isPinned: true,
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString()
    },
    {
        id: "seed_msg_2",
        classId: "default_class",
        authorName: "Md. Residente Guardia",
        authorEmail: "residente@makai.ec",
        authorRole: "estudiante",
        subscriptionTier: "PRO",
        message: "Excelente algoritmo diagnóstico en el minuto 04:15 para diferenciar el manejo inicial según las guías del MSP.",
        videoTimestampSec: 255,
        videoTimestampFormatted: "04:15",
        isPinned: false,
        createdAt: new Date(Date.now() - 1800 * 1000).toISOString()
    }
];

/**
 * Preguntas semilla para el Buzón del Especialista.
 */
const DEFAULT_SEED_SPECIALIST_QA = [
    {
        id: "seed_qa_1",
        classId: "default_class",
        studentName: "Int. Camila V.",
        studentEmail: "camila@makai.ec",
        subscriptionTier: "VIP",
        topic: "Criterio de elección farmacológica en preguntas CACES",
        question: "Doctor, cuando el caso clínico menciona contraindicación absoluta al fármaco de primera línea pero el paciente está hemodinámicamente inestable, ¿qué prioriza la matriz de calificación del CACES?",
        videoTimestampSec: 380,
        videoTimestampFormatted: "06:20",
        status: "respondida",
        upvotes: 8,
        upvotedBy: [],
        specialistAnswer: "En el estándar de evaluación CACES y GPC del MSP, la inestabilidad hemodinámica manda sobre la terapia escalonada oral: debes estabilizar primero (conducta eléctrica o soporte vasoactivo/vía aérea según el caso) antes de pasar al fármaco de segunda línea.",
        answeredBy: "Dr. Especialista Makai",
        answeredAt: new Date(Date.now() - 900 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 2400 * 1000).toISOString()
    }
];

/**
 * Materiales de apoyo semilla vinculados a la bóveda multimedia oficial (`assets/`).
 */
const DEFAULT_SEED_SUPPORT_MATERIALS = [
    {
        id: "mat_class_gpc_01",
        classId: "default_class",
        titulo: "Guía de Práctica Clínica (GPC) y Algoritmo Oficial de la Clase",
        tipo: "pdf",
        formato: "PDF • Descarga Directa",
        tamano: "2.4 MB",
        nivelRequerido: "Básico",
        url: "assets/5-multimedia-1d/guias-pdf/gpc-resumen-clase.pdf",
        descripcion: "Resumen estructurado con puntos clave, escalas diagnósticas y perlas de alto rendimiento."
    },
    {
        id: "mat_class_slides_02",
        classId: "default_class",
        titulo: "Presentación Magistral del Especialista (Diapositivas HD)",
        tipo: "slides",
        formato: "PDF / Infografía",
        tamano: "4.8 MB",
        nivelRequerido: "PRO",
        url: "assets/5-multimedia-1d/infografias-y-algoritmos/algoritmo-magistral-clase.png",
        descripcion: "Láminas proyectadas durante la clase con tablas diferenciales y esquemas terapéuticos."
    },
    {
        id: "mat_class_vip_03",
        classId: "default_class",
        titulo: "Dossier de Casos Clínicos Comentados • Mentoría Élite VIP",
        tipo: "dossier_vip",
        formato: "PDF • Bóveda VIP",
        tamano: "3.1 MB",
        nivelRequerido: "VIP",
        url: "assets/8-multimedia-aulas/portadas-clases/dossier-casos-vip.pdf",
        descripcion: "Banco exclusivo de simulacros comentados línea por línea por el docente especialista."
    }
];

const chatState = {
    initialized: false,
    activeTab: "chat", // "chat" | "qa" | "materials"
    activeClass: {
        id: "aula_general_caces",
        titulo: "Sesión Magistral • Integración Clínica y Razonamiento CACES",
        carrera: "medicina",
        etapa: "caces",
        materia: "Medicina Interna",
        especialista: "Dr. Especialista Makai",
        modalidad: "vod" // "live" | "vod"
    },
    messages: [],
    questions: [],
    materials: [],
    broadcastChannel: null,
    pollingIntervalId: null,
    getVideoCurrentTimeCallback: null,
    seekVideoCallback: null,
    onResourceOpenedCallback: null
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL SUBCOMPONENTE DE INTERACCIÓN DOCENTE
// ============================================================================

/**
 * Inicializa el panel lateral de Chat en Vivo, Buzón al Especialista y Material de Apoyo.
 * Invocado por `classroom.controller.js`.
 * @param {Object} config
 * @param {HTMLElement|string} [config.container] - Contenedor DOM o ID donde montar el panel.
 * @param {Object} [config.activeClass] - Datos de la clase inicialmente activa.
 * @param {Function} [config.getVideoCurrentTime] - Función que retorna el segundo actual del reproductor VOD/Live.
 * @param {Function} [config.onSeekVideo] - Callback para saltar a un minuto (`mm:ss`) del video al pulsar un timestamp.
 * @param {Function} [config.onResourceOpened] - Callback opcional al abrir o descargar un material.
 */
export async function initClassroomChat(config = {}) {
    if (typeof config.getVideoCurrentTime === "function") {
        chatState.getVideoCurrentTimeCallback = config.getVideoCurrentTime;
    }
    if (typeof config.onSeekVideo === "function") {
        chatState.seekVideoCallback = config.onSeekVideo;
    }
    if (typeof config.onResourceOpened === "function") {
        chatState.onResourceOpenedCallback = config.onResourceOpened;
    }
    if (config.activeClass && typeof config.activeClass === "object") {
        chatState.activeClass = { ...chatState.activeClass, ...config.activeClass };
    }

    const mountContainer = resolveChatMountContainer(config.container);
    if (mountContainer) {
        buildClassroomChatSidebarUI(mountContainer);
    }

    initClassroomBroadcastChannel();
    bindCurriculumChangeListener();

    await loadClassroomChatSession(chatState.activeClass);

    chatState.initialized = true;
    return chatState;
}

// Alias de compatibilidad para `classroom.controller.js` y `app.orchestrator.js`
export const initChatSubcomponent = initClassroomChat;

/**
 * Localiza o construye el contenedor lateral dentro de `#view-classrooms`.
 * @param {HTMLElement|string} customTarget
 * @returns {HTMLElement|null}
 */
function resolveChatMountContainer(customTarget) {
    if (customTarget instanceof HTMLElement) return customTarget;
    if (typeof customTarget === "string") {
        const el = document.getElementById(customTarget) || document.querySelector(customTarget);
        if (el) return el;
    }

    const knownIds = [
        "classroom-chat-panel",
        "classroom-interaction-sidebar",
        "classroom-chat-container",
        "classroom-sidebar-right"
    ];

    for (const id of knownIds) {
        const found = document.getElementById(id);
        if (found) return found;
    }

    const classroomsView = document.getElementById("view-classrooms");
    if (!classroomsView) return null;

    let wrapper = document.getElementById("classroom-chat-panel");
    if (!wrapper) {
        wrapper = document.createElement("aside");
        wrapper.id = "classroom-chat-panel";
        wrapper.className = "w-full lg:w-96 shrink-0 bg-surface-container border border-surface-high rounded-2xl flex flex-col overflow-hidden shadow-2xl";
        classroomsView.appendChild(wrapper);
    }

    return wrapper;
}

// ============================================================================
// 3. CONSTRUCCIÓN DE LA INTERFAZ DEL PANEL LATERAL (3 PESTAÑAS)
// ============================================================================

/**
 * Construye la estructura HTML completa del panel de interacción docente:
 * 1) Chat en Vivo, 2) Buzón al Especialista, 3) Material de Apoyo.
 * @param {HTMLElement} container
 */
function buildClassroomChatSidebarUI(container) {
    if (!container) return;

    const isAdmin = isUserMasterAdmin();

    container.innerHTML = `
        <!-- CABECERA DEL PANEL DE INTERACCIÓN DOCENTE -->
        <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between gap-2">
            <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    <span id="classroom-chat-header-badge" class="text-[10px] font-mono uppercase tracking-widest text-primary font-extrabold">
                        Interacción Docente • En Línea
                    </span>
                </div>
                <h3 id="classroom-chat-class-title" class="text-xs font-extrabold text-white truncate mt-0.5">
                    ${escapeHtml(chatState.activeClass.titulo)}
                </h3>
            </div>
            <span id="classroom-chat-specialist-tag" class="px-2 py-1 rounded-lg bg-primary/10 border border-primary/30 text-[10px] font-mono text-primary font-bold shrink-0">
                ${escapeHtml(chatState.activeClass.especialista || "Especialista")}
            </span>
        </div>

        <!-- SELECTOR DE LAS 3 PESTAÑAS (CHAT / BUZÓN ESPECIALISTA / MATERIALES) -->
        <div class="grid grid-cols-3 bg-surface border-b border-surface-high p-1 gap-1 text-[11px] font-extrabold">
            <button
                type="button"
                data-classroom-tab="chat"
                class="classroom-tab-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all bg-primary text-surface"
            >
                <span class="material-symbols-outlined text-sm">forum</span>
                <span>Chat</span>
                <span id="classroom-badge-chat-count" class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-surface/20">0</span>
            </button>
            <button
                type="button"
                data-classroom-tab="qa"
                class="classroom-tab-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all text-gray-400 hover:text-white hover:bg-surface-high"
            >
                <span class="material-symbols-outlined text-sm">clinical_notes</span>
                <span>Especialista</span>
                <span id="classroom-badge-qa-count" class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-surface-high text-primary">0</span>
            </button>
            <button
                type="button"
                data-classroom-tab="materials"
                class="classroom-tab-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all text-gray-400 hover:text-white hover:bg-surface-high"
            >
                <span class="material-symbols-outlined text-sm">folder_Down</span>
                <span>Materiales</span>
                <span id="classroom-badge-mat-count" class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-surface-high text-secondary">0</span>
            </button>
        </div>

        <!-- ================================================================ -->
        <!-- PESTAÑA 1: CHAT EN VIVO DE LA CLASE                              -->
        <!-- ================================================================ -->
        <div id="classroom-tab-panel-chat" class="flex-1 flex flex-col min-h-[420px] max-h-[600px]">
            <!-- Mensaje Fijado por el Especialista / Admin -->
            <div id="classroom-pinned-message-box" class="hidden bg-primary/10 border-b border-primary/30 px-3.5 py-2.5 text-xs">
            </div>

            <!-- Lista de Mensajes en Tiempo Real -->
            <div id="classroom-chat-messages-list" class="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans">
                <div class="text-center text-xs text-gray-500 py-8 font-mono">
                    Sincronizando chat del aula virtual...
                </div>
            </div>

            <!-- Barra de Reacciones Clínicas Rápidas -->
            <div class="px-3 py-1.5 bg-surface/80 border-t border-surface-high flex items-center justify-between gap-1 overflow-x-auto">
                ${CLASSROOM_QUICK_REACTIONS.map(r => `
                    <button
                        type="button"
                        data-chat-reaction="${r.id}"
                        class="classroom-reaction-btn px-2 py-1 rounded-lg bg-surface-high hover:bg-primary/20 border border-transparent hover:border-primary/40 text-[10px] font-mono text-gray-300 hover:text-white transition-all flex items-center gap-1 shrink-0"
                        title="Enviar reacción rápida: ${r.label}"
                    >
                        <span>${r.emoji}</span>
                        <span>${r.label}</span>
                    </button>
                `).join("")}
            </div>

            <!-- Formulario de Envío de Mensaje -->
            <form id="classroom-chat-form" class="p-3 bg-surface border-t border-surface-high space-y-2">
                <div class="flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <label class="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" id="classroom-chat-attach-time" checked class="accent-[#00e5ff] rounded">
                        <span>Vincular minuto actual del video</span>
                    </label>
                    <span id="classroom-chat-current-time-preview" class="text-primary font-bold">⏱ 00:00</span>
                </div>
                <div class="flex items-center gap-2">
                    <input
                        type="text"
                        id="classroom-chat-input"
                        maxlength="380"
                        placeholder="Escribe un comentario o aporte clínico en la clase..."
                        class="flex-1 bg-surface-container border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
                        required
                    >
                    <button
                        type="submit"
                        id="btn-classroom-chat-send"
                        class="px-3.5 py-2 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90 transition-all flex items-center gap-1 shrink-0 shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                    >
                        <span class="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- ================================================================ -->
        <!-- PESTAÑA 2: BUZÓN DE PREGUNTAS DIRECTAS AL ESPECIALISTA           -->
        <!-- ================================================================ -->
        <div id="classroom-tab-panel-qa" class="hidden flex-1 flex flex-col min-h-[420px] max-h-[600px]">
            <!-- Cabecera informativa del Buzón -->
            <div class="p-3 bg-surface/60 border-b border-surface-high flex items-center justify-between gap-2">
                <p class="text-[11px] text-gray-300 leading-snug">
                    Envía tu duda clínica directa al especialista. Las preguntas con más votos se priorizan en vivo.
                </p>
                <button
                    type="button"
                    id="btn-toggle-qa-form"
                    class="px-2.5 py-1.5 rounded-xl bg-secondary text-surface font-extrabold text-[11px] hover:bg-opacity-90 transition-all shrink-0"
                >
                    + Hacer Pregunta
                </button>
            </div>

            <!-- Formulario colapsable para nueva pregunta al especialista -->
            <form id="classroom-qa-form" class="hidden p-3.5 bg-surface border-b border-primary/40 space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        Nueva Consulta para el Especialista
                    </span>
                    <span id="classroom-qa-timestamp-badge" class="text-[10px] font-mono text-secondary font-bold">
                        Minuto ref: 00:00
                    </span>
                </div>
                <input
                    type="text"
                    id="classroom-qa-topic"
                    maxlength="110"
                    placeholder="Tema o patología (ej. Manejo de Preeclampsia Severa / Dosis Sulfato)"
                    class="w-full bg-surface-container border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                >
                <textarea
                    id="classroom-qa-question"
                    rows="3"
                    maxlength="600"
                    placeholder="Describe tu duda clínica con el mayor detalle posible..."
                    class="w-full bg-surface-container border border-surface-high focus:border-primary rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
                    required
                ></textarea>
                <div class="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        id="btn-cancel-qa-form"
                        class="px-3 py-1.5 rounded-xl bg-surface-high text-gray-300 text-xs font-bold hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        id="btn-submit-qa-form"
                        class="px-3.5 py-1.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:bg-opacity-90"
                    >
                        Enviar al Especialista
                    </button>
                </div>
            </form>

            <!-- Listado de Preguntas y Respuestas Oficiales -->
            <div id="classroom-qa-list" class="flex-1 overflow-y-auto p-3.5 space-y-3">
            </div>
        </div>

        <!-- ================================================================ -->
        <!-- PESTAÑA 3: DESCARGA DE MATERIAL DE APOYO DE LA CLASE             -->
        <!-- ================================================================ -->
        <div id="classroom-tab-panel-materials" class="hidden flex-1 flex flex-col min-h-[420px] max-h-[600px]">
            <div class="p-3 bg-surface/60 border-b border-surface-high flex items-center justify-between gap-2">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        Recursos Oficiales de la Sesión
                    </span>
                    <p class="text-[11px] text-gray-400">
                        Guías PDF, algoritmos diagnósticos y diapositivas de esta clase.
                    </p>
                </div>
                ${isAdmin ? `
                    <button
                        type="button"
                        id="btn-admin-quick-add-material"
                        class="px-2.5 py-1 rounded-lg bg-primary/15 border border-primary text-primary text-[10px] font-mono font-extrabold hover:bg-primary hover:text-surface transition-all shrink-0"
                        title="Añadir recurso de apoyo a esta clase (Solo Admin Maestro)"
                    >
                        + Adjuntar PDF
                    </button>
                ` : ""}
            </div>

            <!-- Lista de Materiales Descargables -->
            <div id="classroom-materials-list" class="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            </div>
        </div>
    `;

    bindClassroomChatUIEvents(container);
}

/**
 * Enlaza todos los eventos interactivos del panel lateral.
 * @param {HTMLElement} container
 */
function bindClassroomChatUIEvents(container) {
    // 1. Conmutación entre las 3 pestañas
    container.querySelectorAll(".classroom-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchClassroomChatTab(btn.dataset.classroomTab);
        });
    });

    // 2. Envío de mensajes en el chat en vivo
    const chatForm = document.getElementById("classroom-chat-form");
    chatForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputEl = document.getElementById("classroom-chat-input");
        const attachTimeEl = document.getElementById("classroom-chat-attach-time");
        const text = inputEl?.value?.trim();
        if (!text) return;

        inputEl.value = "";
        await sendLiveChatMessage(text, {
            attachTimestamp: attachTimeEl ? attachTimeEl.checked : true
        });
    });

    // 3. Botones de reacciones rápidas
    container.querySelectorAll(".classroom-reaction-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const reactionId = btn.dataset.chatReaction;
            const reaction = CLASSROOM_QUICK_REACTIONS.find(r => r.id === reactionId);
            if (!reaction) return;
            await sendLiveChatMessage(`${reaction.emoji} ${reaction.label}`, {
                attachTimestamp: true,
                isQuickReaction: true
            });
        });
    });

    // 4. Apertura/cierre del formulario del Buzón del Especialista
    const toggleQaBtn = document.getElementById("btn-toggle-qa-form");
    const cancelQaBtn = document.getElementById("btn-cancel-qa-form");
    const qaForm = document.getElementById("classroom-qa-form");

    toggleQaBtn?.addEventListener("click", () => {
        if (!qaForm) return;
        const isHidden = qaForm.classList.contains("hidden");
        if (isHidden) {
            const currentSec = getCurrentClassVideoTimeSeconds();
            const badge = document.getElementById("classroom-qa-timestamp-badge");
            if (badge) badge.textContent = `Minuto ref: ${formatSecondsToMMSS(currentSec)}`;
            qaForm.classList.remove("hidden");
            document.getElementById("classroom-qa-topic")?.focus();
        } else {
            qaForm.classList.add("hidden");
        }
    });

    cancelQaBtn?.addEventListener("click", () => {
        qaForm?.classList.add("hidden");
    });

    // 5. Envío de pregunta directa al especialista
    qaForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const topicInput = document.getElementById("classroom-qa-topic");
        const questionInput = document.getElementById("classroom-qa-question");

        const topic = topicInput?.value?.trim();
        const question = questionInput?.value?.trim();
        if (!topic || !question) return;

        await submitSpecialistQuestion({
            topic,
            question,
            videoTimestampSec: getCurrentClassVideoTimeSeconds()
        });

        topicInput.value = "";
        questionInput.value = "";
        qaForm.classList.add("hidden");
    });

    // 6. Botón rápido para que el Administrador Maestro adjunte un recurso a la clase
    const adminAddMatBtn = document.getElementById("btn-admin-quick-add-material");
    adminAddMatBtn?.addEventListener("click", () => {
        openAdminQuickAddMaterialPrompt();
    });

    // 7. Actualizar vista previa del reloj del video cada segundo
    if (chatState.pollingIntervalId) clearInterval(chatState.pollingIntervalId);
    chatState.pollingIntervalId = setInterval(() => {
        const previewEl = document.getElementById("classroom-chat-current-time-preview");
        if (previewEl) {
            const sec = getCurrentClassVideoTimeSeconds();
            previewEl.textContent = `⏱ ${formatSecondsToMMSS(sec)}`;
        }
    }, 1000);
}

/**
 * Cambia entre las pestañas "chat", "qa" y "materials" dentro del panel lateral.
 * @param {string} tabId
 */
export function switchClassroomChatTab(tabId = "chat") {
    const validTabs = ["chat", "qa", "materials"];
    const targetTab = validTabs.includes(tabId) ? tabId : "chat";
    chatState.activeTab = targetTab;

    validTabs.forEach(t => {
        const panel = document.getElementById(`classroom-tab-panel-${t}`);
        if (panel) {
            if (t === targetTab) {
                panel.classList.remove("hidden");
            } else {
                panel.classList.add("hidden");
            }
        }
    });

    document.querySelectorAll(".classroom-tab-btn").forEach(btn => {
        const isCurrent = btn.dataset.classroomTab === targetTab;
        if (isCurrent) {
            btn.className = "classroom-tab-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all bg-primary text-surface";
        } else {
            btn.className = "classroom-tab-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all text-gray-400 hover:text-white hover:bg-surface-high";
        }
    });
}

// ============================================================================
// 4. CARGA Y SINCRONIZACIÓN DE LA SESIÓN POR CLASE (FIRESTORE + SEMILLA)
// ============================================================================

/**
 * Carga los mensajes del chat, preguntas al especialista y materiales de apoyo
 * correspondientes a la clase seleccionada en `classroom.controller.js`.
 * @param {Object} classItem
 */
export async function loadClassroomChatSession(classItem = {}) {
    if (classItem && typeof classItem === "object") {
        chatState.activeClass = {
            ...chatState.activeClass,
            ...classItem,
            id: classItem.id || classItem.classId || chatState.activeClass.id || "aula_general_caces"
        };
    }

    const activeClassId = chatState.activeClass.id;

    // Actualizar cabecera visual del panel
    const titleEl = document.getElementById("classroom-chat-class-title");
    const specEl = document.getElementById("classroom-chat-specialist-tag");
    if (titleEl) titleEl.textContent = chatState.activeClass.titulo || "Aula Virtual MakaiAcademy";
    if (specEl) specEl.textContent = chatState.activeClass.especialista || "Dr. Especialista";

    // Cargar en paralelo Mensajes, Preguntas del Buzón y Materiales de Apoyo
    const [loadedMessages, loadedQuestions, loadedMaterials] = await Promise.all([
        fetchClassChatMessagesFromFirestore(activeClassId),
        fetchSpecialistQuestionsFromFirestore(activeClassId),
        fetchClassSupportMaterialsFromFirestore(chatState.activeClass)
    ]);

    chatState.messages = loadedMessages;
    chatState.questions = loadedQuestions;
    chatState.materials = loadedMaterials;

    renderChatMessagesList();
    renderSpecialistQuestionsList();
    renderClassSupportMaterials(chatState.materials);
    updateClassroomSidebarBadges();
}

/**
 * Obtiene los mensajes del chat de Cloud Firestore para la clase indicada o retorna la semilla.
 * @param {string} classId
 * @returns {Promise<Array>}
 */
async function fetchClassChatMessagesFromFirestore(classId) {
    const seedForClass = DEFAULT_SEED_CHAT_MESSAGES.map(m => ({
        ...m,
        classId
    }));

    if (!db) return seedForClass;

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.CHAT_MESSAGES));
        const cloudMessages = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.classId || data.classId === classId || data.classId === "default_class") {
                cloudMessages.push({ id: docSnap.id, ...data });
            }
        });

        if (cloudMessages.length === 0) return seedForClass;

        cloudMessages.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
        return cloudMessages;
    } catch (e) {
        return seedForClass;
    }
}

/**
 * Obtiene las preguntas del Buzón del Especialista desde Cloud Firestore.
 * @param {string} classId
 * @returns {Promise<Array>}
 */
async function fetchSpecialistQuestionsFromFirestore(classId) {
    const seedQA = DEFAULT_SEED_SPECIALIST_QA.map(q => ({
        ...q,
        classId
    }));

    if (!db) return seedQA;

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.SPECIALIST_QA));
        const cloudQA = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.classId || data.classId === classId || data.classId === "default_class") {
                cloudQA.push({ id: docSnap.id, ...data });
            }
        });

        if (cloudQA.length === 0) return seedQA;

        cloudQA.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
        return cloudQA;
    } catch (e) {
        return seedQA;
    }
}

/**
 * Obtiene los materiales de apoyo de la clase combinando los recursos propios del objeto
 * `classItem.materiales`, la colección `materiales_estudio` en Firestore y la semilla.
 * @param {Object} classObj
 * @returns {Promise<Array>}
 */
async function fetchClassSupportMaterialsFromFirestore(classObj = {}) {
    const customMaterials = Array.isArray(classObj.materiales) ? [...classObj.materiales] : [];
    const results = [...customMaterials];

    if (db) {
        try {
            const snap = await getDocs(collection(db, SAFE_COLLECTIONS.STUDY_MATERIALS));
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const matchesClass = data.classId && data.classId === classObj.id;
                const matchesSubject = classObj.materia && data.materia &&
                    data.materia.toLowerCase() === classObj.materia.toLowerCase();
                const matchesCareer = classObj.carrera && data.carrera === classObj.carrera;

                if (matchesClass || matchesSubject || matchesCareer) {
                    results.push({
                        id: docSnap.id,
                        titulo: data.titulo || data.nombre || "Recurso Clínico PDF",
                        tipo: data.tipo || "pdf",
                        formato: (data.tipo || "PDF").toUpperCase(),
                        tamano: data.tamano || "1.8 MB",
                        nivelRequerido: data.nivelSuscripcion || data.nivelRequerido || "Básico",
                        url: data.url || data.rutaArchivo || "assets/5-multimedia-1d/guias-pdf/gpc-resumen-clase.pdf",
                        descripcion: data.descripcion || `Material de apoyo para ${data.materia || "la sesión"}.`
                    });
                }
            });
        } catch (e) {
            // Continúa con materiales semilla
        }
    }

    if (results.length === 0) {
        return DEFAULT_SEED_SUPPORT_MATERIALS.map(item => ({
            ...item,
            classId: classObj.id || "default_class"
        }));
    }

    return results;
}

// ============================================================================
// 5. LÓGICA DEL CHAT EN VIVO (ENVÍO, TIMESTAMPS CLICABLES Y FIJADO DOCENTE)
// ============================================================================

/**
 * Envía un mensaje al chat en vivo de la clase actual, lo transmite por `BroadcastChannel`
 * y lo guarda en Cloud Firestore.
 * @param {string} messageText
 * @param {Object} options
 */
export async function sendLiveChatMessage(messageText, options = {}) {
    const cleanText = String(messageText || "").trim();
    if (!cleanText) return null;

    const profile = getCurrentParticipantIdentity();
    const attachTime = options.attachTimestamp !== false;
    const currentSec = attachTime ? getCurrentClassVideoTimeSeconds() : null;

    const newMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        classId: chatState.activeClass.id,
        authorName: profile.name,
        authorEmail: profile.email,
        authorRole: profile.role,
        subscriptionTier: profile.subscriptionTier,
        message: cleanText,
        videoTimestampSec: typeof currentSec === "number" ? currentSec : null,
        videoTimestampFormatted: typeof currentSec === "number" ? formatSecondsToMMSS(currentSec) : null,
        isPinned: false,
        createdAt: new Date().toISOString()
    };

    chatState.messages.push(newMsg);
    renderChatMessagesList();
    updateClassroomSidebarBadges();

    // 1. Transmitir instantáneamente entre pestañas abiertas
    postClassroomBroadcastEvent({
        type: "NEW_CHAT_MESSAGE",
        classId: chatState.activeClass.id,
        payload: newMsg
    });

    // 2. Guardar en Cloud Firestore
    if (db) {
        try {
            const docRef = await addDoc(collection(db, SAFE_COLLECTIONS.CHAT_MESSAGES), {
                classId: newMsg.classId,
                authorName: newMsg.authorName,
                authorEmail: newMsg.authorEmail,
                authorRole: newMsg.authorRole,
                subscriptionTier: newMsg.subscriptionTier,
                message: newMsg.message,
                videoTimestampSec: newMsg.videoTimestampSec,
                videoTimestampFormatted: newMsg.videoTimestampFormatted,
                isPinned: false,
                createdAt: newMsg.createdAt
            });
            newMsg.id = docRef.id;
        } catch (e) {
            // Mantiene el mensaje en memoria local si Firestore está en modo offline
        }
    }

    return newMsg;
}

/**
 * Permite a un Administrador Maestro fijar o desfijar un mensaje en la cabecera del chat.
 * @param {string} messageId
 */
export async function togglePinChatMessage(messageId) {
    if (!isUserMasterAdmin()) return;

    const target = chatState.messages.find(m => m.id === messageId);
    if (!target) return;

    const nextPinnedState = !target.isPinned;
    chatState.messages.forEach(m => {
        m.isPinned = (m.id === messageId) ? nextPinnedState : false;
    });

    renderChatMessagesList();

    if (db && !String(messageId).startsWith("seed_") && !String(messageId).startsWith("msg_")) {
        try {
            await updateDoc(doc(db, SAFE_COLLECTIONS.CHAT_MESSAGES, messageId), {
                isPinned: nextPinnedState
            });
        } catch (e) {
            // Silencioso en modo local
        }
    }
}

/**
 * Renderiza la lista de mensajes del chat en vivo y el anuncio fijado.
 */
export function renderChatMessagesList() {
    const listEl = document.getElementById("classroom-chat-messages-list");
    const pinnedBox = document.getElementById("classroom-pinned-message-box");
    if (!listEl) return;

    const isAdmin = isUserMasterAdmin();
    const pinnedMsg = chatState.messages.find(m => m.isPinned);

    if (pinnedBox) {
        if (pinnedMsg) {
            pinnedBox.classList.remove("hidden");
            pinnedBox.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="flex items-center gap-1 text-[10px] font-mono text-primary font-extrabold uppercase">
                            <span class="material-symbols-outlined text-xs">keep</span>
                            <span>Aviso Fijado • ${escapeHtml(pinnedMsg.authorName)}</span>
                        </div>
                        <p class="text-xs text-gray-200 mt-0.5 leading-snug">${escapeHtml(pinnedMsg.message)}</p>
                    </div>
                    ${isAdmin ? `
                        <button type="button" id="btn-unpin-active-msg" class="text-[10px] font-mono text-gray-400 hover:text-white shrink-0" title="Desfijar aviso">
                            ✕
                        </button>
                    ` : ""}
                </div>
            `;
            document.getElementById("btn-unpin-active-msg")?.addEventListener("click", () => {
                togglePinChatMessage(pinnedMsg.id);
            });
        } else {
            pinnedBox.classList.add("hidden");
            pinnedBox.innerHTML = "";
        }
    }

    if (chatState.messages.length === 0) {
        listEl.innerHTML = `
            <div class="text-center text-xs text-gray-500 py-8 font-mono">
                Aún no hay mensajes en esta sesión. ¡Inicia la conversación clínica!
            </div>
        `;
        return;
    }

    listEl.innerHTML = chatState.messages.map(msg => {
        const isSpecialist = msg.authorRole === "admin" || isMasterAdmin(msg.authorEmail);
        const roleBadge = isSpecialist
            ? `<span class="px-1.5 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary text-[9px] font-mono font-extrabold">ESPECIALISTA</span>`
            : `<span class="px-1.5 py-0.5 rounded bg-surface-high text-gray-300 text-[9px] font-mono font-bold">${escapeHtml(msg.subscriptionTier || "ALUMNO")}</span>`;

        const hasTimestamp = typeof msg.videoTimestampSec === "number" && msg.videoTimestampFormatted;

        return `
            <div class="rounded-xl p-2.5 border ${isSpecialist ? "bg-primary/5 border-primary/30" : "bg-surface border-surface-high"} space-y-1 transition-all">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-extrabold ${isSpecialist ? "text-primary" : "text-white"} truncate">
                            ${escapeHtml(msg.authorName)}
                        </span>
                        ${roleBadge}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${hasTimestamp ? `
                            <button
                                type="button"
                                data-seek-seconds="${msg.videoTimestampSec}"
                                class="classroom-seek-btn px-1.5 py-0.5 rounded bg-secondary/15 hover:bg-secondary hover:text-surface text-secondary text-[10px] font-mono font-bold transition-all"
                                title="Saltar al minuto ${msg.videoTimestampFormatted} del video"
                            >
                                ▶ ${msg.videoTimestampFormatted}
                            </button>
                        ` : ""}
                        ${isAdmin ? `
                            <button
                                type="button"
                                data-pin-msg-id="${msg.id}"
                                class="classroom-pin-btn text-gray-500 hover:text-primary text-xs"
                                title="${msg.isPinned ? "Desfijar mensaje" : "Fijar mensaje en cabecera"}"
                            >
                                📌
                            </button>
                        ` : ""}
                    </div>
                </div>
                <p class="text-xs text-gray-200 leading-relaxed break-words">
                    ${escapeHtml(msg.message)}
                </p>
            </div>
        `;
    }).join("");

    // Enlazar salto al minuto del reproductor VOD
    listEl.querySelectorAll(".classroom-seek-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetSec = Number(btn.dataset.seekSeconds || 0);
            triggerClassroomVideoSeek(targetSec);
        });
    });

    // Enlazar fijado de mensajes para Administradores Maestros
    listEl.querySelectorAll(".classroom-pin-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            togglePinChatMessage(btn.dataset.pinMsgId);
        });
    });

    listEl.scrollTop = listEl.scrollHeight;
}

// ============================================================================
// 6. BUZÓN DE PREGUNTAS DIRECTAS AL ESPECIALISTA (ENVÍO, VOTOS Y RESPUESTA)
// ============================================================================

/**
 * Registra una pregunta clínica directa para el especialista de la clase.
 * @param {Object} payload
 * @param {string} payload.topic
 * @param {string} payload.question
 * @param {number} [payload.videoTimestampSec]
 */
export async function submitSpecialistQuestion(payload = {}) {
    const profile = getCurrentParticipantIdentity();
    const sec = typeof payload.videoTimestampSec === "number"
        ? payload.videoTimestampSec
        : getCurrentClassVideoTimeSeconds();

    const newQuestion = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        classId: chatState.activeClass.id,
        classTitle: chatState.activeClass.titulo,
        studentName: profile.name,
        studentEmail: profile.email,
        subscriptionTier: profile.subscriptionTier,
        topic: String(payload.topic || "Consulta Clínica").trim(),
        question: String(payload.question || "").trim(),
        videoTimestampSec: sec,
        videoTimestampFormatted: formatSecondsToMMSS(sec),
        status: "pendiente",
        upvotes: 1,
        upvotedBy: [profile.email],
        specialistAnswer: null,
        answeredBy: null,
        answeredAt: null,
        createdAt: new Date().toISOString()
    };

    chatState.questions.unshift(newQuestion);
    renderSpecialistQuestionsList();
    updateClassroomSidebarBadges();

    postClassroomBroadcastEvent({
        type: "NEW_SPECIALIST_QUESTION",
        classId: chatState.activeClass.id,
        payload: newQuestion
    });

    if (db) {
        try {
            const docRef = await addDoc(collection(db, SAFE_COLLECTIONS.SPECIALIST_QA), newQuestion);
            newQuestion.id = docRef.id;
        } catch (e) {
            // Conserva en memoria local si no hay red
        }
    }

    return newQuestion;
}

/**
 * Permite al Administrador Maestro / Docente Especialista responder oficialmente
 * una pregunta del buzón de la clase.
 * @param {string} questionId
 * @param {string} answerText
 */
export async function answerSpecialistQuestion(questionId, answerText) {
    if (!isUserMasterAdmin()) return;

    const cleanAnswer = String(answerText || "").trim();
    if (!cleanAnswer) return;

    const target = chatState.questions.find(q => q.id === questionId);
    if (!target) return;

    const profile = getCurrentParticipantIdentity();
    target.status = "respondida";
    target.specialistAnswer = cleanAnswer;
    target.answeredBy = profile.name;
    target.answeredAt = new Date().toISOString();

    renderSpecialistQuestionsList();

    postClassroomBroadcastEvent({
        type: "SPECIALIST_QUESTION_ANSWERED",
        classId: chatState.activeClass.id,
        payload: target
    });

    if (db && !String(questionId).startsWith("seed_") && !String(questionId).startsWith("qa_")) {
        try {
            await updateDoc(doc(db, SAFE_COLLECTIONS.SPECIALIST_QA, questionId), {
                status: "respondida",
                specialistAnswer: target.specialistAnswer,
                answeredBy: target.answeredBy,
                answeredAt: target.answeredAt
            });
        } catch (e) {
            // Silencioso en modo local
        }
    }
}

/**
 * Permite a los estudiantes votar por una duda clínica para priorizarla.
 * @param {string} questionId
 */
export async function upvoteSpecialistQuestion(questionId) {
    const target = chatState.questions.find(q => q.id === questionId);
    if (!target) return;

    const profile = getCurrentParticipantIdentity();
    target.upvotedBy = Array.isArray(target.upvotedBy) ? target.upvotedBy : [];

    if (target.upvotedBy.includes(profile.email)) return;

    target.upvotedBy.push(profile.email);
    target.upvotes = (target.upvotes || 0) + 1;

    chatState.questions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    renderSpecialistQuestionsList();

    if (db && !String(questionId).startsWith("seed_") && !String(questionId).startsWith("qa_")) {
        try {
            await updateDoc(doc(db, SAFE_COLLECTIONS.SPECIALIST_QA, questionId), {
                upvotes: target.upvotes,
                upvotedBy: target.upvotedBy
            });
        } catch (e) {
            // Silencioso
        }
    }
}

/**
 * Renderiza el listado de consultas en el Buzón del Especialista.
 */
export function renderSpecialistQuestionsList() {
    const listEl = document.getElementById("classroom-qa-list");
    if (!listEl) return;

    const isAdmin = isUserMasterAdmin();

    if (chatState.questions.length === 0) {
        listEl.innerHTML = `
            <div class="text-center text-xs text-gray-500 py-8 font-mono">
                No hay preguntas registradas en esta clase. Pulsa "+ Hacer Pregunta" para consultar al especialista.
            </div>
        `;
        return;
    }

    listEl.innerHTML = chatState.questions.map(q => {
        const isAnswered = q.status === "respondida" && q.specialistAnswer;

        return `
            <div class="rounded-xl p-3 bg-surface border ${isAnswered ? "border-secondary/40" : "border-surface-high"} space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <span class="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase ${
                            isAnswered
                                ? "bg-secondary/20 text-secondary"
                                : "bg-warning/20 text-warning"
                        }">
                            ${isAnswered ? "✓ Respondida por Especialista" : "⏳ Pendiente de Respuesta"}
                        </span>
                        <h4 class="text-xs font-extrabold text-white mt-1 leading-snug">
                            ${escapeHtml(q.topic)}
                        </h4>
                    </div>
                    <button
                        type="button"
                        data-upvote-qa="${q.id}"
                        class="classroom-qa-upvote-btn px-2 py-1 rounded-lg bg-surface-high hover:bg-primary/20 border border-surface-high hover:border-primary text-[10px] font-mono font-bold text-primary flex items-center gap-1 shrink-0 transition-all"
                        title="Priorizar esta duda clínica"
                    >
                        <span>▲</span>
                        <span>${q.upvotes || 1}</span>
                    </button>
                </div>

                <p class="text-xs text-gray-300 leading-relaxed">
                    ${escapeHtml(q.question)}
                </p>

                <div class="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-surface-high">
                    <span>Por: ${escapeHtml(q.studentName)} (${escapeHtml(q.subscriptionTier || "PRO")})</span>
                    ${q.videoTimestampFormatted ? `
                        <button
                            type="button"
                            data-seek-seconds="${q.videoTimestampSec || 0}"
                            class="classroom-seek-btn text-secondary hover:underline font-bold"
                        >
                            ▶ Min ${q.videoTimestampFormatted}
                        </button>
                    ` : ""}
                </div>

                ${isAnswered ? `
                    <div class="mt-2 p-2.5 rounded-xl bg-secondary/10 border border-secondary/30 space-y-1">
                        <div class="flex items-center justify-between text-[10px] font-mono text-secondary font-extrabold">
                            <span>🩺 Respuesta Oficial • ${escapeHtml(q.answeredBy || "Especialista Makai")}</span>
                        </div>
                        <p class="text-xs text-white leading-relaxed">
                            ${escapeHtml(q.specialistAnswer)}
                        </p>
                    </div>
                ` : ""}

                ${isAdmin && !isAnswered ? `
                    <div class="pt-2 space-y-1.5">
                        <textarea
                            id="admin-answer-input-${q.id}"
                            rows="2"
                            placeholder="Escribe la respuesta oficial como Especialista / Admin..."
                            class="w-full bg-surface-container border border-primary/40 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none resize-none"
                        ></textarea>
                        <button
                            type="button"
                            data-answer-qa-id="${q.id}"
                            class="classroom-admin-answer-btn w-full py-1.5 rounded-lg bg-secondary text-surface font-extrabold text-[11px] hover:bg-opacity-90 transition-all"
                        >
                            Publicar Respuesta Oficial
                        </button>
                    </div>
                ` : ""}
            </div>
        `;
    }).join("");

    // Enlazar votos de preguntas
    listEl.querySelectorAll(".classroom-qa-upvote-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            upvoteSpecialistQuestion(btn.dataset.upvoteQa);
        });
    });

    // Enlazar saltos de tiempo del video
    listEl.querySelectorAll(".classroom-seek-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            triggerClassroomVideoSeek(Number(btn.dataset.seekSeconds || 0));
        });
    });

    // Enlazar respuesta del Administrador Maestro
    listEl.querySelectorAll(".classroom-admin-answer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const qaId = btn.dataset.answerQaId;
            const input = document.getElementById(`admin-answer-input-${qaId}`);
            if (input && input.value.trim()) {
                answerSpecialistQuestion(qaId, input.value.trim());
            }
        });
    });
}

// ============================================================================
// 7. GESTIÓN Y DESCARGA DE MATERIAL DE APOYO DE LA CLASE
// ============================================================================

/**
 * Renderiza la lista de materiales de apoyo (PDFs, GPC, diapositivas) de la clase activa.
 * @param {Array} materialsList
 */
export function renderClassSupportMaterials(materialsList = chatState.materials) {
    const listEl = document.getElementById("classroom-materials-list");
    if (!listEl) return;

    chatState.materials = Array.isArray(materialsList) ? materialsList : [];

    if (chatState.materials.length === 0) {
        listEl.innerHTML = `
            <div class="text-center text-xs text-gray-500 py-8 font-mono">
                No hay archivos adjuntos para esta sesión.
            </div>
        `;
        return;
    }

    listEl.innerHTML = chatState.materials.map(mat => {
        const requiredTier = mat.nivelRequerido || "Básico";
        const hasAccess = checkMaterialSubscriptionAccess(requiredTier);

        const badgeColor = requiredTier === "VIP"
            ? "bg-warning/20 text-warning border-warning/40"
            : requiredTier === "PRO"
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-secondary/20 text-secondary border-secondary/40";

        return `
            <div class="rounded-xl p-3 bg-surface border border-surface-high hover:border-primary/40 transition-all space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                            <span class="material-symbols-outlined text-lg">description</span>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-xs font-extrabold text-white leading-snug">
                                ${escapeHtml(mat.titulo)}
                            </h4>
                            <div class="flex items-center gap-2 text-[10px] font-mono text-gray-400 mt-0.5">
                                <span>${escapeHtml(mat.formato || "PDF")}</span>
                                <span>•</span>
                                <span>${escapeHtml(mat.tamano || "2.0 MB")}</span>
                            </div>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase shrink-0 ${badgeColor}">
                        ${escapeHtml(requiredTier)}
                    </span>
                </div>

                ${mat.descripcion ? `
                    <p class="text-[11px] text-gray-400 leading-relaxed">
                        ${escapeHtml(mat.descripcion)}
                    </p>
                ` : ""}

                <div class="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        data-download-mat-id="${mat.id}"
                        class="classroom-mat-download-btn flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            hasAccess
                                ? "bg-primary text-surface hover:bg-opacity-90"
                                : "bg-surface-high text-warning border border-warning/40 hover:bg-warning hover:text-surface"
                        }"
                    >
                        <span class="material-symbols-outlined text-sm">
                            ${hasAccess ? "download" : "lock"}
                        </span>
                        <span>
                            ${hasAccess ? "Descargar Material" : `Desbloquear con Plan ${requiredTier}`}
                        </span>
                    </button>
                    ${hasAccess ? `
                        <button
                            type="button"
                            data-preview-mat-id="${mat.id}"
                            class="classroom-mat-preview-btn px-3 py-2 rounded-xl bg-surface-high hover:bg-surface border border-surface-high hover:border-primary text-xs font-bold text-gray-200 transition-all"
                            title="Abrir en visor clínico"
                        >
                            👁️
                        </button>
                    ` : ""}
                </div>
            </div>
        `;
    }).join("");

    // Eventos de descarga de material
    listEl.querySelectorAll(".classroom-mat-download-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = chatState.materials.find(m => m.id === btn.dataset.downloadMatId);
            if (item) downloadClassResource(item, { mode: "download" });
        });
    });

    // Eventos de vista previa en visor emergente
    listEl.querySelectorAll(".classroom-mat-preview-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = chatState.materials.find(m => m.id === btn.dataset.previewMatId);
            if (item) downloadClassResource(item, { mode: "preview" });
        });
    });
}

/**
 * Verifica los permisos del estudiante y descarga o previsualiza el material de apoyo.
 * @param {Object} resourceItem
 * @param {Object} [options]
 */
export function downloadClassResource(resourceItem, options = { mode: "download" }) {
    if (!resourceItem) return;

    const requiredTier = resourceItem.nivelRequerido || "Básico";
    if (!checkMaterialSubscriptionAccess(requiredTier)) {
        triggerClassroomPaywallPrompt(requiredTier);
        return;
    }

    if (typeof chatState.onResourceOpenedCallback === "function") {
        chatState.onResourceOpenedCallback(resourceItem, options.mode);
    }

    const targetUrl = resourceItem.url || "assets/5-multimedia-1d/guias-pdf/gpc-resumen-clase.pdf";

    if (options.mode === "preview") {
        openSupportMaterialPreviewModal(resourceItem);
        return;
    }

    const link = document.createElement("a");
    link.href = targetUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const safeFilename = (resourceItem.titulo || "Material_MakaiAcademy")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${safeFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/**
 * Abre un visor modal interno en modo oscuro para previsualizar el material sin salir del aula.
 * @param {Object} resourceItem
 */
function openSupportMaterialPreviewModal(resourceItem) {
    let modal = document.getElementById("classroom-material-preview-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "classroom-material-preview-modal";
        modal.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    const isImage = /\.(png|jpg|jpeg|webp|svg)$/i.test(resourceItem.url || "");

    modal.innerHTML = `
        <div class="bg-surface-container border border-primary/50 rounded-2xl w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden shadow-2xl">
            <div class="p-4 bg-surface border-b border-surface-high flex items-center justify-between gap-4">
                <div class="min-w-0">
                    <span class="text-[10px] font-mono uppercase text-primary font-bold">
                        Visor de Material de Apoyo • Aula Virtual
                    </span>
                    <h3 class="text-sm font-extrabold text-white truncate">
                        ${escapeHtml(resourceItem.titulo)}
                    </h3>
                </div>
                <button
                    type="button"
                    id="btn-close-classroom-mat-preview"
                    class="px-3 py-1.5 rounded-xl bg-surface-high hover:bg-danger text-gray-300 hover:text-white text-xs font-extrabold transition-all"
                >
                    ✕ Cerrar Visor
                </button>
            </div>
            <div class="flex-1 bg-[#05080c] flex items-center justify-center overflow-auto p-4">
                ${isImage
                    ? `<img src="${escapeHtml(resourceItem.url)}" alt="${escapeHtml(resourceItem.titulo)}" class="max-w-full max-h-full rounded-xl border border-surface-high object-contain">`
                    : `<iframe src="${escapeHtml(resourceItem.url)}" class="w-full h-full rounded-xl border border-surface-high bg-surface" title="${escapeHtml(resourceItem.titulo)}"></iframe>`
                }
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    document.getElementById("btn-close-classroom-mat-preview")?.addEventListener("click", () => {
        modal.remove();
    });
}

/**
 * Permite al Administrador Maestro adjuntar rápidamente un nuevo PDF o guía a la clase activa.
 */
async function openAdminQuickAddMaterialPrompt() {
    if (!isUserMasterAdmin()) return;

    const titulo = prompt("Título del material de apoyo (ej. GPC Hipertensión Gestacional MSP):");
    if (!titulo || !titulo.trim()) return;

    const url = prompt(
        "Ruta en assets/ o URL de Cloud Storage:",
        "assets/5-multimedia-1d/guias-pdf/nueva-guia-clase.pdf"
    );
    if (!url || !url.trim()) return;

    const nivelRequerido = prompt("Nivel de suscripción requerido (Básico, PRO o VIP):", "PRO") || "PRO";

    const newMat = {
        id: `mat_${Date.now()}`,
        classId: chatState.activeClass.id,
        carrera: chatState.activeClass.carrera || appState.currentCareer || "medicina",
        materia: chatState.activeClass.materia || "General",
        titulo: titulo.trim(),
        tipo: "pdf",
        formato: "PDF • Oficial",
        tamano: "2.1 MB",
        nivelRequerido: ["Básico", "PRO", "VIP"].includes(nivelRequerido.trim()) ? nivelRequerido.trim() : "PRO",
        url: url.trim(),
        descripcion: `Recurso adjuntado por el especialista para ${chatState.activeClass.titulo}.`,
        createdAt: new Date().toISOString()
    };

    chatState.materials.unshift(newMat);
    renderClassSupportMaterials(chatState.materials);
    updateClassroomSidebarBadges();

    if (db) {
        try {
            await addDoc(collection(db, SAFE_COLLECTIONS.STUDY_MATERIALS), newMat);
        } catch (e) {
            // Conservado en sesión local
        }
    }
}

// ============================================================================
// 8. SINCRONIZACIÓN MULTI-PESTAÑA, UTILIDADES DE VIDEO Y PERMISOS
// ============================================================================

/**
 * Inicializa `BroadcastChannel` para sincronizar mensajes y respuestas entre pestañas en 0 ms.
 */
function initClassroomBroadcastChannel() {
    if (chatState.broadcastChannel || typeof window.BroadcastChannel !== "function") return;

    try {
        chatState.broadcastChannel = new BroadcastChannel("makai_classroom_interaction_channel");
        chatState.broadcastChannel.onmessage = (event) => {
            const packet = event.data;
            if (!packet || packet.classId !== chatState.activeClass.id) return;

            if (packet.type === "NEW_CHAT_MESSAGE" && packet.payload) {
                const exists = chatState.messages.some(m => m.id === packet.payload.id);
                if (!exists) {
                    chatState.messages.push(packet.payload);
                    renderChatMessagesList();
                    updateClassroomSidebarBadges();
                }
            } else if (packet.type === "NEW_SPECIALIST_QUESTION" && packet.payload) {
                const exists = chatState.questions.some(q => q.id === packet.payload.id);
                if (!exists) {
                    chatState.questions.unshift(packet.payload);
                    renderSpecialistQuestionsList();
                    updateClassroomSidebarBadges();
                }
            } else if (packet.type === "SPECIALIST_QUESTION_ANSWERED" && packet.payload) {
                const idx = chatState.questions.findIndex(q => q.id === packet.payload.id);
                if (idx >= 0) {
                    chatState.questions[idx] = packet.payload;
                    renderSpecialistQuestionsList();
                }
            }
        };
    } catch (e) {
        // Silencioso en navegadores sin soporte
    }
}

function postClassroomBroadcastEvent(packet) {
    if (!chatState.broadcastChannel) return;
    try {
        chatState.broadcastChannel.postMessage(packet);
    } catch (e) {
        // Silencioso
    }
}

/**
 * Escucha cambios curriculares globales (`makai:curriculumChanged`) emitidos por `router.spa.js`.
 */
function bindCurriculumChangeListener() {
    window.addEventListener("makai:curriculumChanged", (event) => {
        const detail = event.detail || {};
        if (!chatState.initialized) return;

        loadClassroomChatSession({
            id: `aula_${detail.career || appState.currentCareer || "medicina"}_${detail.stage || "caces"}`,
            titulo: `Aula Virtual • ${(detail.subject || detail.career || "Sesión Clínica").toUpperCase()}`,
            carrera: detail.career || appState.currentCareer || "medicina",
            etapa: detail.stage || "caces",
            materia: detail.subject || "General"
        });
    });
}

/**
 * Obtiene el segundo actual del reproductor de video VOD (`#classroom-vod-video`) o callback registrado.
 * @returns {number}
 */
function getCurrentClassVideoTimeSeconds() {
    if (typeof chatState.getVideoCurrentTimeCallback === "function") {
        const val = Number(chatState.getVideoCurrentTimeCallback());
        if (!Number.isNaN(val) && val >= 0) return Math.floor(val);
    }

    const videoEl = document.getElementById("classroom-vod-video") ||
        document.querySelector("#view-classrooms video");
    if (videoEl && typeof videoEl.currentTime === "number") {
        return Math.floor(videoEl.currentTime);
    }

    return 0;
}

/**
 * Salta al segundo indicado en el reproductor de video VOD cuando el alumno pulsa un timestamp en el chat.
 * @param {number} seconds
 */
function triggerClassroomVideoSeek(seconds = 0) {
    const safeSec = Math.max(0, Math.floor(Number(seconds) || 0));

    if (typeof chatState.seekVideoCallback === "function") {
        chatState.seekVideoCallback(safeSec);
    }

    const videoEl = document.getElementById("classroom-vod-video") ||
        document.querySelector("#view-classrooms video");
    if (videoEl) {
        videoEl.currentTime = safeSec;
        videoEl.play?.().catch(() => {});
    }

    window.dispatchEvent(new CustomEvent("makai:classroomSeekVideo", {
        detail: { seconds: safeSec, classId: chatState.activeClass.id }
    }));
}

/**
 * Actualiza los contadores numéricos de las 3 pestañas del panel lateral.
 */
function updateClassroomSidebarBadges() {
    const chatBadge = document.getElementById("classroom-badge-chat-count");
    const qaBadge = document.getElementById("classroom-badge-qa-count");
    const matBadge = document.getElementById("classroom-badge-mat-count");

    if (chatBadge) chatBadge.textContent = String(chatState.messages.length);
    if (qaBadge) qaBadge.textContent = String(chatState.questions.length);
    if (matBadge) matBadge.textContent = String(chatState.materials.length);
}

/**
 * Comprueba si el usuario actual posee privilegios de Administrador Maestro.
 * @returns {boolean}
 */
function isUserMasterAdmin() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(email) || appState?.currentUserData?.rol === "admin";
}

/**
 * Verifica si el plan de suscripción del estudiante permite descargar un recurso.
 * @param {string} requiredTier - "Básico" | "PRO" | "VIP"
 * @returns {boolean}
 */
function checkMaterialSubscriptionAccess(requiredTier = "Básico") {
    if (isUserMasterAdmin()) return true;
    if (typeof canAccessBySubscription === "function") {
        return canAccessBySubscription(requiredTier);
    }

    const userLevel = appState?.currentUserData?.subscriptionLevel || "Básico";
    const rank = { "Básico": 1, "PRO": 2, "VIP": 3 };
    return (rank[userLevel] || 1) >= (rank[requiredTier] || 1);
}

/**
 * Muestra el modal Freemium o redirige al flujo de mejora de plan cuando un recurso requiere PRO/VIP.
 * @param {string} requiredTier
 */
function triggerClassroomPaywallPrompt(requiredTier = "PRO") {
    const freemiumModal = document.getElementById("freemium-modal");
    if (freemiumModal) {
        freemiumModal.classList.remove("hidden");
        freemiumModal.classList.add("flex");
        return;
    }

    const targetPlan = requiredTier === "VIP" ? "vip" : "pro_anual";
    if (confirm(`Este recurso de apoyo requiere el Plan ${requiredTier}. ¿Deseas ir a la pasarela de activación?`)) {
        window.location.href = `registro.html?plan=${targetPlan}&pago=qr`;
    }
}

/**
 * Obtiene el nombre, correo, rol y nivel de suscripción del usuario autenticado.
 */
function getCurrentParticipantIdentity() {
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "estudiante@makai.ec";
    const adminStatus = isUserMasterAdmin();
    const rawName = appState?.currentUserData?.nombre ||
        appState?.currentUserData?.nickname ||
        auth?.currentUser?.displayName ||
        email.split("@")[0];

    return {
        name: adminStatus ? `Dr. ${rawName} (Especialista)` : rawName,
        email,
        role: adminStatus ? "admin" : "estudiante",
        subscriptionTier: adminStatus
            ? "VIP"
            : (appState?.currentUserData?.subscriptionLevel || "Básico")
    };
}

/**
 * Formatea segundos en cadena `mm:ss`.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatSecondsToMMSS(totalSeconds = 0) {
    const secNum = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(secNum / 60).toString().padStart(2, "0");
    const seconds = (secNum % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

/**
 * Escapa caracteres HTML para prevenir inyecciones XSS en el chat y buzón.
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
