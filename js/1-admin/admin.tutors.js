// ============================================================================
// ARCHIVO: js/1-admin/admin.tutors.js
// DESCRIPCIÓN: Subcomponente de Administración para gestionar postulaciones
//              de docentes y aprobar comisiones de Tesis 1 a 1 ($10 USD).
// ============================================================================

import { db, collection, getDocs, updateDoc, doc } from "../2-core/firebase.service.js";
import { isMasterAdmin, appState, MASTER_ADMINS } from "../2-core/state.store.js";

/**
 * Inicializa el panel de Tutores y Tesis dentro de la Bóveda Admin
 */
export function initAdminTutors() {
    const activeEmail = appState.currentUserData?.email || "";
    if (!isMasterAdmin(activeEmail)) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-tutors-section")) return;

    // Inyectar la interfaz de Tutores al final de la Bóveda Admin
    const tutorsSection = document.createElement("div");
    tutorsSection.id = "admin-tutors-section";
    tutorsSection.className = "mb-10 space-y-6 hidden"; // Oculto por defecto hasta que se seleccione la pestaña
    
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
                            <th class="px-4 py-3">Alumno</th>
                            <th class="px-4 py-3">Tutor Solicitado</th>
                            <th class="px-4 py-3">N° Comprobante</th>
                            <th class="px-4 py-3">Acción</th>
                        </tr>
                    </thead>
                    <tbody id="admin-thesis-tbody">
                        <tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">Cargando vinculaciones...</td></tr>
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
 * Carga los usuarios que postularon para ser docentes
 */
async function loadTutorApplications() {
    const tbody = document.getElementById("admin-tutors-tbody");
    if (!tbody) return;
    
    try {
        // Suponiendo que las postulaciones se guardan en la colección "postulaciones_docentes"
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
            
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="text-white font-bold">${data.nombreCompleto || "---"}</div>
                    <div class="text-[10px] text-gray-400">${data.createdAt || "---"}</div>
                </td>
                <td class="px-4 py-3 text-secondary">${data.tituloEspecialidad || "---"}</td>
                <td class="px-4 py-3">${data.email || "---"}<br>${data.telefono || ""}</td>
                <td class="px-4 py-3 uppercase text-[10px] ${data.estado === 'pendiente' ? 'text-warning' : 'text-primary'}">${data.estado || "pendiente"}</td>
                <td class="px-4 py-3 flex gap-2">
                    <button class="btn-activate-tutor px-2 py-1 rounded bg-secondary/20 text-secondary hover:bg-secondary hover:text-surface transition-all" data-id="${docSnap.id}" data-uid="${data.uid}" data-rol="tutor_tesis">
                        Activar Tesis
                    </button>
                    <button class="btn-activate-tutor px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary hover:text-surface transition-all" data-id="${docSnap.id}" data-uid="${data.uid}" data-rol="docente_aula">
                        Activar Aulas
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Eventos para los botones de activación
        document.querySelectorAll(".btn-activate-tutor").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const postulacionId = e.target.getAttribute("data-id");
                const userUid = e.target.getAttribute("data-uid");
                const nuevoRol = e.target.getAttribute("data-rol");
                const rolTexto = nuevoRol === "tutor_tesis" ? "Tutor de Tesis" : "Docente de Aulas";

                if(confirm(`¿Deseas activar a este candidato como ${rolTexto}? Esto actualizará sus permisos en la plataforma.`)) {
                    try {
                        // Actualizar documento de usuario y solicitud
                        await updateDoc(doc(db, "usuarios", userUid), { rol: nuevoRol });
                        await updateDoc(doc(db, "postulaciones_docentes", postulacionId), { estado: "aprobado", rolAsignado: nuevoRol });
                        alert(`Candidato activado como ${rolTexto} exitosamente.`);
                        loadTutorApplications();
                    } catch (error) {
                        alert("Error al activar: " + error.message);
                    }
                }
            });
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-danger">Error de permisos: ${error.message}</td></tr>`;
    }
}

/**
 * Carga las vinculaciones de tesis pendientes de validación del comprobante de $10
 */
async function loadThesisVouchers() {
    const tbody = document.getElementById("admin-thesis-tbody");
    if (!tbody) return;
    
    try {
        const snap = await getDocs(collection(db, "solicitudes_tesis"));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay vinculaciones pendientes.</td></tr>';
            return;
        }

        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if(data.estado === "aprobado") return; // Solo mostrar pendientes

            const tr = document.createElement("tr");
            tr.className = "border-b border-surface-high hover:bg-surface/60";
            tr.innerHTML = `
                <td class="px-4 py-3 text-white">${data.alumnoNombre}</td>
                <td class="px-4 py-3 text-secondary">${data.tutorNombre}</td>
                <td class="px-4 py-3 font-mono text-warning">${data.numeroComprobante}</td>
                <td class="px-4 py-3">
                    <button class="btn-approve-voucher px-3 py-1.5 rounded-lg bg-primary text-surface font-extrabold hover:bg-opacity-90" data-id="${docSnap.id}">
                        Aprobar Vinculación
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".btn-approve-voucher").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const voucherId = e.target.getAttribute("data-id");
                if(confirm("¿Verificaste el ingreso de los $10 USD de esta vinculación?")) {
                    try {
                        await updateDoc(doc(db, "solicitudes_tesis", voucherId), { estado: "aprobado" });
                        alert("Vinculación aprobada. El alumno ya puede ver el WhatsApp del tutor.");
                        loadThesisVouchers();
                    } catch (error) {
                        alert("Error: " + error.message);
                    }
                }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-danger">Error de lectura.</td></tr>`;
    }
}
