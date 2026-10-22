/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — SUBCOMPONENTE DE CALIFICACIÓN Y MÉTRICAS
 * Archivo: js/4-exams/exam.grader.js
 * Propósito: Calificación oficial sobre 100 puntos (estándar CACES >= 70/100),
 *            persistencia de métricas en Cloud Firestore, diagnóstico de áreas
 *            clínicas débiles e historial de simulacros en #view-metrics.
 * ============================================================================
 */

import {
    auth,
    db,
    COLLECTIONS,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    updateUserMetricsInState,
    resetExamSessionState,
    FREEMIUM_MONTHLY_CASE_LIMIT
} from "../2-core/state.store.js";

// ============================================================================
// 1. CONSTANTES DE EVALUACIÓN CACES Y ALMACENAMIENTO LOCAL DE RESPALDO
// ============================================================================

export const CACES_PASSING_SCORE = 70.0;
export const MAX_HISTORY_ITEMS = 25;

const LOCAL_HISTORY_KEY_PREFIX = "makai_exam_history_";
const LOCAL_SUBJECT_STATS_KEY_PREFIX = "makai_subject_stats_";
const LOCAL_FAILED_QUESTIONS_KEY_PREFIX = "makai_failed_questions_";

let isSubmittingExam = false;

// ============================================================================
// 2. UTILIDADES DE ACCESO AL ESTADO Y NAVEGACIÓN SPA
// ============================================================================

/**
 * Obtiene el identificador único del estudiante autenticado.
 * @returns {string}
 */
function getCurrentUid() {
    return auth?.currentUser?.uid || appState?.currentUser?.uid || appState?.currentUserData?.uid || "guest";
}

/**
 * Detiene de forma segura cualquier cronómetro activo en memoria o ventana global.
 */
function stopActiveExamTimers() {
    if (appState?.examTimerInterval) {
        clearInterval(appState.examTimerInterval);
        appState.examTimerInterval = null;
    }
    if (window.examTimerInterval) {
        clearInterval(window.examTimerInterval);
        window.examTimerInterval = null;
    }
    if (typeof window.MakaiExamTimer?.stopTimer === "function") {
        try {
            window.MakaiExamTimer.stopTimer();
        } catch (err) {
            console.warn("[ExamGrader] Aviso al detener exam.timer.js:", err);
        }
    }
}

/**
 * Navega hacia una vista del Dashboard usando el Router SPA o el conmutador nativo.
 * @param {string} viewId
 */
function navigateToDashboardView(viewId) {
    if (typeof window.MakaiRouter?.switchView === "function") {
        window.MakaiRouter.switchView(viewId, { force: true });
        return;
    }
    if (typeof window.MakaiOrchestrator?.switchView === "function") {
        window.MakaiOrchestrator.switchView(viewId);
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

    document.querySelectorAll(".nav-btn").forEach(btn => {
        const isTarget = btn.dataset.target === viewId;
        if (isTarget) {
            btn.classList.remove("text-gray-400", "hover:bg-surface-high");
            btn.classList.add("bg-primary", "text-surface-container");
        } else {
            btn.classList.remove("bg-primary", "text-surface-container");
            btn.classList.add("text-gray-400");
            if (!btn.id?.includes("admin")) {
                btn.classList.add("hover:bg-surface-high");
            }
        }
    });
}

// ============================================================================
// 3. MOTOR DE CÁLCULO Y AUDITORÍA DE REACTIVOS (SOBRE 100 PUNTOS)
// ============================================================================

/**
 * Calcula el informe completo de calificación de un simulacro.
 * @param {Array<Object>} questions - Lista de reactivos del examen
 * @param {Object} userAnswers - Mapa de respuestas del estudiante { [index]: { chosen, isCorrect } }
 * @param {Object} meta - Metadatos de carrera, modalidad, etapa y tiempo
 * @returns {Object} Informe detallado de calificación
 */
export function calculateExamReport(questions = [], userAnswers = {}, meta = {}) {
    const validQuestions = Array.isArray(questions) ? questions : [];
    const totalQuestions = validQuestions.length;

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const subjectBreakdown = {};
    const difficultyBreakdown = {};
    const newlyFailedQuestions = [];
    const newlyMasteredQuestionIds = [];
    const questionAuditList = [];

    validQuestions.forEach((q, idx) => {
        const answerObj = userAnswers?.[idx];
        const chosenLetter = answerObj?.chosen || null;
        const correctLetter = q.respuestaCorrecta || "A";
        const isAnswered = chosenLetter !== null && chosenLetter !== undefined && chosenLetter !== "";
        const isCorrect = isAnswered
            ? (typeof answerObj.isCorrect === "boolean" ? answerObj.isCorrect : chosenLetter === correctLetter)
            : false;

        if (!isAnswered) {
            unansweredCount++;
        } else if (isCorrect) {
            correctCount++;
        } else {
            incorrectCount++;
        }

        const subjectName = (q.materia || meta.subject || "Clínica General").trim();
        const difficultyLevel = (q.dificultad || "Intermedio").trim();
        const qIdentifier = q.id || `${q.carrera || "caces"}_${subjectName}_${ (q.enunciado || "").slice(0, 40) }`;

        if (!subjectBreakdown[subjectName]) {
            subjectBreakdown[subjectName] = {
                materia: subjectName,
                total: 0,
                correct: 0,
                incorrect: 0,
                unanswered: 0,
                accuracy: 0
            };
        }

        subjectBreakdown[subjectName].total += 1;
        if (isCorrect) {
            subjectBreakdown[subjectName].correct += 1;
            newlyMasteredQuestionIds.push(qIdentifier);
        } else {
            if (isAnswered) {
                subjectBreakdown[subjectName].incorrect += 1;
            } else {
                subjectBreakdown[subjectName].unanswered += 1;
            }
            newlyFailedQuestions.push({
                id: qIdentifier,
                carrera: q.carrera || meta.career || "medicina",
                materia: subjectName,
                dificultad: difficultyLevel,
                enunciado: q.enunciado || "",
                opciones: q.opciones || {},
                respuestaCorrecta: correctLetter,
                racional: q.racional || "",
                failedAt: new Date().toISOString()
            });
        }

        if (!difficultyBreakdown[difficultyLevel]) {
            difficultyBreakdown[difficultyLevel] = {
                dificultad: difficultyLevel,
                total: 0,
                correct: 0,
                accuracy: 0
            };
        }
        difficultyBreakdown[difficultyLevel].total += 1;
        if (isCorrect) {
            difficultyBreakdown[difficultyLevel].correct += 1;
        }

        questionAuditList.push({
            index: idx + 1,
            id: qIdentifier,
            materia: subjectName,
            dificultad: difficultyLevel,
            chosen: chosenLetter,
            correctLetter,
            isAnswered,
            isCorrect
        });
    });

    Object.values(subjectBreakdown).forEach(stat => {
        stat.accuracy = stat.total > 0 ? Number(((stat.correct / stat.total) * 100).toFixed(1)) : 0;
    });

    Object.values(difficultyBreakdown).forEach(stat => {
        stat.accuracy = stat.total > 0 ? Number(((stat.correct / stat.total) * 100).toFixed(1)) : 0;
    });

    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const finalScore = Number(rawScore.toFixed(2));
    const passed = finalScore >= CACES_PASSING_SCORE;
    const answeredCount = correctCount + incorrectCount;

    const now = new Date();
    const readableDate = now.toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "short",
        timeStyle: "short"
    });

    return {
        attemptId: `sim_${now.getTime()}`,
        timestampIso: now.toISOString(),
        fechaLegible: readableDate,
        academicTrack: meta.academicTrack || appState?.currentAcademicTrack || "caces",
        career: meta.career || appState?.currentCareer || "medicina",
        stage: meta.stage || appState?.currentStage || "habilitacion_caces",
        subject: meta.subject || appState?.currentSubject || "Todas las materias",
        mode: meta.mode || appState?.currentMode || "tutor",
        totalQuestions,
        answeredCount,
        correctCount,
        incorrectCount,
        unansweredCount,
        casesConsumed: answeredCount > 0 ? answeredCount : totalQuestions,
        score: finalScore,
        passed,
        passingThreshold: CACES_PASSING_SCORE,
        timeSpentSeconds: meta.timeSpentSeconds || 0,
        subjectBreakdown,
        difficultyBreakdown,
        newlyFailedQuestions,
        newlyMasteredQuestionIds,
        questionAuditList
    };
}

// ============================================================================
// 4. PERSISTENCIA EN CLOUD FIRESTORE Y ACTUALIZACIÓN DE MEMORIA
// ============================================================================

/**
 * Combina las estadísticas históricas por materia con los resultados del nuevo simulacro.
 * @param {Object} existingStats
 * @param {Object} newBreakdown
 * @returns {Object}
 */
function mergeSubjectStatistics(existingStats = {}, newBreakdown = {}) {
    const merged = { ...existingStats };

    Object.entries(newBreakdown).forEach(([subjectName, stat]) => {
        const prev = merged[subjectName] || {
            materia: subjectName,
            totalAnswered: 0,
            totalCorrect: 0,
            accuracy: 0,
            lastUpdated: null
        };

        const updatedTotal = (Number(prev.totalAnswered) || 0) + (Number(stat.total) || 0);
        const updatedCorrect = (Number(prev.totalCorrect) || 0) + (Number(stat.correct) || 0);
        const updatedAccuracy = updatedTotal > 0 ? Number(((updatedCorrect / updatedTotal) * 100).toFixed(1)) : 0;

        merged[subjectName] = {
            materia: subjectName,
            totalAnswered: updatedTotal,
            totalCorrect: updatedCorrect,
            accuracy: updatedAccuracy,
            lastUpdated: new Date().toISOString()
        };
    });

    return merged;
}

/**
 * Actualiza el banco de preguntas falladas del estudiante para el Modo Refuerzo Crítico.
 * @param {string} uid
 * @param {Array<Object>} newlyFailed
 * @param {Array<string>} newlyMasteredIds
 * @returns {Array<Object>}
 */
function updateFailedQuestionsBank(uid, newlyFailed = [], newlyMasteredIds = []) {
    const storageKey = `${LOCAL_FAILED_QUESTIONS_KEY_PREFIX}${uid}`;
    let currentBank = [];

    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            currentBank = JSON.parse(raw);
        }
    } catch (e) {
        currentBank = [];
    }

    const masteredSet = new Set(newlyMasteredIds);
    const filteredBank = currentBank.filter(item => !masteredSet.has(item.id));

    const mapById = new Map();
    filteredBank.forEach(item => mapById.set(item.id, item));
    newlyFailed.forEach(item => mapById.set(item.id, item));

    const updatedList = Array.from(mapById.values()).slice(-150);

    try {
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (e) {
        console.warn("[ExamGrader] No se pudo guardar caché local de refuerzo crítico:", e);
    }

    return updatedList;
}

/**
 * Devuelve las preguntas falladas previamente por el alumno para el Modo Refuerzo Crítico (30 reactivos).
 * @param {string} careerId
 * @returns {Array<Object>}
 */
export function getFailedQuestionsRegistry(careerId = null) {
    const uid = getCurrentUid();
    const storageKey = `${LOCAL_FAILED_QUESTIONS_KEY_PREFIX}${uid}`;

    try {
        const raw = localStorage.getItem(storageKey);
        const list = raw ? JSON.parse(raw) : [];
        if (!careerId) return list;
        return list.filter(q => !q.carrera || q.carrera === careerId);
    } catch (e) {
        return [];
    }
}

/**
 * Guarda las métricas actualizadas del estudiante en memoria, localStorage y Cloud Firestore.
 * @param {Object} report - Resultado generado por calculateExamReport()
 * @returns {Promise<Object>} Datos actualizados del usuario
 */
export async function persistUserMetricsToFirestore(report) {
    const uid = getCurrentUid();
    const currentUserData = appState?.currentUserData || {};

    const prevExams = Number(currentUserData.totalExamsCompleted) || 0;
    const prevAvg = Number(currentUserData.globalAverage) || 0;
    const prevCasesUsed = Number(currentUserData.casesUsedThisMonth) || 0;

    const newTotalExams = prevExams + 1;
    const newCasesUsed = prevCasesUsed + (Number(report.casesConsumed) || 0);
    const newGlobalAverage = Number((((prevAvg * prevExams) + report.score) / newTotalExams).toFixed(2));

    // Historial resumido del intento
    const historyEntry = {
        attemptId: report.attemptId,
        fecha: report.fechaLegible,
        timestampIso: report.timestampIso,
        carrera: report.career,
        materia: report.subject,
        modo: report.mode,
        reactivos: report.totalQuestions,
        aciertos: report.correctCount,
        score: report.score,
        passed: report.passed
    };

    const existingHistory = Array.isArray(currentUserData.historialSimulacros)
        ? currentUserData.historialSimulacros
        : getLocalExamHistory(uid);

    const updatedHistory = [historyEntry, ...existingHistory].slice(0, MAX_HISTORY_ITEMS);

    const existingSubjectStats = currentUserData.estadisticasMaterias || getLocalSubjectStats(uid);
    const updatedSubjectStats = mergeSubjectStatistics(existingSubjectStats, report.subjectBreakdown);

    updateFailedQuestionsBank(uid, report.newlyFailedQuestions, report.newlyMasteredQuestionIds);

    // Guardar en localStorage como respaldo instantáneo
    try {
        localStorage.setItem(`${LOCAL_HISTORY_KEY_PREFIX}${uid}`, JSON.stringify(updatedHistory));
        localStorage.setItem(`${LOCAL_SUBJECT_STATS_KEY_PREFIX}${uid}`, JSON.stringify(updatedSubjectStats));
    } catch (e) {
        console.warn("[ExamGrader] Aviso guardando historial local:", e);
    }

    // Actualizar memoria global en state.store.js
    const metricsPatch = {
        totalExamsCompleted: newTotalExams,
        casesUsedThisMonth: newCasesUsed,
        globalAverage: newGlobalAverage,
        historialSimulacros: updatedHistory,
        estadisticasMaterias: updatedSubjectStats,
        lastExamCompletedAt: report.timestampIso
    };

    if (typeof updateUserMetricsInState === "function") {
        updateUserMetricsInState(metricsPatch);
    } else if (appState?.currentUserData) {
        Object.assign(appState.currentUserData, metricsPatch);
    }

    // Sincronizar con la colección "usuarios" en Cloud Firestore
    const activeAuthUser = auth?.currentUser || appState?.currentUser;
    if (activeAuthUser?.uid) {
        try {
            const usersCollection = COLLECTIONS?.USERS || "usuarios";
            const userRef = doc(db, usersCollection, activeAuthUser.uid);
            await updateDoc(userRef, {
                totalExamsCompleted: newTotalExams,
                casesUsedThisMonth: newCasesUsed,
                globalAverage: newGlobalAverage,
                historialSimulacros: updatedHistory,
                estadisticasMaterias: updatedSubjectStats,
                lastExamCompletedAt: report.timestampIso
            });
        } catch (fireErr) {
            console.warn("[ExamGrader] Fallback setDoc merge en Firestore:", fireErr);
            try {
                const usersCollection = COLLECTIONS?.USERS || "usuarios";
                await setDoc(doc(db, usersCollection, activeAuthUser.uid), metricsPatch, { merge: true });
            } catch (err2) {
                console.error("[ExamGrader] No se pudo sincronizar métricas en Firestore:", err2);
            }
        }
    }

    return metricsPatch;
}

function getLocalExamHistory(uid) {
    try {
        const raw = localStorage.getItem(`${LOCAL_HISTORY_KEY_PREFIX}${uid}`);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function getLocalSubjectStats(uid) {
    try {
        const raw = localStorage.getItem(`${LOCAL_SUBJECT_STATS_KEY_PREFIX}${uid}`);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

// ============================================================================
// 5. FUNCIÓN MAESTRA DE CIERRE Y ENVÍO DE SIMULACRO (submitExam)
// ============================================================================

/**
 * Concluye el simulacro activo, califica las respuestas, actualiza Firestore
 * y dirige al estudiante hacia el panel de métricas con su informe clínico.
 * @param {Object} options - Opciones adicionales ({ autoSubmittedByTimer, customQuestions, customAnswers })
 * @returns {Promise<Object|null>} Informe de calificación
 */
export async function submitExam(options = {}) {
    if (isSubmittingExam) return null;
    isSubmittingExam = true;

    try {
        stopActiveExamTimers();

        const questions = options.customQuestions
            || (Array.isArray(appState?.examQuestions) && appState.examQuestions.length > 0
                ? appState.examQuestions
                : (window.examQuestions || []));

        const answers = options.customAnswers
            || (appState?.userAnswers && Object.keys(appState.userAnswers).length > 0
                ? appState.userAnswers
                : (window.userAnswers || {}));

        if (!questions || questions.length === 0) {
            console.warn("[ExamGrader] No hay reactivos activos para calificar.");
            if (typeof resetExamSessionState === "function") {
                resetExamSessionState();
            } else if (appState) {
                appState.isExamActive = false;
            }
            isSubmittingExam = false;
            return null;
        }

        // Desactivar protección de examen en curso
        if (appState) {
            appState.isExamActive = false;
        }
        window.isExamActive = false;

        const report = calculateExamReport(questions, answers, {
            academicTrack: appState?.currentAcademicTrack || "caces",
            career: appState?.currentCareer || "medicina",
            stage: appState?.currentStage || "habilitacion_caces",
            subject: appState?.currentSubject || "General",
            mode: appState?.currentMode || "tutor"
        });

        await persistUserMetricsToFirestore(report);

        // Limpiar estado de sesión del simulacro tras calificar
        if (typeof resetExamSessionState === "function") {
            resetExamSessionState();
        }

        // Conmutar a la vista de Métricas y actualizar indicadores
        navigateToDashboardView("view-metrics");
        initMetrics();

        // Mostrar modal Cyber-Medical con el dictamen CACES
        showExamResultsModal(report, {
            autoSubmittedByTimer: !!options.autoSubmittedByTimer
        });

        window.dispatchEvent(new CustomEvent("makai:examGraded", {
            detail: report
        }));

        return report;
    } catch (err) {
        console.error("[ExamGrader] Error crítico al calificar el simulacro:", err);
        alert("Ocurrió un inconveniente al procesar tu calificación. Tus respuestas locales han sido resguardadas.");
        return null;
    } finally {
        isSubmittingExam = false;
    }
}

// ============================================================================
// 6. MODAL INTERACTIVO DE DICTAMEN DE CALIFICACIÓN CACES
// ============================================================================

/**
 * Despliega un visor emergente Cyber-Medical con la nota final sobre 100 puntos,
 * el estado de aprobación CACES (70/100) y el rendimiento por asignatura.
 * @param {Object} report
 * @param {Object} options
 */
export function showExamResultsModal(report, options = {}) {
    if (!report) return;

    let modal = document.getElementById("makai-exam-result-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "makai-exam-result-modal";
        modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto";
        document.body.appendChild(modal);
    }

    const isPassed = report.passed;
    const statusBadgeClass = isPassed
        ? "bg-secondary/15 border-secondary text-secondary"
        : "bg-danger/15 border-danger text-danger";
    const statusIcon = isPassed ? "verified" : "warning";
    const statusLabel = isPassed
        ? "APROBADO • ESTÁNDAR CACES SUPERADO (≥ 70/100)"
        : "REPROBADO • REQUIERE REFUERZO CLÍNICO (< 70/100)";

    const subjectsListHtml = Object.values(report.subjectBreakdown || {})
        .map(s => {
            const barColor = s.accuracy >= 70 ? "bg-secondary" : (s.accuracy >= 50 ? "bg-warning" : "bg-danger");
            const textColor = s.accuracy >= 70 ? "text-secondary" : (s.accuracy >= 50 ? "text-warning" : "text-danger");
            return `
                <div class="bg-surface p-3 rounded-xl border border-surface-high">
                    <div class="flex items-center justify-between text-xs mb-1.5">
                        <span class="font-bold text-white truncate pr-2">${s.materia}</span>
                        <span class="font-mono font-extrabold ${textColor}">${s.correct}/${s.total} (${s.accuracy}%)</span>
                    </div>
                    <div class="w-full h-1.5 bg-surface-high rounded-full overflow-hidden">
                        <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, s.accuracy)}%"></div>
                    </div>
                </div>
            `;
        })
        .join("");

    modal.innerHTML = `
        <div class="bg-surface-container border-2 ${isPassed ? "border-secondary/60" : "border-primary/60"} rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-[0_0_40px_rgba(0,229,255,0.18)] text-left relative my-8">
            <div class="flex items-start justify-between gap-4 border-b border-surface-high pb-4 mb-5">
                <div>
                    <span class="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                        ${options.autoSubmittedByTimer ? "⏰ Tiempo Agotado • Cierre Automático" : "Dictamen Oficial de Simulacro • Makai Academy"}
                    </span>
                    <h3 class="text-2xl font-extrabold text-white mt-1">Informe de Calificación</h3>
                    <p class="text-xs text-gray-400 font-mono mt-0.5">
                        ${report.career.toUpperCase()} • Modo ${report.mode.toUpperCase()} • ${report.fechaLegible}
                    </p>
                </div>
                <button type="button" id="btn-close-result-modal" class="text-gray-400 hover:text-white p-1 rounded-lg">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- PUNTAJE CENTRAL SOBRE 100 -->
            <div class="bg-surface border border-surface-high rounded-2xl p-5 text-center mb-5">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-extrabold mb-3 ${statusBadgeClass}">
                    <span class="material-symbols-outlined text-sm">${statusIcon}</span>
                    <span>${statusLabel}</span>
                </div>
                <div class="text-5xl font-extrabold font-mono ${isPassed ? "text-secondary" : "text-primary"}">
                    ${report.score.toFixed(2)} <span class="text-xl text-gray-400">/ 100</span>
                </div>
                <div class="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-surface-high text-xs font-mono">
                    <div>
                        <span class="text-gray-400 block">Aciertos</span>
                        <span class="text-secondary font-extrabold text-base">${report.correctCount}</span>
                    </div>
                    <div>
                        <span class="text-gray-400 block">Errores</span>
                        <span class="text-danger font-extrabold text-base">${report.incorrectCount}</span>
                    </div>
                    <div>
                        <span class="text-gray-400 block">En Blanco</span>
                        <span class="text-warning font-extrabold text-base">${report.unansweredCount}</span>
                    </div>
                </div>
            </div>

            <!-- DESGLOSE POR ÁREA CLÍNICA -->
            <div class="mb-6">
                <h4 class="text-xs font-mono uppercase tracking-wider text-gray-400 font-bold mb-2.5">
                    Desempeño por Materia / Área Clínica
                </h4>
                <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                    ${subjectsListHtml || '<p class="text-xs text-gray-500">Sin desglose adicional.</p>'}
                </div>
            </div>

            <!-- ACCIONES -->
            <div class="flex flex-wrap items-center justify-end gap-3">
                <button type="button" id="btn-result-new-exam" class="px-4 py-2.5 rounded-xl bg-surface border border-surface-high text-gray-300 hover:text-white hover:border-primary text-xs font-bold transition-all">
                    Ir al Lanzador de Simulacros
                </button>
                <button type="button" id="btn-result-view-metrics" class="px-5 py-2.5 rounded-xl bg-primary text-surface-container font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                    Ver Panel de Métricas Detallado
                </button>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const closeModal = () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    modal.querySelector("#btn-close-result-modal")?.addEventListener("click", closeModal);
    modal.querySelector("#btn-result-view-metrics")?.addEventListener("click", () => {
        closeModal();
        navigateToDashboardView("view-metrics");
        initMetrics();
    });
    modal.querySelector("#btn-result-new-exam")?.addEventListener("click", () => {
        closeModal();
        navigateToDashboardView("view-launcher");
    });
}

// ============================================================================
// 7. PANEL INTERACTIVO "MIS MÉTRICAS" (#view-metrics EN dashboard.html)
// ============================================================================

/**
 * Inicializa y actualiza el panel de Métricas y Desempeño (#view-metrics) en dashboard.html.
 */
export function initMetrics() {
    const userData = appState?.currentUserData;
    const uid = getCurrentUid();

    const avgEl = document.getElementById("metric-avg");
    const examsEl = document.getElementById("metric-exams");
    const casesEl = document.getElementById("metric-cases");

    const globalAvg = Number(userData?.globalAverage) || 0;
    const totalExams = Number(userData?.totalExamsCompleted) || 0;
    const casesUsed = Number(userData?.casesUsedThisMonth) || 0;

    const userEmail = userData?.email || auth?.currentUser?.email || "";
    const isProOrAdmin = isMasterAdmin(userEmail)
        || userData?.subscriptionLevel === "PRO"
        || userData?.subscriptionLevel === "VIP";

    if (avgEl) {
        avgEl.textContent = `${globalAvg.toFixed(1)}%`;
        avgEl.className = `text-3xl font-extrabold font-mono ${
            globalAvg >= CACES_PASSING_SCORE
                ? "text-secondary"
                : (totalExams === 0 ? "text-primary" : "text-warning")
        }`;
    }

    if (examsEl) {
        examsEl.textContent = String(totalExams);
    }

    if (casesEl) {
        if (isProOrAdmin) {
            casesEl.textContent = `${casesUsed} / ∞ (${userData?.subscriptionLevel || "PRO"})`;
        } else {
            const limit = FREEMIUM_MONTHLY_CASE_LIMIT || 15;
            casesEl.textContent = `${casesUsed} / ${limit}`;
        }
    }

    // Inyectar o actualizar las secciones avanzadas de diagnóstico por materia e historial
    const metricsView = document.getElementById("view-metrics");
    if (!metricsView) return;

    let advancedContainer = document.getElementById("makai-metrics-advanced-container");
    if (!advancedContainer) {
        advancedContainer = document.createElement("div");
        advancedContainer.id = "makai-metrics-advanced-container";
        advancedContainer.className = "mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6";
        metricsView.appendChild(advancedContainer);
    }

    const subjectStats = userData?.estadisticasMaterias || getLocalSubjectStats(uid);
    const examHistory = Array.isArray(userData?.historialSimulacros)
        ? userData.historialSimulacros
        : getLocalExamHistory(uid);

    advancedContainer.innerHTML = `
        <!-- DIAGNÓSTICO DE ÁREAS CLÍNICAS A REFORZAR -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-lg">
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">Diagnóstico Académico CACES</span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">Rendimiento por Área Clínica</h3>
                </div>
                <span class="material-symbols-outlined text-primary">monitoring</span>
            </div>
            <div id="metrics-subjects-breakdown" class="space-y-3">
                ${renderClinicalAreasBreakdownHTML(subjectStats)}
            </div>
        </div>

        <!-- HISTORIAL DE SIMULACROS RECIENTES -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-lg">
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase tracking-widest text-secondary font-bold">Bitácora de Evaluaciones</span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">Historial de Intentos Recientes</h3>
                </div>
                <span class="material-symbols-outlined text-secondary">history_edu</span>
            </div>
            <div id="metrics-history-list" class="overflow-x-auto">
                ${renderExamHistoryTableHTML(examHistory)}
            </div>
        </div>
    `;
}

/**
 * Genera el HTML del desglose de áreas clínicas ordenadas desde la más débil a la más fuerte.
 * @param {Object} subjectStats
 * @returns {string}
 */
export function renderClinicalAreasBreakdownHTML(subjectStats = {}) {
    const entries = Object.values(subjectStats || {});
    if (entries.length === 0) {
        return `
            <div class="p-6 text-center bg-surface rounded-xl border border-surface-high text-gray-400 text-xs font-mono">
                Completa tu primer simulacro CACES para generar el diagnóstico de fortalezas y áreas clínicas que necesitas reforzar.
            </div>
        `;
    }

    // Ordenar de menor a mayor precisión para mostrar primero las materias que requieren refuerzo urgente
    entries.sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));

    return entries
        .map(item => {
            const acc = Number(item.accuracy) || 0;
            const isCritical = acc < 50;
            const isWarning = acc >= 50 && acc < CACES_PASSING_SCORE;

            const barColor = isCritical ? "bg-danger" : (isWarning ? "bg-warning" : "bg-secondary");
            const badgeClass = isCritical
                ? "bg-danger/15 text-danger border-danger/40"
                : (isWarning ? "bg-warning/15 text-warning border-warning/40" : "bg-secondary/15 text-secondary border-secondary/40");
            const statusText = isCritical
                ? "Refuerzo Urgente"
                : (isWarning ? "En Calibración (<70%)" : "Dominio Óptimo CACES");

            return `
                <div class="p-3.5 bg-surface rounded-xl border border-surface-high">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span class="text-xs font-bold text-white">${item.materia}</span>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${badgeClass}">
                                ${statusText}
                            </span>
                            <span class="text-xs font-mono font-extrabold text-white">
                                ${acc.toFixed(1)}% (${item.totalCorrect}/${item.totalAnswered})
                            </span>
                        </div>
                    </div>
                    <div class="w-full h-2 bg-surface-high rounded-full overflow-hidden">
                        <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, acc)}%"></div>
                    </div>
                </div>
            `;
        })
        .join("");
}

/**
 * Genera la tabla HTML con el historial de simulacros realizados por el estudiante.
 * @param {Array<Object>} historyList
 * @returns {string}
 */
function renderExamHistoryTableHTML(historyList = []) {
    if (!Array.isArray(historyList) || historyList.length === 0) {
        return `
            <div class="p-6 text-center bg-surface rounded-xl border border-surface-high text-gray-400 text-xs font-mono">
                Aún no registras simulacros finalizados en tu expediente.
            </div>
        `;
    }

    const rowsHtml = historyList
        .slice(0, 10)
        .map(item => {
            const passed = Number(item.score) >= CACES_PASSING_SCORE;
            return `
                <tr class="border-b border-surface-high hover:bg-surface/60">
                    <td class="px-3 py-2.5 text-[11px] text-gray-300">${item.fecha || "---"}</td>
                    <td class="px-3 py-2.5">
                        <div class="text-xs font-bold text-white uppercase">${item.carrera || "CACES"}</div>
                        <div class="text-[10px] text-gray-400">Modo ${(item.modo || "tutor").toUpperCase()} • ${item.reactivos || 0} preg.</div>
                    </td>
                    <td class="px-3 py-2.5 font-mono font-extrabold text-xs ${passed ? "text-secondary" : "text-warning"}">
                        ${Number(item.score || 0).toFixed(1)} / 100
                    </td>
                    <td class="px-3 py-2.5">
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            passed ? "bg-secondary/15 text-secondary" : "bg-danger/15 text-danger"
                        }">
                            ${passed ? "APROBADO" : "REPROBADO"}
                        </span>
                    </td>
                </tr>
            `;
        })
        .join("");

    return `
        <table class="w-full text-left font-mono text-xs text-gray-300">
            <thead class="text-[10px] uppercase text-gray-400 bg-surface border-b border-surface-high">
                <tr>
                    <th class="px-3 py-2">Fecha</th>
                    <th class="px-3 py-2">Carrera / Modo</th>
                    <th class="px-3 py-2">Puntaje</th>
                    <th class="px-3 py-2">Estado</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
}

/**
 * Alias de inicialización invocado por app.orchestrator.js o exam.controller.js.
 */
export function initExamGrader() {
    initMetrics();
}

// Exposición global controlada para interoperabilidad entre los módulos de js/4-exams/
if (typeof window !== "undefined") {
    window.MakaiExamGrader = {
        initExamGrader,
        initMetrics,
        submitExam,
        calculateExamReport,
        persistUserMetricsToFirestore,
        showExamResultsModal,
        getFailedQuestionsRegistry
    };
}
