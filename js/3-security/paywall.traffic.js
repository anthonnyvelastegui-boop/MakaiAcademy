// ============================================================================
// ARCHIVO: js/3-security/paywall.traffic.js
// PROYECTO: MakaiAcademy (Arquitectura "Rieles de Acero")
// RESPONSABILIDAD: Controlador de Paywall, Límite Freemium (15 casos/mes) y
//                  Micro-Transacciones ("Pase de Guardia 24h" a $2.99 USD)
//                  sincronizado con `#freemium-modal` en dashboard.html.
// ============================================================================

import {
    appState,
    isMasterAdmin
} from "../2-core/state.store.js";

let paywallInitialized = false;

/**
 * Abre el modal `#freemium-modal` con opciones diversificadas de bolsillo:
 * 1. Pase de Guardia 24 Horas ($2.99 USD)
 * 2. Plan Sobrevivencia Universitaria ($9.99/mes o $49.99/semestre)
 * 3. Plan Makai PRO CACES ($18.60/mes o $144.75/año)
 */
export function openPaywallModal(customReason = null) {
    if (isMasterAdmin(appState.currentUser?.email || appState.currentUserData?.email)) {
        return;
    }

    const modal = document.getElementById("freemium-modal");
    if (!modal) return;

    const reasonText = customReason ||
        "El Modo Estándar (100 preguntas), los Simuladores 3D UCI y los casos ilimitados requieren un plan activo o un Pase de Guardia.";

    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-[0_0_40px_rgba(0,229,255,0.2)]">
            <div class="flex items-start justify-between gap-4 border-b border-surface-high pb-4">
                <div>
                    <span class="text-[10px] font-mono text-primary uppercase tracking-widest font-extrabold">
                        ● RIELES DE ACCESO CLÍNICO • DIVERSIFICACIÓN DE PLANES
                    </span>
                    <h3 class="text-xl sm:text-2xl font-extrabold text-white mt-1">
                        Desbloquea tu Entrenamiento Sin Límites
                    </h3>
                    <p class="text-xs text-gray-300 mt-1 leading-relaxed">${reasonText}</p>
                </div>
                <button type="button" id="btn-close-paywall-modal" class="text-gray-400 hover:text-white">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- 3 Opciones de Desbloqueo Rápido -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Opción 1: Micro-Transacción (Pase de Guardia 24h) -->
                <div class="bg-surface border border-warning/50 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                        <span class="text-[10px] font-mono text-warning uppercase font-extrabold">MICRO-PASE 24 HORAS</span>
                        <h4 class="text-sm font-extrabold text-white mt-0.5">Pase de Guardia 24h</h4>
                        <div class="text-xl font-mono font-extrabold text-warning mt-1">$2.99 <span class="text-[10px] text-gray-400">/24h</span></div>
                        <p class="text-[11px] text-gray-400 mt-2">
                            Ideal para practicar hoy mismo en los Simuladores 2D/3D y simulacros antes de tu examen.
                        </p>
                    </div>
                    <button type="button" data-paywall-select="Pase24h" data-paywall-price="2.99" data-paywall-cycle="monthly"
                        class="w-full py-2.5 rounded-xl bg-warning text-surface font-mono font-extrabold text-xs uppercase">
                        Activar Pase 24h →
                    </button>
                </div>

                <!-- Opción 2: Sobrevivencia Universitaria -->
                <div class="bg-surface border border-secondary/50 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                        <span class="text-[10px] font-mono text-secondary uppercase font-extrabold">1° A 8° SEMESTRE</span>
                        <h4 class="text-sm font-extrabold text-white mt-0.5">Sobrevivencia Semestral</h4>
                        <div class="text-xl font-mono font-extrabold text-secondary mt-1">$49.99 <span class="text-[10px] text-gray-400">/semestre</span></div>
                        <p class="text-[11px] text-gray-400 mt-2">
                            Todas las materias de tu carrera, Sináptico v4.4 ilimitado y Biblioteca GPC-MSP.
                        </p>
                    </div>
                    <button type="button" data-paywall-select="Sobrevivencia" data-paywall-price="49.99" data-paywall-cycle="annual"
                        class="w-full py-2.5 rounded-xl bg-secondary text-surface font-mono font-extrabold text-xs uppercase">
                        Elegir Semestral →
                    </button>
                </div>

                <!-- Opción 3: Makai PRO CACES -->
                <div class="bg-surface border-2 border-primary rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
                    <div>
                        <span class="text-[10px] font-mono text-primary uppercase font-extrabold">ACCESO TOTAL CACES</span>
                        <h4 class="text-sm font-extrabold text-white mt-0.5">Makai PRO CACES</h4>
                        <div class="text-xl font-mono font-extrabold text-primary mt-1">$144.75 <span class="text-[10px] text-gray-400">/año</span></div>
                        <p class="text-[11px] text-gray-400 mt-2">
                            Simulacros de 100 preguntas, Motores 1D/2D/3D, Bootcamp Complexivo y Salud Rural.
                        </p>
                    </div>
                    <button type="button" data-paywall-select="PRO" data-paywall-price="144.75" data-paywall-cycle="annual"
                        class="w-full py-2.5 rounded-xl bg-primary text-surface font-mono font-extrabold text-xs uppercase">
                        Adquirir PRO →
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-surface-high text-[11px] font-mono text-gray-400">
                <span>Canales habilitados: Deuna! QR • PayPhone • Transferencia</span>
                <button type="button" id="btn-dismiss-paywall" class="text-gray-400 hover:text-white underline">
                    Continuar en modo Básico
                </button>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const close = () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    document.getElementById("btn-close-paywall-modal")?.addEventListener("click", close);
    document.getElementById("btn-dismiss-paywall")?.addEventListener("click", close);

    modal.querySelectorAll("[data-paywall-select]").forEach(btn => {
        btn.addEventListener("click", () => {
            const planCode = btn.dataset.paywallSelect || "PRO";
            const price = Number(btn.dataset.paywallPrice || 144.75);
            const cycle = btn.dataset.paywallCycle || "annual";

            const snapshot = {
                id: planCode.toLowerCase(),
                codigoPlan: planCode,
                titulo: `Plan ${planCode}`,
                billingCycle: cycle,
                montoCongeladoUSD: price,
                unidad: cycle === "annual" ? "año" : "pase",
                capturedAt: new Date().toISOString()
            };

            sessionStorage.setItem("makai_selected_plan", planCode);
            sessionStorage.setItem("makai_selected_billing", cycle);
            sessionStorage.setItem("makai_selected_plan_snapshot", JSON.stringify(snapshot));

            window.location.href = `registro.html?plan=${encodeURIComponent(planCode)}&billing=${encodeURIComponent(cycle)}&price=${encodeURIComponent(price)}`;
        });
    });
}

export async function initPaywallTraffic() {
    if (paywallInitialized) return;
    paywallInitialized = true;

    if (typeof window !== "undefined") {
        window.MakaiPaywall = {
            openPaywallModal,
            showFreemiumModal: openPaywallModal
        };
    }
}

export const initPaywall = initPaywallTraffic;
