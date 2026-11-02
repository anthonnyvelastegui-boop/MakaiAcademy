// ============================================================================
// ARCHIVO: js/3-security/auth.verifier.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Verificación de Correo Electrónico en registro.html
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    sendEmailVerification,
    doc,
    updateDoc
} from "../2-core/firebase.service.js";

let verifierBound = false;

function showVerifierFeedback(message, type = "info") {
    const box = document.getElementById("verifier-feedback-box");
    if (!box) return;

    const styles = {
        info: "bg-primary/10 border border-primary/40 text-primary",
        success: "bg-secondary/10 border border-secondary/40 text-secondary",
        warning: "bg-warning/10 border border-warning/40 text-warning",
        danger: "bg-danger/10 border border-danger/40 text-danger"
    };

    box.className = `p-3 rounded-xl text-xs font-mono ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove("hidden");
}

/**
 * Muestra la tarjeta de espera de verificación de correo y oculta el formulario.
 */
export function showVerificationPendingScreen(user) {
    document.getElementById("registration-card")?.classList.add("hidden");
    document.getElementById("payment-waiting-room")?.classList.add("hidden");

    const card = document.getElementById("verification-card");
    const emailTarget = document.getElementById("verify-email-target");

    if (emailTarget && user?.email) {
        emailTarget.textContent = user.email;
    }
    card?.classList.remove("hidden");
}

/**
 * Inicializa los botones de comprobación en vivo y reenvío de correo.
 */
export async function initAuthVerifier() {
    if (verifierBound) return;
    verifierBound = true;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("verify") === "pending" && auth.currentUser) {
        showVerificationPendingScreen(auth.currentUser);
    }

    document.getElementById("btn-check-verified-now")?.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        await user.reload();
        if (user.emailVerified) {
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                correoConfirmadoMakai: true
            }).catch(() => {});
            showVerifierFeedback("✅ Correo confirmado. Abriendo tu estación clínica...", "success");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 600);
        } else {
            showVerifierFeedback("⏳ Aún no detectamos la confirmación. Abre el enlace enviado a tu bandeja o carpeta de Spam.", "warning");
        }
    });

    document.getElementById("btn-resend-verification")?.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await sendEmailVerification(user);
            showVerifierFeedback("📨 Nuevo enlace de verificación enviado a tu correo.", "info");
        } catch (err) {
            showVerifierFeedback("Espera un minuto antes de solicitar otro enlace.", "warning");
        }
    });
}

if (typeof window !== "undefined") {
    window.MakaiAuthVerifier = {
        initAuthVerifier,
        showVerificationPendingScreen
    };
}
