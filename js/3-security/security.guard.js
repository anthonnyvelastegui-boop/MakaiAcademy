// ============================================================================
// ARCHIVO: js/3-security/security.guard.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Guardia de Seguridad, Ceguera por Diseño (RBAC en el DOM),
//                  Control de 2 Dispositivos (1 PC + 1 Móvil) y Escudo Anti-Copia.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import {
    appState,
    isMasterAdmin,
    setSessionState
} from "../2-core/state.store.js";

// ============================================================================
// 1. CONSTANTES DE JERARQUÍA Y SEGURIDAD
// ============================================================================
export const SUBSCRIPTION_TIERS = Object.freeze({
    BASIC: "Básico",
    SURVIVAL: "Sobrevivencia",
    PRO: "PRO",
    VIP: "VIP"
});

export const FREEMIUM_MONTHLY_CASE_LIMIT = 15;

const DEVICE_ID_STORAGE_KEY = "makai_hardware_device_id_v1";
const SESSION_TOKEN_STORAGE_KEY = "makai_active_session_token_v1";
const MAX_SELF_SWAPS_PER_MONTH = 2;

let domAdminObserver = null;
let examAntiCheatBound = false;
let focusLostCounter = 0;
let activeDeviceUnsubscribe = null;

const PRO_ONLY_EXAM_MODES = Object.freeze(["estandar", "standard", "critico", "refuerzo_critico"]);

/**
 * Mapa de permisos RBAC dentro de #view-admin (Ceguera por Diseño).
 * Destruye del HTML cualquier sección que no pertenezca al rol del trabajador.
 */
const RBAC_ALLOWED_ADMIN_SECTIONS = Object.freeze({
    master: ["ALL"],
    secretaria: ["admin-section-payments", "admin-section-users"],
    dev_3d: ["admin-section-questions", "admin-section-materials", "admin-section-sinaptico", "admin-section-simulators"],
    docente: [],
    estudiante: []
});

// ============================================================================
// 2. HELPERS DE SUSCRIPCIÓN Y CUOTA (Integrados con state.store.js)
// ============================================================================

export function verifyMasterAdminAccess(userOrEmail = null) {
    if (!userOrEmail) {
        const email = appState.currentUser?.email || appState.currentUserData?.email || "";
        return isMasterAdmin(email);
    }
    if (typeof userOrEmail === "string") return isMasterAdmin(userOrEmail);
    return isMasterAdmin(userOrEmail.email);
}

export function canAccessBySubscription(requiredTier = SUBSCRIPTION_TIERS.BASIC) {
    if (verifyMasterAdminAccess()) return true;
    const rank = { "Básico": 0, "Sobrevivencia": 1, "PRO": 2, "VIP": 3 };
    const userTier = appState.currentUserData?.subscriptionLevel || "Básico";
    return (rank[userTier] ?? 0) >= (rank[requiredTier] ?? 0);
}

export function hasRemainingFreemiumCases() {
    if (verifyMasterAdminAccess()) return true;
    const userTier = appState.currentUserData?.subscriptionLevel || "Básico";
    if (userTier !== "Básico") return true;
    const used = Number(appState.currentUserData?.casesUsedThisMonth || 0);
    return used < FREEMIUM_MONTHLY_CASE_LIMIT;
}

// ============================================================================
// 3. INICIALIZACIÓN Y PROTECCIÓN DE RUTAS
// ============================================================================

export function detectCurrentPageType() {
    if (typeof document === "undefined") return "unknown";
    const path = (window.location.pathname || "").toLowerCase();

    if (document.getElementById("views-container") || path.endsWith("dashboard.html")) return "dashboard";
    if (document.getElementById("full-register-form") || document.getElementById("verification-card") || path.endsWith("registro.html")) return "registro";
    if (document.getElementById("auth-form") || path.endsWith("index.html") || path.endsWith("/")) return "index";
    return "unknown";
}

export async function initSecurityGuard(passedUser = null, passedUserData = null) {
    const currentViewType = detectCurrentPageType();
    const activeUser = passedUser || auth.currentUser || appState.currentUser;
    const activeUserData = passedUserData || appState.currentUserData;

    if (activeUser) {
        const allowed = await enforceRouteProtection(activeUser, activeUserData, currentViewType);
        if (!allowed) return false;
    } else if (currentViewType === "dashboard") {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = "index.html";
                return;
            }
            await enforceRouteProtection(user, appState.currentUserData, "dashboard");
        });
    }

    if (currentViewType === "dashboard") {
        enforceAdminVaultLock(activeUser);
        startAdminDomMutationGuard();
        bindGlobalSecurityListeners();
    }

    return true;
}

export const initGuard = initSecurityGuard;

export async function enforceRouteProtection(user, userData = null, pageType = null) {
    const view = pageType || detectCurrentPageType();

    if (!user) {
        if (view === "dashboard") {
            window.location.href = "index.html";
            return false;
        }
        return true;
    }

    // Olimpo (Administradores Maestros) -> Pase directo sin límite de dispositivos
    if (verifyMasterAdminAccess(user)) {
        await verifyAndRegisterUserDevice(user);
        if (view === "index") {
            window.location.href = "dashboard.html";
            return false;
        }
        if (view === "dashboard") await auditUserSessionIntegrity(user);
        return true;
    }

    // Verificar límite de 2 dispositivos (1 PC + 1 Celular)
    const deviceCheck = await verifyAndRegisterUserDevice(user);
    if (!deviceCheck.allowed) return false;

    if (view === "index") {
        window.location.href = "dashboard.html";
        return false;
    }

    if (view === "dashboard") {
        await auditUserSessionIntegrity(user);
    }

    return true;
}

// ============================================================================
// 4. CEGUERA POR DISEÑO EN EL DOM (Blindaje de Bóveda por Rol)
// ============================================================================

export function enforceAdminVaultLock(user = null) {
    const activeUser = user || auth.currentUser || appState.currentUser;
    const isMaster = verifyMasterAdminAccess(activeUser);
    const role = isMaster ? "master" : (appState.role || "estudiante");
    const allowedSections = RBAC_ALLOWED_ADMIN_SECTIONS[role] || [];
    const canEnterVault = allowedSections.length > 0;

    const adminNavBtn = document.getElementById("admin-nav-btn");
    const headerAdminBtn = document.getElementById("header-admin-btn");
    const adminView = document.getElementById("view-admin");

    if (canEnterVault) {
        adminNavBtn?.classList.remove("hidden");
        headerAdminBtn?.classList.remove("hidden");
        applyRoleBlindnessInsideVault(role);
    } else {
        adminNavBtn?.classList.add("hidden");
        headerAdminBtn?.classList.add("hidden");

        if (adminView && !adminView.classList.contains("hidden")) {
            adminView.classList.add("hidden");
            adminView.innerHTML = "";
            document.getElementById("view-launcher")?.classList.remove("hidden");
            showSecurityToast("Acceso restringido por el Guardia de Seguridad.", "danger");
        }
    }
}

/**
 * Destruye físicamente del DOM los bloques administrativos que no corresponden al rol.
 */
export function applyRoleBlindnessInsideVault(role) {
    if (role === "master") return; // El Administrador Maestro ve todo

    const allowedIds = RBAC_ALLOWED_ADMIN_SECTIONS[role] || [];
    const allAdminModules = document.querySelectorAll("[data-admin-module]");

    allAdminModules.forEach(moduleEl => {
        const moduleId = moduleEl.id || moduleEl.dataset.adminModule;
        if (!allowedIds.includes(moduleId)) {
            moduleEl.remove(); // Destrucción física del DOM (Ceguera por Diseño)
        }
    });
}

function startAdminDomMutationGuard() {
    if (domAdminObserver || typeof MutationObserver === "undefined") return;
    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    domAdminObserver = new MutationObserver(() => {
        const isMaster = verifyMasterAdminAccess();
        const role = isMaster ? "master" : (appState.role || "estudiante");
        const allowed = (RBAC_ALLOWED_ADMIN_SECTIONS[role] || []).length > 0;

        if (!allowed && !adminView.classList.contains("hidden")) {
            adminView.classList.add("hidden");
            adminView.innerHTML = "";
            document.getElementById("view-launcher")?.classList.remove("hidden");
            showSecurityToast("Operación bloqueada por Rieles de Acero Makai.", "danger");
        } else if (allowed && role !== "master") {
            applyRoleBlindnessInsideVault(role);
        }
    });

    domAdminObserver.observe(adminView, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["class", "style"]
    });
}

// ============================================================================
// 5. AUDITORÍA DE EXPEDIENTE Y PERMISOS DE SIMULADORES
// ============================================================================

export async function auditUserSessionIntegrity(user = null) {
    const activeUser = user || auth.currentUser || appState.currentUser;
    if (!activeUser) return null;

    try {
        const userRef = doc(db, COLLECTIONS.USERS, activeUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return appState.currentUserData;

        const remoteData = snap.data();
        const isMaster = verifyMasterAdminAccess(activeUser);

        if (isMaster && (remoteData.rol !== "master" || remoteData.subscriptionLevel !== "PRO")) {
            await updateDoc(userRef, {
                rol: "master",
                subscriptionLevel: "PRO",
                estadoPago: "activo_verificado"
            }).catch(() => {});
            remoteData.rol = "master";
            remoteData.subscriptionLevel = "PRO";
        }

        if (!isMaster && remoteData.estadoPago === "pendiente_verificacion") {
            remoteData.subscriptionLevel = "Básico";
        }

        setSessionState(activeUser, remoteData);
        enforceAdminVaultLock(activeUser);
        return remoteData;
    } catch (err) {
        return appState.currentUserData;
    }
}

export function canUserAccessFeature(featureConfig = {}) {
    const {
        requiredLevel = SUBSCRIPTION_TIERS.BASIC,
        examMode = null,
        requiresCaseQuota = false,
        adminOnly = false
    } = featureConfig;

    if (verifyMasterAdminAccess()) {
        return { allowed: true, reason: "Acceso Maestro Autorizado", action: "none" };
    }

    if (adminOnly) {
        return { allowed: false, reason: "Exclusivo para Administradores Maestros.", action: "admin_only" };
    }

    if (examMode && PRO_ONLY_EXAM_MODES.includes(examMode.trim().toLowerCase())) {
        if (!canAccessBySubscription(SUBSCRIPTION_TIERS.PRO)) {
            return {
                allowed: false,
                reason: "El Simulacro Estándar CACES (100 preguntas) requiere el plan Makai PRO CACES.",
                action: "paywall"
            };
        }
    }

    if (!canAccessBySubscription(requiredLevel)) {
        return {
            allowed: false,
            reason: `Este módulo requiere una suscripción activa nivel ${requiredLevel}.`,
            action: "paywall"
        };
    }

    if (requiresCaseQuota && !hasRemainingFreemiumCases()) {
        return {
            allowed: false,
            reason: `Alcanzaste los ${FREEMIUM_MONTHLY_CASE_LIMIT} casos gratuitos del mes. Actualiza tu plan para acceso ilimitado.`,
            action: "paywall"
        };
    }

    return { allowed: true, reason: "Acceso permitido", action: "none" };
}

export function guardExamLaunch(examMode = null, careerId = null) {
    const verdict = canUserAccessFeature({
        careerId: careerId || appState.currentCareerTunnel || "medicina",
        examMode: examMode || "tutor",
        requiresCaseQuota: true
    });

    if (verdict.allowed) return true;

    if (verdict.action === "paywall") {
        window.MakaiPaywall?.openPaywallModal?.(verdict.reason);
    } else {
        showSecurityToast(verdict.reason, "warning");
    }
    return false;
}

// ============================================================================
// 6. ESCUDO ANTI-COPIA DURANTE EXÁMENES
// ============================================================================

export function enableExamAntiCheatGuard() {
    focusLostCounter = 0;
    if (examAntiCheatBound || typeof window === "undefined") return;

    window.addEventListener("beforeunload", handleBeforeUnloadExam);
    document.addEventListener("copy", handleProtectedClinicalCopy);
    document.addEventListener("contextmenu", handleProtectedContextMenu);
    document.addEventListener("visibilitychange", handleExamVisibilityChange);
    examAntiCheatBound = true;
}

export function disableExamAntiCheatGuard() {
    if (!examAntiCheatBound || typeof window === "undefined") return;

    window.removeEventListener("beforeunload", handleBeforeUnloadExam);
    document.removeEventListener("copy", handleProtectedClinicalCopy);
    document.removeEventListener("contextmenu", handleProtectedContextMenu);
    document.removeEventListener("visibilitychange", handleExamVisibilityChange);
    examAntiCheatBound = false;
}

function handleBeforeUnloadExam(event) {
    if (!appState.isExamActive) return;
    event.preventDefault();
    event.returnValue = "Tienes un simulacro en curso. Si sales perderás tu progreso.";
    return event.returnValue;
}

function handleProtectedClinicalCopy(event) {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;
    event.preventDefault();
    showSecurityToast("Banco de reactivos protegido contra copia.", "warning");
}

function handleProtectedContextMenu(event) {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;
    event.preventDefault();
}

function handleExamVisibilityChange() {
    if (!appState.isExamActive || verifyMasterAdminAccess()) return;
    if (document.hidden) {
        focusLostCounter += 1;
        if (focusLostCounter >= 2) {
            showSecurityToast(`Alerta CACES: Cambio de pestaña detectado (${focusLostCounter}).`, "warning");
        }
    }
}

export async function secureSignOut(reason = null) {
    disableExamAntiCheatGuard();
    appState.isExamActive = false;
    try { await signOut(auth); } catch (e) {}
    if (reason) sessionStorage.setItem("makai_signout_notice", reason);
    window.location.href = "index.html";
}

function bindGlobalSecurityListeners() {
    if (typeof window === "undefined") return;
    window.addEventListener("makai:stateChanged", () => {
        enforceAdminVaultLock(appState.currentUser);
        if (appState.isExamActive) enableExamAntiCheatGuard();
        else disableExamAntiCheatGuard();
    });
}

export function showSecurityToast(message, type = "info") {
    let fallbackToast = document.getElementById("makai-security-toast-fallback");
    if (!fallbackToast) {
        fallbackToast = document.createElement("div");
        fallbackToast.id = "makai-security-toast-fallback";
        document.body.appendChild(fallbackToast);
    }

    const borderPalette = {
        info: "border-[#00e5ff] text-[#00e5ff]",
        warning: "border-[#ffbe0b] text-[#ffbe0b]",
        danger: "border-[#ff4d4d] text-[#ff4d4d]",
        success: "border-[#94de2d] text-[#94de2d]"
    };

    fallbackToast.className = `fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 rounded-xl bg-[#111722] border ${borderPalette[type] || borderPalette.info} shadow-2xl font-mono text-xs`;
    fallbackToast.textContent = message;

    clearTimeout(fallbackToast._hideTimer);
    fallbackToast._hideTimer = setTimeout(() => fallbackToast.remove(), 3600);
}

// ============================================================================
// 7. CONTROL DE HARDWARE: 1 COMPUTADORA (SLOT 1) + 1 CELULAR (SLOT 2)
// ============================================================================

export function detectDeviceEnvironment() {
    const ua = navigator.userAgent || "";
    const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const isIPadOS = platform.includes("mac") && navigator.maxTouchPoints > 1;
    const category = (isMobileUA || isIPadOS) ? "mobile" : "desktop";

    let osName = "OS";
    if (/Windows/i.test(ua)) osName = "Windows";
    else if (/iPhone|iPad/i.test(ua) || isIPadOS) osName = "iOS";
    else if (/Android/i.test(ua)) osName = "Android";
    else if (/Mac/i.test(ua)) osName = "macOS";
    else if (/Linux/i.test(ua)) osName = "Linux";

    let browserName = "Navegador";
    if (/Edg\//i.test(ua)) browserName = "Edge";
    else if (/Chrome\//i.test(ua)) browserName = "Chrome";
    else if (/Firefox\//i.test(ua)) browserName = "Firefox";
    else if (/Safari\//i.test(ua)) browserName = "Safari";

    return {
        category,
        osName,
        browserName,
        label: `${category === "desktop" ? "PC/Laptop" : "Móvil"}: ${browserName} (${osName})`
    };
}

export function getOrCreateDeviceId() {
    const env = detectDeviceEnvironment();
    const prefix = env.category === "desktop" ? "MK-DESK" : "MK-MOB";

    try {
        const saved = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (saved && saved.startsWith(prefix)) return saved;
    } catch (e) {}

    const randHex = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0");
    const newId = `${prefix}-${randHex}`;
    try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId); } catch (e) {}
    return newId;
}

function getOrCreateSessionToken() {
    let token = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (!token) {
        token = `SES-${Date.now().toString(36).toUpperCase()}`;
        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
    return token;
}

export async function verifyAndRegisterUserDevice(user) {
    if (!user?.uid) return { allowed: false };

    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    const isMaster = verifyMasterAdminAccess(user);
    const env = detectDeviceEnvironment();
    const currentDevice = {
        deviceId: getOrCreateDeviceId(),
        slot: env.category,
        etiqueta: env.label,
        sessionToken: getOrCreateSessionToken(),
        ultimoAcceso: new Date().toISOString()
    };

    if (isMaster) return { allowed: true, isMaster: true };

    try {
        const snap = await getDoc(userRef);
        const userData = snap.exists() ? snap.data() : {};
        const registeredMap = userData.dispositivosRegistrados || {};
        const slotKey = currentDevice.slot;
        const existingSlotDevice = registeredMap[slotKey] || null;

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const swapStats = registeredMap.controlReemplazos || { mes: currentMonthKey, usados: 0 };
        if (swapStats.mes !== currentMonthKey) {
            swapStats.mes = currentMonthKey;
            swapStats.usados = 0;
        }

        if (!existingSlotDevice?.deviceId || existingSlotDevice.deviceId === currentDevice.deviceId) {
            const updatedDevices = {
                ...registeredMap,
                [slotKey]: currentDevice,
                controlReemplazos: swapStats
            };
            await setDoc(userRef, { dispositivosRegistrados: updatedDevices }, { merge: true });
            startRealtimeDeviceWatchdog(user.uid, slotKey, currentDevice.deviceId, currentDevice.sessionToken);
            return { allowed: true };
        }

        showDeviceLimitConflictModal({ user, slotKey, existingDevice: existingSlotDevice, newDevice: currentDevice, registeredMap, swapStats });
        return { allowed: false, status: "slot_conflict" };
    } catch (err) {
        return { allowed: true, status: "offline_fallback" };
    }
}

function startRealtimeDeviceWatchdog(uid, slotKey, myDeviceId, mySessionToken) {
    if (activeDeviceUnsubscribe) {
        try { activeDeviceUnsubscribe(); } catch (e) {}
    }

    const userRef = doc(db, COLLECTIONS.USERS, uid);
    activeDeviceUnsubscribe = onSnapshot(userRef, async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (verifyMasterAdminAccess(data.email)) return;

        const activeSlot = data.dispositivosRegistrados?.[slotKey];
        if (activeSlot && (activeSlot.deviceId !== myDeviceId || activeSlot.sessionToken !== mySessionToken)) {
            if (activeDeviceUnsubscribe) activeDeviceUnsubscribe();
            await secureSignOut("Se abrió sesión en otro dispositivo.");
        }
    }, () => {});
}

function showDeviceLimitConflictModal({ user, slotKey, existingDevice, newDevice, registeredMap, swapStats }) {
    document.getElementById("makai-device-conflict-modal")?.remove();
    const remainingSwaps = Math.max(0, MAX_SELF_SWAPS_PER_MONTH - (swapStats.usados || 0));

    const modal = document.createElement("div");
    modal.id = "makai-device-conflict-modal";
    modal.className = "fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-sans";
    modal.innerHTML = `
        <div class="bg-[#111722] border-2 border-[#ffbe0b] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 class="text-lg font-extrabold text-white">🛡️ Límite de Dispositivos (1 PC + 1 Móvil)</h3>
            <p class="text-xs text-gray-300">Ya tienes registrado: <strong>${existingDevice.etiqueta}</strong></p>
            <div class="flex justify-end gap-2 pt-2">
                <button id="btn-cancel-dev" class="px-4 py-2 rounded-xl bg-[#06090e] border border-gray-700 text-xs text-gray-300">Cancelar</button>
                ${remainingSwaps > 0 ? `<button id="btn-swap-dev" class="px-4 py-2 rounded-xl bg-[#00e5ff] text-[#06090e] font-extrabold text-xs">Vincular este equipo (${remainingSwaps} disp.)</button>` : ""}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("btn-cancel-dev")?.addEventListener("click", () => secureSignOut());
    document.getElementById("btn-swap-dev")?.addEventListener("click", async () => {
        const updatedDevices = {
            ...registeredMap,
            [slotKey]: newDevice,
            controlReemplazos: { mes: swapStats.mes, usados: (swapStats.usados || 0) + 1 }
        };
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { dispositivosRegistrados: updatedDevices }, { merge: true });
        modal.remove();
        window.location.href = "dashboard.html";
    });
}

if (typeof window !== "undefined") {
    window.MakaiSecurityGuard = {
        initSecurityGuard,
        initGuard,
        enforceRouteProtection,
        verifyMasterAdminAccess,
        enforceAdminVaultLock,
        applyRoleBlindnessInsideVault,
        auditUserSessionIntegrity,
        canUserAccessFeature,
        guardExamLaunch,
        enableExamAntiCheatGuard,
        disableExamAntiCheatGuard,
        secureSignOut,
        showSecurityToast
    };
}
