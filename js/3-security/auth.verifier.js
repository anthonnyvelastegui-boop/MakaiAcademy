import {
    auth,
    db,
    doc,
    getDoc,
    updateDoc,
    sendEmailVerification
} from "../2-core/firebase.service.js";
import { isMasterAdmin } from "../2-core/state.store.js";

// Comprime imágenes (JPG/PNG) o convierte PDF (máx 750 KB) a Base64 para Firestore
export async function processReceiptFile(file) {
    if (!file) return null;
    if (file.type === "application/pdf") {
        if (file.size > 750 * 1024) {
            throw new Error("El archivo PDF supera los 750 KB. Por favor sube una captura de pantalla en formato JPG o PNG.");
        }
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 900;
                const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Verifica si un usuario ya confirmó su correo o si es Administrador Maestro
export async function checkIsVerifiedUser(user) {
    if (!user) return false;
    if (isMasterAdmin(user.email)) return true;

    const isGoogle = user.providerData?.some(p => p.providerId === "google.com");
    if (isGoogle) {
        try {
            const snap = await getDoc(doc(db, "usuarios", user.uid));
            if (snap.exists() && snap.data().correoConfirmadoMakai === true) {
                return true;
            }
        } catch (e) {
            console.warn("Verificando estado Gmail:", e);
        }
        return localStorage.getItem(`makai_gmail_verified_${user.uid}`) === "true";
    }

    return user.emailVerified;
}

// Despliega la tarjeta de espera de confirmación de correo en registro.html
export function showVerificationPendingScreen(user, chosenPlan = "basico") {
    const regCard = document.getElementById("registration-card");
    const verCard = document.getElementById("verification-card");
    const emailDisplay = document.getElementById("verify-email-display");
    const statusMsg = document.getElementById("verify-status-msg");
    const payBox = document.getElementById("payment-instructions-box");
    const payPlanName = document.getElementById("pay-plan-name");

    regCard?.classList.add("hidden");
    verCard?.classList.remove("hidden");
    if (emailDisplay && user?.email) emailDisplay.textContent = user.email;

    if (chosenPlan !== "basico" && payBox) {
        payBox.classList.remove("hidden");
        if (payPlanName) payPlanName.textContent = chosenPlan.toUpperCase();
    }

    const btnCheck = document.getElementById("btn-check-verified");
    const btnResend = document.getElementById("btn-resend-verification");

    if (btnCheck && !btnCheck.dataset.bound) {
        btnCheck.dataset.bound = "1";
        btnCheck.addEventListener("click", async () => {
            btnCheck.disabled = true;
            btnCheck.textContent = "Comprobando verificación...";
            try {
                await auth.currentUser.reload();
                const isGoogle = auth.currentUser.providerData?.some(p => p.providerId === "google.com");

                if (isGoogle || auth.currentUser.emailVerified || isMasterAdmin(auth.currentUser.email)) {
                    localStorage.setItem(`makai_gmail_verified_${auth.currentUser.uid}`, "true");
                    try {
                        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
                            correoConfirmadoMakai: true
                        });
                    } catch (e) {}
                    window.location.href = "dashboard.html";
                } else if (statusMsg) {
                    statusMsg.className = "mt-4 p-3 rounded-xl text-xs font-mono bg-warning/15 border border-warning text-warning";
                    statusMsg.textContent = `Aún no detectamos la confirmación. Abre el enlace enviado a tu correo (${user.email}) y vuelve a pulsar este botón.`;
                    statusMsg.classList.remove("hidden");
                }
            } catch (e) {
                console.error(e);
            } finally {
                btnCheck.disabled = false;
                btnCheck.innerHTML = '<span class="material-symbols-outlined text-base">verified</span><span>Ya abrí el enlace • Acceder a los Simuladores</span>';
            }
        });
    }

    if (btnResend && !btnResend.dataset.bound) {
        btnResend.dataset.bound = "1";
        btnResend.addEventListener("click", async () => {
            try {
                btnResend.disabled = true;
                await sendEmailVerification(auth.currentUser);
                if (statusMsg) {
                    statusMsg.className = "mt-4 p-3 rounded-xl text-xs font-mono bg-secondary/15 border border-secondary text-secondary";
                    statusMsg.textContent = `✓ Nuevo enlace de verificación enviado a ${user.email}`;
                    statusMsg.classList.remove("hidden");
                }
            } catch (e) {
                if (statusMsg) {
                    statusMsg.className = "mt-4 p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger";
                    statusMsg.textContent = `Espera un minuto antes de solicitar otro enlace (${e.code}).`;
                    statusMsg.classList.remove("hidden");
                }
            } finally {
                btnResend.disabled = false;
            }
        });
    }
}
