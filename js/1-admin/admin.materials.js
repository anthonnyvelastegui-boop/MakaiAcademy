// ============================================================================
// ARCHIVO: js/1-admin/admin.materials.js
// DESCRIPCIÓN: Gestor Maestro de Materiales de Estudio 1D, Guías Clínicas (GPC),
//              Libros PDF, Infografías, Algoritmos y Micro-Videos con Cascada
//              Curricular Oficial por Semestre, Verificador de Rutas assets/,
//              Importador JSON con Ruta Forzada y Papelera de Reciclaje.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION) - makai-academy-f8039
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

// Colección oficial en Cloud Firestore
const MATERIALS_COLLECTION = COLLECTIONS?.MATERIALS || "materiales_estudio";

// ============================================================================
// 1. MAPA CURRICULAR OFICIAL DEL ECUADOR (SINCRONIZADO CON BANCO Y SINÁPTICO)
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

const ASSET_SUBFOLDERS = {
    "guias-pdf": "assets/5-multimedia-1d/guias-pdf/",
    "infografias-y-algoritmos": "assets/5-multimedia-1d/infografias-y-algoritmos/",
    "micro-videos-1d": "assets/5-multimedia-1d/micro-videos-1d/",
    "atlas-visual": "assets/4-banco-clinico/atlas-visual/",
    "electrocardiografia": "assets/4-banco-clinico/electrocardiografia/",
    "imagenologia": "assets/4-banco-clinico/imagenologia/"
};

// Estado interno del módulo de materiales
let materialsCache = [];
let editingMaterialId = null;
let activeCatalogTab = "active"; // "active" | "trash"

// ============================================================================
// 2. VALIDACIÓN DE SEGURIDAD Y PROCESAMIENTO DE ARCHIVOS
// ============================================================================

function verifyAdminAccess() {
    const activeEmail = (
        auth?.currentUser?.email ||
        appState?.currentUser?.email ||
        appState?.currentUserData?.email ||
        ""
    ).toLowerCase().trim();

    if (!isMasterAdmin(activeEmail) && !MASTER_ADMINS.includes(activeEmail)) {
        alert("⛔ Acceso denegado: Función exclusiva para Administradores Maestros de Makai Academy.");
        return false;
    }
    return true;
}

/**
 * Procesa archivos ligeros (PDF <= 750 KB o Imágenes JPG/PNG/WEBP comprimidas) a Base64.
 */
async function processMaterialFileToBase64(file) {
    if (!file) return null;

    if (file.type === "application/pdf") {
        if (file.size > 750 * 1024) {
            throw new Error(
                "El archivo PDF directo supera los 750 KB para Firestore. " +
                "Para guías o libros pesados, súbelos a 'assets/5-multimedia-1d/guias-pdf/' o a Firebase Storage y pega su ruta o URL."
            );
        }
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    if (file.type.startsWith("image/")) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 1200;
                    const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/webp", 0.84));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    throw new Error("Formato directo no soportado. Usa PDF (<=750 KB), JPG, PNG, WEBP o enlaza mediante Ruta Assets / URL Cloud.");
}

// ============================================================================
// 3. INICIALIZADOR PRINCIPAL E INTERFAZ DEL GESTOR DE MATERIALES 1D
// ============================================================================

export async function initAdminMaterials() {
    if (!verifyAdminAccess()) return;

    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    let section = document.getElementById("admin-materials-section");
    if (!section) {
        section = document.createElement("section");
        section.id = "admin-materials-section";
        section.dataset.adminSection = "materiales";
        section.className = "mb-10 space-y-6 mt-6";
        adminView.appendChild(section);
    }

    renderMaterialsSectionUI(section);
    bindMaterialsEvents();
    await loadStudyMaterials();
}

function renderMaterialsSectionUI(section) {
    section.innerHTML = `
        <!-- CABECERA Y MÉTRICAS DEL GESTOR DE MATERIALES Y PDFS -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-surface-high">
                <div>
                    <span class="text-[11px] font-mono text-primary uppercase tracking-widest font-bold block">
                        Colección Firestore: ${MATERIALS_COLLECTION} • Bóveda Bibliográfica y Multimedia 1D
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-1">
                        <span class="material-symbols-outlined text-primary">picture_as_pdf</span>
                        <span>Gestor de Materiales de Estudio, Guías Clínicas (GPC), Infografías y Micro-Videos 1D</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Sincronizado semestre por semestre con las 11 Carreras Universitarias, Preuniversitario, CACES Oficial y la carpeta <code class="text-secondary font-mono">assets/5-multimedia-1d/</code>.
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2.5">
                    <div class="px-3 py-1.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-gray-300">
                        Activos: <strong id="kpi-admin-materials-local" class="text-primary">0</strong>
                        <span class="mx-1 text-gray-600">|</span>
                        Papelera: <strong id="kpi-admin-materials-trash" class="text-danger">0</strong>
                    </div>
                    <button type="button" id="btn-materials-refresh" class="px-3.5 py-2 bg-surface border border-primary/50 text-primary hover:bg-primary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm" id="icon-materials-refresh">refresh</span>
                        <span>Sincronizar Biblioteca</span>
                    </button>
                    <button type="button" id="btn-materials-export-json" class="px-3.5 py-2 bg-surface border border-secondary/50 text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Vista (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- FORMULARIO PRINCIPAL DE ALTA Y EDICIÓN DE MATERIAL -->
            <form id="admin-materials-form" class="space-y-5">
                <div class="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2.5 rounded-xl border border-surface-high">
                    <div class="flex items-center gap-2">
                        <span id="mat-form-mode-badge" class="px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[11px] font-bold uppercase">
                            ➕ MODO CREACIÓN
                        </span>
                        <h4 id="materials-form-title" class="text-xs font-extrabold text-white">
                            Registrar Nuevo Material, Ficha 1-Hoja, Guía PDF o Micro-Video 1D
                        </h4>
                    </div>
                    <button type="button" id="btn-materials-cancel-edit" class="hidden text-xs font-mono text-danger hover:underline">
                        ✖ Cancelar edición y limpiar formulario
                    </button>
                </div>

                <!-- BRÚJULA DE RUTA EXACTA EN VIVO -->
                <div class="bg-primary/10 border border-primary/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="text-xs font-mono text-gray-200 flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-base">route</span>
                        <span><strong>Destino Exacto del Material:</strong></span>
                        <span id="mat-route-preview-text" class="text-primary font-extrabold"></span>
                    </div>
                    <span class="text-[10px] font-mono text-gray-400">
                        Malla oficial sincronizada por carrera y semestre
                    </span>
                </div>

                <!-- FILA 1: CASCADA CURRICULAR ESTRICTA (1. ÁMBITO -> 2. CARRERA -> 3. NIVEL -> 4. MATERIA) -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            1. Ámbito Curricular *
                        </label>
                        <select id="mat-scope" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="caces">🎯 Habilitación CACES (EHEP Oficial)</option>
                            <option value="carrera">🏛️ Malla Universitaria (11 Carreras + Preuniv.)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            2. Carrera Destino *
                        </label>
                        <select id="mat-career" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            3. Nivel / Semestre *
                        </label>
                        <select id="mat-level" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">
                            4. Materia / Asignatura (Por Semestre) *
                        </label>
                        <select id="mat-subject" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>
                </div>

                <!-- FILA 2: TÍTULO, CÓDIGO Y EXTENSIÓN/DURACIÓN -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-2">
                        <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">
                            5. Título del Material / Guía Clínica / Micro-Video *
                        </label>
                        <input type="text" id="mat-title" required placeholder="Ej: GPC Trastornos Hipertensivos del Embarazo (MSP) / Mapa de Guardia" class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            6. Código / Edición
                        </label>
                        <input type="text" id="mat-code" placeholder="Ej: GPC-MSP-2026" class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            7. Páginas o Duración
                        </label>
                        <input type="text" id="mat-meta" placeholder="Ej: 1 Hoja HD | 4 min Video" class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <!-- FILA 3: CATEGORÍA (SUBCARPETA ASSETS), CANDADO DEL PLAN Y VISIBILIDAD -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">
                            8. Categoría / Subcarpeta en Bóveda Assets *
                        </label>
                        <select id="mat-category" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="guias-pdf">📄 Guía Clínica / Libro PDF (assets/5-multimedia-1d/guias-pdf/)</option>
                            <option value="infografias-y-algoritmos">🧠 Infografía / Mapa 1-Hoja (assets/5-multimedia-1d/infografias-y-algoritmos/)</option>
                            <option value="micro-videos-1d">🎬 Micro-Video 1D (3-5 min) (assets/5-multimedia-1d/micro-videos-1d/)</option>
                            <option value="atlas-visual">🔬 Atlas Visual Clínico (assets/4-banco-clinico/atlas-visual/)</option>
                            <option value="electrocardiografia">📈 Electrocardiografía (assets/4-banco-clinico/electrocardiografia/)</option>
                            <option value="imagenologia">🩻 Imagenología / RX / TAC (assets/4-banco-clinico/imagenologia/)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            9. Candado del Plan *
                        </label>
                        <select id="mat-plan" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="Básico">🔓 Plan Básico ($0 - Abierto / Demo)</option>
                            <option value="PRO">💎 Makai PRO ($17.99 / $139.99)</option>
                            <option value="VIP">👑 Mentoría Élite VIP ($49.99)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            10. Visibilidad para Alumnos *
                        </label>
                        <select id="mat-visible" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="true" selected>🟢 Visible inmediatamente en Biblioteca 1D</option>
                            <option value="false">🙈 Oculto (Borrador / En preparación)</option>
                        </select>
                    </div>
                </div>

                <!-- FILA 4: ORIGEN DEL ARCHIVO HÍBRIDO + PROBADOR EN VIVO -->
                <div class="bg-surface border border-surface-high rounded-2xl p-4 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-primary text-base">folder_managed</span>
                                <span>11. Origen del Archivo (Ruta en <code class="text-primary font-mono">assets/</code>, URL Externa o Subida Directa desde tu PC)</span>
                            </span>
                            <p class="text-[11px] text-gray-400">
                                Verifica que la ruta exista con el botón de prueba o sube el archivo directamente desde tu computadora.
                            </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-primary/50 text-primary flex items-center gap-1.5">
                                <input type="radio" name="mat-source-mode" value="assets" checked class="accent-cyan-400" />
                                <span>📂 Ruta <code class="text-primary">assets/</code></span>
                            </label>
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-secondary/50 text-secondary flex items-center gap-1.5">
                                <input type="radio" name="mat-source-mode" value="url" class="accent-lime-400" />
                                <span>☁️ URL Cloud / Video</span>
                            </label>
                            <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container border border-warning/50 text-warning flex items-center gap-1.5">
                                <input type="radio" name="mat-source-mode" value="upload" class="accent-amber-400" />
                                <span>💻 Subir desde mi PC</span>
                            </label>
                        </div>
                    </div>

                    <!-- MODO 1: RUTA EN CARPETA ASSETS/ -->
                    <div id="mat-source-assets-box" class="space-y-2">
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-2">
                            <input type="text" id="mat-asset-prefix" readonly value="assets/5-multimedia-1d/guias-pdf/" class="md:col-span-5 bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-secondary font-mono" />
                            <input type="text" id="mat-asset-filename" placeholder="nombre-del-archivo.pdf (o pega la ruta completa)" class="md:col-span-5 bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                            <button type="button" id="btn-mat-test-resource" class="md:col-span-2 px-3 py-2 rounded-xl bg-surface-container border border-primary text-primary hover:bg-primary hover:text-surface text-xs font-extrabold transition-all">
                                🔍 Probar Ruta
                            </button>
                        </div>
                        <p class="text-[11px] text-gray-400 font-mono">
                            Ruta final generada: <strong id="mat-asset-preview" class="text-primary">assets/5-multimedia-1d/guias-pdf/guia-ejemplo.pdf</strong>
                        </p>
                    </div>

                    <!-- MODO 2: URL EXTERNA O FIREBASE STORAGE -->
                    <div id="mat-source-url-box" class="hidden space-y-2">
                        <div class="flex gap-2">
                            <input type="url" id="mat-external-url" placeholder="https://firebasestorage.googleapis.com/... o enlace directo al PDF / Micro-Video MP4/WebM" class="flex-1 bg-surface-container border border-surface-high rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-secondary focus:outline-none" />
                            <button type="button" id="btn-mat-test-url" class="px-3.5 py-2 rounded-xl bg-surface-container border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold transition-all">
                                🔍 Probar URL
                            </button>
                        </div>
                        <p class="text-[10px] text-gray-400">
                            Ideal para libros PDF pesados o Micro-Videos alojados en <code class="text-primary">makai-academy-f8039.firebasestorage.app</code>.
                        </p>
                    </div>

                    <!-- MODO 3: SUBIDA DIRECTA EN BASE64 DESDE TU PC -->
                    <div id="mat-source-upload-box" class="hidden space-y-1.5">
                        <input type="file" id="mat-file-upload" accept=".pdf,image/jpeg,image/png,image/webp" class="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-warning file:text-surface cursor-pointer" />
                        <p class="text-[10px] text-gray-400">
                            Comprime automáticamente Infografías / Mapas de 1 Hoja (JPG/PNG/WEBP) o adjunta resúmenes en PDF ($\le 750\text{ KB}$) directamente en Firestore y les asigna su ruta en <code class="text-primary">assets/</code>.
                        </p>
                    </div>

                    <!-- Caja de estado de verificación del recurso -->
                    <div id="mat-resource-verify-box" class="hidden bg-surface-container border border-surface-high rounded-xl p-3 text-xs font-mono flex items-center justify-between gap-3">
                        <span id="mat-resource-verify-status"></span>
                        <button type="button" id="btn-mat-open-test-tab" class="px-3 py-1 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-surface font-bold text-[11px]">
                            ↗ Abrir en Pestaña
                        </button>
                    </div>
                </div>

                <!-- FILA 5: RESUMEN CLÍNICO / PUNTOS DE ALTA RENTABILIDAD -->
                <div>
                    <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">
                        12. Resumen Clínico / Puntos Clave de Lectura 1D para el Estudiante
                    </label>
                    <textarea id="mat-description" rows="3" placeholder="Escribe los puntos de alta rentabilidad, criterios diagnósticos, escalas o dosis críticas que el alumno verá en el Visor 1D..." class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none leading-relaxed"></textarea>
                </div>

                <!-- BOTÓN DE GUARDADO -->
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="submit" id="btn-submit-material" class="px-6 py-3 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
                        <span class="material-symbols-outlined text-base">save</span>
                        <span id="btn-submit-material-text">Guardar Material en Cloud Firestore</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- IMPORTADOR MASIVO DE MATERIALES (.JSON) CON CANDADO DE RUTA FORZADA -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">data_object</span>
                        <span>Importación Masiva de Materiales y Guías por Lotes (.JSON) con Ruta Garantizada</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Con el candado inferior activo, todos los materiales del lote JSON se guardarán en el Ámbito, Carrera, Semestre y Materia seleccionados arriba.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <label class="cursor-pointer px-3 py-2 bg-surface border border-gray-600 hover:border-primary text-xs text-gray-200 rounded-xl font-mono flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-primary">folder_open</span>
                        <span>Cargar archivo .JSON</span>
                        <input type="file" id="mat-json-file-input" accept=".json,application/json" class="hidden" />
                    </label>
                    <button type="button" id="btn-mat-load-template" class="px-3 py-2 bg-surface border border-gray-700 hover:border-secondary text-xs text-secondary rounded-xl font-mono">
                        📋 Insertar Plantilla con Ruta Actual
                    </button>
                </div>
            </div>

            <div class="bg-surface border border-secondary/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <label class="flex items-center gap-2.5 text-xs text-white font-mono cursor-pointer">
                    <input type="checkbox" id="mat-batch-force-route" checked class="w-4 h-4 accent-lime-400" />
                    <span>
                        🎯 <strong>Forzar Ruta Actual del Formulario para todo este lote:</strong>
                        <span id="mat-batch-route-badge" class="text-secondary font-extrabold ml-1"></span>
                    </span>
                </label>
                <span class="text-[10px] font-mono text-gray-400">
                    Garantiza que ninguna guía PDF o video quede en otra carrera o semestre.
                </span>
            </div>

            <textarea id="mat-json-import" rows="4" placeholder='[\n  {\n    "titulo": "GPC Trastornos Hipertensivos del Embarazo MSP",\n    "codigo": "GPC-MSP-2026",\n    "categoria": "guias-pdf",\n    "planRequerido": "Básico",\n    "metaInfo": "42 págs.",\n    "recursoUrl": "assets/5-multimedia-1d/guias-pdf/gpc-preeclampsia.pdf",\n    "descripcion": "Criterios de severidad, Score MAMÁ, Clave Azul y esquema de Zuspan."\n  }\n]' class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-secondary focus:outline-none"></textarea>

            <div id="mat-batch-validation-box" class="hidden bg-surface border border-primary/40 rounded-xl p-3 text-xs font-mono text-gray-200"></div>

            <div class="flex flex-wrap justify-end gap-2.5">
                <button type="button" id="btn-mat-validate-json" class="px-4 py-2.5 bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">fact_check</span>
                    <span>1. Pre-validar Lote y Ruta</span>
                </button>
                <button type="button" id="btn-mat-import-json" class="px-5 py-2.5 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">cloud_upload</span>
                    <span>2. Importar Lote a Firestore</span>
                </button>
            </div>
        </div>

        <!-- CATÁLOGO DE MATERIALES EN CLOUD FIRESTORE + FILTROS + PAPELERA -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <h4 class="text-base font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">library_books</span>
                        <span>Catálogo de Materiales de Estudio en Cloud Firestore</span>
                    </h4>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Filtra por ámbito, carrera, semestre, categoría, visibilidad o plan. Cambia la visibilidad o el plan en 1 clic, o restaura desde la Papelera.
                    </p>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" id="btn-mat-tab-active" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5">
                        <span>📚 Biblioteca Activa</span>
                        <span id="badge-mat-active-count" class="px-1.5 py-0.5 rounded bg-black/20 text-[10px]">0</span>
                    </button>
                    <button type="button" id="btn-mat-tab-trash" class="px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5">
                        <span>🗑️ Papelera</span>
                        <span id="badge-mat-trash-count" class="px-1.5 py-0.5 rounded bg-danger/20 text-[10px]">0</span>
                    </button>
                </div>
            </div>

            <!-- BARRA DE FILTROS AVANZADOS (7 CRITERIOS) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface p-3.5 rounded-xl border border-surface-high">
                <div class="lg:col-span-2">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Buscar por Título, Código, Materia o Resumen</label>
                    <input type="search" id="filter-mat-search" placeholder="🔍 Ej: GPC, Preeclampsia, ECG, Farmacología..." class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none" />
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Ámbito Curricular</label>
                    <select id="filter-mat-scope" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos (CACES + Malla Univ.)</option>
                        <option value="caces">🎯 Solo Habilitación CACES</option>
                        <option value="carrera">🏛️ Solo Malla Universitaria</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Carrera</label>
                    <select id="filter-mat-career" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todas las Carreras</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Nivel / Semestre</label>
                    <select id="filter-mat-level" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos los Niveles / Semestres</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Categoría / Formato</label>
                    <select id="filter-mat-category" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todas las Categorías</option>
                        <option value="guias-pdf">📄 Guías Clínicas y PDFs</option>
                        <option value="infografias-y-algoritmos">🧠 Infografías y Algoritmos</option>
                        <option value="micro-videos-1d">🎬 Micro-Videos 1D</option>
                        <option value="atlas-visual">🔬 Atlas Visual</option>
                        <option value="electrocardiografia">📈 Electrocardiografía</option>
                        <option value="imagenologia">🩻 Imagenología</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Visibilidad para Usuarios</label>
                    <select id="filter-mat-visibility" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos (Visibles + Ocultos)</option>
                        <option value="visible">🟢 Solo Visibles</option>
                        <option value="hidden">🙈 Solo Ocultos / Borradores</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Candado del Plan</label>
                    <select id="filter-mat-plan" class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                        <option value="all">Todos los Planes</option>
                        <option value="Básico">🔓 Plan Básico</option>
                        <option value="PRO">💎 Makai PRO</option>
                        <option value="VIP">👑 Élite VIP</option>
                    </select>
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
                <span id="mat-filter-count-label">Mostrando 0 materiales</span>
                <button type="button" id="btn-mat-empty-trash" class="hidden px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px] transition-all">
                    🔥 Vaciar toda la Papelera definitivamente
                </button>
            </div>

            <!-- TABLA DEL CATÁLOGO DE MATERIALES -->
            <div class="overflow-x-auto rounded-xl border border-surface-high">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Título / Código / Resumen</th>
                            <th class="px-4 py-3">Ruta Curricular (Ámbito / Carrera / Semestre / Materia)</th>
                            <th class="px-4 py-3">Categoría / Ruta Archivo</th>
                            <th class="px-4 py-3">Visibilidad & Plan</th>
                            <th class="px-4 py-3 text-right">Acciones CRUD / Papelera</th>
                        </tr>
                    </thead>
                    <tbody id="admin-materials-tbody" class="divide-y divide-surface-high"></tbody>
                </table>
            </div>
        </div>
    `;

    populateCascadingMaterialCareers();
    populateMaterialFilterDropdowns();
    updateAssetPathPreview();
}

// ============================================================================
// 4. CASCADA CURRICULAR ESTRICTA POR SEMESTRE Y VERIFICADOR DE ARCHIVOS
// ============================================================================

function populateCascadingMaterialCareers(selectedCareer = null) {
    const scopeEl = document.getElementById("mat-scope");
    const careerEl = document.getElementById("mat-career");
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

    populateCascadingMaterialLevels();
}

function populateCascadingMaterialLevels(selectedLevel = null) {
    const scope = document.getElementById("mat-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("mat-career")?.value || "medicina";
    const levelEl = document.getElementById("mat-level");
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

    populateCascadingMaterialSubjects();
}

function populateCascadingMaterialSubjects(selectedSubject = null) {
    const scope = document.getElementById("mat-scope")?.value === "carrera" ? "carrera" : "caces";
    const careerId = document.getElementById("mat-career")?.value || "medicina";
    const levelId = document.getElementById("mat-level")?.value || "caces_oficial";
    const subjectEl = document.getElementById("mat-subject");
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

    updateMaterialLiveRouteBanner();
}

function updateMaterialLiveRouteBanner() {
    const scope = document.getElementById("mat-scope")?.value === "carrera" ? "Malla Universitaria" : "Habilitación CACES";
    const careerSelect = document.getElementById("mat-career");
    const levelSelect = document.getElementById("mat-level");
    const subjectSelect = document.getElementById("mat-subject");
    const categorySelect = document.getElementById("mat-category");
    const planSelect = document.getElementById("mat-plan");
    const visibleSelect = document.getElementById("mat-visible");

    const careerText = careerSelect?.options[careerSelect.selectedIndex]?.text || "---";
    const levelText = levelSelect?.options[levelSelect.selectedIndex]?.text || "---";
    const subjectText = subjectSelect?.value || "---";
    const catVal = categorySelect?.value || "guias-pdf";
    const planText = planSelect?.value || "Básico";
    const visText = visibleSelect?.value === "false" ? "Oculto" : "Visible";

    const routeSummary = `${scope} ➔ ${careerText} ➔ ${levelText} ➔ ${subjectText} [${catVal} • Plan ${planText} • ${visText}]`;

    const previewEl = document.getElementById("mat-route-preview-text");
    if (previewEl) previewEl.textContent = routeSummary;

    const batchRouteEl = document.getElementById("mat-batch-route-badge");
    if (batchRouteEl) batchRouteEl.textContent = `[${scope} > ${careerText} > ${levelText} > ${subjectText}]`;
}

function populateMaterialFilterDropdowns() {
    const filterCareer = document.getElementById("filter-mat-career");
    const filterLevel = document.getElementById("filter-mat-level");

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

function updateAssetPathPreview() {
    const categoryEl = document.getElementById("mat-category");
    const prefixEl = document.getElementById("mat-asset-prefix");
    const filenameEl = document.getElementById("mat-asset-filename");
    const previewEl = document.getElementById("mat-asset-preview");

    if (!categoryEl || !prefixEl || !filenameEl || !previewEl) return;

    const prefix = ASSET_SUBFOLDERS[categoryEl.value] || "assets/5-multimedia-1d/guias-pdf/";
    prefixEl.value = prefix;

    const rawVal = filenameEl.value.trim();
    const cleanFileName = rawVal
        ? rawVal.split("/").pop().replace(/\s+/g, "-")
        : "guia-ejemplo.pdf";

    previewEl.textContent = `${prefix}${cleanFileName}`;
    updateMaterialLiveRouteBanner();
}

/**
 * Prueba en tiempo real si el archivo en assets/ o la URL externa responde correctamente.
 */
async function testMaterialResourceAvailability(targetUrl) {
    const box = document.getElementById("mat-resource-verify-box");
    const statusEl = document.getElementById("mat-resource-verify-status");
    const openBtn = document.getElementById("btn-mat-open-test-tab");

    if (!box || !statusEl || !targetUrl) return;

    box.classList.remove("hidden");
    statusEl.className = "text-warning font-extrabold";
    statusEl.textContent = `⏳ Verificando disponibilidad de: ${targetUrl}...`;

    if (openBtn) {
        openBtn.onclick = () => window.open(targetUrl, "_blank");
    }

    if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(targetUrl)) {
        const probe = new Image();
        probe.onload = () => {
            statusEl.className = "text-secondary font-extrabold";
            statusEl.textContent = `✅ Imagen encontrada y verificada en: ${targetUrl}`;
        };
        probe.onerror = () => {
            statusEl.className = "text-danger font-extrabold";
            statusEl.textContent = `⚠️ Aún no se encuentra la imagen en "${targetUrl}". Súbela a esa carpeta de GitHub o usa 'Subir desde mi PC'.`;
        };
        probe.src = targetUrl;
        return;
    }

    try {
        const resp = await fetch(targetUrl, { method: "HEAD" });
        if (resp.ok) {
            statusEl.className = "text-secondary font-extrabold";
            statusEl.textContent = `✅ Recurso verificado correctamente (HTTP ${resp.status}): ${targetUrl}`;
        } else {
            statusEl.className = "text-danger font-extrabold";
            statusEl.textContent = `⚠️ El archivo aún no existe en "${targetUrl}" (HTTP ${resp.status}). Verifica el nombre o súbelo a esa carpeta.`;
        }
    } catch (e) {
        statusEl.className = "text-primary font-bold";
        statusEl.textContent = `ℹ️ Ruta asignada: ${targetUrl} (Pulsa 'Abrir en Pestaña' para comprobar la visualización).`;
    }
}

// ============================================================================
// 5. EVENTOS DEL MÓDULO
// ============================================================================

function bindMaterialsEvents() {
    document.getElementById("mat-scope")?.addEventListener("change", () => populateCascadingMaterialCareers());
    document.getElementById("mat-career")?.addEventListener("change", () => populateCascadingMaterialLevels());
    document.getElementById("mat-level")?.addEventListener("change", () => populateCascadingMaterialSubjects());
    document.getElementById("mat-subject")?.addEventListener("change", updateMaterialLiveRouteBanner);
    document.getElementById("mat-plan")?.addEventListener("change", updateMaterialLiveRouteBanner);
    document.getElementById("mat-visible")?.addEventListener("change", updateMaterialLiveRouteBanner);

    document.getElementById("mat-category")?.addEventListener("change", updateAssetPathPreview);
    document.getElementById("mat-asset-filename")?.addEventListener("input", updateAssetPathPreview);

    document.querySelectorAll('input[name="mat-source-mode"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const mode = getSelectedSourceMode();
            document.getElementById("mat-source-assets-box")?.classList.toggle("hidden", mode !== "assets");
            document.getElementById("mat-source-url-box")?.classList.toggle("hidden", mode !== "url");
            document.getElementById("mat-source-upload-box")?.classList.toggle("hidden", mode !== "upload");
            document.getElementById("mat-resource-verify-box")?.classList.add("hidden");
        });
    });

    document.getElementById("btn-mat-test-resource")?.addEventListener("click", () => {
        updateAssetPathPreview();
        const path = document.getElementById("mat-asset-preview")?.textContent || "";
        testMaterialResourceAvailability(path);
    });

    document.getElementById("btn-mat-test-url")?.addEventListener("click", () => {
        const url = document.getElementById("mat-external-url")?.value.trim() || "";
        if (!url) {
            alert("Ingresa primero una URL para probar.");
            return;
        }
        testMaterialResourceAvailability(url);
    });

    document.getElementById("admin-materials-form")?.addEventListener("submit", saveStudyMaterial);
    document.getElementById("btn-materials-cancel-edit")?.addEventListener("click", resetMaterialsForm);
    document.getElementById("btn-materials-refresh")?.addEventListener("click", loadStudyMaterials);
    document.getElementById("btn-materials-export-json")?.addEventListener("click", exportMaterialsCatalogJSON);

    // Importación masiva JSON
    document.getElementById("btn-mat-load-template")?.addEventListener("click", insertSampleMaterialsBatchJSON);
    document.getElementById("btn-mat-validate-json")?.addEventListener("click", () => validateMaterialsBatchJSON(true));
    document.getElementById("btn-mat-import-json")?.addEventListener("click", importMaterialsBatchJSON);

    document.getElementById("mat-json-file-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const textarea = document.getElementById("mat-json-import");
            if (textarea) textarea.value = String(ev.target?.result || "");
            validateMaterialsBatchJSON(true);
        };
        reader.readAsText(file, "UTF-8");
    });

    // Pestañas Biblioteca Activa vs Papelera
    document.getElementById("btn-mat-tab-active")?.addEventListener("click", () => switchMaterialsCatalogTab("active"));
    document.getElementById("btn-mat-tab-trash")?.addEventListener("click", () => switchMaterialsCatalogTab("trash"));
    document.getElementById("btn-mat-empty-trash")?.addEventListener("click", emptyMaterialsTrash);

    // Filtros en tiempo real
    [
        "filter-mat-search",
        "filter-mat-scope",
        "filter-mat-career",
        "filter-mat-level",
        "filter-mat-category",
        "filter-mat-visibility",
        "filter-mat-plan"
    ].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", renderMaterialsTable);
        el?.addEventListener("change", renderMaterialsTable);
    });
}

function getSelectedSourceMode() {
    const checked = document.querySelector('input[name="mat-source-mode"]:checked');
    return checked ? checked.value : "assets";
}

function switchMaterialsCatalogTab(tab) {
    activeCatalogTab = tab === "trash" ? "trash" : "active";
    const btnActive = document.getElementById("btn-mat-tab-active");
    const btnTrash = document.getElementById("btn-mat-tab-trash");
    const btnEmptyTrash = document.getElementById("btn-mat-empty-trash");

    if (activeCatalogTab === "active") {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-primary text-surface transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-danger/50 text-danger hover:bg-danger/15 transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.add("hidden");
    } else {
        btnActive.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-surface border border-primary/40 text-primary hover:bg-primary/15 transition-all flex items-center gap-1.5";
        btnTrash.className = "px-4 py-2 rounded-xl text-xs font-mono font-extrabold bg-danger text-white transition-all flex items-center gap-1.5";
        btnEmptyTrash?.classList.remove("hidden");
    }

    renderMaterialsTable();
}

// ============================================================================
// 6. LECTURA, FILTRADO Y RENDERIZADO CON VISIBILIDAD, PLAN Y PAPELERA
// ============================================================================

export async function loadStudyMaterials() {
    if (!verifyAdminAccess()) return;

    const tbody = document.getElementById("admin-materials-tbody");
    const iconRefresh = document.getElementById("icon-materials-refresh");
    iconRefresh?.classList.add("animate-spin");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-400 font-mono">
                    Sincronizando con Cloud Firestore (${MATERIALS_COLLECTION})...
                </td>
            </tr>
        `;
    }

    try {
        const snap = await getDocs(collection(db, MATERIALS_COLLECTION));
        materialsCache = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            materialsCache.push({
                id: docSnap.id,
                ...data,
                visible: data.visible !== false,
                enPapelera: data.enPapelera === true
            });
        });

        materialsCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        updateMaterialsCounters();
        renderMaterialsTable();
    } catch (err) {
        console.error("Error al cargar materiales_estudio:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-danger font-mono">
                        Error al consultar materiales_estudio: ${escapeHTML(err.message)}
                    </td>
                </tr>
            `;
        }
    } finally {
        iconRefresh?.classList.remove("animate-spin");
    }
}

function updateMaterialsCounters() {
    const activeCount = materialsCache.filter(m => !m.enPapelera).length;
    const trashCount = materialsCache.filter(m => m.enPapelera).length;

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
    };

    setEl("kpi-admin-materials-local", activeCount);
    setEl("kpi-admin-materials-trash", trashCount);
    setEl("kpi-admin-materials", activeCount);
    setEl("badge-mat-active-count", activeCount);
    setEl("badge-mat-trash-count", trashCount);
}

function getFilteredMaterials() {
    const searchQuery = (document.getElementById("filter-mat-search")?.value || "").toLowerCase().trim();
    const scopeFilter = document.getElementById("filter-mat-scope")?.value || "all";
    const careerFilter = document.getElementById("filter-mat-career")?.value || "all";
    const levelFilter = document.getElementById("filter-mat-level")?.value || "all";
    const categoryFilter = document.getElementById("filter-mat-category")?.value || "all";
    const visFilter = document.getElementById("filter-mat-visibility")?.value || "all";
    const planFilter = document.getElementById("filter-mat-plan")?.value || "all";

    return materialsCache.filter(item => {
        const isTrash = item.enPapelera === true;
        if (activeCatalogTab === "trash" && !isTrash) return false;
        if (activeCatalogTab === "active" && isTrash) return false;

        const itemScope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
        if (scopeFilter !== "all" && itemScope !== scopeFilter) return false;
        if (careerFilter !== "all" && item.carrera !== careerFilter) return false;
        if (levelFilter !== "all" && (item.nivel || "caces_oficial") !== levelFilter) return false;
        if (categoryFilter !== "all" && item.categoria !== categoryFilter) return false;

        const isVisible = item.visible !== false;
        if (visFilter === "visible" && !isVisible) return false;
        if (visFilter === "hidden" && isVisible) return false;

        if (planFilter !== "all" && (item.planRequerido || "Básico") !== planFilter) return false;

        if (searchQuery) {
            const haystack = `${item.titulo || ""} ${item.codigo || ""} ${item.materia || ""} ${item.descripcion || ""}`.toLowerCase();
            if (!haystack.includes(searchQuery)) return false;
        }

        return true;
    });
}

function renderMaterialsTable() {
    const tbody = document.getElementById("admin-materials-tbody");
    const countLabel = document.getElementById("mat-filter-count-label");
    if (!tbody) return;

    const filtered = getFilteredMaterials();
    if (countLabel) {
        countLabel.textContent = activeCatalogTab === "trash"
            ? `🗑️ Mostrando ${filtered.length} materiales en la Papelera de Reciclaje`
            : `📚 Mostrando ${filtered.length} materiales activos en este filtro`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500 font-mono">
                    ${
                        activeCatalogTab === "trash"
                            ? "La Papelera de Reciclaje de Materiales está vacía."
                            : "No se encontraron materiales que coincidan con los filtros seleccionados."
                    }
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    filtered.forEach(item => {
        const itemScope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
        const scopeBadge = itemScope === "caces"
            ? `<span class="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono font-bold">🎯 CACES</span>`
            : `<span class="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-mono font-bold">🏛️ MALLA</span>`;

        const isVisible = item.visible !== false;
        const plan = item.planRequerido || "Básico";

        const tr = document.createElement("tr");
        tr.className = `transition-colors ${!isVisible ? "bg-surface/40 opacity-75" : "hover:bg-surface/60"}`;

        tr.innerHTML = `
            <!-- 1. TÍTULO Y CÓDIGO -->
            <td class="px-4 py-3.5 align-top max-w-xs">
                <div class="text-white font-bold">${escapeHTML(item.titulo || "Sin título")}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">
                    Código: <span class="text-primary font-bold">${escapeHTML(item.codigo || "S/C")}</span>
                    ${item.metaInfo ? ` • ${escapeHTML(item.metaInfo)}` : ""}
                </div>
                ${
                    item.descripcion
                        ? `<p class="text-[11px] text-gray-400 font-sans line-clamp-2 mt-1">${escapeHTML(item.descripcion)}</p>`
                        : ""
                }
            </td>

            <!-- 2. RUTA CURRICULAR -->
            <td class="px-4 py-3.5 align-top">
                <div class="flex items-center gap-1.5 mb-1">
                    ${scopeBadge}
                    <span class="text-white font-extrabold uppercase text-[11px]">${escapeHTML(item.carrera || "medicina")}</span>
                </div>
                <div class="text-[11px] text-secondary font-bold">${escapeHTML(item.materia || "General")}</div>
                <div class="text-[10px] text-gray-400">Nivel: ${escapeHTML(item.nivel || "caces_oficial")}</div>
            </td>

            <!-- 3. CATEGORÍA Y RUTA DEL ARCHIVO -->
            <td class="px-4 py-3.5 align-top">
                <span class="px-2 py-0.5 rounded bg-surface-high text-primary border border-primary/30 text-[10px] uppercase font-bold">
                    ${escapeHTML(item.categoria || "guias-pdf")}
                </span>
                <div class="text-[10px] text-gray-400 truncate max-w-[220px] mt-1.5" title="${escapeHTML(item.recursoUrl || "")}">
                    ${item.archivoBase64 ? "📎 Subido directo en Firestore + Ruta" : escapeHTML(item.recursoUrl || "---")}
                </div>
            </td>

            <!-- 4. VISIBILIDAD Y PLAN EN 1 CLIC -->
            <td class="px-4 py-3.5 align-top space-y-1.5">
                <div>
                    <button type="button" class="btn-mat-toggle-vis px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold border transition-all ${
                        isVisible
                            ? "bg-secondary/15 text-secondary border-secondary/40 hover:bg-secondary/25"
                            : "bg-gray-800 text-gray-400 border-gray-600 hover:text-white"
                    }" title="Haz clic para mostrar u ocultar este material a los estudiantes">
                        ${isVisible ? "🟢 Visible Usuarios" : "🙈 Oculto (Borrador)"}
                    </button>
                </div>
                <div>
                    <select class="select-mat-inline-plan bg-surface border border-surface-high rounded-lg px-2 py-1 text-[10px] font-mono text-white focus:border-primary focus:outline-none">
                        <option value="Básico" ${plan === "Básico" ? "selected" : ""}>🔓 Plan Básico</option>
                        <option value="PRO" ${plan === "PRO" ? "selected" : ""}>💎 Plan PRO</option>
                        <option value="VIP" ${plan === "VIP" ? "selected" : ""}>👑 Plan VIP</option>
                    </select>
                </div>
            </td>

            <!-- 5. ACCIONES CRUD / PAPELERA -->
            <td class="px-4 py-3.5 align-top text-right space-x-1 whitespace-nowrap">
                <button type="button" class="btn-mat-preview px-2.5 py-1.5 rounded-lg bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-bold text-[11px]" title="Previsualizar recurso">
                    👁️ Ver
                </button>
                ${
                    activeCatalogTab === "active"
                        ? `
                            <button type="button" class="btn-mat-edit px-2.5 py-1.5 rounded-lg bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface font-bold text-[11px]" title="Editar material">
                                ✏️ Editar
                            </button>
                            <button type="button" class="btn-mat-trash px-2.5 py-1.5 rounded-lg bg-surface border border-danger text-danger hover:bg-danger hover:text-white font-bold text-[11px]" title="Enviar a la Papelera">
                                🗑️
                            </button>
                          `
                        : `
                            <button type="button" class="btn-mat-restore px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-secondary text-secondary hover:bg-secondary hover:text-surface font-extrabold text-[11px]" title="Restaurar a la Biblioteca Activa">
                                ♻️ Restaurar
                            </button>
                            <button type="button" class="btn-mat-delete-perm px-2.5 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger hover:bg-danger hover:text-white font-extrabold text-[11px]" title="Eliminar definitivamente de Firestore">
                                🔥 Borrar Definitivo
                            </button>
                          `
                }
            </td>
        `;

        tr.querySelector(".btn-mat-preview")?.addEventListener("click", () => previewMaterialResource(item));
        tr.querySelector(".btn-mat-toggle-vis")?.addEventListener("click", () => toggleStudyMaterialVisibility(item.id));
        tr.querySelector(".select-mat-inline-plan")?.addEventListener("change", (e) => updateStudyMaterialPlanInline(item.id, e.target.value));
        tr.querySelector(".btn-mat-edit")?.addEventListener("click", () => editStudyMaterial(item.id));
        tr.querySelector(".btn-mat-trash")?.addEventListener("click", () => moveStudyMaterialToTrash(item.id));
        tr.querySelector(".btn-mat-restore")?.addEventListener("click", () => restoreStudyMaterialFromTrash(item.id));
        tr.querySelector(".btn-mat-delete-perm")?.addEventListener("click", () => deleteStudyMaterial(item.id));

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 7. GUARDADO, EDICIÓN, VISIBILIDAD, PLAN Y PAPELERA (CRUD)
// ============================================================================

export async function saveStudyMaterial(e) {
    if (e) e.preventDefault();
    if (!verifyAdminAccess()) return;

    const submitBtn = document.getElementById("btn-submit-material");
    const submitText = document.getElementById("btn-submit-material-text");

    const ambito = document.getElementById("mat-scope")?.value || "caces";
    const carrera = document.getElementById("mat-career")?.value || "medicina";
    const nivel = document.getElementById("mat-level")?.value || "caces_oficial";
    const materia = document.getElementById("mat-subject")?.value || "General";

    const titulo = document.getElementById("mat-title")?.value.trim() || "";
    const codigo = document.getElementById("mat-code")?.value.trim() || "";
    const metaInfo = document.getElementById("mat-meta")?.value.trim() || "";
    const categoria = document.getElementById("mat-category")?.value || "guias-pdf";
    const planRequerido = document.getElementById("mat-plan")?.value || "Básico";
    const visible = document.getElementById("mat-visible")?.value !== "false";
    const descripcion = document.getElementById("mat-description")?.value.trim() || "";
    const sourceMode = getSelectedSourceMode();

    let recursoUrl = "";
    let archivoBase64 = null;
    let archivoTipo = null;

    try {
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = "Guardando en Firestore...";

        const prefix = ASSET_SUBFOLDERS[categoria] || "assets/5-multimedia-1d/guias-pdf/";

        if (sourceMode === "assets") {
            const rawFilename = document.getElementById("mat-asset-filename")?.value.trim() || "";
            if (!rawFilename) {
                throw new Error("Escribe el nombre del archivo ubicado en la subcarpeta de assets/.");
            }
            const cleanFilename = rawFilename.split("/").pop().replace(/\s+/g, "-");
            recursoUrl = `${prefix}${cleanFilename}`;
        } else if (sourceMode === "url") {
            recursoUrl = document.getElementById("mat-external-url")?.value.trim() || "";
            if (!recursoUrl) {
                throw new Error("Ingresa la URL externa o de Firebase Storage del recurso.");
            }
        } else if (sourceMode === "upload") {
            const fileInput = document.getElementById("mat-file-upload");
            const file = fileInput?.files?.[0];
            if (file) {
                archivoBase64 = await processMaterialFileToBase64(file);
                archivoTipo = file.type;
                const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
                recursoUrl = `${prefix}${safeName}`;
            } else if (editingMaterialId) {
                const existing = materialsCache.find(m => m.id === editingMaterialId);
                archivoBase64 = existing?.archivoBase64 || null;
                archivoTipo = existing?.archivoTipo || null;
                recursoUrl = existing?.recursoUrl || "";
            } else {
                throw new Error("Selecciona un archivo PDF (<=750 KB) o imagen para adjuntar desde tu PC.");
            }
        }

        const nowIso = new Date().toISOString();
        const adminEmail = auth?.currentUser?.email || appState?.currentUserData?.email || MASTER_ADMINS[0];

        const payload = {
            ambito,
            carrera,
            nivel,
            materia,
            titulo,
            codigo,
            categoria,
            planRequerido,
            visible,
            enPapelera: false,
            metaInfo,
            descripcion,
            origenTipo: sourceMode,
            recursoUrl,
            archivoBase64,
            archivoTipo,
            actualizadoPor: adminEmail,
            updatedAt: nowIso
        };

        if (editingMaterialId) {
            await setDoc(doc(db, MATERIALS_COLLECTION, editingMaterialId), payload, { merge: true });
            alert(`✅ Material actualizado en [${ambito.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        } else {
            payload.createdAt = nowIso;
            payload.creadoPor = adminEmail;
            await addDoc(collection(db, MATERIALS_COLLECTION), payload);
            alert(`✅ Nuevo material guardado en [${ambito.toUpperCase()} > ${carrera} > ${nivel} > ${materia}].`);
        }

        resetMaterialsForm();
        await loadStudyMaterials();
    } catch (err) {
        console.error("Error en saveStudyMaterial:", err);
        alert("⚠️ No se pudo guardar el material: " + err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) {
            submitText.textContent = editingMaterialId
                ? "Actualizar Material en Cloud Firestore"
                : "Guardar Material en Cloud Firestore";
        }
    }
}

export function editStudyMaterial(materialId) {
    if (!verifyAdminAccess()) return;

    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    editingMaterialId = item.id;

    const scope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
    const scopeEl = document.getElementById("mat-scope");
    if (scopeEl) scopeEl.value = scope;

    populateCascadingMaterialCareers(item.carrera || "medicina");
    populateCascadingMaterialLevels(item.nivel || (scope === "caces" ? "caces_oficial" : "semestre_1"));
    populateCascadingMaterialSubjects(item.materia || "General");

    document.getElementById("mat-title").value = item.titulo || "";
    document.getElementById("mat-code").value = item.codigo || "";
    document.getElementById("mat-meta").value = item.metaInfo || "";

    const categoryEl = document.getElementById("mat-category");
    if (categoryEl) {
        categoryEl.value = item.categoria || "guias-pdf";
    }

    document.getElementById("mat-plan").value = item.planRequerido || "Básico";
    document.getElementById("mat-visible").value = item.visible === false ? "false" : "true";
    document.getElementById("mat-description").value = item.descripcion || "";

    const mode = item.origenTipo || (item.archivoBase64 ? "upload" : (item.recursoUrl?.startsWith("http") ? "url" : "assets"));
    const radio = document.querySelector(`input[name="mat-source-mode"][value="${mode}"]`);
    if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change"));
    }

    if (mode === "assets") {
        const prefix = ASSET_SUBFOLDERS[item.categoria] || "";
        const filename = (item.recursoUrl || "").replace(prefix, "");
        document.getElementById("mat-asset-filename").value = filename;
        updateAssetPathPreview();
    } else if (mode === "url") {
        document.getElementById("mat-external-url").value = item.recursoUrl || "";
    }

    updateMaterialLiveRouteBanner();

    const modeBadge = document.getElementById("mat-form-mode-badge");
    if (modeBadge) {
        modeBadge.textContent = "✏️ MODO EDICIÓN";
        modeBadge.className = "px-2.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[11px] font-bold uppercase";
    }

    const formTitle = document.getElementById("materials-form-title");
    if (formTitle) {
        formTitle.textContent = `Editando: ${item.titulo}`;
    }

    document.getElementById("btn-materials-cancel-edit")?.classList.remove("hidden");
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) submitText.textContent = "Actualizar Material en Cloud Firestore";

    document.getElementById("admin-materials-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetMaterialsForm() {
    editingMaterialId = null;
    document.getElementById("admin-materials-form")?.reset();

    const defaultRadio = document.querySelector('input[name="mat-source-mode"][value="assets"]');
    if (defaultRadio) {
        defaultRadio.checked = true;
        defaultRadio.dispatchEvent(new Event("change"));
    }

    populateCascadingMaterialCareers();
    updateAssetPathPreview();
    document.getElementById("mat-resource-verify-box")?.classList.add("hidden");

    const modeBadge = document.getElementById("mat-form-mode-badge");
    if (modeBadge) {
        modeBadge.textContent = "➕ MODO CREACIÓN";
        modeBadge.className = "px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[11px] font-bold uppercase";
    }

    const formTitle = document.getElementById("materials-form-title");
    if (formTitle) {
        formTitle.textContent = "Registrar Nuevo Material, Ficha 1-Hoja, Guía PDF o Micro-Video 1D";
    }

    document.getElementById("btn-materials-cancel-edit")?.classList.add("hidden");
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) submitText.textContent = "Guardar Material en Cloud Firestore";
}

export async function toggleStudyMaterialVisibility(materialId) {
    if (!verifyAdminAccess()) return;
    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    const newVis = item.visible === false;
    try {
        await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
            visible: newVis,
            updatedAt: new Date().toISOString()
        });
        item.visible = newVis;
        renderMaterialsTable();
    } catch (err) {
        alert("Error al cambiar visibilidad: " + err.message);
    }
}

export async function updateStudyMaterialPlanInline(materialId, newPlan) {
    if (!verifyAdminAccess()) return;
    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    try {
        await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
            planRequerido: newPlan,
            updatedAt: new Date().toISOString()
        });
        item.planRequerido = newPlan;
    } catch (err) {
        alert("Error al actualizar el plan del material: " + err.message);
    }
}

export async function moveStudyMaterialToTrash(materialId) {
    if (!verifyAdminAccess()) return;
    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    try {
        await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
            enPapelera: true,
            visible: false,
            eliminadoEn: new Date().toISOString()
        });
        item.enPapelera = true;
        item.visible = false;
        updateMaterialsCounters();
        renderMaterialsTable();
    } catch (err) {
        alert("Error al mover a la papelera: " + err.message);
    }
}

export async function restoreStudyMaterialFromTrash(materialId) {
    if (!verifyAdminAccess()) return;
    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    try {
        await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
            enPapelera: false,
            visible: true,
            restauradoEn: new Date().toISOString()
        });
        item.enPapelera = false;
        item.visible = true;
        updateMaterialsCounters();
        renderMaterialsTable();
    } catch (err) {
        alert("Error al restaurar el material: " + err.message);
    }
}

export async function deleteStudyMaterial(materialId) {
    if (!verifyAdminAccess()) return;

    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    const confirmed = confirm(
        `🔥 ¿Confirmas ELIMINAR DEFINITIVAMENTE el material "${item.titulo}" (${item.materia}) de Cloud Firestore?\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, MATERIALS_COLLECTION, materialId));
        if (editingMaterialId === materialId) {
            resetMaterialsForm();
        }
        await loadStudyMaterials();
    } catch (err) {
        console.error("Error al eliminar material:", err);
        alert("Error al eliminar el documento: " + err.message);
    }
}

async function emptyMaterialsTrash() {
    if (!verifyAdminAccess()) return;
    const trashItems = materialsCache.filter(m => m.enPapelera);
    if (trashItems.length === 0) return;

    if (!confirm(`🔥 ¿Estás seguro de eliminar permanentemente los ${trashItems.length} materiales de la Papelera?`)) {
        return;
    }

    try {
        for (const item of trashItems) {
            await deleteDoc(doc(db, MATERIALS_COLLECTION, item.id));
        }
        await loadStudyMaterials();
    } catch (err) {
        alert("Error al vaciar la papelera: " + err.message);
    }
}

// ============================================================================
// 8. IMPORTACIÓN MASIVA (.JSON), PRE-VALIDADOR Y VISOR DE PREVISUALIZACIÓN
// ============================================================================

function insertSampleMaterialsBatchJSON() {
    const ambito = document.getElementById("mat-scope")?.value || "caces";
    const carrera = document.getElementById("mat-career")?.value || "medicina";
    const nivel = document.getElementById("mat-level")?.value || "caces_oficial";
    const materia = document.getElementById("mat-subject")?.value || "General";
    const categoria = document.getElementById("mat-category")?.value || "guias-pdf";
    const plan = document.getElementById("mat-plan")?.value || "Básico";
    const prefix = ASSET_SUBFOLDERS[categoria] || "assets/5-multimedia-1d/guias-pdf/";

    const sample = [
        {
            ambito,
            carrera,
            nivel,
            materia,
            titulo: `Guía Clínica & Mapa de Guardia: ${materia}`,
            codigo: "GPC-MSP-2026",
            categoria,
            planRequerido: plan,
            metaInfo: "18 págs. • Lectura 1D",
            recursoUrl: `${prefix}guia-clinica-ejemplo.pdf`,
            descripcion: "Algoritmo diagnóstico oficial, signos de alarma, criterios de hospitalización y tratamiento de primera línea."
        }
    ];

    const textarea = document.getElementById("mat-json-import");
    if (textarea) {
        textarea.value = JSON.stringify(sample, null, 2);
        validateMaterialsBatchJSON(true);
    }
}

function validateMaterialsBatchJSON(showBox = true) {
    const textarea = document.getElementById("mat-json-import");
    const box = document.getElementById("mat-batch-validation-box");
    const forceRoute = document.getElementById("mat-batch-force-route")?.checked;

    const formScope = document.getElementById("mat-scope")?.value || "caces";
    const formCareer = document.getElementById("mat-career")?.value || "medicina";
    const formLevel = document.getElementById("mat-level")?.value || "caces_oficial";
    const formSubject = document.getElementById("mat-subject")?.value || "General";
    const formCategory = document.getElementById("mat-category")?.value || "guias-pdf";
    const formPlan = document.getElementById("mat-plan")?.value || "Básico";

    const rawText = textarea?.value?.trim() || "";
    if (!rawText) {
        if (box) box.classList.add("hidden");
        return null;
    }

    try {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.materiales_estudio) ? parsed.materiales_estudio : null);

        if (!list || list.length === 0) {
            throw new Error("El formato debe ser un arreglo JSON ([ ... ]) con al menos un material.");
        }

        const normalizedList = [];
        for (const item of list) {
            if (!item.titulo) continue;
            const cat = item.categoria || formCategory;
            const prefix = ASSET_SUBFOLDERS[cat] || "assets/5-multimedia-1d/guias-pdf/";
            let url = String(item.recursoUrl || "").trim();
            if (url && !url.startsWith("http") && !url.startsWith("assets/") && !url.startsWith("data:")) {
                url = `${prefix}${url.replace(/\s+/g, "-")}`;
            }

            normalizedList.push({
                id: item.id || null,
                ambito: forceRoute ? formScope : (item.ambito || formScope),
                carrera: forceRoute ? formCareer : String(item.carrera || formCareer).toLowerCase().trim(),
                nivel: forceRoute ? formLevel : (item.nivel || formLevel),
                materia: forceRoute ? formSubject : (item.materia || formSubject),
                titulo: String(item.titulo).trim(),
                codigo: String(item.codigo || "").trim(),
                categoria: cat,
                planRequerido: forceRoute ? formPlan : (item.planRequerido || formPlan),
                visible: item.visible !== false,
                enPapelera: false,
                metaInfo: String(item.metaInfo || "").trim(),
                descripcion: String(item.descripcion || "").trim(),
                origenTipo: url.startsWith("http") ? "url" : "assets",
                recursoUrl: url,
                archivoBase64: item.archivoBase64 || null,
                archivoTipo: item.archivoTipo || null
            });
        }

        if (showBox && box) {
            box.classList.remove("hidden");
            box.innerHTML = `
                <div class="text-secondary font-extrabold">
                    ✅ Lote JSON Válido: ${normalizedList.length} materiales listos para importar.
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

export async function importMaterialsBatchJSON() {
    if (!verifyAdminAccess()) return;

    const validList = validateMaterialsBatchJSON(true);
    if (!validList || validList.length === 0) {
        alert("⚠️ Verifica el formato del lote JSON antes de importar.");
        return;
    }

    const textarea = document.getElementById("mat-json-import");
    const btn = document.getElementById("btn-mat-import-json");

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = `Subiendo ${validList.length} materiales...`;
        }

        let uploaded = 0;
        const nowIso = new Date().toISOString();
        const adminEmail = auth?.currentUser?.email || MASTER_ADMINS[0];

        for (const item of validList) {
            const { id, ...docPayload } = item;
            docPayload.actualizadoPor = adminEmail;
            docPayload.createdAt = nowIso;
            docPayload.updatedAt = nowIso;

            if (id) {
                await setDoc(doc(db, MATERIALS_COLLECTION, String(id)), docPayload, { merge: true });
            } else {
                await addDoc(collection(db, MATERIALS_COLLECTION), docPayload);
            }
            uploaded++;
        }

        alert(`✅ Importación completada: ${uploaded} materiales sincronizados en la ruta seleccionada.`);
        if (textarea) textarea.value = "";
        document.getElementById("mat-batch-validation-box")?.classList.add("hidden");
        await loadStudyMaterials();
    } catch (err) {
        console.error("Error en importMaterialsBatchJSON:", err);
        alert("Error al importar lote JSON: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-base">cloud_upload</span><span>2. Importar Lote a Firestore</span>';
        }
    }
}

export function exportMaterialsCatalogJSON() {
    if (!verifyAdminAccess()) return;

    const filtered = getFilteredMaterials();
    if (filtered.length === 0) {
        alert("No hay materiales en la vista actual para exportar.");
        return;
    }

    const exportPayload = {
        plataforma: "Makai Academy (Proyecto ALICIZATION)",
        modulo: "Bóveda Bibliográfica y Multimedia 1D",
        coleccion: MATERIALS_COLLECTION,
        fechaExportacion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
        totalMateriales: filtered.length,
        materiales_estudio: filtered
    };

    const dataStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `Catalogo_Materiales_Makai_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function previewMaterialResource(item) {
    if (!item) return;

    const targetSource = item.archivoBase64 || item.recursoUrl;
    if (!targetSource) {
        alert("Este registro no tiene un archivo o ruta asignada.");
        return;
    }

    const win = window.open("", "_blank");
    if (!win) {
        window.location.href = targetSource;
        return;
    }

    const isImage =
        item.archivoTipo?.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(targetSource);

    const isVideo =
        item.categoria === "micro-videos-1d" ||
        /\.(mp4|webm|ogg)$/i.test(targetSource);

    if (isImage) {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>${escapeHTML(item.titulo)} | Makai Academy</title></head>
            <body style="margin:0;background:#06090e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:monospace;">
                <div style="padding:14px;text-align:center;">
                    <strong>${escapeHTML(item.titulo)}</strong> (${escapeHTML(item.materia)} • Plan ${escapeHTML(item.planRequerido || "Básico")})
                </div>
                <img src="${targetSource}" style="max-width:95%;max-height:85vh;border:2px solid #00e5ff;border-radius:12px;" />
            </body>
            </html>
        `);
    } else if (isVideo) {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>${escapeHTML(item.titulo)} | Micro-Video 1D Makai</title></head>
            <body style="margin:0;background:#06090e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:monospace;">
                <div style="padding:14px;text-align:center;">
                    <strong>🎬 ${escapeHTML(item.titulo)}</strong> (${escapeHTML(item.materia)})
                </div>
                <video src="${targetSource}" controls autoplay style="max-width:92%;max-height:82vh;border:2px solid #94de2d;border-radius:12px;background:#000;"></video>
            </body>
            </html>
        `);
    } else {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>${escapeHTML(item.titulo)} | Visor PDF Makai Academy</title></head>
            <body style="margin:0;background:#06090e;overflow:hidden;">
                <iframe src="${targetSource}" style="width:100vw;height:100vh;border:none;"></iframe>
            </body>
            </html>
        `);
    }
}

function escapeHTML(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
