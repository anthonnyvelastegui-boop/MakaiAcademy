// ============================================================================
// ARCHIVO: js/3-security/auth.login.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Autenticación en index.html, Motor de Precios Dinámico
//                  (renderPricingCards desde Firestore) y Postulación Docente.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    googleProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    collection,
    getDocs,
    addDoc
} from "../2-core/firebase.service.js";

import { isMasterAdmin } from "../2-core/state.store.js";

let currentBillingCycle = "annual"; // "monthly" | "annual"
let cachedPlans = [];
let loginUIBound = false;

/**
 * CATÁLOGO SEMILLA DE RESPALDO ("Diversificación de Bolsillos")
 * Se utiliza automáticamente si la colección `planes_suscripcion` en Firestore
 * aún no tiene documentos creados por el Administrador Maestro o si falla la red.
 */
export const DEFAULT_DYNAMIC_PLANS = Object.freeze([
    {
        id: "basico",
        codigoPlan: "Básico",
        titulo: "Plan Básico Freemium",
        subtitulo: "Exploración inicial del ecosistema",
        precio_mensual: 0,
        precio_anual: 0,
        unidad_anual: "siempre gratis",
        etiqueta_badge: "ACCESO INICIAL",
        color_acento: "gray",
        destacado: false,
        activo: true,
        orden: 1,
        beneficios: [
            "15 casos clínicos de práctica al mes",
            "Acceso al primer nivel de tu carrera",
            "Vista previa de tarjetas Sináptico v4.4",
            "1 PC + 1 Dispositivo Móvil protegido"
        ]
    },
    {
        id: "sobrevivencia_universitaria",
        codigoPlan: "Sobrevivencia",
        titulo: "Sobrevivencia Universitaria",
        subtitulo: "Ideal de 1° a 8° Semestre y Preuniversitario",
        precio_mensual: 9.99,
        precio_anual: 49.99,
        unidad_anual: "semestre",
        etiqueta_badge: "ESTUDIANTES 1° A 8° SEM",
        color_acento: "secondary",
        destacado: false,
        activo: true,
        orden: 2,
        beneficios: [
            "Desbloqueo total de los semestres de TU carrera",
            "Motor de Repetición Espaciada Sináptico v4.4 ilimitado",
            "Biblioteca 1D: Guías GPC-MSP, PDFs y resúmenes",
            "Exámenes parciales por materia en Modo Tutor"
        ]
    },
    {
        id: "pro_caces",
        codigoPlan: "PRO",
        titulo: "Makai PRO CACES",
        subtitulo: "Internado Rotativo, Egresados y Salud Rural",
        precio_mensual: 18.60,
        precio_anual: 144.75,
        unidad_anual: "año",
        etiqueta_badge: "MÁS ELEGIDO • AHORRA 35%",
        color_acento: "primary",
        destacado: true,
        activo: true,
        orden: 3,
        beneficios: [
            "Bancos de reactivos CACES 100% ilimitados",
            "Modo Estándar Oficial (100 preguntas / 150 min)",
            "Simuladores Clínicos Interactivos 1D, 2D y 3D UCI",
            "Bootcamp de Examen Complexivo y Año de Salud Rural"
        ]
    },
    {
        id: "matchmaker_vip",
        codigoPlan: "VIP",
        titulo: "Vinculación Tutor VIP / Tesis",
        subtitulo: "Conexión directa 1 a 1 con Especialistas",
        precio_mensual: 10.00,
        precio_anual: 10.00,
        unidad_anual: "vinculación",
        etiqueta_badge: "MARKETPLACE 1 A 1",
        color_acento: "warning",
        destacado: false,
        activo: true,
        orden: 4,
        beneficios: [
            "Tasa única de vinculación garantizada por Makai",
            "Desbloqueo de WhatsApp y agenda del Especialista",
            "Tutores con registro SENESCYT auditado",
            "Negociación libre de honorarios sin intermediarios"
        ]
    }
]);

/**
 * Resuelve el logotipo oficial sin romper la vista si cambia el nombre del archivo.
 */
function resolveBrandLogo() {
    const imgEl = document.getElementById("brand-logo-img");
    const fallbackEl = document.getElementById("brand-logo-fallback");
    if (!imgEl) return;

    const candidates = [
        "assets/1-branding/logos/logo.png",
        "assets/1-branding/logos/Logo.png",
        "assets/1-branding/logos/Fondo MAKAI Academy 2.png",
        "logo.png"
    ];

    let idx = 0;
    const tryNext = () => {
        if (idx >= candidates.length) return;
        const testImg = new Image();
        const currentSrc = candidates[idx++];
        testImg.onload = () => {
            imgEl.src = currentSrc;
            imgEl.classList.remove("hidden");
            fallbackEl?.classList.add("hidden");
        };
        testImg.onerror = tryNext;
        testImg.src = currentSrc;
    };
    tryNext();
}

/**
 * Muestra alertas limpias dentro del cajón de login.
 */
function showAuthAlert(message, type = "info") {
    const box = document.getElementById("auth-alert-box");
    if (!box) return;

    const styles = {
        info: "bg-primary/10 border-primary/40 text-primary",
        error: "bg-danger/10 border-danger/40 text-danger",
        success: "bg-secondary/10 border-secondary/40 text-secondary",
        warning: "bg-warning/10 border-warning/40 text-warning"
    };

    box.className = `mb-5 p-3.5 rounded-xl border text-xs font-mono ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove("hidden");
}

/**
 * Descarga los planes desde Firestore (`planes_suscripcion`).
 * Si no existen aún o falla el internet, utiliza `DEFAULT_DYNAMIC_PLANS`.
 */
export async function fetchDynamicPlansFromFirestore() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.SUBSCRIPTIONS));
        const remotePlans = [];
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.activo !== false) {
                remotePlans.push({ id: docSnap.id, ...data });
            }
        });

        if (remotePlans.length > 0) {
            remotePlans.sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));
            cachedPlans = remotePlans;
            localStorage.setItem("makai_cached_plans_v1", JSON.stringify(remotePlans));
            return remotePlans;
        }
    } catch (err) {
        console.warn("[DynamicPricing] Usando catálogo en caché/semilla por red:", err.message);
    }

    try {
        const saved = localStorage.getItem("makai_cached_plans_v1");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedPlans = parsed;
                return parsed;
            }
        }
    } catch (e) {}

    cachedPlans = [...DEFAULT_DYNAMIC_PLANS];
    return cachedPlans;
}

/**
 * MOTOR DE RENDERIZADO DE TARJETAS DE PRECIOS EN EL CLIENTE
 * Construye el HTML dinámicamente sin tocar index.html.
 */
export async function renderPricingCards(forceRefresh = false) {
    const mount = document.getElementById("pricing-cards-mount");
    if (!mount) return;

    const plans = (cachedPlans.length > 0 && !forceRefresh)
        ? cachedPlans
        : await fetchDynamicPlansFromFirestore();

    const accentPalette = {
        primary: {
            border: "border-2 border-primary shadow-[0_0_25px_rgba(0,229,255,0.12)]",
            badge: "bg-primary text-surface",
            price: "text-primary",
            btn: "bg-primary text-surface hover:bg-opacity-90"
        },
        secondary: {
            border: "border border-secondary/50 hover:border-secondary",
            badge: "bg-secondary/20 text-secondary border border-secondary/40",
            price: "text-secondary",
            btn: "bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface"
        },
        warning: {
            border: "border border-warning/50 hover:border-warning",
            badge: "bg-warning/20 text-warning border border-warning/40",
            price: "text-warning",
            btn: "bg-surface border border-warning text-warning hover:bg-warning hover:text-surface"
        },
        gray: {
            border: "border border-surface-high hover:border-gray-600",
            badge: "bg-surface-high text-gray-300",
            price: "text-white",
            btn: "bg-surface border border-surface-high text-gray-200 hover:border-primary hover:text-primary"
        }
    };

    mount.innerHTML = plans.map((plan) => {
        const palette = accentPalette[plan.color_acento] || accentPalette.primary;
        const isFree = Number(plan.precio_mensual) === 0 && Number(plan.precio_anual) === 0;
        const useAnnual = currentBillingCycle === "annual" && Number(plan.precio_anual) > 0;

        const displayedPrice = isFree
            ? "$0"
            : `$${Number(useAnnual ? plan.precio_anual : plan.precio_mensual).toFixed(2)}`;

        const displayedUnit = isFree
            ? "/gratis"
            : (useAnnual ? `/${plan.unidad_anual || "año"}` : "/mes");

        const secondaryPriceNote = (!isFree && Number(plan.precio_anual) > 0 && Number(plan.precio_mensual) !== Number(plan.precio_anual))
            ? (useAnnual
                ? `Facturación mensual disponible a $${Number(plan.precio_mensual).toFixed(2)}/mes`
                : `O ahorra pagando $${Number(plan.precio_anual).toFixed(2)}/${plan.unidad_anual || "año"}`)
            : "Tarifa controlada por Rieles Makai";

        const benefitsList = Array.isArray(plan.beneficios) ? plan.beneficios : [];

        return `
            <article class="bg-surface-container ${palette.border} rounded-2xl p-6 flex flex-col justify-between relative transition-all">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${palette.badge}">
                            ${plan.etiqueta_badge || "PLAN OFICIAL"}
                        </span>
                        <span class="text-[10px] font-mono text-gray-500">ID: ${plan.id}</span>
                    </div>

                    <h3 class="text-lg font-extrabold text-white">${plan.titulo}</h3>
                    <p class="text-xs text-gray-400 mt-0.5 mb-4">${plan.subtitulo || ""}</p>

                    <div class="bg-surface rounded-xl p-3.5 border border-surface-high mb-5">
                        <div class="flex items-baseline gap-1">
                            <span class="text-2xl sm:text-3xl font-extrabold font-mono ${palette.price}">${displayedPrice}</span>
                            <span class="text-xs font-mono text-gray-400">${displayedUnit}</span>
                        </div>
                        <p class="text-[11px] font-mono text-gray-500 mt-1">${secondaryPriceNote}</p>
                    </div>

                    <ul class="space-y-2.5 text-xs text-gray-300 mb-6">
                        ${benefitsList.map(item => `
                            <li class="flex items-start gap-2">
                                <span class="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                                <span>${item}</span>
                            </li>
                        `).join("")}
                    </ul>
                </div>

                <button type="button"
                    data-select-plan-id="${plan.id}"
                    class="w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all ${palette.btn}">
                    ${isFree ? "Comenzar Gratis →" : `Elegir ${plan.titulo} →`}
                </button>
            </article>
        `;
    }).join("");

    // Enlazar clic de cada tarjeta para guardar la FOTO HISTÓRICA del precio
    mount.querySelectorAll("[data-select-plan-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const planId = btn.dataset.selectPlanId;
            const chosen = plans.find(p => p.id === planId) || plans[0];
            handlePlanSelectionRedirect(chosen);
        });
    });
}

/**
 * Guarda la foto histórica (Snapshot) del plan elegido y redirige al embudo `registro.html`.
 */
function handlePlanSelectionRedirect(planObj) {
    const isFree = Number(planObj.precio_mensual) === 0 && Number(planObj.precio_anual) === 0;
    const billingMode = isFree ? "free" : currentBillingCycle;
    const lockedAmount = isFree
        ? 0
        : Number(billingMode === "annual" && planObj.precio_anual > 0 ? planObj.precio_anual : planObj.precio_mensual);

    const snapshot = {
        id: planObj.id,
        codigoPlan: planObj.codigoPlan || planObj.titulo,
        titulo: planObj.titulo,
        billingCycle: billingMode,
        montoCongeladoUSD: lockedAmount,
        unidad: billingMode === "annual" ? (planObj.unidad_anual || "año") : "mes",
        capturedAt: new Date().toISOString()
    };

    sessionStorage.setItem("makai_selected_plan", snapshot.codigoPlan);
    sessionStorage.setItem("makai_selected_billing", billingMode);
    sessionStorage.setItem("makai_selected_plan_snapshot", JSON.stringify(snapshot));

    window.location.href = `registro.html?plan=${encodeURIComponent(snapshot.codigoPlan)}&billing=${encodeURIComponent(billingMode)}&price=${encodeURIComponent(lockedAmount)}`;
}

/**
 * Gestiona el envío del formulario de Postulación de Especialistas a Firestore (`perfiles_docentes`).
 */
async function handleTutorApplicationSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById("btn-submit-tutor-app");
    const feedback = document.getElementById("tutor-form-feedback");

    const nombre = document.getElementById("tutor-name")?.value.trim() || "";
    const senescyt = document.getElementById("tutor-senescyt")?.value.trim() || "";
    const especialidad = document.getElementById("tutor-specialty")?.value.trim() || "";
    const modalidad = document.getElementById("tutor-modality")?.value || "mentorias_y_tesis";
    const tarifaReferencial = document.getElementById("tutor-rate")?.value.trim() || "";
    const whatsapp = document.getElementById("tutor-whatsapp")?.value.trim() || "";
    const email = document.getElementById("tutor-email")?.value.trim() || "";
    const cvUrl = document.getElementById("tutor-cv-link")?.value.trim() || "";
    const bio = document.getElementById("tutor-bio")?.value.trim() || "";

    if (senescyt.length < 6) {
        if (feedback) {
            feedback.className = "p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger";
            feedback.textContent = "Por favor ingresa un número de registro SENESCYT válido para auditoría.";
            feedback.classList.remove("hidden");
        }
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Enviando a Bóveda Admin...";
        }

        await addDoc(collection(db, COLLECTIONS.TUTORS), {
            nombre,
            registroSenescyt: senescyt,
            especialidad,
            modalidad,
            tarifaReferencial,
            whatsapp,
            email,
            cvUrl,
            biografia: bio,
            tasaVinculacionMakaiUSD: 10,
            verificadoSenescyt: false,
            estado: "pendiente_revision", // Entra en cuarentena hasta que el Master Admin lo apruebe
            createdAt: new Date().toISOString()
        });

        if (feedback) {
            feedback.className = "p-3 rounded-xl text-xs font-mono bg-secondary/15 border border-secondary text-secondary";
            feedback.textContent = "✅ Postulación recibida en la Bóveda Maestra. Tras verificar tu SENESCYT te contactaremos por WhatsApp.";
            feedback.classList.remove("hidden");
        }

        document.getElementById("tutor-application-form")?.reset();
    } catch (error) {
        if (feedback) {
            feedback.className = "p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger";
            feedback.textContent = `Error al registrar postulación: ${error.message}`;
            feedback.classList.remove("hidden");
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Enviar Expediente a Auditoría →";
        }
    }
}

/**
 * Inicializador principal invocado automáticamente por `app.orchestrator.js`.
 */
export async function initAuthLogin() {
    if (loginUIBound) return;
    loginUIBound = true;

    resolveBrandLogo();

    // Mostrar aviso si fue desconectado por límite de dispositivos
    const signoutNotice = sessionStorage.getItem("makai_signout_notice");
    if (signoutNotice) {
        sessionStorage.removeItem("makai_signout_notice");
        showAuthAlert(signoutNotice, "warning");
    }

    // 1. Renderizar tarjetas de precios desde Firestore
    await renderPricingCards();

    // 2. Conmutador Mensual vs Anual/Semestral
    document.querySelectorAll(".billing-toggle-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            currentBillingCycle = btn.dataset.billingToggle || "annual";
            document.querySelectorAll(".billing-toggle-btn").forEach((b) => {
                if (b.dataset.billingToggle === currentBillingCycle) {
                    b.className = "billing-toggle-btn px-3.5 py-2 rounded-lg text-xs font-mono font-extrabold bg-primary text-surface transition-all";
                } else {
                    b.className = "billing-toggle-btn px-3.5 py-2 rounded-lg text-xs font-mono font-bold text-gray-400 transition-all";
                }
            });
            renderPricingCards(false);
        });
    });

    // 3. Login con Correo y Contraseña
    const authForm = document.getElementById("auth-form");
    authForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email")?.value.trim() || "";
        const pass = document.getElementById("auth-password")?.value || "";
        const btn = document.getElementById("btn-submit-login");

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Verificando credenciales...";
            }
            await signInWithEmailAndPassword(auth, email, pass);
            showAuthAlert("Acceso verificado. Entrando a tu estación...", "success");
        } catch (err) {
            showAuthAlert("Credenciales inválidas o cuenta no registrada.", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Ingresar a mi Estación →";
            }
        }
    });

    // 4. Login con Google OAuth
    const googleBtn = document.getElementById("btn-google-login");
    googleBtn?.addEventListener("click", async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            showAuthAlert("Cuenta de Google autenticada. Redirigiendo...", "success");
        } catch (err) {
            showAuthAlert("Se canceló el inicio con Google o hubo un bloqueo de ventana emergente.", "warning");
        }
    });

    // 5. Recuperación de contraseña con un clic
    const forgotBtn = document.getElementById("btn-forgot-password");
    forgotBtn?.addEventListener("click", async () => {
        const email = document.getElementById("auth-email")?.value.trim() || "";
        if (!email) {
            showAuthAlert("Escribe primero tu correo en la casilla superior para enviarte el enlace de recuperación.", "warning");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            showAuthAlert(`Enlace de restablecimiento enviado a ${email}. Revisa tu bandeja o Spam.`, "success");
        } catch (err) {
            showAuthAlert("No pudimos enviar el correo de recuperación. Verifica que esté bien escrito.", "error");
        }
    });

    // 6. Modal de Postulación Docente VIP
    const tutorModal = document.getElementById("tutor-application-modal");
    const openTutorModal = () => {
        tutorModal?.classList.remove("hidden");
        tutorModal?.classList.add("flex");
    };
    const closeTutorModal = () => {
        tutorModal?.classList.add("hidden");
        tutorModal?.classList.remove("flex");
    };

    document.getElementById("btn-open-tutor-modal")?.addEventListener("click", openTutorModal);
    document.getElementById("btn-open-tutor-modal-bottom")?.addEventListener("click", openTutorModal);
    document.getElementById("btn-close-tutor-modal")?.addEventListener("click", closeTutorModal);
    document.getElementById("btn-cancel-tutor-modal")?.addEventListener("click", closeTutorModal);
    document.getElementById("tutor-application-form")?.addEventListener("submit", handleTutorApplicationSubmit);
}

export const initAuthUI = initAuthLogin;

if (typeof window !== "undefined") {
    window.MakaiAuthLogin = {
        initAuthLogin,
        renderPricingCards,
        fetchDynamicPlansFromFirestore
    };
}
