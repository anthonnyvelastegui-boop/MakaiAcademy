// ============================================================================
// ARCHIVO: js/2-core/app.orchestrator.js
// DESCRIPCIÓN: Director de Orquesta con importación dinámica anticaídas
// ============================================================================

import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from "./firebase.service.js";
import { isMasterAdmin, setSessionState } from "./state.store.js";

async function initApp() {
    const isIndexPage = !!document.getElementById("auth-form");
    const isRegisterPage = !!document.getElementById("full-register-form");
    const isDashboardPage = !!document.getElementById("views-container");

    // 1. Si estamos en index.html, activar inmediatamente los botones de Login y Gmail
    if (isIndexPage) {
        try {
            const loginModule = await import("../3-security/auth.login.js");
            loginModule.initAuthLogin();
        } catch (err) {
            console.error("Error cargando auth.login.js:", err);
        }
    }

    // 2. Si estamos en registro.html, activar el formulario de registro (si ya existe el archivo)
    if (isRegisterPage) {
        try {
            const regModule = await import("../3-security/auth.register.js");
            regModule.initAuthRegister();
        } catch (err) {
            console.warn("Módulo auth.register.js pendiente de creación:", err);
        }
    }

    // 3. Escuchar el estado de sesión en Firebase Authentication
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (isDashboardPage) {
                window.location.href = "index.html";
            }
            return;
        }

        const isAdmin = isMasterAdmin(user.email);
        const fallbackData = {
            uid: user.uid,
            email: user.email,
            nombre: user.displayName || user.email.split("@")[0],
            rol: isAdmin ? "admin" : "estudiante",
            subscriptionLevel: isAdmin ? "PRO" : "Básico",
            correoConfirmadoMakai: true,
            casesUsedThisMonth: 0,
            totalExamsCompleted: 0,
            globalAverage: 0,
            createdAt: new Date().toISOString()
        };

        let userData = fallbackData;

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
                await setDoc(userRef, fallbackData);
            } else {
                userData = snap.data();
                if (isAdmin) {
                    userData.rol = "admin";
                    userData.subscriptionLevel = "PRO";
                }
            }
        } catch (fireErr) {
            console.warn("Firestore en espera de reglas; usando sesión en memoria:", fireErr);
        }

        setSessionState(user, userData);

        if (isIndexPage) {
            const pendingPlan = sessionStorage.getItem("makai_selected_plan");
            const pendingBilling = sessionStorage.getItem("makai_selected_billing") || "annual";
            if (pendingPlan && (pendingPlan === "PRO" || pendingPlan === "VIP") && !isAdmin) {
                window.location.href = `registro.html?plan=${pendingPlan}&billing=${pendingBilling}`;
            } else {
                window.location.href = "dashboard.html";
            }
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
