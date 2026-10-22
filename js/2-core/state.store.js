// ============================================================================
// ARCHIVO: js/2-core/state.store.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Subcomponente de Memoria Global Reactiva, Control de Sesión,
//                  Estado Curricular (CACES / 11 Carreras), Estado de Simulacros
//                  y Validación Oficial de Administradores Maestros.
// ============================================================================

/**
 * Lista inmutable de cuentas maestras de administración autorizadas.
 * Poseen acceso total a la Bóveda Admin (js/1-admin/), bypass de verificación
 * y nivel de suscripción PRO/VIP desbloqueado permanentemente.
 */
export const MASTER_ADMINS = Object.freeze([
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
]);

/**
 * Límite mensual de casos clínicos gratuitos para cuentas con Plan Básico ($0).
 */
export const FREEMIUM_MONTHLY_CASE_LIMIT = 15;

/**
 * Jerarquía numérica de planes de suscripción para validaciones de acceso
 * en materiales PDF, simuladores 1D/2D/3D, modos de examen y aulas virtuales.
 */
export const SUBSCRIPTION_TIERS = Object.freeze({
    "Básico": 1,
    "Basico": 1,
    "PRO": 2,
    "VIP": 3
});

/**
 * Claves de persistencia ligera en el navegador para conservar la selección
 * curricular del estudiante durante la navegación en dashboard.html.
 */
const STORAGE_KEYS = Object.freeze({
    TRACK: "makai_state_academic_track",
    CAREER: "makai_state_career",
    STAGE: "makai_state_stage",
    SUBJECT: "makai_state_subject",
    MODE: "makai_state_exam_mode",
    VIEW: "makai_state_active_view"
});

/**
 * Conjunto interno de suscriptores para notificar cambios de estado entre módulos.
 */
const stateListeners = new Set();

/**
 * Lee un valor guardado en sessionStorage de forma segura.
 * @param {string} key
 * @param {string} fallbackValue
 * @returns {string}
 */
function readPersistedValue(key, fallbackValue) {
    try {
        const val = sessionStorage.getItem(key);
        return val !== null && val !== "" ? val : fallbackValue;
    } catch (_) {
        return fallbackValue;
    }
}

/**
 * Guarda un valor en sessionStorage de forma segura.
 * @param {string} key
 * @param {string} value
 */
function writePersistedValue(key, value) {
    try {
        if (value === undefined || value === null) {
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, String(value));
        }
    } catch (_) {
        // Ignorar silenciosamente si el navegador restringe sessionStorage
    }
}

/**
 * Estado Global Maestro compartido por las 8 carpetas de controladores:
 * 1-admin, 2-core, 3-security, 4-exams, 5-engine-1d, 6-engine-2d, 7-engine-3d y 8-classrooms.
 */
export const appState = {
    // 1. Sesión y Perfil del Usuario (Firebase Auth + Firestore `usuarios`)
    currentUser: null,
    currentUserData: null,
    isAuthenticated: false,
    isAdmin: false,

    // 2. Navegación SPA en dashboard.html
    currentActiveView: readPersistedValue(STORAGE_KEYS.VIEW, "view-launcher"),

    // 3. Despliegue Curricular Encadenado Dual (CACES 4 carreras vs CARRERA 11 carreras)
    currentAcademicTrack: readPersistedValue(STORAGE_KEYS.TRACK, "caces"), // "caces" | "carrera"
    currentCareer: readPersistedValue(STORAGE_KEYS.CAREER, "medicina"),
    currentStage: readPersistedValue(STORAGE_KEYS.STAGE, "habilitacion_caces"), // Preuniversitario, Nivelación, 1° a 10° Semestre, Internado
    currentSubject: readPersistedValue(STORAGE_KEYS.SUBJECT, "Todas las materias"),
    currentMode: readPersistedValue(STORAGE_KEYS.MODE, "tutor"), // "tutor" | "standard" | "critical"

    // 4. Estado del Motor de Exámenes y Matriz CACES (js/4-exams/)
    isExamActive: false,
    examQuestions: [],
    currentQuestionIndex: 0,
    userAnswers: {}, // Formato: { [questionIndex]: { chosen: "A", isCorrect: true, timeSpent: 12 } }
    markedForReview: new Set(),
    examTimeRemaining: 0,
    examTimerInterval: null,
    examStartedAt: null,

    // 5. Estado de Motores 1D (Sináptico), 2D, 3D y Aulas Virtuales
    activeDeck1D: [],
    currentCardIndex1D: 0,
    activeCase2D: null,
    activeSession3D: null,
    activeClassroomStream: null,

    // 6. Caché Ligera para Panel de Administración (js/1-admin/)
    adminActiveSubTab: "pagos",
    adminStats: {
        totalUsers: 0,
        pendingPayments: 0,
        totalQuestions: 0,
        totalSinapticoCards: 0,
        totalStudyMaterials: 0
    },

    // 7. Marca de tiempo de la última sincronización
    lastUpdatedAt: new Date().toISOString()
};

/**
 * Verifica si un correo electrónico pertenece a una de las cuentas maestras
 * de administración autorizadas en MakaiAcademy.
 * @param {string} email
 * @returns {boolean}
 */
export function isMasterAdmin(email) {
    if (!email || typeof email !== "string") return false;
    return MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Comprueba si el usuario actualmente autenticado en `appState` es un
 * administrador maestro autorizado.
 * @returns {boolean}
 */
export function isCurrentUserAdmin() {
    const email = appState.currentUser?.email || appState.currentUserData?.email || "";
    return isMasterAdmin(email) || appState.currentUserData?.rol === "admin";
}

/**
 * Notifica a todos los módulos suscritos y emite un CustomEvent en `window`
 * cada vez que se produce una actualización relevante en `appState`.
 * @param {string} changeType - Identificador del tipo de cambio (ej: "session", "curriculum", "exam", "view")
 * @param {Object} payload - Datos adicionales del cambio
 */
export function notifyStateChange(changeType = "general", payload = {}) {
    appState.lastUpdatedAt = new Date().toISOString();

    stateListeners.forEach((listenerFn) => {
        try {
            listenerFn(appState, changeType, payload);
        } catch (err) {
            console.warn("[StateStore] Error en suscriptor de estado:", err);
        }
    });

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
            new CustomEvent("makai:stateChanged", {
                detail: {
                    changeType,
                    payload,
                    state: appState
                }
            })
        );
    }
}

/**
 * Permite que cualquier controlador de las 8 carpetas se suscriba a los
 * cambios del estado global. Devuelve una función para cancelar la suscripción.
 * @param {Function} listenerFn - Callback `(state, changeType, payload) => void`
 * @returns {Function} Función `unsubscribe()`
 */
export function subscribeToState(listenerFn) {
    if (typeof listenerFn !== "function") {
        return () => {};
    }
    stateListeners.add(listenerFn);
    return () => {
        stateListeners.delete(listenerFn);
    };
}

/**
 * Actualiza de forma segura la sesión del usuario autenticado (Firebase Auth)
 * y su expediente de Cloud Firestore (`usuarios`) dentro de `appState`.
 * Aplica blindaje automático a las cuentas maestras de administración.
 * @param {Object|null} user - Objeto User de Firebase Authentication
 * @param {Object|null} userData - Documento del usuario obtenido desde Firestore
 * @returns {Object} Estado actualizado
 */
export function setSessionState(user, userData) {
    if (!user && !userData) {
        appState.currentUser = null;
        appState.currentUserData = null;
        appState.isAuthenticated = false;
        appState.isAdmin = false;

        if (typeof window !== "undefined") {
            window.makaiCurrentUser = null;
            window.makaiCurrentUserData = null;
        }

        notifyStateChange("session", { user: null, userData: null });
        return appState;
    }

    const email = user?.email || userData?.email || "";
    const masterAdminFlag = isMasterAdmin(email);

    const normalizedUserData = userData
        ? {
              ...userData,
              uid: user?.uid || userData.uid || "",
              email: email,
              rol: masterAdminFlag ? "admin" : (userData.rol || "estudiante"),
              subscriptionLevel: masterAdminFlag ? "PRO" : (userData.subscriptionLevel || "Básico"),
              estadoPago: masterAdminFlag ? "activo_verificado" : (userData.estadoPago || "activo_gratis"),
              correoConfirmadoMakai: masterAdminFlag ? true : !!userData.correoConfirmadoMakai,
              casesUsedThisMonth: Number(userData.casesUsedThisMonth || 0),
              totalExamsCompleted: Number(userData.totalExamsCompleted || 0),
              globalAverage: Number(userData.globalAverage || 0)
          }
        : null;

    appState.currentUser = user || null;
    appState.currentUserData = normalizedUserData;
    appState.isAuthenticated = !!user;
    appState.isAdmin = masterAdminFlag || normalizedUserData?.rol === "admin";

    if (normalizedUserData?.carrera && !sessionStorage.getItem(STORAGE_KEYS.CAREER)) {
        appState.currentCareer = normalizedUserData.carrera;
        writePersistedValue(STORAGE_KEYS.CAREER, normalizedUserData.carrera);
    }

    if (typeof window !== "undefined") {
        window.makaiCurrentUser = appState.currentUser;
        window.makaiCurrentUserData = appState.currentUserData;
    }

    notifyStateChange("session", {
        user: appState.currentUser,
        userData: appState.currentUserData,
        isAdmin: appState.isAdmin
    });

    return appState;
}

/**
 * Actualiza únicamente métricas o propiedades puntuales del expediente del usuario
 * en memoria (ej: tras concluir un simulacro o aprobarse un plan de suscripción).
 * @param {Object} metricsPatch - Campos a actualizar en `currentUserData`
 * @returns {Object|null} Perfil actualizado en memoria
 */
export function updateUserMetricsInState(metricsPatch = {}) {
    if (!appState.currentUserData) return null;

    appState.currentUserData = {
        ...appState.currentUserData,
        ...metricsPatch
    };

    if (typeof window !== "undefined") {
        window.makaiCurrentUserData = appState.currentUserData;
    }

    notifyStateChange("userMetrics", metricsPatch);
    return appState.currentUserData;
}

/**
 * Registra la vista SPA activa dentro de `dashboard.html` (ej: "view-launcher",
 * "view-simulator", "view-spaced", "view-sim2d", "view-sim3d", "view-classrooms",
 * "view-metrics", "view-admin").
 * @param {string} viewId
 */
export function setActiveViewState(viewId) {
    if (!viewId || typeof viewId !== "string") return;
    appState.currentActiveView = viewId;
    writePersistedValue(STORAGE_KEYS.VIEW, viewId);
    notifyStateChange("view", { viewId });
}

/**
 * Actualiza la selección curricular encadenada del estudiante (Sección CACES de 4 carreras
 * o Sección CARRERA de 11 carreras de salud por niveles/semestres y materias) y dispara
 * el evento global `makai:curriculumChanged`.
 * @param {Object} selection
 * @param {string} [selection.track] - "caces" | "carrera"
 * @param {string} [selection.career] - ID de la carrera (ej: "medicina", "enfermeria")
 * @param {string} [selection.stage] - Etapa o semestre (ej: "preuniversitario", "semestre_5", "internado")
 * @param {string} [selection.subject] - Materia seleccionada
 * @param {string} [selection.mode] - Modo de simulacro ("tutor", "standard", "critical")
 * @returns {Object} Selección curricular consolidada
 */
export function setCurriculumSelection({ track, career, stage, subject, mode } = {}) {
    if (track) {
        appState.currentAcademicTrack = track;
        writePersistedValue(STORAGE_KEYS.TRACK, track);
    }
    if (career) {
        appState.currentCareer = career;
        writePersistedValue(STORAGE_KEYS.CAREER, career);
    }
    if (stage !== undefined) {
        appState.currentStage = stage;
        writePersistedValue(STORAGE_KEYS.STAGE, stage);
    }
    if (subject !== undefined) {
        appState.currentSubject = subject;
        writePersistedValue(STORAGE_KEYS.SUBJECT, subject);
    }
    if (mode) {
        appState.currentMode = mode;
        writePersistedValue(STORAGE_KEYS.MODE, mode);
    }

    const currentSelection = {
        track: appState.currentAcademicTrack,
        career: appState.currentCareer,
        stage: appState.currentStage,
        subject: appState.currentSubject,
        mode: appState.currentMode
    };

    notifyStateChange("curriculum", currentSelection);

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
            new CustomEvent("makai:curriculumChanged", {
                detail: currentSelection
            })
        );
    }

    return currentSelection;
}

/**
 * Inicializa o actualiza el estado en vivo de un simulacro CACES o evaluación por carrera.
 * @param {Object} examPatch
 */
export function setExamSessionState(examPatch = {}) {
    if (typeof examPatch.isExamActive === "boolean") {
        appState.isExamActive = examPatch.isExamActive;
    }
    if (Array.isArray(examPatch.examQuestions)) {
        appState.examQuestions = examPatch.examQuestions;
    }
    if (typeof examPatch.currentQuestionIndex === "number") {
        appState.currentQuestionIndex = examPatch.currentQuestionIndex;
    }
    if (examPatch.userAnswers && typeof examPatch.userAnswers === "object") {
        appState.userAnswers = examPatch.userAnswers;
    }
    if (examPatch.markedForReview instanceof Set) {
        appState.markedForReview = examPatch.markedForReview;
    }
    if (typeof examPatch.examTimeRemaining === "number") {
        appState.examTimeRemaining = examPatch.examTimeRemaining;
    }
    if (examPatch.examTimerInterval !== undefined) {
        appState.examTimerInterval = examPatch.examTimerInterval;
    }
    if (examPatch.examStartedAt !== undefined) {
        appState.examStartedAt = examPatch.examStartedAt;
    }

    notifyStateChange("exam", {
        isExamActive: appState.isExamActive,
        currentQuestionIndex: appState.currentQuestionIndex,
        totalQuestions: appState.examQuestions.length
    });
}

/**
 * Limpia de forma segura el cronómetro y reinicia todas las variables del
 * simulacro activo al concluir o abandonar un examen.
 */
export function resetExamSessionState() {
    if (appState.examTimerInterval) {
        clearInterval(appState.examTimerInterval);
    }

    appState.isExamActive = false;
    appState.examQuestions = [];
    appState.currentQuestionIndex = 0;
    appState.userAnswers = {};
    appState.markedForReview = new Set();
    appState.examTimeRemaining = 0;
    appState.examTimerInterval = null;
    appState.examStartedAt = null;

    notifyStateChange("examReset", { isExamActive: false });
}

/**
 * Verifica si el usuario actual cumple con el nivel de suscripción requerido
 * ("Básico", "PRO" o "VIP") para acceder a una función, guía PDF o simulador.
 * Los administradores maestros tienen acceso total garantizado.
 * @param {string} [requiredLevel="Básico"]
 * @returns {boolean}
 */
export function canAccessBySubscription(requiredLevel = "Básico") {
    if (isCurrentUserAdmin()) return true;

    const userLevel = appState.currentUserData?.subscriptionLevel || "Básico";
    const userRank = SUBSCRIPTION_TIERS[userLevel] || 1;
    const requiredRank = SUBSCRIPTION_TIERS[requiredLevel] || 1;

    return userRank >= requiredRank;
}

/**
 * Comprueba si el estudiante aún dispone de casos clínicos disponibles dentro
 * de la cuota Freemium mensual (15 casos para Plan Básico; ilimitados para PRO, VIP y Admin).
 * @returns {boolean}
 */
export function hasRemainingFreemiumCases() {
    if (isCurrentUserAdmin()) return true;

    const subLevel = appState.currentUserData?.subscriptionLevel || "Básico";
    if (subLevel === "PRO" || subLevel === "VIP") {
        return true;
    }

    const usedCases = Number(appState.currentUserData?.casesUsedThisMonth || 0);
    return usedCases < FREEMIUM_MONTHLY_CASE_LIMIT;
}

/**
 * Devuelve una copia de lectura del estado actual para auditoría o depuración.
 * @returns {Object}
 */
export function getStateSnapshot() {
    return {
        ...appState,
        markedForReview: Array.from(appState.markedForReview || [])
    };
}

// Exposición global en window para facilitar la interoperabilidad entre los 38 módulos
if (typeof window !== "undefined") {
    window.MakaiStateStore = {
        MASTER_ADMINS,
        FREEMIUM_MONTHLY_CASE_LIMIT,
        SUBSCRIPTION_TIERS,
        appState,
        isMasterAdmin,
        isCurrentUserAdmin,
        setSessionState,
        updateUserMetricsInState,
        setActiveViewState,
        setCurriculumSelection,
        setExamSessionState,
        resetExamSessionState,
        canAccessBySubscription,
        hasRemainingFreemiumCases,
        subscribeToState,
        notifyStateChange,
        getStateSnapshot
    };
}
