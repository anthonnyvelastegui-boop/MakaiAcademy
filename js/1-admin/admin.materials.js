// ============================================================================
// ARCHIVO: js/1-admin/admin.materials.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Bóveda de Carga 1D (Guías GPC-MSP, PDFs, Infografías y
//                  Resúmenes) con Renombramiento Automático Estandarizado
//                  (`GPC-MED-PED-001.pdf`) y Cero Creación de Carpetas Libres.
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

import { getSelectedAdminRoute } from "./admin.questions.js";

let materialsCache = [];

/**
 * Categorías oficiales controladas (El trabajador NO puede inventar carpetas sueltas).
 */
const CONTROLLED_MATERIAL_CATEGORIES = Object.freeze([
    { code: "GPC", label: "Guía de Práctica Clínica MSP (GPC)", folder: "assets/5-multimedia-1d/guias-gpc/" },
    { code: "RES", label: "Resumen Ejecutivo / Compendio CACES", folder: "assets/5-multimedia-1d/resumenes-caces/" },
    { code: "INF", label: "Infografía / Algoritmo de Guardia", folder: "assets/5-multimedia-1d/infografias/" },
    { code: "RUR", label: "Protocolo Salud Rural (PRAS / RDACAA / SIVE)", folder: "assets/10-multimedia-profesionales/salud-rural/" }
]);

/**
 * Genera el nombre de archivo estandarizado e inmutable:
 * Ejemplo: `GPC-MED-FAR-004.pdf` sin importar cómo lo haya llamado el digitador.
 */
export function generateStandardizedMaterialFilename(categoryCode, carrera, materia, sequenceNumber = 1, extension = "pdf") {
    const prefix = String(categoryCode || "GPC").toUpperCase().slice(0, 3);
    const car = String(carrera || "MED").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "MED";
    const mat = String(materia || "GEN")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3) || "GEN";
    const seq = String(sequenceNumber).padStart(3, "0");
    const ext = String(extension || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";

    return `${prefix}-${car}-${mat}-${seq}.${ext}`;
}

async function loadMaterialsFromFirestore() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.MATERIALS));
        materialsCache = [];
        snap.forEach(d => materialsCache.push({ id: d.id, ...d.data() }));
    } catch (e) {}
}

export async function initAdminMaterials(passedRole = null) {
    const mount = document.getElementById("admin-materials-mount");
    if (!mount) return;

    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    const isMaster = isMasterAdmin(email) || passedRole === "master";

    await loadMaterialsFromFirestore();
    renderMaterialsWorkstation(mount, isMaster);

    if (!window._materialsRouteListenerBound) {
        window._materialsRouteListenerBound = true;
        window.addEventListener("makai:adminRouteChanged", () => {
            renderMaterialsWorkstation(mount, isMaster);
        });
    }
}

function renderMaterialsWorkstation(mount, isMaster) {
    const route = getSelectedAdminRoute();
    const nextSeq = materialsCache.length + 1;
    const sampleStandardName = generateStandardizedMaterialFilename("GPC", route.carrera, route.materia, nextSeq, "pdf");

    const filteredMaterials = materialsCache.filter(
        m => (m.carrera || "").toLowerCase() === route.carrera.toLowerCase()
    );

    mount.innerHTML = `
        <div class="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <span class="text-[10px] font-mono text-warning uppercase font-bold">
                        ● ESTACIÓN 3 DE 3 • BÓVEDA MULTIMEDIA 1D & RENOMBRADO AUTOMÁTICO
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Subida Guiada de PDFs, Guías GPC-MSP e Infografías (${route.carrera.toUpperCase()} • ${route.materia})
                    </h3>
                    <p class="text-xs text-gray-400">
                        Sin botón de crear carpetas libres. El sistema bautiza automáticamente cada archivo como <code id="mat-live-code-preview" class="text-primary font-mono font-bold">${sampleStandardName}</code>.
                    </p>
                </div>
            </div>

            <form id="admin-materials-form" class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div class="md:col-span-3">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Categoría Controlada *</label>
                    <select id="mat-category-select"
                        class="w-full bg-surface border border-surface-high rounded-xl px-3 py-2.5 text-xs text-white font-bold">
                        ${CONTROLLED_MATERIAL_CATEGORIES.map(c => `<option value="${c.code}">${c.label}</option>`).join("")}
                    </select>
                </div>

                <div class="md:col-span-4">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Título Oficial del Documento *</label>
                    <input type="text" id="mat-title-input" required
                        placeholder="Ej: GPC Trastornos Hipertensivos del Embarazo MSP"
                        class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none">
                </div>

                <div class="md:col-span-3">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Archivo Local o Enlace Cloud Storage</label>
                    <input type="text" id="mat-url-input"
                        placeholder="Opcional: URL externa o archivo local"
                        class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white font-mono">
                </div>

                <div class="md:col-span-2">
                    <button type="submit"
                        class="w-full py-2.5 px-4 rounded-xl bg-warning text-surface font-mono font-extrabold text-xs uppercase">
                        📁 Registrar PDF
                    </button>
                </div>
            </form>

            <!-- Listado de materiales de la carrera activa -->
            <div class="space-y-2 pt-2">
                ${filteredMaterials.slice(0, 8).map(m => `
                    <div class="bg-surface border border-surface-high rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                        <div>
                            <span class="text-primary font-extrabold">[${m.nombreArchivoEstandar || m.id}]</span>
                            <span class="text-white font-sans font-bold ml-2">${m.titulo}</span>
                            <span class="text-gray-400 block text-[11px]">Ruta Bóveda: ${m.rutaDestino} • Materia: ${m.materia}</span>
                        </div>
                        ${isMaster ? `
                            <button type="button" data-delete-mat="${m.id}"
                                class="px-2.5 py-1 rounded-lg bg-danger/15 border border-danger text-danger text-[11px]">
                                Eliminar
                            </button>
                        ` : ""}
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    const catSelect = document.getElementById("mat-category-select");
    catSelect?.addEventListener("change", () => {
        const preview = document.getElementById("mat-live-code-preview");
        if (preview) {
            preview.textContent = generateStandardizedMaterialFilename(
                catSelect.value,
                route.carrera,
                route.materia,
                materialsCache.length + 1,
                "pdf"
            );
        }
    });

    document.getElementById("admin-materials-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const catCode = document.getElementById("mat-category-select")?.value || "GPC";
        const titulo = document.getElementById("mat-title-input")?.value.trim() || "";
        const customUrl = document.getElementById("mat-url-input")?.value.trim() || "";

        const catObj = CONTROLLED_MATERIAL_CATEGORIES.find(c => c.code === catCode) || CONTROLLED_MATERIAL_CATEGORIES[0];
        const stdFilename = generateStandardizedMaterialFilename(catCode, route.carrera, route.materia, materialsCache.length + 1, "pdf");
        const docId = stdFilename.replace(".pdf", "");
        const finalPath = customUrl || `${catObj.folder}${stdFilename}`;

        await setDoc(doc(db, COLLECTIONS.MATERIALS, docId), {
            id: docId,
            titulo,
            categoria: catCode,
            carrera: route.carrera,
            semestre: Number(route.semestre),
            materia: route.materia,
            nombreArchivoEstandar: stdFilename,
            rutaDestino: finalPath,
            url: finalPath,
            estadoRevision: isMaster ? "publicado" : "pendiente_revision",
            creadoPor: auth.currentUser?.email || "staff",
            createdAt: new Date().toISOString()
        });

        window.MakaiSecurityGuard?.showSecurityToast?.(
            `📁 Documento registrado con código oficial: ${stdFilename}`,
            "success"
        );
        await loadMaterialsFromFirestore();
        renderMaterialsWorkstation(mount, isMaster);
    });

    mount.querySelectorAll("[data-delete-mat]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await deleteDoc(doc(db, COLLECTIONS.MATERIALS, btn.dataset.deleteMat));
            await loadMaterialsFromFirestore();
            renderMaterialsWorkstation(mount, isMaster);
        });
    });
}
