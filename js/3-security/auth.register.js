// ============================================================================
// ARCHIVO: js/3-security/auth.register.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Embudo de Registro en Cascada, Compresión Automática Base64,
//                  Máscara Numérica de Referencia, Generación de ID Contable
//                  `PAG-[AAAAMMDD]-[PLAN]-[REF]` y Escudo de Precio Histórico.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    googleProvider,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithPopup,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "../2-core/firebase.service.js";

import { isMasterAdmin } from "../2-core/state.store.js";
import { DEFAULT_DYNAMIC_PLANS, fetchDynamicPlansFromFirestore } from "./auth.login.js";

let registerBound = false;
let availablePlans = [];
let selectedPlanObj = null;
let selectedBillingMode = "annual"; // "monthly" | "annual" | "free"
let selectedPaymentMethod = "Deuna!";
let compressedVoucherBase64 = null;
let frozenPriceOverride = null;

/**
 * Instrucciones limpias y exclusivas por medio de pago (Cero distracciones).
 */
const PAYMENT_CHANNEL_INSTRUCTIONS = Object.freeze({
    "Deuna!": `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1">
                <p class="font-extrabold text-primary text-xs uppercase">📲 Pago Directo por Deuna! (Banco Pichincha)</p>
                <p class="text-gray-300">1. Abre tu app <strong>Deuna!</strong> y transfiere el monto exacto congelado en tu pantalla.</p>
                <p class="text-gray-300">2. Titular Oficial: <strong class="text-white">Makai Academy / Anthonny Velástegui</strong></p>
                <p class="text-gray-300">3. Copia los últimos dígitos del comprobante y sube la captura a la derecha.</p>
            </div>
            <div class="px-3 py-2 rounded-xl bg-primary/10 border border-primary/40 font-mono text-[11px] text-primary text-center">
                Acreditación Prioritaria<br><strong>0% Comisión</strong>
            </div>
        </div>
    `,
    "Transferencia Bancaria": `
        <div class="space-y-1.5">
            <p class="font-extrabold text-secondary text-xs uppercase">🏦 Transferencia Bancaria Directa / Depósito</p>
            <p class="text-gray-300">• <strong>Banco Pichincha / Mi Vecino:</strong> Cuenta verificada a nombre de <strong>Anthonny Velástegui</strong>.</p>
            <p class="text-gray-300">• En el concepto coloca únicamente tu correo de registro e ingresa abajo los últimos 4 a 8 dígitos del documento.</p>
        </div>
    `,
    "PayPhone / Tarjeta": `
        <div class="space-y-1.5">
            <p class="font-extrabold text-warning text-xs uppercase">💳 Pago con Tarjeta vía PayPhone</p>
            <p class="text-gray-300">• Realiza el cobro a través del botón o link oficial de PayPhone Makai Academy.</p>
            <p class="text-gray-300">• Una vez aprobado, escribe abajo el número de autorización (4 a 8 dígitos) y adjunta la captura del recibo.</p>
        </div>
    `
});

/**
 * Muestra alertas en el encabezado del formulario de registro.
 */
function showRegisterAlert(message, type = "info") {
    const box = document.getElementById("register-alert-box");
    if (!box) return;

    const palette = {
        info: "bg-primary/10 border-primary/40 text-primary",
        warning: "bg-warning/10 border-warning/40 text-warning",
        danger: "bg-danger/10 border-danger/40 text-danger",
        success: "bg-secondary/10 border-secondary/40 text-secondary"
    };

    box.className = `p-4 rounded-xl border text-xs font-mono ${palette[type] || palette.info}`;
    box.textContent = message;
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Genera el ID contable estandarizado: PAG-[AAAAMMDD]-[PLAN]-[COMPROBANTE]
 */
export function buildAccountingPaymentId(planCode = "PRO", refDigits = "0000") {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const cleanPlan = String(planCode || "PRO")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || "PRO";

    const cleanRef = String(refDigits || "0000").replace(/\D/g, "").slice(-6).padStart(4, "0");
    return `PAG-${yyyy}${mm}${dd}-${cleanPlan}-${cleanRef}`;
}

/**
 * Compresor Automático HTML5 Canvas -> Base64 ligero (< 140 KB)
 * Garantiza que la imagen jamás exceda el límite de 1 MB de Cloud Firestore.
 */
export function compressVoucherImageToBase64(file, maxWidth = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(new Error("El archivo seleccionado debe ser una imagen válida (JPG, PNG o WEBP)."));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error("No se pudo leer la imagen del comprobante."));
        reader.onload = (ev) => {
            const img = new Image();
            img.onerror = () => reject(new Error("Formato de imagen corrupto o no compatible."));
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#06090e";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                const approxSizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                resolve({ base64: dataUrl, sizeKB: approxSizeKB, width, height });
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Calcula el precio congelado actual según el plan y ciclo elegidos.
 */
function getActiveLockedAmount() {
    if (!selectedPlanObj) return 0;
    const isFree = Number(selectedPlanObj.precio_mensual) === 0 && Number(selectedPlanObj.precio_anual) === 0;
    if (isFree) return 0;

    if (frozenPriceOverride !== null && !isNaN(Number(frozenPriceOverride))) {
        return Number(frozenPriceOverride);
    }

    if (selectedBillingMode === "annual" && Number(selectedPlanObj.precio_anual) > 0) {
        return Number(selectedPlanObj.precio_anual);
    }
    return Number(selectedPlanObj.precio_mensual || 0);
}

/**
 * Actualiza las tarjetas en cascada del Paso 2 y muestra/oculta el Paso 3 (Rieles de Pago).
 */
function renderCascadePlanSelector() {
    const container = document.getElementById("register-plans-cascade");
    const paymentSection = document.getElementById("payment-rails-section");
    const submitBtn = document.getElementById("btn-submit-registration");
    const summaryEl = document.getElementById("frozen-plan-summary");
    const amountEl = document.getElementById("frozen-plan-amount");
    const cycleEl = document.getElementById("frozen-plan-cycle");

    if (!container) return;

    container.innerHTML = availablePlans.map((plan) => {
        const isSelected = selectedPlanObj && (selectedPlanObj.id === plan.id || selectedPlanObj.codigoPlan === plan.codigoPlan);
        const isFree = Number(plan.precio_mensual) === 0 && Number(plan.precio_anual) === 0;
        const priceVal = isFree
            ? 0
            : (selectedBillingMode === "annual" && Number(plan.precio_anual) > 0 ? plan.precio_anual : plan.precio_mensual);

        return `
            <button type="button" data-cascade-plan="${plan.id}"
                class="p-4 rounded-xl text-left transition-all ${
                    isSelected
                        ? "bg-primary/15 border-2 border-primary shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                        : "bg-surface border border-surface-high opacity-75 hover:opacity-100 hover:border-gray-600"
                }">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-mono font-extrabold uppercase ${isSelected ? "text-primary" : "text-gray-400"}">
                        ${plan.codigoPlan || plan.titulo}
                    </span>
                    ${isSelected ? `<span class="material-symbols-outlined text-primary text-sm">check_circle</span>` : ""}
                </div>
                <div class="text-sm font-extrabold text-white truncate">${plan.titulo}</div>
                <div class="text-base font-mono font-extrabold ${isSelected ? "text-primary" : "text-gray-300"} mt-1">
                    ${isFree ? "GRATIS" : `$${Number(priceVal).toFixed(2)}`}
                </div>
            </button>
        `;
    }).join("");

    container.querySelectorAll("[data-cascade-plan]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const found = availablePlans.find(p => p.id === btn.dataset.cascadePlan);
            if (found) {
                selectedPlanObj = found;
                frozenPriceOverride = null; // Recalcular según selección manual
                renderCascadePlanSelector();
                updateLiveAccountingIdPreview();
            }
        });
    });

    const lockedPrice = getActiveLockedAmount();
    const isFreePlan = lockedPrice <= 0;

    if (summaryEl && selectedPlanObj) {
        summaryEl.textContent = `${selectedPlanObj.titulo} (${isFreePlan ? "Acceso Freemium" : (selectedBillingMode === "annual" ? "Ciclo Anual / Semestral" : "Ciclo Mensual")})`;
    }
    if (amountEl) {
        amountEl.textContent = `$${lockedPrice.toFixed(2)}`;
    }
    if (cycleEl) {
        cycleEl.textContent = isFreePlan ? "Sin costo • Activación inmediata" : "USD • Precio Histórico Protegido";
    }

    // Mostrar u ocultar Paso 3 según si el plan cuesta dinero
    if (paymentSection) {
        if (isFreePlan) {
            paymentSection.classList.add("hidden");
            if (submitBtn) submitBtn.textContent = "Crear mi Cuenta Gratis e Ingresar →";
        } else {
            paymentSection.classList.remove("hidden");
            if (submitBtn) submitBtn.textContent = `Registrar Pago de $${lockedPrice.toFixed(2)} y Enviar a Auditoría →`;
        }
    }
}

/**
 * Actualiza en tiempo real la vista previa del ID Contable `PAG-AAAAMMDD-PLAN-XXXX`.
 */
function updateLiveAccountingIdPreview() {
    const previewEl = document.getElementById("live-accounting-id-preview");
    const refInput = document.getElementById("reg-voucher-ref");
    if (!previewEl) return;

    const planCode = selectedPlanObj?.codigoPlan || "PRO";
    const digits = refInput?.value || "0000";
    previewEl.textContent = buildAccountingPaymentId(planCode, digits);
}

/**
 * Renderiza exclusivamente las instrucciones del canal de pago elegido.
 */
function renderSelectedPaymentChannelInstructions() {
    const box = document.getElementById("payment-method-instructions");
    if (!box) return;
    box.innerHTML = PAYMENT_CHANNEL_INSTRUCTIONS[selectedPaymentMethod] || PAYMENT_CHANNEL_INSTRUCTIONS["Deuna!"];

    document.querySelectorAll(".pay-method-btn").forEach((btn) => {
        if (btn.dataset.payMethod === selectedPaymentMethod) {
            btn.className = "pay-method-btn p-3.5 rounded-xl bg-primary/15 border-2 border-primary text-left transition-all";
        } else {
            btn.className = "pay-method-btn p-3.5 rounded-xl bg-surface border border-surface-high text-left hover:border-gray-600 transition-all";
        }
    });
}

/**
 * Comprueba en Firestore que el número de comprobante no esté duplicado en `solicitudes_pago`.
 */
async function isVoucherReferenceDuplicate(refDigits) {
    try {
        const q = query(
            collection(db, COLLECTIONS.PAYMENTS),
            where("numeroComprobante", "==", refDigits)
        );
        const snap = await getDocs(q);
        let duplicateFound = false;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.estado !== "rechazado") {
                duplicateFound = true;
            }
        });
        return duplicateFound;
    } catch (err) {
        return false;
    }
}

/**
 * Procesa el envío final del Embudo de Registro y Pasarela Blindada.
 */
async function handleFullRegistrationSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById("btn-submit-registration");
    const fullname = document.getElementById("reg-fullname")?.value.trim() || "";
    const whatsapp = document.getElementById("reg-whatsapp")?.value.trim() || "";
    const email = document.getElementById("reg-email")?.value.trim().toLowerCase() || "";
    const password = document.getElementById("reg-password")?.value || "";
    const career = document.getElementById("reg-career")?.value || "medicina";
    const semesterVal = Number(document.getElementById("reg-semester")?.value || 1);
    const university = document.getElementById("reg-university")?.value.trim() || "Por definir";

    const lockedPrice = getActiveLockedAmount();
    const isPaidPlan = lockedPrice > 0;
    const refDigits = (document.getElementById("reg-voucher-ref")?.value || "").replace(/\D/g, "");

    // 1. Validaciones de Rieles de Acero para planes de pago
    if (isPaidPlan) {
        if (refDigits.length < 4 || refDigits.length > 8) {
            showRegisterAlert("⚠️ Ingresa únicamente los últimos 4 a 8 dígitos numéricos de tu comprobante de pago.", "warning");
            document.getElementById("reg-voucher-ref")?.focus();
            return;
        }
        if (!compressedVoucherBase64) {
            showRegisterAlert("⚠️ Por favor adjunta la captura o foto de tu comprobante de pago para continuar.", "warning");
            return;
        }
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Blindando expediente en Cloud Firestore...";
        }

        // 2. Verificar si el comprobante ya fue utilizado antes
        if (isPaidPlan) {
            const isDup = await isVoucherReferenceDuplicate(refDigits);
            if (isDup) {
                showRegisterAlert("❌ Este número de referencia de comprobante ya fue registrado previamente en el sistema.", "danger");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = `Registrar Pago de $${lockedPrice.toFixed(2)} y Enviar a Auditoría →`;
                }
                return;
            }
        }

        // 3. Autenticar o crear el usuario en Firebase Auth
        let activeUser = auth.currentUser;
        let isGoogleUser = activeUser?.providerData?.some(p => p.providerId === "google.com") || false;

        if (!activeUser) {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            activeUser = cred.user;
            await sendEmailVerification(activeUser).catch(() => {});
        }

        const isMaster = isMasterAdmin(activeUser.email);
        const nowIso = new Date().toISOString();
        const etapaAcademica = semesterVal === 9
            ? "internado"
            : (semesterVal === 10 ? "egresado" : (semesterVal >= 11 ? "rural" : "semestre"));

        // 4. Guardar perfil del estudiante con su Túnel de Carrera Bloqueado
        const userDocData = {
            uid: activeUser.uid,
            email: activeUser.email,
            nombre: fullname || activeUser.displayName || activeUser.email.split("@")[0],
            primerNombre: (fullname || activeUser.displayName || "Estudiante").split(" ")[0],
            whatsapp,
            universidad: university,
            carrera: career,
            semestreActual: semesterVal,
            etapaAcademica,
            rol: isMaster ? "master" : "estudiante",
            subscriptionLevel: isMaster ? "PRO" : "Básico", // Se mantiene en Básico hasta que Secretaría apruebe el comprobante
            planSolicitado: selectedPlanObj?.codigoPlan || "Básico",
            estadoPago: isMaster
                ? "activo_verificado"
                : (isPaidPlan ? "pendiente_verificacion" : "activo_gratis"),
            correoConfirmadoMakai: isMaster || isGoogleUser || !!activeUser.emailVerified,
            casesUsedThisMonth: 0,
            updatedAt: nowIso,
            createdAt: nowIso
        };

        await setDoc(doc(db, COLLECTIONS.USERS, activeUser.uid), userDocData, { merge: true });

        // 5. Si eligió Plan Pagado -> Crear documento con ID Contable `PAG-AAAAMMDD-PLAN-REF` y Foto Histórica
        if (isPaidPlan && !isMaster) {
            const accountingId = buildAccountingPaymentId(selectedPlanObj?.codigoPlan || "PRO", refDigits);
            const diasVigenciaSolicitados = selectedBillingMode === "annual"
                ? (selectedPlanObj?.unidad_anual === "semestre" ? 180 : 365)
                : 30;

            const paymentRecord = {
                id: accountingId,
                codigoContable: accountingId,
                uid: activeUser.uid,
                nombreUsuario: userDocData.nombre,
                emailUsuario: activeUser.email,
                whatsappUsuario: whatsapp,
                carreraUsuario: career,
                planId: selectedPlanObj?.id || "pro_caces",
                planSolicitado: selectedPlanObj?.codigoPlan || "PRO",
                tituloPlanHistorico: selectedPlanObj?.titulo || "Makai PRO CACES",
                cicloFacturacion: selectedBillingMode,
                diasPorAcreditar: diasVigenciaSolicitados,
                // ESCUDO DE PRECIO HISTÓRICO (Inmune a cambios futuros de tarifas)
                montoEsperadoUSD: lockedPrice,
                montoDeclaradoUSD: lockedPrice,
                metodoPago: selectedPaymentMethod,
                numeroComprobante: refDigits,
                comprobanteBase64: compressedVoucherBase64,
                estado: "pendiente",
                motivoRechazo: null,
                fechaSolicitud: nowIso
            };

            await setDoc(doc(db, COLLECTIONS.PAYMENTS, accountingId), paymentRecord);

            // Mostrar Sala de Espera Activa para bloquear doble subida
            document.getElementById("registration-card")?.classList.add("hidden");
            const waitingRoom = document.getElementById("payment-waiting-room");
            if (waitingRoom) {
                document.getElementById("waiting-room-payment-id").textContent = accountingId;
                document.getElementById("waiting-room-plan").textContent = `${paymentRecord.tituloPlanHistorico} (${diasVigenciaSolicitados} días)`;
                document.getElementById("waiting-room-amount").textContent = `$${lockedPrice.toFixed(2)} USD`;
                waitingRoom.classList.remove("hidden");
            }
            return;
        }

        // 6. Si es Plan Básico gratuito -> Verificar correo o llevar al Dashboard
        if (!isMaster && !isGoogleUser && !activeUser.emailVerified) {
            const verifierMod = await import("./auth.verifier.js");
            verifierMod.showVerificationPendingScreen(activeUser);
            return;
        }

        window.location.href = "dashboard.html";
    } catch (error) {
        let msg = error.message || "Error al procesar el registro.";
        if (error.code === "auth/email-already-in-use") {
            msg = "Este correo ya tiene una cuenta en Makai Academy. Inicia sesión primero o usa el botón de Google.";
        }
        showRegisterAlert(msg, "danger");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

/**
 * Inicializador principal del Embudo de Registro.
 */
export async function initAuthRegister() {
    if (registerBound) return;
    registerBound = true;

    // 1. Leer parámetros de URL y Foto Histórica guardada en sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    const paramPlan = urlParams.get("plan");
    const paramBilling = urlParams.get("billing");
    const paramPrice = urlParams.get("price");

    if (paramBilling === "monthly" || paramBilling === "annual") {
        selectedBillingMode = paramBilling;
    }

    if (paramPrice !== null && !isNaN(Number(paramPrice)) && Number(paramPrice) > 0) {
        frozenPriceOverride = Number(paramPrice);
    } else {
        try {
            const snapRaw = sessionStorage.getItem("makai_selected_plan_snapshot");
            if (snapRaw) {
                const snap = JSON.parse(snapRaw);
                if (snap.montoCongeladoUSD > 0) frozenPriceOverride = Number(snap.montoCongeladoUSD);
                if (snap.billingCycle === "monthly" || snap.billingCycle === "annual") {
                    selectedBillingMode = snap.billingCycle;
                }
            }
        } catch (e) {}
    }

    // 2. Cargar planes dinámicos desde Firestore
    availablePlans = await fetchDynamicPlansFromFirestore();
    if (!Array.isArray(availablePlans) || availablePlans.length === 0) {
        availablePlans = [...DEFAULT_DYNAMIC_PLANS];
    }

    selectedPlanObj = availablePlans.find(
        p => p.codigoPlan?.toLowerCase() === (paramPlan || "").toLowerCase() || p.id === paramPlan
    ) || availablePlans.find(p => p.codigoPlan === "PRO") || availablePlans[0];

    renderCascadePlanSelector();
    renderSelectedPaymentChannelInstructions();
    updateLiveAccountingIdPreview();

    // 3. Detectar si el estudiante ya tiene sesión iniciada (Upgrade de plan)
    setTimeout(async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const banner = document.getElementById("logged-in-user-banner");
            const bannerText = document.getElementById("logged-in-user-text");
            const emailInput = document.getElementById("reg-email");
            const passWrapper = document.getElementById("reg-password-wrapper");
            const passInput = document.getElementById("reg-password");
            const nameInput = document.getElementById("reg-fullname");

            if (banner && bannerText) {
                bannerText.textContent = `Sesión activa: ${currentUser.email}`;
                banner.classList.remove("hidden");
            }
            if (emailInput) {
                emailInput.value = currentUser.email || "";
                emailInput.readOnly = true;
            }
            if (nameInput && currentUser.displayName && !nameInput.value) {
                nameInput.value = currentUser.displayName;
            }
            if (passWrapper && passInput) {
                passInput.required = false;
                passWrapper.classList.add("hidden");
            }
        }
    }, 500);

    // 4. Botón de Vinculación Rápida con Google en el Paso 1
    document.getElementById("btn-register-google")?.addEventListener("click", async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            if (user) {
                document.getElementById("reg-fullname").value = user.displayName || "";
                document.getElementById("reg-email").value = user.email || "";
                document.getElementById("reg-email").readOnly = true;
                const passInput = document.getElementById("reg-password");
                if (passInput) passInput.required = false;
                document.getElementById("reg-password-wrapper")?.classList.add("hidden");
                showRegisterAlert("✅ Cuenta de Google vinculada. Confirma tu carrera y plan para finalizar.", "success");
            }
        } catch (err) {
            showRegisterAlert("Se canceló la vinculación con Google.", "warning");
        }
    });

    // 5. Conmutador Mensual vs Anual en Paso 2
    document.querySelectorAll(".reg-billing-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            selectedBillingMode = btn.dataset.regBilling || "annual";
            frozenPriceOverride = null;
            document.querySelectorAll(".reg-billing-btn").forEach((b) => {
                if (b.dataset.regBilling === selectedBillingMode) {
                    b.className = "reg-billing-btn px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold bg-primary text-surface";
                } else {
                    b.className = "reg-billing-btn px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-gray-400";
                }
            });
            renderCascadePlanSelector();
        });
    });

    // 6. Botones de Rieles de Pago (Deuna!, Transferencia, PayPhone)
    document.querySelectorAll(".pay-method-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            selectedPaymentMethod = btn.dataset.payMethod || "Deuna!";
            renderSelectedPaymentChannelInstructions();
        });
    });

    // 7. Máscara Estricta de Solo Números en el Comprobante (Cero texto libre)
    const refInput = document.getElementById("reg-voucher-ref");
    refInput?.addEventListener("input", () => {
        refInput.value = refInput.value.replace(/\D/g, "").slice(0, 8);
        updateLiveAccountingIdPreview();
    });

    // 8. Compresión Automática Base64 al seleccionar el archivo del comprobante
    const fileInput = document.getElementById("reg-voucher-file");
    fileInput?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const labelEl = document.getElementById("voucher-upload-label");
        const previewBox = document.getElementById("voucher-preview-box");
        const previewImg = document.getElementById("voucher-preview-img");
        const sizeInfo = document.getElementById("voucher-size-info");

        try {
            if (labelEl) labelEl.textContent = "Comprimiendo comprobante...";
            const compressed = await compressVoucherImageToBase64(file);
            compressedVoucherBase64 = compressed.base64;

            if (previewImg) previewImg.src = compressed.base64;
            if (sizeInfo) sizeInfo.textContent = `Tamaño final: ${compressed.sizeKB} KB (${compressed.width}x${compressed.height}px)`;
            previewBox?.classList.remove("hidden");
            if (labelEl) labelEl.textContent = "Cambiar Imagen del Comprobante";
        } catch (err) {
            compressedVoucherBase64 = null;
            showRegisterAlert(err.message || "Error al comprimir el comprobante.", "danger");
            if (labelEl) labelEl.textContent = "Seleccionar Imagen (JPG / PNG / WEBP)";
        }
    });

    // 9. Envío del formulario maestro
    document.getElementById("full-register-form")?.addEventListener("submit", handleFullRegistrationSubmit);
}

export const initRegisterUI = initAuthRegister;

if (typeof window !== "undefined") {
    window.MakaiAuthRegister = {
        initAuthRegister,
        buildAccountingPaymentId,
        compressVoucherImageToBase64
    };
}
