// js/2-core/curriculum.data.js
// Diccionario Curricular Oficial de Makai Academy (11 Carreras + 4 CACES + Casos Semilla)

export const HEALTH_CAREERS_11 = [
    { id: "medicina", nombre: "Medicina Humana", semestres: 12, caces: true, icono: "stethoscope", descripcion: "Preuniversitario, Nivelación, 1.º a 10.º Semestre + Internado Rotativo (11.º y 12.º)" },
    { id: "enfermeria", nombre: "Enfermería & Cuidados Críticos", semestres: 9, caces: true, icono: "medical_services", descripcion: "Preuniversitario, Nivelación y 1.º a 9.º Semestre con Internado Rotativo" },
    { id: "obstetricia", nombre: "Obstetricia & Salud Materna", semestres: 9, caces: true, icono: "pregnant_woman", descripcion: "Preuniversitario, Nivelación y 1.º a 9.º Semestre Materno-Perinatal" },
    { id: "odontologia", nombre: "Odontología Clínica", semestres: 10, caces: true, icono: "dentistry", descripcion: "Preuniversitario, Nivelación y 1.º a 10.º Semestre Estomatológico" },
    { id: "fisioterapia", nombre: "Fisioterapia y Rehabilitación", semestres: 8, caces: false, icono: "accessibility_new", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" },
    { id: "laboratorio", nombre: "Laboratorio Clínico", semestres: 8, caces: false, icono: "biotech", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" },
    { id: "psicologia", nombre: "Psicología Clínica", semestres: 8, caces: false, icono: "psychology", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" },
    { id: "nutricion", nombre: "Nutrición y Dietética", semestres: 8, caces: false, icono: "nutrition", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" },
    { id: "bioquimica", nombre: "Bioquímica y Farmacia", semestres: 9, caces: false, icono: "science", descripcion: "Preuniversitario, Nivelación y 1.º a 9.º Semestre" },
    { id: "imagenologia", nombre: "Imagenología y Radiología", semestres: 8, caces: false, icono: "radiology", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" },
    { id: "prehospitalaria", nombre: "Atención Prehospitalaria y Emergencias", semestres: 8, caces: false, icono: "ambulance", descripcion: "Preuniversitario, Nivelación y 1.º a 8.º Semestre" }
];

export const CACES_OFFICIAL_SUBJECTS = {
    medicina: [
        "Medicina Interna",
        "Pediatría",
        "Ginecología y Obstetricia",
        "Cirugía General",
        "Salud Pública y Epidemiología",
        "Salud Mental y Bioética"
    ],
    enfermeria: [
        "Enfermería Clínico-Quirúrgica",
        "Enfermería Materno-Infantil",
        "Salud Comunitaria y Epidemiología",
        "Fundamentos y Proceso de Atención (PAE)",
        "Cuidados Críticos y Emergencias",
        "Administración y Bioética en Salud"
    ],
    obstetricia: [
        "Obstetricia Normal y Alto Riesgo",
        "Ginecología y Salud Sexual",
        "Neonatología y Perinatología",
        "Claves Obstétricas (Roja, Azul, Amarilla)",
        "Salud Pública Materno-Infantil",
        "Farmacología Obstétrica y Bioética"
    ],
    odontologia: [
        "Patología y Cirugía Bucal",
        "Endodoncia y Periodoncia",
        "Rehabilitación Oral y Operatoria",
        "Odontopediatría y Ortodoncia",
        "Farmacología e Imagenología Estomatológica",
        "Salud Pública y Bioseguridad Odontológica"
    ]
};

export function getUniversalSubjectsByLevel(careerId, levelKey) {
    if (levelKey === "preuniversitario") {
        return ["Biología Celular y Molecular", "Química General e Inorgánica", "Anatomía Básica de Admisión", "Razonamiento Lógico y Verbal"];
    }
    if (levelKey === "nivelacion") {
        return ["Morfofisiología Inicial", "Química Orgánica Aplicada", "Terminología Médica", "Metodología de la Investigación Científica"];
    }
    const semNum = parseInt(levelKey.replace("sem-", ""), 10) || 1;
    if (semNum <= 2) {
        return ["Anatomía descriptiva y Topográfica", "Histología y Embriología", "Fisiología Humana I", "Bioquímica Clínica y Molecular"];
    }
    if (semNum <= 4) {
        return ["Fisiopatología General", "Microbiología y Parasitología", "Farmacología Básica", "Semiología Clínica y Propedéutica"];
    }
    if (semNum <= 6) {
        return ["Medicina Interna / Clínica I", "Farmacología Terapéutica Aplicada", "Imagenología Diagnóstica", "Epidemiología y Bioestadística"];
    }
    if (semNum <= 8) {
        return ["Clínica Quirúrgica y Trauma", "Ginecología, Obstetricia y Perinatología", "Pediatría y Neonatología", "Salud Pública y Gestión MSP"];
    }
    return ["Rotación de Medicina Interna", "Rotación de Cirugía y Emergencias", "Rotación de Pediatría y Gineco-Obstetricia", "Preparación Intensiva CACES"];
}

export const SEED_CLINICAL_CASES = [
    {
        id: "seed-med-1",
        carrera: "medicina",
        materia: "Medicina Interna",
        dificultad: "Intermedio",
        enunciado: "Paciente masculino de 62 años con antecedente de HTA y diabetes mellitus tipo 2 acude a emergencia por dolor torácico opresivo retroesternal de 90 minutos de evolución, irradiado a mandíbula, acompañado de diaforesis fría. PA: 150/92 mmHg, FC: 108 lpm. El ECG muestra supradesnivel del segmento ST de 3 mm en V1-V4. ¿Cuál es la conducta inmediata de elección según las guías clínicas?",
        opciones: {
            A: "Terapia de reperfusión inmediata (angioplastia primaria o fibrinólisis según ventana) + doble antiagregación plaquetaria.",
            B: "Solicitar ergometría en banda sin fin de forma ambulatoria.",
            C: "Administrar nifedipino sublingual y dar alta médica con analgesia oral.",
            D: "Esperar 12 horas el resultado de la segunda curva de troponinas antes de iniciar tratamiento."
        },
        respuestaCorrecta: "A",
        racional: "El supradesnivel persistente del ST en derivaciones contiguas V1-V4 confirma un IAMCEST anterior extenso. El tiempo puerta-balón (<90-120 min) o puerta-aguja (<30 min) junto con AAS + inhibidor P2Y12 reduce drásticamente la mortalidad."
    },
    {
        id: "seed-med-2",
        carrera: "medicina",
        materia: "Ginecología y Obstetricia",
        dificultad: "Avanzado",
        enunciado: "Gestante de 34 semanas acude por cefalea holocraneana intensa, escotomas centelleantes y epigastralgia. Al examen físico: PA 168/112 mmHg, hiperreflexia rotuliana +++/++++. ¿Cuál es el fármaco de primera línea para la profilaxis de convulsiones (Clave Azul MSP)?",
        opciones: {
            A: "Fenitoína sódica 1 g IV en bolo rápido.",
            B: "Sulfato de magnesio (Esquema Zuspan: 4 g IV de impregnación en 20 min, seguido de 1 g/hora en infusión continua).",
            C: "Diazepam 20 mg intramuscular cada 4 horas.",
            D: "Ácido valproico vía oral cada 8 horas."
        },
        respuestaCorrecta: "B",
        racional: "En preeclampsia con criterios de severidad (PA >=160/110 + síntomas neurológicos/epigastralgia), la Clave Azul del MSP Ecuador establece el Sulfato de Magnesio (4 g IV de impregnación + 1 g/h de mantenimiento) como estándar de oro para prevenir eclampsia."
    },
    {
        id: "seed-enf-1",
        carrera: "enfermeria",
        materia: "Cuidados Críticos y Emergencias",
        dificultad: "Intermedio",
        enunciado: "Durante la administración de una solución de Cloruro de Potasio (KCl) en un paciente con hipopotasemia severa en UCI, ¿cuál es la regla de oro de seguridad clínica de enfermería?",
        opciones: {
            A: "Administrar la ampolla de KCl directamente en bolo intravenoso rápido en 1 minuto.",
            B: "Diluir siempre el KCl, nunca administrarlo en bolo directo y controlar la velocidad mediante bomba de infusión continua con monitoreo ECG.",
            C: "Administrar por vía intramuscular profunda en región glútea.",
            D: "Suspender el monitoreo cardíaco durante la infusión."
        },
        respuestaCorrecta: "B",
        racional: "El potasio concentrado es un medicamento de alto riesgo (electrolito concentrado). Su inyección IV directa en bolo provoca paro cardíaco en asistolia o fibrilación ventricular inmediata."
    },
    {
        id: "seed-obs-1",
        carrera: "obstetricia",
        materia: "Claves Obstétricas (Roja, Azul, Amarilla)",
        dificultad: "Élite",
        enunciado: "Puérpera inmediata presenta sangrado transvaginal abundante (>1000 ml) con útero blando y supraumbilical que no responde al masaje uterino bimanual inicial. ¿Cuál es la primera causa de hemorragia posparto (4T) y el uterotónico de primera línea en Clave Roja?",
        opciones: {
            A: "Tono (Atonía uterina) • Oxitocina intravenosa + masaje uterino bimanual continuo.",
            B: "Trombina • Plasma fresco congelado de inicio sin uterotónicos.",
            C: "Tejido • Histerectomía obstétrica inmediata sin manejo médico.",
            D: "Trauma •Observación expectante por 6 horas."
        },
        respuestaCorrecta: "A",
        racional: "La atonía uterina ('Tono') representa el 70-80% de las hemorragias posparto. El protocolo Clave Roja del MSP indica activación inmediata del equipo, masaje bimanual y administración de oxitocina IV como uterotónico de primera elección."
    },
    {
        id: "seed-odo-1",
        carrera: "odontologia",
        materia: "Patología y Cirugía Bucal",
        dificultad: "Intermedio",
        enunciado: "Paciente de 28 años sin alergias conocidas acude por absceso dentoalveolar agudo con celulitis facial incipiente y fiebre de 38.6 °C. Además del drenaje local/endodóntico o quirúrgico, ¿cuál es el antibiótico empírico de primera elección?",
        opciones: {
            A: "Amoxicilina + Ácido Clavulánico por vía oral/parenteral según severidad.",
            B: "Gentamicina tópica exclusivamente.",
            C: "Fluconazol 150 mg dosis única.",
            D: "Aciclovir 400 mg cada 12 horas."
        },
        respuestaCorrecta: "A",
        racional: "Las infecciones odontogénicas son polimicrobianas (cocos grampositivos aerobios y bacilos anaerobios estrictos productores de betalactamasas). La combinación de Amoxicilina + Ácido Clavulánico ofrece cobertura óptima de primera línea."
    }
];
