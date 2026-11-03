// ============================================================================
// ARCHIVO: src/data/careersConfig.ts
// DESCRIPCIÓN: Catálogo alfabético de carreras de salud, niveles académicos
//              dinámicos según normativa y extensiones telefónicas por país.
// ============================================================================

export interface CareerOption {
  id: string;
  nombre: string;
  categoria: "licenciatura_12" | "licenciatura_10" | "licenciatura_8" | "tecnologia_5" | "tecnologia_enf" | "auxiliar" | "preuniversitario";
  duracionDescripcion: string;
  niveles: string[];
}

const RAW_CAREERS: CareerOption[] = [
  {
    id: "atencion_prehospitalaria",
    nombre: "Atención Prehospitalaria",
    categoria: "tecnologia_5",
    duracionDescripcion: "Tecnología Superior • Nivelación + 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "auxiliar_enfermeria",
    nombre: "Auxiliar de Enfermería",
    categoria: "auxiliar",
    duracionDescripcion: "Curso Técnico (6 a 12 meses) • Módulos Teórico-Prácticos",
    niveles: [
      "Módulo 1: Fundamentos de Enfermería y Bioseguridad (Meses 1 - 2)",
      "Módulo 2: Anatomía Elemental, Signos Vitales y Primeros Auxilios (Meses 3 - 4)",
      "Módulo 3: Cuidados Básicos Hospitalarios y Farmacología Elemental (Meses 5 - 6)",
      "Módulo 4: Práctica Clínica Tutelada I (Meses 7 - 9)",
      "Módulo 5: Práctica Clínica Integral y Certificación Final (Meses 10 - 12)"
    ]
  },
  {
    id: "bioquimica_farmacia",
    nombre: "Bioquímica y Farmacia",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Internado / Prácticas Preprofesionales)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Internado Rotativo / Prácticas I)",
      "10° Nivel (Internado Rotativo / Titulación II)"
    ]
  },
  {
    id: "enfermeria",
    nombre: "Enfermería (Licenciatura)",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Internado Rotativo en los 2 últimos)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Internado Rotativo I)",
      "10° Nivel (Internado Rotativo II)"
    ]
  },
  {
    id: "enfermeria_tecnologia",
    nombre: "Enfermería (Tecnología Superior)",
    categoria: "tecnologia_enf",
    duracionDescripcion: "Nivelación Académica + 4 a 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre • Prácticas)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "estimulacion_temprana",
    nombre: "Estimulación Temprana",
    categoria: "tecnologia_5",
    duracionDescripcion: "Tecnología Superior • Nivelación + 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "fisioterapia",
    nombre: "Fisioterapia",
    categoria: "licenciatura_8",
    duracionDescripcion: "Nivelación Académica + 8 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre • Titulación)"
    ]
  },
  {
    id: "fonoaudiologia",
    nombre: "Fonoaudiología",
    categoria: "licenciatura_8",
    duracionDescripcion: "Nivelación Académica + 8 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre • Titulación)"
    ]
  },
  {
    id: "imagenologia_radiologia",
    nombre: "Imagenología y Radiología",
    categoria: "tecnologia_5",
    duracionDescripcion: "Tecnología Superior • Nivelación + 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "laboratorio_clinico",
    nombre: "Laboratorio Clínico",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Internado Rotativo en los 2 últimos)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Internado Rotativo I)",
      "10° Nivel (Internado Rotativo II)"
    ]
  },
  {
    id: "medicina_humana",
    nombre: "Medicina Humana",
    categoria: "licenciatura_12",
    duracionDescripcion: "Nivelación Académica + 12 niveles (incluye Internado Rotativo en 11° y 12° nivel)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (9no Semestre)",
      "10° Nivel (10mo Semestre)",
      "11° Nivel (Internado Rotativo I)",
      "12° Nivel (Internado Rotativo II)"
    ]
  },
  {
    id: "nutricion_dietetica",
    nombre: "Nutrición y Dietética",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Internado Rotativo en los 2 últimos)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Internado Rotativo I)",
      "10° Nivel (Internado Rotativo II)"
    ]
  },
  {
    id: "obstetricia",
    nombre: "Obstetricia",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Internado Rotativo en los 2 últimos)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Internado Rotativo I)",
      "10° Nivel (Internado Rotativo II)"
    ]
  },
  {
    id: "odontologia",
    nombre: "Odontología",
    categoria: "licenciatura_10",
    duracionDescripcion: "Nivelación Académica + 9 a 10 niveles (incluye Clínica Integral / Internado en los últimos niveles)",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre)",
      "9° Nivel (Clínica Integral / Internado I)",
      "10° Nivel (Clínica Integral / Internado II)"
    ]
  },
  {
    id: "optometria",
    nombre: "Optometría",
    categoria: "licenciatura_8",
    duracionDescripcion: "Nivelación Académica + 8 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre • Titulación)"
    ]
  },
  {
    id: "podologia",
    nombre: "Podología",
    categoria: "tecnologia_5",
    duracionDescripcion: "Tecnología Superior • Nivelación + 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "preuniversitario_salud",
    nombre: "Preuniversitario en Salud",
    categoria: "preuniversitario",
    duracionDescripcion: "Preparación de Admisión y Nivelación para Ciencias de la Salud",
    niveles: [
      "Módulo Inicial: Biología, Química y Anatomía Base",
      "Módulo Intensivo: Razonamiento y Admisión Universitaria",
      "Nivelación General Pre-Carrera"
    ]
  },
  {
    id: "promocion_vigilancia_salud",
    nombre: "Promoción y Vigilancia de la Salud",
    categoria: "tecnologia_5",
    duracionDescripcion: "Tecnología Superior • Nivelación + 5 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre • Titulación)"
    ]
  },
  {
    id: "psicologia_clinica",
    nombre: "Psicología Clínica",
    categoria: "licenciatura_8",
    duracionDescripcion: "Nivelación Académica + 8 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre • Titulación)"
    ]
  },
  {
    id: "terapia_ocupacional",
    nombre: "Terapia Ocupacional",
    categoria: "licenciatura_8",
    duracionDescripcion: "Nivelación Académica + 8 niveles",
    niveles: [
      "Nivelación Académica",
      "1° Nivel (1er Semestre)",
      "2° Nivel (2do Semestre)",
      "3° Nivel (3er Semestre)",
      "4° Nivel (4to Semestre)",
      "5° Nivel (5to Semestre)",
      "6° Nivel (6to Semestre)",
      "7° Nivel (7mo Semestre)",
      "8° Nivel (8vo Semestre • Titulación)"
    ]
  }
];

// Orden estricto de A a Z según locale español
export const CAREERS_ALPHABETICAL: CareerOption[] = [...RAW_CAREERS].sort((a, b) =>
  a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
);

export interface CountryDialCode {
  code: string;
  country: string;
  dial: string;
  placeholder: string;
}

export const COUNTRY_PHONE_CODES: CountryDialCode[] = [
  { code: "EC", country: "Ecuador", dial: "+593", placeholder: "99 123 4567" },
  { code: "CO", country: "Colombia", dial: "+57", placeholder: "300 123 4567" },
  { code: "PE", country: "Perú", dial: "+51", placeholder: "912 345 678" },
  { code: "MX", country: "México", dial: "+52", placeholder: "55 1234 5678" },
  { code: "CL", country: "Chile", dial: "+56", placeholder: "9 1234 5678" },
  { code: "AR", country: "Argentina", dial: "+54", placeholder: "9 11 1234 5678" },
  { code: "BO", country: "Bolivia", dial: "+591", placeholder: "71234567" },
  { code: "VE", country: "Venezuela", dial: "+58", placeholder: "412 1234567" },
  { code: "ES", country: "España", dial: "+34", placeholder: "612 34 56 78" },
  { code: "US", country: "Estados Unidos", dial: "+1", placeholder: "202 555 0143" },
  { code: "BR", country: "Brasil", dial: "+55", placeholder: "11 91234 5678" },
  { code: "PA", country: "Panamá", dial: "+507", placeholder: "6123 4567" },
  { code: "CR", country: "Costa Rica", dial: "+506", placeholder: "8312 3456" },
  { code: "DO", country: "República Dominicana", dial: "+1-809", placeholder: "809 234 5678" },
  { code: "GT", country: "Guatemala", dial: "+502", placeholder: "5123 4567" },
  { code: "PY", country: "Paraguay", dial: "+595", placeholder: "981 123456" },
  { code: "UY", country: "Uruguay", dial: "+598", placeholder: "94 123 456" }
];
