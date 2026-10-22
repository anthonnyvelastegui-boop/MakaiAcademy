import { auth, onAuthStateChanged } from "./firebase.service.js";
import { initAuthLogin } from "../3-security/auth.login.js";
import { initAuthRegister } from "../3-security/auth.register.js";
import { checkIsVerifiedUser, showVerificationPendingScreen } from "../3-security/auth.verifier.js";

function initApp() {
    const isIndexPage = !!document.getElementById("auth-form");
    const isRegisterPage = !!document.getElementById("full-register-form");

    if (isIndexPage) {
        initAuthLogin();
    }

    if (isRegisterPage) {
        initAuthRegister();
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        const verified = await checkIsVerifiedUser(user);

        if (!verified) {
            if (isRegisterPage) {
                showVerificationPendingScreen(user);
            } else if (isIndexPage) {
                window.location.href = "registro.html?verify=pending";
            }
            return;
        }

        // Si ya está autenticado y verificado en index.html o registro.html, redirigir al Dashboard
        if (isIndexPage || isRegisterPage) {
            window.location.href = "dashboard.html";
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
