// ============================================================================
// ARCHIVO: js/1-admin/admin.tutors.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Bandeja Maestra de Reclutamiento de Especialistas VIP,
//                  Verificación SENESCYT y Publicación de Fichas Inmodificables.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

let allTutorsCache = [];
let currentTutorFilter = "pendiente_revision"; // "pendiente_revision" | "aprobado"

/**
 * Descarga todos los expedientes de `perfiles_docentes` desde Firestore.
 */
async function loadTutorsFromFirestore() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.TUTORS));
        allTutorsCache = [];
        snap.forEach(d => allTutorsCache.push({ id: d.id, ...d.data() }));
        allTutorsCache.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    } catch (err) {
        console.warn("[AdminTutors] Error cargando perfiles docentes:", err.message);
    }
}

/**
 * Inicializador principal invocado por `admin.controller.js`.
 */
export async function initAdminTutors() {
    const mount = document.getElementById("admin-tab-panel-tutors");
    if (!mount) return;

    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    if (!isMasterAdmin(email)) {
        mount.innerHTML = "";
        return;
    }

    mount.innerHTML = `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 text-xs font-mono text-warning">
            Sincronizando expedientes de Especialistas VIP y registros SENESCYT...
        </div>
    `;

    await loadTutorsFromFirestore();
    renderAdminTutorsPanel(mount);
}

function renderAdminTutorsPanel(mount) {
    const pendingList = allTutorsCache.filter(t => (t.estado || "pendiente_revision") === "pendiente_revision");
    const approvedList = allTutorsCache.filter(t => t.estado === "aprobado");
    const visibleList = currentTutorFilter === "aprobado" ? approvedList : pendingList;

    mount.innerHTML = `
        <div class="space-y-6">
            <!-- CABECERA Y CONMUTADOR DE BANDEJA -->
            <div class="bg-surface-container border border-warning/50 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span class="text-[10px] font-mono text-warning uppercase font-bold">
                        ● MODELO MATCHMAKER • AUDITORÍA DE CREDENCIALES SENESCYT
                    </span>
                    <h3 class="text-xl font-extrabold text-white mt-0.5">
                        Gestión del Directorio de Especialistas & Tutores de Tesis
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Los especialistas fijan sus honorarios referenciales; Makai Academy cobra únicamente la Tasa de Vinculación al estudiante.
                    </p>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" data-tutor-filter="pendiente_revision"
                        class="px-4 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentTutorFilter === "pendiente_revision"
                                ? "bg-warning text-surface"
                                : "bg-surface border border-surface-high text-gray-300"
                        }">
                        ⏳ Postulaciones en Cuarentena (${pendingList.length})
                    </button>
                    <button type="button" data-tutor-filter="aprobado"
                        class="px-4 py-2 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            currentTutorFilter === "aprobado"
                                ? "bg-secondary text-surface"
                                : "bg-surface border border-surface-high text-gray-300"
                        }">
                        ✅ Publicados en Marketplace (${approvedList.length})
                    </button>
                </div>
            </div>

            <!-- FORMULARIO RÁPIDO PARA CREAR UN ESPECIALISTA DIRECTAMENTE DESDE BÓVEDA -->
            <details class="bg-surface-container border border-surface-high rounded-2xl p-5">
                <summary class="cursor-pointer text-xs font-mono font-extrabold text-primary uppercase">
                    ➕ Registrar Especialista / Tutor VIP Manualmente (Sin esperar postulación)
                </summary>
                <form id="admin-create-tutor-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 mt-3 border-t border-surface-high text-xs">
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Nombre y Título *</label>
                        <input type="text" id="adm-tutor-name" required placeholder="Dra. Valeria Gómez, MSc."
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-warning uppercase mb-1">N° Registro SENESCYT *</label>
                        <input type="text" id="adm-tutor-senescyt" required placeholder="1031-2019-998877"
                            class="w-full bg-surface border border-warning/40 rounded-xl px-3 py-2 text-white font-mono">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Especialidad Clínica / Tesis *</label>
                        <input type="text" id="adm-tutor-spec" required placeholder="Epidemiología & Bioestadística SPSS"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-secondary uppercase mb-1">Tarifa Referencial del Doctor *</label>
                        <input type="text" id="adm-tutor-rate" required placeholder="$30/hora o $200/Tesis"
                            class="w-full bg-surface border border-secondary/40 rounded-xl px-3 py-2 text-white font-mono">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">WhatsApp Directo *</label>
                        <input type="text" id="adm-tutor-wa" required placeholder="0991234567"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white font-mono">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-primary uppercase mb-1">Tasa Vinculación Makai (USD) *</label>
                        <input type="number" step="0.5" id="adm-tutor-fee" value="10" required
                            class="w-full bg-surface border border-primary/40 rounded-xl px-3 py-2 text-white font-mono font-bold">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Biografía y Materias que Domina *</label>
                        <input type="text" id="adm-tutor-bio" required placeholder="Especialista en diseño PICO, PRISMA, R-Studio y preparación CACES..."
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2 text-white">
                    </div>
                    <div class="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
                        <button type="submit"
                            class="px-5 py-2.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase">
                            ✅ Crear y Publicar Ficha VIP Directamente
                        </button>
                    </div>
                </form>
            </details>

            <!-- LISTADO DE FICHAS EN LA BANDEJA ACTUAL -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${visibleList.length === 0 ? `
                    <div class="col-span-full bg-surface-container border border-surface-high rounded-2xl p-8 text-center text-xs font-mono text-gray-400">
                        No hay expedientes docentes en esta bandeja actualmente.
                    </div>
                ` : visibleList.map(tutor => `
                    <article class="bg-surface-container border ${tutor.estado === "aprobado" ? "border-secondary/50" : "border-warning/50"} rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div class="space-y-2">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <span class="px-2.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40 text-[10px] font-mono font-extrabold uppercase">
                                        SENESCYT: ${tutor.registroSenescyt || "Pendiente"}
                                    </span>
                                    <h4 class="text-base font-extrabold text-white mt-1">${tutor.nombre || "Especialista"}</h4>
                                    <p class="text-xs text-primary font-mono">${tutor.especialidad || "Medicina & Investigación"}</p>
                                </div>
                                <span class="text-xs font-mono font-extrabold text-secondary bg-surface px-3 py-1 rounded-lg border border-secondary/30">
                                    Honorarios: ${tutor.tarifaReferencial || "A convenir"}
                                </span>
                            </div>

                            <p class="text-xs text-gray-300 leading-relaxed bg-surface rounded-xl p-3 border border-surface-high">
                                ${tutor.biografia || "Sin resumen biográfico."}
                            </p>

                            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400">
                                <div>📱 WhatsApp: <strong class="text-white">${tutor.whatsapp || "N/A"}</strong></div>
                                <div>✉️ Correo: <strong class="text-white">${tutor.email || "N/A"}</strong></div>
                                <div>🎯 Modalidad: <strong class="text-warning">${tutor.modalidad || "mentorias_y_tesis"}</strong></div>
                                <div>💰 Comisión Makai: <strong class="text-primary">$${Number(tutor.tasaVinculacionMakaiUSD || 10).toFixed(2)} USD</strong></div>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-surface-high">
                            ${tutor.cvUrl ? `
                                <a href="${tutor.cvUrl}" target="_blank" rel="noopener"
                                    class="px-3 py-1.5 rounded-lg bg-surface border border-surface-high text-xs font-mono text-primary hover:border-primary">
                                    🔗 Ver CV / ORCID
                                </a>
                            ` : ""}

                            ${tutor.estado !== "aprobado" ? `
                                <button type="button" data-approve-tutor="${tutor.id}"
                                    class="px-4 py-2 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                                    ✅ Verificar SENESCYT y Publicar Ficha
                                </button>
                            ` : `
                                <button type="button" data-pause-tutor="${tutor.id}"
                                    class="px-3 py-1.5 rounded-lg bg-warning/20 border border-warning text-warning font-mono font-bold text-xs">
                                    ⏸️ Ocultar del Marketplace
                                </button>
                            `}

                            <button type="button" data-delete-tutor="${tutor.id}"
                                class="px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger font-mono font-bold text-xs">
                                🗑️ Eliminar
                            </button>
                        </div>
                    </article>
                `).join("")}
            </div>
        </div>
    `;

    // Conmutar filtro de bandeja
    mount.querySelectorAll("[data-tutor-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentTutorFilter = btn.dataset.tutorFilter;
            renderAdminTutorsPanel(mount);
        });
    });

    // Crear Especialista Manualmente
    document.getElementById("admin-create-tutor-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = `TUT-${Date.now().toString(36).toUpperCase()}`;
        const nuevoTutor = {
            id,
            nombre: document.getElementById("adm-tutor-name")?.value.trim() || "",
            registroSenescyt: document.getElementById("adm-tutor-senescyt")?.value.trim() || "",
            especialidad: document.getElementById("adm-tutor-spec")?.value.trim() || "",
            tarifaReferencial: document.getElementById("adm-tutor-rate")?.value.trim() || "",
            whatsapp: document.getElementById("adm-tutor-wa")?.value.trim() || "",
            tasaVinculacionMakaiUSD: Number(document.getElementById("adm-tutor-fee")?.value || 10),
            biografia: document.getElementById("adm-tutor-bio")?.value.trim() || "",
            modalidad: "mentorias_y_tesis",
            avatarUrl: "assets/9-multimedia-titulacion/avatares-tutores/default-specialist.png",
            verificadoSenescyt: true,
            estado: "aprobado",
            createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, COLLECTIONS.TUTORS, id), nuevoTutor);
        window.MakaiSecurityGuard?.showSecurityToast?.("✅ Ficha de Especialista VIP publicada en el Marketplace.", "success");
        currentTutorFilter = "aprobado";
        await loadTutorsFromFirestore();
        renderAdminTutorsPanel(mount);
    });

    // Aprobar postulación y asignar rol "docente" si el usuario existe
    mount.querySelectorAll("[data-approve-tutor]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const tutorId = btn.dataset.approveTutor;
            await updateDoc(doc(db, COLLECTIONS.TUTORS, tutorId), {
                verificadoSenescyt: true,
                estado: "aprobado",
                aprobadoPor: auth.currentUser?.email || "master",
                fechaAprobacion: new Date().toISOString()
            });
            window.MakaiSecurityGuard?.showSecurityToast?.("✅ Especialista verificado y visible para todos los estudiantes.", "success");
            await loadTutorsFromFirestore();
            renderAdminTutorsPanel(mount);
        });
    });

    // Pausar / Ocultar tutor
    mount.querySelectorAll("[data-pause-tutor]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await updateDoc(doc(db, COLLECTIONS.TUTORS, btn.dataset.pauseTutor), {
                estado: "pendiente_revision"
            });
            await loadTutorsFromFirestore();
            renderAdminTutorsPanel(mount);
        });
    });

    // Eliminar tutor
    mount.querySelectorAll("[data-delete-tutor]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await deleteDoc(doc(db, COLLECTIONS.TUTORS, btn.dataset.deleteTutor));
            await loadTutorsFromFirestore();
            renderAdminTutorsPanel(mount);
        });
    });
}
