// ============================================================================
// ARCHIVO: js/1-admin/admin.tutors.js
// DESCRIPCIÓN: Subcomponente de Administración para gestionar postulaciones
//              de docentes y aprobar comisiones de Tesis 1 a 1 ($10 USD).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    updateDoc,
    setDoc,
    doc
} from "../2-core/firebase.service.js";

import {
    isMasterAdmin,
    appState
} from "../2-core/state.store.js";

/**
 * Inicializa el panel de Tutores y Tesis dentro de la Bóveda Admin
 */
export function initAdminTutors() {
    const activeEmail =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";

    if (!isMasterAdmin(activeEmail)) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-tutors-section")) return;

    // Inyectar la interfaz de Tutores al final de la Bóveda Admin (visible en Vista Completa)
    const tutorsSection = document.createElement("div");
    tutorsSection.id = "admin-tutors-section";
    tutorsSection.className = "mb-10 space-y-6";

    tutorsSection.innerHTML = `
        <!-- BANDEJA DE POSTULACIONES DOCENTES -->
        <div class="bg-surface-container border-2 border-secondary/50 rounded-2xl p-6 shadow-2xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-surface-high">
                <div>
                    <h3 class="text-xl font-extrabold text-secondary flex items-center gap-2">
                        <span class="material-symbols-outlined">school</span>
                        Reclutamiento y Postulaciones de Docentes
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">Activa a los candidatos como "Tutores Verificados de Tesis" o "Docentes de Aulas Virtuales".</p>
                </div>
                <button type="button" id="btn-refresh-tutors" class="px-4 py-2 bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all">
                    ↻ Actualizar Solicitudes
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Fecha / Candidato</th>
                            <th class="px-4 py-3">Especialidad / Título</th>
                            <th class="px-4 py-3">Contacto</th>
                            <th class="px-4 py-3">Estado Actual</th>
                            <th class="px-4 py-3">Acciones de Activación</th>
                        </tr>
                    </thead>
                    <tbody id="admin-tutors-tbody">
                        <tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">Cargando postulaciones...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- BANDEJA DE VINCULACIONES DE TESIS ($10 USD) -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 shadow-lg mt-6">
            <h3 class="text-lg font-extrabold text-white flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-primary">handshake</span>
                Comisiones Makai: Vinculaciones Tesis 1 a 1 ($10 USD)
            </h3>
            <p class="text-xs text-gray-400 mb-4">Aprueba los comprobantes de $10 USD para habilitar el contacto directo por WhatsApp entre el alumno y el tutor.</p>
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Alumno / Tema</th>
                            <th class="px-4 py-3">Tutor Solicitado</th>
                            <th class="px-4 py-3">Método / N° Comprobante</th>
                            <th class="px-4 py-3">Evidencia</th>
                            <th class="px-4 py-3">Acción</th>
                        </tr>
                    </thead>
                    <tbody id="admin-thesis-tbody">
                        <tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">Cargando vinculaciones...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    adminView.appendChild(tutorsSection);

    // Enlazar eventos de recarga
    document.getElementById("btn-refresh-tutors")?.addEventListener("click", () => {
        loadTutorApplications();
        loadThesisVouchers();
    });

    // Carga inicial
    loadTutorApplications();
    loadThesisVouchers();
}

/**
 * Carga los usuarios que postularon para ser docentes en "postulaciones_docentes"
 */
async function loadTutorApplications() {
    const tbody = document.getElementById("admin-tutors-tbody");
    if (!tbody) return;

    try {
        const snap = await getDocs(collection(db, "postulaciones_docentes"));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">No hay postulaciones pendientes.</td></tr>';
            return;
        }

        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement("tr");
            tr.className = "border-b border-surface-high hover:bg-surface/60";

            const isPending = !data.estado || data.estado.toLowerCase() === "pendiente";

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="text-white font-bold">${data.nombreCompleto || data.nombre || "---"}</div>
                    <div class="text-[10px] text-gray-400">${data.createdAt || "---"}</div>
                </td>
                <td class="px-4 py-3 text-secondary">${data.tituloEspecialidad || data.especialidad || "---"}</td>
                <td class="px-4 py-3">${data.email || "---"}<br>${data.telefono || data.whatsappDirecto || ""}</td>
                <td class="px-4 py-3 uppercase text-[10px] font-bold ${isPending ? "text-warning" : "text-primary"}">
                    ${data.estado || "pendiente"}
                </td>
                <td class="px-4 py-3 flex flex-wrap gap-2">
                    <button type="button" class="btn-activate-tutor px-2.5 py-1 rounded bg-secondary/20 text-secondary hover:bg-secondary hover:text-surface font-bold transition-all" data-id="${docSnap.id}" data-uid="${data.uid || docSnap.id}" data-rol="tutor_tesis">
                        Activar Tesis
                    </button>
                    <button type="button" class="btn-activate-tutor px-2.5 py-1 rounded bg-primary/20 text-primary hover:bg-primary hover:text-surface font-bold transition-all" data-id="${docSnap.id}" data-uid="${data.uid || docSnap.id}" data-rol="docente_aula">
                        Activar Aulas
                    </button>
                </td>
            `;

            tr.querySelectorAll(".btn-activate-tutor").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const targetBtn = e.currentTarget;
                    const postulacionId = targetBtn.getAttribute("data-id");
                    const userUid = targetBtn.getAttribute("data-uid");
                    const nuevoRol = targetBtn.getAttribute("data-rol");
                    const rolTexto = nuevoRol === "tutor_tesis" ? "Tutor Verificado de Tesis" : "Docente de Aulas Virtuales";

                    if (!confirm(`¿Deseas activar a este candidato como ${rolTexto}? Esto actualizará sus permisos sin darle acceso a la Bóveda Admin.`)) {
                        return;
                    }

                    try {
                        // 1. Actualizar rol en la colección "usuarios"
                        await setDoc(doc(db, "usuarios", userUid), {
                            rol: nuevoRol,
                            updatedAt: new Date().toISOString()
                        }, { merge: true });

                        // 2. Marcar postulación como aprobada
                        await updateDoc(doc(db, "postulaciones_docentes", postulacionId), {
                            estado: "aprobado",
                            rolAsignado: nuevoRol
                        });

                        // 3. Si es Tutor de Tesis, registrarlo también en "tutores_verificados" para el Marketplace
                        if (nuevoRol === "tutor_tesis") {
                            await setDoc(doc(db, "tutores_verificados", userUid), {
                                id: userUid,
                                nombre: data.nombreCompleto || data.nombre || "Especialista Verificado",
                                carrera: data.carrera || "medicina",
                                carrerasCompatibles: data.carrerasCompatibles || [data.carrera || "medicina"],
                                especialidad: data.tituloEspecialidad || data.especialidad || "Asesoría Metodológica y Bioestadística",
                                universidadesExperiencia: data.universidadesExperiencia || ["Universidades del Ecuador"],
                                tesisAprobadas: Number(data.tesisAprobadas) || 10,
                                calificacion: 4.95,
                                tarifaReferencialTutor: data.tarifaReferencialTutor || "$150 - $280 USD (Negociable directo con el tutor)",
                                comisionMakaiUSD: 10,
                                whatsappDirecto: (data.telefono || data.whatsappDirecto || "").replace(/\D/g, ""),
                                insignia: "TUTOR VERIFICADO MAKAI"
                            }, { merge: true });
                        }

                        alert(`✅ Candidato activado como ${rolTexto} exitosamente.`);
                        loadTutorApplications();
                    } catch (error) {
                        alert("Error al activar: " + error.message);
                    }
                });
            });

            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-danger">Error de permisos o colección vacía: ${error.message}</td></tr>`;
    }
}

/**
 * Carga las vinculaciones de tesis pendientes de validación del comprobante de $10 USD
 */
async function loadThesisVouchers() {
    const tbody = document.getElementById("admin-thesis-tbody");
    if (!tbody) return;

    try {
        const snap = await getDocs(collection(db, "solicitudes_tesis"));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">No hay vinculaciones pendientes.</td></tr>';
            return;
        }

        tbody.innerHTML = "";
        let pendingCount = 0;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const currentStatus = String(data.estado || "").toUpperCase();
            if (currentStatus === "APROBADO" || currentStatus === "VERIFICADO") return;

            pendingCount++;
            const studentName = data.nombreEstudiante || data.alumnoNombre || "Estudiante Makai";
            const studentEmail = data.emailEstudiante || "";
            const topic = data.temaTentativo || "Sin tema especificado";

            const tr = document.createElement("tr");
            tr.className = "border-b border-surface-high hover:bg-surface/60";
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="text-white font-bold">${studentName}</div>
                    <div class="text-[10px] text-primary">${studentEmail}</div>
                    <div class="text-[10px] text-gray-400 truncate max-w-xs" title="${topic}">Tema: ${topic}</div>
                </td>
                <td class="px-4 py-3 text-secondary font-bold">${data.tutorNombre || "---"}</td>
                <td class="px-4 py-3">
                    <div class="font-mono text-warning font-bold">Ref: ${data.numeroComprobante || "---"}</div>
                    <div class="text-[10px] text-gray-400">${data.metodoPago || "QR / Transferencia"} • $${data.montoUSD || 10} USD</div>
                </td>
                <td class="px-4 py-3">
                    ${
                        data.comprobanteBase64
                            ? `<button type="button" class="btn-view-thesis-voucher px-2.5 py-1 rounded bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-bold">👁️ Ver Captura</button>`
                            : `<span class="text-gray-500">Sin captura</span>`
                    }
                </td>
                <td class="px-4 py-3">
                    <button type="button" class="btn-approve-voucher px-3 py-1.5 rounded-lg bg-primary text-surface font-extrabold hover:bg-opacity-90" data-id="${docSnap.id}">
                        ✅ Aprobar Vinculación
                    </button>
                </td>
            `;

            // Ver captura del comprobante de $10 USD si el estudiante la subió
            tr.querySelector(".btn-view-thesis-voucher")?.addEventListener("click", () => {
                const win = window.open("", "_blank");
                win.document.write(`
                    <body style="margin:0;background:#06090e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:monospace;">
                        <div style="padding:12px;text-align:center;">
                            <strong>Alumno:</strong> ${studentName} | <strong>Tutor:</strong> ${data.tutorNombre} | <strong>Ref:</strong> ${data.numeroComprobante}
                        </div>
                        <img src="${data.comprobanteBase64}" style="max-width:95%;max-height:85vh;border:2px solid #00e5ff;border-radius:12px;"/>
                    </body>
                `);
            });

            // Aprobar el pago de $10 USD (escribe "APROBADO" como espera graduation.controller.js)
            tr.querySelector(".btn-approve-voucher")?.addEventListener("click", async (e) => {
                const voucherId = e.currentTarget.getAttribute("data-id");
                if (confirm(`¿Verificaste el ingreso de los $10 USD de ${studentName} para vincularse con ${data.tutorNombre}?`)) {
                    try {
                        await updateDoc(doc(db, "solicitudes_tesis", voucherId), {
                            estado: "APROBADO",
                            aprobadoEn: new Date().toISOString()
                        });
                        alert("✅ Vinculación aprobada. El alumno ya tiene habilitado el botón de WhatsApp directo con el tutor.");
                        loadThesisVouchers();
                    } catch (error) {
                        alert("Error al aprobar vinculación: " + error.message);
                    }
                }
            });

            tbody.appendChild(tr);
        });

        if (pendingCount === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">Todas las vinculaciones están al día.</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-danger">Error de lectura: ${error.message}</td></tr>`;
    }
}
