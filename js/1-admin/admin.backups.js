// ============================================================================
// ARCHIVO: js/1-admin/admin.backups.js
// DESCRIPCIÓN: Bóveda de Seguridad para exportación total (.JSON), reportes 
//              contables/académicos (.CSV Excel) y restauración de Firestore.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    doc,
    setDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

// ============================================================================
// 1. VERIFICACIÓN INTERNA DE SEGURIDAD
// ============================================================================

/**
 * Valida que el usuario actual tenga credenciales de Administrador Maestro.
 * @returns {boolean}
 */
function verifyAdminAccess() {
    const activeEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    if (!isMasterAdmin(activeEmail)) {
        alert("⛔ Acceso denegado: Función exclusiva para Administradores Maestros de Makai Academy.");
        return false;
    }
    return true;
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (Zona horaria de Ecuador).
 * @returns {string}
 */
function getEcuadorDateStamp() {
    const now = new Date();
    const ecTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
    const year = ecTime.getFullYear();
    const month = String(ecTime.getMonth() + 1).padStart(2, "0");
    const day = String(ecTime.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Escapa valores de texto para celdas CSV compatibles con Microsoft Excel.
 * @param {any} val
 * @returns {string}
 */
function escapeCSVCell(val) {
    if (val === null || val === undefined) return '""';
    const cleaned = String(val)
        .replace(/\r?\n|\r/g, " ")
        .replace(/"/g, '""')
        .trim();
    return `"${cleaned}"`;
}

// ============================================================================
// 2. INICIALIZADOR DE INTERFAZ Y EVENTOS (BÓVEDA DE SEGURIDAD)
// ============================================================================

/**
 * Inicializa la Bóveda de Respaldo en el Panel de Administrador y enlaza sus botones.
 */
export function initAdminBackups() {
    const activeEmail = auth.currentUser?.email || appState.currentUserData?.email || "";
    if (!isMasterAdmin(activeEmail)) return;

    renderBackupVaultUI();

    const btnJson = document.getElementById("btn-backup-json");
    const btnUsersCsv = document.getElementById("btn-backup-excel");
    const btnPaymentsCsv = document.getElementById("btn-backup-payments-csv");
    const btnRestoreTrigger = document.getElementById("btn-restore-backup-trigger");
    const inputRestoreFile = document.getElementById("input-restore-backup-json");

    if (btnJson && !btnJson.dataset.bound) {
        btnJson.dataset.bound = "1";
        btnJson.addEventListener("click", downloadFullBackupJSON);
    }

    if (btnUsersCsv && !btnUsersCsv.dataset.bound) {
        btnUsersCsv.dataset.bound = "1";
        btnUsersCsv.addEventListener("click", downloadUsersExcelCSV);
    }

    if (btnPaymentsCsv && !btnPaymentsCsv.dataset.bound) {
        btnPaymentsCsv.dataset.bound = "1";
        btnPaymentsCsv.addEventListener("click", downloadPaymentsExcelCSV);
    }

    if (btnRestoreTrigger && inputRestoreFile && !btnRestoreTrigger.dataset.bound) {
        btnRestoreTrigger.dataset.bound = "1";
        btnRestoreTrigger.addEventListener("click", () => inputRestoreFile.click());
        inputRestoreFile.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                await restoreBackupFromJSON(file);
                inputRestoreFile.value = "";
            }
        });
    }
}

/**
 * Inyecta el panel visual de la Bóveda de Seguridad en #view-admin si no está presente.
 */
function renderBackupVaultUI() {
    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-backup-vault")) return;

    const vaultDiv = document.createElement("div");
    vaultDiv.id = "admin-backup-vault";
    vaultDiv.className = "bg-surface-container border border-primary/50 rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-lg";
    vaultDiv.innerHTML = `
        <div>
            <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                Bóveda de Seguridad • Administradores Autorizados
            </span>
            <h3 class="text-lg font-extrabold text-white flex items-center gap-2 mt-0.5">
                <span class="material-symbols-outlined text-primary">cloud_download</span>
                Copias de Respaldo de Base de Datos (Usuarios, Pagos, Reactivos y Materiales)
            </h3>
            <p class="text-xs text-gray-400">
                Cuentas maestras activas: anthonnyvelastegui@gmail.com | aavemakaihc@gmail.com
            </p>
        </div>
        <div class="flex flex-wrap gap-3">
            <button type="button" id="btn-backup-json" class="px-4 py-2.5 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                <span class="material-symbols-outlined text-base">database</span>
                <span>💾 Respaldo Total (.JSON)</span>
            </button>
            <button type="button" id="btn-backup-excel" class="px-4 py-2.5 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">table_view</span>
                <span>📊 Alumnos y Pagos (.CSV Excel)</span>
            </button>
            <button type="button" id="btn-backup-payments-csv" class="px-4 py-2.5 bg-warning text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">receipt_long</span>
                <span>🧾 Historial Bancario (.CSV)</span>
            </button>
            <button type="button" id="btn-restore-backup-trigger" class="px-4 py-2.5 bg-surface-high border border-gray-600 text-gray-200 hover:border-primary hover:text-primary font-extrabold text-xs rounded-xl transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">upload_file</span>
                <span>♻️ Restaurar (.JSON)</span>
            </button>
            <input type="file" id="input-restore-backup-json" accept=".json,application/json" class="hidden" />
        </div>
    `;

    // Insertar al inicio del Panel de Administrador, justo debajo del encabezado
    if (adminView.children.length > 1) {
        adminView.insertBefore(vaultDiv, adminView.children[1]);
    } else {
        adminView.appendChild(vaultDiv);
    }
}

// ============================================================================
// 3. DESCARGA DE RESPALDO TOTAL EN FORMATO .JSON (5 COLECCIONES)
// ============================================================================

/**
 * Descarga toda la base de datos de Firestore en un archivo .JSON estructurado.
 */
export async function downloadFullBackupJSON() {
    if (!verifyAdminAccess()) return;

    const btn = document.getElementById("btn-backup-json");
    const originalHTML = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Generando copia...</span>';
        }

        const [
            usersSnap,
            paymentsSnap,
            questionsSnap,
            sinapticoSnap,
            materialsSnap
        ] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.USERS)),
            getDocs(collection(db, COLLECTIONS.PAYMENTS)),
            getDocs(collection(db, COLLECTIONS.QUESTIONS)),
            getDocs(collection(db, COLLECTIONS.SINAPTICO)),
            getDocs(collection(db, COLLECTIONS.MATERIALS))
        ]);

        const backupData = {
            plataforma: "Makai Academy (Proyecto ALICIZATION)",
            versionArquitectura: "Modular-8D-v13.0.0",
            proyectoFirebase: "makai-academy-f8039",
            fechaRespaldoISO: new Date().toISOString(),
            fechaRespaldoEcuador: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
            generadoPor: auth.currentUser?.email || appState.currentUserData?.email || "admin",
            resumenEstadistico: {
                totalUsuarios: usersSnap.size,
                totalSolicitudesPago: paymentsSnap.size,
                totalPreguntasCaces: questionsSnap.size,
                totalTarjetasSinaptico: sinapticoSnap.size,
                totalMaterialesEstudio: materialsSnap.size
            },
            colecciones: {
                [COLLECTIONS.USERS]: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                [COLLECTIONS.PAYMENTS]: paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                [COLLECTIONS.QUESTIONS]: questionsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                [COLLECTIONS.SINAPTICO]: sinapticoSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                [COLLECTIONS.MATERIALS]: materialsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            }
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `Respaldo_Makai_Academy_${getEcuadorDateStamp()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error en downloadFullBackupJSON:", err);
        alert("Error al generar el respaldo JSON: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML || '<span class="material-symbols-outlined text-base">database</span><span>💾 Respaldo Total (.JSON)</span>';
        }
    }
}

// ============================================================================
// 4. DESCARGA DE PADRÓN DE ALUMNOS Y PAGOS EN .CSV (MICROSOFT EXCEL)
// ============================================================================

/**
 * Descarga la colección de usuarios con su expediente académico y bancario en .CSV.
 */
export async function downloadUsersExcelCSV() {
    if (!verifyAdminAccess()) return;

    const btn = document.getElementById("btn-backup-excel");
    const originalHTML = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Generando Excel...</span>';
        }

        const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));

const headers = [
            "UID",
            "Titulo",
            "Nombre Completo",
            "Nickname",
            "Carrera Principal",
            "Modalidad Ingreso",
            "Carreras Habilitadas",
            "Dispositivo 1 (PC Desktop)",
            "Dispositivo 2 (Celular Mobile)",
            "Correo Principal",
            "Correo Respaldo",
            "Telefono",
            "Pais",
            "Cumpleanos",
            "Rol",
            "Nivel Activo",
            "Plan Solicitado",
            "Metodo Pago",
            "Estado Pago",
            "N_Comprobante",
            "Titular Cuenta",
            "Cedula/RUC Titular",
            "Banco Origen",
            "Monto USD",
            "Fecha Comprobante",
            "Simulacros Completados",
            "Promedio Global (%)",
            "Casos Usados Mes",
            "Correo Confirmado",
            "Fecha Registro"
        ];

        const rows = [headers.join(";")];

        usersSnap.forEach(d => {
            const u = d.data();
            const comp = u.datosComprobante || {};
            const devs = u.dispositivosRegistrados || {};
            const habs = Array.isArray(u.carrerasHabilitadas) ? u.carrerasHabilitadas.join(", ") : (u.carrera || "medicina");
            const pcInfo = devs.desktop ? `${devs.desktop.etiqueta || "PC"} (${devs.desktop.deviceId || ""})` : "Sin vincular";
            const mobInfo = devs.mobile ? `${devs.mobile.etiqueta || "Móvil"} (${devs.mobile.deviceId || ""})` : "Sin vincular";

            const row = [
                d.id,
                u.titulo || "",
                u.nombre || "",
                u.nickname || "",
                u.carrera || "",
                u.nivelIngreso || (u.carrera === "preuniversitario_salud" ? "preuniversitario" : "universitario"),
                habs,
                pcInfo,
                mobInfo,
                u.email || "",
                u.emailRespaldo || "",
                u.telefonoCompleto || "",
                u.pais || "",
                u.cumpleanos || "",
                u.rol || "estudiante",
                u.subscriptionLevel || "Básico",
                u.planSolicitado || "basico",
                u.metodoPagoPreferido || "ninguno",
                u.estadoPago || "activo_gratis",
                comp.numeroComprobante || "",
                comp.titularCuenta || "",
                comp.cedulaTitular || "",
                comp.bancoOrigen || "",
                comp.montoDeclarado || "0.00",
                comp.fechaComprobante || "",
                u.totalExamsCompleted ?? 0,
                typeof u.globalAverage === "number" ? u.globalAverage.toFixed(2) : "0.00",
                u.casesUsedThisMonth ?? 0,
                u.correoConfirmadoMakai ? "SI" : "NO",
                u.createdAt || ""
            ].map(escapeCSVCell);

            rows.push(row.join(";"));
        });

        // \uFEFF (BOM) garantiza que Microsoft Excel reconozca tildes y caracteres UTF-8 automáticamente
        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `Alumnos_y_Pagos_Makai_${getEcuadorDateStamp()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error en downloadUsersExcelCSV:", err);
        alert("Error al generar el archivo Excel de alumnos: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML || '<span class="material-symbols-outlined text-base">table_view</span><span>📊 Alumnos y Pagos (.CSV Excel)</span>';
        }
    }
}

// ============================================================================
// 5. DESCARGA CONTABLE DE SOLICITUDES DE PAGO EN .CSV (AUDITORÍA BANCARIA)
// ============================================================================

/**
 * Descarga todas las transacciones registradas en solicitudes_pago hacia un archivo .CSV.
 */
export async function downloadPaymentsExcelCSV() {
    if (!verifyAdminAccess()) return;

    const btn = document.getElementById("btn-backup-payments-csv");
    const originalHTML = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Exportando Pagos...</span>';
        }

        const paymentsSnap = await getDocs(collection(db, COLLECTIONS.PAYMENTS));

        const headers = [
            "ID Solicitud",
            "UID Estudiante",
            "Nombre Estudiante",
            "Correo Estudiante",
            "Telefono",
            "Plan Solicitado",
            "Metodo Pago",
            "Monto Declarado (USD)",
            "Numero Comprobante",
            "Titular Cuenta",
            "Cedula/RUC Titular",
            "Banco Origen",
            "Fecha Comprobante",
            "Fecha/Hora Envio Exacta",
            "Estado Verificacion",
            "Fecha Aprobacion"
        ];

        const rows = [headers.join(";")];

        paymentsSnap.forEach(d => {
            const p = d.data();
            const row = [
                d.id,
                p.uid || "",
                p.estudianteNombre || "",
                p.estudianteEmail || "",
                p.estudianteTelefono || "",
                p.planSolicitado || "",
                p.metodoPago || "",
                p.montoDeclarado || "0.00",
                p.numeroComprobante || "",
                p.titularCuenta || "",
                p.cedulaTitular || "",
                p.bancoOrigen || "",
                p.fechaComprobante || "",
                p.fechaHoraEnvioExacta || p.createdAt || "",
                p.estado || "pendiente",
                p.aprobadoEn || ""
            ].map(escapeCSVCell);

            rows.push(row.join(";"));
        });

        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `Historial_Bancario_Makai_${getEcuadorDateStamp()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error en downloadPaymentsExcelCSV:", err);
        alert("Error al exportar el historial bancario: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML || '<span class="material-symbols-outlined text-base">receipt_long</span><span>🧾 Historial Bancario (.CSV)</span>';
        }
    }
}

// ============================================================================
// 6. RESTAURACIÓN DE RESPALDO .JSON HACIA CLOUD FIRESTORE
// ============================================================================

/**
 * Restaura en Firestore los documentos contenidos en un archivo .JSON de respaldo.
 * @param {File} file - Archivo .JSON seleccionado por el administrador.
 */
export async function restoreBackupFromJSON(file) {
    if (!verifyAdminAccess() || !file) return;

    const btn = document.getElementById("btn-restore-backup-trigger");
    const originalHTML = btn ? btn.innerHTML : "";

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Soportar tanto el esquema nuevo (parsed.colecciones) como el esquema anterior en raíz
        const cols = parsed.colecciones || {
            [COLLECTIONS.USERS]: parsed.usuarios || [],
            [COLLECTIONS.PAYMENTS]: parsed.solicitudes_pago || [],
            [COLLECTIONS.QUESTIONS]: parsed.preguntas_caces || [],
            [COLLECTIONS.SINAPTICO]: parsed.tarjetas_sinaptico || [],
            [COLLECTIONS.MATERIALS]: parsed.materiales_estudio || []
        };

        const totalDocs = Object.values(cols).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
        if (totalDocs === 0) {
            alert("⚠️ El archivo seleccionado no contiene documentos válidos de Makai Academy.");
            return;
        }

        const confirmRestore = confirm(
            `¿Confirmas restaurar ${totalDocs} documentos en Cloud Firestore desde el archivo "${file.name}"?\n\n` +
            `Esta operación actualizará o creará los registros manteniendo sus IDs originales.`
        );
        if (!confirmRestore) return;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Restaurando en Firestore...</span>';
        }

        let restoredCount = 0;

        for (const [colName, docsArray] of Object.entries(cols)) {
            if (!Array.isArray(docsArray)) continue;

            for (const item of docsArray) {
                const { id, ...docData } = item;
                if (!id) continue;
                await setDoc(doc(db, colName, String(id)), docData, { merge: true });
                restoredCount++;
            }
        }

        alert(`✅ Restauración completada con éxito: ${restoredCount} documentos sincronizados en Firestore.`);

    } catch (err) {
        console.error("Error en restoreBackupFromJSON:", err);
        alert("Error al restaurar el respaldo JSON: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML || '<span class="material-symbols-outlined text-base">upload_file</span><span>♻️ Restaurar (.JSON)</span>';
        }
    }
}
