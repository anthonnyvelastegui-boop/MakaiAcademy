// ============================================================================
// ARCHIVO: js/2-core/router.spa.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Subcomponente de Navegación SPA, Conmutador de Vistas
//                  (switchView), Control de Historial (Botón Atrás sin salir
//                  de dashboard.html) y Despliegue Curricular Encadenado.
// ============================================================================

import * as StateStore from "./state.store.js";

// --- CORREOS MAESTROS DE ADMINISTRACIÓN (ACCESO TOTAL DESBLOQUEADO) ---
const FALLBACK_MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

// --- REGISTRO OFICIAL DE VISTAS DEL LIENZO SPA (dashboard.html) ---
export const SPA_VIEWS = {
    LAUNCHER: "view-launcher",
    CARRERA: "view-carrera",
    CACES: "view-caces",
    RURAL: "view-rural",
    SIMULATORS_HUB: "view-simulators",
    SIMULATOR: "view-simulator",
    SPACED_1D: "view-spaced",
    SIM_2D: "view-sim2d",
    SIM_3D: "view-sim3d",
    CLASSROOMS: "view-classrooms",
    METRICS: "view-metrics",
    ADMIN: "view-admin"
};

// --- CATÁLOGO OFICIAL: 4 CARRERAS CONVOCADAS AL EXAMEN CACES ---
const DEFAULT_CACES_CAREERS = [
    {
        id: "medicina",
        nombre: "Medicina Humana (FCS-EC)",
        codigo: "CACES-MED",
        icono: "medical_services",
        descripcion: "Habilitación profesional para Médicos Generales • Matriz oficial de casos clínicos integrales.",
        activa: true,
        materias: [
            "Medicina Interna",
            "Pediatría",
            "Ginecología y Obstetricia",
            "Cirugía General",
            "Salud Pública y Bioética",
            "Salud Mental y Urgencias Críticas"
        ],
        nivelesCaces: [
            { id: "basico", nombre: "Nivel 1 • Básico (Conceptos y GPC)" },
            { id: "intermedio", nombre: "Nivel 2 • Intermedio (Casos Clínicos)" },
            { id: "avanzado", nombre: "Nivel 3 • Avanzado (Diagnóstico Diferencial)" },
            { id: "elite", nombre: "Nivel 4 • Élite CACES (Simulacro Complejo)" }
        ]
    },
    {
        id: "enfermeria",
        nombre: "Enfermería & Cuidados Críticos",
        codigo: "CACES-ENF",
        icono: "Monitor_Heart",
        descripcion: "Proceso de Atención de Enfermería (PAE), NANDA/NIC/NOC, farmacología y cuidados intensivos.",
        activa: true,
        materias: [
            "Enfermería Clínico-Quirúrgica",
            "Enfermería Materno-Infantil y Pediátrica",
            "Enfermería Comunitaria y Epidemiología",
            "Fundamentos y Proceso de Enfermería (PAE)",
            "Administración y Bioética en Enfermería",
            "Urgencias y Cuidados Críticos"
        ],
        nivelesCaces: [
            { id: "basico", nombre: "Nivel 1 • Básico (Fundamentos y PAE)" },
            { id: "intermedio", nombre: "Nivel 2 • Intermedio (Cuidado Clínico)" },
            { id: "avanzado", nombre: "Nivel 3 • Avanzado (Críticos y Materno)" },
            { id: "elite", nombre: "Nivel 4 • Élite CACES (Simulacro Complejo)" }
        ]
    },
    {
        id: "odontologia",
        nombre: "Odontología Clínica",
        codigo: "CACES-ODO",
        icono: "dentistry",
        descripcion: "Diagnóstico oral, cirugía maxilofacial, endodoncia, periodoncia, rehabilitación y bioseguridad.",
        activa: false,
        materias: [
            "Patología Bucal y Diagnóstico",
            "Endodoncia y Operatoria Dental",
            "Periodoncia y Cirugía Maxilofacial",
            "Rehabilitación Oral y Prótesis",
            "Odontopediatría y Ortodoncia",
            "Farmacología y Salud Pública Odontológica"
        ],
        nivelesCaces: [
            { id: "basico", nombre: "Nivel 1 • Básico (Diagnóstico y Bioseguridad)" },
            { id: "intermedio", nombre: "Nivel 2 • Intermedio (Clínica y Endodoncia)" },
            { id: "avanzado", nombre: "Nivel 3 • Avanzado (Cirugía y Rehabilitación)" },
            { id: "elite", nombre: "Nivel 4 • Élite CACES (Simulacro Complejo)" }
        ]
    },
    {
        id: "obstetricia",
        nombre: "Obstetricia & Salud Materna",
        codigo: "CACES-OBS",
        icono: "pregnant_woman",
        descripcion: "Control prenatal, Claves Obstétricas MSP (Roja, Azul, Amarilla), Score MAMÁ y perinatología.",
        activa: false,
        materias: [
            "Obstetricia Fisiológica y Alto Riesgo",
            "Claves Obstétricas y Emergencias (MSP)",
            "Ginecología y Salud Sexual Reproductiva",
            "Neonatología y Perinatología",
            "Farmacología Obstétrica",
            "Salud Pública Materna y Normativa"
        ],
        nivelesCaces: [
            { id: "basico", nombre: "Nivel 1 • Básico (Prenatal y Normativa MSP)" },
            { id: "intermedio", nombre: "Nivel 2 • Intermedio (Parto y Puerperio)" },
            { id: "avanzado", nombre: "Nivel 3 • Avanzado (Claves Obstétricas)" },
            { id: "elite", nombre: "Nivel 4 • Élite CACES (Simulacro Complejo)" }
        ]
    }
];

// --- CATÁLOGO OFICIAL: 11 CARRERAS UNIVERSITARIAS DE CIENCIAS DE LA SALUD ---
const DEFAULT_UNIVERSITY_CAREERS = [
    {
        id: "medicina",
        numero: "01",
        nombre: "Medicina Humana",
        icono: "stethoscope",
        duracion: "12 Semestres + Internado Rotativo",
        activa: true,
        materiasEspeciales: ["Clínica Médica", "Cirugía General", "Pediatría", "Ginecología y Obstetricia", "Emergencias y UCI"]
    },
    {
        id: "enfermeria",
        numero: "02",
        nombre: "Enfermería",
        icono: "medical_information",
        duracion: "9 Semestres + Internado Rotativo",
        activa: true,
        materiasEspeciales: ["Proceso de Atención de Enfermería (PAE)", "Enfermería Quirúrgica", "Cuidados Críticos", "Enfermería Materno-Infantil"]
    },
    {
        id: "odontologia",
        numero: "03",
        nombre: "Odontología",
        icono: "dentistry",
        duracion: "10 Semestres Clínicos",
        activa: true,
        materiasEspeciales: ["Anatomía Dental", "Operatoria y Endodoncia", "Periodoncia", "Cirugía Oral y Maxilofacial", "Rehabilitación Oral"]
    },
    {
        id: "obstetricia",
        numero: "04",
        nombre: "Obstetricia y Puericultura",
        icono: "pregnant_woman",
        duracion: "9 Semestres + Internado",
        activa: true,
        materiasEspeciales: ["Obstetricia Clínica", "Claves Obstétricas MSP", "Monitoreo Fetal", "Salud Sexual y Reproductiva", "Neonatología"]
    },
    {
        id: "nutricion",
        numero: "05",
        nombre: "Nutrición y Dietética",
        icono: "nutrition",
        duracion: "8 Semestres + Prácticas Hospitalarias",
        activa: true,
        materiasEspeciales: ["Dietoterapia del Adulto y Pediátrica", "Evaluación Nutricional ABCD", "Soporte Nutricional Enteral y Parenteral", "Bromatología"]
    },
    {
        id: "fisioterapia",
        numero: "06",
        nombre: "Fisioterapia y Rehabilitación",
        icono: "physical_therapy",
        duracion: "8 Semestres Clínicos",
        activa: true,
        materiasEspeciales: ["Biomecánica y Kinesiología", "Rehabilitación Musculoesquelética", "Fisioterapia Neurológica", "Fisioterapia Cardiorrespiratoria"]
    },
    {
        id: "laboratorio",
        numero: "07",
        nombre: "Laboratorio Clínico",
        icono: "biotech",
        duracion: "8 Semestres de Diagnóstico",
        activa: true,
        materiasEspeciales: ["Hematología y Coagulación", "Bioquímica Clínica", "Microbiología y Parasitología Diagnóstica", "Inmunología y Biología Molecular"]
    },
    {
        id: "imagenologia",
        numero: "08",
        nombre: "Imagenología y Radiología",
        icono: "radiology",
        duracion: "8 Semestres Tecnológicos",
        activa: true,
        materiasEspeciales: ["Anatomía Radiológica", "Tomografía Computarizada (TC)", "Resonancia Magnética (RMN)", "Ecografía y Doppler", "Protección Radiológica"]
    },
    {
        id: "farmacia",
        numero: "09",
        nombre: "Bioquímica y Farmacia",
        icono: "science",
        duracion: "10 Semestres Científicos",
        activa: true,
        materiasEspeciales: ["Química Farmacéutica", "Farmacología y Farmacoterapia", "Toxicología Analítica y Clínica", "Farmacia Hospitalaria"]
    },
    {
        id: "psicologia_clinica",
        numero: "10",
        nombre: "Psicología Clínica",
        icono: "psychology",
        duracion: "8 Semestres + Práctica Clínica",
        activa: true,
        materiasEspeciales: ["Psicopatología DSM-5 / CIE-11", "Neuropsicología Clínica", "Psicodiagnóstico y Evaluación", "Intervención en Crisis y Psicoterapia"]
    },
    {
        id: "paramedicina",
        numero: "11",
        nombre: "Atención Prehospitalaria y Emergencias",
        icono: "ambulance",
        duracion: "8 Semestres Tácticos (APH)",
        activa: true,
        materiasEspeciales: ["Soporte Vital Básico y Avanzado (BLS/ACLS)", "Trauma Prehospitalario (PHTLS)", "Triaje START y Desastres", "Farmacología de Emergencias"]
    }
];

// --- ETAPAS FORMATIVAS Y SEMESTRES ACADÉMICOS (PASO 2 DE CARRERA) ---
const ACADEMIC_STAGES = [
    {
        id: "preuniversitario",
        etiqueta: "Etapa Inicial",
        nombre: "Preuniversitario",
        descripcion: "Admisión a Ciencias de la Salud: Biología, Química, Anatomía preliminar y Razonamiento.",
        materias: [
            "Biología Celular y Molecular",
            "Química General e Inorgánica",
            "Química Orgánica Aplicada",
            "Anatomía y Fisiología Elemental",
            "Terminología Médica y Razonamiento"
        ]
    },
    {
        id: "nivelacion",
        etiqueta: "Semestre 0",
        nombre: "Nivelación Académica",
        descripcion: "Bases morfológicas y bioquímicas para el primer año universitario.",
        materias: [
            "Morfofisiología Básica I",
            "Bioquímica Médica Elemental",
            "Biofísica Aplicada a la Salud",
            "Salud, Sociedad y Bioética",
            "Metodología de la Investigación Científica"
        ]
    },
    {
        id: "semestre_1",
        etiqueta: "Nivel 1",
        nombre: "1° Semestre (Ciencias Básicas I)",
        descripcion: "Estructura macroscópica y microscópica del cuerpo humano.",
        materias: [
            "Anatomía Humana Descriptiva I",
            "Histología General",
            "Embriología Humana y Genética Básica",
            "Biología Molecular Clínica",
            "Bioestadística Descriptiva"
        ]
    },
    {
        id: "semestre_2",
        etiqueta: "Nivel 2",
        nombre: "2° Semestre (Morfofunción)",
        descripcion: "Fisiología de sistemas y metabolismo humano normal.",
        materias: [
            "Anatomía Humana Neurovascular II",
            "Fisiología Humana General y Neurofisiología",
            "Bioquímica Clínica y Metabolismo",
            "Histología de Sistemas",
            "Salud Pública y Atención Primaria (MAIS-FCI)"
        ]
    },
    {
        id: "semestre_3",
        etiqueta: "Nivel 3",
        nombre: "3° Semestre (Agentes y Mecanismos)",
        descripcion: "Microbiología, parasitología, inmunología y bases patológicas.",
        materias: [
            "Microbiología Médica (Bacteriología y Virología)",
            "Parasitología y Micología Clínica",
            "Fisiopatología General I",
            "Inmunología Clínica",
            "Anatomía Patológica General"
        ]
    },
    {
        id: "semestre_4",
        etiqueta: "Nivel 4",
        nombre: "4° Semestre (Preclínicas y Semiología)",
        descripcion: "Propedéutica clínica, examen físico, signos vitales y farmacología básica.",
        materias: [
            "Semiología y Propedéutica Clínica I",
            "Fisiopatología de Sistemas II",
            "Farmacología Básica y Mecanismos de Acción",
            "Laboratorio Clínico e Interpretación Diagnóstica",
            "Epidemiología Clínica"
        ]
    },
    {
        id: "semestre_5",
        etiqueta: "Nivel 5",
        nombre: "5° Semestre (Clínicas I)",
        descripcion: "Síndromes clínicos cardiovasculares, respiratorios, renales y digestivos.",
        materias: [
            "Semiología Avanzada y Razonamiento Clínico",
            "Medicina Interna I (Cardio, Neumo, Nefro, Gastro)",
            "Farmacología Clínica y Terapéutica",
            "Imagenología Diagnóstica Básica",
            "Psicología Médica y Comunicación Clínica"
        ]
    },
    {
        id: "semestre_6",
        etiqueta: "Nivel 6",
        nombre: "6° Semestre (Clínicas II)",
        descripcion: "Endocrinología, infectología, hematología, neurología y reumatología.",
        materias: [
            "Medicina Interna II (Endocrino, Infecto, Neuro, Hemato)",
            "Terapéutica Basada en Evidencia y GPC",
            "Nutrición Clínica y Dietoterapia",
            "Salud Mental y Psiquiatría Clínica",
            "Dermatología e Infectología Tropical"
        ]
    },
    {
        id: "semestre_7",
        etiqueta: "Nivel 7",
        nombre: "7° Semestre (Quirúrgicas y Trauma)",
        descripcion: "Patología quirúrgica, técnica aséptica, anestesiología y manejo del trauma.",
        materias: [
            "Cirugía General y Abdomen Agudo",
            "Traumatología y Ortopedia",
            "Anestesiología y Reanimación",
            "Especialidades Quirúrgicas (ORL, Oftalmología, Urología)",
            "Soporte Vital en Trauma"
        ]
    },
    {
        id: "semestre_8",
        etiqueta: "Nivel 8",
        nombre: "8° Semestre (Materno-Infantil)",
        descripcion: "Ginecología, control prenatal, claves obstétricas, pediatría y neonatología.",
        materias: [
            "Ginecología y Salud Reproductiva",
            "Obstetricia y Claves Obstétricas MSP",
            "Pediatría Clínica y Crecimiento",
            "Neonatología y Reanimación Neonatal",
            "AIEPI Clínico y Esquema de Vacunación MSP"
        ]
    },
    {
        id: "semestre_9_10",
        etiqueta: "Niveles 9 - 10",
        nombre: "9° y 10° Semestre (Urgencias y Críticos)",
        descripcion: "Medicina de urgencias, cuidados intensivos, geriatría, medicina legal y gestión.",
        materias: [
            "Urgencias Médicas y Cuidados Críticos (UCI)",
            "Toxicología Clínica y Envenenamientos",
            "Geriatría y Cuidados Paliativos",
            "Medicina Legal, Deontología y Bioética",
            "Administración y Gerencia Hospitalaria"
        ]
    },
    {
        id: "internado_rotativo",
        etiqueta: "Etapa Final",
        nombre: "Internado Rotativo & Preparación CACES",
        descripcion: "Integración hospitalaria por rotaciones clínicas y simulacros comprehensivos.",
        materias: [
            "Rotación de Medicina Interna",
            "Rotación de Pediatría y Neonatología",
            "Rotación de Ginecología y Obstetricia",
            "Rotación de Cirugía y Emergencias",
            "Rotación de Salud Comunitaria y Rural (MSP)"
        ]
    }
];

// --- MODOS DE EVALUACIÓN Y SIMULACRO ---
const EXAM_MODES = [
    {
        id: "tutor",
        titulo: "Práctica Rápida (Modo Tutor)",
        subtitulo: "20 Reactivos • 30 Minutos",
        icono: "bolt",
        badge: "RECOMENDADO DIARIO",
        color: "primary",
        descripcion: "Revela la respuesta correcta y el Racional Clínico GPC al instante tras responder cada caso."
    },
    {
        id: "estandar",
        titulo: "Simulacro Oficial Estándar",
        subtitulo: "100 Reactivos • 150 Minutos",
        icono: "assignment_turned_in",
        badge: "CONDICIONES REALES CACES",
        color: "secondary",
        descripcion: "Cronómetro estricto sin retroalimentación hasta finalizar. Calificación mínima aprobatoria: 70/100."
    },
    {
        id: "critico",
        titulo: "Refuerzo de Puntos Críticos",
        subtitulo: "30 Reactivos • 45 Minutos",
        icono: "emergency",
        badge: "ALTA DIFICULTAD",
        color: "warning",
        descripcion: "Prioriza casos clínicos de alta complejidad, diagnósticos diferenciales y áreas vulnerables."
    }
];

// Estado reactivo interno del Router SPA
let routerInitialized = false;
let isHandlingPopState = false;
let lastDetectedDomStep = 1;

let routerState = {
    activeView: SPA_VIEWS.CARRERA,
    academicTrack: "carrera", // "carrera" (11 áreas) | "caces" (4 oficiales)
    carreraStep: 1,           // Paso visual activo en la vista CARRERA (1, 2 o 3)
    selectedCareer: "medicina",
    selectedStage: "preuniversitario",
    selectedSubject: "Todas las Materias",
    selectedCacesCareer: "medicina",
    selectedCacesLevel: "intermedio",
    selectedCacesSubject: "Todas las Materias",
    selectedMode: "tutor",
    viewHistory: []
};

// ============================================================================
// CONTROLADOR DEL HISTORIAL DEL NAVEGADOR (EVITA SALIR A INDEX.HTML)
// ============================================================================

/**
 * Detecta en qué paso (1, 2 o 3) se encuentra actualmente la interfaz de CARRERA
 * leyendo los botones de retroceso o el encabezado "PASO X DE 3" en el DOM.
 */
function detectCurrentDomStep() {
    const container = findCarreraViewContainer();
    if (!container || container.classList.contains("hidden")) {
        return routerState.carreraStep || 1;
    }

    // Buscar botones visibles de retroceso en el DOM de dashboard.html
    const buttons = container.querySelectorAll("button, a");
    for (const btn of buttons) {
        if (btn.offsetParent === null) continue; // Ignorar elementos ocultos
        const txt = (btn.textContent || "").trim();
        if (txt.includes("Cambiar Nivel")) return 3;
    }
    for (const btn of buttons) {
        if (btn.offsetParent === null) continue;
        const txt = (btn.textContent || "").trim();
        if (txt.includes("Cambiar de Carrera")) return 2;
    }

    // Respaldo: leer el badge "PASO X DE 3"
    const textContent = container.textContent || "";
    if (textContent.includes("PASO 3 DE 3")) return 3;
    if (textContent.includes("PASO 2 DE 3")) return 2;
    if (textContent.includes("PASO 1 DE 3")) return 1;

    return routerState.carreraStep || 1;
}

/**
 * Busca y hace clic automáticamente en el botón interno de retroceso de Carrera
 * ("← Cambiar Nivel" cuando está en Paso 3, o "← Cambiar de Carrera" en Paso 2).
 */
function triggerInternalStepBack(targetStep) {
    const container = findCarreraViewContainer();
    if (!container) return false;

    const buttons = Array.from(container.querySelectorAll("button, a")).filter(
        el => el.offsetParent !== null
    );

    if (targetStep === 2) {
        const backToLevelBtn = buttons.find(el =>
            (el.textContent || "").includes("Cambiar Nivel")
        );
        if (backToLevelBtn) {
            backToLevelBtn.click();
            return true;
        }
    }

    if (targetStep === 1) {
        const backToCareerBtn = buttons.find(el =>
            (el.textContent || "").includes("Cambiar de Carrera")
        );
        if (backToCareerBtn) {
            backToCareerBtn.click();
            return true;
        }
    }

    return false;
}

/**
 * Registra un nuevo estado en el historial del navegador (pushState)
 * para que la flecha "Atrás" retroceda un paso a la vez sin salir de dashboard.html.
 */
export function pushSpaHistoryState(customData = {}) {
    if (isHandlingPopState || !window.history?.pushState) return;

    const currentState = window.history.state || {};
    const nextState = {
        makaiSpa: true,
        makaiRootGuard: false,
        viewId: customData.viewId || routerState.activeView || SPA_VIEWS.CARRERA,
        carreraStep: customData.carreraStep || routerState.carreraStep || 1,
        career: customData.career || routerState.selectedCareer,
        stage: customData.stage || routerState.selectedStage
    };

    // Evitar empujar dos estados idénticos seguidos
    if (
        currentState.viewId === nextState.viewId &&
        currentState.carreraStep === nextState.carreraStep &&
        currentState.career === nextState.career &&
        currentState.stage === nextState.stage &&
        !currentState.makaiRootGuard
    ) {
        return;
    }

    const cleanViewName = nextState.viewId.replace(/^view-/, "");
    const stepSuffix =
        cleanViewName === "launcher" || cleanViewName === "carrera"
            ? `-paso-${nextState.carreraStep}`
            : "";
    const hash = `#${cleanViewName}${stepSuffix}`;

    window.history.pushState(nextState, "", hash);
}

/**
 * Instala el escudo inicial en el historial del navegador apenas carga dashboard.html
 * y observa cambios de Paso (1 -> 2 -> 3) para apilarlos automáticamente.
 */
function initBrowserHistoryGuard() {
    if (!window.history?.pushState) return;

    const initialStep = detectCurrentDomStep();
    routerState.carreraStep = initialStep;
    lastDetectedDomStep = initialStep;

    // 1. Entrada raíz (colchón de seguridad para no regresar a index.html)
    window.history.replaceState(
        {
            makaiSpa: true,
            makaiRootGuard: true,
            viewId: routerState.activeView,
            carreraStep: 1,
            career: routerState.selectedCareer,
            stage: routerState.selectedStage
        },
        "",
        "#launcher"
    );

    // 2. Entrada activa sobre el colchón
    window.history.pushState(
        {
            makaiSpa: true,
            makaiRootGuard: false,
            viewId: routerState.activeView,
            carreraStep: initialStep,
            career: routerState.selectedCareer,
            stage: routerState.selectedStage
        },
        "",
        `#launcher-paso-${initialStep}`
    );

    // 3. Observar el contenedor principal para detectar cuando el usuario avanza
    //    del Paso 1 al Paso 2, o del Paso 2 al Paso 3 en dashboard.html
    const carreraContainer = findCarreraViewContainer();
    if (carreraContainer && typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver(() => {
            if (isHandlingPopState) return;

            const currentDomStep = detectCurrentDomStep();
            if (currentDomStep !== lastDetectedDomStep) {
                const previousStep = lastDetectedDomStep;
                lastDetectedDomStep = currentDomStep;
                routerState.carreraStep = currentDomStep;

                // Si avanzó de paso (ej. 1 -> 2 o 2 -> 3), guardar en el historial del navegador
                if (currentDomStep > previousStep) {
                    pushSpaHistoryState({
                        viewId: routerState.activeView,
                        carreraStep: currentDomStep
                    });
                }
            }
        });

        observer.observe(carreraContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // 4. Interceptar el botón "Atrás" del navegador (evento popstate)
    window.addEventListener("popstate", (event) => {
        isHandlingPopState = true;

        try {
            const currentDomStep = detectCurrentDomStep();

            // CASO A: El usuario está en el Paso 3 (Asignaturas) -> regresar al Paso 2 (Niveles)
            if (currentDomStep === 3) {
                routerState.carreraStep = 2;
                lastDetectedDomStep = 2;
                const clickedNative = triggerInternalStepBack(2);
                if (!clickedNative) {
                    renderCarreraUniversityView();
                }
                // Re-asegurar estado en historial para permitir otro clic en Atrás hacia el Paso 1
                window.history.pushState(
                    {
                        makaiSpa: true,
                        makaiRootGuard: false,
                        viewId: routerState.activeView,
                        carreraStep: 2,
                        career: routerState.selectedCareer,
                        stage: routerState.selectedStage
                    },
                    "",
                    "#launcher-paso-2"
                );
                return;
            }

            // CASO B: El usuario está en el Paso 2 (Niveles) -> regresar al Paso 1 (11 Carreras)
            if (currentDomStep === 2) {
                routerState.carreraStep = 1;
                lastDetectedDomStep = 1;
                const clickedNative = triggerInternalStepBack(1);
                if (!clickedNative) {
                    renderCarreraUniversityView();
                }
                // Re-armar el escudo para que el siguiente clic en Atrás tampoco salga a index.html
                window.history.pushState(
                    {
                        makaiSpa: true,
                        makaiRootGuard: false,
                        viewId: routerState.activeView,
                        carreraStep: 1,
                        career: routerState.selectedCareer,
                        stage: routerState.selectedStage
                    },
                    "",
                    "#launcher-paso-1"
                );
                return;
            }

            // CASO C: El usuario estaba en otra pestaña lateral (CACES, Rural, Mentoría, Admin...)
            const targetView = event.state?.viewId;
            if (targetView && targetView !== routerState.activeView && document.getElementById(targetView)) {
                switchView(targetView, { force: false, updateHash: false });
            } else if (routerState.viewHistory.length > 1) {
                routerState.viewHistory.pop();
                const prevView = routerState.viewHistory[routerState.viewHistory.length - 1];
                if (prevView && prevView !== routerState.activeView) {
                    switchView(prevView, { force: false, updateHash: false });
                }
            }

            // CASO D: El usuario ya está en el tope (Paso 1) -> bloquear salida a index.html
            if (!event.state || event.state.makaiRootGuard) {
                window.history.pushState(
                    {
                        makaiSpa: true,
                        makaiRootGuard: false,
                        viewId: routerState.activeView,
                        carreraStep: 1,
                        career: routerState.selectedCareer,
                        stage: routerState.selectedStage
                    },
                    "",
                    "#launcher-paso-1"
                );
            }
        } finally {
            setTimeout(() => {
                isHandlingPopState = false;
            }, 60);
        }
    });
}

/**
 * Verifica si un correo corresponde a un Administrador Maestro autorizado.
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
 * Despliega la notificación emergente (#toast) o crea una si no existe en el DOM.
 */
export function showRouterToast(customMessage = "Módulo en calibración final • Disponible próximamente") {
    let toastEl = document.getElementById("toast");
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "toast";
        toastEl.className = "fixed bottom-6 right-6 z-50 bg-surface-container border border-primary text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 translate-y-24 opacity-0";
        toastEl.innerHTML = `
            <span class="material-symbols-outlined text-primary">info</span>
            <span class="toast-message text-xs font-mono font-bold">${customMessage}</span>
        `;
        document.body.appendChild(toastEl);
    } else if (customMessage) {
        const textNode = toastEl.querySelector(".toast-message") || toastEl.querySelector("span:last-child");
        if (textNode) textNode.textContent = customMessage;
    }

    toastEl.classList.remove("translate-y-24", "opacity-0");
    clearTimeout(toastEl._hideTimeout);
    toastEl._hideTimeout = setTimeout(() => {
        toastEl.classList.add("translate-y-24", "opacity-0");
    }, 3200);
}

/**
 * Sincroniza las selecciones del Router SPA con `state.store.js` y emite
 * el evento `makai:curriculumChanged` para los motores de examen, 1D y aulas.
 */
function syncRouterWithStore() {
    const isCaces = routerState.academicTrack === "caces";
    const activeCareer = isCaces ? routerState.selectedCacesCareer : routerState.selectedCareer;
    const activeStage = isCaces ? routerState.selectedCacesLevel : routerState.selectedStage;
    const activeSubject = isCaces ? routerState.selectedCacesSubject : routerState.selectedSubject;

    if (StateStore.appState) {
        StateStore.appState.currentActiveView = routerState.activeView;
        StateStore.appState.currentAcademicTrack = routerState.academicTrack;
        StateStore.appState.currentCareer = activeCareer;
        StateStore.appState.currentStage = activeStage;
        StateStore.appState.currentAcademicStage = activeStage;
        StateStore.appState.currentSubject = activeSubject;
        StateStore.appState.currentMode = routerState.selectedMode;
    }

    if (typeof StateStore.setCurriculumSelection === "function") {
        StateStore.setCurriculumSelection({
            track: routerState.academicTrack,
            career: activeCareer,
            stage: activeStage,
            subject: activeSubject === "Todas las Materias" ? "todas" : activeSubject,
            mode: routerState.selectedMode
        });
    } else {
        window.dispatchEvent(
            new CustomEvent("makai:curriculumChanged", {
                detail: {
                    track: routerState.academicTrack,
                    career: activeCareer,
                    stage: activeStage,
                    subject: activeSubject === "Todas las Materias" ? "todas" : activeSubject,
                    mode: routerState.selectedMode,
                    ...routerState
                }
            })
        );
    }
}

// ============================================================================
// DETECCIÓN INTELIGENTE DE CONTENEDORES EN DASHBOARD.HTML
// ============================================================================

/**
 * Localiza el contenedor `.tab-content` correspondiente a "CARRERA (11 ÁREAS)"
 * buscando por ID o por el título "Carreras de Ciencias de la Salud".
 */
function findCarreraViewContainer() {
    const directIds = ["view-carrera", "view-careers", "view-launcher", "tab-carrera"];
    for (const id of directIds) {
        const el = document.getElementById(id);
        if (el && (el.textContent.includes("Carreras de Ciencias de la Salud") || el.textContent.includes("MÓDULO UNIVERSITARIO") || id === "view-carrera" || id === "view-launcher")) {
            return el;
        }
    }

    const allTabs = document.querySelectorAll(".tab-content, #views-container > div, main > section, main > div");
    for (const tab of allTabs) {
        const txt = tab.textContent || "";
        if (txt.includes("Carreras de Ciencias de la Salud") || txt.includes("MÓDULO UNIVERSITARIO")) {
            return tab;
        }
    }

    return document.getElementById("view-launcher") || document.querySelector(".tab-content");
}

/**
 * Localiza el contenedor `.tab-content` correspondiente a "CACES (OFICIAL)"
 * buscando por ID o por el título "Examen Oficial CACES".
 */
function findCacesViewContainer() {
    const directIds = ["view-caces", "view-caces-oficial", "tab-caces"];
    for (const id of directIds) {
        const el = document.getElementById(id);
        if (el) return el;
    }

    const allTabs = document.querySelectorAll(".tab-content, #views-container > div, main > section, main > div");
    for (const tab of allTabs) {
        const txt = tab.textContent || "";
        if (txt.includes("Examen Oficial CACES") || txt.includes("HABILITACIÓN PROFESIONAL CACES")) {
            return tab;
        }
    }

    return null;
}

/**
 * Lanza el simulador de examen configurando previamente los parámetros elegidos,
 * o navega hacia `#view-simulator` invocando `startExam` si está disponible.
 */
function triggerStartSimulation(trackType = "carrera") {
    routerState.academicTrack = trackType;
    syncRouterWithStore();

    if (typeof window.MakaiExamController?.startExam === "function") {
        window.MakaiExamController.startExam({
            track: routerState.academicTrack,
            career: trackType === "caces" ? routerState.selectedCacesCareer : routerState.selectedCareer,
            stage: trackType === "caces" ? routerState.selectedCacesLevel : routerState.selectedStage,
            subject: trackType === "caces" ? routerState.selectedCacesSubject : routerState.selectedSubject,
            mode: routerState.selectedMode
        });
        return;
    }

    const legacyStartBtn = document.getElementById("btn-start-exam");
    if (legacyStartBtn && !legacyStartBtn.dataset.routerInternalTrigger) {
        legacyStartBtn.click();
        return;
    }

    const switched = switchView(SPA_VIEWS.SIMULATOR);
    window.dispatchEvent(
        new CustomEvent("makai:startExamRequested", {
            detail: {
                track: routerState.academicTrack,
                career: trackType === "caces" ? routerState.selectedCacesCareer : routerState.selectedCareer,
                stage: trackType === "caces" ? routerState.selectedCacesLevel : routerState.selectedStage,
                subject: trackType === "caces" ? routerState.selectedCacesSubject : routerState.selectedSubject,
                mode: routerState.selectedMode
            }
        })
    );

    if (!switched) {
        showRouterToast("Preparando motor de evaluación clínica...");
    }
}

// ============================================================================
// CONSTRUCCIÓN Y RENDERIZADO DE LA VISTA: CARRERA (11 ÁREAS • 3 PASOS)
// ============================================================================

/**
 * Construye e inyecta el sistema interactivo de 3 pasos dentro de la vista
 * "Carreras de Ciencias de la Salud" (#view-carrera / #view-launcher).
 */
export function renderCarreraUniversityView() {
    const container = findCarreraViewContainer();
    if (!container) return;

    // Actualizar el badge superior nativo ("MÓDULO UNIVERSITARIO • PASO X DE 3") si existe en el encabezado
    const headerBadges = container.querySelectorAll("span, div, p");
    headerBadges.forEach(node => {
        if (node.children.length === 0 && node.textContent && node.textContent.includes("PASO") && node.textContent.includes("DE 3")) {
            node.textContent = `MÓDULO UNIVERSITARIO • PASO ${routerState.carreraStep} DE 3`;
        }
    });

    // Si dashboard.html ya cuenta con sus propias tarjetas nativas de Carrera/Nivel,
    // sincronizar sin duplicar una segunda rejilla debajo.
    const hasNativeStepCards = Array.from(container.querySelectorAll("div, span, button")).some(
        el => !el.closest("#makai-carrera-dynamic-root") &&
              ((el.textContent || "").includes("ÁREA 01") ||
               (el.textContent || "").includes("Cambiar de Carrera") ||
               (el.textContent || "").includes("Cambiar Nivel"))
    );
    if (hasNativeStepCards) {
        return;
    }

    // Crear o recuperar el lienzo dinámico debajo de la cabecera
    let dynamicRoot = document.getElementById("makai-carrera-dynamic-root");
    if (!dynamicRoot) {
        dynamicRoot = document.createElement("div");
        dynamicRoot.id = "makai-carrera-dynamic-root";
        dynamicRoot.className = "mt-6 space-y-6 pb-12";
        container.appendChild(dynamicRoot);
    }

    const isAdmin = checkIsAdmin(getCurrentUserEmail());
    const activeCareerObj = DEFAULT_UNIVERSITY_CAREERS.find(c => c.id === routerState.selectedCareer) || DEFAULT_UNIVERSITY_CAREERS[0];
    const activeStageObj = ACADEMIC_STAGES.find(s => s.id === routerState.selectedStage) || ACADEMIC_STAGES[0];

    const combinedSubjects = [
        ...activeStageObj.materias,
        ...(activeCareerObj.materiasEspeciales || [])
    ].filter((v, i, a) => a.indexOf(v) === i);

    dynamicRoot.innerHTML = `
        <!-- BARRA PROGRESIVA INTERACTIVA DE LOS 3 PASOS -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div class="flex flex-wrap items-center gap-2 md:gap-3">
                <button type="button" data-goto-step="1" class="carrera-step-pill flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-extrabold transition-all border ${
                    routerState.carreraStep === 1
                        ? "bg-primary text-surface border-primary shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                        : "bg-surface text-primary border-primary/40 hover:border-primary"
                }">
                    <span class="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[11px]">1</span>
                    <span>Carrera: ${activeCareerObj.nombre}</span>
                </button>

                <span class="text-gray-600 font-mono">→</span>

                <button type="button" data-goto-step="2" class="carrera-step-pill flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-extrabold transition-all border ${
                    routerState.carreraStep === 2
                        ? "bg-primary text-surface border-primary shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                        : "bg-surface text-gray-300 border-surface-high hover:border-primary/50"
                }">
                    <span class="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[11px]">2</span>
                    <span>Etapa: ${activeStageObj.nombre}</span>
                </button>

                <span class="text-gray-600 font-mono">→</span>

                <button type="button" data-goto-step="3" class="carrera-step-pill flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-extrabold transition-all border ${
                    routerState.carreraStep === 3
                        ? "bg-primary text-surface border-primary shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                        : "bg-surface text-gray-300 border-surface-high hover:border-primary/50"
                }">
                    <span class="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[11px]">3</span>
                    <span>Materia: ${routerState.selectedSubject}</span>
                </button>
            </div>

            <div class="flex items-center gap-2">
                ${
                    routerState.carreraStep > 1
                        ? `<button type="button" id="btn-carrera-step-back" class="px-3.5 py-1.5 rounded-xl bg-surface border border-primary/50 text-primary hover:bg-primary/15 text-xs font-mono font-bold transition-all">
                            ← ${routerState.carreraStep === 3 ? `Cambiar Nivel (${activeStageObj.nombre})` : "Cambiar de Carrera (11 Áreas)"}
                           </button>`
                        : `<span class="px-3 py-1 rounded-lg bg-secondary/15 border border-secondary/40 text-secondary text-[11px] font-mono font-bold">
                            11 Carreras Activas
                           </span>`
                }
            </div>
        </div>

        <!-- PASO 1: SELECCIÓN DE LAS 11 CARRERAS DE CIENCIAS DE LA SALUD -->
        <div class="${routerState.carreraStep === 1 ? "block" : "hidden"} bg-surface-container border border-surface-high rounded-2xl p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        PASO 1 DE 3 • CATÁLOGO UNIVERSITARIO
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        1. Selecciona tu Carrera de Ciencias de la Salud (11 Áreas)
                    </h3>
                </div>
                <span class="text-xs font-mono text-gray-400">
                    Haz clic en una carrera para desplegar sus semestres y materias
                </span>
            </div>

            <div id="carrera-grid-11" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                ${DEFAULT_UNIVERSITY_CAREERS.map(career => {
                    const isSelected = career.id === routerState.selectedCareer;
                    const isLocked = !career.activa && !isAdmin;
                    return `
                        <div data-univ-career="${career.id}" class="univ-career-card group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                                ? "bg-surface-high border-primary text-white shadow-[0_0_20px_rgba(0,229,255,0.15)]"
                                : "bg-surface border-surface-high text-gray-300 hover:border-primary/60 hover:bg-surface-high/60"
                        } ${isLocked ? "opacity-60" : ""}">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-extrabold ${
                                        isSelected ? "bg-primary text-surface" : "bg-surface-container text-primary border border-primary/30"
                                    }">
                                        ${career.numero}
                                    </div>
                                    <div>
                                        <h4 class="font-extrabold text-sm ${isSelected ? "text-white" : "text-gray-100 group-hover:text-white"}">
                                            ${career.nombre}
                                        </h4>
                                        <span class="text-[10px] font-mono text-gray-400 block">
                                            ${career.duracion}
                                        </span>
                                    </div>
                                </div>
                                ${
                                    isSelected
                                        ? `<span class="material-symbols-outlined text-primary text-lg">check_circle</span>`
                                        : `<span class="material-symbols-outlined text-gray-600 group-hover:text-primary text-base">arrow_forward_ios</span>`
                                }
                            </div>
                            <div class="mt-3 pt-2.5 border-t border-surface-high/80 flex items-center justify-between text-[10px] font-mono">
                                <span class="${isSelected ? "text-primary font-bold" : "text-gray-400"}">
                                    Preuniv • Nivelación • 1°-10° Sem
                                </span>
                                <span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-bold">
                                    HABILITADA
                                </span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>

        <!-- PASO 2: ETAPA FORMATIVA (PREUNIVERSITARIO, NIVELACIÓN, SEMESTRES) -->
        <div id="carrera-step2-box" class="${routerState.carreraStep === 2 ? "block" : "hidden"} bg-surface-container border border-primary/50 shadow-[0_0_25px_rgba(0,229,255,0.08)] rounded-2xl p-5 space-y-4 transition-all">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold">
                        PASO 2 DE 3 • MALLA CURRICULAR DE ${activeCareerObj.nombre.toUpperCase()}
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        2. Selecciona tu Etapa Formativa o Semestre Académico
                    </h3>
                </div>
                <span class="text-xs font-mono text-primary">
                    Etapa activa: ${activeStageObj.nombre}
                </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                ${ACADEMIC_STAGES.map(stage => {
                    const isStageSelected = stage.id === routerState.selectedStage;
                    return `
                        <button type="button" data-univ-stage="${stage.id}" class="univ-stage-btn text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                            isStageSelected
                                ? "bg-primary/15 border-primary text-white shadow-[0_0_15px_rgba(0,229,255,0.18)]"
                                : "bg-surface border-surface-high text-gray-300 hover:border-primary/50 hover:text-white"
                        }">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-1">
                                    <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                                        isStageSelected ? "bg-primary text-surface" : "bg-surface-high text-primary"
                                    }">
                                        ${stage.etiqueta}
                                    </span>
                                    ${isStageSelected ? `<span class="text-xs font-mono text-primary font-extrabold">✓ ACTIVO</span>` : ""}
                                </div>
                                <div class="font-extrabold text-xs mt-1.5">${stage.nombre}</div>
                                <p class="text-[11px] text-gray-400 mt-1 line-clamp-2">${stage.descripcion}</p>
                            </div>
                            <div class="mt-2.5 pt-2 border-t border-surface-high/60 text-[10px] font-mono text-secondary">
                                ${stage.materias.length} asignaturas disponibles →
                            </div>
                        </button>
                    `;
                }).join("")}
            </div>
        </div>

        <!-- PASO 3: MATERIAS DEL SEMESTRE Y LANZADOR DE EVALUACIÓN / 1D -->
        <div id="carrera-step3-box" class="${routerState.carreraStep === 3 ? "block" : "hidden"} bg-surface-container border border-primary shadow-[0_0_25px_rgba(0,229,255,0.12)] rounded-2xl p-5 space-y-6 transition-all">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        PASO 3 DE 3 • ASIGNATURAS Y MODALIDAD DE ESTUDIO
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        3. Elige la Materia de ${activeStageObj.nombre} (${activeCareerObj.nombre})
                    </h3>
                </div>
                <span class="text-xs font-mono text-secondary">
                    Materia seleccionada: ${routerState.selectedSubject}
                </span>
            </div>

            <!-- PÍLDORAS DE MATERIAS -->
            <div class="flex flex-wrap gap-2.5">
                ${["Todas las Materias", ...combinedSubjects].map(subj => {
                    const isSubjSelected = routerState.selectedSubject === subj;
                    return `
                        <button type="button" data-univ-subject="${subj}" class="univ-subject-pill px-4 py-2 rounded-xl text-xs font-mono transition-all border ${
                            isSubjSelected
                                ? "bg-primary text-surface border-primary font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.3)]"
                                : "bg-surface border-surface-high text-gray-300 hover:border-primary/60 hover:text-white"
                        }">
                            ${isSubjSelected ? "● " : ""}${subj}
                        </button>
                    `;
                }).join("")}
            </div>

            <!-- TARJETAS DE MODO DE EVALUACIÓN -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                ${EXAM_MODES.map(m => {
                    const isModeSelected = routerState.selectedMode === m.id;
                    return `
                        <div data-exam-mode="${m.id}" class="univ-mode-card p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isModeSelected
                                ? "bg-surface-high border-primary shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                                : "bg-surface border-surface-high hover:border-gray-500"
                        }">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <span class="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-primary/15 text-primary">
                                        ${m.badge}
                                    </span>
                                    <span class="material-symbols-outlined ${isModeSelected ? "text-primary" : "text-gray-500"}">
                                        ${isModeSelected ? "radio_button_checked" : "radio_button_unchecked"}
                                    </span>
                                </div>
                                <h4 class="text-sm font-extrabold text-white">${m.titulo}</h4>
                                <p class="text-xs font-mono text-secondary mt-0.5">${m.subtitulo}</p>
                                <p class="text-xs text-gray-400 mt-2 leading-relaxed">${m.descripcion}</p>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <!-- BOTONES DE ACCIÓN INMEDIATA -->
            <div class="pt-4 border-t border-surface-high flex flex-wrap items-center justify-between gap-4">
                <div class="text-xs font-mono text-gray-300">
                    Ruta lista: <strong class="text-primary">${activeCareerObj.nombre}</strong> •
                    <strong class="text-secondary">${activeStageObj.nombre}</strong> •
                    <strong class="text-white">${routerState.selectedSubject}</strong>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button type="button" id="btn-carrera-go-1d" class="px-4 py-3 rounded-xl bg-surface border border-primary/60 text-primary hover:bg-primary/15 text-xs font-extrabold font-mono transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-base">psychology</span>
                        <span>Estudiar en Sináptico 1D & PDFs</span>
                    </button>

                    <button type="button" id="btn-carrera-start-exam" class="px-6 py-3 rounded-xl bg-primary text-surface hover:bg-opacity-90 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                        <span class="material-symbols-outlined text-base">play_arrow</span>
                        <span>Iniciar Evaluación de Carrera</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Enlazar eventos de las tarjetas de las 11 carreras (Paso 1 -> Paso 2)
    dynamicRoot.querySelectorAll(".univ-career-card").forEach(card => {
        card.addEventListener("click", () => {
            const careerId = card.dataset.univCareer;
            routerState.academicTrack = "carrera";
            routerState.selectedCareer = careerId;
            routerState.selectedSubject = "Todas las Materias";
            routerState.carreraStep = 2;
            lastDetectedDomStep = 2;
            pushSpaHistoryState({ viewId: routerState.activeView, carreraStep: 2, career: careerId });
            renderCarreraUniversityView();
            syncRouterWithStore();
        });
    });

    // Enlazar eventos de Etapas / Semestres (Paso 2 -> Paso 3)
    dynamicRoot.querySelectorAll(".univ-stage-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const stageId = btn.dataset.univStage;
            routerState.academicTrack = "carrera";
            routerState.selectedStage = stageId;
            routerState.selectedSubject = "Todas las Materias";
            routerState.carreraStep = 3;
            lastDetectedDomStep = 3;
            pushSpaHistoryState({ viewId: routerState.activeView, carreraStep: 3, stage: stageId });
            renderCarreraUniversityView();
            syncRouterWithStore();
        });
    });

    // Enlazar eventos de Píldoras de Materias (Paso 3)
    dynamicRoot.querySelectorAll(".univ-subject-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            routerState.academicTrack = "carrera";
            routerState.selectedSubject = pill.dataset.univSubject || "Todas las Materias";
            routerState.carreraStep = 3;
            renderCarreraUniversityView();
            syncRouterWithStore();
        });
    });

    // Enlazar selección de Modo de Examen
    dynamicRoot.querySelectorAll(".univ-mode-card").forEach(modeCard => {
        modeCard.addEventListener("click", () => {
            routerState.selectedMode = modeCard.dataset.examMode || "tutor";
            renderCarreraUniversityView();
            syncRouterWithStore();
        });
    });

    // Enlazar píldoras superiores de navegación de pasos (1, 2, 3)
    dynamicRoot.querySelectorAll(".carrera-step-pill").forEach(stepBtn => {
        stepBtn.addEventListener("click", () => {
            const nextStep = Number(stepBtn.dataset.gotoStep) || 1;
            routerState.carreraStep = nextStep;
            lastDetectedDomStep = nextStep;
            pushSpaHistoryState({ viewId: routerState.activeView, carreraStep: nextStep });
            renderCarreraUniversityView();
        });
    });

    // Botón interno de retroceso ("← Cambiar Nivel" o "← Cambiar de Carrera")
    document.getElementById("btn-carrera-step-back")?.addEventListener("click", () => {
        routerState.carreraStep = Math.max(1, routerState.carreraStep - 1);
        lastDetectedDomStep = routerState.carreraStep;
        renderCarreraUniversityView();
        syncRouterWithStore();
    });

    // Botón para ir a Sináptico 1D / Guías PDF con el filtro actual
    document.getElementById("btn-carrera-go-1d")?.addEventListener("click", () => {
        routerState.academicTrack = "carrera";
        syncRouterWithStore();
        switchView(SPA_VIEWS.SPACED_1D);
    });

    // Botón para iniciar el simulacro de Carrera
    document.getElementById("btn-carrera-start-exam")?.addEventListener("click", () => {
        triggerStartSimulation("carrera");
    });
}

// ============================================================================
// CONSTRUCCIÓN Y RENDERIZADO DE LA VISTA: CACES OFICIAL (4 CARRERAS)
// ============================================================================

/**
 * Construye e inyecta el selector oficial de las 4 carreras CACES, sus niveles
 * de dificultad, sus 6 materias oficiales y los 3 modos de simulacro dentro
 * de la vista "Examen Oficial CACES" (#view-caces).
 */
export function renderCacesOfficialView() {
    const container = findCacesViewContainer();
    if (!container) return;

    let dynamicRoot = document.getElementById("makai-caces-dynamic-root");
    if (!dynamicRoot) {
        dynamicRoot = document.createElement("div");
        dynamicRoot.id = "makai-caces-dynamic-root";
        dynamicRoot.className = "mt-6 space-y-6 pb-12";
        container.appendChild(dynamicRoot);
    }

    const isAdmin = checkIsAdmin(getCurrentUserEmail());
    const dataCareers = Array.isArray(window.makaiData?.carreras) && window.makaiData.carreras.length > 0
        ? DEFAULT_CACES_CAREERS.map(def => {
            const found = window.makaiData.carreras.find(c => c.id === def.id);
            return found ? { ...def, materias: found.materias || def.materias, activa: found.activa ?? def.activa } : def;
        })
        : DEFAULT_CACES_CAREERS;

    const activeCacesCareer = dataCareers.find(c => c.id === routerState.selectedCacesCareer) || dataCareers[0];
    const activeLevels = activeCacesCareer.nivelesCaces || DEFAULT_CACES_CAREERS[0].nivelesCaces;

    dynamicRoot.innerHTML = `
        <!-- PASO 1 CACES: LAS 4 CARRERAS CONVOCADAS AL EXAMEN OFICIAL -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        CONVOCATORIA NACIONAL • HABILITACIÓN PROFESIONAL
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        1. Selecciona tu Carrera Oficial CACES (4 Carreras Habilitadas)
                    </h3>
                </div>
                <span class="text-xs font-mono text-secondary">
                    ${isAdmin ? "Modo Admin Maestro: 4/4 Desbloqueadas" : "Selecciona tu carrera para desplegar componentes"}
                </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                ${dataCareers.map(career => {
                    const isSelected = career.id === routerState.selectedCacesCareer;
                    const isLocked = !career.activa && !isAdmin;
                    return `
                        <div data-caces-career="${career.id}" class="caces-career-card p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                                ? "bg-surface-high border-primary text-white shadow-[0_0_20px_rgba(0,229,255,0.18)]"
                                : "bg-surface border-surface-high text-gray-300 hover:border-primary/60"
                        } ${isLocked ? "opacity-60" : ""}">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <span class="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                        isSelected ? "bg-primary text-surface" : "bg-surface-container text-primary border border-primary/30"
                                    }">
                                        ${career.codigo}
                                    </span>
                                    ${
                                        isLocked
                                            ? `<span class="text-[10px] font-mono text-warning font-bold">⏳ Próximamente</span>`
                                            : isSelected
                                                ? `<span class="material-symbols-outlined text-primary text-lg">verified</span>`
                                                : `<span class="text-[10px] font-mono text-secondary font-bold">● Activa</span>`
                                    }
                                </div>
                                <h4 class="font-extrabold text-sm text-white mt-1">${career.nombre}</h4>
                                <p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${career.descripcion}</p>
                            </div>
                            <div class="mt-4 pt-2.5 border-t border-surface-high flex items-center justify-between text-[10px] font-mono">
                                <span class="text-gray-400">${career.materias.length} Componentes Oficiales</span>
                                <span class="text-primary font-bold">100 Reactivos</span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>

        <!-- PASO 2 CACES: NIVEL DE DIFICULTAD Y COMPONENTES/MATERIAS OFICIALES -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-5 space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold">
                        ESTRUCTURA DE EVALUACIÓN • ${activeCacesCareer.nombre.toUpperCase()}
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        2. Selecciona el Nivel de Complejidad y Componente Curricular CACES
                    </h3>
                </div>
                <span class="text-xs font-mono text-primary">
                    Filtro activo: ${routerState.selectedCacesSubject}
                </span>
            </div>

            <!-- 4 NIVELES DE COMPLEJIDAD CACES -->
            <div>
                <label class="block text-[11px] font-mono text-gray-400 uppercase mb-2 font-bold">
                    Nivel de Complejidad del Banco de Reactivos:
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${activeLevels.map(lvl => {
                        const isLvlActive = routerState.selectedCacesLevel === lvl.id;
                        return `
                            <button type="button" data-caces-level="${lvl.id}" class="caces-level-btn px-3.5 py-2.5 rounded-xl text-xs font-mono text-left transition-all border ${
                                isLvlActive
                                    ? "bg-secondary/20 border-secondary text-white font-extrabold shadow-[0_0_12px_rgba(148,222,45,0.2)]"
                                    : "bg-surface border-surface-high text-gray-300 hover:border-secondary/60"
                            }">
                                ${isLvlActive ? "✓ " : ""}${lvl.nombre}
                            </button>
                        `;
                    }).join("")}
                </div>
            </div>

            <!-- PÍLDORAS DE LAS 6 MATERIAS OFICIALES CACES -->
            <div>
                <label class="block text-[11px] font-mono text-gray-400 uppercase mb-2 font-bold">
                    Componentes y Subcomponentes Oficiales (${activeCacesCareer.nombre}):
                </label>
                <div class="flex flex-wrap gap-2.5">
                    ${["Todas las Materias", ...activeCacesCareer.materias].map(subj => {
                        const isSubjActive = routerState.selectedCacesSubject === subj;
                        return `
                            <button type="button" data-caces-subject="${subj}" class="caces-subject-pill px-4 py-2 rounded-xl text-xs font-mono transition-all border ${
                                isSubjActive
                                    ? "bg-primary text-surface border-primary font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                                    : "bg-surface border-surface-high text-gray-300 hover:border-primary/60 hover:text-white"
                            }">
                                ${isSubjActive ? "● " : ""}${subj}
                            </button>
                        `;
                    }).join("")}
                </div>
            </div>
        </div>

        <!-- PASO 3 CACES: SELECCIÓN DEL MODO DE SIMULACRO Y ARRANQUE -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-5 space-y-5 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-high pb-3">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        CONFIGURACIÓN DE SIMULACRO CACES
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        3. Modalidad del Simulacro de Habilitación Profesional
                    </h3>
                </div>
                <span class="text-xs font-mono text-secondary">
                    Puntaje mínimo referencial CACES: 70 / 100
                </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${EXAM_MODES.map(m => {
                    const isModeSelected = routerState.selectedMode === m.id;
                    return `
                        <div data-caces-mode="${m.id}" class="caces-mode-card p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isModeSelected
                                ? "bg-surface-high border-primary shadow-[0_0_15px_rgba(0,229,255,0.18)]"
                                : "bg-surface border-surface-high hover:border-gray-500"
                        }">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <span class="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-primary/15 text-primary">
                                        ${m.badge}
                                    </span>
                                    <span class="material-symbols-outlined ${isModeSelected ? "text-primary" : "text-gray-500"}">
                                        ${isModeSelected ? "radio_button_checked" : "radio_button_unchecked"}
                                    </span>
                                </div>
                                <h4 class="text-sm font-extrabold text-white">${m.titulo}</h4>
                                <p class="text-xs font-mono text-secondary mt-0.5">${m.subtitulo}</p>
                                <p class="text-xs text-gray-400 mt-2 leading-relaxed">${m.descripcion}</p>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <div class="pt-4 border-t border-surface-high flex flex-wrap items-center justify-between gap-4">
                <div class="text-xs font-mono text-gray-300">
                    Configuración CACES: <strong class="text-primary">${activeCacesCareer.nombre}</strong> •
                    <strong class="text-secondary">${routerState.selectedCacesSubject}</strong>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button type="button" id="btn-caces-go-sinaptico" class="px-4 py-3 rounded-xl bg-surface border border-secondary/60 text-secondary hover:bg-secondary/15 text-xs font-extrabold font-mono transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-base">style</span>
                        <span>Repasar Mazo CACES en Sináptico v4.4</span>
                    </button>

                    <button type="button" id="btn-caces-start-exam" class="px-6 py-3 rounded-xl bg-primary text-surface hover:bg-opacity-90 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                        <span class="material-symbols-outlined text-base">bolt</span>
                        <span>Iniciar Nuevo Simulacro CACES</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Eventos de selección de Carrera CACES (4 oficiales)
    dynamicRoot.querySelectorAll(".caces-career-card").forEach(card => {
        card.addEventListener("click", () => {
            const careerId = card.dataset.cacesCareer;
            const targetObj = dataCareers.find(c => c.id === careerId);
            const isLocked = targetObj && !targetObj.activa && !isAdmin;

            if (isLocked) {
                showRouterToast(`El banco oficial CACES de ${targetObj.nombre} estará disponible próximamente.`);
                return;
            }

            routerState.academicTrack = "caces";
            routerState.selectedCacesCareer = careerId;
            routerState.selectedCacesSubject = "Todas las Materias";
            renderCacesOfficialView();
            syncRouterWithStore();
        });
    });

    // Eventos de Nivel de Dificultad CACES
    dynamicRoot.querySelectorAll(".caces-level-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            routerState.academicTrack = "caces";
            routerState.selectedCacesLevel = btn.dataset.cacesLevel || "intermedio";
            renderCacesOfficialView();
            syncRouterWithStore();
        });
    });

    // Eventos de Píldoras de Materias CACES
    dynamicRoot.querySelectorAll(".caces-subject-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            routerState.academicTrack = "caces";
            routerState.selectedCacesSubject = pill.dataset.cacesSubject || "Todas las Materias";
            renderCacesOfficialView();
            syncRouterWithStore();
        });
    });

    // Eventos de Modo de Simulacro CACES
    dynamicRoot.querySelectorAll(".caces-mode-card").forEach(card => {
        card.addEventListener("click", () => {
            routerState.selectedMode = card.dataset.cacesMode || "tutor";
            renderCacesOfficialView();
            syncRouterWithStore();
        });
    });

    // Botón para ir a Sináptico v4.4 desde CACES
    document.getElementById("btn-caces-go-sinaptico")?.addEventListener("click", () => {
        routerState.academicTrack = "caces";
        syncRouterWithStore();
        switchView(SPA_VIEWS.SPACED_1D);
    });

    // Botón para iniciar el Simulacro CACES
    document.getElementById("btn-caces-start-exam")?.addEventListener("click", () => {
        triggerStartSimulation("caces");
    });
}

/**
 * Renderiza simultáneamente ambos selectores curriculares (CARRERA y CACES)
 * y mantiene retrocompatibilidad si existen `#career-selector` y `#subject-pills`.
 */
export function renderCascadingSelectors() {
    renderCarreraUniversityView();
    renderCacesOfficialView();
}

// ============================================================================
// CONMUTADOR CENTRAL DE VISTAS SPA (switchView)
// ============================================================================

/**
 * Cambia de vista dentro de `dashboard.html` sin recargar la página.
 * Soporta tanto IDs directos como búsqueda inteligente si el botón lateral
 * apunta a alias como `view-carrera`, `view-launcher` o `view-caces`.
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
    if (isExamRunning && viewId !== SPA_VIEWS.SIMULATOR && !options.force) {
        const confirmLeave = confirm(
            "Tienes un simulacro activo en curso. ¿Deseas abandonar el examen actual y perder el progreso no enviado?"
        );
        if (!confirmLeave) return false;

        if (StateStore.appState) {
            StateStore.appState.isExamActive = false;
        }
        window.dispatchEvent(new CustomEvent("makai:examAbortedByNavigation"));
    }

    // 3. Resolver el elemento DOM destino incluso si en dashboard.html usa un ID alternativo
    let targetEl = document.getElementById(viewId);
    if (!targetEl) {
        if (viewId === "view-carrera" || viewId === "view-launcher") {
            targetEl = findCarreraViewContainer();
        } else if (viewId === "view-caces") {
            targetEl = findCacesViewContainer();
        }
    }

    if (!targetEl) {
        console.warn(`[RouterSPA] No se encontró el contenedor #${viewId} en dashboard.html.`);
        return false;
    }

    const resolvedId = targetEl.id || viewId;

    // 4. Ocultar todas las vistas (.tab-content) y activar únicamente la vista destino
    const allTabs = document.querySelectorAll(".tab-content");
    allTabs.forEach(tab => {
        if (tab === targetEl || tab.id === resolvedId) {
            tab.classList.remove("hidden");
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
            tab.classList.add("hidden");
        }
    });

    // 5. Actualizar estado visual de los botones de navegación lateral (.nav-btn)
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        const isTarget = btn.dataset.target === viewId || btn.dataset.target === resolvedId;
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

    // 6. Actualizar el track activo según la pestaña abierta y re-asegurar su renderizado
    if (resolvedId.includes("caces") || targetEl === findCacesViewContainer()) {
        routerState.academicTrack = "caces";
        renderCacesOfficialView();
    } else if (resolvedId.includes("carrera") || resolvedId.includes("launcher") || targetEl === findCarreraViewContainer()) {
        routerState.academicTrack = "carrera";
        renderCarreraUniversityView();
    }

    // 7. Registrar historial interno y agregar entrada con pushState (no replaceState)
    routerState.activeView = resolvedId;
    if (routerState.viewHistory[routerState.viewHistory.length - 1] !== resolvedId) {
        routerState.viewHistory.push(resolvedId);
        if (routerState.viewHistory.length > 20) {
            routerState.viewHistory.shift();
        }
    }

    if (options.updateHash && !isHandlingPopState) {
        pushSpaHistoryState({
            viewId: resolvedId,
            carreraStep: routerState.carreraStep
        });
    }

    const viewsContainer = document.getElementById("views-container");
    if (viewsContainer) {
        viewsContainer.scrollTo({ top: 0, behavior: "smooth" });
    }

    syncRouterWithStore();

    window.dispatchEvent(
        new CustomEvent("makai:viewChanged", {
            detail: { viewId: resolvedId, routerState: { ...routerState } }
        })
    );

    return true;
}

/**
 * Permite regresar a la vista o paso inmediatamente anterior dentro de la sesión SPA.
 */
export function goBackView() {
    const currentStep = detectCurrentDomStep();
    if (currentStep > 1) {
        const nextStep = currentStep - 1;
        routerState.carreraStep = nextStep;
        lastDetectedDomStep = nextStep;
        if (!triggerInternalStepBack(nextStep)) {
            renderCarreraUniversityView();
        }
        return;
    }

    if (routerState.viewHistory.length > 1) {
        routerState.viewHistory.pop();
        const previousView = routerState.viewHistory[routerState.viewHistory.length - 1];
        switchView(previousView);
    } else {
        switchView(SPA_VIEWS.CARRERA);
    }
}

/**
 * Alterna la modalidad curricular activa ("caces" o "carrera").
 */
export function selectAcademicTrack(trackType) {
    routerState.academicTrack = trackType === "caces" ? "caces" : "carrera";
    renderCascadingSelectors();
    syncRouterWithStore();
}

/**
 * Selecciona programáticamente carrera, etapa/semestre y materia.
 */
export function selectCareerAndStage(careerId, stageId = null, subjectName = null) {
    if (routerState.academicTrack === "caces") {
        if (careerId) routerState.selectedCacesCareer = careerId;
        if (stageId) routerState.selectedCacesLevel = stageId;
        routerState.selectedCacesSubject = subjectName !== null ? subjectName : "Todas las Materias";
        renderCacesOfficialView();
    } else {
        if (careerId) routerState.selectedCareer = careerId;
        if (stageId) routerState.selectedStage = stageId;
        routerState.selectedSubject = subjectName !== null ? subjectName : "Todas las Materias";
        renderCarreraUniversityView();
    }
    syncRouterWithStore();
}

/**
 * Enlaza automáticamente los botones de acceso rápido ("Aulas Virtuales",
 * "Mis Métricas", "Sináptico v4.4") presentes en las cabeceras de CARRERA y CACES.
 */
function bindHeaderQuickButtons() {
    const allButtons = document.querySelectorAll("button, a");
    allButtons.forEach(btn => {
        if (btn.dataset.boundQuickShortcut || btn.classList.contains("nav-btn")) return;

        const text = (btn.textContent || "").trim().toLowerCase();
        const targetAttr = btn.dataset.target || btn.dataset.viewTarget;

        if (targetAttr) {
            btn.dataset.boundQuickShortcut = "1";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                switchView(targetAttr);
            });
            return;
        }

        if (text.includes("aulas virtuales")) {
            btn.dataset.boundQuickShortcut = "1";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                switchView(SPA_VIEWS.CLASSROOMS);
            });
        } else if (text.includes("mis métricas") || text.includes("mis metricas")) {
            btn.dataset.boundQuickShortcut = "1";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                switchView(SPA_VIEWS.METRICS);
            });
        } else if (text.includes("sináptico v4.4") || text.includes("sinaptico v4.4")) {
            btn.dataset.boundQuickShortcut = "1";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                switchView(SPA_VIEWS.SPACED_1D);
            });
        }
    });
}

/**
 * Inicializa el Router SPA, enlaza el menú lateral, inyecta los selectores
 * encadenados en las vistas de CARRERA y CACES, y activa el escudo del botón Atrás.
 */
export function initRouterSPA(user = null, userData = null) {
    if (userData?.carrera) {
        routerState.selectedCareer = userData.carrera;
        if (DEFAULT_CACES_CAREERS.some(c => c.id === userData.carrera)) {
            routerState.selectedCacesCareer = userData.carrera;
        }
    }

    // 1. Inyectar y renderizar las vistas interactivas de CARRERA (11) y CACES (4)
    renderCascadingSelectors();

    // 2. Enlazar todos los botones de navegación lateral (.nav-btn)
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.dataset.boundSpaRouter) return;
        btn.dataset.boundSpaRouter = "1";

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const targetView = btn.dataset.target;
            if (targetView) {
                switchView(targetView);
                return;
            }

            const label = (btn.textContent || "").toLowerCase();
            if (label.includes("carrera")) switchView(SPA_VIEWS.CARRERA);
            else if (label.includes("caces")) switchView(SPA_VIEWS.CACES);
            else if (label.includes("rural")) switchView(SPA_VIEWS.RURAL);
            else if (label.includes("mentoría") || label.includes("mentoria")) switchView(SPA_VIEWS.CLASSROOMS);
            else if (label.includes("bóveda") || label.includes("admin")) switchView(SPA_VIEWS.ADMIN);
        });
    });

    // 3. Enlazar botón rápido de Admin en el Header superior (#header-admin-btn)
    const headerAdminBtn = document.getElementById("header-admin-btn");
    if (headerAdminBtn && !headerAdminBtn.dataset.boundSpaRouter) {
        headerAdminBtn.dataset.boundSpaRouter = "1";
        headerAdminBtn.addEventListener("click", (e) => {
            e.preventDefault();
            switchView(SPA_VIEWS.ADMIN);
        });
    }

    // 4. Enlazar botones superiores ("Aulas Virtuales", "Mis Métricas", "Sináptico v4.4")
    bindHeaderQuickButtons();

    // 5. Enlazar botones con clase .upcoming-feature al Toast informativo
    document.querySelectorAll(".upcoming-feature").forEach(btn => {
        if (btn.dataset.boundSpaToast) return;
        btn.dataset.boundSpaToast = "1";
        btn.addEventListener("click", () => showRouterToast());
    });

    // 6. Centralizar switchView en window.MakaiOrchestrator
    if (window.MakaiOrchestrator) {
        window.MakaiOrchestrator.switchView = switchView;
    }

    // 7. Inicializar el escudo de historial del navegador (evita volver a index.html)
    if (!routerInitialized) {
        routerInitialized = true;
        initBrowserHistoryGuard();
    }

    syncRouterWithStore();
    console.info("[MakaiRouterSPA] Navegación SPA y retroceso paso a paso activos.");
}

// Alias de compatibilidad invocados por app.orchestrator.js
export const initRouter = initRouterSPA;
export const initCascadingCurriculumRouter = renderCascadingSelectors;

// Exposición global para cualquier módulo o inspección en consola
window.MakaiRouter = {
    SPA_VIEWS,
    initRouterSPA,
    switchView,
    goBackView,
    pushSpaHistoryState,
    selectAcademicTrack,
    selectCareerAndStage,
    renderCascadingSelectors,
    renderCarreraUniversityView,
    renderCacesOfficialView,
    showRouterToast,
    getRouterState: () => ({ ...routerState })
};
