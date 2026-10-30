// ============================================================================
// ARCHIVO: js/1-admin/admin.materials.js
// DESCRIPCIÓN: Subcomponente Administrativo para Gestión de Guías Clínicas,
//              Libros PDF, Infografías, Algoritmos y Micro-Videos 1D en la
//              colección "materiales_estudio" y la bóveda "assets/".
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
    isMasterAdmin
} from "../2-core/state.store.js";

// Importación directa de deleteDoc desde el CDN oficial v13.0.0 para garantizar
// eliminación física en Firestore incluso si firebase.service.js no lo reexporta.
import {
    deleteDoc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Nombre seguro de la colección oficial en Firestore
const MATERIALS_COLLECTION = COLLECTIONS?.MATERIALS || "materiales_estudio";

// Estado local del módulo de materiales
let materialsCache = [];
let editingMaterialId = null;

// Catálogo curricular de respaldo (Preuniversitario + 11 Carreras de Salud + 4 Oficiales CACES)
const DEFAULT_CAREERS = [
    {
        id: "preuniversitario_salud",
        nombre: "Preuniversitario General de Salud",
        caces: false,
        materias: [
            "Biología Celular y Molecular",
            "Química General e Inorgánica",
            "Química Orgánica Aplicada a la Salud",
            "Anatomía y Fisiología Elemental",
            "Terminología Médica y Razonamiento Clínico"
        ]
    },
    {
        id: "medicina",
        nombre: "Medicina",
        caces: true,
        materias: [
            "Medicina Interna",
            "Pediatría",
            "Ginecología y Obstetricia",
            "Cirugía General",
            "Salud Pública y Bioética",
            "Salud Mental y Psiquiatría",
            "Anatomía y Fisiología",
            "Farmacología Clínica",
            "Semiología y Diagnóstico"
        ]
    },
    {
        id: "enfermeria",
        nombre: "Enfermería",
        caces: true,
        materias: [
            "Enfermería Clínico-Quirúrgica",
            "Enfermería Materno-Infantil",
            "Enfermería Comunitaria y Salud Pública",
            "Fundamentos de Enfermería",
            "Administración y Liderazgo en Enfermería",
            "Bioética y Seguridad del Paciente",
            "Farmacología en Enfermería"
        ]
    },
    {
        id: "odontologia",
        nombre: "Odontología",
        caces: true,
        materias: [
            "Patología Bucal y Maxilofacial",
            "Endodoncia y Periodoncia",
            "Cirugía Oral",
            "Odontopediatría y Ortodoncia",
            "Rehabilitación Oral y Operatoria",
            "Farmacología y Biomateriales",
            "Salud Pública Estomatológica"
        ]
    },
    {
        id: "obstetricia",
        nombre: "Obstetricia",
        caces: true,
        materias: [
            "Obstetricia Fisiológica y Alto Riesgo",
            "Ginecología y Salud Sexual",
            "Neonatología e Inmunizaciones",
            "Salud Pública y Epidemiología Materna",
            "Farmacología Obstétrica",
            "Bioética y Normativa MSP"
        ]
    },
    {
        id: "nutricion",
        nombre: "Nutrición y Dietética",
        caces: false,
        materias: ["Nutrición Clínica", "Dietoterapia", "Bioquímica Nutricional", "Salud Pública y Bromatología"]
    },
    {
        id: "fisioterapia",
        nombre: "Fisioterapia y Rehabilitación",
        caces: false,
        materias: ["Biomecánica", "Kinesiología", "Rehabilitación Neurológica", "Terapia Cardiorrespiratoria"]
    },
    {
        id: "laboratorio_clinico",
        nombre: "Laboratorio Clínico",
        caces: false,
        materias: ["Hematología", "Microbiología y Parasitología", "Bioquímica Clínica", "Inmunología"]
    },
    {
        id: "imagenologia",
        nombre: "Imagenología y Radiología",
        caces: false,
        materias: ["Radiología Convencional", "Tomografía y Resonancia", "Ecografía Diagnóstica", "Protección Radiológica"]
    },
    {
        id: "psicologia_clinica",
        nombre: "Psicología Clínica",
        caces: false,
        materias: ["Psicopatología", "Psicoterapia", "Evaluación Psicológica", "Neuropsicología"]
    },
    {
        id: "bioquimica_farmacia",
        nombre: "Bioquímica y Farmacia",
        caces: false,
        materias: ["Farmacología y Toxicología", "Química Farmacéutica", "Farmacia Hospitalaria", "Análisis Clínico"]
    },
    {
        id: "atencion_prehospitalaria",
        nombre: "Atención Prehospitalaria y Emergencias",
        caces: false,
        materias: ["Soporte Vital Avanzado (ACLS/PHTLS)", "Trauma Prehospitalario", "Emergencias Clínicas", "Desastres y Triaje"]
    }
];

const ACADEMIC_LEVELS = [
    { id: "caces_oficial", label: "Preparación CACES Oficial" },
    { id: "preuniversitario", label: "Preuniversitario" },
    { id: "nivelacion", label: "Nivelación General" },
    { id: "semestre_1_3", label: "Ciencias Básicas (1° a 3° Semestre)" },
    { id: "semestre_4_6", label: "Ciencias Preclínicas (4° a 6° Semestre)" },
    { id: "semestre_7_10", label: "Ciencias Clínicas (7° a 10° Semestre)" },
    { id: "internado_rotativo", label: "Internado Rotativo" }
];

const ASSET_SUBFOLDERS = {
    "guias-pdf": "assets/5-multimedia-1d/guias-pdf/",
    "infografias-y-algoritmos": "assets/5-multimedia-1d/infografias-y-algoritmos/",
    "micro-videos-1d": "assets/5-multimedia-1d/micro-videos-1d/",
    "atlas-visual": "assets/4-banco-clinico/atlas-visual/",
    "electrocardiografia": "assets/4-banco-clinico/electrocardiografia/",
    "imagenologia": "assets/4-banco-clinico/imagenologia/"
};

// ============================================================================
// 1. VALIDACIÓN DE SEGURIDAD Y UTILIDADES INTERNAS
// ============================================================================

/**
 * Verifica que el usuario activo pertenezca a las cuentas maestras autorizadas.
 * @returns {boolean}
 */
function verifyAdminAccess() {
    const activeEmail =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";

    if (!isMasterAdmin(activeEmail)) {
        alert("⛔ Acceso denegado: Función exclusiva para Administradores Maestros de Makai Academy.");
        return false;
    }
    return true;
}

/**
 * Obtiene la lista unificada de carreras combinando window.makaiData y el catálogo completo.
 */
function getCareersList() {
    const externalCareers = window.makaiData?.carreras || [];
    const mergedMap = new Map();

    DEFAULT_CAREERS.forEach(c => mergedMap.set(c.id, { ...c }));
    externalCareers.forEach(ext => {
        if (mergedMap.has(ext.id)) {
            const existing = mergedMap.get(ext.id);
            const combinedMaterias = Array.from(new Set([...(ext.materias || []), ...(existing.materias || [])]));
            mergedMap.set(ext.id, { ...existing, ...ext, materias: combinedMaterias });
        } else {
            mergedMap.set(ext.id, ext);
        }
    });

    return Array.from(mergedMap.values());
}

/**
 * Procesa archivos ligeros (PDF <= 750 KB o Imágenes JPG/PNG/WEBP comprimidas) a Base64.
 * @param {File} file
 * @returns {Promise<string>}
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
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.82));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    throw new Error("Formato de archivo directo no soportado. Usa PDF, JPG, PNG o enlaza mediante URL/Ruta Assets.");
}

// ============================================================================
// 2. INICIALIZADOR PRINCIPAL DEL MÓDULO (INVOCADO POR ADMIN.CONTROLLER.JS)
// ============================================================================

/**
 * Inicializa la sección de Materiales de Estudio y PDFs dentro de #view-admin.
 */
export async function initAdminMaterials() {
    const activeEmail =
        auth.currentUser?.email ||
        appState.currentUser?.email ||
        appState.currentUserData?.email ||
        "";

    if (!isMasterAdmin(activeEmail)) return;

    renderMaterialsSectionUI();
    populateCareerAndSubjectSelectors();
    bindMaterialsEvents();
    await loadStudyMaterials();
}

/**
 * Construye e inyecta el contenedor #admin-materials-section en #view-admin.
 */
function renderMaterialsSectionUI() {
    const adminView = document.getElementById("view-admin");
    if (!adminView || document.getElementById("admin-materials-section")) return;

    const section = document.createElement("section");
    section.id = "admin-materials-section";
    section.className = "mb-10 space-y-6";

    section.innerHTML = `
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 shadow-xl">
            <!-- CABECERA DEL GESTOR DE MATERIALES Y PDFS -->
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        Subcomponente 5 • Bóveda Bibliográfica y Multimedia 1D
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                        <span class="material-symbols-outlined text-primary">picture_as_pdf</span>
                        Gestor de Materiales de Estudio, Guías Clínicas (GPC) y PDFs
                    </h3>
                    <p class="text-xs text-gray-400 mt-0.5">
                        Sincronizado con la colección <code class="text-primary font-mono">materiales_estudio</code> y la carpeta <code class="text-secondary font-mono">assets/5-multimedia-1d/</code>
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2.5">
                    <button type="button" id="btn-materials-refresh" class="px-3.5 py-2 bg-surface border border-primary/50 text-primary hover:bg-primary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm" id="icon-materials-refresh">refresh</span>
                        <span>Actualizar Biblioteca</span>
                    </button>
                    <button type="button" id="btn-materials-export-json" class="px-3.5 py-2 bg-surface border border-secondary/50 text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Catálogo (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- REJILLA PRINCIPAL: FORMULARIO CRUD + IMPORTACIÓN POR LOTES -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- COLUMNA IZQUIERDA (2/3): FORMULARIO DE ALTA Y EDICIÓN DE MATERIAL -->
                <form id="admin-materials-form" class="lg:col-span-2 bg-surface border border-surface-high rounded-2xl p-5 space-y-4">
                    <div class="flex items-center justify-between border-b border-surface-high pb-3">
                        <h4 id="materials-form-title" class="text-sm font-extrabold text-white flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-base">upload_file</span>
                            <span>Registrar Nuevo Material o Guía Clínica</span>
                        </h4>
                        <button type="button" id="btn-materials-cancel-edit" class="hidden px-3 py-1 rounded-lg bg-danger/20 border border-danger text-danger text-xs font-bold hover:bg-danger hover:text-white transition-all">
                            Cancelar Edición
                        </button>
                    </div>

                    <!-- FILA 1: TÍTULO Y CÓDIGO NORMATIVO -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="sm:col-span-2">
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Título del Material / Guía Clínica *</label>
                            <input type="text" id="mat-title" required placeholder="Ej: GPC Trastornos Hipertensivos del Embarazo (MSP)" class="w-full bg-surface-container border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Código / Edición</label>
                            <input type="text" id="mat-code" placeholder="Ej: GPC-MSP-2026" class="w-full bg-surface-container border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                        </div>
                    </div>

                    <!-- FILA 2: CARRERA, NIVEL/SEMESTRE Y MATERIA -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Carrera *</label>
                            <select id="mat-career" required class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Nivel / Semestre *</label>
                            <select id="mat-level" required class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Materia / Asignatura *</label>
                            <select id="mat-subject" required class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                        </div>
                    </div>

                    <!-- FILA 3: TIPO DE RECURSO (CARPETA ASSETS), PLAN REQUERIDO Y PÁGINAS/DURACIÓN -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Categoría / Subcarpeta Assets *</label>
                            <select id="mat-category" required class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                                <option value="guias-pdf">📄 Guía Clínica / Libro PDF (guias-pdf)</option>
                                <option value="infografias-y-algoritmos">🧠 Infografía / Algoritmo (infografias-y-algoritmos)</option>
                                <option value="micro-videos-1d">🎬 Micro-Video 1D (micro-videos-1d)</option>
                                <option value="atlas-visual">🔬 Atlas Visual Clínico (atlas-visual)</option>
                                <option value="electrocardiografia">📈 Electrocardiografía (electrocardiografia)</option>
                                <option value="imagenologia">🩻 Imagenología / RX / TAC (imagenologia)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Plan Requerido (Candado) *</label>
                            <select id="mat-plan" required class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                                <option value="Básico">🔓 Plan Básico ($0 - Abierto)</option>
                                <option value="PRO">⚡ Makai PRO CACES ($18.60 / $144.75)</option>
                                <option value="VIP">👑 Mentoría Élite VIP ($45.99)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Páginas o Duración</label>
                            <input type="text" id="mat-meta" placeholder="Ej: 48 págs. | 12 min" class="w-full bg-surface-container border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                        </div>
                    </div>

                    <!-- FILA 4: ORIGEN DEL ARCHIVO (RUTA REPOSITORIO ASSETS, URL NUBE O SUBIDA DIRECTA) -->
                    <div class="bg-surface-container border border-surface-high rounded-xl p-4 space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-[11px] font-mono text-primary uppercase font-bold">
                                Origen de Almacenamiento Híbrido (GitHub Assets / Firebase Storage / Base64)
                            </span>
                            <div class="flex items-center gap-2 text-[11px] font-mono">
                                <label class="flex items-center gap-1 cursor-pointer text-gray-300">
                                    <input type="radio" name="mat-source-mode" value="assets" checked class="accent-primary" />
                                    <span>Ruta <code class="text-primary">assets/</code></span>
                                </label>
                                <label class="flex items-center gap-1 cursor-pointer text-gray-300">
                                    <input type="radio" name="mat-source-mode" value="url" class="accent-primary" />
                                    <span>URL Externa / Cloud</span>
                                </label>
                                <label class="flex items-center gap-1 cursor-pointer text-gray-300">
                                    <input type="radio" name="mat-source-mode" value="upload" class="accent-primary" />
                                    <span>Adjuntar Archivo (&le;750KB)</span>
                                </label>
                            </div>
                        </div>

                        <!-- MODO 1: RUTA EN CARPETA ASSETS/ -->
                        <div id="mat-source-assets-box" class="space-y-1.5">
                            <div class="flex flex-col sm:flex-row gap-2">
                                <input type="text" id="mat-asset-prefix" readonly value="assets/5-multimedia-1d/guias-pdf/" class="sm:w-1/2 bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-secondary font-mono" />
                                <input type="text" id="mat-asset-filename" placeholder="nombre-del-archivo.pdf (sin espacios)" class="sm:w-1/2 bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                            </div>
                            <p class="text-[10px] text-gray-400 font-mono">
                                Ruta generada: <strong id="mat-asset-preview" class="text-primary">assets/5-multimedia-1d/guias-pdf/guia-ejemplo.pdf</strong>
                            </p>
                        </div>

                        <!-- MODO 2: URL EXTERNA O FIREBASE STORAGE -->
                        <div id="mat-source-url-box" class="hidden space-y-1">
                            <input type="url" id="mat-external-url" placeholder="https://firebasestorage.googleapis.com/... o enlace directo al PDF/Video" class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                            <p class="text-[10px] text-gray-400">
                                Ideal para libros pesados o videos alojados en <code class="text-primary">makai-academy-f8039.firebasestorage.app</code> o servidores externos.
                            </p>
                        </div>

                        <!-- MODO 3: SUBIDA DIRECTA EN BASE64 (RESÚMENES O INFOGRAFÍAS LIGERAS) -->
                        <div id="mat-source-upload-box" class="hidden space-y-1">
                            <input type="file" id="mat-file-upload" accept=".pdf,image/jpeg,image/png,image/webp" class="w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-surface hover:file:bg-opacity-90" />
                            <p class="text-[10px] text-gray-400">
                                Comprime automáticamente imágenes clínicas/infografías o adjunta resúmenes en PDF de hasta 750 KB directamente en Firestore.
                            </p>
                        </div>
                    </div>

                    <!-- FILA 5: RESUMEN CLÍNICO / PUNTOS CLAVE CACES -->
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Resumen Clínico / Perlas para el Estudiante</label>
                        <textarea id="mat-description" rows="3" placeholder="Describe los puntos clave de esta guía clínica, dosis críticas o algoritmos que el estudiante debe dominar..." class="w-full bg-surface-container border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>

                    <!-- BOTÓN DE GUARDADO -->
                    <div class="flex items-center justify-end gap-3 pt-2">
                        <button type="submit" id="btn-submit-material" class="px-5 py-2.5 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.25)]">
                            <span class="material-symbols-outlined text-base">save</span>
                            <span id="btn-submit-material-text">Guardar Material en Firestore</span>
                        </button>
                    </div>
                </form>

                <!-- COLUMNA DERECHA (1/3): IMPORTACIÓN MASIVA JSON Y GUÍA DE CARPETAS -->
                <div class="bg-surface border border-surface-high rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <div class="space-y-3">
                        <h4 class="text-sm font-extrabold text-white flex items-center gap-2 border-b border-surface-high pb-3">
                            <span class="material-symbols-outlined text-secondary text-base">data_object</span>
                            <span>Importación Masiva de Materiales (.JSON)</span>
                        </h4>
                        <p class="text-xs text-gray-400">
                            Pega un arreglo JSON para registrar múltiples guías clínicas, algoritmos o enlaces PDF en un solo lote hacia <code class="text-primary font-mono">materiales_estudio</code>.
                        </p>
                        <textarea id="mat-json-import" rows="8" placeholder='[\n  {\n    "titulo": "GPC Sepsis Neonatal MSP",\n    "codigo": "GPC-MSP-2025",\n    "carrera": "medicina",\n    "nivel": "caces_oficial",\n    "materia": "Pediatría",\n    "categoria": "guias-pdf",\n    "planRequerido": "Básico",\n    "recursoUrl": "assets/5-multimedia-1d/guias-pdf/gpc-sepsis-neonatal.pdf",\n    "descripcion": "Criterios diagnósticos y antibioticoterapia empírica."\n  }\n]' class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-[11px] font-mono text-gray-200 focus:border-secondary focus:outline-none"></textarea>

                        <button type="button" id="btn-mat-import-json" class="w-full py-2.5 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-base">cloud_upload</span>
                            <span>Importar Lote a Firestore</span>
                        </button>
                    </div>

                    <!-- RECORDATORIO DE RUTAS OFICIALES EN ASSETS/ -->
                    <div class="bg-surface-container border border-surface-high rounded-xl p-3.5 text-[11px] font-mono space-y-1.5">
                        <div class="text-primary font-bold uppercase">📂 Mapa de Bóveda 1D (GitHub):</div>
                        <div class="text-gray-400">• <span class="text-gray-200">assets/5-multimedia-1d/guias-pdf/</span></div>
                        <div class="text-gray-400">• <span class="text-gray-200">assets/5-multimedia-1d/infografias-y-algoritmos/</span></div>
                        <div class="text-gray-400">• <span class="text-gray-200">assets/5-multimedia-1d/micro-videos-1d/</span></div>
                        <div class="text-gray-400">• <span class="text-gray-200">assets/4-banco-clinico/</span></div>
                    </div>
                </div>
            </div>

            <!-- BARRA DE FILTROS Y BÚSQUEDA DEL CATÁLOGO -->
            <div class="mt-8 pt-6 border-t border-surface-high flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select id="filter-mat-career" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-200 focus:border-primary focus:outline-none">
                        <option value="all">Todas las Carreras</option>
                    </select>
                    <select id="filter-mat-category" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-200 focus:border-primary focus:outline-none">
                        <option value="all">Todas las Categorías</option>
                        <option value="guias-pdf">Guías Clínicas y PDFs</option>
                        <option value="infografias-y-algoritmos">Infografías y Algoritmos</option>
                        <option value="micro-videos-1d">Micro-Videos 1D</option>
                        <option value="atlas-visual">Atlas Visual</option>
                        <option value="electrocardiografia">Electrocardiografía</option>
                        <option value="imagenologia">Imagenología</option>
                    </select>
                    <select id="filter-mat-plan" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-gray-200 focus:border-primary focus:outline-none">
                        <option value="all">Todos los Planes</option>
                        <option value="Básico">Plan Básico</option>
                        <option value="PRO">Plan PRO</option>
                        <option value="VIP">Plan VIP</option>
                    </select>
                </div>

                <div class="relative flex-1 min-w-[220px] max-w-xs">
                    <input type="search" id="filter-mat-search" placeholder="Buscar por título, materia o código..." class="w-full bg-surface border border-surface-high rounded-xl pl-3.5 pr-8 py-2 text-xs text-white focus:border-primary focus:outline-none" />
                </div>
            </div>

            <!-- TABLA DEL CATÁLOGO DE MATERIALES EN FIRESTORE -->
            <div class="overflow-x-auto mt-4">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Título / Código</th>
                            <th class="px-4 py-3">Carrera / Nivel / Materia</th>
                            <th class="px-4 py-3">Categoría / Origen</th>
                            <th class="px-4 py-3">Acceso</th>
                            <th class="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="admin-materials-tbody">
                        <tr>
                            <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                                Cargando catálogo de materiales_estudio...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    adminView.appendChild(section);
}

// ============================================================================
// 3. POBLADO DINÁMICO DE CARRERAS, NIVELES, MATERIAS Y RUTAS ASSETS
// ============================================================================

/**
 * Rellena los selectores de carrera, nivel académico y materias vinculadas.
 */
function populateCareerAndSubjectSelectors() {
    const careerSelect = document.getElementById("mat-career");
    const levelSelect = document.getElementById("mat-level");
    const subjectSelect = document.getElementById("mat-subject");
    const filterCareerSelect = document.getElementById("filter-mat-career");

    if (!careerSelect || !levelSelect || !subjectSelect) return;

    const careers = getCareersList();

    careerSelect.innerHTML = "";
    if (filterCareerSelect) {
        filterCareerSelect.innerHTML = '<option value="all">Todas las Carreras</option>';
    }

    careers.forEach(career => {
        const badge = career.caces ? " (CACES + Carrera)" : " (Carrera)";
        const opt = document.createElement("option");
        opt.value = career.id;
        opt.textContent = `${career.nombre}${badge}`;
        careerSelect.appendChild(opt);

        if (filterCareerSelect) {
            const filterOpt = document.createElement("option");
            filterOpt.value = career.id;
            filterOpt.textContent = career.nombre;
            filterCareerSelect.appendChild(filterOpt);
        }
    });

    levelSelect.innerHTML = "";
    ACADEMIC_LEVELS.forEach(lvl => {
        const opt = document.createElement("option");
        opt.value = lvl.id;
        opt.textContent = lvl.label;
        levelSelect.appendChild(opt);
    });

    const updateSubjects = () => {
        const selectedCareer = careers.find(c => c.id === careerSelect.value) || careers[0];
        subjectSelect.innerHTML = "";
        (selectedCareer?.materias || ["General"]).forEach(materia => {
            const opt = document.createElement("option");
            opt.value = materia;
            opt.textContent = materia;
            subjectSelect.appendChild(opt);
        });
    };

    careerSelect.addEventListener("change", updateSubjects);
    updateSubjects();
}

/**
 * Actualiza el prefijo de la carpeta assets/ según la categoría elegida.
 */
function updateAssetPathPreview() {
    const categoryEl = document.getElementById("mat-category");
    const prefixEl = document.getElementById("mat-asset-prefix");
    const filenameEl = document.getElementById("mat-asset-filename");
    const previewEl = document.getElementById("mat-asset-preview");

    if (!categoryEl || !prefixEl || !filenameEl || !previewEl) return;

    const prefix = ASSET_SUBFOLDERS[categoryEl.value] || "assets/5-multimedia-1d/guias-pdf/";
    prefixEl.value = prefix;

    const cleanName = (filenameEl.value || "guia-ejemplo.pdf")
        .trim()
        .replace(/\s+/g, "-");

    previewEl.textContent = `${prefix}${cleanName}`;
}

// ============================================================================
// 4. ENLACE DE EVENTOS DEL SUBCOMPONENTE
// ============================================================================

/**
 * Conecta los eventos del formulario, selectores de origen, filtros y botones.
 */
function bindMaterialsEvents() {
    const form = document.getElementById("admin-materials-form");
    const categoryEl = document.getElementById("mat-category");
    const filenameEl = document.getElementById("mat-asset-filename");
    const cancelEditBtn = document.getElementById("btn-materials-cancel-edit");
    const refreshBtn = document.getElementById("btn-materials-refresh");
    const exportBtn = document.getElementById("btn-materials-export-json");
    const importBtn = document.getElementById("btn-mat-import-json");

    if (form && !form.dataset.bound) {
        form.dataset.bound = "1";
        form.addEventListener("submit", saveStudyMaterial);
    }

    categoryEl?.addEventListener("change", updateAssetPathPreview);
    filenameEl?.addEventListener("input", updateAssetPathPreview);

    // Alternar modo de origen (Assets / URL / Subida directa)
    const modeRadios = document.querySelectorAll('input[name="mat-source-mode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            const mode = getSelectedSourceMode();
            document.getElementById("mat-source-assets-box")?.classList.toggle("hidden", mode !== "assets");
            document.getElementById("mat-source-url-box")?.classList.toggle("hidden", mode !== "url");
            document.getElementById("mat-source-upload-box")?.classList.toggle("hidden", mode !== "upload");
        });
    });

    cancelEditBtn?.addEventListener("click", resetMaterialsForm);
    refreshBtn?.addEventListener("click", loadStudyMaterials);
    exportBtn?.addEventListener("click", exportMaterialsCatalogJSON);
    importBtn?.addEventListener("click", importMaterialsBatchJSON);

    // Filtros en tiempo real
    ["filter-mat-career", "filter-mat-category", "filter-mat-plan", "filter-mat-search"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", renderMaterialsTable);
        el?.addEventListener("change", renderMaterialsTable);
    });
}

/**
 * Obtiene el modo de almacenamiento seleccionado en el formulario.
 * @returns {"assets" | "url" | "upload"}
 */
function getSelectedSourceMode() {
    const checked = document.querySelector('input[name="mat-source-mode"]:checked');
    return checked ? checked.value : "assets";
}

// ============================================================================
// 5. LECTURA Y RENDERIZADO DE MATERIALES DESDE CLOUD FIRESTORE
// ============================================================================

/**
 * Consulta la colección "materiales_estudio" en Firestore y actualiza la tabla y el KPI.
 */
export async function loadStudyMaterials() {
    if (!verifyAdminAccess()) return;

    const tbody = document.getElementById("admin-materials-tbody");
    const iconRefresh = document.getElementById("icon-materials-refresh");
    iconRefresh?.classList.add("animate-spin");

    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">Sincronizando con Firestore (materiales_estudio)...</td></tr>';
    }

    try {
        const snap = await getDocs(collection(db, MATERIALS_COLLECTION));
        materialsCache = [];

        snap.forEach(docSnap => {
            materialsCache.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        materialsCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Actualizar el KPI en la cabecera de admin.controller.js si está visible
        const kpiEl = document.getElementById("kpi-admin-materials");
        if (kpiEl) {
            kpiEl.textContent = String(materialsCache.length);
        }

        renderMaterialsTable();
    } catch (err) {
        console.error("Error al cargar materiales_estudio:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-danger">Error al consultar materiales_estudio: ${err.message}</td></tr>`;
        }
    } finally {
        iconRefresh?.classList.remove("animate-spin");
    }
}

/**
 * Filtra y dibuja las filas en la tabla #admin-materials-tbody.
 */
function renderMaterialsTable() {
    const tbody = document.getElementById("admin-materials-tbody");
    if (!tbody) return;

    const careerFilter = document.getElementById("filter-mat-career")?.value || "all";
    const categoryFilter = document.getElementById("filter-mat-category")?.value || "all";
    const planFilter = document.getElementById("filter-mat-plan")?.value || "all";
    const searchQuery = (document.getElementById("filter-mat-search")?.value || "").toLowerCase().trim();

    const filtered = materialsCache.filter(item => {
        if (careerFilter !== "all" && item.carrera !== careerFilter) return false;
        if (categoryFilter !== "all" && item.categoria !== categoryFilter) return false;
        if (planFilter !== "all" && (item.planRequerido || "Básico") !== planFilter) return false;

        if (searchQuery) {
            const haystack = `${item.titulo || ""} ${item.codigo || ""} ${item.materia || ""} ${item.descripcion || ""}`.toLowerCase();
            if (!haystack.includes(searchQuery)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                    No se encontraron materiales que coincidan con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    const careersMap = new Map(getCareersList().map(c => [c.id, c.nombre]));
    const levelsMap = new Map(ACADEMIC_LEVELS.map(l => [l.id, l.label]));

    tbody.innerHTML = "";

    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high hover:bg-surface/60 transition-colors";

        const planBadgeClass =
            item.planRequerido === "VIP"
                ? "bg-warning/20 text-warning border border-warning/40"
                : item.planRequerido === "PRO"
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-secondary/20 text-secondary border border-secondary/40";

        const careerName = careersMap.get(item.carrera) || item.carrera || "General";
        const levelName = levelsMap.get(item.nivel) || item.nivel || "CACES";

        tr.innerHTML = `
            <td class="px-4 py-3">
                <div class="text-white font-bold">${item.titulo || "Sin título"}</div>
                <div class="text-[10px] text-gray-400">
                    Código: <span class="text-primary">${item.codigo || "S/C"}</span>
                    ${item.metaInfo ? ` • ${item.metaInfo}` : ""}
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="text-white font-bold">${careerName}</div>
                <div class="text-[11px] text-secondary">${item.materia || "General"}</div>
                <div class="text-[10px] text-gray-400">${levelName}</div>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded bg-surface-high text-gray-200 text-[10px] uppercase">${item.categoria || "guias-pdf"}</span>
                <div class="text-[10px] text-gray-400 truncate max-w-[210px] mt-1" title="${item.recursoUrl || "Archivo Base64"}">
                    ${item.archivoBase64 ? "📎 Archivo directo en Firestore" : (item.recursoUrl || "---")}
                </div>
            </td>
            <td class="px-4 py-3">
                <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${planBadgeClass}">
                    ${item.planRequerido || "Básico"}
                </span>
            </td>
            <td class="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                <button type="button" class="btn-mat-preview px-2.5 py-1.5 rounded-lg bg-surface border border-primary text-primary hover:bg-primary hover:text-surface font-bold text-[11px]" title="Previsualizar recurso">
                    👁️ Ver
                </button>
                <button type="button" class="btn-mat-edit px-2.5 py-1.5 rounded-lg bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface font-bold text-[11px]" title="Editar material">
                    ✏️ Editar
                </button>
                <button type="button" class="btn-mat-delete px-2.5 py-1.5 rounded-lg bg-surface border border-danger text-danger hover:bg-danger hover:text-white font-bold text-[11px]" title="Eliminar de Firestore">
                    🗑️
                </button>
            </td>
        `;

        tr.querySelector(".btn-mat-preview")?.addEventListener("click", () => previewMaterialResource(item));
        tr.querySelector(".btn-mat-edit")?.addEventListener("click", () => editStudyMaterial(item.id));
        tr.querySelector(".btn-mat-delete")?.addEventListener("click", () => deleteStudyMaterial(item.id));

        tbody.appendChild(tr);
    });
}

// ============================================================================
// 6. GUARDADO, EDICIÓN Y ELIMINACIÓN (CRUD EN MATERIALES_ESTUDIO)
// ============================================================================

/**
 * Crea o actualiza un documento dentro de la colección "materiales_estudio".
 * @param {SubmitEvent} e
 */
export async function saveStudyMaterial(e) {
    e.preventDefault();
    if (!verifyAdminAccess()) return;

    const submitBtn = document.getElementById("btn-submit-material");
    const submitText = document.getElementById("btn-submit-material-text");

    const titulo = document.getElementById("mat-title")?.value.trim() || "";
    const codigo = document.getElementById("mat-code")?.value.trim() || "";
    const carrera = document.getElementById("mat-career")?.value || "medicina";
    const nivel = document.getElementById("mat-level")?.value || "caces_oficial";
    const materia = document.getElementById("mat-subject")?.value || "General";
    const categoria = document.getElementById("mat-category")?.value || "guias-pdf";
    const planRequerido = document.getElementById("mat-plan")?.value || "Básico";
    const metaInfo = document.getElementById("mat-meta")?.value.trim() || "";
    const descripcion = document.getElementById("mat-description")?.value.trim() || "";
    const sourceMode = getSelectedSourceMode();

    let recursoUrl = "";
    let archivoBase64 = null;
    let archivoTipo = null;

    try {
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = "Guardando en Firestore...";

        if (sourceMode === "assets") {
            const prefix = ASSET_SUBFOLDERS[categoria] || "assets/5-multimedia-1d/guias-pdf/";
            const filename = document.getElementById("mat-asset-filename")?.value.trim().replace(/\s+/g, "-") || "";
            if (!filename) {
                throw new Error("Escribe el nombre del archivo ubicado en la subcarpeta de assets/.");
            }
            recursoUrl = `${prefix}${filename}`;
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
                recursoUrl = `firestore-base64://${file.name}`;
            } else if (editingMaterialId) {
                const existing = materialsCache.find(m => m.id === editingMaterialId);
                archivoBase64 = existing?.archivoBase64 || null;
                archivoTipo = existing?.archivoTipo || null;
                recursoUrl = existing?.recursoUrl || "";
            } else {
                throw new Error("Selecciona un archivo PDF (<=750 KB) o imagen para adjuntar.");
            }
        }

        const payload = {
            titulo,
            codigo,
            carrera,
            nivel,
            materia,
            categoria,
            planRequerido,
            metaInfo,
            descripcion,
            origenTipo: sourceMode,
            recursoUrl,
            archivoBase64,
            archivoTipo,
            actualizadoPor: auth.currentUser?.email || appState.currentUserData?.email || "admin",
            updatedAt: new Date().toISOString()
        };

        if (editingMaterialId) {
            await updateDoc(doc(db, MATERIALS_COLLECTION, editingMaterialId), payload);
            alert("✅ Material actualizado correctamente en Firestore.");
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(collection(db, MATERIALS_COLLECTION), payload);
            alert("✅ Nuevo material registrado exitosamente en materiales_estudio.");
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
                ? "Actualizar Material en Firestore"
                : "Guardar Material en Firestore";
        }
    }
}

/**
 * Carga los datos de un material existente en el formulario para su edición.
 * @param {string} materialId
 */
export function editStudyMaterial(materialId) {
    if (!verifyAdminAccess()) return;

    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    editingMaterialId = item.id;

    document.getElementById("mat-title").value = item.titulo || "";
    document.getElementById("mat-code").value = item.codigo || "";

    const careerEl = document.getElementById("mat-career");
    if (careerEl) {
        careerEl.value = item.carrera || "medicina";
        careerEl.dispatchEvent(new Event("change"));
    }

    document.getElementById("mat-level").value = item.nivel || "caces_oficial";
    document.getElementById("mat-subject").value = item.materia || "General";

    const categoryEl = document.getElementById("mat-category");
    if (categoryEl) {
        categoryEl.value = item.categoria || "guias-pdf";
        categoryEl.dispatchEvent(new Event("change"));
    }

    document.getElementById("mat-plan").value = item.planRequerido || "Básico";
    document.getElementById("mat-meta").value = item.metaInfo || "";
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

    const formTitle = document.getElementById("materials-form-title");
    if (formTitle) {
        formTitle.innerHTML = `<span class="material-symbols-outlined text-warning text-base">edit_document</span><span class="text-warning">Editando: ${item.titulo}</span>`;
    }

    document.getElementById("btn-materials-cancel-edit")?.classList.remove("hidden");
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) submitText.textContent = "Actualizar Material en Firestore";

    document.getElementById("admin-materials-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Restaura el formulario a su estado inicial de creación.
 */
function resetMaterialsForm() {
    editingMaterialId = null;
    const form = document.getElementById("admin-materials-form");
    form?.reset();

    const defaultRadio = document.querySelector('input[name="mat-source-mode"][value="assets"]');
    if (defaultRadio) {
        defaultRadio.checked = true;
        defaultRadio.dispatchEvent(new Event("change"));
    }

    document.getElementById("mat-career")?.dispatchEvent(new Event("change"));
    updateAssetPathPreview();

    const formTitle = document.getElementById("materials-form-title");
    if (formTitle) {
        formTitle.innerHTML = `<span class="material-symbols-outlined text-primary text-base">upload_file</span><span>Registrar Nuevo Material o Guía Clínica</span>`;
    }

    document.getElementById("btn-materials-cancel-edit")?.classList.add("hidden");
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) submitText.textContent = "Guardar Material en Firestore";
}

/**
 * Elimina un documento de la colección "materiales_estudio" en Cloud Firestore.
 * @param {string} materialId
 */
export async function deleteStudyMaterial(materialId) {
    if (!verifyAdminAccess()) return;

    const item = materialsCache.find(m => m.id === materialId);
    if (!item) return;

    const confirmed = confirm(
        `¿Confirmas eliminar permanentemente el material "${item.titulo}" (${item.materia}) de Cloud Firestore?`
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

// ============================================================================
// 7. IMPORTACIÓN MASIVA (.JSON), EXPORTACIÓN Y VISOR DE PREVISUALIZACIÓN
// ============================================================================

/**
 * Importa un arreglo JSON de materiales directamente hacia "materiales_estudio".
 */
export async function importMaterialsBatchJSON() {
    if (!verifyAdminAccess()) return;

    const textarea = document.getElementById("mat-json-import");
    const btn = document.getElementById("btn-mat-import-json");
    const rawText = textarea?.value.trim() || "";

    if (!rawText) {
        alert("⚠️ Pega un arreglo JSON válido antes de importar.");
        return;
    }

    try {
        const parsed = JSON.parse(rawText);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error("El formato debe ser un arreglo JSON ([ ... ]) con al menos un material.");
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Subiendo lote a Firestore...";
        }

        let uploaded = 0;
        const nowIso = new Date().toISOString();

        for (const item of parsed) {
            if (!item.titulo) continue;

            const docPayload = {
                titulo: item.titulo,
                codigo: item.codigo || "",
                carrera: item.carrera || "medicina",
                nivel: item.nivel || "caces_oficial",
                materia: item.materia || "General",
                categoria: item.categoria || "guias-pdf",
                planRequerido: item.planRequerido || "Básico",
                metaInfo: item.metaInfo || "",
                descripcion: item.descripcion || "",
                origenTipo: item.recursoUrl?.startsWith("http") ? "url" : "assets",
                recursoUrl: item.recursoUrl || "",
                archivoBase64: item.archivoBase64 || null,
                archivoTipo: item.archivoTipo || null,
                actualizadoPor: auth.currentUser?.email || "admin",
                createdAt: item.createdAt || nowIso,
                updatedAt: nowIso
            };

            if (item.id) {
                await setDoc(doc(db, MATERIALS_COLLECTION, String(item.id)), docPayload, { merge: true });
            } else {
                await addDoc(collection(db, MATERIALS_COLLECTION), docPayload);
            }
            uploaded++;
        }

        alert(`✅ Importación completada: ${uploaded} materiales sincronizados en Firestore.`);
        if (textarea) textarea.value = "";
        await loadStudyMaterials();

    } catch (err) {
        console.error("Error en importMaterialsBatchJSON:", err);
        alert("Error al importar lote JSON: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-base">cloud_upload</span><span>Importar Lote a Firestore</span>';
        }
    }
}

/**
 * Descarga el catálogo actual de "materiales_estudio" en un archivo .JSON.
 */
export function exportMaterialsCatalogJSON() {
    if (!verifyAdminAccess()) return;

    const dataStr = JSON.stringify(materialsCache, null, 2);
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

/**
 * Abre una ventana de inspección para visualizar el PDF, imagen o recurso enlazado.
 * @param {object} item
 */
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

    if (isImage) {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><title>${item.titulo} | Makai Academy</title></head>
            <body style="margin:0;background:#06090e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:monospace;">
                <div style="padding:14px;text-align:center;">
                    <strong>${item.titulo}</strong> (${item.materia} • Plan ${item.planRequerido || "Básico"})
                </div>
                <img src="${targetSource}" style="max-width:95%;max-height:85vh;border:2px solid #00e5ff;border-radius:12px;" />
            </body>
            </html>
        `);
    } else {
        win.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><title>${item.titulo} | Visor PDF Makai Academy</title></head>
            <body style="margin:0;background:#06090e;overflow:hidden;">
                <iframe src="${targetSource}" style="width:100vw;height:100vh;border:none;"></iframe>
            </body>
            </html>
        `);
    }
}
