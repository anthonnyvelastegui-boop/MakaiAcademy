// ============================================================================
// ARCHIVO: js/9-graduation/thesis.toolkit.js
// DESCRIPCIÓN: Toolkit Metodológico y Bioestadístico de Tesis (Carpeta 9).
//              Integra para las 11 Carreras de Ciencias de la Salud:
//              1) Generador PICO + Título + Objetivos + Hipótesis (H1/H0)
//              2) Calculadora Bioestadística de Tamaño de Muestra (n y ajuste)
//              3) Matriz Interactiva de Operacionalización de Variables
//              4) Asesor de Pruebas en SPSS / R-Studio + Flujograma PRISMA 2020
//              5) Citador Automático en Normas Vancouver + Plantillas Oficiales
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { appState, isMasterAdmin } from "../2-core/state.store.js";
import { db, auth } from "../2-core/firebase.service.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA Y CATÁLOGO DE LAS 11 CARRERAS DE SALUD
// ============================================================================

export const TOOLKIT_ASSETS = Object.freeze({
    templatesPath: "assets/9-multimedia-titulacion/plantillas-tesis/"
});

const MASTER_ADMIN_EMAILS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

export const HEALTH_CAREERS_TOOLKIT = Object.freeze([
    { id: "medicina", nombre: "Medicina Humana", icono: "medical_services" },
    { id: "enfermeria", nombre: "Enfermería", icono: "vaccines" },
    { id: "odontologia", nombre: "Odontología", icono: "dentistry" },
    { id: "obstetricia", nombre: "Obstetricia y Puericultura", icono: "pregnant_woman" },
    { id: "fisioterapia", nombre: "Fisioterapia y Terapia Física", icono: "accessibility_new" },
    { id: "laboratorio_clinico", nombre: "Laboratorio Clínico", icono: "biotech" },
    { id: "psicologia_clinica", nombre: "Psicología Clínica", icono: "psychology" },
    { id: "nutricion_dietetica", nombre: "Nutrición y Dietética", icono: "nutrition" },
    { id: "bioquimica_farmacia", nombre: "Bioquímica y Farmacia", icono: "medication" },
    { id: "imagenologia_radiologia", nombre: "Imagenología y Radiología", icono: "radiology" },
    { id: "atencion_prehospitalaria", nombre: "Atención Prehospitalaria y Emergencias", icono: "ambulance" }
]);

// Presets PICO Clínicos por cada una de las 11 Carreras de Salud
export const CAREER_PICO_PRESETS = Object.freeze({
    medicina: {
        p: "pacientes adultos con sepsis de foco abdominal atendidos en la Unidad de Cuidados Intensivos del Hospital General",
        i: "la elevación temprana del índice lactato/albúmina (> 1.5) en las primeras 6 horas de ingreso",
        c: "el puntaje SOFA aislado convencional",
        o: "la predicción de mortalidad intrahospitalaria a los 28 días y requerimiento de soporte vasopresor",
        design: "Observacional, Analítico, de Cohorte Retrospectiva",
        placeAndYear: "Hospital General Docente, periodo 2025-2026"
    },
    enfermeria: {
        p: "pacientes adultos mayores hospitalizados con ventilación mecánica invasiva en la Unidad de Cuidados Críticos",
        i: "la aplicación estandarizada del paquete de medidas ABCDEF guiado por taxonomía NANDA-NIC-NOC",
        c: "el cuidado postural y aspiración de secreciones convencional",
        o: "la disminución de la incidencia de neumonía asociada a la ventilación mecánica (NAVM) y días de estancia en UCI",
        design: "Cuasi-experimental, Longitudinal, Prospectivo con Pre-test y Post-test",
        placeAndYear: "Hospital de Especialidades, periodo 2025-2026"
    },
    odontologia: {
        p: "premolares humanos extraídos sometidos a preparación biomecánica endodóntica in vitro",
        i: "la irrigación ultrasónica pasiva con hipoclorito de sodio al 5.25% activado + EDTA al 17%",
        c: "la irrigación convencional con aguja de salida lateral sin activación ultrasónica",
        o: "la eliminación de Enterococcus faecalis del tercio apical radicular y sellado tridimensional",
        design: "Experimental In Vitro, Comparativo, Transversal",
        placeAndYear: "Laboratorio de Investigación Odontológica Universitaria, 2026"
    },
    obstetricia: {
        p: "gestantes adolescentes en el tercer trimestre atendidas en el Centro Obstétrico",
        i: "el índice proteína/creatinina urinario en muestra aislada >= 0.3 mg/dL asociado a flujometría Doppler de arterias uterinas",
        c: "la proteinuria de 24 horas tradicional sin velocimetría Doppler",
        o: "el diagnóstico oportuno de preeclampsia con signos de gravedad y restricción del crecimiento intrauterino (RCIU)",
        design: "Observacional, Analítico de Validación de Prueba Diagnóstica (Curvas ROC)",
        placeAndYear: "Hospital Gineco-Obstétrico, periodo 2025-2026"
    },
    fisioterapia: {
        p: "pacientes adultos con secuelas de accidente cerebrovascular isquémico en fase subaguda",
        i: "un protocolo combinado de facilitación neuromuscular propioceptiva (FNP) más entrenamiento de marcha en doble tarea",
        c: "la cinesiterapia pasiva-asistida convencional",
        o: "la recuperación del equilibrio funcional (Escala de Berg) y reducción del riesgo de caídas (Test de Tinetti)",
        design: "Cuasi-experimental, Longitudinal, Prospectivo (Pre/Post intervención)",
        placeAndYear: "Centro Especializado de Rehabilitación Integral, 2026"
    },
    laboratorio_clinico: {
        p: "urocultivos positivos de pacientes hospitalizados con infección del tracto urinario complicada",
        i: "la detección fenotípica y molecular de betalactamasas de espectro extendido (BLEE) y carbapenemasas tipo KPC",
        c: "el antibiograma automatizado estándar sin pruebas confirmatorias de sinergia",
        o: "la determinación del perfil de multidrogorresistencia antimicrobiana y concordancia diagnóstica",
        design: "Observacional, Descriptivo-Correlacional, de Corte Transversal",
        placeAndYear: "Área de Microbiología del Laboratorio Clínico Hospitalario, 2026"
    },
    psicologia_clinica: {
        p: "médicos residentes e internos rotativos de áreas críticas hospitalarias",
        i: "la presencia de síndrome de Burnout severo (Maslach Burnout Inventory) y fatiga por compasión",
        c: "niveles bajos o moderados de agotamiento emocional laboral",
        o: "el desarrollo de sintomatología depresiva (PHQ-9), ansiedad generalizada (GAD-7) y alteración de la calidad del sueño",
        design: "Observacional, Analítico, Correlacional de Corte Transversal",
        placeAndYear: "Hospital General Docente, periodo 2025-2026"
    },
    nutricion_dietetica: {
        p: "pacientes adultos con enfermedad renal crónica estadio 5 en programa de hemodiálisis trisemanal",
        i: "el soporte nutricional personalizado hiperproteico controlado en fósforo/potasio guiado por bioimpedancia eléctrica",
        c: "la consejería dietética estándar sin monitoreo de ángulo de fase",
        o: "la preservación de masa muscular esquelética (índice ISAK), albúmina sérica >= 4.0 g/dL y score MIS",
        design: "Observacional, Analítico, Longitudinal Prospectivo",
        placeAndYear: "Unidad de Diálisis y Nefrología Clínica, 2026"
    },
    bioquimica_farmacia: {
        p: "pacientes polimedicados con insuficiencia cardíaca crónica e hipertensión arterial",
        i: "el seguimiento farmacoterapéutico estructurado (Método Dáder) y conciliación de medicamentos al alta",
        c: "la dispensación hospitalaria habitual sin intervención farmacéutica clínica",
        o: "la reducción de resultados negativos asociados a la medicación (RNM), interacciones graves y adherencia Morisky-Green",
        design: "Cuasi-experimental, Prospectivo de Intervención Farmacéutica",
        placeAndYear: "Servicio de Farmacia Hospitalaria, periodo 2025-2026"
    },
    imagenologia_radiologia: {
        p: "pacientes adultos con sospecha clínica de tromboembolismo pulmonar agudo en emergencia",
        i: "la angiotomografía pulmonar multicorte con protocolo de optimización de dosis de radiación y bolo de contraste",
        c: "el protocolo tomográfico estándar de energía única",
        o: "la calidad diagnóstica de opacificación arterial pulmonar (Unidades Hounsfield) y reducción del producto dosis-longitud (DLP)",
        design: "Observacional, Analítico, Comparativo de Corte Transversal",
        placeAndYear: "Departamento de Imagenología y Radiodiagnóstico, 2026"
    },
    atencion_prehospitalaria: {
        p: "pacientes politraumatizados graves con shock hemorrágico atendidos en la escena prehospitalaria",
        i: "la aplicación del índice de shock modificado (>= 1.3), ácido tranexámico temprano (< 3h) y control de hipotermia",
        c: "la reanimación hídrica agresiva convencional con cristaloides",
        o: "la estabilidad hemodinámica al ingreso al cuarto de choque y supervivencia a las 24 horas",
        design: "Observacional, Analítico, de Casos y Controles",
        placeAndYear: "Sistema de Emergencias Médicas Prehospitalarias, 2025-2026"
    }
});

// Biblioteca Oficial de Plantillas de Tesis (assets/9-multimedia-titulacion/plantillas-tesis/)
export const METHODOLOGY_TEMPLATES_CATALOG = Object.freeze([
    {
        id: "tpl_anteproyecto_ces",
        titulo: "Plantilla Maestra de Anteproyecto / Perfil de Tesis (Formato Universal CES)",
        archivo: "plantilla_anteproyecto_salud_2026.pdf",
        categoria: "Anteproyecto & Protocolo",
        paginas: 28,
        puntosClave: [
            "Estructura oficial: Planteamiento del problema, contextualización macro-meso-micro, pregunta PICO y justificación.",
            "Formulación de Objetivo General, Objetivos Específicos (Taxonomía de Bloom) e Hipótesis clínica.",
            "Matriz de Operacionalización de Variables y Aspectos Bioéticos (Declaración de Helsinki y Ley Orgánica de Salud)."
        ]
    },
    {
        id: "tpl_vancouver_icmje",
        titulo: "Manual Práctico de Normas Vancouver (ICMJE) + Zotero / Mendeley en Ciencias de la Salud",
        archivo: "guia_normas_vancouver_salud_2026.pdf",
        categoria: "Citado & Bibliografía",
        paginas: 34,
        puntosClave: [
            "Reglas de numeración correlativa por orden de aparición en el texto con superíndice o paréntesis.",
            "Formatos exactos para artículos de PubMed/Medline, SciELO, Guías de Práctica Clínica (GPC-MSP) y libros médicos.",
            "Protocolo de reducción de similitud en Turnitin / Compilatio (< 5%) mediante parafraseo técnico clínico."
        ]
    },
    {
        id: "tpl_spss_prisma",
        titulo: "Guía de Bioestadística en SPSS / R-Studio y Flujograma PRISMA 2020",
        archivo: "manual_bioestadistica_spss_prisma.pdf",
        categoria: "Bioestadística & PRISMA",
        paginas: 42,
        puntosClave: [
            "Árbol de decisión paso a paso: Prueba de normalidad (Kolmogorov-Smirnov n > 50 / Shapiro-Wilk n <= 50).",
            "Cálculo e interpretación clínica de Valor p (< 0.05), IC 95%, Odds Ratio (OR), Riesgo Relativo (RR) y Curvas ROC.",
            "Plantilla editable del diagrama de flujo PRISMA 2020 (Identificación, Cribado, Elegibilidad e Inclusión) y escala Newcastle-Ottawa."
        ]
    },
    {
        id: "tpl_defensa_tribunal",
        titulo: "Estructura de Diapositivas y Defensa Oral de Tesis ante Tribunal Calificador",
        archivo: "plantilla_defensa_tribunal_salud.pdf",
        categoria: "Sustentación & Jurado",
        paginas: 22,
        puntosClave: [
            "Distribución táctica de 20 minutos: Introducción (3 min), Metodología (4 min), Resultados/Tablas (8 min), Discusión y Conclusiones (5 min).",
            "Banco de las 25 preguntas más frecuentes del Tribunal de Grado (validez interna, sesgos, cálculo muestral y limitaciones).",
            "Regla de coherencia horizontal: correspondencia exacta entre Objetivos Específicos, Tablas de Resultados y Conclusiones."
        ]
    }
]);

// ============================================================================
// 2. ESTADO REACTIVO DEL TOOLKIT DE TESIS
// ============================================================================

export const toolkitState = {
    initialized: false,
    mountElement: null,
    selectedCareer: "medicina",
    activeTab: "pico", // "pico" | "sample" | "variables" | "spss_prisma" | "vancouver"
    picoData: { ...CAREER_PICO_PRESETS.medicina },
    sampleParams: {
        mode: "FINITE", // "FINITE" | "INFINITE" | "TWO_GROUPS"
        populationN: 450,
        confidenceZ: 1.96, // 95%
        expectedPrevalenceP: 0.50,
        marginErrorE: 0.05,
        attritionRatePct: 10, // 10% de pérdidas esperadas
        pGroup1: 0.35,
        pGroup2: 0.15,
        powerFactor: 7.84 // Z_alpha + Z_beta al cuadrado (80% potencia, 95% confianza)
    },
    sampleResult: null,
    variablesMatrix: [],
    spssAdvisorConfig: {
        studyObjective: "ASOCIACION_CATEGORICA", // "ASOCIACION_CATEGORICA" | "COMPARAR_2_MEDIAS" | "COMPARAR_3_MAS_GRUPOS" | "CORRELACION_NUMERICA" | "PRUEBA_DIAGNOSTICA"
        sampleSizeN: 120,
        distribution: "NORMAL", // "NORMAL" | "NO_NORMAL"
        pairedSamples: false
    },
    prismaFlow: {
        identificadosPubMed: 245,
        identificadosScopusScielo: 130,
        duplicadosEliminados: 95,
        excluidosTituloResumen: 210,
        textosCompletosEvaluados: 70,
        excluidosCriterios: 48,
        incluidosSintesisFinal: 22
    },
    vancouverForm: {
        sourceType: "JOURNAL", // "JOURNAL" | "GPC_MSP" | "BOOK" | "THESIS"
        authors: "Velastegui A, Mendoza CA, Paredes V",
        title: "Índice lactato/albúmina como predictor temprano de mortalidad en sepsis abdominal",
        journalOrPublisher: "Rev Ecuat Med Cienc Biol",
        year: "2026",
        volume: "47",
        issue: "2",
        pages: "112-120",
        doiOrUrl: "10.26807/remcb.v47i2.1045"
    },
    vancouverBibliography: [],
    activeTemplatePreview: null
};

// ============================================================================
// 3. VERIFICACIÓN DE PERMISOS Y NORMALIZACIÓN DE CARRERAS
// ============================================================================

function isCurrentUserMasterAdmin() {
    const email = (
        appState?.currentUserData?.email ||
        auth?.currentUser?.email ||
        ""
    ).toLowerCase().trim();

    if (MASTER_ADMIN_EMAILS.includes(email)) return true;
    if (typeof isMasterAdmin === "function" && isMasterAdmin(email)) return true;
    return false;
}

function normalizeCareerId(rawCareer = "") {
    const clean = String(rawCareer).toLowerCase().trim();
    const aliasMap = {
        laboratorio: "laboratorio_clinico",
        psicologia: "psicologia_clinica",
        nutricion: "nutricion_dietetica",
        bioquimica: "bioquimica_farmacia",
        imagenologia: "imagenologia_radiologia",
        prehospitalaria: "atencion_prehospitalaria"
    };
    const mapped = aliasMap[clean] || clean;
    return HEALTH_CAREERS_TOOLKIT.some((c) => c.id === mapped) ? mapped : "medicina";
}

// ============================================================================
// 4. INICIALIZADOR PRINCIPAL (initThesisToolkit)
// ============================================================================

/**
 * Inicializa el Toolkit Metodológico y Bioestadístico de Tesis (Carpeta 9).
 * Invocado automáticamente por `graduation.controller.js` o `app.orchestrator.js`.
 * @param {Object} options - `{ mountSelector, defaultCareer, defaultTab }`
 */
export async function initThesisToolkit(options = {}) {
    loadToolkitLocalState();

    const resolvedCareer = normalizeCareerId(
        options.defaultCareer ||
        appState?.currentCareer ||
        appState?.currentUserData?.carrera ||
        toolkitState.selectedCareer
    );

    if (resolvedCareer !== toolkitState.selectedCareer) {
        toolkitState.selectedCareer = resolvedCareer;
        if (CAREER_PICO_PRESETS[resolvedCareer]) {
            toolkitState.picoData = { ...CAREER_PICO_PRESETS[resolvedCareer] };
        }
        toolkitState.variablesMatrix = buildDefaultVariableMatrix(resolvedCareer, toolkitState.picoData);
    }

    if (options.defaultTab) {
        toolkitState.activeTab = options.defaultTab;
    }

    if (!toolkitState.sampleResult) {
        calculateSampleSize(toolkitState.sampleParams);
    }
    if (!Array.isArray(toolkitState.variablesMatrix) || toolkitState.variablesMatrix.length === 0) {
        toolkitState.variablesMatrix = buildDefaultVariableMatrix(
            toolkitState.selectedCareer,
            toolkitState.picoData
        );
    }
    if (!Array.isArray(toolkitState.vancouverBibliography) || toolkitState.vancouverBibliography.length === 0) {
        const seedCite = formatVancouverCitation(toolkitState.vancouverForm);
        toolkitState.vancouverBibliography = [seedCite];
    }

    const mountEl = resolveToolkitMountElement(options.mountSelector);
    if (!mountEl) return;

    toolkitState.mountElement = mountEl;
    toolkitState.initialized = true;

    renderThesisToolkitUI();
    exposeGlobalToolkitAPI();
}

// Alias de compatibilidad para cargadores dinámicos
export const initToolkitTesis = initThesisToolkit;

function resolveToolkitMountElement(customSelector) {
    if (customSelector) {
        const el = document.querySelector(customSelector);
        if (el) return el;
    }
    const existingMount = document.getElementById("thesis-toolkit-mount");
    if (existingMount) return existingMount;

    const gradStage = document.getElementById("graduation-dynamic-stage");
    if (gradStage) return gradStage;

    const gradView = document.getElementById("view-graduation");
    if (gradView) return gradView;

    return null;
}

function exposeGlobalToolkitAPI() {
    window.MakaiThesisToolkit = {
        init: (opts) => initThesisToolkit(opts),
        calculateSampleSize: (params) => calculateSampleSize(params),
        buildPicoQuestion: (pico) => buildPicoQuestion(pico),
        generateVariableMatrix: (careerId) => generateVariableMatrix(careerId),
        recommendStatisticalTest: (cfg) => recommendStatisticalTest(cfg),
        formatVancouverCitation: (src) => formatVancouverCitation(src),
        openMethodologyTemplates: (id) => openMethodologyTemplates(id),
        exportProtocol: () => exportThesisProtocolReport()
    };
}

// ============================================================================
// 5. FUNCIONES NUCLEARES DEL TOOLKIT (PICO, MUESTRA, VARIABLES, SPSS, VANCOUVER)
// ============================================================================

/**
 * Genera la Pregunta PICO, el Título Oficial de Tesis, el Objetivo General,
 * los 4 Objetivos Específicos y las Hipótesis (H1 y H0).
 * @param {Object} picoInput - `{ p, i, c, o, design, placeAndYear }`
 */
export function buildPicoQuestion(picoInput = toolkitState.picoData) {
    const p = (picoInput.p || "pacientes atendidos en la unidad hospitalaria").trim();
    const i = (picoInput.i || "el factor de exposición o intervención clínica").trim();
    const c = (picoInput.c || "el manejo o parámetro convencional").trim();
    const o = (picoInput.o || "el desenlace clínico primario").trim();
    const design = (picoInput.design || "Observacional, Analítico de Corte Transversal").trim();
    const placeAndYear = (picoInput.placeAndYear || "Hospital General, 2026").trim();

    const hasComparator = c && !c.toLowerCase().includes("no aplica") && c !== "-";

    const question = hasComparator
        ? `¿En ${p}, de qué manera ${i}, en comparación con ${c}, se asocia o influye sobre ${o} en el ${placeAndYear}?`
        : `¿En ${p}, cuál es la relación entre ${i} y ${o} en el ${placeAndYear}?`;

    const thesisTitle = `${capitalizeFirst(i)} y su relación con ${o} en ${p}. ${placeAndYear}.`;

    const generalObjective = hasComparator
        ? `Determinar la efectividad y asociación clínica de ${i} frente a ${c} sobre ${o} en ${p}, ${placeAndYear}.`
        : `Determinar la asociación entre ${i} y ${o} en ${p}, ${placeAndYear}.`;

    const specificObjectives = [
        `1. Caracterizar sociodemográfica y clínicamente a la población de ${p} incluida en el estudio.`,
        `2. Evaluar los parámetros de ${i} ${hasComparator ? `en contraste con ${c}` : ""} según los protocolos diagnósticos vigentes.`,
        `3. Establecer la asociación bioestadística (Valor p < 0.05 e IC 95%) entre ${i} y ${o}.`,
        `4. Proponer un algoritmo clínico o protocolo de actuación basado en los hallazgos obtenidos para optimizar el manejo en ${placeAndYear}.`
    ];

    const hypothesisH1 = `H₁ (Hipótesis de Investigación): ${capitalizeFirst(i)} presenta una asociación estadísticamente significativa (p < 0.05) con ${o} en ${p}.`;
    const hypothesisH0 = `H₀ (Hipótesis Nula): ${capitalizeFirst(i)} no presenta una asociación estadísticamente significativa (p ≥ 0.05) con ${o} en ${p}.`;

    return {
        question,
        thesisTitle,
        generalObjective,
        specificObjectives,
        hypothesisH1,
        hypothesisH0,
        design,
        placeAndYear
    };
}

/**
 * Calculadora automática de Tamaño de Muestra (n) para tesis de grado:
 * - Población Finita (fórmula de Cochran con corrección finita)
 * - Población Infinita (universo desconocido o > 100.000)
 * - Comparación de 2 Proporciones Independientes (Casos y Controles / Cohortes / Ensayos)
 * Incluye cálculo automático de Muestra Ajustada por Pérdidas (Attrition).
 */
export function calculateSampleSize(params = toolkitState.sampleParams) {
    const merged = { ...toolkitState.sampleParams, ...params };
    const mode = merged.mode || "FINITE";
    const N = Math.max(10, Number(merged.populationN) || 450);
    const Z = Number(merged.confidenceZ) || 1.96;
    const p = Math.min(0.99, Math.max(0.01, Number(merged.expectedPrevalenceP) || 0.5));
    const q = 1 - p;
    const e = Math.min(0.25, Math.max(0.01, Number(merged.marginErrorE) || 0.05));
    const attritionPct = Math.min(50, Math.max(0, Number(merged.attritionRatePct) || 10));

    let baseSampleN = 0;
    let formulaUsed = "";
    let technicalExplanation = "";

    if (mode === "INFINITE") {
        baseSampleN = Math.ceil((Math.pow(Z, 2) * p * q) / Math.pow(e, 2));
        formulaUsed = "n₀ = (Z² · p · q) / e² (Población Infinita o Desconocida)";
        technicalExplanation = `Cálculo para población infinita con nivel de confianza Z = ${Z}, prevalencia esperada p = ${(p * 100).toFixed(1)}% y error máximo admisible e = ${(e * 100).toFixed(1)}%.`;
    } else if (mode === "TWO_GROUPS") {
        const p1 = Math.min(0.99, Math.max(0.01, Number(merged.pGroup1) || 0.35));
        const p2 = Math.min(0.99, Math.max(0.01, Number(merged.pGroup2) || 0.15));
        const diffSq = Math.max(0.0025, Math.pow(p1 - p2, 2));
        const k = Number(merged.powerFactor) || 7.84; // 80% potencia + 95% confianza
        const perGroup = Math.ceil((k * (p1 * (1 - p1) + p2 * (1 - p2))) / diffSq);
        baseSampleN = perGroup * 2;
        formulaUsed = `n por grupo = ${perGroup} sujetos (Total 2 grupos = ${baseSampleN})`;
        technicalExplanation = `Comparación de dos grupos independientes (p₁ = ${(p1 * 100).toFixed(1)}% vs p₂ = ${(p2 * 100).toFixed(1)}%) con potencia estadística (1-β) = 80% y nivel de confianza del 95%.`;
    } else {
        // FINITE (Por defecto)
        const numerator = N * Math.pow(Z, 2) * p * q;
        const denominator = Math.pow(e, 2) * (N - 1) + Math.pow(Z, 2) * p * q;
        baseSampleN = Math.ceil(numerator / denominator);
        formulaUsed = "n = [N · Z² · p · q] / [e² · (N - 1) + Z² · p · q] (Población Finita)";
        technicalExplanation = `Muestra representativa extraída de un universo finito de N = ${N} historias clínicas/pacientes con Z = ${Z}, p = ${(p * 100).toFixed(1)}% y margen de error e = ${(e * 100).toFixed(1)}%.`;
    }

    const lossFactor = 1 - attritionPct / 100;
    const adjustedSampleN =
        lossFactor > 0 ? Math.ceil(baseSampleN / lossFactor) : baseSampleN;

    const resultObj = {
        mode,
        populationN: N,
        confidenceZ: Z,
        expectedPrevalenceP: p,
        marginErrorE: e,
        attritionRatePct: attritionPct,
        baseSampleN,
        adjustedSampleN,
        formulaUsed,
        technicalExplanation
    };

    toolkitState.sampleParams = merged;
    toolkitState.sampleResult = resultObj;
    saveToolkitLocalState();

    return resultObj;
}

/**
 * Construye la Matriz de Operacionalización de Variables según la carrera y el PICO.
 */
export function generateVariableMatrix(
    careerId = toolkitState.selectedCareer,
    customVars = null
) {
    if (Array.isArray(customVars) && customVars.length > 0) {
        toolkitState.variablesMatrix = customVars;
        saveToolkitLocalState();
        return toolkitState.variablesMatrix;
    }

    const built = buildDefaultVariableMatrix(careerId, toolkitState.picoData);
    toolkitState.variablesMatrix = built;
    saveToolkitLocalState();
    return built;
}

function buildDefaultVariableMatrix(careerId, picoData = {}) {
    return [
        {
            id: "var_indep",
            tipo: "Variable Independiente (Exposición / Intervención)",
            nombre: capitalizeFirst(picoData.i || "Factor de exposición principal"),
            dimension: "Clínica / Diagnóstica / Terapéutica",
            indicador: "Presencia/Ausencia o Valor cuantitativo en protocolo",
            escala: "Cuantitativa Continua / Cualitativa Nominal Dicotómica",
            instrumento: "Ficha de recolección de datos / Historia Clínica"
        },
        {
            id: "var_dep",
            tipo: "Variable Dependiente (Outcome / Resultado)",
            nombre: capitalizeFirst(picoData.o || "Desenlace clínico primario"),
            dimension: "Evolución Clínica y Pronóstico",
            indicador: "Tasa de evento clínico / Escala validada post-intervención",
            escala: "Cualitativa Nominal Dicotómica (Sí / No) o Ordinal",
            instrumento: "Epicrisis / Escala Clínica Validada / Reporte de Laboratorio"
        },
        {
            id: "var_interv_1",
            tipo: "Variable Interviniente (Sociodemográfica)",
            nombre: "Edad y Sexo biológico del paciente",
            dimension: "Demográfica biológica",
            indicador: "Años cumplidos / Sexo registrado (Masculino / Femenino)",
            escala: "Cuantitativa Discreta (Edad) / Cualitativa Nominal (Sexo)",
            instrumento: "Expediente clínico / Cédula de identidad"
        },
        {
            id: "var_interv_2",
            tipo: "Variable Interviniente (Clínica / Comorbilidad)",
            nombre: "Comorbilidades previas y estancia hospitalaria",
            dimension: "Antecedentes patológicos y tiempo de exposición",
            indicador: "Índice de Charlson / Días de hospitalización",
            escala: "Cualitativa Ordinal / Cuantitativa Discreta",
            instrumento: "Historia clínica electrónica (PRAS / HCE)"
        }
    ];
}

/**
 * Recomienda la prueba estadística exacta en SPSS / R-Studio según el objetivo,
 * tamaño de muestra y distribución de los datos.
 */
export function recommendStatisticalTest(config = toolkitState.spssAdvisorConfig) {
    const merged = { ...toolkitState.spssAdvisorConfig, ...config };
    toolkitState.spssAdvisorConfig = merged;

    const n = Number(merged.sampleSizeN) || 120;
    const isNormal = merged.distribution === "NORMAL";
    const isPaired = Boolean(merged.pairedSamples);

    const normalityTest =
        n > 50
            ? "Prueba de Kolmogorov-Smirnov (K-S) porque n > 50 sujetos (normalidad si p > 0.05)"
            : "Prueba de Shapiro-Wilk porque n ≤ 50 sujetos (normalidad si p > 0.05)";

    let primaryTest = "";
    let effectSizeMeasure = "";
    let spssRoute = "";

    switch (merged.studyObjective) {
        case "ASOCIACION_CATEGORICA":
            primaryTest = isPaired
                ? "Prueba de McNemar (muestras relacionadas dicotómicas)"
                : "Chi-Cuadrado de Pearson (χ²) o Test Exacto de Fisher (si alguna celda esperada < 5)";
            effectSizeMeasure =
                "Odds Ratio (OR) en Casos y Controles / Transversal, o Riesgo Relativo (RR) en Cohortes con IC 95%";
            spssRoute =
                "Analizar → Estadísticos descriptivos → Tablas cruzadas → Casilla 'Estadísticos': marcar Chi-cuadrado y Riesgo (OR/RR)";
            break;

        case "COMPARAR_2_MEDIAS":
            if (isNormal) {
                primaryTest = isPaired
                    ? "Prueba T de Student para muestras relacionadas (Pre-test vs Post-test)"
                    : "Prueba T de Student para muestras independientes (con prueba de Levene para igualdad de varianzas)";
                spssRoute = isPaired
                    ? "Analizar → Comparar medias → Prueba T para muestras relacionadas"
                    : "Analizar → Comparar medias → Prueba T para muestras independientes";
            } else {
                primaryTest = isPaired
                    ? "Prueba de Rangos con Signo de Wilcoxon (No paramétrica Pre/Post)"
                    : "Prueba U de Mann-Whitney (No paramétrica para 2 grupos independientes)";
                spssRoute =
                    "Analizar → Pruebas no paramétricas → Cuadros de diálogo antiguos → 2 muestras independientes / relacionadas";
            }
            effectSizeMeasure =
                "Diferencia de medias/medianas con Intervalo de Confianza al 95% y d de Cohen";
            break;

        case "COMPARAR_3_MAS_GRUPOS":
            if (isNormal) {
                primaryTest = isPaired
                    ? "ANOVA de medidas repetidas (con corrección de Greenhouse-Geisser)"
                    : "ANOVA de un factor (One-Way ANOVA) con prueba Post-Hoc de Tukey o Bonferroni";
                spssRoute = "Analizar → Comparar medias → ANOVA de un factor → Post Hoc (Tukey)";
            } else {
                primaryTest = isPaired
                    ? "Prueba de Friedman (3 o más mediciones repetidas no paramétricas)"
                    : "Prueba H de Kruskal-Wallis (3 o más grupos independientes no paramétricos)";
                spssRoute =
                    "Analizar → Pruebas no paramétricas → K muestras independientes (Kruskal-Wallis)";
            }
            effectSizeMeasure = "Eta cuadrado parcial (η²) y comparaciones múltiples por pares";
            break;

        case "CORRELACION_NUMERICA":
            primaryTest = isNormal
                ? "Coeficiente de Correlación r de Pearson (relación lineal paramétrica)"
                : "Coeficiente Rho de Spearman (ρ) (no paramétrico o variables ordinales)";
            effectSizeMeasure =
                "Coeficiente r / Rho (-1 a +1) y Coeficiente de determinación R² en regresión lineal";
            spssRoute =
                "Analizar → Correlaciones → Bivariadas → Marcar Pearson o Spearman (bilateral)";
            break;

        case "PRUEBA_DIAGNOSTICA":
        default:
            primaryTest =
                "Curva ROC (Área Bajo la Curva - AUC) y Tabla de Contingencia 2x2 contra Gold Standard";
            effectSizeMeasure =
                "Sensibilidad (S), Especificidad (E), Valor Predictivo Positivo (VPP), Valor Predictivo Negativo (VPN) e Índice de Youden";
            spssRoute =
                "Analizar → Clasificar → Curva COR (ROC Curve) → Marcar 'Con línea de referencia diagonal' y Error estándar/IC 95%";
            break;
    }

    saveToolkitLocalState();
    return {
        normalityTest,
        primaryTest,
        effectSizeMeasure,
        spssRoute
    };
}

/**
 * Formatea una fuente bibliográfica en estilo oficial Normas Vancouver (ICMJE).
 */
export function formatVancouverCitation(sourceData = toolkitState.vancouverForm) {
    const type = sourceData.sourceType || "JOURNAL";
    const authors = (sourceData.authors || "Autor A").trim().replace(/\.$/, "");
    const title = (sourceData.title || "Título de la investigación").trim().replace(/\.$/, "");
    const journalOrPub = (sourceData.journalOrPublisher || "Rev Med").trim().replace(/\.$/, "");
    const year = (sourceData.year || "2026").trim();
    const vol = (sourceData.volume || "1").trim();
    const issue = (sourceData.issue || "1").trim();
    const pages = (sourceData.pages || "1-10").trim();
    const doi = (sourceData.doiOrUrl || "").trim();

    if (type === "GPC_MSP") {
        return `Ministerio de Salud Pública del Ecuador. ${title}: Guía de Práctica Clínica (GPC). Quito: Dirección Nacional de Normatización - MSP; ${year}. Disponible en: ${doi || "https://www.salud.gob.ec"}`;
    }
    if (type === "BOOK") {
        return `${authors}. ${title}. ${vol ? `${vol}ª ed. ` : ""}Madrid: ${journalOrPub}; ${year}. p. ${pages}.`;
    }
    if (type === "THESIS") {
        return `${authors}. ${title} [Tesis de grado]. Ecuador: ${journalOrPub}; ${year}. Disponible en: ${doi || "Repositorio Digital Universitario"}`;
    }

    // Por defecto: JOURNAL (Artículo de revista médica indexada)
    const doiSuffix = doi
        ? doi.startsWith("http")
            ? ` Disponible en: ${doi}`
            : ` doi: ${doi}.`
        : "";
    return `${authors}. ${title}. ${journalOrPub}. ${year};${vol}(${issue}):${pages}.${doiSuffix}`;
}

/**
 * Abre las plantillas de `assets/9-multimedia-titulacion/plantillas-tesis/`.
 * Si el PDF existe lo abre en una pestaña nueva; si aún es semilla, despliega el
 * Resumen Táctico Holográfico sin errores 404.
 */
export async function openMethodologyTemplates(templateId) {
    const tpl =
        METHODOLOGY_TEMPLATES_CATALOG.find((t) => t.id === templateId) ||
        METHODOLOGY_TEMPLATES_CATALOG[0];

    const fileUrl = `${TOOLKIT_ASSETS.templatesPath}${tpl.archivo}`;

    try {
        const response = await fetch(fileUrl, { method: "HEAD", cache: "no-cache" });
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (response.ok && (contentType.includes("pdf") || contentType.includes("word"))) {
            window.open(fileUrl, "_blank");
            return { openedExternal: true, url: fileUrl };
        }
    } catch (e) {
        // Continúa hacia el visor holográfico integrado
    }

    toolkitState.activeTemplatePreview = tpl;
    renderThesisToolkitUI();
    return { openedExternal: false, template: tpl };
}

// ============================================================================
// 6. EXPORTACIÓN Y SINCRONIZACIÓN DEL PROTOCOLO EN FIRESTORE
// ============================================================================

export async function exportThesisProtocolReport() {
    const careerObj =
        HEALTH_CAREERS_TOOLKIT.find((c) => c.id === toolkitState.selectedCareer) ||
        HEALTH_CAREERS_TOOLKIT[0];
    const picoOut = buildPicoQuestion(toolkitState.picoData);
    const sampleOut = toolkitState.sampleResult || calculateSampleSize(toolkitState.sampleParams);
    const spssOut = recommendStatisticalTest(toolkitState.spssAdvisorConfig);

    const lines = [
        "====================================================================",
        "EXPEDIENTE METODOLÓGICO DE TESIS — MAKAI ACADEMY (CARPETA 9)",
        "====================================================================",
        `CARRERA: ${careerObj.nombre}`,
        `DISEÑO DE ESTUDIO: ${picoOut.design}`,
        "",
        "1. TÍTULO TENTATIVO DE TESIS:",
        `   ${picoOut.thesisTitle}`,
        "",
        "2. PREGUNTA DE INVESTIGACIÓN (ESTRUCTURA PICO):",
        `   ${picoOut.question}`,
        `   • P (Población): ${toolkitState.picoData.p}`,
        `   • I (Intervención/Exposición): ${toolkitState.picoData.i}`,
        `   • C (Comparador): ${toolkitState.picoData.c}`,
        `   • O (Outcome/Desenlace): ${toolkitState.picoData.o}`,
        "",
        "3. OBJETIVOS DE LA INVESTIGACIÓN:",
        `   • Objetivo General: ${picoOut.generalObjective}`,
        ...picoOut.specificObjectives.map((obj) => `   ${obj}`),
        "",
        "4. HIPÓTESIS CLÍNICA:",
        `   • ${picoOut.hypothesisH1}`,
        `   • ${picoOut.hypothesisH0}`,
        "",
        "5. CÁLCULO BIOESTADÍSTICO DE TAMAÑO DE MUESTRA:",
        `   • Fórmula aplicada: ${sampleOut.formulaUsed}`,
        `   • Muestra mínima calculada (n): ${sampleOut.baseSampleN} sujetos`,
        `   • Muestra ajustada por pérdidas (${sampleOut.attritionRatePct}%): ${sampleOut.adjustedSampleN} sujetos`,
        `   • Justificación técnica: ${sampleOut.technicalExplanation}`,
        "",
        "6. PLAN DE ANÁLISIS EN SPSS / R-STUDIO:",
        `   • Prueba de Normalidad: ${spssOut.normalityTest}`,
        `   • Prueba Estadística Principal: ${spssOut.primaryTest}`,
        `   • Medida de Asociación / Efecto: ${spssOut.effectSizeMeasure}`,
        `   • Ruta en SPSS: ${spssOut.spssRoute}`,
        "",
        "7. REFERENCIAS EN NORMAS VANCOUVER (ICMJE):",
        ...toolkitState.vancouverBibliography.map((ref, idx) => `   [${idx + 1}] ${ref}`)
    ];

    const fullText = lines.join("\n");

    // Copiar automáticamente al portapapeles y descargar archivo .txt
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(fullText);
        }
    } catch (e) {}

    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Protocolo_Tesis_${toolkitState.selectedCareer}_MakaiAcademy.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await syncToolkitProjectToFirestore();
    return fullText;
}

export async function syncToolkitProjectToFirestore() {
    saveToolkitLocalState();
    if (!db) return;

    const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid;
    if (!uid) return;

    try {
        await setDoc(
            doc(db, "proyectos_tesis_toolkit", uid),
            {
                uid,
                email: auth?.currentUser?.email || appState?.currentUserData?.email || "",
                carrera: toolkitState.selectedCareer,
                picoData: toolkitState.picoData,
                sampleParams: toolkitState.sampleParams,
                sampleResult: toolkitState.sampleResult,
                variablesMatrix: toolkitState.variablesMatrix,
                spssAdvisorConfig: toolkitState.spssAdvisorConfig,
                vancouverBibliography: toolkitState.vancouverBibliography,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );
    } catch (e) {
        // Conserva respaldo local si la colección aún no tiene permisos de escritura
    }
}

// ============================================================================
// 7. RENDERIZADO DE LA INTERFAZ CYBER-MEDICAL DEL TOOLKIT
// ============================================================================

function renderThesisToolkitUI() {
    const mount = toolkitState.mountElement;
    if (!mount) return;

    const currentCareer =
        HEALTH_CAREERS_TOOLKIT.find((c) => c.id === toolkitState.selectedCareer) ||
        HEALTH_CAREERS_TOOLKIT[0];
    const isStandalone = mount.id === "view-graduation";

    mount.innerHTML = `
        <div class="space-y-6">
            ${
                isStandalone
                    ? `
                <!-- BARRA SUPERIOR CON BOTONES FIJOS DERECHOS SI SE MONTA EN MODO AUTÓNOMO -->
                <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-2xl">calculate</span>
                        <div>
                            <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">CARPETA 9 • THESIS TOOLKIT</span>
                            <h2 class="text-base font-extrabold text-white">Laboratorio Metodológico, PICO, Muestra y Vancouver</h2>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-tk-nav="view-classrooms" class="px-3.5 py-2 rounded-xl bg-surface hover:bg-primary hover:text-[#06090e] text-primary border border-primary/40 text-xs font-extrabold font-mono transition-all">
                            🎥 Aulas Virtuales
                        </button>
                        <button type="button" data-tk-nav="view-metrics" class="px-3.5 py-2 rounded-xl bg-surface hover:bg-secondary hover:text-[#06090e] text-secondary border border-secondary/40 text-xs font-extrabold font-mono transition-all">
                            📊 Mis Métricas
                        </button>
                    </div>
                </div>
            `
                    : ""
            }

            <!-- CABECERA DEL TOOLKIT Y SELECTOR DE LAS 11 CARRERAS DE SALUD -->
            <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 space-y-5 shadow-[0_0_35px_rgba(0,229,255,0.06)]">
                <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/40">
                                TOOLKIT METODOLÓGICO & BIOESTADÍSTICO
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/40">
                                Especialidad activa: ${escapeHtml(currentCareer.nombre)}
                            </span>
                        </div>
                        <h2 class="text-xl font-extrabold text-white mt-1">
                            Ingeniería de Protocolo de Tesis y Cálculo Bioestadístico
                        </h2>
                    </div>

                    <div class="flex flex-wrap items-center gap-2.5">
                        <select
                            id="tk-career-selector"
                            class="bg-[#06090e] border border-primary/40 rounded-xl px-3.5 py-2 text-xs font-extrabold text-primary focus:outline-none cursor-pointer"
                        >
                            ${HEALTH_CAREERS_TOOLKIT.map(
                                (c) => `
                                <option value="${c.id}" class="bg-[#06090e] text-white" ${c.id === toolkitState.selectedCareer ? "selected" : ""}>
                                    ${escapeHtml(c.nombre)}
                                </option>
                            `
                            ).join("")}
                        </select>

                        <button
                            type="button"
                            id="btn-tk-load-preset"
                            class="px-3.5 py-2 rounded-xl bg-surface hover:bg-primary hover:text-[#06090e] text-primary border border-primary/40 text-xs font-mono font-extrabold transition-all"
                        >
                            ⚡ Cargar Caso Clínico Modelo
                        </button>

                        <button
                            type="button"
                            id="btn-tk-export-protocol"
                            class="px-4 py-2 rounded-xl bg-secondary text-[#06090e] hover:bg-opacity-90 text-xs font-mono font-extrabold transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,230,118,0.25)]"
                        >
                            <span class="material-symbols-outlined text-base">download</span>
                            <span>Descargar Protocolo Completo</span>
                        </button>
                    </div>
                </div>

                <!-- PESTAÑAS DE LAS 5 HERRAMIENTAS DEL TOOLKIT -->
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    ${renderToolkitTabButton("pico", "architecture", "1. Generador PICO", "Título, Objetivos e Hipótesis")}
                    ${renderToolkitTabButton("sample", "Functions", "2. Tamaño Muestra", "Población Finita / Infinita / 2 Grupos")}
                    ${renderToolkitTabButton("variables", "table_chart", "3. Matriz Variables", "Operacionalización e Indicadores")}
                    ${renderToolkitTabButton("spss_prisma", "analytics", "4. Asesor SPSS & PRISMA", "Pruebas Estadísticas y Flujograma")}
                    ${renderToolkitTabButton("vancouver", "menu_book", "5. Vancouver & Guías", "Citador ICMJE y Plantillas")}
                </div>

                <!-- CONTENIDO DINÁMICO DE LA HERRAMIENTA SELECCIONADA -->
                <div class="pt-2">
                    ${renderActiveToolkitTabContent()}
                </div>
            </div>
        </div>
    `;

    bindToolkitEvents(mount);
}

function renderToolkitTabButton(tabId, icon, title, subtitle) {
    const isActive = toolkitState.activeTab === tabId;
    return `
        <button
            type="button"
            data-tk-tab="${tabId}"
            class="p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                isActive
                    ? "bg-primary text-[#06090e] border-primary shadow-[0_0_18px_rgba(0,229,255,0.28)]"
                    : "bg-[#06090e] text-gray-300 border-surface-high hover:border-primary/50"
            }"
        >
            <span class="material-symbols-outlined text-xl">${icon}</span>
            <div class="overflow-hidden">
                <div class="text-xs font-extrabold font-mono uppercase truncate">${escapeHtml(title)}</div>
                <div class="text-[10px] opacity-80 truncate">${escapeHtml(subtitle)}</div>
            </div>
        </button>
    `;
}

function renderActiveToolkitTabContent() {
    switch (toolkitState.activeTab) {
        case "sample":
            return renderSampleSizeCalculatorTab();
        case "variables":
            return renderVariablesMatrixTab();
        case "spss_prisma":
            return renderSpssAndPrismaTab();
        case "vancouver":
            return renderVancouverAndTemplatesTab();
        case "pico":
        default:
            return renderPicoGeneratorTab();
    }
}

// ============================================================================
// 8. SUB-VISTAS DE LAS 5 HERRAMIENTAS DEL TOOLKIT
// ============================================================================

function renderPicoGeneratorTab() {
    const p = toolkitState.picoData;
    const out = buildPicoQuestion(p);

    return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Formulario de Entrada PICO -->
            <div class="lg:col-span-5 bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-3.5">
                <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                    PARÁMETROS CLÍNICOS PICO DE ENTRADA
                </span>

                <div>
                    <label class="block text-xs font-mono text-primary font-bold mb-1">
                        P — Paciente / Población / Problema Clínico
                    </label>
                    <textarea id="tk-in-p" rows="2" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none">${escapeHtml(p.p)}</textarea>
                </div>

                <div>
                    <label class="block text-xs font-mono text-primary font-bold mb-1">
                        I — Intervención / Exposición / Factor Pronóstico
                    </label>
                    <textarea id="tk-in-i" rows="2" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none">${escapeHtml(p.i)}</textarea>
                </div>

                <div>
                    <label class="block text-xs font-mono text-primary font-bold mb-1">
                        C — Comparador / Control (o "No aplica" si es descriptivo)
                    </label>
                    <input id="tk-in-c" type="text" value="${escapeHtml(p.c)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                </div>

                <div>
                    <label class="block text-xs font-mono text-primary font-bold mb-1">
                        O — Outcome / Desenlace Clínico Medible
                    </label>
                    <textarea id="tk-in-o" rows="2" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none">${escapeHtml(p.o)}</textarea>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 font-bold mb-1">Diseño Metodológico</label>
                        <input id="tk-in-design" type="text" value="${escapeHtml(p.design)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 font-bold mb-1">Hospital / Institución y Año</label>
                        <input id="tk-in-place" type="text" value="${escapeHtml(p.placeAndYear)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white" />
                    </div>
                </div>

                <button
                    type="button"
                    id="btn-tk-build-pico"
                    class="w-full py-2.5 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                >
                    Actualizar Matriz PICO, Objetivos e Hipótesis →
                </button>
            </div>

            <!-- Resultado Generado: Título, Pregunta, Objetivos e Hipótesis -->
            <div class="lg:col-span-7 bg-[#06090e] border border-primary/30 rounded-2xl p-5 space-y-4">
                <div class="p-3.5 rounded-xl bg-[#0c1118] border border-primary/40 space-y-1">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                        TÍTULO OFICIAL PROPUESTO PARA EL ANTEPROYECTO
                    </span>
                    <p class="text-sm font-extrabold text-white leading-relaxed">
                        ${escapeHtml(out.thesisTitle)}
                    </p>
                </div>

                <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high space-y-1">
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                        PREGUNTA DE INVESTIGACIÓN ESTRUCTURADA (PICO)
                    </span>
                    <p class="text-xs text-gray-200 leading-relaxed">
                        ${escapeHtml(out.question)}
                    </p>
                </div>

                <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high space-y-2">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                        OBJETIVO GENERAL Y OBJETIVOS ESPECÍFICOS (TAXONOMÍA DE BLOOM)
                    </span>
                    <p class="text-xs text-white">
                        <strong class="text-secondary">Objetivo General:</strong> ${escapeHtml(out.generalObjective)}
                    </p>
                    <div class="space-y-1 pt-1 border-t border-surface-high text-xs text-gray-300">
                        ${out.specificObjectives.map((obj) => `<p>${escapeHtml(obj)}</p>`).join("")}
                    </div>
                </div>

                <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high space-y-1.5 text-xs">
                    <span class="text-[10px] font-mono uppercase text-warning font-extrabold block">
                        SISTEMA DE HIPÓTESIS ESTADÍSTICAS (H₁ Y H₀)
                    </span>
                    <p class="text-gray-200">${escapeHtml(out.hypothesisH1)}</p>
                    <p class="text-gray-400">${escapeHtml(out.hypothesisH0)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderSampleSizeCalculatorTab() {
    const sp = toolkitState.sampleParams;
    const res = toolkitState.sampleResult || calculateSampleSize(sp);

    return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-6 bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-4">
                <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                    CONFIGURACIÓN BIOESTADÍSTICA DEL UNIVERSO Y ERROR MUESTRAL
                </span>

                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        1. Modalidad de Cálculo Muestral
                    </label>
                    <select id="tk-sp-mode" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-bold">
                        <option value="FINITE" ${sp.mode === "FINITE" ? "selected" : ""}>Población Finita Conocida (N de historias clínicas / pacientes)</option>
                        <option value="INFINITE" ${sp.mode === "INFINITE" ? "selected" : ""}>Población Infinita o Desconocida (Cochran n₀)</option>
                        <option value="TWO_GROUPS" ${sp.mode === "TWO_GROUPS" ? "selected" : ""}>Comparación de 2 Proporciones (Casos y Controles / Cohortes)</option>
                    </select>
                </div>

                ${
                    sp.mode === "TWO_GROUPS"
                        ? `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Proporción Grupo Expuesto (p₁)</label>
                            <input id="tk-sp-p1" type="number" step="0.01" min="0.01" max="0.99" value="${sp.pGroup1}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                        </div>
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Proporción Grupo Control (p₂)</label>
                            <input id="tk-sp-p2" type="number" step="0.01" min="0.01" max="0.99" value="${sp.pGroup2}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                        </div>
                    </div>
                `
                        : `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Población Universo (N)</label>
                            <input id="tk-sp-n" type="number" min="10" value="${sp.populationN}" ${sp.mode === "INFINITE" ? "disabled" : ""} class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                        </div>
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Nivel de Confianza (Z)</label>
                            <select id="tk-sp-z" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono">
                                <option value="1.96" ${Number(sp.confidenceZ) === 1.96 ? "selected" : ""}>95% (Z = 1.96) • Estándar OMS</option>
                                <option value="2.576" ${Number(sp.confidenceZ) === 2.576 ? "selected" : ""}>99% (Z = 2.58) • Alta precisión</option>
                                <option value="1.645" ${Number(sp.confidenceZ) === 1.645 ? "selected" : ""}>90% (Z = 1.645) • Exploratorio</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Prevalencia Esperada (p)</label>
                            <input id="tk-sp-p" type="number" step="0.01" min="0.01" max="0.99" value="${sp.expectedPrevalenceP}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                        </div>
                        <div>
                            <label class="block text-xs font-mono text-gray-300 font-bold mb-1">Margen de Error (e)</label>
                            <input id="tk-sp-e" type="number" step="0.01" min="0.01" max="0.20" value="${sp.marginErrorE}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                        </div>
                    </div>
                `
                }

                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        Porcentaje Estimado de Pérdidas / Historias Incompletas (%)
                    </label>
                    <input id="tk-sp-attrition" type="number" min="0" max="40" value="${sp.attritionRatePct}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-mono" />
                </div>

                <button
                    type="button"
                    id="btn-tk-run-sample"
                    class="w-full py-2.5 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    Recalcular Tamaño Muestral Exacto →
                </button>
            </div>

            <div class="lg:col-span-6 bg-[#06090e] border border-secondary/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div class="space-y-4">
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                        DICTAMEN BIOESTADÍSTICO DE TAMAÑO MUESTRAL
                    </span>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div class="p-4 rounded-xl bg-[#0c1118] border border-primary/40">
                            <span class="text-[10px] font-mono uppercase text-gray-400 block">Muestra Mínima Neta (n)</span>
                            <span class="text-3xl font-mono font-extrabold text-primary mt-1 block">${res.baseSampleN}</span>
                            <span class="text-[11px] text-gray-400">Unidades de análisis requeridas</span>
                        </div>

                        <div class="p-4 rounded-xl bg-[#0c1118] border border-secondary/50">
                            <span class="text-[10px] font-mono uppercase text-gray-400 block">Muestra Ajustada (+${res.attritionRatePct}% Pérdidas)</span>
                            <span class="text-3xl font-mono font-extrabold text-secondary mt-1 block">${res.adjustedSampleN}</span>
                            <span class="text-[11px] text-gray-400">Meta recomendada de recolección</span>
                        </div>
                    </div>

                    <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high text-xs space-y-1.5">
                        <div>
                            <strong class="text-primary font-mono">Fórmula Aplicada:</strong>
                            <span class="font-mono text-gray-200 block mt-0.5">${escapeHtml(res.formulaUsed)}</span>
                        </div>
                        <div class="pt-1 border-t border-surface-high text-gray-300">
                            <strong class="text-secondary">Párrafo Listo para Metodología de Tesis:</strong>
                            <p class="mt-0.5 leading-relaxed">${escapeHtml(res.technicalExplanation)} Considerando una tasa prevista de pérdidas o registros clínicos incompletos del ${res.attritionRatePct}%, la muestra final ajustada corresponde a ${res.adjustedSampleN} sujetos.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderVariablesMatrixTab() {
    const vars = toolkitState.variablesMatrix;

    return `
        <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                        CUADRO DE OPERACIONALIZACIÓN DE VARIABLES (FORMATO TRIBUNAL)
                    </span>
                    <p class="text-xs text-gray-400">
                        Sincronizado automáticamente con tu Pregunta PICO. Puedes añadir variables adicionales para tu protocolo.
                    </p>
                </div>
                <button
                    type="button"
                    id="btn-tk-regenerate-vars"
                    class="px-3.5 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-[#06090e] text-xs font-mono font-extrabold transition-all"
                >
                    ↻ Sincronizar con PICO Actual
                </button>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-surface-high bg-[#06090e]">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-[#0c1118] border-b border-surface-high font-mono text-[10px] uppercase text-primary">
                            <th class="p-3">Tipo de Variable</th>
                            <th class="p-3">Variable</th>
                            <th class="p-3">Dimensión</th>
                            <th class="p-3">Indicador Clínico</th>
                            <th class="p-3">Escala de Medición</th>
                            <th class="p-3">Instrumento / Fuente</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-high text-gray-200">
                        ${vars
                            .map(
                                (v) => `
                            <tr class="hover:bg-[#0c1118]/60">
                                <td class="p-3 font-mono font-bold text-secondary">${escapeHtml(v.tipo)}</td>
                                <td class="p-3 font-bold text-white">${escapeHtml(v.nombre)}</td>
                                <td class="p-3 text-gray-300">${escapeHtml(v.dimension)}</td>
                                <td class="p-3 text-gray-300">${escapeHtml(v.indicador)}</td>
                                <td class="p-3 font-mono text-[11px] text-primary">${escapeHtml(v.escala)}</td>
                                <td class="p-3 text-gray-400">${escapeHtml(v.instrumento)}</td>
                            </tr>
                        `
                            )
                            .join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSpssAndPrismaTab() {
    const cfg = toolkitState.spssAdvisorConfig;
    const recommendation = recommendStatisticalTest(cfg);
    const pf = toolkitState.prismaFlow;

    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- ASESOR DE PRUEBAS ESTADÍSTICAS EN SPSS / R-STUDIO -->
            <div class="bg-[#06090e] border border-primary/30 rounded-2xl p-5 space-y-4">
                <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                    ÁRBOL DE DECISIÓN ESTADÍSTICA PARA SPSS / R-STUDIO
                </span>

                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            1. ¿Qué deseas demostrar con tus variables principales?
                        </label>
                        <select id="tk-spss-obj" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2.5 text-xs text-white font-bold">
                            <option value="ASOCIACION_CATEGORICA" ${cfg.studyObjective === "ASOCIACION_CATEGORICA" ? "selected" : ""}>Asociar 2 Variables Cualitativas/Categóricas (Ej: Factor de Riesgo vs Enfermedad)</option>
                            <option value="COMPARAR_2_MEDIAS" ${cfg.studyObjective === "COMPARAR_2_MEDIAS" ? "selected" : ""}>Comparar Variable Numérica entre 2 Grupos (Ej: Presión Arterial en Grupo A vs B)</option>
                            <option value="COMPARAR_3_MAS_GRUPOS" ${cfg.studyObjective === "COMPARAR_3_MAS_GRUPOS" ? "selected" : ""}>Comparar Variable Numérica en 3 o más Grupos</option>
                            <option value="CORRELACION_NUMERICA" ${cfg.studyObjective === "CORRELACION_NUMERICA" ? "selected" : ""}>Correlacionar 2 Variables Numéricas / Puntajes de Escalas</option>
                            <option value="PRUEBA_DIAGNOSTICA" ${cfg.studyObjective === "PRUEBA_DIAGNOSTICA" ? "selected" : ""}>Validar una Prueba Diagnóstica o Escala Pronóstica (Curva ROC)</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 font-bold mb-1">Tamaño Muestra (n)</label>
                            <input id="tk-spss-n" type="number" min="5" value="${cfg.sampleSizeN}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white font-mono" />
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 font-bold mb-1">Distribución</label>
                            <select id="tk-spss-dist" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white">
                                <option value="NORMAL" ${cfg.distribution === "NORMAL" ? "selected" : ""}>Normal (Paramétrica)</option>
                                <option value="NO_NORMAL" ${cfg.distribution === "NO_NORMAL" ? "selected" : ""}>No Normal (Asimétrica)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 font-bold mb-1">Tipo de Medición</label>
                            <select id="tk-spss-paired" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white">
                                <option value="false" ${!cfg.pairedSamples ? "selected" : ""}>Grupos Independientes</option>
                                <option value="true" ${cfg.pairedSamples ? "selected" : ""}>Pre-Test / Post-Test</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="p-4 rounded-xl bg-[#0c1118] border border-surface-high space-y-2 text-xs">
                    <div>
                        <strong class="text-primary font-mono">1. Prueba de Normalidad:</strong>
                        <p class="text-gray-300 mt-0.5">${escapeHtml(recommendation.normalityTest)}</p>
                    </div>
                    <div>
                        <strong class="text-secondary font-mono">2. Prueba de Hipótesis Recomendada:</strong>
                        <p class="text-white font-bold mt-0.5">${escapeHtml(recommendation.primaryTest)}</p>
                    </div>
                    <div>
                        <strong class="text-warning font-mono">3. Fuerza de Asociación / Efecto:</strong>
                        <p class="text-gray-300 mt-0.5">${escapeHtml(recommendation.effectSizeMeasure)}</p>
                    </div>
                    <div class="pt-1 border-t border-surface-high">
                        <strong class="text-primary font-mono">Ruta Exacta de Clics en IBM SPSS:</strong>
                        <p class="text-gray-300 font-mono text-[11px] mt-0.5">${escapeHtml(recommendation.spssRoute)}</p>
                    </div>
                </div>
            </div>

            <!-- CALCULADORA DE FLUJOGRAMA PRISMA 2020 -->
            <div class="bg-[#06090e] border border-secondary/30 rounded-2xl p-5 space-y-4">
                <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                    CONSTRUCTOR DE FLUJOGRAMA PRISMA 2020 (REVISIÓN SISTEMÁTICA)
                </span>

                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="p-3 rounded-xl bg-[#0c1118] border border-surface-high">
                        <span class="text-[10px] font-mono text-gray-400 uppercase block">1. Identificación</span>
                        <span class="text-base font-extrabold text-white font-mono">
                            ${pf.identificadosPubMed + pf.identificadosScopusScielo} artículos
                        </span>
                        <span class="text-[11px] text-gray-400 block">PubMed (${pf.identificadosPubMed}) + Scopus/SciELO (${pf.identificadosScopusScielo})</span>
                    </div>
                    <div class="p-3 rounded-xl bg-[#0c1118] border border-surface-high">
                        <span class="text-[10px] font-mono text-gray-400 uppercase block">2. Cribado (Sin duplicados)</span>
                        <span class="text-base font-extrabold text-primary font-mono">
                            ${pf.identificadosPubMed + pf.identificadosScopusScielo - pf.duplicadosEliminados} registros
                        </span>
                        <span class="text-[11px] text-gray-400 block">-${pf.duplicadosEliminados} duplicados removidos en Zotero</span>
                    </div>
                    <div class="p-3 rounded-xl bg-[#0c1118] border border-surface-high">
                        <span class="text-[10px] font-mono text-gray-400 uppercase block">3. Elegibilidad (Texto Completo)</span>
                        <span class="text-base font-extrabold text-warning font-mono">
                            ${pf.textosCompletosEvaluados} estudios
                        </span>
                        <span class="text-[11px] text-gray-400 block">Excluidos por criterios PICO: ${pf.excluidosCriterios}</span>
                    </div>
                    <div class="p-3 rounded-xl bg-[#0c1118] border border-secondary/50">
                        <span class="text-[10px] font-mono text-secondary uppercase font-bold block">4. Inclusión Final</span>
                        <span class="text-base font-extrabold text-secondary font-mono">
                            ${pf.incluidosSintesisFinal} artículos incluidos
                        </span>
                        <span class="text-[11px] text-gray-300 block">Aptos para síntesis cualitativa/metaanálisis</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderVancouverAndTemplatesTab() {
    const vf = toolkitState.vancouverForm;
    const previewCite = formatVancouverCitation(vf);

    return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- FORMATEADOR AUTOMÁTICO DE NORMAS VANCOUVER (ICMJE) -->
            <div class="lg:col-span-6 bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-3.5">
                <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                    GENERADOR AUTOMÁTICO DE CITAS EN NORMAS VANCOUVER (ICMJE)
                </span>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-300 font-bold mb-1">Tipo de Fuente</label>
                        <select id="tk-vc-type" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white font-bold">
                            <option value="JOURNAL" ${vf.sourceType === "JOURNAL" ? "selected" : ""}>Artículo de Revista (PubMed / SciELO)</option>
                            <option value="GPC_MSP" ${vf.sourceType === "GPC_MSP" ? "selected" : ""}>Guía de Práctica Clínica (GPC - MSP)</option>
                            <option value="BOOK" ${vf.sourceType === "BOOK" ? "selected" : ""}>Libro o Tratado Médico</option>
                            <option value="THESIS" ${vf.sourceType === "THESIS" ? "selected" : ""}>Tesis de Repositorio Universitario</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-300 font-bold mb-1">Autores (Apellido Iniciales)</label>
                        <input id="tk-vc-authors" type="text" value="${escapeHtml(vf.authors)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white" />
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-mono text-gray-300 font-bold mb-1">Título del Artículo / Guía / Libro</label>
                    <input id="tk-vc-title" type="text" value="${escapeHtml(vf.title)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white" />
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div class="col-span-2">
                        <label class="block text-[10px] font-mono text-gray-400 mb-1">Revista / Editorial</label>
                        <input id="tk-vc-journal" type="text" value="${escapeHtml(vf.journalOrPublisher)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white" />
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 mb-1">Año</label>
                        <input id="tk-vc-year" type="text" value="${escapeHtml(vf.year)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white font-mono" />
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 mb-1">Páginas</label>
                        <input id="tk-vc-pages" type="text" value="${escapeHtml(vf.pages)}" class="w-full bg-[#0c1118] border border-surface-high rounded-xl p-2 text-xs text-white font-mono" />
                    </div>
                </div>

                <div class="p-3 rounded-xl bg-[#0c1118] border border-primary/40 text-xs">
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold block mb-1">
                        Vista Previa en Formato Vancouver:
                    </span>
                    <p class="text-white leading-relaxed">${escapeHtml(previewCite)}</p>
                </div>

                <button
                    type="button"
                    id="btn-tk-add-vancouver"
                    class="w-full py-2.5 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                >
                    + Añadir Referencia a mi Bibliografía Vancouver
                </button>

                <div class="space-y-1.5 pt-2">
                    ${toolkitState.vancouverBibliography
                        .map(
                            (item, idx) => `
                        <div class="p-2.5 rounded-lg bg-[#0c1118] border border-surface-high text-[11px] text-gray-300">
                            <strong class="text-secondary font-mono">[${idx + 1}]</strong> ${escapeHtml(item)}
                        </div>
                    `
                        )
                        .join("")}
                </div>
            </div>

            <!-- BÓVEDA DE PLANTILLAS OFICIALES (assets/9-multimedia-titulacion/plantillas-tesis/) -->
            <div class="lg:col-span-6 bg-[#06090e] border border-secondary/30 rounded-2xl p-5 space-y-3.5">
                <span class="text-[10px] font-mono uppercase text-secondary font-extrabold block">
                    BÓVEDA MULTIMEDIA • ${TOOLKIT_ASSETS.templatesPath}
                </span>

                <div class="space-y-2.5">
                    ${METHODOLOGY_TEMPLATES_CATALOG.map(
                        (tpl) => `
                        <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high flex items-center justify-between gap-3">
                            <div>
                                <span class="text-[10px] font-mono text-primary font-bold uppercase">${escapeHtml(tpl.categoria)} • ${tpl.paginas} págs.</span>
                                <h4 class="text-xs font-extrabold text-white mt-0.5">${escapeHtml(tpl.titulo)}</h4>
                            </div>
                            <button
                                type="button"
                                data-tk-open-tpl="${tpl.id}"
                                class="px-3.5 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-[#06090e] font-mono font-extrabold text-xs shrink-0 transition-all"
                            >
                                Abrir Guía
                            </button>
                        </div>
                    `
                    ).join("")}
                </div>

                ${
                    toolkitState.activeTemplatePreview
                        ? `
                    <div class="p-4 rounded-xl bg-[#0c1118] border-2 border-primary/50 space-y-2 mt-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-mono font-extrabold text-primary">
                                ${escapeHtml(toolkitState.activeTemplatePreview.titulo)}
                            </span>
                            <button type="button" id="btn-tk-close-tpl-preview" class="text-xs text-gray-400 hover:text-white">✕</button>
                        </div>
                        <ul class="space-y-1.5 text-xs text-gray-300">
                            ${toolkitState.activeTemplatePreview.puntosClave
                                .map((pt) => `<li>• ${escapeHtml(pt)}</li>`)
                                .join("")}
                        </ul>
                    </div>
                `
                        : ""
                }
            </div>
        </div>
    `;
}

// ============================================================================
// 9. ENLACE DE EVENTOS DEL DOM Y PERSISTENCIA LOCAL
// ============================================================================

function bindToolkitEvents(mount) {
    mount.querySelector("#tk-career-selector")?.addEventListener("change", (e) => {
        const newCareer = normalizeCareerId(e.target.value);
        toolkitState.selectedCareer = newCareer;
        if (CAREER_PICO_PRESETS[newCareer]) {
            toolkitState.picoData = { ...CAREER_PICO_PRESETS[newCareer] };
        }
        toolkitState.variablesMatrix = buildDefaultVariableMatrix(newCareer, toolkitState.picoData);
        saveToolkitLocalState();
        renderThesisToolkitUI();
    });

    mount.querySelector("#btn-tk-load-preset")?.addEventListener("click", () => {
        const preset = CAREER_PICO_PRESETS[toolkitState.selectedCareer] || CAREER_PICO_PRESETS.medicina;
        toolkitState.picoData = { ...preset };
        toolkitState.variablesMatrix = buildDefaultVariableMatrix(
            toolkitState.selectedCareer,
            toolkitState.picoData
        );
        saveToolkitLocalState();
        renderThesisToolkitUI();
    });

    mount.querySelector("#btn-tk-export-protocol")?.addEventListener("click", () => {
        exportThesisProtocolReport();
    });

    mount.querySelectorAll("[data-tk-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            toolkitState.activeTab = btn.dataset.tkTab;
            saveToolkitLocalState();
            renderThesisToolkitUI();
        });
    });

    // Eventos Pestaña 1: PICO
    mount.querySelector("#btn-tk-build-pico")?.addEventListener("click", () => {
        toolkitState.picoData = {
            p: mount.querySelector("#tk-in-p")?.value || "",
            i: mount.querySelector("#tk-in-i")?.value || "",
            c: mount.querySelector("#tk-in-c")?.value || "",
            o: mount.querySelector("#tk-in-o")?.value || "",
            design: mount.querySelector("#tk-in-design")?.value || "",
            placeAndYear: mount.querySelector("#tk-in-place")?.value || ""
        };
        toolkitState.variablesMatrix = buildDefaultVariableMatrix(
            toolkitState.selectedCareer,
            toolkitState.picoData
        );
        saveToolkitLocalState();
        renderThesisToolkitUI();
    });

    // Eventos Pestaña 2: Calculadora de Muestra
    mount.querySelector("#tk-sp-mode")?.addEventListener("change", (e) => {
        toolkitState.sampleParams.mode = e.target.value;
        calculateSampleSize(toolkitState.sampleParams);
        renderThesisToolkitUI();
    });

    mount.querySelector("#btn-tk-run-sample")?.addEventListener("click", () => {
        const mode = mount.querySelector("#tk-sp-mode")?.value || toolkitState.sampleParams.mode;
        const nextParams = {
            ...toolkitState.sampleParams,
            mode,
            populationN: Number(mount.querySelector("#tk-sp-n")?.value) || toolkitState.sampleParams.populationN,
            confidenceZ: Number(mount.querySelector("#tk-sp-z")?.value) || toolkitState.sampleParams.confidenceZ,
            expectedPrevalenceP:
                Number(mount.querySelector("#tk-sp-p")?.value) || toolkitState.sampleParams.expectedPrevalenceP,
            marginErrorE:
                Number(mount.querySelector("#tk-sp-e")?.value) || toolkitState.sampleParams.marginErrorE,
            attritionRatePct: Number(mount.querySelector("#tk-sp-attrition")?.value ?? 10),
            pGroup1: Number(mount.querySelector("#tk-sp-p1")?.value) || toolkitState.sampleParams.pGroup1,
            pGroup2: Number(mount.querySelector("#tk-sp-p2")?.value) || toolkitState.sampleParams.pGroup2
        };
        calculateSampleSize(nextParams);
        renderThesisToolkitUI();
    });

    // Eventos Pestaña 3: Matriz de Variables
    mount.querySelector("#btn-tk-regenerate-vars")?.addEventListener("click", () => {
        generateVariableMatrix(toolkitState.selectedCareer);
        renderThesisToolkitUI();
    });

    // Eventos Pestaña 4: SPSS Advisor
    ["#tk-spss-obj", "#tk-spss-n", "#tk-spss-dist", "#tk-spss-paired"].forEach((sel) => {
        mount.querySelector(sel)?.addEventListener("change", () => {
            recommendStatisticalTest({
                studyObjective: mount.querySelector("#tk-spss-obj")?.value || "ASOCIACION_CATEGORICA",
                sampleSizeN: Number(mount.querySelector("#tk-spss-n")?.value) || 120,
                distribution: mount.querySelector("#tk-spss-dist")?.value || "NORMAL",
                pairedSamples: mount.querySelector("#tk-spss-paired")?.value === "true"
            });
            renderThesisToolkitUI();
        });
    });

    // Eventos Pestaña 5: Vancouver y Plantillas
    mount.querySelector("#btn-tk-add-vancouver")?.addEventListener("click", () => {
        toolkitState.vancouverForm = {
            sourceType: mount.querySelector("#tk-vc-type")?.value || "JOURNAL",
            authors: mount.querySelector("#tk-vc-authors")?.value || "",
            title: mount.querySelector("#tk-vc-title")?.value || "",
            journalOrPublisher: mount.querySelector("#tk-vc-journal")?.value || "",
            year: mount.querySelector("#tk-vc-year")?.value || "2026",
            volume: toolkitState.vancouverForm.volume || "47",
            issue: toolkitState.vancouverForm.issue || "2",
            pages: mount.querySelector("#tk-vc-pages")?.value || "1-10",
            doiOrUrl: toolkitState.vancouverForm.doiOrUrl || ""
        };
        const formatted = formatVancouverCitation(toolkitState.vancouverForm);
        toolkitState.vancouverBibliography.push(formatted);
        saveToolkitLocalState();
        renderThesisToolkitUI();
    });

    mount.querySelectorAll("[data-tk-open-tpl]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openMethodologyTemplates(btn.dataset.tkOpenTpl);
        });
    });

    mount.querySelector("#btn-tk-close-tpl-preview")?.addEventListener("click", () => {
        toolkitState.activeTemplatePreview = null;
        renderThesisToolkitUI();
    });

    mount.querySelectorAll("[data-tk-nav]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetView = btn.dataset.tkNav;
            if (typeof window.switchView === "function") {
                window.switchView(targetView);
            } else {
                document.querySelector(`[data-target="${targetView}"], [data-view="${targetView}"]`)?.click();
            }
        });
    });
}

function loadToolkitLocalState() {
    try {
        const raw = localStorage.getItem("makai_thesis_toolkit_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);

        if (parsed.selectedCareer) {
            toolkitState.selectedCareer = normalizeCareerId(parsed.selectedCareer);
        }
        if (parsed.activeTab) toolkitState.activeTab = parsed.activeTab;
        if (parsed.picoData) toolkitState.picoData = { ...toolkitState.picoData, ...parsed.picoData };
        if (parsed.sampleParams) {
            toolkitState.sampleParams = { ...toolkitState.sampleParams, ...parsed.sampleParams };
        }
        if (Array.isArray(parsed.variablesMatrix) && parsed.variablesMatrix.length > 0) {
            toolkitState.variablesMatrix = parsed.variablesMatrix;
        }
        if (Array.isArray(parsed.vancouverBibliography) && parsed.vancouverBibliography.length > 0) {
            toolkitState.vancouverBibliography = parsed.vancouverBibliography;
        }
    } catch (e) {}
}

function saveToolkitLocalState() {
    try {
        localStorage.setItem(
            "makai_thesis_toolkit_v1",
            JSON.stringify({
                selectedCareer: toolkitState.selectedCareer,
                activeTab: toolkitState.activeTab,
                picoData: toolkitState.picoData,
                sampleParams: toolkitState.sampleParams,
                variablesMatrix: toolkitState.variablesMatrix,
                vancouverBibliography: toolkitState.vancouverBibliography.slice(0, 20)
            })
        );
    } catch (e) {}
}

function capitalizeFirst(str = "") {
    const s = String(str).trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
