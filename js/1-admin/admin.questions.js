// ============================================================================
// ARCHIVO: js/1-admin/admin.questions.js
// DESCRIPCIÓN: Subcomponente de Reactivos (CRUD e Importación Masiva JSON
//              para las 4 carreras CACES y las 11 carreras de Salud por nivel).
// PROYECTO: Makai Academy (Proyecto ALICIZATION) - makai-academy-f8039
// ============================================================================

import {
    db,
    auth,
    collection,
    getDocs,
    addDoc,
    doc,
    getDoc,
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

// Nombre oficial de la colección de reactivos en Cloud Firestore
const QUESTIONS_COLLECTION = COLLECTIONS?.QUESTIONS || "preguntas_caces";

// Catálogo curricular dual: 4 Carreras CACES + 11 Carreras de Salud y Niveles
const CURRICULUM_CATALOG = {
    cacesCareers: [
        {
            id: "medicina",
            nombre: "Medicina (Habilitación CACES)",
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
            materias: [
                "Obstetricia Fisiológica y Alto Riesgo",
                "Ginecología y Salud Sexual",
                "Neonatología y Perinatología",
                "Salud Pública y Epidemiología",
                "Farmacología Obstétrica"
            ]
        }
    ],
    healthCareers11: [
        { id: "preuniversitario_salud", nombre: "0. Preuniversitario General de Salud (Admisión)" },
        { id: "medicina", nombre: "1. Medicina Humana" },
        { id: "enfermeria", nombre: "2. Enfermería" },
        { id: "odontologia", nombre: "3. Odontología" },
        { id: "obstetricia", nombre: "4. Obstetricia" },
        { id: "nutricion", nombre: "5. Nutrición y Dietética" },
        { id: "fisioterapia", nombre: "6. Fisioterapia y Rehabilitación" },
        { id: "laboratorio_clinico", nombre: "7. Laboratorio Clínico" },
        { id: "imagenologia", nombre: "8. Imagenología y Radiología" },
        { id: "psicologia_clinica", nombre: "9. Psicología Clínica" },
        { id: "bioquimica_farmacia", nombre: "10. Bioquímica y Farmacia" },
        { id: "atencion_prehospitalaria", nombre: "11. Emergencias Médicas / APH" }
    ],
    academicLevels: [
        { id: "caces_oficial", nombre: "Examen Oficial CACES" },
        { id: "preuniversitario", nombre: "Preuniversitario General de Salud" },
        { id: "nivelacion", nombre: "Nivelación Académica (Semestre 0)" },
        { id: "semestre_1", nombre: "1er Semestre (Ciencias Básicas)" },
        { id: "semestre_2", nombre: "2do Semestre (Morfofunción)" },
        { id: "semestre_3", nombre: "3er Semestre (Fisiopatología / Farmacología)" },
        { id: "semestre_4", nombre: "4to Semestre (Semiología / Diagnóstico)" },
        { id: "semestre_5", nombre: "5to Semestre (Clínicas I)" },
        { id: "semestre_6", nombre: "6to Semestre (Clínicas II)" },
        { id: "semestre_7", nombre: "7mo Semestre (Quirúrgicas / Especialidades)" },
        { id: "semestre_8", nombre: "8vo Semestre (Materno-Infantil / Pediatría)" },
        { id: "semestre_9", nombre: "9no Semestre (Salud Pública / Gestión)" },
        { id: "semestre_10", nombre: "10mo Semestre (Integración Clínica)" },
        { id: "internado_rotativo", nombre: "Internado Rotativo" },
        { id: "titulacion_complexivo", nombre: "Examen Complexivo (Graduación)" }
    ],
    preuniversitarioSubjects: [
        "Biología Celular y Molecular",
        "Química General e Inorgánica",
        "Química Orgánica Aplicada a la Salud",
        "Anatomía y Fisiología Elemental",
        "Terminología Médica y Razonamiento Clínico"
    ],
    universalSubjects: [
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
    ]
};
// Estado interno del módulo de reactivos
let questionsCache = [];
let editingQuestionId = null;
let questionsModuleInitialized = false;

/**
 * Comprueba si el usuario autenticado pertenece a las cuentas maestras autorizadas.
 * @returns {boolean}
 */
function hasMasterPermission() {
    const activeEmail = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(activeEmail);
}

/**
 * Obtiene el catálogo de carreras combinando window.makaiData (si existe) con el catálogo oficial.
 * @param {string} scope - "caces" | "carrera"
 * @returns {Array}
 */
function getCareersByScope(scope = "caces") {
    if (scope === "carrera") {
        return CURRICULUM_CATALOG.healthCareers11;
    }
    if (window.makaiData?.carreras && Array.isArray(window.makaiData.carreras)) {
        return window.makaiData.carreras;
    }
    return CURRICULUM_CATALOG.cacesCareers;
}

/**
 * Obtiene la lista de materias para una carrera y modalidad determinadas.
 * @param {string} careerId
 * @param {string} scope
 * @returns {Array<string>}
 */
function getSubjectsForCareer(careerId, scope = "caces") {
    if (careerId === "preuniversitario_salud") {
        return CURRICULUM_CATALOG.preuniversitarioSubjects;
    }

    const cacesMatch = (window.makaiData?.carreras || CURRICULUM_CATALOG.cacesCareers)
        .find(c => c.id === careerId);

    if (scope === "caces" && cacesMatch?.materias?.length) {
        return cacesMatch.materias;
    }

    if (cacesMatch?.materias?.length) {
        return [...new Set([...CURRICULUM_CATALOG.preuniversitarioSubjects, ...cacesMatch.materias, ...CURRICULUM_CATALOG.universalSubjects])];
    }

    return [...new Set([...CURRICULUM_CATALOG.preuniversitarioSubjects, ...CURRICULUM_CATALOG.universalSubjects])];
}

/**
 * Punto de entrada principal del módulo de preguntas.
 * Es invocado automáticamente por js/1-admin/admin.controller.js.
 */
export async function initAdminQuestions() {
    if (!hasMasterPermission()) {
        console.warn("[AdminQuestions] Acceso denegado: Se requiere cuenta maestra autorizada.");
        return;
    }

    renderAdminQuestionsSection();
    bindLegacyAdminFormIfPresent();

    if (!questionsModuleInitialized) {
        bindAdminQuestionsEvents();
        questionsModuleInitialized = true;
    }

    await loadQuestionsBank();
}

/**
 * Construye e inyecta la interfaz completa de gestión de reactivos (#admin-questions-section)
 * dentro de #view-admin sin romper formularios previos del HTML.
 */
function renderAdminQuestionsSection() {
    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    // Si ya existe el contenedor modular, no duplicarlo
    if (document.getElementById("admin-questions-section")) return;

    const section = document.createElement("section");
    section.id = "admin-questions-section";
    section.dataset.adminSection = "reactivos";
    section.className = "mb-10 space-y-6";

    section.innerHTML = `
        <!-- CABECERA Y ESTADÍSTICAS DEL BANCO DE REACTIVOS -->
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-bold">
                        Módulo 1-Admin • Colección: ${QUESTIONS_COLLECTION}
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                        <span class="material-symbols-outlined text-primary">quiz</span>
                        Gestor Maestro de Reactivos CACES y 11 Carreras de Salud
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Crea, edita, importa por lotes (.JSON) y audita casos clínicos para simulacros estandarizados, Modo Tutor y evaluaciones por semestre.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <div class="px-4 py-2 rounded-xl bg-surface border border-surface-high text-right">
                        <span class="block text-[10px] font-mono text-gray-400 uppercase">Total en Firestore</span>
                        <span id="kpi-admin-questions-local" class="text-lg font-extrabold text-primary font-mono">0</span>
                    </div>
                    <button type="button" id="btn-refresh-questions" class="px-4 py-2.5 bg-surface border border-primary text-primary hover:bg-primary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">sync</span>
                        <span>Sincronizar Banco</span>
                    </button>
                    <button type="button" id="btn-export-questions-json" class="px-4 py-2.5 bg-secondary text-surface text-xs font-extrabold rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Filtrados (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- FORMULARIO CRUD DE REACTIVO CLÍNICO -->
            <form id="aq-crud-form" class="mt-6 space-y-5">
                <div class="flex items-center justify-between bg-surface px-4 py-2.5 rounded-xl border border-surface-high">
                    <div class="flex items-center gap-2">
                        <span id="aq-form-mode-badge" class="px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[11px] font-bold uppercase">
                            MODO CREACIÓN
                        </span>
                        <span id="aq-form-mode-title" class="text-xs text-gray-300 font-bold">
                            Nuevo Reactivo Clínico para Firestore
                        </span>
                    </div>
                    <button type="button" id="btn-aq-cancel-edit" class="hidden text-xs font-mono text-warning hover:underline">
                        ✕ Cancelar edición y limpiar formulario
                    </button>
                </div>

                <!-- FILA 1: MODALIDAD, CARRERA, NIVEL/SEMESTRE Y MATERIA -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">1. Ámbito Curricular</label>
                        <select id="aq-scope" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="caces">Habilitación CACES (4 Carreras)</option>
                            <option value="carrera">Malla Universitaria (11 Carreras)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">2. Carrera</label>
                        <select id="aq-carrera" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">3. Nivel / Semestre</label>
                        <select id="aq-nivel" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">4. Materia / Área Clínica</label>
                        <select id="aq-materia" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none"></select>
                    </div>
                </div>

                <!-- FILA 2: DIFICULTAD, PLAN REQUERIDO, SUBTEMA Y RUTA MULTIMEDIA -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Dificultad CACES</label>
                        <select id="aq-dificultad" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="Baja">Baja (Concepto Directo)</option>
                            <option value="Media" selected>Media (Caso Clínico Estándar)</option>
                            <option value="Alta">Alta (Diagnóstico Diferencial / Crítico)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Candado de Plan</label>
                        <select id="aq-plan-acceso" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                            <option value="Básico">Básico (Disponible en Freemium / PRO / VIP)</option>
                            <option value="PRO">Exclusivo PRO / VIP (Simulacro 100 preg.)</option>
                            <option value="VIP">Exclusivo Mentoría Élite VIP</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Subtema / Guía GPC (Opcional)</label>
                        <input type="text" id="aq-subtema" placeholder="Ej: Score Mama / Clave Azul MSP" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Imagen Clínica (assets/4-banco-clinico/)</label>
                        <input type="text" id="aq-imagen-url" placeholder="assets/4-banco-clinico/ecg-iam.png" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <!-- ENUNCIADO DEL CASO CLÍNICO -->
                <div>
                    <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                        Viñeta Clínica / Enunciado del Reactivo
                    </label>
                    <textarea id="aq-enunciado" rows="4" required placeholder="Paciente masculino de 58 años acude a emergencias por dolor torácico opresivo retroesternal de 45 minutos de evolución..." class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                </div>

                <!-- OPCIONES DE RESPUESTA A, B, C, D -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">Opción A</label>
                        <input type="text" id="aq-opA" required placeholder="Texto de la opción A..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">Opción B</label>
                        <input type="text" id="aq-opB" required placeholder="Texto de la opción B..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">Opción C</label>
                        <input type="text" id="aq-opC" required placeholder="Texto de la opción C..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-primary uppercase mb-1 font-bold">Opción D</label>
                        <input type="text" id="aq-opD" required placeholder="Texto de la opción D..." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none" />
                    </div>
                </div>

                <!-- RESPUESTA CORRECTA Y RACIONAL CIENTÍFICO -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-secondary uppercase mb-1 font-bold">Respuesta Correcta</label>
                        <select id="aq-correcta" required class="w-full bg-surface border-2 border-secondary/60 rounded-xl px-3 py-2.5 text-xs text-white font-extrabold focus:border-secondary focus:outline-none">
                            <option value="A">Literal A</option>
                            <option value="B">Literal B</option>
                            <option value="C">Literal C</option>
                            <option value="D">Literal D</option>
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Racional Científico / Justificación Oficial (GPC MSP / Bibliografía)
                        </label>
                        <textarea id="aq-racional" rows="2" required placeholder="Explica por qué el literal correcto es el adecuado y por qué se descartan los distractores según la GPC..." class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>
                </div>

                <!-- BOTÓN DE GUARDADO -->
                <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button type="submit" id="btn-aq-submit" class="px-6 py-3 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
                        <span class="material-symbols-outlined text-base">save</span>
                        <span>Guardar Reactivo en Cloud Firestore</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- IMPORTADOR MASIVO POR LOTES (.JSON) -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">upload_file</span>
                        Importación Masiva de Reactivos por Lotes (.JSON)
                    </h4>
                    <p class="text-xs text-gray-400">
                        Pega un arreglo JSON de preguntas o carga un archivo <code class="text-primary">.json</code> para subir decenas de reactivos simultáneamente a <code class="text-primary">${QUESTIONS_COLLECTION}</code>.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <label class="cursor-pointer px-3 py-2 bg-surface border border-gray-600 hover:border-primary text-xs text-gray-200 rounded-xl font-mono flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-primary">folder_open</span>
                        <span>Cargar archivo .JSON</span>
                        <input type="file" id="aq-json-file-input" accept=".json,application/json" class="hidden" />
                    </label>
                    <button type="button" id="btn-aq-load-template" class="px-3 py-2 bg-surface border border-gray-700 hover:border-secondary text-xs text-secondary rounded-xl font-mono">
                        Insertar Ejemplo JSON
                    </button>
                </div>
            </div>
            <textarea id="aq-json-batch-textarea" rows="4" placeholder='[{"carrera":"medicina","materia":"Medicina Interna","dificultad":"Media","enunciado":"...","opciones":{"A":"...","B":"...","C":"...","D":"..."},"respuestaCorrecta":"A","racional":"..."}]' class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-primary focus:outline-none"></textarea>
            <div class="flex justify-end mt-3">
                <button type="button" id="btn-aq-import-batch" class="px-5 py-2.5 bg-secondary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">cloud_upload</span>
                    <span>Procesar e Importar Lote JSON</span>
                </button>
            </div>
        </div>

        <!-- EXPLORADOR Y AUDITORÍA DEL BANCO DE REACTIVOS -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">manage_search</span>
                        Catálogo Activo en Cloud Firestore (Filtros y Auditoría CRUD)
                    </h4>
                    <p class="text-xs text-gray-400">
                        Filtra por modalidad, carrera, materia o palabra clave para previsualizar, editar o eliminar reactivos.
                    </p>
                </div>
                <span id="aq-filter-count-label" class="text-xs font-mono text-gray-400">Mostrando 0 reactivos</span>
            </div>

            <!-- BARRA DE FILTROS -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <input type="text" id="aq-filter-search" placeholder="🔍 Buscar en enunciado, racional o subtema..." class="md:col-span-2 bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none" />
                <select id="aq-filter-career" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                    <option value="all">Todas las Carreras</option>
                </select>
                <select id="aq-filter-difficulty" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                    <option value="all">Todas las Dificultades</option>
                    <option value="Baja">Dificultad Baja</option>
                    <option value="Media">Dificultad Media</option>
                    <option value="Alta">Dificultad Alta</option>
                </select>
                <select id="aq-filter-scope" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none">
                    <option value="all">CACES + 11 Carreras</option>
                    <option value="caces">Solo CACES Oficial</option>
                    <option value="carrera">Solo Malla por Semestres</option>
                </select>
            </div>

            <!-- TABLA DE REACTIVOS -->
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Carrera / Nivel / Materia</th>
                            <th class="px-4 py-3">Enunciado Clínico</th>
                            <th class="px-4 py-3">Correcta</th>
                            <th class="px-4 py-3">Dificultad / Plan</th>
                            <th class="px-4 py-3 text-right">Acciones CRUD</th>
                        </tr>
                    </thead>
                    <tbody id="aq-questions-tbody">
                        <tr>
                            <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                                Cargando banco de reactivos desde Cloud Firestore...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MODAL DE VISTA PREVIA CLÍNICA -->
        <div id="aq-preview-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm items-center justify-center p-4">
            <div class="bg-surface-container border border-primary rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between border-b border-surface-high pb-3">
                    <div>
                        <span id="aq-preview-meta" class="text-[10px] font-mono text-primary uppercase font-bold"></span>
                        <h4 class="text-base font-extrabold text-white">Vista Previa del Reactivo (Modo Tutor)</h4>
                    </div>
                    <button type="button" id="btn-aq-close-preview" class="text-gray-400 hover:text-white text-sm font-mono">
                        ✕ Cerrar
                    </button>
                </div>
                <div id="aq-preview-image-box" class="hidden">
                    <img id="aq-preview-image" src="" alt="Imagen clínica del caso" class="max-h-60 rounded-xl border border-surface-high mx-auto object-contain" />
                </div>
                <p id="aq-preview-stem" class="text-sm text-gray-100 leading-relaxed whitespace-pre-line bg-surface p-4 rounded-xl border border-surface-high"></p>
                <div id="aq-preview-options" class="space-y-2"></div>
                <div class="bg-secondary/10 border border-secondary/40 rounded-xl p-4">
                    <span class="text-[10px] font-mono text-secondary uppercase font-bold block mb-1">
                        Justificación Oficial / Racional Clínico
                    </span>
                    <p id="aq-preview-rationale" class="text-xs text-gray-200 leading-relaxed"></p>
                </div>
            </div>
        </div>
    `;

    adminView.appendChild(section);
    populateDynamicSelects();
}

/**
 * Rellena dinámicamente los selectores de carrera, nivel académico y materia.
 */
function populateDynamicSelects() {
    const scopeSelect = document.getElementById("aq-scope");
    const careerSelect = document.getElementById("aq-carrera");
    const levelSelect = document.getElementById("aq-nivel");
    const subjectSelect = document.getElementById("aq-materia");
    const filterCareerSelect = document.getElementById("aq-filter-career");

    if (!careerSelect || !subjectSelect || !levelSelect) return;

    const currentScope = scopeSelect?.value || "caces";
    const careers = getCareersByScope(currentScope);

    // Poblar selector de carreras del formulario
    careerSelect.innerHTML = "";
    careers.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        careerSelect.appendChild(opt);
    });

    // Poblar niveles académicos
    levelSelect.innerHTML = "";
    CURRICULUM_CATALOG.academicLevels.forEach(lvl => {
        const opt = document.createElement("option");
        opt.value = lvl.id;
        opt.textContent = lvl.nombre;
        levelSelect.appendChild(opt);
    });
    levelSelect.value = currentScope === "caces" ? "caces_oficial" : "semestre_1";

    // Poblar filtro de carreras de la tabla (combinando las 11 carreras)
    if (filterCareerSelect && filterCareerSelect.options.length <= 1) {
        CURRICULUM_CATALOG.healthCareers11.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.nombre;
            filterCareerSelect.appendChild(opt);
        });
    }

    updateSubjectOptions();
}

/**
 * Actualiza el selector de materias según la carrera y el ámbito elegidos.
 */
function updateSubjectOptions() {
    const scopeSelect = document.getElementById("aq-scope");
    const careerSelect = document.getElementById("aq-carrera");
    const subjectSelect = document.getElementById("aq-materia");
    if (!careerSelect || !subjectSelect) return;

    const subjects = getSubjectsForCareer(careerSelect.value, scopeSelect?.value || "caces");
    subjectSelect.innerHTML = "";
    subjects.forEach(subj => {
        const opt = document.createElement("option");
        opt.value = subj;
        opt.textContent = subj;
        subjectSelect.appendChild(opt);
    });
}

/**
 * Enlaza los eventos del módulo de reactivos.
 */
function bindAdminQuestionsEvents() {
    document.getElementById("aq-scope")?.addEventListener("change", populateDynamicSelects);
    document.getElementById("aq-carrera")?.addEventListener("change", updateSubjectOptions);

    document.getElementById("aq-crud-form")?.addEventListener("submit", saveQuestionItem);
    document.getElementById("btn-aq-cancel-edit")?.addEventListener("click", resetQuestionForm);
    document.getElementById("btn-refresh-questions")?.addEventListener("click", loadQuestionsBank);
    document.getElementById("btn-export-questions-json")?.addEventListener("click", exportQuestionsBankJSON);
    document.getElementById("btn-aq-import-batch")?.addEventListener("click", importQuestionsBatchJSON);

    // Plantilla JSON de ejemplo
    document.getElementById("btn-aq-load-template")?.addEventListener("click", () => {
        const textarea = document.getElementById("aq-json-batch-textarea");
        if (!textarea) return;
        const sample = [
            {
                ambito: "caces",
                carrera: "medicina",
                nivel: "caces_oficial",
                materia: "Ginecología y Obstetricia",
                subtema: "Trastornos Hipertensivos del Embarazo",
                dificultad: "Alta",
                planAcceso: "Básico",
                enunciado: "Gestante de 34 semanas acude por cefalea holocraneana intensa, escotomas centelleantes y TA de 165/112 mmHg en dos tomas separadas por 15 minutos. Proteinuria en tirilla ++. ¿Cuál es el fármaco de primera línea para la profilaxis de convulsiones?",
                opciones: {
                    A: "Sulfato de magnesio (Esquema Zuspan: 4 g IV de impregnación seguido de 1 g/hora)",
                    B: "Fenitoína sódica 15 mg/kg en infusión intravenosa continua",
                    C: "Diazepam 10 mg intravenoso lento en bolo único",
                    D: "Nifedipino 10 mg vía oral cada 20 minutos hasta 3 dosis"
                },
                respuestaCorrecta: "A",
                racional: "Según la GPC del MSP de Ecuador para Trastornos Hipertensivos del Embarazo, el Sulfato de Magnesio (esquema de Zuspan) es el fármaco de elección para prevención y tratamiento de eclampsia."
            }
        ];
        textarea.value = JSON.stringify(sample, null, 2);
    });

    // Lectura de archivo .JSON local hacia el área de texto de importación
    document.getElementById("aq-json-file-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const textarea = document.getElementById("aq-json-batch-textarea");
            if (textarea) textarea.value = String(ev.target?.result || "");
        };
        reader.readAsText(file, "UTF-8");
    });

    // Filtros en vivo
    document.getElementById("aq-filter-search")?.addEventListener("input", renderQuestionsTable);
    document.getElementById("aq-filter-career")?.addEventListener("change", renderQuestionsTable);
    document.getElementById("aq-filter-difficulty")?.addEventListener("change", renderQuestionsTable);
    document.getElementById("aq-filter-scope")?.addEventListener("change", renderQuestionsTable);

    // Cerrar modal de vista previa
    document.getElementById("btn-aq-close-preview")?.addEventListener("click", () => {
        const modal = document.getElementById("aq-preview-modal");
        modal?.classList.add("hidden");
        modal?.classList.remove("flex");
    });
}

/**
 * Mantiene compatibilidad con el formulario original (#admin-form y #btn-import-json)
 * de dashboard.html si aún está presente en el DOM.
 */
function bindLegacyAdminFormIfPresent() {
    const legacyForm = document.getElementById("admin-form");
    const legacyCarrera = document.getElementById("admin-carrera");
    const legacyMateria = document.getElementById("admin-materia");

    if (legacyCarrera && legacyMateria && !legacyCarrera.dataset.boundByQuestionsModule) {
        legacyCarrera.dataset.boundByQuestionsModule = "1";
        legacyCarrera.addEventListener("change", () => {
            legacyMateria.innerHTML = "";
            const subjects = getSubjectsForCareer(legacyCarrera.value, "caces");
            subjects.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                legacyMateria.appendChild(opt);
            });
        });
        legacyCarrera.dispatchEvent(new Event("change"));
    }

    if (legacyForm && !legacyForm.dataset.boundByQuestionsModule) {
        legacyForm.dataset.boundByQuestionsModule = "1";
        legacyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!hasMasterPermission()) return;

            const reactivo = {
                ambito: "caces",
                carrera: document.getElementById("admin-carrera")?.value || "medicina",
                nivel: "caces_oficial",
                materia: document.getElementById("admin-materia")?.value || "Medicina Interna",
                dificultad: document.getElementById("admin-dificultad")?.value || "Media",
                planAcceso: "Básico",
                enunciado: document.getElementById("admin-enunciado")?.value?.trim() || "",
                opciones: {
                    A: document.getElementById("admin-opA")?.value?.trim() || "",
                    B: document.getElementById("admin-opB")?.value?.trim() || "",
                    C: document.getElementById("admin-opC")?.value?.trim() || "",
                    D: document.getElementById("admin-opD")?.value?.trim() || ""
                },
                respuestaCorrecta: document.getElementById("admin-correcta")?.value || "A",
                racional: document.getElementById("admin-racional")?.value?.trim() || "",
                createdAt: new Date().toISOString()
            };

            try {
                await addDoc(collection(db, QUESTIONS_COLLECTION), reactivo);
                alert("✅ Reactivo guardado exitosamente en Firestore.");
                legacyForm.reset();
                legacyCarrera?.dispatchEvent(new Event("change"));
                await loadQuestionsBank();
            } catch (err) {
                alert("Error al guardar reactivo: " + err.message);
            }
        });
    }

    const legacyImportBtn = document.getElementById("btn-import-json");
    if (legacyImportBtn && !legacyImportBtn.dataset.boundByQuestionsModule) {
        legacyImportBtn.dataset.boundByQuestionsModule = "1";
        legacyImportBtn.addEventListener("click", async () => {
            const legacyText = document.getElementById("admin-json-import")?.value?.trim();
            if (!legacyText) return;
            const batchTextarea = document.getElementById("aq-json-batch-textarea");
            if (batchTextarea) batchTextarea.value = legacyText;
            await importQuestionsBatchJSON();
            const legacyInput = document.getElementById("admin-json-import");
            if (legacyInput) legacyInput.value = "";
        });
    }
}

/**
 * Consulta la colección preguntas_caces en Cloud Firestore, sincroniza KPIs
 * y actualiza la tabla interactiva.
 */
export async function loadQuestionsBank() {
    if (!hasMasterPermission()) return;

    const tbody = document.getElementById("aq-questions-tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-400">
                    Sincronizando reactivos con Cloud Firestore (${QUESTIONS_COLLECTION})...
                </td>
            </tr>
        `;
    }

    try {
        const snap = await getDocs(collection(db, QUESTIONS_COLLECTION));
        questionsCache = [];

        snap.forEach(docSnap => {
            questionsCache.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // Ordenar desde el más reciente al más antiguo
        questionsCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Actualizar contadores KPI en cabecera global y local
        const total = questionsCache.length;
        const localKpi = document.getElementById("kpi-admin-questions-local");
        const globalKpi = document.getElementById("kpi-admin-questions");
        if (localKpi) localKpi.textContent = String(total);
        if (globalKpi) globalKpi.textContent = String(total);

        renderQuestionsTable();
    } catch (err) {
        console.error("[AdminQuestions] Error consultando preguntas_caces:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-danger">
                        Error al cargar reactivos desde Firestore: ${err.message}
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Filtra la memoria caché de preguntas según los controles de búsqueda y renderiza las filas.
 */
function getFilteredQuestions() {
    const searchVal = (document.getElementById("aq-filter-search")?.value || "").toLowerCase().trim();
    const careerVal = document.getElementById("aq-filter-career")?.value || "all";
    const diffVal = document.getElementById("aq-filter-difficulty")?.value || "all";
    const scopeVal = document.getElementById("aq-filter-scope")?.value || "all";

    return questionsCache.filter(q => {
        const qScope = q.ambito || (q.nivel && q.nivel !== "caces_oficial" ? "carrera" : "caces");
        if (scopeVal !== "all" && qScope !== scopeVal) return false;
        if (careerVal !== "all" && q.carrera !== careerVal) return false;
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

/**
 * Renderiza la tabla de reactivos filtrados con botones de Vista Previa, Edición y Eliminación.
 */
function renderQuestionsTable() {
    const tbody = document.getElementById("aq-questions-tbody");
    const countLabel = document.getElementById("aq-filter-count-label");
    if (!tbody) return;

    const filtered = getFilteredQuestions();
    if (countLabel) {
        countLabel.textContent = `Mostrando ${filtered.length} de ${questionsCache.length} reactivos`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                    No se encontraron reactivos con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";
    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high hover:bg-surface/60 transition-colors";

        const diffBadgeColor = item.dificultad === "Alta"
            ? "bg-danger/15 text-danger border-danger/40"
            : item.dificultad === "Baja"
                ? "bg-secondary/15 text-secondary border-secondary/40"
                : "bg-warning/15 text-warning border-warning/40";

        const shortStem = (item.enunciado || "").length > 130
            ? `${item.enunciado.substring(0, 130)}...`
            : (item.enunciado || "Sin enunciado");

        tr.innerHTML = `
            <td class="px-4 py-3 align-top">
                <div class="text-white font-bold uppercase">${item.carrera || "medicina"}</div>
                <div class="text-[11px] text-primary">${item.materia || "General"}</div>
                <div class="text-[10px] text-gray-400">${item.nivel || "caces_oficial"} ${item.subtema ? `• ${item.subtema}` : ""}</div>
            </td>
            <td class="px-4 py-3 align-top max-w-md">
                <div class="text-gray-200 font-sans text-xs leading-relaxed">${shortStem}</div>
                ${item.imagenUrl ? `<span class="inline-block mt-1 text-[10px] text-primary font-mono">🖼️ ${item.imagenUrl}</span>` : ""}
            </td>
            <td class="px-4 py-3 align-top">
                <span class="px-2.5 py-1 rounded-lg bg-secondary/20 border border-secondary text-secondary font-extrabold text-xs">
                    ${item.respuestaCorrecta || "A"}
                </span>
            </td>
            <td class="px-4 py-3 align-top">
                <span class="px-2 py-0.5 rounded border text-[10px] font-bold ${diffBadgeColor}">
                    ${item.dificultad || "Media"}
                </span>
                <div class="text-[10px] text-gray-400 mt-1">Plan: <strong>${item.planAcceso || "Básico"}</strong></div>
            </td>
            <td class="px-4 py-3 align-top text-right whitespace-nowrap space-x-1.5">
                <button type="button" class="btn-aq-preview px-2.5 py-1.5 rounded-lg bg-surface border border-gray-600 text-gray-200 hover:border-primary hover:text-primary font-bold" title="Vista Previa">
                    👁️
                </button>
                <button type="button" class="btn-aq-edit px-2.5 py-1.5 rounded-lg bg-surface border border-primary/60 text-primary hover:bg-primary hover:text-surface font-bold" title="Editar Reactivo">
                    ✏️ Editar
                </button>
                <button type="button" class="btn-aq-delete px-2.5 py-1.5 rounded-lg bg-surface border border-danger/60 text-danger hover:bg-danger hover:text-white font-bold" title="Eliminar Reactivo">
                    🗑️
                </button>
            </td>
        `;

        tr.querySelector(".btn-aq-preview")?.addEventListener("click", () => previewQuestionModal(item.id));
        tr.querySelector(".btn-aq-edit")?.addEventListener("click", () => editQuestionItem(item.id));
        tr.querySelector(".btn-aq-delete")?.addEventListener("click", () => deleteQuestionItem(item.id));

        tbody.appendChild(tr);
    });
}

/**
 * Crea un nuevo reactivo o actualiza uno existente en la colección preguntas_caces.
 * @param {Event} event
 */
export async function saveQuestionItem(event) {
    if (event) event.preventDefault();
    if (!hasMasterPermission()) {
        alert("Acceso restringido: Solo las cuentas maestras pueden modificar el banco de reactivos.");
        return;
    }

    const submitBtn = document.getElementById("btn-aq-submit");
    const activeEmail = auth?.currentUser?.email || appState?.currentUserData?.email || MASTER_ADMINS[0];

    const payload = {
        ambito: document.getElementById("aq-scope")?.value || "caces",
        carrera: document.getElementById("aq-carrera")?.value || "medicina",
        nivel: document.getElementById("aq-nivel")?.value || "caces_oficial",
        materia: document.getElementById("aq-materia")?.value || "Medicina Interna",
        subtema: document.getElementById("aq-subtema")?.value?.trim() || "",
        dificultad: document.getElementById("aq-dificultad")?.value || "Media",
        planAcceso: document.getElementById("aq-plan-acceso")?.value || "Básico",
        imagenUrl: document.getElementById("aq-imagen-url")?.value?.trim() || "",
        enunciado: document.getElementById("aq-enunciado")?.value?.trim() || "",
        opciones: {
            A: document.getElementById("aq-opA")?.value?.trim() || "",
            B: document.getElementById("aq-opB")?.value?.trim() || "",
            C: document.getElementById("aq-opC")?.value?.trim() || "",
            D: document.getElementById("aq-opD")?.value?.trim() || ""
        },
        respuestaCorrecta: document.getElementById("aq-correcta")?.value || "A",
        racional: document.getElementById("aq-racional")?.value?.trim() || "",
        actualizadoPor: activeEmail,
        updatedAt: new Date().toISOString()
    };

    if (!payload.enunciado || !payload.opciones.A || !payload.opciones.B || !payload.opciones.C || !payload.opciones.D) {
        alert("⚠️ Por favor completa el enunciado y las 4 opciones de respuesta (A, B, C y D).");
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Guardando en Firestore...</span>`;
        }

        if (editingQuestionId) {
            await updateDoc(doc(db, QUESTIONS_COLLECTION, editingQuestionId), payload);
            alert("✅ Reactivo actualizado correctamente en Cloud Firestore.");
        } else {
            payload.createdAt = new Date().toISOString();
            payload.creadoPor = activeEmail;
            await addDoc(collection(db, QUESTIONS_COLLECTION), payload);
            alert("✅ Nuevo reactivo clínico registrado exitosamente en Cloud Firestore.");
        }

        resetQuestionForm();
        await loadQuestionsBank();
    } catch (err) {
        console.error("[AdminQuestions] Error guardando reactivo:", err);
        alert("Error al guardar el reactivo en Firestore: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">save</span><span>Guardar Reactivo en Cloud Firestore</span>`;
        }
    }
}

/**
 * Carga un reactivo existente dentro del formulario administrativo para su edición.
 * @param {string} questionId
 */
export function editQuestionItem(questionId) {
    if (!hasMasterPermission()) return;

    const item = questionsCache.find(q => q.id === questionId);
    if (!item) return;

    editingQuestionId = item.id;

    const scopeSelect = document.getElementById("aq-scope");
    const careerSelect = document.getElementById("aq-carrera");
    const levelSelect = document.getElementById("aq-nivel");
    const subjectSelect = document.getElementById("aq-materia");

    const detectedScope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
    if (scopeSelect) scopeSelect.value = detectedScope;
    populateDynamicSelects();

    if (careerSelect) {
        careerSelect.value = item.carrera || "medicina";
        updateSubjectOptions();
    }

    if (levelSelect && item.nivel) levelSelect.value = item.nivel;

    if (subjectSelect && item.materia) {
        const exists = Array.from(subjectSelect.options).some(o => o.value === item.materia);
        if (!exists) {
            const customOpt = document.createElement("option");
            customOpt.value = item.materia;
            customOpt.textContent = item.materia;
            subjectSelect.appendChild(customOpt);
        }
        subjectSelect.value = item.materia;
    }

    document.getElementById("aq-dificultad").value = item.dificultad || "Media";
    document.getElementById("aq-plan-acceso").value = item.planAcceso || "Básico";
    document.getElementById("aq-subtema").value = item.subtema || "";
    document.getElementById("aq-imagen-url").value = item.imagenUrl || "";
    document.getElementById("aq-enunciado").value = item.enunciado || "";
    document.getElementById("aq-opA").value = item.opciones?.A || "";
    document.getElementById("aq-opB").value = item.opciones?.B || "";
    document.getElementById("aq-opC").value = item.opciones?.C || "";
    document.getElementById("aq-opD").value = item.opciones?.D || "";
    document.getElementById("aq-correcta").value = item.respuestaCorrecta || "A";
    document.getElementById("aq-racional").value = item.racional || "";

    const badge = document.getElementById("aq-form-mode-badge");
    const title = document.getElementById("aq-form-mode-title");
    const cancelBtn = document.getElementById("btn-aq-cancel-edit");
    const submitBtn = document.getElementById("btn-aq-submit");

    if (badge) {
        badge.textContent = "MODO EDICIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = `Editando Reactivo ID: ${item.id}`;
    cancelBtn?.classList.remove("hidden");
    if (submitBtn) {
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">edit_note</span><span>Actualizar Reactivo en Firestore</span>`;
    }

    document.getElementById("admin-questions-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Restablece el formulario al modo de creación limpia.
 */
function resetQuestionForm() {
    editingQuestionId = null;
    const form = document.getElementById("aq-crud-form");
    form?.reset();
    populateDynamicSelects();

    const badge = document.getElementById("aq-form-mode-badge");
    const title = document.getElementById("aq-form-mode-title");
    const cancelBtn = document.getElementById("btn-aq-cancel-edit");
    const submitBtn = document.getElementById("btn-aq-submit");

    if (badge) {
        badge.textContent = "MODO CREACIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = "Nuevo Reactivo Clínico para Firestore";
    cancelBtn?.classList.add("hidden");
    if (submitBtn) {
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">save</span><span>Guardar Reactivo en Cloud Firestore</span>`;
    }
}

/**
 * Elimina de forma permanente un reactivo de la colección preguntas_caces.
 * @param {string} questionId
 */
export async function deleteQuestionItem(questionId) {
    if (!hasMasterPermission()) return;

    const item = questionsCache.find(q => q.id === questionId);
    const previewText = item?.enunciado ? item.enunciado.substring(0, 80) + "..." : questionId;

    if (!confirm(`¿Confirmas que deseas eliminar permanentemente este reactivo de Firestore?\n\n"${previewText}"`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, QUESTIONS_COLLECTION, questionId));
        if (editingQuestionId === questionId) {
            resetQuestionForm();
        }
        await loadQuestionsBank();
    } catch (err) {
        console.error("[AdminQuestions] Error al eliminar reactivo:", err);
        alert("Error al eliminar el reactivo: " + err.message);
    }
}

/**
 * Importa un lote masivo de reactivos en formato .JSON hacia la colección preguntas_caces.
 */
export async function importQuestionsBatchJSON() {
    if (!hasMasterPermission()) return;

    const textarea = document.getElementById("aq-json-batch-textarea");
    const importBtn = document.getElementById("btn-aq-import-batch");
    const rawText = textarea?.value?.trim() || "";

    if (!rawText) {
        alert("⚠️ Pega un arreglo JSON válido o selecciona un archivo .JSON antes de importar.");
        return;
    }

    try {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.preguntas_caces) ? parsed.preguntas_caces : null);

        if (!list || list.length === 0) {
            throw new Error("El archivo debe contener un arreglo JSON de reactivos.");
        }

        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = `Importando ${list.length} reactivos...`;
        }

        const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
        let importedCount = 0;

        for (const rawItem of list) {
            if (!rawItem.enunciado || !rawItem.opciones) continue;

            const normalizedItem = {
                ambito: rawItem.ambito || "caces",
                carrera: (rawItem.carrera || "medicina").toLowerCase().trim(),
                nivel: rawItem.nivel || "caces_oficial",
                materia: rawItem.materia || "Medicina Interna",
                subtema: rawItem.subtema || "",
                dificultad: rawItem.dificultad || "Media",
                planAcceso: rawItem.planAcceso || "Básico",
                imagenUrl: rawItem.imagenUrl || "",
                enunciado: String(rawItem.enunciado).trim(),
                opciones: {
                    A: String(rawItem.opciones.A || "").trim(),
                    B: String(rawItem.opciones.B || "").trim(),
                    C: String(rawItem.opciones.C || "").trim(),
                    D: String(rawItem.opciones.D || "").trim()
                },
                respuestaCorrecta: String(rawItem.respuestaCorrecta || "A").toUpperCase().trim(),
                racional: String(rawItem.racional || "Sin racional disponible.").trim(),
                creadoPor: activeEmail,
                createdAt: rawItem.createdAt || new Date().toISOString()
            };

            await addDoc(collection(db, QUESTIONS_COLLECTION), normalizedItem);
            importedCount++;
        }

        alert(`✅ Importación masiva completada: ${importedCount} reactivos subidos a ${QUESTIONS_COLLECTION}.`);
        if (textarea) textarea.value = "";
        await loadQuestionsBank();
    } catch (err) {
        console.error("[AdminQuestions] Error en importación JSON:", err);
        alert("Error de importación: Verifica que la sintaxis JSON sea válida.\nDetalle: " + err.message);
    } finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span><span>Procesar e Importar Lote JSON</span>`;
        }
    }
}

/**
 * Abre el visor emergente en Modo Tutor para inspeccionar el reactivo completo.
 * @param {string} questionId
 */
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
        metaEl.textContent = `${(item.carrera || "medicina").toUpperCase()} • ${item.nivel || "CACES"} • ${item.materia || "General"} • Dificultad ${item.dificultad || "Media"}`;
    }

    if (item.imagenUrl && imgBox && imgEl) {
        imgEl.src = item.imagenUrl;
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
            <span class="flex-1">${item.opciones?.[letter] || "---"}</span>
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

/**
 * Descarga los reactivos actualmente filtrados en pantalla como archivo .JSON.
 */
export function exportQuestionsBankJSON() {
    if (!hasMasterPermission()) return;

    const filtered = getFilteredQuestions();
    if (filtered.length === 0) {
        alert("No hay reactivos en la vista actual para exportar.");
        return;
    }

    const exportPayload = {
        plataforma: "Makai Academy (Proyecto ALICIZATION)",
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
    a.download = `Banco_Reactivos_Makai_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
