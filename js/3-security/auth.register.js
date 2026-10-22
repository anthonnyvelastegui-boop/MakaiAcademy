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
    const params = new URLSearchParams(window.location.search);
    const initialPlan = params.get("plan") || "basico";
    const initialPago = params.get("pago") || "";

    const planHiddenInput = document.getElementById("reg-plan-select");
    const planCards = document.querySelectorAll(".plan-card");
    const paySelect = document.getElementById("reg-payment-select");

    const qrSection = document.getElementById("qr-payment-section");
    const bankSection = document.getElementById("bank-transfer-section");
    const cardSection = document.getElementById("card-payment-section");
    const evidenceSection = document.getElementById("payment-evidence-section");
    const payAmountInput = document.getElementById("pay-amount");

    const planPrices = {
        basico: "0.00",
        pro_anual: "139.99",
        pro_mensual: "17.99",
        vip: "49.99"
    };

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

    function updatePaymentSectionsUI() {
        const currentPlan = planHiddenInput?.value || "basico";
        const method = paySelect?.value || "ninguno";

        qrSection?.classList.add("hidden");
        bankSection?.classList.add("hidden");
        cardSection?.classList.add("hidden");
        evidenceSection?.classList.add("hidden");

        const requiredEvidenceIds = [
            "pay-receipt-number",
            "pay-holder-name",
            "pay-holder-id",
            "pay-origin-bank",
            "pay-amount",
            "pay-receipt-date",
            "pay-receipt-file"
        ];

        if (currentPlan !== "basico" && (method === "qr" || method === "transferencia")) {
            if (method === "qr") qrSection?.classList.remove("hidden");
            if (method === "transferencia") bankSection?.classList.remove("hidden");
            evidenceSection?.classList.remove("hidden");
            if (payAmountInput) payAmountInput.value = planPrices[currentPlan] || "";

            requiredEvidenceIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.required = true;
            });
        } else {
            if (currentPlan !== "basico" && method === "tarjeta") {
                cardSection?.classList.remove("hidden");
            }
            requiredEvidenceIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.required = false;
            });
        }
    }

    function selectPlanCard(planKey, preferredMethod = "") {
        if (!planHiddenInput) return;
        planHiddenInput.value = planKey;

        planCards.forEach(card => {
            const isSelected = card.dataset.planCard === planKey;
            const icon = card.querySelector(".check-icon");
            if (isSelected) {
                card.className = "plan-card cursor-pointer rounded-xl p-4 border-2 border-primary bg-surface-high/95 shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all relative flex flex-col justify-between";
                if (icon) {
                    icon.textContent = "check_circle";
                    icon.className = "material-symbols-outlined text-primary text-base check-icon";
                }
            } else {
                card.className = "plan-card cursor-pointer rounded-xl p-4 border border-surface-high bg-surface hover:border-gray-600 transition-all relative flex flex-col justify-between";
                if (icon) {
                    icon.textContent = "radio_button_unchecked";
                    icon.className = "material-symbols-outlined text-gray-600 text-base check-icon";
                }
            }
        });

        if (paySelect) {
            paySelect.innerHTML = "";
            if (planKey === "basico") {
                const opt = document.createElement("option");
                opt.value = "ninguno";
                opt.textContent = "Sin pago por ahora (Iniciar con Plan Básico $0)";
                paySelect.appendChild(opt);
            } else {
                const paidOptions = [
                    { value: "qr", text: "Código QR Deuna! o Bancario" },
                    { value: "transferencia", text: "Transferencia Bancaria Directa" },
                    { value: "tarjeta", text: "Tarjeta de Crédito / Débito (Visa / Mastercard)" }
                ];
                paidOptions.forEach(o => {
                    const opt = document.createElement("option");
                    opt.value = o.value;
                    opt.textContent = o.text;
                    paySelect.appendChild(opt);
                });

                if (preferredMethod === "deuna" || preferredMethod === "qr") {
                    paySelect.value = "qr";
                } else if (preferredMethod === "transferencia") {
                    paySelect.value = "transferencia";
                } else if (preferredMethod === "tarjeta") {
                    paySelect.value = "tarjeta";
                }
            }
        }

        updatePaymentSectionsUI();
    }

    planCards.forEach(card => {
        card.addEventListener("click", () => selectPlanCard(card.dataset.planCard));
    });

    paySelect?.addEventListener("change", updatePaymentSectionsUI);

    const validPlans = ["basico", "pro_anual", "pro_mensual", "vip"];
    selectPlanCard(validPlans.includes(initialPlan) ? initialPlan : "basico", initialPago);

    const dateInput = document.getElementById("pay-receipt-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    const form = document.getElementById("full-register-form");
    const errorBox = document.getElementById("reg-error-box");
    const submitBtn = document.getElementById("btn-submit-register");

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox?.classList.add("hidden");

        const firstName = document.getElementById("reg-firstname").value.trim();
        const lastName = document.getElementById("reg-lastname").value.trim();
        const nickname = document.getElementById("reg-nickname").value.trim();
        const title = document.getElementById("reg-title").value;
        const career = document.getElementById("reg-career").value;
        const country = document.getElementById("reg-country").value;
        const phoneExt = document.getElementById("reg-phone-ext").value;
        const phoneNumber = document.getElementById("reg-phone-number").value.trim();
        const bday = document.getElementById("reg-bday").value.padStart(2, "0");
        const bmonth = document.getElementById("reg-bmonth").value.padStart(2, "0");
        const byear = document.getElementById("reg-byear").value;
        const email = document.getElementById("reg-email").value.trim();
        const backupEmail = document.getElementById("reg-backup-email").value.trim();
        const pass = document.getElementById("reg-password").value;
        const confirmPass = document.getElementById("reg-confirm-password").value;
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
                numeroComprobante: document.getElementById("pay-receipt-number").value.trim(),
                titularCuenta: document.getElementById("pay-holder-name").value.trim(),
                cedulaTitular: document.getElementById("pay-holder-id").value.trim(),
                bancoOrigen: document.getElementById("pay-origin-bank").value.trim(),
                montoDeclarado: document.getElementById("pay-amount").value.trim(),
                fechaComprobante: document.getElementById("pay-receipt-date").value,
                archivoNombre: receiptFile.name,
                archivoTipo: receiptFile.type,
                comprobanteBase64: receiptDataUrl,
                fechaHoraEnvioExacta: nowReadable
            } : null;

            const isUserAdmin = isMasterAdmin(email);

            const profileData = {
                uid: cred.user.uid,
                primerNombre: firstName,
                apellido: lastName,
                nombre: `${title} ${firstName} ${lastName}`,
                nickname: nickname,
                titulo: title,
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
