// ============================================================================
// ARCHIVO: js/1-admin/admin.payments.js
// DESCRIPCIÓN: Subcomponente de Verificación Bancaria, Detección de
//              Comprobantes Duplicados, Contador de Vigencia con Auto-Expiración,
//              Cambio Manual de Estatus y Visor de Evidencias (JPG/PNG/PDF).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin
} from "../2-core/state.store.js";

// Colecciones oficiales con respaldo seguro
const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    PAYMENTS: COLLECTIONS?.PAYMENTS || "solicitudes_pago"
};

// Rutas hacia las subcarpetas oficiales de assets/2-pagos-bancarios/
const PAYMENT_ASSETS_PATHS = {
    QR_FOLDER: "assets/2-pagos-bancarios/codigos-qr/",
    EXAMPLES_FOLDER: "assets/2-pagos-bancarios/ejemplos-comprobantes/",
    SEALS_FOLDER: "assets/2-pagos-bancarios/sellos-financieros/"
};

// Catálogo de precios y vigencia oficial (en días) para auditoría y contador
const OFFICIAL_PLAN_CATALOG = {
    basico: { label: "Plan Básico", level: "Básico", expectedAmount: 0.00, durationDays: 0, warnDays: 0 },
    pro_mensual: { label: "Makai PRO Mensual", level: "PRO", expectedAmount: 17.99, durationDays: 30, warnDays: 5 },
    pro_anual: { label: "Makai PRO Anual", level: "PRO", expectedAmount: 139.99, durationDays: 365, warnDays: 15 },
    vip: { label: "Mentoría Élite VIP", level: "VIP", expectedAmount: 49.99, durationDays: 30, warnDays: 5 }
};

// Estado interno del módulo de pagos
let cachedPaymentRequests = [];
let receiptFrequencyMap = {};
let activeFilterStatus = "todos";
let activeFilterMethod = "todos";
let activeFilterPlan = "todos";
let activeSearchQuery = "";

// ============================================================================
// 1. VALIDACIÓN DE SEGURIDAD Y GENERADORES DE IDs LÓGICOS
// ============================================================================

function hasMasterPaymentAccess() {
    const email =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";
    return isMasterAdmin(email);
}

/**
 * Genera el UID lógico del estudiante: MK-[CARRERA]-[AÑO]-[INICIALES]-[4_DIGITOS]
 */
function buildLogicalStudentUID(item = {}) {
    if (item.codigoEstudiante) return item.codigoEstudiante;

    const careerMap = {
        medicina: "MED",
        enfermeria: "ENF",
        odontologia: "ODO",
        obstetricia: "OBS",
        psicologia_clinica: "PSI",
        nutricion: "NUT",
        fisioterapia: "FIS",
        laboratorio_clinico: "LAB",
        imagenologia: "IMG",
        bioquimica_farmacia: "BQF",
        atencion_prehospitalaria: "APH",
        preuniversitario_salud: "PRE"
    };

    const careerCode = careerMap[(item.estudianteCarrera || "").toLowerCase()] || "ALU";
    const year = (item.createdAt || "").slice(0, 4) || new Date().getFullYear();

    const cleanName = String(item.estudianteNombre || "AL")
        .replace(/^(Dr\.|Dra\.|Md\.|Lic\.|Est\.|Sr\.|Sra\.)\s*/i, "")
        .trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : cleanName.slice(0, 2).toUpperCase().padEnd(2, "X");

    const suffix = String(item.uid || item.id || "0000").slice(-4).toUpperCase();
    return `MK-${careerCode}-${year}-${initials}-${suffix}`;
}

/**
 * Genera el ID lógico de la solicitud de pago: PAG-[AAAAMMDD]-[PLAN]-[REF]
 */
function buildLogicalPaymentID(item = {}) {
    if (item.codigoSolicitud) return item.codigoSolicitud;

    const rawDate = item.fechaComprobante || (item.createdAt ? item.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const dateCompact = String(rawDate).replace(/-/g, "").slice(0, 8) || "20260000";

    const planMap = {
        pro_anual: "ANUAL",
        pro_mensual: "MENSUAL",
        vip: "VIP",
        basico: "BASICO"
    };
    const planCode = planMap[(item.planSolicitado || "").toLowerCase()] || "PRO";

    const refClean = String(item.numeroComprobante || "").replace(/\D/g, "").slice(-4);
    const suffix = refClean || String(item.id || "0000").slice(-4).toUpperCase();

    return `PAG-${dateCompact}-${planCode}-${suffix}`;
}

/**
 * Calcula el estado del contador de vigencia para planes aprobados.
 * Devuelve días transcurridos, días restantes, fecha de vencimiento y banderas de alerta.
 */
function evaluatePlanCountdown(item) {
    const status = item.estado || "pendiente";
    if (status !== "aprobado" && status !== "vencido") {
        return { active: false, isExpiringSoon: false, isExpired: status === "vencido" };
    }

    const planKey = (item.planSolicitado || "pro_anual").toLowerCase();
    const catalog = OFFICIAL_PLAN_CATALOG[planKey] || OFFICIAL_PLAN_CATALOG.pro_anual;
    const totalDays = item.duracionDiasPersonalizada || catalog.durationDays || 365;
    const warnThreshold = catalog.warnDays || 15;

    const startIso = item.aprobadoEn || item.fechaActivacionPlan || item.createdAt;
    if (!startIso || totalDays <= 0) {
        return { active: false, isExpiringSoon: false, isExpired: false };
    }

    const startMs = new Date(startIso).getTime();
    if (isNaN(startMs)) {
        return { active: false, isExpiringSoon: false, isExpired: false };
    }

    const endMs = item.fechaVencimientoPlan
        ? new Date(item.fechaVencimientoPlan).getTime()
        : startMs + totalDays * 86400000;

    const nowMs = Date.now();
    const elapsedDays = Math.max(0, Math.floor((nowMs - startMs) / 86400000));
    const remainingDays = Math.ceil((endMs - nowMs) / 86400000);
    const progressPct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    const isExpired = remainingDays <= 0 || status === "vencido";
    const isExpiringSoon = !isExpired && remainingDays <= warnThreshold;

    return {
        active: true,
        totalDays,
        elapsedDays,
        remainingDays: Math.max(0, remainingDays),
        progressPct,
        startFormatted: new Date(startMs).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" }),
        endFormatted: new Date(endMs).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" }),
        endIso: new Date(endMs).toISOString(),
        isExpiringSoon,
        isExpired
    };
}

// ============================================================================
// 2. INICIALIZADOR DEL SUBCOMPONENTE DE PAGOS
// ============================================================================

export async function initAdminPayments() {
    if (!hasMasterPaymentAccess()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    renderAdminPaymentsSection(adminView);
    renderReceiptPreviewModal();
    await loadPaymentRequests();
}

function renderAdminPaymentsSection(adminView) {
    let section =
        document.getElementById("admin-payments-section") ||
        document.getElementById("admin-payments-inbox");

    if (!section) {
        section = document.createElement("section");
        section.id = "admin-payments-section";
        section.className = "mb-10 space-y-5";

        const backupVault = document.getElementById("admin-backup-vault");
        const commandCenter = document.getElementById("admin-command-center");

        if (backupVault && backupVault.nextSibling) {
            adminView.insertBefore(section, backupVault.nextSibling);
        } else if (commandCenter && commandCenter.nextSibling) {
            adminView.insertBefore(section, commandCenter.nextSibling);
        } else {
            adminView.appendChild(section);
        }
    } else {
        section.id = "admin-payments-section";
    }

    if (section.dataset.paymentsInitialized === "1") return;
    section.dataset.paymentsInitialized = "1";

    section.innerHTML = `
        <div id="admin-payments-inbox" class="bg-surface-container border-2 border-warning/50 rounded-2xl p-6 shadow-2xl space-y-5">
            <!-- CABECERA DE LA BANDEJA BANCARIA -->
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-warning/15 text-warning border border-warning/40">
                            Auditoría Financiera • Colección: ${SAFE_COLLECTIONS.PAYMENTS}
                        </span>
                        <span class="text-[10px] font-mono text-gray-400 hidden sm:inline">
                            Vigencia Automática + Control Manual
                        </span>
                    </div>
                    <h3 class="text-xl font-extrabold text-warning flex items-center gap-2 mt-1.5">
                        <span class="material-symbols-outlined">receipt_long</span>
                        <span>Bandeja de Verificación de Pagos, Vigencia y Activación PRO / VIP</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Inspecciona capturas, audita el contador de vigencia del plan, recibe alertas rojas cuando estén próximos a vencer y cambia el estatus manual o automáticamente.
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2.5">
                    <button type="button" id="btn-export-payments-csv" class="px-3.5 py-2 bg-surface border border-secondary/50 text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base">table_view</span>
                        <span>Exportar Vista (.CSV)</span>
                    </button>
                    <button type="button" id="btn-refresh-payments" class="px-4 py-2 bg-surface border border-warning text-warning hover:bg-warning hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base" id="icon-payments-refresh">sync</span>
                        <span>Actualizar Solicitudes</span>
                    </button>
                </div>
            </div>

            <!-- SUB-MÉTRICAS FINANCIERAS DE LA BANDEJA -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div class="bg-surface border border-warning/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-warning uppercase block">Pendientes de Revisión</span>
                    <div class="text-xl font-extrabold text-warning font-mono mt-0.5" id="pay-stat-pending">0</div>
                </div>
                <div class="bg-surface border border-secondary/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-secondary uppercase block">Planes Activos</span>
                    <div class="text-xl font-extrabold text-secondary font-mono mt-0.5" id="pay-stat-approved">0</div>
                </div>
                <div class="bg-surface border border-danger/50 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-danger uppercase block">🚨 Por Vencer / Vencidos</span>
                    <div class="text-xl font-extrabold text-danger font-mono mt-0.5" id="pay-stat-expiring">0</div>
                </div>
                <div class="bg-surface border border-danger/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-danger uppercase block">Alertas Ref. Duplicada</span>
                    <div class="text-xl font-extrabold text-danger font-mono mt-0.5" id="pay-stat-duplicates">0</div>
                </div>
                <div class="bg-surface border border-primary/30 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <span class="text-[10px] font-mono text-primary uppercase block">Recaudación Aprobada</span>
                    <div class="text-xl font-extrabold text-white font-mono mt-0.5" id="pay-stat-revenue">$0.00 USD</div>
                </div>
            </div>

            <!-- BARRA DE FILTROS Y BÚSQUEDA -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="lg:col-span-2">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Buscar Alumno, ID Lógico, Correo, CI/RUC o Comprobante</label>
                    <div class="relative">
                        <input
                            type="text"
                            id="payments-search-input"
                            placeholder="Ej: PAG-2026, MK-MED, 0987654321, correo..."
                            class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Estado de Auditoría</label>
                    <select id="payments-filter-status" class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono">
                        <option value="todos">Todos los estados</option>
                        <option value="pendiente">⏳ Pendientes</option>
                        <option value="aprobado">✅ Aprobados (Activos)</option>
                        <option value="por_vencer">🚨 Próximos a vencer (Alerta Roja)</option>
                        <option value="vencido">⛔ Planes Vencidos / Expirados</option>
                        <option value="rechazado">❌ Rechazados / Observados</option>
                        <option value="duplicados">⚠️ Solo N° Ref. Duplicados</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Plan Solicitado</label>
                    <select id="payments-filter-plan" class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono">
                        <option value="todos">Todos los planes</option>
                        <option value="pro_anual">PRO Anual ($139.99)</option>
                        <option value="pro_mensual">PRO Mensual ($17.99)</option>
                        <option value="vip">Mentoría Élite VIP ($49.99)</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Método de Pago</label>
                    <select id="payments-filter-method" class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono">
                        <option value="todos">Todos los métodos</option>
                        <option value="qr">QR Deuna! / Bancario</option>
                        <option value="transferencia">Transferencia Directa</option>
                        <option value="tarjeta">Tarjeta Visa / Mastercard</option>
                    </select>
                </div>
            </div>

            <!-- TABLA DE SOLICITUDES DE PAGO -->
            <div class="overflow-x-auto rounded-xl border border-surface-high">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">ID Solicitud / Fecha</th>
                            <th class="px-4 py-3">Estudiante / UID Lógico</th>
                            <th class="px-4 py-3">Plan / Contador Vigencia</th>
                            <th class="px-4 py-3">Titular / Banco / N° Ref</th>
                            <th class="px-4 py-3">Evidencia</th>
                            <th class="px-4 py-3">Estado / Comandos / Estatus Manual</th>
                        </tr>
                    </thead>
                    <tbody id="admin-payments-tbody">
                        <tr>
                            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                Inicializando bandeja bancaria...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById("btn-refresh-payments")?.addEventListener("click", () => {
        loadPaymentRequests();
    });

    document.getElementById("btn-export-payments-csv")?.addEventListener("click", () => {
        exportFilteredPaymentsCSV();
    });

    document.getElementById("payments-search-input")?.addEventListener("input", (e) => {
        activeSearchQuery = e.target.value.trim().toLowerCase();
        renderFilteredPaymentRows();
    });

    document.getElementById("payments-filter-status")?.addEventListener("change", (e) => {
        activeFilterStatus = e.target.value;
        renderFilteredPaymentRows();
    });

    document.getElementById("payments-filter-plan")?.addEventListener("change", (e) => {
        activeFilterPlan = e.target.value;
        renderFilteredPaymentRows();
    });

    document.getElementById("payments-filter-method")?.addEventListener("change", (e) => {
        activeFilterMethod = e.target.value;
        renderFilteredPaymentRows();
    });
}

// ============================================================================
// 3. LECTURA EN FIRESTORE, AUTO-VENCIMIENTO Y DETECCIÓN DE DUPLICADOS
// ============================================================================

export async function loadPaymentRequests() {
    if (!hasMasterPaymentAccess()) return;

    const tbody = document.getElementById("admin-payments-tbody");
    const refreshIcon = document.getElementById("icon-payments-refresh");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-400 font-mono">
                    Consultando colección ${SAFE_COLLECTIONS.PAYMENTS} y verificando vigencias...
                </td>
            </tr>
        `;
    }
    refreshIcon?.classList.add("animate-spin");

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.PAYMENTS));
        const items = [];
        const counts = {};
        const autoExpirePromises = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const normalizedRef = normalizeReceiptNumber(data.numeroComprobante);
            if (normalizedRef) {
                counts[normalizedRef] = (counts[normalizedRef] || 0) + 1;
            }

            const rawItem = {
                id: docSnap.id,
                ...data,
                estado: data.estado || "pendiente"
            };

            rawItem.codigoSolicitud = buildLogicalPaymentID(rawItem);
            rawItem.codigoEstudiante = buildLogicalStudentUID(rawItem);
            rawItem.countdown = evaluatePlanCountdown(rawItem);

            // AUTO-EXPIRACIÓN AUTOMÁTICA: Si un plan estaba "aprobado" pero el contador llegó a 0 días
            if (rawItem.estado === "aprobado" && rawItem.countdown.active && rawItem.countdown.isExpired) {
                rawItem.estado = "vencido";
                autoExpirePromises.push(autoExpireStudentPlan(rawItem));
            }

            items.push(rawItem);
        });

        if (autoExpirePromises.length > 0) {
            await Promise.allSettled(autoExpirePromises);
        }

        items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        cachedPaymentRequests = items;
        receiptFrequencyMap = counts;

        updatePaymentKPIsAndStats();
        renderFilteredPaymentRows();
    } catch (err) {
        console.error("Error al cargar solicitudes_pago:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-6 text-center text-danger font-mono">
                        Error al consultar Firestore (${escapeHTML(err.message)}).
                    </td>
                </tr>
            `;
        }
    } finally {
        refreshIcon?.classList.remove("animate-spin");
    }
}

/**
 * Degrada automáticamente la cuenta del estudiante a Básico cuando su contador llega a 0.
 */
async function autoExpireStudentPlan(item) {
    try {
        const nowIso = new Date().toISOString();
        if (item.uid) {
            await setDoc(
                doc(db, SAFE_COLLECTIONS.USERS, item.uid),
                {
                    subscriptionLevel: "Básico",
                    estadoPago: "plan_expirado",
                    fechaExpiracionAutomatica: nowIso
                },
                { merge: true }
            );
        }
        await updateDoc(doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id), {
            estado: "vencido",
            motivoAuditoria: "Plan expirado automáticamente por cumplimiento de vigencia (0 días restantes)."
        });
    } catch (e) {
        console.warn("Aviso en auto-expiración de plan:", e);
    }
}

function normalizeReceiptNumber(rawRef) {
    if (!rawRef) return "";
    return String(rawRef).trim().toUpperCase().replace(/\s+/g, "");
}

function isDuplicateReceipt(rawRef) {
    const key = normalizeReceiptNumber(rawRef);
    if (!key) return false;
    return (receiptFrequencyMap[key] || 0) > 1;
}

function updatePaymentKPIsAndStats() {
    let pendingCount = 0;
    let approvedCount = 0;
    let expiringOrExpiredCount = 0;
    let duplicateCount = 0;
    let approvedRevenue = 0;

    cachedPaymentRequests.forEach(item => {
        const status = item.estado || "pendiente";
        const cd = item.countdown || evaluatePlanCountdown(item);

        if (status === "pendiente") pendingCount++;
        if (status === "aprobado") {
            approvedCount++;
            const amount = parseFloat(String(item.montoDeclarado || "0").replace(",", "."));
            if (!isNaN(amount)) {
                approvedRevenue += amount;
            }
        }
        if (status === "vencido") {
            const amount = parseFloat(String(item.montoDeclarado || "0").replace(",", "."));
            if (!isNaN(amount)) {
                approvedRevenue += amount;
            }
        }
        if (cd.isExpiringSoon || cd.isExpired || status === "vencido") {
            expiringOrExpiredCount++;
        }
        if (isDuplicateReceipt(item.numeroComprobante)) {
            duplicateCount++;
        }
    });

    const setElText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(text);
    };

    setElText("pay-stat-pending", pendingCount);
    setElText("pay-stat-approved", approvedCount);
    setElText("pay-stat-expiring", expiringOrExpiredCount);
    setElText("pay-stat-duplicates", duplicateCount);
    setElText("pay-stat-revenue", `$${approvedRevenue.toFixed(2)} USD`);

    setElText("kpi-admin-payments", pendingCount);
    setElText("kpi-admin-payments-total", `Total solicitudes: ${cachedPaymentRequests.length}`);
}

// ============================================================================
// 4. RENDERIZADO DE FILAS, CONTADOR ROJO Y FILTRADO INTERACTIVO
// ============================================================================

function getFilteredPaymentItems() {
    return cachedPaymentRequests.filter(item => {
        const status = item.estado || "pendiente";
        const plan = (item.planSolicitado || "").toLowerCase();
        const method = (item.metodoPago || "").toLowerCase();
        const duplicate = isDuplicateReceipt(item.numeroComprobante);
        const cd = item.countdown || evaluatePlanCountdown(item);

        if (activeFilterStatus === "duplicados") {
            if (!duplicate) return false;
        } else if (activeFilterStatus === "por_vencer") {
            if (!cd.isExpiringSoon) return false;
        } else if (activeFilterStatus === "vencido") {
            if (!cd.isExpired && status !== "vencido") return false;
        } else if (activeFilterStatus !== "todos" && status !== activeFilterStatus) {
            return false;
        }

        if (activeFilterPlan !== "todos" && plan !== activeFilterPlan) {
            return false;
        }

        if (activeFilterMethod !== "todos" && method !== activeFilterMethod) {
            return false;
        }

        if (activeSearchQuery) {
            const haystack = [
                item.codigoSolicitud,
                item.codigoEstudiante,
                item.estudianteNombre,
                item.estudianteEmail,
                item.estudianteTelefono,
                item.titularCuenta,
                item.cedulaTitular,
                item.bancoOrigen,
                item.numeroComprobante,
                item.planSolicitado,
                item.metodoPago
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!haystack.includes(activeSearchQuery)) {
                return false;
            }
        }

        return true;
    });
}

function renderFilteredPaymentRows() {
    const tbody = document.getElementById("admin-payments-tbody");
    if (!tbody) return;

    const filtered = getFilteredPaymentItems();

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500 font-mono">
                    No se encontraron solicitudes de pago con los criterios seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(item => {
        const duplicate = isDuplicateReceipt(item.numeroComprobante);
        const status = item.estado || "pendiente";
        const planKey = (item.planSolicitado || "pro_mensual").toLowerCase();
        const catalogInfo = OFFICIAL_PLAN_CATALOG[planKey] || {
            label: item.planSolicitado || "PRO",
            level: planKey === "vip" ? "VIP" : "PRO",
            expectedAmount: 18.60,
            durationDays: 30
        };

        const cd = item.countdown || evaluatePlanCountdown(item);
        const declaredAmount = parseFloat(String(item.montoDeclarado || "0").replace(",", "."));
        const amountMismatch =
            !isNaN(declaredAmount) &&
            catalogInfo.expectedAmount > 0 &&
            Math.abs(declaredAmount - catalogInfo.expectedAmount) > 0.5;

        // Resaltar la fila entera en rojo si está próxima a vencer, vencida o duplicada
        const highlightRedRow = duplicate || cd.isExpiringSoon || cd.isExpired;

        const tr = document.createElement("tr");
        tr.className = `border-b border-surface-high transition-colors ${
            highlightRedRow ? "bg-danger/10 hover:bg-danger/15" : "hover:bg-surface/60"
        }`;

        // Etiqueta de estado visual
        let statusBadgeHTML = "";
        if (status === "aprobado" && cd.isExpiringSoon) {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-danger/25 text-danger border border-danger font-extrabold text-[11px] animate-pulse">
                    🚨 POR VENCER (${cd.remainingDays}d)
                </span>
            `;
        } else if (status === "aprobado") {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/20 text-secondary border border-secondary/40 font-extrabold text-[11px]">
                    ✅ APROBADO (${catalogInfo.level})
                </span>
            `;
        } else if (status === "vencido" || cd.isExpired) {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-danger/30 text-danger border border-danger font-extrabold text-[11px]">
                    ⛔ PLAN VENCIDO (Básico)
                </span>
            `;
        } else if (status === "rechazado") {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-danger/20 text-danger border border-danger/40 font-extrabold text-[11px]">
                    ❌ RECHAZADO
                </span>
            `;
        } else {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/20 text-warning border border-warning/40 font-extrabold text-[11px]">
                    ⏳ PENDIENTE
                </span>
            `;
        }

        // Bloque visual del Contador de Vigencia
        let countdownHTML = `<div class="text-[10px] text-gray-500 mt-1.5">⏳ Contador inicia al aprobar el plan</div>`;
        if (cd.active) {
            const barColor = cd.isExpired || cd.isExpiringSoon ? "bg-danger" : "bg-secondary";
            const boxStyle = cd.isExpired || cd.isExpiringSoon
                ? "border-danger bg-danger/15 text-danger"
                : "border-secondary/40 bg-surface text-gray-200";

            countdownHTML = `
                <div class="mt-2 p-2 rounded-lg border ${boxStyle} text-[10px] space-y-1">
                    <div class="flex items-center justify-between font-extrabold">
                        <span>${cd.isExpired ? "⛔ EXPIRADO" : cd.isExpiringSoon ? "🚨 ALERTA ROJA" : "⏱️ VIGENCIA ACTIVA"}</span>
                        <span>${cd.remainingDays} días restantes</span>
                    </div>
                    <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div class="h-full ${barColor}" style="width: ${cd.progressPct}%"></div>
                    </div>
                    <div class="flex justify-between text-[9px] opacity-85">
                        <span>Inicio: ${escapeHTML(cd.startFormatted)}</span>
                        <span>Vence: ${escapeHTML(cd.endFormatted)}</span>
                    </div>
                </div>
            `;
        }

        tr.innerHTML = `
            <!-- 1. ID LÓGICO SOLICITUD Y FECHA -->
            <td class="px-4 py-3.5 align-top">
                <div class="inline-block px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-extrabold text-[10px] mb-1">
                    ${escapeHTML(item.codigoSolicitud)}
                </div>
                <div class="text-white font-bold">${escapeHTML(item.fechaHoraEnvioExacta || formatISOToEcuador(item.createdAt))}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">Fecha Comp.: <strong class="text-gray-300">${escapeHTML(item.fechaComprobante || "---")}</strong></div>
            </td>

            <!-- 2. DATOS DEL ESTUDIANTE Y UID LÓGICO -->
            <td class="px-4 py-3.5 align-top">
                <div class="text-white font-bold">${escapeHTML(item.estudianteNombre || "---")}</div>
                <div class="text-[10px] font-extrabold text-secondary mt-0.5">UID: ${escapeHTML(item.codigoEstudiante)}</div>
                <div class="text-[11px] text-primary break-all">${escapeHTML(item.estudianteEmail || "---")}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">${escapeHTML(item.estudianteTelefono || "Sin teléfono")}</div>
                ${item.estudianteCarrera ? `<span class="inline-block mt-1 px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-bold uppercase">Área: ${escapeHTML(item.estudianteCarrera)}</span>` : ""}
            </td>

            <!-- 3. PLAN SOLICITADO, MONTO Y CONTADOR DE VIGENCIA -->
            <td class="px-4 py-3.5 align-top min-w-[210px]">
                <span class="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-extrabold uppercase text-[10px]">
                    ${escapeHTML(catalogInfo.label)}
                </span>
                <div class="text-secondary font-extrabold text-sm mt-1">
                    $${escapeHTML(item.montoDeclarado || "0.00")} USD
                </div>
                ${
                    amountMismatch
                        ? `<div class="text-[10px] text-warning font-bold mt-0.5">⚠️ Oficial: $${catalogInfo.expectedAmount.toFixed(2)}</div>`
                        : ""
                }
                <div class="text-[10px] text-gray-400 uppercase mt-0.5">
                    Vía: <strong class="text-gray-200">${escapeHTML(item.metodoPago || "N/A")}</strong>
                </div>
                ${countdownHTML}
            </td>

            <!-- 4. DATOS BANCARIOS Y DETECCIÓN DE DUPLICADOS -->
            <td class="px-4 py-3.5 align-top">
                <div class="text-white">Titular: <strong>${escapeHTML(item.titularCuenta || "---")}</strong></div>
                <div class="text-[11px] text-gray-400">
                    CI/RUC: ${escapeHTML(item.cedulaTitular || "---")} • Banco: <strong class="text-gray-200">${escapeHTML(item.bancoOrigen || "---")}</strong>
                </div>
                <div class="text-[11px] mt-1 ${duplicate ? "text-danger font-extrabold" : "text-warning font-bold"}">
                    N° Ref: ${escapeHTML(item.numeroComprobante || "---")}
                    ${duplicate ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-danger/20 border border-danger text-[10px]">⚠️ DUPLICADO</span>' : ""}
                </div>
                ${
                    item.motivoAuditoria
                        ? `<div class="text-[10px] text-gray-400 italic mt-1">Nota: ${escapeHTML(item.motivoAuditoria)}</div>`
                        : ""
                }
            </td>

            <!-- 5. VISOR DE EVIDENCIA -->
            <td class="px-4 py-3.5 align-top">
                ${
                    item.comprobanteBase64
                        ? `<button type="button" class="btn-view-receipt px-3 py-1.5 rounded-lg bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-extrabold transition-all flex items-center gap-1">
                               <span>👁️ Ver Captura</span>
                           </button>
                           <div class="text-[10px] text-gray-500 mt-1 truncate max-w-[130px]" title="${escapeHTML(item.archivoNombre || "")}">
                               ${escapeHTML(item.archivoNombre || item.archivoTipo || "Adjunto")}
                           </div>`
                        : `<span class="text-gray-500 text-[11px]">Sin archivo adjunto</span>`
                }
            </td>

            <!-- 6. ESTADO, COMANDOS Y CAMBIO MANUAL DE ESTATUS DE CUENTA -->
            <td class="px-4 py-3.5 align-top space-y-2 min-w-[210px]">
                <div>${statusBadgeHTML}</div>

                <div class="flex flex-wrap gap-1.5 pt-0.5">
                    ${
                        status !== "aprobado"
                            ? `<button type="button" class="btn-approve-payment px-2.5 py-1.5 rounded-lg bg-secondary text-surface font-extrabold hover:bg-opacity-90 transition-all text-[11px]">
                                   ✅ Aprobar (${catalogInfo.level})
                               </button>`
                            : `<button type="button" class="btn-revert-payment px-2.5 py-1 rounded-lg bg-surface border border-gray-600 text-gray-300 hover:text-white text-[10px]">
                                   ↩ Revertir a Pendiente
                               </button>`
                    }
                    ${
                        status !== "rechazado"
                            ? `<button type="button" class="btn-reject-payment px-2.5 py-1.5 rounded-lg bg-danger/15 border border-danger/50 text-danger hover:bg-danger hover:text-white font-bold transition-all text-[11px]">
                                   ❌ Rechazar
                               </button>`
                            : ""
                    }
                </div>

                <!-- CONTROL MANUAL DE ESTATUS DE LA CUENTA -->
                <div class="pt-1.5 border-t border-surface-high">
                    <label class="block text-[9px] font-mono text-gray-400 uppercase mb-1">⚙️ Cambiar Estatus de Cuenta Manual:</label>
                    <div class="flex items-center gap-1">
                        <select class="select-manual-account-status flex-1 bg-surface border border-surface-high rounded-lg px-2 py-1 text-[10px] text-white focus:border-primary focus:outline-none">
                            <option value="">-- Elegir estatus --</option>
                            <option value="pro_anual">🟢 Activar PRO Anual (365 días)</option>
                            <option value="pro_mensual">🔵 Activar PRO Mensual (30 días)</option>
                            <option value="vip">🟣 Activar Élite VIP (30 días)</option>
                            <option value="vencido_basico">🔴 Expirar Plan → Pasar a Básico</option>
                            <option value="basico_gratis">⚪ Restablecer a Básico Gratis</option>
                        </select>
                        <button type="button" class="btn-apply-manual-status px-2 py-1 rounded-lg bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-surface font-extrabold text-[10px] transition-all">
                            Aplicar
                        </button>
                    </div>
                </div>
            </td>
        `;

        tr.querySelector(".btn-view-receipt")?.addEventListener("click", () => {
            previewPaymentReceipt(item.id);
        });

        tr.querySelector(".btn-approve-payment")?.addEventListener("click", () => {
            approvePaymentRequest(item.id);
        });

        tr.querySelector(".btn-reject-payment")?.addEventListener("click", () => {
            rejectPaymentRequest(item.id);
        });

        tr.querySelector(".btn-revert-payment")?.addEventListener("click", () => {
            revertPaymentToPending(item.id);
        });

        tr.querySelector(".btn-apply-manual-status")?.addEventListener("click", () => {
            const selectEl = tr.querySelector(".select-manual-account-status");
            const chosenStatus = selectEl?.value || "";
            if (!chosenStatus) {
                alert("Selecciona primero el estatus manual que deseas aplicar a la cuenta.");
                return;
            }
            changeAccountStatusManually(item.id, chosenStatus);
        });

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 5. ACCIONES DE APROBACIÓN, RECHAZO, REVERSIÓN Y ESTATUS MANUAL
// ============================================================================

export async function approvePaymentRequest(paymentId) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item) return;

    const duplicate = isDuplicateReceipt(item.numeroComprobante);
    const planKey = (item.planSolicitado || "pro_anual").toLowerCase();
    const catalog = OFFICIAL_PLAN_CATALOG[planKey] || OFFICIAL_PLAN_CATALOG.pro_anual;
    const newLevel = catalog.level || "PRO";
    const durationDays = catalog.durationDays || 365;

    let confirmMessage =
        `¿Confirmas el ingreso de $${item.montoDeclarado || "0.00"} USD ` +
        `de ${item.estudianteNombre} (${item.codigoSolicitud}) y deseas activarle el nivel ${newLevel} por ${durationDays} días?`;

    if (duplicate) {
        confirmMessage =
            `⚠️ ALERTA DE SEGURIDAD: El número de comprobante "${item.numeroComprobante}" aparece DUPLICADO.\n\n` +
            confirmMessage;
    }

    if (!confirm(confirmMessage)) return;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expirationIso = new Date(nowMs + durationDays * 86400000).toISOString();
    const adminEmail = auth.currentUser?.email || MASTER_ADMINS[0];

    try {
        if (item.uid) {
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, item.uid);
            await setDoc(
                userRef,
                {
                    codigoEstudiante: item.codigoEstudiante,
                    subscriptionLevel: newLevel,
                    planActivo: planKey,
                    estadoPago: "activo_verificado",
                    fechaActivacionPlan: nowIso,
                    fechaVencimientoPlan: expirationIso,
                    duracionDiasPlan: durationDays,
                    aprobadoPorAdmin: adminEmail
                },
                { merge: true }
            );
        }

        const paymentRef = doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id);
        await updateDoc(paymentRef, {
            codigoSolicitud: item.codigoSolicitud,
            codigoEstudiante: item.codigoEstudiante,
            estado: "aprobado",
            nivelActivado: newLevel,
            aprobadoEn: nowIso,
            fechaVencimientoPlan: expirationIso,
            duracionDiasPersonalizada: durationDays,
            aprobadoPor: adminEmail,
            motivoAuditoria: `Verificación aprobada. Vigencia iniciada por ${durationDays} días.`
        });

        alert(`✅ Nivel ${newLevel} activado por ${durationDays} días para ${item.estudianteNombre}.`);
        await loadPaymentRequests();
    } catch (err) {
        console.error("Error al aprobar el pago:", err);
        alert("Error al aprobar el plan en Firestore: " + err.message);
    }
}

/**
 * Permite cambiar manualmente el estatus de la cuenta y reiniciar o finalizar el contador.
 */
export async function changeAccountStatusManually(paymentId, mode) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item) return;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const adminEmail = auth.currentUser?.email || MASTER_ADMINS[0];

    let targetLevel = "Básico";
    let targetPlanKey = "basico";
    let targetPaymentState = "vencido";
    let targetUserPayState = "plan_expirado";
    let durationDays = 0;
    let expirationIso = nowIso;
    let auditNote = "";

    if (mode === "pro_anual") {
        targetLevel = "PRO";
        targetPlanKey = "pro_anual";
        targetPaymentState = "aprobado";
        targetUserPayState = "activo_verificado";
        durationDays = 365;
        expirationIso = new Date(nowMs + 365 * 86400000).toISOString();
        auditNote = "Activado manualmente como PRO Anual (365 días) por administración.";
    } else if (mode === "pro_mensual") {
        targetLevel = "PRO";
        targetPlanKey = "pro_mensual";
        targetPaymentState = "aprobado";
        targetUserPayState = "activo_verificado";
        durationDays = 30;
        expirationIso = new Date(nowMs + 30 * 86400000).toISOString();
        auditNote = "Activado manualmente como PRO Mensual (30 días) por administración.";
    } else if (mode === "vip") {
        targetLevel = "VIP";
        targetPlanKey = "vip";
        targetPaymentState = "aprobado";
        targetUserPayState = "activo_verificado";
        durationDays = 30;
        expirationIso = new Date(nowMs + 30 * 86400000).toISOString();
        auditNote = "Activado manualmente como Mentoría VIP (30 días) por administración.";
    } else if (mode === "vencido_basico") {
        targetLevel = "Básico";
        targetPlanKey = "basico";
        targetPaymentState = "vencido";
        targetUserPayState = "plan_expirado";
        durationDays = 0;
        auditNote = "Plan marcado como Expirado y cuenta degradada a Básico manualmente.";
    } else if (mode === "basico_gratis") {
        targetLevel = "Básico";
        targetPlanKey = "basico";
        targetPaymentState = "pendiente";
        targetUserPayState = "activo_gratis";
        durationDays = 0;
        auditNote = "Cuenta restablecida manualmente a Plan Básico Gratis.";
    } else {
        return;
    }

    if (!confirm(`¿Confirmas cambiar manualmente el estatus de ${item.estudianteNombre} a "${targetLevel}" (${auditNote})?`)) {
        return;
    }

    try {
        if (item.uid) {
            await setDoc(
                doc(db, SAFE_COLLECTIONS.USERS, item.uid),
                {
                    codigoEstudiante: item.codigoEstudiante,
                    subscriptionLevel: targetLevel,
                    planActivo: targetPlanKey,
                    estadoPago: targetUserPayState,
                    fechaActivacionPlan: durationDays > 0 ? nowIso : null,
                    fechaVencimientoPlan: durationDays > 0 ? expirationIso : nowIso,
                    actualizadoManualPor: adminEmail
                },
                { merge: true }
            );
        }

        await updateDoc(doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id), {
            codigoSolicitud: item.codigoSolicitud,
            codigoEstudiante: item.codigoEstudiante,
            planSolicitado: durationDays > 0 ? targetPlanKey : item.planSolicitado,
            estado: targetPaymentState,
            nivelActivado: targetLevel,
            aprobadoEn: durationDays > 0 ? nowIso : (item.aprobadoEn || null),
            fechaVencimientoPlan: durationDays > 0 ? expirationIso : nowIso,
            duracionDiasPersonalizada: durationDays,
            aprobadoPor: adminEmail,
            motivoAuditoria: auditNote
        });

        await loadPaymentRequests();
    } catch (err) {
        alert("Error al cambiar manualmente el estatus: " + err.message);
    }
}

export async function rejectPaymentRequest(paymentId) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item) return;

    const reason = prompt(
        `Indica el motivo del rechazo para el comprobante de ${item.estudianteNombre}:`,
        "Comprobante ilegible, número de referencia inválido o pago no reflejado en cuenta."
    );

    if (reason === null) return;

    const nowIso = new Date().toISOString();
    const adminEmail = auth.currentUser?.email || MASTER_ADMINS[0];

    try {
        if (item.uid) {
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, item.uid);
            await setDoc(
                userRef,
                {
                    subscriptionLevel: "Básico",
                    estadoPago: "comprobante_rechazado",
                    observacionPago: reason.trim()
                },
                { merge: true }
            );
        }

        const paymentRef = doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id);
        await updateDoc(paymentRef, {
            estado: "rechazado",
            rechazadoEn: nowIso,
            rechazadoPor: adminEmail,
            motivoAuditoria: reason.trim()
        });

        alert(`❌ Solicitud de ${item.estudianteNombre} marcada como rechazada.`);
        await loadPaymentRequests();
    } catch (err) {
        console.error("Error al rechazar la solicitud:", err);
        alert("Error al actualizar el estado en Firestore: " + err.message);
    }
}

export async function revertPaymentToPending(paymentId) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item) return;

    if (!confirm(`¿Deseas revertir la solicitud de ${item.estudianteNombre} al estado PENDIENTE y regresar su cuenta temporalmente al Plan Básico?`)) {
        return;
    }

    try {
        if (item.uid) {
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, item.uid);
            await setDoc(
                userRef,
                {
                    subscriptionLevel: "Básico",
                    estadoPago: "pendiente_verificacion"
                },
                { merge: true }
            );
        }

        const paymentRef = doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id);
        await updateDoc(paymentRef, {
            estado: "pendiente",
            motivoAuditoria: "Revertido a pendiente por administración."
        });

        await loadPaymentRequests();
    } catch (err) {
        alert("Error al revertir la solicitud: " + err.message);
    }
}

// ============================================================================
// 6. VISOR MODAL Y EXTERNO DE EVIDENCIAS BANCARIAS (JPG / PNG / PDF)
// ============================================================================

function renderReceiptPreviewModal() {
    if (document.getElementById("admin-receipt-modal")) return;

    const modal = document.createElement("div");
    modal.id = "admin-receipt-modal";
    modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-sm p-4";

    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-[0_0_40px_rgba(0,229,255,0.25)] overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-surface border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        Auditoría de Evidencia Bancaria • MakaiAcademy
                    </span>
                    <h4 class="text-base font-extrabold text-white mt-0.5" id="receipt-modal-title">
                        Comprobante de Pago
                    </h4>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" id="btn-receipt-open-tab" class="px-3 py-1.5 rounded-lg bg-surface-high border border-primary/50 text-primary hover:bg-primary hover:text-surface text-xs font-extrabold transition-all">
                        ↗ Abrir en Pestaña Nueva
                    </button>
                    <button type="button" id="btn-receipt-close" class="px-3 py-1.5 rounded-lg bg-surface-high text-gray-300 hover:text-white text-xs font-extrabold">
                        ✕ Cerrar
                    </button>
                </div>
            </div>

            <div class="px-6 py-3 bg-surface/60 border-b border-surface-high text-xs font-mono text-gray-300 grid grid-cols-1 sm:grid-cols-3 gap-2" id="receipt-modal-meta">
            </div>

            <div class="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-[#06090e]" id="receipt-modal-body">
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    document.getElementById("btn-receipt-close")?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
}

export function previewPaymentReceipt(paymentId) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item || !item.comprobanteBase64) {
        alert("Esta solicitud no contiene un archivo adjunto en Base64.");
        return;
    }

    renderReceiptPreviewModal();

    const modal = document.getElementById("admin-receipt-modal");
    const titleEl = document.getElementById("receipt-modal-title");
    const metaEl = document.getElementById("receipt-modal-meta");
    const bodyEl = document.getElementById("receipt-modal-body");
    const openTabBtn = document.getElementById("btn-receipt-open-tab");

    const duplicate = isDuplicateReceipt(item.numeroComprobante);

    if (titleEl) {
        titleEl.textContent = `${item.codigoSolicitud} • ${item.estudianteNombre || "Estudiante"}`;
    }

    if (metaEl) {
        metaEl.innerHTML = `
            <div><strong>Titular:</strong> ${escapeHTML(item.titularCuenta || "---")} (${escapeHTML(item.cedulaTitular || "---")})</div>
            <div><strong>Banco / Método:</strong> ${escapeHTML(item.bancoOrigen || "---")} (${escapeHTML(item.metodoPago || "---")})</div>
            <div>
                <strong>Ref:</strong> <span class="${duplicate ? "text-danger font-extrabold" : "text-warning"}">${escapeHTML(item.numeroComprobante || "---")}</span>
                • <strong>Monto:</strong> <span class="text-secondary font-extrabold">$${escapeHTML(item.montoDeclarado || "0.00")}</span>
            </div>
        `;
    }

    if (bodyEl) {
        if (item.archivoTipo === "application/pdf" || String(item.comprobanteBase64).startsWith("data:application/pdf")) {
            bodyEl.innerHTML = `
                <iframe
                    src="${item.comprobanteBase64}"
                    class="w-full h-[65vh] rounded-xl border border-primary/40 bg-white"
                    title="Comprobante PDF"
                ></iframe>
            `;
        } else {
            bodyEl.innerHTML = `
                <img
                    src="${item.comprobanteBase64}"
                    alt="Comprobante Bancario"
                    class="max-w-full max-h-[65vh] rounded-xl border-2 border-primary shadow-lg object-contain"
                />
            `;
        }
    }

    if (openTabBtn) {
        openTabBtn.onclick = () => {
            openReceiptInNewWindow(item);
        };
    }

    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
}

function openReceiptInNewWindow(item) {
    const win = window.open("", "_blank");
    if (!win) {
        alert("Permite las ventanas emergentes para abrir el comprobante en una pestaña nueva.");
        return;
    }

    if (item.archivoTipo === "application/pdf" || String(item.comprobanteBase64).startsWith("data:application/pdf")) {
        win.document.write(`<iframe src="${item.comprobanteBase64}" style="width:100%;height:100vh;border:none;"></iframe>`);
    } else {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>Comprobante ${escapeHTML(item.numeroComprobante || "")}</title></head>
            <body style="margin:0;background:#06090e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:monospace;">
                <div style="padding:14px;text-align:center;">
                    <strong>ID:</strong> ${escapeHTML(item.codigoSolicitud || "---")} |
                    <strong>Estudiante:</strong> ${escapeHTML(item.estudianteNombre || "---")} |
                    <strong>Ref:</strong> ${escapeHTML(item.numeroComprobante || "---")} |
                    <strong>Monto:</strong> $${escapeHTML(item.montoDeclarado || "0.00")} USD
                </div>
                <img src="${item.comprobanteBase64}" style="max-width:95%;max-height:85vh;border:2px solid #00e5ff;border-radius:12px;"/>
            </body>
            </html>
        `);
    }
}

// ============================================================================
// 7. EXPORTACIÓN CONTABLE EN FORMATO .CSV COMPATIBLE CON EXCEL
// ============================================================================

export function exportFilteredPaymentsCSV() {
    if (!hasMasterPaymentAccess()) return;

    const rowsData = getFilteredPaymentItems();
    if (rowsData.length === 0) {
        alert("No hay registros en la vista actual para exportar.");
        return;
    }

    const headers = [
        "ID_Solicitud_Logico",
        "UID_Estudiante_Logico",
        "Fecha_Hora_Envio",
        "Fecha_Comprobante",
        "Estudiante",
        "Correo",
        "Telefono",
        "Plan_Solicitado",
        "Metodo_Pago",
        "Monto_Declarado_USD",
        "Titular_Cuenta",
        "Cedula_RUC_Titular",
        "Banco_Origen",
        "Numero_Comprobante",
        "Alerta_Duplicado",
        "Estado_Auditoria",
        "Dias_Restantes_Vigencia",
        "Fecha_Vencimiento_Plan",
        "Aprobado_Por",
        "Observacion_Auditoria"
    ];

    const csvLines = [headers.join(";")];

    rowsData.forEach(item => {
        const duplicate = isDuplicateReceipt(item.numeroComprobante) ? "SI_DUPLICADO" : "NO";
        const cd = item.countdown || evaluatePlanCountdown(item);
        const remainingLabel = cd.active ? `${cd.remainingDays} dias` : "N/A";
        const endLabel = cd.active ? cd.endFormatted : "---";

        const row = [
            item.codigoSolicitud || buildLogicalPaymentID(item),
            item.codigoEstudiante || buildLogicalStudentUID(item),
            item.fechaHoraEnvioExacta || item.createdAt || "",
            item.fechaComprobante || "",
            item.estudianteNombre || "",
            item.estudianteEmail || "",
            item.estudianteTelefono || "",
            item.planSolicitado || "",
            item.metodoPago || "",
            item.montoDeclarado || "0.00",
            item.titularCuenta || "",
            item.cedulaTitular || "",
            item.bancoOrigen || "",
            item.numeroComprobante || "",
            duplicate,
            item.estado || "pendiente",
            remainingLabel,
            endLabel,
            item.aprobadoPor || "",
            item.motivoAuditoria || ""
        ].map(val => `"${String(val).replace(/"/g, '""')}"`);

        csvLines.push(row.join(";"));
    });

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
        type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];

    link.href = url;
    link.download = `Auditoria_Pagos_MakaiAcademy_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// 8. UTILIDADES DE FORMATO Y SANEAMIENTO HTML
// ============================================================================

function formatISOToEcuador(isoStr) {
    if (!isoStr) return "---";
    try {
        return new Date(isoStr).toLocaleString("es-EC", {
            timeZone: "America/Guayaquil"
        });
    } catch (e) {
        return isoStr;
    }
}

function escapeHTML(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
