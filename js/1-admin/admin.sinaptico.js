// ============================================================================
// ARCHIVO: js/1-admin/admin.sinaptico.js
// DESCRIPCIÓN: Gestor Maestro de Mazos y Tarjetas para Repetición Espaciada •
//              Sináptico v4.4 con Cascada Curricular Oficial por Semestre,
//              Verificador/Subida de Imágenes, Importador JSON con Ruta Forzada,
//              Conversor desde Banco de Preguntas y Papelera de Reciclaje.
// PROYECTO: Makai Academy (Proyecto ALICIZATION) - makai-academy-f8039
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
    deleteDoc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import {
    appState,
    MASTER_ADMINS,
    isMasterAdmin
} from "../2-core/state.store.js";

// Colecciones oficiales en Cloud Firestore
const SINAPTICO_COLLECTION = COLLECTIONS?.SINAPTICO || "tarjetas_sinaptico";
const QUESTIONS_COLLECTION = COLLECTIONS?.QUESTIONS || "preguntas_caces";

// ============================================================================
// 1. MAPA CURRICULAR OFICIAL DEL ECUADOR (SINCRONIZADO CON BANCO DE PREGUNTAS)
// ============================================================================

const COMPLEXIVO_AXES = [
    "Eje 1 Complexivo: Ciencias Básicas y Preclínicas Integradas",
    "Eje 2 Complexivo: Diagnóstico Clínico y Razonamiento Sindrómico",
    "Eje 3 Complexivo: Terapéutica, Protocolos y Guías del MSP",
    "Eje 4 Complexivo: Salud Pública, Epidemiología, Bioética y Gestión",
    "Eje 5 Complexivo: Resolución de Casos Prácticos de Fin de Carrera"
];

const CURRICULUM_MAP = {
    // ÁMBITO A: HABILITACIÓN PROFESIONAL OFICIAL CACES (EHEP ECUADOR)
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

    // ÁMBITO B: MALLA UNIVERSITARIA DEL ECUADOR (SEMESTRE POR SEMESTRE REAL)
    carrera: {
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
                semestre_2: ["Morfofunción II y Fisiopatología General", "Microbiología y Parasitología Aplicada", "Fundamentos de Enfermería y Procedimientos Básicos", "Proceso de Atención de Enfermería (PAE: NANDA-NIC-NOC)", "Socioantropología e Interculturalidad en Salud"],
                semestre_3: ["Semiología y Valoración Clínica de Enfermería", "Farmacología General y Cálculo/Dilución de Dosis", "Enfermería Comunitaria I y Promoción de la Salud", "Bioestadística y Epidemiología en Enfermería", "Dietoterapia y Nutrición Clínica"],
                semestre_4: ["Enfermería Clínico-Quirúrgica del Adulto I", "Farmacología Clínica Aplicada", "Enfermería Familiar y Comunitaria II (Estrategia ENI / PAI)", "Ética, Bioética y Legislación en Enfermería", "Educación para la Salud"],
                semestre_5: ["Enfermería Clínico-Quirúrgica del Adulto II", "Enfermería Perioperatoria e Instrumentación Quirúrgica", "Enfermería Gerontológica y del Adulto Mayor", "Cuidados Paliativos y Manejo del Dolor", "Metodología de la Investigación en Enfermería"],
                semestre_6: ["Enfermería Ginecológica y Obstétrica (Claves y Score MAMÁ)", "Enfermería Neonatal", "Enfermería Pediátrica y del Adolescente (AIEPI)", "Enfermería en Salud Mental y Psiquiatría", "Calidad de Atención y Seguridad del Paciente"],
                semestre_7: ["Enfermería en Urgencias, Emergencias y Desastres", "Enfermería en Cuidados Críticos y Terapia Intensiva (UCI)", "Administración, Liderazgo y Gerencia de Servicios de Enfermería", "Diseño de Trabajo de Titulación", "Auditoría y Gestión Hospitalaria"],
                internado_rotativo: ["Rotación Clínico-Quirúrgica Hospitalaria", "Rotación Materno-Infantil y Pediátrica", "Rotación de Emergencias y Cuidados Críticos", "Rotación Comunitaria y Atención Primaria MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },
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
                semestre_2: ["Fisiología Humana y Materno-Fetal", "Microbiología, Parasitología e Infecciones Perinatales (TORCH/ITS)", "Psicología Evolutiva y de la Reproducción", "Educación Prenatal y Psicoprofilaxis Obstétrica", "Bioseguridad"],
                semestre_3: ["Semiología General y Obstétrica", "Fisiopatología General y Reproductiva", "Farmacología General y Obstétrica", "Clínica Prenatal de Bajo Riesgo", "Bioestadística y Epidemiología Materna"],
                semestre_4: ["Clínica del Parto, Alumbramiento y Puerperio Fisiológico", "Monitoreo Fetal Electrónico y Ecografía Obstétrica Básica", "Ginecología Infanto-Juvenil y del Adulto I", "Lactancia Materna y Puericultura", "Salud Intercultural y Parto Humanizado"],
                semestre_5: ["Ginecología II, Climaterio y Patología Cervical/Mamaria", "Planificación Familiar y Anticoncepción Normativa MSP", "Neonatología Inmediata y Reanimación Neonatal", "Laboratorio Clínico Perinatal", "Bioética y Legislación Materno-Perinatal"],
                semestre_6: ["Patología Obstétrica y Alto Riesgo Obstétrico I", "Claves Obstétricas del MSP (Roja, Azul, Amarilla) y Score MAMÁ", "Medicina Interna Aplicada a la Gestación", "Enfermedades Infecciosas en el Embarazo", "Investigación Clínica"],
                semestre_7: ["Alto Riesgo Obstétrico II y Cuidados Críticos Maternos", "Procedimientos Quirúrgicos e Instrumentación en Centro Obstétrico", "Violencia de Género y Obstetricia Forense", "Gerencia de Servicios Materno-Infantiles", "Trabajo de Titulación"],
                internado_rotativo: ["Rotación de Centro Obstétrico y Sala de Partos", "Rotación de Alto Riesgo Obstétrico y Hospitalización", "Rotación de Ginecología y Planificación Familiar", "Rotación de Neonatología y Puerperio", "Rotación Comunitaria y Control Prenatal MSP"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },
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
                semestre_6: ["Psicoterapia Cognitivo-Conductual (TCC) y Terapias de Tercera Generación", "Psicoterapia de Orientación Psicodinámica", "Intervención Clínica en Niños y Adolescentes", "Psicoterapia Familiar y de Pareja", "Salud Mental Comunitaria y Normativa MSP"],
                semestre_7: ["Intervención en Crisis, Emergencias, Desastres y Riesgo Suicida", "Prevención y Tratamiento de Adicciones / Consumo Problemático", "Psicofarmacología Aplicada para Psicólogos Clínicos", "Psicogerontología Clínica", "Diseño de Trabajo de Titulación"],
                semestre_8: ["Psicología Clínica Hospitalaria y Cuidados Paliativos", "Psicología Forense, Peritaje y Violencia de Género", "Supervisión de Casos Clínicos Integrados", "Trabajo de Titulación"],
                titulacion_complexivo: COMPLEXIVO_AXES
            }
        },
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

const SINAPTICO_CARD_TYPES = [
    { id: "perla_clinica", nombre: "💡 Perla Clínica / Criterio Diagnóstico" },
    { id: "farmaco_dosis", nombre: "💊 Fármaco de Elección / Dosis Crítica" },
    { id: "algoritmo_gpc", nombre: "📋 Algoritmo / Norma GPC MSP" },
    { id: "signo_imagen", nombre: "🖼️ Reconocimiento de Imagen / ECG / Signo" },
    { id: "caso_corto", nombre: "⚡ Viñeta Clínica de Decisión Rápida" }
];

const SINAPTICO_ASSET_FOLDERS = [
    { prefix: "assets/4-banco-clinico/atlas-visual/", label: "📁 assets/4-banco-clinico/atlas-visual/ (Láminas y fotos)" },
    { prefix: "assets/4-banco-clinico/electrocardiografia/", label: "📁 assets/4-banco-clinico/electrocardiografia/ (Tiras ECG)" },
    { prefix: "assets/4-banco-clinico/imagenologia/", label: "📁 assets/4-banco-clinico/imagenologia/ (RX, TAC, RMN, Eco)" },
    { prefix: "assets/5-multimedia-1d/infografias-y-algoritmos/", label: "📁 assets/5-multimedia-1d/infografias-y-algoritmos/" }
];

// Estado interno del módulo Sináptico v4.4
let sinapticoCache = [];
let editingCardId = null;
let uploadedCardImageBase64 = null;
let activeCatalogTab = "active"; // "active" | "trash"
let previewCardFlipped = false;

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

export async function initAdminSinaptico() {
    if (!hasMasterPermission()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    let section = document.getElementById("admin-sinaptico-section");
    if (!section) {
        section = document.createElement("section");
        section.id = "admin-sinaptico-section";
        section.dataset.adminSection = "sinaptico";
        section.className = "mb-10 space-y-6 mt-6";
        adminView.appendChild(section);
    }

    renderSinapticoAdminUI(section);
    bindSinapticoEvents();
    await loadSinapticoCards();
}

// ============================================================================
// 3. INTERFAZ DEL GESTOR «SINÁPTICO v4.4»
// ============================================================================

function renderSinapticoAdminUI(container) {
    container.innerHTML = `
        <!-- CABECERA DEL MÓDULO SINÁPTICO v4.4 -->
        <div class="bg-surface-container border border-secondary/40 rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-surface-high">
                <div>
                    <span class="text-[11px] font-mono text-secondary uppercase tracking-widest block font-bold">
                        Colección Firestore: ${SINAPTICO_COLLECTION} • Motor 1D • Malla Oficial por Semestre
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-1">
                        <span class="material-symbols-outlined text-secondary">psychology</span>
                        <span>Gestor de Repetición Espaciada • Sináptico v4.4</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Crea tarjetas de memoria activa, conviértelas en 1 clic desde el Banco de Preguntas o importa mazos JSON en la ruta curricular exacta.
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <div class="px-3 py-1.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-gray-300">
                        Activas: <strong id="kpi-admin-sinaptico-local" class="text-secondary">0</strong>
                        <span class="mx-1 text-gray-600">|</span>
                        Papelera: <strong id="kpi-admin-sinaptico-trash" class="text-danger">0</strong>
                    </div>
                    <button type="button" id="btn-refresh-sinaptico" class="px-3.5 py-2 bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">sync</span>
                        <span>Sincronizar</span>
                    </button>
                    <button type="button" id="btn-sync-from-caces" class="px-3.5 py-2 bg-surface border border-primary text-primary hover:bg-primary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5" title="Convierte automáticamente reactivos activos del Banco de Preguntas en tarjetas Sináptico">
                        <span class="material-symbols-outlined text-sm">auto_awesome</span>
                        <span>Generar desde Banco de Preguntas</span>
                    </button>
                    <button type="button" id="btn-export-sinaptico-json" class="px-3.5 py-2 bg-secondary text-surface text-xs font-extrabold rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Vista (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- FORMULARIO CRUD DE TARJETA SINÁPTICA -->
            <form id="as-crud-form" class="space-y-5">
                <div class="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2.5 rounded-xl border border-surface-high">
                    <div class="flex items-center gap-2">
                        <span id="as-form-mode-badge" class="px-2.5 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[11px] font-bold uppercase">
                            ➕ MODO CREACIÓN
                        </span>
                        <span id="as-form-mode-title" class="text-xs text-gray-300 font-bold">
                            Nueva Tarjeta de Repetición Espaciada • Sináptico v4.4
                        </span>
                    </div>
                    <button type="button" id="btn-as-cancel-edit" class="hidden text-xs font-mono text-danger hover:underline">
                        ✖ Cancelar edición y limpiar formulario
                    </button>
                </div>

                <!-- BRÚJULA DE RUTA EXACTA EN VIVO -->
                <div class="bg-secondary/10 border border-secondary/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="text-xs font-mono text-gray-200 flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary text-base">route</span>
                        <span><strong>Destino Exacto del Mazo:</strong></span>
                        <span id="as-route-preview-text" class="text-secondary font-extrabold"></span>
                    </div>
                    <span class="text-[10px] font-mono text-gray-400">
                        Sincronizado por carrera y semestre con el Banco de Preguntas
                    </span>
                </div>

                <!-- FILA 1: CASCADA CURRICULAR ESTRICTA (1. ÁMBITO -> 2. CARRERA -> 3. NIVEL -> 4. MATERIA) -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            1. Ámbito Curricular
                        </label>
                        <select id="as-scope" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="caces">🎯 Habilitación CACES (EHEP Oficial)</option>
                            <option value="carrera">🏛️ Malla Universitaria (11 Carreras + Preuniv.)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            2. Carrera Destino
                        </label>
                        <select id="as-carrera" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            3. Nivel / Semestre
                        </label>
                        <select id="as-nivel" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            4. Materia / Mazo Clínico (Por Semestre)
                        </label>
                        <select id="as-materia" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>
                </div>

                <!-- FILA 2: TIPO DE TARJETA, DIFICULTAD, CANDADO DEL PLAN, VISIBILIDAD Y TEMA ESPECÍFICO -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            5. Tipo de Estímulo
                        </label>
                        <select id="as-tipo" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            6. Complejidad Cognitiva
                        </label>
                        <select id="as-dificultad" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="Baja">🟢 Baja (Memoria Directa)</option>
                            <option value="Media" selected>🟡 Media (Asociación Clínica)</option>
                            <option value="Alta">🔴 Alta (Algoritmo Crítico)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            7. Candado del Plan
                        </label>
                        <select id="as-plan-acceso" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="Básico">🔓 Plan Básico (Abierto)</option>
                            <option value="PRO" selected>💎 Makai PRO</option>
                            <option value="VIP">👑 Mentoría Élite VIP</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            8. Visibilidad Usuarios
                        </label>
                        <select id="as-visible" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="true" selected>🟢 Visible en Sináptico</option>
                            <option value="false">🙈 Oculto (Borrador)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            9. Tema / Patología (Opcional)
                        </label>
                        <input type="text" id="as-subtema" placeholder="Ej: Score MAMÁ / Sepsis" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <!-- FILA 3: FRENTE (CARA A) Y REVERSO (CARA B) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-surface/70 border border-primary/30 rounded-xl p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-[11px] font-mono text-primary uppercase font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">flip_to_front</span>
                                <span>10. Frente de la Tarjeta (Pregunta / Caso Activo) *</span>
                            </label>
                            <span class="text-[10px] font-mono text-gray-500">Cara A • Estímulo</span>
                        </div>
                        <textarea id="as-frente" rows="4" required placeholder="Ej: ¿Cuál es el antídoto específico de primera línea ante intoxicación por sulfato de magnesio con abolición del reflejo rotuliano y depresión respiratoria?" class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none leading-relaxed"></textarea>
                    </div>

                    <div class="bg-surface/70 border border-secondary/30 rounded-xl p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-[11px] font-mono text-secondary uppercase font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">flip_to_back</span>
                                <span>11. Reverso de la Tarjeta (Respuesta / Conducta Oficial) *</span>
                            </label>
                            <span class="text-[10px] font-mono text-gray-500">Cara B • Resolución</span>
                        </div>
                        <textarea id="as-reverso" rows="4" required placeholder="Ej: Gluconato de calcio al 10%: administrar 1 g (10 ml) por vía intravenosa lenta durante 3 a 5 minutos." class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-secondary focus:outline-none leading-relaxed"></textarea>
                    </div>
                </div>

                <!-- FILA 4: PERLA CLÍNICA / NEMOTECNIA -->
                <div>
                    <label class="block text-[11px] font-mono text-warning uppercase mb-1 font-bold">
                        12. Perla Clínica / Nemotecnia de Guardia (Opcional)
                    </label>
                    <input type="text" id="as-perla" placeholder="Ej: Vigilar FR >= 12 rpm, reflejo rotuliano presente y diuresis >= 30 ml/h antes de mantener infusión de Sulfato de Magnesio." class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-warning focus:outline-none" />
                </div>

                <!-- FILA 5: IMAGEN / ESQUEMA SINÁPTICO (RUTA VERIFICADA O SUBIDA DIRECTA DESDE TU PC) -->
                <div class="bg-surface border border-surface-high rounded-2xl p-4 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <label class="text-xs font-extrabold text-white flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-secondary text-base">image</span>
                                <span>13. Imagen o Esquema Sináptico Adjunto (Opcional: ECG, Algoritmo, RX, Lesión)</span>
                            </label>
                            <p class="text-[11px] text-gray-400">
                                Elige la carpeta en <code class="text-secondary font-mono">assets/</code> y prueba la ruta o sube el archivo directamente desde tu computadora.
                            </p>
                        </div>
                        <div class="flex items-center gap-2 text-xs font-mono">
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-primary/50 text-primary flex items-center gap-1.5">
                                <input type="radio" name="as-img-mode" value="path" checked class="accent-cyan-400" />
                                <span>📂 Usar Ruta de Carpeta</span>
                            </label>
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-secondary/50 text-secondary flex items-center gap-1.5">
                                <input type="radio" name="as-img-mode" value="upload" class="accent-lime-400" />
                                <span>💻 Subir Imagen desde mi PC</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                        <div>
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                                Carpeta Destino en Bóveda (assets/)
                            </label>
                            <select id="as-asset-folder" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-secondary focus:outline-none"></select>
                        </div>

                        <div id="as-img-path-box" class="md:col-span-2 space-y-1">
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                                Ruta Completa de la Imagen (Puedes escribir solo el nombre, ej: bloqueo-av.png)
                            </label>
                            <div class="flex gap-2">
                                <input type="text" id="as-imagen-url" placeholder="assets/4-banco-clinico/electrocardiografia/bloqueo-av.png" class="flex-1 bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-secondary focus:outline-none" />
                                <button type="button" id="btn-as-test-img" class="px-3 py-2 rounded-xl bg-surface-container border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold transition-all whitespace-nowrap">
                                    🔍 Probar Imagen
                                </button>
                            </div>
                        </div>

                        <div id="as-img-upload-box" class="hidden md:col-span-2 space-y-1">
                            <label class="block text-[10px] font-mono text-secondary uppercase mb-1">
                                Selecciona la imagen desde tu computadora (.PNG, .JPG, .WEBP)
                            </label>
                            <input type="file" id="as-imagen-file" accept="image/png,image/jpeg,image/webp,image/gif" class="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-secondary file:text-surface cursor-pointer" />
                            <p class="text-[10px] text-gray-400">
                                Se optimiza automáticamente y queda guardada en Firestore junto a su ruta clasificada.
                            </p>
                        </div>
                    </div>

                    <div id="as-img-live-preview-wrap" class="hidden bg-surface-container border border-surface-high rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <img id="as-img-live-preview" src="" alt="Vista previa" class="w-20 h-20 object-contain rounded-lg border border-secondary bg-black" />
                            <div class="text-xs font-mono space-y-1">
                                <div id="as-img-live-status" class="font-extrabold text-secondary">✅ Imagen verificada correctamente</div>
                                <div id="as-img-live-path" class="text-[11px] text-gray-400 break-all"></div>
                            </div>
                        </div>
                        <button type="button" id="btn-as-clear-img" class="px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/40 text-danger text-xs font-bold hover:bg-danger hover:text-white">
                            ✕ Quitar Imagen
                        </button>
                    </div>
                </div>

                <!-- BOTÓN DE GUARDADO -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div class="text-[11px] font-mono text-gray-400 flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">Difícil (&lt;10m)</span>
                        <span class="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">Bueno (1d)</span>
                        <span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30">Fácil (4d)</span>
                        <span class="hidden sm:inline text-gray-500">• Intervalos algorítmicos Sináptico v4.4</span>
                    </div>
                    <button type="submit" id="btn-as-submit" class="px-6 py-3 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(148,222,45,0.25)]">
                        <span class="material-symbols-outlined text-base">save</span>
                        <span id="btn-as-submit-label">Guardar Tarjeta en Cloud Firestore</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- IMPORTADOR MASIVO POR LOTES (.JSON) CON RUTA GARANTIZADA -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">upload_file</span>
                        <span>Importación Masiva de Mazos Sinápticos por Lotes (.JSON) con Ruta Garantizada</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Con el candado inferior activo, todo el lote JSON se guardará exactamente en el Ámbito, Carrera, Semestre y Materia seleccionados arriba.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <label class="cursor-pointer px-3 py-2 bg-surface border border-gray-600 hover:border-secondary text-xs text-gray-200 rounded-xl font-mono flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-secondary">folder_open</span>
                        <span>Cargar archivo .JSON</span>
                        <input type="file" id="as-json-file-input" accept=".json,application/json" class="hidden" />
                    </label>
                    <button type="button" id="btn-as-load-template" class="px-3 py-2 bg-surface border border-gray-700 hover:border-primary text-xs text-primary rounded-xl font-mono">
                        📋 Insertar Plantilla con Ruta Actual
                    </button>
                </div>
            </div>

            <div class="bg-surface border border-secondary/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <label class="flex items-center gap-2.5 text-xs text-white font-mono cursor-pointer">
                    <input type="checkbox" id="as-batch-force-route" checked class="w-4 h-4 accent-lime-400" />
                    <span>
                        🎯 <strong>Forzar Ruta Actual del Formulario para todo este mazo:</strong>
                        <span id="as-batch-route-badge" class="text-secondary font-extrabold ml-1"></span>
                    </span>
                </label>
                <span class="text-[10px] font-mono text-gray-400">
                    Evita errores de tipeo en carreras o semestres dentro del JSON.
                </span>
            </div>

            <textarea id="as-json-batch-textarea" rows="4" placeholder='[\n  {\n    "frente": "¿Cuál es el fármaco uterotónico de primera línea en atonía uterina según GPC-MSP?",\n    "reverso": "Oxitocina 10 UI IM o 5 UI IV lento, seguido de infusión de 20-40 UI en 1000 ml.",\n    "perlaClinica": "Las 4 T: Tono (70%), Trauma (20%), Tejido (9%), Trombina (1%)."\n  }\n]' class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-secondary focus:outline-none"></textarea>

            <div id="as-batch-validation-box" class="hidden bg-surface border border-secondary/40 rounded-xl p-3 text-xs font-mono text-gray-200"></div>

            <div class="flex flex-wrap justify-end gap-2.5">
                <button type="button" id="btn-as-validate-batch" class="px-4 py-2.5 bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">fact_check</span>
                    <span>1. Pre-validar Mazo y Ruta</span>
                </button>
                <button type="button" id="btn-as-import-batch" class="px-5 py-2.5 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">cloud_upload</span>
                    <span>2. Procesar e Importar Mazo a Firestore</span>
                </button>
            </div>
        </div>

        <!-- CATÁLOGO ACTIVO EN CLOUD FIRESTORE + FILTROS + PAPELERA DE RECICLAJE -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <h4 class="text-base font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">style</span>
                        <span>Catálogo de Tarjetas Sináptico v4.4 en Cloud Firestore</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Filtra por ámbito, carrera, semestre, visibilidad o plan. Cambia la visibilidad o el plan en 1 clic, o restaura tarjetas desde la Papelera.
                    </p>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" id="btn-as-tab-active" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-secondary text-surface transition-all flex items-center gap-1.5">
                        <span>📚 Mazos Activos</span>
                        <span id="badge-as-active-count" class="px-1.5 py-0.5 rounded bg-black/20 text-[10px]">0</span>
                    </button>
                    <button type="button" id="btn-as-tab-trash" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5">
                        <span>🗑️ Papelera</span>
                        <span id="badge-as-trash-count" class="px-1.5 py-0.5 rounded bg-danger/20 text-[10px]">0</span>
                    </button>
                </div>
            </div>

            <!-- BARRA DE FILTROS AVANZADOS (7 CRITERIOS) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="lg:col-span-2">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Buscar en Frente, Reverso, Perla, Tema o Materia</label>
                    <input type="text" id="as-filter-search" placeholder="🔍 Ej: Zuspan, Oxitocina, NANDA, Score MAMÁ..." class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none" />
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Ámbito Curricular</label>
                    <select id="as-filter-scope" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todos (CACES + Malla Univ.)</option>
                        <option value="caces">🎯 Solo Habilitación CACES</option>
                        <option value="carrera">🏛️ Solo Malla Universitaria</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Carrera</label>
                    <select id="as-filter-career" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todas las Carreras</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Nivel / Semestre</label>
                    <select id="as-filter-level" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todos los Niveles / Semestres</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Visibilidad para Usuarios</label>
                    <select id="as-filter-visibility" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todas (Visibles + Ocultas)</option>
                        <option value="visible">🟢 Solo Visibles</option>
                        <option value="hidden">🙈 Solo Ocultas / Borradores</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Candado del Plan</label>
                    <select id="as-filter-plan" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todos los Planes</option>
                        <option value="Básico">🔓 Plan Básico</option>
                        <option value="PRO">💎 Makai PRO</option>
                        <option value="VIP">👑 Élite VIP</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Tipo de Estímulo</label>
                    <select id="as-filter-type" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                        <option value="all">Todos los Tipos</option>
                    </select>
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
                <span id="as-filter-count-label">Mostrando 0 tarjetas</span>
                <button type="button" id="btn-as-empty-trash" class="hidden px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px] transition-all">
                    🔥 Vaciar toda la Papelera definitivamente
                </button>
            </div>

            <!-- TABLA DE TARJETAS SINÁPTICAS -->
            <div class="overflow-x-auto rounded-xl border border-surface-high">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Ruta Curricular (Ámbito / Carrera / Semestre / Mazo)</th>
                            <th class="px-4 py-3">Frente (Cara A • Estímulo)</th>
                            <th class="px-4 py-3">Reverso (Cara B • Conducta & Perla)</th>
                            <th class="px-4 py-3">Visibilidad & Plan</th>
                            <th class="px-4 py-3 text-right">Acciones CRUD / Papelera</th>
                        </tr>
                    </thead>
                    <tbody id="as-cards-tbody" class="divide-y divide-surface-high"></tbody>
                </table>
            </div>
        </div>

        <!-- MODAL INTERACTIVO DE SIMULACIÓN DE TARJETA SINÁPTICA -->
        <div id="as-preview-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm items-center justify-center p-4">
            <div class="bg-surface-container border border-secondary rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between border-b border-surface-high pb-3">
                    <div>
                        <span id="as-preview-meta" class="text-[10px] font-mono text-secondary uppercase font-bold"></span>
                        <h4 class="text-base font-extrabold text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-secondary text-lg">psychology</span>
                            <span>Simulador de Tarjeta • Sináptico v4.4</span>
                        </h4>
                    </div>
                    <button type="button" id="btn-as-close-preview" class="text-gray-400 hover:text-white text-sm font-mono px-2.5 py-1 rounded-lg bg-surface">
                        ✕ Cerrar
                    </button>
                </div>

                <div class="bg-surface border border-surface-high rounded-2xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <span id="as-preview-face-badge" class="px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] font-bold uppercase">
                            CARA A • ESTÍMULO CLÍNICO
                        </span>
                        <span id="as-preview-subtema" class="text-[11px] font-mono text-gray-400"></span>
                    </div>

                    <div id="as-preview-image-box" class="hidden">
                        <img id="as-preview-image" src="" alt="Recurso visual sináptico" class="max-h-56 rounded-xl border border-surface-high mx-auto object-contain" />
                    </div>

                    <div id="as-preview-front-box" class="py-2">
                        <p id="as-preview-front-text" class="text-sm text-white font-semibold leading-relaxed whitespace-pre-line"></p>
                    </div>

                    <div id="as-preview-back-box" class="hidden pt-4 border-t border-surface-high space-y-3">
                        <div>
                            <span class="text-[10px] font-mono text-secondary uppercase font-bold block mb-1">
                                Respuesta / Conducta Clínica Oficial:
                            </span>
                            <p id="as-preview-back-text" class="text-sm text-gray-100 leading-relaxed whitespace-pre-line bg-secondary/10 border border-secondary/30 rounded-xl p-4"></p>
                        </div>
                        <div id="as-preview-pearl-box" class="hidden bg-warning/10 border border-warning/30 rounded-xl p-3">
                            <span class="text-[10px] font-mono text-warning uppercase font-bold block mb-0.5">
                                💡 Perla Clínica / Nemotecnia:
                            </span>
                            <p id="as-preview-pearl-text" class="text-xs text-gray-200"></p>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button type="button" id="btn-as-flip-preview" class="w-full sm:w-auto px-5 py-2.5 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-base">flip</span>
                        <span>Mostrar Respuesta (Espacio)</span>
                    </button>
                    <div id="as-preview-retention-btns" class="hidden w-full sm:w-auto grid grid-cols-3 gap-2">
                        <button type="button" data-interval="10m" class="btn-as-sim-interval px-3 py-2 rounded-xl bg-danger/15 border border-danger/40 text-danger text-xs font-mono font-bold hover:bg-danger hover:text-white transition-all">
                            Difícil (&lt;10m)
                        </button>
                        <button type="button" data-interval="1d" class="btn-as-sim-interval px-3 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-xs font-mono font-bold hover:bg-primary hover:text-surface transition-all">
                            Bueno (1d)
                        </button>
                        <button type="button" data-interval="4d" class="btn-as-sim-interval px-3 py-2 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary text-xs font-mono font-bold hover:bg-secondary hover:text-surface transition-all">
                            Fácil (4d)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    populateSinapticoStaticSelectors();
    populateCascadingSinapticoCareers();
    populateSinapticoFilterDropdowns();
}

// ============================================================================
// 4. LÓGICA DE CASCADA CURRICULAR ESTRICTA Y VERIFICADOR DE IMÁGENES
// ============================================================================

function populateSinapticoStaticSelectors() {
    const typeSelect = document.getElementById("as-tipo");
    if (typeSelect) {
        typeSelect.innerHTML = SINAPTICO_CARD_TYPES
            .map(t => `<option value="${t.id}">${t.nombre}</option>`)
            .join("");
    }

    const folderSelect = document.getElementById("as-asset-folder");
    if (folderSelect) {
        folderSelect.innerHTML = SINAPTICO_ASSET_FOLDERS
            .map(f => `<option value="${f.prefix}">${f.label}</option>`)
            .join("");
    }
}

function populateCascadingSinapticoCareers(selectedCareer = null) {
    const scopeEl = document.getElementById("as-scope");
    const careerEl = document.getElementById("as-carrera");
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

    populateCascadingSinapticoLevels();
}

function populateCascadingSinapticoLevels(selectedLevel = null) {
    const scope = document.getElementById("as-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("as-carrera")?.value || "medicina";
    const levelEl = document.getElementById("as-nivel");
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

    populateCascadingSinapticoSubjects();
}

function populateCascadingSinapticoSubjects(selectedSubject = null) {
    const scope = document.getElementById("as-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("as-carrera")?.value || "medicina";
    const levelId = document.getElementById("as-nivel")?.value || "caces_oficial";
    const subjectEl = document.getElementById("as-materia");
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

    updateSinapticoLiveRouteBanner();
}

function updateSinapticoLiveRouteBanner() {
    const scope = document.getElementById("as-scope")?.value === "carrera" ? "Malla Universitaria" : "Habilitación CACES";
    const careerSelect = document.getElementById("as-carrera");
    const levelSelect = document.getElementById("as-nivel");
    const subjectSelect = document.getElementById("as-materia");
    const planSelect = document.getElementById("as-plan-acceso");
    const visibleSelect = document.getElementById("as-visible");

    const careerText = careerSelect?.options[careerSelect.selectedIndex]?.text || "---";
    const levelText = levelSelect?.options[levelSelect.selectedIndex]?.text || "---";
    const subjectText = subjectSelect?.value || "---";
    const planText = planSelect?.value || "PRO";
    const visText = visibleSelect?.value === "false" ? "Oculto" : "Visible";

    const routeSummary = `${scope} ➔ ${careerText} ➔ ${levelText} ➔ ${subjectText} (Plan ${planText} • ${visText})`;

    const previewEl = document.getElementById("as-route-preview-text");
    if (previewEl) previewEl.textContent = routeSummary;

    const batchRouteEl = document.getElementById("as-batch-route-badge");
    if (batchRouteEl) batchRouteEl.textContent = `[${scope} > ${careerText} > ${levelText} > ${subjectText}]`;
}

function populateSinapticoFilterDropdowns() {
    const filterCareer = document.getElementById("as-filter-career");
    const filterLevel = document.getElementById("as-filter-level");
    const filterType = document.getElementById("as-filter-type");

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

    if (filterType) {
        filterType.innerHTML = `<option value="all">Todos los Tipos</option>` +
            SINAPTICO_CARD_TYPES.map(t => `<option value="${t.id}">${t.nombre}</option>`).join("");
    }
}

function syncCardImagePathWithFolder() {
    const folderPrefix = document.getElementById("as-asset-folder")?.value || "assets/4-banco-clinico/atlas-visual/";
    const imgInput = document.getElementById("as-imagen-url");
    if (!imgInput) return;

    const currentVal = imgInput.value.trim();
    if (!currentVal) {
        imgInput.placeholder = `${folderPrefix}bloqueo-av.png`;
        return;
    }

    if (!currentVal.startsWith("http") && !currentVal.startsWith("data:")) {
        const cleanFileName = currentVal.split("/").pop() || "esquema.png";
        imgInput.value = `${folderPrefix}${cleanFileName}`;
    }
}

function testAndPreviewSinapticoImage(customSource = null) {
    const wrap = document.getElementById("as-img-live-preview-wrap");
    const imgEl = document.getElementById("as-img-live-preview");
    const statusEl = document.getElementById("as-img-live-status");
    const pathEl = document.getElementById("as-img-live-path");
    const imgInput = document.getElementById("as-imagen-url");

    if (!wrap || !imgEl || !statusEl || !pathEl) return;

    syncCardImagePathWithFolder();
    const targetUrl = customSource || uploadedCardImageBase64 || imgInput?.value.trim() || "";

    if (!targetUrl) {
        wrap.classList.add("hidden");
        return;
    }

    wrap.classList.remove("hidden");
    pathEl.textContent = `Ruta asignada: ${imgInput?.value.trim() || "Imagen directa en Firestore"}`;
    statusEl.textContent = "⏳ Verificando carga de la imagen...";
    statusEl.className = "font-extrabold text-warning";

    imgEl.onload = () => {
        statusEl.textContent = uploadedCardImageBase64
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

function handleDirectSinapticoImageUpload(file) {
    if (!file) return;

    const folderPrefix = document.getElementById("as-asset-folder")?.value || "assets/4-banco-clinico/atlas-visual/";
    const safeFileName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const logicalPath = `${folderPrefix}${safeFileName}`;

    const imgInput = document.getElementById("as-imagen-url");
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
            uploadedCardImageBase64 = canvas.toDataURL("image/webp", 0.82);
            testAndPreviewSinapticoImage(uploadedCardImageBase64);
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
}

// ============================================================================
// 5. EVENTOS DEL MÓDULO SINÁPTICO v4.4
// ============================================================================

function bindSinapticoEvents() {
    document.getElementById("as-scope")?.addEventListener("change", () => populateCascadingSinapticoCareers());
    document.getElementById("as-carrera")?.addEventListener("change", () => populateCascadingSinapticoLevels());
    document.getElementById("as-nivel")?.addEventListener("change", () => populateCascadingSinapticoSubjects());
    document.getElementById("as-materia")?.addEventListener("change", updateSinapticoLiveRouteBanner);
    document.getElementById("as-plan-acceso")?.addEventListener("change", updateSinapticoLiveRouteBanner);
    document.getElementById("as-visible")?.addEventListener("change", updateSinapticoLiveRouteBanner);

    document.querySelectorAll('input[name="as-img-mode"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            const mode = e.target.value;
            document.getElementById("as-img-path-box")?.classList.toggle("hidden", mode !== "path");
            document.getElementById("as-img-upload-box")?.classList.toggle("hidden", mode !== "upload");
        });
    });

    document.getElementById("as-asset-folder")?.addEventListener("change", () => {
        syncCardImagePathWithFolder();
        if (document.getElementById("as-imagen-url")?.value.trim()) {
            testAndPreviewSinapticoImage();
        }
    });

    document.getElementById("btn-as-test-img")?.addEventListener("click", () => {
        uploadedCardImageBase64 = null;
        testAndPreviewSinapticoImage();
    });

    document.getElementById("as-imagen-file")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleDirectSinapticoImageUpload(file);
    });

    document.getElementById("btn-as-clear-img")?.addEventListener("click", () => {
        uploadedCardImageBase64 = null;
        const urlEl = document.getElementById("as-imagen-url");
        const fileEl = document.getElementById("as-imagen-file");
        if (urlEl) urlEl.value = "";
        if (fileEl) fileEl.value = "";
        document.getElementById("as-img-live-preview-wrap")?.classList.add("hidden");
    });

    document.getElementById("as-crud-form")?.addEventListener("submit", saveSinapticoCard);
    document.getElementById("btn-as-cancel-edit")?.addEventListener("click", resetSinapticoForm);
    document.getElementById("btn-refresh-sinaptico")?.addEventListener("click", loadSinapticoCards);
    document.getElementById("btn-sync-from-caces")?.addEventListener("click", generateCardsFromCacesQuestions);
    document.getElementById("btn-export-sinaptico-json")?.addEventListener("click", exportSinapticoDeckJSON);

    // Importación por lotes JSON
    document.getElementById("btn-as-load-template")?.addEventListener("click", insertSampleSinapticoBatchJSON);
    document.getElementById("btn-as-validate-batch")?.addEventListener("click", () => validateSinapticoBatchJSON(true));
    document.getElementById("btn-as-import-batch")?.addEventListener("click", importSinapticoBatchJSON);

    document.getElementById("as-json-file-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const textarea = document.getElementById("as-json-batch-textarea");
            if (textarea) textarea.value = String(ev.target?.result || "");
            validateSinapticoBatchJSON(true);
        };
        reader.readAsText(file, "UTF-8");
    });

    // Pestañas Catálogo Activo vs Papelera
    document.getElementById("btn-as-tab-active")?.addEventListener("click", () => switchSinapticoCatalogTab("active"));
    document.getElementById("btn-as-tab-trash")?.addEventListener("click", () => switchSinapticoCatalogTab("trash"));
    document.getElementById("btn-as-empty-trash")?.addEventListener("click", emptySinapticoTrash);

    // Filtros en vivo
    [
        "as-filter-search",
        "as-filter-scope",
        "as-filter-career",
        "as-filter-level",
        "as-filter-visibility",
        "as-filter-plan",
        "as-filter-type"
    ].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", renderSinapticoTable);
        el?.addEventListener("change", renderSinapticoTable);
    });

    // Modal de simulación de volteo
    document.getElementById("btn-as-flip-preview")?.addEventListener("click", togglePreviewCardFlip);
    document.getElementById("btn-as-close-preview")?.addEventListener("click", closePreviewModal);

    document.querySelectorAll(".btn-as-sim-interval").forEach(btn => {
        btn.addEventListener("click", () => {
            const interval = btn.getAttribute("data-interval") || "1d";
            alert(`⚡ Retención Sináptico v4.4 calibrada: Intervalo programado en [${interval}].`);
            closePreviewModal();
        });
    });

    document.addEventListener("keydown", (e) => {
        const modal = document.getElementById("as-preview-modal");
        if (modal && !modal.classList.contains("hidden") && e.code === "Space") {
            e.preventDefault();
            togglePreviewCardFlip();
        }
    });
}

function switchSinapticoCatalogTab(tab) {
    activeCatalogTab = tab === "trash" ? "trash" : "active";
    const btnActive = document.getElementById("btn-as-tab-active");
    const btnTrash = document.getElementById("btn-as-tab-trash");
    const btnEmptyTrash = document.getElementById("btn-as-empty-trash");

    if (activeCatalogTab === "active") {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-secondary text-surface transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.add("hidden");
    } else {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-secondary/40 text-secondary hover:bg-secondary/15 transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-danger text-white transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.remove("hidden");
    }

    renderSinapticoTable();
}

// ============================================================================
// 6. LECTURA, FILTRADO Y TABLA CON VISIBILIDAD, PLAN Y PAPELERA
// ============================================================================

export async function loadSinapticoCards() {
    if (!hasMasterPermission()) return;

    const tbody = document.getElementById("as-cards-tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-400 font-mono">
                    Sincronizando mazos con Cloud Firestore (${SINAPTICO_COLLECTION})...
                </td>
            </tr>
        `;
    }

    try {
        const snap = await getDocs(collection(db, SINAPTICO_COLLECTION));
        sinapticoCache = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            sinapticoCache.push({
                id: docSnap.id,
                ...data,
                visible: data.visible !== false,
                enPapelera: data.enPapelera === true
            });
        });

        sinapticoCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        updateSinapticoCounters();
        renderSinapticoTable();
    } catch (err) {
        console.error("[AdminSinaptico] Error consultando tarjetas_sinaptico:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-danger font-mono">
                        Error al cargar tarjetas desde Firestore: ${escapeHTML(err.message)}
                    </td>
                </tr>
            `;
        }
    }
}

function updateSinapticoCounters() {
    const activeCount = sinapticoCache.filter(c => !c.enPapelera).length;
    const trashCount = sinapticoCache.filter(c => c.enPapelera).length;

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
    };

    setEl("kpi-admin-sinaptico-local", activeCount);
    setEl("kpi-admin-sinaptico-trash", trashCount);
    setEl("kpi-admin-sinaptico", activeCount);
    setEl("badge-as-active-count", activeCount);
    setEl("badge-as-trash-count", trashCount);
}

function getFilteredSinapticoCards() {
    const searchVal = (document.getElementById("as-filter-search")?.value || "").toLowerCase().trim();
    const scopeVal = document.getElementById("as-filter-scope")?.value || "all";
    const careerVal = document.getElementById("as-filter-career")?.value || "all";
    const levelVal = document.getElementById("as-filter-level")?.value || "all";
    const visVal = document.getElementById("as-filter-visibility")?.value || "all";
    const planVal = document.getElementById("as-filter-plan")?.value || "all";
    const typeVal = document.getElementById("as-filter-type")?.value || "all";

    return sinapticoCache.filter(c => {
        const isTrash = c.enPapelera === true;
        if (activeCatalogTab === "trash" && !isTrash) return false;
        if (activeCatalogTab === "active" && isTrash) return false;

        const cardScope = c.ambito || (c.nivel && c.nivel !== "caces_oficial" ? "carrera" : "caces");
        if (scopeVal !== "all" && cardScope !== scopeVal) return false;
        if (careerVal !== "all" && c.carrera !== careerVal) return false;
        if (levelVal !== "all" && (c.nivel || "caces_oficial") !== levelVal) return false;

        const isVisible = c.visible !== false;
        if (visVal === "visible" && !isVisible) return false;
        if (visVal === "hidden" && isVisible) return false;

        if (planVal !== "all" && (c.planAcceso || "PRO") !== planVal) return false;
        if (typeVal !== "all" && (c.tipoTarjeta || "perla_clinica") !== typeVal) return false;

        if (searchVal) {
            const haystack = [
                c.frente || c.pregunta || "",
                c.reverso || c.respuesta || "",
                c.perlaClinica || "",
                c.materia || "",
                c.subtema || ""
            ].join(" ").toLowerCase();
            if (!haystack.includes(searchVal)) return false;
        }

        return true;
    });
}

function renderSinapticoTable() {
    const tbody = document.getElementById("as-cards-tbody");
    const countLabel = document.getElementById("as-filter-count-label");
    if (!tbody) return;

    const filtered = getFilteredSinapticoCards();
    if (countLabel) {
        countLabel.textContent = activeCatalogTab === "trash"
            ? `🗑️ Mostrando ${filtered.length} tarjetas en la Papelera de Reciclaje`
            : `📚 Mostrando ${filtered.length} tarjetas activas en este filtro`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500 font-mono">
                    ${
                        activeCatalogTab === "trash"
                            ? "La Papelera de Reciclaje de Sináptico está vacía."
                            : "No se encontraron tarjetas Sináptico con los filtros seleccionados."
                    }
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(item => {
        const cardScope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
        const scopeBadge = cardScope === "caces"
            ? `<span class="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono font-bold">🎯 CACES</span>`
            : `<span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-mono font-bold">🏛️ MALLA</span>`;

        const isVisible = item.visible !== false;
        const plan = item.planAcceso || "PRO";
        const hasImg = Boolean(item.imagenUrl || item.imagenBase64);

        const frontText = item.frente || item.pregunta || "Sin frente";
        const backText = item.reverso || item.respuesta || "Sin reverso";
        const typeObj = SINAPTICO_CARD_TYPES.find(t => t.id === item.tipoTarjeta);
        const typeLabel = typeObj ? typeObj.nombre : "💡 Perla Clínica";

        const tr = document.createElement("tr");
        tr.className = `transition-colors ${!isVisible ? "bg-surface/40 opacity-75" : "hover:bg-surface/60"}`;

        tr.innerHTML = `
            <!-- 1. RUTA CURRICULAR -->
            <td class="px-4 py-3.5 align-top">
                <div class="flex items-center gap-1.5 mb-1">
                    ${scopeBadge}
                    <span class="text-white font-extrabold uppercase text-[11px]">${escapeHTML(item.carrera || "medicina")}</span>
                </div>
                <div class="text-[11px] text-secondary font-bold">${escapeHTML(item.materia || "General")}</div>
                <div class="text-[10px] text-gray-400">Nivel: ${escapeHTML(item.nivel || "caces_oficial")}</div>
                <div class="text-[10px] text-primary mt-0.5">${escapeHTML(typeLabel)}</div>
            </td>

            <!-- 2. FRENTE (CARA A) -->
            <td class="px-4 py-3.5 align-top max-w-xs">
                ${
                    item.subtema
                        ? `<span class="inline-block px-2 py-0.5 rounded bg-surface-high text-primary font-mono text-[10px] font-bold mb-1">📌 ${escapeHTML(item.subtema)}</span>`
                        : ""
                }
                <div class="text-gray-200 font-sans text-xs line-clamp-3 leading-relaxed">${escapeHTML(frontText)}</div>
                ${
                    hasImg
                        ? `<span class="inline-block mt-1 text-[10px] text-secondary font-mono">🖼️ ${escapeHTML(item.imagenUrl || "Imagen subida")}</span>`
                        : ""
                }
            </td>

            <!-- 3. REVERSO (CARA B) Y PERLA -->
            <td class="px-4 py-3.5 align-top max-w-xs">
                <div class="text-gray-300 font-sans text-xs line-clamp-3 leading-relaxed">${escapeHTML(backText)}</div>
                ${
                    item.perlaClinica
                        ? `<div class="mt-1 text-[10px] text-warning font-sans line-clamp-2">💡 ${escapeHTML(item.perlaClinica)}</div>`
                        : ""
                }
            </td>

            <!-- 4. VISIBILIDAD Y PLAN EN 1 CLIC -->
            <td class="px-4 py-3.5 align-top space-y-1.5">
                <div>
                    <button type="button" class="btn-as-toggle-vis px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold border transition-all ${
                        isVisible
                            ? "bg-secondary/15 text-secondary border-secondary/40 hover:bg-secondary/25"
                            : "bg-gray-800 text-gray-400 border-gray-600 hover:text-white"
                    }" title="Haz clic para mostrar u ocultar esta tarjeta a los usuarios">
                        ${isVisible ? "🟢 Visible Usuarios" : "🙈 Oculto (Borrador)"}
                    </button>
                </div>
                <div>
                    <select class="select-as-inline-plan bg-surface border border-surface-high rounded-lg px-2 py-1 text-[10px] font-mono text-white focus:border-secondary focus:outline-none">
                        <option value="Básico" ${plan === "Básico" ? "selected" : ""}>🔓 Plan Básico</option>
                        <option value="PRO" ${plan === "PRO" ? "selected" : ""}>💎 Plan PRO</option>
                        <option value="VIP" ${plan === "VIP" ? "selected" : ""}>👑 Plan VIP</option>
                    </select>
                </div>
            </td>

            <!-- 5. ACCIONES CRUD / PAPELERA -->
            <td class="px-4 py-3.5 align-top text-right whitespace-nowrap space-x-1">
                <button type="button" class="btn-as-preview px-2.5 py-1.5 rounded-lg bg-surface border border-gray-600 text-gray-200 hover:border-secondary hover:text-secondary font-bold text-[11px]" title="Probar Volteo Sináptico">
                    🔄 Probar
                </button>
                ${
                    activeCatalogTab === "active"
                        ? `
                            <button type="button" class="btn-as-edit px-2.5 py-1.5 rounded-lg bg-surface border border-primary/60 text-primary hover:bg-primary hover:text-surface font-bold text-[11px]" title="Editar Tarjeta">
                                ✏️ Editar
                            </button>
                            <button type="button" class="btn-as-trash px-2.5 py-1.5 rounded-lg bg-surface border border-danger/60 text-danger hover:bg-danger hover:text-white font-bold text-[11px]" title="Enviar a la Papelera">
                                🗑️
                            </button>
                          `
                        : `
                            <button type="button" class="btn-as-restore px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-secondary text-secondary hover:bg-secondary hover:text-surface font-extrabold text-[11px]" title="Restaurar al Catálogo Activo">
                                ♻️ Restaurar
                            </button>
                            <button type="button" class="btn-as-delete-perm px-2.5 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px]" title="Eliminar definitivamente de Firestore">
                                🔥 Borrar Definitivo
                            </button>
                          `
                }
            </td>
        `;

        tr.querySelector(".btn-as-preview")?.addEventListener("click", () => previewSinapticoCardModal(item.id));
        tr.querySelector(".btn-as-toggle-vis")?.addEventListener("click", () => toggleSinapticoCardVisibility(item.id));
        tr.querySelector(".select-as-inline-plan")?.addEventListener("change", (e) => updateSinapticoCardPlanInline(item.id, e.target.value));
        tr.querySelector(".btn-as-edit")?.addEventListener("click", () => editSinapticoCard(item.id));
        tr.querySelector(".btn-as-trash")?.addEventListener("click", () => moveSinapticoCardToTrash(item.id));
        tr.querySelector(".btn-as-restore")?.addEventListener("click", () => restoreSinapticoCardFromTrash(item.id));
        tr.querySelector(".btn-as-delete-perm")?.addEventListener("click", () => deleteSinapticoCard(item.id));

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 7. GUARDADO, EDICIÓN, VISIBILIDAD, PLAN Y PAPELERA DE RECICLAJE
// ============================================================================

export async function saveSinapticoCard(event) {
    if (event) event.preventDefault();
    if (!hasMasterPermission()) return;

    const submitBtn = document.getElementById("btn-as-submit");
    const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];

    const scope = document.getElementById("as-scope")?.value || "caces";
    const carrera = document.getElementById("as-carrera")?.value || "medicina";
    const nivel = document.getElementById("as-nivel")?.value || "caces_oficial";
    const materia = document.getElementById("as-materia")?.value || "Medicina Interna";
    const tipoTarjeta = document.getElementById("as-tipo")?.value || "perla_clinica";
    const dificultad = document.getElementById("as-dificultad")?.value || "Media";
    const planAcceso = document.getElementById("as-plan-acceso")?.value || "PRO";
    const visible = document.getElementById("as-visible")?.value !== "false";
    const subtema = (document.getElementById("as-subtema")?.value || "").trim();

    const frenteVal = (document.getElementById("as-frente")?.value || "").trim();
    const reversoVal = (document.getElementById("as-reverso")?.value || "").trim();
    const perlaClinica = (document.getElementById("as-perla")?.value || "").trim();

    syncCardImagePathWithFolder();
    const imagenUrl = (document.getElementById("as-imagen-url")?.value || "").trim();

    if (!frenteVal || !reversoVal) {
        alert("⚠️ Completa tanto el Frente (Cara A) como el Reverso (Cara B) de la tarjeta.");
        return;
    }

    const nowIso = new Date().toISOString();

    const payload = {
        ambito: scope,
        carrera,
        nivel,
        materia,
        tipoTarjeta,
        dificultad,
        planAcceso,
        visible,
        enPapelera: false,
        subtema,
        frente: frenteVal,
        pregunta: frenteVal,
        reverso: reversoVal,
        respuesta: reversoVal,
        perlaClinica,
        imagenUrl,
        imagenBase64: uploadedCardImageBase64 || null,
        intervalosAlgoritmo: {
            dificil: "<10m",
            bueno: "1d",
            facil: "4d"
        },
        motorVersion: "Sináptico v4.4",
        actualizadoPor: activeEmail,
        updatedAt: nowIso
    };

    try {
        if (submitBtn) submitBtn.disabled = true;

        if (editingCardId) {
            await setDoc(doc(db, SINAPTICO_COLLECTION, editingCardId), payload, { merge: true });
            alert(`✅ Tarjeta actualizada en [${scope.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        } else {
            payload.createdAt = nowIso;
            payload.creadoPor = activeEmail;
            await addDoc(collection(db, SINAPTICO_COLLECTION), payload);
            alert(`✅ Nueva tarjeta Sináptica guardada en [${scope.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        }

        resetSinapticoForm();
        await loadSinapticoCards();
    } catch (err) {
        console.error("[AdminSinaptico] Error guardando tarjeta:", err);
        alert("Error al guardar la tarjeta en Firestore: " + err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

export function editSinapticoCard(cardId) {
    if (!hasMasterPermission()) return;

    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    editingCardId = item.id;
    uploadedCardImageBase64 = item.imagenBase64 || null;

    const scope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
    const scopeEl = document.getElementById("as-scope");
    if (scopeEl) scopeEl.value = scope;

    populateCascadingSinapticoCareers(item.carrera || "medicina");
    populateCascadingSinapticoLevels(item.nivel || (scope === "caces" ? "caces_oficial" : "semestre_1"));
    populateCascadingSinapticoSubjects(item.materia || "General");

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal("as-tipo", item.tipoTarjeta || "perla_clinica");
    setVal("as-dificultad", item.dificultad || "Media");
    setVal("as-plan-acceso", item.planAcceso || "PRO");
    setVal("as-visible", item.visible === false ? "false" : "true");
    setVal("as-subtema", item.subtema || "");
    setVal("as-frente", item.frente || item.pregunta || "");
    setVal("as-reverso", item.reverso || item.respuesta || "");
    setVal("as-perla", item.perlaClinica || "");
    setVal("as-imagen-url", item.imagenUrl || "");

    updateSinapticoLiveRouteBanner();

    if (item.imagenBase64 || item.imagenUrl) {
        testAndPreviewSinapticoImage(item.imagenBase64 || item.imagenUrl);
    } else {
        document.getElementById("as-img-live-preview-wrap")?.classList.add("hidden");
    }

    const badge = document.getElementById("as-form-mode-badge");
    const title = document.getElementById("as-form-mode-title");
    const submitLabel = document.getElementById("btn-as-submit-label");

    if (badge) {
        badge.textContent = "✏️ MODO EDICIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = `Modificando Tarjeta Sináptica (${item.id})`;
    if (submitLabel) submitLabel.textContent = "Actualizar Tarjeta en Cloud Firestore";

    document.getElementById("btn-as-cancel-edit")?.classList.remove("hidden");
    document.getElementById("admin-sinaptico-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetSinapticoForm() {
    editingCardId = null;
    uploadedCardImageBase64 = null;

    document.getElementById("as-crud-form")?.reset();
    populateCascadingSinapticoCareers();
    document.getElementById("as-img-live-preview-wrap")?.classList.add("hidden");

    const badge = document.getElementById("as-form-mode-badge");
    const title = document.getElementById("as-form-mode-title");
    const submitLabel = document.getElementById("btn-as-submit-label");

    if (badge) {
        badge.textContent = "➕ MODO CREACIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = "Nueva Tarjeta de Repetición Espaciada • Sináptico v4.4";
    if (submitLabel) submitLabel.textContent = "Guardar Tarjeta en Cloud Firestore";

    document.getElementById("btn-as-cancel-edit")?.classList.add("hidden");
}

export async function toggleSinapticoCardVisibility(cardId) {
    if (!hasMasterPermission()) return;
    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    const newVis = item.visible === false;
    try {
        await updateDoc(doc(db, SINAPTICO_COLLECTION, cardId), {
            visible: newVis,
            updatedAt: new Date().toISOString()
        });
        item.visible = newVis;
        renderSinapticoTable();
    } catch (err) {
        alert("Error al cambiar visibilidad: " + err.message);
    }
}

export async function updateSinapticoCardPlanInline(cardId, newPlan) {
    if (!hasMasterPermission()) return;
    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    try {
        await updateDoc(doc(db, SINAPTICO_COLLECTION, cardId), {
            planAcceso: newPlan,
            updatedAt: new Date().toISOString()
        });
        item.planAcceso = newPlan;
    } catch (err) {
        alert("Error al actualizar el plan de la tarjeta: " + err.message);
    }
}

export async function moveSinapticoCardToTrash(cardId) {
    if (!hasMasterPermission()) return;
    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    try {
        await updateDoc(doc(db, SINAPTICO_COLLECTION, cardId), {
            enPapelera: true,
            visible: false,
            eliminadoEn: new Date().toISOString()
        });
        item.enPapelera = true;
        item.visible = false;
        updateSinapticoCounters();
        renderSinapticoTable();
    } catch (err) {
        alert("Error al mover a la papelera: " + err.message);
    }
}

export async function restoreSinapticoCardFromTrash(cardId) {
    if (!hasMasterPermission()) return;
    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    try {
        await updateDoc(doc(db, SINAPTICO_COLLECTION, cardId), {
            enPapelera: false,
            visible: true,
            restauradoEn: new Date().toISOString()
        });
        item.enPapelera = false;
        item.visible = true;
        updateSinapticoCounters();
        renderSinapticoTable();
    } catch (err) {
        alert("Error al restaurar la tarjeta: " + err.message);
    }
}

export async function deleteSinapticoCard(cardId) {
    if (!hasMasterPermission()) return;

    const item = sinapticoCache.find(c => c.id === cardId);
    const previewText = (item?.frente || item?.pregunta || cardId).substring(0, 80);

    if (!confirm(`🔥 ¿Confirmas ELIMINAR DEFINITIVAMENTE esta tarjeta de Firestore?\nEsta acción no se puede deshacer.\n\n"${previewText}..."`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, SINAPTICO_COLLECTION, cardId));
        if (editingCardId === cardId) resetSinapticoForm();
        await loadSinapticoCards();
    } catch (err) {
        alert("Error al eliminar definitivamente: " + err.message);
    }
}

async function emptySinapticoTrash() {
    if (!hasMasterPermission()) return;
    const trashItems = sinapticoCache.filter(c => c.enPapelera);
    if (trashItems.length === 0) return;

    if (!confirm(`🔥 ¿Estás seguro de eliminar permanentemente las ${trashItems.length} tarjetas de la Papelera?`)) {
        return;
    }

    try {
        for (const item of trashItems) {
            await deleteDoc(doc(db, SINAPTICO_COLLECTION, item.id));
        }
        await loadSinapticoCards();
    } catch (err) {
        alert("Error al vaciar la papelera: " + err.message);
    }
}

// ============================================================================
// 8. IMPORTACIÓN MASIVA (.JSON) Y CONVERSOR DESDE BANCO DE PREGUNTAS
// ============================================================================

function insertSampleSinapticoBatchJSON() {
    const scope = document.getElementById("as-scope")?.value || "caces";
    const carrera = document.getElementById("as-carrera")?.value || "medicina";
    const nivel = document.getElementById("as-nivel")?.value || "caces_oficial";
    const materia = document.getElementById("as-materia")?.value || "Medicina Interna";
    const plan = document.getElementById("as-plan-acceso")?.value || "PRO";

    const sample = [
        {
            ambito: scope,
            carrera,
            nivel,
            materia,
            tipoTarjeta: "algoritmo_gpc",
            dificultad: "Alta",
            planAcceso: plan,
            subtema: "Clave Roja Obstétrica MSP",
            frente: "Paciente puérpera inmediata con hemorragia posparto por atonía uterina. ¿Cuál es el fármaco uterotónico de primera línea y su dosis inicial según la GPC del MSP?",
            reverso: "Oxitocina: 10 UI por vía intramuscular (o 5 UI IV lento) STAT, seguida de infusión continua de 20 a 40 UI en 1000 ml de cristaloides a 125 ml/hora.",
            perlaClinica: "Las 4 T de la Hemorragia Posparto: Tono (70% atonía), Trauma (20%), Tejido (9%), Trombina (1%).",
            imagenUrl: ""
        }
    ];

    const textarea = document.getElementById("as-json-batch-textarea");
    if (textarea) {
        textarea.value = JSON.stringify(sample, null, 2);
        validateSinapticoBatchJSON(true);
    }
}

function validateSinapticoBatchJSON(showBox = true) {
    const textarea = document.getElementById("as-json-batch-textarea");
    const box = document.getElementById("as-batch-validation-box");
    const forceRoute = document.getElementById("as-batch-force-route")?.checked;

    const formScope = document.getElementById("as-scope")?.value || "caces";
    const formCareer = document.getElementById("as-carrera")?.value || "medicina";
    const formLevel = document.getElementById("as-nivel")?.value || "caces_oficial";
    const formSubject = document.getElementById("as-materia")?.value || "Medicina Interna";
    const formPlan = document.getElementById("as-plan-acceso")?.value || "PRO";
    const formType = document.getElementById("as-tipo")?.value || "perla_clinica";

    const rawText = textarea?.value?.trim() || "";
    if (!rawText) {
        if (box) box.classList.add("hidden");
        return null;
    }

    try {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.tarjetas_sinaptico) ? parsed.tarjetas_sinaptico : null);

        if (!list || list.length === 0) {
            throw new Error("El JSON debe ser un arreglo [ ... ] con al menos 1 tarjeta sináptica.");
        }

        const normalizedList = [];
        for (const rawItem of list) {
            const front = String(rawItem.frente || rawItem.pregunta || "").trim();
            const back = String(rawItem.reverso || rawItem.respuesta || "").trim();
            if (!front || !back) continue;

            normalizedList.push({
                ambito: forceRoute ? formScope : (rawItem.ambito || formScope),
                carrera: forceRoute ? formCareer : String(rawItem.carrera || formCareer).toLowerCase().trim(),
                nivel: forceRoute ? formLevel : (rawItem.nivel || formLevel),
                materia: forceRoute ? formSubject : (rawItem.materia || formSubject),
                planAcceso: forceRoute ? formPlan : (rawItem.planAcceso || formPlan),
                tipoTarjeta: rawItem.tipoTarjeta || formType,
                dificultad: rawItem.dificultad || "Media",
                subtema: rawItem.subtema || "",
                frente: front,
                pregunta: front,
                reverso: back,
                respuesta: back,
                perlaClinica: String(rawItem.perlaClinica || "").trim(),
                imagenUrl: String(rawItem.imagenUrl || "").trim(),
                visible: rawItem.visible !== false,
                enPapelera: false,
                intervalosAlgoritmo: {
                    dificil: "<10m",
                    bueno: "1d",
                    facil: "4d"
                },
                motorVersion: "Sináptico v4.4"
            });
        }

        if (showBox && box) {
            box.classList.remove("hidden");
            box.innerHTML = `
                <div class="text-secondary font-extrabold">
                    ✅ Mazo JSON Válido: ${normalizedList.length} tarjetas listas para importar.
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

export async function importSinapticoBatchJSON() {
    if (!hasMasterPermission()) return;

    const validList = validateSinapticoBatchJSON(true);
    if (!validList || validList.length === 0) {
        alert("⚠️ Verifica el formato del lote JSON antes de importar.");
        return;
    }

    const importBtn = document.getElementById("btn-as-import-batch");
    const textarea = document.getElementById("as-json-batch-textarea");
    const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
    const nowIso = new Date().toISOString();

    try {
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = `Importando ${validList.length} tarjetas...`;
        }

        let importedCount = 0;
        for (const item of validList) {
            await addDoc(collection(db, SINAPTICO_COLLECTION), {
                ...item,
                creadoPor: activeEmail,
                createdAt: nowIso,
                updatedAt: nowIso
            });
            importedCount++;
        }

        alert(`✅ Importación masiva exitosa: ${importedCount} tarjetas guardadas en la ruta seleccionada.`);
        if (textarea) textarea.value = "";
        document.getElementById("as-batch-validation-box")?.classList.add("hidden");
        await loadSinapticoCards();
    } catch (err) {
        alert("Error al importar mazo JSON: " + err.message);
    } finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span><span>2. Procesar e Importar Mazo a Firestore</span>`;
        }
    }
}

/**
 * Convierte automáticamente los reactivos activos de preguntas_caces en tarjetas
 * Sináptico v4.4 respetando su ruta exacta e ignorando los reactivos en Papelera.
 */
export async function generateCardsFromCacesQuestions() {
    if (!hasMasterPermission()) return;

    const syncBtn = document.getElementById("btn-sync-from-caces");

    try {
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `<span>Analizando Banco de Preguntas...</span>`;
        }

        const questionsSnap = await getDocs(collection(db, QUESTIONS_COLLECTION));
        if (questionsSnap.empty) {
            alert("No se encontraron reactivos en el Banco de Preguntas (preguntas_caces) para convertir.");
            return;
        }

        const existingSourceIds = new Set(
            sinapticoCache
                .map(c => c.sourceQuestionId)
                .filter(Boolean)
        );

        const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
        const nowIso = new Date().toISOString();
        let createdCount = 0;

        for (const qDoc of questionsSnap.docs) {
            if (existingSourceIds.has(qDoc.id)) continue;

            const q = qDoc.data();
            // Ignorar preguntas eliminadas en la Papelera
            if (q.enPapelera === true) continue;

            const correctLetter = q.respuestaCorrecta || "A";
            const correctOptionText = q.opciones?.[correctLetter] || "";
            if (!q.enunciado || !correctOptionText) continue;

            const newCard = {
                sourceQuestionId: qDoc.id,
                ambito: q.ambito || "caces",
                carrera: q.carrera || "medicina",
                nivel: q.nivel || "caces_oficial",
                materia: q.materia || "Medicina Interna",
                tipoTarjeta: "caso_corto",
                dificultad: q.dificultad || "Media",
                planAcceso: q.planAcceso || "PRO",
                visible: q.visible !== false,
                enPapelera: false,
                subtema: q.subtema || "Caso Clínico",
                frente: q.enunciado,
                pregunta: q.enunciado,
                reverso: `Respuesta Correcta (${correctLetter}): ${correctOptionText}`,
                respuesta: `Respuesta Correcta (${correctLetter}): ${correctOptionText}`,
                perlaClinica: q.racional || "",
                imagenUrl: q.imagenUrl || "",
                imagenBase64: q.imagenBase64 || null,
                intervalosAlgoritmo: {
                    dificil: "<10m",
                    bueno: "1d",
                    facil: "4d"
                },
                motorVersion: "Sináptico v4.4",
                creadoPor: activeEmail,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            await addDoc(collection(db, SINAPTICO_COLLECTION), newCard);
            createdCount++;
        }

        if (createdCount === 0) {
            alert("ℹ️ Todos los reactivos activos del Banco de Preguntas ya cuentan con su tarjeta Sináptica correspondiente.");
        } else {
            alert(`✅ Conversión completada: Se generaron ${createdCount} nuevas tarjetas en ${SINAPTICO_COLLECTION} conservando su carrera, semestre y materia.`);
            await loadSinapticoCards();
        }
    } catch (err) {
        console.error("[AdminSinaptico] Error generando tarjetas desde preguntas_caces:", err);
        alert("Error al generar tarjetas desde el Banco de Preguntas: " + err.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `<span class="material-symbols-outlined text-sm">auto_awesome</span><span>Generar desde Banco de Preguntas</span>`;
        }
    }
}

// ============================================================================
// 9. MODAL DE SIMULACIÓN DE VOLTEO Y EXPORTACIÓN JSON
// ============================================================================

export function previewSinapticoCardModal(cardId) {
    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    previewCardFlipped = false;

    const modal = document.getElementById("as-preview-modal");
    const metaEl = document.getElementById("as-preview-meta");
    const subtemaEl = document.getElementById("as-preview-subtema");
    const faceBadge = document.getElementById("as-preview-face-badge");
    const frontText = document.getElementById("as-preview-front-text");
    const backBox = document.getElementById("as-preview-back-box");
    const backText = document.getElementById("as-preview-back-text");
    const pearlBox = document.getElementById("as-preview-pearl-box");
    const pearlText = document.getElementById("as-preview-pearl-text");
    const imgBox = document.getElementById("as-preview-image-box");
    const imgEl = document.getElementById("as-preview-image");
    const flipBtn = document.getElementById("btn-as-flip-preview");
    const retentionBtns = document.getElementById("as-preview-retention-btns");

    if (!modal || !frontText || !backText) return;

    if (metaEl) {
        metaEl.textContent = `${(item.ambito || "caces").toUpperCase()} • ${(item.carrera || "medicina").toUpperCase()} • ${item.nivel || "CACES"} • ${item.materia || "General"}`;
    }
    if (subtemaEl) {
        subtemaEl.textContent = item.subtema || "Repetición Espaciada • Sináptico v4.4";
    }
    if (faceBadge) {
        faceBadge.textContent = "CARA A • ESTÍMULO CLÍNICO";
        faceBadge.className = "px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] font-bold uppercase";
    }

    const imgSrc = item.imagenBase64 || item.imagenUrl || "";
    if (imgSrc && imgBox && imgEl) {
        imgEl.src = imgSrc;
        imgBox.classList.remove("hidden");
    } else if (imgBox) {
        imgBox.classList.add("hidden");
    }

    frontText.textContent = item.frente || item.pregunta || "";
    backText.textContent = item.reverso || item.respuesta || "";

    if (item.perlaClinica && pearlBox && pearlText) {
        pearlText.textContent = item.perlaClinica;
        pearlBox.classList.remove("hidden");
    } else if (pearlBox) {
        pearlBox.classList.add("hidden");
    }

    backBox?.classList.add("hidden");
    retentionBtns?.classList.add("hidden");
    if (flipBtn) {
        flipBtn.innerHTML = `<span class="material-symbols-outlined text-base">flip</span><span>Mostrar Respuesta (Espacio)</span>`;
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function togglePreviewCardFlip() {
    previewCardFlipped = !previewCardFlipped;

    const faceBadge = document.getElementById("as-preview-face-badge");
    const backBox = document.getElementById("as-preview-back-box");
    const flipBtn = document.getElementById("btn-as-flip-preview");
    const retentionBtns = document.getElementById("as-preview-retention-btns");

    if (previewCardFlipped) {
        backBox?.classList.remove("hidden");
        retentionBtns?.classList.remove("hidden");
        if (faceBadge) {
            faceBadge.textContent = "CARA B • RESOLUCIÓN Y PERLA CLÍNICA";
            faceBadge.className = "px-2.5 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[10px] font-bold uppercase";
        }
        if (flipBtn) {
            flipBtn.innerHTML = `<span class="material-symbols-outlined text-base">flip</span><span>Ocultar Respuesta (Espacio)</span>`;
        }
    } else {
        backBox?.classList.add("hidden");
        retentionBtns?.classList.add("hidden");
        if (faceBadge) {
            faceBadge.textContent = "CARA A • ESTÍMULO CLÍNICO";
            faceBadge.className = "px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] font-bold uppercase";
        }
        if (flipBtn) {
            flipBtn.innerHTML = `<span class="material-symbols-outlined text-base">flip</span><span>Mostrar Respuesta (Espacio)</span>`;
        }
    }
}

function closePreviewModal() {
    const modal = document.getElementById("as-preview-modal");
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
}

export function exportSinapticoDeckJSON() {
    if (!hasMasterPermission()) return;

    const filtered = getFilteredSinapticoCards();
    if (filtered.length === 0) {
        alert("No hay tarjetas en la vista actual para exportar.");
        return;
    }

    const exportPayload = {
        plataforma: "Makai Academy (Proyecto ALICIZATION)",
        sistema: "Repetición Espaciada • Sináptico v4.4",
        coleccion: SINAPTICO_COLLECTION,
        fechaExportacion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
        totalTarjetas: filtered.length,
        tarjetas_sinaptico: filtered
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `Mazo_Sinaptico_Makai_${dateStr}.json`;
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
