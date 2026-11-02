// ============================================================================
// ARCHIVO: js/1-admin/admin.sinaptico.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Fábrica de Tarjetas de Repetición Espaciada • Sináptico v4.4
//                  Sincronizada con la Ruta Forzada y Conversor 1-Clic desde
//                  el Banco de Reactivos CACES.
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

import { getSelectedAdminRoute } from "./admin.questions.js";

let sinapticoCardsCache = [];

async function loadSinapticoFromFirestore() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.SINAPTICO));
        sinapticoCardsCache = [];
        snap.forEach(d => sinapticoCardsCache.push({ id: d.id, ...d.data() }));
    } catch (e) {}
}

export async function initAdminSinaptico(passedRole = null) {
    const mount = document.getElementById("admin-sinaptico-mount");
    if (!mount) return;

    const email = auth.currentUser?.email || appState.currentUser?.email || "";
    const isMaster = isMasterAdmin(email) || passedRole === "master";

    await loadSinapticoFromFirestore();
    renderSinapticoWorkstation(mount, isMaster);

    if (!window._sinapticoRouteListenerBound) {
        window._sinapticoRouteListenerBound = true;
        window.addEventListener("makai:adminRouteChanged", () => {
            renderSinapticoWorkstation(mount, isMaster);
        });
    }
}

function renderSinapticoWorkstation(mount, isMaster) {
    const route = getSelectedAdminRoute();
    const matchingCards = sinapticoCardsCache.filter(
        c => (c.carrera || "").toLowerCase() === route.carrera.toLowerCase() &&
             (c.materia || "").toLowerCase() === route.materia.toLowerCase()
    );

    mount.innerHTML = `
        <div class="bg-surface-container border border-secondary/40 rounded-2xl p-6 space-y-5 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <span class="text-[10px] font-mono text-secondary uppercase font-bold">
                        ● ESTACIÓN 2 DE 3 • REPETICIÓN ESPACIADA • SINÁPTICO V4.4
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Mazo Sináptico para: <span class="text-secondary">${route.carrera.toUpperCase()} • ${route.materia}</span>
                    </h3>
                </div>

                <div class="flex items-center gap-3">
                    <span class="px-3 py-1.5 rounded-xl bg-surface border border-secondary/40 text-xs font-mono text-secondary font-bold">
                        ${matchingCards.length} tarjetas en esta materia (${sinapticoCardsCache.length} totales)
                    </span>
                    <button type="button" id="btn-sync-questions-to-sinaptico"
                        class="px-4 py-2 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                        ⚡ Convertir Reactivos de esta Materia en Flashcards
                    </button>
                </div>
            </div>

            <form id="admin-sinaptico-form" class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div class="md:col-span-5">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Frente de la Tarjeta (Pregunta Directa / Signo Clínico) *</label>
                    <input type="text" id="sin-front-input" required
                        placeholder="Ej: ¿Cuál es la dosis de impregnación de Sulfato de Magnesio en Clave Azul MSP?"
                        class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                </div>
                <div class="md:col-span-5">
                    <label class="block text-[10px] font-mono text-gray-400 uppercase mb-1">Reverso (Respuesta Exacta & Perla CACES) *</label>
                    <input type="text" id="sin-back-input" required
                        placeholder="Ej: 4 gramos IV en 20 minutos, seguido de 1 g/hora en infusión continua."
                        class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-secondary focus:outline-none">
                </div>
                <div class="md:col-span-2">
                    <button type="submit"
                        class="w-full py-2.5 px-4 rounded-xl bg-surface border-2 border-secondary text-secondary hover:bg-secondary hover:text-surface font-mono font-extrabold text-xs uppercase transition-all">
                        + Crear Tarjeta
                    </button>
                </div>
            </form>
        </div>
    `;

    // Crear Tarjeta Sináptica Manual
    document.getElementById("admin-sinaptico-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const frente = document.getElementById("sin-front-input")?.value.trim() || "";
        const reverso = document.getElementById("sin-back-input")?.value.trim() || "";
        if (!frente || !reverso) return;

        const id = `SIN-${route.carrera.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        await setDoc(doc(db, COLLECTIONS.SINAPTICO, id), {
            id,
            carrera: route.carrera,
            semestre: Number(route.semestre),
            materia: route.materia,
            frente,
            reverso,
            dificultad: "Alta",
            estadoRevision: isMaster ? "publicado" : "pendiente_revision",
            createdAt: new Date().toISOString()
        });

        window.MakaiSecurityGuard?.showSecurityToast?.(`🧠 Tarjeta Sináptico ${id} guardada.`, "success");
        await loadSinapticoFromFirestore();
        renderSinapticoWorkstation(mount, isMaster);
    });

    // Convertir reactivos existentes de la materia en tarjetas Sináptico v4.4
    document.getElementById("btn-sync-questions-to-sinaptico")?.addEventListener("click", async () => {
        const qSnap = await getDocs(collection(db, COLLECTIONS.QUESTIONS));
        let created = 0;
        for (const docSnap of qSnap.docs) {
            const q = docSnap.data();
            if ((q.carrera || "").toLowerCase() === route.carrera.toLowerCase() &&
                (q.materia || "").toLowerCase() === route.materia.toLowerCase()) {
                const sinId = `SIN-${docSnap.id}`;
                const ansText = Array.isArray(q.opciones) ? q.opciones[q.correcta || 0] : "";
                await setDoc(doc(db, COLLECTIONS.SINAPTICO, sinId), {
                    id: sinId,
                    carrera: q.carrera,
                    semestre: Number(q.semestre || route.semestre),
                    materia: q.materia,
                    frente: q.enunciado,
                    reverso: `✅ Respuesta: ${ansText}\n\n🩺 Racional: ${q.racional || ""}`,
                    dificultad: q.dificultad || "Alta",
                    estadoRevision: "publicado",
                    createdAt: new Date().toISOString()
                }, { merge: true });
                created++;
            }
        }
        window.MakaiSecurityGuard?.showSecurityToast?.(`⚡ ${created} tarjetas Sináptico sincronizadas en ${route.materia}.`, "success");
        await loadSinapticoFromFirestore();
        renderSinapticoWorkstation(mount, isMaster);
    });
}
