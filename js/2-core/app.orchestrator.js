// js/2-core/app.orchestrator.js
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from "./firebase.service.js";
import { appState, isMasterAdmin } from "./state.store.js";
import { initAuthLogin } from "../3-security/auth.login.js";
import { initDashboardSPA } from "./router.spa.js";

function initApp() {
    const isIndexPage = !!document.getElementById("auth-form");
    const isDashboardPage = !!document.getElementById("views-container");

    if (isIndexPage) {
        initAuthLogin();
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            appState.currentUser = user;
            const adminStatus = isMasterAdmin(user.email);

            const defaultProfile = {
                email: user.email,
                nombre: user.displayName || user.email.split("@")[0],
                rol: adminStatus ? "admin" : "estudiante",
                subscriptionLevel: adminStatus ? "PRO" : "Básico",
                casesUsedThisMonth: 0,
                totalExamsCompleted: 0,
                globalAverage: 0,
                createdAt: new Date().toISOString()
            };

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const snap = await getDoc(userRef);
                if (!snap.exists()) {
                    await setDoc(userRef, defaultProfile);
                    appState.currentUserData = defaultProfile;
                } else {
                    appState.currentUserData = snap.data();
                    if (adminStatus) {
                        appState.currentUserData.rol = "admin";
                        appState.currentUserData.subscriptionLevel = "PRO";
                    }
                }
            } catch (e) {
                console.warn("Cargando perfil en memoria mientras responde Firestore:", e);
                appState.currentUserData = defaultProfile;
            }

            if (isIndexPage) {
                window.location.href = "dashboard.html";
            } else if (isDashboardPage) {
                initDashboardSPA(user, appState.currentUserData);
            }
        } else {
            if (isDashboardPage) {
                window.location.href = "index.html";
            }
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
