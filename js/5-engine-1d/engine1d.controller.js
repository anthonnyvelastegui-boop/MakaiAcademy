// ============================================================================
// ARCHIVO: js/5-engine-1d/engine1d.controller.js
// DESCRIPCIÓN: Controlador General del Motor 1D (Estudio Secuencial,
//              Repetición Espaciada • Sináptico v4.4 y Lectura Lineal/PDFs).
//              Coordina sinaptico.algorithm.js, sinaptico.cardUI.js y study.reader.js.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    doc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    canAccessBySubscription,
    setCurriculumSelection
} from "../2-core/state.store.js";

// Importación por espacio de nombres (Namespace Imports) para tolerar archivos
// semilla vacíos mientras se completan los subcomponentes hermanos de js/5-engine-1d/.
import * as SinapticoAlgorithm from "./sinaptico.algorithm.js";
import * as SinapticoCardUI from "./sinaptico.cardUI.js";
import * as StudyReader from "./study.reader.js";

// ============================================================================
// 1. ESTADO INTERNO DEL MOTOR 1D
// ============================================================================

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    QUESTIONS: COLLECTIONS?.QUESTIONS || "preguntas_caces",
    SINAPTICO: COLLECTIONS?.SINAPTICO || "tarjetas_sinaptico",
    MATERIALS: COLLECTIONS?.MATERIALS || "materiales_estudio"
};

export const engine1DState = {
    initialized: false,
    activeSubMode: "sinaptico", // "sinaptico" | "reader"
    track: "caces",             // "caces" | "carrera"
    career: "medicina",
    stage: "general",
    subject: "todas",
    fullDeck: [],
    filteredDeck: [],
    currentCardIndex: 0,
    isAnswerVisible: false,
    sessionStats: {
        reviewedToday: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0
    },
    materialsCatalog: [],
    filteredMaterials: [],
    activeMaterial: null
};

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL CONTROLADOR 1D
// ============================================================================

/**
 * Inicializa el Motor 1D completo dentro de #view-spaced en dashboard.html:
 * inyecta la barra táctica de filtros (Carrera/Materia y conmutador Sináptico/Lector),
 * carga los mazos y materiales desde Firestore y activa los 3 subcomponentes.
 */
export async function initEngine1DController() {
    const spacedView = document.getElementById("view-spaced");
    if (!spacedView) return;

    // Sincronizar filtros iniciales con state.store.js
    engine1DState.track = appState.currentAcademicTrack || "caces";
    engine1DState.career = appState.currentCareer || appState.currentUserData?.carrera || "medicina";
    engine1DState.stage = appState.currentStage || "general";
    engine1DState.subject = appState.currentSubject || "todas";

    // 1. Construir la barra superior de control 1D (Mazos, Materias y Visor de Guías PDF)
    renderEngine1DCommandBar(spacedView);

    // 2. Inicializar de forma segura los 3 subcomponentes de js/5-engine-1d/
    initEngine1DSubmodules();

    // 3. Enlazar controles nativos de la tarjeta en dashboard.html y atajos de teclado
    bindNativeFlashcardControls();

    // 4. Escuchar cambios curriculares globales desde router.spa.js / state.store.js
    bindGlobalCurriculumEvents();

    // 5. Cargar banco de tarjetas Sináptico v4.4 y biblioteca de materiales 1D
    await Promise.all([
        loadEngine1DDeck({
            track: engine1DState.track,
            career: engine1DState.career,
            stage: engine1DState.stage,
            subject: engine1DState.subject
        }),
        loadEngine1DMaterials({
            career: engine1DState.career,
            subject: engine1DState.subject
        })
    ]);

    engine1DState.initialized = true;
}

// Alias exportados para compatibilidad total con app.orchestrator.js y código previo
export const initSpacedRepetition = initEngine1DController;
export const initEngine1D = initEngine1DController;

/**
 * Despierta los 3 subcomponentes de la carpeta js/5-engine-1d/ si ya están codificados.
 */
function initEngine1DSubmodules() {
    if (typeof SinapticoAlgorithm.initSinapticoAlgorithm === "function") {
        SinapticoAlgorithm.initSinapticoAlgorithm(engine1DState);
    }

    if (typeof SinapticoCardUI.initSinapticoCardUI === "function") {
        SinapticoCardUI.initSinapticoCardUI({
            onShowAnswer: revealCurrentCardAnswer,
            onRateCard: handleCardRetention
        });
    }

    if (typeof StudyReader.initStudyReader === "function") {
        StudyReader.initStudyReader(engine1DState);
    }
}

// ============================================================================
// 3. INTERFAZ DE COMANDO 1D (SELECTORES DE MAZO, CONTADORES Y VISOR PDF)
// ============================================================================

/**
 * Inyecta la cabecera interactiva en #view-spaced para filtrar por Carrera,
 * Materia, Modo (Sináptico v4.4 vs Lectura Lineal / PDFs) y ver contadores de retención.
 * @param {HTMLElement} spacedView
 */
function renderEngine1DCommandBar(spacedView) {
    if (document.getElementById("engine1d-command-bar")) {
        populateCareerAndSubjectSelectors();
        return;
    }

    const commandBar = document.createElement("div");
    commandBar.id = "engine1d-command-bar";
    commandBar.className = "mb-6 bg-surface-container border border-primary/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,229,255,0.06)] space-y-4";

    commandBar.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
            <div>
                <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold">
                        Motor 1D • Aprendizaje Secuencial & Algorítmico
                    </span>
                </div>
                <h2 class="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">psychology</span>
                    <span>Repetición Espaciada • Sináptico v4.4 & Lectura Clínica</span>
                </h2>
            </div>

            <!-- CONMUTADOR DE SUB-MODO 1D: TARJETAS SINÁPTICO VS BIBLIOTECA PDF -->
            <div class="flex items-center gap-2 bg-surface p-1.5 rounded-xl border border-surface-high">
                <button type="button" id="btn-mode-sinaptico" class="px-3.5 py-2 rounded-lg text-xs font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">style</span>
                    <span>Mazos Sináptico v4.4</span>
                </button>
                <button type="button" id="btn-mode-reader" class="px-3.5 py-2 rounded-lg text-xs font-extrabold text-gray-400 hover:text-white transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">menu_book</span>
                    <span>Guías & PDFs (<span id="engine1d-materials-count">0</span>)</span>
                </button>
            </div>
        </div>

        <!-- SELECTORES DE CARRERA, MATERIA Y MÉTRICAS DE SESIÓN EN VIVO -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div class="md:col-span-4">
                <label for="engine1d-career-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                    Carrera / Dominio Clínico
                </label>
                <select id="engine1d-career-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                </select>
            </div>

            <div class="md:col-span-4">
                <label for="engine1d-subject-select" class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                    Materia / Módulo Específico
                </label>
                <select id="engine1d-subject-select" class="w-full bg-surface border border-surface-high focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors">
                    <option value="todas">Todas las materias del dominio</option>
                </select>
            </div>

            <div class="md:col-span-4 flex items-center justify-between bg-surface border border-surface-high rounded-xl px-4 py-2">
                <div class="text-center">
                    <span class="block text-[10px] font-mono text-gray-400 uppercase">En Mazo</span>
                    <span id="engine1d-stat-total" class="text-sm font-extrabold font-mono text-primary">0</span>
                </div>
                <div class="h-6 w-px bg-surface-high"></div>
                <div class="text-center">
                    <span class="block text-[10px] font-mono text-gray-400 uppercase">Repasadas Hoy</span>
                    <span id="engine1d-stat-reviewed" class="text-sm font-extrabold font-mono text-secondary">0</span>
                </div>
                <div class="h-6 w-px bg-surface-high"></div>
                <button type="button" id="btn-engine1d-shuffle" title="Barajar mazo actual" class="px-2.5 py-1.5 rounded-lg bg-surface-high hover:bg-primary hover:text-surface text-gray-300 text-xs font-bold transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">shuffle</span>
                    <span>Barajar</span>
                </button>
            </div>
        </div>
    `;

    spacedView.insertBefore(commandBar, spacedView.firstChild);

    // Crear contenedor para el Lector Lineal / PDFs (oculto por defecto hasta pulsar "Guías & PDFs")
    if (!document.getElementById("engine1d-reader-container")) {
        const readerContainer = document.createElement("div");
        readerContainer.id = "engine1d-reader-container";
        readerContainer.className = "hidden space-y-4 mt-4";
        spacedView.appendChild(readerContainer);
    }

    populateCareerAndSubjectSelectors();

    // Eventos de cambio de modo 1D
    document.getElementById("btn-mode-sinaptico")?.addEventListener("click", () => switchEngine1DMode("sinaptico"));
    document.getElementById("btn-mode-reader")?.addEventListener("click", () => switchEngine1DMode("reader"));

    // Eventos de filtrado por Carrera y Materia
    const careerSelect = document.getElementById("engine1d-career-select");
    const subjectSelect = document.getElementById("engine1d-subject-select");

    careerSelect?.addEventListener("change", async () => {
        engine1DState.career = careerSelect.value;
        engine1DState.subject = "todas";
        updateSubjectOptionsForCareer(engine1DState.career);

        setCurriculumSelection({
            career: engine1DState.career,
            subject: "todas"
        });

        await Promise.all([
            loadEngine1DDeck({ career: engine1DState.career, subject: "todas" }),
            loadEngine1DMaterials({ career: engine1DState.career, subject: "todas" })
        ]);
    });

    subjectSelect?.addEventListener("change", async () => {
        engine1DState.subject = subjectSelect.value;
        filterActiveDeckAndMaterials();
    });

    document.getElementById("btn-engine1d-shuffle")?.addEventListener("click", () => {
        shuffleActiveDeck();
    });
}

/**
 * Rellena los selectores de Carrera y Materia leyendo window.makaiData.
 */
function populateCareerAndSubjectSelectors() {
    const careerSelect = document.getElementById("engine1d-career-select");
    if (!careerSelect) return;

    const data = window.makaiData || {};
    const careersList = Array.isArray(data.carreras) && data.carreras.length > 0
        ? data.carreras
        : [
            { id: "medicina", nombre: "Medicina Humana (FCS-EC)", activa: true, materias: [] },
            { id: "enfermeria", nombre: "Enfermería & Cuidados Críticos", activa: true, materias: [] },
            { id: "odontologia", nombre: "Odontología Clínica", activa: false, materias: [] },
            { id: "obstetricia", nombre: "Obstetricia & Salud Materna", activa: false, materias: [] }
        ];

    const userEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    const isAdmin = isMasterAdmin(userEmail);

    careerSelect.innerHTML = "";
    careersList.forEach(c => {
        const isLocked = c.activa === false && !isAdmin;
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.disabled = isLocked;
        opt.textContent = isLocked ? `${c.nombre} (Próximamente)` : c.nombre;
        if (c.id === engine1DState.career) opt.selected = true;
        careerSelect.appendChild(opt);
    });

    updateSubjectOptionsForCareer(engine1DState.career);
}

/**
 * Actualiza el selector de materias según la carrera activa.
 * @param {string} careerId
 */
function updateSubjectOptionsForCareer(careerId) {
    const subjectSelect = document.getElementById("engine1d-subject-select");
    if (!subjectSelect) return;

    const data = window.makaiData || {};
    const foundCareer = (data.carreras || []).find(c => c.id === careerId);
    const subjects = foundCareer?.materias || [];

    subjectSelect.innerHTML = `<option value="todas">Todas las materias (${subjects.length || "General"})</option>`;
    subjects.forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        if (mat === engine1DState.subject) opt.selected = true;
        subjectSelect.appendChild(opt);
    });
}

// ============================================================================
// 4. CARGA Y FILTRADO DE MAZOS SINÁPTICO V4.4 (FIRESTORE + SEMILLA LOCAL)
// ============================================================================

/**
 * Carga las tarjetas de estudio combinando el banco semilla local (window.makaiData.semillaCasos),
 * la colección `tarjetas_sinaptico` y los reactivos de `preguntas_caces` en Firestore.
 * @param {Object} filters
 */
export async function loadEngine1DDeck(filters = {}) {
    if (filters.career) engine1DState.career = filters.career;
    if (filters.subject) engine1DState.subject = filters.subject;

    const combinedCards = [];
    const seenKeys = new Set();

    const addUniqueCard = (rawCard, origin) => {
        const frontText = (rawCard.frente || rawCard.enunciado || rawCard.pregunta || "").trim();
        if (!frontText) return;

        const key = `${rawCard.carrera || "medicina"}::${frontText.slice(0, 80).toLowerCase()}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        let backAnswer = rawCard.reverso || rawCard.respuesta || "";
        if (!backAnswer && rawCard.opciones && rawCard.respuestaCorrecta) {
            const correctOptionText = rawCard.opciones[rawCard.respuestaCorrecta] || rawCard.respuestaCorrecta;
            backAnswer = `${correctOptionText}${rawCard.racional ? ` — ${rawCard.racional}` : ""}`;
        }

        combinedCards.push({
            id: rawCard.id || `card_${combinedCards.length + 1}`,
            carrera: (rawCard.carrera || "medicina").toLowerCase(),
            etapa: rawCard.etapa || rawCard.semestre || "general",
            materia: rawCard.materia || "General",
            dificultad: rawCard.dificultad || "Media",
            frente: frontText,
            reverso: backAnswer || "Sin respuesta registrada.",
            racional: rawCard.racional || "",
            imagenUrl: rawCard.imagenUrl || "",
            origen: origin,
            nextReviewAt: rawCard.nextReviewAt || 0,
            intervalDays: rawCard.intervalDays || 0,
            easeFactor: rawCard.easeFactor || 2.5
        });
    };

    // 1. Cargar casos semilla locales para disponibilidad instantánea
    const localSeed = window.makaiData?.semillaCasos || [];
    localSeed.forEach(item => addUniqueCard(item, "semilla_local"));

    // 2. Consultar colección `tarjetas_sinaptico` y `preguntas_caces` en Firestore
    try {
        const [sinapticoSnap, questionsSnap] = await Promise.all([
            getDocs(collection(db, SAFE_COLLECTIONS.SINAPTICO)),
            getDocs(collection(db, SAFE_COLLECTIONS.QUESTIONS))
        ]);

        sinapticoSnap.forEach(docSnap => {
            addUniqueCard({ id: docSnap.id, ...docSnap.data() }, "tarjetas_sinaptico");
        });

        questionsSnap.forEach(docSnap => {
            addUniqueCard({ id: docSnap.id, ...docSnap.data() }, "preguntas_caces");
        });
    } catch (err) {
        console.warn("Motor 1D operando con banco semilla local:", err);
    }

    engine1DState.fullDeck = combinedCards;
    filterActiveDeckAndMaterials();
}

/**
 * Aplica los filtros de Carrera y Materia sobre el mazo cargado y ordena
 * las tarjetas según la prioridad de curva de olvido (sinaptico.algorithm.js).
 */
export function filterActiveDeckAndMaterials() {
    const targetCareer = (engine1DState.career || "medicina").toLowerCase();
    const targetSubject = (engine1DState.subject || "todas").toLowerCase();

    let filtered = engine1DState.fullDeck.filter(card => {
        const matchCareer = !targetCareer || card.carrera === targetCareer;
        const matchSubject =
            targetSubject === "todas" ||
            (card.materia || "").toLowerCase() === targetSubject;
        return matchCareer && matchSubject;
    });

    // Si el subcomponente matemático sinaptico.algorithm.js exporta sortDeckBySpacedRepetition, utilizarlo
    if (typeof SinapticoAlgorithm.sortDeckBySpacedRepetition === "function") {
        filtered = SinapticoAlgorithm.sortDeckBySpacedRepetition(filtered);
    } else {
        filtered.sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0));
    }

    engine1DState.filteredDeck = filtered;
    engine1DState.currentCardIndex = 0;
    engine1DState.isAnswerVisible = false;

    // Filtrar también los materiales PDF / Guías de esa carrera y materia
    engine1DState.filteredMaterials = engine1DState.materialsCatalog.filter(mat => {
        const matchCareer = !targetCareer || (mat.carrera || "medicina").toLowerCase() === targetCareer;
        const matchSubject =
            targetSubject === "todas" ||
            (mat.materia || "").toLowerCase() === targetSubject;
        return matchCareer && matchSubject;
    });

    updateEngine1DCountersUI();
    renderCurrentFlashcard();
    renderMaterialsCatalog1D();
}

/**
 * Baraja aleatoriamente el mazo activo cuando el estudiante pulsa "Barajar".
 */
export function shuffleActiveDeck() {
    if (engine1DState.filteredDeck.length <= 1) return;
    engine1DState.filteredDeck.sort(() => 0.5 - Math.random());
    engine1DState.currentCardIndex = 0;
    engine1DState.isAnswerVisible = false;
    renderCurrentFlashcard();
}

// ============================================================================
// 5. RENDERIZADO DE TARJETAS Y ALGORITMO DE RETENCIÓN SINÁPTICO V4.4
// ============================================================================

/**
 * Pinta la tarjeta actual en pantalla delegando a `sinaptico.cardUI.js` o
 * utilizando el renderizador nativo sobre `#fc-front`, `#fc-back`, `#fc-answer` y `#fc-category`.
 */
export function renderCurrentFlashcard() {
    const deck = engine1DState.filteredDeck;
    const currentCard = deck[engine1DState.currentCardIndex] || null;

    // Si sinaptico.cardUI.js tiene su función renderCard activa, delegar
    if (typeof SinapticoCardUI.renderCard === "function") {
        SinapticoCardUI.renderCard(currentCard, engine1DState);
        return;
    }

    // Renderizador nativo compatible con los IDs oficiales de dashboard.html
    const fcFront = document.getElementById("fc-front");
    const fcBack = document.getElementById("fc-back");
    const fcAnswer = document.getElementById("fc-answer");
    const fcCategory = document.getElementById("fc-category");
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    if (!fcFront || !fcBack || !btnShow || !controls) return;

    if (!currentCard) {
        fcCategory.textContent = `${engine1DState.career.toUpperCase()} • SIN TARJETAS EN ESTE FILTRO`;
        fcFront.textContent = "No hay tarjetas registradas para esta materia aún. Selecciona 'Todas las materias' o agrega nuevas desde el Panel Admin.";
        fcBack.classList.add("hidden");
        btnShow.classList.add("hidden");
        controls.classList.add("hidden");
        return;
    }

    const positionBadge = `(${engine1DState.currentCardIndex + 1}/${deck.length})`;
    fcCategory.textContent = `${currentCard.carrera.toUpperCase()} • ${currentCard.materia} ${positionBadge}`;
    fcFront.textContent = currentCard.frente;
    fcAnswer.textContent = currentCard.reverso;

    engine1DState.isAnswerVisible = false;
    fcBack.classList.add("hidden");
    btnShow.classList.remove("hidden");
    controls.classList.add("hidden");
}

/**
 * Muestra el reverso de la tarjeta actual y despliega los 3 botones algorítmicos:
 * "Difícil (<10m)", "Bueno (1d)" y "Fácil (4d)".
 */
export function revealCurrentCardAnswer() {
    if (engine1DState.filteredDeck.length === 0) return;
    engine1DState.isAnswerVisible = true;

    if (typeof SinapticoCardUI.revealCardAnswer === "function") {
        SinapticoCardUI.revealCardAnswer();
        return;
    }

    const fcBack = document.getElementById("fc-back");
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    fcBack?.classList.remove("hidden");
    btnShow?.classList.add("hidden");
    controls?.classList.remove("hidden");
}

/**
 * Procesa la calificación de retención elegida por el estudiante:
 * - "hard"  -> Difícil (<10 min): reaparece en la misma sesión
 * - "good"  -> Bueno (1 día)
 * - "easy"  -> Fácil (4 días)
 * @param {"hard"|"good"|"easy"} quality
 */
export async function handleCardRetention(quality = "good") {
    const deck = engine1DState.filteredDeck;
    if (deck.length === 0) return;

    const currentCard = deck[engine1DState.currentCardIndex];
    engine1DState.sessionStats.reviewedToday += 1;

    if (quality === "hard") engine1DState.sessionStats.hardCount += 1;
    else if (quality === "easy") engine1DState.sessionStats.easyCount += 1;
    else engine1DState.sessionStats.goodCount += 1;

    // 1. Calcular el próximo intervalo con sinaptico.algorithm.js o cálculo SM-2 integrado
    let scheduleResult = null;
    if (typeof SinapticoAlgorithm.calculateNextReview === "function") {
        scheduleResult = SinapticoAlgorithm.calculateNextReview(currentCard, quality);
    } else {
        const now = Date.now();
        const intervalsMs = {
            hard: 10 * 60 * 1000,            // 10 minutos
            good: 24 * 60 * 60 * 1000,       // 1 día
            easy: 4 * 24 * 60 * 60 * 1000    // 4 días
        };
        scheduleResult = {
            nextReviewAt: now + (intervalsMs[quality] || intervalsMs.good),
            intervalDays: quality === "hard" ? 0.01 : (quality === "easy" ? 4 : 1)
        };
    }

    currentCard.nextReviewAt = scheduleResult.nextReviewAt;
    currentCard.intervalDays = scheduleResult.intervalDays;

    // 2. Reordenar la tarjeta dentro de la cola de la sesión actual
    const reviewedCard = deck.splice(engine1DState.currentCardIndex, 1)[0];
    if (quality === "hard" && deck.length >= 2) {
        // Si fue difícil (<10m), reinsertar pocas posiciones más adelante para reforzar
        const reinsertIndex = Math.min(3, deck.length);
        deck.splice(reinsertIndex, 0, reviewedCard);
    } else {
        deck.push(reviewedCard);
    }

    if (engine1DState.currentCardIndex >= deck.length) {
        engine1DState.currentCardIndex = 0;
    }

    updateEngine1DCountersUI();
    renderCurrentFlashcard();

    // 3. Persistir progreso de repaso en Firestore (sin bloquear la interfaz)
    persistSpacedRepetitionProgress(currentCard, quality, scheduleResult);
}

/**
 * Guarda en segundo plano el contador de tarjetas repasadas del estudiante en Firestore.
 */
async function persistSpacedRepetitionProgress(card, quality, scheduleResult) {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid;
    if (!uid) return;

    try {
        const localKey = `makai_sinaptico_${uid}_${card.id}`;
        localStorage.setItem(localKey, JSON.stringify({
            cardId: card.id,
            quality,
            nextReviewAt: scheduleResult.nextReviewAt,
            updatedAt: new Date().toISOString()
        }));

        await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            lastSinapticoReviewAt: new Date().toISOString(),
            sinapticoReviewedSession: engine1DState.sessionStats.reviewedToday
        });
    } catch (err) {
        // Silencioso en caso de modo offline temporal
    }
}

/**
 * Enlaza el botón `#btn-show-answer`, los 3 botones de retención en `#fc-controls`
 * y la barra espaciadora (`Space`) para voltear la tarjeta rápidamente.
 */
function bindNativeFlashcardControls() {
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    if (btnShow && !btnShow.dataset.engine1dBound) {
        btnShow.dataset.engine1dBound = "1";
        btnShow.addEventListener("click", () => {
            revealCurrentCardAnswer();
        });
    }

    if (controls && !controls.dataset.engine1dBound) {
        controls.dataset.engine1dBound = "1";
        const qualityBtns = controls.querySelectorAll("button");
        qualityBtns.forEach((btn, idx) => {
            btn.addEventListener("click", () => {
                const label = (btn.dataset.quality || btn.textContent || "").toLowerCase();
                let quality = "good";
                if (label.includes("difícil") || label.includes("dificil") || label.includes("10m") || idx === 0) {
                    quality = "hard";
                } else if (label.includes("fácil") || label.includes("facil") || label.includes("4d") || idx === 2) {
                    quality = "easy";
                }
                handleCardRetention(quality);
            });
        });
    }

    if (!window.__makaiEngine1DKeybound) {
        window.__makaiEngine1DKeybound = true;
        document.addEventListener("keydown", (e) => {
            const spacedView = document.getElementById("view-spaced");
            const isSpacedVisible = spacedView && !spacedView.classList.contains("hidden");
            if (!isSpacedVisible || engine1DState.activeSubMode !== "sinaptico") return;

            const activeTag = document.activeElement?.tagName || "";
            if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

            if (e.code === "Space" && !engine1DState.isAnswerVisible) {
                e.preventDefault();
                revealCurrentCardAnswer();
            } else if (engine1DState.isAnswerVisible) {
                if (e.key === "1") handleCardRetention("hard");
                if (e.key === "2") handleCardRetention("good");
                if (e.key === "3") handleCardRetention("easy");
            }
        });
    }
}

// ============================================================================
// 6. BIBLIOTECA Y LECTOR LINEAL 1D (GUÍAS PDF, INFOGRAFÍAS Y RESÚMENES)
// ============================================================================

/**
 * Carga el catálogo de materiales clínicos desde la colección `materiales_estudio`
 * en Cloud Firestore y añade recursos semilla de `assets/5-multimedia-1d/`.
 * @param {Object} filters
 */
export async function loadEngine1DMaterials(filters = {}) {
    const seedMaterials = [
        {
            id: "gpc_clavero_obstetricia",
            titulo: "Protocolo Score MAMÁ y Claves Obstétricas (MSP Ecuador)",
            carrera: "medicina",
            materia: "Ginecología y Salud Materna",
            tipo: "pdf",
            planRequerido: "Básico",
            ruta: "assets/5-multimedia-1d/guias-pdf/guia-score-mama-msp.pdf",
            descripcion: "Algoritmo lineal 1D de activación de Clave Roja, Azul y Amarilla en emergencias obstétricas."
        },
        {
            id: "infografia_sepsis_uci",
            titulo: "Algoritmo Surviving Sepsis Campaign (Hora-1)",
            carrera: "enfermeria",
            materia: "Enfermería de Cuidados Críticos y Urgencias",
            tipo: "infografia",
            planRequerido: "Básico",
            ruta: "assets/5-multimedia-1d/infografias-y-algoritmos/algoritmo-sepsis-hora1.png",
            descripcion: "Secuencia clínica 1D de lactato, hemocultivos, cristaloides y vasopresores."
        }
    ];

    const loadedMaterials = [...seedMaterials];

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.MATERIALS));
        snap.forEach(docSnap => {
            loadedMaterials.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
    } catch (err) {
        console.warn("Catálogo de materiales 1D cargado en modo semilla:", err);
    }

    engine1DState.materialsCatalog = loadedMaterials;
    filterActiveDeckAndMaterials();
}

/**
 * Alterna entre la vista de Tarjetas Sináptico v4.4 y la Biblioteca de Lectura/PDFs.
 * @param {"sinaptico"|"reader"} mode
 */
export function switchEngine1DMode(mode = "sinaptico") {
    engine1DState.activeSubMode = mode;

    const btnSinaptico = document.getElementById("btn-mode-sinaptico");
    const btnReader = document.getElementById("btn-mode-reader");
    const readerContainer = document.getElementById("engine1d-reader-container");
    const fcFront = document.getElementById("fc-front");
    const flashcardWrapper = fcFront?.closest(".bg-surface-container") || fcFront?.parentElement;

    if (mode === "reader") {
        btnReader?.classList.add("bg-primary", "text-surface");
        btnReader?.classList.remove("text-gray-400");
        btnSinaptico?.classList.remove("bg-primary", "text-surface");
        btnSinaptico?.classList.add("text-gray-400");

        flashcardWrapper?.classList.add("hidden");
        readerContainer?.classList.remove("hidden");
        renderMaterialsCatalog1D();
    } else {
        btnSinaptico?.classList.add("bg-primary", "text-surface");
        btnSinaptico?.classList.remove("text-gray-400");
        btnReader?.classList.remove("bg-primary", "text-surface");
        btnReader?.classList.add("text-gray-400");

        readerContainer?.classList.add("hidden");
        flashcardWrapper?.classList.remove("hidden");
        renderCurrentFlashcard();
    }
}

/**
 * Renderiza las tarjetas de Guías Clínicas, PDFs e Infografías dentro de `#engine1d-reader-container`.
 */
function renderMaterialsCatalog1D() {
    const readerContainer = document.getElementById("engine1d-reader-container");
    if (!readerContainer) return;

    if (typeof StudyReader.renderStudyMaterialsList === "function") {
        StudyReader.renderStudyMaterialsList(engine1DState.filteredMaterials, readerContainer);
        return;
    }

    const materials = engine1DState.filteredMaterials;
    if (materials.length === 0) {
        readerContainer.innerHTML = `
            <div class="bg-surface-container border border-surface-high rounded-2xl p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-gray-500">folder_open</span>
                <p class="text-sm font-bold text-white mt-2">No hay guías PDF o esquemas 1D para este filtro aún</p>
                <p class="text-xs text-gray-400 mt-1">Puedes subir o enlazar nuevos PDFs desde el Panel Admin (Pestaña 5: Materiales y PDFs).</p>
            </div>
        `;
        return;
    }

    readerContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${materials.map(item => `
                <div class="bg-surface-container border border-surface-high hover:border-primary/60 rounded-2xl p-5 flex flex-col justify-between transition-all">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-primary/15 text-primary">
                                ${item.tipo || "PDF"} • ${item.materia || "General"}
                            </span>
                            <span class="text-[10px] font-mono font-bold ${item.planRequerido && item.planRequerido !== "Básico" ? "text-warning" : "text-secondary"}">
                                Plan ${item.planRequerido || "Básico"}
                            </span>
                        </div>
                        <h4 class="text-base font-extrabold text-white">${item.titulo || "Documento Clínico"}</h4>
                        <p class="text-xs text-gray-400 mt-1">${item.descripcion || "Recurso oficial de lectura secuencial 1D."}</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-surface-high flex items-center justify-end">
                        <button type="button" data-open-material="${item.id}" class="btn-open-material-1d px-4 py-2 rounded-xl bg-primary text-surface text-xs font-extrabold hover:bg-opacity-90 transition-all flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                            <span>Abrir en Visor 1D</span>
                        </button>
                    </div>
                </div>
            `).join("")}
        </div>
        <div id="engine1d-inline-viewer" class="hidden mt-4"></div>
    `;

    readerContainer.querySelectorAll(".btn-open-material-1d").forEach(btn => {
        btn.addEventListener("click", () => {
            const found = materials.find(m => m.id === btn.dataset.openMaterial);
            if (found) openStudyMaterial1D(found);
        });
    });
}

/**
 * Abre un material bibliográfico (PDF, infografía o micro-video 1D) verificando
 * primero el nivel de suscripción del estudiante.
 * @param {Object} materialItem
 */
export function openStudyMaterial1D(materialItem) {
    if (!materialItem) return;

    const requiredPlan = materialItem.planRequerido || "Básico";
    if (!canAccessBySubscription(requiredPlan)) {
        const freemiumModal = document.getElementById("freemium-modal");
        if (freemiumModal) {
            freemiumModal.classList.remove("hidden");
            freemiumModal.classList.add("flex");
        } else {
            alert(`Este recurso clínico requiere el Plan ${requiredPlan}. Actualiza tu cuenta para desbloquearlo.`);
        }
        return;
    }

    engine1DState.activeMaterial = materialItem;

    if (typeof StudyReader.openMaterialViewer === "function") {
        StudyReader.openMaterialViewer(materialItem);
        return;
    }

    const viewerBox = document.getElementById("engine1d-inline-viewer");
    if (!viewerBox) return;

    const url = materialItem.url || materialItem.ruta || materialItem.base64Data || "";
    viewerBox.classList.remove("hidden");
    viewerBox.innerHTML = `
        <div class="bg-surface-container border-2 border-primary/50 rounded-2xl p-4 space-y-3">
            <div class="flex items-center justify-between border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase font-bold">Visor Clínico 1D • Modo Oscuro</span>
                    <h4 class="text-sm font-extrabold text-white">${materialItem.titulo}</h4>
                </div>
                <button type="button" id="btn-close-inline-viewer" class="px-3 py-1 rounded-lg bg-surface-high text-gray-300 hover:text-white text-xs font-bold">
                    ✕ Cerrar Visor
                </button>
            </div>
            <div class="w-full h-[70vh] bg-surface rounded-xl overflow-hidden flex items-center justify-center">
                <iframe src="${url}" class="w-full h-full border-0" title="${materialItem.titulo}"></iframe>
            </div>
        </div>
    `;

    document.getElementById("btn-close-inline-viewer")?.addEventListener("click", () => {
        viewerBox.classList.add("hidden");
        viewerBox.innerHTML = "";
    });
}

// ============================================================================
// 7. SINCRONIZACIÓN DE CONTADORES Y EVENTOS GLOBALES
// ============================================================================

/**
 * Actualiza los indicadores numéricos de la barra de comando 1D.
 */
function updateEngine1DCountersUI() {
    const totalEl = document.getElementById("engine1d-stat-total");
    const reviewedEl = document.getElementById("engine1d-stat-reviewed");
    const materialsCountEl = document.getElementById("engine1d-materials-count");

    if (totalEl) totalEl.textContent = String(engine1DState.filteredDeck.length);
    if (reviewedEl) reviewedEl.textContent = String(engine1DState.sessionStats.reviewedToday);
    if (materialsCountEl) materialsCountEl.textContent = String(engine1DState.filteredMaterials.length);
}

/**
 * Escucha el evento global `makai:curriculumChanged` emitido por `router.spa.js`
 * o `state.store.js` para sincronizar automáticamente la carrera y materia activa.
 */
function bindGlobalCurriculumEvents() {
    if (window.__makaiEngine1DCurriculumBound) return;
    window.__makaiEngine1DCurriculumBound = true;

    window.addEventListener("makai:curriculumChanged", (e) => {
        const detail = e.detail || {};
        if (detail.career && detail.career !== engine1DState.career) {
            engine1DState.career = detail.career;
            const careerSelect = document.getElementById("engine1d-career-select");
            if (careerSelect) careerSelect.value = detail.career;
            updateSubjectOptionsForCareer(detail.career);
        }

        if (detail.subject) {
            engine1DState.subject = detail.subject;
            const subjectSelect = document.getElementById("engine1d-subject-select");
            if (subjectSelect) subjectSelect.value = detail.subject;
        }

        filterActiveDeckAndMaterials();
    });
}
