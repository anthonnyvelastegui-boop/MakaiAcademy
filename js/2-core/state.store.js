// ============================================================================
// ARCHIVO: js/2-core/state.store.js
// DESCRIPCIÓN: Memoria de estado global y validación de Administradores Maestros
// ============================================================================

export const MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

/**
 * Verifica si un correo pertenece a una de las cuentas maestras de administración.
 * @param {string} email
 * @returns {boolean}
 */
export function isMasterAdmin(email) {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Estado global compartido entre los controladores de las 8 carpetas.
 */
export const appState = {
    currentUser: null,
    currentUserData: null,
    currentActiveView: "view-launcher",
    currentCareer: "medicina",
    currentMode: "tutor",
    isExamActive: false
};

/**
 * Actualiza de forma segura los datos del usuario en memoria.
 * @param {object} user - Objeto User de Firebase Auth
 * @param {object} userData - Documento del usuario desde Firestore
 */
export function setSessionState(user, userData) {
    appState.currentUser = user;
    appState.currentUserData = userData;
    if (userData?.carrera) {
        appState.currentCareer = userData.carrera;
    }
}
