// ============================================================================
// ARCHIVO: js/1-admin/admin.questions.js
// DESCRIPCIÓN: Gestor del Banco de Preguntas con Mallas Curriculares Oficiales
//              del Ecuador (CES) Semestre por Semestre para las 11 Carreras +
//              Preuniversitario + Componentes Oficiales CACES (EHEP).
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    addDoc,
    doc,
    setDoc,
    updateDoc,
    COLLECTIONS
} from "../2-core/firebase.service.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin
} from "../2-core/state.store.js";

import {
    deleteDoc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const QUESTIONS_COLLECTION = COLLECTIONS?.QUESTIONS || "preguntas_caces";

// ============================================================================
// 1. MAPA CURRICULAR OFICIAL DEL ECUADOR (CACES EHEP + 11 CARRERAS POR SEMESTRE)
// ============================================================================

const COMPLEXIVO_AXES = [
    "Eje 1 Complexivo: Ciencias Básicas y Preclínicas Integradas",
    "Eje 2 Complexivo: Diagnóstico Clínico y Razonamiento Sindrómico",
    "Eje 3 Complexivo: Terapéutica, Protocolos y Guías del MSP",
    "Eje 4 Complexivo: Salud Pública, Epidemiología, Bioética y Gestión",
    "Eje 5 Complexivo: Resolución de Casos Prácticos de Fin de Carrera"
];

export const CURRICULUM_MAP = {
    // ========================================================================
    // ÁMBITO A: HABILITACIÓN PROFESIONAL OFICIAL CACES (EHEP ECUADOR)
    // ========================================================================
    caces: {
        medicina: {
            nombre: "Medicina Humana (CACES Oficial)",
            niveles: [{ id: "caces_oficial", nombre: "Examen de Habilitación Profesional (EHEP - CACES)" }],
            materiasPorNivel: {
                caces_oficial: [
                    "Medicina Interna (Cardiología, Neumología, Nefrología, Gastro, Endocrino, Neuro, Infecto)",
                    "Pediatría y Neonatología (AIEPI, Crecimiento, Vacunación PAI y Patologías Prevalentes)",
                    "Ginecología y Obstetricia (Control Prenatal, Claves Obstétricas MSP, Score MAMÁ y Parto)",
                    "Cirugía General, Trauma y Abdomen Agudo",
                    "Urgencias, Emergencias y Cuidados Críticos",
                    "Salud Mental y Psiquiatría Comunitaria",
                    "Salud Pública, Epidemiología, MAIS-FCI y Bioética Médica"
                ]
            }
        },
        enfermeria: {
            nombre: "Enfermería (CACES Oficial)",
            niveles: [{ id: "caces_oficial", nombre: "Examen de Habilitación Profesional (EHEP - CACES)" }],
            materiasPorNivel: {
                caces_oficial: [
                    "Bases Conceptuales y Proceso de Atención de Enfermería (PAE: NANDA, NIC, NOC)",
                    "Enfermería Clínico-Quirúrgica del Adulto y Adulto Mayor",
                    "Enfermería Materno-Infantil, Neonatal y del Adolescente",
                    "Enfermería Familiar, Comunitaria, Intercultural y Estrategia Nacional de Inmunizaciones (ENI)",
                    "Enfermería en Urgencias, Emergencias y Cuidados Críticos (UCI)",
                    "Salud Mental y Psiquiatría en Enfermería",
                    "Administración, Gestión de Calidad, Seguridad del Paciente y Bioética",
                    "Investigación, Epidemiología y Educación para la Salud"
                ]
            }
        },
        odontologia: {
            nombre: "Odontología (CACES Oficial)",
            niveles: [{ id: "caces_oficial", nombre: "Examen de Habilitación Profesional (EHEP - CACES)" }],
            materiasPorNivel: {
                caces_oficial: [
                    "Patología Bucal, Semiología y Diagnóstico Clínico-Radiológico",
                    "Cirugía Oral y Maxilofacial",
                    "Endodoncia Clínica y Traumatología Dental",
                    "Periodoncia y Medicina Periodontal",
                    "Operatoria Dental, Cariología y Biomateriales",
                    "Rehabilitación Oral y Prótesis (Fija, Removible y Total)",
                    "Odontopediatría y Ortodoncia Preventiva/Interceptiva",
                    "Farmacología Odontológica, Anestesiología, Bioseguridad y Salud Pública"
                ]
            }
        },
        obstetricia: {
            nombre: "Obstetricia (CACES Oficial)",
            niveles: [{ id: "caces_oficial", nombre: "Examen de Habilitación Profesional (EHEP - CACES)" }],
            materiasPorNivel: {
                caces_oficial: [
                    "Obstetricia Fisiológica, Control Prenatal y Psicoprofilaxis",
                    "Alto Riesgo Obstétrico y Patología Gestacional",
                    "Claves Obstétricas del MSP (Roja, Azul, Amarilla) y Score MAMÁ",
                    "Atención del Parto, Puerperio y Lactancia Materna",
                    "Ginecología, Salud Sexual/Reproductiva y Planificación Familiar",
                    "Neonatología Inmediata y Reanimación Neonatal",
                    "Farmacología Gíneco-Obstétrica",
                    "Salud Pública Materno-Perinatal, Vigilancia Epidemiológica y Bioética"
                ]
            }
        },
        psicologia_clinica: {
            nombre: "Psicología Clínica (Interés Público CACES)",
            niveles: [{ id: "caces_oficial", nombre: "Evaluación de Habilitación Profesional (CACES)" }],
            materiasPorNivel: {
                caces_oficial: [
                    "Psicopatología y Sistemas Diagnósticos (DSM-5-TR / CIE-11)",
                    "Evaluación Psicológica, Psicometría y Psicodiagnóstico Clínico",
                    "Modelos de Intervención Psicoterapéutica y Psicoterapia Basada en Evidencia",
                    "Intervención en Crisis, Primeros Auxilios Psicológicos y Riesgo Suicida",
                    "Neuropsicología Clínica y Rehabilitación Cognitiva",
                    "Salud Mental Comunitaria, Normativa MSP y Deontología Profesional"
                ]
            }
        }
    },

    // ========================================================================
    // ÁMBITO B: MALLA UNIVERSITARIA DEL ECUADOR (SEMESTRE POR SEMESTRE REAL)
    // ========================================================================
    carrera: {
        // 0. PREUNIVERSITARIO GENERAL DE SALUD
        preuniversitario_salud: {
            nombre: "0. Preuniversitario General de Salud",
            niveles: [
                { id: "preuniversitario", nombre: "Tronco Común de Admisión Universitaria" }
            ],
            materiasPorNivel: {
                preuniversitario: [
                    "Biología Celular y Molecular",
                    "Química General e Inorgánica",
                    "Química Orgánica Aplicada a la Salud",
                    "Anatomía y Fisiología Elemental",
                    "Física Aplicada a Ciencias de la Salud",
                    "Terminología Médica y Razonamiento Clínico-Verbal"
                ]
            }
        },

        // 1. MEDICINA HUMANA (10 Semestres + Internado Rotativo + Titulación)
        medicina: {
            nombre: "1. Medicina Humana",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Ciencias Básicas I)" },
                { id: "semestre_2", nombre: "2.° Semestre (Ciencias Básicas II)" },
                { id: "semestre_3", nombre: "3.° Semestre (Preclínica I)" },
                { id: "semestre_4", nombre: "4.° Semestre (Preclínica II)" },
                { id: "semestre_5", nombre: "5.° Semestre (Semiología y Transición)" },
                { id: "semestre_6", nombre: "6.° Semestre (Clínica Médica I)" },
                { id: "semestre_7", nombre: "7.° Semestre (Clínica Médica II)" },
                { id: "semestre_8", nombre: "8.° Semestre (Clínica Quirúrgica)" },
                { id: "semestre_9", nombre: "9.° Semestre (Materno-Infantil)" },
                { id: "semestre_10", nombre: "10.° Semestre (Críticos y Legal)" },
                { id: "internado_rotativo", nombre: "Internado Rotativo (5 Rotaciones MSP)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular Médica", "Química Médica", "Morfofisiología Elemental", "Biofísica Aplicada", "Metodología de la Investigación y Salud"],
                semestre_1: ["Anatomía Humana Descriptiva I", "Histología General I", "Embriología Humana", "Biología Molecular", "Bioquímica I"],
                semestre_2: ["Anatomía Humana II y Neuroanatomía", "Histología por Sistemas II", "Fisiología Humana I", "Bioquímica Clínica y Nutrición II", "Salud Pública y Atención Primaria (MAIS-FCI)"],
                semestre_3: ["Fisiología Humana II", "Microbiología Médica y Virología", "Parasitología y Micología Médica", "Inmunología Básica y Clínica", "Genética Médica"],
                semestre_4: ["Anatomía Patológica General y Especial", "Fisiopatología I", "Farmacología Básica", "Psicología Médica", "Bioestadística y Epidemiología Clínica"],
                semestre_5: ["Semiología Médica y Propedéutica Clínica", "Fisiopatología de Sistemas II", "Farmacología Clínica y Terapéutica", "Imagenología Diagnóstica", "Interpretación de Laboratorio Clínico"],
                semestre_6: ["Medicina Interna I (Cardiología y Neumología)", "Infectología y Medicina Tropical", "Dermatología Clínica", "Gastroenterología", "Salud Pública y Vigilancia Epidemiológica"],
                semestre_7: ["Medicina Interna II (Nefrología, Endocrinología y Reumatología)", "Neurología Clínica", "Hematología y Oncología", "Psiquiatría y Salud Mental", "Nutrición Clínica"],
                semestre_8: ["Cirugía General y Abdomen Agudo", "Traumatología y Ortopedia", "Anestesiología y Reanimación", "Otorrinolaringología y Oftalmología", "Urología Clínica"],
                semestre_9: ["Ginecología y Salud Reproductiva", "Obstetricia y Claves Obstétricas MSP", "Pediatría Clínica y Puericultura", "Neonatología y Reanimación Neonatal", "AIEPI Clínico y Esquema PAI"],
                semestre_10: ["Urgencias Médicas y Cuidados Críticos (UCI)", "Toxicología Clínica", "Geriatría y Cuidados Paliativos", "Medicina Legal y Deontología Médica", "Administración y Gerencia Hospitalaria"],
                internado_rotativo: ["Rotación de Medicina Interna", "Rotación de Cirugía General", "Rotación de Pediatría y Neonatología", "Rotación de Ginecología y Obstetricia", "Rotación Comunitaria y Atención Primaria MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 2. ENFERMERÍA (7 Semestres + Internado Rotativo + Titulación)
        enfermeria: {
            nombre: "2. Enfermería",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Bases y Morfofunción I)" },
                { id: "semestre_2", nombre: "2.° Semestre (Fundamentos y PAE)" },
                { id: "semestre_3", nombre: "3.° Semestre (Semiología y Farmacología)" },
                { id: "semestre_4", nombre: "4.° Semestre (Enfermería del Adulto I)" },
                { id: "semestre_5", nombre: "5.° Semestre (Quirúrgica y Adulto Mayor)" },
                { id: "semestre_6", nombre: "6.° Semestre (Materno-Infantil y Pediatría)" },
                { id: "semestre_7", nombre: "7.° Semestre (Críticos, Mental y Gerencia)" },
                { id: "internado_rotativo", nombre: "Internado Rotativo (8.° y 9.° Semestre)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Aplicada a Enfermería", "Química General y Orgánica", "Morfofisiología Elemental", "Introducción a la Salud Pública", "Comunicación y Metodología de Estudio"],
                semestre_1: ["Anatomía y Fisiología Humana (Morfofunción I)", "Bioquímica y Nutrición Básica", "Bases Teóricas y Epistemológicas de Enfermería", "Salud Pública y Modelo MAIS-FCI", "Bioseguridad y Primeros Auxilios"],
                semestre_2: ["Morfofunción II y Fisiopatología General", "Microbiología y Parasitología Aplicada", "Fundamentos de Enfermería y Procedimientos Básicos", "Proceso de Atención de Enfermería (PAE: NANDA-NIC-NOC)", " Socioantropología e Interculturalidad en Salud"],
                semestre_3: ["Semiología y Valoración Clínica de Enfermería", "Farmacología General y Cálculo/Dilución de Dosis", "Enfermería Comunitaria I y Promoción de la Salud", "Bioestadística y Epidemiología en Enfermería", "Dietoterapia y Nutrición Clínica"],
                semestre_4: ["Enfermería Clínico-Quirúrgica del Adulto I", "Farmacología Clínica Aplicada", "Enfermería Familiar y Comunitaria II (Estrategia ENI / PAI)", "Ética, Bioética y Legislación en Enfermería", "Educación para la Salud"],
                semestre_5: ["Enfermería Clínico-Quirúrgica del Adulto II", "Enfermería Perioperatoria e Instrumentación Quirúrgica", "Enfermería Gerontológica y del Adulto Mayor", "Cuidados Paliativos y Manejo del Dolor", "Metodología de la Investigación en Enfermería"],
                semestre_6: ["Enfermería Ginecológica y Obstétrica (Claves y Score MAMÁ)", "Enfermería Neonatal", "Enfermería Pediátrica y del Adolescente (AIEPI)", "Enfermería en Salud Mental y Psiquiatría", "Calidad de Atención y Seguridad del Paciente"],
                semestre_7: ["Enfermería en Urgencias, Emergencias y Desastres", "Enfermería en Cuidados Críticos y Terapia Intensiva (UCI)", "Administración, Liderazgo y Gerencia de Servicios de Enfermería", "Diseño de Trabajo de Titulación", "Auditoría y Gestión Hospitalaria"],
                internado_rotativo: ["Rotación Clínico-Quirúrgica Hospitalaria", "Rotación Materno-Infantil y Pediátrica", "Rotación de Emergencias y Cuidados Críticos", "Rotación Comunitaria y Atención Primaria MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 3. ODONTOLOGÍA (10 Semestres + Titulación)
        odontologia: {
            nombre: "3. Odontología",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Básicas Estomatológicas I)" },
                { id: "semestre_2", nombre: "2.° Semestre (Anatomía Dental e Histología)" },
                { id: "semestre_3", nombre: "3.° Semestre (Patología y Biomateriales)" },
                { id: "semestre_4", nombre: "4.° Semestre (Semiología, Imagen y Anestesia)" },
                { id: "semestre_5", nombre: "5.° Semestre (Operatoria, Perio I y Endo I)" },
                { id: "semestre_6", nombre: "6.° Semestre (Cirugía I, Perio II y Endo II)" },
                { id: "semestre_7", nombre: "7.° Semestre (Prótesis Fija/Removible y Cirugía II)" },
                { id: "semestre_8", nombre: "8.° Semestre (Odontopediatría y Ortodoncia I)" },
                { id: "semestre_9", nombre: "9.° Semestre (Clínica Integral I y Maxilofacial)" },
                { id: "semestre_10", nombre: "10.° Semestre (Clínica Integral II y Legal)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular", "Química General y Orgánica", "Anatomía Elemental", "Física Aplicada", "Morfología Dental Introductoria"],
                semestre_1: ["Anatomía Humana de Cabeza y Cuello", "Embriología e Histología General", "Bioquímica Estomatológica", "Bioseguridad y Ergonomía Odontológica", "Salud Pública y Odontología Preventiva"],
                semestre_2: ["Anatomía Dental y Morfología Oclusal", "Histología y Embriología Bucodental", "Fisiología Humana y Estomatognática", "Microbiología e Inmunología Oral", "Cariología"],
                semestre_3: ["Patología General y Bucal I", "Biomateriales y Materiales Dentales I", "Farmacología General y Terapéutica Odontológica", "Oclusión y Trastornos Temporomandibulares (ATM)", "Epidemiología Estomatológica"],
                semestre_4: ["Semiología y Diagnóstico Clínico Estomatológico", "Radiología e Imagenología Bucofacial", "Anestesiología Odontológica", "Materiales Dentales II y Preclínica de Operatoria", "Patología Bucal II"],
                semestre_5: ["Operatoria Dental Clínica I", "Periodoncia I", "Endodoncia Preclínica y Clínica I", "Cirugía Bucal I (Exodoncia Simple)", "Medicina Interna Aplicada a la Odontología"],
                semestre_6: ["Operatoria Dental y Estética II", "Periodoncia II e Implantología Básica", "Endodoncia Clínica II", "Cirugía Bucal II (Exodoncia Compleja y Retenidos)", "Prótesis Total Preclínica"],
                semestre_7: ["Rehabilitación Oral: Prótesis Fija I", "Rehabilitación Oral: Prótesis Parcial Removible", "Cirugía Dentoalveolar y Patología Quirúrgica", "Odontopediatría I", "Ortodoncia y Ortopedia Maxilar I"],
                semestre_8: ["Odontopediatría Clínica II", "Ortodoncia Preventiva e Interceptiva II", "Rehabilitación Oral Integrada II", "Urgencias Médicas en el Consultorio Odontológico", "Metodología de la Investigación"],
                semestre_9: ["Clínica Integral del Adulto I", "Clínica Integral Pediátrica", "Cirugía Maxilofacial y Traumatología Facial", "Odontología Hospitalaria y Pacientes Especiales", "Gerencia y Administración de Consultorios"],
                semestre_10: ["Clínica Integral del Adulto II", "Odontología Legal, Forense y Bioética", "Salud Pública y Vinculación Comunitaria", "Trabajo de Titulación Odontológica"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 4. OBSTETRICIA Y PUERICULTURA (7 Semestres + Internado Rotativo + Titulación)
        obstetricia: {
            nombre: "4. Obstetricia y Puericultura",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Anatomía Pelviperineal y Básicas)" },
                { id: "semestre_2", nombre: "2.° Semestre (Fisiología Materno-Fetal)" },
                { id: "semestre_3", nombre: "3.° Semestre (Semiología Obstétrica y Farmacología)" },
                { id: "semestre_4", nombre: "4.° Semestre (Obstetricia Fisiológica y Parto)" },
                { id: "semestre_5", nombre: "5.° Semestre (Ginecología y Neonatología)" },
                { id: "semestre_6", nombre: "6.° Semestre (Alto Riesgo y Claves MSP)" },
                { id: "semestre_7", nombre: "7.° Semestre (Emergencias, Cirugía y Gestión)" },
                { id: "internado_rotativo", nombre: "Internado Rotativo Obstétrico" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular", "Química Médica", "Morfofisiología Básica", "Salud Sexual Introductoria", "Metodología de la Investigación"],
                semestre_1: ["Anatomía Humana y Pelviperineal", "Embriología y Genética Reproductiva", "Histología General y del Aparato Reproductor", "Bioquímica y Nutrición Materna", "Salud Pública y Atención Primaria (MAIS-FCI)"],
                semestre_2: ["Fisiología Humana y Materno-Fetal", "Microbiología, Parasitología e Infecciones Perinatales (TORCH/ITS)", "Psicología evolutiva y de la Reproducción", "Educación Prenatal y Psicoprofilaxis Obstétrica", "Bioseguridad"],
                semestre_3: ["Semiología General y Obstétrica", "Fisiopatología General y Reproductiva", "Farmacología General y Obstétrica", "Clínica Prenatal de Bajo Riesgo", "Bioestadística y Epidemiología Materna"],
                semestre_4: ["Clínica del Parto, Alumbramiento y Puerperio Fisiológico", "Monitoreo Fetal Electrónico y Ecografía Obstétrica Básica", "Ginecología Infanto-Juvenil y del Adulto I", "Lactancia Materna y Puericultura", "Salud Intercultural y Parto Humanizado"],
                semestre_5: ["Ginecología II, Climaterio y Patología Cervical/Mamaria", "Planificación Familiar y Anticoncepción Normativa MSP", "Neonatología Inmediata y Reanimación Neonatal", "Laboratorio Clínico Perinatal", "Bioética y Legislación Materno-Perinatal"],
                semestre_6: ["Patología Obstétrica y Alto Riesgo Obstétrico I", "Claves Obstétricas del MSP (Roja, Azul, Amarilla) y Score MAMÁ", "Medicina Interna Aplicada a la Gestación", "Enfermedades Infecciosas en el Embarazo", "Investigación Clínica"],
                semestre_7: ["Alto Riesgo Obstétrico II y Cuidados Críticos Maternos", "Procedimientos Quirúrgicos e Instrumentación en Centro Obstétrico", "Violencia de Género y Obstetricia Forense", "Gerencia de Servicios Materno-Infantiles", "Trabajo de Titulación"],
                internado_rotativo: ["Rotación de Centro Obstétrico y Sala de Partos", "Rotación de Alto Riesgo Obstétrico y Hospitalización", "Rotación de Ginecología y Planificación Familiar", "Rotación de Neonatología y Puerperio", "Rotación Comunitaria y Control Prenatal MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 5. NUTRICIÓN Y DIETÉTICA (8 Semestres + Internado Rotativo + Titulación)
        nutricion: {
            nombre: "5. Nutrición y Dietética",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Morfofunción y Química)" },
                { id: "semestre_2", nombre: "2.° Semestre (Bioquímica Nutricional y Bromatología)" },
                { id: "semestre_3", nombre: "3.° Semestre (Evaluación ABCD y Ciclos de Vida)" },
                { id: "semestre_4", nombre: "4.° Semestre (Fisiopatología y Tecnología Alimentaria)" },
                { id: "semestre_5", nombre: "5.° Semestre (Dietoterapia del Adulto)" },
                { id: "semestre_6", nombre: "6.° Semestre (Dietoterapia Pediátrica y Materna)" },
                { id: "semestre_7", nombre: "7.° Semestre (Soporte Enteral/Parenteral y Deportiva)" },
                { id: "semestre_8", nombre: "8.° Semestre (Servicios de Alimentación y Pública)" },
                { id: "internado_rotativo", nombre: "Internado Rotativo Nutricional" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular", "Química General e Inorgánica", "Morfofisiología Básica", "Introducción a la Nutrición Humana", "Matemática y Bioestadística Básica"],
                semestre_1: ["Anatomía y Fisiología del Sistema Digestivo y Endocrino", "Química Orgánica de los Alimentos", "Bases de la Nutrición Humana y Macronutrientes", "Socioantropología Alimentaria", "Salud Pública"],
                semestre_2: ["Bioquímica Metabólica y Nutricional", "Bromatología y Composición de Alimentos", "Microbiología y Parasitología de los Alimentos", "Micronutrientes (Vitaminas y Minerales)", "Técnica Dietética y Culinaria I"],
                semestre_3: ["Evaluación del Estado Nutricional (Antropometría y ABCD)", "Nutrición en el Ciclo de Vida (Embarazo, Lactancia, Adulto Mayor)", "Técnica Dietética II y Cálculo de Dietas", "Higiene, Inocuidad Alimentaria y Normativa ARCSA/HACCP", "Bioestadística"],
                semestre_4: ["Fisiopatología Aplicada a la Nutrición", "Tecnología y Conservación de Alimentos", "Farmacología e Interacción Fármaco-Nutriente", "Psicología de la Alimentación y Trastornos de la Conducta Alimentaria", "Epidemiología Nutricional"],
                semestre_5: ["Dietoterapia del Adulto I (Patologías Digestivas y Metabólicas)", "Dietoterapia en Obesidad, Diabetes y Síndrome Metabólico", "Educación y Consejería Nutricional", "Nutrición Comunitaria I y Seguridad Alimentaria", "Bioética"],
                semestre_6: ["Dietoterapia del Adulto II (Renal, Cardiovascular, Hepática y Oncológica)", "Dietoterapia Pediátrica y Manejo de Desnutrición Crónica Infantil (DCI)", "Nutrición Materno-Infantil y Lactancia", "Nutrición Comunitaria II y Programas MSP", "Investigación en Nutrición"],
                semestre_7: ["Soporte Nutricional Clínico (Nutrición Enteral y Parenteral)", "Nutrición en el Paciente Crítico y Quirúrgico", "Nutrición Aplicada al Deporte y Cineantropometría", "Administración de Servicios de Alimentación y Dietética Hospitalaria I", "Diseño de Titulación"],
                semestre_8: ["Gerencia y Auditoría de Servicios de Alimentación II", "Políticas Públicas, Soberanía Alimentaria y Etiquetado Nutricional", "Nutrigenómica y Alimentos Funcionales", "Práctica Integradora de Nutrición Clínica", "Trabajo de Titulación"],
                internado_rotativo: ["Rotación de Nutrición Clínica Hospitalaria", "Rotación de Soporte Nutricional y Pediatría", "Rotación de Gestión de Servicios de Alimentación", "Rotación de Nutrición Comunitaria MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 6. FISIOTERAPIA Y REHABILITACIÓN (8 Semestres + Titulación)
        fisioterapia: {
            nombre: "6. Fisioterapia y Rehabilitación",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Anatomía Locomotora y Biofísica)" },
                { id: "semestre_2", nombre: "2.° Semestre (Biomecánica y Fisiología del Ejercicio)" },
                { id: "semestre_3", nombre: "3.° Semestre (Semiología, Goniometría y Agentes Físicos)" },
                { id: "semestre_4", nombre: "4.° Semestre (Cinesiterapia y Terapia Manual)" },
                { id: "semestre_5", nombre: "5.° Semestre (Fisioterapia Musculoesquelética y Trauma)" },
                { id: "semestre_6", nombre: "6.° Semestre (Rehabilitación Neurológica Adulto/Pediátrica)" },
                { id: "semestre_7", nombre: "7.° Semestre (Cardiorrespiratoria y Deportiva)" },
                { id: "semestre_8", nombre: "8.° Semestre (Geriátrica, Ergonomía y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular", "Física y Biofísica del Movimiento", "Anatomía Elemental", "Introducción a la Fisioterapia", "Comunicación Científica"],
                semestre_1: ["Anatomía Descriptiva y Funcional del Aparato Locomotor", "Fisiología Humana General", "Histología y Tejido Conectivo", "Fundamentos de Fisioterapia y Kinesiología", "Salud Pública y Discapacidad"],
                semestre_2: ["Neuroanatomía Funcional", "Biomecánica Clínica y Análisis del Movimiento", "Fisiología del Ejercicio y Contracción Muscular", "Desarrollo Psicomotor", "Psicología de la Rehabilitación"],
                semestre_3: ["Evaluación Funcional, Goniometría y Examen Muscular", "Semiología y Diagnóstico Fisioterapéutico (CIF)", "Agentes Físicos I (Termoterapia, Crioterapia e Hidroterapia)", "Patología General y Musculoesquelética", "Imagenología Musculoesquelética"],
                semestre_4: ["Cinesiterapia Activa, Pasiva y Ejercicio Terapéutico", "Agentes Físicos II (Electroterapia, Ultrasonido y Láser)", "Terapia Manual Ortopédica I y Masoterapia", "Farmacología Aplicada a Rehabilitación", "Bioestadística"],
                semestre_5: ["Fisioterapia Traumatológica y Ortopédica", "Rehabilitación Reumatológica y Manejo del Dolor", "Terapia Manual II y Liberación Miofascial", "Órtesis, Prótesis y Ayudas Técnicas", "Metodología de la Investigación"],
                semestre_6: ["Fisioterapia y Rehabilitación Neurológica del Adulto", "Fisioterapia Neurológica Pediátrica y Estimulación Temprana", "Reeducación Postural Global y Marcha", "Fisioterapia en Amputados", "Bioética y Legislación"],
                semestre_7: ["Fisioterapia Cardiorrespiratoria y Rehabilitación Pulmonar/UCI", "Fisioterapia Deportiva y Readaptación Funcional", "Fisioterapia del Suelo Pélvico y Uroginecológica", "Fisioterapia Comunitaria y Rehabilitación Basada en la Comunidad (RBC)", "Diseño de Titulación"],
                semestre_8: ["Fisioterapia Geriátrica y Prevención de Caídas", "Ergonomía y Salud Ocupacional", "Administración y Gestión de Centros de Rehabilitación", "Clínica Integradora de Fisioterapia", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 7. LABORATORIO CLÍNICO (8 Semestres + Titulación)
        laboratorio_clinico: {
            nombre: "7. Laboratorio Clínico",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Química Analítica y Bioseguridad)" },
                { id: "semestre_2", nombre: "2.° Semestre (Bioquímica Clínica I y Toma de Muestras)" },
                { id: "semestre_3", nombre: "3.° Semestre (Hematología I y Uroanálisis)" },
                { id: "semestre_4", nombre: "4.° Semestre (Bacteriología y Parasitología I)" },
                { id: "semestre_5", nombre: "5.° Semestre (Hematología II, Hemostasia e Inmunología)" },
                { id: "semestre_6", nombre: "6.° Semestre (Virología, Micología y Banco de Sangre)" },
                { id: "semestre_7", nombre: "7.° Semestre (Biología Molecular y Citopatología)" },
                { id: "semestre_8", nombre: "8.° Semestre (Control de Calidad ISO 15189 y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Celular", "Química General e Inorgánica", "Matemática Aplicada", "Morfofisiología Elemental", "Introducción al Laboratorio Clínico"],
                semestre_1: ["Química Orgánica y Analítica Cuantitativa", "Anatomía e Histología Humana", "Bioseguridad y Manejo de Desechos Biológicos", "Instrumentación y Equipos de Laboratorio", "Salud Pública"],
                semestre_2: ["Bioquímica Clínica I (Carbohidratos, Lípidos y Proteínas)", "Fase Preanalítica y Flebotomía / Toma de Muestras", "Fisiología y Fisiopatología Humana", "Biología Molecular Básica", "Bioestadística"],
                semestre_3: ["Hematología Clínica I (Serie Roja y Blanca)", "Uroanálisis, Coprología y Líquidos Biológicos (LCR, Sinovial, Pleural)", "Bioquímica Clínica II (Enzimología, Renal, Hepático y Electrolitos)", "Inmunología Básica", "Epidemiología"],
                semestre_4: ["Microbiología y Bacteriología Clínica I", "Parasitología Clínica I (Protozoos y Helmintos)", "Inmunoserología Diagnóstica", "Endocrinología y Marcadores Tumorales/Cardíacos", "Fisiopatología de Sistemas"],
                semestre_5: ["Hematología Especial II (Leucemias y Trastornos Mieloproliferativos)", "Hemostasia, Coagulación y Trombosis", "Bacteriología Clínica II y Antibiograma (Resistencia Antimicrobiana)", "Parasitología Tisular II", "Metodología de la Investigación"],
                semestre_6: ["Medicina Transfusional y Banco de Sangre (Inmunohematología)", "Virología Clínica y Diagnóstico Serológico", "Micología Médica", "Toxicología Analítica y Monitoreo de Fármacos", "Bioética"],
                semestre_7: ["Diagnóstico Molecular (PCR, qPCR y Secuenciación)", "Genética y Citogenética Clínica", "Técnicas Histológicas y Citopatología", "Vigilancia Epidemiológica y Laboratorio de Salud Pública (INSPI)", "Diseño de Titulación"],
                semestre_8: ["Gestión y Aseguramiento de la Calidad en Laboratorio (Norma ISO 15189)", "Auditoría, Acreditación y Administración de Laboratorios", "Correlación Clínico-Patológica de Casos Complejos", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 8. IMAGENOLOGÍA Y RADIOLOGÍA (8 Semestres + Titulación)
        imagenologia: {
            nombre: "8. Imagenología y Radiología",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Anatomía y Física Radiológica)" },
                { id: "semestre_2", nombre: "2.° Semestre (Radiología Convencional I y Protección)" },
                { id: "semestre_3", nombre: "3.° Semestre (Radiología Convencional II y Contrastada)" },
                { id: "semestre_4", nombre: "4.° Semestre (Tomografía Computarizada I y Ecografía I)" },
                { id: "semestre_5", nombre: "5.° Semestre (Tomografía II, Mamografía y Densitometría)" },
                { id: "semestre_6", nombre: "6.° Semestre (Resonancia Magnética I y Doppler)" },
                { id: "semestre_7", nombre: "7.° Semestre (Resonancia II, Intervencionismo y Nuclear)" },
                { id: "semestre_8", nombre: "8.° Semestre (Radioterapia, Gestión PACS y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Física General y Electromagnetismo", "Biología Celular", "Anatomía Elemental", "Matemática Aplicada", "Introducción a la Imagenología"],
                semestre_1: ["Anatomía Humana Descriptiva y Topográfica", "Física de las Radiaciones Ionizantes", "Fisiología Humana", "Cuidados de Enfermería y Primeros Auxilios en Radiología", "Bioseguridad"],
                semestre_2: ["Anatomía Radiológica y Multiplanar I", "Radiología Convencional I (Esqueleto Apendicular y Tórax)", "Radiobiología y Protección Radiológica / Dosimetría", "Procesamiento Digital de Imágenes (CR/DR)", "Salud Pública"],
                semestre_3: ["Anatomía Radiológica Multiplanar II (Neuroanatomía y Abdomen)", "Radiología Convencional II (Cráneo, Columna y Pelvis)", "Estudios Radiológicos Especiales y Medios de Contraste", "Fisiopatología y Semiología Radiológica", "Radiología Dental y Maxilofacial"],
                semestre_4: ["Tomografía Computarizada (TC) I: Física, Protocolos de Cráneo y Tórax", "Ecografía Diagnóstica General I (Abdominal y Pélvica)", "Radiología Pediátrica y Neonatal", "Farmacología de Medios de Contraste y Reacciones Adversas", "Bioestadística"],
                semestre_5: ["Tomografía Computarizada (TC) II: Abdomen, Angio-TC y Reconstrucción 3D", "Mamografía, Control de Calidad y Clasificación BI-RADS", "Densitometría Ósea", "Ecografía Obstétrica y Musculoesquelética II", "Metodología de la Investigación"],
                semestre_6: ["Resonancia Magnética Nuclear (RMN) I: Física, Secuencias y Neuroimagen", "Ecografía Vascular Doppler", "Radiología de Urgencias y Trauma (FAST)", "Patología por Sistemas en Imagenología", "Bioética y Legislación Radiológica"],
                semestre_7: ["Resonancia Magnética Nuclear (RMN) II: Musculoesquelética, Corporal y Cardio-RM", "Radiología Vascular e Intervencionista (Hemodinamia)", "Medicina Nuclear (Gammagrafía, SPECT y PET-CT)", "Diseño de Titulación"],
                semestre_8: ["Fundamentos de Radioterapia Oncológica y Braquiterapia", "Gestión de Servicios de Imagenología, Sistemas RIS/PACS y Teleradiología", "Control de Calidad de Equipos Radiológicos", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 9. BIOQUÍMICA Y FARMACIA (9 Semestres + Titulación)
        bioquimica_farmacia: {
            nombre: "9. Bioquímica y Farmacia",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Química General e Inorgánica)" },
                { id: "semestre_2", nombre: "2.° Semestre (Química Orgánica I y Analítica)" },
                { id: "semestre_3", nombre: "3.° Semestre (Orgánica II, Fisicoquímica y Botánica)" },
                { id: "semestre_4", nombre: "4.° Semestre (Bioquímica, Fisiología y Farmacognosia)" },
                { id: "semestre_5", nombre: "5.° Semestre (Farmacología I y Química Farmacéutica I)" },
                { id: "semestre_6", nombre: "6.° Semestre (Farmacología II y Tecnología Farmacéutica I)" },
                { id: "semestre_7", nombre: "7.° Semestre (Biofarmacia, Tecnología II y Bromatología)" },
                { id: "semestre_8", nombre: "8.° Semestre (Farmacia Hospitalaria y Toxicología)" },
                { id: "semestre_9", nombre: "9.° Semestre (Atención Farmacéutica, ARCSA y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Química General", "Biología Celular", "Matemática y Cálculo Básico", "Física Aplicada", "Introducción a las Ciencias Farmacéuticas"],
                semestre_1: ["Química Inorgánica Farmacéutica", "Anatomía e Histología Humana", "Biología Molecular y Celular", "Cálculo y Bioestadística", "Bioseguridad en Laboratorios Químicos"],
                semestre_2: ["Química Orgánica I", "Química Analítica Cualitativa y Cuantitativa", "Fisiología Humana", "Física Farmacéutica", "Salud Pública y Epidemiología"],
                semestre_3: ["Química Orgánica II (Síntesis y Reacciones)", "Análisis Instrumental (HPLC, Espectrofotometría, Cromatografía)", "Fisicoquímica Farmacéutica", "Botánica Farmacéutica", "Microbiología General"],
                semestre_4: ["Bioquímica General y Metabólica", "Fisiopatología Humana", "Farmacognosia y Fitoquímica (Productos Naturales)", "Microbiología y Parasitología Farmacéutica", "Inmunología"],
                semestre_5: ["Farmacología Básica y Molecular I", "Química Farmacéutica y Medicinal I (Diseño de Fármacos y Clasificación ATC)", "Bioquímica Clínica y Diagnóstico de Laboratorio", "Biotecnología Farmacéutica", "Metodología de la Investigación"],
                semestre_6: ["Farmacología Clínica y Terapéutica II", "Química Farmacéutica II", "Tecnología Farmacéutica I (Formas Sólidas y Polvos)", "Hematología y Análisis Clínico", "Bioética"],
                semestre_7: ["Tecnología Farmacéutica II (Formas Líquidas, Semisólidas y Estériles)", "Biofarmacia y Farmacocinética Clínica", "Bromatología y Análisis de Alimentos", "Tecnología Cosmética y Dermofarmacia", "Control de Calidad de Medicamentos (USP/BP)"],
                semestre_8: ["Farmacia Clínica y Hospitalaria (Unidosis y Mezclas IV)", "Toxicología Analítica, Clínica y Forense", "Farmacovigilancia y Tecnovigilancia", "Aseguramiento de Calidad y Buenas Prácticas de Manufactura (BPM)", "Diseño de Titulación"],
                semestre_9: ["Atención Farmacéutica y Seguimiento Farmacoterapéutico (Método Dáder)", "Legislación Farmacéutica, Regulación Sanitaria (ARCSA) y Cuadro Nacional de Medicamentos (CNMB)", "Administración y Marketing Farmacéutico", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 10. PSICOLOGÍA CLÍNICA (8 Semestres + Titulación)
        psicologia_clinica: {
            nombre: "10. Psicología Clínica",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Bases Biológicas y Procesos Básicos)" },
                { id: "semestre_2", nombre: "2.° Semestre (Neuroanatomía y Desarrollo Humano)" },
                { id: "semestre_3", nombre: "3.° Semestre (Psicopatología I y Personalidad)" },
                { id: "semestre_4", nombre: "4.° Semestre (Psicopatología II y Psicometría)" },
                { id: "semestre_5", nombre: "5.° Semestre (Psicodiagnóstico y Neuropsicología)" },
                { id: "semestre_6", nombre: "6.° Semestre (Psicoterapia Cognitivo-Conductual e Infantil)" },
                { id: "semestre_7", nombre: "7.° Semestre (Intervención en Crisis, Adicciones y Psicofármacos)" },
                { id: "semestre_8", nombre: "8.° Semestre (Psicología Hospitalaria, Forense y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Fundamentos e Historia de la Psicología", "Biología Humana", "Epistemología de las Ciencias de la Salud", "Comunicación Académica", "Metodología de Estudio"],
                semestre_1: ["Bases Biológicas de la Conducta y Psicofisiología", "Procesos Psicológicos Básicos (Atención, Percepción, Memoria)", "Teorías y Sistemas Psicológicos", "Socioantropología de la Salud", "Estadística Aplicada a la Psicología"],
                semestre_2: ["Neuroanatomía y Neurofisiología Clínica", "Psicología del Desarrollo (Infancia y Adolescencia)", "Psicología del Desarrollo (Adultez y Vejez)", "Procesos Cognitivos Superiores (Pensamiento y Lenguaje)", "Entrevista Psicológica y Observación Clínica"],
                semestre_3: ["Semiología Psiquiátrica y Psicopatología General I", "Teorías de la Personalidad y Trastornos de Personalidad", "Neuropsicología Básica", "Psicología Social y Comunitaria", "Psicometría y Construcción de Pruebas"],
                semestre_4: ["Psicopatología Especial II (DSM-5-TR y CIE-11)", "Técnicas de Evaluación Psicológica y Pruebas Proyectivas/Objetivas", "Psicopatología Infantil y del Adolescente", "Sexualidad Humana y Disfunciones Sexuales", "Metodología de la Investigación Cuantitativa y Cualitativa"],
                semestre_5: ["Psicodiagnóstico Clínico e Integración de Informes", "Evaluación y Rehabilitación Neuropsicológica", "Modelos Psicoterapéuticos (Enfoque Sistémico y Humanista)", "Psicología de la Salud y Enfermedades Crónicas", "Deontología y Bioética en Psicología"],
                semestre_6: ["Psicoterapia Cognitivo-Conductual (TCC) y Terapias de Tercera Generación", "Psicoterapia de orientación Psicodinámica", "Intervención Clínica en Niños y Adolescentes", "Psicoterapia Familiar y de Pareja", "Salud Mental Comunitaria y Normativa MSP"],
                semestre_7: ["Intervención en Crisis, Emergencias, Desastres y Riesgo Suicida", "Prevención y Tratamiento de Adicciones / Consumo Problemático", "Psicofarmacología Aplicada para Psicólogos Clínicos", "Psicogerontología Clínica", "Diseño de Trabajo de Titulación"],
                semestre_8: ["Psicología Clínica Hospitalaria y Cuidados Paliativos", "Psicología Forense, Peritaje y Violencia de Género", "Supervisión de Casos Clínicos Integrados", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },

        // 11. ATENCIÓN PREHOSPITALARIA Y EMERGENCIAS (8 Semestres + Titulación)
        atencion_prehospitalaria: {
            nombre: "11. Atención Prehospitalaria y Emergencias",
            niveles: [
                { id: "nivelacion", nombre: "Nivelación Universitaria" },
                { id: "semestre_1", nombre: "1.° Semestre (Anatomía, Fisiología y BLS)" },
                { id: "semestre_2", nombre: "2.° Semestre (Semiología, Vía Aérea y Cinemática)" },
                { id: "semestre_3", nombre: "3.° Semestre (Farmacología de Urgencias y Trauma I)" },
                { id: "semestre_4", nombre: "4.° Semestre (Emergencias Clínicas, ECG y ACLS)" },
                { id: "semestre_5", nombre: "5.° Semestre (Trauma Avanzado PHTLS y Quirúrgicas)" },
                { id: "semestre_6", nombre: "6.° Semestre (Emergencias Obstétricas y Pediátricas PALS)" },
                { id: "semestre_7", nombre: "7.° Semestre (Desastres, Triaje START y MatPel)" },
                { id: "semestre_8", nombre: "8.° Semestre (Transporte Crítico, SIS ECU-911 y Titulación)" },
                { id: "titulacion_complexivo", nombre: "Titulación / Examen Complexivo" }
            ],
            materiasPorNivel: {
                nivelacion: ["Biología Humana", "Química y Física Aplicada", "Anatomía Elemental", "Introducción a los Sistemas de Emergencias Médicas (SEM)", "Acondicionamiento Físico y Bioseguridad"],
                semestre_1: ["Anatomía Humana Topográfica y de Urgencias", "Fisiología Humana Aplicada a la Emergencia", "Soporte Vital Básico (BLS) y DEA", "Bioseguridad, Cinemática del Trauma y Evaluación de la Escena", "Comunicaciones Médicas y Sistema Integrado ECU-911"],
                semestre_2: ["Semiología y Valoración Primaria/Secundaria del Paciente Crítico (XABCDE)", "Manejo Básico y Avanzado de la Vía Aérea y Ventilación Mecánica de Transporte", "Fisiopatología del Shock y Fluidoterapia / Accesos Vasculares e Intraóseos", "Inmovilización, Empaquetamiento y Extricación Vehicular", "Psicología de la Emergencia y Primeros Auxilios Psicológicos"],
                semestre_3: ["Farmacología de Urgencias y Cálculo de Infusiones Vasoactivas", "Electrocardiografía Básica y Arritmias en Urgencias", "Emergencias Respiratorias y Neurológicas Prehospitalarias", "Manejo Prehospitalario del Trauma I (TEC y Trauma Raquimedular)", "Epidemiología y Bioestadística del Trauma"],
                semestre_4: ["Soporte Vital Cardiovascular Avanzado (ACLS) y Síndrome Coronario Agudo", "Emergencias Metabólicas, Endócrinas y Ambientales", "Manejo Prehospitalario del Trauma II (Tórax, Abdomen, Pelvis y Quemados - PHTLS)", "Toxicología Clínica de Urgencias y Envenenamientos", "Ética, Legislación Médica y Cadena de Custodia"],
                semestre_5: ["Emergencias Quirúrgicas y Abdomen Agudo Prehospitalario", "Tácticas de Rescate Urbano, Vertical y en Espacios Confinados", "Manejo de Hemorragias Exanguinantes (Stop the Bleed) y Transfusión Prehospitalaria", "Emergencias Psiquiátricas y Paciente Agitado", "Metodología de la Investigación"],
                semestre_6: ["Emergencias Obstétricas, Parto Expulsivo y Claves Obstétricas MSP", "Soporte Vital Avanzado Pediátrico (PALS) y Reanimación Neonatal (NRP)", "Emergencias Geriátricas y Paciente Polifarmacia", "Ecografía Focalizada en Trauma y Emergencias (E-FAST)", "Salud Pública"],
                semestre_7: ["Gestión de Riesgos, Desastres e Incidentes con Múltiples Víctimas (Triaje START / META)", "Materiales Peligrosos (MatPel / HAZMAT) y Riesgos NRBQ", "Medicina Táctica (TECC / TCCC)", "Transporte Sanitario Terrestre, Aéreo (Aeromedicina) y Evacuación Crítica", "Diseño de Titulación"],
                semestre_8: ["Cuidados Intensivos durante el Transporte Interhospitalario", "Gerencia de Servicios de Emergencias Médicas y Auditoría", "Simulación Integrada de Casos Críticos Prehospitalarios", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        }
    }
};

// Subcarpetas oficiales de la Bóveda Multimedia para Imágenes Clínicas
const CLINICAL_IMAGE_FOLDERS = [
    { prefix: "assets/4-banco-clinico/atlas-visual/", label: "📁 assets/4-banco-clinico/atlas-visual/ (Lesiones, placas, fotos)" },
    { prefix: "assets/4-banco-clinico/electrocardiografia/", label: "📁 assets/4-banco-clinico/electrocardiografia/ (Tiras ECG)" },
    { prefix: "assets/4-banco-clinico/imagenologia/", label: "📁 assets/4-banco-clinico/imagenologia/ (RX, TAC, RMN, Eco)" },
    { prefix: "assets/5-multimedia-1d/infografias-y-algoritmos/", label: "📁 assets/5-multimedia-1d/infografias-y-algoritmos/" }
];

// Estado interno del módulo
let questionsCache = [];
let editingQuestionId = null;
let uploadedClinicalImageBase64 = null;
let activeCatalogTab = "active"; // "active" | "trash"

// ============================================================================
// 2. VERIFICACIÓN DE PERMISOS E INICIALIZACIÓN
// ============================================================================

function hasMasterPermission() {
    const email = (
        auth?.currentUser?.email ||
        appState?.currentUser?.email ||
        appState?.currentUserData?.email ||
        ""
    ).toLowerCase().trim();
    return isMasterAdmin(email) || MASTER_ADMINS.includes(email);
}

export async function initAdminQuestions() {
    if (!hasMasterPermission()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    renameAdminTabToQuestionBank();

    let section = document.getElementById("admin-questions-section");
    if (!section) {
        section = document.createElement("div");
        section.id = "admin-questions-section";
        section.className = "space-y-6 mt-6";
        adminView.appendChild(section);
    }

    renderQuestionsAdminUI(section);
    bindQuestionsEvents();
    await loadQuestionsBank();
}

function renameAdminTabToQuestionBank() {
    const tabButtons = document.querySelectorAll('[data-admin-tab="reactivos"], #tab-admin-questions, button');
    tabButtons.forEach(btn => {
        if (btn.textContent && /Reactivos\s*CACES/i.test(btn.textContent)) {
            btn.innerHTML = btn.innerHTML.replace(/Reactivos\s*CACES/gi, "Banco de Preguntas");
        }
    });
}

// ============================================================================
// 3. INTERFAZ DEL MÓDULO «BANCO DE PREGUNTAS»
// ============================================================================

function renderQuestionsAdminUI(container) {
    container.innerHTML = `
        <!-- CABECERA DEL MÓDULO: BANCO DE PREGUNTAS -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4 mb-5">
                <div>
                    <span class="text-[11px] font-mono uppercase tracking-widest text-primary block">
                        Colección Firestore: ${QUESTIONS_COLLECTION} • Malla Armonizada CES Ecuador + EHEP CACES
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-1">
                        <span class="material-symbols-outlined text-primary">quiz</span>
                        <span>Banco de Preguntas (CACES Oficial + Malla Universitaria por Semestre)</span>
                    </h3>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <div class="px-3 py-1.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-gray-300">
                        Activos: <strong id="kpi-admin-questions-local" class="text-primary">0</strong>
                        <span class="mx-1 text-gray-600">|</span>
                        Papelera: <strong id="kpi-admin-questions-trash" class="text-danger">0</strong>
                    </div>
                    <button type="button" id="btn-aq-refresh" class="px-3.5 py-2 rounded-xl bg-surface border border-gray-600 hover:border-primary text-xs font-bold text-gray-200 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">refresh</span>
                        <span>Sincronizar</span>
                    </button>
                    <button type="button" id="btn-aq-export-json" class="px-3.5 py-2 rounded-xl bg-surface border border-secondary/60 hover:bg-secondary/10 text-xs font-bold text-secondary transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Vista (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- FORMULARIO PRINCIPAL DE CREACIÓN / EDICIÓN -->
            <form id="admin-question-form" class="space-y-5">
                <div class="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2.5 rounded-xl border border-surface-high">
                    <span id="aq-form-mode-badge" class="text-xs font-mono font-bold text-secondary">
                        ➕ MODO CREACIÓN: Nuevo Reactivo para el Banco de Preguntas
                    </span>
                    <button type="button" id="btn-aq-cancel-edit" class="hidden text-xs font-mono text-danger hover:underline">
                        ✖ Cancelar edición y limpiar formulario
                    </button>
                </div>

                <!-- BRÚJULA DE RUTA EXACTA EN VIVO -->
                <div class="bg-primary/10 border border-primary/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="text-xs font-mono text-gray-200 flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-base">route</span>
                        <span><strong>Destino Exacto de Guardado:</strong></span>
                        <span id="aq-route-preview-text" class="text-primary font-extrabold"></span>
                    </div>
                    <span class="text-[10px] font-mono text-gray-400">
                        Malla oficial sincronizada por carrera y semestre
                    </span>
                </div>

                <!-- FILA 1: CASCADA CURRICULAR ESTRICTA (1. ÁMBITO -> 2. CARRERA -> 3. NIVEL -> 4. MATERIA) -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            1. Ámbito Curricular
                        </label>
                        <select id="aq-scope" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="caces">🎯 Habilitación CACES (EHEP Oficial)</option>
                            <option value="carrera">🏛️ Malla Universitaria (11 Carreras + Preuniv.)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            2. Carrera Destino
                        </label>
                        <select id="aq-carrera" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            3. Nivel / Semestre
                        </label>
                        <select id="aq-nivel" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            4. Materia / Área Clínica (Por Semestre)
                        </label>
                        <select id="aq-materia" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>
                </div>

                <!-- FILA 2: DIFICULTAD, CANDADO DEL PLAN, VISIBILIDAD INICIAL Y TEMA ESPECÍFICO / PATOLOGÍA -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            5. Dificultad del Reactivo
                        </label>
                        <select id="aq-dificultad" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="Baja">🟢 Baja (Conceptos / Reconocimiento)</option>
                            <option value="Media" selected>🟡 Media (Aplicación Clínica Estándar)</option>
                            <option value="Alta">🔴 Alta (Caso Complejo / CACES Élite)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            6. Candado del Plan
                        </label>
                        <select id="aq-plan" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="Básico">🔓 Plan Básico (Abierto / Demo)</option>
                            <option value="PRO" selected>💎 Makai PRO (Suscriptores PRO)</option>
                            <option value="VIP">👑 Mentoría Élite VIP</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            7. Visibilidad para Alumnos
                        </label>
                        <select id="aq-visible" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="true" selected>🟢 Visible inmediatamente en Simuladores</option>
                            <option value="false">🙈 Oculto (Borrador / En revisión)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            8. Tema Específico / Patología (Opcional)
                        </label>
                        <input
                            type="text"
                            id="aq-subtema"
                            list="aq-subtema-suggestions"
                            placeholder="Ej: Preeclampsia Severa / GPC Score MAMÁ"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"
                        />
                        <datalist id="aq-subtema-suggestions">
                            <option value="GPC MSP Ecuador (Normativa Oficial)"></option>
                            <option value="Diagnóstico Diferencial"></option>
                            <option value="Tratamiento de Primera Línea"></option>
                            <option value="Manejo de Emergencia / Código Rojo"></option>
                            <option value="Fisiopatología y Semiología"></option>
                            <option value="Farmacología y Dosis Crítica"></option>
                        </datalist>
                        <span class="text-[10px] text-gray-500 block mt-0.5">
                            Indica qué enfermedad o guía específica evalúa dentro de la materia.
                        </span>
                    </div>
                </div>

                <!-- FILA 3: IMAGEN CLÍNICA (MODO RUTA VERIFICADA + MODO SUBIDA DIRECTA DESDE TU PC) -->
                <div class="bg-surface border border-surface-high rounded-2xl p-4 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <label class="text-xs font-extrabold text-white flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-primary text-base">image</span>
                                <span>9. Imagen Clínica Adjunta (Opcional: ECG, Rayos X, TAC, Lesión, Esquema)</span>
                            </label>
                            <p class="text-[11px] text-gray-400">
                                Elige la carpeta destino en <code class="text-primary font-mono">assets/4-banco-clinico/</code> y verifica la ruta o sube el archivo directamente desde tu computadora.
                            </p>
                        </div>
                        <div class="flex items-center gap-2 text-xs font-mono">
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-primary/50 text-primary flex items-center gap-1.5">
                                <input type="radio" name="aq-img-mode" value="path" checked class="accent-cyan-400" />
                                <span>📂 Usar Ruta de Carpeta</span>
                            </label>
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-secondary/50 text-secondary flex items-center gap-1.5">
                                <input type="radio" name="aq-img-mode" value="upload" class="accent-lime-400" />
                                <span>💻 Subir Imagen desde mi PC</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                        <div>
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                                Carpeta Destino en Bóveda (assets/)
                            </label>
                            <select id="aq-asset-folder" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-primary focus:outline-none"></select>
                        </div>

                        <div id="aq-img-path-box" class="md:col-span-2 space-y-1">
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                                Ruta Completa de la Imagen (Puedes escribir solo el nombre, ej: ecg.png)
                            </label>
                            <div class="flex gap-2">
                                <input
                                    type="text"
                                    id="aq-imagen-url"
                                    placeholder="assets/4-banco-clinico/atlas-visual/ecg.png"
                                    class="flex-1 bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none"
                                />
                                <button type="button" id="btn-aq-test-img" class="px-3 py-2 rounded-xl bg-surface-container border border-primary text-primary hover:bg-primary hover:text-surface text-xs font-extrabold transition-all whitespace-nowrap">
                                    🔍 Probar Imagen
                                </button>
                            </div>
                        </div>

                        <div id="aq-img-upload-box" class="hidden md:col-span-2 space-y-1">
                            <label class="block text-[10px] font-mono text-secondary uppercase mb-1">
                                Selecciona la imagen desde tu computadora (.PNG, .JPG, .WEBP)
                            </label>
                            <input
                                type="file"
                                id="aq-imagen-file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                class="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-secondary file:text-surface cursor-pointer"
                            />
                            <p class="text-[10px] text-gray-400">
                                Se asociará automáticamente a la ruta de carpeta elegida y quedará guardada en Firestore para mostrarse al instante.
                            </p>
                        </div>
                    </div>

                    <div id="aq-img-live-preview-wrap" class="hidden bg-surface-container border border-surface-high rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <img id="aq-img-live-preview" src="" alt="Vista previa" class="w-20 h-20 object-contain rounded-lg border border-primary bg-black" />
                            <div class="text-xs font-mono space-y-1">
                                <div id="aq-img-live-status" class="font-extrabold text-secondary">✅ Imagen verificada correctamente</div>
                                <div id="aq-img-live-path" class="text-[11px] text-gray-400 break-all"></div>
                            </div>
                        </div>
                        <button type="button" id="btn-aq-clear-img" class="px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/40 text-danger text-xs font-bold hover:bg-danger hover:text-white">
                            ✕ Quitar Imagen
                        </button>
                    </div>
                </div>

                <!-- FILA 4: VIÑETA CLÍNICA / ENUNCIADO -->
                <div>
                    <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">
                        10. Viñeta Clínica / Enunciado del Reactivo *
                    </label>
                    <textarea
                        id="aq-enunciado"
                        rows="4"
                        required
                        placeholder="Describe el caso clínico completo: edad, sexo, motivo de consulta, antecedentes, signos vitales, hallazgos al examen físico o laboratorio y la pregunta concreta..."
                        class="w-full bg-surface border border-surface-high rounded-xl p-3.5 text-xs text-white focus:border-primary focus:outline-none leading-relaxed"
                    ></textarea>
                </div>

                <!-- FILA 5: OPCIONES A, B, C, D -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Opción A *</label>
                        <input type="text" id="aq-opt-a" required placeholder="Texto de la opción A..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Opción B *</label>
                        <input type="text" id="aq-opt-b" required placeholder="Texto de la opción B..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Opción C *</label>
                        <input type="text" id="aq-opt-c" required placeholder="Texto de la opción C..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Opción D *</label>
                        <input type="text" id="aq-opt-d" required placeholder="Texto de la opción D..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <!-- FILA 6: RESPUESTA CORRECTA Y RACIONAL CIENTÍFICO -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            11. Respuesta Correcta *
                        </label>
                        <select id="aq-correcta" required class="w-full bg-surface border-2 border-secondary/60 rounded-xl px-3 py-2.5 text-xs font-extrabold text-secondary focus:border-secondary focus:outline-none">
                            <option value="A">Literal A</option>
                            <option value="B">Literal B</option>
                            <option value="C">Literal C</option>
                            <option value="D">Literal D</option>
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">
                            12. Racional Científico / Justificación Oficial (Por qué es correcta y por qué se descartan las demás) *
                        </label>
                        <textarea
                            id="aq-racional"
                            rows="3"
                            required
                            placeholder="Fundamentación clínica basada en GPC del MSP, Harrison, Nelson, Williams, NANDA-NIC-NOC o Schwartz..."
                            class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none leading-relaxed"
                        ></textarea>
                    </div>
                </div>

                <!-- BOTÓN DE GUARDADO -->
                <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button type="submit" id="btn-aq-submit" class="px-6 py-3 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
                        <span class="material-symbols-outlined text-base">save</span>
                        <span id="btn-aq-submit-label">Guardar Reactivo en el Banco de Preguntas</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- IMPORTADOR MASIVO POR LOTES (.JSON) CON RUTA GUIADA Y PRE-VALIDADOR -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">upload_file</span>
                        <span>Importación Masiva de Reactivos por Lotes (.JSON) con Ruta Garantizada</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Con el candado inferior activo, todo el lote JSON se guardará exactamente en el Ámbito, Carrera, Semestre y Materia seleccionados arriba.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <label class="cursor-pointer px-3 py-2 bg-surface border border-gray-600 hover:border-primary text-xs text-gray-200 rounded-xl font-mono flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-primary">folder_open</span>
                        <span>Cargar archivo .JSON</span>
                        <input type="file" id="aq-json-file-input" accept=".json,application/json" class="hidden" />
                    </label>
                    <button type="button" id="btn-aq-load-template" class="px-3 py-2 bg-surface border border-gray-700 hover:border-secondary text-xs text-secondary rounded-xl font-mono">
                        📋 Insertar Plantilla con Ruta Actual
                    </button>
                </div>
            </div>

            <div class="bg-surface border border-secondary/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <label class="flex items-center gap-2.5 text-xs text-white font-mono cursor-pointer">
                    <input type="checkbox" id="aq-batch-force-route" checked class="w-4 h-4 accent-lime-400" />
                    <span>
                        🎯 <strong>Forzar Ruta Actual del Formulario para todo este lote:</strong>
                        <span id="aq-batch-route-badge" class="text-secondary font-extrabold ml-1"></span>
                    </span>
                </label>
                <span class="text-[10px] font-mono text-gray-400">
                    Garantiza que ninguna pregunta se desvíe de carrera o semestre.
                </span>
            </div>

            <textarea
                id="aq-json-batch-textarea"
                rows="5"
                placeholder='[\n  {\n    "enunciado": "Paciente masculino de 58 años acude por dolor torácico opresivo...",\n    "opciones": { "A": "...", "B": "...", "C": "...", "D": "..." },\n    "respuestaCorrecta": "A",\n    "racional": "El supradesnivel del ST en V1-V4 confirma IAM anterior...",\n    "dificultad": "Alta",\n    "subtema": "Síndrome Coronario Agudo"\n  }\n]'
                class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-primary focus:outline-none"
            ></textarea>

            <div id="aq-batch-validation-box" class="hidden bg-surface border border-primary/40 rounded-xl p-3 text-xs font-mono text-gray-200"></div>

            <div class="flex flex-wrap justify-end gap-2.5">
                <button type="button" id="btn-aq-validate-batch" class="px-4 py-2.5 bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">fact_check</span>
                    <span>1. Pre-validar Lote y Ruta</span>
                </button>
                <button type="button" id="btn-aq-import-batch" class="px-5 py-2.5 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">cloud_upload</span>
                    <span>2. Procesar e Importar Lote a Firestore</span>
                </button>
            </div>
        </div>

        <!-- CATÁLOGO ACTIVO EN CLOUD FIRESTORE + FILTROS AVANZADOS + PAPELERA -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <h4 class="text-base font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">manage_search</span>
                        <span>Catálogo del Banco de Preguntas en Cloud Firestore</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Filtra por ámbito, carrera, semestre, visibilidad o plan. Cambia la visibilidad o el plan en 1 clic, edita o restaura desde la Papelera.
                    </p>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" id="btn-aq-tab-active" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5">
                        <span>📚 Catálogo Activo</span>
                        <span id="badge-aq-active-count" class="px-1.5 py-0.5 rounded bg-black/20 text-[10px]">0</span>
                    </button>
                    <button type="button" id="btn-aq-tab-trash" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5">
                        <span>🗑️ Papelera</span>
                        <span id="badge-aq-trash-count" class="px-1.5 py-0.5 rounded bg-danger/20 text-[10px]">0</span>
                    </button>
                </div>
            </div>

            <!-- BARRA DE FILTROS AVANZADOS -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="lg:col-span-2">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Buscar por Enunciado, Tema, Materia o Racional</label>
                    <input type="text" id="aq-filter-search" placeholder="🔍 Ej: Preeclampsia, NANDA, ECG, Score MAMÁ, Farmacología..." class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none" />
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Ámbito Curricular</label>
                    <select id="aq-filter-scope" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos (CACES + Malla Univ.)</option>
                        <option value="caces">🎯 Solo Habilitación CACES</option>
                        <option value="carrera">🏛️ Solo Malla Universitaria</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Carrera</label>
                    <select id="aq-filter-career" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todas las Carreras</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Nivel / Semestre</label>
                    <select id="aq-filter-level" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos los Niveles / Semestres</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Visibilidad para Usuarios</label>
                    <select id="aq-filter-visibility" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todas (Visibles + Ocultas)</option>
                        <option value="visible">🟢 Solo Visibles para Usuarios</option>
                        <option value="hidden">🙈 Solo Ocultas / Borradores</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Candado del Plan</label>
                    <select id="aq-filter-plan" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos los Planes (Básico/PRO/VIP)</option>
                        <option value="Básico">🔓 Plan Básico</option>
                        <option value="PRO">💎 Makai PRO</option>
                        <option value="VIP">👑 Élite VIP</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Dificultad</label>
                    <select id="aq-filter-difficulty" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todas las Dificultades</option>
                        <option value="Baja">🟢 Dificultad Baja</option>
                        <option value="Media">🟡 Dificultad Media</option>
                        <option value="Alta">🔴 Dificultad Alta</option>
                    </select>
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
                <span id="aq-filter-count-label">Mostrando 0 reactivos</span>
                <button type="button" id="btn-aq-empty-trash" class="hidden px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px] transition-all">
                    🔥 Vaciar toda la Papelera definitivamente
                </button>
            </div>

            <!-- TABLA DEL CATÁLOGO DE PREGUNTAS -->
            <div class="overflow-x-auto rounded-xl border border-surface-high">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-surface text-[11px] font-mono text-gray-400 uppercase border-b border-surface-high">
                            <th class="py-3 px-4">Ruta Curricular (Ámbito / Carrera / Semestre / Materia)</th>
                            <th class="py-3 px-4">Viñeta Clínica / Tema Específico</th>
                            <th class="py-3 px-4">Resp. / Dif.</th>
                            <th class="py-3 px-4">Visibilidad & Plan</th>
                            <th class="py-3 px-4 text-right">Acciones CRUD / Papelera</th>
                        </tr>
                    </thead>
                    <tbody id="aq-questions-tbody" class="divide-y divide-surface-high text-xs"></tbody>
                </table>
            </div>
        </div>

        <!-- MODAL DE VISTA PREVIA MODO TUTOR -->
        <div id="aq-preview-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div class="bg-surface-container border border-primary/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between border-b border-surface-high pb-3">
                    <div>
                        <span id="aq-preview-meta" class="text-[11px] font-mono text-primary uppercase"></span>
                        <h4 class="text-base font-extrabold text-white">Vista Previa del Reactivo (Modo Tutor)</h4>
                    </div>
                    <button type="button" id="btn-aq-close-preview" class="text-gray-400 hover:text-white text-sm font-mono px-2.5 py-1 rounded-lg bg-surface">
                        ✕ Cerrar
                    </button>
                </div>
                <div id="aq-preview-image-box" class="hidden rounded-xl overflow-hidden border border-surface-high bg-black/40 p-2 text-center">
                    <img id="aq-preview-image" src="" alt="Imagen Clínica" class="max-h-64 mx-auto rounded-lg object-contain" />
                </div>
                <p id="aq-preview-stem" class="text-sm text-gray-100 leading-relaxed whitespace-pre-line"></p>
                <div id="aq-preview-options" class="space-y-2"></div>
                <div class="bg-surface border-l-4 border-secondary p-4 rounded-r-xl">
                    <span class="text-[11px] font-mono uppercase text-secondary font-bold block mb-1">
                        📖 Racional Científico Oficial
                    </span>
                    <p id="aq-preview-rationale" class="text-xs text-gray-300 leading-relaxed whitespace-pre-line"></p>
                </div>
            </div>
        </div>
    `;

    populateAssetFoldersSelect();
    populateCascadingCareerOptions();
    populateFilterDropdowns();
}

// ============================================================================
// 4. LÓGICA DE CASCADA CURRICULAR ESTRICTA POR SEMESTRE Y CARRERA
// ============================================================================

function populateAssetFoldersSelect() {
    const folderSelect = document.getElementById("aq-asset-folder");
    if (!folderSelect) return;
    folderSelect.innerHTML = CLINICAL_IMAGE_FOLDERS
        .map(f => `<option value="${f.prefix}">${f.label}</option>`)
        .join("");
}

function populateCascadingCareerOptions(selectedCareer = null) {
    const scopeEl = document.getElementById("aq-scope");
    const careerEl = document.getElementById("aq-carrera");
    if (!scopeEl || !careerEl) return;

    const scope = scopeEl.value === "carrera" ? "carrera" : "caces";
    const careersDict = CURRICULUM_MAP[scope] || CURRICULUM_MAP.caces;
    const careerKeys = Object.keys(careersDict);

    careerEl.innerHTML = careerKeys
        .map(key => `<option value="${key}">${careersDict[key].nombre}</option>`)
        .join("");

    if (selectedCareer && careersDict[selectedCareer]) {
        careerEl.value = selectedCareer;
    }

    populateCascadingLevelOptions();
}

function populateCascadingLevelOptions(selectedLevel = null) {
    const scope = document.getElementById("aq-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("aq-carrera")?.value || "medicina";
    const levelEl = document.getElementById("aq-nivel");
    if (!levelEl) return;

    const careerObj = CURRICULUM_MAP[scope]?.[careerId] || CURRICULUM_MAP.caces.medicina;
    const levels = careerObj.niveles || [{ id: "caces_oficial", nombre: "Examen de Habilitación Profesional (EHEP - CACES)" }];

    levelEl.innerHTML = levels
        .map(lvl => `<option value="${lvl.id}">${lvl.nombre}</option>`)
        .join("");

    levelEl.disabled = levels.length === 1;
    levelEl.classList.toggle("opacity-75", levels.length === 1);

    if (selectedLevel && levels.some(l => l.id === selectedLevel)) {
        levelEl.value = selectedLevel;
    }

    populateCascadingSubjectOptions();
}

function populateCascadingSubjectOptions(selectedSubject = null) {
    const scope = document.getElementById("aq-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("aq-carrera")?.value || "medicina";
    const levelId = document.getElementById("aq-nivel")?.value || "caces_oficial";
    const subjectEl = document.getElementById("aq-materia");
    if (!subjectEl) return;

    const careerObj = CURRICULUM_MAP[scope]?.[careerId] || CURRICULUM_MAP.caces.medicina;
    const subjectsByLevel = careerObj.materiasPorNivel || {};
    const subjects = subjectsByLevel[levelId] || subjectsByLevel.default || ["General"];

    subjectEl.innerHTML = subjects
        .map(subj => `<option value="${subj}">${subj}</option>`)
        .join("");

    if (selectedSubject) {
        if (!subjects.includes(selectedSubject)) {
            const customOpt = document.createElement("option");
            customOpt.value = selectedSubject;
            customOpt.textContent = selectedSubject;
            subjectEl.appendChild(customOpt);
        }
        subjectEl.value = selectedSubject;
    }

    updateLiveRouteBanner();
}

function updateLiveRouteBanner() {
    const scope = document.getElementById("aq-scope")?.value === "carrera" ? "Malla Universitaria" : "Habilitación CACES";
    const careerSelect = document.getElementById("aq-carrera");
    const levelSelect = document.getElementById("aq-nivel");
    const subjectSelect = document.getElementById("aq-materia");
    const planSelect = document.getElementById("aq-plan");
    const visibleSelect = document.getElementById("aq-visible");

    const careerText = careerSelect?.options[careerSelect.selectedIndex]?.text || "---";
    const levelText = levelSelect?.options[levelSelect.selectedIndex]?.text || "---";
    const subjectText = subjectSelect?.value || "---";
    const planText = planSelect?.value || "PRO";
    const visText = visibleSelect?.value === "false" ? "Oculto" : "Visible";

    const routeSummary = `${scope} ➔ ${careerText} ➔ ${levelText} ➔ ${subjectText} (Plan ${planText} • ${visText})`;

    const previewEl = document.getElementById("aq-route-preview-text");
    if (previewEl) previewEl.textContent = routeSummary;

    const batchRouteEl = document.getElementById("aq-batch-route-badge");
    if (batchRouteEl) batchRouteEl.textContent = `[${scope} > ${careerText} > ${levelText} > ${subjectText}]`;
}

function populateFilterDropdowns() {
    const filterCareer = document.getElementById("aq-filter-career");
    const filterLevel = document.getElementById("aq-filter-level");

    if (filterCareer) {
        const allCareers = { ...CURRICULUM_MAP.carrera, ...CURRICULUM_MAP.caces };
        filterCareer.innerHTML = `<option value="all">Todas las Carreras</option>` +
            Object.keys(allCareers)
                .map(id => `<option value="${id}">${allCareers[id].nombre}</option>`)
                .join("");
    }

    if (filterLevel) {
        const allLevels = [
            { id: "caces_oficial", nombre: "Examen Oficial CACES (EHEP)" },
            { id: "preuniversitario", nombre: "Tronco Común Preuniversitario" },
            ...CURRICULUM_MAP.carrera.medicina.niveles
        ];
        filterLevel.innerHTML = `<option value="all">Todos los Niveles / Semestres</option>` +
            allLevels.map(l => `<option value="${l.id}">${l.nombre}</option>`).join("");
    }
}

function syncImagePathWithFolder() {
    const folderPrefix = document.getElementById("aq-asset-folder")?.value || "assets/4-banco-clinico/atlas-visual/";
    const imgInput = document.getElementById("aq-imagen-url");
    if (!imgInput) return;

    const currentVal = imgInput.value.trim();
    if (!currentVal) {
        imgInput.placeholder = `${folderPrefix}ecg.png`;
        return;
    }

    if (!currentVal.startsWith("http") && !currentVal.startsWith("data:")) {
        const cleanFileName = currentVal.split("/").pop() || "imagen.png";
        imgInput.value = `${folderPrefix}${cleanFileName}`;
    }
}

function testAndPreviewClinicalImage(customSource = null) {
    const wrap = document.getElementById("aq-img-live-preview-wrap");
    const imgEl = document.getElementById("aq-img-live-preview");
    const statusEl = document.getElementById("aq-img-live-status");
    const pathEl = document.getElementById("aq-img-live-path");
    const imgInput = document.getElementById("aq-imagen-url");

    if (!wrap || !imgEl || !statusEl || !pathEl) return;

    syncImagePathWithFolder();
    const targetUrl = customSource || uploadedClinicalImageBase64 || imgInput?.value.trim() || "";

    if (!targetUrl) {
        wrap.classList.add("hidden");
        return;
    }

    wrap.classList.remove("hidden");
    pathEl.textContent = `Ruta asignada: ${imgInput?.value.trim() || "Imagen directa en Firestore"}`;
    statusEl.textContent = "⏳ Verificando carga de la imagen...";
    statusEl.className = "font-extrabold text-warning";

    imgEl.onload = () => {
        statusEl.textContent = uploadedClinicalImageBase64
            ? "✅ Imagen cargada desde tu PC y vinculada a la ruta seleccionada"
            : "✅ Imagen encontrada y verificada en la ruta seleccionada";
        statusEl.className = "font-extrabold text-secondary";
    };

    imgEl.onerror = () => {
        statusEl.textContent = "⚠️ Archivo aún no encontrado en esa ruta de GitHub (Súbelo a esa carpeta o usa 'Subir Imagen desde mi PC')";
        statusEl.className = "font-extrabold text-danger";
    };

    imgEl.src = targetUrl;
}

function handleDirectImageUpload(file) {
    if (!file) return;

    const folderPrefix = document.getElementById("aq-asset-folder")?.value || "assets/4-banco-clinico/atlas-visual/";
    const safeFileName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const logicalPath = `${folderPrefix}${safeFileName}`;

    const imgInput = document.getElementById("aq-imagen-url");
    if (imgInput) imgInput.value = logicalPath;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const rawDataUrl = String(ev.target?.result || "");
        const img = new Image();
        img.onload = () => {
            const maxDim = 900;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            uploadedClinicalImageBase64 = canvas.toDataURL("image/webp", 0.82);
            testAndPreviewClinicalImage(uploadedClinicalImageBase64);
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
}

// ============================================================================
// 5. EVENTOS DEL MÓDULO
// ============================================================================

function bindQuestionsEvents() {
    document.getElementById("aq-scope")?.addEventListener("change", () => populateCascadingCareerOptions());
    document.getElementById("aq-carrera")?.addEventListener("change", () => populateCascadingLevelOptions());
    document.getElementById("aq-nivel")?.addEventListener("change", () => populateCascadingSubjectOptions());
    document.getElementById("aq-materia")?.addEventListener("change", updateLiveRouteBanner);
    document.getElementById("aq-plan")?.addEventListener("change", updateLiveRouteBanner);
    document.getElementById("aq-visible")?.addEventListener("change", updateLiveRouteBanner);

    document.querySelectorAll('input[name="aq-img-mode"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            const mode = e.target.value;
            document.getElementById("aq-img-path-box")?.classList.toggle("hidden", mode !== "path");
            document.getElementById("aq-img-upload-box")?.classList.toggle("hidden", mode !== "upload");
        });
    });

    document.getElementById("aq-asset-folder")?.addEventListener("change", () => {
        syncImagePathWithFolder();
        if (document.getElementById("aq-imagen-url")?.value.trim()) {
            testAndPreviewClinicalImage();
        }
    });

    document.getElementById("btn-aq-test-img")?.addEventListener("click", () => {
        uploadedClinicalImageBase64 = null;
        testAndPreviewClinicalImage();
    });

    document.getElementById("aq-imagen-file")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleDirectImageUpload(file);
    });

    document.getElementById("btn-aq-clear-img")?.addEventListener("click", () => {
        uploadedClinicalImageBase64 = null;
        const urlEl = document.getElementById("aq-imagen-url");
        const fileEl = document.getElementById("aq-imagen-file");
        if (urlEl) urlEl.value = "";
        if (fileEl) fileEl.value = "";
        document.getElementById("aq-img-live-preview-wrap")?.classList.add("hidden");
    });

    document.getElementById("admin-question-form")?.addEventListener("submit", saveQuestionItem);
    document.getElementById("btn-aq-cancel-edit")?.addEventListener("click", resetQuestionForm);
    document.getElementById("btn-aq-refresh")?.addEventListener("click", loadQuestionsBank);
    document.getElementById("btn-aq-export-json")?.addEventListener("click", exportQuestionsBankJSON);

    document.getElementById("btn-aq-load-template")?.addEventListener("click", insertSampleBatchJSON);
    document.getElementById("btn-aq-validate-batch")?.addEventListener("click", () => validateBatchJSON(true));
    document.getElementById("btn-aq-import-batch")?.addEventListener("click", importQuestionsBatchJSON);

    document.getElementById("aq-json-file-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const textarea = document.getElementById("aq-json-batch-textarea");
            if (textarea) textarea.value = String(ev.target?.result || "");
            validateBatchJSON(true);
        };
        reader.readAsText(file);
    });

    document.getElementById("btn-aq-tab-active")?.addEventListener("click", () => switchCatalogTab("active"));
    document.getElementById("btn-aq-tab-trash")?.addEventListener("click", () => switchCatalogTab("trash"));
    document.getElementById("btn-aq-empty-trash")?.addEventListener("click", emptyQuestionsTrash);

    [
        "aq-filter-search",
        "aq-filter-scope",
        "aq-filter-career",
        "aq-filter-level",
        "aq-filter-visibility",
        "aq-filter-plan",
        "aq-filter-difficulty"
    ].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", renderQuestionsTable);
        el?.addEventListener("change", renderQuestionsTable);
    });

    document.getElementById("btn-aq-close-preview")?.addEventListener("click", () => {
        const modal = document.getElementById("aq-preview-modal");
        modal?.classList.add("hidden");
        modal?.classList.remove("flex");
    });
}

function switchCatalogTab(tab) {
    activeCatalogTab = tab === "trash" ? "trash" : "active";
    const btnActive = document.getElementById("btn-aq-tab-active");
    const btnTrash = document.getElementById("btn-aq-tab-trash");
    const btnEmptyTrash = document.getElementById("btn-aq-empty-trash");

    if (activeCatalogTab === "active") {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.add("hidden");
    } else {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-primary/40 text-primary hover:bg-primary/15 transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-danger text-white transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.remove("hidden");
    }

    renderQuestionsTable();
}

// ============================================================================
// 6. LECTURA, FILTRADO Y TABLA CON VISIBILIDAD, PLAN Y PAPELERA
// ============================================================================

export async function loadQuestionsBank() {
    if (!hasMasterPermission()) return;

    const tbody = document.getElementById("aq-questions-tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-400 font-mono">
                    Sincronizando Banco de Preguntas con Cloud Firestore (${QUESTIONS_COLLECTION})...
                </td>
            </tr>
        `;
    }

    try {
        const snap = await getDocs(collection(db, QUESTIONS_COLLECTION));
        questionsCache = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            questionsCache.push({
                id: docSnap.id,
                ...data,
                visible: data.visible !== false,
                enPapelera: data.enPapelera === true
            });
        });

        questionsCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        updateQuestionsCounters();
        renderQuestionsTable();
    } catch (err) {
        console.error("[AdminQuestions] Error consultando preguntas_caces:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-danger font-mono">
                        Error al cargar reactivos desde Firestore: ${escapeHTML(err.message)}
                    </td>
                </tr>
            `;
        }
    }
}

function updateQuestionsCounters() {
    const activeCount = questionsCache.filter(q => !q.enPapelera).length;
    const trashCount = questionsCache.filter(q => q.enPapelera).length;

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
    };

    setEl("kpi-admin-questions-local", activeCount);
    setEl("kpi-admin-questions-trash", trashCount);
    setEl("kpi-admin-questions", activeCount);
    setEl("badge-aq-active-count", activeCount);
    setEl("badge-aq-trash-count", trashCount);
}

function getFilteredQuestions() {
    const searchVal = (document.getElementById("aq-filter-search")?.value || "").toLowerCase().trim();
    const scopeVal = document.getElementById("aq-filter-scope")?.value || "all";
    const careerVal = document.getElementById("aq-filter-career")?.value || "all";
    const levelVal = document.getElementById("aq-filter-level")?.value || "all";
    const visVal = document.getElementById("aq-filter-visibility")?.value || "all";
    const planVal = document.getElementById("aq-filter-plan")?.value || "all";
    const diffVal = document.getElementById("aq-filter-difficulty")?.value || "all";

    return questionsCache.filter(q => {
        const isTrash = q.enPapelera === true;
        if (activeCatalogTab === "trash" && !isTrash) return false;
        if (activeCatalogTab === "active" && isTrash) return false;

        const qScope = q.ambito || (q.nivel && q.nivel !== "caces_oficial" ? "carrera" : "caces");
        if (scopeVal !== "all" && qScope !== scopeVal) return false;
        if (careerVal !== "all" && q.carrera !== careerVal) return false;
        if (levelVal !== "all" && (q.nivel || "caces_oficial") !== levelVal) return false;

        const isVisible = q.visible !== false;
        if (visVal === "visible" && !isVisible) return false;
        if (visVal === "hidden" && isVisible) return false;

        if (planVal !== "all" && (q.planAcceso || "Básico") !== planVal) return false;
        if (diffVal !== "all" && (q.dificultad || "Media") !== diffVal) return false;

        if (searchVal) {
            const haystack = [
                q.enunciado || "",
                q.materia || "",
                q.subtema || "",
                q.racional || "",
                q.opciones?.A || "",
                q.opciones?.B || "",
                q.opciones?.C || "",
                q.opciones?.D || ""
            ].join(" ").toLowerCase();
            if (!haystack.includes(searchVal)) return false;
        }

        return true;
    });
}

function renderQuestionsTable() {
    const tbody = document.getElementById("aq-questions-tbody");
    const countLabel = document.getElementById("aq-filter-count-label");
    if (!tbody) return;

    const filtered = getFilteredQuestions();
    if (countLabel) {
        countLabel.textContent = activeCatalogTab === "trash"
            ? `🗑️ Mostrando ${filtered.length} reactivos en la Papelera de Reciclaje`
            : `📚 Mostrando ${filtered.length} reactivos activos en este filtro`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500 font-mono">
                    ${
                        activeCatalogTab === "trash"
                            ? "La Papelera de Reciclaje está vacía."
                            : "No se encontraron preguntas con los filtros seleccionados."
                    }
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(q => {
        const qScope = q.ambito || (q.nivel && q.nivel !== "caces_oficial" ? "carrera" : "caces");
        const scopeBadge = qScope === "caces"
            ? `<span class="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono font-bold">🎯 CACES</span>`
            : `<span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-mono font-bold">🏛️ MALLA</span>`;

        const isVisible = q.visible !== false;
        const plan = q.planAcceso || "Básico";
        const hasImg = Boolean(q.imagenUrl || q.imagenBase64);

        const tr = document.createElement("tr");
        tr.className = `transition-colors ${
            !isVisible ? "bg-surface/40 opacity-75" : "hover:bg-surface/60"
        }`;

        tr.innerHTML = `
            <td class="py-3.5 px-4 align-top">
                <div class="flex items-center gap-1.5 mb-1">
                    ${scopeBadge}
                    <span class="font-extrabold text-white uppercase text-[11px]">${escapeHTML(q.carrera || "medicina")}</span>
                </div>
                <div class="text-[11px] text-primary font-bold">${escapeHTML(q.materia || "General")}</div>
                <div class="text-[10px] font-mono text-gray-400">Nivel: ${escapeHTML(q.nivel || "caces_oficial")}</div>
            </td>

            <td class="py-3.5 px-4 align-top max-w-md">
                ${
                    q.subtema
                        ? `<span class="inline-block px-2 py-0.5 rounded bg-surface-high text-secondary font-mono text-[10px] font-bold mb-1">📌 Tema: ${escapeHTML(q.subtema)}</span>`
                        : ""
                }
                <div class="text-gray-200 line-clamp-2 leading-relaxed">${escapeHTML(q.enunciado || "")}</div>
                ${
                    hasImg
                        ? `<div class="text-[10px] font-mono text-primary mt-1 flex items-center gap-1">
                               <span>🖼️ Imagen adjunta: ${escapeHTML(q.imagenUrl || "Subida directa")}</span>
                           </div>`
                        : ""
                }
            </td>

            <td class="py-3.5 px-4 align-top font-mono">
                <div class="text-secondary font-extrabold">Resp: ${escapeHTML(q.respuestaCorrecta || "A")}</div>
                <div class="text-[10px] text-gray-400 mt-1">Dif: ${escapeHTML(q.dificultad || "Media")}</div>
            </td>

            <td class="py-3.5 px-4 align-top space-y-1.5">
                <div>
                    <button type="button" class="btn-aq-toggle-vis px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold border transition-all ${
                        isVisible
                            ? "bg-secondary/15 text-secondary border-secondary/40 hover:bg-secondary/25"
                            : "bg-gray-800 text-gray-400 border-gray-600 hover:text-white"
                    }" title="Haz clic para mostrar u ocultar esta pregunta a los usuarios">
                        ${isVisible ? "🟢 Visible Usuarios" : "🙈 Oculto (Borrador)"}
                    </button>
                </div>
                <div>
                    <select class="select-aq-inline-plan bg-surface border border-surface-high rounded-lg px-2 py-1 text-[10px] font-mono text-white focus:border-primary focus:outline-none">
                        <option value="Básico" ${plan === "Básico" ? "selected" : ""}>🔓 Plan Básico</option>
                        <option value="PRO" ${plan === "PRO" ? "selected" : ""}>💎 Plan PRO</option>
                        <option value="VIP" ${plan === "VIP" ? "selected" : ""}>👑 Plan VIP</option>
                    </select>
                </div>
            </td>

            <td class="py-3.5 px-4 align-top text-right whitespace-nowrap space-x-1">
                <button type="button" class="btn-aq-preview px-2.5 py-1.5 rounded-lg bg-surface border border-primary/50 text-primary hover:bg-primary hover:text-surface font-bold text-[11px]" title="Previsualizar en Modo Tutor">
                    👁️
                </button>
                ${
                    activeCatalogTab === "active"
                        ? `
                            <button type="button" class="btn-aq-edit px-2.5 py-1.5 rounded-lg bg-surface border border-secondary/50 text-secondary hover:bg-secondary hover:text-surface font-bold text-[11px]" title="Editar reactivo">
                                ✏️ Editar
                            </button>
                            <button type="button" class="btn-aq-trash px-2.5 py-1.5 rounded-lg bg-surface border border-danger/50 text-danger hover:bg-danger hover:text-white font-bold text-[11px]" title="Enviar a la Papelera">
                                🗑️
                            </button>
                          `
                        : `
                            <button type="button" class="btn-aq-restore px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-secondary text-secondary hover:bg-secondary hover:text-surface font-extrabold text-[11px]" title="Restaurar al Catálogo Activo">
                                ♻️ Restaurar
                            </button>
                            <button type="button" class="btn-aq-delete-perm px-2.5 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px]" title="Eliminar definitivamente de Firestore">
                                🔥 Borrar Definitivo
                            </button>
                          `
                }
            </td>
        `;

        tr.querySelector(".btn-aq-preview")?.addEventListener("click", () => previewQuestionModal(q.id));
        tr.querySelector(".btn-aq-toggle-vis")?.addEventListener("click", () => toggleQuestionVisibility(q.id));
        tr.querySelector(".select-aq-inline-plan")?.addEventListener("change", (e) => updateQuestionPlanInline(q.id, e.target.value));
        tr.querySelector(".btn-aq-edit")?.addEventListener("click", () => editQuestionItem(q.id));
        tr.querySelector(".btn-aq-trash")?.addEventListener("click", () => moveQuestionToTrash(q.id));
        tr.querySelector(".btn-aq-restore")?.addEventListener("click", () => restoreQuestionFromTrash(q.id));
        tr.querySelector(".btn-aq-delete-perm")?.addEventListener("click", () => deleteQuestionItem(q.id));

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 7. GUARDADO, EDICIÓN, VISIBILIDAD, PLAN Y PAPELERA DE RECICLAJE
// ============================================================================

export async function saveQuestionItem(event) {
    if (event) event.preventDefault();
    if (!hasMasterPermission()) return;

    const submitBtn = document.getElementById("btn-aq-submit");
    const scope = document.getElementById("aq-scope")?.value || "caces";
    const carrera = document.getElementById("aq-carrera")?.value || "medicina";
    const nivel = document.getElementById("aq-nivel")?.value || "caces_oficial";
    const materia = document.getElementById("aq-materia")?.value || "Medicina Interna";
    const dificultad = document.getElementById("aq-dificultad")?.value || "Media";
    const planAcceso = document.getElementById("aq-plan")?.value || "PRO";
    const visible = document.getElementById("aq-visible")?.value !== "false";
    const subtema = (document.getElementById("aq-subtema")?.value || "").trim();

    syncImagePathWithFolder();
    const imagenUrl = (document.getElementById("aq-imagen-url")?.value || "").trim();
    const enunciado = (document.getElementById("aq-enunciado")?.value || "").trim();
    const optA = (document.getElementById("aq-opt-a")?.value || "").trim();
    const optB = (document.getElementById("aq-opt-b")?.value || "").trim();
    const optC = (document.getElementById("aq-opt-c")?.value || "").trim();
    const optD = (document.getElementById("aq-opt-d")?.value || "").trim();
    const respuestaCorrecta = document.getElementById("aq-correcta")?.value || "A";
    const racional = (document.getElementById("aq-racional")?.value || "").trim();

    if (!enunciado || !optA || !optB || !optC || !optD || !racional) {
        alert("⚠️ Completa el enunciado, las 4 opciones (A-D) y el racional científico.");
        return;
    }

    const nowIso = new Date().toISOString();
    const adminEmail = auth?.currentUser?.email || MASTER_ADMINS[0];

    const payload = {
        ambito: scope,
        carrera,
        nivel,
        materia,
        dificultad,
        planAcceso,
        visible,
        enPapelera: false,
        subtema,
        imagenUrl,
        imagenBase64: uploadedClinicalImageBase64 || null,
        enunciado,
        opciones: { A: optA, B: optB, C: optC, D: optD },
        respuestaCorrecta,
        racional,
        actualizadoPor: adminEmail,
        updatedAt: nowIso
    };

    try {
        if (submitBtn) submitBtn.disabled = true;

        if (editingQuestionId) {
            await setDoc(doc(db, QUESTIONS_COLLECTION, editingQuestionId), payload, { merge: true });
            alert(`✅ Reactivo actualizado en [${scope.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        } else {
            payload.creadoPor = adminEmail;
            payload.createdAt = nowIso;
            await addDoc(collection(db, QUESTIONS_COLLECTION), payload);
            alert(`✅ Nuevo reactivo guardado en [${scope.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        }

        resetQuestionForm();
        await loadQuestionsBank();
    } catch (err) {
        console.error("[AdminQuestions] Error al guardar reactivo:", err);
        alert("Error al guardar en Cloud Firestore: " + err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

export function editQuestionItem(questionId) {
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    editingQuestionId = questionId;
    uploadedClinicalImageBase64 = item.imagenBase64 || null;

    const scope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
    const scopeEl = document.getElementById("aq-scope");
    if (scopeEl) scopeEl.value = scope;

    populateCascadingCareerOptions(item.carrera || "medicina");
    populateCascadingLevelOptions(item.nivel || (scope === "caces" ? "caces_oficial" : "semestre_1"));
    populateCascadingSubjectOptions(item.materia || "General");

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal("aq-dificultad", item.dificultad || "Media");
    setVal("aq-plan", item.planAcceso || "PRO");
    setVal("aq-visible", item.visible === false ? "false" : "true");
    setVal("aq-subtema", item.subtema || "");
    setVal("aq-imagen-url", item.imagenUrl || "");
    setVal("aq-enunciado", item.enunciado || "");
    setVal("aq-opt-a", item.opciones?.A || "");
    setVal("aq-opt-b", item.opciones?.B || "");
    setVal("aq-opt-c", item.opciones?.C || "");
    setVal("aq-opt-d", item.opciones?.D || "");
    setVal("aq-correcta", item.respuestaCorrecta || "A");
    setVal("aq-racional", item.racional || "");

    updateLiveRouteBanner();

    if (item.imagenBase64 || item.imagenUrl) {
        testAndPreviewClinicalImage(item.imagenBase64 || item.imagenUrl);
    } else {
        document.getElementById("aq-img-live-preview-wrap")?.classList.add("hidden");
    }

    const badge = document.getElementById("aq-form-mode-badge");
    if (badge) {
        badge.textContent = `✏️ MODO EDICIÓN: Modificando reactivo (${questionId})`;
        badge.className = "text-xs font-mono font-bold text-warning";
    }
    const submitLabel = document.getElementById("btn-aq-submit-label");
    if (submitLabel) submitLabel.textContent = "Actualizar Reactivo en Cloud Firestore";

    document.getElementById("btn-aq-cancel-edit")?.classList.remove("hidden");
    document.getElementById("admin-question-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetQuestionForm() {
    editingQuestionId = null;
    uploadedClinicalImageBase64 = null;

    document.getElementById("admin-question-form")?.reset();
    populateCascadingCareerOptions();
    document.getElementById("aq-img-live-preview-wrap")?.classList.add("hidden");

    const badge = document.getElementById("aq-form-mode-badge");
    if (badge) {
        badge.textContent = "➕ MODO CREACIÓN: Nuevo Reactivo para el Banco de Preguntas";
        badge.className = "text-xs font-mono font-bold text-secondary";
    }
    const submitLabel = document.getElementById("btn-aq-submit-label");
    if (submitLabel) submitLabel.textContent = "Guardar Reactivo en el Banco de Preguntas";

    document.getElementById("btn-aq-cancel-edit")?.classList.add("hidden");
}

export async function toggleQuestionVisibility(questionId) {
    if (!hasMasterPermission()) return;
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    const newVis = item.visible === false;
    try {
        await updateDoc(doc(db, QUESTIONS_COLLECTION, questionId), {
            visible: newVis,
            updatedAt: new Date().toISOString()
        });
        item.visible = newVis;
        renderQuestionsTable();
    } catch (err) {
        alert("Error al cambiar visibilidad: " + err.message);
    }
}

export async function updateQuestionPlanInline(questionId, newPlan) {
    if (!hasMasterPermission()) return;
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    try {
        await updateDoc(doc(db, QUESTIONS_COLLECTION, questionId), {
            planAcceso: newPlan,
            updatedAt: new Date().toISOString()
        });
        item.planAcceso = newPlan;
    } catch (err) {
        alert("Error al actualizar el plan de la pregunta: " + err.message);
    }
}

export async function moveQuestionToTrash(questionId) {
    if (!hasMasterPermission()) return;
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    try {
        const nowIso = new Date().toISOString();
        await updateDoc(doc(db, QUESTIONS_COLLECTION, questionId), {
            enPapelera: true,
            visible: false,
            eliminadoEn: nowIso
        });
        item.enPapelera = true;
        item.visible = false;
        updateQuestionsCounters();
        renderQuestionsTable();
    } catch (err) {
        alert("Error al mover a la papelera: " + err.message);
    }
}

export async function restoreQuestionFromTrash(questionId) {
    if (!hasMasterPermission()) return;
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    try {
        await updateDoc(doc(db, QUESTIONS_COLLECTION, questionId), {
            enPapelera: false,
            visible: true,
            restauradoEn: new Date().toISOString()
        });
        item.enPapelera = false;
        item.visible = true;
        updateQuestionsCounters();
        renderQuestionsTable();
    } catch (err) {
        alert("Error al restaurar el reactivo: " + err.message);
    }
}

export async function deleteQuestionItem(questionId) {
    if (!hasMasterPermission()) return;

    const item = questionsCache.find(q => q.id === questionId);
    const previewText = item?.enunciado ? item.enunciado.substring(0, 80) + "..." : questionId;

    if (!confirm(`🔥 ¿Confirmas ELIMINAR DEFINITIVAMENTE este reactivo de Firestore?\nEsta acción no se puede deshacer.\n\n"${previewText}"`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, QUESTIONS_COLLECTION, questionId));
        if (editingQuestionId === questionId) resetQuestionForm();
        await loadQuestionsBank();
    } catch (err) {
        alert("Error al eliminar definitivamente: " + err.message);
    }
}

async function emptyQuestionsTrash() {
    if (!hasMasterPermission()) return;
    const trashItems = questionsCache.filter(q => q.enPapelera);
    if (trashItems.length === 0) return;

    if (!confirm(`🔥 ¿Estás seguro de eliminar permanentemente los ${trashItems.length} reactivos de la Papelera?`)) {
        return;
    }

    try {
        for (const item of trashItems) {
            await deleteDoc(doc(db, QUESTIONS_COLLECTION, item.id));
        }
        await loadQuestionsBank();
    } catch (err) {
        alert("Error al vaciar la papelera: " + err.message);
    }
}

// ============================================================================
// 8. IMPORTACIÓN MASIVA (.JSON) CON PRE-VALIDADOR Y RUTA FORZADA
// ============================================================================

function insertSampleBatchJSON() {
    const scope = document.getElementById("aq-scope")?.value || "caces";
    const carrera = document.getElementById("aq-carrera")?.value || "medicina";
    const nivel = document.getElementById("aq-nivel")?.value || "caces_oficial";
    const materia = document.getElementById("aq-materia")?.value || "Medicina Interna";
    const plan = document.getElementById("aq-plan")?.value || "PRO";

    const sample = [
        {
            ambito: scope,
            carrera,
            nivel,
            materia,
            planAcceso: plan,
            dificultad: "Media",
            subtema: "Guía de Práctica Clínica MSP",
            imagenUrl: "assets/4-banco-clinico/atlas-visual/ecg.png",
            enunciado: "Paciente de 32 semanas de gestación acude con TA 165/110 mmHg, cefalea frontal intensa y escotomas. ¿Cuál es la conducta inmediata según la GPC del MSP?",
            opciones: {
                A: "Sulfato de magnesio (impregnación 4 g IV) + Labetalol o Nifedipino oral",
                B: "Alta domiciliaria con control en 7 días",
                C: "Administrar IECA (Enalapril) intravenoso de urgencia",
                D: "Restricción hídrica estricta sin antihipertensivos"
            },
            respuestaCorrecta: "A",
            racional: "Ante preeclampsia con signos de gravedad (TA >= 160/110 y síntomas neurológicos), se inicia prevención de eclampsia con Sulfato de Magnesio (Esquema Zuspan) y antihipertensivo de primera línea."
        }
    ];

    const textarea = document.getElementById("aq-json-batch-textarea");
    if (textarea) {
        textarea.value = JSON.stringify(sample, null, 2);
        validateBatchJSON(true);
    }
}

function validateBatchJSON(showBox = true) {
    const textarea = document.getElementById("aq-json-batch-textarea");
    const box = document.getElementById("aq-batch-validation-box");
    const forceRoute = document.getElementById("aq-batch-force-route")?.checked;

    const formScope = document.getElementById("aq-scope")?.value || "caces";
    const formCareer = document.getElementById("aq-carrera")?.value || "medicina";
    const formLevel = document.getElementById("aq-nivel")?.value || "caces_oficial";
    const formSubject = document.getElementById("aq-materia")?.value || "Medicina Interna";
    const formPlan = document.getElementById("aq-plan")?.value || "PRO";

    const rawText = textarea?.value?.trim() || "";
    if (!rawText) {
        if (box) box.classList.add("hidden");
        return null;
    }

    try {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.preguntas_caces) ? parsed.preguntas_caces : null);

        if (!list || list.length === 0) {
            throw new Error("El JSON debe ser un arreglo [ ... ] con al menos 1 pregunta.");
        }

        const normalizedList = [];
        for (const rawItem of list) {
            if (!rawItem.enunciado || !rawItem.opciones) continue;
            normalizedList.push({
                ambito: forceRoute ? formScope : (rawItem.ambito || formScope),
                carrera: forceRoute ? formCareer : (rawItem.carrera || formCareer).toLowerCase().trim(),
                nivel: forceRoute ? formLevel : (rawItem.nivel || formLevel),
                materia: forceRoute ? formSubject : (rawItem.materia || formSubject),
                planAcceso: forceRoute ? formPlan : (rawItem.planAcceso || formPlan),
                dificultad: rawItem.dificultad || "Media",
                subtema: rawItem.subtema || "",
                imagenUrl: rawItem.imagenUrl || "",
                visible: rawItem.visible !== false,
                enPapelera: false,
                enunciado: String(rawItem.enunciado).trim(),
                opciones: {
                    A: String(rawItem.opciones.A || "").trim(),
                    B: String(rawItem.opciones.B || "").trim(),
                    C: String(rawItem.opciones.C || "").trim(),
                    D: String(rawItem.opciones.D || "").trim()
                },
                respuestaCorrecta: String(rawItem.respuestaCorrecta || "A").toUpperCase().trim(),
                racional: String(rawItem.racional || "Sin racional disponible.").trim()
            });
        }

        if (showBox && box) {
            box.classList.remove("hidden");
            box.innerHTML = `
                <div class="text-secondary font-extrabold">
                    ✅ Lote JSON Válido: ${normalizedList.length} reactivos listos para subir.
                </div>
                <div class="text-[11px] text-gray-300 mt-1">
                    📍 Ruta donde se guardarán: <strong>${forceRoute ? `FORZADA A: ${formScope.toUpperCase()} ➔ ${formCareer} ➔ ${formLevel} ➔ ${formSubject} (Plan ${formPlan})` : "Según cada objeto del archivo JSON"}</strong>
                </div>
            `;
        }

        return normalizedList;
    } catch (err) {
        if (showBox && box) {
            box.classList.remove("hidden");
            box.innerHTML = `<span class="text-danger font-extrabold">❌ Error en el formato JSON: ${escapeHTML(err.message)}</span>`;
        }
        return null;
    }
}

export async function importQuestionsBatchJSON() {
    if (!hasMasterPermission()) return;

    const validList = validateBatchJSON(true);
    if (!validList || validList.length === 0) {
        alert("⚠️ Verifica el formato del lote JSON antes de importar.");
        return;
    }

    const importBtn = document.getElementById("btn-aq-import-batch");
    const textarea = document.getElementById("aq-json-batch-textarea");
    const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
    const nowIso = new Date().toISOString();

    try {
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = `Subiendo ${validList.length} reactivos...`;
        }

        let importedCount = 0;
        for (const item of validList) {
            await addDoc(collection(db, QUESTIONS_COLLECTION), {
                ...item,
                creadoPor: activeEmail,
                createdAt: nowIso,
                updatedAt: nowIso
            });
            importedCount++;
        }

        alert(`✅ Importación masiva exitosa: ${importedCount} reactivos guardados en la ruta seleccionada.`);
        if (textarea) textarea.value = "";
        document.getElementById("aq-batch-validation-box")?.classList.add("hidden");
        await loadQuestionsBank();
    } catch (err) {
        alert("Error al importar lote JSON: " + err.message);
    } finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span><span>2. Procesar e Importar Lote a Firestore</span>`;
        }
    }
}

// ============================================================================
// 9. MODAL DE VISTA PREVIA Y EXPORTACIÓN JSON
// ============================================================================

export function previewQuestionModal(questionId) {
    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    const modal = document.getElementById("aq-preview-modal");
    const metaEl = document.getElementById("aq-preview-meta");
    const stemEl = document.getElementById("aq-preview-stem");
    const optsEl = document.getElementById("aq-preview-options");
    const ratEl = document.getElementById("aq-preview-rationale");
    const imgBox = document.getElementById("aq-preview-image-box");
    const imgEl = document.getElementById("aq-preview-image");

    if (!modal || !stemEl || !optsEl) return;

    if (metaEl) {
        metaEl.textContent = `${(item.ambito || "caces").toUpperCase()} • ${(item.carrera || "medicina").toUpperCase()} • ${item.nivel || "CACES"} • ${item.materia || "General"} • Plan ${item.planAcceso || "Básico"}`;
    }

    const imgSrc = item.imagenBase64 || item.imagenUrl || "";
    if (imgSrc && imgBox && imgEl) {
        imgEl.src = imgSrc;
        imgBox.classList.remove("hidden");
    } else if (imgBox) {
        imgBox.classList.add("hidden");
    }

    stemEl.textContent = item.enunciado || "";
    optsEl.innerHTML = "";

    ["A", "B", "C", "D"].forEach(letter => {
        const isCorrect = letter === (item.respuestaCorrecta || "A");
        const div = document.createElement("div");
        div.className = `p-3 rounded-xl border text-xs flex items-start gap-3 ${
            isCorrect
                ? "border-secondary bg-secondary/15 text-white font-bold"
                : "border-surface-high bg-surface text-gray-300"
        }`;
        div.innerHTML = `
            <span class="font-mono font-extrabold ${isCorrect ? "text-secondary" : "text-gray-500"}">${letter}.</span>
            <span class="flex-1">${escapeHTML(item.opciones?.[letter] || "---")}</span>
            ${isCorrect ? '<span class="text-[10px] font-mono text-secondary uppercase">✓ Correcta</span>' : ""}
        `;
        optsEl.appendChild(div);
    });

    if (ratEl) {
        ratEl.textContent = item.racional || "Sin racional registrado.";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

export function exportQuestionsBankJSON() {
    if (!hasMasterPermission()) return;

    const filtered = getFilteredQuestions();
    if (filtered.length === 0) {
        alert("No hay reactivos en la vista actual para exportar.");
        return;
    }

    const exportPayload = {
        plataforma: "Makai Academy (Proyecto ALICIZATION)",
        modulo: "Banco de Preguntas",
        coleccion: QUESTIONS_COLLECTION,
        fechaExportacion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
        totalReactivos: filtered.length,
        preguntas_caces: filtered
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `Banco_Preguntas_Makai_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHTML(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
