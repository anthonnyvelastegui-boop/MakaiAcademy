// ============================================================================
// ARCHIVO: js/1-admin/admin.questions.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Estación de Carga de Reactivos CACES y Semestrales con
//                  Árbol Visual, Candado de Ruta Forzada, Importador Masivo
//                  Excel/TSV y Cuarentena de Publicación para Digitadores.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

import { makaiData } from "../2-core/curriculum.data.js";

let selectedRoute = {
    carrera: "medicina",
    semestre: 10,
    materia: "Medicina Interna",
    locked: true // Candado de Ruta Forzada activo por defecto
};

let cachedQuestions = [];

/**
 * Genera un ID clínico legible: CACES-[CARRERA]-[MATERIA]-[TIMESTAMP]
 */
function buildQuestionDeterministicId(carrera, materia) {
    const carCode = String(carrera || "med").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "MED";
    const matCode = String(materia || "gen")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3) || "GEN";
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    const rand = Math.floor(100 + Math.random() * 900);
    return `CACES-${carCode}-${matCode}-${stamp}${rand}`;
}

/**
 * Obtiene las materias disponibles para la carrera y semestre seleccionados en el árbol.
 */
function getSubjectsForSelectedRoute() {
    const allCareers = window.makaiData?.carreras || makaiData.carreras || [];
    const careerObj = allCareers.find(c => c.id === selectedRoute.carrera) || allCareers[0];
    if (!careerObj) return ["General"];

    if (careerObj.semestres && Array.isArray(careerObj.semestres[selectedRoute.semestre])) {
        return [...careerObj.semestres[selectedRoute.semestre], ...(careerObj.materias || [])];
    }
    return careerObj.materias || ["General"];
}

/**
 * Descarga los reactivos existentes en `preguntas_caces`.
 */
async function loadQuestionsFromFirestore() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.QUESTIONS));
        cachedQuestions = [];
        snap.forEach(d => cachedQuestions.push({ id: d.id, ...d.data() }));
        cachedQuestions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    } catch (err) {
        console.warn("[AdminQuestions] Error cargando preguntas:", err.message);
    }
}

/**
 * Inicializador principal invocado por `admin.controller.js`.
 */
export async function initAdminQuestions(passedRole = null) {
    const mount = document.getElementById("admin-questions-mount");
    if (!mount) return;

    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    const isMaster = isMasterAdmin(email) || passedRole === "master";

    await loadQuestionsFromFirestore();
    renderQuestionsWorkstation(mount, isMaster);
}

function renderQuestionsWorkstation(mount, isMaster) {
    const allCareers = window.makaiData?.carreras || makaiData.carreras || [];
    const subjectsList = [...new Set(getSubjectsForSelectedRoute())];
    if (!subjectsList.includes(selectedRoute.materia)) {
        selectedRoute.materia = subjectsList[0] || "Medicina Interna";
    }

    const quarantineList = cachedQuestions.filter(q => q.estadoRevision === "pendiente_revision");
    const publishedList = cachedQuestions.filter(q => q.estadoRevision !== "pendiente_revision");

    mount.innerHTML = `
        <div class="bg-surface-container border border-primary/40 rounded-2xl p-6 space-y-6 shadow-xl">
            <!-- CABECERA DEL MÓDULO 1: BANCO DE REACTIVOS CACES -->
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase font-bold">
                        ● ESTACIÓN 1 DE 3 • FÁBRICA DE REACTIVOS CACES & CARRERAS
                    </span>
                    <h3 class="text-xl font-extrabold text-white mt-0.5">
                        Árbol Visual de Ruta Forzada & Importador Masivo
                    </h3>
                    <p class="text-xs text-gray-400">
                        ${isMaster
                            ? "Tus cargas como Master Admin se publican al instante. También puedes aprobar lotes en cuarentena subidos por digitadores."
                            : "Modo Digitador Activo: Selecciona la ruta en el árbol superior. Todo lo que subas entrará en Cuarentena de Revisión."}
                    </p>
                </div>

                <div class="flex items-center gap-2 text-xs font-mono">
                    <span class="px-3 py-1.5 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary font-extrabold">
                        Publicados: ${publishedList.length}
                    </span>
                    <span class="px-3 py-1.5 rounded-xl bg-warning/15 border border-warning/40 text-warning font-extrabold">
                        En Cuarentena: ${quarantineList.length}
                    </span>
                </div>
            </div>

            <!-- PASO 1: EL ÁRBOL VISUAL CON CANDADO DE RUTA FORZADA (Cero tipeo de carpetas) -->
            <div class="bg-surface border-2 ${selectedRoute.locked ? "border-primary" : "border-surface-high"} rounded-2xl p-5 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined ${selectedRoute.locked ? "text-primary" : "text-gray-400"}">
                            ${selectedRoute.locked ? "lock" : "lock_open"}
                        </span>
                        <span class="text-xs font-mono font-extrabold text-white uppercase">
                            RUTA ACTIVA DE INYECCIÓN:
                            <span class="text-primary">${selectedRoute.carrera.toUpperCase()}</span> ➔
                            <span class="text-secondary">SEMESTRE ${selectedRoute.semestre}</span> ➔
                            <span class="text-warning">${selectedRoute.materia}</span>
                        </span>
                    </div>

                    <button type="button" id="btn-toggle-route-lock"
                        class="px-3.5 py-1.5 rounded-xl font-mono text-xs font-extrabold transition-all ${
                            selectedRoute.locked
                                ? "bg-primary text-surface"
                                : "bg-surface-container border border-warning text-warning"
                        }">
                        ${selectedRoute.locked ? "🔒 Candado de Ruta ACTIVADO (Desbloquear para cambiar)" : "🔓 Ruta Desbloqueada (Fijar Candado)"}
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">1. Carrera Oficial</label>
                        <select id="q-tree-career" ${selectedRoute.locked ? "disabled" : ""}
                            class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold disabled:opacity-60">
                            ${allCareers.map(c => `<option value="${c.id}" ${c.id === selectedRoute.carrera ? "selected" : ""}>${c.nombre}</option>`).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">2. Semestre / Etapa</label>
                        <select id="q-tree-semester" ${selectedRoute.locked ? "disabled" : ""}
                            class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold disabled:opacity-60">
                            ${Array.from({ length: 10 }, (_, i) => i + 1).map(s => `
                                <option value="${s}" ${s === Number(selectedRoute.semestre) ? "selected" : ""}>
                                    ${s >= 9 ? `${s}° Semestre (Internado / CACES)` : `${s}° Semestre Universitario`}
                                </option>
                            `).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">3. Asignatura / Eje CACES</label>
                        <select id="q-tree-subject" ${selectedRoute.locked ? "disabled" : ""}
                            class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold disabled:opacity-60">
                            ${subjectsList.map(sub => `<option value="${sub}" ${sub === selectedRoute.materia ? "selected" : ""}>${sub}</option>`).join("")}
                        </select>
                    </div>
                </div>
            </div>

            <!-- PASO 2: FORMULARIO UNITARIO + IMPORTADOR MASIVO EXCEL/TSV -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Columna Izquierda (7 cols): Carga Unitaria Guiada -->
                <form id="admin-single-question-form" class="lg:col-span-7 bg-surface border border-surface-high rounded-2xl p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-extrabold text-white font-mono uppercase">
                            ➕ Subir Reactivo Clínico Individual
                        </h4>
                        <select id="q-single-difficulty"
                            class="bg-surface-container border border-surface-high rounded-lg px-2.5 py-1 text-xs font-mono text-primary">
                            <option value="Alta">Dificultad: Alta (CACES)</option>
                            <option value="Media">Dificultad: Media</option>
                            <option value="Básica">Dificultad: Básica</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Caso Clínico / Enunciado *</label>
                        <textarea id="q-single-stem" rows="3" required
                            placeholder="Paciente masculino de 58 años acude a urgencias por..."
                            class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label class="block text-[10px] font-mono text-secondary uppercase mb-1">Opción A *</label>
                            <input type="text" id="q-opt-a" required placeholder="A) ..."
                                class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-[10px] font-mono text-gray-300 uppercase mb-1">Opción B *</label>
                            <input type="text" id="q-opt-b" required placeholder="B) ..."
                                class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-[10px] font-mono text-gray-300 uppercase mb-1">Opción C *</label>
                            <input type="text" id="q-opt-c" required placeholder="C) ..."
                                class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-[10px] font-mono text-gray-300 uppercase mb-1">Opción D *</label>
                            <input type="text" id="q-opt-d" required placeholder="D) ..."
                                class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-white">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label class="block text-[10px] font-mono text-primary uppercase mb-1 font-bold">Respuesta Correcta *</label>
                            <select id="q-correct-index"
                                class="w-full bg-surface-container border border-primary/50 rounded-xl px-3 py-2 text-white font-mono font-bold">
                                <option value="0">Literal A (Índice 0)</option>
                                <option value="1">Literal B (Índice 1)</option>
                                <option value="2">Literal C (Índice 2)</option>
                                <option value="3">Literal D (Índice 3)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Imagen Clínica Opcional (Ruta o URL)</label>
                            <input type="text" id="q-image-url" placeholder="assets/4-banco-clinico/electrocardiografia/ecg01.png"
                                class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-white font-mono">
                        </div>
                    </div>

                    <div>
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Racional Clínico Oficial (Justificación GPC-MSP) *</label>
                        <textarea id="q-single-rationale" rows="2" required
                            placeholder="Según la GPC del MSP de Ecuador, el tratamiento de primera línea es..."
                            class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-high">
                        <label class="flex items-center gap-2 text-xs font-mono text-secondary cursor-pointer">
                            <input type="checkbox" id="q-auto-create-sinaptico" checked class="accent-secondary w-4 h-4">
                            <span>Crear también Tarjeta Sináptico v4.4 automáticamente</span>
                        </label>

                        <button type="submit"
                            class="px-5 py-2.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase">
                            💾 Guardar en Ruta Forzada
                        </button>
                    </div>
                </form>

                <!-- Columna Derecha (5 cols): Importador Masivo Excel / TSV con Candado -->
                <div class="lg:col-span-5 bg-surface border border-surface-high rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <div class="space-y-3">
                        <span class="text-[10px] font-mono text-secondary uppercase font-bold">
                            ⚡ IMPORTACIÓN MASIVA DESDE EXCEL / GOOGLE SHEETS
                        </span>
                        <h4 class="text-sm font-extrabold text-white">
                            Pega 50 o 100 Preguntas de Golpe (Sin Escribir Rutas)
                        </h4>
                        <p class="text-[11px] text-gray-400 leading-relaxed">
                            Copia tus filas desde Excel con 7 columnas separadas por tabulación (<code>TAB</code>) o barra vertical (<code>|</code>):<br>
                            <code class="text-primary">Enunciado | Opción A | Opción B | Opción C | Opción D | Correcta (A/B/C/D) | Racional</code>
                        </p>

                        <textarea id="q-bulk-tsv-input" rows="8"
                            placeholder="Gestante 34 sem con PA 170/110... | Sulfato Magnesio 4g | Fenitoína | Diazepam | Nifedipino | A | Según Clave Azul MSP..."
                            class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs font-mono text-gray-200 focus:border-secondary focus:outline-none"></textarea>
                    </div>

                    <button type="button" id="btn-process-bulk-questions"
                        class="w-full py-3 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-opacity-90">
                        🚀 Inyectar Lote en ${selectedRoute.carrera.toUpperCase()} (${selectedRoute.materia})
                    </button>
                </div>
            </div>

            <!-- PASO 3: BANDEJA DE CUARENTENA (EXCLUSIVO MASTER ADMIN) -->
            ${isMaster && quarantineList.length > 0 ? `
                <div class="bg-surface border-2 border-warning rounded-2xl p-5 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <span class="text-[10px] font-mono text-warning uppercase font-extrabold">
                                🛡️ CUARENTENA DE PUBLICACIÓN • TRABAJO DE DIGITADORES
                            </span>
                            <h4 class="text-base font-extrabold text-white">
                                ${quarantineList.length} Reactivos esperando tu visto bueno antes de ser visibles a los alumnos
                            </h4>
                        </div>
                        <button type="button" id="btn-approve-all-quarantine"
                            class="px-4 py-2.5 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                            ✅ Aprobar Todo el Lote (${quarantineList.length})
                        </button>
                    </div>

                    <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        ${quarantineList.map(q => `
                            <div class="bg-surface-container border border-surface-high rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div class="max-w-2xl">
                                    <span class="font-mono text-[10px] text-primary uppercase font-bold">
                                        [${q.id}] ${q.carrera} • Sem ${q.semestre || 10} • ${q.materia} (Subido por: ${q.creadoPor || "digitador"})
                                    </span>
                                    <p class="text-white font-semibold mt-0.5 line-clamp-2">${q.enunciado}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button type="button" data-approve-q="${q.id}"
                                        class="px-3 py-1.5 rounded-lg bg-secondary text-surface font-mono font-extrabold text-xs">
                                        ✅ Publicar
                                    </button>
                                    <button type="button" data-delete-q="${q.id}"
                                        class="px-3 py-1.5 rounded-lg bg-danger/20 border border-danger text-danger font-mono font-bold text-xs">
                                        🗑️ Borrar
                                    </button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : ""}
        </div>
    `;

    // Enlazar Candado de Ruta Forzada
    document.getElementById("btn-toggle-route-lock")?.addEventListener("click", () => {
        selectedRoute.locked = !selectedRoute.locked;
        renderQuestionsWorkstation(mount, isMaster);
    });

    document.getElementById("q-tree-career")?.addEventListener("change", (e) => {
        selectedRoute.carrera = e.target.value;
        const subs = getSubjectsForSelectedRoute();
        selectedRoute.materia = subs[0] || "General";
        renderQuestionsWorkstation(mount, isMaster);
        window.dispatchEvent(new CustomEvent("makai:adminRouteChanged", { detail: selectedRoute }));
    });

    document.getElementById("q-tree-semester")?.addEventListener("change", (e) => {
        selectedRoute.semestre = Number(e.target.value || 10);
        const subs = getSubjectsForSelectedRoute();
        selectedRoute.materia = subs[0] || "General";
        renderQuestionsWorkstation(mount, isMaster);
        window.dispatchEvent(new CustomEvent("makai:adminRouteChanged", { detail: selectedRoute }));
    });

    document.getElementById("q-tree-subject")?.addEventListener("change", (e) => {
        selectedRoute.materia = e.target.value;
        renderQuestionsWorkstation(mount, isMaster);
        window.dispatchEvent(new CustomEvent("makai:adminRouteChanged", { detail: selectedRoute }));
    });

    // Guardar Reactivo Individual
    document.getElementById("admin-single-question-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const enunciado = document.getElementById("q-single-stem")?.value.trim() || "";
        const optA = document.getElementById("q-opt-a")?.value.trim() || "";
        const optB = document.getElementById("q-opt-b")?.value.trim() || "";
        const optC = document.getElementById("q-opt-c")?.value.trim() || "";
        const optD = document.getElementById("q-opt-d")?.value.trim() || "";
        const correcta = Number(document.getElementById("q-correct-index")?.value || 0);
        const racional = document.getElementById("q-single-rationale")?.value.trim() || "";
        const dificultad = document.getElementById("q-single-difficulty")?.value || "Alta";
        const imagenUrl = document.getElementById("q-image-url")?.value.trim() || null;
        const autoSinaptico = document.getElementById("q-auto-create-sinaptico")?.checked ?? false;

        const qId = buildQuestionDeterministicId(selectedRoute.carrera, selectedRoute.materia);
        const optionsArr = [optA, optB, optC, optD];
        const nowIso = new Date().toISOString();

        const questionDoc = {
            id: qId,
            carrera: selectedRoute.carrera,
            semestre: Number(selectedRoute.semestre),
            materia: selectedRoute.materia,
            dificultad,
            enunciado,
            opciones: optionsArr,
            correcta,
            racional,
            imagenUrl,
            estadoRevision: isMaster ? "publicado" : "pendiente_revision",
            creadoPor: auth.currentUser?.email || "staff",
            createdAt: nowIso
        };

        await setDoc(doc(db, COLLECTIONS.QUESTIONS, qId), questionDoc);

        if (autoSinaptico) {
            const sinId = `SIN-${qId}`;
            await setDoc(doc(db, COLLECTIONS.SINAPTICO, sinId), {
                id: sinId,
                carrera: selectedRoute.carrera,
                semestre: Number(selectedRoute.semestre),
                materia: selectedRoute.materia,
                frente: enunciado,
                reverso: `✅ Respuesta: ${optionsArr[correcta]}\n\n🩺 Racional: ${racional}`,
                dificultad,
                origenReactivoId: qId,
                estadoRevision: isMaster ? "publicado" : "pendiente_revision",
                createdAt: nowIso
            });
        }

        window.MakaiSecurityGuard?.showSecurityToast?.(
            isMaster ? `✅ Reactivo ${qId} publicado.` : `⏳ Reactivo ${qId} enviado a Cuarentena de Revisión.`,
            "success"
        );
        await loadQuestionsFromFirestore();
        renderQuestionsWorkstation(mount, isMaster);
    });

    // Procesar Importación Masiva Excel / TSV
    document.getElementById("btn-process-bulk-questions")?.addEventListener("click", async () => {
        const raw = document.getElementById("q-bulk-tsv-input")?.value.trim() || "";
        if (!raw) return;

        const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
        let importedCount = 0;
        const nowIso = new Date().toISOString();

        for (const line of lines) {
            const parts = line.includes("\t") ? line.split("\t") : line.split("|");
            if (parts.length < 6) continue;

            const [stem, a, b, c, d, ansRaw, ratRaw] = parts.map(p => p.trim());
            const letterMap = { A: 0, B: 1, C: 2, D: 3, "0": 0, "1": 1, "2": 2, "3": 3 };
            const correctIdx = letterMap[String(ansRaw || "A").toUpperCase().charAt(0)] ?? 0;
            const qId = buildQuestionDeterministicId(selectedRoute.carrera, selectedRoute.materia);

            await setDoc(doc(db, COLLECTIONS.QUESTIONS, qId), {
                id: qId,
                carrera: selectedRoute.carrera,
                semestre: Number(selectedRoute.semestre),
                materia: selectedRoute.materia,
                dificultad: "Alta",
                enunciado: stem,
                opciones: [a, b, c, d],
                correcta: correctIdx,
                racional: ratRaw || "Protocolo Oficial CACES / MSP.",
                estadoRevision: isMaster ? "publicado" : "pendiente_revision",
                creadoPor: auth.currentUser?.email || "staff",
                createdAt: nowIso
            });
            importedCount++;
        }

        window.MakaiSecurityGuard?.showSecurityToast?.(
            `🚀 ${importedCount} reactivos inyectados en ${selectedRoute.materia}.`,
            "success"
        );
        await loadQuestionsFromFirestore();
        renderQuestionsWorkstation(mount, isMaster);
    });

    // Aprobar todo el lote en cuarentena (Solo Master Admin)
    document.getElementById("btn-approve-all-quarantine")?.addEventListener("click", async () => {
        for (const q of quarantineList) {
            await updateDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), { estadoRevision: "publicado" });
        }
        window.MakaiSecurityGuard?.showSecurityToast?.(`✅ ${quarantineList.length} reactivos liberados al túnel estudiantil.`, "success");
        await loadQuestionsFromFirestore();
        renderQuestionsWorkstation(mount, isMaster);
    });

    mount.querySelectorAll("[data-approve-q]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await updateDoc(doc(db, COLLECTIONS.QUESTIONS, btn.dataset.approveQ), { estadoRevision: "publicado" });
            await loadQuestionsFromFirestore();
            renderQuestionsWorkstation(mount, isMaster);
        });
    });

    mount.querySelectorAll("[data-delete-q]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, btn.dataset.deleteQ));
            await loadQuestionsFromFirestore();
            renderQuestionsWorkstation(mount, isMaster);
        });
    });
}

export function getSelectedAdminRoute() {
    return selectedRoute;
}
