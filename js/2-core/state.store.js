// ============================================================================
// ARCHIVO: js/2-core/state.store.js
// DESCRIPCIÓN: Estado global y validación de Administradores Maestros
// ============================================================================

export const MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

export function isMasterAdmin(email) {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.trim().toLowerCase());
}

export const appState = {
    currentUser: null,
    currentUserData: null,
    currentActiveView: "view-launcher",
    currentCareer: "medicina",
    currentMode: "tutor",
    isExamActive: false
};

export function setSessionState(user, userData) {
    appState.currentUser = user;
    appState.currentUserData = userData;
    if (userData?.carrera) {
        appState.currentCareer = userData.carrera;
    }
}
