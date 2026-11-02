// ============================================================================
// ARCHIVO: js/2-core/curriculum.data.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Diccionario Curricular Oficial de las 11 Carreras de Salud,
//                  Semestres 1° al 10°, Simuladores Contextuales y Semilla CACES.
// ============================================================================

export const makaiData = {
    version: "4.4-rieles",
    carreras: [
        {
            id: "medicina",
            nombre: "Medicina Humana",
            caces: true,
            activa: true,
            materias: [
                "Medicina Interna",
                "Pediatría",
                "Ginecología y Obstetricia",
                "Cirugía General",
                "Salud Pública y Bioética",
                "Urgencias y Cuidados Críticos"
            ],
            semestres: {
                1: ["Anatomía Humana I", "Histología y Embriología", "Biología Molecular", "Salud Intercultural"],
                2: ["Anatomía Humana II", "Fisiología Médica I", "Bioquímica Clínica", "Bioestadística"],
                3: ["Fisiología Médica II", "Fisiopatología General", "Microbiología y Parasitología", "Inmunología"],
                4: ["Semiología Médica y Diagnóstico Físico", "Farmacología Básica", "Patología Estructural", "Imagenología Básica"],
                5: ["Farmacología Clínica", "Cardiología y Neumología", "Gastroenterología", "Infectología MSP"],
                6: ["Nefrología y Medio Interno", "Endocrinología y Metabolismo", "Neurología Clínica", "Hematología"],
                7: ["Pediatría y Neonatología", "Ginecología y Claves Obstétricas", "Psiquiatría y Salud Mental"],
                8: ["Cirugía General y Trauma", "Ortopedia y Traumatología", "Urgencias y Toxicología", "Bioética y Medicina Legal"],
                9: ["Internado Rotativo: Medicina Interna & Urgencias", "Internado Rotativo: Pediatría & Gineco-Obstetricia"],
                10: ["Internado Rotativo: Cirugía & Salud Comunitaria", "Entrenamiento Intensivo CACES & Complexivo"]
            }
        },
        {
            id: "enfermeria",
            nombre: "Enfermería",
            caces: true,
            activa: true,
            materias: [
                "Enfermería Clínico-Quirúrgica",
                "Enfermería Materno-Infantil",
                "Salud Comunitaria y Epidemiología",
                "Farmacología Aplicada en Enfermería",
                "Gestión y Liderazgo en Enfermería",
                "Enfermería en Urgencias y Cuidados Intensivos"
            ]
        },
        {
            id: "odontologia",
            nombre: "Odontología",
            caces: true,
            activa: true,
            materias: [
                "Patología y Medicina Oral",
                "Cirugía Oral y Maxilofacial",
                "Endodoncia y Periodoncia",
                "Rehabilitación Oral y Operatoria",
                "Odontopediatría y Ortodoncia",
                "Farmacología y Anestesiología Odontológica"
            ]
        },
        {
            id: "obstetricia",
            nombre: "Obstetricia",
            caces: true,
            activa: true,
            materias: [
                "Obstetricia Fisiológica y Alto Riesgo",
                "Claves Obstétricas MSP (Roja, Azul, Amarilla)",
                "Ginecología y Salud Sexual Reproductiva",
                "Neonatología y Recepción del Recién Nacido",
                "Farmacología Obstétrica",
                "Salud Pública y Normativa Materna"
            ]
        },
        {
            id: "fisioterapia",
            nombre: "Fisioterapia",
            caces: false,
            activa: true,
            materias: ["Biomecánica y Kinesiología", "Rehabilitación Neurológica", "Fisioterapia traumatológica y Deportiva", "Fisioterapia Cardiorrespiratoria"]
        },
        {
            id: "laboratorio",
            nombre: "Laboratorio Clínico",
            caces: false,
            activa: true,
            materias: ["Hematología y Coagulación", "Microbiología y Bacteriología", "Bioquímica Clínica", "Inmunología y Banco de Sangre"]
        },
        {
            id: "psicologia",
            nombre: "Psicología Clínica",
            caces: false,
            activa: true,
            materias: ["Psicopatología y DSM-5", "Evaluación y Psicodiagnóstico", "Intervención en Crisis y Psicoterapia", "Neuropsicología Clínica"]
        },
        {
            id: "nutricion",
            nombre: "Nutrición y Dietética",
            caces: false,
            activa: true,
            materias: ["Dietoterapia en Patologías Crónicas", "Evaluación del Estado Nutricional", "Nutrición Materno-Infantil", "Soporte Nutricional Enteral y Parenteral"]
        },
        {
            id: "bioquimica",
            nombre: "Bioquímica y Farmacia",
            caces: false,
            activa: true,
            materias: ["Farmacología Clínica y Atención Farmacéutica", "Toxicología Analítica", "Química Farmacéutica", "Control de Calidad de Medicamentos"]
        },
        {
            id: "imagenologia",
            nombre: "Imagenología y Radiología",
            caces: false,
            activa: true,
            materias: ["Física Radiológica y Protección", "Radiodiagnóstico Convencional", "Tomografía Computarizada", "Resonancia Magnética y Ecografía"]
        },
        {
            id: "prehospitalaria",
            nombre: "Atención Prehospitalaria",
            caces: false,
            activa: true,
            materias: ["Soporte Vital Básico y Avanzado (BLS/ACLS)", "Manejo Prehospitalario del Trauma (PHTLS)", "Emergencias Obstétricas y Pediátricas", "Triage y Gestión de Desastres"]
        },
        {
            id: "preuniversitario",
            nombre: "Preuniversitario de Salud",
            caces: false,
            activa: true,
            materias: ["Biología Celular y Humana", "Química General y Orgánica", "Anatomía Introductoria", "Razonamiento Lógico y Verbal"]
        }
    ],

    // Mapa de Simuladores Contextuales por Palabra Clave de Materia
    contextualSimulators: {
        default2D: "Monitor Multiparámetro & Casos Ramificados 2D",
        default3D: "Estación Clínica 3D WebGL • Procedimientos y Guardia",
        byKeyword: [
            { match: "cardio", sim2d: "Simulador 2D: Auscultación Cardíaca & Lectura ECG", sim3d: "Simulador 3D: Cardioversión y RCP Avanzado" },
            { match: "obstet", sim2d: "Simulador 2D: Score MAMÁ & Claves Obstétricas MSP", sim3d: "Simulador 3D: Atención de Parto y Hemorragia Postparto" },
            { match: "urgencia", sim2d: "Simulador 2D: Triage de Manchester y Gasometría", sim3d: "Simulador 3D: Intubación Secuencia Rápida en UCI" },
            { match: "farmaco", sim2d: "Simulador 2D: Bombas de Infusión y Dosificación", sim3d: "Simulador 3D: Reacción Anafiláctica y Vasopresores" },
            { match: "pediatr", sim2d: "Simulador 2D: Triángulo de Evaluación Pediátrica", sim3d: "Simulador 3D: Reanimación Neonatal Avanzada" }
        ]
    },

    // Casos Semilla Oficiales CACES (Respaldo Offline Inmediato)
    semillaCasos: [
        {
            id: "CACES-MED-001",
            carrera: "medicina",
            materia: "Ginecología y Obstetricia",
            dificultad: "Alta",
            enunciado: "Gestante de 34 semanas acude a emergencia con cefalea holocraneana intensa, escotomas centelleantes y epigastralgia. PA: 168/112 mmHg, FC: 92 lpm, proteinuria en tirilla reactiva +++. Según la GPC del MSP de Ecuador (Clave Azul), ¿cuál es la conducta farmacológica inmediata para prevención de eclampsia?",
            opciones: [
                "A) Sulfato de magnesio 4 g IV en impregnación durante 20 minutos, seguido de 1 g/hora en mantenimiento.",
                "B) Sulfato de magnesio 6 g IV en bolo rápido de 5 minutos, seguido de 2 g/hora.",
                "C) Fenitoína sódica 15 mg/kg IV diluida en solución salina al 0.9%.",
                "D) Diazepam 10 mg IV lento y referir sin dosis de mantenimiento."
            ],
            correcta: 0,
            racional: "De acuerdo con la Guía de Práctica Clínica de Trastornos Hipertensivos del Embarazo del MSP (Clave Azul), el esquema Zuspan modificado para prevención de preeclampsia con signos de gravedad utiliza 4 g de Sulfato de Magnesio IV en 20 minutos como impregnación y 1 g/hora en infusión continua."
        },
        {
            id: "CACES-MED-002",
            carrera: "medicina",
            materia: "Medicina Interna",
            dificultad: "Alta",
            enunciado: "Paciente masculino de 64 años con antecedente de hipertensión arterial acude por dolor torácico opresivo retroesternal de 90 minutos de evolución irradiado a mandíbula. El ECG de 12 derivaciones muestra supradesnivel del segmento ST de 3 mm en V1, V2, V3 y V4. ¿Cuál es la localización anatómica del infarto y la arteria coronaria comprometida?",
            opciones: [
                "A) Cara anteroseptal / Arteria Descendente Anterior.",
                "B) Cara inferior / Arteria Coronaria Derecha.",
                "C) Cara lateral alta / Arteria Circunfleja.",
                "D) Ventrículo derecho exclusivo / Marginal aguda."
            ],
            correcta: 0,
            racional: "El supradesnivel del ST de V1 a V4 corresponde al territorio anteroseptal y anterior, irrigado directamente por la arteria coronaria Descendente Anterior (rama de la coronaria izquierda)."
        }
    ]
};

export function initCurriculumData() {
    if (typeof window !== "undefined") {
        window.makaiData = makaiData;
    }
    return makaiData;
}
