// ============================================================================
// ARCHIVO: src/components/PaymentMethodsStep3.tsx
// DESCRIPCIÓN: Paso 3 de 3 — "Elige tu Medio de Pago y Sube tu Comprobante"
//              1) QR Bancario (Banco Pichincha y Banco del Pacífico + Instrucciones + Comprobante)
//              2) Transferencia o Depósito (Banco Pichincha, Banco del Pacífico y Banco Diners Club + Comprobante)
//              3) Tarjeta de Crédito o Débito (PayPhone — en pantalla, pendiente de configuración)
//              Al enviar el comprobante, ingresa a la app con el Plan Básico Freemium y el aviso
//              destacado de activación del plan elegido en un plazo máximo de 24 horas.
// ============================================================================

import React, { useState } from "react";
import {
  QrCode,
  Building2,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  Upload,
  FileCheck2,
  Copy,
  Check,
  Clock,
  ArrowLeft,
  ArrowRight,
  Sliders,
  Sparkles,
  AlertCircle,
  Smartphone,
  Receipt
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PaymentMethodType } from "../types";

interface PaymentMethodsStep3Props {
  onOpenMasterEditor: () => void;
  onBackToStep2: () => void;
  onCompletedStep3: () => void;
}

export const PaymentMethodsStep3: React.FC<PaymentMethodsStep3Props> = ({
  onOpenMasterEditor,
  onBackToStep2,
  onCompletedStep3
}) => {
  const {
    user,
    isMaster,
    plansCatalog,
    paymentMethodsConfig,
    submitPaymentStep3,
    completeFreePlanOnboarding
  } = useAuth();

  // Plan elegido en el Paso 2
  const selectedPlanStep2 = user?.datosPlanPaso2;
  const matchedPlan =
    plansCatalog.find((p) => p.id === selectedPlanStep2?.planId) ||
    plansCatalog.find((p) => p.id === "plan-universitario") ||
    plansCatalog[0];

  const planId = selectedPlanStep2?.planId || matchedPlan.id;
  const planNombre = selectedPlanStep2?.planNombre || matchedPlan.nombre;
  const ciclo = selectedPlanStep2?.cicloFacturacion || "mensual";
  const monto =
    selectedPlanStep2?.costoAplicado ??
    (ciclo === "mensual" ? matchedPlan.costoMensual : matchedPlan.costoAnual);
  const moneda = selectedPlanStep2?.moneda || matchedPlan.moneda || "USD";

  // Opción de medio de pago activa (1: QR Bancario, 2: Transferencia o Depósito, 3: Tarjeta PayPhone)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>("qr_bancario");

  // Banco seleccionado dentro de QR Bancario (Pichincha o Pacífico)
  const enabledQrBanks = paymentMethodsConfig.qrBancos.filter((b) => b.habilitado);
  const [selectedQrBankId, setSelectedQrBankId] = useState<string>(
    enabledQrBanks[0]?.id || "qr-pichincha"
  );

  // Banco seleccionado dentro de Transferencia o Depósito (Pichincha, Pacífico o Diners Club)
  const enabledTransferBanks = paymentMethodsConfig.cuentasTransferencia.filter((b) => b.habilitado);
  const [selectedTransferBankId, setSelectedTransferBankId] = useState<string>(
    enabledTransferBanks[0]?.id || "trans-pichincha"
  );

  // Campos obligatorios del comprobante
  const [numeroComprobante, setNumeroComprobante] = useState<string>(
    user?.datosPagoPaso3?.numeroComprobante || ""
  );
  const [fotoComprobante, setFotoComprobante] = useState<string>(
    user?.datosPagoPaso3?.fotoComprobante || ""
  );
  const [nombreArchivoComprobante, setNombreArchivoComprobante] = useState<string>("");

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const activeQrBank =
    enabledQrBanks.find((b) => b.id === selectedQrBankId) ||
    enabledQrBanks[0] ||
    paymentMethodsConfig.qrBancos[0];

  const activeTransferBank =
    enabledTransferBanks.find((b) => b.id === selectedTransferBankId) ||
    enabledTransferBanks[0] ||
    paymentMethodsConfig.cuentasTransferencia[0];

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Procesar imagen/captura de comprobante y comprimir a DataURL para sincronizar en Firebase
  const handleReceiptImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLocalError("Por favor sube una captura o fotografía válida (JPG, PNG o WEBP).");
      return;
    }

    setNombreArchivoComprobante(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 900;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          setFotoComprobante(compressedDataUrl);
        } else {
          setFotoComprobante(String(ev.target?.result || ""));
        }
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (selectedMethod === "tarjeta_payphone") {
      setLocalError(
        "El pago con tarjeta vía PayPhone estará habilitado próximamente. Por favor elige 'QR Bancario' o 'Transferencia o Depósito' para subir tu comprobante."
      );
      return;
    }

    if (!numeroComprobante.trim() || numeroComprobante.trim().length < 4) {
      setLocalError(
        "Debes copiar y pegar el número de comprobante bancario (mínimo 4 caracteres)."
      );
      return;
    }

    if (!fotoComprobante) {
      setLocalError(
        "Debes adjuntar una captura de pantalla, foto o evidencia del comprobante de pago."
      );
      return;
    }

    setSubmitting(true);
    try {
      const bankId =
        selectedMethod === "qr_bancario"
          ? activeQrBank?.id || "qr-pichincha"
          : activeTransferBank?.id || "trans-pichincha";

      const bankName =
        selectedMethod === "qr_bancario"
          ? `${activeQrBank?.banco || "Banco"} (${activeQrBank?.nombreApp || "QR"})`
          : activeTransferBank?.banco || "Transferencia Bancaria";

      await submitPaymentStep3({
        metodoPago: selectedMethod,
        entidadBancariaId: bankId,
        entidadBancariaNombre: bankName,
        numeroComprobante: numeroComprobante.trim(),
        fotoComprobante,
        planSolicitadoId: planId,
        planSolicitadoNombre: planNombre,
        cicloFacturacion: ciclo,
        montoPagado: monto,
        moneda
      });

      onCompletedStep3();
    } catch (err: any) {
      setLocalError(err?.message || "No se pudo registrar el comprobante. Inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipWithFreePlan = async () => {
    setSubmitting(true);
    try {
      await completeFreePlanOnboarding();
      onCompletedStep3();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container border border-surface-high rounded-2xl p-6 sm:p-8 shadow-2xl">
      {/* Cabecera Paso 3 de 3 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-surface-high">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-wider mb-2">
            <Receipt className="w-3.5 h-3.5" />
            PASO 3 DE 3 • VALIDACIÓN FINANCIERA & ACCESO INMEDIATO
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Elige tu Medio de Pago y Sube tu Comprobante
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Selecciona una de las 3 modalidades de pago. Una vez subas el número y foto de tu
            comprobante, ingresarás inmediatamente a la plataforma con el{" "}
            <span className="text-primary font-semibold">Plan Básico Freemium</span> mientras
            habilitamos tu plan seleccionado en un plazo máximo de{" "}
            <span className="text-warning font-semibold">24 horas</span>.
          </p>
        </div>

        {isMaster && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenMasterEditor}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/15 hover:bg-warning/25 border border-warning/40 text-warning text-xs font-mono font-bold transition cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              Panel Maestro: Configurar QR y Cuentas
            </button>
          </div>
        )}
      </div>

      {/* Resumen del Plan Seleccionado en Paso 2 */}
      <div className="mb-7 p-4 sm:p-5 rounded-2xl bg-surface border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase text-slate-400">
                Plan Seleccionado (Paso 2):
              </span>
              <span className="text-sm font-extrabold text-white">{planNombre}</span>
              <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[11px] font-mono uppercase">
                Ciclo {ciclo}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Al enviar tu comprobante entrarás de inmediato con{" "}
              <span className="text-secondary font-semibold">Plan Básico Freemium</span> y en{" "}
              <span className="text-warning font-semibold">máximo 24 horas</span> se activarán todas
              las funciones de <span className="text-white font-semibold">{planNombre}</span>.
            </p>
          </div>
        </div>

        <div className="flex sm:flex-col items-baseline sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-surface-high shrink-0">
          <span className="text-[11px] font-mono uppercase text-slate-400">Valor a pagar</span>
          <span className="text-2xl font-mono font-extrabold text-primary">
            ${Number(monto).toFixed(2)} <span className="text-xs text-slate-400">{moneda}</span>
          </span>
        </div>
      </div>

      {/* Si el usuario escogió Plan Básico Freemium ($0), puede entrar directo o igual revisar los medios */}
      {planId === "plan-basico-freemium" && (
        <div className="mb-6 p-4 rounded-xl bg-secondary/10 border border-secondary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-200">
            <span className="font-bold text-secondary">Seleccionaste el Plan Básico Freemium:</span>{" "}
            Puedes ingresar directamente sin comprobante o adquirir uno de los planes superiores
            usando los medios de pago debajo.
          </div>
          <button
            type="button"
            onClick={handleSkipWithFreePlan}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-secondary text-surface font-bold text-xs hover:brightness-110 transition shrink-0 cursor-pointer"
          >
            Ingresar Directo con Plan Gratuito
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* SELECTOR DE LAS 3 OPCIONES DE PAGO                                  */}
      {/* =================================================================== */}
      <div className="mb-7">
        <label className="block text-xs font-mono uppercase text-slate-400 mb-3">
          Selecciona una de las 3 modalidades de pago disponibles:
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* OPCIÓN 1: QR BANCARIO */}
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("qr_bancario");
              setLocalError(null);
            }}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              selectedMethod === "qr_bancario"
                ? "bg-primary/15 border-primary shadow-lg shadow-primary/10"
                : "bg-surface border-surface-high hover:border-slate-600"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  selectedMethod === "qr_bancario"
                    ? "bg-primary text-surface border-primary"
                    : "bg-surface-container text-primary border-surface-high"
                }`}
              >
                <QrCode className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  selectedMethod === "qr_bancario"
                    ? "bg-primary/20 text-primary border-primary/40 font-bold"
                    : "bg-surface-container text-slate-400 border-surface-high"
                }`}
              >
                Opción 1 • Activa
              </span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">1) QR Bancario</h3>
              <p className="text-xs text-slate-400 mt-1">
                Escanea el código QR desde la app de{" "}
                <span className="text-slate-200 font-semibold">Banco Pichincha</span> o{" "}
                <span className="text-slate-200 font-semibold">Banco del Pacífico</span> y sube tu
                comprobante.
              </p>
            </div>
          </button>

          {/* OPCIÓN 2: TRANSFERENCIA O DEPÓSITO */}
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("transferencia_deposito");
              setLocalError(null);
            }}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              selectedMethod === "transferencia_deposito"
                ? "bg-secondary/15 border-secondary shadow-lg shadow-secondary/10"
                : "bg-surface border-surface-high hover:border-slate-600"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  selectedMethod === "transferencia_deposito"
                    ? "bg-secondary text-surface border-secondary"
                    : "bg-surface-container text-secondary border-surface-high"
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  selectedMethod === "transferencia_deposito"
                    ? "bg-secondary/20 text-secondary border-secondary/40 font-bold"
                    : "bg-surface-container text-slate-400 border-surface-high"
                }`}
              >
                Opción 2 • Activa
              </span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">2) Transferencia o Depósito</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cuentas habilitadas en{" "}
                <span className="text-slate-200 font-semibold">
                  Banco Pichincha, Banco del Pacífico y Banco Diners Club
                </span>
                .
              </p>
            </div>
          </button>

          {/* OPCIÓN 3: TARJETA DE CRÉDITO O DÉBITO (PAYPHONE) */}
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("tarjeta_payphone");
              setLocalError(null);
            }}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              selectedMethod === "tarjeta_payphone"
                ? "bg-warning/15 border-warning shadow-lg shadow-warning/10"
                : "bg-surface border-surface-high hover:border-slate-600"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  selectedMethod === "tarjeta_payphone"
                    ? "bg-warning text-surface border-warning"
                    : "bg-surface-container text-warning border-surface-high"
                }`}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 font-bold">
                Opción 3 • Próximamente
              </span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                3) Tarjeta de Crédito o Débito
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pasarela <span className="text-warning font-semibold">PayPhone</span> (en etapa de
                configuración).
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* DESPLIEGUE DINÁMICO SEGÚN LA OPCIÓN ELEGIDA                         */}
      {/* =================================================================== */}

      {/* ------------------------------------------------------------------- */}
      {/* CONTENIDO OPCIÓN 1: QR BANCARIO (PICHINCHA Y PACÍFICO)              */}
      {/* ------------------------------------------------------------------- */}
      {selectedMethod === "qr_bancario" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-surface border border-surface-high">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-surface-high">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Escanea el Código QR desde el aplicativo de tu banco
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecciona entre{" "}
                  <span className="text-slate-200 font-semibold">Banco Pichincha</span> o{" "}
                  <span className="text-slate-200 font-semibold">Banco del Pacífico</span> para
                  visualizar su código QR oficial.
                </p>
              </div>

              {/* Pestañas de selección de QR (Pichincha vs Pacífico) */}
              <div className="flex items-center gap-2 bg-surface-container p-1.5 rounded-xl border border-surface-high">
                {enabledQrBanks.map((bank) => {
                  const isActive = activeQrBank?.id === bank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedQrBankId(bank.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-primary text-surface shadow"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {bank.banco}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vista de las 2 tarjetas QR lado a lado con resalte en la seleccionada */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {enabledQrBanks.map((qrBank) => {
                const isSelected = activeQrBank?.id === qrBank.id;
                return (
                  <div
                    key={qrBank.id}
                    onClick={() => setSelectedQrBankId(qrBank.id)}
                    className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row items-center gap-5 ${
                      isSelected
                        ? "bg-surface-container border-primary ring-1 ring-primary/40"
                        : "bg-surface-container/50 border-surface-high hover:border-slate-600 opacity-85"
                    }`}
                  >
                    {/* Imagen del QR */}
                    <div className="w-44 h-44 rounded-2xl bg-white p-2.5 border-2 border-primary/40 shrink-0 flex items-center justify-center overflow-hidden shadow-lg">
                      <img
                        src={qrBank.qrImageUrl}
                        alt={`QR ${qrBank.banco}`}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Datos de verificación del QR */}
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-[11px] font-mono font-bold">
                        {qrBank.nombreApp}
                      </div>
                      <h4 className="text-lg font-extrabold text-white">{qrBank.banco}</h4>

                      <div className="space-y-1 text-xs text-slate-300 pt-1">
                        <div>
                          <span className="text-slate-500 font-mono">Titular a verificar: </span>
                          <span className="font-bold text-white">{qrBank.titular}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-mono">Cédula / RUC: </span>
                          <span className="font-mono text-slate-200">{qrBank.cedulaRuc}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-mono">Cuenta ref.: </span>
                          <span className="font-mono text-slate-200">{qrBank.numeroCuenta}</span>
                        </div>
                      </div>

                      {qrBank.notaEspecifica && (
                        <p className="text-[11px] text-slate-400 bg-surface p-2.5 rounded-xl border border-surface-high mt-2">
                          {qrBank.notaEspecifica}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instrucciones para evitar errores (configurables desde el Panel Maestro) */}
            <div className="mt-5 p-4 rounded-xl bg-warning/10 border border-warning/30">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-warning font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {paymentMethodsConfig.qrTituloInstrucciones}
                </h4>
              </div>
              <ul className="space-y-1.5">
                {paymentMethodsConfig.qrInstruccionesEvitarErrores.map((inst, idx) => (
                  <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* CONTENIDO OPCIÓN 2: TRANSFERENCIA O DEPÓSITO                        */}
      {/* (Banco Pichincha, Banco del Pacífico y Banco Diners Club)           */}
      {/* ------------------------------------------------------------------- */}
      {selectedMethod === "transferencia_deposito" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-surface border border-surface-high">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-surface-high">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-secondary" />
                  Cuentas Bancarias Oficiales para Transferencia o Depósito
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Elige el banco al que realizaste o realizarás tu transferencia o depósito.
                </p>
              </div>
            </div>

            {/* Tarjetas de los 3 bancos: Pichincha, Pacífico y Diners Club */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {enabledTransferBanks.map((bank) => {
                const isSelected = activeTransferBank?.id === bank.id;
                return (
                  <div
                    key={bank.id}
                    onClick={() => setSelectedTransferBankId(bank.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-surface-container border-secondary ring-1 ring-secondary/40 shadow-lg"
                        : "bg-surface-container/50 border-surface-high hover:border-slate-600"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 font-bold">
                          {bank.tipoCuenta}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-mono text-secondary flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Seleccionado
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-extrabold text-white mb-3">{bank.banco}</h4>

                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-surface border border-surface-high flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-[10px] font-mono uppercase text-slate-400">
                              Número de Cuenta
                            </span>
                            <span className="font-mono font-bold text-white text-sm">
                              {bank.numeroCuenta}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(bank.numeroCuenta, `cta-${bank.id}`);
                            }}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-high text-slate-300 hover:text-white transition cursor-pointer"
                            title="Copiar número de cuenta"
                          >
                            {copiedField === `cta-${bank.id}` ? (
                              <Check className="w-4 h-4 text-secondary" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-surface-high">
                          <span className="block text-[10px] font-mono uppercase text-slate-400">
                            Titular de la Cuenta
                          </span>
                          <span className="font-bold text-slate-100">{bank.titular}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-surface-high flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-[10px] font-mono uppercase text-slate-400">
                              Cédula / RUC
                            </span>
                            <span className="font-mono text-slate-200">{bank.cedulaRuc}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(bank.cedulaRuc, `ruc-${bank.id}`);
                            }}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-high text-slate-300 hover:text-white transition cursor-pointer"
                            title="Copiar Cédula/RUC"
                          >
                            {copiedField === `ruc-${bank.id}` ? (
                              <Check className="w-4 h-4 text-secondary" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-surface-high">
                          <span className="block text-[10px] font-mono uppercase text-slate-400">
                            Correo de Notificación
                          </span>
                          <span className="font-mono text-primary text-[11px]">
                            {bank.emailNotificacion}
                          </span>
                        </div>
                      </div>
                    </div>

                    {bank.notaAdicional && (
                      <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-surface-high">
                        {bank.notaAdicional}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Instrucciones para evitar errores en Transferencia o Depósito */}
            <div className="mt-5 p-4 rounded-xl bg-secondary/10 border border-secondary/30">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-secondary font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {paymentMethodsConfig.transferenciaTituloInstrucciones}
                </h4>
              </div>
              <ul className="space-y-1.5">
                {paymentMethodsConfig.transferenciaInstrucciones.map((inst, idx) => (
                  <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* CONTENIDO OPCIÓN 3: TARJETA DE CRÉDITO O DÉBITO (PAYPHONE)          */}
      {/* ------------------------------------------------------------------- */}
      {selectedMethod === "tarjeta_payphone" && (
        <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-warning/40 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-warning/15 border border-warning/40 flex items-center justify-center text-warning mx-auto">
            <CreditCard className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/15 border border-warning/30 text-warning text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5" />
            PASARELA EN CONFIGURACIÓN
          </div>
          <h3 className="text-xl font-extrabold text-white">
            {paymentMethodsConfig.payphoneTitulo}
          </h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            {paymentMethodsConfig.payphoneMensajePendiente}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedMethod("qr_bancario")}
              className="px-4 py-2.5 rounded-xl bg-primary text-surface font-bold text-xs hover:brightness-110 transition cursor-pointer"
            >
              Usar Opción 1: QR Bancario
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod("transferencia_deposito")}
              className="px-4 py-2.5 rounded-xl bg-secondary text-surface font-bold text-xs hover:brightness-110 transition cursor-pointer"
            >
              Usar Opción 2: Transferencia o Depósito
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* FORMULARIO DE COMPROBANTE (COMÚN PARA OPCIÓN 1 Y OPCIÓN 2)          */}
      {/* =================================================================== */}
      {(selectedMethod === "qr_bancario" || selectedMethod === "transferencia_deposito") && (
        <form onSubmit={handleSubmitReceipt} className="mt-6 space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-primary/30 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-high">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-primary" />
                  Registra los Datos y Evidencia de tu Comprobante
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modalidad seleccionada:{" "}
                  <span className="text-primary font-semibold">
                    {selectedMethod === "qr_bancario"
                      ? `QR Bancario — ${activeQrBank?.banco}`
                      : `Transferencia / Depósito — ${activeTransferBank?.banco}`}
                  </span>
                </p>
              </div>
              <span className="text-[11px] font-mono text-warning bg-warning/10 border border-warning/30 px-2.5 py-1 rounded-lg">
                Ambos campos son obligatorios
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CAMPO 1: COPIAR Y PEGAR EL NÚMERO DE COMPROBANTE */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-slate-300 font-bold">
                  1. Copia y pega el Número de Comprobante / Documento *
                </label>
                <input
                  type="text"
                  value={numeroComprobante}
                  onChange={(e) => setNumeroComprobante(e.target.value)}
                  placeholder="Ej: 0948271645 / COMP-20258891"
                  required
                  className="w-full px-4 py-3.5 rounded-xl bg-surface-container border border-surface-high focus:border-primary focus:outline-none text-white font-mono text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Ingresa exactamente el número de comprobante, referencia o secuencial que generó
                  tu banco al confirmar la transacción.
                </p>
              </div>

              {/* CAMPO 2: SUBIR CAPTURA, FOTO O EVIDENCIA DEL COMPROBANTE */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-slate-300 font-bold">
                  2. Sube la Captura, Foto o Evidencia del Comprobante *
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-surface-container hover:bg-surface-high border border-dashed border-primary/50 text-xs font-semibold text-primary cursor-pointer transition">
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>
                      {fotoComprobante
                        ? "Cambiar Captura / Foto del Comprobante"
                        : "Seleccionar Captura o Foto del Comprobante"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptImageUpload}
                      className="hidden"
                    />
                  </label>

                  {fotoComprobante && (
                    <div className="w-16 h-16 rounded-xl border border-secondary overflow-hidden shrink-0 bg-surface-container relative">
                      <img
                        src={fotoComprobante}
                        alt="Vista previa comprobante"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {nombreArchivoComprobante && (
                  <p className="text-[11px] text-secondary font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Evidencia cargada: {nombreArchivoComprobante}
                  </p>
                )}
              </div>
            </div>

            {/* Banner informativo de ingreso con Plan Básico Freemium y activación en 24h */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-slate-200 leading-relaxed">
                <span className="font-bold text-primary block mb-0.5">
                  ¿Qué sucede al enviar tu comprobante?
                </span>
                {paymentMethodsConfig.mensajeActivacion24Horas}
              </div>
            </div>

            {localError && (
              <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/40 text-danger text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            {/* Botonera de navegación Paso 3 */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBackToStep2}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-container hover:bg-surface-high border border-surface-high text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Paso 2 (Cambiar Plan)
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-surface font-extrabold text-sm hover:brightness-110 transition shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer"
              >
                <span>
                  {submitting
                    ? "Registrando Comprobante..."
                    : "Enviar Comprobante e Ingresar con Plan Gratuito (Activación en máx. 24h)"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
