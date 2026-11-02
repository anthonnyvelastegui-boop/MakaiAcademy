// ============================================================================
// ARCHIVO: js/2-core/state.store.js
// DESCRIPCIÓN: Memoria Reactiva, Ceguera por Diseño y Control de Permisos
// FILOSOFÍA: "Rieles de Acero" - Estricta separación de privilegios
// ============================================================================

/**
 * 1. EL OLIMPO: Cuentas Maestras de Administración.
 * Poseen acceso a base de datos, métricas financieras y configuración.
 */
export const MASTER_ADMINS = Object.freeze([
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
]);

/**
 * Verifica si un correo es Administrador Maestro absoluto.
 */
export function isMasterAdmin(email) {
    if (!email || typeof email !== "string") return false;
    return MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * 2. ESTADO GLOBAL COMPARTIDO (appState)
 * Define estrictamente qué ve el usuario y dónde está atrapado (Embudo).
 */
export const appState = {
    // Perfil
    currentUser: null,
    currentUserData: null,
    isAuthenticated: false,
    
    // Nivel de Privilegios (RBAC)
    role: "estudiante", // Valores posibles: "master", "secretaria", "dev_3d", "docente", "estudiante"
    
    // El Túnel del Estudiante (Rieles de Navegación)
    currentActiveView: "view-launcher",
    currentCareerTunnel: null, // Bloquea al estudiante solo en su carrera elegida
    currentStage: null, 
    currentSubject: null,
    
    // Motor de Exámenes
    isExamActive: false,
    examQuestions: [],
    currentQuestionIndex: 0,
    userAnswers: {}, 
    
    // Planes y Accesos Dinámicos
    activePlanFeatures: [] // Se llenará desde Firebase (planes_suscripcion)
};

/**
 * 3. MOTOR DE PRIVILEGIOS (Ceguera por Diseño)
 * Configura la sesión limitando la memoria según el rol exacto.
 */
export function setSessionState(user, userData) {
    if (!user && !userData) {
        appState.currentUser = null;
        appState.currentUserData = null;
        appState.isAuthenticated = false;
        appState.role = "visitante";
        return;
    }

    const email = user?.email || userData?.email || "";
    const isMaster = isMasterAdmin(email);

    appState.currentUser = user || null;
    appState.currentUserData = userData || null;
    appState.isAuthenticated = true;

    // Asignación de Roles Inmutable
    if (isMaster) {
        appState.role = "master";
        appState.currentCareerTunnel = "ALL"; // Tú lo ves todo
    } else {
        // Si es trabajador, respeta su rol (secretaria, docente, etc). Si no, es estudiante.
        appState.role = userData?.rol || "estudiante";
        
        // Túnel Forzado: El estudiante queda atrapado en su carrera
        if (appState.role === "estudiante" && userData?.carrera) {
            appState.currentCareerTunnel = userData.carrera; 
        }
    }

    // Ventana global para lectura rápida de módulos
    if (typeof window !== "undefined") {
        window.makaiRole = appState.role;
        window.makaiCareerTunnel = appState.currentCareerTunnel;
    }
}
