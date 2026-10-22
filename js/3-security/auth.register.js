// ============================================================================
// ARCHIVO: js/3-security/auth.register.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Controlador Principal de registro.html, Selección de Planes,
//                  Pasarela QR / Transferencia / Tarjeta, Compresión Base64 de
//                  Comprobantes y Registro en `usuarios` y `solicitudes_pago`.
// ============================================================================

import {
    auth,
    db,
    createUserWithEmailAndPassword,
     doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    addDoc
} from "../2-core/firebase.service.js";

import * as FirebaseService from "../2-core/firebase.service.js";
import * as StateStore from "../2-core/state.store.js";

// --- LISTA DE RESPALDO DE CUENTAS MAESTRAS DE ADMINISTRACIÓN ---
const FALLBACK_MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

// --- DICCIONARIO OFICIAL DE PRECIOS POR PLAN (USD) ---
export const PLAN_PRICES_USD = Object.freeze({
    basico: "0.00",
    pro_anual: "139.99",
    pro_mensual: "17.99",
    vip: "49.99"
});

// --- IDs DE CAMPOS OBLIGATORIOS CUANDO SE SUBE COMPROBANTE BANCARIO ---
const REQUIRED_EVIDENCE_IDS = [
    "pay-receipt-number",
    "pay-holder-name",
    "pay-holder-id",
    "pay-origin-bank",
    "pay-amount",
    "pay-receipt-date",
    "pay-receipt-file"
];

// Bandera interna para evitar enlaces duplicados en el DOM
let registerUIInitialized = false;

/**
 * Verifica si un correo electrónico pertenece a una cuenta maestra de administración.
 * @param {string} email
 * @returns {boolean}
 */
export function isRegisterAdminEmail(email) {
    if (!email) return false;
    if (typeof StateStore.isMasterAdmin === "function") {
        return StateStore.isMasterAdmin(email);
    }
    return FALLBACK_MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Envía el correo de verificación utilizando la función exportada por firebase.service.js
 * o importándola desde el CDN oficial v13.0.0 como respaldo seguro.
 * @param {Object} user - Objeto User de Firebase Auth
 */
async function triggerVerificationEmail(user) {
    if (!user) return;
    if (typeof FirebaseService.sendEmailVerification === "function") {
        await FirebaseService.sendEmailVerification(user);
        return;
    }
    const { sendEmailVerification } = await import(
        "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js"
    );
    await sendEmailVerification(user);
}

/**
 * Normaliza los parámetros URL (`?plan=...&billing=...`) provenientes de
 * `index.html`, `dashboard.html` o accesos directos hacia las 4 llaves de `registro.html`.
 * @param {string|null} rawPlan
 * @param {string|null} rawBilling
 * @returns {"basico"|"pro_anual"|"pro_mensual"|"vip"}
 */
export function normalizePlanKeyFromUrl(rawPlan, rawBilling = "annual") {
    const cleanPlan = (rawPlan || "").trim().toLowerCase();
    const cleanBilling = (rawBilling || "annual").trim().toLowerCase();

    if (cleanPlan === "pro_anual" || cleanPlan === "pro_mensual" || cleanPlan === "vip" || cleanPlan === "basico") {
        return cleanPlan;
    }
    if (cleanPlan === "pro") {
        return cleanBilling === "monthly" || cleanBilling === "mensual"
            ? "pro_mensual"
            : "pro_anual";
    }
    return "basico";
}

/**
 * Comprime imágenes JPG/PNG utilizando HTML5 Canvas (máx. 900px, JPEG 0.78)
 * o convierte documentos PDF (máx. 750 KB) a formato DataURL Base64.
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function processReceiptFile(file) {
    if (!file) return null;

    if (file.type === "application/pdf") {
        if (file.size > 750 * 1024) {
            throw new Error(
                "El archivo PDF supera los 750 KB. Por favor sube una captura de pantalla en formato JPG o PNG."
            );
        }
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("No se pudo leer el archivo PDF seleccionado."));
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
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            img.onerror = () => reject(new Error("El archivo de imagen no es válido. Usa formato JPG o PNG."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("No se pudo procesar la captura del comprobante."));
        reader.readAsDataURL(file);
    });
}

/**
 * Muestra u oculta las secciones de QR, Transferencia, Tarjeta y Evidencia Bancaria
 * según el plan activo y el método de pago elegido.
 */
export function updatePaymentSectionsUI() {
    const planHiddenInput = document.getElementById("reg-plan-select");
    const paySelect = document.getElementById("reg-payment-select");

    const qrSection = document.getElementById("qr-payment-section");
    const bankSection = document.getElementById("bank-transfer-section");
    const cardSection = document.getElementById("card-payment-section");
    const evidenceSection = document.getElementById("payment-evidence-section");
    const payAmountInput = document.getElementById("pay-amount");

    const currentPlan = planHiddenInput?.value || "basico";
    const method = paySelect?.value || "ninguno";

    qrSection?.classList.add("hidden");
    bankSection?.classList.add("hidden");
    cardSection?.classList.add("hidden");
    evidenceSection?.classList.add("hidden");

    if (currentPlan !== "basico" && (method === "qr" || method === "transferencia")) {
        if (method === "qr") qrSection?.classList.remove("hidden");
        if (method === "transferencia") bankSection?.classList.remove("hidden");
        evidenceSection?.classList.remove("hidden");

        if (payAmountInput) {
            payAmountInput.value = PLAN_PRICES_USD[currentPlan] || "";
        }

        REQUIRED_EVIDENCE_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.required = true;
        });
    } else {
        if (currentPlan !== "basico" && method === "tarjeta") {
            cardSection?.classList.remove("hidden");
        }
        REQUIRED_EVIDENCE_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.required = false;
        });
    }
}

/**
 * Selecciona una tarjeta de plan académico (`.plan-card`), actualiza el selector de
 * métodos de pago (`#reg-payment-select`) y sincroniza los paneles bancarios.
 * @param {string} planKey - "basico" | "pro_anual" | "pro_mensual" | "vip"
 * @param {string} [preferredMethod=""] - "qr" | "deuna" | "transferencia" | "tarjeta"
 */
export function selectPlanCard(planKey, preferredMethod = "") {
    const planHiddenInput = document.getElementById("reg-plan-select");
    const planCards = document.querySelectorAll(".plan-card");
    const paySelect = document.getElementById("reg-payment-select");

    if (!planHiddenInput) return;
    planHiddenInput.value = planKey;

    planCards.forEach((card) => {
        const isSelected = card.dataset.planCard === planKey;
        const icon = card.querySelector(".check-icon");

        if (isSelected) {
            card.className =
                "plan-card cursor-pointer rounded-xl p-4 border-2 border-primary bg-surface-high/95 shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all relative flex flex-col justify-between";
            if (icon) {
                icon.textContent = "check_circle";
                icon.className = "material-symbols-outlined text-primary text-base check-icon";
            }
        } else {
            card.className =
                "plan-card cursor-pointer rounded-xl p-4 border border-surface-high bg-surface hover:border-gray-600 transition-all relative flex flex-col justify-between";
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

            paidOptions.forEach((o) => {
                const opt = document.createElement("option");
                opt.value = o.value;
                opt.textContent = o.text;
                paySelect.appendChild(opt);
            });

            const cleanMethod = preferredMethod.trim().toLowerCase();
            if (cleanMethod === "deuna" || cleanMethod === "qr") {
                paySelect.value = "qr";
            } else if (cleanMethod === "transferencia") {
                paySelect.value = "transferencia";
            } else if (cleanMethod === "tarjeta") {
                paySelect.value = "tarjeta";
            }
        }
    }

    updatePaymentSectionsUI();
}

/**
 * Despliega la tarjeta de verificación de correo (`#verification-card`) tras crear la cuenta.
 * Si `auth.verifier.js` está disponible, se apoya en él y asegura los listeners de respaldo.
 * @param {Object} user - Usuario de Firebase Auth
 * @param {string} [chosenPlan="basico"]
 * @param {string} [chosenPayment="ninguno"]
 */
export async function showVerificationPendingScreen(user, chosenPlan = "basico", chosenPayment = "ninguno") {
    if (!user) return;

    // Intentar delegar primero al módulo hermano auth.verifier.js si ya fue programado
    try {
        const verifierMod = await import("./auth.verifier.js");
        if (typeof verifierMod.showVerificationPendingScreen === "function") {
            verifierMod.showVerificationPendingScreen(user, chosenPlan, chosenPayment);
            return;
        }
    } catch (_) {
        // Continúa con el respaldo integrado si auth.verifier.js aún es archivo semilla
    }

    const regCard = document.getElementById("registration-card");
    const verCard = document.getElementById("verification-card");
    const emailDisplay = document.getElementById("verify-email-display");
    const statusMsg = document.getElementById("verify-status-msg");
    const payBox = document.getElementById("payment-instructions-box");
    const payPlanName = document.getElementById("pay-plan-name");

    regCard?.classList.add("hidden");
    verCard?.classList.remove("hidden");

    if (emailDisplay) emailDisplay.textContent = user.email || "";

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
                await auth.currentUser?.reload();
                const currentUser = auth.currentUser || user;
                const isGoogle = currentUser.providerData?.some((p) => p.providerId === "google.com");

                if (isGoogle || currentUser.emailVerified || isRegisterAdminEmail(currentUser.email)) {
                    localStorage.setItem(`makai_gmail_verified_${currentUser.uid}`, "true");
                    try {
                        await updateDoc(doc(db, "usuarios", currentUser.uid), {
                            correoConfirmadoMakai: true
                        });
                    } catch (_) {}
                    window.location.href = "dashboard.html";
                } else if (statusMsg) {
                    statusMsg.className =
                        "mt-4 p-3 rounded-xl text-xs font-mono bg-warning/15 border border-warning text-warning";
                    statusMsg.textContent =
                        `Aún no detectamos la confirmación. Abre el enlace enviado a tu correo (${currentUser.email}) y vuelve a pulsar este botón.`;
                    statusMsg.classList.remove("hidden");
                }
            } catch (err) {
                console.error("[AuthRegister] Error comprobando verificación:", err);
            } finally {
                btnCheck.disabled = false;
                btnCheck.innerHTML =
                    '<span class="material-symbols-outlined text-base">verified</span><span>Ya abrí el enlace • Acceder a los Simuladores</span>';
            }
        });
    }

    if (btnResend && !btnResend.dataset.bound) {
        btnResend.dataset.bound = "1";
        btnResend.addEventListener("click", async () => {
            try {
                btnResend.disabled = true;
                await triggerVerificationEmail(auth.currentUser || user);
                if (statusMsg) {
                    statusMsg.className =
                        "mt-4 p-3 rounded-xl text-xs font-mono bg-secondary/15 border border-secondary text-secondary";
                    statusMsg.textContent = `✓ Nuevo enlace de verificación enviado a ${user.email}`;
                    statusMsg.classList.remove("hidden");
                }
            } catch (err) {
                if (statusMsg) {
                    statusMsg.className =
                        "mt-4 p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger";
                    statusMsg.textContent = `Espera un minuto antes de solicitar otro enlace (${err.code || "límite activo"}).`;
                    statusMsg.classList.remove("hidden");
                }
            } finally {
                btnResend.disabled = false;
            }
        });
    }
}

/**
 * Muestra un mensaje de error formateado dentro de `#reg-error-box`.
 * @param {string} message
 */
function showRegisterError(message) {
    const errorBox = document.getElementById("reg-error-box");
    if (!errorBox) {
        alert(message);
        return;
    }
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Procesa el envío del formulario `#full-register-form` en `registro.html`.
 * Soporta tanto el alta de un nuevo expediente como la subida de un comprobante de
 * actualización de plan (`?plan=pro_anual&pago=qr`) si el alumno ya tiene sesión activa.
 * @param {SubmitEvent} e
 */
export async function handleRegisterSubmit(e) {
    e.preventDefault();

    const errorBox = document.getElementById("reg-error-box");
    const submitBtn = document.getElementById("btn-submit-register");
    const planHiddenInput = document.getElementById("reg-plan-select");
    const paySelect = document.getElementById("reg-payment-select");

    errorBox?.classList.add("hidden");

    const firstName = (document.getElementById("reg-firstname")?.value || "").trim();
    const lastName = (document.getElementById("reg-lastname")?.value || "").trim();
    const nickname = (document.getElementById("reg-nickname")?.value || "").trim();
    const title = document.getElementById("reg-title")?.value || "Est.";
    const career = document.getElementById("reg-career")?.value || "medicina";
    const country = document.getElementById("reg-country")?.value || "Ecuador";
    const phoneExt = document.getElementById("reg-phone-ext")?.value || "+593";
    const phoneNumber = (document.getElementById("reg-phone-number")?.value || "").trim();
    const bday = String(document.getElementById("reg-bday")?.value || "01").padStart(2, "0");
    const bmonth = String(document.getElementById("reg-bmonth")?.value || "01").padStart(2, "0");
    const byear = document.getElementById("reg-byear")?.value || "2000";
    const email = (document.getElementById("reg-email")?.value || "").trim();
    const backupEmail = (document.getElementById("reg-backup-email")?.value || "").trim();
    const pass = document.getElementById("reg-password")?.value || "";
    const confirmPass = document.getElementById("reg-confirm-password")?.value || "";

    const chosenPlan = planHiddenInput?.value || "basico";
    const chosenPayment = paySelect?.value || "ninguno";

    // Verificar si es un usuario ya autenticado que entró a subir comprobante de upgrade
    const existingActiveUser =
        auth.currentUser && auth.currentUser.email?.toLowerCase() === email.toLowerCase()
            ? auth.currentUser
            : null;

    if (!existingActiveUser) {
        if (pass.length < 6) {
            showRegisterError("⚠️ La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        if (pass !== confirmPass) {
            showRegisterError("⚠️ Las contraseñas no coinciden. Verifícalas e intenta de nuevo.");
            return;
        }
    }

    if (email && backupEmail && email.toLowerCase() === backupEmail.toLowerCase()) {
        showRegisterError("⚠️ El correo de respaldo debe ser diferente a tu correo electrónico principal.");
        return;
    }

    const requiresReceipt =
        chosenPlan !== "basico" && (chosenPayment === "qr" || chosenPayment === "transferencia");
    const receiptFile = document.getElementById("pay-receipt-file")?.files?.[0];

    if (requiresReceipt && !receiptFile) {
        showRegisterError("⚠️ Debes adjuntar la imagen (JPG/PNG) o PDF de tu comprobante bancario.");
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "<span>Procesando expediente y comprobante...</span>";
        }

        // 1. Comprimir y codificar el comprobante en Base64 si aplica
        let receiptDataUrl = null;
        if (requiresReceipt && receiptFile) {
            receiptDataUrl = await processReceiptFile(receiptFile);
        }

        // 2. Crear cuenta en Firebase Authentication (o usar sesión activa en caso de upgrade)
        let targetUser = existingActiveUser;
        if (!targetUser) {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            targetUser = cred.user;
        }

        const nowIso = new Date().toISOString();
        const nowReadable = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });

        // 3. Construir objeto de evidencia bancaria
        const paymentVerificationDetails = requiresReceipt
            ? {
                  numeroComprobante: (document.getElementById("pay-receipt-number")?.value || "").trim(),
                  titularCuenta: (document.getElementById("pay-holder-name")?.value || "").trim(),
                  cedulaTitular: (document.getElementById("pay-holder-id")?.value || "").trim(),
                  bancoOrigen: (document.getElementById("pay-origin-bank")?.value || "").trim(),
                  montoDeclarado: (document.getElementById("pay-amount")?.value || "").trim(),
                  fechaComprobante: document.getElementById("pay-receipt-date")?.value || "",
                  archivoNombre: receiptFile.name,
                  archivoTipo: receiptFile.type,
                  comprobanteBase64: receiptDataUrl,
                  fechaHoraEnvioExacta: nowReadable
              }
            : null;

        const isUserAdmin = isRegisterAdminEmail(email);

        // 4. Construir expediente integral para la colección `usuarios`
        const profileData = {
            uid: targetUser.uid,
            primerNombre: firstName,
            apellido: lastName,
            nombre: `${title} ${firstName} ${lastName}`.trim(),
            nickname: nickname || firstName,
            titulo: title,
            carrera: career,
            pais: country,
            telefonoExtension: phoneExt,
            telefonoNumero: phoneNumber,
            telefonoCompleto: `${phoneExt} ${phoneNumber}`.trim(),
            email: email,
            emailRespaldo: backupEmail,
            cumpleanos: `${bday}/${bmonth}/${byear}`,
            rol: isUserAdmin ? "admin" : "estudiante",
            subscriptionLevel: isUserAdmin ? "PRO" : "Básico",
            planSolicitado: chosenPlan,
            metodoPagoPreferido: chosenPayment,
            estadoPago: isUserAdmin
                ? "activo_verificado"
                : chosenPlan === "basico"
                ? "activo_gratis"
                : "pendiente_verificacion",
            datosComprobante: paymentVerificationDetails,
            correoConfirmadoMakai: isUserAdmin || !!existingActiveUser?.emailVerified,
            casesUsedThisMonth: 0,
            totalExamsCompleted: 0,
            globalAverage: 0,
            createdAt: nowIso
        };

        // 5. Guardar en las colecciones `usuarios` y `solicitudes_pago` de Cloud Firestore
        try {
            await setDoc(doc(db, "usuarios", targetUser.uid), profileData, { merge: true });

            if (requiresReceipt && paymentVerificationDetails) {
                await addDoc(collection(db, "solicitudes_pago"), {
                    uid: targetUser.uid,
                    estudianteNombre: `${title} ${firstName} ${lastName}`.trim(),
                    estudianteEmail: email,
                    estudianteTelefono: `${phoneExt} ${phoneNumber}`.trim(),
                    planSolicitado: chosenPlan,
                    metodoPago: chosenPayment,
                    estado: "pendiente",
                    ...paymentVerificationDetails,
                    createdAt: nowIso
                });
            }
        } catch (fireErr) {
            console.warn("[AuthRegister] Aviso guardando en Firestore:", fireErr);
        }

        // Sincronizar con la memoria global state.store.js
        if (typeof StateStore.setSessionState === "function") {
            StateStore.setSessionState(targetUser, profileData);
        }

        // 6. Pase directo para cuentas maestras o usuarios ya verificados que subieron comprobante
        if (isUserAdmin || existingActiveUser?.emailVerified) {
            window.location.href = "dashboard.html";
            return;
        }

        // 7. Enviar enlace de verificación al correo y mostrar pantalla de confirmación
        try {
            await triggerVerificationEmail(targetUser);
        } catch (verifyErr) {
            console.warn("[AuthRegister] Aviso al enviar correo de verificación:", verifyErr);
        }

        await showVerificationPendingScreen(targetUser, chosenPlan, chosenPayment);
    } catch (err) {
        let friendlyMessage = `Error al registrar: ${err.message}`;
        if (err.code === "auth/email-already-in-use") {
            friendlyMessage =
                "⚠️ Este correo electrónico ya está registrado en Makai Academy. Inicia sesión desde el portal principal.";
        } else if (err.code === "auth/invalid-email") {
            friendlyMessage = "⚠️ El formato del correo electrónico no es válido.";
        } else if (err.code === "auth/weak-password") {
            friendlyMessage = "⚠️ La contraseña es demasiado débil. Usa al menos 6 caracteres.";
        }

        showRegisterError(friendlyMessage);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
                '<span class="material-symbols-outlined">how_to_reg</span><span>Registrar y Enviar Correo de Verificación</span>';
        }
    }
}

/**
 * Si el estudiante ya tiene sesión iniciada y abre `registro.html?plan=pro_anual&pago=qr`
 * para subir su comprobante, prellena sus datos registrados desde Firestore.
 */
async function prefillExistingUserIfAuthenticated() {
    const user = auth.currentUser;
    if (!user) return;

    const emailInput = document.getElementById("reg-email");
    if (emailInput && !emailInput.value) {
        emailInput.value = user.email || "";
    }

    try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (!snap.exists()) return;
        const data = snap.data();

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && !el.value) el.value = val;
        };

        setVal("reg-firstname", data.primerNombre);
        setVal("reg-lastname", data.apellido);
        setVal("reg-nickname", data.nickname);
        setVal("reg-title", data.titulo);
        setVal("reg-career", data.carrera);
        setVal("reg-country", data.pais);
        setVal("reg-phone-ext", data.telefonoExtension);
        setVal("reg-phone-number", data.telefonoNumero);
        setVal("reg-backup-email", data.emailRespaldo);
    } catch (_) {}
}

/**
 * Inicializador principal del módulo (`initAuthRegister` / `initRegisterUI`).
 * Invocado automáticamente por `js/2-core/app.orchestrator.js` en `registro.html`.
 */
export function initAuthRegister() {
    if (registerUIInitialized) return;

    const form = document.getElementById("full-register-form");
    const regCard = document.getElementById("registration-card");
    if (!form && !regCard) return;

    registerUIInitialized = true;

    // 1. Leer parámetros URL (?plan=..., ?billing=..., ?pago=..., ?verify=pending)
    const params = new URLSearchParams(window.location.search);
    const rawPlan = params.get("plan") || sessionStorage.getItem("makai_selected_plan") || "basico";
    const rawBilling = params.get("billing") || sessionStorage.getItem("makai_selected_billing") || "annual";
    const initialPago = params.get("pago") || "";
    const normalizedPlan = normalizePlanKeyFromUrl(rawPlan, rawBilling);

    // 2. Enlazar tarjetas interactivas de planes (.plan-card)
    const planCards = document.querySelectorAll(".plan-card");
    planCards.forEach((card) => {
        card.addEventListener("click", () => {
            if (card.dataset.planCard) {
                selectPlanCard(card.dataset.planCard);
            }
        });
    });

    // 3. Enlazar cambio en el selector de método de pago (#reg-payment-select)
    const paySelect = document.getElementById("reg-payment-select");
    paySelect?.addEventListener("change", updatePaymentSectionsUI);

    // 4. Seleccionar el plan inicial y método de pago detectado en la URL
    selectPlanCard(normalizedPlan, initialPago);

    // 5. Inicializar la fecha del comprobante con el día actual por defecto
    const dateInput = document.getElementById("pay-receipt-date");
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    // 6. Enlazar el envío del formulario de registro completo
    form?.addEventListener("submit", handleRegisterSubmit);

    // 7. Si hay un usuario autenticado subiendo comprobante, prellenar sus campos básicos
    prefillExistingUserIfAuthenticated();

    console.info("[AuthRegister] Controlador de registro y comprobantes inicializado.");
}

// Alias de compatibilidad total con app.orchestrator.js
export const initRegisterUI = initAuthRegister;
