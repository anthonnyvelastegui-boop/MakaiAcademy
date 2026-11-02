// ============================================================================
// ARCHIVO: js/1-admin/admin.backups.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD:
//   1. Fábrica Autónoma de Reactivos "Makai AI" (Extracción Multimodal RAG
//      Costo $0 desde PDFs, Infografías y Placas hacia Cuarentena CACES).
//   2. Botón del Pánico: Exportación y Restauración Física en formato .JSON
//      de todas las colecciones críticas de Cloud Firestore.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    setDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

import { makaiData } from "../2-core/curriculum.data.js";
import { getSelectedAdminRoute } from "./admin.questions.js";

const LOCAL_AI_KEY_STORAGE = "makai_master_gemini_api_key_v1";
let selectedMultimodalFile = null;
let selectedMultimodalBase64 = null;
let generatedPreviewBatch = [];

/**
 * Convierte un archivo PDF o Imagen en Base64 puro (sin cabecera data:) para envío multimodal.
 */
function fileToInlineBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
        reader.onload = () => {
            const full = String(reader.result || "");
            const base64Clean = full.includes(",") ? full.split(",")[1] : full;
            resolve({
                mimeType: file.type || "application/pdf",
                data: base64Clean,
                name: file.name,
                sizeKB: Math.round(file.size / 1024)
            });
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Genera un ID determinístico para los reactivos creados por Makai AI.
 */
function buildAIQuestionId(carrera, materia, idx = 1) {
    const car = String(carrera || "MED").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "MED";
    const mat = String(materia || "GEN")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3) || "GEN";
    const stamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `CACES-AI-${car}-${mat}-${stamp}${String(idx).padStart(2, "0")}`;
}

/**
 * Inicializador principal invocado por `admin.controller.js`.
 */
export async function initAdminBackups(passedRole = null) {
    const mount = document.getElementById("admin-tab-panel-backups");
    if (!mount) return;

    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    if (!isMasterAdmin(email) && passedRole !== "master") {
        mount.innerHTML = "";
        return;
    }

    renderBackupsAndAIFactory(mount);
}

function renderBackupsAndAIFactory(mount) {
    const savedApiKey = localStorage.getItem(LOCAL_AI_KEY_STORAGE) || "";
    const allCareers = window.makaiData?.carreras || makaiData.carreras || [];
    const currentRoute = getSelectedAdminRoute();

    mount.innerHTML = `
        <div class="space-y-6">
            <!-- =========================================================== -->
            <!-- BLOQUE 1: FÁBRICA AUTÓNOMA DE REACTIVOS MAKAI AI (COSTO $0) -->
            <!-- =========================================================== -->
            <div class="bg-surface-container border-2 border-primary/60 rounded-2xl p-6 space-y-5 shadow-2xl">
                <div class="flex flex-wrap items-start justify-between gap-4 border-b border-surface-high pb-4">
                    <div>
                        <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-extrabold">
                            ● FÁBRICA AUTÓNOMA MAKAI AI • MOTOR RAG MULTIMODAL COSTO $0
                        </span>
                        <h3 class="text-xl font-extrabold text-white mt-0.5">
                            Extractor Clínico de PDFs, Guías GPC-MSP, Infografías e Imágenes
                        </h3>
                        <p class="text-xs text-gray-400 mt-1 max-w-3xl">
                            Sube un PDF o imagen médica. Makai AI analizará exclusivamente ese documento (Cero Alucinaciones) y redactará los casos clínicos con Opciones A, B, C, D y Racional Oficial enviándolos directo a tu Bandeja de Cuarentena.
                        </p>
                    </div>

                    <span class="px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/40 text-primary font-mono text-xs font-extrabold">
                        🤖 Identidad: 100% Makai AI
                    </span>
                </div>

                <!-- Configuración de Llave Gratuita Google AI Studio (Oculta en el navegador del Master Admin) -->
                <div class="bg-surface border border-surface-high rounded-xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div class="lg:col-span-6">
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">
                            🔑 Llave Privada Gratuita (Google AI Studio • Gemini 1.5 API Key)
                        </label>
                        <input type="password" id="ai-factory-api-key" value="${savedApiKey}"
                            placeholder="Pega aquí tu API Key gratuita (AIzaSy...)"
                            class="w-full bg-surface-container border border-surface-high rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none">
                    </div>
                    <div class="lg:col-span-3">
                        <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Modelo Cognitivo</label>
                        <select id="ai-factory-model"
                            class="w-full bg-surface-container border border-surface-high rounded-xl px-3 py-2 text-xs text-white font-mono">
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido • Capa Gratuita Alta)</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Máxima Profundidad Clínica)</option>
                        </select>
                    </div>
                    <div class="lg:col-span-3">
                        <button type="button" id="btn-save-ai-key"
                            class="w-full py-2 px-4 rounded-xl bg-surface-container border border-primary text-primary hover:bg-primary hover:text-surface font-mono font-extrabold text-xs transition-all">
                            💾 Guardar Llave en Bóveda Local
                        </button>
                    </div>
                </div>

                <!-- Selector de Ruta de Destino + Carga de Documento PDF/Imagen -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label class="block text-[10px] font-mono text-primary uppercase mb-1 font-bold">Carrera Destino</label>
                        <select id="ai-target-career"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold">
                            ${allCareers.map(c => `<option value="${c.id}" ${c.id === currentRoute.carrera ? "selected" : ""}>${c.nombre}</option>`).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-secondary uppercase mb-1 font-bold">Semestre / Etapa</label>
                        <select id="ai-target-semester"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold">
                            ${Array.from({ length: 10 }, (_, i) => i + 1).map(s => `
                                <option value="${s}" ${s === Number(currentRoute.semestre) ? "selected" : ""}>Semestre ${s}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-warning uppercase mb-1 font-bold">Materia / Eje CACES</label>
                        <input type="text" id="ai-target-subject" value="${currentRoute.materia || "Medicina Interna"}"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white font-bold">
                    </div>
                    <div>
                        <label class="block text-[10px] font-mono text-gray-300 uppercase mb-1 font-bold">Cantidad de Reactivos</label>
                        <select id="ai-question-count"
                            class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white font-mono font-bold">
                            <option value="5">Generar 5 Reactivos CACES</option>
                            <option value="10" selected>Generar 10 Reactivos CACES</option>
                            <option value="20">Generar 20 Reactivos CACES</option>
                            <option value="30">Generar 30 Reactivos CACES</option>
                        </select>
                    </div>
                </div>

                <!-- Zona de Carga Multimodal (PDF, JPG, PNG, WEBP) + Texto Opcional -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="bg-surface border-2 border-dashed border-primary/50 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                        <div>
                            <span class="text-[10px] font-mono text-primary uppercase font-bold block">
                                1. SUBIR DOCUMENTO OFICIAL (PDF / INFOGRAFÍA / IMAGEN CLÍNICA)
                            </span>
                            <p class="text-xs text-gray-400 mt-1">
                                Acepta Guías de Práctica Clínica en <code>.pdf</code>, fotos de tablas farmacológicas, placas o esquemas en cualquier idioma (los traduce y adapta al español clínico ecuatoriano).
                            </p>
                        </div>

                        <label for="ai-multimodal-file-input"
                            class="cursor-pointer py-3 px-4 rounded-xl bg-surface-container border border-primary/40 hover:border-primary text-primary font-mono font-extrabold text-xs text-center block transition-all">
                            <span id="ai-file-label">📄 Seleccionar PDF o Imagen Médica (Máx. 15 MB)</span>
                        </label>
                        <input type="file" id="ai-multimodal-file-input" accept="application/pdf,image/jpeg,image/png,image/webp" class="hidden">
                    </div>

                    <div class="bg-surface border border-surface-high rounded-2xl p-4 space-y-2">
                        <label class="block text-[10px] font-mono text-gray-400 uppercase font-bold">
                            2. O Pega Fragmento de Guía Clínica / Algoritmo / Artículo (Opcional)
                        </label>
                        <textarea id="ai-source-text-input" rows="4"
                            placeholder="Pega aquí texto de la GPC-MSP, criterios diagnósticos o algoritmos si no deseas adjuntar archivo..."
                            class="w-full bg-surface-container border border-surface-high rounded-xl p-3 text-xs text-white focus:border-primary focus:outline-none"></textarea>
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span id="ai-factory-status" class="text-xs font-mono text-gray-400">
                        Esperando documento o texto clínico para iniciar extracción RAG...
                    </span>

                    <button type="button" id="btn-run-ai-extraction"
                        class="px-6 py-3.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-opacity-90 transition-all shadow-[0_0_25px_rgba(0,229,255,0.3)]">
                        🧠 Ejecutar Extracción Makai AI → Enviar a Cuarentena
                    </button>
                </div>

                <!-- Previsualización del Lote Generado por Makai AI -->
                <div id="ai-generated-preview-container" class="hidden space-y-3 pt-4 border-t border-surface-high"></div>
            </div>

            <!-- =========================================================== -->
            <!-- BLOQUE 2: EL BOTÓN DEL PÁNICO (RESPALDOS FÍSICOS .JSON)     -->
            <!-- =========================================================== -->
            <div class="bg-surface-container border-2 border-secondary/50 rounded-2xl p-6 space-y-5 shadow-xl">
                <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                    <div>
                        <span class="text-[10px] font-mono text-secondary uppercase font-extrabold">
                            ● EL BOTÓN DEL PÁNICO • INMUTABILIDAD DE BASE DE DATOS
                        </span>
                        <h3 class="text-xl font-extrabold text-white mt-0.5">
                            Copias de Seguridad Físicas (.JSON) en 1 Clic
                        </h3>
                        <p class="text-xs text-gray-400 mt-1">
                            Descarga una copia completa de tus planes, preguntas CACES, tarjetas Sináptico v4.4, biblioteca 1D y tutores VIP, o restaura un archivo <code>.json</code> ante cualquier eventualidad sin tocar código.
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <!-- Exportar Todo -->
                    <div class="bg-surface border border-surface-high rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div>
                            <h4 class="text-sm font-extrabold text-white font-mono uppercase">
                                📥 1. Descargar Copia de Seguridad Maestra
                            </h4>
                            <p class="text-xs text-gray-400 mt-1">
                                Empaqueta en un solo archivo <code>MAKAI-BACKUP-TOTAL.json</code> las 5 colecciones de contenido de Cloud Firestore.
                            </p>
                        </div>
                        <button type="button" id="btn-export-full-json-backup"
                            class="w-full py-3 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-opacity-90">
                            💾 Descargar Respaldo Completo (.JSON)
                        </button>
                    </div>

                    <!-- Restaurar desde archivo .JSON -->
                    <div class="bg-surface border border-surface-high rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div>
                            <h4 class="text-sm font-extrabold text-warning font-mono uppercase">
                                📤 2. Restaurar Base de Datos desde Archivo .JSON
                            </h4>
                            <p class="text-xs text-gray-400 mt-1">
                                Selecciona un archivo de respaldo previamente descargado para reinyectar todos los documentos automáticamente.
                            </p>
                        </div>
                        <label for="backup-json-restore-input"
                            class="cursor-pointer w-full py-3 rounded-xl bg-surface-container border-2 border-warning text-warning hover:bg-warning hover:text-surface font-mono font-extrabold text-xs uppercase text-center block transition-all">
                            🔄 Seleccionar Archivo .JSON y Restaurar Ahora
                        </label>
                        <input type="file" id="backup-json-restore-input" accept="application/json,.json" class="hidden">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Guardar API Key en el navegador del Administrador Maestro
    document.getElementById("btn-save-ai-key")?.addEventListener("click", () => {
        const keyVal = document.getElementById("ai-factory-api-key")?.value.trim() || "";
        localStorage.setItem(LOCAL_AI_KEY_STORAGE, keyVal);
        window.MakaiSecurityGuard?.showSecurityToast?.("🔑 Llave de Makai AI guardada localmente en tu navegador.", "success");
    });

    // Seleccionar archivo PDF o Imagen para extracción multimodal
    document.getElementById("ai-multimodal-file-input")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const label = document.getElementById("ai-file-label");
        try {
            if (label) label.textContent = "Procesando archivo para lectura multimodal...";
            selectedMultimodalBase64 = await fileToInlineBase64(file);
            selectedMultimodalFile = file;
            if (label) {
                label.textContent = `✅ Listo: ${selectedMultimodalBase64.name} (${selectedMultimodalBase64.sizeKB} KB)`;
            }
        } catch (err) {
            selectedMultimodalBase64 = null;
            if (label) label.textContent = "❌ Error al leer archivo. Intenta de nuevo.";
        }
    });

    // Ejecutar Extracción Multimodal RAG y enviar a Cuarentena
    document.getElementById("btn-run-ai-extraction")?.addEventListener("click", async () => {
        await runMakaiAIQuestionFactory();
    });

    // Descargar Respaldo Completo .JSON
    document.getElementById("btn-export-full-json-backup")?.addEventListener("click", async () => {
        await exportFullFirestoreBackupJSON();
    });

    // Restaurar desde archivo .JSON
    document.getElementById("backup-json-restore-input")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await restoreFullFirestoreBackupJSON(file);
    });
}

/**
 * Ejecuta el motor RAG de Makai AI conectándose al endpoint multimodal de Gemini
 * y deposita las preguntas generadas en Cuarentena (`pendiente_revision`).
 */
async function runMakaiAIQuestionFactory() {
    const apiKey = (document.getElementById("ai-factory-api-key")?.value || localStorage.getItem(LOCAL_AI_KEY_STORAGE) || "").trim();
    const modelName = document.getElementById("ai-factory-model")?.value || "gemini-1.5-flash";
    const career = document.getElementById("ai-target-career")?.value || "medicina";
    const semester = Number(document.getElementById("ai-target-semester")?.value || 10);
    const subject = document.getElementById("ai-target-subject")?.value.trim() || "Medicina Interna";
    const count = Number(document.getElementById("ai-question-count")?.value || 10);
    const rawText = document.getElementById("ai-source-text-input")?.value.trim() || "";
    const statusEl = document.getElementById("ai-factory-status");
    const runBtn = document.getElementById("btn-run-ai-extraction");

    if (!apiKey) {
        window.MakaiSecurityGuard?.showSecurityToast?.("⚠️ Ingresa primero tu API Key gratuita de Google AI Studio.", "warning");
        return;
    }

    if (!selectedMultimodalBase64 && !rawText) {
        window.MakaiSecurityGuard?.showSecurityToast?.("⚠️ Adjunta un PDF/Imagen médica o pega un fragmento de guía clínica.", "warning");
        return;
    }

    try {
        if (runBtn) runBtn.disabled = true;
        if (statusEl) statusEl.textContent = `⏳ Makai AI está leyendo el documento y redactando ${count} casos clínicos CACES...`;

        const strictRagPrompt = `
Eres Makai AI, el motor oficial de evaluación clínica de Makai Academy en Ecuador.
REGLA DE ACERO (RAG ESTRICTO): Genera exactamente ${count} reactivos de opción múltiple tipo caso clínico CACES basándote ÚNICA Y EXCLUSIVAMENTE en el documento o texto adjunto. Si el documento está en otro idioma, traduce y adapta todo al español médico estándar. Prohibido inventar datos fuera del documento.

Devuelve ÚNICAMENTE un arreglo JSON válido (sin bloques markdown \`\`\`json) donde cada elemento tenga exactamente esta estructura:
[
  {
    "enunciado": "Caso clínico completo con signos vitales, edad, cuadro clínico y pregunta final...",
    "opciones": [
      "A) Primera opción...",
      "B) Segunda opción...",
      "C) Tercera opción...",
      "D) Cuarta opción..."
    ],
    "correcta": 0,
    "racional": "Justificación clínica detallada explicando por qué la respuesta es correcta y por qué se descartan las demás según el documento."
  }
]
${rawText ? `\nTEXTO CLÍNICO DE REFERENCIA:\n${rawText}` : ""}
        `.trim();

        const parts = [{ text: strictRagPrompt }];
        if (selectedMultimodalBase64) {
            parts.push({
                inline_data: {
                    mime_type: selectedMultimodalBase64.mimeType,
                    data: selectedMultimodalBase64.data
                }
            });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson?.error?.message || `Error HTTP ${response.status} al invocar la API.`);
        }

        const resultData = await response.json();
        const rawOutput = resultData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const cleanedJson = rawOutput.replace(/```json|```/g, "").trim();
        const parsedQuestions = JSON.parse(cleanedJson);

        if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
            throw new Error("El modelo no devolvió un listado válido de preguntas.");
        }

        generatedPreviewBatch = [];
        const nowIso = new Date().toISOString();

        for (let i = 0; i < parsedQuestions.length; i++) {
            const item = parsedQuestions[i];
            const qId = buildAIQuestionId(career, subject, i + 1);
            const optionsArr = Array.isArray(item.opciones) && item.opciones.length === 4
                ? item.opciones
                : ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4"];
            const correctIdx = Number(item.correcta ?? 0);

            const qRecord = {
                id: qId,
                carrera: career,
                semestre: semester,
                materia: subject,
                dificultad: "Alta",
                enunciado: String(item.enunciado || "").trim(),
                opciones: optionsArr,
                correcta: correctIdx >= 0 && correctIdx <= 3 ? correctIdx : 0,
                racional: String(item.racional || "").trim(),
                estadoRevision: "pendiente_revision", // Riel de Acero: Entra en Cuarentena hasta revisión humana
                creadoPor: "Makai AI (RAG Multimodal)",
                documentoFuente: selectedMultimodalBase64?.name || "Texto GPC",
                createdAt: nowIso
            };

            await setDoc(doc(db, COLLECTIONS.QUESTIONS, qId), qRecord);

            // Crear también su tarjeta Sináptico v4.4 en cuarentena
            const sinId = `SIN-${qId}`;
            await setDoc(doc(db, COLLECTIONS.SINAPTICO, sinId), {
                id: sinId,
                carrera: career,
                semestre: semester,
                materia: subject,
                frente: qRecord.enunciado,
                reverso: `✅ Respuesta: ${optionsArr[qRecord.correcta]}\n\n🩺 Racional: ${qRecord.racional}`,
                dificultad: "Alta",
                origenReactivoId: qId,
                estadoRevision: "pendiente_revision",
                createdAt: nowIso
            });

            generatedPreviewBatch.push(qRecord);
        }

        if (statusEl) {
            statusEl.textContent = `✅ ${generatedPreviewBatch.length} reactivos extraídos y depositados en la Bandeja de Cuarentena (${subject}).`;
        }
        window.MakaiSecurityGuard?.showSecurityToast?.(
            `🤖 Makai AI generó ${generatedPreviewBatch.length} reactivos en Cuarentena listos para auditar.`,
            "success"
        );

        renderGeneratedBatchPreview();
    } catch (err) {
        if (statusEl) statusEl.textContent = `❌ Error en extracción IA: ${err.message}`;
        window.MakaiSecurityGuard?.showSecurityToast?.(err.message, "danger");
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
}

function renderGeneratedBatchPreview() {
    const box = document.getElementById("ai-generated-preview-container");
    if (!box || generatedPreviewBatch.length === 0) return;

    box.classList.remove("hidden");
    box.innerHTML = `
        <div class="flex items-center justify-between">
            <h4 class="text-xs font-mono font-extrabold text-secondary uppercase">
                🔍 Vista Previa del Lote Enviado a Cuarentena (${generatedPreviewBatch.length} Reactivos)
            </h4>
            <button type="button" id="btn-approve-ai-batch-now"
                class="px-4 py-2 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                ✅ Aprobar y Publicar Este Lote Ahora
            </button>
        </div>
        <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
            ${generatedPreviewBatch.map(q => `
                <div class="bg-surface border border-surface-high rounded-xl p-3 text-xs space-y-1">
                    <div class="font-mono text-[10px] text-primary font-bold">[${q.id}] ${q.carrera.toUpperCase()} • ${q.materia}</div>
                    <p class="text-white font-semibold">${q.enunciado}</p>
                    <p class="text-secondary font-mono text-[11px]">Correcta: ${q.opciones[q.correcta]}</p>
                </div>
            `).join("")}
        </div>
    `;

    document.getElementById("btn-approve-ai-batch-now")?.addEventListener("click", async () => {
        for (const q of generatedPreviewBatch) {
            await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), { estadoRevision: "publicado" }, { merge: true });
            await setDoc(doc(db, COLLECTIONS.SINAPTICO, `SIN-${q.id}`), { estadoRevision: "publicado" }, { merge: true });
        }
        window.MakaiSecurityGuard?.showSecurityToast?.(
            `✅ Lote de ${generatedPreviewBatch.length} reactivos publicado en el túnel estudiantil.`,
            "success"
        );
        box.classList.add("hidden");
    });
}

// ============================================================================
// 2. EXPORTACIÓN Y RESTAURACIÓN FÍSICA .JSON (EL BOTÓN DEL PÁNICO)
// ============================================================================

export async function exportFullFirestoreBackupJSON() {
    try {
        const targetCollections = [
            COLLECTIONS.SUBSCRIPTIONS,
            COLLECTIONS.QUESTIONS,
            COLLECTIONS.SINAPTICO,
            COLLECTIONS.MATERIALS,
            COLLECTIONS.TUTORS
        ];

        const backupPayload = {
            exportedAt: new Date().toISOString(),
            projectId: "makai-academy-f8039",
            version: "4.4-rieles",
            collections: {}
        };

        for (const colName of targetCollections) {
            const snap = await getDocs(collection(db, colName));
            const docsArr = [];
            snap.forEach(d => docsArr.push({ id: d.id, ...d.data() }));
            backupPayload.collections[colName] = docsArr;
        }

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const a = document.createElement("a");
        a.href = url;
        a.download = `MAKAI-BACKUP-TOTAL-${dateTag}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        window.MakaiSecurityGuard?.showSecurityToast?.("💾 Copia de seguridad .JSON descargada con éxito.", "success");
    } catch (err) {
        window.MakaiSecurityGuard?.showSecurityToast?.(`Error al exportar JSON: ${err.message}`, "danger");
    }
}

export async function restoreFullFirestoreBackupJSON(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed?.collections || typeof parsed.collections !== "object") {
            throw new Error("El archivo .JSON no tiene el formato oficial de respaldo Makai.");
        }

        let restoredCount = 0;
        for (const [colName, docsList] of Object.entries(parsed.collections)) {
            if (!Array.isArray(docsList)) continue;
            for (const item of docsList) {
                const docId = item.id || `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                await setDoc(doc(db, colName, docId), item, { merge: true });
                restoredCount++;
            }
        }

        window.MakaiSecurityGuard?.showSecurityToast?.(
            `✅ Restauración completada: ${restoredCount} documentos reinyectados en Cloud Firestore.`,
            "success"
        );
    } catch (err) {
        window.MakaiSecurityGuard?.showSecurityToast?.(`Error al restaurar respaldo: ${err.message}`, "danger");
    }
}
