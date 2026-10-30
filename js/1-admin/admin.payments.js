// ============================================================================
// ARCHIVO: js/1-admin/admin.payments.js
// DESCRIPCIÓN: Subcomponente de Verificación Bancaria, Detección de
//              Comprobantes Duplicados, Visor de Evidencias (JPG/PNG/PDF) y
//              Activación de Planes PRO y VIP en Cloud Firestore.
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

// Catálogo de precios oficiales actualizados ($18.60 mensual y $144.75 anual con 35% de descuento)
const OFFICIAL_PLAN_CATALOG = {
    basico: { label: "Plan Básico", level: "Básico", expectedAmount: 0.00 },
    pro_mensual: { label: "Makai PRO Mensual", level: "PRO", expectedAmount: 18.60 },
    pro_anual: { label: "Makai PRO Anual", level: "PRO", expectedAmount: 144.75 },
    vip: { label: "Mentoría Élite VIP", level: "VIP", expectedAmount: 49.99 },
    tesis_1a1: { label: "Vinculación Tesis 1 a 1", level: "PRO", expectedAmount: 10.00 }
};

// Estado interno del módulo de pagos
let cachedPaymentRequests = [];
let receiptFrequencyMap = {};
let activeFilterStatus = "todos";
let activeFilterMethod = "todos";
let activeFilterPlan = "todos";
let activeSearchQuery = "";

// ============================================================================
// 1. VALIDACIÓN DE SEGURIDAD DE CUENTAS MAESTRAS
// ============================================================================

/**
 * Verifica que la sesión activa pertenezca exclusivamente a uno de los
 * Administradores Maestros (anthonnyvelastegui@gmail.com | aavemakaihc@gmail.com).
 * @returns {boolean}
 */
function hasMasterPaymentAccess() {
    const email =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";
    return isMasterAdmin(email);
}

// ============================================================================
// 2. INICIALIZADOR DEL SUBCOMPONENTE DE PAGOS
// ============================================================================

/**
 * Inicializa la Bandeja de Verificación Bancaria dentro de #view-admin,
 * construye su interfaz táctica y consulta las solicitudes en Firestore.
 */
export async function initAdminPayments() {
    if (!hasMasterPaymentAccess()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    renderAdminPaymentsSection(adminView);
    renderReceiptPreviewModal();
    await loadPaymentRequests();
}

/**
 * Construye o actualiza el contenedor #admin-payments-section en #view-admin,
 * asegurando compatibilidad con el selector de sub-pestañas de admin.controller.js.
 * @param {HTMLElement} adminView
 */
function renderAdminPaymentsSection(adminView) {
    let section =
        document.getElementById("admin-payments-section") ||
        document.getElementById("admin-payments-inbox");

    if (!section) {
        section = document.createElement("section");
        section.id = "admin-payments-section";
        section.className = "mb-10 space-y-5";

        // Insertar después de la bóveda de respaldos o de la cabecera de comando
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
                            Bóveda: ${PAYMENT_ASSETS_PATHS.QR_FOLDER}
                        </span>
                    </div>
                    <h3 class="text-xl font-extrabold text-warning flex items-center gap-2 mt-1.5">
                        <span class="material-symbols-outlined">receipt_long</span>
                        <span>Bandeja de Verificación de Pagos y Activación PRO / VIP</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Inspecciona capturas (JPG/PNG/PDF), detecta números de referencia duplicados y activa los planes <strong class="text-primary">Makai PRO</strong> ($18.60 / $144.75) o <strong class="text-secondary">Mentoría VIP</strong> ($49.99).
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
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-surface border border-warning/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-warning uppercase block">Pendientes de Revisión</span>
                    <div class="text-xl font-extrabold text-warning font-mono mt-0.5" id="pay-stat-pending">0</div>
                </div>
                <div class="bg-surface border border-secondary/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-secondary uppercase block">Planes Aprobados</span>
                    <div class="text-xl font-extrabold text-secondary font-mono mt-0.5" id="pay-stat-approved">0</div>
                </div>
                <div class="bg-surface border border-danger/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-danger uppercase block">Alertas Ref. Duplicada</span>
                    <div class="text-xl font-extrabold text-danger font-mono mt-0.5" id="pay-stat-duplicates">0</div>
                </div>
                <div class="bg-surface border border-primary/30 rounded-xl p-3">
                    <span class="text-[10px] font-mono text-primary uppercase block">Recaudación Aprobada</span>
                    <div class="text-xl font-extrabold text-white font-mono mt-0.5" id="pay-stat-revenue">$0.00 USD</div>
                </div>
            </div>

            <!-- BARRA DE FILTROS Y BÚSQUEDA -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="lg:col-span-2">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Buscar Alumno, Correo, CI/RUC o N° Comprobante</label>
                    <div class="relative">
                        <input
                            type="text"
                            id="payments-search-input"
                            placeholder="Ej: 0987654321, Pichincha, Deuna, correo..."
                            class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Estado de Auditoría</label>
                    <select id="payments-filter-status" class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono">
                        <option value="todos">Todos los estados</option>
                        <option value="pendiente">⏳ Pendientes</option>
                        <option value="aprobado">✅ Aprobados</option>
                        <option value="rechazado">❌ Rechazados / Observados</option>
                        <option value="duplicados">⚠️ Solo N° Ref. Duplicados</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Plan Solicitado</label>
                    <select id="payments-filter-plan" class="w-full bg-surface-container border border-surface-high rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-mono">
                        <option value="todos">Todos los planes</option>
                        <option value="pro_anual">PRO Anual ($144.75)</option>
                        <option value="pro_mensual">PRO Mensual ($18.60)</option>
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
                            <th class="px-4 py-3">Fecha Envío / Comprobante</th>
                            <th class="px-4 py-3">Estudiante</th>
                            <th class="px-4 py-3">Plan / Monto</th>
                            <th class="px-4 py-3">Titular / Banco / N° Ref</th>
                            <th class="px-4 py-3">Evidencia</th>
                            <th class="px-4 py-3">Estado / Acción</th>
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

    // Enlazar eventos de controles y filtros
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
// 3. LECTURA DE SOLICITUDES EN FIRESTORE Y DETECCIÓN DE DUPLICADOS
// ============================================================================

/**
 * Consulta la colección solicitudes_pago en Cloud Firestore, calcula frecuencias
 * de números de comprobante para detectar duplicados y actualiza la tabla y KPIs.
 */
export async function loadPaymentRequests() {
    if (!hasMasterPaymentAccess()) return;

    const tbody = document.getElementById("admin-payments-tbody");
    const refreshIcon = document.getElementById("icon-payments-refresh");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-400 font-mono">
                    Consultando colección ${SAFE_COLLECTIONS.PAYMENTS} en Cloud Firestore...
                </td>
            </tr>
        `;
    }
    refreshIcon?.classList.add("animate-spin");

    try {
        const snap = await getDocs(collection(db, SAFE_COLLECTIONS.PAYMENTS));
        const items = [];
        const counts = {};

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const normalizedRef = normalizeReceiptNumber(data.numeroComprobante);
            if (normalizedRef) {
                counts[normalizedRef] = (counts[normalizedRef] || 0) + 1;
            }
            items.push({
                id: docSnap.id,
                ...data,
                estado: data.estado || "pendiente"
            });
        });

        // Ordenar desde el más reciente al más antiguo
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
                        Error al consultar Firestore (${escapeHTML(err.message)}). Verifica las Reglas de Seguridad.
                    </td>
                </tr>
            `;
        }
    } finally {
        refreshIcon?.classList.remove("animate-spin");
    }
}

/**
 * Normaliza el número de comprobante para detectar duplicados incluso si el
 * usuario añadió espacios o ceros a la izquierda.
 * @param {string} rawRef
 * @returns {string}
 */
function normalizeReceiptNumber(rawRef) {
    if (!rawRef) return "";
    return String(rawRef).trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Comprueba si un número de comprobante aparece más de una vez en Firestore.
 * @param {string} rawRef
 * @returns {boolean}
 */
function isDuplicateReceipt(rawRef) {
    const key = normalizeReceiptNumber(rawRef);
    if (!key) return false;
    return (receiptFrequencyMap[key] || 0) > 1;
}

/**
 * Actualiza tanto las tarjetas de la Bandeja Bancaria como los KPIs globales
 * inyectados por admin.controller.js en la cabecera del panel.
 */
function updatePaymentKPIsAndStats() {
    let pendingCount = 0;
    let approvedCount = 0;
    let duplicateCount = 0;
    let approvedRevenue = 0;

    cachedPaymentRequests.forEach(item => {
        const status = item.estado || "pendiente";
        if (status === "pendiente") pendingCount++;
        if (status === "aprobado") {
            approvedCount++;
            const amount = parseFloat(String(item.montoDeclarado || "0").replace(",", "."));
            if (!isNaN(amount)) {
                approvedRevenue += amount;
            }
        }
        if (isDuplicateReceipt(item.numeroComprobante)) {
            duplicateCount++;
        }
    });

    const setElText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(text);
    };

    // Sub-métricas internas del módulo
    setElText("pay-stat-pending", pendingCount);
    setElText("pay-stat-approved", approvedCount);
    setElText("pay-stat-duplicates", duplicateCount);
    setElText("pay-stat-revenue", `$${approvedRevenue.toFixed(2)} USD`);

    // Sincronización con los KPIs de admin.controller.js
    setElText("kpi-admin-payments", pendingCount);
    setElText("kpi-admin-payments-total", `Total solicitudes: ${cachedPaymentRequests.length}`);
}

// ============================================================================
// 4. RENDERIZADO DE FILAS Y FILTRADO INTERACTIVO
// ============================================================================

/**
 * Obtiene la lista de solicitudes que cumplen con los filtros activos.
 * @returns {Array<Object>}
 */
function getFilteredPaymentItems() {
    return cachedPaymentRequests.filter(item => {
        const status = item.estado || "pendiente";
        const plan = (item.planSolicitado || "").toLowerCase();
        const method = (item.metodoPago || "").toLowerCase();
        const duplicate = isDuplicateReceipt(item.numeroComprobante);

        if (activeFilterStatus === "duplicados") {
            if (!duplicate) return false;
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

/**
 * Renderiza en #admin-payments-tbody las filas filtradas con sus botones de acción.
 */
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
            expectedAmount: 18.60
        };

        const declaredAmount = parseFloat(String(item.montoDeclarado || "0").replace(",", "."));
        const amountMismatch =
            !isNaN(declaredAmount) &&
            catalogInfo.expectedAmount > 0 &&
            Math.abs(declaredAmount - catalogInfo.expectedAmount) > 0.5;

        const tr = document.createElement("tr");
        tr.className = `border-b border-surface-high transition-colors ${
            duplicate ? "bg-danger/5 hover:bg-danger/10" : "hover:bg-surface/60"
        }`;

        // Etiqueta de estado visual
        let statusBadgeHTML = "";
        if (status === "aprobado") {
            statusBadgeHTML = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/20 text-secondary border border-secondary/40 font-extrabold text-[11px]">
                    ✅ APROBADO (${catalogInfo.level})
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

        tr.innerHTML = `
            <!-- 1. FECHA ENVÍO / COMPROBANTE -->
            <td class="px-4 py-3.5 align-top">
                <div class="text-white font-bold">${escapeHTML(item.fechaHoraEnvioExacta || formatISOToEcuador(item.createdAt))}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">Fecha Comp.: <strong class="text-gray-300">${escapeHTML(item.fechaComprobante || "---")}</strong></div>
                <div class="text-[10px] text-gray-500 mt-0.5">ID: ${escapeHTML(item.id.slice(0, 8))}...</div>
            </td>

            <!-- 2. DATOS DEL ESTUDIANTE -->
            <td class="px-4 py-3.5 align-top">
                <div class="text-white font-bold">${escapeHTML(item.estudianteNombre || "---")}</div>
                <div class="text-[11px] text-primary break-all">${escapeHTML(item.estudianteEmail || "---")}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">${escapeHTML(item.estudianteTelefono || "Sin teléfono")}</div>
                ${item.estudianteCarrera ? `<span class="inline-block mt-1 px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-bold uppercase">Área: ${escapeHTML(item.estudianteCarrera)}</span>` : ""}
            </td>

            <!-- 3. PLAN SOLICITADO Y MONTO -->
            <td class="px-4 py-3.5 align-top">
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

            <!-- 6. ESTADO Y ACCIONES DE APROBACIÓN / RECHAZO -->
            <td class="px-4 py-3.5 align-top space-y-1.5">
                <div>${statusBadgeHTML}</div>
                <div class="flex flex-wrap gap-1.5 pt-1">
                    ${
                        status !== "aprobado"
                            ? `<button type="button" class="btn-approve-payment px-2.5 py-1.5 rounded-lg bg-secondary text-surface font-extrabold hover:bg-opacity-90 transition-all text-[11px]">
                                   ✅ Aprobar ${catalogInfo.level}
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
            </td>
        `;

        // Enlazar eventos de la fila
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

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 5. ACCIONES DE APROBACIÓN, RECHAZO Y REVERSIÓN EN FIRESTORE
// ============================================================================

/**
 * Aprueba una solicitud bancaria, activa el nivel PRO o VIP en el documento del
 * estudiante dentro de la colección "usuarios" y actualiza "solicitudes_pago".
 * @param {string} paymentId
 */
export async function approvePaymentRequest(paymentId) {
    if (!hasMasterPaymentAccess()) return;

    const item = cachedPaymentRequests.find(p => p.id === paymentId);
    if (!item) return;

    const duplicate = isDuplicateReceipt(item.numeroComprobante);
    const newLevel = (item.planSolicitado || "").toLowerCase() === "vip" ? "VIP" : "PRO";

    let confirmMessage =
        `¿Confirmas que ya verificaste en tu banco el ingreso de $${item.montoDeclarado || "0.00"} USD ` +
        `de ${item.estudianteNombre} (Ref: ${item.numeroComprobante || "S/N"}) y deseas activarle el nivel ${newLevel}?`;

    if (duplicate) {
        confirmMessage =
            `⚠️ ALERTA DE SEGURIDAD: El número de comprobante "${item.numeroComprobante}" aparece DUPLICADO en la base de datos.\n\n` +
            confirmMessage;
    }

    if (!confirm(confirmMessage)) return;

    const nowIso = new Date().toISOString();
    const adminEmail = auth.currentUser?.email || MASTER_ADMINS[0];

    try {
        // 1. Actualizar el perfil del estudiante en la colección "usuarios"
        if (item.uid) {
            const userRef = doc(db, SAFE_COLLECTIONS.USERS, item.uid);
            await setDoc(
                userRef,
                {
                    subscriptionLevel: newLevel,
                    planActivo: item.planSolicitado || "pro_mensual",
                    estadoPago: "activo_verificado",
                    fechaActivacionPlan: nowIso,
                    aprobadoPorAdmin: adminEmail
                },
                { merge: true }
            );
        }

        // 2. Actualizar el documento en la colección "solicitudes_pago"
        const paymentRef = doc(db, SAFE_COLLECTIONS.PAYMENTS, item.id);
        await updateDoc(paymentRef, {
            estado: "aprobado",
            nivelActivado: newLevel,
            aprobadoEn: nowIso,
            aprobadoPor: adminEmail,
            motivoAuditoria: "Verificación bancaria aprobada satisfactoriamente."
        });

        alert(`✅ Nivel ${newLevel} activado exitosamente para ${item.estudianteNombre}.`);
        await loadPaymentRequests();
    } catch (err) {
        console.error("Error al aprobar el pago:", err);
        alert("Error al aprobar el plan en Firestore: " + err.message);
    }
}

/**
 * Rechaza u observa una solicitud de pago dejando constancia del motivo en Firestore.
 * @param {string} paymentId
 */
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

/**
 * Revierte una solicitud aprobada o rechazada de vuelta al estado "pendiente"
 * y restablece preventivamente la suscripción del usuario a "Básico".
 * @param {string} paymentId
 */
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

/**
 * Inyecta el visor modal de comprobantes en el documento si aún no existe.
 */
function renderReceiptPreviewModal() {
    if (document.getElementById("admin-receipt-modal")) return;

    const modal = document.createElement("div");
    modal.id = "admin-receipt-modal";
    modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-sm p-4";

    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-[0_0_40px_rgba(0,229,255,0.25)] overflow-hidden">
            <!-- Cabecera del Visor -->
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

            <!-- Metadatos de Auditoría -->
            <div class="px-6 py-3 bg-surface/60 border-b border-surface-high text-xs font-mono text-gray-300 grid grid-cols-1 sm:grid-cols-3 gap-2" id="receipt-modal-meta">
            </div>

            <!-- Lienzo de Imagen o PDF -->
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

/**
 * Abre el visor de evidencias para inspeccionar el comprobante Base64 (JPG/PNG/PDF)
 * de una solicitud específica.
 * @param {string} paymentId
 */
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
        titleEl.textContent = `${item.estudianteNombre || "Estudiante"} • Plan ${(item.planSolicitado || "PRO").toUpperCase()}`;
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

/**
 * Abre el comprobante en una pestaña independiente del navegador.
 * @param {Object} item
 */
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

/**
 * Descarga un archivo .CSV con codificación UTF-8 con BOM (\uFEFF) y separador
 * de punto y coma (;) con las solicitudes de pago filtradas actualmente.
 */
export function exportFilteredPaymentsCSV() {
    if (!hasMasterPaymentAccess()) return;

    const rowsData = getFilteredPaymentItems();
    if (rowsData.length === 0) {
        alert("No hay registros en la vista actual para exportar.");
        return;
    }

    const headers = [
        "ID_Solicitud",
        "UID_Estudiante",
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
        "Aprobado_Por",
        "Observacion_Auditoria"
    ];

    const csvLines = [headers.join(";")];

    rowsData.forEach(item => {
        const duplicate = isDuplicateReceipt(item.numeroComprobante) ? "SI_DUPLICADO" : "NO";
        const row = [
            item.id || "",
            item.uid || "",
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

/**
 * Formatea una fecha ISO a la zona horaria oficial de Ecuador (America/Guayaquil).
 * @param {string} isoStr
 * @returns {string}
 */
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

/**
 * Escapa caracteres especiales para prevenir inyecciones de HTML al renderizar
 * datos enviados por usuarios en la tabla administrativa.
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
