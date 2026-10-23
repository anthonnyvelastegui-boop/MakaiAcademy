// ============================================================================
// ARCHIVO: js/5-engine-1d/sinaptico.algorithm.js
// DESCRIPCIÓN: Subcomponente Matemático de Repetición Espaciada • Sináptico v4.4.
//              Calcula la curva de olvido exponencial, factor de facilidad,
//              intervalos (<10m, 1d, 4d+) y priorización inteligente de mazos.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { auth } from "../2-core/firebase.service.js";
import { appState } from "../2-core/state.store.js";

// ============================================================================
// 1. CONSTANTES MATEMÁTICAS DEL MOTOR SINÁPTICO V4.4
// ============================================================================

export const SINAPTICO_CONFIG = Object.freeze({
    VERSION: "4.4",
    STORAGE_PREFIX: "makai_sinaptico",
    // Intervalos base oficiales mostrados en los botones de dashboard.html
    INTERVALS_MS: {
        HARD: 10 * 60 * 1000,            // < 10 minutos (Refuerzo intrasesión)
        GOOD_INITIAL: 24 * 60 * 60 * 1000, // 1 día (24 horas)
        EASY_INITIAL: 4 * 24 * 60 * 60 * 1000 // 4 días (96 horas)
    },
    EASE_FACTOR: {
        DEFAULT: 2.50,
        MIN: 1.30,
        MAX: 3.00,
        DELTA_HARD: -0.20,
        DELTA_GOOD: 0.00,
        DELTA_EASY: 0.15
    },
    // Modificadores según complejidad clínica del reactivo CACES / Carrera
    DIFFICULTY_WEIGHTS: {
        básico: 1.08,
        basico: 1.08,
        baja: 1.08,
        intermedio: 1.00,
        media: 1.00,
        avanzado: 0.90,
        alta: 0.90,
        élite: 0.82,
        elite: 0.82
    }
});

// Referencia interna opcional al estado de engine1d.controller.js
let controllerStateRef = null;

// ============================================================================
// 2. INICIALIZACIÓN Y SINCRONIZACIÓN DE PROGRESO POR USUARIO
// ============================================================================

/**
 * Inicializa el motor algorítmico Sináptico v4.4 y vincula el estado de Engine 1D.
 * Es invocada automáticamente por `engine1d.controller.js`.
 * @param {Object} engine1DState
 */
export function initSinapticoAlgorithm(engine1DState = null) {
    if (engine1DState && typeof engine1DState === "object") {
        controllerStateRef = engine1DState;
        if (Array.isArray(controllerStateRef.fullDeck) && controllerStateRef.fullDeck.length > 0) {
            hydrateDeckWithSavedProgress(controllerStateRef.fullDeck);
        }
    }
    return {
        version: SINAPTICO_CONFIG.VERSION,
        status: "online"
    };
}

/**
 * Alias de compatibilidad arquitectónica por si algún módulo invoca initSpacedRepetition
 * directamente sobre el subcomponente matemático.
 */
export const initSpacedRepetition = initSinapticoAlgorithm;

/**
 * Obtiene el identificador único del estudiante autenticado para aislar su progreso.
 * @returns {string}
 */
function getActiveStudentUid() {
    return auth?.currentUser?.uid || appState?.currentUser?.uid || appState?.currentUserData?.uid || "guest";
}

/**
 * Construye la clave de almacenamiento local compatible con `engine1d.controller.js`.
 * @param {string} cardId
 * @returns {string}
 */
function buildCardStorageKey(cardId) {
    const uid = getActiveStudentUid();
    return `${SINAPTICO_CONFIG.STORAGE_PREFIX}_${uid}_${cardId}`;
}

/**
 * Lee el registro algorítmico guardado en `localStorage` para una tarjeta específica.
 * @param {string} cardId
 * @returns {Object|null}
 */
export function getSavedCardRecord(cardId) {
    if (!cardId) return null;
    try {
        const raw = localStorage.getItem(buildCardStorageKey(cardId));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (err) {
        return null;
    }
}

/**
 * Hidrata una tarjeta o un mazo completo combinando sus metadatos base con el
 * historial de curva de olvido almacenado para el estudiante actual.
 * @param {Array<Object>} deck
 * @returns {Array<Object>}
 */
export function hydrateDeckWithSavedProgress(deck = []) {
    if (!Array.isArray(deck)) return [];

    deck.forEach(card => {
        if (!card || !card.id) return;
        const saved = getSavedCardRecord(card.id);
        if (saved) {
            card.nextReviewAt = Number(saved.nextReviewAt ?? card.nextReviewAt ?? 0);
            card.intervalDays = Number(saved.intervalDays ?? card.intervalDays ?? 0);
            card.easeFactor = Number(saved.easeFactor ?? card.easeFactor ?? SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT);
            card.repetitions = Number(saved.repetitions ?? card.repetitions ?? 0);
            card.lapses = Number(saved.lapses ?? card.lapses ?? 0);
            card.lastQuality = saved.quality || card.lastQuality || null;
            card.lastReviewedAt = saved.updatedAt || card.lastReviewedAt || null;
        } else {
            card.nextReviewAt = Number(card.nextReviewAt || 0);
            card.intervalDays = Number(card.intervalDays || 0);
            card.easeFactor = Number(card.easeFactor || SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT);
            card.repetitions = Number(card.repetitions || 0);
            card.lapses = Number(card.lapses || 0);
        }
    });

    return deck;
}

// ============================================================================
// 3. NÚCLEO MATEMÁTICO DE LA CURVA DE OLVIDO (CÁLCULO DE INTERVALOS)
// ============================================================================

/**
 * Normaliza la etiqueta de calidad seleccionada por el estudiante a "hard" | "good" | "easy".
 * @param {string|number} rawQuality
 * @returns {"hard"|"good"|"easy"}
 */
export function normalizeRetentionQuality(rawQuality) {
    if (typeof rawQuality === "number") {
        if (rawQuality <= 1) return "hard";
        if (rawQuality === 2) return "good";
        return "easy";
    }

    const q = String(rawQuality || "good").toLowerCase().trim();
    if (q.includes("hard") || q.includes("difícil") || q.includes("dificil") || q.includes("10m")) {
        return "hard";
    }
    if (q.includes("easy") || q.includes("fácil") || q.includes("facil") || q.includes("4d")) {
        return "easy";
    }
    return "good";
}

/**
 * Obtiene el ponderador de dificultad clínica según el nivel del caso.
 * Casos de dificultad "Alta" o "Élite" acortan ligeramente el intervalo para
 * reforzar conceptos críticos del examen CACES.
 * @param {string} difficultyLabel
 * @returns {number}
 */
function getClinicalDifficultyModifier(difficultyLabel = "Media") {
    const key = String(difficultyLabel || "media").toLowerCase().trim();
    return SINAPTICO_CONFIG.DIFFICULTY_WEIGHTS[key] || 1.00;
}

/**
 * Calcula el próximo intervalo de repaso aplicando el algoritmo Sináptico v4.4:
 * - "hard" (<10m): Reinicia la racha de repeticiones, reduce el Ease Factor en 0.20
 *                  y programa la tarjeta a 10 minutos (0.0069 días) para repaso en la misma sesión.
 * - "good" (1d+):  Si es la 1ª repetición asigna 1 día; en la 2ª asigna 3 días;
 *                  a partir de la 3ª multiplica el intervalo previo por el Ease Factor y el peso clínico.
 * - "easy" (4d+):  Si es la 1ª repetición asigna 4 días directos; en repeticiones posteriores
 *                  incrementa el Ease Factor (+0.15) y aplica bonificación de consolidación (x1.30).
 *
 * @param {Object} card - Objeto de la tarjeta actual
 * @param {"hard"|"good"|"easy"} quality - Calificación elegida por el estudiante
 * @returns {Object} Resultado completo del cálculo algorítmico
 */
export function calculateNextReview(card = {}, quality = "good") {
    const now = Date.now();
    const normalizedQuality = normalizeRetentionQuality(quality);

    let easeFactor = Number(card.easeFactor || SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT);
    let repetitions = Number(card.repetitions || 0);
    let lapses = Number(card.lapses || 0);
    let prevIntervalDays = Number(card.intervalDays || 0);

    const clinicalMod = getClinicalDifficultyModifier(card.dificultad);
    let nextIntervalDays = 1;
    let nextReviewAt = now + SINAPTICO_CONFIG.INTERVALS_MS.GOOD_INITIAL;
    let memoryState = "learning"; // "relearning" | "learning" | "review" | "mastered"

    if (normalizedQuality === "hard") {
        // Botón: Difícil (<10m) -> Penalización de facilidad y retorno inmediato en sesión
        repetitions = 0;
        lapses += 1;
        easeFactor = Math.max(
            SINAPTICO_CONFIG.EASE_FACTOR.MIN,
            Number((easeFactor + SINAPTICO_CONFIG.EASE_FACTOR.DELTA_HARD).toFixed(2))
        );
        nextIntervalDays = 0.0069; // ~10 minutos expresados en fracción de día
        nextReviewAt = now + SINAPTICO_CONFIG.INTERVALS_MS.HARD;
        memoryState = "relearning";

    } else if (normalizedQuality === "good") {
        // Botón: Bueno (1d en primer repaso, escalado exponencial en siguientes)
        repetitions += 1;
        easeFactor = Math.min(
            SINAPTICO_CONFIG.EASE_FACTOR.MAX,
            Math.max(SINAPTICO_CONFIG.EASE_FACTOR.MIN, Number((easeFactor + SINAPTICO_CONFIG.EASE_FACTOR.DELTA_GOOD).toFixed(2)))
        );

        if (repetitions === 1 || prevIntervalDays < 1) {
            nextIntervalDays = 1;
        } else if (repetitions === 2) {
            nextIntervalDays = Math.max(2, Math.round(3 * clinicalMod));
        } else {
            nextIntervalDays = Math.max(
                prevIntervalDays + 1,
                Math.round(prevIntervalDays * easeFactor * clinicalMod)
            );
        }

        nextReviewAt = now + Math.round(nextIntervalDays * 24 * 60 * 60 * 1000);
        memoryState = nextIntervalDays >= 14 ? "mastered" : "review";

    } else {
        // Botón: Fácil (4d en primer repaso, aceleración sináptica en siguientes)
        repetitions += 1;
        easeFactor = Math.min(
            SINAPTICO_CONFIG.EASE_FACTOR.MAX,
            Number((easeFactor + SINAPTICO_CONFIG.EASE_FACTOR.DELTA_EASY).toFixed(2))
        );

        if (repetitions === 1 || prevIntervalDays < 1) {
            nextIntervalDays = 4;
        } else if (repetitions === 2) {
            nextIntervalDays = Math.max(5, Math.round(7 * clinicalMod));
        } else {
            nextIntervalDays = Math.max(
                prevIntervalDays + 2,
                Math.round(prevIntervalDays * easeFactor * 1.30 * clinicalMod)
            );
        }

        nextReviewAt = now + Math.round(nextIntervalDays * 24 * 60 * 60 * 1000);
        memoryState = nextIntervalDays >= 14 ? "mastered" : "review";
    }

    const retentionScore = estimateCardRetentionProbability({
        ...card,
        nextReviewAt,
        intervalDays: nextIntervalDays,
        easeFactor,
        repetitions,
        lapses
    });

    const scheduleResult = {
        cardId: card.id || null,
        quality: normalizedQuality,
        nextReviewAt,
        intervalDays: nextIntervalDays,
        humanInterval: formatIntervalBadge(nextIntervalDays, normalizedQuality),
        easeFactor,
        repetitions,
        lapses,
        memoryState,
        retentionScore,
        updatedAt: new Date(now).toISOString()
    };

    // Mutar la tarjeta en memoria y persistir su estado enriquecido en localStorage
    card.nextReviewAt = scheduleResult.nextReviewAt;
    card.intervalDays = scheduleResult.intervalDays;
    card.easeFactor = scheduleResult.easeFactor;
    card.repetitions = scheduleResult.repetitions;
    card.lapses = scheduleResult.lapses;
    card.lastQuality = scheduleResult.quality;
    card.memoryState = scheduleResult.memoryState;

    if (card.id) {
        try {
            localStorage.setItem(buildCardStorageKey(card.id), JSON.stringify(scheduleResult));
        } catch (err) {
            // Ignorar si el almacenamiento del navegador está restringido
        }
    }

    return scheduleResult;
}

// ============================================================================
// 4. ORDENAMIENTO PRIORITARIO Y ENCOLADO INTELIGENTE DE MAZOS
// ============================================================================

/**
 * Ordena un mazo de tarjetas aplicando la jerarquía de urgencia Sináptico v4.4:
 * 1. Tarjetas en re-aprendizaje o vencidas (`nextReviewAt > 0 && nextReviewAt <= now`),
 *    ordenadas desde la más atrasada y con menor Ease Factor.
 * 2. Tarjetas nuevas nunca vistas (`nextReviewAt === 0`), priorizando las de mayor
 *    complejidad clínica (Élite / Alta / Avanzado -> Media -> Básica).
 * 3. Tarjetas ya repasadas cuya fecha futura aún no vence (`nextReviewAt > now`),
 *    ordenadas de la más próxima a vencer a la más lejana.
 *
 * @param {Array<Object>} deck
 * @returns {Array<Object>} Mazo ordenado por prioridad sináptica
 */
export function sortDeckBySpacedRepetition(deck = []) {
    if (!Array.isArray(deck) || deck.length === 0) return [];

    // Asegurar que todas las tarjetas tengan su progreso del alumno hidratado
    hydrateDeckWithSavedProgress(deck);

    const now = Date.now();

    const getPriorityBucket = (card) => {
        const due = Number(card.nextReviewAt || 0);
        if (due > 0 && due <= now) return 1; // Urgente / Vencida hoy
        if (due === 0) return 2;             // Nueva por aprender
        return 3;                            // Programada a futuro
    };

    const getDifficultyRank = (card) => {
        const diff = String(card.dificultad || "media").toLowerCase();
        if (diff.includes("élite") || diff.includes("elite") || diff.includes("alta") || diff.includes("avanzad")) return 1;
        if (diff.includes("media") || diff.includes("intermedi")) return 2;
        return 3;
    };

    return [...deck].sort((a, b) => {
        const bucketA = getPriorityBucket(a);
        const bucketB = getPriorityBucket(b);

        if (bucketA !== bucketB) {
            return bucketA - bucketB;
        }

        // Si ambas están vencidas (Bucket 1): primero las de menor intervalo (<10m) y más atrasadas
        if (bucketA === 1) {
            const dueDiff = (a.nextReviewAt || 0) - (b.nextReviewAt || 0);
            if (dueDiff !== 0) return dueDiff;
            return (a.easeFactor || 2.5) - (b.easeFactor || 2.5);
        }

        // Si ambas son nuevas (Bucket 2): priorizar primero las de mayor dificultad CACES
        if (bucketA === 2) {
            return getDifficultyRank(a) - getDifficultyRank(b);
        }

        // Si ambas son futuras (Bucket 3): mostrar primero la que vence más pronto
        return (a.nextReviewAt || 0) - (b.nextReviewAt || 0);
    });
}

/**
 * Reubica una tarjeta recién calificada dentro de la cola de la sesión activa.
 * Si el alumno pulsó "Difícil (<10m)", se reinserta a 3 posiciones de distancia.
 * @param {Array<Object>} deck
 * @param {number} currentIndex
 * @param {"hard"|"good"|"easy"} quality
 * @returns {Array<Object>}
 */
export function requeueCardInSession(deck = [], currentIndex = 0, quality = "good") {
    if (!Array.isArray(deck) || deck.length <= 1) return deck;

    const normalized = normalizeRetentionQuality(quality);
    const safeIndex = Math.max(0, Math.min(currentIndex, deck.length - 1));
    const [reviewedCard] = deck.splice(safeIndex, 1);

    if (normalized === "hard") {
        const reinsertPos = Math.min(safeIndex + 3, deck.length);
        deck.splice(reinsertPos, 0, reviewedCard);
    } else if (normalized === "good") {
        deck.push(reviewedCard);
    } else {
        deck.push(reviewedCard);
    }

    return deck;
}

// ============================================================================
// 5. PROBABILIDAD DE RETENCIÓN (EBBINGHAUS) Y ANALÍTICAS DEL MAZO
// ============================================================================

/**
 * Estima la probabilidad de recuerdo actual $R = e^{-t / S}$ basada en la
 * curva de olvido exponencial de Ebbinghaus y la estabilidad sináptica $S$.
 * @param {Object} card
 * @returns {number} Porcentaje estimado de retención entre 0 y 100
 */
export function estimateCardRetentionProbability(card = {}) {
    const repetitions = Number(card.repetitions || 0);
    const intervalDays = Number(card.intervalDays || 0);
    const nextReviewAt = Number(card.nextReviewAt || 0);

    if (nextReviewAt === 0 && repetitions === 0) {
        return 0; // Tarjeta nueva aún no estudiada
    }

    const now = Date.now();
    const stabilityDays = Math.max(0.25, intervalDays * (Number(card.easeFactor || 2.5) / 2.5));
    const durationMs = Math.max(1, stabilityDays * 24 * 60 * 60 * 1000);

    // Tiempo transcurrido desde la última revisión estimada
    const reviewStartMs = nextReviewAt - (intervalDays * 24 * 60 * 60 * 1000);
    const elapsedMs = Math.max(0, now - reviewStartMs);

    const rawRetention = Math.exp(-elapsedMs / durationMs) * 100;
    return Math.max(5, Math.min(100, Math.round(rawRetention)));
}

/**
 * Genera el resumen estadístico de un mazo para mostrar indicadores de dominio
 * en el panel de Repetición Espaciada • Sináptico v4.4.
 * @param {Array<Object>} deck
 * @returns {Object}
 */
export function getDeckRetentionAnalytics(deck = []) {
    if (!Array.isArray(deck) || deck.length === 0) {
        return {
            totalCards: 0,
            dueNowCount: 0,
            newCount: 0,
            learningCount: 0,
            masteredCount: 0,
            averageEaseFactor: SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT,
            globalRetentionPercent: 0
        };
    }

    hydrateDeckWithSavedProgress(deck);

    const now = Date.now();
    let dueNowCount = 0;
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;
    let easeSum = 0;
    let retentionSum = 0;

    deck.forEach(card => {
        const due = Number(card.nextReviewAt || 0);
        const interval = Number(card.intervalDays || 0);
        const ease = Number(card.easeFactor || SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT);

        easeSum += ease;
        retentionSum += estimateCardRetentionProbability(card);

        if (due === 0) {
            newCount += 1;
        } else if (due <= now) {
            dueNowCount += 1;
        } else if (interval >= 14) {
            masteredCount += 1;
        } else {
            learningCount += 1;
        }
    });

    return {
        totalCards: deck.length,
        dueNowCount,
        newCount,
        learningCount,
        masteredCount,
        averageEaseFactor: Number((easeSum / deck.length).toFixed(2)),
        globalRetentionPercent: Math.round(retentionSum / deck.length)
    };
}

/**
 * Devuelve las etiquetas dinámicas que verán los 3 botones de retención ("Difícil", "Bueno", "Fácil")
 * en `sinaptico.cardUI.js` antes de que el estudiante presione uno.
 * @param {Object} card
 * @returns {{hardLabel: string, goodLabel: string, easyLabel: string}}
 */
export function getPreviewIntervalsForCard(card = {}) {
    if (!card) {
        return {
            hardLabel: "<10m",
            goodLabel: "1d",
            easyLabel: "4d"
        };
    }

    const reps = Number(card.repetitions || 0);
    const prevDays = Number(card.intervalDays || 0);
    const ease = Number(card.easeFactor || SINAPTICO_CONFIG.EASE_FACTOR.DEFAULT);
    const mod = getClinicalDifficultyModifier(card.dificultad);

    let goodDays = 1;
    let easyDays = 4;

    if (reps === 1 && prevDays >= 1) {
        goodDays = Math.max(2, Math.round(3 * mod));
        easyDays = Math.max(5, Math.round(7 * mod));
    } else if (reps >= 2 && prevDays >= 1) {
        goodDays = Math.max(prevDays + 1, Math.round(prevDays * ease * mod));
        easyDays = Math.max(prevDays + 2, Math.round(prevDays * ease * 1.30 * mod));
    }

    return {
        hardLabel: "<10m",
        goodLabel: `${goodDays}d`,
        easyLabel: `${easyDays}d`
    };
}

/**
 * Formatea un intervalo numérico en días a una insignia compacta ("<10m", "1d", "4d", "21d").
 * @param {number} intervalDays
 * @param {"hard"|"good"|"easy"} quality
 * @returns {string}
 */
export function formatIntervalBadge(intervalDays, quality = "good") {
    if (quality === "hard" || intervalDays < 0.5) {
        return "<10m";
    }
    return `${Math.max(1, Math.round(intervalDays))}d`;
}
