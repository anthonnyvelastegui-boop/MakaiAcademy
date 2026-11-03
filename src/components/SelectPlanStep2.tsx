// ============================================================================
// ARCHIVO: src/components/SelectPlanStep2.tsx
// DESCRIPCIÓN: Paso 2 de 3 — "Selecciona un Plan" (Plan Básico Freemium,
//              Plan Universitario, Plan CACES y Plan Profesional) con
//              conmutador Mensual / Anual. Si el plan cuesta $0.00 USD, salta
//              el Paso 3 e ingresa directamente al entorno del usuario.
// ============================================================================

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { PlanBillingCycle, SubscriptionPlanConfig } from "../types";

interface SelectPlanStep2Props {
  onBackToStep1: () => void;
  onSuccessStep2: () => void;
  onSkipToAppInside: () => void;
  onOpenMasterPlansEditor: () => void;
}

export const SelectPlanStep2: React.FC<SelectPlanStep2Props> = ({
  onBackToStep1,
  onSuccessStep2,
  onSkipToAppInside,
  onOpenMasterPlansEditor
}) => {
  const { user, isMaster, plansCatalog, savePlanSelectionStep2 } = useAuth();

  const existingPlan = user?.datosPlanPaso2;

  const [billingCycle, setBillingCycle] = useState<PlanBillingCycle>(
    existingPlan?.cicloFacturacion || "mensual"
  );
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanConfig["id"]>(
    existingPlan?.planId || "plan-basico-freemium"
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  const visiblePlans = plansCatalog;
  const selectedPlanObj =
    visiblePlans.find((p) => p.id === selectedPlanId) || visiblePlans[0];

  const currentSelectedPrice = selectedPlanObj
    ? billingCycle === "mensual"
      ? Number(selectedPlanObj.costoMensual)
      : Number(selectedPlanObj.costoAnual)
    : 0;

  const isSelectedPlanFree =
    currentSelectedPrice === 0 || selectedPlanObj?.id === "plan-basico-freemium";

  const handleConfirmStep2 = async () => {
    if (!selectedPlanObj) return;
    setSubmitting(true);
    try {
      const price =
        billingCycle === "mensual"
          ? Number(selectedPlanObj.costoMensual)
          : Number(selectedPlanObj.costoAnual);

      const nextStep = await savePlanSelectionStep2({
        planId: selectedPlanObj.id,
        planNombre: selectedPlanObj.nombre,
        cicloFacturacion: billingCycle,
        costoAplicado: price,
        moneda: selectedPlanObj.moneda || "USD",
        paso2CompletadoEn: new Date().toISOString()
      });

      if (nextStep === "completado" || price === 0) {
        onSkipToAppInside();
      } else {
        onSuccessStep2();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto space-y-6 py-2">
      {/* Cabecera de Progreso: Paso 2 de 3 */}
      <div className="bg-surface-container border border-surface-high rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
            <span>CREACIÓN DE NUEVO USUARIO</span>
            <span aria-hidden="true">·</span>
            <span>PASO 2 DE 3</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            Selecciona un Plan
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Elige el plan acorde a tu etapa académica y alterna entre cuota mensual o anual. Si
            eliges un plan de $0.00 USD ingresarás directamente a tu entorno de estudio.
          </p>
        </div>

        {/* Indicador Visual de Pasos */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
          <button
            type="button"
            onClick={onBackToStep1}
            className="px-3 py-1.5 rounded-lg bg-surface border border-secondary/50 text-secondary font-bold hover:bg-secondary/10 transition-colors cursor-pointer"
          >
            ✓ 1. Datos Personales
          </button>
          <span className="text-gray-600">→</span>
          <div className="px-3 py-1.5 rounded-lg bg-primary text-surface font-extrabold">
            2. Selecciona un Plan
          </div>
          {!isSelectedPlanFree && (
            <>
              <span className="text-gray-600">→</span>
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-surface-high text-gray-400">
                3. Medios de Pago
              </div>
            </>
          )}
        </div>
      </div>

      {/* Barra de Control: Conmutador Mensual / Anual + Botón Exclusivo Admin Maestro */}
      <div className="bg-surface-container border border-surface-high rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-gray-300 font-semibold">
            Modalidad de Cuota:
          </span>

          <div className="inline-flex p-1 bg-surface rounded-xl border border-surface-high">
            <button
              type="button"
              onClick={() => setBillingCycle("mensual")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                billingCycle === "mensual"
                  ? "bg-primary text-surface font-extrabold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Cuota Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("anual")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                billingCycle === "anual"
                  ? "bg-secondary text-surface font-extrabold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Cuota Anual
            </button>
          </div>
        </div>

        {/* EXCLUSIVO PARA LAS CUENTAS MAESTRAS (anthonnyvelastegui@gmail.com y aavemakaihc@gmail.com) */}
        {isMaster && (
          <button
            type="button"
            onClick={onOpenMasterPlansEditor}
            className="px-4 py-2.5 rounded-xl bg-warning/15 border border-warning/60 hover:bg-warning hover:text-surface text-warning font-mono font-extrabold text-xs flex items-center gap-2 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Configurar Planes, Beneficios y Costos (Admin Maestro)</span>
          </button>
        )}
      </div>

      {/* Grilla de los 4 Planes Oficiales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {visiblePlans.map((plan) => {
          const isSelected = selectedPlanObj?.id === plan.id;
          const displayPrice =
            billingCycle === "mensual" ? plan.costoMensual : plan.costoAnual;

          return (
            <article
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`rounded-2xl p-6 flex flex-col justify-between transition-all cursor-pointer border ${
                isSelected
                  ? "bg-surface-container border-2 border-primary shadow-[0_0_25px_rgba(0,229,255,0.18)]"
                  : plan.destacado
                  ? "bg-surface-container border border-secondary/50 hover:border-primary"
                  : "bg-surface-container border border-surface-high hover:border-gray-500"
              }`}
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span
                      className={
                        isSelected
                          ? "text-primary font-extrabold"
                          : plan.destacado
                          ? "text-secondary font-bold"
                          : "text-gray-400"
                      }
                    >
                      {isSelected
                        ? "● PLAN SELECCIONADO"
                        : plan.destacado
                        ? "★ RECOMENDADO"
                        : plan.badge || `PLAN 0${plan.orden}`}
                    </span>
                    <span className="text-gray-400 uppercase">{billingCycle}</span>
                  </div>

                  <h2 className="text-lg font-extrabold text-white leading-snug">
                    {plan.nombre}
                  </h2>

                  <p className="text-xs text-gray-300 leading-relaxed min-h-[3.25rem]">
                    {plan.descripcion}
                  </p>
                </div>

                {/* Bloque de Costo (Mensual o Anual) */}
                <div className="py-3.5 border-y border-surface-high space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono font-extrabold text-white">
                      ${Number(displayPrice).toFixed(2)}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {plan.moneda || "USD"} / {billingCycle === "mensual" ? "mes" : "año"}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-primary">
                    {Number(displayPrice) === 0
                      ? "Ingreso directo sin comprobante de pago"
                      : plan.etiquetaCostoPendiente}
                  </div>
                </div>

                {/* Lista de Beneficios */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-gray-400 uppercase font-semibold block">
                    Beneficios del Plan:
                  </span>
                  <ul className="space-y-2 text-xs text-gray-200">
                    {plan.beneficios.map((ben, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-secondary font-mono font-bold shrink-0">
                          ✓
                        </span>
                        <span className="leading-snug">{ben}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-surface-high">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanId(plan.id);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-mono font-extrabold text-xs uppercase transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary text-surface"
                      : "bg-surface border border-surface-high text-gray-300 hover:border-primary hover:text-white"
                  }`}
                >
                  {isSelected ? "Seleccionado ✓" : `Elegir ${plan.nombre}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Barra Inferior de Confirmación del Paso 2 */}
      {selectedPlanObj && (
        <div className="bg-surface-container border border-surface-high rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-gray-400">
              RESUMEN DE TU ELECCIÓN:
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white flex flex-wrap items-center gap-2">
              <span>{selectedPlanObj.nombre}</span>
              <span className="text-primary font-mono text-sm">
                ({billingCycle === "mensual" ? "Modalidad Mensual" : "Modalidad Anual"} — $
                {currentSelectedPrice.toFixed(2)} {selectedPlanObj.moneda || "USD"})
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={onBackToStep1}
              className="px-4 py-3 rounded-xl bg-surface border border-surface-high hover:border-gray-500 text-gray-300 text-xs font-mono font-bold cursor-pointer"
            >
              ← Volver al Paso 1
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmStep2}
              className="px-7 py-3 rounded-xl bg-primary text-surface font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? "Procesando..."
                : isSelectedPlanFree
                ? "Confirmar Plan ($0.00) e Ingresar Directo →"
                : "Confirmar Plan e Ir al Paso 3: Medios de Pago →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
