// ============================================================================
// ARCHIVO: js/2-core/router.spa.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Enrutador del Túnel Universitario por Carrera y Semestre,
//                  Lanzador de Simuladores Contextuales (1D/2D/3D) y Solicitud
//                  de Segunda Carrera a la Bóveda Admin.
// ============================================================================

import {
    db,
    auth,
    addDoc,
    collection
} from "./firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "./state.store.js";

import { makaiData } from "./curriculum.data.js";

let routerBound = false;

/**
 * Obtiene el objeto completo de la carrera activa en el túnel del usuario.
 */
export function getActiveCareerObject() {
    const list = window.makaiData?.carreras || makaiData.carreras || [];
    const targetId = (
        appState.currentCareerTunnel && appState.currentCareerTunnel !== "ALL"
            ? appState.currentCareerTunnel
            : (appState.currentUserData?.carrera || "medicina")
    ).toLowerCase();

    return list.find(c => c.id === targetId) || list[0];
}

/**
 * Obtiene la lista de materias para un semestre específico de la carrera.
 * Si la carrera no tiene semestres desglosados uno por uno, distribuye sus ejes oficiales.
 */
function getSubjectsForCareerAndSemester(careerObj, semesterNumber = 1) {
    if (!careerObj) return [];
    if (careerObj.semestres && Array.isArray(careerObj.semestres[semesterNumber])) {
        return careerObj.semestres[semesterNumber];
    }
    return Array.isArray(careerObj.materias) ? careerObj.materias : [];
}

/**
 * Resuelve los nombres de los Simuladores 2D y 3D contextuales según el nombre de la asignatura.
 */
function resolveContextualSimulatorsForSubject(subjectName = "") {
    const lower = subjectName.toLowerCase();
    const rules = makaiData.contextualSimulators?.byKeyword || [];
    for (const rule of rules) {
        if (lower.includes(rule.match)) {
            return { sim2d: rule.sim2d, sim3d: rule.sim3d };
        }
    }
    return {
        sim2d: `${makaiData.contextualSimulators.default2D} (${subjectName})`,
        sim3d: `${makaiData.contextualSimulators.default3D} (${subjectName})`
    };
}

/**
 * Emite el evento global `makai:curriculumChanged` para que `engine1d.controller.js`,
 * `exam.controller.js`, `engine2d` y `sim3d` filtren su contenido automáticamente.
 */
export function broadcastCurriculumSelection({ routeType = "carrera", careerId, semester, subject }) {
    appState.currentCareerTunnel = careerId;
    appState.currentStage = semester;
    appState.currentSubject = subject;

    const breadcrumb = document.getElementById("header-active-breadcrumb");
    if (breadcrumb) {
        breadcrumb.textContent = `${String(careerId || "medicina").toUpperCase()} • SEMESTRE ${semester || 1} • ${subject || "GENERAL"}`;
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("makai:curriculumChanged", {
            detail: { routeType, careerId, semester, subject }
        }));
    }
}

/**
 * Renderiza la Malla Semestral y las tarjetas de asignaturas con Simuladores Contextuales.
 */
export function renderCareerTunnelView() {
    const careerObj = getActiveCareerObject();
    if (!careerObj) return;

    const semesterSelect = document.getElementById("tunnel-semester-select");
    const titleEl = document.getElementById("tunnel-career-title");
    const activeCareerPill = document.getElementById("active-career-pill");
    const activeSemesterPill = document.getElementById("active-semester-pill");
    const subjectsGrid = document.getElementById("tunnel-subjects-grid");
    const launcherSubjectSelect = document.getElementById("launcher-subject-filter");

    const currentSem = Number(appState.currentStage || appState.currentUserData?.semestreActual || 1);

    if (titleEl) titleEl.textContent = `Túnel Académico: ${careerObj.nombre}`;
    if (activeCareerPill) activeCareerPill.textContent = careerObj.nombre;
    if (activeSemesterPill) {
        activeSemesterPill.textContent = currentSem >= 9
            ? `Etapa Actual: Internado / CACES (${currentSem}° Sem)`
            : `Etapa Actual: ${currentSem}° Semestre`;
    }

    // Poblar selector de semestres (1° al 10°)
    if (semesterSelect && !semesterSelect.dataset.populated) {
        semesterSelect.dataset.populated = "1";
        semesterSelect.innerHTML = Array.from({ length: 10 }, (_, idx) => {
            const semNum = idx + 1;
            const label = semNum === 9
                ? "9° Semestre • Internado Rotativo I"
                : (semNum === 10 ? "10° Semestre • Internado & CACES" : `${semNum}° Semestre Universitario`);
            return `<option value="${semNum}" ${semNum === currentSem ? "selected" : ""}>${label}</option>`;
        }).join("");

        semesterSelect.addEventListener("change", () => {
            appState.currentStage = Number(semesterSelect.value || 1);
            renderCareerTunnelView();
        });
    }

    // Poblar selector de materias en el Lanzador CACES
    if (launcherSubjectSelect) {
        const officialSubjects = careerObj.materias || [];
        launcherSubjectSelect.innerHTML = [
            `<option value="todas">Todas las Materias Oficiales (${careerObj.nombre})</option>`,
            ...officialSubjects.map(sub => `<option value="${sub}">${sub}</option>`)
        ].join("");
    }

    if (!subjectsGrid) return;

    const selectedSem = Number(semesterSelect?.value || currentSem || 1);
    const subjects = getSubjectsForCareerAndSemester(careerObj, selectedSem);

    subjectsGrid.innerHTML = subjects.map((subjectName, index) => {
        const sims = resolveContextualSimulatorsForSubject(subjectName);
        return `
            <article class="bg-surface-container border border-surface-high hover:border-primary/60 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono font-extrabold uppercase">
                            Semestre ${selectedSem} • Eje 0${index + 1}
                        </span>
                        <span class="text-[10px] font-mono text-gray-500">${careerObj.id.toUpperCase()}</span>
                    </div>

                    <h3 class="text-base font-extrabold text-white leading-snug mb-2">
                        ${subjectName}
                    </h3>

                    <p class="text-[11px] font-mono text-gray-400 mb-4">
                        • ${sims.sim2d}<br>
                        • ${sims.sim3d}
                    </p>
                </div>

                <!-- Botones de Simuladores Contextuales de la Materia -->
                <div class="space-y-2 pt-3 border-t border-surface-high">
                    <div class="grid grid-cols-2 gap-2">
                        <button type="button"
                            data-contextual-action="sinaptico"
                            data-subject="${subjectName}"
                            class="py-2 px-3 rounded-xl bg-surface border border-secondary/50 hover:bg-secondary hover:text-surface text-secondary font-mono font-extrabold text-[11px] transition-all">
                            🧠 Sináptico 1D
                        </button>
                        <button type="button"
                            data-contextual-action="reader"
                            data-subject="${subjectName}"
                            class="py-2 px-3 rounded-xl bg-surface border border-primary/50 hover:bg-primary hover:text-surface text-primary font-mono font-extrabold text-[11px] transition-all">
                            📚 Guías & GPC
                        </button>
                    </div>

                    <button type="button"
                        data-contextual-action="simulators"
                        data-subject="${subjectName}"
                        class="w-full py-2.5 px-3 rounded-xl bg-primary/15 border border-primary/40 hover:bg-primary hover:text-surface text-primary font-mono font-extrabold text-[11px] transition-all flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">vital_signs</span>
                        <span>Lanzar Simulador 2D / 3D de ${subjectName.split(" ")[0]}</span>
                    </button>
                </div>
            </article>
        `;
    }).join("");

    // Enlazar clics de los botones contextuales de cada materia
    subjectsGrid.querySelectorAll("[data-contextual-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.contextualAction;
            const subject = btn.dataset.subject || "General";

            broadcastCurriculumSelection({
                routeType: "carrera",
                careerId: careerObj.id,
                semester: selectedSem,
                subject
            });

            if (action === "sinaptico" || action === "reader") {
                window.MakaiOrchestrator?.switchView?.("view-spaced");
                const modeBtn = document.getElementById(action === "reader" ? "btn-mode-reader" : "btn-mode-sinaptico");
                modeBtn?.click();
            } else if (action === "simulators") {
                const badge = document.getElementById("sim-context-subject-badge");
                if (badge) badge.textContent = `Materia Activa: ${subject}`;
                window.MakaiOrchestrator?.switchView?.("view-simulators-hub");
            }
        });
    });
}

/**
 * Inicializa el Enrutador SPA y los controles de carrera.
 */
export async function initRouterSPA(user = null, userData = null) {
    if (routerBound) return;
    routerBound = true;

    const email = user?.email || userData?.email || "";
    const isMaster = isMasterAdmin(email);
    const allowedCareers = Array.isArray(userData?.carrerasHabilitadas) ? userData.carrerasHabilitadas : [];

    // 1. Si es Master Admin o tiene múltiples carreras autorizadas, habilitar el selector superior
    const switcherWrap = document.getElementById("admin-career-switcher-wrap");
    const globalSelector = document.getElementById("global-career-selector");

    if (switcherWrap && globalSelector && (isMaster || allowedCareers.length > 1)) {
        switcherWrap.classList.remove("hidden");
        const allCareers = window.makaiData?.carreras || makaiData.carreras;
        const visibleList = isMaster
            ? allCareers
            : allCareers.filter(c => allowedCareers.includes(c.id) || c.id === userData?.carrera);

        globalSelector.innerHTML = visibleList.map(c =>
            `<option value="${c.id}" ${c.id === (userData?.carrera || "medicina") ? "selected" : ""}>${c.nombre}</option>`
        ).join("");

        globalSelector.addEventListener("change", () => {
            appState.currentCareerTunnel = globalSelector.value;
            renderCareerTunnelView();
        });
    }

    // 2. Botón para solicitar cambio o adición de una segunda carrera (envía a `solicitudes_cambio_carrera`)
    document.getElementById("btn-request-career-switch")?.addEventListener("click", async () => {
        const requested = prompt("Escribe el nombre de la carrera adicional que deseas solicitar al Administrador Maestro (ej. Enfermería, Odontología):");
        if (!requested || !requested.trim()) return;

        try {
            await addDoc(collection(db, "solicitudes_cambio_carrera"), {
                uid: user?.uid || userData?.uid || "guest",
                email: email,
                nombre: userData?.nombre || email,
                carreraActual: userData?.carrera || "medicina",
                carreraSolicitada: requested.trim(),
                estado: "pendiente",
                fechaSolicitud: new Date().toISOString()
            });
            window.MakaiSecurityGuard?.showSecurityToast?.(
                "✅ Solicitud enviada a la Bóveda del Administrador Maestro.",
                "success"
            );
        } catch (err) {
            window.MakaiSecurityGuard?.showSecurityToast?.(
                "No se pudo enviar la solicitud en este momento.",
                "warning"
            );
        }
    });

    // 3. Conmutador rápido entre Sináptico v4.4 y Biblioteca 1D dentro de #view-spaced
    const btnSinaptico = document.getElementById("btn-mode-sinaptico");
    const btnReader = document.getElementById("btn-mode-reader");
    const sinapticoBox = document.getElementById("engine1d-sinaptico-container");
    const readerBox = document.getElementById("engine1d-reader-container");

    btnSinaptico?.addEventListener("click", () => {
        sinapticoBox?.classList.remove("hidden");
        readerBox?.classList.add("hidden");
        btnSinaptico.className = "px-4 py-2 rounded-lg bg-primary text-surface font-mono font-extrabold text-xs";
        if (btnReader) btnReader.className = "px-4 py-2 rounded-lg text-gray-400 font-mono font-bold text-xs hover:text-white";
    });

    btnReader?.addEventListener("click", () => {
        readerBox?.classList.remove("hidden");
        sinapticoBox?.classList.add("hidden");
        btnReader.className = "px-4 py-2 rounded-lg bg-primary text-surface font-mono font-extrabold text-xs";
        if (btnSinaptico) btnSinaptico.className = "px-4 py-2 rounded-lg text-gray-400 font-mono font-bold text-xs hover:text-white";
    });

    // 4. Renderizar inicialmente el túnel universitario del alumno
    renderCareerTunnelView();
}

export const initRouter = initRouterSPA;
