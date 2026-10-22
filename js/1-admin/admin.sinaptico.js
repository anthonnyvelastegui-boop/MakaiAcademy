// ============================================================================
// ARCHIVO: js/1-admin/admin.sinaptico.js
// DESCRIPCIÓN: Subcomponente de Gestión de Mazos y Tarjetas para el Sistema de
//              Repetición Espaciada • Sináptico v4.4 (CRUD, Importación JSON
//              y Generador Automático desde Reactivos CACES).
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

// Colecciones oficiales en Cloud Firestore
const SINAPTICO_COLLECTION = COLLECTIONS?.SINAPTICO || "tarjetas_sinaptico";
const QUESTIONS_COLLECTION = COLLECTIONS?.QUESTIONS || "preguntas_caces";

// Catálogo curricular dual: 4 Carreras CACES + 11 Carreras de Salud y Niveles
const SINAPTICO_CURRICULUM = {
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
        { id: "preuniversitario", nombre: "Preuniversitario" },
        { id: "nivelacion", nombre: "Nivelación Académica" },
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
        { id: "internado_rotativo", nombre: "Internado Rotativo" }
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
    ],
    cardTypes: [
        { id: "perla_clinica", nombre: "Perla Clínica / Criterio Diagnóstico" },
        { id: "farmaco_dosis", nombre: "Fármaco de Elección / Dosis Crítica" },
        { id: "algoritmo_gpc", nombre: "Algoritmo / Norma GPC MSP" },
        { id: "signo_imagen", nombre: "Reconocimiento de Imagen / ECG / Signo" },
        { id: "caso_corto", nombre: "Viñeta Clínica de Decisión Rápida" }
    ],
    assetFolders: [
        { prefix: "", label: "Sin ruta predefinida (Escribir manual o URL)" },
        { prefix: "assets/4-banco-clinico/imagenologia/", label: "📁 assets/4-banco-clinico/imagenologia/" },
        { prefix: "assets/4-banco-clinico/electrocardiografia/", label: "📁 assets/4-banco-clinico/electrocardiografia/" },
        { prefix: "assets/4-banco-clinico/atlas-visual/", label: "📁 assets/4-banco-clinico/atlas-visual/" },
        { prefix: "assets/5-multimedia-1d/infografias-y-algoritmos/", label: "📁 assets/5-multimedia-1d/infografias-y-algoritmos/" },
        { prefix: "assets/5-multimedia-1d/micro-videos-1d/", label: "📁 assets/5-multimedia-1d/micro-videos-1d/" }
    ]
};

// Estado interno del módulo Sináptico v4.4
let sinapticoCache = [];
let editingCardId = null;
let sinapticoModuleInitialized = false;
let previewCardFlipped = false;

/**
 * Comprueba si el usuario autenticado pertenece a las cuentas maestras autorizadas.
 * @returns {boolean}
 */
function hasMasterPermission() {
    const activeEmail = auth?.currentUser?.email || appState?.currentUserData?.email || "";
    return isMasterAdmin(activeEmail);
}

/**
 * Obtiene el catálogo de carreras según el ámbito curricular seleccionado.
 * @param {string} scope - "caces" | "carrera"
 * @returns {Array}
 */
function getCareersByScope(scope = "caces") {
    if (scope === "carrera") {
        return SINAPTICO_CURRICULUM.healthCareers11;
    }
    if (window.makaiData?.carreras && Array.isArray(window.makaiData.carreras)) {
        return window.makaiData.carreras;
    }
    return SINAPTICO_CURRICULUM.cacesCareers;
}

/**
 * Obtiene la lista de materias para una carrera y modalidad determinadas.
 * @param {string} careerId
 * @param {string} scope
 * @returns {Array<string>}
 */
function getSubjectsForCareer(careerId, scope = "caces") {
    const cacesMatch = (window.makaiData?.carreras || SINAPTICO_CURRICULUM.cacesCareers)
        .find(c => c.id === careerId);

    if (scope === "caces" && cacesMatch?.materias?.length) {
        return cacesMatch.materias;
    }

    if (cacesMatch?.materias?.length) {
        return [...new Set([...cacesMatch.materias, ...SINAPTICO_CURRICULUM.universalSubjects])];
    }

    return SINAPTICO_CURRICULUM.universalSubjects;
}

/**
 * Punto de entrada principal del módulo de tarjetas Sináptico v4.4.
 * Es invocado automáticamente por js/1-admin/admin.controller.js.
 */
export async function initAdminSinaptico() {
    if (!hasMasterPermission()) {
        console.warn("[AdminSinaptico] Acceso denegado: Se requiere cuenta maestra autorizada.");
        return;
    }

    renderAdminSinapticoSection();

    if (!sinapticoModuleInitialized) {
        bindAdminSinapticoEvents();
        sinapticoModuleInitialized = true;
    }

    await loadSinapticoCards();
}

/**
 * Construye e inyecta la interfaz completa de gestión de tarjetas (#admin-sinaptico-section)
 * dentro de #view-admin.
 */
function renderAdminSinapticoSection() {
    const adminView = document.getElementById("view-admin");
    if (!adminView) return;

    if (document.getElementById("admin-sinaptico-section")) return;

    const section = document.createElement("section");
    section.id = "admin-sinaptico-section";
    section.dataset.adminSection = "sinaptico";
    section.className = "mb-10 space-y-6";

    section.innerHTML = `
        <!-- CABECERA Y ESTADÍSTICAS DEL MOTOR SINÁPTICO v4.4 -->
        <div class="bg-surface-container border border-secondary/40 rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold">
                        Módulo 1-Admin • Colección: ${SINAPTICO_COLLECTION} • Motor 1D
                    </span>
                    <h3 class="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                        <span class="material-symbols-outlined text-secondary">psychology</span>
                        Gestor de Repetición Espaciada • Sináptico v4.4
                    </h3>
                    <p class="text-xs text-gray-400 mt-1">
                        Crea, edita, convierte desde reactivos CACES e importa mazos de memoria activa para las 4 carreras oficiales del CACES y las 11 carreras de Salud.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <div class="px-4 py-2 rounded-xl bg-surface border border-surface-high text-right">
                        <span class="block text-[10px] font-mono text-gray-400 uppercase">Tarjetas en Firestore</span>
                        <span id="kpi-admin-sinaptico-local" class="text-lg font-extrabold text-secondary font-mono">0</span>
                    </div>
                    <button type="button" id="btn-refresh-sinaptico" class="px-4 py-2.5 bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">sync</span>
                        <span>Sincronizar Mazos</span>
                    </button>
                    <button type="button" id="btn-sync-from-caces" class="px-4 py-2.5 bg-surface border border-primary text-primary hover:bg-primary hover:text-surface text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5" title="Genera tarjetas Sináptico automáticamente a partir de preguntas_caces">
                        <span class="material-symbols-outlined text-sm">auto_awesome</span>
                        <span>Generar desde Banco CACES</span>
                    </button>
                    <button type="button" id="btn-export-sinaptico-json" class="px-4 py-2.5 bg-secondary text-surface text-xs font-extrabold rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">download</span>
                        <span>Exportar Mazo (.JSON)</span>
                    </button>
                </div>
            </div>

            <!-- FORMULARIO CRUD DE TARJETA SINÁPTICA -->
            <form id="as-crud-form" class="mt-6 space-y-5">
                <div class="flex items-center justify-between bg-surface px-4 py-2.5 rounded-xl border border-surface-high">
                    <div class="flex items-center gap-2">
                        <span id="as-form-mode-badge" class="px-2.5 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[11px] font-bold uppercase">
                            MODO CREACIÓN
                        </span>
                        <span id="as-form-mode-title" class="text-xs text-gray-300 font-bold">
                            Nueva Tarjeta de Repetición Espaciada • Sináptico v4.4
                        </span>
                    </div>
                    <button type="button" id="btn-as-cancel-edit" class="hidden text-xs font-mono text-warning hover:underline">
                        ✕ Cancelar edición y limpiar formulario
                    </button>
                </div>

                <!-- FILA 1: ÁMBITO, CARRERA, NIVEL/SEMESTRE Y MATERIA -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">1. Ámbito Curricular</label>
                        <select id="as-scope" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="caces">Habilitación CACES (4 Carreras)</option>
                            <option value="carrera">Malla Universitaria (11 Carreras)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">2. Carrera</label>
                        <select id="as-carrera" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">3. Nivel / Semestre</label>
                        <select id="as-nivel" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">4. Materia / Mazo Clínico</label>
                        <select id="as-materia" required class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>
                </div>

                <!-- FILA 2: TIPO DE TARJETA, DIFICULTAD, PLAN Y ETIQUETA / SUBTEMA -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Tipo de Estímulo Sináptico</label>
                        <select id="as-tipo" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Complejidad Cognitiva</label>
                        <select id="as-dificultad" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="Baja">Baja (Memoria Directa)</option>
                            <option value="Media" selected>Media (Asociación Clínica)</option>
                            <option value="Alta">Alta (Integración / Algoritmo Crítico)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Candado de Suscripción</label>
                        <select id="as-plan-acceso" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                            <option value="Básico">Básico (Mazo Demostrativo / PRO / VIP)</option>
                            <option value="PRO" selected>Makai PRO CACES / VIP</option>
                            <option value="VIP">Exclusivo Mentoría Élite VIP</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">Subtema / Etiqueta GPC</label>
                        <input type="text" id="as-subtema" placeholder="Ej: Sepsis Neonatal / Score QSOFA" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-secondary focus:outline-none" />
                    </div>
                </div>

                <!-- FILA 3: FRENTE (ESTÍMULO / PREGUNTA) Y REVERSO (RESPUESTA / CONDUCTA) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-surface/70 border border-primary/30 rounded-xl p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-[11px] font-mono text-primary uppercase font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">flip_to_front</span>
                                Frente de la Tarjeta (Caso / Pregunta Activa)
                            </label>
                            <span class="text-[10px] font-mono text-gray-500">Cara A • Estímulo</span>
                        </div>
                        <textarea id="as-frente" rows="4" required placeholder="Ej: ¿Cuál es el antídoto específico de primera línea ante intoxicación por sulfato de magnesio con abolición del reflejo rotuliano y depresión respiratoria?" class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>

                    <div class="bg-surface/70 border border-secondary/30 rounded-xl p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-[11px] font-mono text-secondary uppercase font-bold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">flip_to_back</span>
                                Reverso de la Tarjeta (Respuesta / Conducta Oficial)
                            </label>
                            <span class="text-[10px] font-mono text-gray-500">Cara B • Resolución</span>
                        </div>
                        <textarea id="as-reverso" rows="4" required placeholder="Ej: Gluconato de calcio al 10%: administrar 1 g (10 ml) por vía intravenosa lenta durante 3 a 5 minutos." class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-secondary focus:outline-none"></textarea>
                    </div>
                </div>

                <!-- FILA 4: PERLA CLÍNICA / NEMOTECNIA Y ASISTENTE DE RUTA MULTIMEDIA -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-[11px] font-mono text-warning uppercase mb-1 font-bold">
                            Perla Clínica / Nemotecnia (Opcional)
                        </label>
                        <input type="text" id="as-perla" placeholder="Ej: Vigilar FR >= 12 rpm y diuresis >= 30 ml/h antes de mantener infusión." class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white focus:border-warning focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Subcarpeta Multimedia (assets/)
                        </label>
                        <select id="as-asset-folder" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-gray-200 font-mono focus:border-secondary focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                            Ruta Imagen / Esquema (Opcional)
                        </label>
                        <input type="text" id="as-imagen-url" placeholder="assets/4-banco-clinico/electrocardiografia/bloqueo-av.png" class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-secondary focus:outline-none" />
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
                        <span>Guardar Tarjeta en Cloud Firestore</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- IMPORTADOR MASIVO POR LOTES (.JSON) PARA SINÁPTICO v4.4 -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">upload_file</span>
                        Importación Masiva de Mazos Sinápticos por Lotes (.JSON)
                    </h4>
                    <p class="text-xs text-gray-400">
                        Pega un arreglo JSON de tarjetas o selecciona un archivo <code class="text-secondary">.json</code> para nutrir la colección <code class="text-secondary">${SINAPTICO_COLLECTION}</code>.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <label class="cursor-pointer px-3 py-2 bg-surface border border-gray-600 hover:border-secondary text-xs text-gray-200 rounded-xl font-mono flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-secondary">folder_open</span>
                        <span>Cargar archivo .JSON</span>
                        <input type="file" id="as-json-file-input" accept=".json,application/json" class="hidden" />
                    </label>
                    <button type="button" id="btn-as-load-template" class="px-3 py-2 bg-surface border border-gray-700 hover:border-primary text-xs text-primary rounded-xl font-mono">
                        Insertar Ejemplo JSON
                    </button>
                </div>
            </div>
            <textarea id="as-json-batch-textarea" rows="4" placeholder='[{"ambito":"caces","carrera":"medicina","materia":"Urgencias y Emergencias","frente":"...","reverso":"...","perlaClinica":"..."}]' class="w-full bg-surface border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-secondary focus:outline-none"></textarea>
            <div class="flex justify-end mt-3">
                <button type="button" id="btn-as-import-batch" class="px-5 py-2.5 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">cloud_upload</span>
                    <span>Procesar e Importar Mazo JSON</span>
                </button>
            </div>
        </div>

        <!-- EXPLORADOR Y AUDITORÍA DE MAZOS EN CLOUD FIRESTORE -->
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                    <h4 class="text-sm font-extrabold text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">style</span>
                        Catálogo de Tarjetas Sináptico v4.4 en Cloud Firestore
                    </h4>
                    <p class="text-xs text-gray-400">
                        Filtra por ámbito, carrera, tipo de estímulo o palabra clave para voltear en vista previa, editar o eliminar tarjetas.
                    </p>
                </div>
                <span id="as-filter-count-label" class="text-xs font-mono text-gray-400">Mostrando 0 tarjetas</span>
            </div>

            <!-- BARRA DE FILTROS -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <input type="text" id="as-filter-search" placeholder="🔍 Buscar en frente, reverso, perla o materia..." class="md:col-span-2 bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none" />
                <select id="as-filter-career" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                    <option value="all">Todas las Carreras</option>
                </select>
                <select id="as-filter-type" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                    <option value="all">Todos los Tipos</option>
                </select>
                <select id="as-filter-scope" class="bg-surface border border-surface-high rounded-xl px-3 py-2 text-xs text-white focus:border-secondary focus:outline-none">
                    <option value="all">CACES + 11 Carreras</option>
                    <option value="caces">Solo CACES Oficial</option>
                    <option value="carrera">Solo Malla por Semestres</option>
                </select>
            </div>

            <!-- TABLA DE TARJETAS SINÁPTICAS -->
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-gray-300 font-mono">
                    <thead class="text-[11px] text-gray-400 uppercase bg-surface border-b border-surface-high">
                        <tr>
                            <th class="px-4 py-3">Carrera / Nivel / Mazo</th>
                            <th class="px-4 py-3">Frente (Estímulo Clínico)</th>
                            <th class="px-4 py-3">Reverso (Respuesta / Conducta)</th>
                            <th class="px-4 py-3">Tipo / Plan</th>
                            <th class="px-4 py-3 text-right">Acciones CRUD</th>
                        </tr>
                    </thead>
                    <tbody id="as-cards-tbody">
                        <tr>
                            <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                                Cargando tarjetas de Repetición Espaciada • Sináptico v4.4 desde Cloud Firestore...
                            </td>
                        </tr>
                    </tbody>
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
                            Simulador de Tarjeta • Sináptico v4.4
                        </h4>
                    </div>
                    <button type="button" id="btn-as-close-preview" class="text-gray-400 hover:text-white text-sm font-mono">
                        ✕ Cerrar
                    </button>
                </div>

                <!-- CONTENEDOR DE VOLTEO INTERACTIVO -->
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

                    <!-- FRENTE -->
                    <div id="as-preview-front-box" class="py-2">
                        <p id="as-preview-front-text" class="text-sm text-white font-semibold leading-relaxed whitespace-pre-line"></p>
                    </div>

                    <!-- REVERSO (OCULTO HASTA PULSAR MOSTRAR RESPUESTA) -->
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

                <!-- CONTROLES DE VOLTEO Y RETENCIÓN ALGORÍTMICA -->
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

    adminView.appendChild(section);
    populateSinapticoSelects();
}

/**
 * Rellena dinámicamente los selectores del formulario y la barra de filtros.
 */
function populateSinapticoSelects() {
    const scopeSelect = document.getElementById("as-scope");
    const careerSelect = document.getElementById("as-carrera");
    const levelSelect = document.getElementById("as-nivel");
    const subjectSelect = document.getElementById("as-materia");
    const typeSelect = document.getElementById("as-tipo");
    const folderSelect = document.getElementById("as-asset-folder");
    const filterCareerSelect = document.getElementById("as-filter-career");
    const filterTypeSelect = document.getElementById("as-filter-type");

    if (!careerSelect || !subjectSelect || !levelSelect) return;

    const currentScope = scopeSelect?.value || "caces";
    const careers = getCareersByScope(currentScope);

    // Poblar carreras
    careerSelect.innerHTML = "";
    careers.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        careerSelect.appendChild(opt);
    });

    // Poblar niveles académicos
    levelSelect.innerHTML = "";
    SINAPTICO_CURRICULUM.academicLevels.forEach(lvl => {
        const opt = document.createElement("option");
        opt.value = lvl.id;
        opt.textContent = lvl.nombre;
        levelSelect.appendChild(opt);
    });
    levelSelect.value = currentScope === "caces" ? "caces_oficial" : "semestre_1";

    // Poblar tipos de tarjeta Sináptico
    if (typeSelect && typeSelect.options.length === 0) {
        SINAPTICO_CURRICULUM.cardTypes.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.nombre;
            typeSelect.appendChild(opt);
        });
    }

    // Poblar asistente de subcarpetas de assets/
    if (folderSelect && folderSelect.options.length === 0) {
        SINAPTICO_CURRICULUM.assetFolders.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f.prefix;
            opt.textContent = f.label;
            folderSelect.appendChild(opt);
        });
    }

    // Poblar filtros de la tabla
    if (filterCareerSelect && filterCareerSelect.options.length <= 1) {
        SINAPTICO_CURRICULUM.healthCareers11.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.nombre;
            filterCareerSelect.appendChild(opt);
        });
    }

    if (filterTypeSelect && filterTypeSelect.options.length <= 1) {
        SINAPTICO_CURRICULUM.cardTypes.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.nombre;
            filterTypeSelect.appendChild(opt);
        });
    }

    updateSinapticoSubjects();
}

/**
 * Actualiza el selector de materias/mazos según la carrera y modalidad elegidas.
 */
function updateSinapticoSubjects() {
    const scopeSelect = document.getElementById("as-scope");
    const careerSelect = document.getElementById("as-carrera");
    const subjectSelect = document.getElementById("as-materia");
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
 * Enlaza todos los eventos interactivos del módulo Sináptico v4.4.
 */
function bindAdminSinapticoEvents() {
    document.getElementById("as-scope")?.addEventListener("change", populateSinapticoSelects);
    document.getElementById("as-carrera")?.addEventListener("change", updateSinapticoSubjects);

    // Autocompletado de prefijo de subcarpeta multimedia
    document.getElementById("as-asset-folder")?.addEventListener("change", (e) => {
        const prefix = e.target.value || "";
        const imgInput = document.getElementById("as-imagen-url");
        if (!imgInput || !prefix) return;
        const currentVal = imgInput.value.trim();
        const fileNameOnly = currentVal.includes("/") ? currentVal.split("/").pop() : currentVal;
        imgInput.value = `${prefix}${fileNameOnly || "ejemplo-recurso.png"}`;
    });

    document.getElementById("as-crud-form")?.addEventListener("submit", saveSinapticoCard);
    document.getElementById("btn-as-cancel-edit")?.addEventListener("click", resetSinapticoForm);
    document.getElementById("btn-refresh-sinaptico")?.addEventListener("click", loadSinapticoCards);
    document.getElementById("btn-sync-from-caces")?.addEventListener("click", generateCardsFromCacesQuestions);
    document.getElementById("btn-export-sinaptico-json")?.addEventListener("click", exportSinapticoDeckJSON);
    document.getElementById("btn-as-import-batch")?.addEventListener("click", importSinapticoBatchJSON);

    // Insertar plantilla JSON de ejemplo
    document.getElementById("btn-as-load-template")?.addEventListener("click", () => {
        const textarea = document.getElementById("as-json-batch-textarea");
        if (!textarea) return;
        const sample = [
            {
                ambito: "caces",
                carrera: "medicina",
                nivel: "caces_oficial",
                materia: "Ginecología y Obstetricia",
                subtema: "Clave Roja Obstétrica MSP",
                tipoTarjeta: "algoritmo_gpc",
                dificultad: "Alta",
                planAcceso: "PRO",
                frente: "Paciente puérpera inmediata con hemorragia posparto por atonía uterina. ¿Cuál es el fármaco uterotónico de primera línea y su dosis inicial según la GPC del MSP de Ecuador?",
                reverso: "Oxitocina: 10 UI por vía intramuscular (o 5 UI IV lento) STAT, seguida de infusión continua de 20 a 40 UI en 1000 ml de cristaloides a 125 ml/hora.",
                perlaClinica: "Las 4 T de la Hemorragia Posparto: Tono (70% atonía), Trauma (20%), Tejido (9%), Trombina (1%).",
                imagenUrl: ""
            }
        ];
        textarea.value = JSON.stringify(sample, null, 2);
    });

    // Lectura de archivo .JSON local
    document.getElementById("as-json-file-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const textarea = document.getElementById("as-json-batch-textarea");
            if (textarea) textarea.value = String(ev.target?.result || "");
        };
        reader.readAsText(file, "UTF-8");
    });

    // Filtros en vivo
    document.getElementById("as-filter-search")?.addEventListener("input", renderSinapticoTable);
    document.getElementById("as-filter-career")?.addEventListener("change", renderSinapticoTable);
    document.getElementById("as-filter-type")?.addEventListener("change", renderSinapticoTable);
    document.getElementById("as-filter-scope")?.addEventListener("change", renderSinapticoTable);

    // Eventos del modal de simulación de volteo
    document.getElementById("btn-as-flip-preview")?.addEventListener("click", togglePreviewCardFlip);
    document.getElementById("btn-as-close-preview")?.addEventListener("click", closePreviewModal);

    document.querySelectorAll(".btn-as-sim-interval").forEach(btn => {
        btn.addEventListener("click", () => {
            const interval = btn.getAttribute("data-interval") || "1d";
            alert(`⚡ Retención Sináptico v4.4 calibrada: Intervalo programado en [${interval}].`);
            closePreviewModal();
        });
    });

    // Soporte de barra espaciadora para voltear la tarjeta cuando el modal está abierto
    document.addEventListener("keydown", (e) => {
        const modal = document.getElementById("as-preview-modal");
        if (modal && !modal.classList.contains("hidden") && e.code === "Space") {
            e.preventDefault();
            togglePreviewCardFlip();
        }
    });
}

/**
 * Consulta la colección tarjetas_sinaptico en Cloud Firestore, sincroniza KPIs
 * y renderiza la tabla administrativa.
 */
export async function loadSinapticoCards() {
    if (!hasMasterPermission()) return;

    const tbody = document.getElementById("as-cards-tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-400">
                    Sincronizando mazos con Cloud Firestore (${SINAPTICO_COLLECTION})...
                </td>
            </tr>
        `;
    }

    try {
        const snap = await getDocs(collection(db, SINAPTICO_COLLECTION));
        sinapticoCache = [];

        snap.forEach(docSnap => {
            sinapticoCache.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // Ordenar desde la tarjeta más reciente a la más antigua
        sinapticoCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Actualizar KPIs local y global en admin.controller.js
        const total = sinapticoCache.length;
        const localKpi = document.getElementById("kpi-admin-sinaptico-local");
        const globalKpi = document.getElementById("kpi-admin-sinaptico");
        if (localKpi) localKpi.textContent = String(total);
        if (globalKpi) globalKpi.textContent = String(total);

        renderSinapticoTable();
    } catch (err) {
        console.error("[AdminSinaptico] Error consultando tarjetas_sinaptico:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-danger">
                        Error al cargar tarjetas desde Firestore: ${err.message}
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Filtra las tarjetas en caché según la búsqueda y selectores activos.
 * @returns {Array}
 */
function getFilteredSinapticoCards() {
    const searchVal = (document.getElementById("as-filter-search")?.value || "").toLowerCase().trim();
    const careerVal = document.getElementById("as-filter-career")?.value || "all";
    const typeVal = document.getElementById("as-filter-type")?.value || "all";
    const scopeVal = document.getElementById("as-filter-scope")?.value || "all";

    return sinapticoCache.filter(c => {
        const cardScope = c.ambito || (c.nivel && c.nivel !== "caces_oficial" ? "carrera" : "caces");
        if (scopeVal !== "all" && cardScope !== scopeVal) return false;
        if (careerVal !== "all" && c.carrera !== careerVal) return false;
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

/**
 * Renderiza la tabla interactiva de tarjetas Sináptico v4.4.
 */
function renderSinapticoTable() {
    const tbody = document.getElementById("as-cards-tbody");
    const countLabel = document.getElementById("as-filter-count-label");
    if (!tbody) return;

    const filtered = getFilteredSinapticoCards();
    if (countLabel) {
        countLabel.textContent = `Mostrando ${filtered.length} de ${sinapticoCache.length} tarjetas`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                    No se encontraron tarjetas Sináptico con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";
    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-surface-high hover:bg-surface/60 transition-colors";

        const frontText = item.frente || item.pregunta || "Sin frente";
        const backText = item.reverso || item.respuesta || "Sin reverso";

        const shortFront = frontText.length > 110 ? `${frontText.substring(0, 110)}...` : frontText;
        const shortBack = backText.length > 110 ? `${backText.substring(0, 110)}...` : backText;

        const typeObj = SINAPTICO_CURRICULUM.cardTypes.find(t => t.id === item.tipoTarjeta);
        const typeLabel = typeObj ? typeObj.nombre.split("/")[0].trim() : "Perla Clínica";

        tr.innerHTML = `
            <td class="px-4 py-3 align-top">
                <div class="text-white font-bold uppercase">${item.carrera || "medicina"}</div>
                <div class="text-[11px] text-secondary">${item.materia || "General"}</div>
                <div class="text-[10px] text-gray-400">${item.nivel || "caces_oficial"} ${item.subtema ? `• ${item.subtema}` : ""}</div>
            </td>
            <td class="px-4 py-3 align-top max-w-xs">
                <div class="text-gray-200 font-sans text-xs leading-relaxed">${shortFront}</div>
                ${item.imagenUrl ? `<span class="inline-block mt-1 text-[10px] text-primary font-mono">🖼️ ${item.imagenUrl}</span>` : ""}
            </td>
            <td class="px-4 py-3 align-top max-w-xs">
                <div class="text-gray-300 font-sans text-xs leading-relaxed">${shortBack}</div>
                ${item.perlaClinica ? `<div class="mt-1 text-[10px] text-warning font-sans">💡 ${item.perlaClinica.substring(0, 80)}</div>` : ""}
            </td>
            <td class="px-4 py-3 align-top">
                <span class="px-2 py-0.5 rounded bg-secondary/15 border border-secondary/40 text-secondary text-[10px] font-bold">
                    ${typeLabel}
                </span>
                <div class="text-[10px] text-gray-400 mt-1">
                    Plan: <strong>${item.planAcceso || "PRO"}</strong> • ${item.dificultad || "Media"}
                </div>
            </td>
            <td class="px-4 py-3 align-top text-right whitespace-nowrap space-x-1.5">
                <button type="button" class="btn-as-preview px-2.5 py-1.5 rounded-lg bg-surface border border-gray-600 text-gray-200 hover:border-secondary hover:text-secondary font-bold" title="Probar Volteo Sináptico">
                    🔄 Probar
                </button>
                <button type="button" class="btn-as-edit px-2.5 py-1.5 rounded-lg bg-surface border border-primary/60 text-primary hover:bg-primary hover:text-surface font-bold" title="Editar Tarjeta">
                    ✏️ Editar
                </button>
                <button type="button" class="btn-as-delete px-2.5 py-1.5 rounded-lg bg-surface border border-danger/60 text-danger hover:bg-danger hover:text-white font-bold" title="Eliminar Tarjeta">
                    🗑️
                </button>
            </td>
        `;

        tr.querySelector(".btn-as-preview")?.addEventListener("click", () => previewSinapticoCardModal(item.id));
        tr.querySelector(".btn-as-edit")?.addEventListener("click", () => editSinapticoCard(item.id));
        tr.querySelector(".btn-as-delete")?.addEventListener("click", () => deleteSinapticoCard(item.id));

        tbody.appendChild(tr);
    });
}

/**
 * Crea o actualiza una tarjeta dentro de la colección tarjetas_sinaptico en Cloud Firestore.
 * @param {Event} event
 */
export async function saveSinapticoCard(event) {
    if (event) event.preventDefault();
    if (!hasMasterPermission()) {
        alert("Acceso restringido: Solo las cuentas maestras pueden modificar los mazos Sináptico v4.4.");
        return;
    }

    const submitBtn = document.getElementById("btn-as-submit");
    const activeEmail = auth?.currentUser?.email || appState?.currentUserData?.email || MASTER_ADMINS[0];

    const frenteVal = document.getElementById("as-frente")?.value?.trim() || "";
    const reversoVal = document.getElementById("as-reverso")?.value?.trim() || "";

    if (!frenteVal || !reversoVal) {
        alert("⚠️ Completa tanto el Frente (Estímulo/Pregunta) como el Reverso (Respuesta/Conducta) de la tarjeta.");
        return;
    }

    const payload = {
        ambito: document.getElementById("as-scope")?.value || "caces",
        carrera: document.getElementById("as-carrera")?.value || "medicina",
        nivel: document.getElementById("as-nivel")?.value || "caces_oficial",
        materia: document.getElementById("as-materia")?.value || "Medicina Interna",
        tipoTarjeta: document.getElementById("as-tipo")?.value || "perla_clinica",
        dificultad: document.getElementById("as-dificultad")?.value || "Media",
        planAcceso: document.getElementById("as-plan-acceso")?.value || "PRO",
        subtema: document.getElementById("as-subtema")?.value?.trim() || "",
        frente: frenteVal,
        pregunta: frenteVal, // Alias de compatibilidad con el lector de tarjetas
        reverso: reversoVal,
        respuesta: reversoVal, // Alias de compatibilidad con el lector de tarjetas
        perlaClinica: document.getElementById("as-perla")?.value?.trim() || "",
        imagenUrl: document.getElementById("as-imagen-url")?.value?.trim() || "",
        intervalosAlgoritmo: {
            dificil: "<10m",
            bueno: "1d",
            facil: "4d"
        },
        motorVersion: "Sináptico v4.4",
        actualizadoPor: activeEmail,
        updatedAt: new Date().toISOString()
    };

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Guardando en Firestore...</span>`;
        }

        if (editingCardId) {
            await updateDoc(doc(db, SINAPTICO_COLLECTION, editingCardId), payload);
            alert("✅ Tarjeta Sináptica actualizada correctamente en Cloud Firestore.");
        } else {
            payload.createdAt = new Date().toISOString();
            payload.creadoPor = activeEmail;
            await addDoc(collection(db, SINAPTICO_COLLECTION), payload);
            alert("✅ Nueva tarjeta registrada en Repetición Espaciada • Sináptico v4.4.");
        }

        resetSinapticoForm();
        await loadSinapticoCards();
    } catch (err) {
        console.error("[AdminSinaptico] Error guardando tarjeta:", err);
        alert("Error al guardar la tarjeta en Firestore: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">save</span><span>Guardar Tarjeta en Cloud Firestore</span>`;
        }
    }
}

/**
 * Carga una tarjeta existente en el formulario administrativo para su edición.
 * @param {string} cardId
 */
export function editSinapticoCard(cardId) {
    if (!hasMasterPermission()) return;

    const item = sinapticoCache.find(c => c.id === cardId);
    if (!item) return;

    editingCardId = item.id;

    const scopeSelect = document.getElementById("as-scope");
    const careerSelect = document.getElementById("as-carrera");
    const levelSelect = document.getElementById("as-nivel");
    const subjectSelect = document.getElementById("as-materia");

    const detectedScope = item.ambito || (item.nivel && item.nivel !== "caces_oficial" ? "carrera" : "caces");
    if (scopeSelect) scopeSelect.value = detectedScope;
    populateSinapticoSelects();

    if (careerSelect) {
        careerSelect.value = item.carrera || "medicina";
        updateSinapticoSubjects();
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

    document.getElementById("as-tipo").value = item.tipoTarjeta || "perla_clinica";
    document.getElementById("as-dificultad").value = item.dificultad || "Media";
    document.getElementById("as-plan-acceso").value = item.planAcceso || "PRO";
    document.getElementById("as-subtema").value = item.subtema || "";
    document.getElementById("as-frente").value = item.frente || item.pregunta || "";
    document.getElementById("as-reverso").value = item.reverso || item.respuesta || "";
    document.getElementById("as-perla").value = item.perlaClinica || "";
    document.getElementById("as-imagen-url").value = item.imagenUrl || "";

    const badge = document.getElementById("as-form-mode-badge");
    const title = document.getElementById("as-form-mode-title");
    const cancelBtn = document.getElementById("btn-as-cancel-edit");
    const submitBtn = document.getElementById("btn-as-submit");

    if (badge) {
        badge.textContent = "MODO EDICIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-warning/20 text-warning font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = `Editando Tarjeta Sináptica ID: ${item.id}`;
    cancelBtn?.classList.remove("hidden");
    if (submitBtn) {
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">edit_note</span><span>Actualizar Tarjeta en Firestore</span>`;
    }

    document.getElementById("admin-sinaptico-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Restablece el formulario al estado de creación limpia.
 */
function resetSinapticoForm() {
    editingCardId = null;
    const form = document.getElementById("as-crud-form");
    form?.reset();
    populateSinapticoSelects();

    const badge = document.getElementById("as-form-mode-badge");
    const title = document.getElementById("as-form-mode-title");
    const cancelBtn = document.getElementById("btn-as-cancel-edit");
    const submitBtn = document.getElementById("btn-as-submit");

    if (badge) {
        badge.textContent = "MODO CREACIÓN";
        badge.className = "px-2.5 py-0.5 rounded bg-secondary/20 text-secondary font-mono text-[11px] font-bold uppercase";
    }
    if (title) title.textContent = "Nueva Tarjeta de Repetición Espaciada • Sináptico v4.4";
    cancelBtn?.classList.add("hidden");
    if (submitBtn) {
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">save</span><span>Guardar Tarjeta en Cloud Firestore</span>`;
    }
}

/**
 * Elimina de forma permanente una tarjeta de la colección tarjetas_sinaptico.
 * @param {string} cardId
 */
export async function deleteSinapticoCard(cardId) {
    if (!hasMasterPermission()) return;

    const item = sinapticoCache.find(c => c.id === cardId);
    const previewText = (item?.frente || item?.pregunta || cardId).substring(0, 80);

    if (!confirm(`¿Confirmas que deseas eliminar permanentemente esta tarjeta de Repetición Espaciada • Sináptico v4.4?\n\n"${previewText}..."`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, SINAPTICO_COLLECTION, cardId));
        if (editingCardId === cardId) {
            resetSinapticoForm();
        }
        await loadSinapticoCards();
    } catch (err) {
        console.error("[AdminSinaptico] Error al eliminar tarjeta:", err);
        alert("Error al eliminar la tarjeta: " + err.message);
    }
}

/**
 * Importa un lote masivo de tarjetas en formato .JSON hacia la colección tarjetas_sinaptico.
 */
export async function importSinapticoBatchJSON() {
    if (!hasMasterPermission()) return;

    const textarea = document.getElementById("as-json-batch-textarea");
    const importBtn = document.getElementById("btn-as-import-batch");
    const rawText = textarea?.value?.trim() || "";

    if (!rawText) {
        alert("⚠️ Pega un arreglo JSON válido o carga un archivo .JSON antes de importar.");
        return;
    }

    try {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.tarjetas_sinaptico) ? parsed.tarjetas_sinaptico : null);

        if (!list || list.length === 0) {
            throw new Error("El archivo debe contener un arreglo JSON de tarjetas sinápticas.");
        }

        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = `Importando ${list.length} tarjetas...`;
        }

        const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
        let importedCount = 0;

        for (const rawItem of list) {
            const front = String(rawItem.frente || rawItem.pregunta || "").trim();
            const back = String(rawItem.reverso || rawItem.respuesta || "").trim();
            if (!front || !back) continue;

            const normalizedCard = {
                ambito: rawItem.ambito || "caces",
                carrera: String(rawItem.carrera || "medicina").toLowerCase().trim(),
                nivel: rawItem.nivel || "caces_oficial",
                materia: rawItem.materia || "Medicina Interna",
                tipoTarjeta: rawItem.tipoTarjeta || "perla_clinica",
                dificultad: rawItem.dificultad || "Media",
                planAcceso: rawItem.planAcceso || "PRO",
                subtema: rawItem.subtema || "",
                frente: front,
                pregunta: front,
                reverso: back,
                respuesta: back,
                perlaClinica: String(rawItem.perlaClinica || "").trim(),
                imagenUrl: String(rawItem.imagenUrl || "").trim(),
                intervalosAlgoritmo: {
                    dificil: "<10m",
                    bueno: "1d",
                    facil: "4d"
                },
                motorVersion: "Sináptico v4.4",
                creadoPor: activeEmail,
                createdAt: rawItem.createdAt || new Date().toISOString()
            };

            await addDoc(collection(db, SINAPTICO_COLLECTION), normalizedCard);
            importedCount++;
        }

        alert(`✅ Importación masiva completada: ${importedCount} tarjetas subidas a ${SINAPTICO_COLLECTION}.`);
        if (textarea) textarea.value = "";
        await loadSinapticoCards();
    } catch (err) {
        console.error("[AdminSinaptico] Error en importación JSON:", err);
        alert("Error de importación: Verifica que la sintaxis JSON sea válida.\nDetalle: " + err.message);
    } finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span><span>Procesar e Importar Mazo JSON</span>`;
        }
    }
}

/**
 * Convierte automáticamente reactivos de la colección preguntas_caces en tarjetas
 * de Repetición Espaciada • Sináptico v4.4 evitando duplicados por sourceQuestionId.
 */
export async function generateCardsFromCacesQuestions() {
    if (!hasMasterPermission()) return;

    const syncBtn = document.getElementById("btn-sync-from-caces");

    try {
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `<span>Analizando Banco CACES...</span>`;
        }

        const questionsSnap = await getDocs(collection(db, QUESTIONS_COLLECTION));
        if (questionsSnap.empty) {
            alert("No se encontraron reactivos en la colección preguntas_caces para convertir.");
            return;
        }

        const existingSourceIds = new Set(
            sinapticoCache
                .map(c => c.sourceQuestionId)
                .filter(Boolean)
        );

        const activeEmail = auth?.currentUser?.email || MASTER_ADMINS[0];
        let createdCount = 0;

        for (const qDoc of questionsSnap.docs) {
            if (existingSourceIds.has(qDoc.id)) continue;

            const q = qDoc.data();
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
                subtema: q.subtema || "Caso Clínico CACES",
                frente: q.enunciado,
                pregunta: q.enunciado,
                reverso: `Respuesta Correcta (${correctLetter}): ${correctOptionText}`,
                respuesta: `Respuesta Correcta (${correctLetter}): ${correctOptionText}`,
                perlaClinica: q.racional || "",
                imagenUrl: q.imagenUrl || "",
                intervalosAlgoritmo: {
                    dificil: "<10m",
                    bueno: "1d",
                    facil: "4d"
                },
                motorVersion: "Sináptico v4.4",
                creadoPor: activeEmail,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, SINAPTICO_COLLECTION), newCard);
            createdCount++;
        }

        if (createdCount === 0) {
            alert("ℹ️ Todos los reactivos actuales de preguntas_caces ya cuentan con su tarjeta Sináptica correspondiente.");
        } else {
            alert(`✅ Conversión completada: Se generaron ${createdCount} nuevas tarjetas en ${SINAPTICO_COLLECTION} a partir del banco CACES.`);
            await loadSinapticoCards();
        }
    } catch (err) {
        console.error("[AdminSinaptico] Error generando tarjetas desde preguntas_caces:", err);
        alert("Error al generar tarjetas desde el banco CACES: " + err.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `<span class="material-symbols-outlined text-sm">auto_awesome</span><span>Generar desde Banco CACES</span>`;
        }
    }
}

/**
 * Abre el modal interactivo para probar el volteo (Cara A / Cara B) de una tarjeta.
 * @param {string} cardId
 */
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
        metaEl.textContent = `${(item.carrera || "medicina").toUpperCase()} • ${item.nivel || "CACES"} • ${item.materia || "General"}`;
    }
    if (subtemaEl) {
        subtemaEl.textContent = item.subtema || "Repetición Espaciada • Sináptico v4.4";
    }
    if (faceBadge) {
        faceBadge.textContent = "CARA A • ESTÍMULO CLÍNICO";
        faceBadge.className = "px-2.5 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] font-bold uppercase";
    }

    if (item.imagenUrl && imgBox && imgEl) {
        imgEl.src = item.imagenUrl;
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

/**
 * Alterna entre el frente y el reverso dentro del modal de simulación de tarjeta.
 */
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

/**
 * Cierra el modal de simulación de tarjeta Sináptica.
 */
function closePreviewModal() {
    const modal = document.getElementById("as-preview-modal");
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
}

/**
 * Descarga las tarjetas actualmente filtradas en pantalla como un archivo .JSON.
 */
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
