// ============================================================================
// ARCHIVO: js/3-security/paywall.traffic.js
// DESCRIPCIÓN: Guardia de Tráfico Académico, Control de Cuota Mensual Freemium
//              (15 Casos), Candados por Nivel (Básico / PRO / VIP) y Pasarela
//              Interna de Upgrade con Subida de Comprobantes a Firestore.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    FREEMIUM_MONTHLY_CASE_LIMIT,
    isMasterAdmin,
    isCurrentUserAdmin,
    canAccessBySubscription,
    hasRemainingFreemiumCases,
    updateUserMetricsInState,
    setSessionState,
    subscribeToState
} from "../2-core/state.store.js";

import { processReceiptFile } from "./auth.verifier.js";

// Colecciones oficiales con respaldo seguro
const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    PAYMENTS: COLLECTIONS?.PAYMENTS || "solicitudes_pago"
};

// Rutas hacia la Bóveda Multimedia (assets/2-pagos-bancarios/)
const PAYMENT_ASSETS_PATHS = {
    QR_DEUNA: "assets/2-pagos-bancarios/codigos-qr/qr-deuna.png",
    QR_BANCO: "assets/2-pagos-bancarios/codigos-qr/qr-banco.png",
    EXAMPLE_RECEIPT: "assets/2-pagos-bancarios/ejemplos-comprobantes/ejemplo-comprobante.png",
    SEAL_VERIFIED: "assets/2-pagos-bancarios/sellos-financieros/sello-verificado.png"
};

// Catálogo oficial de planes y beneficios de MakaiAcademy
export const PAYWALL_PLAN_CATALOG = {
    basico: {
        key: "basico",
        label: "Plan Básico",
        level: "Básico",
        price: "0.00",
        period: "Gratis",
        badgeClass: "bg-gray-800 text-gray-300 border-gray-600",
        features: [
            "Hasta 15 casos clínicos al mes en Modo Tutor",
            "Acceso al lanzador curricular básico",
            "Métricas generales de rendimiento"
        ]
    },
    pro_mensual: {
        key: "pro_mensual",
        label: "Makai PRO CACES (Mensual)",
        level: "PRO",
        price: "17.99",
        period: "/ mes",
        badgeClass: "bg-primary/15 text-primary border-primary/40",
        features: [
            "Casos clínicos e intentos mensuales ILIMITADOS",
            "Modo Estándar (100 preguntas CACES) y Modo Crítico (30 preguntas)",
            "Repetición Sináptica 1D y Biblioteca de Guías PDF",
            "Simuladores Interactivos 2D y retroalimentación completa"
        ]
    },
    pro_anual: {
        key: "pro_anual",
        label: "Makai PRO CACES (Anual)",
        level: "PRO",
        price: "139.99",
        period: "/ año",
        badgeClass: "bg-primary/20 text-primary border-primary",
        features: [
            "Todo lo incluido en Makai PRO Mensual por 12 meses",
            "Ahorro superior al 35% respecto al plan mensual",
            "Acceso prioritario a bancos de preguntas CACES actualizados",
            "Descarga de resúmenes y algoritmos clínicos de alto rendimiento"
        ]
    },
    vip: {
        key: "vip",
        label: "Mentoría Élite VIP",
        level: "VIP",
        price: "49.99",
        period: "/ mes",
        badgeClass: "bg-secondary/20 text-secondary border-secondary",
        features: [
            "Acceso total ILIMITADO a Simuladores 1D, 2D y Motor 3D WebGL",
            "Aulas Virtuales en Vivo, Grabaciones VOD protegidas y Mentoría",
            "Simulacros CACES de 100 reactivos con analítica avanzada",
            "Soporte académico prioritario y revisión personalizada"
        ]
    }
};

// Reglas de nivel mínimo según el modo o módulo solicitado
const FEATURE_ACCESS_RULES = {
    "mode:tutor": { requiredLevel: "Básico", consumesFreemiumQuota: true, title: "Modo Tutor (20 Reactivos)" },
    "mode:standard": { requiredLevel: "PRO", consumesFreemiumQuota: false, title: "Modo Estándar CACES (100 Reactivos)" },
    "mode:critical": { requiredLevel: "PRO", consumesFreemiumQuota: false, title: "Modo Crítico de Alta Complejidad (30 Reactivos)" },
    "view:spaced": { requiredLevel: "Básico", consumesFreemiumQuota: true, title: "Repetición Sináptica 1D" },
    "view:sim2d": { requiredLevel: "PRO", consumesFreemiumQuota: false, title: "Simulador Clínico Interactivo 2D" },
    "view:sim3d": { requiredLevel: "VIP", consumesFreemiumQuota: false, title: "Simulador Hospitalario 3D WebGL" },
    "view:classrooms": { requiredLevel: "PRO", consumesFreemiumQuota: false, title: "Aulas Virtuales y Clases Magistrales" }
};

let isPaywallInitialized = false;

// ============================================================================
// 1. INICIALIZACIÓN DEL CONTROLADOR DE TRÁFICO Y PAYWALL
// ============================================================================

/**
 * Inicializa el sistema de control de tráfico, sincroniza la cuota mensual,
 * renderiza banners de estado bancario y enlaza botones de planes.
 * @param {Object|null} user
 * @param {Object|null} userData
 */
export async function initPaywallTraffic(user = null, userData = null) {
    const activeUser = user || appState.currentUser || auth.currentUser;
    const activeUserData = userData || appState.currentUserData;

    // 1. Enlazar botones de selección de planes si estamos en index.html
    bindLandingPlanButtons();

    // 2. Si estamos en dashboard.html, preparar modales, banners y cuota
    const isDashboard = window.location.pathname.endsWith("dashboard.html");
    if (isDashboard && activeUser) {
        await verifyAndResetMonthlyQuotaIfNeeded(activeUser, activeUserData);
        ensureFreemiumModalContainer();
        renderPaymentStatusBanner();
        syncPaywallStatusUI();
    }

    if (!isPaywallInitialized) {
        isPaywallInitialized = true;

        // Suscribirse a cambios de estado global para refrescar contadores
        subscribeToState(() => {
            syncPaywallStatusUI();
        });

        // Escuchar eventos globales disparados por otros controladores
        window.addEventListener("makai:openPaywall", (e) => {
            showFreemiumModal(e.detail || {});
        });

        window.addEventListener("makai:consumeCases", async (e) => {
            const count = Number(e.detail?.count ?? 1);
            await consumeFreemiumCases(count);
        });
    }

    // Exponer API global segura para compatibilidad con llamadas inline
    window.MakaiPaywall = {
        showFreemiumModal,
        openDirectUpgradeModal,
        canStartExamOrActivity,
        consumeFreemiumCases,
        syncPaywallStatusUI
    };
    window.showFreemiumModal = showFreemiumModal;
}

// Alias compatible con cargadores dinámicos de app.orchestrator.js
export const initPaywall = initPaywallTraffic;

/**
 * Enlaza botones con atributo [data-select-plan] en index.html o dashboard.html
 * para guardar la intención de compra en sessionStorage o abrir el upgrade.
 */
function bindLandingPlanButtons() {
    const planBtns = document.querySelectorAll("[data-select-plan]");
    planBtns.forEach(btn => {
        if (btn.dataset.paywallBound === "1") return;
        btn.dataset.paywallBound = "1";

        btn.addEventListener("click", (e) => {
            const planKey = btn.dataset.selectPlan || "pro_mensual";
            const paymentMethod = btn.dataset.selectPayment || "";

            try {
                sessionStorage.setItem("makai_selected_plan", planKey);
                if (paymentMethod) {
                    sessionStorage.setItem("makai_selected_payment", paymentMethod);
                }
            } catch (err) {
                console.warn("No se pudo guardar el plan en sessionStorage:", err);
            }

            const isDashboard = window.location.pathname.endsWith("dashboard.html");
            if (isDashboard) {
                e.preventDefault();
                openDirectUpgradeModal(planKey, paymentMethod);
            }
        });
    });
}

// ============================================================================
// 2. AUDITORÍA DE TRÁFICO, NIVELES DE SUSCRIPCIÓN Y CUOTA MENSUAL (15 CASOS)
// ============================================================================

/**
 * Verifica si ha cambiado el mes calendario (YYYY-MM) desde el último reinicio
 * para restablecer a 0 el contador casesUsedThisMonth del estudiante.
 * @param {Object} user
 * @param {Object} userData
 */
async function verifyAndResetMonthlyQuotaIfNeeded(user, userData) {
    if (!user || !userData) return;

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastResetMonth = userData.ultimoMesReinicioCuota || "";

    if (lastResetMonth && lastResetMonth !== currentYearMonth && Number(userData.casesUsedThisMonth || 0) > 0) {
        try {
            updateUserMetricsInState({ casesUsedThisMonth: 0 });
            if (appState.currentUserData) {
                appState.currentUserData.ultimoMesReinicioCuota = currentYearMonth;
            }
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, user.uid);
            await updateDoc(userRef, {
                casesUsedThisMonth: 0,
                ultimoMesReinicioCuota: currentYearMonth
            });
        } catch (err) {
            console.warn("No se pudo reiniciar la cuota mensual en Firestore:", err);
        }
    } else if (!lastResetMonth && user.uid) {
        try {
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, user.uid);
            await setDoc(userRef, { ultimoMesReinicioCuota: currentYearMonth }, { merge: true });
        } catch (err) {
            // Silencioso en caso de modo offline
        }
    }
}

/**
 * Evalúa si el usuario actual puede iniciar un simulacro, modo de examen o
 * módulo interactivo. Si no cumple los requisitos, despliega el Paywall.
 *
 * @param {Object} options
 * @param {string} [options.mode] - "tutor" | "standard" | "critical"
 * @param {string} [options.requiredLevel] - "Básico" | "PRO" | "VIP"
 * @param {string} [options.featureKey] - Clave opcional en FEATURE_ACCESS_RULES
 * @param {string} [options.featureTitle] - Nombre descriptivo del módulo
 * @param {boolean} [options.silent] - Si es true, no abre el modal automáticamente
 * @returns {boolean} true si tiene acceso permitido, false si fue bloqueado por Paywall
 */
export function canStartExamOrActivity(options = {}) {
    const email =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";

    // 1. Las Cuentas Maestras de Administración siempre tienen pase libre total
    if (isMasterAdmin(email) || isCurrentUserAdmin()) {
        return true;
    }

    const mode = (options.mode || appState.currentMode || "tutor").toLowerCase();
    const ruleKey = options.featureKey || `mode:${mode}`;
    const rule = FEATURE_ACCESS_RULES[ruleKey] || {
        requiredLevel: options.requiredLevel || (mode === "tutor" ? "Básico" : "PRO"),
        consumesFreemiumQuota: mode === "tutor",
        title: options.featureTitle || `Modo ${mode.toUpperCase()}`
    };

    const targetLevel = options.requiredLevel || rule.requiredLevel || "Básico";
    const userLevel = appState.currentUserData?.subscriptionLevel || "Básico";
    const casesUsed = Number(appState.currentUserData?.casesUsedThisMonth ?? 0);
    const limit = Number(FREEMIUM_MONTHLY_CASE_LIMIT || 15);

    // 2. Verificar si el nivel de suscripción cubre el nivel exigido (Básico < PRO < VIP)
    if (!canAccessBySubscription(targetLevel)) {
        if (!options.silent) {
            showFreemiumModal({
                reason: "level_required",
                requiredLevel: targetLevel,
                featureTitle: options.featureTitle || rule.title,
                message: `El acceso a "${options.featureTitle || rule.title}" requiere una suscripción activa ${targetLevel === "VIP" ? "Mentoría Élite VIP" : "Makai PRO CACES"}.`
            });
        }
        return false;
    }

    // 3. Si el estudiante está en Plan Básico, verificar límite de 15 casos mensuales
    if (userLevel === "Básico" && rule.consumesFreemiumQuota) {
        if (!hasRemainingFreemiumCases() || casesUsed >= limit) {
            if (!options.silent) {
                showFreemiumModal({
                    reason: "quota_reached",
                    requiredLevel: "PRO",
                    featureTitle: options.featureTitle || rule.title,
                    message: `Has alcanzado tu límite mensual gratuito de ${limit}/${limit} casos clínicos en el Plan Básico. Actualiza a Makai PRO para desbloquear simulacros y casos ilimitados.`
                });
            }
            return false;
        }
    }

    return true;
}

/**
 * Registra el consumo de reactivos/casos clínicos en el perfil del usuario.
 * Si el usuario es PRO, VIP o Admin Maestro, también lleva registro estadístico
 * o mantiene su acceso ilimitado sin bloquearlo.
 *
 * @param {number} [casesCount=1] - Cantidad de casos consumidos
 * @returns {Promise<number>} Nuevo total de casos usados en el mes
 */
export async function consumeFreemiumCases(casesCount = 1) {
    const incrementBy = Math.max(1, Number(casesCount) || 1);
    const currentUsed = Number(appState.currentUserData?.casesUsedThisMonth ?? 0);
    const newUsedTotal = currentUsed + incrementBy;

    // Actualizar en memoria global
    updateUserMetricsInState({
        casesUsedThisMonth: newUsedTotal
    });

    syncPaywallStatusUI();

    // Persistir en Cloud Firestore si hay usuario autenticado
    const uid = auth.currentUser?.uid || appState.currentUser?.uid || appState.currentUserData?.uid;
    if (uid) {
        try {
            const now = new Date();
            const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, uid);
            await setDoc(
                userRef,
                {
                    casesUsedThisMonth: newUsedTotal,
                    ultimoMesReinicioCuota: currentYearMonth,
                    updatedAt: now.toISOString()
                },
                { merge: true }
            );
        } catch (err) {
            console.warn("Aviso al sincronizar casesUsedThisMonth en Firestore:", err);
        }
    }

    return newUsedTotal;
}

/**
 * Devuelve un resumen detallado del estado de cuota y plan del estudiante activo.
 * @returns {Object}
 */
export function getUserTrafficSummary() {
    const userData = appState.currentUserData || {};
    const email = auth.currentUser?.email || appState.currentUser?.email || userData.email || "";
    const isAdmin = isMasterAdmin(email) || isCurrentUserAdmin();
    const level = isAdmin ? "PRO" : (userData.subscriptionLevel || "Básico");
    const used = Number(userData.casesUsedThisMonth ?? 0);
    const limit = Number(FREEMIUM_MONTHLY_CASE_LIMIT || 15);
    const isUnlimited = isAdmin || level === "PRO" || level === "VIP";

    return {
        isAdmin,
        subscriptionLevel: level,
        estadoPago: userData.estadoPago || "activo_gratis",
        planSolicitado: userData.planSolicitado || "basico",
        observacionPago: userData.observacionPago || "",
        casesUsedThisMonth: used,
        monthlyLimit: limit,
        remainingCases: isUnlimited ? Infinity : Math.max(0, limit - used),
        isUnlimited
    };
}

// ============================================================================
// 3. SINCRONIZACIÓN DE UI EN DASHBOARD Y BANNERS DE ESTADO BANCARIO
// ============================================================================

/**
 * Sincroniza los contadores visuales del Dashboard (#user-plan, #metric-cases)
 * con el estado financiero y de tráfico actual del estudiante.
 */
export function syncPaywallStatusUI() {
    const summary = getUserTrafficSummary();

    // 1. Etiqueta de plan en la barra lateral
    const userPlanEl = document.getElementById("user-plan");
    if (userPlanEl) {
        if (summary.isAdmin) {
            userPlanEl.textContent = "Plan PRO • Master Admin";
            userPlanEl.className = "text-xs font-mono font-extrabold text-primary";
        } else if (summary.subscriptionLevel === "VIP") {
            userPlanEl.textContent = "Plan Mentoría Élite VIP";
            userPlanEl.className = "text-xs font-mono font-extrabold text-secondary";
        } else if (summary.subscriptionLevel === "PRO") {
            userPlanEl.textContent = "Plan Makai PRO CACES";
            userPlanEl.className = "text-xs font-mono font-extrabold text-primary";
        } else {
            userPlanEl.textContent = `Plan Básico (${summary.casesUsedThisMonth}/${summary.monthlyLimit} casos)`;
            userPlanEl.className = "text-xs font-mono text-gray-400";
        }
    }

    // 2. Tarjeta de métricas (#metric-cases)
    const metricCasesEl = document.getElementById("metric-cases");
    if (metricCasesEl) {
        if (summary.isUnlimited) {
            metricCasesEl.textContent = `${summary.casesUsedThisMonth} / ∞`;
        } else {
            metricCasesEl.textContent = `${summary.casesUsedThisMonth} / ${summary.monthlyLimit}`;
        }
    }

    // 3. Actualizar banner de verificación si el estado de pago cambió
    renderPaymentStatusBanner();
}

/**
 * Muestra un banner informativo en la parte superior del Dashboard cuando el
 * estudiante tiene un pago "pendiente_verificacion" o "comprobante_rechazado".
 */
export function renderPaymentStatusBanner() {
    const viewsContainer = document.getElementById("views-container") || document.getElementById("view-launcher");
    if (!viewsContainer) return;

    let banner = document.getElementById("makai-payment-status-banner");
    const summary = getUserTrafficSummary();

    if (summary.isAdmin || summary.subscriptionLevel === "PRO" || summary.subscriptionLevel === "VIP") {
        banner?.remove();
        return;
    }

    if (summary.estadoPago !== "pendiente_verificacion" && summary.estadoPago !== "comprobante_rechazado") {
        banner?.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement("div");
        banner.id = "makai-payment-status-banner";
        viewsContainer.prepend(banner);
    }

    const planInfo = PAYWALL_PLAN_CATALOG[summary.planSolicitado] || PAYWALL_PLAN_CATALOG.pro_mensual;

    if (summary.estadoPago === "pendiente_verificacion") {
        banner.className = "mb-6 p-4 rounded-2xl bg-warning/10 border border-warning/40 flex flex-wrap items-center justify-between gap-4";
        banner.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-warning text-2xl mt-0.5">hourglass_top</span>
                <div>
                    <h4 class="text-sm font-extrabold text-warning">
                        Comprobante en Revisión Bancaria • ${escapeHTML(planInfo.label)}
                    </h4>
                    <p class="text-xs text-gray-300 mt-0.5">
                        Tu evidencia de pago fue recibida en la colección <span class="font-mono text-warning">${SAFE_COLLECTIONS.PAYMENTS}</span>. Mientras un Administrador Maestro verifica la transacción, puedes explorar la plataforma con tu cuota Básica.
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" id="btn-banner-refresh-status" class="px-3.5 py-2 rounded-xl bg-surface border border-warning/50 text-warning hover:bg-warning hover:text-surface text-xs font-extrabold transition-all">
                    🔄 Comprobar Activación
                </button>
            </div>
        `;

        banner.querySelector("#btn-banner-refresh-status")?.addEventListener("click", async () => {
            await refreshUserPaymentStatusFromFirestore();
        });
    } else if (summary.estadoPago === "comprobante_rechazado") {
        banner.className = "mb-6 p-4 rounded-2xl bg-danger/10 border border-danger/50 flex flex-wrap items-center justify-between gap-4";
        banner.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-danger text-2xl mt-0.5">report</span>
                <div>
                    <h4 class="text-sm font-extrabold text-danger">
                        Comprobante Observado por Auditoría Financiera
                    </h4>
                    <p class="text-xs text-gray-300 mt-0.5">
                        Motivo reportado: <strong class="text-white">${escapeHTML(summary.observacionPago || "Comprobante ilegible o referencia no encontrada.")}</strong>
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" id="btn-banner-reupload" class="px-4 py-2 rounded-xl bg-danger text-white hover:bg-opacity-90 text-xs font-extrabold transition-all">
                    📤 Subir Comprobante Corregido
                </button>
            </div>
        `;

        banner.querySelector("#btn-banner-reupload")?.addEventListener("click", () => {
            openDirectUpgradeModal(summary.planSolicitado || "pro_mensual");
        });
    }
}

/**
 * Consulta en tiempo real el documento del estudiante en Firestore para verificar
 * si un administrador ya aprobó su solicitud en admin.payments.js.
 */
export async function refreshUserPaymentStatusFromFirestore() {
    const uid = auth.currentUser?.uid || appState.currentUser?.uid;
    if (!uid) return;

    try {
        const userRef = doc(db, SAFE_COLLECTIONS.USERS, uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const freshData = snap.data();
            setSessionState(auth.currentUser || appState.currentUser, freshData);
            syncPaywallStatusUI();

            if (freshData.subscriptionLevel === "PRO" || freshData.subscriptionLevel === "VIP") {
                alert(`🎉 ¡Felicidades! Tu plan ${freshData.subscriptionLevel} ya está activo y verificado.`);
            } else {
                alert("⏳ Tu solicitud continúa en proceso de verificación bancaria. Te notificaremos en cuanto sea aprobada.");
            }
        }
    } catch (err) {
        console.error("Error al consultar estado de pago:", err);
    }
}

// ============================================================================
// 4. MODAL DE PAYWALL (#freemium-modal) Y PASARELA INTERNA DE UPGRADE
// ============================================================================

/**
 * Garantiza que exista el contenedor #freemium-modal en el DOM.
 * @returns {HTMLElement}
 */
function ensureFreemiumModalContainer() {
    let modal = document.getElementById("freemium-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "freemium-modal";
        modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto";
        document.body.appendChild(modal);
    }
    return modal;
}

/**
 * Despliega el modal de límite Freemium o candado de suscripción PRO/VIP,
 * permitiendo elegir entre Makai PRO Mensual ($17.99), PRO Anual ($139.99)
 * o Mentoría Élite VIP ($49.99).
 *
 * @param {Object} [options={}]
 */
export function showFreemiumModal(options = {}) {
    const modal = ensureFreemiumModalContainer();
    const summary = getUserTrafficSummary();

    const title =
        options.reason === "level_required"
            ? `Acceso Exclusivo ${options.requiredLevel === "VIP" ? "Mentoría Élite VIP" : "Makai PRO CACES"}`
            : "Límite Freemium Alcanzado (15/15 Casos)";

    const description =
        options.message ||
        "El Modo Estándar (100 preguntas), Modo Crítico y casos clínicos ilimitados requieren activar Makai PRO CACES o Mentoría Élite VIP.";

    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary/80 p-6 sm:p-8 rounded-2xl max-w-4xl w-full text-left shadow-[0_0_40px_rgba(0,229,255,0.22)] relative my-8">
            <!-- Encabezado del Modal -->
            <div class="flex items-start justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/30">
                        Guardia de Tráfico • MakaiAcademy
                    </span>
                    <h3 class="text-xl sm:text-2xl font-extrabold text-white mt-1.5">${escapeHTML(title)}</h3>
                    <p class="text-xs sm:text-sm text-gray-400 mt-1">${escapeHTML(description)}</p>
                </div>
                <button type="button" id="btn-close-freemium-modal" class="p-2 rounded-xl bg-surface text-gray-400 hover:text-white border border-surface-high">
                    ✕
                </button>
            </div>

            <!-- Barra de Consumo Actual -->
            <div class="mt-4 bg-surface p-3.5 rounded-xl border border-surface-high flex flex-wrap items-center justify-between gap-3">
                <div class="text-xs font-mono text-gray-300">
                    Estado actual: <strong class="text-white">Plan ${escapeHTML(summary.subscriptionLevel)}</strong> •
                    Casos usados este mes: <strong class="text-warning">${summary.casesUsedThisMonth} / ${summary.monthlyLimit}</strong>
                </div>
                <div class="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                    <span class="px-2 py-0.5 rounded bg-surface-container border border-gray-700">Deuna! QR</span>
                    <span class="px-2 py-0.5 rounded bg-surface-container border border-gray-700">Transferencia Bancaria</span>
                    <span class="px-2 py-0.5 rounded bg-surface-container border border-gray-700">PayPhone / Tarjeta</span>
                </div>
            </div>

            <!-- Tarjetas Comparativas de Planes -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <!-- Plan PRO Mensual -->
                <div class="bg-surface border border-primary/50 rounded-xl p-5 flex flex-col justify-between hover:border-primary transition-all">
                    <div>
                        <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">Más Popular</span>
                        <h4 class="text-base font-extrabold text-white mt-2">Makai PRO Mensual</h4>
                        <div class="mt-2 flex items-baseline gap-1">
                            <span class="text-2xl font-extrabold text-primary font-mono">$17.99</span>
                            <span class="text-xs text-gray-400">USD / mes</span>
                        </div>
                        <ul class="mt-3 space-y-1.5 text-xs text-gray-300">
                            <li>✓ Casos y simulacros ilimitados</li>
                            <li>✓ Modo Estándar (100 preguntas) y Crítico</li>
                            <li>✓ Repetición Sináptica 1D y Guías PDF</li>
                            <li>✓ Simuladores Clínicos 2D</li>
                        </ul>
                    </div>
                    <button type="button" data-upgrade-plan="pro_mensual" class="mt-5 w-full py-2.5 px-4 rounded-xl bg-primary text-surface-container font-extrabold text-xs hover:bg-opacity-90 transition-all">
                        Activar PRO Mensual ($17.99)
                    </button>
                </div>

                <!-- Plan PRO Anual -->
                <div class="bg-surface border-2 border-primary rounded-xl p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(0,229,255,0.12)]">
                    <div>
                        <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary text-surface font-extrabold">Mejor Ahorro (-35%)</span>
                        <h4 class="text-base font-extrabold text-white mt-2">Makai PRO Anual</h4>
                        <div class="mt-2 flex items-baseline gap-1">
                            <span class="text-2xl font-extrabold text-white font-mono">$139.99</span>
                            <span class="text-xs text-gray-400">USD / año</span>
                        </div>
                        <ul class="mt-3 space-y-1.5 text-xs text-gray-300">
                            <li>✓ 12 meses de acceso total Makai PRO</li>
                            <li>✓ Banco completo de reactivos CACES</li>
                            <li>✓ Simuladores 1D y 2D sin restricción</li>
                            <li>✓ Descarga de algoritmos y GPCs</li>
                        </ul>
                    </div>
                    <button type="button" data-upgrade-plan="pro_anual" class="mt-5 w-full py-2.5 px-4 rounded-xl bg-primary text-surface-container font-extrabold text-xs hover:bg-opacity-90 transition-all">
                        Activar PRO Anual ($139.99)
                    </button>
                </div>

                <!-- Plan Mentoría Élite VIP -->
                <div class="bg-surface border border-secondary/60 rounded-xl p-5 flex flex-col justify-between hover:border-secondary transition-all">
                    <div>
                        <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/20 text-secondary font-bold">Nivel Élite 3D + Aulas</span>
                        <h4 class="text-base font-extrabold text-white mt-2">Mentoría Élite VIP</h4>
                        <div class="mt-2 flex items-baseline gap-1">
                            <span class="text-2xl font-extrabold text-secondary font-mono">$49.99</span>
                            <span class="text-xs text-gray-400">USD / mes</span>
                        </div>
                        <ul class="mt-3 space-y-1.5 text-xs text-gray-300">
                            <li>✓ Todo lo de Makai PRO incluido</li>
                            <li>✓ Acceso al Motor Hospitalario 3D WebGL</li>
                            <li>✓ Aulas Virtuales en Vivo y VOD con DRM</li>
                            <li>✓ Mentoría académica personalizada</li>
                        </ul>
                    </div>
                    <button type="button" data-upgrade-plan="vip" class="mt-5 w-full py-2.5 px-4 rounded-xl bg-secondary text-surface-container font-extrabold text-xs hover:bg-opacity-90 transition-all">
                        Activar Mentoría VIP ($49.99)
                    </button>
                </div>
            </div>

            <!-- Pie del Modal -->
            <div class="mt-6 pt-4 border-t border-surface-high flex flex-wrap items-center justify-between gap-3">
                <span class="text-xs text-gray-400">
                    ¿Ya realizaste tu transferencia o pago por QR Deuna!? Sube tu comprobante aquí mismo para activación inmediata.
                </span>
                <button type="button" id="btn-Dismiss-freemium" class="text-xs font-mono text-gray-400 hover:text-white px-3 py-1.5">
                    Continuar en Plan Básico
                </button>
            </div>
        </div>
    `;

    const closeModal = () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    modal.querySelector("#btn-close-freemium-modal")?.addEventListener("click", closeModal);
    modal.querySelector("#btn-Dismiss-freemium")?.addEventListener("click", closeModal);
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    modal.querySelectorAll("[data-upgrade-plan]").forEach(btn => {
        btn.addEventListener("click", () => {
            const chosenPlan = btn.dataset.upgradePlan || "pro_mensual";
            openDirectUpgradeModal(chosenPlan);
        });
    });

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

/**
 * Renderiza dentro de #freemium-modal el formulario directo de subida de
 * comprobante bancario (conectado a la colección "solicitudes_pago" de Firestore)
 * para que un estudiante con cuenta activa actualice su plan sin salir del Dashboard.
 *
 * @param {string} [selectedPlanKey="pro_mensual"]
 * @param {string} [preferredMethod="qr"]
 */
export function openDirectUpgradeModal(selectedPlanKey = "pro_mensual", preferredMethod = "qr") {
    const modal = ensureFreemiumModalContainer();
    const planInfo = PAYWALL_PLAN_CATALOG[selectedPlanKey] || PAYWALL_PLAN_CATALOG.pro_mensual;
    const todayStr = new Date().toISOString().split("T")[0];

    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary p-6 sm:p-8 rounded-2xl max-w-2xl w-full text-left shadow-[0_0_40px_rgba(0,229,255,0.25)] relative my-8">
            <div class="flex items-start justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-bold">
                        Activación Bancaria Directa • Colección: ${SAFE_COLLECTIONS.PAYMENTS}
                    </span>
                    <h3 class="text-xl font-extrabold text-white mt-1">
                        Actualizar a ${escapeHTML(planInfo.label)} ($${escapeHTML(planInfo.price)} USD)
                    </h3>
                </div>
                <button type="button" id="btn-close-upgrade-modal" class="p-2 rounded-xl bg-surface text-gray-400 hover:text-white border border-surface-high">
                    ✕
                </button>
            </div>

            <form id="paywall-upgrade-form" class="mt-4 space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Plan a Activar</label>
                        <select id="upgrade-plan-select" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-primary focus:outline-none">
                            <option value="pro_mensual" ${selectedPlanKey === "pro_mensual" ? "selected" : ""}>Makai PRO Mensual ($17.99 USD)</option>
                            <option value="pro_anual" ${selectedPlanKey === "pro_anual" ? "selected" : ""}>Makai PRO Anual ($139.99 USD)</option>
                            <option value="vip" ${selectedPlanKey === "vip" ? "selected" : ""}>Mentoría Élite VIP ($49.99 USD)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Método de Pago Utilizado</label>
                        <select id="upgrade-method-select" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-primary focus:outline-none">
                            <option value="qr" ${preferredMethod === "qr" ? "selected" : ""}>Código QR Deuna! / Bancario</option>
                            <option value="transferencia" ${preferredMethod === "transferencia" ? "selected" : ""}>Transferencia Bancaria Directa</option>
                            <option value="tarjeta" ${preferredMethod === "tarjeta" ? "selected" : ""}>PayPhone / Tarjeta Visa o Mastercard</option>
                        </select>
                    </div>
                </div>

                <!-- Referencia visual de QR / Datos Bancarios desde assets/2-pagos-bancarios/ -->
                <div class="bg-surface p-3.5 rounded-xl border border-surface-high flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                        <div class="font-bold text-white">Bóveda Bancaria Oficial MakaiAcademy</div>
                        <p class="text-gray-400 text-[11px] mt-0.5">
                            Realiza tu pago por el valor exacto del plan y adjunta la captura (JPG/PNG) o PDF del comprobante.
                        </p>
                    </div>
                    <a href="${PAYMENT_ASSETS_PATHS.QR_DEUNA}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary font-mono text-[11px] font-bold hover:bg-primary hover:text-surface transition-all">
                        🔍 Ver QR Oficial
                    </a>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">N° de Comprobante / Referencia</label>
                        <input type="text" id="upgrade-receipt-number" required placeholder="Ej: 094817263" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Banco o Billetera de Origen</label>
                        <input type="text" id="upgrade-origin-bank" required placeholder="Ej: Banco Pichincha / Deuna / Guayaquil" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Nombre del Titular de la Cuenta</label>
                        <input type="text" id="upgrade-holder-name" required placeholder="Nombre completo del titular" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Cédula / RUC del Titular</label>
                        <input type="text" id="upgrade-holder-id" required placeholder="Ej: 0601234567" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Monto Transferido (USD)</label>
                        <input type="text" id="upgrade-amount" required value="${escapeHTML(planInfo.price)}" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-secondary font-extrabold font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Fecha del Comprobante</label>
                        <input type="date" id="upgrade-receipt-date" required value="${todayStr}" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Adjuntar Captura (JPG/PNG) o PDF del Comprobante</label>
                    <input type="file" id="upgrade-receipt-file" accept="image/jpeg,image/png,image/webp,application/pdf" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-300 font-mono" />
                </div>

                <div id="upgrade-error-box" class="hidden p-3 rounded-xl bg-danger/15 border border-danger text-danger text-xs font-mono"></div>

                <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button type="button" id="btn-back-to-plans" class="px-4 py-2.5 rounded-xl bg-surface border border-surface-high text-gray-300 hover:text-white text-xs font-bold">
                        ← Volver a Planes
                    </button>
                    <button type="submit" id="btn-submit-upgrade" class="px-6 py-2.5 rounded-xl bg-primary text-surface-container font-extrabold text-xs hover:bg-opacity-90 transition-all">
                        📤 Enviar Comprobante para Activación
                    </button>
                </div>
            </form>
        </div>
    `;

    const planSelect = modal.querySelector("#upgrade-plan-select");
    const amountInput = modal.querySelector("#upgrade-amount");
    planSelect?.addEventListener("change", () => {
        const chosen = PAYWALL_PLAN_CATALOG[planSelect.value];
        if (chosen && amountInput) {
            amountInput.value = chosen.price;
        }
    });

    modal.querySelector("#btn-close-upgrade-modal")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });

    modal.querySelector("#btn-back-to-plans")?.addEventListener("click", () => {
        showFreemiumModal();
    });

    const form = modal.querySelector("#paywall-upgrade-form");
    const errorBox = modal.querySelector("#upgrade-error-box");
    const submitBtn = modal.querySelector("#btn-submit-upgrade");

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox?.classList.add("hidden");

        const user = auth.currentUser || appState.currentUser;
        const userData = appState.currentUserData || {};

        if (!user) {
            const chosenPlan = planSelect?.value || "pro_mensual";
            window.location.href = `registro.html?plan=${encodeURIComponent(chosenPlan)}`;
            return;
        }

        const file = modal.querySelector("#upgrade-receipt-file")?.files?.[0];
        if (!file) {
            if (errorBox) {
                errorBox.textContent = "⚠️ Debes adjuntar el archivo de imagen o PDF del comprobante bancario.";
                errorBox.classList.remove("hidden");
            }
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = "Procesando comprobante en Base64...";

            const base64Receipt = await processReceiptFile(file);
            const nowIso = new Date().toISOString();
            const nowEcuador = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });

            const chosenPlan = planSelect?.value || "pro_mensual";
            const chosenMethod = modal.querySelector("#upgrade-method-select")?.value || "qr";

            const paymentDetails = {
                numeroComprobante: modal.querySelector("#upgrade-receipt-number").value.trim(),
                bancoOrigen: modal.querySelector("#upgrade-origin-bank").value.trim(),
                titularCuenta: modal.querySelector("#upgrade-holder-name").value.trim(),
                cedulaTitular: modal.querySelector("#upgrade-holder-id").value.trim(),
                montoDeclarado: modal.querySelector("#upgrade-amount").value.trim(),
                fechaComprobante: modal.querySelector("#upgrade-receipt-date").value,
                archivoNombre: file.name,
                archivoTipo: file.type,
                comprobanteBase64: base64Receipt,
                fechaHoraEnvioExacta: nowEcuador
            };

            // 1. Registrar en la colección "solicitudes_pago" para admin.payments.js
            await addDoc(collection(db, SAFE_COLLECTIONS.PAYMENTS), {
                uid: user.uid,
                estudianteNombre: userData.nombre || user.displayName || user.email,
                estudianteEmail: user.email,
                estudianteTelefono: userData.telefonoCompleto || userData.telefonoNumero || "",
                planSolicitado: chosenPlan,
                metodoPago: chosenMethod,
                estado: "pendiente",
                ...paymentDetails,
                createdAt: nowIso
            });

            // 2. Actualizar el estado del estudiante en la colección "usuarios"
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, user.uid);
            await setDoc(
                userRef,
                {
                    planSolicitado: chosenPlan,
                    metodoPagoPreferido: chosenMethod,
                    estadoPago: "pendiente_verificacion",
                    datosComprobante: paymentDetails,
                    observacionPago: "",
                    updatedAt: nowIso
                },
                { merge: true }
            );

            // 3. Sincronizar estado en memoria
            if (appState.currentUserData) {
                appState.currentUserData.planSolicitado = chosenPlan;
                appState.currentUserData.estadoPago = "pendiente_verificacion";
                appState.currentUserData.observacionPago = "";
            }

            modal.classList.add("hidden");
            modal.classList.remove("flex");
            syncPaywallStatusUI();

            alert("✅ Comprobante enviado exitosamente a la Bandeja de Auditoría Financiera. Tu plan PRO/VIP se activará en cuanto se verifique la referencia.");
        } catch (err) {
            if (errorBox) {
                errorBox.textContent = "⚠️ Error al enviar el comprobante: " + err.message;
                errorBox.classList.remove("hidden");
            }
            submitBtn.disabled = false;
            submitBtn.textContent = "📤 Enviar Comprobante para Activación";
        }
    });

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

// ============================================================================
// 5. UTILIDADES DE SANEAMIENTO HTML
// ============================================================================

/**
 * Escapa caracteres especiales para prevenir inyecciones XSS en modales.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
