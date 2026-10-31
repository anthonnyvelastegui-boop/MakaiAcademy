// ============================================================================
// ARCHIVO: js/1-admin/admin.users.js
// DESCRIPCIÓN: Subcomponente 7 • Control Maestro de Carreras Habilitadas por
//              Alumno, Nivel de Suscripción (Básico/PRO/VIP) y Dispositivos
//              Vinculados (1 PC + 1 Móvil estilo Netflix/Crunchyroll).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    updateDoc,
    setDoc,
    doc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

const SAFE_COLLECTIONS = {
    USERS: COLLECTIONS?.USERS || "usuarios",
    CAREER_REQUESTS: "solicitudes_cambio_carrera"
};

export const ADMIN_CAREER_OPTIONS = [
    { id: "preuniversitario_salud", short: "🎓 Preuni Salud", nombre: "Preuniversitario General de Salud" },
    { id: "medicina", short: "Medicina", nombre: "01 • Medicina Humana" },
    { id: "enfermeria", short: "Enfermería", nombre: "02 • Enfermería" },
    { id: "odontologia", short: "Odontología", nombre: "03 • Odontología" },
    { id: "obstetricia", short: "Obstetricia", nombre: "04 • Obstetricia y Puericultura" },
    { id: "nutricion", short: "Nutrición", nombre: "05 • Nutrición y Dietética" },
    { id: "fisioterapia", short: "Fisioterapia", nombre: "06 • Fisioterapia y Rehabilitación" },
    { id: "laboratorio", short: "Laboratorio", nombre: "07 • Laboratorio Clínico" },
    { id: "imagenologia", short: "Imagenología", nombre: "08 • Imagenología y Radiología" },
    { id: "farmacia", short: "Farmacia", nombre: "09 • Bioquímica y Farmacia" },
    { id: "psicologia_clinica", short: "Psicología", nombre: "10 • Psicología Clínica" },
    { id: "paramedicina", short: "Prehospitalaria", nombre: "11 • Atención Prehospitalaria" }
];

let cachedAdminUsers = [];
let cachedCareerRequests = [];
let currentFilterMode = "all"; // "all" | "with_devices" | "multi_career"

function verifyPermissions() {
    const activeEmail =
        auth.currentUser?.email ||
        appState?.currentUser?.email ||
        appState?.currentUserData?.email ||
        window.makaiCurrentUser?.email ||
        "";
    return isMasterAdmin(activeEmail);
}

/**
 * Inicializa el Subcomponente 7 dentro de #view-admin
 */
export function initAdminUsers() {
    if (!verifyPermissions()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-access-devices-section")) return;

    const section = document.createElement("section");
    section.id = "admin-access-devices-section";
    section.className = "mb-10 space-y-6";

    section.innerHTML = `
        <div class="bg-surface-container border-2 border-warning/50 rounded-2xl p-6 shadow-2xl space-y-6">
            <!-- CABECERA -->
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono text-warning uppercase tracking-widest font-extrabold">
                        Subcomponente 7 • Control Maestro de Carreras por Alumno, Planes y Dispositivos (1 PC + 1 Celular)
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                        <span class="material-symbols-outlined text-warning">manage_accounts</span>
                        7. Carreras por Alumno, Suscripciones y Dispositivos (1+1)
                    </h3>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Activa o desactiva carreras adicionales para cualquier estudiante, ajusta su Plan y libera sus equipos vinculados.
                    </p>
                </div>

                <button type="button" id="btn-refresh-access-manager" class="px-4 py-2 bg-surface border border-warning text-warning hover:bg-warning hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">refresh</span>
                    <span>Actualizar Solicitudes y Alumnos</span>
                </button>
            </div>

            <!-- BANDEJA 1: NOTIFICACIONES DE SOLICITUDES DE CAMBIO O RESET DE DISPOSITIVO -->
            <div class="bg-surface border border-surface-high rounded-2xl p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <h4 class="text-xs font-mono font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
                        <span class="material-symbols-outlined text-base">notifications_active</span>
                        <span>Bandeja de Solicitudes (Cambio de Carrera / Área Adicional / Reset de Dispositivo)</span>
                    </h4>
                    <span id="access-requests-count-label" class="text-[11px] font-mono text-warning font-bold">Cargando...</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-xs text-left text-gray-300 font-mono">
                        <thead class="text-[10px] text-gray-400 uppercase bg-surface-container border-b border-surface-high">
                            <tr>
                                <th class="px-3 py-2.5">Fecha / Alumno</th>
                                <th class="px-3 py-2.5">Tipo de Solicitud</th>
                                <th class="px-3 py-2.5">Área Actual → Solicitada</th>
                                <th class="px-3 py-2.5">Motivo del Estudiante</th>
                                <th class="px-3 py-2.5 text-right">Acción del Administrador Maestro</th>
                            </tr>
                        </thead>
                        <tbody id="admin-career-requests-tbody">
                            <tr><td colspan="5" class="px-4 py-5 text-center text-gray-500">Consultando solicitudes pendientes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- BANDEJA 2: INTERRUPTORES DE CARRERAS, PLANES Y CONTROL DE 2 DISPOSITIVOS POR ESTUDIANTE -->
            <div class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <h4 class="text-xs font-mono font-extrabold text-secondary uppercase tracking-wider flex items-center gap-2 mr-2">
                            <span class="material-symbols-outlined text-base">tune</span>
                            <span>Expediente Maestro de Alumnos</span>
                        </h4>
                        <button type="button" data-user-filter="all" class="btn-user-quick-filter px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-primary text-surface">
                            Todos
                        </button>
                        <button type="button" data-user-filter="with_devices" class="btn-user-quick-filter px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-surface border border-surface-high text-gray-400 hover:text-white">
                            💻📱 Con Equipos Vinculados
                        </button>
                        <button type="button" data-user-filter="multi_career" class="btn-user-quick-filter px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-surface border border-surface-high text-gray-400 hover:text-white">
                            🎓 Multinivel / +2 Carreras
                        </button>
                    </div>

                    <input type="search" id="admin-access-user-search" placeholder="Buscar por nombre, correo, cédula o carrera..." class="w-full sm:w-80 bg-surface border border-surface-high rounded-xl px-3.5 py-2 text-xs text-white focus:border-primary focus:outline-none" />
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-xs text-left text-gray-300 font-mono">
                        <thead class="text-[10px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                            <tr>
                                <th class="px-3 py-3">Estudiante / Plan</th>
                                <th class="px-3 py-3">Área Principal</th>
                                <th class="px-3 py-3">Interruptores: Carreras Habilitadas (Clic para Activar / Desactivar)</th>
                                <th class="px-3 py-3">Dispositivos Vinculados (1 PC + 1 Móvil)</th>
                            </tr>
                        </thead>
                        <tbody id="admin-users-access-tbody">
                            <tr><td colspan="4" class="px-4 py-6 text-center text-gray-500">Cargando expediente de estudiantes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    adminView.appendChild(section);

    document.getElementById("btn-refresh-access-manager")?.addEventListener("click", loadAdminAccessAndDevicesData);
    document.getElementById("admin-access-user-search")?.addEventListener("input", renderAdminUsersAccessTable);

    section.querySelectorAll(".btn-user-quick-filter").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilterMode = btn.dataset.userFilter || "all";
            section.querySelectorAll(".btn-user-quick-filter").forEach(b => {
                const active = b.dataset.userFilter === currentFilterMode;
                b.className = active
                    ? "btn-user-quick-filter px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-primary text-surface"
                    : "btn-user-quick-filter px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-surface border border-surface-high text-gray-400 hover:text-white";
            });
            renderAdminUsersAccessTable();
        });
    });

    loadAdminAccessAndDevicesData();
}

export const initAdminAccessAndDevicesManager = initAdminUsers;

export async function loadAdminAccessAndDevicesData() {
    if (!verifyPermissions()) return;

    try {
        const [usersSnap, reqsSnap] = await Promise.all([
            getDocs(collection(db, SAFE_COLLECTIONS.USERS)),
            getDocs(collection(db, SAFE_COLLECTIONS.CAREER_REQUESTS))
        ]);

        cachedAdminUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedCareerRequests = reqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderAdminCareerRequestsTable();
        renderAdminUsersAccessTable();
    } catch (err) {
        console.warn("[AdminUsers] Error cargando solicitudes de carrera y dispositivos:", err);
    }
}

function renderAdminCareerRequestsTable() {
    const tbody = document.getElementById("admin-career-requests-tbody");
    const countLabel = document.getElementById("access-requests-count-label");
    if (!tbody) return;

    const pendingCareerReqs = cachedCareerRequests.filter(r => !r.estado || r.estado.includes("pendiente"));
    const pendingDeviceResets = cachedAdminUsers.filter(u => u.dispositivosRegistrados?.solicitudResetPendiente);
    const totalNotifications = pendingCareerReqs.length + pendingDeviceResets.length;

    if (countLabel) {
        countLabel.textContent = `${totalNotifications} pendiente(s)`;
    }

    // Actualizar todos los globos de notificación (tanto en el sidebar como en subtabs)
    document.querySelectorAll("#badge-pending-career-reqs, .badge-pending-career-reqs").forEach(badge => {
        badge.textContent = String(totalNotifications);
        badge.classList.toggle("hidden", totalNotifications === 0);
    });

    if (totalNotifications === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-5 text-center text-gray-500">No hay solicitudes pendientes de cambio de carrera ni de desbloqueo de dispositivos.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    // 1. Filas de Solicitudes de Cambio / Carrera Adicional
    pendingCareerReqs.forEach(req => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high hover:bg-surface-container/60";
        tr.innerHTML = `
            <td class="px-3 py-3">
                <div class="text-white font-bold">${req.estudianteNombre || "Estudiante"}</div>
                <div class="text-[10px] text-primary">${req.estudianteEmail || ""}</div>
                <div class="text-[10px] text-gray-500">${req.fechaSolicitud || ""}</div>
            </td>
            <td class="px-3 py-3">
                <span class="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold uppercase">
                    ${req.tipoSolicitud === "cambiar_carrera_principal" ? "🔄 Cambio de Carrera Principal" : "➕ Habilitar Carrera Adicional"}
                </span>
            </td>
            <td class="px-3 py-3">
                <span class="text-gray-400">${req.carreraActual || "medicina"}</span>
                <span class="text-warning font-bold mx-1">→</span>
                <span class="text-secondary font-extrabold uppercase">${req.carreraSolicitada || ""}</span>
            </td>
            <td class="px-3 py-3 max-w-xs text-[11px] text-gray-300">
                ${req.motivo || "Sin motivo especificado"}
            </td>
            <td class="px-3 py-3 text-right space-x-1.5 whitespace-nowrap">
                <button type="button" class="btn-approve-career-req px-3 py-1.5 rounded-lg bg-secondary text-surface font-extrabold text-[11px] hover:opacity-90">
                    ✓ Aprobar y Activar
                </button>
                <button type="button" class="btn-reject-career-req px-2.5 py-1.5 rounded-lg bg-surface-container border border-danger text-danger hover:bg-danger hover:text-white font-bold text-[11px]">
                    ✕ Rechazar
                </button>
            </td>
        `;

        tr.querySelector(".btn-approve-career-req")?.addEventListener("click", () => approveCareerRequest(req));
        tr.querySelector(".btn-reject-career-req")?.addEventListener("click", () => rejectCareerRequest(req));
        tbody.appendChild(tr);
    });

    // 2. Filas de Solicitudes de Reset de Dispositivo (1+1)
    pendingDeviceResets.forEach(u => {
        const reqDev = u.dispositivosRegistrados.solicitudResetPendiente;
        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high bg-warning/5";
        tr.innerHTML = `
            <td class="px-3 py-3">
                <div class="text-white font-bold">${u.nombre || u.email}</div>
                <div class="text-[10px] text-warning">${u.email || ""}</div>
            </td>
            <td class="px-3 py-3">
                <span class="px-2 py-0.5 rounded bg-warning/20 text-warning text-[10px] font-bold uppercase">
                    🔓 Desbloqueo de Dispositivo (${reqDev.slotSolicitado === "desktop" ? "PC" : "Móvil"})
                </span>
            </td>
            <td class="px-3 py-3 text-[11px] text-gray-200">
                Nuevo equipo: <strong>${reqDev.nuevoDispositivo?.etiqueta || "Equipo"}</strong>
            </td>
            <td class="px-3 py-3 text-[11px] text-gray-400">
                Solicitó resetear el límite mensual de dispositivos.
            </td>
            <td class="px-3 py-3 text-right">
                <button type="button" class="btn-approve-dev-reset px-3 py-1.5 rounded-lg bg-warning text-surface font-extrabold text-[11px]">
                    🔓 Liberar y Autorizar Equipo
                </button>
            </td>
        `;

        tr.querySelector(".btn-approve-dev-reset")?.addEventListener("click", () => resetStudentDevices(u.id, "all"));
        tbody.appendChild(tr);
    });
}

function renderAdminUsersAccessTable() {
    const tbody = document.getElementById("admin-users-access-tbody");
    if (!tbody) return;

    const query = (document.getElementById("admin-access-user-search")?.value || "").toLowerCase().trim();

    const filtered = cachedAdminUsers.filter(u => {
        const devs = u.dispositivosRegistrados || {};
        const enabledList = Array.isArray(u.carrerasHabilitadas) ? u.carrerasHabilitadas : [u.carrera || "medicina"];

        if (currentFilterMode === "with_devices" && !devs.desktop && !devs.mobile) {
            return false;
        }
        if (currentFilterMode === "multi_career" && enabledList.length < 2) {
            return false;
        }
        if (!query) return true;
        const haystack = `${u.nombre || ""} ${u.email || ""} ${u.cedula || ""} ${u.carrera || ""} ${u.subscriptionLevel || ""}`.toLowerCase();
        return haystack.includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-500">No se encontraron estudiantes con ese criterio.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(u => {
        const primaryCareer = u.carrera || "medicina";
        const enabledList = Array.isArray(u.carrerasHabilitadas) && u.carrerasHabilitadas.length > 0
            ? u.carrerasHabilitadas
            : [primaryCareer];

        const currentPlan = u.subscriptionLevel || "Básico";
        const devs = u.dispositivosRegistrados || {};
        const pcDev = devs.desktop || null;
        const mobDev = devs.mobile || null;

        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high hover:bg-surface/60 align-top";

        tr.innerHTML = `
            <td class="px-3 py-3.5 space-y-1.5">
                <div class="text-white font-bold">${u.nombre || "Sin nombre"}</div>
                <div class="text-[11px] text-primary">${u.email || ""}</div>
                <div class="text-[10px] text-gray-500">Cédula: ${u.cedula || "---"}</div>
                <div class="pt-1 flex items-center gap-1.5">
                    <span class="text-[10px] text-gray-400">Plan:</span>
                    <select class="select-user-plan bg-surface border border-secondary/50 rounded-lg px-2 py-0.5 text-[10px] text-secondary font-extrabold focus:outline-none">
                        <option value="Básico" ${currentPlan === "Básico" ? "selected" : ""}>🔓 Básico</option>
                        <option value="PRO" ${currentPlan === "PRO" ? "selected" : ""}>⚡ PRO</option>
                        <option value="VIP" ${currentPlan === "VIP" ? "selected" : ""}>👑 VIP</option>
                    </select>
                </div>
            </td>

            <td class="px-3 py-3.5">
                <select class="select-user-primary-career bg-surface border border-primary/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-bold focus:outline-none">
                    ${ADMIN_CAREER_OPTIONS.map(opt => `
                        <option value="${opt.id}" ${opt.id === primaryCareer ? "selected" : ""}>${opt.nombre}</option>
                    `).join("")}
                </select>
                <div class="text-[10px] text-gray-400 mt-1">
                    Modalidad: <span class="text-warning">${primaryCareer === "preuniversitario_salud" ? "Preuniversitario" : "Universitario"}</span>
                </div>
            </td>

            <td class="px-3 py-3.5">
                <div class="flex flex-wrap gap-1.5 max-w-xl">
                    ${ADMIN_CAREER_OPTIONS.map(opt => {
                        const isActive = enabledList.includes(opt.id);
                        return `
                            <button type="button"
                                    data-toggle-career="${opt.id}"
                                    title="Clic para ${isActive ? 'Desactivar' : 'Activar'} ${opt.nombre}"
                                    class="btn-toggle-user-career px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                                        isActive
                                            ? "bg-secondary/20 border-secondary text-secondary shadow-[0_0_8px_rgba(148,222,45,0.2)]"
                                            : "bg-surface border-surface-high text-gray-500 hover:border-gray-400 hover:text-gray-300"
                                    }">
                                ${isActive ? "✓ " : "+ "}${opt.short}
                            </button>
                        `;
                    }).join("")}
                </div>
            </td>

            <td class="px-3 py-3.5 space-y-2 min-w-[230px]">
                <div class="p-2 rounded-lg bg-surface border border-surface-high flex items-center justify-between gap-2">
                    <div class="truncate">
                        <span class="text-[10px] text-primary font-bold block">💻 Slot 1 (PC):</span>
                        <span class="text-[10px] text-gray-300 truncate block" title="${pcDev?.etiqueta || 'Libre'}">${pcDev ? pcDev.etiqueta : "Libre"}</span>
                    </div>
                    ${pcDev ? `<button type="button" class="btn-reset-pc px-2 py-1 rounded bg-danger/20 border border-danger text-danger text-[10px] font-bold shrink-0">Liberar PC</button>` : ""}
                </div>

                <div class="p-2 rounded-lg bg-surface border border-surface-high flex items-center justify-between gap-2">
                    <div class="truncate">
                        <span class="text-[10px] text-secondary font-bold block">📱 Slot 2 (Móvil):</span>
                        <span class="text-[10px] text-gray-300 truncate block" title="${mobDev?.etiqueta || 'Libre'}">${mobDev ? mobDev.etiqueta : "Libre"}</span>
                    </div>
                    ${mobDev ? `<button type="button" class="btn-reset-mob px-2 py-1 rounded bg-danger/20 border border-danger text-danger text-[10px] font-bold shrink-0">Liberar Móvil</button>` : ""}
                </div>

                ${(pcDev || mobDev) ? `
                    <button type="button" class="btn-reset-both w-full py-1 rounded-lg bg-surface-high hover:bg-warning hover:text-surface text-warning text-[10px] font-bold transition-all">
                        🔄 Resetear Ambos Equipos y Contador
                    </button>
                ` : ""}
            </td>
        `;

        // Cambiar Plan de Suscripción en vivo
        const planSelect = tr.querySelector(".select-user-plan");
        planSelect?.addEventListener("change", async () => {
            await updateStudentSubscriptionPlan(u.id, planSelect.value);
        });

        // Cambiar carrera principal
        const primarySelect = tr.querySelector(".select-user-primary-career");
        primarySelect?.addEventListener("change", async () => {
            const newPrimary = primarySelect.value;
            const newEnabled = Array.from(new Set([newPrimary, ...enabledList]));
            await updateStudentCareerPermissions(u.id, newPrimary, newEnabled);
        });

        // Activar / Desactivar carreras adicionales con 1 clic
        tr.querySelectorAll(".btn-toggle-user-career").forEach(btn => {
            btn.addEventListener("click", async () => {
                const targetCareer = btn.dataset.toggleCareer;
                let updatedList = [...enabledList];

                if (updatedList.includes(targetCareer)) {
                    if (updatedList.length === 1) {
                        alert("⚠️ El estudiante debe tener al menos 1 área o carrera activa.");
                        return;
                    }
                    updatedList = updatedList.filter(c => c !== targetCareer);
                } else {
                    updatedList.push(targetCareer);
                }

                const finalPrimary = updatedList.includes(primaryCareer) ? primaryCareer : updatedList[0];
                await updateStudentCareerPermissions(u.id, finalPrimary, updatedList);
            });
        });

        // Botones de liberación de dispositivos (PC / Móvil / Ambos)
        tr.querySelector(".btn-reset-pc")?.addEventListener("click", () => resetStudentDevices(u.id, "desktop"));
        tr.querySelector(".btn-reset-mob")?.addEventListener("click", () => resetStudentDevices(u.id, "mobile"));
        tr.querySelector(".btn-reset-both")?.addEventListener("click", () => resetStudentDevices(u.id, "all"));

        tbody.appendChild(tr);
    });
}

async function updateStudentSubscriptionPlan(uid, newPlan) {
    if (!verifyPermissions() || !uid) return;
    try {
        await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            subscriptionLevel: newPlan,
            updatedByAdminAt: new Date().toISOString()
        });
        await loadAdminAccessAndDevicesData();
    } catch (err) {
        alert("Error al actualizar el Plan del estudiante: " + err.message);
    }
}

async function updateStudentCareerPermissions(uid, primaryCareer, enabledCareersArray) {
    if (!verifyPermissions() || !uid) return;
    const isPreuni = primaryCareer === "preuniversitario_salud";

    try {
        await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            carrera: primaryCareer,
            nivelIngreso: isPreuni ? "preuniversitario" : "universitario",
            esPreuniversitarioExclusivo: isPreuni,
            carrerasHabilitadas: enabledCareersArray,
            updatedByAdminAt: new Date().toISOString()
        });
        await loadAdminAccessAndDevicesData();
    } catch (err) {
        alert("Error al actualizar las carreras del estudiante: " + err.message);
    }
}

async function approveCareerRequest(req) {
    if (!verifyPermissions() || !req) return;

    try {
        const student = cachedAdminUsers.find(u => u.id === req.uid || u.email === req.estudianteEmail);
        const targetCareer = req.carreraSolicitada || "medicina";

        if (student) {
            const currentEnabled = Array.isArray(student.carrerasHabilitadas) && student.carrerasHabilitadas.length > 0
                ? student.carrerasHabilitadas
                : [student.carrera || "medicina"];

            let newPrimary = student.carrera || "medicina";
            let newEnabled = [...currentEnabled];

            if (req.tipoSolicitud === "cambiar_carrera_principal") {
                newPrimary = targetCareer;
                newEnabled = [targetCareer];
            } else {
                newEnabled = Array.from(new Set([...currentEnabled, targetCareer]));
            }

            const isPreuni = newPrimary === "preuniversitario_salud";
            await updateDoc(doc(db, SAFE_COLLECTIONS.USERS, student.id), {
                carrera: newPrimary,
                nivelIngreso: isPreuni ? "preuniversitario" : "universitario",
                esPreuniversitarioExclusivo: isPreuni,
                carrerasHabilitadas: newEnabled,
                updatedByAdminAt: new Date().toISOString()
            });
        }

        await updateDoc(doc(db, SAFE_COLLECTIONS.CAREER_REQUESTS, req.id), {
            estado: "aprobada_por_admin",
            aprobadoPor: auth.currentUser?.email || "admin",
            fechaResolucion: new Date().toISOString()
        });

        await loadAdminAccessAndDevicesData();
    } catch (err) {
        alert("Error al aprobar la solicitud: " + err.message);
    }
}

async function rejectCareerRequest(req) {
    if (!verifyPermissions() || !req) return;
    try {
        await updateDoc(doc(db, SAFE_COLLECTIONS.CAREER_REQUESTS, req.id), {
            estado: "rechazada_por_admin",
            fechaResolucion: new Date().toISOString()
        });
        await loadAdminAccessAndDevicesData();
    } catch (err) {
        alert("Error al rechazar la solicitud: " + err.message);
    }
}

async function resetStudentDevices(uid, mode = "all") {
    if (!verifyPermissions() || !uid) return;

    const student = cachedAdminUsers.find(u => u.id === uid);
    const currentDevs = student?.dispositivosRegistrados || {};
    const currentMonthKey = new Date().toISOString().slice(0, 7);

    const updatedDevs = {
        ...currentDevs,
        desktop: (mode === "all" || mode === "desktop") ? null : (currentDevs.desktop || null),
        mobile: (mode === "all" || mode === "mobile") ? null : (currentDevs.mobile || null),
        controlReemplazos: { mes: currentMonthKey, usados: 0 },
        solicitudResetPendiente: null
    };

    try {
        await setDoc(doc(db, SAFE_COLLECTIONS.USERS, uid), {
            dispositivosRegistrados: updatedDevs
        }, { merge: true });
        await loadAdminAccessAndDevicesData();
    } catch (err) {
        alert("Error al liberar dispositivo(s): " + err.message);
    }
}
