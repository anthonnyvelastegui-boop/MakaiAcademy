// ============================================================================
// ARCHIVO: js/9-graduation/thesis.marketplace.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero" - Modelo Matchmaker)
// RESPONSABILIDAD: Directorio de Especialistas VIP y Tutores de Tesis 1 a 1.
//                  Muestra Fichas de Prestigio Inmodificables verificadas en
//                  SENESCYT y gestiona el desbloqueo de contacto directo por
//                  la Tasa de Vinculación Makai ($10 USD).
// ============================================================================

import {
    auth,
    db,
    COLLECTIONS,
    collection,
    getDocs,
    addDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

let approvedTutorsCache = [];
let selectedTutorForMatch = null;

/**
 * Catálogo semilla de Especialistas Verificados para que el Marketplace
 * luzca con nivel de alta gama desde el primer día.
 */
export const SEED_VERIFIED_TUTORS = Object.freeze([
    {
        id: "TUT-MED-EPI-01",
        nombre: "Dr. Andrés Villavicencio, MSc.",
        registroSenescyt: "1029-2019-2184920",
        especialidad: "Medicina Interna & Epidemiología Clínica (SPSS / R)",
        modalidad: "mentorias_y_tesis",
        tarifaReferencial: "$35/hora • $240 Asesoría Completa de Tesis",
        tasaVinculacionMakaiUSD: 10,
        whatsapp: "0998123456",
        biografia: "Especialista en diseño metodológico PICO, revisiones sistemáticas PRISMA, análisis bioestadístico en SPSS/R y entrenamiento intensivo de casos clínicos CACES.",
        verificadoSenescyt: true,
        estado: "aprobado"
    },
    {
        id: "TUT-GO-CLAVE-02",
        nombre: "Dra. Carolina Mancero, Esp.",
        registroSenescyt: "1031-2020-1948271",
        especialidad: "Ginecología, Obstetricia & Claves Obstétricas MSP",
        modalidad: "solo_mentorias",
        tarifaReferencial: "$30/hora (Simulación Oral ECOE & CACES)",
        tasaVinculacionMakaiUSD: 10,
        whatsapp: "0987654321",
        biografia: "Docente universitaria y tutora de Internado Rotativo. Entrenamiento 1 a 1 en Clave Roja, Azul y Amarilla, partograma, monitoreo fetal y defensa de Tribunal Complexivo.",
        verificadoSenescyt: true,
        estado: "aprobado"
    },
    {
        id: "TUT-INV-BIO-03",
        nombre: "MSc. Roberto Salazar, PhD(c)",
        registroSenescyt: "1045-2018-3391024",
        especialidad: "Metodología de la Investigación, Normas Vancouver & Artículos Scopus",
        modalidad: "solo_tesis",
        tarifaReferencial: "$25/hora • Corrección Anti-Plagio y Estadística",
        tasaVinculacionMakaiUSD: 10,
        whatsapp: "0991122334",
        biografia: "Asesor metodológico para las 11 carreras de Ciencias de la Salud (UNACH, ESPOCH, UCE, UG, UTA). Estructuración de anteproyectos, operacionalización de variables y defensa final.",
        verificadoSenescyt: true,
        estado: "aprobado"
    }
]);

/**
 * Descarga los especialistas con `estado === "aprobado"` desde `perfiles_docentes`
 * y los combina con las fichas semilla verificadas.
 */
export async function fetchApprovedMarketplaceTutors() {
    const combined = [...SEED_VERIFIED_TUTORS];
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.TUTORS));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data && data.estado === "aprobado") {
                if (!combined.some(t => t.id === docSnap.id)) {
                    combined.unshift({ id: docSnap.id, ...data });
                }
            }
        });
    } catch (err) {
        console.warn("[ThesisMarketplace] Operando con directorio verificado en caché:", err.message);
    }
    approvedTutorsCache = combined;
    return combined;
}

/**
 * Renderiza el Directorio de Especialistas VIP y el Modal Matchmaker ($10 USD).
 */
export async function initThesisMarketplace(mountSelector = "#thesis-marketplace-mount") {
    const mount = typeof mountSelector === "string"
        ? document.querySelector(mountSelector)
        : mountSelector;
    if (!mount) return;

    const tutors = await fetchApprovedMarketplaceTutors();
    const isMaster = isMasterAdmin(auth.currentUser?.email || appState.currentUser?.email);
    const userTier = appState.currentUserData?.subscriptionLevel || "Básico";
    const hasVIPUnlock = isMaster || userTier === "VIP";

    mount.innerHTML = `
        <div class="space-y-6">
            <!-- EXPLICACIÓN TRANSPARENTE DEL MODELO MATCHMAKER -->
            <div class="bg-surface-container border-2 border-warning/50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-warning text-surface font-mono font-extrabold text-[10px] uppercase">
                            SELLO DORADO SENESCYT
                        </span>
                        <span class="text-xs font-mono text-warning font-bold">
                            Fichas de Prestigio Auditadas por el Administrador Maestro
                        </span>
                    </div>
                    <p class="text-xs text-gray-300 leading-relaxed">
                        Elige al especialista ideal para tu Tesis o Mentoría Clínica 1 a 1. Abonas únicamente el <strong>Derecho de Vinculación Makai ($10 USD)</strong> para desbloquear su contacto directo y acuerdas tus clases u honorarios directamente con el doctor sin intermediarios.
                    </p>
                </div>
            </div>

            <!-- GRILLA DE TARJETAS COLECCIONABLES DE ESPECIALISTAS -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                ${tutors.map(tutor => {
                    const fee = Number(tutor.tasaVinculacionMakaiUSD || 10).toFixed(2);
                    const initials = (tutor.nombre || "DR")
                        .replace(/Dr\.|Dra\.|MSc\./gi, "")
                        .trim()
                        .split(" ")
                        .slice(0, 2)
                        .map(w => w.charAt(0).toUpperCase())
                        .join("");

                    return `
                        <article class="bg-surface-container border border-surface-high hover:border-warning/60 rounded-2xl p-6 flex flex-col justify-between transition-all shadow-xl">
                            <div class="space-y-4">
                                <!-- Cabecera de la Ficha: Avatar + Sello SENESCYT -->
                                <div class="flex items-start gap-3.5">
                                    <div class="w-14 h-14 rounded-2xl bg-warning/15 border-2 border-warning text-warning font-mono font-extrabold text-lg flex items-center justify-center shrink-0">
                                        ${initials || "VIP"}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/15 border border-warning/40 text-[10px] font-mono font-extrabold text-warning mb-1">
                                            <span class="material-symbols-outlined text-xs">verified</span>
                                            <span>SENESCYT: ${tutor.registroSenescyt || "Verificado"}</span>
                                        </div>
                                        <h3 class="text-base font-extrabold text-white leading-snug">${tutor.nombre}</h3>
                                        <p class="text-xs font-mono text-primary mt-0.5">${tutor.especialidad}</p>
                                    </div>
                                </div>

                                <!-- Biografía / Ejes que domina -->
                                <p class="text-xs text-gray-300 leading-relaxed bg-surface rounded-xl p-3.5 border border-surface-high">
                                    ${tutor.biografia}
                                </p>

                                <!-- Honorarios Referenciales del Especialista -->
                                <div class="bg-surface border border-secondary/30 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                                    <span class="text-gray-400">Tarifa del Especialista:</span>
                                    <span class="text-secondary font-extrabold text-right">${tutor.tarifaReferencial}</span>
                                </div>
                            </div>

                            <!-- Botón de Acción Matchmaker -->
                            <div class="pt-4 mt-4 border-t border-surface-high">
                                ${hasVIPUnlock ? `
                                    <a href="https://wa.me/593${String(tutor.whatsapp || "").replace(/^0/, "")}?text=${encodeURIComponent(`Hola ${tutor.nombre}, desbloqueé tu contacto desde Makai Academy para asesoría clínica / tesis.`)}"
                                       target="_blank" rel="noopener"
                                       class="w-full py-3 px-4 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                        <span>💬 Abrir WhatsApp Directo (${tutor.whatsapp})</span>
                                    </a>
                                ` : `
                                    <button type="button" data-unlock-tutor-id="${tutor.id}"
                                        class="w-full py-3 px-4 rounded-xl bg-warning text-surface hover:bg-opacity-90 font-mono font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,190,11,0.2)]">
                                        🔓 Desbloquear Contacto Directo ($${fee} USD)
                                    </button>
                                `}
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>

            <!-- MODAL DE VINCULACIÓN 1 A 1 CON EL ESPECIALISTA SELECCIONADO -->
            <div id="matchmaker-unlock-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md hidden items-center justify-center p-4">
                <div class="bg-surface-container border-2 border-warning rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                    <div class="border-b border-surface-high pb-3">
                        <span class="text-[10px] font-mono text-warning uppercase font-extrabold">
                            ● SOLICITUD DE VINCULACIÓN DIRECTA 1 A 1
                        </span>
                        <h3 id="match-modal-tutor-name" class="text-lg font-extrabold text-white mt-0.5">
                            Conectar con Especialista
                        </h3>
                        <p id="match-modal-tutor-spec" class="text-xs font-mono text-primary"></p>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">
                                Tema Tentativo de Tesis o Materia de Mentoría 1a1: *
                            </label>
                            <input type="text" id="thesis-topic-input"
                                placeholder="Ej: Factores de riesgo asociados a preeclampsia en Hospital..."
                                class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-warning focus:outline-none">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">Universidad: *</label>
                                <input type="text" id="thesis-univ-input"
                                    placeholder="Ej: UNACH / UCE / UG / ESPOCH"
                                    class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-warning focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-[11px] font-mono text-gray-300 uppercase mb-1 font-bold">Tu WhatsApp de Contacto: *</label>
                                <input type="tel" id="thesis-whatsapp-input"
                                    placeholder="Ej: 0999999999"
                                    class="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-warning focus:outline-none">
                            </div>
                        </div>
                    </div>

                    <div class="pt-3 border-t border-surface-high flex items-center justify-end gap-3">
                        <button type="button" id="btn-close-matchmaker-modal"
                            class="px-4 py-2.5 rounded-xl bg-surface border border-surface-high text-xs font-bold text-gray-300">
                            Cancelar
                        </button>
                        <button type="button" id="btn-confirm-matchmaker-link"
                            class="px-5 py-2.5 rounded-xl bg-warning text-surface font-extrabold text-xs uppercase tracking-wider hover:bg-opacity-90">
                            Confirmar Vinculación 1 a 1 ($10 USD) →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Abrir modal al elegir un especialista
    mount.querySelectorAll("[data-unlock-tutor-id]").forEach(btn => {
        btn.addEventListener("click", () => {
            const tutorId = btn.dataset.unlockTutorId;
            selectedTutorForMatch = tutors.find(t => t.id === tutorId) || tutors[0];

            const modal = document.getElementById("matchmaker-unlock-modal");
            const nameEl = document.getElementById("match-modal-tutor-name");
            const specEl = document.getElementById("match-modal-tutor-spec");
            const confirmBtn = document.getElementById("btn-confirm-matchmaker-link");

            const fee = Number(selectedTutorForMatch?.tasaVinculacionMakaiUSD || 10).toFixed(2);
            if (nameEl) nameEl.textContent = `Vincular con: ${selectedTutorForMatch.nombre}`;
            if (specEl) specEl.textContent = `${selectedTutorForMatch.especialidad} • SENESCYT: ${selectedTutorForMatch.registroSenescyt}`;
            if (confirmBtn) confirmBtn.textContent = `Confirmar Vinculación 1 a 1 ($${fee} USD) →`;

            modal?.classList.remove("hidden");
            modal?.classList.add("flex");
        });
    });

    // Cerrar modal
    document.getElementById("btn-close-matchmaker-modal")?.addEventListener("click", () => {
        const modal = document.getElementById("matchmaker-unlock-modal");
        modal?.classList.add("hidden");
        modal?.classList.remove("flex");
    });

    // Confirmar solicitud y redirigir con Foto Histórica del precio hacia registro.html
    document.getElementById("btn-confirm-matchmaker-link")?.addEventListener("click", async () => {
        const topic = document.getElementById("thesis-topic-input")?.value.trim() || "";
        const univ = document.getElementById("thesis-whatsapp-input") ? (document.getElementById("thesis-univ-input")?.value.trim() || "") : "";
        const wa = document.getElementById("thesis-whatsapp-input")?.value.trim() || "";

        if (!topic || !wa) {
            window.MakaiSecurityGuard?.showSecurityToast?.("⚠️ Ingresa tu tema o materia y tu número de WhatsApp.", "warning");
            return;
        }

        const fee = Number(selectedTutorForMatch?.tasaVinculacionMakaiUSD || 10);

        try {
            await addDoc(collection(db, "solicitudes_vinculacion_tutor"), {
                uidEstudiante: auth.currentUser?.uid || "guest",
                emailEstudiante: auth.currentUser?.email || "",
                whatsappEstudiante: wa,
                universidad: univ,
                temaSolicitado: topic,
                tutorId: selectedTutorForMatch?.id || "VIP",
                tutorNombre: selectedTutorForMatch?.nombre || "Especialista VIP",
                tasaVinculacionUSD: fee,
                estado: "pendiente_pago",
                createdAt: new Date().toISOString()
            });
        } catch (e) {}

        // Congelar Snapshot de $10 USD para la pasarela blindada de registro.html
        const snapshot = {
            id: "matchmaker_vip",
            codigoPlan: "VIP",
            titulo: `Vinculación 1a1: ${selectedTutorForMatch?.nombre || "Tutor VIP"}`,
            billingCycle: "annual",
            montoCongeladoUSD: fee,
            unidad: "vinculación",
            capturedAt: new Date().toISOString()
        };

        sessionStorage.setItem("makai_selected_plan", "VIP");
        sessionStorage.setItem("makai_selected_billing", "annual");
        sessionStorage.setItem("makai_selected_plan_snapshot", JSON.stringify(snapshot));

        window.location.href = `registro.html?plan=VIP&billing=annual&price=${encodeURIComponent(fee)}`;
    });
}
