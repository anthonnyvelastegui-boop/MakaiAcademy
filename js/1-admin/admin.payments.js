// ============================================================================
// ARCHIVO: js/1-admin/admin.payments.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD:
//   1. Bóveda de Auditoría Split-Screen (Pantalla Dividida: Visor Oscuro con
//      Zoom a la izquierda + Ficha de Acción con 1 Clic y Semáforo a la derecha).
//   2. Gestor de Tarifas en Vivo (CMS de `planes_suscripcion` en Firestore)
//      para que el Master Admin cambie precios sin tocar código HTML/JS.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import { isMasterAdmin } from "../2-core/state.store.js";
import { DEFAULT_DYNAMIC_PLANS } from "../3-security/auth.login.js";

let allPaymentsCache = [];
let allUsersExpirationCache = [];
let currentFilterTab = "pendiente"; // "pendiente" | "aprobado" | "rechazado" | "por_vencer"
let selectedPaymentId = null;
let voucherZoomScale = 1;

/**
 * Motivos estandarizados de rechazo (Cero tipeo libre para evitar errores de Secretaría).
 */
const STANDARD_REJECTION_REASONS = Object.freeze([
    "Comprobante ilegible, recortado o borroso.",
    "El monto transferido no coincide con la tarifa congelada del plan.",
    "Número de referencia o comprobante no encontrado en el estado bancario.",
    "Comprobante duplicado o utilizado previamente en otra cuenta.",
    "Transferencia en tránsito aún no efectiva en cuenta destino."
]);

/**
 * Calcula los días restantes hasta la fecha de vencimiento del plan de un usuario.
 */
function calculateDaysRemaining(isoDateString) {
    if (!isoDateString) return null;
    const exp = new Date(isoDateString);
    if (isNaN(exp.getTime())) return null;
    const diffMs = exp.getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determina si una cuenta entra en el Semáforo Rojo de Próximo Vencimiento:
 * <= 15 días para planes anuales/semestrales, <= 5 días para planes mensuales.
 */
function isAccountExpiringSoon(userDoc) {
    if (!userDoc?.fechaVencimientoPlan || userDoc.subscriptionLevel === "Básico") return false;
    const daysLeft = calculateDaysRemaining(userDoc.fechaVencimientoPlan);
    if (daysLeft === null || daysLeft < 0) return false;

    const cycle = (userDoc.cicloFacturacion || "annual").toLowerCase();
    const threshold = cycle === "monthly" ? 5 : 15;
    return daysLeft <= threshold;
}

/**
 * Descarga todas las solicitudes de pago y los usuarios para el semáforo de vigencia.
 */
async function loadPaymentsAndExpirationsFromFirestore() {
    const [paySnap, userSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.PAYMENTS)),
        getDocs(collection(db, COLLECTIONS.USERS))
    ]);

    allPaymentsCache = [];
    paySnap.forEach(d => allPaymentsCache.push({ id: d.id, ...d.data() }));
    allPaymentsCache.sort((a, b) => String(b.fechaSolicitud || "").localeCompare(String(a.fechaSolicitud || "")));

    allUsersExpirationCache = [];
    userSnap.forEach(d => {
        const u = { id: d.id, ...d.data() };
        if (isAccountExpiringSoon(u)) {
            allUsersExpirationCache.push(u);
        }
    });
}

// ============================================================================
// 1. BÓVEDA DE AUDITORÍA EN PANTALLA DIVIDIDA (SPLIT-SCREEN)
// ============================================================================

export async function initAdminPayments(role = "master") {
    const mount = document.getElementById("admin-tab-panel-payments");
    if (!mount) return;

    const isMaster = isMasterAdmin(auth.currentUser?.email) || role === "master";

    mount.innerHTML = `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 text-xs font-mono text-primary">
            Sincronizando Bóveda de Pagos en Pantalla Dividida...
        </div>
    `;

    try {
        await loadPaymentsAndExpirationsFromFirestore();
    } catch (err) {
        mount.innerHTML = `<div class="p-4 rounded-xl bg-danger/15 border border-danger text-xs text-danger">Error al cargar pagos: ${err.message}</div>`;
        return;
    }

    renderSplitScreenAuditor(mount, isMaster);
}

function renderSplitScreenAuditor(mount, isMaster) {
    const pendingList = allPaymentsCache.filter(p => (p.estado || "pendiente") === "pendiente");
    const approvedList = allPaymentsCache.filter(p => p.estado === "aprobado");
    const rejectedList = allPaymentsCache.filter(p => p.estado === "rechazado");

    let activeList = pendingList;
    if (currentFilterTab === "aprobado") activeList = approvedList;
    else if (currentFilterTab === "rechazado") activeList = rejectedList;

    if (!selectedPaymentId || !activeList.some(p => p.id === selectedPaymentId)) {
        selectedPaymentId = activeList[0]?.id || null;
    }

    const activePayment = activeList.find(p => p.id === selectedPaymentId) || null;
    voucherZoomScale = 1;

    mount.innerHTML = `
        <div class="space-y-5">
            <!-- FILTROS INTELIGENTES Y SEMÁFORO DE VENCIMIENTO -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-2">
                    <button type="button" data-pay-filter="pendiente"
                        class="px-3.5 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentFilterTab === "pendiente" ? "bg-warning text-surface" : "bg-surface text-gray-300 border border-surface-high"
                        }">
                        ⏳ Nuevas Solicitudes (${pendingList.length})
                    </button>

                    <button type="button" data-pay-filter="aprobado"
                        class="px-3.5 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentFilterTab === "aprobado" ? "bg-secondary text-surface" : "bg-surface text-gray-300 border border-surface-high"
                        }">
                        ✅ Aprobados (${approvedList.length})
                    </button>

                    <button type="button" data-pay-filter="rechazado"
                        class="px-3.5 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentFilterTab === "rechazado" ? "bg-danger text-white" : "bg-surface text-gray-300 border border-surface-high"
                        }">
                        ❌ Rechazados (${rejectedList.length})
                    </button>

                    <button type="button" data-pay-filter="por_vencer"
                        class="px-3.5 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentFilterTab === "por_vencer"
                                ? "bg-danger text-white shadow-[0_0_15px_rgba(255,77,77,0.4)]"
                                : "bg-danger/15 border border-danger/50 text-danger"
                        }">
                        🚨 Semáforo Por Vencer (${allUsersExpirationCache.length})
                    </button>
                </div>

                <!-- Lista rápida de tickets en la bandeja actual -->
                ${currentFilterTab !== "por_vencer" ? `
                    <select id="audit-ticket-selector"
                        class="bg-surface border border-primary/50 rounded-xl px-3.5 py-2 text-xs font-mono text-white">
                        ${activeList.length === 0
                            ? `<option value="">Sin comprobantes en esta bandeja</option>`
                            : activeList.map(p => `
                                <option value="${p.id}" ${p.id === selectedPaymentId ? "selected" : ""}>
                                    ${p.codigoContable || p.id} • ${p.nombreUsuario || p.emailUsuario} ($${Number(p.montoEsperadoUSD || 0).toFixed(2)})
                                </option>
                            `).join("")}
                    </select>
                ` : ""}
            </div>

            ${currentFilterTab === "por_vencer"
                ? renderExpiringSoonSemaphoreTable()
                : renderSplitScreenColumns(activePayment, isMaster)}
        </div>
    `;

    // Enlazar botones de filtro
    mount.querySelectorAll("[data-pay-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilterTab = btn.dataset.payFilter;
            renderSplitScreenAuditor(mount, isMaster);
        });
    });

    // Selector rápido de ticket
    document.getElementById("audit-ticket-selector")?.addEventListener("change", (e) => {
        selectedPaymentId = e.target.value;
        renderSplitScreenAuditor(mount, isMaster);
    });

    // Controles de Zoom en el Visor Oscuro Izquierdo
    const voucherImg = document.getElementById("split-voucher-img");
    document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
        voucherZoomScale = Math.min(2.6, voucherZoomScale + 0.3);
        if (voucherImg) voucherImg.style.transform = `scale(${voucherZoomScale})`;
    });
    document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
        voucherZoomScale = 1;
        if (voucherImg) voucherImg.style.transform = "scale(1)";
    });

    // Botón ✅ APROBAR CON 1 CLIC
    document.getElementById("btn-audit-approve")?.addEventListener("click", async () => {
        if (!activePayment) return;
        await approvePaymentAndCreditDays(activePayment);
        await loadPaymentsAndExpirationsFromFirestore();
        renderSplitScreenAuditor(mount, isMaster);
    });

    // Botón ❌ RECHAZAR CON MENÚ DESPLEGABLE ESTANDARIZADO
    document.getElementById("btn-audit-reject")?.addEventListener("click", async () => {
        if (!activePayment) return;
        const reason = document.getElementById("audit-reject-reason-select")?.value || STANDARD_REJECTION_REASONS[0];
        await rejectPaymentWithStandardReason(activePayment, reason);
        await loadPaymentsAndExpirationsFromFirestore();
        renderSplitScreenAuditor(mount, isMaster);
    });

    // Botón ⚙️ ESTATUS MANUAL FORZADO (SOLO MASTER ADMIN)
    document.getElementById("btn-force-manual-status")?.addEventListener("click", async () => {
        if (!isMaster || !activePayment?.uid) return;
        const forcedAction = document.getElementById("manual-force-select")?.value;
        await applyForcedManualAccountStatus(activePayment.uid, forcedAction);
        await loadPaymentsAndExpirationsFromFirestore();
        renderSplitScreenAuditor(mount, isMaster);
    });
}

/**
 * Renderiza el Layout de Pantalla Dividida (Visor Izquierdo + Ficha Derecha).
 */
function renderSplitScreenColumns(payment, isMaster) {
    if (!payment) {
        return `
            <div class="bg-surface-container border border-surface-high rounded-2xl p-10 text-center text-xs font-mono text-gray-400">
                🎉 No hay comprobantes pendientes en esta bandeja.
            </div>
        `;
    }

    const expectedUSD = Number(payment.montoEsperadoUSD ?? payment.montoDeclaradoUSD ?? 0).toFixed(2);
    const declaredUSD = Number(payment.montoDeclaradoUSD ?? expectedUSD).toFixed(2);
    const daysToCredit = Number(payment.diasPorAcreditar || (payment.cicloFacturacion === "monthly" ? 30 : 365));

    return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- MITAD IZQUIERDA (6 COLS): VISOR OSCURO DEL COMPROBANTE CON ZOOM -->
            <div class="lg:col-span-6 bg-[#06090e] border-2 border-surface-high rounded-2xl p-4 space-y-3 shadow-2xl">
                <div class="flex items-center justify-between border-b border-surface-high pb-3">
                    <div>
                        <span class="text-[10px] font-mono text-primary uppercase font-bold block">
                            🔍 VISOR INTEGRADO SIN SALIR DE PESTAÑA
                        </span>
                        <span class="text-xs font-mono font-extrabold text-white">
                            ${payment.codigoContable || payment.id}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="btn-zoom-in"
                            class="px-3 py-1.5 rounded-lg bg-surface-container border border-surface-high text-xs font-mono text-primary hover:border-primary">
                            + Zoom
                        </button>
                        <button type="button" id="btn-zoom-reset"
                            class="px-3 py-1.5 rounded-lg bg-surface-container border border-surface-high text-xs font-mono text-gray-300">
                            100%
                        </button>
                    </div>
                </div>

                <div class="h-[460px] overflow-auto rounded-xl bg-black/80 border border-surface-high flex items-center justify-center p-3">
                    ${payment.comprobanteBase64
                        ? `<img id="split-voucher-img" src="${payment.comprobanteBase64}" alt="Comprobante" class="max-h-full max-w-full object-contain transition-transform duration-200 origin-center">`
                        : `<p class="text-xs font-mono text-gray-500">Sin imagen Base64 adjunta en este registro.</p>`}
                </div>
            </div>

            <!-- MITAD DERECHA (6 COLS): FICHA DE AUDITORÍA Y BOTONES SIN TIPEO -->
            <div class="lg:col-span-6 bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5 shadow-2xl">
                <div class="flex items-start justify-between gap-3 border-b border-surface-high pb-4">
                    <div>
                        <span class="text-[10px] font-mono text-warning uppercase font-bold">
                            EXPEDIENTE CONTABLE BLINDADO
                        </span>
                        <h3 class="text-lg font-extrabold text-white mt-0.5">
                            ${payment.nombreUsuario || "Estudiante"}
                        </h3>
                        <p class="text-xs font-mono text-gray-400">
                            ${payment.emailUsuario || ""} • WhatsApp: ${payment.whatsappUsuario || "N/A"}
                        </p>
                    </div>
                    <span class="px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary font-mono text-xs font-extrabold uppercase">
                        ${payment.estado || "pendiente"}
                    </span>
                </div>

                <!-- Comparativa de Monto Histórico Congelado vs Declarado -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div class="bg-surface border border-surface-high rounded-xl p-3">
                        <span class="text-[10px] text-gray-400 uppercase block">Plan & Vigencia</span>
                        <span class="text-white font-extrabold block mt-1">${payment.planSolicitado || "PRO"} (${daysToCredit}d)</span>
                    </div>
                    <div class="bg-surface border border-primary/40 rounded-xl p-3">
                        <span class="text-[10px] text-primary uppercase block">Monto Histórico</span>
                        <span class="text-lg font-extrabold text-primary block mt-0.5">$${expectedUSD}</span>
                    </div>
                    <div class="bg-surface border border-secondary/40 rounded-xl p-3">
                        <span class="text-[10px] text-secondary uppercase block">Ref. Bancaria</span>
                        <span class="text-lg font-extrabold text-secondary block mt-0.5">#${payment.numeroComprobante || "N/A"}</span>
                    </div>
                </div>

                <div class="bg-surface border border-surface-high rounded-xl p-3.5 text-xs font-mono text-gray-300 space-y-1">
                    <div>Canal Declarado: <strong class="text-white">${payment.metodoPago || "Deuna!"}</strong></div>
                    <div>Carrera Registrada: <strong class="text-primary uppercase">${payment.carreraUsuario || "medicina"}</strong></div>
                    <div>Fecha de Subida: <span>${payment.fechaSolicitud ? new Date(payment.fechaSolicitud).toLocaleString("es-EC") : "Reciente"}</span></div>
                    ${payment.motivoRechazo ? `<div class="text-danger font-bold">Motivo de Rechazo: ${payment.motivoRechazo}</div>` : ""}
                </div>

                <!-- ACCIONES RÁPIDAS DE AUDITORÍA (CERO TIPEO LIBRE) -->
                <div class="space-y-4 pt-2 border-t border-surface-high">
                    <button type="button" id="btn-audit-approve"
                        class="w-full py-3.5 rounded-xl bg-secondary text-surface font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(148,222,45,0.25)]">
                        ✅ Aprobar Comprobante y Acreditar +${daysToCredit} Días Automáticamente
                    </button>

                    <div class="bg-surface border border-danger/40 rounded-xl p-3.5 space-y-2.5">
                        <label class="block text-[10px] font-mono text-danger uppercase font-extrabold">
                            ❌ Rechazo Estandarizado (Selecciona motivo sin escribir):
                        </label>
                        <div class="flex flex-col sm:flex-row gap-2">
                            <select id="audit-reject-reason-select"
                                class="flex-1 bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-danger focus:outline-none">
                                ${STANDARD_REJECTION_REASONS.map(r => `<option value="${r}">${r}</option>`).join("")}
                            </select>
                            <button type="button" id="btn-audit-reject"
                                class="px-4 py-2 rounded-lg bg-danger text-white font-mono font-extrabold text-xs uppercase whitespace-nowrap">
                                ❌ Rechazar
                            </button>
                        </div>
                    </div>

                    <!-- SELECTOR DE ESTATUS MANUAL FORZADO (EXCLUSIVO MASTER ADMIN) -->
                    ${isMaster ? `
                        <div class="bg-surface border border-warning/40 rounded-xl p-3.5 space-y-2">
                            <label class="block text-[10px] font-mono text-warning uppercase font-extrabold">
                                ⚙️ Estatus Manual Forzado (Exclusivo Master Admin):
                            </label>
                            <div class="flex flex-col sm:flex-row gap-2">
                                <select id="manual-force-select"
                                    class="flex-1 bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs font-mono text-white">
                                    <option value="PRO_365">Forzar PRO Anual (+365 días)</option>
                                    <option value="PRO_30">Forzar PRO Mensual (+30 días)</option>
                                    <option value="SURVIVAL_180">Forzar Sobrevivencia Semestral (+180 días)</option>
                                    <option value="DOWNGRADE_BASIC">Degradar inmediatamente a Plan Básico</option>
                                    <option value="EXPIRE_NOW">Marcar cuenta como ⛔ VENCIDO</option>
                                </select>
                                <button type="button" id="btn-force-manual-status"
                                    class="px-4 py-2 rounded-lg bg-warning text-surface font-mono font-extrabold text-xs uppercase whitespace-nowrap">
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    ` : ""}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderiza la tabla del Semáforo de Vencimiento (<= 15 días anual, <= 5 días mensual).
 */
function renderExpiringSoonSemaphoreTable() {
    if (allUsersExpirationCache.length === 0) {
        return `
            <div class="bg-surface-container border border-surface-high rounded-2xl p-8 text-center text-xs font-mono text-secondary">
                ✅ Ninguna suscripción activa se encuentra dentro del umbral crítico de vencimiento hoy.
            </div>
        `;
    }

    return `
        <div class="bg-surface-container border-2 border-danger/60 rounded-2xl p-6 space-y-4">
            <h3 class="text-base font-extrabold text-white">
                🚨 Semáforo de Suscripciones Próximas a Vencer (≤15d Anual / ≤5d Mensual)
            </h3>
            <div class="space-y-2">
                ${allUsersExpirationCache.map(u => {
                    const daysLeft = calculateDaysRemaining(u.fechaVencimientoPlan);
                    const waLink = u.whatsapp
                        ? `https://wa.me/593${String(u.whatsapp).replace(/^0/, "")}?text=${encodeURIComponent(`Hola ${u.primerNombre || ""}, te escribimos de Makai Academy. Tu plan ${u.subscriptionLevel} vence en ${daysLeft} días.`)}`
                        : "#";

                    return `
                        <div class="bg-surface border border-danger/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                            <div>
                                <span class="font-extrabold text-white">${u.nombre || u.email}</span>
                                <span class="text-gray-400 block">${u.email} • Plan ${u.subscriptionLevel}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="px-3 py-1 rounded-lg bg-danger/20 text-danger font-extrabold">
                                    ⏰ Quedan ${daysLeft} días
                                </span>
                                ${u.whatsapp ? `
                                    <a href="${waLink}" target="_blank" rel="noopener"
                                        class="px-3 py-1.5 rounded-lg bg-secondary text-surface font-extrabold">
                                        Avisar por WhatsApp
                                    </a>
                                ` : ""}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

/**
 * Aprueba el comprobante y suma automáticamente los días (30, 180 o 365) al estudiante.
 */
async function approvePaymentAndCreditDays(payment) {
    const now = new Date();
    const days = Number(payment.diasPorAcreditar || (payment.cicloFacturacion === "monthly" ? 30 : 365));
    const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const auditorEmail = auth.currentUser?.email || "secretaria@makai";

    await updateDoc(doc(db, COLLECTIONS.PAYMENTS, payment.id), {
        estado: "aprobado",
        motivoRechazo: null,
        auditadoPor: auditorEmail,
        fechaAuditoria: now.toISOString(),
        fechaVencimientoOtorgada: expirationDate
    });

    if (payment.uid) {
        await updateDoc(doc(db, COLLECTIONS.USERS, payment.uid), {
            subscriptionLevel: payment.planSolicitado || "PRO",
            estadoPago: "activo_verificado",
            cicloFacturacion: payment.cicloFacturacion || "annual",
            fechaActivacionPlan: now.toISOString(),
            fechaVencimientoPlan: expirationDate
        });
    }

    window.MakaiSecurityGuard?.showSecurityToast?.(
        `✅ Comprobante ${payment.codigoContable || payment.id} aprobado (+${days} días activos).`,
        "success"
    );
}

/**
 * Rechaza el comprobante con motivo estandarizado y mantiene al usuario en Básico.
 */
async function rejectPaymentWithStandardReason(payment, reason) {
    const nowIso = new Date().toISOString();
    const auditorEmail = auth.currentUser?.email || "secretaria@makai";

    await updateDoc(doc(db, COLLECTIONS.PAYMENTS, payment.id), {
        estado: "rechazado",
        motivoRechazo: reason,
        auditadoPor: auditorEmail,
        fechaAuditoria: nowIso
    });

    if (payment.uid) {
        await updateDoc(doc(db, COLLECTIONS.USERS, payment.uid), {
            subscriptionLevel: "Básico",
            estadoPago: "pago_rechazado",
            ultimoMotivoRechazo: reason
        }).catch(() => {});
    }

    window.MakaiSecurityGuard?.showSecurityToast?.(
        `❌ Comprobante rechazado: ${reason}`,
        "warning"
    );
}

/**
 * Cambia forzosamente el estatus de una cuenta (Exclusivo Master Admin).
 */
async function applyForcedManualAccountStatus(uid, actionCode) {
    const now = new Date();
    const addDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

    let payload = {};
    if (actionCode === "PRO_365") {
        payload = { subscriptionLevel: "PRO", estadoPago: "activo_verificado", fechaVencimientoPlan: addDays(365) };
    } else if (actionCode === "PRO_30") {
        payload = { subscriptionLevel: "PRO", estadoPago: "activo_verificado", fechaVencimientoPlan: addDays(30) };
    } else if (actionCode === "SURVIVAL_180") {
        payload = { subscriptionLevel: "Sobrevivencia", estadoPago: "activo_verificado", fechaVencimientoPlan: addDays(180) };
    } else if (actionCode === "DOWNGRADE_BASIC") {
        payload = { subscriptionLevel: "Básico", estadoPago: "activo_gratis", fechaVencimientoPlan: null };
    } else if (actionCode === "EXPIRE_NOW") {
        payload = { subscriptionLevel: "Básico", estadoPago: "vencido", fechaVencimientoPlan: new Date(now.getTime() - 86400000).toISOString() };
    }

    await updateDoc(doc(db, COLLECTIONS.USERS, uid), payload);
    window.MakaiSecurityGuard?.showSecurityToast?.("⚙️ Estatus manual aplicado al expediente.", "success");
}

// ============================================================================
// 2. GESTOR DE TARIFAS EN VIVO (MOTOR DE PRECIOS DINÁMICO SIN TOCAR CÓDIGO)
// ============================================================================

export async function initAdminPricingManager() {
    const mount = document.getElementById("admin-tab-panel-pricing");
    if (!mount) return;

    if (!isMasterAdmin(auth.currentUser?.email)) {
        mount.innerHTML = "";
        return;
    }

    let plansList = [];
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.SUBSCRIPTIONS));
        snap.forEach(d => plansList.push({ id: d.id, ...d.data() }));
    } catch (e) {}

    if (plansList.length === 0) {
        plansList = [...DEFAULT_DYNAMIC_PLANS];
    }
    plansList.sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));

    mount.innerHTML = `
        <div class="space-y-6">
            <div class="bg-surface-container border border-primary/50 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase font-bold">
                        ● MOTOR DE PRECIOS DINÁMICOS • COLECCIÓN: planes_suscripcion
                    </span>
                    <h3 class="text-xl font-extrabold text-white mt-0.5">
                        Gestor Comercial de Planes y Tarifas en Vivo
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Cambia precios, beneficios o apaga paquetes con un clic. Se refleja al instante en <code>index.html</code> y <code>registro.html</code> sin tocar HTML.
                    </p>
                </div>

                <button type="button" id="btn-seed-default-plans"
                    class="px-4 py-2.5 rounded-xl bg-surface border border-secondary/50 text-secondary font-mono font-extrabold text-xs hover:bg-secondary hover:text-surface transition-all">
                    ⚡ Restaurar / Sembrar 4 Planes Oficiales
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                ${plansList.map(plan => `
                    <form data-plan-editor-form="${plan.id}"
                        class="bg-surface-container border border-surface-high rounded-2xl p-5 space-y-4 shadow-xl">
                        <div class="flex items-center justify-between border-b border-surface-high pb-3">
                            <div>
                                <span class="text-[10px] font-mono text-primary uppercase font-bold">ID DOCUMENTO: ${plan.id}</span>
                                <h4 class="text-base font-extrabold text-white">${plan.titulo}</h4>
                            </div>
                            <label class="flex items-center gap-2 text-xs font-mono cursor-pointer">
                                <input type="checkbox" name="activo" ${plan.activo !== false ? "checked" : ""} class="accent-secondary w-4 h-4">
                                <span class="text-secondary font-bold">Plan Visible</span>
                            </label>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Título Público</label>
                                <input type="text" name="titulo" value="${plan.titulo || ""}" required
                                    class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white">
                            </div>
                            <div>
                                <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Etiqueta Badge Neón</label>
                                <input type="text" name="etiqueta_badge" value="${plan.etiqueta_badge || ""}"
                                    class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-primary font-mono">
                            </div>
                            <div>
                                <label class="block text-[10px] font-mono text-secondary uppercase mb-1 font-bold">Precio Mensual (USD)</label>
                                <input type="number" step="0.01" name="precio_mensual" value="${Number(plan.precio_mensual || 0)}" required
                                    class="w-full bg-surface border border-secondary/50 rounded-xl px-3 py-2 text-white font-mono font-extrabold">
                            </div>
                            <div>
                                <label class="block text-[10px] font-mono text-primary uppercase mb-1 font-bold">Precio Anual / Semestral (USD)</label>
                                <input type="number" step="0.01" name="precio_anual" value="${Number(plan.precio_anual || 0)}" required
                                    class="w-full bg-surface border border-primary/50 rounded-xl px-3 py-2 text-white font-mono font-extrabold">
                            </div>
                        </div>

                        <div>
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                                Lista de Beneficios (1 beneficio por línea)
                            </label>
                            <textarea name="beneficios" rows="4"
                                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-gray-200 font-mono">${(plan.beneficios || []).join("\n")}</textarea>
                        </div>

                        <input type="hidden" name="codigoPlan" value="${plan.codigoPlan || plan.titulo}">
                        <input type="hidden" name="subtitulo" value="${plan.subtitulo || ""}">
                        <input type="hidden" name="unidad_anual" value="${plan.unidad_anual || "año"}">
                        <input type="hidden" name="color_acento" value="${plan.color_acento || "primary"}">
                        <input type="hidden" name="orden" value="${plan.orden || 1}">

                        <div class="flex justify-end pt-2 border-t border-surface-high">
                            <button type="submit"
                                class="px-5 py-2.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase">
                                💾 Guardar Cambios en Vivo
                            </button>
                        </div>
                    </form>
                `).join("")}
            </div>
        </div>
    `;

    // Guardar cambios individuales de un plan en Firestore
    mount.querySelectorAll("[data-plan-editor-form]").forEach(form => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const planId = form.dataset.planEditorForm;
            const fd = new FormData(form);
            const benefitsRaw = String(fd.get("beneficios") || "");
            const benefitsArray = benefitsRaw.split("\n").map(s => s.trim()).filter(Boolean);

            const updatedPlan = {
                id: planId,
                codigoPlan: String(fd.get("codigoPlan") || "PRO"),
                titulo: String(fd.get("titulo") || "").trim(),
                subtitulo: String(fd.get("subtitulo") || "").trim(),
                etiqueta_badge: String(fd.get("etiqueta_badge") || "").trim(),
                precio_mensual: Number(fd.get("precio_mensual") || 0),
                precio_anual: Number(fd.get("precio_anual") || 0),
                unidad_anual: String(fd.get("unidad_anual") || "año"),
                color_acento: String(fd.get("color_acento") || "primary"),
                orden: Number(fd.get("orden") || 1),
                activo: form.querySelector('[name="activo"]')?.checked ?? true,
                beneficios: benefitsArray,
                updatedAt: new Date().toISOString()
            };

            await setDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, planId), updatedPlan, { merge: true });
            localStorage.removeItem("makai_cached_plans_v1");
            window.MakaiSecurityGuard?.showSecurityToast?.(
                `✅ Tarifa de "${updatedPlan.titulo}" actualizada en vivo para toda la web.`,
                "success"
            );
        });
    });

    // Botón para sembrar/restaurar los 4 planes semilla en Firestore
    document.getElementById("btn-seed-default-plans")?.addEventListener("click", async () => {
        for (const p of DEFAULT_DYNAMIC_PLANS) {
            await setDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, p.id), p, { merge: true });
        }
        localStorage.removeItem("makai_cached_plans_v1");
        window.MakaiSecurityGuard?.showSecurityToast?.("✅ Los 4 planes oficiales fueron publicados en Firestore.", "success");
        initAdminPricingManager();
    });
}
