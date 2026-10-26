// ============================================================================
// ARCHIVO: js/9-graduation/complexivo.bootcamp.js
// DESCRIPCIÓN: Motor Intensivo de Examen Complexivo de Titulación por Carrera
//              (11 Carreras de Ciencias de la Salud). Incluye Cronograma
//              Bootcamp de 4 Semanas, Simulador Escrito Multidisciplinario por
//              Ejes Curriculares, Simulador de Defensa Oral / ECOE ante
//              Tribunal con Rúbrica Automatizada y Bóveda de Compendios.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION) - Carpeta 9 (Titulación)
// ============================================================================

import { appState, isMasterAdmin } from "../2-core/state.store.js";
import { db, auth } from "../2-core/firebase.service.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA Y CONFIGURACIÓN DE CARRERAS (11 ÁREAS)
// ============================================================================

export const COMPLEXIVO_ASSETS_PATH = "assets/9-multimedia-titulacion/guias-complexivo/";

const MASTER_ADMIN_EMAILS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

function hasFullComplexivoAccess() {
    const email = (
        appState?.currentUserData?.email ||
        auth?.currentUser?.email ||
        ""
    ).toLowerCase().trim();

    if (MASTER_ADMIN_EMAILS.includes(email)) return true;
    if (typeof isMasterAdmin === "function" && isMasterAdmin(email)) return true;

    const level = (appState?.currentUserData?.subscriptionLevel || "Básico").toUpperCase();
    return level === "PRO" || level === "VIP";
}

// Matriz Curricular de Ejes de Titulación para las 11 Carreras de Salud
export const COMPLEXIVO_CAREERS_BLUEPRINT = Object.freeze({
    medicina: {
        id: "medicina",
        nombre: "Medicina Humana",
        icono: "medical_services",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Eje Morfofuncional y Ciencias Básicas", peso: 20, materias: ["Anatomía Clínica", "Fisiología Médica", "Bioquímica", "Farmacología Básica", "Patología General"] },
            { id: "preclinico", nombre: "Eje Semiológico y Diagnóstico Clínico", peso: 25, materias: ["Semiología Médica", "Fisiopatología", "Imagenología", "Laboratorio Clínico", "Infectología"] },
            { id: "profesional", nombre: "Eje Clínico-Quirúrgico y Materno-Infantil", peso: 40, materias: ["Medicina Interna", "Cirugía General", "Pediatría", "Ginecología y Obstetricia", "Urgencias y UCI"] },
            { id: "salud_publica", nombre: "Eje Salud Pública, Bioética e Investigación", peso: 15, materias: ["Epidemiología Clínica", "Administración de Salud", "Bioética Médica", "Medicina Legal", "Metodología PICO"] }
        ]
    },
    enfermeria: {
        id: "enfermeria",
        nombre: "Enfermería",
        icono: "vaccines",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Fundamentos Biológicos y Modelos de Enfermería", peso: 20, materias: ["Morfofisiología", "Farmacología en Enfermería", "Teorías de Enfermería", "Microbiología"] },
            { id: "preclinico", nombre: "Proceso de Atención de Enfermería (PAE / NANDA-NIC-NOC)", peso: 25, materias: ["Semiología y Valoración", "Taxonomía NANDA-NIC-NOC", "Bioseguridad Clínica", "Dosificación y Dilución"] },
            { id: "profesional", nombre: "Cuidado Clínico, Quirúrgico, Materno y Crítico", peso: 40, materias: ["Enfermería Médico-Quirúrgica", "Enfermería Materno-Infantil", "Enfermería en UCI y Urgencias", "Centro Quirúrgico"] },
            { id: "salud_publica", nombre: "Salud Familiar, Comunitaria y Gestión", peso: 15, materias: ["Enfermería Comunitaria y MAIS-FCI", "Programa Ampliado de Inmunizaciones (PAI)", "Gerencia Hospitalaria", "Bioética"] }
        ]
    },
    odontologia: {
        id: "odontologia",
        nombre: "Odontología",
        icono: "dentistry",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Sistema Estomatognático y Biomateriales", peso: 20, materias: ["Anatomía de Cabeza y Cuello", "Histología y Embriología Dental", "Biomateriales Dentales", "Farmacología Odontológica"] },
            { id: "preclinico", nombre: "Diagnóstico Estomatológico y Radiología", peso: 25, materias: ["Patología Bucal", "Semiología Estomatológica", "Radiología Maxilofacial", "Oclusión y ATM"] },
            { id: "profesional", nombre: "Clínica Rehabilitadora, Quirúrgica y Endoperiodontal", peso: 40, materias: ["Endodoncia", "Periodoncia", "Cirugía Oral y Maxilofacial", "Operatoria y Rehabilitación Oral", "Odontopediatría"] },
            { id: "salud_publica", nombre: "Odontología Preventiva, Legal y Bioseguridad", peso: 15, materias: ["Salud Pública Estomatológica", "Epidemiología Oral", "Odontología Legal y Forense", "Bioética"] }
        ]
    },
    obstetricia: {
        id: "obstetricia",
        nombre: "Obstetricia y Puericultura",
        icono: "pregnant_woman",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Morfofisiología Reproductiva y Embriología", peso: 20, materias: ["Anatomía Pélvica", "Endocrinología Reproductiva", "Embriología y Genética", "Farmacología Obstétrica"] },
            { id: "preclinico", nombre: "Semiología Obstétrica y Monitoreo Fetal", peso: 25, materias: ["Control Prenatal Integral", "Cardiotocografía y Ecografía Básica", "Puntaje MAMÁ y Claves Obstétricas", "Tamizaje Perinatal"] },
            { id: "profesional", nombre: "Clínica Obstétrica, Parto, Puerperio y Alto Riesgo", peso: 40, materias: ["Atención del Parto y Partograma", "Claves Roja, Azul y Amarilla", "Puerperio y Lactancia", "Recepción Neonatal", "Ginecología Clínica"] },
            { id: "salud_publica", nombre: "Salud Sexual, Reproductiva y Normativa MSP", peso: 15, materias: ["Planificación Familiar", "Prevención de Muerte Materna", "Bioética Perinatal", "Vigilancia Epidemiológica"] }
        ]
    },
    fisioterapia: {
        id: "fisioterapia",
        nombre: "Fisioterapia y Terapia Física",
        icono: "accessibility_new",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Biomecánica, Cinesiología y Neuroanatomía", peso: 20, materias: ["Anatomía Musculoesquelética", "Biomecánica Clínica", "Fisiología del Ejercicio", "Neurofisiología"] },
            { id: "preclinico", nombre: "Evaluación Funcional y Agentes Físicos", peso: 25, materias: ["Goniometría y Examen Muscular (Daniels)", "Pruebas Ortopédicas Especiales", "Electroterapia y Termoterapia", "Imagenología Musculoesquelética"] },
            { id: "profesional", nombre: "Rehabilitación Traumatológica, Neurológica y Cardiorrespiratoria", peso: 40, materias: ["Fisioterapia Traumatológica y Deportiva", "Neurorrehabilitación (Bobath/Kabat)", "Fisioterapia Respiratoria y UCI", "Rehabilitación Geriátrica y Pediátrica"] },
            { id: "salud_publica", nombre: "Ergonomía, Discapacidad y Salud Ocupacional", peso: 15, materias: ["Clasificación CIF-OMS", "Ergonomía Laboral", "Bioética en Rehabilitación", "Diseño de Protocolos"] }
        ]
    },
    laboratorio_clinico: {
        id: "laboratorio_clinico",
        nombre: "Laboratorio Clínico",
        icono: "biotech",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Bioquímica Analítica y Biología Celular", peso: 20, materias: ["Química Analítica", "Biología Molecular", "Inmunología Básica", "Bioseguridad Nivel II/III"] },
            { id: "preclinico", nombre: "Fase Preanalítica y Control de Calidad", peso: 25, materias: ["Flebotomía y Manejo de Muestras", "Reglas de Westgard y Calibración", "Instrumentación Automatizada", "Microscopía"] },
            { id: "profesional", nombre: "Hematología, Microbiología, Química Clínica y Banco de Sangre", peso: 40, materias: ["Hematología y Coagulación", "Bacteriología, Micología y Virología", "Parasitología y Uroanálisis", "Inmunohematología y Medicina Transfusional"] },
            { id: "salud_publica", nombre: "Gestión de Calidad ISO 15189 y Epidemiología", peso: 15, materias: ["Norma ISO 15189", "Vigilancia de Resistencia Antimicrobiana", "Ética Diagnóstica", "Bioestadística"] }
        ]
    },
    psicologia_clinica: {
        id: "psicologia_clinica",
        nombre: "Psicología Clínica",
        icono: "psychology",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Neuropsicología y Procesos Psicológicos", peso: 20, materias: ["Neuroanatomía Funcional", "Psicofisiología", "Psicología del Desarrollo", "Teorías de la Personalidad"] },
            { id: "preclinico", nombre: "Psicopatología y Psicodiagnóstico (DSM-5-TR / CIE-11)", peso: 25, materias: ["Semiología Psiquiátrica y Psicopatología", "Entrevista Clínica y Examen Mental", "Baterías Psicométricas y Proyectivas", "Diagnóstico Diferencial DSM-5-TR"] },
            { id: "profesional", nombre: "Psicoterapia Basada en Evidencia e Intervención en Crisis", peso: 40, materias: ["Terapia Cognitivo-Conductual (TCC)", "Primeros Auxilios Psicológicos y Riesgo Suicida", "Psicoterapia Sistémica y Familiar", "Adicciones y Patología Dual"] },
            { id: "salud_publica", nombre: "Salud Mental Comunitaria y Deontología", peso: 15, materias: ["Políticas de Salud Mental", "Psicología Forense y Peritaje", "Código Deontológico", "Investigación Clínica"] }
        ]
    },
    nutricion_dietetica: {
        id: "nutricion_dietetica",
        nombre: "Nutrición y Dietética",
        icono: "nutrition",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Bioquímica Nutricional y Bromatología", peso: 20, materias: ["Metabolismo de Macro y Micronutrientes", "Fisiología Digestiva", "Bromatología y Tecnología de Alimentos", "Microbiología Alimentaria"] },
            { id: "preclinico", nombre: "Evaluación del Estado Nutricional (ABCD)", peso: 25, materias: ["Antropometría y Composición Corporal (ISAK)", "Indicadores Bioquímicos y Clínicos", "Cálculo de Requerimientos Energéticos", "Nutrición en el Ciclo de Vida"] },
            { id: "profesional", nombre: "Dietoterapia Clínica y Soporte Nutricional (Enteral/Parenteral)", peso: 40, materias: ["Dietoterapia en Patología Renal y Hepática", "Manejo Nutricional en Diabetes y Riesgo CV", "Soporte Nutricional Enteral y Parenteral en UCI", "Nutrición Pediátrica y Desnutrición Aguda"] },
            { id: "salud_publica", nombre: "Seguridad Alimentaria, Inocuidad y Salud Pública", peso: 15, materias: ["Epidemiología Nutricional", "Gestión de Servicios de Alimentación (HACCP)", "Programas de Desnutrición Crónica Infantil", "Bioética"] }
        ]
    },
    bioquimica_farmacia: {
        id: "bioquimica_farmacia",
        nombre: "Bioquímica y Farmacia",
        icono: "medication",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Química Orgánica, Farmacoquímica y Fisiología", peso: 20, materias: ["Química Farmacéutica", "Fisiopatología", "Anatomía y Fisiología", "Bioquímica Metabólica"] },
            { id: "preclinico", nombre: "Farmacocinética, Farmacodinamia y Toxicología", peso: 25, materias: ["Biofarmacia y Farmacocinética Clínica", "Farmacología por Sistemas", "Toxicología Analítica y Forense", "Farmacognosia y Fitoquímica"] },
            { id: "profesional", nombre: "Farmacia Hospitalaria, Atención Farmacéutica y Tecnología", peso: 40, materias: ["Seguimiento Farmacoterapéutico (Método Dáder)", "Interacciones Medicamentosas y PRM", "Tecnología Farmacéutica y Buenas Prácticas (BPM)", "Mezclas Intravenosas y Oncológicas"] },
            { id: "salud_publica", nombre: "Farmacovigilancia, Regulación ARCSA y Bioética", peso: 15, materias: ["Normativa Sanitaria ARCSA y CNMB", "Farmacovigilancia y Tecnovigilancia", "Gestión de Suministros de Medicamentos", "Deontología Farmacéutica"] }
        ]
    },
    imagenologia_radiologia: {
        id: "imagenologia_radiologia",
        nombre: "Imagenología y Radiología",
        icono: "radiology",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Física de las Radiaciones y Anatomía Radiológica", peso: 20, materias: ["Física Radiológica y Dosimetría", "Anatomía Seccional (TC/RM)", "Radiobiología", "Medios de Contraste y Nefroprotección"] },
            { id: "preclinico", nombre: "Protección Radiológica y Posicionamiento Técnico", peso: 25, materias: ["Principio ALARA y Blindaje", "Proyecciones Radiológicas Convencionales", "Control de Calidad de Equipos", "Sistemas PACS y DICOM"] },
            { id: "profesional", nombre: "Tomografía, Resonancia Magnética, Ecografía y Mamografía", peso: 40, materias: ["Protocolos de Tomografía Computarizada Multicorte", "Secuencias de Resonancia Magnética (T1, T2, FLAIR, DWI)", "Mamografía y Sistema BI-RADS", "Angiotomografía e Intervencionismo"] },
            { id: "salud_publica", nombre: "Seguridad del Paciente y Normativa Nuclear", peso: 15, materias: ["Manejo de Reacciones Anafilácticas al Contraste", "Legislación de Seguridad Radiológica", "Ética Clínica", "Gestión de Servicios de Imagen"] }
        ]
    },
    atencion_prehospitalaria: {
        id: "atencion_prehospitalaria",
        nombre: "Atención Prehospitalaria y Emergencias",
        icono: "ambulance",
        ponderacionTeorica: 60,
        ponderacionPractica: 40,
        ejes: [
            { id: "basico", nombre: "Anatomofisiología Aplicada y Cinemática del Trauma", peso: 20, materias: ["Fisiología del Shock y Perfusión", "Cinemática de Colisiones y Explosiones", "Farmacología de Urgencias", "Vía Aérea y Ventilación"] },
            { id: "preclinico", nombre: "Evaluación Primaria y Secundaria (XABCDE / SAMPLE)", peso: 25, materias: ["Valoración XABCDE en Escena", "Electrocardiografía de Emergencia", "Triage START y META", "Inmovilización y Extricación"] },
            { id: "profesional", nombre: "Soporte Vital Avanzado en Trauma, Cardiovascular y Pediátrico", peso: 40, materias: ["PHTLS y Manejo de Hemorragia Exanguinante", "ACLS y Reanimación Cardiopulmonar de Alta Calidad", "PALS y Emergencias Obstétricas Extrahospitalarias", "Toxicología y Emergencias Ambientales"] },
            { id: "salud_publica", nombre: "Sistema de Comando de Incidentes (SCI) y Desastres", peso: 15, materias: ["Comando de Incidentes (SCI-100/200)", "Materiales Peligrosos (HAZMAT)", "Transferencia SBAR / MIST y Aspectos Médico-Legales", "Salud Mental en Emergencias"] }
        ]
    }
});

// ============================================================================
// 2. CRONOGRAMA INTENSIVO DE 4 SEMANAS (BOOTCAMP 28 DÍAS)
// ============================================================================

export const BOOTCAMP_4_WEEKS_PLAN = Object.freeze([
    {
        week: 1,
        title: "Semana 1: Cimientos Morfofuncionales y Eje Básico (20%)",
        subtitle: "Dominio de fisiología, bioquímica, farmacología base y correlación anatomoclínica.",
        badge: "FASE 1 • FUNDAMENTOS",
        tasks: [
            { id: "w1_t1", day: "Días 1-2", title: "Revisión de Fisiopatología y Homeostasis por Sistemas", type: "compendio", mins: 90 },
            { id: "w1_t2", day: "Días 3-4", title: "Farmacología Esencial: Mecanismos de Acción y Efectos Adversos", type: "sinaptico", mins: 75 },
            { id: "w1_t3", day: "Días 5-6", title: "Entrenamiento de Reactivos del Eje Básico (Modo Tutor)", type: "simulacro_eje", eje: "basico", mins: 60 },
            { id: "w1_t4", day: "Día 7", title: "Control Diagnóstico Semanal N.° 1 + Análisis de Errores", type: "evaluacion", mins: 90 }
        ]
    },
    {
        week: 2,
        title: "Semana 2: Eje Preclínico, Semiología y Métodos Diagnósticos (25%)",
        subtitle: "Interpretación sindrómica, escalas clínicas, laboratorio e imagenología diagnóstica.",
        badge: "FASE 2 • DIAGNÓSTICO",
        tasks: [
            { id: "w2_t1", day: "Días 8-9", title: "Integración Sindrómica y Diagnóstico Diferencial Estructurado", type: "compendio", mins: 90 },
            { id: "w2_t2", day: "Días 10-11", title: "Interpretación de Exámenes Complementarios y Escalas de Gravedad", type: "simulacro_eje", eje: "preclinico", mins: 80 },
            { id: "w2_t3", day: "Días 12-13", title: "Taller de Estructuración de Caso Clínico (Método SOAP / PICO)", type: "osce_prep", mins: 75 },
            { id: "w2_t4", day: "Día 14", title: "Simulacro Acumulativo Ejes 1 + 2 (Básico y Preclínico)", type: "evaluacion", mins: 100 }
        ]
    },
    {
        week: 3,
        title: "Semana 3: Eje Profesionalizante, Manejo Clínico y Urgencias (40%)",
        subtitle: "El bloque de mayor peso en el Examen Complexivo: protocolos terapéuticos y guías MSP.",
        badge: "FASE 3 • ALTO PESO (40%)",
        tasks: [
            { id: "w3_t1", day: "Días 15-17", title: "Protocolos de Primera Línea y Guías de Práctica Clínica (GPC)", type: "compendio", mins: 120 },
            { id: "w3_t2", day: "Días 18-19", title: "Resolución de Casos Críticos y Conductas Terapéuticas", type: "simulacro_eje", eje: "profesional", mins: 90 },
            { id: "w3_t3", day: "Día 20", title: "Salud Pública, Bioética, Normativa Sanitaria y Bioestadística (15%)", type: "simulacro_eje", eje: "salud_publica", mins: 60 },
            { id: "w3_t4", day: "Día 21", title: "Primer Simulacro Complexivo Escrito Multidisciplinario Completo", type: "evaluacion", mins: 120 }
        ]
    },
    {
        week: 4,
        title: "Semana 4: Defensa Oral ECOE ante Tribunal y Simulacro Final (40% Práctico)",
        subtitle: "Entrenamiento con cronómetro de estación, rúbrica de tribunal y defensa oral sin fisuras.",
        badge: "FASE 4 • TRIBUNAL & ECOE",
        tasks: [
            { id: "w4_t1", day: "Días 22-23", title: "Simulación de Estación ECOE / Defensa de Caso Clínico con Rúbrica", type: "osce_prep", mins: 90 },
            { id: "w4_t2", day: "Días 24-25", title: "Entrenamiento de Respuestas a Preguntas de Réplica del Jurado", type: "osce_prep", mins: 80 },
            { id: "w4_t3", day: "Días 26-27", title: "Simulacro Final de Grado bajo Condiciones Oficiales de Tiempo", type: "evaluacion", mins: 150 },
            { id: "w4_t4", day: "Día 28", title: "Revisión de Racionales Críticos y Checklist de Día de Examen", type: "compendio", mins: 45 }
        ]
    }
]);

// ============================================================================
// 3. BANCO SEMILLA MULTIDISCIPLINARIO PARA EXAMEN COMPLEXIVO ESCRITO
// ============================================================================

export const COMPLEXIVO_SEED_QUESTIONS = Object.freeze([
    {
        id: "cx_med_01",
        carrera: "medicina",
        eje: "profesional",
        materia: "Medicina Interna / Urgencias",
        dificultad: "Alta (Nivel Titulación)",
        enunciado: "Paciente masculino de 64 años con antecedente de cirrosis hepática por VHC acude a urgencias por hematemesis franca y melenas de 4 horas de evolución. PA: 84/52 mmHg, FC: 118 lpm, Hb: 7.4 g/dL, plaquetas: 62.000/mm³. Tras asegurar la vía aérea y canalizar dos vías periféricas gruesas con cristaloides cautelosos, ¿cuál es la conducta farmacológica y endoscópica inicial que disminuye la mortalidad en este cuadro?",
        opciones: {
            A: "Terlipresina (u Octreótide) IV inmediata + Profilaxis antibiótica con Ceftriaxona IV + Ligadura endoscópica con bandas dentro de las primeras 12 horas.",
            B: "Omeprazol en bolo de 80 mg IV único sin vasoactivos + Endoscopía diferida a las 48 horas + Transfusión hasta llevar la Hb a 12 g/dL.",
            C: "Colocación inmediata de balón de Sengstaken-Blakemore como primera línea definitiva + Ciprofloxacino oral.",
            D: "Propranolol vía oral en fase aguda de choque hipovolémico + Escleroterapia de urgencia sin antibióticos."
        },
        respuestaCorrecta: "A",
        racional: "En la hemorragia digestiva alta variceal aguda, el consenso de Baveno VII establece: 1) Estrategia transfusional restrictiva (meta Hb 7-8 g/dL), 2) Fármacos vasoactivos inmediatos (Terlipresina, Somatostatina u Octreótide), 3) Profilaxis antibiótica obligatoria (Ceftriaxona 1 g IV c/24h) que reduce resangrado y mortalidad, y 4) VEDA con ligadura con bandas en las primeras 12 horas."
    },
    {
        id: "cx_med_02",
        carrera: "medicina",
        eje: "basico",
        materia: "Fisiopatología / Nefrología",
        dificultad: "Media-Alta",
        enunciado: "En un paciente con cetoacidosis diabética severa (pH 7.12, HCO3 8 mEq/L, Na+ sérico medido 128 mEq/L, glucosa 620 mg/dL, K+ sérico 3.1 mEq/L), ¿cuál es el paso fisiopatológico prioritario respecto a la insulinoterapia y el potasio?",
        opciones: {
            A: "Diferir el inicio de la infusión de insulina regular IV hasta reponer potasio y alcanzar un K+ sérico > 3.3 mEq/L para prevenir arritmias letales.",
            B: "Iniciar bolo de insulina regular 0.1 UI/kg inmediatamente junto con bicarbonato de sodio al 8.4% en todos los casos.",
            C: "Administrar solución glucosada al 5% desde el minuto cero para corregir la hiponatremia dilucional.",
            D: "Restringir líquidos intravenosos porque el sodio medido está bajo."
        },
        respuestaCorrecta: "A",
        racional: "La insulina introduce potasio al espacio intracelular mediante la activación de la bomba Na+/K+ ATPasa. Si el K+ sérico inicial es < 3.3 mEq/L, iniciar insulina antes de reponer potasio precipita hipopotasemia severa y paro cardíaco por arritmias ventriculares."
    },
    {
        id: "cx_enf_01",
        carrera: "enfermeria",
        eje: "profesional",
        materia: "Enfermería Crítica y Urgencias",
        dificultad: "Alta (Nivel Titulación)",
        enunciado: "Durante el turno en UCI, usted recibe la prescripción de infundir 1.200 ml de Solución Salina 0.9% en 8 horas mediante un equipo de venoclisis normogotero (factor de goteo 20 gotas/ml). ¿A cuántas gotas por minuto (gt/min) y mililitros por hora (ml/h) debe programar la infusión?",
        opciones: {
            A: "50 gotas/minuto y 150 ml/hora.",
            B: "35 gotas/minuto y 120 ml/hora.",
            C: "60 gotas/minuto y 180 ml/hora.",
            D: "25 gotas/minuto y 75 ml/hora."
        },
        respuestaCorrecta: "A",
        racional: "Velocidad en ml/h = 1200 ml / 8 h = 150 ml/h. En normogotero (constante 3): Gotas/min = (Volumen total en ml) / (Horas × 3) = 1200 / (8 × 3) = 1200 / 24 = 50 gotas/min."
    },
    {
        id: "cx_odo_01",
        carrera: "odontologia",
        eje: "profesional",
        materia: "Endodoncia y Urgencias Odontológicas",
        dificultad: "Alta (Nivel Titulación)",
        enunciado: "Paciente de 29 años acude por dolor espontáneo, pulsátil, severo y localizado en el primer molar inferior derecho (46), que aumenta con el decúbito y los estímulos térmicos calientes, aliviándose momentáneamente con el frío. A la percusión vertical presenta sensibilidad leve y radiográficamente se observa caries profunda comunicada con cámara pulpar y espacio periodontal apical normal. ¿Cuál es el diagnóstico pulpar definitivo y el tratamiento de elección?",
        opciones: {
            A: "Pulpitis Irreversible Sintomática • Biopulpectomía total (endodoncia) en diente vital.",
            B: "Pulpitis Reversible • Recubrimiento pulpar indirecto con hidróxido de calcio.",
            C: "Necrosis Pulpar con Periodontitis Apical Aguda • Exodoncia inmediata.",
            D: "Absceso Fénix • Solo prescripción de amoxicilina sin apertura cameral."
        },
        respuestaCorrecta: "A",
        racional: "El dolor espontáneo, pulsátil, que persiste tras retirar el estímulo y empeora con el calor (vasodilatación intrapulpar en cavidad inextensible) caracteriza a la Pulpitis Irreversible Sintomática. El tratamiento de elección es la apertura cameral y biopulpectomía."
    },
    {
        id: "cx_obs_01",
        carrera: "obstetricia",
        eje: "profesional",
        materia: "Emergencias Obstétricas (Clave Azul)",
        dificultad: "Alta (Nivel Titulación)",
        enunciado: "Gestante de 35 semanas ingresa con PA 168/114 mmHg, cefalea frontooccipital intensa, escotomas centelleantes e hiperreflexia rotuliana. Se activa Clave Azul y se inicia Sulfato de Magnesio (esquema Zuspan: 4 g IV de impregnación en 20 min seguido de 1 g/hora). A las 2 horas presenta FR de 10 rpm y abolición del reflejo rotuliano. ¿Cuál es la conducta inmediata?",
        opciones: {
            A: "Suspender la infusión de Sulfato de Magnesio, asegurar oxigenación y administrar Gluconato de Calcio al 10% (1 g IV lento en 10 minutos).",
            B: "Duplicar la velocidad de infusión de Sulfato de Magnesio a 2 g/hora por riesgo de eclampsia.",
            C: "Administrar Nifedipino sublingual y mantener el Sulfato de Magnesio sin cambios.",
            D: "Administrar Protamina 50 mg IV en bolo rápido."
        },
        respuestaCorrecta: "A",
        racional: "La pérdida del reflejo patelar (> 8-10 mEq/L) seguida de depresión respiratoria (< 12 rpm, > 12 mEq/L) son signos cardinales de intoxicación por Sulfato de Magnesio. El antídoto específico es el Gluconato de Calcio al 10% (10 ml = 1 g IV lento)."
    }
]);

// ============================================================================
// 4. CASOS INTEGRADORES PARA DEFENSA ORAL / ECOE ANTE TRIBUNAL
// ============================================================================

export const COMPLEXIVO_ORAL_OSCE_CASES = Object.freeze([
    {
        id: "osce_med_sepsis",
        carrera: "medicina",
        titulo: "Estación ECOE 01: Choque Séptico de Foco Urinario Obstructivo",
        tiempoMinutos: 15,
        escenario: "Mujer de 58 años, diabética tipo 2, ingresa a emergencias con fiebre de 39.2 °C, escalofríos, dolor lumbar derecho y confusión aguda (Glasgow 13/15). Signos vitales: PA 78/44 mmHg (PAM 55 mmHg), FC 124 lpm, FR 26 rpm, SpO2 91%. Laboratorio: Leucocitos 21.400/mm³ (neutrófilos 89%), Creatinina 2.4 mg/dL, Lactato sérico 4.6 mmol/L. Ecografía renal a pie de cama reporta hidronefrosis moderada derecha por litiasis ureteral proximal de 11 mm.",
        preguntasTribunal: [
            "1. ¿Por qué este cuadro cumple criterios de Choque Séptico según Sepsis-3 y cuál es el puntaje qSOFA inicial?",
            "2. Describa el paquete de la Hora-1 (Hour-1 Bundle) de la Campaña Sobreviviendo a la Sepsis aplicado a esta paciente.",
            "3. Además de los antibióticos y vasopresores, ¿qué intervención de control de foco es indispensable y urgente para salvarle la vida?"
        ],
        clavesRubrica: {
            sindromico: ["sindrome febril", "respuesta inflamatoria", "hipoperfusion", "choque", "obstruccion urinaria", "qsofa"],
            diagnostico: ["choque septico", "sepsis", "pielonefritis obstructiva", "urolitiasis", "lesion renal aguda", "aki"],
            terapeutico: ["cristaloides", "30 ml/kg", "lactato", "hemocultivos", "urocultivo", "antibiotico", "ceftriaxona", "piperacilina", "meropenem", "noradrenalina", "norepinefrina", "pam 65"],
            replica: ["descompresion", "cateter doble j", "nefrostomia", "control de foco", "lactato > 2", "pam >= 65"]
        },
        modeloRespuestaIdeal: {
            sindromico: "Síndrome de respuesta inflamatoria sistémica con disfunción orgánica (encefalopatía aguda + lesión renal aguda KDIGO II) e hipoperfusión tisular severa (qSOFA 3/3: FR ≥ 22, alteración mental y PAS ≤ 100 mmHg).",
            diagnostico: "Choque Séptico (Sepsis-3) secundario a Pielonefritis Aguda Obstructiva Derecha por litiasis ureteral proximal + Lesión Renal Aguda prerrenal/intrínseca.",
            terapeutico: "Paquete Hora-1: 1) Medir lactato sérico (4.6 mmol/L) y reevaluar en 2h; 2) Tomar 2 sets de hemocultivos y urocultivo antes del antibiótico; 3) Antibiótico IV de amplio espectro en la 1.ª hora (ej. Piperacilina/Tazobactam o Carbapenémico según riesgo BLEE); 4) Reanimación con cristaloides balanceados 30 ml/kg; 5) Iniciar Noradrenalina IV para meta de PAM ≥ 65 mmHg.",
            replica: "El control del foco infeccioso es mandatorio en las primeras 6 a 12 horas: derivación urinaria urgente mediante colocación de catéter ureteral Doble J o nefrostomía percutánea derecha, ya que el antibiótico no penetra adecuadamente en una pelvis renal obstruida a tensión."
        }
    },
    {
        id: "osce_enf_pae_uci",
        carrera: "enfermeria",
        titulo: "Estación ECOE 02: Defensa PAE (NANDA-NIC-NOC) en Paciente con Neumonía Grave",
        tiempoMinutos: 15,
        escenario: "Paciente masculino de 71 años con EPOC exacerbado y neumonía adquirida en la comunidad. Presenta disnea en reposo, uso de músculos accesorios, estertores crepitantes bibasales, secreciones bronquiales espesas difíciles de expectorar, FR 30 rpm, SpO2 84% al aire ambiente y gasometría arterial con pH 7.29, PaCO2 58 mmHg, PaO2 54 mmHg, HCO3 27 mEq/L.",
        preguntasTribunal: [
            "1. ¿Cómo interpreta la gasometría arterial de ingreso?",
            "2. Formule el diagnóstico NANDA prioritario con su factor relacionado (R/C) y características definitorias (M/P).",
            "3. Mencione el resultado NOC esperado y al menos 3 intervenciones NIC prioritarias."
        ],
        clavesRubrica: {
            sindromico: ["insuficiencia respiratoria", "acidosis respiratoria", "hipercapnia", "hipoxemia", "secreciones"],
            diagnostico: ["deterioro del intercambio de gases", "limpieza ineficaz de las vias aereas", "00030", "00031", "nanda"],
            terapeutico: ["oxigenoterapia", "venturi", "aspiracion", "fisioterapia respiratoria", "semifowler", "monitoreo", "nic", "noc"],
            replica: ["acidosis respiratoria", "epoc", "fio2 controlada", "88-92%", "retencion de co2"]
        },
        modeloRespuestaIdeal: {
            sindromico: "Insuficiencia respiratoria aguda global (hipoxémica e hipercápnica) con acidosis respiratoria descompensada (pH < 7.35 y PaCO2 > 45 mmHg).",
            diagnostico: "NANDA [00030] Deterioro del intercambio de gases R/C cambios en la membrana alveolocapilar y desequilibrio ventilación-perfusión M/P hipoxemia (PaO2 54 mmHg), hipercapnia (PaCO2 58 mmHg), disnea y SpO2 84%. Diagnóstico secundario: [00031] Limpieza ineficaz de las vías aéreas.",
            terapeutico: "NOC [0402] Estado respiratorio: intercambio gaseoso. NIC [3320] Oxigenoterapia controlada con mascarilla de flujo regulado (Venturi) para meta de SpO2 88-92%, [3140] Manejo de la vía aérea, posición Semi-Fowler a 45°, nebulización y fisioterapia respiratoria.",
            replica: "En pacientes con EPOC hipercápnico crónico debe evitarse la hiperoxia no controlada (FiO2 altas) porque deprime el estímulo ventilatorio hipóxico y empeora la acidosis hipercápnica por efecto Haldane; la meta segura de SpO2 es 88% a 92%."
        }
    },
    {
        id: "osce_multidisciplinario_general",
        carrera: "todas",
        titulo: "Estación ECOE 03: Anafilaxia Grado III en Escenario Clínico / Quirófano",
        tiempoMinutos: 15,
        escenario: "Paciente de 34 años que, 4 minutos después de la administración parenteral de un betalactámico / medio diagnóstico, desarrolla estridor laríngeo inspiratorio, sibilancias difusas, urticaria generalizada, edema labial y caída brusca de la presión arterial a 76/40 mmHg con FC 132 lpm y SpO2 86%.",
        preguntasTribunal: [
            "1. ¿Cuál es el fármaco de primera línea, su vía de administración anatómica exacta, concentración y dosis en adultos?",
            "2. ¿Por qué los antihistamínicos y corticoides intravenosos NO sustituyen al fármaco de primera línea?",
            "3. ¿Qué posición corporal y manejo de vía aérea indica de inmediato?"
        ],
        clavesRubrica: {
            sindromico: ["choque anafilactico", "anafilaxia", "hipersensibilidad tipo i", "igE", "edema laringeo", "broncoespasmo"],
            diagnostico: ["anafilaxia", "choque distributivo", "compromiso de via aerea"],
            terapeutico: ["adrenalina", "epinefrina", "intramuscular", "vasto externo", "0.3", "0.5 mg", "1:1000", "oxigeno", "cristaloides"],
            replica: ["alfa-1", "beta-2", "inicio de accion", "antihistaminicos", "intubacion", "decubito supino", "piernas elevadas"]
        },
        modeloRespuestaIdeal: {
            sindromico: "Reacción de hipersensibilidad inmediata mediada por IgE (Tipo I de Gell y Coombs) con compromiso simultáneo cutáneo-mucoso, respiratorio alto/bajo y colapso cardiovascular distributivo.",
            diagnostico: "Choque Anafiláctico (Anafilaxia Grado III-IV) inducido por fármacos.",
            terapeutico: "1) Suspender inmediatamente el agente causal; 2) Adrenalina (Epinefrina) 1:1000 (1 mg/ml) a dosis de 0.3 a 0.5 mg por vía INTRAMUSCULAR en la cara anterolateral del tercio medio del muslo (músculo vasto externo), repetible cada 5-15 min; 3) Oxígeno al 100% de alto flujo y preparación para intubación precoz por estridor; 4) Bolo de cristaloides 20 ml/kg IV.",
            replica: "La adrenalina IM revierte el edema laríngeo y la hipotensión por efecto alfa-1 vasoconstrictor, produce broncodilatación por efecto beta-2 y estabiliza la membrana del mastocito en minutos. Los corticoides tardan 4-6 horas en actuar y los antihistamínicos solo alivian el prurito/urticaria sin revertir el choque ni el broncoespasmo."
        }
    }
]);

// ============================================================================
// 5. COMPENDIOS INTEGRADORES (assets/9-multimedia-titulacion/guias-complexivo/)
// ============================================================================

export const COMPLEXIVO_COMPENDIUM_LIBRARY = Object.freeze([
    {
        id: "comp_med_integrador",
        carrera: "medicina",
        titulo: "Compendio Maestro Complexivo: Medicina Interna, Cirugía, Pediatría y Gineco-Obstetricia",
        paginas: 148,
        archivoPdf: "compendio_complexivo_medicina_2026.pdf",
        ejesCubiertos: ["Eje Básico (20%)", "Eje Preclínico (25%)", "Eje Clínico-Quirúrgico (40%)", "GPC-MSP y Bioética (15%)"],
        resumenTactico: [
            "Tablas de primera y segunda línea antibiótica según foco infeccioso y GPC vigentes.",
            "Algoritmos de reanimación, escalas diagnósticas (CURB-65, BISAP, Alvarado, Wells, Child-Pugh, MELD, Bishop).",
            "Esquemas de Claves Obstétricas (Roja, Azul, Amarilla) y AIEPI Neonatal/Pediátrico."
        ]
    },
    {
        id: "comp_enf_pae",
        carrera: "enfermeria",
        titulo: "Manual Integrador de Titulación: Taxonomía NANDA-NIC-NOC, Farmacocálculo y PAI",
        paginas: 112,
        archivoPdf: "compendio_complexivo_enfermeria_2026.pdf",
        ejesCubiertos: ["Proceso Enfermero PAE", "Cuidado Crítico y Quirúrgico", "Cadena de Frío y PAI", "MAIS-FCI"],
        resumenTactico: [
            "Fórmulas de cálculo de goteo (normogotero, microgotero), bombas de infusión y conversión a mcg/kg/min.",
            "Esquema Nacional de Vacunación del Ecuador (vías, ángulos, calibres de aguja y conservación +2 °C a +8 °C).",
            "Interconexiones diagnósticas NANDA-NIC-NOC más evaluadas por tribunales de titulación."
        ]
    },
    {
        id: "comp_odo_clinica",
        carrera: "odontologia",
        titulo: "Guía de Titulación Estomatológica: Diagnóstico Pulpar, Periodontal y Farmacología Oral",
        paginas: 96,
        archivoPdf: "compendio_complexivo_odontologia_2026.pdf",
        ejesCubiertos: ["Clasificación AAE Endodoncia", "Nueva Clasificación Periodontal (Estadios/Grados)", "Cirugía y Anestesiología"],
        resumenTactico: [
            "Criterios diagnósticos pulpares y periapicales de la Asociación Americana de Endodoncia (AAE).",
            "Cálculo de dosis máximas de anestésicos locales con y sin vasoconstrictor en adultos, niños y gestantes.",
            "Protocolos de profilaxis antibiótica para endocarditis infecciosa (AHA) y manejo de accidentes con hipoclorito."
        ]
    },
    {
        id: "comp_multidisciplinario_ecoe",
        carrera: "todas",
        titulo: "Protocolo Universal de Defensa Oral ante Tribunal y Estaciones ECOE (11 Carreras)",
        paginas: 64,
        archivoPdf: "manual_defensa_oral_ecoe_tribunal.pdf",
        ejesCubiertos: ["Estructura de Exposición en 10 Minutos", "Rúbrica Oficial de Tribunal", "Manejo de Preguntas de Réplica"],
        resumenTactico: [
            "Minuto 0 a 2: Presentación de datos de filiación relevantes, motivo de consulta e identificación sindrómica.",
            "Minuto 2 a 5: Sustento del diagnóstico definitivo y descarte razonado de al menos 2 diagnósticos diferenciales.",
            "Minuto 5 a 8: Plan terapéutico / de intervención escalonado (medidas no farmacológicas, farmacológicas y signos de alarma).",
            "Minuto 8 a 10: Cierre bioético y preparación para la ronda de réplica del jurado calificador."
        ]
    }
]);

// ============================================================================
// 6. ESTADO REACTIVO DEL MOTOR COMPLEXIVO BOOTCAMP
// ============================================================================

export const complexivoState = {
    initialized: false,
    mountElement: null,
    selectedCareer: "medicina",
    activeSubTab: "roadmap", // "roadmap" | "written" | "osce" | "compendiums"
    selectedWeek: 1,
    completedTasks: new Set(),
    // Estado del Simulador Escrito
    writtenExam: {
        active: false,
        axisFilter: "todos",
        mode: "tutor", // "tutor" | "oficial"
        questions: [],
        currentIndex: 0,
        answers: {},
        marked: new Set(),
        timeRemainingSec: 0,
        timerInterval: null,
        lastResult: null
    },
    // Estado del Simulador Oral ECOE
    osceSession: {
        activeCaseId: "osce_med_sepsis",
        timerSec: 15 * 60,
        timerRunning: false,
        timerInterval: null,
        lastEvaluation: null
    }
};

// ============================================================================
// 7. INICIALIZADOR PRINCIPAL (initComplexivoBootcamp)
// ============================================================================

/**
 * Inicializa el motor de Examen Complexivo y monta su interfaz Cyber-Medical HUD.
 * @param {Object} options - `{ mountSelector, defaultCareer }`
 */
export function initComplexivoBootcamp(options = {}) {
    loadSavedProgressFromLocal();

    if (options.defaultCareer && COMPLEXIVO_CAREERS_BLUEPRINT[options.defaultCareer]) {
        complexivoState.selectedCareer = options.defaultCareer;
    } else if (
        appState?.currentUserData?.carrera &&
        COMPLEXIVO_CAREERS_BLUEPRINT[appState.currentUserData.carrera]
    ) {
        complexivoState.selectedCareer = appState.currentUserData.carrera;
    } else if (appState?.currentCareer && COMPLEXIVO_CAREERS_BLUEPRINT[appState.currentCareer]) {
        complexivoState.selectedCareer = appState.currentCareer;
    }

    const mountEl = resolveComplexivoMountContainer(options.mountSelector);
    if (!mountEl) return;

    complexivoState.mountElement = mountEl;
    complexivoState.initialized = true;

    renderComplexivoBootcampShell();
    exposeGlobalComplexivoAPI();
}

// Alias compatible con safeLoadModule en app.orchestrator.js y graduation.controller.js
export const initBootcampComplexivo = initComplexivoBootcamp;

function resolveComplexivoMountContainer(customSelector) {
    if (customSelector) {
        const customEl = document.querySelector(customSelector);
        if (customEl) return customEl;
    }

    const directCandidates = [
        "#complexivo-bootcamp-mount",
        "#graduation-complexivo-container",
        "#view-complexivo",
        "#view-graduation"
    ];

    for (const sel of directCandidates) {
        const found = document.querySelector(sel);
        if (found) return found;
    }

    const viewsContainer = document.getElementById("views-container");
    if (viewsContainer) {
        let dynamicView = document.getElementById("view-complexivo");
        if (!dynamicView) {
            dynamicView = document.createElement("section");
            dynamicView.id = "view-complexivo";
            dynamicView.className = "tab-content hidden space-y-6";
            viewsContainer.appendChild(dynamicView);
        }
        return dynamicView;
    }

    return null;
}

function exposeGlobalComplexivoAPI() {
    window.MakaiComplexivoBootcamp = {
        open: (careerId) => {
            if (careerId && COMPLEXIVO_CAREERS_BLUEPRINT[careerId]) {
                complexivoState.selectedCareer = careerId;
            }
            renderComplexivoBootcampShell();
        },
        startWritten: (config) => startComplexivoWrittenExam(config),
        startOSCE: (caseId) => startComplexivoOralOSCE(caseId),
        getBlueprint: (careerId) => loadComplexivoBlueprintByCareer(careerId)
    };
}

// ============================================================================
// 8. RENDERIZADO PRINCIPAL DEL SHELL CYBER-MEDICAL HUD
// ============================================================================

export function loadComplexivoBlueprintByCareer(careerId = complexivoState.selectedCareer) {
    return (
        COMPLEXIVO_CAREERS_BLUEPRINT[careerId] ||
        COMPLEXIVO_CAREERS_BLUEPRINT.medicina
    );
}

function renderComplexivoBootcampShell() {
    const mount = complexivoState.mountElement;
    if (!mount) return;

    const blueprint = loadComplexivoBlueprintByCareer(complexivoState.selectedCareer);
    const totalTasks = BOOTCAMP_4_WEEKS_PLAN.reduce((acc, w) => acc + w.tasks.length, 0);
    const completedCount = complexivoState.completedTasks.size;
    const progressPct = Math.round((completedCount / totalTasks) * 100);

    mount.innerHTML = `
        <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 shadow-[0_0_35px_rgba(0,229,255,0.08)] space-y-6">
            <!-- CABECERA DEL MOTOR COMPLEXIVO -->
            <div class="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-surface-high">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/40">
                            CARPETA 9 • MOTOR DE TITULACIÓN UNIVERSITARIA
                        </span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/40">
                            ${blueprint.ponderacionTeorica}% Escrito + ${blueprint.ponderacionPractica}% Práctico/ECOE
                        </span>
                    </div>
                    <h2 class="text-2xl font-extrabold text-white flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-3xl">${blueprint.icono}</span>
                        <span>Bootcamp Intensivo Examen Complexivo • ${escapeHtml(blueprint.nombre)}</span>
                    </h2>
                    <p class="text-xs text-gray-400">
                        Preparación integral de fin de carrera por ejes curriculares, simulador escrito multidisciplinario y defensa oral ante tribunal.
                    </p>
                </div>

                <!-- SELECTOR DE LAS 11 CARRERAS DE SALUD -->
                <div class="flex flex-wrap items-center gap-3">
                    <div class="bg-surface border border-surface-high rounded-xl px-3 py-2">
                        <label for="complexivo-career-select" class="block text-[10px] font-mono text-gray-400 uppercase">
                            Carrera de Titulación (11 Áreas)
                        </label>
                        <select
                            id="complexivo-career-select"
                            class="bg-transparent text-xs font-extrabold text-primary focus:outline-none cursor-pointer pr-2 mt-0.5"
                        >
                            ${Object.values(COMPLEXIVO_CAREERS_BLUEPRINT)
                                .map(
                                    (c) => `
                                    <option value="${c.id}" class="bg-[#06090e] text-white" ${c.id === complexivoState.selectedCareer ? "selected" : ""}>
                                        ${escapeHtml(c.nombre)}
                                    </option>
                                `
                                )
                                .join("")}
                        </select>
                    </div>

                    <div class="bg-surface border border-secondary/40 rounded-xl px-4 py-2 text-right">
                        <span class="block text-[10px] font-mono text-gray-400 uppercase">Avance Bootcamp</span>
                        <span class="text-sm font-extrabold font-mono text-secondary">${progressPct}% (${completedCount}/${totalTasks})</span>
                    </div>
                </div>
            </div>

            <!-- TARJETAS DE PONDERACIÓN DE LOS 4 EJES CURRICULARES -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                ${blueprint.ejes
                    .map(
                        (eje) => `
                        <div class="bg-[#06090e] border border-surface-high hover:border-primary/50 rounded-xl p-4 transition-all flex flex-col justify-between">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-1.5">
                                    <span class="text-[10px] font-mono uppercase text-primary font-bold">Peso Curricular</span>
                                    <span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-xs font-extrabold">${eje.peso}%</span>
                                </div>
                                <h4 class="text-xs font-extrabold text-white leading-snug mb-2">${escapeHtml(eje.nombre)}</h4>
                            </div>
                            <div class="flex flex-wrap gap-1 pt-2 border-t border-surface-high/60">
                                ${eje.materias
                                    .slice(0, 4)
                                    .map(
                                        (m) => `
                                        <span class="px-2 py-0.5 rounded bg-surface text-[10px] text-gray-300 border border-gray-800">
                                            ${escapeHtml(m)}
                                        </span>
                                    `
                                    )
                                    .join("")}
                            </div>
                        </div>
                    `
                    )
                    .join("")}
            </div>

            <!-- BARRA DE NAVEGACIÓN DE LAS 4 SUB-VISTAS DEL BOOTCAMP -->
            <div class="flex flex-wrap items-center gap-2 bg-[#06090e] p-2 rounded-xl border border-surface-high">
                <button
                    type="button"
                    data-cx-tab="roadmap"
                    class="cx-tab-btn flex-1 min-w-[170px] py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono transition-all flex items-center justify-center gap-2 ${
                        complexivoState.activeSubTab === "roadmap"
                            ? "bg-primary text-[#06090e] shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                            : "text-gray-400 hover:text-white hover:bg-surface"
                    }"
                >
                    <span class="material-symbols-outlined text-base">calendar_month</span>
                    <span>1. Ruta Bootcamp (4 Semanas)</span>
                </button>

                <button
                    type="button"
                    data-cx-tab="written"
                    class="cx-tab-btn flex-1 min-w-[170px] py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono transition-all flex items-center justify-center gap-2 ${
                        complexivoState.activeSubTab === "written"
                            ? "bg-primary text-[#06090e] shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                            : "text-gray-400 hover:text-white hover:bg-surface"
                    }"
                >
                    <span class="material-symbols-outlined text-base">quiz</span>
                    <span>2. Simulador Escrito (60%)</span>
                </button>

                <button
                    type="button"
                    data-cx-tab="osce"
                    class="cx-tab-btn flex-1 min-w-[170px] py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono transition-all flex items-center justify-center gap-2 ${
                        complexivoState.activeSubTab === "osce"
                            ? "bg-primary text-[#06090e] shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                            : "text-gray-400 hover:text-white hover:bg-surface"
                    }"
                >
                    <span class="material-symbols-outlined text-base">record_voice_over</span>
                    <span>3. Defensa Oral / ECOE (40%)</span>
                </button>

                <button
                    type="button"
                    data-cx-tab="compendiums"
                    class="cx-tab-btn flex-1 min-w-[170px] py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono transition-all flex items-center justify-center gap-2 ${
                        complexivoState.activeSubTab === "compendiums"
                            ? "bg-primary text-[#06090e] shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                            : "text-gray-400 hover:text-white hover:bg-surface"
                    }"
                >
                    <span class="material-symbols-outlined text-base">menu_book</span>
                    <span>4. Compendios y Guías PDF</span>
                </button>
            </div>

            <!-- CONTENEDOR DINÁMICO DE SUB-VISTAS -->
            <div id="complexivo-subview-body" class="pt-1"></div>
        </div>
    `;

    // Evento de cambio de carrera
    mount.querySelector("#complexivo-career-select")?.addEventListener("change", (e) => {
        complexivoState.selectedCareer = e.target.value;
        saveProgressToLocal();
        renderComplexivoBootcampShell();
    });

    // Eventos de pestañas internas
    mount.querySelectorAll(".cx-tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            complexivoState.activeSubTab = btn.dataset.cxTab;
            renderComplexivoBootcampShell();
        });
    });

    renderActiveComplexivoSubView();
}

function renderActiveComplexivoSubView() {
    const container = document.getElementById("complexivo-subview-body");
    if (!container) return;

    if (complexivoState.activeSubTab === "roadmap") {
        renderBootcampRoadmap(complexivoState.selectedCareer, complexivoState.selectedWeek, container);
    } else if (complexivoState.activeSubTab === "written") {
        renderWrittenExamSubView(container);
    } else if (complexivoState.activeSubTab === "osce") {
        renderOralOSCESubView(container);
    } else if (complexivoState.activeSubTab === "compendiums") {
        renderCompendiumsSubView(container);
    }
}

// ============================================================================
// 9. SUB-VISTA 1: RUTA BOOTCAMP INTENSIVA DE 4 SEMANAS
// ============================================================================

export function renderBootcampRoadmap(
    careerId = complexivoState.selectedCareer,
    weekNumber = complexivoState.selectedWeek,
    targetContainer = null
) {
    const container = targetContainer || document.getElementById("complexivo-subview-body");
    if (!container) return;

    const activeWeekObj =
        BOOTCAMP_4_WEEKS_PLAN.find((w) => w.week === Number(weekNumber)) ||
        BOOTCAMP_4_WEEKS_PLAN[0];

    container.innerHTML = `
        <div class="space-y-5">
            <!-- Selector de las 4 Semanas -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${BOOTCAMP_4_WEEKS_PLAN.map((w) => {
                    const weekDone = w.tasks.filter((t) => complexivoState.completedTasks.has(t.id)).length;
                    const isSelected = w.week === activeWeekObj.week;
                    return `
                        <button
                            type="button"
                            data-week-btn="${w.week}"
                            class="text-left p-4 rounded-xl border transition-all ${
                                isSelected
                                    ? "bg-surface-high border-primary shadow-[0_0_20px_rgba(0,229,255,0.15)]"
                                    : "bg-[#06090e] border-surface-high hover:border-gray-600"
                            }"
                        >
                            <div class="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span class="text-primary font-extrabold">${escapeHtml(w.badge)}</span>
                                <span class="text-secondary font-bold">${weekDone}/${w.tasks.length} completadas</span>
                            </div>
                            <div class="text-sm font-extrabold text-white">Semana ${w.week}</div>
                            <div class="text-[11px] text-gray-400 truncate mt-0.5">${escapeHtml(w.title.replace(/^Semana \d:\s*/, ""))}</div>
                        </button>
                    `;
                }).join("")}
            </div>

            <!-- Detalle de la Semana Seleccionada -->
            <div class="bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-high">
                    <div>
                        <h3 class="text-lg font-extrabold text-white">${escapeHtml(activeWeekObj.title)}</h3>
                        <p class="text-xs text-gray-400">${escapeHtml(activeWeekObj.subtitle)}</p>
                    </div>
                    <button
                        type="button"
                        id="btn-cx-quick-sim"
                        class="px-4 py-2 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all flex items-center gap-1.5"
                    >
                        <span class="material-symbols-outlined text-base">bolt</span>
                        <span>Lanzar Práctica de esta Semana</span>
                    </button>
                </div>

                <div class="space-y-3">
                    ${activeWeekObj.tasks
                        .map((task) => {
                            const isChecked = complexivoState.completedTasks.has(task.id);
                            return `
                                <div class="p-4 rounded-xl border ${
                                    isChecked
                                        ? "bg-secondary/10 border-secondary/40"
                                        : "bg-surface border-surface-high"
                                } flex flex-wrap items-center justify-between gap-4 transition-all">
                                    <label class="flex items-start gap-3 cursor-pointer flex-1">
                                        <input
                                            type="checkbox"
                                            data-task-check="${task.id}"
                                            class="mt-1 w-4 h-4 accent-secondary rounded cursor-pointer"
                                            ${isChecked ? "checked" : ""}
                                        />
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <span class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#06090e] text-primary border border-primary/30">
                                                    ${escapeHtml(task.day)}
                                                </span>
                                                <span class="text-[11px] font-mono text-gray-400">⏱ ${task.mins} min</span>
                                            </div>
                                            <div class="text-sm font-bold text-white mt-1 ${isChecked ? "line-through text-gray-400" : ""}">
                                                ${escapeHtml(task.title)}
                                            </div>
                                        </div>
                                    </label>

                                    <button
                                        type="button"
                                        data-task-launch="${task.type}"
                                        data-task-eje="${task.eje || "todos"}"
                                        class="px-3 py-1.5 rounded-lg bg-[#06090e] border border-primary/40 text-primary hover:bg-primary hover:text-[#06090e] text-xs font-mono font-bold transition-all"
                                    >
                                        Ejecutar Módulo →
                                    </button>
                                </div>
                            `;
                        })
                        .join("")}
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll("[data-week-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
            complexivoState.selectedWeek = Number(btn.dataset.weekBtn);
            renderBootcampRoadmap(careerId, complexivoState.selectedWeek, container);
        });
    });

    container.querySelectorAll("[data-task-check]").forEach((chk) => {
        chk.addEventListener("change", () => {
            const taskId = chk.dataset.taskCheck;
            if (chk.checked) {
                complexivoState.completedTasks.add(taskId);
            } else {
                complexivoState.completedTasks.delete(taskId);
            }
            saveProgressToLocal();
            renderComplexivoBootcampShell();
        });
    });

    container.querySelectorAll("[data-task-launch]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.taskLaunch;
            const eje = btn.dataset.taskEje || "todos";
            if (type === "compendio") {
                complexivoState.activeSubTab = "compendiums";
                renderComplexivoBootcampShell();
            } else if (type === "osce_prep") {
                complexivoState.activeSubTab = "osce";
                renderComplexivoBootcampShell();
            } else {
                complexivoState.activeSubTab = "written";
                renderComplexivoBootcampShell();
                startComplexivoWrittenExam({ axisFilter: eje, mode: "tutor" });
            }
        });
    });

    container.querySelector("#btn-cx-quick-sim")?.addEventListener("click", () => {
        complexivoState.activeSubTab = "written";
        renderComplexivoBootcampShell();
        startComplexivoWrittenExam({ axisFilter: "todos", mode: "tutor" });
    });
}

// ============================================================================
// 10. SUB-VISTA 2: SIMULADOR ESCRITO MULTIDISCIPLINARIO (60% DE LA NOTA)
// ============================================================================

function renderWrittenExamSubView(container) {
    const blueprint = loadComplexivoBlueprintByCareer(complexivoState.selectedCareer);
    const exam = complexivoState.writtenExam;

    if (!exam.active) {
        container.innerHTML = `
            <div class="bg-[#06090e] border border-surface-high rounded-2xl p-6 space-y-6">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <span class="text-[10px] font-mono uppercase text-primary font-bold">Componente Escrito Integrador (60% Nota de Titulación)</span>
                        <h3 class="text-xl font-extrabold text-white mt-0.5">Configurador de Simulacro Complexivo • ${escapeHtml(blueprint.nombre)}</h3>
                        <p class="text-xs text-gray-400">Evalúa casos clínicos multidisciplinarios filtrados por eje de formación o examen global integrador.</p>
                    </div>
                </div>

                ${
                    exam.lastResult
                        ? `
                    <div class="p-4 rounded-xl bg-secondary/10 border border-secondary/40 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">Último Resultado Registrado</span>
                            <div class="text-sm font-extrabold text-white">
                                Calificación Complexivo Escrito: ${exam.lastResult.score.toFixed(1)} / 100 (${exam.lastResult.correct}/${exam.lastResult.total} aciertos)
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-lg font-mono text-xs font-extrabold ${
                            exam.lastResult.score >= 70
                                ? "bg-secondary text-[#06090e]"
                                : "bg-danger text-white"
                        }">
                            ${exam.lastResult.score >= 70 ? "APTO PARA TITULACIÓN (≥70%)" : "REQUIERE REFUERZO (<70%)"}
                        </span>
                    </div>
                `
                        : ""
                }

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="p-4 rounded-xl bg-surface border border-surface-high space-y-2">
                        <label class="block text-xs font-mono text-gray-300 font-bold">1. Selecciona el Eje Curricular a Evaluar</label>
                        <select id="cx-written-axis" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white font-bold">
                            <option value="todos">🌐 Examen Integrador Completo (Todos los 4 Ejes Curriculares)</option>
                            ${blueprint.ejes
                                .map(
                                    (e) => `
                                <option value="${e.id}">📌 ${escapeHtml(e.nombre)} (Peso: ${e.peso}%)</option>
                            `
                                )
                                .join("")}
                        </select>
                    </div>

                    <div class="p-4 rounded-xl bg-surface border border-surface-high space-y-2">
                        <label class="block text-xs font-mono text-gray-300 font-bold">2. Modalidad de Retroalimentación</label>
                        <select id="cx-written-mode" class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-white font-bold">
                            <option value="tutor">🧠 Modo Bootcamp Tutor (Racional Clínico Inmediato)</option>
                            <option value="oficial">⏱️ Modo Examen de Grado Oficial (Sin pistas hasta entregar)</option>
                        </select>
                    </div>
                </div>

                <div class="flex justify-end">
                    <button
                        type="button"
                        id="btn-start-cx-written"
                        class="px-6 py-3 rounded-xl bg-primary text-[#06090e] font-extrabold text-sm hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.25)]"
                    >
                        <span class="material-symbols-outlined">play_arrow</span>
                        <span>Iniciar Simulacro Complexivo Escrito</span>
                    </button>
                </div>
            </div>
        `;

        container.querySelector("#btn-start-cx-written")?.addEventListener("click", () => {
            const axisFilter = container.querySelector("#cx-written-axis")?.value || "todos";
            const mode = container.querySelector("#cx-written-mode")?.value || "tutor";
            startComplexivoWrittenExam({ axisFilter, mode });
        });
        return;
    }

    // Vista de Examen Escrito Activo
    const q = exam.questions[exam.currentIndex];
    const userAns = exam.answers[exam.currentIndex];
    const isAnswered = userAns !== undefined;

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <!-- Panel Izquierdo: Enunciado, Opciones y Racional -->
            <div class="lg:col-span-3 bg-[#06090e] border border-surface-high rounded-2xl p-6 space-y-5">
                <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-surface-high">
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-lg bg-primary/15 text-primary font-mono text-xs font-extrabold">
                            Reactivo ${exam.currentIndex + 1} / ${exam.questions.length}
                        </span>
                        <span class="px-2.5 py-1 rounded-lg bg-surface text-gray-300 font-mono text-xs border border-surface-high">
                            ${escapeHtml(q.materia || "Caso Integrador")}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span id="cx-written-timer" class="px-3 py-1 rounded-lg bg-surface border border-warning/40 text-warning font-mono text-sm font-extrabold">
                            ${formatSecondsMMSS(exam.timeRemainingSec)}
                        </span>
                        <button
                            type="button"
                            id="btn-cx-mark-review"
                            class="px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${
                                exam.marked.has(exam.currentIndex)
                                    ? "bg-warning text-[#06090e] border-warning"
                                    : "bg-surface text-gray-300 border-surface-high hover:border-warning"
                            }"
                        >
                            ⚑ Marcar
                        </button>
                    </div>
                </div>

                <p class="text-sm md:text-base text-gray-100 leading-relaxed font-medium">
                    ${escapeHtml(q.enunciado)}
                </p>

                <div class="space-y-3" id="cx-written-options">
                    ${["A", "B", "C", "D"]
                        .map((letter) => {
                            const text = q.opciones?.[letter];
                            if (!text) return "";

                            let cls =
                                "w-full text-left p-4 rounded-xl border text-xs md:text-sm transition-all flex gap-3 items-start ";
                            if (isAnswered && exam.mode === "tutor") {
                                if (letter === q.respuestaCorrecta) {
                                    cls += "border-secondary bg-secondary/15 text-white";
                                } else if (userAns.chosen === letter) {
                                    cls += "border-danger bg-danger/15 text-white";
                                } else {
                                    cls += "border-surface-high bg-surface text-gray-500 opacity-60";
                                }
                            } else if (isAnswered && userAns.chosen === letter) {
                                cls += "border-primary bg-primary/15 text-white";
                            } else {
                                cls += "border-surface-high bg-surface text-gray-200 hover:border-primary/60";
                            }

                            return `
                                <button
                                    type="button"
                                    data-cx-opt="${letter}"
                                    class="${cls}"
                                    ${isAnswered && exam.mode === "tutor" ? "disabled" : ""}
                                >
                                    <span class="font-extrabold font-mono text-primary">${letter}.</span>
                                    <span>${escapeHtml(text)}</span>
                                </button>
                            `;
                        })
                        .join("")}
                </div>

                ${
                    isAnswered && exam.mode === "tutor"
                        ? `
                    <div class="p-4 rounded-xl bg-surface border-l-4 border-secondary space-y-1">
                        <div class="text-xs font-mono font-extrabold text-secondary uppercase">
                            Sustento Científico y Racional de Titulación
                        </div>
                        <p class="text-xs text-gray-300 leading-relaxed">
                            ${escapeHtml(q.racional || "Respuesta verificada conforme a la guía de práctica clínica.")}
                        </p>
                    </div>
                `
                        : ""
                }

                <div class="flex items-center justify-between pt-4 border-t border-surface-high">
                    <button
                        type="button"
                        id="btn-cx-prev-q"
                        class="px-4 py-2 rounded-xl bg-surface border border-surface-high text-gray-300 hover:text-white text-xs font-bold"
                        ${exam.currentIndex === 0 ? "disabled" : ""}
                    >
                        ← Anterior
                    </button>

                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            id="btn-cx-finish-exam"
                            class="px-4 py-2 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90"
                        >
                            Calificar Simulacro
                        </button>
                        ${
                            exam.currentIndex < exam.questions.length - 1
                                ? `
                            <button
                                type="button"
                                id="btn-cx-next-q"
                                class="px-4 py-2 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90"
                            >
                                Siguiente →
                            </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            </div>

            <!-- Panel Derecho: Matriz de Reactivos -->
            <div class="bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-4 h-fit">
                <div class="text-xs font-mono font-extrabold text-gray-300 uppercase">
                    Matriz de Reactivos
                </div>
                <div class="grid grid-cols-5 gap-2">
                    ${exam.questions
                        .map((_, idx) => {
                            let mCls =
                                "aspect-square rounded-lg font-mono text-xs font-extrabold flex items-center justify-center border ";
                            if (idx === exam.currentIndex) mCls += "ring-2 ring-white ";
                            if (exam.answers[idx]) {
                                mCls += "bg-primary text-[#06090e] border-primary";
                            } else if (exam.marked.has(idx)) {
                                mCls += "bg-warning text-[#06090e] border-warning";
                            } else {
                                mCls += "bg-surface text-gray-400 border-surface-high";
                            }
                            return `<button type="button" data-cx-jump="${idx}" class="${mCls}">${idx + 1}</button>`;
                        })
                        .join("")}
                </div>
                <button
                    type="button"
                    id="btn-cx-abort-exam"
                    class="w-full py-2 rounded-xl bg-surface border border-danger/40 text-danger hover:bg-danger hover:text-white text-xs font-bold transition-all"
                >
                    Salir del Simulacro
                </button>
            </div>
        </div>
    `;

    container.querySelectorAll("[data-cx-opt]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const letter = btn.dataset.cxOpt;
            exam.answers[exam.currentIndex] = {
                chosen: letter,
                isCorrect: letter === q.respuestaCorrecta
            };
            renderWrittenExamSubView(container);
        });
    });

    container.querySelector("#btn-cx-mark-review")?.addEventListener("click", () => {
        if (exam.marked.has(exam.currentIndex)) {
            exam.marked.delete(exam.currentIndex);
        } else {
            exam.marked.add(exam.currentIndex);
        }
        renderWrittenExamSubView(container);
    });

    container.querySelector("#btn-cx-prev-q")?.addEventListener("click", () => {
        if (exam.currentIndex > 0) {
            exam.currentIndex--;
            renderWrittenExamSubView(container);
        }
    });

    container.querySelector("#btn-cx-next-q")?.addEventListener("click", () => {
        if (exam.currentIndex < exam.questions.length - 1) {
            exam.currentIndex++;
            renderWrittenExamSubView(container);
        }
    });

    container.querySelectorAll("[data-cx-jump]").forEach((btn) => {
        btn.addEventListener("click", () => {
            exam.currentIndex = Number(btn.dataset.cxJump);
            renderWrittenExamSubView(container);
        });
    });

    container.querySelector("#btn-cx-finish-exam")?.addEventListener("click", () => {
        finishComplexivoWrittenExam();
    });

    container.querySelector("#btn-cx-abort-exam")?.addEventListener("click", () => {
        clearInterval(exam.timerInterval);
        exam.active = false;
        renderWrittenExamSubView(container);
    });
}

export async function startComplexivoWrittenExam(config = {}) {
    const careerId = complexivoState.selectedCareer;
    const axisFilter = config.axisFilter || "todos";
    const mode = config.mode || "tutor";

    let pool = COMPLEXIVO_SEED_QUESTIONS.filter(
        (q) => q.carrera === careerId || q.carrera === "todas"
    );

    if (Array.isArray(window.makaiData?.semillaCasos)) {
        const extra = window.makaiData.semillaCasos.filter((c) => c.carrera === careerId);
        pool = [...pool, ...extra];
    }

    if (pool.length === 0) {
        pool = [...COMPLEXIVO_SEED_QUESTIONS];
    }

    if (axisFilter !== "todos") {
        const filteredByAxis = pool.filter((q) => q.eje === axisFilter);
        if (filteredByAxis.length > 0) pool = filteredByAxis;
    }

    const exam = complexivoState.writtenExam;
    exam.active = true;
    exam.axisFilter = axisFilter;
    exam.mode = mode;
    exam.questions = pool;
    exam.currentIndex = 0;
    exam.answers = {};
    exam.marked = new Set();
    exam.timeRemainingSec = Math.max(15 * 60, pool.length * 90);

    clearInterval(exam.timerInterval);
    exam.timerInterval = setInterval(() => {
        exam.timeRemainingSec--;
        const timerEl = document.getElementById("cx-written-timer");
        if (timerEl) timerEl.textContent = formatSecondsMMSS(exam.timeRemainingSec);
        if (exam.timeRemainingSec <= 0) {
            finishComplexivoWrittenExam();
        }
    }, 1000);

    renderActiveComplexivoSubView();
}

async function finishComplexivoWrittenExam() {
    const exam = complexivoState.writtenExam;
    clearInterval(exam.timerInterval);

    let correct = 0;
    const total = exam.questions.length || 1;
    Object.values(exam.answers).forEach((a) => {
        if (a.isCorrect) correct++;
    });

    const score = (correct / total) * 100;
    exam.lastResult = {
        score,
        correct,
        total,
        career: complexivoState.selectedCareer,
        completedAt: new Date().toISOString()
    };
    exam.active = false;

    await syncComplexivoProgressToFirestore({
        type: "written_exam",
        ...exam.lastResult
    });

    renderActiveComplexivoSubView();
}

// ============================================================================
// 11. SUB-VISTA 3: SIMULADOR DE DEFENSA ORAL / ECOE ANTE TRIBUNAL (40%)
// ============================================================================

function renderOralOSCESubView(container) {
    const careerId = complexivoState.selectedCareer;
    const availableCases = COMPLEXIVO_ORAL_OSCE_CASES.filter(
        (c) => c.carrera === careerId || c.carrera === "todas"
    );
    const activeCase =
        availableCases.find((c) => c.id === complexivoState.osceSession.activeCaseId) ||
        availableCases[0] ||
        COMPLEXIVO_ORAL_OSCE_CASES[0];

    complexivoState.osceSession.activeCaseId = activeCase.id;
    const evalResult = complexivoState.osceSession.lastEvaluation;

    container.innerHTML = `
        <div class="space-y-6">
            <!-- Barra Superior: Selector de Estación ECOE y Cronómetro de Tribunal -->
            <div class="bg-[#06090e] border border-surface-high rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div class="space-y-1">
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        Componente Práctico / Oral ante Tribunal (40% Nota de Titulación)
                    </span>
                    <div class="flex flex-wrap items-center gap-3">
                        <select
                            id="cx-osce-case-select"
                            class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs font-extrabold text-white"
                        >
                            ${COMPLEXIVO_ORAL_OSCE_CASES.map(
                                (c) => `
                                <option value="${c.id}" ${c.id === activeCase.id ? "selected" : ""}>
                                    ${escapeHtml(c.titulo)}
                                </option>
                            `
                            ).join("")}
                        </select>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="px-4 py-2 rounded-xl bg-surface border border-primary/40 text-center">
                        <span class="block text-[10px] font-mono text-gray-400 uppercase">Cronómetro Estación</span>
                        <span id="cx-osce-timer-display" class="text-base font-mono font-extrabold text-primary">
                            ${formatSecondsMMSS(complexivoState.osceSession.timerSec)}
                        </span>
                    </div>
                    <button
                        type="button"
                        id="btn-cx-osce-toggle-timer"
                        class="px-4 py-2.5 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90"
                    >
                        ${complexivoState.osceSession.timerRunning ? "⏸ Pausar" : "▶ Iniciar 15:00"}
                    </button>
                </div>
            </div>

            <!-- Viñeta del Caso Clínico Integrador + Preguntas del Jurado -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div class="lg:col-span-1 bg-[#06090e] border border-primary/30 rounded-2xl p-5 space-y-4">
                    <div>
                        <span class="px-2.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-extrabold uppercase">
                            Caso Clínico Sorteado
                        </span>
                        <h4 class="text-sm font-extrabold text-white mt-2">${escapeHtml(activeCase.titulo)}</h4>
                        <p class="text-xs text-gray-300 leading-relaxed mt-2">
                            ${escapeHtml(activeCase.escenario)}
                        </p>
                    </div>

                    <div class="pt-3 border-t border-surface-high space-y-2">
                        <div class="text-xs font-mono font-extrabold text-warning uppercase">
                            Preguntas de Réplica del Tribunal
                        </div>
                        <ul class="space-y-2 text-xs text-gray-300">
                            ${activeCase.preguntasTribunal
                                .map(
                                    (q) => `
                                <li class="p-2.5 rounded-lg bg-surface border border-surface-high">
                                    ${escapeHtml(q)}
                                </li>
                            `
                                )
                                .join("")}
                        </ul>
                    </div>
                </div>

                <!-- Formulario Estructurado de Defensa en 4 Bloques de Rúbrica -->
                <div class="lg:col-span-2 bg-[#06090e] border border-surface-high rounded-2xl p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-extrabold text-white">
                            Estructuración de tu Defensa Oral / Escrita (Rúbrica sobre 100 Puntos)
                        </h4>
                        <span class="text-[11px] font-mono text-gray-400">4 Criterios × 25 pts</span>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-mono text-primary font-bold mb-1">
                                1. Identificación Sindrómica y Escalas (25 pts)
                            </label>
                            <textarea
                                id="osce-input-sindromico"
                                rows="3"
                                placeholder="Describe los síndromes clínicos, signos de alarma y escalas de gravedad..."
                                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                            ></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-mono text-primary font-bold mb-1">
                                2. Diagnóstico Definitivo y Diferenciales (25 pts)
                            </label>
                            <textarea
                                id="osce-input-diagnostico"
                                rows="3"
                                placeholder="Plantea el diagnóstico definitivo y al menos 2 diagnósticos diferenciales..."
                                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                            ></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-mono text-primary font-bold mb-1">
                                3. Plan Terapéutico / Intervención (25 pts)
                            </label>
                            <textarea
                                id="osce-input-terapeutico"
                                rows="3"
                                placeholder="Detalla el manejo inicial, fármacos con dosis/vías o intervenciones prioritarias..."
                                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                            ></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-mono text-primary font-bold mb-1">
                                4. Respuesta a la Réplica del Tribunal (25 pts)
                            </label>
                            <textarea
                                id="osce-input-replica"
                                rows="3"
                                placeholder="Responde a las 3 preguntas de réplica planteadas por el tribunal..."
                                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"
                            ></textarea>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            id="btn-osce-fill-model"
                            class="px-4 py-2 rounded-xl bg-surface border border-surface-high text-gray-300 hover:text-white text-xs font-mono font-bold"
                        >
                            👁️ Cargar Defensa Modelo (Pauta 100/100)
                        </button>
                        <button
                            type="button"
                            id="btn-osce-evaluate"
                            class="px-5 py-2.5 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 shadow-[0_0_20px_rgba(0,230,118,0.25)]"
                        >
                            ⚖️ Evaluar con Rúbrica del Tribunal
                        </button>
                    </div>

                    ${
                        evalResult
                            ? `
                        <div class="mt-4 p-5 rounded-2xl bg-surface border border-secondary/50 space-y-3">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <span class="text-xs font-mono font-extrabold text-secondary uppercase">
                                    Dictamen del Tribunal Calificador
                                </span>
                                <span class="px-3 py-1 rounded-lg bg-secondary/20 text-secondary font-mono text-sm font-extrabold">
                                    Puntaje Final ECOE: ${evalResult.totalScore} / 100
                                </span>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                                <div class="p-2 rounded bg-[#06090e] border border-surface-high">Sindrómico: <strong>${evalResult.breakdown.sindromico}/25</strong></div>
                                <div class="p-2 rounded bg-[#06090e] border border-surface-high">Diagnóstico: <strong>${evalResult.breakdown.diagnostico}/25</strong></div>
                                <div class="p-2 rounded bg-[#06090e] border border-surface-high">Terapéutica: <strong>${evalResult.breakdown.terapeutico}/25</strong></div>
                                <div class="p-2 rounded bg-[#06090e] border border-surface-high">Réplica: <strong>${evalResult.breakdown.replica}/25</strong></div>
                            </div>
                            <div class="text-xs text-gray-300 space-y-1 pt-2 border-t border-surface-high">
                                <div><strong class="text-primary">Pauta Oficial del Tribunal:</strong></div>
                                <p><strong>• Diagnóstico:</strong> ${escapeHtml(activeCase.modeloRespuestaIdeal.diagnostico)}</p>
                                <p><strong>• Manejo Ideal:</strong> ${escapeHtml(activeCase.modeloRespuestaIdeal.terapeutico)}</p>
                                <p><strong>• Réplica Clave:</strong> ${escapeHtml(activeCase.modeloRespuestaIdeal.replica)}</p>
                            </div>
                        </div>
                    `
                            : ""
                    }
                </div>
            </div>
        </div>
    `;

    container.querySelector("#cx-osce-case-select")?.addEventListener("change", (e) => {
        startComplexivoOralOSCE(e.target.value);
    });

    container.querySelector("#btn-cx-osce-toggle-timer")?.addEventListener("click", () => {
        toggleOSCETimer();
    });

    container.querySelector("#btn-osce-fill-model")?.addEventListener("click", () => {
        const ideal = activeCase.modeloRespuestaIdeal;
        container.querySelector("#osce-input-sindromico").value = ideal.sindromico;
        container.querySelector("#osce-input-diagnostico").value = ideal.diagnostico;
        container.querySelector("#osce-input-terapeutico").value = ideal.terapeutico;
        container.querySelector("#osce-input-replica").value = ideal.replica;
    });

    container.querySelector("#btn-osce-evaluate")?.addEventListener("click", () => {
        evaluateOralOSCEDefense({
            caseId: activeCase.id,
            sindromico: container.querySelector("#osce-input-sindromico")?.value || "",
            diagnostico: container.querySelector("#osce-input-diagnostico")?.value || "",
            terapeutico: container.querySelector("#osce-input-terapeutico")?.value || "",
            replica: container.querySelector("#osce-input-replica")?.value || ""
        });
    });
}

export function startComplexivoOralOSCE(caseId) {
    const found =
        COMPLEXIVO_ORAL_OSCE_CASES.find((c) => c.id === caseId) ||
        COMPLEXIVO_ORAL_OSCE_CASES[0];

    clearInterval(complexivoState.osceSession.timerInterval);
    complexivoState.osceSession.activeCaseId = found.id;
    complexivoState.osceSession.timerSec = (found.tiempoMinutos || 15) * 60;
    complexivoState.osceSession.timerRunning = false;
    complexivoState.osceSession.lastEvaluation = null;

    renderActiveComplexivoSubView();
}

function toggleOSCETimer() {
    const session = complexivoState.osceSession;
    if (session.timerRunning) {
        clearInterval(session.timerInterval);
        session.timerRunning = false;
    } else {
        session.timerRunning = true;
        session.timerInterval = setInterval(() => {
            session.timerSec = Math.max(0, session.timerSec - 1);
            const el = document.getElementById("cx-osce-timer-display");
            if (el) el.textContent = formatSecondsMMSS(session.timerSec);
            if (session.timerSec <= 0) {
                clearInterval(session.timerInterval);
                session.timerRunning = false;
            }
        }, 1000);
    }
    renderActiveComplexivoSubView();
}

export async function evaluateOralOSCEDefense(defensePayload = {}) {
    const activeCase =
        COMPLEXIVO_ORAL_OSCE_CASES.find((c) => c.id === defensePayload.caseId) ||
        COMPLEXIVO_ORAL_OSCE_CASES[0];

    const scoreSection = (text = "", keywords = []) => {
        const clean = normalizeAccents(text);
        if (clean.length < 15) return 5;
        let hits = 0;
        keywords.forEach((kw) => {
            if (clean.includes(normalizeAccents(kw))) hits++;
        });
        const ratio = keywords.length > 0 ? hits / Math.min(keywords.length, 4) : 0.7;
        return Math.min(25, Math.max(10, Math.round(ratio * 25)));
    };

    const breakdown = {
        sindromico: scoreSection(defensePayload.sindromico, activeCase.clavesRubrica.sindromico),
        diagnostico: scoreSection(defensePayload.diagnostico, activeCase.clavesRubrica.diagnostico),
        terapeutico: scoreSection(defensePayload.terapeutico, activeCase.clavesRubrica.terapeutico),
        replica: scoreSection(defensePayload.replica, activeCase.clavesRubrica.replica)
    };

    const totalScore =
        breakdown.sindromico +
        breakdown.diagnostico +
        breakdown.terapeutico +
        breakdown.replica;

    complexivoState.osceSession.lastEvaluation = {
        caseId: activeCase.id,
        totalScore,
        breakdown,
        evaluatedAt: new Date().toISOString()
    };

    await syncComplexivoProgressToFirestore({
        type: "osce_defense",
        ...complexivoState.osceSession.lastEvaluation
    });

    renderActiveComplexivoSubView();
}

// ============================================================================
// 12. SUB-VISTA 4: BIBLIOTECA DE COMPENDIOS (assets/9-multimedia-titulacion/)
// ============================================================================

function renderCompendiumsSubView(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-[#06090e] border border-surface-high rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        Bóveda Documental • ${COMPLEXIVO_ASSETS_PATH}
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Compendios Integradores y Guías Oficiales de Fin de Carrera
                    </h3>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${COMPLEXIVO_COMPENDIUM_LIBRARY.map(
                    (comp) => `
                    <div class="bg-[#06090e] border border-surface-high hover:border-primary/50 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-[10px] font-mono">
                                <span class="px-2.5 py-0.5 rounded bg-primary/15 text-primary font-extrabold uppercase">
                                    ${comp.carrera === "todas" ? "UNIVERSAL (11 CARRERAS)" : escapeHtml(comp.carrera.toUpperCase())}
                                </span>
                                <span class="text-gray-400">📄 ${comp.paginas} páginas</span>
                            </div>
                            <h4 class="text-sm font-extrabold text-white">${escapeHtml(comp.titulo)}</h4>
                            <div class="flex flex-wrap gap-1.5">
                                ${comp.ejesCubiertos
                                    .map(
                                        (eje) => `
                                    <span class="px-2 py-0.5 rounded bg-surface border border-surface-high text-[10px] text-gray-300">
                                        ${escapeHtml(eje)}
                                    </span>
                                `
                                    )
                                    .join("")}
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-3 border-t border-surface-high">
                            <span class="text-[10px] font-mono text-gray-500 truncate max-w-[200px]">
                                ${escapeHtml(comp.archivoPdf)}
                            </span>
                            <button
                                type="button"
                                data-open-compendium="${comp.id}"
                                class="px-4 py-2 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all"
                            >
                                Abrir Compendio →
                            </button>
                        </div>
                    </div>
                `
                ).join("")}
            </div>

            <div id="cx-compendium-preview-modal" class="hidden"></div>
        </div>
    `;

    container.querySelectorAll("[data-open-compendium]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openComplexivoCompendium(btn.dataset.openCompendium);
        });
    });
}

export async function openComplexivoCompendium(guideId) {
    const comp =
        COMPLEXIVO_COMPENDIUM_LIBRARY.find((c) => c.id === guideId) ||
        COMPLEXIVO_COMPENDIUM_LIBRARY[0];

    const pdfUrl = `${COMPLEXIVO_ASSETS_PATH}${comp.archivoPdf}`;
    let fileExists = false;

    try {
        const res = await fetch(pdfUrl, { method: "HEAD", cache: "no-cache" });
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (res.ok && contentType.includes("pdf")) {
            fileExists = true;
        }
    } catch (e) {
        fileExists = false;
    }

    if (fileExists && hasFullComplexivoAccess()) {
        window.open(pdfUrl, "_blank");
        return;
    }

    const previewBox = document.getElementById("cx-compendium-preview-modal");
    if (!previewBox) return;

    previewBox.className =
        "p-5 rounded-2xl bg-[#06090e] border-2 border-primary/50 space-y-3 shadow-2xl";
    previewBox.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-extrabold text-primary uppercase">
                Resumen Táctico de AltaRentabilidad • ${escapeHtml(comp.titulo)}
            </span>
            <button
                type="button"
                id="btn-close-comp-preview"
                class="text-xs font-mono text-gray-400 hover:text-white"
            >
                ✕ Cerrar
            </button>
        </div>
        <ul class="space-y-2 text-xs text-gray-200">
            ${comp.resumenTactico
                .map(
                    (item) => `
                <li class="p-3 rounded-xl bg-surface border border-surface-high flex items-start gap-2">
                    <span class="text-secondary font-bold">✓</span>
                    <span>${escapeHtml(item)}</span>
                </li>
            `
                )
                .join("")}
        </ul>
        <div class="text-[11px] font-mono text-gray-400">
            Ruta vinculada en repositorio: <code class="text-primary">${escapeHtml(pdfUrl)}</code>
        </div>
    `;

    previewBox.querySelector("#btn-close-comp-preview")?.addEventListener("click", () => {
        previewBox.className = "hidden";
    });
}

// ============================================================================
// 13. PERSISTENCIA EN CLOUD FIRESTORE Y LOCALSTORAGE
// ============================================================================

function loadSavedProgressFromLocal() {
    try {
        const raw = localStorage.getItem("makai_complexivo_progress_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.selectedCareer && COMPLEXIVO_CAREERS_BLUEPRINT[parsed.selectedCareer]) {
            complexivoState.selectedCareer = parsed.selectedCareer;
        }
        if (Array.isArray(parsed.completedTasks)) {
            complexivoState.completedTasks = new Set(parsed.completedTasks);
        }
    } catch (e) {
        // Silencioso si localStorage está restringido
    }
}

function saveProgressToLocal() {
    try {
        localStorage.setItem(
            "makai_complexivo_progress_v1",
            JSON.stringify({
                selectedCareer: complexivoState.selectedCareer,
                completedTasks: Array.from(complexivoState.completedTasks)
            })
        );
    } catch (e) {}
}

export async function syncComplexivoProgressToFirestore(summary = {}) {
    saveProgressToLocal();
    const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid;
    if (!uid || !db) return;

    try {
        await setDoc(
            doc(db, "usuarios", uid),
            {
                ultimoAvanceComplexivo: {
                    ...summary,
                    tareasBootcampCompletadas: complexivoState.completedTasks.size,
                    updatedAt: new Date().toISOString()
                }
            },
            { merge: true }
        );
    } catch (e) {
        console.warn("Progreso Complexivo guardado localmente:", e);
    }
}

// ============================================================================
// 14. UTILIDADES DE FORMATO Y SANITIZACIÓN
// ============================================================================

function formatSecondsMMSS(totalSeconds = 0) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const m = Math.floor(safe / 60)
        .toString()
        .padStart(2, "0");
    const s = (safe % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function normalizeAccents(str = "") {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
