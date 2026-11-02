// ============================================================================
// ARCHIVO: js/9-graduation/graduation.controller.js
// PROYECTO: MakaiAcademy (Carpeta 9: Titulación, Complexivo & Tesis 1 a 1)
// RESPONSABILIDAD: Controlador General de Fin de Carrera. Coordina el
//                  Marketplace de Tutores VIP (`thesis.marketplace.js`), el
//                  Bootcamp Complexivo Escrito + ECOE (`complexivo.bootcamp.js`)
//                  y la Calculadora Bioestadística PICO (`thesis.toolkit.js`).
// ============================================================================

import { appState } from "../2-core/state.store.js";
import { makaiData } from "../2-core/curriculum.data.js";
import { initThesisMarketplace } from "./thesis.marketplace.js";

let graduationBootstrapped = false;
let activeGraduationTab = "marketplace"; // "marketplace" | "complexivo" | "toolkit"

/**
 * Inicializador principal invocado por `app.orchestrator.js`.
 */
export async function initGraduationController(userData = null) {
    const viewGraduation = document.getElementById("view-graduation");
    if (!viewGraduation) return;

    renderGraduationHubLayout(viewGraduation, userData || appState.currentUserData);
    graduationBootstrapped = true;
}

function renderGraduationHubLayout(container, userData) {
    const careerId = (appState.currentCareerTunnel && appState.currentCareerTunnel !== "ALL")
        ? appState.currentCareerTunnel
        : (userData?.carrera || "medicina");
    const allCareers = window.makaiData?.carreras || makaiData.carreras || [];
    const careerObj = allCareers.find(c => c.id === careerId) || allCareers[0];

    container.innerHTML = `
        <div class="space-y-6">
            <!-- CABECERA DE LA CARPETA 9: TITULACIÓN, TESIS & EXAMEN COMPLEXIVO -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
                <div>
                    <span class="text-[10px] font-mono text-warning uppercase tracking-widest font-extrabold">
                        ● CARPETA 9 • CENTRO DE TITULACIÓN UNIVERSITARIA (${careerObj?.nombre?.toUpperCase() || "SALUD"})
                    </span>
                    <h2 class="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                        Marketplace de Tutores VIP 1 a 1, Examen Complexivo & Toolkit de Tesis
                    </h2>
                    <p class="text-xs text-gray-400 mt-1">
                        Conecta con especialistas verificados en SENESCYT, entrena casos integradores ECOE o estructura tu protocolo PICO.
                    </p>
                </div>

                <!-- PESTAÑAS DE NAVEGACIÓN INTERNA DE CARPETA 9 -->
                <div class="inline-flex flex-wrap bg-surface p-1.5 rounded-xl border border-surface-high gap-1">
                    <button type="button" data-grad-tab="marketplace"
                        class="px-3.5 py-2 rounded-lg text-xs font-mono font-extrabold transition-all ${
                            activeGraduationTab === "marketplace" ? "bg-warning text-surface" : "text-gray-400 hover:text-white"
                        }">
                        🩺 Tutores VIP & Tesis 1a1
                    </button>
                    <button type="button" data-grad-tab="complexivo"
                        class="px-3.5 py-2 rounded-lg text-xs font-mono font-extrabold transition-all ${
                            activeGraduationTab === "complexivo" ? "bg-primary text-surface" : "text-gray-400 hover:text-white"
                        }">
                        🎯 Bootcamp Complexivo & ECOE
                    </button>
                    <button type="button" data-grad-tab="toolkit"
                        class="px-3.5 py-2 rounded-lg text-xs font-mono font-extrabold transition-all ${
                            activeGraduationTab === "toolkit" ? "bg-secondary text-surface" : "text-gray-400 hover:text-white"
                        }">
                        🧮 Calculadora PICO & Muestra
                    </button>
                </div>
            </div>

            <!-- SUBCONTENEDOR 1: MARKETPLACE DE TUTORES VIP -->
            <div id="thesis-marketplace-mount" class="${activeGraduationTab === "marketplace" ? "" : "hidden"}"></div>

            <!-- SUBCONTENEDOR 2: BOOTCAMP EXAMEN COMPLEXIVO (ESCRITO + ECOE) -->
            <div id="complexivo-bootcamp-mount" class="${activeGraduationTab === "complexivo" ? "" : "hidden"}"></div>

            <!-- SUBCONTENEDOR 3: TOOLKIT METODOLÓGICO Y BIOESTADÍSTICO -->
            <div id="thesis-toolkit-mount" class="${activeGraduationTab === "toolkit" ? "" : "hidden"}"></div>
        </div>
    `;

    // Enlazar pestañas
    container.querySelectorAll("[data-grad-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            activeGraduationTab = btn.dataset.gradTab;
            renderGraduationHubLayout(container, userData);
        });
    });

    if (activeGraduationTab === "marketplace") {
        initThesisMarketplace("#thesis-marketplace-mount");
    } else if (activeGraduationTab === "complexivo") {
        mountComplexivoBootcampSection(careerObj);
    } else if (activeGraduationTab === "toolkit") {
        mountThesisToolkitSection(careerObj);
    }
}

/**
 * Monta el Bootcamp Complexivo intentando primero cargar `complexivo.bootcamp.js`
 * y ofreciendo una estación interactiva inmediata Escrito + ECOE para las 11 carreras.
 */
async function mountComplexivoBootcampSection(careerObj) {
    const mount = document.getElementById("complexivo-bootcamp-mount");
    if (!mount) return;

    try {
        const mod = await import("./complexivo.bootcamp.js");
        if (typeof mod.initComplexivoBootcamp === "function") {
            await mod.initComplexivoBootcamp({ mountSelector: "#complexivo-bootcamp-mount" });
            return;
        }
    } catch (e) {}

    // Estación interactiva integrada de Examen Complexivo (Escrito + Defensa Oral ECOE)
    mount.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-surface-container border border-primary/50 rounded-2xl p-6 space-y-4">
                <span class="text-[10px] font-mono text-primary uppercase font-bold">
                    FASE 1 • EXAMEN ESCRITO MULTIDISCIPLINARIO (${careerObj?.nombre || "SALUD"})
                </span>
                <h3 class="text-lg font-extrabold text-white">Simulacro Integrador de Fin de Carrera</h3>
                <p class="text-xs text-gray-400 leading-relaxed">
                    Evalúa todos los ejes troncales de tu malla curricular (${(careerObj?.materias || []).slice(0, 4).join(", ")}) bajo formato de titulación universitaria.
                </p>
                <button type="button" id="btn-launch-complexivo-written"
                    class="w-full py-3 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase tracking-wider">
                    🚀 Lanzar Simulacro Escrito Complexivo →
                </button>
            </div>

            <div class="bg-surface-container border border-secondary/50 rounded-2xl p-6 space-y-4">
                <span class="text-[10px] font-mono text-secondary uppercase font-bold">
                    FASE 2 • DEFENSA ORAL / PRÁCTICA ANTE TRIBUNAL (ECOE)
                </span>
                <h3 class="text-lg font-extrabold text-white">Entrenador de Caso Integrador con Rúbrica</h3>
                <p class="text-xs text-gray-400 leading-relaxed">
                    Estructura tu presentación oral en 4 bloques obligatorios: 1) Síndrome Principal, 2) Diagnóstico Diferencial, 3) Conducta Terapéutica GPC-MSP y 4) Pronóstico.
                </p>
                <div class="p-3.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-gray-300">
                    📁 Compendios disponibles en: <code>assets/9-multimedia-titulacion/guias-complexivo/</code>
                </div>
            </div>
        </div>
    `;

    document.getElementById("btn-launch-complexivo-written")?.addEventListener("click", () => {
        window.MakaiOrchestrator?.switchView?.("view-launcher");
    });
}

/**
 * Monta el Constructor PICO y Calculadora de Tamaño Muestral (Integra `thesis.toolkit.js`).
 */
async function mountThesisToolkitSection() {
    const mount = document.getElementById("thesis-toolkit-mount");
    if (!mount) return;

    try {
        const mod = await import("./thesis.toolkit.js");
        if (typeof mod.initThesisToolkit === "function") {
            await mod.initThesisToolkit({ mountSelector: "#thesis-toolkit-mount" });
            return;
        }
    } catch (e) {}

    mount.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Estructurador de Pregunta Clínica PICO -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-4">
                <span class="text-[10px] font-mono text-secondary uppercase font-bold">HERRAMIENTA 1 • PROTOCOLO DE TESIS</span>
                <h3 class="text-lg font-extrabold text-white">Generador Automático de Pregunta PICO</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input type="text" id="pico-p" placeholder="P: Población / Paciente (ej. Gestantes)"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white">
                    <input type="text" id="pico-i" placeholder="I: Intervención / Exposición"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white">
                    <input type="text" id="pico-c" placeholder="C: Comparador (ej. Manejo estándar)"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white">
                    <input type="text" id="pico-o" placeholder="O: Outcome / Desenlace clínico"
                        class="bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-white">
                </div>
                <button type="button" id="btn-build-pico"
                    class="px-4 py-2.5 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                    Generar Enunciado PICO y Objetivo General
                </button>
                <div id="pico-output-box" class="p-3.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-primary">
                    Completa las 4 casillas para redactar tu pregunta de investigación.
                </div>
            </div>

            <!-- Calculadora Bioestadística de Muestra Poblacional Finita -->
            <div class="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-4">
                <span class="text-[10px] font-mono text-primary uppercase font-bold">HERRAMIENTA 2 • BIOESTADÍSTICA CLÍNICA</span>
                <h3 class="text-lg font-extrabold text-white">Calculadora de Tamaño Muestral (IC 95%, Error 5%)</h3>
                <div class="space-y-2 text-xs">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase">Universo / Población Total del Hospital (N):</label>
                    <input type="number" id="sample-n-input" value="450" min="10"
                        class="w-full bg-surface border border-primary/50 rounded-xl px-3.5 py-2.5 text-white font-mono font-extrabold">
                </div>
                <button type="button" id="btn-calc-sample"
                    class="px-4 py-2.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase">
                    Calcular Muestra Mínima (n)
                </button>
                <div id="sample-output-box" class="p-3.5 rounded-xl bg-surface border border-surface-high text-xs font-mono text-secondary">
                    Muestra recomendada para N=450: <strong>n = 208 pacientes</strong>.
                </div>
            </div>
        </div>
    `;

    document.getElementById("btn-build-pico")?.addEventListener("click", () => {
        const p = document.getElementById("pico-p")?.value.trim() || "[Población]";
        const i = document.getElementById("pico-i")?.value.trim() || "[Intervención]";
        const c = document.getElementById("pico-c")?.value.trim() || "[Comparación]";
        const o = document.getElementById("pico-o")?.value.trim() || "[Desenlace]";
        const out = document.getElementById("pico-output-box");
        if (out) {
            out.innerHTML = `<strong>Pregunta PICO:</strong> En ${p}, ¿cómo influye ${i} en comparación con ${c} sobre ${o}?`;
        }
    });

    document.getElementById("btn-calc-sample")?.addEventListener("click", () => {
        const N = Number(document.getElementById("sample-n-input")?.value || 100);
        const Z2 = 1.96 * 1.96;
        const p = 0.5;
        const q = 0.5;
        const e2 = 0.05 * 0.05;
        const n = Math.ceil((N * Z2 * p * q) / (e2 * (N - 1) + Z2 * p * q));
        const out = document.getElementById("sample-output-box");
        if (out) {
            out.innerHTML = `Para una población finita de <strong>N = ${N}</strong> historias clínicas (IC 95%, e=5%), tu muestra representativa es: <strong class="text-white text-sm">n = ${n} sujetos</strong>.`;
        }
    });
}
