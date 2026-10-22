/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — EXAM CONTROLLER
 * Archivo: js/4-exams/exam.controller.js
 * Propósito: Controlador Maestro del Lanzador Académico, Simulador CACES y
 *            Evaluaciones por Carrera, Matriz de Reactivos, Cronómetro y Métricas.
 * ============================================================================
 */

import {
    auth,
    db,
    collection,
    getDocs,
    doc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    setCurriculumSelection,
    setExamSessionState,
    resetExamSessionState,
    updateUserMetricsInState,
    hasRemainingFreemiumCases,
    FREEMIUM_MONTHLY_CASE_LIMIT
} from "../2-core/state.store.js";

// ============================================================================
// 1. CONFIGURACIÓN DE MODOS DE EVALUACIÓN Y TIEMPOS OFICIALES
// ============================================================================
export const EXAM_MODES_CONFIG = Object.freeze({
    tutor: {
        id: "tutor",
        label: "Práctica Rápida (Modo Tutor)",
        questionCount: 20,
        durationSeconds: 30 * 60, // 30 minutos
        requiresPro: false,
        instantRational: true
    },
    critical: {
        id: "critical",
        label: "Refuerzo Crítico",
        questionCount: 30,
        durationSeconds: 45 * 60, // 45 minutos
        requiresPro: false,
        instantRational: false
    },
    standard: {
        id: "standard",
        label: "Modo Estándar CACES",
        questionCount: 100,
        durationSeconds: 150 * 60, // 150 minutos
        requiresPro: true,
        instantRational: false
    }
});

export const PASSING_SCORE_CACES = 70;

// Estado interno sincronizado con state.store.js
let launcherEventsInitialized = false;
let simulatorEventsInitialized = false;
let curriculumListenerBound = false;
let internalTimerInterval = null;
let externalTimerModule = null;
let externalPaywallModule = null;

// ============================================================================
// 2. CARGADOR SEGURO DE SUBCOMPONENTES HERMANOS (TOLERANTE A ARCHIVOS SEMILLA)
// ============================================================================
async function loadOptionalExamDependencies() {
    try {
        const timerMod = await import("./exam.timer.js");
        if (timerMod && (typeof timerMod.startExamTimer === "function" || typeof timerMod.stopExamTimer === "function")) {
            externalTimerModule = timerMod;
        }
    } catch (e) {
        // Usa el reloj interno de respaldo si exam.timer.js aún es semilla
    }

    try {
        const paywallMod = await import("../3-security/paywall.traffic.js");
        if (paywallMod && typeof paywallMod.showFreemiumModal === "function") {
            externalPaywallModule = paywallMod;
        }
    } catch (e) {
        // Usa el modal Freemium interno de respaldo si paywall.traffic.js aún es semilla
    }
}

// ============================================================================
// 3. UTILIDADES INTERNAS DE NAVEGACIÓN Y PERMISOS
// ============================================================================
function getActiveUserData() {
    if (appState?.currentUserData) return appState.currentUserData;
    const user = auth?.currentUser;
    const adminFlag = isMasterAdmin(user?.email);
    return {
        uid: user?.uid || null,
        email: user?.email || "",
        nombre: user?.displayName || "Estudiante Makai",
        rol: adminFlag ? "admin" : "estudiante",
        subscriptionLevel: adminFlag ? "PRO" : "Básico",
        casesUsedThisMonth: 0,
        totalExamsCompleted: 0,
        globalAverage: 0
    };
}

function isUserProOrAdmin(userData = getActiveUserData()) {
    if (!userData) return false;
    if (isMasterAdmin(userData.email) || userData.rol === "admin") return true;
    const plan = String(userData.subscriptionLevel || "Básico").toUpperCase();
    return plan === "PRO" || plan === "VIP";
}

function navigateToView(viewId) {
    if (window.MakaiOrchestrator && typeof window.MakaiOrchestrator.switchView === "function") {
        window.MakaiOrchestrator.switchView(viewId, { force: true });
        return;
    }

    document.querySelectorAll(".tab-content").forEach(el => {
        el.classList.remove("active");
        el.classList.add("hidden");
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }

    if (appState) {
        appState.currentActiveView = viewId;
    }
}

function triggerUpcomingToast(customMessage = null) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    if (customMessage) {
        const textSpan = toast.querySelector("span:not(.material-symbols-outlined)") || toast;
        if (textSpan && textSpan !== toast) {
            textSpan.textContent = customMessage;
        }
    }

    toast.classList.remove("translate-y-24", "opacity-0");
    setTimeout(() => {
        toast.classList.add("translate-y-24", "opacity-0");
    }, 3000);
}

// ============================================================================
// 4. PUNTO DE ENTRADA PRINCIPAL DEL CONTROLADOR DE EXÁMENES
// ============================================================================
export async function initExamController() {
    await loadOptionalExamDependencies();

    const userData = getActiveUserData();
    if (userData?.carrera && (!appState.currentCareer || appState.currentCareer === "medicina")) {
        setCurriculumSelection({ career: userData.carrera });
    }

    initLauncher();
    initSimulator();
    initMetrics();

    if (!curriculumListenerBound) {
        window.addEventListener("makai:curriculumChanged", (e) => {
            const detail = e.detail || {};
            if (detail.career && detail.career !== appState.currentCareer) {
                appState.currentCareer = detail.career;
            }
            renderSubjectPills();
        });
        curriculumListenerBound = true;
    }

    // Exponer API global para comunicación limpia con otros controladores
    window.MakaiExamController = {
        initLauncher,
        initSimulator,
        startExam,
        submitExam,
        quitExam,
        initMetrics,
        showFreemiumModal,
        toggleMarkForReview
    };
}

// Alias estandarizado para app.orchestrator.js
export const initExams = initExamController;

// ============================================================================
// 5. VISTA 1: LANZADOR Y SELECTOR ACADÉMICO (#view-launcher)
// ============================================================================
export function initLauncher() {
    const data = window.makaiData || { carreras: [], semillaCasos: [] };
    const cSelector = document.getElementById("career-selector");
    const btnStart = document.getElementById("btn-start-exam");
    const userData = getActiveUserData();
    const currentCareer = appState.currentCareer || "medicina";

    if (cSelector && Array.isArray(data.carreras)) {
        cSelector.innerHTML = "";

        data.carreras.forEach(c => {
            const isLocked = !c.activa && !isMasterAdmin(userData.email);
            const isSelected = c.id === currentCareer;

            const div = document.createElement("div");
            div.dataset.careerCard = c.id;
            div.className = `p-4 border rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                isSelected
                    ? "bg-surface-high border-primary text-white shadow-[0_0_15px_rgba(0,229,255,0.12)]"
                    : "bg-surface border-surface-high text-gray-400 hover:border-gray-500"
            } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`;

            let content = `<span class="font-bold text-sm">${c.nombre}</span>`;
            if (isLocked) {
                content += `<svg class="w-5 h-5 flex-shrink-0"><use href="#nirvana-icon"></use></svg>`;
            }

            div.innerHTML = content;

            if (!isLocked) {
                div.addEventListener("click", () => {
                    setCurriculumSelection({
                        career: c.id,
                        subject: "todas"
                    });
                    initLauncher();
                });
            } else {
                div.addEventListener("click", () => {
                    triggerUpcomingToast("Módulo en calibración final • Disponible próximamente");
                });
            }

            cSelector.appendChild(div);
        });
    }

    renderSubjectPills();

    if (!launcherEventsInitialized) {
        const modes = ["standard", "tutor", "critical"];

        modes.forEach(m => {
            const el = document.getElementById(`mode-${m}`);
            if (!el) return;

            el.addEventListener("click", () => {
                const activeUser = getActiveUserData();

                // Candado Freemium para Modo Estándar (100 preguntas)
                if (m === "standard" && !isUserProOrAdmin(activeUser)) {
                    showFreemiumModal();
                    return;
                }

                modes.forEach(modeKey => {
                    const mel = document.getElementById(`mode-${modeKey}`);
                    if (!mel) return;
                    mel.classList.remove("border-primary", "border-2");
                    mel.classList.add("border-surface-high", "border");
                });

                el.classList.remove("border-surface-high", "border");
                el.classList.add("border-primary", "border-2");

                setCurriculumSelection({ mode: m });
            });
        });

        // Seleccionar Modo Tutor por defecto al iniciar
        const defaultModeBtn = document.getElementById(`mode-${appState.currentMode || "tutor"}`) || document.getElementById("mode-tutor");
        defaultModeBtn?.click();

        btnStart?.addEventListener("click", () => startExam());
        launcherEventsInitialized = true;
    }
}

function renderSubjectPills() {
    const data = window.makaiData || { carreras: [] };
    const pSelector = document.getElementById("subject-pills");
    if (!pSelector) return;

    const currentCareer = appState.currentCareer || "medicina";
    const currentSubject = appState.currentSubject || "todas";
    const currentCareerData = data.carreras?.find(c => c.id === currentCareer);

    pSelector.innerHTML = "";
    if (!currentCareerData || !Array.isArray(currentCareerData.materias)) return;

    // Píldora "Todas las materias"
    const allPill = document.createElement("button");
    allPill.type = "button";
    const isAllSelected = !currentSubject || currentSubject === "todas";
    allPill.className = `px-3 py-1 border text-xs rounded-full transition-all font-medium ${
        isAllSelected
            ? "bg-primary/20 border-primary text-primary font-bold"
            : "bg-surface-high border-gray-700 text-gray-300 hover:border-gray-500"
    }`;
    allPill.textContent = "Todas las materias";
    allPill.addEventListener("click", () => {
        setCurriculumSelection({ subject: "todas" });
        renderSubjectPills();
    });
    pSelector.appendChild(allPill);

    // Píldoras por cada materia oficial de la carrera seleccionada
    currentCareerData.materias.forEach(materia => {
        const span = document.createElement("button");
        span.type = "button";
        const isSelected = currentSubject === materia;
        span.className = `px-3 py-1 border text-xs rounded-full transition-all ${
            isSelected
                ? "bg-primary/20 border-primary text-primary font-bold"
                : "bg-surface-high border-gray-700 text-gray-300 hover:border-gray-500"
        }`;
        span.textContent = materia;
        span.addEventListener("click", () => {
            setCurriculumSelection({ subject: materia });
            renderSubjectPills();
        });
        pSelector.appendChild(span);
    });
}

// ============================================================================
// 6. CANDADO FREEMIUM Y MODAL DE ACTUALIZACIÓN A MAKAI PRO CACES
// ============================================================================
export function showFreemiumModal() {
    if (externalPaywallModule && typeof externalPaywallModule.showFreemiumModal === "function") {
        externalPaywallModule.showFreemiumModal();
        return;
    }

    const modal = document.getElementById("freemium-modal");
    if (!modal) return;

    modal.innerHTML = `
        <div class="bg-surface-container border border-primary p-8 rounded-2xl max-w-md text-center shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <h3 class="text-2xl font-bold text-white mb-2">Activa Makai PRO CACES</h3>
            <p class="text-sm text-gray-400 mb-6">
                El Modo Estándar (100 preguntas) y casos ilimitados requieren Makai PRO ($17.99/mes o $139.99/año).
            </p>
            <div class="space-y-4">
                <a href="registro.html?plan=pro_anual&pago=qr" class="block w-full bg-primary text-surface-container font-bold py-3 rounded-xl hover:bg-opacity-90 transition-all">
                    Subir Comprobante QR / Transferencia
                </a>
                <div class="flex justify-center gap-3 py-2 font-mono">
                    <span class="text-xs bg-surface p-2 rounded border border-primary/40 text-primary">Tarjeta</span>
                    <span class="text-xs bg-surface p-2 rounded border border-secondary/40 text-secondary">QR Deuna! / Pacífico</span>
                    <span class="text-xs bg-surface p-2 rounded border border-gray-700 text-gray-300">Transferencia</span>
                </div>
                <button type="button" id="btn-close-freemium-modal" class="w-full text-gray-500 text-sm hover:text-white transition-colors">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    document.getElementById("btn-close-freemium-modal")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });
}

// ============================================================================
// 7. VISTA 2: ARRANQUE Y MOTOR DEL SIMULADOR (#view-simulator)
// ============================================================================
export async function startExam(customOptions = {}) {
    const userData = getActiveUserData();
    const currentCareer = customOptions.career || appState.currentCareer || "medicina";
    const currentSubject = customOptions.subject || appState.currentSubject || "todas";
    const currentMode = customOptions.mode || appState.currentMode || "tutor";
    const modeConfig = EXAM_MODES_CONFIG[currentMode] || EXAM_MODES_CONFIG.tutor;

    // 1. Verificar candado Freemium por modalidad o límite mensual de 15 casos
    if (!isUserProOrAdmin(userData)) {
        const casesUsed = Number(userData.casesUsedThisMonth || 0);
        const hasQuota = typeof hasRemainingFreemiumCases === "function"
            ? hasRemainingFreemiumCases()
            : casesUsed < FREEMIUM_MONTHLY_CASE_LIMIT;

        if (modeConfig.requiresPro || !hasQuota) {
            showFreemiumModal();
            return;
        }
    }

    // 2. Recopilar banco semilla local + colección preguntas_caces de Cloud Firestore
    const data = window.makaiData || { carreras: [], semillaCasos: [] };
    const seedCases = Array.isArray(data.semillaCasos)
        ? data.semillaCasos.filter(c => c.carrera === currentCareer)
        : [];

    const firestoreCases = [];
    try {
        const snap = await getDocs(collection(db, "preguntas_caces"));
        snap.forEach(docSnap => {
            const qData = docSnap.data();
            if (qData && qData.carrera === currentCareer) {
                firestoreCases.push({ id: docSnap.id, ...qData });
            }
        });
    } catch (err) {
        console.warn("[Makai ExamController] Usando banco semilla local:", err);
    }

    // Combinar evitando duplicados por enunciado
    const combinedMap = new Map();
    [...seedCases, ...firestoreCases].forEach((item, idx) => {
        const key = (item.id || item.enunciado || `q_${idx}`).trim();
        combinedMap.set(key, item);
    });

    let availableCases = Array.from(combinedMap.values());

    // Filtrar por materia específica si el alumno seleccionó una píldora
    if (currentSubject && currentSubject !== "todas") {
        const filteredBySubject = availableCases.filter(
            c => String(c.materia || "").toLowerCase() === String(currentSubject).toLowerCase()
        );
        if (filteredBySubject.length > 0) {
            availableCases = filteredBySubject;
        }
    }

    // Si es modo "Refuerzo Crítico", priorizar reactivos de dificultad Alta
    if (currentMode === "critical") {
        availableCases.sort((a, b) => {
            const aHard = String(a.dificultad || "").toLowerCase() === "alta" ? 0 : 1;
            const bHard = String(b.dificultad || "").toLowerCase() === "alta" ? 0 : 1;
            return aHard - bHard || (0.5 - Math.random());
        });
    } else {
        availableCases.sort(() => 0.5 - Math.random());
    }

    const selectedQuestions = availableCases.slice(
        0,
        Math.min(modeConfig.questionCount, availableCases.length)
    );

    if (selectedQuestions.length === 0) {
        alert("No hay suficientes reactivos para esta carrera aún. Puedes agregarlos desde el Panel Admin.");
        return;
    }

    // 3. Inicializar estado del simulacro en state.store.js
    setExamSessionState({
        isExamActive: true,
        examQuestions: selectedQuestions,
        currentQuestionIndex: 0,
        userAnswers: {},
        markedForReview: new Set(),
        examTimeRemaining: modeConfig.durationSeconds
    });

    // 4. Actualizar contexto superior y mostrar la vista del simulador
    const careerObj = data.carreras?.find(c => c.id === currentCareer);
    const careerLabel = careerObj ? careerObj.nombre : currentCareer.toUpperCase();
    const subjectSuffix = currentSubject && currentSubject !== "todas" ? ` • ${currentSubject}` : "";
    const contextEl = document.getElementById("exam-context");
    if (contextEl) {
        contextEl.textContent = `${careerLabel}${subjectSuffix} • Modo ${currentMode.toUpperCase()}`;
    }

    navigateToView("view-simulator");
    renderExamQuestion();
    renderMatrix();
    startCountdownTimer(modeConfig.durationSeconds);
}

// ============================================================================
// 8. CRONÓMETRO EN CUENTA REGRESIVA (#exam-timer)
// ============================================================================
function formatSecondsToHMS(totalSeconds) {
    const safeSecs = Math.max(0, Number(totalSeconds) || 0);
    const h = Math.floor(safeSecs / 3600).toString().padStart(2, "0");
    const m = Math.floor((safeSecs % 3600) / 60).toString().padStart(2, "0");
    const s = (safeSecs % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function startCountdownTimer(durationSeconds) {
    stopCountdownTimer();

    const timerEl = document.getElementById("exam-timer");
    if (timerEl) {
        timerEl.textContent = formatSecondsToHMS(durationSeconds);
    }

    // Si exam.timer.js está programado, delegar manteniendo sincronización
    if (externalTimerModule && typeof externalTimerModule.startExamTimer === "function") {
        externalTimerModule.startExamTimer(durationSeconds, {
            onTick: (remaining) => {
                appState.examTimeRemaining = remaining;
                if (timerEl) timerEl.textContent = formatSecondsToHMS(remaining);
            },
            onExpire: () => {
                submitExam();
            }
        });
        return;
    }

    // Cronómetro interno de respaldo
    appState.examTimeRemaining = durationSeconds;
    internalTimerInterval = setInterval(() => {
        appState.examTimeRemaining = Math.max(0, (appState.examTimeRemaining || 0) - 1);

        if (timerEl) {
            timerEl.textContent = formatSecondsToHMS(appState.examTimeRemaining);
        }

        if (appState.examTimeRemaining <= 0) {
            stopCountdownTimer();
            submitExam();
        }
    }, 1000);
}

function stopCountdownTimer() {
    if (externalTimerModule && typeof externalTimerModule.stopExamTimer === "function") {
        try { externalTimerModule.stopExamTimer(); } catch (e) {}
    }
    if (internalTimerInterval) {
        clearInterval(internalTimerInterval);
        internalTimerInterval = null;
    }
}

// ============================================================================
// 9. EVENTOS DEL SIMULADOR, RENDERIZADO DE PREGUNTAS Y MATRIZ CACES
// ============================================================================
export function initSimulator() {
    if (simulatorEventsInitialized) return;

    document.getElementById("btn-exit-exam")?.addEventListener("click", () => {
        if (confirm("¿Deseas salir del simulacro? Perderás el progreso no guardado.")) {
            quitExam();
        }
    });

    document.getElementById("btn-submit-exam")?.addEventListener("click", () => {
        if (confirm("¿Estás seguro de concluir el simulacro y enviarlo a calificar?")) {
            submitExam();
        }
    });

    document.getElementById("btn-next-tutor")?.addEventListener("click", () => {
        const questions = appState.examQuestions || [];
        if (appState.currentQuestionIndex < questions.length - 1) {
            appState.currentQuestionIndex += 1;
            renderExamQuestion();
            renderMatrix();
        } else {
            submitExam();
        }
    });

    document.getElementById("btn-mark-review")?.addEventListener("click", () => {
        toggleMarkForReview(appState.currentQuestionIndex);
    });

    simulatorEventsInitialized = true;
}

export function renderExamQuestion() {
    const questions = appState.examQuestions || [];
    const currentIndex = appState.currentQuestionIndex || 0;
    const q = questions[currentIndex];
    if (!q) return;

    const currentMode = appState.currentMode || "tutor";
    const userAnswers = appState.userAnswers || {};
    const isAnswered = userAnswers[currentIndex] !== undefined;

    // Cabecera de reactivo y dificultad
    const counterEl = document.getElementById("q-counter");
    const difficultyEl = document.getElementById("q-difficulty");
    const textEl = document.getElementById("q-text");

    if (counterEl) counterEl.textContent = `Reactivo ${currentIndex + 1} / ${questions.length}`;
    if (difficultyEl) difficultyEl.textContent = `Dificultad: ${q.dificultad || "Media"}`;
    if (textEl) textEl.textContent = q.enunciado || "";

    // Soporte de imagen diagnóstica desde assets/4-banco-clinico/ o URL
    renderQuestionClinicalMedia(q);

    // Ocultar racional por defecto antes de evaluar
    const rationalDiv = document.getElementById("q-rational");
    rationalDiv?.classList.add("hidden");

    // Opciones A, B, C, D
    const optContainer = document.getElementById("q-options");
    if (optContainer) {
        optContainer.innerHTML = "";

        ["A", "B", "C", "D"].forEach(letter => {
            if (q.opciones && q.opciones[letter]) {
                const btn = document.createElement("button");
                btn.type = "button";
                let baseClasses = "w-full text-left p-4 rounded-xl border text-sm transition-all flex gap-4 items-start ";

                if (isAnswered && currentMode === "tutor") {
                    if (letter === q.respuestaCorrecta) {
                        baseClasses += "border-secondary bg-secondary/10 text-white";
                    } else if (userAnswers[currentIndex].chosen === letter) {
                        baseClasses += "border-danger bg-danger/10 text-white";
                    } else {
                        baseClasses += "border-surface-high bg-surface text-gray-500 opacity-50";
                    }
                    btn.disabled = true;
                } else if (isAnswered && userAnswers[currentIndex].chosen === letter) {
                    baseClasses += "border-primary bg-primary/10 text-white";
                } else {
                    baseClasses += "border-surface-high bg-surface text-gray-300 hover:border-gray-500 hover:bg-surface-high";
                }

                btn.className = baseClasses;
                btn.innerHTML = `<span class="font-bold text-gray-500">${letter}.</span> <span>${q.opciones[letter]}</span>`;

                if (!btn.disabled) {
                    btn.addEventListener("click", () => handleAnswer(letter));
                }

                optContainer.appendChild(btn);
            }
        });
    }

    // Mostrar Racional CACES en Modo Tutor tras responder
    if (isAnswered && currentMode === "tutor" && rationalDiv) {
        rationalDiv.classList.remove("hidden");
        const rationalTextEl = document.getElementById("q-rational-text");
        if (rationalTextEl) {
            rationalTextEl.textContent = q.racional || "Sin racional disponible.";
        }
    }
}

function renderQuestionClinicalMedia(questionObj) {
    const textEl = document.getElementById("q-text");
    if (!textEl) return;

    let mediaWrapper = document.getElementById("q-clinical-media-wrapper");
    const imgPath = questionObj.imagenUrl || questionObj.imagen || questionObj.mediaUrl || "";

    if (!imgPath) {
        if (mediaWrapper) mediaWrapper.innerHTML = "";
        mediaWrapper?.classList.add("hidden");
        return;
    }

    if (!mediaWrapper) {
        mediaWrapper = document.createElement("div");
        mediaWrapper.id = "q-clinical-media-wrapper";
        mediaWrapper.className = "my-4 flex justify-center";
        textEl.insertAdjacentElement("afterend", mediaWrapper);
    }

    mediaWrapper.classList.remove("hidden");
    mediaWrapper.innerHTML = `
        <img
            src="${imgPath}"
            alt="Anexo Clínico del Reactivo"
            class="max-h-72 rounded-xl border border-surface-high object-contain bg-surface p-2"
            onerror="this.parentElement.classList.add('hidden')"
        />
    `;
}

export function handleAnswer(letter) {
    const questions = appState.examQuestions || [];
    const currentIndex = appState.currentQuestionIndex || 0;
    const q = questions[currentIndex];
    if (!q) return;

    appState.userAnswers[currentIndex] = {
        chosen: letter,
        isCorrect: letter === q.respuestaCorrecta
    };

    renderExamQuestion();
    renderMatrix();
}

export function toggleMarkForReview(index = appState.currentQuestionIndex) {
    if (!(appState.markedForReview instanceof Set)) {
        appState.markedForReview = new Set();
    }

    if (appState.markedForReview.has(index)) {
        appState.markedForReview.delete(index);
    } else {
        appState.markedForReview.add(index);
    }

    renderMatrix();
}

export function renderMatrix() {
    const grid = document.getElementById("matrix-grid");
    if (!grid) return;

    const questions = appState.examQuestions || [];
    const currentIndex = appState.currentQuestionIndex || 0;
    const userAnswers = appState.userAnswers || {};
    const markedSet = appState.markedForReview instanceof Set ? appState.markedForReview : new Set();

    grid.innerHTML = "";

    for (let i = 0; i < questions.length; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = i + 1;

        let classes = "w-full aspect-square rounded font-bold text-xs flex items-center justify-center transition-colors border ";

        if (i === currentIndex) {
            classes += "ring-2 ring-white ";
        }

        if (userAnswers[i]) {
            classes += "bg-primary text-surface-container border-primary";
        } else if (markedSet.has(i)) {
            classes += "bg-warning text-surface-container border-warning";
        } else {
            classes += "bg-surface text-gray-400 border-surface-high hover:border-gray-500";
        }

        btn.className = classes;

        // Clic izquierdo: ir a la pregunta | Clic derecho: marcar/desmarcar para revisión
        btn.addEventListener("click", () => {
            appState.currentQuestionIndex = i;
            renderExamQuestion();
            renderMatrix();
        });

        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            toggleMarkForReview(i);
        });

        grid.appendChild(btn);
    }
}

// ============================================================================
// 10. SALIDA SEGURA, CALIFICACIÓN CACES Y SINCRONIZACIÓN DE MÉTRICAS
// ============================================================================
export function quitExam() {
    stopCountdownTimer();
    resetExamSessionState();
    navigateToView("view-launcher");
}

export async function submitExam() {
    stopCountdownTimer();

    const questions = appState.examQuestions || [];
    const userAnswers = appState.userAnswers || {};
    const totalQuestions = questions.length || 1;

    appState.isExamActive = false;

    let correctCount = 0;
    Object.values(userAnswers).forEach(ans => {
        if (ans && ans.isCorrect) correctCount++;
    });

    const score = (correctCount / totalQuestions) * 100;
    const passed = score >= PASSING_SCORE_CACES;

    alert(
        `Simulacro Finalizado.\nCalificación: ${score.toFixed(2)}/100\n${passed ? "✅ Aprobado" : "❌ Reprobado"}`
    );

    const userData = getActiveUserData();
    if (userData) {
        const prevExams = Number(userData.totalExamsCompleted || 0);
        const prevAvg = Number(userData.globalAverage || 0);
        const prevCases = Number(userData.casesUsedThisMonth || 0);
        const answeredOrTotal = Object.keys(userAnswers).length || questions.length;

        const newTotalExams = prevExams + 1;
        const newCasesUsed = prevCases + answeredOrTotal;
        const newGlobalAvg = ((prevAvg * prevExams) + score) / newTotalExams;

        updateUserMetricsInState({
            totalExamsCompleted: newTotalExams,
            casesUsedThisMonth: newCasesUsed,
            globalAverage: newGlobalAvg
        });

        if (auth?.currentUser?.uid) {
            try {
                await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
                    totalExamsCompleted: newTotalExams,
                    casesUsedThisMonth: newCasesUsed,
                    globalAverage: newGlobalAvg
                });
            } catch (err) {
                console.error("[Makai ExamController] Error actualizando métricas en Firestore:", err);
            }
        }
    }

    resetExamSessionState();
    navigateToView("view-metrics");
    initMetrics();
}

// ============================================================================
// 11. VISTA 4: PANEL DE MÉTRICAS Y DESEMPEÑO (#view-metrics)
// ============================================================================
export function initMetrics() {
    const userData = getActiveUserData();
    if (!userData) return;

    const avgEl = document.getElementById("metric-avg");
    const examsEl = document.getElementById("metric-exams");
    const casesEl = document.getElementById("metric-cases");

    if (avgEl) {
        avgEl.textContent = `${Number(userData.globalAverage || 0).toFixed(1)}%`;
    }
    if (examsEl) {
        examsEl.textContent = Number(userData.totalExamsCompleted || 0);
    }
    if (casesEl) {
        const limitLabel = isUserProOrAdmin(userData) ? "∞" : FREEMIUM_MONTHLY_CASE_LIMIT;
        casesEl.textContent = `${Number(userData.casesUsedThisMonth || 0)} / ${limitLabel}`;
    }
}
