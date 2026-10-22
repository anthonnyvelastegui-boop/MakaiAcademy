// ============================================================================
// ARCHIVO: js/2-core/router.spa.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Subcomponente de Navegación SPA, Conmutador de Vistas
//                  (switchView) y Despliegue Encadenado CARRERA (11) / CACES (4).
// ============================================================================

import * as StateStore from "./state.store.js";

// --- CORREOS MAESTROS DE ADMINISTRACIÓN (RESPALDO DE SEGURIDAD) ---
const FALLBACK_MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

// --- REGISTRO OFICIAL DE VISTAS DEL LIENZO SPA (dashboard.html) ---
export const SPA_VIEWS = {
    LAUNCHER: "view-launcher",
    SIMULATOR: "view-simulator",
    SPACED_1D: "view-spaced",
    SIM_2D: "view-sim2d",
    SIM_3D: "view-sim3d",
    CLASSROOMS: "view-classrooms",
    METRICS: "view-metrics",
    ADMIN: "view-admin"
};

// --- CATÁLOGO DE RESPALDO: 4 CARRERAS OFICIALES CACES ---
const DEFAULT_CACES_CAREERS = [
    {
        id: "medicina",
        nombre: "Medicina Humana (FCS-EC)",
        activa: true,
        materias: [
            "Medicina Interna",
            "Pediatría",
            "Ginecología y Obstetricia",
            "Cirugía General",
            "Salud Pública y Bioética",
            "Urgencias y Cuidados Críticos"
        ],
        nivelesCaces: [
            "Eje Básico Clínico",
            "Eje Quirúrgico y Materno-Infantil",
            "Simulacro Integral CACES (100 Reactivos)"
        ]
    },
    {
        id: "enfermeria",
        nombre: "Enfermería & Cuidados Críticos",
        activa: true,
        materias: [
            "Enfermería Clínico-Quirúrgica",
            "Enfermería Materno-Infantil",
            "Salud Comunitaria y Epidemiología",
            "Farmacología Aplicada",
            "Gestión y Bioética en Enfermería",
            "Cuidados Intensivos y Emergencias"
        ],
        nivelesCaces: [
            "Cuidado Directo y Farmacología",
            "Salud Pública y Materno-Infantil",
            "Simulacro Integral CACES (100 Reactivos)"
        ]
    },
    {
        id: "odontologia",
        nombre: "Odontología Clínica",
        activa: false,
        materias: [
            "Patología y Diagnóstico Oral",
            "Cirugía Oral y Maxilofacial",
            "Endodoncia y Periodoncia",
            "Rehabilitación y Operatoria Dental",
            "Odontopediatría y Ortodoncia",
            "Farmacología y Bioseguridad Odontológica"
        ],
        nivelesCaces: [
            "Diagnóstico y Cirugía Oral",
            "Especialidades Clínicas Odontológicas",
            "Simulacro Integral CACES (100 Reactivos)"
        ]
    },
    {
        id: "obstetricia",
        nombre: "Obstetricia & Salud Materna",
        activa: false,
        materias: [
            "Obstetricia Fisiológica y Alto Riesgo",
            "Ginecología y Salud Sexual",
            "Neonatología e Inmunizaciones",
            "Salud Pública y Normativa MSP",
            "Farmacología Obstétrica",
            "Emergencias Obstétricas (Clave Roja/Azul/Amarilla)"
        ],
        nivelesCaces: [
            "Control Prenatal y Parto Humanizado",
            "Claves Obstétricas y Alto Riesgo",
            "Simulacro Integral CACES (100 Reactivos)"
        ]
    }
];

// --- CATÁLOGO DE RESPALDO: 11 CARRERAS DE CIENCIAS DE LA SALUD ---
const DEFAULT_UNIVERSITY_CAREERS = [
    { id: "medicina", nombre: "1. Medicina Humana", activa: true },
    { id: "enfermeria", nombre: "2. Enfermería", activa: true },
    { id: "odontologia", nombre: "3. Odontología", activa: true },
    { id: "obstetricia", nombre: "4. Obstetricia", activa: true },
    { id: "nutricion", nombre: "5. Nutrición y Dietética", activa: true },
    { id: "fisioterapia", nombre: "6. Fisioterapia y Rehabilitación", activa: true },
    { id: "laboratorio", nombre: "7. Laboratorio Clínico", activa: true },
    { id: "imagenologia", nombre: "8. Imagenología y Radiología", activa: true },
    { id: "farmacia", nombre: "9. Bioquímica y Farmacia", activa: true },
    { id: "psicologia_clinica", nombre: "10. Psicología Clínica", activa: true },
    { id: "paramedicina", nombre: "11. Atención Prehospitalaria y Emergencias", activa: true }
];

// --- ETAPAS FORMATIVAS Y MATERIAS UNIVERSALES POR NIVEL (SECCIÓN CARRERA) ---
const ACADEMIC_STAGES = [
    {
        id: "preuniversitario",
        nombre: "Preuniversitario",
        materias: [
            "Biología Celular y Molecular",
            "Química General y Orgánica",
            "Anatomía y Fisiología Básica",
            "Razonamiento Lógico y Verbal",
            "Terminología Médica"
        ]
    },
    {
        id: "nivelacion",
        nombre: "Nivelación",
        materias: [
            "Morfofisiología I",
            "Bioquímica Médica Elemental",
            "Salud y Sociedad",
            "Biofísica Aplicada",
            "Metodología de la Investigación"
        ]
    },
    {
        id: "semestre_1_2",
        nombre: "1° y 2° Semestre (Ciencias Básicas)",
        materias: [
            "Anatomía Humana Descriptiva",
            "Histología y Embriología",
            "Fisiología Humana I",
            "Bioquímica Clínica",
            "Bioestadística"
        ]
    },
    {
        id: "semestre_3_4",
        nombre: "3° y 4° Semestre (Preclínicas)",
        materias: [
            "Fisiopatología General",
            "Microbiología y Parasitología",
            "Farmacología Básica",
            "Anatomía Patológica",
            "Inmunología y Genética"
        ]
    },
    {
        id: "semestre_5_6",
        nombre: "5° y 6° Semestre (Semiología y Clínica I)",
        materias: [
            "Semiología y Propedéutica Clínica",
            "Farmacología Clínica y Terapéutica",
            "Medicina Interna I / Cuidados Clínicos",
            "Imagenología Diagnóstica",
            "Epidemiología y Salud Pública"
        ]
    },
    {
        id: "semestre_7_8",
        nombre: "7° y 8° Semestre (Clínico-Quirúrgicas)",
        materias: [
            "Clínica Médica Avanzada",
            "Cirugía y Trauma",
            "Pediatría y Neonatología",
            "Ginecología y Salud Reproductiva",
            "Bioética y Medicina Legal"
        ]
    },
    {
        id: "semestre_9_10",
        nombre: "9° y 10° Semestre (Especialidades y Urgencias)",
        materias: [
            "Urgencias y Cuidados Críticos",
            "Salud Mental y Psiquiatría",
            "Geriatría y Cuidados Paliativos",
            "Administración y Gestión en Salud",
            "Normativa del MSP y Guías Clínicas"
        ]
    },
    {
        id: "internado_rotativo",
        nombre: "Internado Rotativo / Año Rural",
        materias: [
            "Rotación de Medicina Interna",
            "Rotación de Pediatría",
            "Rotación de Ginecología y Obstetricia",
            "Rotación de Cirugía y Emergencias",
            "Salud Comunitaria y Rural (MAIS-FCI)"
        ]
    }
];

// Estado interno del Router SPA
let routerInitialized = false;
let routerState = {
    activeView: SPA_VIEWS.LAUNCHER,
    academicTrack: "caces", // "caces" (4 carreras) | "carrera" (11 carreras)
    selectedCareer: "medicina",
    selectedStage: "semestre_5_6",
    selectedSubject: "Todas las Materias",
    selectedMode: "tutor",
    viewHistory: [SPA_VIEWS.LAUNCHER]
};

/**
 * Verifica si un correo corresponde a un Administrador Maestro autorizado.
 * @param {string} email
 * @returns {boolean}
 */
function checkIsAdmin(email) {
    if (!email) return false;
    if (typeof StateStore.isMasterAdmin === "function") {
        return StateStore.isMasterAdmin(email);
    }
    return FALLBACK_MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Obtiene el correo del usuario autenticado actualmente desde StateStore o window.
 * @returns {string}
 */
function getCurrentUserEmail() {
    return (
        StateStore.appState?.currentUser?.email ||
        StateStore.appState?.currentUserData?.email ||
        window.makaiCurrentUser?.email ||
        window.makaiCurrentUserData?.email ||
        ""
    );
}

/**
 * Muestra la notificación Toast inferior de `dashboard.html` para funciones
 * con sello (Próximamente) o avisos de navegación.
 * @param {string} customMessage - Mensaje opcional para mostrar en el Toast
 */
export function showRouterToast(customMessage = "") {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;

    if (customMessage) {
        const textNode = toastEl.querySelector(".toast-message") || toastEl.querySelector("span:last-child");
        if (textNode) {
            textNode.textContent = customMessage;
        }
    }

    toastEl.classList.remove("translate-y-24", "opacity-0");
    clearTimeout(toastEl._hideTimeout);
    toastEl._hideTimeout = setTimeout(() => {
        toastEl.classList.add("translate-y-24", "opacity-0");
    }, 3000);
}

/**
 * Sincroniza las selecciones del Router SPA con `state.store.js` y emite
 * un evento global para que los demás controladores se actualicen.
 */
function syncRouterWithStore() {
    if (StateStore.appState) {
        StateStore.appState.currentActiveView = routerState.activeView;
        StateStore.appState.currentCareer = routerState.selectedCareer;
        StateStore.appState.currentMode = routerState.selectedMode;
        StateStore.appState.currentAcademicTrack = routerState.academicTrack;
        StateStore.appState.currentAcademicStage = routerState.selectedStage;
        StateStore.appState.currentSubject = routerState.selectedSubject;
    }

    window.dispatchEvent(
        new CustomEvent("makai:curriculumChanged", {
            detail: { ...routerState }
        })
    );
}

/**
 * Cambia de vista dentro de `#views-container` en `dashboard.html` sin recargar la página.
 * Incluye validación de simulacro en curso (`isExamActive`) y protección de `#view-admin`.
 * @param {string} viewId - ID del contenedor `.tab-content` (ej: "view-launcher", "view-admin")
 * @param {Object} options - Opciones adicionales ({ force: boolean, updateHash: boolean })
 * @returns {boolean} Indica si la transición de vista se realizó con éxito
 */
export function switchView(viewId, options = { force: false, updateHash: true }) {
    if (!viewId) return false;

    const currentEmail = getCurrentUserEmail();
    const isAdmin = checkIsAdmin(currentEmail);

    // 1. Guardia de seguridad para la Bóveda de Administración
    if (viewId === SPA_VIEWS.ADMIN && !isAdmin) {
        console.warn("[RouterSPA] Acceso denegado a #view-admin para cuenta no administradora.");
        showRouterToast("Acceso exclusivo para Administradores Maestros.");
        return false;
    }

    // 2. Guardia de protección cuando hay un examen activo en el simulador
    const isExamRunning = !!StateStore.appState?.isExamActive;
    if (
        isExamRunning &&
        viewId !== SPA_VIEWS.SIMULATOR &&
        !options.force
    ) {
        const confirmLeave = confirm(
            "Tienes un simulacro activo en curso. ¿Deseas abandonar el examen actual y perder el progreso no enviado?"
        );
        if (!confirmLeave) {
            return false;
        }
        if (StateStore.appState) {
            StateStore.appState.isExamActive = false;
        }
        window.dispatchEvent(new CustomEvent("makai:examAbortedByNavigation"));
    }

    // 3. Ocultar todas las vistas (.tab-content) y activar únicamente la vista destino
    const allTabs = document.querySelectorAll(".tab-content");
    let targetFound = false;

    allTabs.forEach(tab => {
        if (tab.id === viewId) {
            tab.classList.remove("hidden");
            tab.classList.add("active");
            targetFound = true;
        } else {
            tab.classList.remove("active");
            tab.classList.add("hidden");
        }
    });

    if (!targetFound) {
        console.warn(`[RouterSPA] No se encontró el contenedor #${viewId} en dashboard.html.`);
        return false;
    }

    // 4. Actualizar estado visual de los botones de navegación lateral (.nav-btn)
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        const isTarget = btn.dataset.target === viewId;
        if (isTarget) {
            btn.classList.remove("text-gray-400", "hover:bg-surface-high");
            btn.classList.add("bg-primary", "text-surface-container");
        } else {
            btn.classList.remove("bg-primary", "text-surface-container");
            btn.classList.add("text-gray-400");
            if (!btn.id?.includes("admin")) {
                btn.classList.add("hover:bg-surface-high");
            }
        }
    });

    // 5. Registrar historial interno y sincronizar con state.store.js
    routerState.activeView = viewId;
    if (routerState.viewHistory[routerState.viewHistory.length - 1] !== viewId) {
        routerState.viewHistory.push(viewId);
        if (routerState.viewHistory.length > 20) {
            routerState.viewHistory.shift();
        }
    }

    if (options.updateHash && window.history?.replaceState) {
        const cleanHash = `#${viewId.replace(/^view-/, "")}`;
        window.history.replaceState({ viewId }, "", cleanHash);
    }

    // Llevar el scroll del contenedor principal al inicio suavemente
    const viewsContainer = document.getElementById("views-container");
    if (viewsContainer) {
        viewsContainer.scrollTo({ top: 0, behavior: "smooth" });
    }

    syncRouterWithStore();

    window.dispatchEvent(
        new CustomEvent("makai:viewChanged", {
            detail: { viewId, routerState: { ...routerState } }
        })
    );

    return true;
}

/**
 * Permite regresar a la vista inmediatamente anterior dentro de la sesión SPA.
 */
export function goBackView() {
    if (routerState.viewHistory.length > 1) {
        routerState.viewHistory.pop();
        const previousView = routerState.viewHistory[routerState.viewHistory.length - 1];
        switchView(previousView);
    } else {
        switchView(SPA_VIEWS.LAUNCHER);
    }
}

/**
 * Alterna la modalidad curricular activa en el Lanzador entre:
 * - "caces": 4 carreras oficiales del CACES -> Materias y niveles CACES
 * - "carrera": 11 carreras de salud -> Preuniversitario/Nivelación/Semestres -> Materias universales
 * @param {"caces"|"carrera"} trackType
 */
export function selectAcademicTrack(trackType) {
    routerState.academicTrack = trackType === "carrera" ? "carrera" : "caces";

    // Si regresa a CACES y tenía elegida una de las carreras 5 a 11, ajustar a Medicina por defecto
    const cacesIds = DEFAULT_CACES_CAREERS.map(c => c.id);
    if (routerState.academicTrack === "caces" && !cacesIds.includes(routerState.selectedCareer)) {
        routerState.selectedCareer = "medicina";
    }

    routerState.selectedSubject = "Todas las Materias";
    renderCascadingSelectors();
    syncRouterWithStore();
}

/**
 * Actualiza de forma encadenada la Carrera, Etapa/Semestre y Materia activa.
 * @param {string} careerId
 * @param {string} [stageId]
 * @param {string} [subjectName]
 */
export function selectCareerAndStage(careerId, stageId = null, subjectName = null) {
    if (careerId) {
        routerState.selectedCareer = careerId;
    }
    if (stageId) {
        routerState.selectedStage = stageId;
    }
    if (subjectName !== null) {
        routerState.selectedSubject = subjectName;
    } else {
        routerState.selectedSubject = "Todas las Materias";
    }

    renderCascadingSelectors();
    syncRouterWithStore();
}

/**
 * Asegura que el contenedor `#view-launcher` disponga de la barra superior de
 * conmutación entre **SECCIÓN CACES (4 Carreras)** y **SECCIÓN CARRERA (11 Carreras)**,
 * además del selector encadenado de Etapa/Nivel cuando corresponda.
 */
function ensureCascadingHeaderDOM() {
    const careerSelector = document.getElementById("career-selector");
    if (!careerSelector || document.getElementById("makai-cascading-track-bar")) return;

    const trackBar = document.createElement("div");
    trackBar.id = "makai-cascading-track-bar";
    trackBar.className = "mb-5 space-y-4";
    trackBar.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 bg-surface-container border border-surface-high p-2.5 rounded-2xl">
            <div class="flex flex-wrap items-center gap-2">
                <button type="button" id="btn-track-caces" class="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 bg-primary text-surface-container shadow">
                    <span class="material-symbols-outlined text-base">verified</span>
                    <span>CACES Oficial (4 Carreras)</span>
                </button>
                <button type="button" id="btn-track-carrera" class="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 text-gray-400 hover:text-white hover:bg-surface-high">
                    <span class="material-symbols-outlined text-base">school</span>
                    <span>CARRERA Universitaria (11 Carreras • Semestres)</span>
                </button>
            </div>
            <div id="router-breadcrumb-badge" class="text-[11px] font-mono text-primary bg-surface px-3 py-1.5 rounded-xl border border-primary/30">
                CACES • MEDICINA HUMANA
            </div>
        </div>

        <!-- Desplegable Encadenado de Etapa Formativa / Semestre (Visible en Modo CARRERA o Nodos CACES) -->
        <div id="cascading-stage-container" class="bg-surface-container border border-surface-high rounded-2xl p-4">
            <div class="flex items-center justify-between mb-2.5">
                <span id="cascading-stage-title" class="text-xs font-mono uppercase tracking-wider text-gray-400 font-bold">
                    2. Selecciona el Eje / Nivel de Evaluación
                </span>
                <span id="cascading-stage-helper" class="text-[11px] font-mono text-secondary">
                    Despliegue encadenado activo
                </span>
            </div>
            <div id="cascading-stage-pills" class="flex flex-wrap gap-2"></div>
        </div>
    `;

    careerSelector.parentNode.insertBefore(trackBar, careerSelector);

    document.getElementById("btn-track-caces")?.addEventListener("click", () => {
        selectAcademicTrack("caces");
    });

    document.getElementById("btn-track-carrera")?.addEventListener("click", () => {
        selectAcademicTrack("carrera");
    });
}

/**
 * Renderiza el despliegue encadenado completo:
 * 1) Tarjetas de Carrera (4 en modo CACES / 11 en modo CARRERA)
 * 2) Selector de Etapa/Nivel (Ejes CACES o Preuniversitario/Nivelación/Semestres/Internado)
 * 3) Píldoras interactivas de Materias (#subject-pills)
 */
export function renderCascadingSelectors() {
    const careerSelector = document.getElementById("career-selector");
    const subjectPills = document.getElementById("subject-pills");
    if (!careerSelector || !subjectPills) return;

    ensureCascadingHeaderDOM();

    const isAdmin = checkIsAdmin(getCurrentUserEmail());
    const data = window.makaiData || {};

    // 1. Actualizar botones de modalidad (CACES vs CARRERA)
    const btnCaces = document.getElementById("btn-track-caces");
    const btnCarrera = document.getElementById("btn-track-carrera");

    if (routerState.academicTrack === "caces") {
        btnCaces?.classList.add("bg-primary", "text-surface-container", "shadow");
        btnCaces?.classList.remove("text-gray-400", "hover:bg-surface-high");
        btnCarrera?.classList.remove("bg-primary", "text-surface-container", "shadow");
        btnCarrera?.classList.add("text-gray-400", "hover:bg-surface-high");
    } else {
        btnCarrera?.classList.add("bg-primary", "text-surface-container", "shadow");
        btnCarrera?.classList.remove("text-gray-400", "hover:bg-surface-high");
        btnCaces?.classList.remove("bg-primary", "text-surface-container", "shadow");
        btnCaces?.classList.add("text-gray-400", "hover:bg-surface-high");
    }

    // 2. Determinar lista de carreras según la sección activa
    const cacesCatalog = Array.isArray(data.carreras) && data.carreras.length > 0
        ? data.carreras
        : DEFAULT_CACES_CAREERS;

    const universityCatalog = Array.isArray(data.carrerasUniversitarias) && data.carrerasUniversitarias.length > 0
        ? data.carrerasUniversitarias
        : DEFAULT_UNIVERSITY_CAREERS;

    const activeCareerList = routerState.academicTrack === "caces"
        ? cacesCatalog
        : universityCatalog;

    // 3. Renderizar tarjetas de carreras (#career-selector)
    careerSelector.innerHTML = "";
    activeCareerList.forEach(career => {
        const isLocked = !career.activa && !isAdmin;
        const isSelected = career.id === routerState.selectedCareer;

        const card = document.createElement("div");
        card.dataset.careerCard = career.id;
        card.className = `p-4 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
            isSelected
                ? "bg-surface-high border-primary text-white shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                : "bg-surface border-surface-high text-gray-400 hover:border-gray-500"
        } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`;

        let innerHTML = `<span class="font-bold text-sm">${career.nombre}</span>`;
        if (isLocked) {
            innerHTML += `<svg class="w-5 h-5 flex-shrink-0"><use href="#nirvana-icon"></use></svg>`;
        } else if (isSelected) {
            innerHTML += `<span class="material-symbols-outlined text-primary text-base">check_circle</span>`;
        }

        card.innerHTML = innerHTML;

        card.addEventListener("click", () => {
            if (isLocked) {
                showRouterToast(`La carrera ${career.nombre} se habilitará próximamente.`);
                return;
            }
            selectCareerAndStage(career.id, null, "Todas las Materias");
        });

        careerSelector.appendChild(card);
    });

    // 4. Renderizar Etapas / Semestres o Ejes CACES (#cascading-stage-pills)
    const stagePillsContainer = document.getElementById("cascading-stage-pills");
    const stageTitleEl = document.getElementById("cascading-stage-title");
    let subjectsToRender = [];

    if (routerState.academicTrack === "carrera") {
        if (stageTitleEl) {
            stageTitleEl.textContent = "2. Nivel / Etapa Universitaria (Preuniversitario → Nivelación → Semestres)";
        }

        const currentStageObj = ACADEMIC_STAGES.find(s => s.id === routerState.selectedStage) || ACADEMIC_STAGES[0];
        routerState.selectedStage = currentStageObj.id;
        subjectsToRender = currentStageObj.materias;

        if (stagePillsContainer) {
            stagePillsContainer.innerHTML = "";
            ACADEMIC_STAGES.forEach(stage => {
                const active = stage.id === routerState.selectedStage;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                    active
                        ? "bg-primary text-surface-container border-primary font-extrabold"
                        : "bg-surface text-gray-300 border-gray-700 hover:border-primary/60"
                }`;
                btn.textContent = stage.nombre;
                btn.addEventListener("click", () => {
                    selectCareerAndStage(routerState.selectedCareer, stage.id, "Todas las Materias");
                });
                stagePillsContainer.appendChild(btn);
            });
        }
    } else {
        if (stageTitleEl) {
            stageTitleEl.textContent = "2. Ejes Oficiales de Evaluación CACES";
        }

        const cacesCareerObj = cacesCatalog.find(c => c.id === routerState.selectedCareer) || cacesCatalog[0];
        const defaultCacesRef = DEFAULT_CACES_CAREERS.find(c => c.id === routerState.selectedCareer) || DEFAULT_CACES_CAREERS[0];
        const cacesLevels = cacesCareerObj?.nivelesCaces || defaultCacesRef.nivelesCaces;
        subjectsToRender = cacesCareerObj?.materias || defaultCacesRef.materias;

        if (!cacesLevels.includes(routerState.selectedStage)) {
            routerState.selectedStage = cacesLevels[0];
        }

        if (stagePillsContainer) {
            stagePillsContainer.innerHTML = "";
            cacesLevels.forEach(levelName => {
                const active = levelName === routerState.selectedStage;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                    active
                        ? "bg-secondary text-surface-container border-secondary font-extrabold"
                        : "bg-surface text-gray-300 border-gray-700 hover:border-secondary/60"
                }`;
                btn.textContent = levelName;
                btn.addEventListener("click", () => {
                    selectCareerAndStage(routerState.selectedCareer, levelName, routerState.selectedSubject);
                });
                stagePillsContainer.appendChild(btn);
            });
        }
    }

    // 5. Renderizar Píldoras Interactivas de Materias (#subject-pills)
    subjectPills.innerHTML = "";
    const allSubjectsList = ["Todas las Materias", ...subjectsToRender];

    allSubjectsList.forEach(subj => {
        const isSubjActive = routerState.selectedSubject === subj;
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = `px-3 py-1.5 rounded-full text-xs font-mono transition-all border ${
            isSubjActive
                ? "bg-primary/20 border-primary text-primary font-bold shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                : "bg-surface-high border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
        }`;
        pill.textContent = subj;
        pill.addEventListener("click", () => {
            selectCareerAndStage(routerState.selectedCareer, routerState.selectedStage, subj);
        });
        subjectPills.appendChild(pill);
    });

    // 6. Actualizar indicador de migas de pan (Breadcrumb)
    const breadcrumbBadge = document.getElementById("router-breadcrumb-badge");
    if (breadcrumbBadge) {
        const activeCareerObj = activeCareerList.find(c => c.id === routerState.selectedCareer);
        const careerLabel = (activeCareerObj?.nombre || routerState.selectedCareer).replace(/^\d+\.\s*/, "");
        breadcrumbBadge.textContent = `${routerState.academicTrack.toUpperCase()} • ${careerLabel.toUpperCase()} • ${routerState.selectedSubject.toUpperCase()}`;
    }
}

/**
 * Inicializa el enrutador de pestañas laterales (`.nav-btn`), accesos directos a
 * Aulas Virtuales, Mis Métricas, Bóveda Admin y escucha cambios en el hash de la URL.
 * @param {Object} user - Usuario activo de Firebase Auth
 * @param {Object} userData - Perfil sincronizado desde Cloud Firestore
 */
export function initRouterSPA(user = null, userData = null) {
    if (userData?.carrera) {
        routerState.selectedCareer = userData.carrera;
    }

    // 1. Enlazar todos los botones de navegación lateral (.nav-btn)
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.dataset.boundSpaRouter) return;
        btn.dataset.boundSpaRouter = "1";

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const targetView = btn.dataset.target;
            if (!targetView) return;
            switchView(targetView);
        });
    });

    // 2. Enlazar botón rápido de Bóveda Admin en la barra superior (#header-admin-btn)
    const headerAdminBtn = document.getElementById("header-admin-btn");
    if (headerAdminBtn && !headerAdminBtn.dataset.boundSpaRouter) {
        headerAdminBtn.dataset.boundSpaRouter = "1";
        headerAdminBtn.addEventListener("click", (e) => {
            e.preventDefault();
            switchView(SPA_VIEWS.ADMIN);
        });
    }

    // 3. Enlazar botones con clase .upcoming-feature al Toast informativo
    const upcomingBtns = document.querySelectorAll(".upcoming-feature");
    upcomingBtns.forEach(btn => {
        if (btn.dataset.boundSpaToast) return;
        btn.dataset.boundSpaToast = "1";
        btn.addEventListener("click", () => {
            showRouterToast();
        });
    });

    // 4. Inicializar el despliegue encadenado CARRERA (11) / CACES (4)
    renderCascadingSelectors();

    // 5. Sobrescribir switchView en MakaiOrchestrator para centralizar toda la navegación
    if (window.MakaiOrchestrator) {
        window.MakaiOrchestrator.switchView = switchView;
    }

    // 6. Leer hash inicial de la URL si el usuario recargó en una pestaña específica
    if (!routerInitialized) {
        routerInitialized = true;

        const initialHash = window.location.hash.replace("#", "").trim();
        if (initialHash) {
            const candidateViewId = initialHash.startsWith("view-") ? initialHash : `view-${initialHash}`;
            const existsInDom = !!document.getElementById(candidateViewId);
            if (existsInDom && candidateViewId !== SPA_VIEWS.SIMULATOR) {
                switchView(candidateViewId, { force: true, updateHash: false });
            }
        }

        window.addEventListener("popstate", (event) => {
            const targetFromState = event.state?.viewId;
            if (targetFromState && document.getElementById(targetFromState)) {
                switchView(targetFromState, { force: false, updateHash: false });
            }
        });
    }

    syncRouterWithStore();
    console.info("[MakaiRouterSPA] Navegación SPA y despliegue curricular encadenado activos.");
}

// Alias de compatibilidad invocado por app.orchestrator.js
export const initRouter = initRouterSPA;
export const initCascadingCurriculumRouter = renderCascadingSelectors;

// Exposición global para que cualquier subcomponente pueda invocar al Router
window.MakaiRouter = {
    SPA_VIEWS,
    initRouterSPA,
    switchView,
    goBackView,
    selectAcademicTrack,
    selectCareerAndStage,
    renderCascadingSelectors,
    showRouterToast,
    getRouterState: () => ({ ...routerState })
};
