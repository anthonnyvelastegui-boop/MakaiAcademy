/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — RENDERIZADOR DE CASOS CLÍNICOS CACES
 * Archivo: js/4-exams/exam.renderer.js
 * Propósito: Renderizado dinámico del caso clínico activo, signos vitales,
 *            imágenes diagnósticas (assets/4-banco-clinico/), opciones A-D,
 *            retroalimentación en Modo Tutor y Racional CACES.
 * ============================================================================
 */

import {
    appState,
    setExamSessionState
} from "../2-core/state.store.js";

import {
    renderMatrix,
    navigateToQuestion,
    toggleMarkForReview,
    registerQuestionRendererCallback
} from "./exam.matrix.js";

// --- ESTADO INTERNO DEL RENDERIZADOR ---
let isPostExamReviewMode = false;
let rendererEventsBound = false;
let onSubmitExamCallback = null;

/**
 * Normaliza la estructura de un reactivo proveniente de Firestore (`preguntas_caces`)
 * o del banco semilla local (`curriculum.data.js`) para garantizar compatibilidad total.
 * @param {Object} rawQuestion
 * @param {number} index
 * @returns {Object}
 */
function normalizeQuestionObject(rawQuestion = {}, index = 0) {
    const opcionesRaw = rawQuestion.opciones || rawQuestion.options || {};
    const opciones = {
        A: opcionesRaw.A || opcionesRaw.a || rawQuestion.opcionA || "",
        B: opcionesRaw.B || opcionesRaw.b || rawQuestion.opcionB || "",
        C: opcionesRaw.C || opcionesRaw.c || rawQuestion.opcionC || "",
        D: opcionesRaw.D || opcionesRaw.d || rawQuestion.opcionD || ""
    };

    const respuestaCorrecta = String(
        rawQuestion.respuestaCorrecta ||
        rawQuestion.correctAnswer ||
        rawQuestion.correcta ||
        "A"
    )
        .trim()
        .toUpperCase();

    return {
        id: rawQuestion.id || `reactivo-${index + 1}`,
        carrera: rawQuestion.carrera || appState.currentCareer || "medicina",
        etapa: rawQuestion.etapa || rawQuestion.semestre || appState.currentStage || "CACES Oficial",
        materia: rawQuestion.materia || appState.currentSubject || "Clínica General",
        dificultad: rawQuestion.dificultad || rawQuestion.difficulty || "Media",
        enunciado:
            rawQuestion.enunciado ||
            rawQuestion.pregunta ||
            rawQuestion.question ||
            "Caso clínico sin enunciado especificado.",
        opciones,
        respuestaCorrecta,
        racional:
            rawQuestion.racional ||
            rawQuestion.justificacion ||
            rawQuestion.rationale ||
            "Justificación clínica validada conforme a las Guías de Práctica Clínica (GPC) del MSP y bibliografía oficial CACES.",
        referencia:
            rawQuestion.referencia ||
            rawQuestion.bibliografia ||
            "Normativa Oficial MSP Ecuador / Bibliografía CACES",
        imagenUrl:
            rawQuestion.imagenUrl ||
            rawQuestion.imagen ||
            rawQuestion.mediaUrl ||
            null,
        signosVitales:
            rawQuestion.signosVitales ||
            rawQuestion.vitalSigns ||
            null
    };
}

/**
 * Devuelve el arreglo de preguntas activas desde `appState`.
 * @returns {Array<Object>}
 */
function getActiveQuestions() {
    return Array.isArray(appState.examQuestions) ? appState.examQuestions : [];
}

/**
 * Devuelve el mapa de respuestas del usuario desde `appState`.
 * @returns {Object}
 */
function getActiveUserAnswers() {
    if (!appState.userAnswers || typeof appState.userAnswers !== "object") {
        appState.userAnswers = {};
    }
    return appState.userAnswers;
}

/**
 * Asegura que el conjunto `markedForReview` sea un `Set` válido.
 * @returns {Set<number>}
 */
function ensureMarkedSet() {
    if (!(appState.markedForReview instanceof Set)) {
        const initial = Array.isArray(appState.markedForReview)
            ? appState.markedForReview
            : [];
        appState.markedForReview = new Set(initial);
    }
    return appState.markedForReview;
}

/**
 * Configura el modo de revisión post-examen (cuando el alumno ya entregó el simulacro
 * y desea inspeccionar todas las respuestas con su Racional CACES).
 * @param {boolean} enabled
 */
export function setExamReviewMode(enabled = false) {
    isPostExamReviewMode = Boolean(enabled);
    if (appState.examQuestions && appState.examQuestions.length > 0) {
        renderExamQuestion(appState.currentQuestionIndex);
    }
}

/**
 * Registra un callback personalizado para cuando el estudiante concluye el examen
 * desde el botón de la última pregunta (`#btn-next-tutor`).
 * @param {Function} submitFn
 */
export function registerSubmitExamCallback(submitFn) {
    if (typeof submitFn === "function") {
        onSubmitExamCallback = submitFn;
    }
}

/**
 * Inyecta de forma no destructiva los contenedores clínicos complementarios
 * dentro de la tarjeta del caso clínico en `dashboard.html` si aún no existen:
 * - Etiqueta de Materia / Subespecialidad (`#q-subject-badge`)
 * - Tabla táctica de Signos Vitales (`#q-vitals-box`)
 * - Contenedor de Imagen Diagnóstica (`#q-media-box`)
 * - Barra inferior de navegación (Anterior / Limpiar selección / Marcar / Siguiente)
 * - Modal de zoom clínico para radiografías y ECGs (`#clinical-image-zoom-modal`)
 */
function ensureClinicalRendererDOM() {
    const qTextEl = document.getElementById("q-text");
    const qOptionsEl = document.getElementById("q-options");
    const qCounterEl = document.getElementById("q-counter");

    // 1. Inyectar insignia de materia junto al contador o dificultad
    if (qCounterEl && qCounterEl.parentElement && !document.getElementById("q-subject-badge")) {
        const badgeWrap = document.createElement("div");
        badgeWrap.className = "flex flex-wrap items-center gap-2";
        badgeWrap.innerHTML = `
            <span id="q-subject-badge" class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-primary/10 text-primary border border-primary/30">
                Materia CACES
            </span>
        `;
        qCounterEl.parentElement.insertBefore(badgeWrap, qCounterEl.nextSibling);
    }

    // 2. Inyectar contenedores de Signos Vitales e Imagen Clínica antes de #q-options
    if (qTextEl && qOptionsEl && qTextEl.parentElement && !document.getElementById("q-clinical-extras")) {
        const extrasContainer = document.createElement("div");
        extrasContainer.id = "q-clinical-extras";
        extrasContainer.className = "space-y-4 my-4";
        extrasContainer.innerHTML = `
            <!-- Tabla de Signos Vitales Opcional -->
            <div id="q-vitals-box" class="hidden bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-primary mb-2">
                    <span class="material-symbols-outlined text-sm">monitor_heart</span>
                    <span>Constantes Vitales / Parámetros de Ingreso</span>
                </div>
                <div id="q-vitals-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono"></div>
            </div>

            <!-- Visor de Imagen Diagnóstica Opcional (assets/4-banco-clinico/) -->
            <div id="q-media-box" class="hidden bg-surface p-3 rounded-xl border border-surface-high">
                <div class="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-2">
                    <span class="flex items-center gap-1.5 text-primary">
                        <span class="material-symbols-outlined text-sm">radiology</span>
                        <span>Anexo Diagnóstico Clínico</span>
                    </span>
                    <button type="button" id="btn-zoom-clinical-img" class="text-xs text-primary hover:underline flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">zoom_in</span>
                        <span>Ampliar imagen</span>
                    </button>
                </div>
                <div class="relative rounded-lg overflow-hidden bg-black/50 border border-surface-high flex justify-center items-center max-h-80">
                    <img id="q-clinical-image" src="" alt="Imagen clínica del caso" class="max-h-72 w-auto object-contain cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]" />
                </div>
            </div>
        `;
        qOptionsEl.parentElement.insertBefore(extrasContainer, qOptionsEl);

        const imgEl = document.getElementById("q-clinical-image");
        const zoomBtn = document.getElementById("btn-zoom-clinical-img");
        const openZoom = () => {
            if (imgEl && imgEl.src) {
                openClinicalImageZoom(imgEl.src, document.getElementById("q-counter")?.textContent || "Anexo Clínico");
            }
        };
        imgEl?.addEventListener("click", openZoom);
        zoomBtn?.addEventListener("click", openZoom);
    }

    // 3. Inyectar barra táctica de navegación al pie del caso clínico (si no existe)
    if (qOptionsEl && qOptionsEl.parentElement && !document.getElementById("q-navigation-footer")) {
        const navFooter = document.createElement("div");
        navFooter.id = "q-navigation-footer";
        navFooter.className = "mt-6 pt-4 border-t border-surface-high flex flex-wrap items-center justify-between gap-3";
        navFooter.innerHTML = `
            <div class="flex items-center gap-2">
                <button type="button" id="btn-prev-question" class="px-3.5 py-2 rounded-xl bg-surface border border-surface-high text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none">
                    <span class="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Anterior</span>
                </button>
                <button type="button" id="btn-clear-answer" class="hidden px-3 py-2 rounded-xl bg-surface border border-surface-high text-gray-400 hover:text-danger hover:border-danger/50 text-xs font-semibold items-center gap-1 transition-all">
                    <span class="material-symbols-outlined text-sm">restart_alt</span>
                    <span>Limpiar</span>
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button type="button" id="btn-inline-mark-review" class="px-3.5 py-2 rounded-xl bg-surface border border-surface-high text-gray-300 hover:border-warning hover:text-warning text-xs font-bold flex items-center gap-1.5 transition-all">
                    <span class="material-symbols-outlined text-sm">flag</span>
                    <span id="label-inline-mark-review">Duda / Revisión</span>
                </button>
                <button type="button" id="btn-next-question-nav" class="px-4 py-2 rounded-xl bg-primary text-surface-container hover:bg-opacity-90 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                    <span id="label-next-question-nav">Siguiente</span>
                    <span class="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
            </div>
        `;
        qOptionsEl.parentElement.appendChild(navFooter);

        document.getElementById("btn-prev-question")?.addEventListener("click", () => {
            goToPrevQuestion();
        });

        document.getElementById("btn-clear-answer")?.addEventListener("click", () => {
            clearCurrentAnswer();
        });

        document.getElementById("btn-inline-mark-review")?.addEventListener("click", () => {
            toggleMarkForReview(appState.currentQuestionIndex);
            updateInlineReviewButtonState();
        });

        document.getElementById("btn-next-question-nav")?.addEventListener("click", () => {
            goToNextQuestion();
        });
    }

    // 4. Crear modal de zoom clínico en el body si no existe
    if (!document.getElementById("clinical-image-zoom-modal")) {
        const modal = document.createElement("div");
        modal.id = "clinical-image-zoom-modal";
        modal.className = "hidden fixed inset-0 z-50 bg-black/85 backdrop-blur-sm items-center justify-center p-4";
        modal.innerHTML = `
            <div class="relative bg-surface-container border border-surface-high rounded-2xl max-w-4xl w-full p-4 shadow-2xl">
                <div class="flex items-center justify-between pb-3 mb-3 border-b border-surface-high">
                    <span id="clinical-zoom-caption" class="text-xs font-mono text-primary font-bold uppercase tracking-wider">Anexo Diagnóstico</span>
                    <button type="button" id="btn-close-clinical-zoom" class="p-1.5 rounded-lg bg-surface text-gray-400 hover:text-white border border-surface-high">
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
                <div class="flex items-center justify-center max-h-[78vh] overflow-auto bg-black rounded-xl p-2">
                    <img id="clinical-zoom-img" src="" alt="Vista ampliada" class="max-h-[74vh] w-auto object-contain" />
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        };
        document.getElementById("btn-close-clinical-zoom")?.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

/**
 * Abre el visor modal de alta resolución para inspeccionar imágenes clínicas.
 * @param {string} src Ruta hacia `assets/4-banco-clinico/...` o URL externa
 * @param {string} [caption]
 */
export function openClinicalImageZoom(src, caption = "Anexo Diagnóstico CACES") {
    ensureClinicalRendererDOM();
    const modal = document.getElementById("clinical-image-zoom-modal");
    const img = document.getElementById("clinical-zoom-img");
    const cap = document.getElementById("clinical-zoom-caption");
    if (!modal || !img) return;

    img.src = src;
    if (cap) cap.textContent = caption;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

/**
 * Renderiza la tabla de signos vitales si el caso clínico los incluye.
 * Soporta tanto un objeto `{ PA: "120/80 mmHg", FC: "98 lpm", ... }` como un string.
 * @param {Object|string|null} vitals
 */
function renderVitalSignsSection(vitals) {
    const vitalsBox = document.getElementById("q-vitals-box");
    const vitalsGrid = document.getElementById("q-vitals-grid");
    if (!vitalsBox || !vitalsGrid) return;

    if (!vitals || (typeof vitals === "object" && Object.keys(vitals).length === 0)) {
        vitalsBox.classList.add("hidden");
        vitalsGrid.innerHTML = "";
        return;
    }

    vitalsGrid.innerHTML = "";

    if (typeof vitals === "string") {
        vitalsGrid.className = "text-xs font-mono text-gray-200";
        vitalsGrid.textContent = vitals;
    } else if (typeof vitals === "object") {
        vitalsGrid.className = "grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono";
        Object.entries(vitals).forEach(([key, val]) => {
            if (!val) return;
            const item = document.createElement("div");
            item.className = "bg-surface-container px-2.5 py-1.5 rounded-lg border border-surface-high flex flex-col";
            item.innerHTML = `
                <span class="text-[10px] text-gray-400 uppercase">${key}</span>
                <span class="text-white font-bold">${val}</span>
            `;
            vitalsGrid.appendChild(item);
        });
    }

    vitalsBox.classList.remove("hidden");
}

/**
 * Renderiza la imagen diagnóstica del caso clínico si está definida.
 * @param {string|null} imageUrl
 */
function renderClinicalMediaSection(imageUrl) {
    const mediaBox = document.getElementById("q-media-box");
    const imgEl = document.getElementById("q-clinical-image");
    if (!mediaBox || !imgEl) return;

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
        mediaBox.classList.add("hidden");
        imgEl.removeAttribute("src");
        return;
    }

    imgEl.src = imageUrl.trim();
    imgEl.onerror = () => {
        mediaBox.classList.add("hidden");
    };
    mediaBox.classList.remove("hidden");
}

/**
 * Sincroniza el estado visual del botón inferior de "Duda / Revisión"
 * con el conjunto `markedForReview`.
 */
function updateInlineReviewButtonState() {
    const btn = document.getElementById("btn-inline-mark-review");
    const label = document.getElementById("label-inline-mark-review");
    if (!btn) return;

    const markedSet = ensureMarkedSet();
    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const isMarked = markedSet.has(currentIndex);

    if (isMarked) {
        btn.className =
            "px-3.5 py-2 rounded-xl bg-warning/20 border border-warning text-warning text-xs font-extrabold flex items-center gap-1.5 transition-all";
        if (label) label.textContent = "En Revisión ✓";
    } else {
        btn.className =
            "px-3.5 py-2 rounded-xl bg-surface border border-surface-high text-gray-300 hover:border-warning hover:text-warning text-xs font-bold flex items-center gap-1.5 transition-all";
        if (label) label.textContent = "Duda / Revisión";
    }
}

/**
 * Devuelve las clases de color según la dificultad del reactivo.
 * @param {string} difficulty
 * @returns {string}
 */
function getDifficultyBadgeClasses(difficulty = "Media") {
    const norm = String(difficulty).toLowerCase();
    if (norm.includes("alta") || norm.includes("difícil") || norm.includes("critica")) {
        return "text-danger font-bold";
    }
    if (norm.includes("baja") || norm.includes("fácil")) {
        return "text-secondary font-bold";
    }
    return "text-warning font-bold";
}

/**
 * Renderiza en pantalla el reactivo clínico activo (`currentQuestionIndex`),
 * pintando su enunciado, signos vitales, anexo multimedia, las 4 opciones (A-D)
 * y el Racional CACES (si está en Modo Tutor o Modo Revisión).
 * @param {number} [overrideIndex] Índice opcional para saltar directamente a una pregunta
 */
export function renderExamQuestion(overrideIndex) {
    const questions = getActiveQuestions();
    if (questions.length === 0) return;

    ensureClinicalRendererDOM();

    if (overrideIndex !== undefined && overrideIndex !== null) {
        const bounded = Math.max(0, Math.min(Number(overrideIndex) || 0, questions.length - 1));
        appState.currentQuestionIndex = bounded;
    }

    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const rawQuestion = questions[currentIndex];
    if (!rawQuestion) return;

    const q = normalizeQuestionObject(rawQuestion, currentIndex);
    const answers = getActiveUserAnswers();
    const currentAnswerObj = answers[currentIndex];
    const isAnswered =
        currentAnswerObj !== undefined &&
        currentAnswerObj !== null &&
        Boolean(currentAnswerObj.chosen);

    const isTutorMode = appState.currentMode === "tutor";
    const revealCorrection = (isAnswered && isTutorMode) || isPostExamReviewMode;

    // 1. Actualizar cabecera del reactivo (#q-counter, #q-difficulty, #q-subject-badge)
    const counterEl = document.getElementById("q-counter");
    const difficultyEl = document.getElementById("q-difficulty");
    const subjectBadgeEl = document.getElementById("q-subject-badge");
    const textEl = document.getElementById("q-text");

    if (counterEl) {
        counterEl.textContent = `Reactivo ${currentIndex + 1} / ${questions.length}`;
    }
    if (difficultyEl) {
        difficultyEl.className = `text-xs font-mono ${getDifficultyBadgeClasses(q.dificultad)}`;
        difficultyEl.textContent = `Dificultad: ${q.dificultad}`;
    }
    if (subjectBadgeEl) {
        subjectBadgeEl.textContent = `${q.materia} • ${q.etapa}`;
    }
    if (textEl) {
        textEl.textContent = q.enunciado;
    }

    // 2. Renderizar Signos Vitales e Imagen Diagnóstica opcional
    renderVitalSignsSection(q.signosVitales);
    renderClinicalMediaSection(q.imagenUrl);

    // 3. Renderizar las 4 opciones de respuesta (A, B, C, D) en #q-options
    const optContainer = document.getElementById("q-options");
    if (optContainer) {
        optContainer.innerHTML = "";

        ["A", "B", "C", "D"].forEach((letter) => {
            const optionText = q.opciones[letter];
            if (!optionText) return;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.dataset.optionLetter = letter;

            let baseClasses =
                "w-full text-left p-4 rounded-xl border text-sm transition-all flex gap-4 items-start group ";
            let badgeClasses =
                "w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ";
            let statusIconHTML = "";

            if (revealCorrection) {
                // Modo Tutor respondido o Modo Revisión Post-Examen
                const isThisCorrect = letter === q.respuestaCorrecta;
                const isThisChosen = isAnswered && currentAnswerObj.chosen === letter;

                if (isThisCorrect) {
                    baseClasses += "border-secondary bg-secondary/10 text-white shadow-[0_0_15px_rgba(148,222,45,0.12)]";
                    badgeClasses += "bg-secondary text-surface-container";
                    statusIconHTML = `<span class="material-symbols-outlined text-secondary ml-auto shrink-0">check_circle</span>`;
                } else if (isThisChosen && !isThisCorrect) {
                    baseClasses += "border-danger bg-danger/10 text-white";
                    badgeClasses += "bg-danger text-white";
                    statusIconHTML = `<span class="material-symbols-outlined text-danger ml-auto shrink-0">cancel</span>`;
                } else {
                    baseClasses += "border-surface-high bg-surface text-gray-500 opacity-55";
                    badgeClasses += "bg-surface-high text-gray-500";
                }
                btn.disabled = true;
            } else if (isAnswered && currentAnswerObj.chosen === letter) {
                // Seleccionada en Modo Estándar (100) o Crítico (30)
                baseClasses += "border-primary bg-primary/10 text-white shadow-[0_0_15px_rgba(0,229,255,0.12)]";
                badgeClasses += "bg-primary text-surface-container";
                statusIconHTML = `<span class="material-symbols-outlined text-primary ml-auto shrink-0 text-base">radio_button_checked</span>`;
            } else {
                // Estado pendiente / disponible para seleccionar
                baseClasses += "border-surface-high bg-surface text-gray-300 hover:border-primary/60 hover:bg-surface-high";
                badgeClasses += "bg-surface-high text-gray-400 group-hover:text-primary";
            }

            btn.className = baseClasses;
            btn.innerHTML = `
                <span class="${badgeClasses}">${letter}</span>
                <span class="flex-1 leading-relaxed">${optionText}</span>
                ${statusIconHTML}
            `;

            if (!btn.disabled) {
                btn.addEventListener("click", () => handleAnswer(letter));
            }

            optContainer.appendChild(btn);
        });
    }

    // 4. Controlar el recuadro de "Racional CACES" (#q-rational y #q-rational-text)
    const rationalDiv = document.getElementById("q-rational");
    const rationalTextEl = document.getElementById("q-rational-text");
    if (rationalDiv) {
        if (revealCorrection) {
            rationalDiv.classList.remove("hidden");
            if (rationalTextEl) {
                const verdictPrefix = isAnswered
                    ? currentAnswerObj.isCorrect
                        ? `✓ Respuesta Correcta (${q.respuestaCorrecta}). `
                        : `✕ Respuesta Incorrecta (Elegiste ${currentAnswerObj.chosen}; la correcta es ${q.respuestaCorrecta}). `
                    : `Respuesta Oficial: ${q.respuestaCorrecta}. `;
                rationalTextEl.textContent = `${verdictPrefix}${q.racional}`;
            }
        } else {
            rationalDiv.classList.add("hidden");
        }
    }

    // 5. Actualizar estado de los controles de navegación inferiores
    const prevBtn = document.getElementById("btn-prev-question");
    const clearBtn = document.getElementById("btn-clear-answer");
    const nextLabel = document.getElementById("label-next-question-nav");

    if (prevBtn) {
        prevBtn.disabled = currentIndex <= 0;
    }

    if (clearBtn) {
        // Solo permitir limpiar respuesta si está respondida, no es Modo Tutor bloqueado y no es post-revisión
        if (isAnswered && !isTutorMode && !isPostExamReviewMode) {
            clearBtn.classList.remove("hidden");
            clearBtn.classList.add("flex");
        } else {
            clearBtn.classList.add("hidden");
            clearBtn.classList.remove("flex");
        }
    }

    if (nextLabel) {
        nextLabel.textContent =
            currentIndex >= questions.length - 1 ? "Finalizar Revisión" : "Siguiente";
    }

    updateInlineReviewButtonState();
}

/**
 * Procesa la selección de una opción (`A`, `B`, `C` o `D`) por parte del estudiante,
 * actualiza `state.store.js`, re-renderiza el caso actual y refresca `exam.matrix.js`.
 * @param {string} letter Letra seleccionada ("A" | "B" | "C" | "D")
 */
export function handleAnswer(letter) {
    if (!appState.isExamActive && !isPostExamReviewMode) return;
    if (isPostExamReviewMode) return;

    const questions = getActiveQuestions();
    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const rawQuestion = questions[currentIndex];
    if (!rawQuestion) return;

    const normalizedChoice = String(letter || "").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(normalizedChoice)) return;

    const answers = getActiveUserAnswers();

    // En Modo Tutor, si ya fue respondida, no se puede sobreescribir
    if (appState.currentMode === "tutor" && answers[currentIndex]?.chosen) {
        return;
    }

    const q = normalizeQuestionObject(rawQuestion, currentIndex);
    const isCorrect = normalizedChoice === q.respuestaCorrecta;

    answers[currentIndex] = {
        chosen: normalizedChoice,
        isCorrect,
        questionId: q.id,
        materia: q.materia,
        answeredAt: Date.now()
    };

    setExamSessionState({
        userAnswers: answers
    });

    renderExamQuestion(currentIndex);
    renderMatrix();

    // Emitir evento global para telemetría o audio de retroalimentación UI
    window.dispatchEvent(
        new CustomEvent("makai:questionAnswered", {
            detail: {
                questionIndex: currentIndex,
                chosen: normalizedChoice,
                isCorrect,
                mode: appState.currentMode
            }
        })
    );
}

/**
 * Limpia la respuesta seleccionada en el reactivo actual (habilitado en
 * Modo Estándar de 100 reactivos y Refuerzo Crítico de 30 reactivos).
 */
export function clearCurrentAnswer() {
    if (!appState.isExamActive || isPostExamReviewMode) return;
    if (appState.currentMode === "tutor") return;

    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    const answers = getActiveUserAnswers();

    if (answers[currentIndex]) {
        delete answers[currentIndex];
        setExamSessionState({
            userAnswers: answers
        });
        renderExamQuestion(currentIndex);
        renderMatrix();
    }
}

/**
 * Avanza al siguiente reactivo del simulacro o dispara la confirmación de envío
 * si el estudiante se encuentra en la última pregunta.
 */
export function goToNextQuestion() {
    const questions = getActiveQuestions();
    if (questions.length === 0) return;

    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    if (currentIndex < questions.length - 1) {
        navigateToQuestion(currentIndex + 1);
    } else {
        // Si está en el último reactivo, invocar el flujo de cierre de examen
        if (typeof onSubmitExamCallback === "function") {
            onSubmitExamCallback();
        } else if (typeof window.submitExam === "function") {
            window.submitExam();
        } else {
            document.getElementById("btn-submit-exam")?.click();
        }
    }
}

/**
 * Retrocede al reactivo anterior del simulacro.
 */
export function goToPrevQuestion() {
    const questions = getActiveQuestions();
    if (questions.length === 0) return;

    const currentIndex = Number(appState.currentQuestionIndex) || 0;
    if (currentIndex > 0) {
        navigateToQuestion(currentIndex - 1);
    }
}

/**
 * Inicializa el Subcomponente Renderizador de Exámenes (`exam.renderer.js`),
 * conectándolo con `exam.matrix.js`, el botón `#btn-next-tutor` de `dashboard.html`
 * y los atajos de teclado numéricos/alfabéticos (`A-D` / `1-4`).
 * @param {Object} [options={}]
 * @param {Function} [options.onSubmitExam] Callback opcional para concluir el simulacro
 */
export function initExamRenderer(options = {}) {
    if (typeof options.onSubmitExam === "function") {
        registerSubmitExamCallback(options.onSubmitExam);
    }

    isPostExamReviewMode = false;
    ensureClinicalRendererDOM();

    // 1. Registrar `renderExamQuestion` en `exam.matrix.js` para saltos instantáneos
    registerQuestionRendererCallback((targetIndex) => {
        renderExamQuestion(targetIndex);
    });

    // 2. Enlazar el botón `#btn-next-tutor` dentro de `#q-rational` en `dashboard.html`
    const nextTutorBtn = document.getElementById("btn-next-tutor");
    if (nextTutorBtn && !nextTutorBtn.dataset.boundRenderer) {
        nextTutorBtn.dataset.boundRenderer = "1";
        nextTutorBtn.addEventListener("click", (e) => {
            e.preventDefault();
            goToNextQuestion();
        });
    }

    // 3. Enlazar atajos de teclado clínicos (A, B, C, D o 1, 2, 3, 4) y eventos globales
    if (!rendererEventsBound) {
        rendererEventsBound = true;

        window.addEventListener("makai:questionChanged", (e) => {
            const idx = e.detail?.questionIndex ?? appState.currentQuestionIndex;
            renderExamQuestion(idx);
        });

        document.addEventListener("keydown", (e) => {
            if (!appState.isExamActive || appState.currentActiveView !== "view-simulator") {
                return;
            }

            const tag = (e.target?.tagName || "").toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") {
                return;
            }

            const keyUpper = e.key.toUpperCase();
            const numberMap = { "1": "A", "2": "B", "3": "C", "4": "D" };

            if (["A", "B", "C", "D"].includes(keyUpper)) {
                e.preventDefault();
                handleAnswer(keyUpper);
            } else if (numberMap[e.key]) {
                e.preventDefault();
                handleAnswer(numberMap[e.key]);
            }
        });
    }

    // Si ya hay preguntas cargadas en memoria, pintar el reactivo actual
    if (getActiveQuestions().length > 0) {
        renderExamQuestion(appState.currentQuestionIndex);
    }

    // Exponer utilidades en `window` para interoperabilidad inmediata con otros módulos
    window.MakaiExamRenderer = {
        initExamRenderer,
        renderExamQuestion,
        handleAnswer,
        clearCurrentAnswer,
        goToNextQuestion,
        goToPrevQuestion,
        setExamReviewMode,
        openClinicalImageZoom,
        registerSubmitExamCallback
    };
    window.renderExamQuestion = renderExamQuestion;
    window.handleAnswer = handleAnswer;
}

export default {
    initExamRenderer,
    renderExamQuestion,
    handleAnswer,
    clearCurrentAnswer,
    goToNextQuestion,
    goToPrevQuestion,
    setExamReviewMode,
    openClinicalImageZoom,
    registerSubmitExamCallback
};
