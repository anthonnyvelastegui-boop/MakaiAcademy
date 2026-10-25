// ============================================================================
// ARCHIVO: js/3-security/auth.register.js
// DESCRIPCIÓN: Controlador de Apertura de Expediente Académico, Cédula,
//              Planes (Básico, PRO Mensual, PRO Anual, VIP), QR y Comprobantes.
// ============================================================================

import {
    auth,
    db,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    doc,
    setDoc,
    collection,
    addDoc
} from "../2-core/firebase.service.js";
import { isMasterAdmin } from "../2-core/state.store.js";
import { processReceiptFile, showVerificationPendingScreen } from "./auth.verifier.js";

export function initAuthRegister() {
    const planHiddenInput = document.getElementById("reg-plan-select");
    const paySelect = document.getElementById("reg-payment-select");
    const form = document.getElementById("full-register-form");
    const errorBox = document.getElementById("reg-error-box");
    const submitBtn = document.getElementById("btn-submit-register");

    if (!form || form.dataset.registerBound === "1") return;
    form.dataset.registerBound = "1";

    // Medidor de entropía de contraseña en tiempo real
    const passInput = document.getElementById("reg-password");
    const strengthBar = document.getElementById("reg-password-strength");
    const strengthIndicator = strengthBar?.querySelector("div");

    if (passInput && strengthBar && strengthIndicator) {
        passInput.addEventListener("input", (e) => {
            const val = e.target.value;
            if (!val) {
                strengthBar.classList.add("hidden");
                return;
            }
            strengthBar.classList.remove("hidden");
            let strength = 0;
            if (val.length >= 8) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;

            strengthIndicator.className = "h-full transition-all ";
            if (strength <= 1) {
                strengthIndicator.classList.add("w-1/3", "bg-danger");
            } else if (strength <= 3) {
                strengthIndicator.classList.add("w-2/3", "bg-warning");
            } else {
                strengthIndicator.classList.add("w-full", "bg-secondary");
            }
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox?.classList.add("hidden");

        const title = document.getElementById("reg-title")?.value || "Dr.";
        const firstName = document.getElementById("reg-firstname")?.value.trim() || "";
        const lastName = document.getElementById("reg-lastname")?.value.trim() || "";
        const cedula = document.getElementById("reg-cedula")?.value.trim() || "";
        const nickname = document.getElementById("reg-nickname")?.value.trim() || "";
        const career = document.getElementById("reg-career")?.value || "medicina";
        const country = document.getElementById("reg-country")?.value || "Ecuador";
        const phoneExt = document.getElementById("reg-phone-ext")?.value || "+593";
        const phoneNumber = document.getElementById("reg-phone-number")?.value.trim() || "";
        const bday = String(document.getElementById("reg-bday")?.value || "01").padStart(2, "0");
        const bmonth = String(document.getElementById("reg-bmonth")?.value || "01").padStart(2, "0");
        const byear = document.getElementById("reg-byear")?.value || "2000";
        const email = document.getElementById("reg-email")?.value.trim() || "";
        const backupEmail = document.getElementById("reg-backup-email")?.value.trim() || "";
        const pass = document.getElementById("reg-password")?.value || "";
        const confirmPass = document.getElementById("reg-confirm-password")?.value || "";
        const chosenPlan = planHiddenInput?.value || "basico";
        const chosenPayment = paySelect?.value || "ninguno";

        if (pass !== confirmPass) {
            errorBox.textContent = "⚠️ Las contraseñas no coinciden. Verifícalas e intenta de nuevo.";
            errorBox.classList.remove("hidden");
            return;
        }

        if (email.toLowerCase() === backupEmail.toLowerCase()) {
            errorBox.textContent = "⚠️ El correo de respaldo debe ser diferente a tu correo electrónico principal.";
            errorBox.classList.remove("hidden");
            return;
        }

        const requiresReceipt = chosenPlan !== "basico" && (chosenPayment === "qr" || chosenPayment === "transferencia");
        const receiptFile = document.getElementById("pay-receipt-file")?.files?.[0];

        if (requiresReceipt && !receiptFile) {
            errorBox.textContent = "⚠️ Debes adjuntar la imagen (JPG/PNG) o PDF de tu comprobante bancario.";
            errorBox.classList.remove("hidden");
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "<span>Procesando expediente y comprobante...</span>";

            let receiptDataUrl = null;
            if (requiresReceipt && receiptFile) {
                receiptDataUrl = await processReceiptFile(receiptFile);
            }

            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            const nowIso = new Date().toISOString();
            const nowReadable = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });

            const paymentVerificationDetails = requiresReceipt ? {
                numeroComprobante: document.getElementById("pay-receipt-number")?.value.trim() || "",
                titularCuenta: document.getElementById("pay-holder-name")?.value.trim() || `${firstName} ${lastName}`,
                cedulaTitular: document.getElementById("pay-holder-id")?.value.trim() || cedula,
                bancoOrigen: document.getElementById("pay-origin-bank")?.value.trim() || "",
                montoDeclarado: document.getElementById("pay-amount")?.value.trim() || "17.99",
                fechaComprobante: document.getElementById("pay-receipt-date")?.value || "",
                archivoNombre: receiptFile.name,
                archivoTipo: receiptFile.type,
                comprobanteBase64: receiptDataUrl,
                fechaHoraEnvioExacta: nowReadable
            } : null;

            const isUserAdmin = isMasterAdmin(email);

            const profileData = {
                uid: cred.user.uid,
                titulo: title,
                primerNombre: firstName,
                apellido: lastName,
                nombre: `${title} ${firstName} ${lastName}`,
                cedula: cedula,
                nickname: nickname,
                carrera: career,
                pais: country,
                telefonoExtension: phoneExt,
                telefonoNumero: phoneNumber,
                telefonoCompleto: `${phoneExt} ${phoneNumber}`,
                email: email,
                emailRespaldo: backupEmail,
                cumpleanos: `${bday}/${bmonth}/${byear}`,
                rol: isUserAdmin ? "admin" : "estudiante",
                subscriptionLevel: isUserAdmin ? "PRO" : "Básico",
                planSolicitado: chosenPlan,
                metodoPagoPreferido: chosenPayment,
                estadoPago: chosenPlan === "basico" ? "activo_gratis" : "pendiente_verificacion",
                datosComprobante: paymentVerificationDetails,
                correoConfirmadoMakai: isUserAdmin,
                casesUsedThisMonth: 0,
                totalExamsCompleted: 0,
                globalAverage: 0,
                createdAt: nowIso
            };

            try {
                await setDoc(doc(db, "usuarios", cred.user.uid), profileData);

                if (requiresReceipt && paymentVerificationDetails) {
                    await addDoc(collection(db, "solicitudes_pago"), {
                        uid: cred.user.uid,
                        estudianteNombre: `${title} ${firstName} ${lastName}`,
                        estudianteCedula: cedula,
                        estudianteEmail: email,
                        estudianteTelefono: `${phoneExt} ${phoneNumber}`,
                        planSolicitado: chosenPlan,
                        metodoPago: chosenPayment,
                        estado: "pendiente",
                        ...paymentVerificationDetails,
                        createdAt: nowIso
                    });
                }
            } catch (fireErr) {
                console.warn("Aviso guardando en Firestore:", fireErr);
            }

            if (isUserAdmin) {
                window.location.href = "dashboard.html";
                return;
            }

            await sendEmailVerification(cred.user);
            showVerificationPendingScreen(cred.user, chosenPlan);

        } catch (err) {
            errorBox.textContent = "Error al registrar: " + err.message;
            errorBox.classList.remove("hidden");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-symbols-outlined">how_to_reg</span><span>Registrar y Enviar Correo de Verificación</span>';
        }
    });
}
