// ============================================================================
// ARCHIVO: js/1-admin/admin.controller.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Orquestador de la Bóveda Admin con Ceguera por Diseño (RBAC),
//                  KPIs en Vivo, Gestión de Roles de Empleados, Interruptores de
//                  11 Carreras y Reseteo de Hardware (1 PC + 1 Móvil).
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

import { makaiData } from "../2-core/curriculum.data.js";

let adminBootstrapped = false;
let currentAdminTab = "payments";
let cachedUsersList = [];
let cachedCareerRequests = [];

/**
 * Definición de pestañas administrativas y qué roles tienen permiso de verlas.
 */
const ADMIN_TABS_CONFIG = Object.freeze([
    {
        id: "payments",
        moduleId: "admin-section-payments",
        label: "💳 Auditoría de Pagos",
        roles: ["master", "secretaria"]
    },
    {
        id: "pricing",
        moduleId: "admin-section-pricing",
        label: "🏷️ Gestor de Tarifas (CMS)",
        roles: ["master"] // Exclusivo Olimpo
    },
    {
        id: "users",
        moduleId: "admin-section-users",
        label: "👥 Usuarios, Roles & Dispositivos",
        roles: ["master", "secretaria"]
    },
    {
        id: "workstation",
        moduleId: "admin-section-questions",
        label: "🛠️ Estación de Contenido (CACES / 1D / 3D)",
        roles: ["master", "dev_3d"]
    },
    {
        id: "tutors",
        moduleId: "admin-section-tutors",
        label: "🩺 Marketplace Tutores VIP",
        roles: ["master"]
    },
    {
        id: "backups",
        moduleId: "admin-section-backups",
        label: "💾 Respaldos JSON",
        roles: ["master"]
    }
]);

/**
 * Muestra una notificación rápida dentro de la Bóveda Admin.
 */
export function showAdminToast(message, type = "info") {
    window.MakaiSecurityGuard?.showSecurityToast?.(message, type);
}

/**
 * Carga dinámicamente un submódulo de `js/1-admin/` sin romper la consola si aún es semilla.
 */
async function safeLoadAdminSubmodule(path, fnNames = [], ...args) {
    try {
        const mod = await import(path);
        for (const fn of fnNames) {
            if (typeof mod[fn] === "function") {
                await mod[fn](...args);
                break;
            }
        }
        return mod;
    } catch (err) {
        console.warn(`[AdminVault] Submódulo en espera (${path}):`, err.message || err);
        return null;
    }
}

/**
 * Actualiza los 5 contadores KPI superiores (Solo Master Admin ve el total general).
 */
export async function refreshAdminVaultKPIs() {
    const isMaster = isMasterAdmin(auth.currentUser?.email || appState.currentUser?.email);
    const kpiBar = document.getElementById("admin-master-kpi-bar");
    if (!kpiBar || !isMaster) return;

    try {
        const [usersSnap, paySnap, qSnap, sinSnap, matSnap] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.USERS)),
            getDocs(collection(db, COLLECTIONS.PAYMENTS)),
            getDocs(collection(db, COLLECTIONS.QUESTIONS)),
            getDocs(collection(db, COLLECTIONS.SINAPTICO)),
            getDocs(collection(db, COLLECTIONS.MATERIALS))
        ]);

        let pendingPayments = 0;
        paySnap.forEach(d => {
            if (d.data().estado === "pendiente") pendingPayments++;
        });

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };

        setTxt("kpi-count-users", usersSnap.size);
        setTxt("kpi-count-payments", `${pendingPayments} pend. / ${paySnap.size}`);
        setTxt("kpi-count-questions", qSnap.size);
        setTxt("kpi-count-sinaptico", sinSnap.size);
        setTxt("kpi-count-materials", matSnap.size);
    } catch (err) {
        console.warn("[AdminVault] No se pudieron refrescar los KPIs:", err.message);
    }
}

/**
 * Construye el esqueleto principal de la Bóveda Admin aplicando Ceguera por Diseño.
 */
function renderAdminVaultSkeleton(role) {
    const mount = document.getElementById("admin-vault-mount") || document.getElementById("view-admin");
    if (!mount) return;

    const isMaster = role === "master";
    const allowedTabs = ADMIN_TABS_CONFIG.filter(t => t.roles.includes(role));
    if (allowedTabs.length > 0 && !allowedTabs.some(t => t.id === currentAdminTab)) {
        currentAdminTab = allowedTabs[0].id;
    }

    mount.innerHTML = `
        <div class="space-y-6">
            <!-- CABECERA DE LA BÓVEDA / ESTACIÓN DE TRABAJO -->
            <div class="bg-surface-container border-2 border-warning/50 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xl">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/40 text-[10px] font-mono font-extrabold uppercase">
                            ROL ACTIVO: ${role.toUpperCase()}
                        </span>
                        <span class="text-[10px] font-mono text-gray-400">
                            ● RIELES DE ACERO • CERO ACCESO AL CÓDIGO FUENTE
                        </span>
                    </div>
                    <h2 class="text-xl sm:text-2xl font-extrabold text-white mt-1">
                        ${isMaster ? "⚡ Bóveda Maestra Makai Academy (Olimpo)" : "🛠️ Estación de Trabajo Operativa"}
                    </h2>
                    <p class="text-xs text-gray-400 mt-0.5">
                        ${isMaster
                            ? "Control total de tarifas en vivo, auditoría split-screen, permisos de personal y bases de datos."
                            : "Entorno guiado con permisos específicos asignados por el Administrador Maestro."}
                    </p>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" id="btn-refresh-admin-vault"
                        class="px-4 py-2.5 rounded-xl bg-surface border border-surface-high hover:border-primary text-xs font-mono font-bold text-primary flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">sync</span>
                        <span>Sincronizar Firestore</span>
                    </button>
                </div>
            </div>

            <!-- BARRA DE 5 KPIs EN VIVO (SOLO VISIBLE PARA MASTER ADMIN) -->
            ${isMaster ? `
                <div id="admin-master-kpi-bar" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div class="bg-surface-container border border-surface-high rounded-xl p-4">
                        <span class="text-[10px] font-mono text-gray-400 uppercase block">Usuarios Totales</span>
                        <span id="kpi-count-users" class="text-xl font-mono font-extrabold text-white mt-1 block">...</span>
                    </div>
                    <div class="bg-surface-container border border-warning/40 rounded-xl p-4">
                        <span class="text-[10px] font-mono text-warning uppercase block">Solicitudes Pago</span>
                        <span id="kpi-count-payments" class="text-xl font-mono font-extrabold text-warning mt-1 block">...</span>
                    </div>
                    <div class="bg-surface-container border border-primary/40 rounded-xl p-4">
                        <span class="text-[10px] font-mono text-primary uppercase block">Reactivos CACES</span>
                        <span id="kpi-count-questions" class="text-xl font-mono font-extrabold text-primary mt-1 block">...</span>
                    </div>
                    <div class="bg-surface-container border border-secondary/40 rounded-xl p-4">
                        <span class="text-[10px] font-mono text-secondary uppercase block">Tarjetas Sináptico</span>
                        <span id="kpi-count-sinaptico" class="text-xl font-mono font-extrabold text-secondary mt-1 block">...</span>
                    </div>
                    <div class="bg-surface-container border border-surface-high rounded-xl p-4">
                        <span class="text-[10px] font-mono text-gray-300 uppercase block">Materiales 1D</span>
                        <span id="kpi-count-materials" class="text-xl font-mono font-extrabold text-white mt-1 block">...</span>
                    </div>
                </div>
            ` : ""}

            <!-- PESTAÑAS DE NAVEGACIÓN INTERNA SEGÚN ROL -->
            <div class="flex flex-wrap gap-2 border-b border-surface-high pb-3">
                ${allowedTabs.map(tab => `
                    <button type="button"
                        data-admin-tab-btn="${tab.id}"
                        class="px-4 py-2.5 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            tab.id === currentAdminTab
                                ? "bg-warning text-surface shadow-lg"
                                : "bg-surface-container border border-surface-high text-gray-300 hover:border-warning/50"
                        }">
                        ${tab.label}
                    </button>
                `).join("")}
            </div>

            <!-- CONTENEDORES DE CADA SUB-MÓDULO (Protegidos por data-admin-module) -->
            <div id="admin-tab-panel-payments" data-admin-module="admin-section-payments"
                class="${currentAdminTab === "payments" ? "" : "hidden"}"></div>

            <div id="admin-tab-panel-pricing" data-admin-module="admin-section-pricing"
                class="${currentAdminTab === "pricing" ? "" : "hidden"}"></div>

            <div id="admin-tab-panel-users" data-admin-module="admin-section-users"
                class="${currentAdminTab === "users" ? "" : "hidden"}"></div>

            <div id="admin-tab-panel-workstation" data-admin-module="admin-section-questions"
                class="${currentAdminTab === "workstation" ? "" : "hidden"} space-y-6">
                <div id="admin-questions-mount"></div>
                <div id="admin-sinaptico-mount"></div>
                <div id="admin-materials-mount"></div>
            </div>

            <div id="admin-tab-panel-tutors" data-admin-module="admin-section-tutors"
                class="${currentAdminTab === "tutors" ? "" : "hidden"}"></div>

            <div id="admin-tab-panel-backups" data-admin-module="admin-section-backups"
                class="${currentAdminTab === "backups" ? "" : "hidden"}"></div>
        </div>
    `;

    // Aplicar limpieza DOM del Guardia de Seguridad
    window.MakaiSecurityGuard?.applyRoleBlindnessInsideVault?.(role);

    // Enlazar cambio de pestañas
    mount.querySelectorAll("[data-admin-tab-btn]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentAdminTab = btn.dataset.adminTabBtn;
            renderAdminVaultSkeleton(role);
            activateSelectedAdminSubmodule(role);
        });
    });

    document.getElementById("btn-refresh-admin-vault")?.addEventListener("click", () => {
        refreshAdminVaultKPIs();
        activateSelectedAdminSubmodule(role, true);
        showAdminToast("Datos sincronizados con Cloud Firestore.", "info");
    });
}

// ============================================================================
// GESTIÓN DE USUARIOS, ROLES DE EMPLEADOS, MULTICARRERA Y RESET DE HARDWARE
// ============================================================================

async function renderUsersAndRolesManagement(role) {
    const container = document.getElementById("admin-tab-panel-users");
    if (!container) return;

    const isMaster = role === "master";
    container.innerHTML = `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 text-xs font-mono text-primary">
            Cargando expedientes de usuarios y solicitudes de cambio de carrera...
        </div>
    `;

    try {
        const [usersSnap, reqSnap] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.USERS)),
            getDocs(collection(db, "solicitudes_cambio_carrera")).catch(() => ({ forEach: () => {} }))
        ]);

        cachedUsersList = [];
        usersSnap.forEach(d => cachedUsersList.push({ id: d.id, ...d.data() }));

        cachedCareerRequests = [];
        reqSnap.forEach(d => {
            const data = d.data();
            if (data.estado === "pendiente") cachedCareerRequests.push({ id: d.id, ...data });
        });
    } catch (err) {
        container.innerHTML = `<div class="p-4 rounded-xl bg-danger/15 border border-danger text-xs text-danger">Error al cargar usuarios: ${err.message}</div>`;
        return;
    }

    const allCareers = window.makaiData?.carreras || makaiData.carreras || [];

    container.innerHTML = `
        <div class="space-y-6">
            <!-- BANDEJA DE SOLICITUDES DE CAMBIO / SEGUNDA CARRERA -->
            ${cachedCareerRequests.length > 0 ? `
                <div class="bg-surface-container border-2 border-warning rounded-2xl p-5 space-y-3">
                    <h3 class="text-sm font-extrabold text-warning font-mono uppercase">
                        🔔 Solicitudes Pendientes de Segunda Carrera / Cambio (${cachedCareerRequests.length})
                    </h3>
                    <div class="space-y-2">
                        ${cachedCareerRequests.map(req => `
                            <div class="bg-surface border border-surface-high rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                    <span class="font-extrabold text-white">${req.nombre || req.email}</span>
                                    <span class="text-gray-400 font-mono block">
                                        Actual: <strong>${req.carreraActual}</strong> → Solicita habilitar: <strong class="text-primary">${req.carreraSolicitada}</strong>
                                    </span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button type="button" data-approve-career-req="${req.id}" data-req-uid="${req.uid}" data-req-career="${req.carreraSolicitada}"
                                        class="px-3 py-1.5 rounded-lg bg-secondary text-surface font-mono font-extrabold text-xs">
                                        ✅ Autorizar Carrera
                                    </button>
                                    <button type="button" data-reject-career-req="${req.id}"
                                        class="px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger font-mono font-bold text-xs">
                                        Descartar
                                    </button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : ""}

            <!-- BUSCADOR Y TABLA DE USUARIOS / EMPLEADOS / DISPOSITIVOS -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 class="text-lg font-extrabold text-white">Directorio de Usuarios, Roles RBAC & Hardware</h3>
                        <p class="text-xs text-gray-400">
                            Resetea los 2 dispositivos (PC + Móvil), habilita múltiples carreras o asigna roles a tus trabajadores.
                        </p>
                    </div>
                    <input type="search" id="admin-user-search" placeholder="Buscar por correo, nombre o carrera..."
                        class="bg-surface border border-surface-high rounded-xl px-4 py-2 text-xs text-white w-full sm:w-72 focus:border-primary focus:outline-none">
                </div>

                <div id="admin-users-list-mount" class="space-y-3 max-h-[600px] overflow-y-auto pr-1"></div>
            </div>
        </div>
    `;

    const renderFilteredUsers = (queryText = "") => {
        const listMount = document.getElementById("admin-users-list-mount");
        if (!listMount) return;

        const q = queryText.trim().toLowerCase();
        const filtered = cachedUsersList.filter(u =>
            !q ||
            (u.email || "").toLowerCase().includes(q) ||
            (u.nombre || "").toLowerCase().includes(q) ||
            (u.carrera || "").toLowerCase().includes(q)
        );

        listMount.innerHTML = filtered.map(u => {
            const userIsMaster = isMasterAdmin(u.email);
            const deskSlot = u.dispositivosRegistrados?.desktop?.etiqueta || "Libre";
            const mobSlot = u.dispositivosRegistrados?.mobile?.etiqueta || "Libre";
            const enabledCareers = Array.isArray(u.carrerasHabilitadas) ? u.carrerasHabilitadas : [u.carrera || "medicina"];

            return `
                <div class="bg-surface border border-surface-high rounded-xl p-4 space-y-3 text-xs">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-extrabold text-white text-sm">${u.nombre || "Sin nombre"}</span>
                                <span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono font-bold text-[10px] uppercase">
                                    Plan ${u.subscriptionLevel || "Básico"}
                                </span>
                                <span class="px-2 py-0.5 rounded bg-warning/15 text-warning font-mono font-bold text-[10px] uppercase">
                                    Rol: ${userIsMaster ? "MASTER" : (u.rol || "estudiante")}
                                </span>
                            </div>
                            <p class="text-gray-400 font-mono mt-0.5">${u.email} • WhatsApp: ${u.whatsapp || "N/A"} • Carrera base: <strong>${u.carrera || "medicina"}</strong></p>
                            <p class="text-[11px] font-mono text-gray-500 mt-1">
                                💻 Slot PC: <span class="text-gray-300">${deskSlot}</span> | 📱 Slot Móvil: <span class="text-gray-300">${mobSlot}</span>
                            </p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <!-- Botón para Resetear los 2 Dispositivos (Permitido para Master y Secretaría) -->
                            <button type="button" data-reset-devices-uid="${u.id}"
                                class="px-3 py-1.5 rounded-lg bg-surface-container border border-primary/50 hover:bg-primary hover:text-surface text-primary font-mono font-bold text-[11px] transition-all">
                                🔄 Resetear 2 Dispositivos
                            </button>

                            <!-- Selector de Rol RBAC (SOLO MASTER ADMIN PUEDE CREAR TRABAJADORES) -->
                            ${isMaster && !userIsMaster ? `
                                <select data-change-role-uid="${u.id}"
                                    class="bg-surface-container border border-warning/50 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-warning font-bold">
                                    <option value="estudiante" ${(u.rol || "estudiante") === "estudiante" ? "selected" : ""}>Rol: Estudiante</option>
                                    <option value="secretaria" ${u.rol === "secretaria" ? "selected" : ""}>Rol: Secretaría (Pagos/Usuarios)</option>
                                    <option value="dev_3d" ${u.rol === "dev_3d" ? "selected" : ""}>Rol: Digitador / Dev 3D</option>
                                    <option value="docente" ${u.rol === "docente" ? "selected" : ""}>Rol: Docente Especialista</option>
                                </select>
                            ` : ""}
                        </div>
                    </div>

                    <!-- Interruptores (Switches) de las 11 Carreras + Preuniversitario -->
                    <details class="pt-2 border-t border-surface-high">
                        <summary class="cursor-pointer text-[11px] font-mono text-secondary font-bold">
                            ⚙️ Interruptores de Carreras Habilitadas (${enabledCareers.length} activas)
                        </summary>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                            ${allCareers.map(c => {
                                const checked = enabledCareers.includes(c.id) || u.carrera === c.id;
                                return `
                                    <label class="flex items-center gap-2 p-2 rounded-lg bg-surface-container border border-surface-high cursor-pointer text-[11px]">
                                        <input type="checkbox"
                                            data-toggle-career-uid="${u.id}"
                                            data-career-id="${c.id}"
                                            ${checked ? "checked" : ""}
                                            class="accent-primary">
                                        <span class="truncate">${c.nombre}</span>
                                    </label>
                                `;
                            }).join("")}
                        </div>
                    </details>
                </div>
            `;
        }).join("");

        // Eventos: Resetear 2 Dispositivos
        listMount.querySelectorAll("[data-reset-devices-uid]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const uid = btn.dataset.resetDevicesUid;
                await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
                    dispositivosRegistrados: {}
                });
                showAdminToast("✅ Dispositivos (PC y Móvil) liberados correctamente.", "success");
                renderUsersAndRolesManagement(role);
            });
        });

        // Eventos: Cambiar Rol RBAC (Solo Master Admin)
        listMount.querySelectorAll("[data-change-role-uid]").forEach(sel => {
            sel.addEventListener("change", async () => {
                if (!isMaster) return;
                const uid = sel.dataset.changeRoleUid;
                const newRole = sel.value;
                await updateDoc(doc(db, COLLECTIONS.USERS, uid), { rol: newRole });
                showAdminToast(`✅ Rol actualizado a "${newRole.toUpperCase()}" con Ceguera por Diseño.`, "success");
            });
        });

        // Eventos: Interruptores de Carreras Habilitadas
        listMount.querySelectorAll("[data-toggle-career-uid]").forEach(chk => {
            chk.addEventListener("change", async () => {
                const uid = chk.dataset.toggleCareerUid;
                const boxes = listMount.querySelectorAll(`[data-toggle-career-uid="${uid}"]`);
                const selectedIds = [];
                boxes.forEach(b => {
                    if (b.checked) selectedIds.push(b.dataset.careerId);
                });
                if (selectedIds.length === 0) selectedIds.push("medicina");

                await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
                    carrera: selectedIds[0],
                    carrerasHabilitadas: selectedIds
                });
                showAdminToast(`✅ Carreras actualizadas (${selectedIds.join(", ")}).`, "info");
            });
        });
    };

    renderFilteredUsers();

    document.getElementById("admin-user-search")?.addEventListener("input", (e) => {
        renderFilteredUsers(e.target.value);
    });

    // Eventos de Solicitudes de Segunda Carrera
    container.querySelectorAll("[data-approve-career-req]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const reqId = btn.dataset.approveCareerReq;
            const uid = btn.dataset.reqUid;
            const reqCareer = (btn.dataset.reqCareer || "").toLowerCase();
            const targetUser = cachedUsersList.find(u => u.id === uid);
            const currentList = Array.isArray(targetUser?.carrerasHabilitadas)
                ? [...targetUser.carrerasHabilitadas]
                : [targetUser?.carrera || "medicina"];

            if (!currentList.includes(reqCareer)) currentList.push(reqCareer);

            await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
                carrerasHabilitadas: currentList
            }).catch(() => {});
            await updateDoc(doc(db, "solicitudes_cambio_carrera", reqId), {
                estado: "aprobado"
            }).catch(() => {});

            showAdminToast("✅ Segunda carrera habilitada en el expediente del alumno.", "success");
            renderUsersAndRolesManagement(role);
        });
    });

    container.querySelectorAll("[data-reject-career-req]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const reqId = btn.dataset.rejectCareerReq;
            await deleteDoc(doc(db, "solicitudes_cambio_carrera", reqId)).catch(() => {});
            renderUsersAndRolesManagement(role);
        });
    });
}

/**
 * Despierta el submódulo correspondiente a la pestaña activa.
 */
async function activateSelectedAdminSubmodule(role, forceReload = false) {
    if (currentAdminTab === "payments") {
        await safeLoadAdminSubmodule("./admin.payments.js", ["initAdminPayments"], role, "audit", forceReload);
    } else if (currentAdminTab === "pricing" && role === "master") {
        await safeLoadAdminSubmodule("./admin.payments.js", ["initAdminPricingManager"], role);
    } else if (currentAdminTab === "users") {
        await renderUsersAndRolesManagement(role);
    } else if (currentAdminTab === "workstation") {
        await Promise.all([
            safeLoadAdminSubmodule("./admin.questions.js", ["initAdminQuestions"], role),
            safeLoadAdminSubmodule("./admin.sinaptico.js", ["initAdminSinaptico"], role),
            safeLoadAdminSubmodule("./admin.materials.js", ["initAdminMaterials"], role)
        ]);
    } else if (currentAdminTab === "tutors" && role === "master") {
        await safeLoadAdminSubmodule("./admin.tutors.js", ["initAdminTutors"], role);
    } else if (currentAdminTab === "backups" && role === "master") {
        await safeLoadAdminSubmodule("./admin.backups.js", ["initAdminBackups"], role);
    }
}

/**
 * Inicializador principal de la Bóveda Admin invocado por `app.orchestrator.js`.
 */
export async function initAdminController(passedRole = null) {
    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    const role = isMasterAdmin(email) ? "master" : (passedRole || appState.role || "estudiante");

    if (!["master", "secretaria", "dev_3d"].includes(role)) {
        return;
    }

    renderAdminVaultSkeleton(role);
    await refreshAdminVaultKPIs();
    await activateSelectedAdminSubmodule(role);
    adminBootstrapped = true;
}

export const initAdmin = initAdminController;

