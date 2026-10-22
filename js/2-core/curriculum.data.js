// ============================================================================
// ARCHIVO: js/2-core/curriculum.data.js
// DESCRIPCIÓN: Catálogo Curricular Maestro (4 Carreras CACES + 11 Carreras de
//              Salud por Semestres), Rutas de Bóveda Multimedia, Planes y
//              Banco Semilla de Reactivos Clínicos (window.makaiData).
// PROYECTO: Makai Academy (Proyecto ALICIZATION) - makai-academy-f8039
// ============================================================================

import { isMasterAdmin } from "./state.store.js";

// ============================================================================
// 1. CATÁLOGO OFICIAL DE LAS 4 CARRERAS DE HABILITACIÓN CACES
// ============================================================================
export const CACES_CAREERS = [
    {
        id: "medicina",
        nombre: "Medicina (Habilitación CACES)",
        nombreCorto: "Medicina",
        activa: true,
        icono: "stethoscope",
        totalPreguntasEstadar: 100,
        tiempoMinutosEstandar: 150,
        materias: [
            "Medicina Interna",
            "Pediatría",
            "Ginecología y Obstetricia",
            "Cirugía General",
            "Salud Pública y Bioética",
            "Salud Mental y Psiquiatría",
            "Urgencias y Emergencias"
        ]
    },
    {
        id: "enfermeria",
        nombre: "Enfermería (Habilitación CACES)",
        nombreCorto: "Enfermería",
        activa: true,
        icono: "medical_services",
        totalPreguntasEstadar: 100,
        tiempoMinutosEstandar: 150,
        materias: [
            "Fundamentos de Enfermería",
            "Enfermería Clínico-Quirúrgica",
            "Enfermería Materno-Infantil",
            "Enfermería Comunitaria y Salud Pública",
            "Administración y Gestión en Enfermería",
            "Urgencias y Cuidados Críticos"
        ]
    },
    {
        id: "odontologia",
        nombre: "Odontología (Habilitación CACES)",
        nombreCorto: "Odontología",
        activa: true,
        icono: "dentistry",
        totalPreguntasEstadar: 100,
        tiempoMinutosEstandar: 150,
        materias: [
            "Patología Bucal y Diagnóstico",
            "Endodoncia y Operatoria Dental",
            "Periodoncia y Cirugía Bucal",
            "Rehabilitación Oral y Prótesis",
            "Odontopediatría y Ortodoncia",
            "Farmacología y Bioseguridad"
        ]
    },
    {
        id: "obstetricia",
        nombre: "Obstetricia (Habilitación CACES)",
        nombreCorto: "Obstetricia",
        activa: true,
        icono: "pregnant_woman",
        totalPreguntasEstadar: 100,
        tiempoMinutosEstandar: 150,
        materias: [
            "Obstetricia Fisiológica y Alto Riesgo",
            "Ginecología y Salud Sexual",
            "Neonatología y Perinatología",
            "Salud Pública y Epidemiología",
            "Farmacología Obstétrica"
        ]
    }
];

// ============================================================================
// 2. CATÁLOGO DE LAS 11 CARRERAS DE CIENCIAS DE LA SALUD (MALLA UNIVERSITARIA)
// ============================================================================
export const HEALTH_CAREERS_11 = [
    {
        id: "medicina",
        nombre: "1. Medicina Humana",
        activa: true,
        habilitacionCaces: true,
        materias: [
            "Anatomía e Histología",
            "Fisiología Humana",
            "Bioquímica y Biología Molecular",
            "Microbiología y Parasitología",
            "Farmacología Básica y Clínica",
            "Fisiopatología y Semiología",
            "Medicina Interna",
            "Cirugía General",
            "Pediatría y Neonatología",
            "Ginecología y Obstetricia",
            "Salud Pública, Epidemiología y Bioética",
            "Salud Mental y Psiquiatría",
            "Urgencias, Trauma y Cuidados Críticos"
        ]
    },
    {
        id: "enfermeria",
        nombre: "2. Enfermería",
        activa: true,
        habilitacionCaces: true,
        materias: [
            "Morfofunción y Ciencias Básicas",
            "Fundamentos de Enfermería",
            "Farmacología para Enfermería",
            "Enfermería Clínico-Quirúrgica",
            "Enfermería Materno-Infantil",
            "Enfermería Comunitaria y Salud Pública",
            "Administración y Gestión en Enfermería",
            "Urgencias y Cuidados Críticos"
        ]
    },
    {
        id: "odontologia",
        nombre: "3. Odontología",
        activa: true,
        habilitacionCaces: true,
        materias: [
            "Anatomía de Cabeza y Cuello",
            "Biomateriales Dentales",
            "Patología Bucal y Diagnóstico",
            "Endodoncia y Operatoria Dental",
            "Periodoncia y Cirugía Bucal",
            "Rehabilitación Oral y Prótesis",
            "Odontopediatría y Ortodoncia",
            "Farmacología y Bioseguridad"
        ]
    },
    {
        id: "obstetricia",
        nombre: "4. Obstetricia",
        activa: true,
        habilitacionCaces: true,
        materias: [
            "Anatomía y Fisiología Reproductiva",
            "Obstetricia Fisiológica y Alto Riesgo",
            "Ginecología y Salud Sexual",
            "Neonatología y Perinatología",
            "Salud Pública y Epidemiología",
            "Farmacología Obstétrica",
            "Clave Roja, Azul y Amarilla (MSP)"
        ]
    },
    {
        id: "nutricion",
        nombre: "5. Nutrición y Dietética",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Bioquímica de la Nutrición",
            "Evaluación del Estado Nutricional",
            "Dietoterapia del Adulto y Pediátrica",
            "Nutrición Clínica y Soporte Metabólico",
            "Bromatología y Tecnología de Alimentos",
            "Nutrición Comunitaria y Salud Pública"
        ]
    },
    {
        id: "fisioterapia",
        nombre: "6. Fisioterapia y Rehabilitación",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Anatomía Funcional y Biomecánica",
            "Cinesiterapia y Valoración Muscular",
            "Agentes Físicos y Electroterapia",
            "Rehabilitación Traumatológica y Deportiva",
            "Fisioterapia Neurológica",
            "Fisioterapia Cardiorrespiratoria"
        ]
    },
    {
        id: "laboratorio_clinico",
        nombre: "7. Laboratorio Clínico",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Hematología y Coagulación",
            "Química Clínica y Enzimología",
            "Bacteriología y Virología Diagnóstica",
            "Parasitología y Micología Clínica",
            "Inmunología y Banco de Sangre",
            "Biología Molecular y Control de Calidad"
        ]
    },
    {
        id: "imagenologia",
        nombre: "8. Imagenología y Radiología",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Física Radiológica y Radioprotección",
            "Anatomía Radiológica Convencional",
            "Tomografía Computarizada (TC)",
            "Resonancia Magnética Nuclear (RMN)",
            "Ecografía General y Doppler",
            "Medios de Contraste y Urgencias Radiológicas"
        ]
    },
    {
        id: "psicologia_clinica",
        nombre: "9. Psicología Clínica",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Neuroanatomía y Psicofisiología",
            "Psicopatología y Diagnóstico DSM-5 / CIE-11",
            "Evaluación y Psicometría Clínica",
            "Psicoterapia Cognitivo-Conductual e Intervención en Crisis",
            "Psicofarmacología Clínica",
            "Salud Mental Comunitaria y Bioética"
        ]
    },
    {
        id: "bioquimica_farmacia",
        nombre: "10. Bioquímica y Farmacia",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Química Orgánica y Analítica",
            "Farmacología y Farmacocinética",
            "Farmacia Hospitalaria y Atención Farmacéutica",
            "Toxicología Clínica y Forense",
            "Tecnología Farmacéutica y Biofarmacia",
            "Legislación Farmacéutica y Bioseguridad"
        ]
    },
    {
        id: "atencion_prehospitalaria",
        nombre: "11. Emergencias Médicas / APH",
        activa: true,
        habilitacionCaces: false,
        materias: [
            "Soporte Vital Básico y Avanzado (BLS / ACLS)",
            "Manejo Prehospitalario del Trauma (PHTLS)",
            "Emergencias Clínicas y Toxicológicas",
            "Emergencias Gineco-Obstétricas y Pediátricas (PALS)",
            "Cinemática del Trauma y Extricación",
            "Gestión de Desastres y Triaje START"
        ]
    }
];

// ============================================================================
// 3. NIVELES ACADÉMICOS Y SEMESTRES OFICIALES
// ============================================================================
export const ACADEMIC_LEVELS = [
    { id: "caces_oficial", nombre: "Examen Oficial CACES", orden: 0, ambito: "caces" },
    { id: "preuniversitario", nombre: "Preuniversitario", orden: 1, ambito: "carrera" },
    { id: "nivelacion", nombre: "Nivelación Académica", orden: 2, ambito: "carrera" },
    { id: "semestre_1", nombre: "1er Semestre (Ciencias Básicas)", orden: 3, ambito: "carrera" },
    { id: "semestre_2", nombre: "2do Semestre (Morfofunción)", orden: 4, ambito: "carrera" },
    { id: "semestre_3", nombre: "3er Semestre (Fisiopatología / Farmacología)", orden: 5, ambito: "carrera" },
    { id: "semestre_4", nombre: "4to Semestre (Semiología / Diagnóstico)", orden: 6, ambito: "carrera" },
    { id: "semestre_5", nombre: "5to Semestre (Clínicas I)", orden: 7, ambito: "carrera" },
    { id: "semestre_6", nombre: "6to Semestre (Clínicas II)", orden: 8, ambito: "carrera" },
    { id: "semestre_7", nombre: "7mo Semestre (Quirúrgicas / Especialidades)", orden: 9, ambito: "carrera" },
    { id: "semestre_8", nombre: "8vo Semestre (Materno-Infantil / Pediatría)", orden: 10, ambito: "carrera" },
    { id: "semestre_9", nombre: "9no Semestre (Salud Pública / Gestión)", orden: 11, ambito: "carrera" },
    { id: "semestre_10", nombre: "10mo Semestre (Integración Clínica)", orden: 12, ambito: "carrera" },
    { id: "internado_rotativo", nombre: "Internado Rotativo", orden: 13, ambito: "carrera" }
];

// ============================================================================
// 4. MATERIAS TRANSVERSALES / UNIVERSALES DE CIENCIAS DE LA SALUD
// ============================================================================
export const UNIVERSAL_SUBJECTS = [
    "Anatomía e Histología",
    "Fisiología Humana",
    "Bioquímica y Biología Molecular",
    "Microbiología y Parasitología",
    "Farmacología Básica y Clínica",
    "Fisiopatología y Semiología",
    "Medicina Interna",
    "Cirugía General",
    "Pediatría y Neonatología",
    "Ginecología y Obstetricia",
    "Salud Pública, Epidemiología y Bioética",
    "Urgencias, Trauma y Cuidados Críticos"
];

// ============================================================================
// 5. PLANES DE SUSCRIPCIÓN Y NIVELES DE ACCESO
// ============================================================================
export const SUBSCRIPTION_PLANS = {
    basico: {
        id: "basico",
        nivelFirestore: "Básico",
        nombre: "Plan Básico Freemium",
        precioUSD: "0.00",
        limiteCasosMes: 15,
        modosPermitidos: ["tutor", "critical"]
    },
    pro_mensual: {
        id: "pro_mensual",
        nivelFirestore: "PRO",
        nombre: "Makai PRO CACES (Mensual)",
        precioUSD: "17.99",
        limiteCasosMes: Infinity,
        modosPermitidos: ["standard", "tutor", "critical"]
    },
    pro_anual: {
        id: "pro_anual",
        nivelFirestore: "PRO",
        nombre: "Makai PRO CACES (Anual)",
        precioUSD: "139.99",
        limiteCasosMes: Infinity,
        modosPermitidos: ["standard", "tutor", "critical"]
    },
    vip: {
        id: "vip",
        nivelFirestore: "VIP",
        nombre: "Mentoría Élite VIP",
        precioUSD: "49.99",
        limiteCasosMes: Infinity,
        modosPermitidos: ["standard", "tutor", "critical"]
    }
};

// ============================================================================
// 6. DICCIONARIO DE RUTAS DE LA BÓVEDA MULTIMEDIA (assets/)
// ============================================================================
export const MULTIMEDIA_VAULT_PATHS = {
    brandingLogos: "assets/1-branding/logos/",
    pagosBancarios: "assets/2-pagos-bancarios/",
    audioSistema: "assets/3-audio-sistema/",
    bancoClinico: "assets/4-banco-clinico/",
    multimedia1D: {
        root: "assets/5-multimedia-1d/",
        guiasPdf: "assets/5-multimedia-1d/guias-pdf/",
        infografias: "assets/5-multimedia-1d/infografias-y-algoritmos/",
        microVideos: "assets/5-multimedia-1d/micro-videos-1d/"
    },
    multimedia2D: "assets/6-multimedia-2d/",
    multimedia3D: "assets/7-multimedia-3d/",
    multimediaAulas: "assets/8-multimedia-aulas/"
};

// ============================================================================
// 7. BANCO SEMILLA DE CASOS CLÍNICOS (FALLBACK LOCAL Y PRUEBA INMEDIATA)
// ============================================================================
export const SEED_CASES = [
    {
        id: "seed-med-001",
        ambito: "caces",
        carrera: "medicina",
        nivel: "caces_oficial",
        materia: "Ginecología y Obstetricia",
        subtema: "Trastornos Hipertensivos del Embarazo (Clave Azul)",
        dificultad: "Alta",
        planAcceso: "Básico",
        enunciado: "Gestante de 34 semanas acude a emergencias por cefalea holocraneana intensa, escotomas centelleantes y dolor epigástrico en barra. Al examen físico: TA 165/112 mmHg en dos tomas separadas por 15 minutos, hiperreflexia rotuliana +++ y proteinuria en tirilla reactiva ++. ¿Cuál es el fármaco de primera línea para la profilaxis de convulsiones eclámpticas según la GPC del MSP?",
        opciones: {
            A: "Sulfato de magnesio (Esquema Zuspan: 4 g IV de impregnación en 20 minutos, seguido de 1 g/hora en infusión continua)",
            B: "Fenitoína sódica 15 mg/kg en infusión intravenosa continua",
            C: "Diazepam 10 mg intravenoso lento en bolo único",
            D: "Nifedipino 10 mg vía oral cada 20 minutos hasta completar 3 dosis"
        },
        respuestaCorrecta: "A",
        racional: "De acuerdo con la Guía de Práctica Clínica (GPC) del MSP de Ecuador para Trastornos Hipertensivos del Embarazo (Clave Azul), el Sulfato de Magnesio en esquema de Zuspan (4 g IV de impregnación + 1 g/h de mantenimiento) es el fármaco de elección absoluto para prevenir y tratar las convulsiones en preeclampsia con signos de gravedad."
    },
    {
        id: "seed-med-002",
        ambito: "caces",
        carrera: "medicina",
        nivel: "caces_oficial",
        materia: "Medicina Interna",
        subtema: "Cetoacidosis Diabética",
        dificultad: "Media",
        planAcceso: "Básico",
        enunciado: "Paciente masculino de 24 años con antecedente de Diabetes Mellitus tipo 1 ingresa por estupor, respiración de Kussmaul y aliento cetónico. Laboratorio: Glucemia 480 mg/dL, pH arterial 7.12, HCO3 8 mEq/L, Potasio sérico 2.9 mEq/L. Tras iniciar hidratación con solución salina isotónica al 0.9%, ¿cuál es la conducta terapéutica inmediata respecto a la insulina?",
        opciones: {
            A: "Diferir el inicio de insulina intravenosa y reponer potasio hasta alcanzar niveles séricos > 3.3 mEq/L",
            B: "Iniciar bolo inmediato de insulina cristalina 0.1 UI/kg IV simultáneamente con bicarbonato de sodio",
            C: "Administrar insulina glargina subcutánea 0.4 UI/kg y controlar potasio en 6 horas",
            D: "Cambiar inmediatamente a dextrosa al 5% en agua antes de corregir el potasio"
        },
        respuestaCorrecta: "A",
        racional: "En el manejo de la Cetoacidosis Diabética, si el potasio sérico inicial es < 3.3 mEq/L, está contraindicado iniciar insulina porque esta introduce potasio a la célula y puede desencadenar arritmias ventriculares letales o paro cardíaco. Primero se hidrata y se repone potasio hasta superar 3.3 mEq/L."
    },
    {
        id: "seed-med-003",
        ambito: "caces",
        carrera: "medicina",
        nivel: "caces_oficial",
        materia: "Cirugía General",
        subtema: "Apendicitis Aguda",
        dificultad: "Baja",
        planAcceso: "Básico",
        enunciado: "Paciente de 19 años acude por dolor abdominal que inició hace 14 horas en epigastrio y migró hacia fosa ilíaca derecha, acompañado de anorexia, náusea y alza térmica de 38.3 °C. Al examen físico presenta dolor a la descompresión brusca en el punto de McBurney y dolor en fosa ilíaca derecha al comprimir la fosa ilíaca izquierda. ¿Cómo se denomina este último signo semiológico?",
        opciones: {
            A: "Signo de Rovsing",
            B: "Signo de Blumberg",
            C: "Signo del Psoas",
            D: "Signo de Murphy"
        },
        respuestaCorrecta: "A",
        racional: "El signo de Rovsing consiste en la aparición de dolor en el cuadrante inferior derecho (fosa ilíaca derecha) al realizar presión profunda en el cuadrante inferior izquierdo, por desplazamiento retrógrado de gases en el marco cólico hacia el ciego inflamado."
    },
    {
        id: "seed-enf-001",
        ambito: "caces",
        carrera: "enfermeria",
        nivel: "caces_oficial",
        materia: "Enfermería Materno-Infantil",
        subtema: "Hemorragia Postparto (Clave Roja)",
        dificultad: "Media",
        planAcceso: "Básico",
        enunciado: "Durante el puerperio inmediato de un parto eutócico, usted identifica sangrado transvaginal abundante (> 500 mL), útero blando supraumbilical que no se contrae, FC materna de 118 lpm y TA de 88/54 mmHg. En el manejo activo y activación de Clave Roja, ¿cuál es el uterotónico de primera elección y su vía de administración inicial?",
        opciones: {
            A: "Oxitocina (10 UI intramusculares o infusión intravenosa continua diluida en cristaloide)",
            B: "Metilergonovina 0.2 mg en bolo intravenoso directo rápido",
            C: "Ácido tranexámico 2 g por vía subcutánea",
            D: "Sulfato de magnesio 4 g por vía intravenosa"
        },
        respuestaCorrecta: "A",
        racional: "La hipotonía/atonía uterina es la causa más frecuente de hemorragia postparto (HPP). Según la GPC de HPP y Clave Roja del MSP, la Oxitocina es el uterotónico de primera línea tanto en el alumbramiento dirigido (10 UI IM) como en la reanimación inicial por atonía uterina."
    },
    {
        id: "seed-odo-001",
        ambito: "caces",
        carrera: "odontologia",
        nivel: "caces_oficial",
        materia: "Endodoncia y Operatoria Dental",
        subtema: "Patología Pulpar",
        dificultad: "Media",
        planAcceso: "Básico",
        enunciado: "Paciente acude a consulta odontológica por dolor dental espontáneo, pulsátil, severo, que aumenta con el decúbito nocturno y persiste varios minutos después de retirar estímulos térmicos al frío y al calor en el órgano dental 26. Radiográficamente se observa caries profunda comunicada con cámara pulpar y espacio del ligamento periodontal normal. ¿Cuál es el diagnóstico pulpar más probable?",
        opciones: {
            A: "Pulpitis irreversible sintomática",
            B: "Pulpitis reversible",
            C: "Necrosis pulpar total",
            D: "Periodontitis apical asintomática"
        },
        respuestaCorrecta: "A",
        racional: "El dolor espontáneo, severo, pulsátil, que empeora al acostarse (decúbito) y que persiste tras retirar el estímulo térmico caracteriza clínicamente a la pulpitis irreversible sintomática, requiriendo biopulpectomía (tratamiento endodóntico)."
    },
    {
        id: "seed-obs-001",
        ambito: "caces",
        carrera: "obstetricia",
        nivel: "caces_oficial",
        materia: "Obstetricia Fisiológica y Alto Riesgo",
        subtema: "Control Prenatal y Maniobras de Leopold",
        dificultad: "Baja",
        planAcceso: "Básico",
        enunciado: "Al realizar las maniobras de Leopold en una gestante de 36 semanas de edad gestacional, usted busca determinar qué polo fetal (cefálico o pélvico) ocupa el estrecho superior de la pelvis materna y su grado de peloteo. ¿Qué maniobra de Leopold está ejecutando?",
        opciones: {
            A: "Tercera maniobra de Leopold (Maniobra de Pawlik)",
            B: "Primera maniobra de Leopold",
            C: "Segunda maniobra de Leopold",
            D: "Cuarta maniobra de Leopold"
        },
        respuestaCorrecta: "A",
        racional: "La primera maniobra evalúa el fondo uterino (situación/polo en fondo); la segunda evalúa la posición (dorso fetal); la tercera maniobra (unimanual de Pawlik) identifica la presentación fetal en el polo inferior y su movilidad/peloteo; y la cuarta evalúa el grado de encajamiento."
    }
];

// ============================================================================
// 8. OBJETO CONSOLIDADO DEL CATÁLOGO CURRICULAR
// ============================================================================
export const CURRICULUM_CATALOG = {
    cacesCareers: CACES_CAREERS,
    healthCareers11: HEALTH_CAREERS_11,
    academicLevels: ACADEMIC_LEVELS,
    universalSubjects: UNIVERSAL_SUBJECTS,
    subscriptionPlans: SUBSCRIPTION_PLANS,
    multimediaPaths: MULTIMEDIA_VAULT_PATHS
};

// ============================================================================
// 9. OBJETO GLOBAL makaiData (SINCRONIZACIÓN CON window.makaiData)
// ============================================================================
export const makaiData = {
    carreras: CACES_CAREERS,
    cacesCareers: CACES_CAREERS,
    healthCareers11: HEALTH_CAREERS_11,
    academicLevels: ACADEMIC_LEVELS,
    universalSubjects: UNIVERSAL_SUBJECTS,
    planes: SUBSCRIPTION_PLANS,
    rutasMultimedia: MULTIMEDIA_VAULT_PATHS,
    semillaCasos: SEED_CASES
};

// Exponer automáticamente en window.makaiData para compatibilidad total
if (typeof window !== "undefined") {
    window.makaiData = {
        ...(window.makaiData || {}),
        ...makaiData
    };
}

// ============================================================================
// 10. FUNCIONES UTILITARIAS Y CONSULTORES CURRICULARES
// ============================================================================

/**
 * Inicializa y garantiza que el catálogo curricular esté disponible en window.makaiData.
 * @returns {object} Catálogo makaiData completo.
 */
export function initCurriculumData() {
    if (typeof window !== "undefined") {
        window.makaiData = {
            ...(window.makaiData || {}),
            ...makaiData
        };
    }
    return makaiData;
}

/**
 * Devuelve la lista de carreras según el ámbito curricular ("caces" o "carrera").
 * @param {string} scope - "caces" (4 carreras) | "carrera" (11 carreras de salud)
 * @returns {Array}
 */
export function getCareersByScope(scope = "caces") {
    if (scope === "carrera" || scope === "all" || scope === "salud11") {
        return HEALTH_CAREERS_11;
    }
    return CACES_CAREERS;
}

/**
 * Busca la configuración completa de una carrera por su ID.
 * @param {string} careerId - Ej: "medicina", "enfermeria", "nutricion"
 * @param {string} scope - "caces" | "carrera"
 * @returns {object|null}
 */
export function getCareerById(careerId = "medicina", scope = "caces") {
    const normalizedId = String(careerId || "medicina").toLowerCase().trim();
    if (scope === "caces") {
        const cacesFound = CACES_CAREERS.find(c => c.id === normalizedId);
        if (cacesFound) return cacesFound;
    }
    return (
        HEALTH_CAREERS_11.find(c => c.id === normalizedId) ||
        CACES_CAREERS.find(c => c.id === normalizedId) ||
        null
    );
}

/**
 * Obtiene la lista de materias correspondientes a una carrera y ámbito curricular.
 * @param {string} careerId - ID de la carrera
 * @param {string} scope - "caces" | "carrera"
 * @returns {Array<string>}
 */
export function getSubjectsForCareer(careerId = "medicina", scope = "caces") {
    const normalizedId = String(careerId || "medicina").toLowerCase().trim();

    if (scope === "caces") {
        const cacesCareer = CACES_CAREERS.find(c => c.id === normalizedId);
        if (cacesCareer?.materias?.length) {
            return [...cacesCareer.materias];
        }
    }

    const healthCareer = HEALTH_CAREERS_11.find(c => c.id === normalizedId);
    if (healthCareer?.materias?.length) {
        return [...new Set([...healthCareer.materias, ...UNIVERSAL_SUBJECTS])];
    }

    return [...UNIVERSAL_SUBJECTS];
}

/**
 * Devuelve los niveles académicos filtrados por ámbito o la lista completa.
 * @param {string} scope - "all" | "caces" | "carrera"
 * @returns {Array}
 */
export function getAcademicLevels(scope = "all") {
    if (scope === "caces") {
        return ACADEMIC_LEVELS.filter(lvl => lvl.id === "caces_oficial");
    }
    if (scope === "carrera") {
        return ACADEMIC_LEVELS.filter(lvl => lvl.id !== "caces_oficial");
    }
    return ACADEMIC_LEVELS;
}

/**
 * Verifica si una carrera está desbloqueada para el usuario actual.
 * Los administradores maestros tienen acceso total a todas las carreras.
 * @param {string} careerId
 * @param {string} userEmail
 * @returns {boolean}
 */
export function isCareerUnlocked(careerId, userEmail = "") {
    if (isMasterAdmin(userEmail)) return true;
    const career = getCareerById(careerId, "carrera");
    return Boolean(career?.activa);
}

/**
 * Filtra los casos clínicos del banco semilla local según criterios opcionales.
 * @param {object} filters - { carrera, materia, nivel, dificultad, ambito }
 * @returns {Array}
 */
export function getSeedCasesByFilter(filters = {}) {
    const {
        carrera = "all",
        materia = "all",
        nivel = "all",
        dificultad = "all",
        ambito = "all"
    } = filters;

    return SEED_CASES.filter(item => {
        if (carrera !== "all" && item.carrera !== carrera) return false;
        if (materia !== "all" && item.materia !== materia) return false;
        if (nivel !== "all" && item.nivel !== nivel) return false;
        if (dificultad !== "all" && item.dificultad !== dificultad) return false;
        if (ambito !== "all" && item.ambito !== ambito) return false;
        return true;
    });
}

/**
 * Obtiene la información de un plan de suscripción por su clave.
 * @param {string} planKey - "basico" | "pro_mensual" | "pro_anual" | "vip"
 * @returns {object}
 */
export function getPlanDetails(planKey = "basico") {
    const key = String(planKey || "basico").toLowerCase().trim();
    return SUBSCRIPTION_PLANS[key] || SUBSCRIPTION_PLANS.basico;
}
