// ============================================================================
// ARCHIVO: src/components/MasterPlansEditorModal.tsx
// DESCRIPCIÓN: Panel del Administrador Maestro (anthonnyvelastegui@gmail.com y
//              aavemakaihc@gmail.com) para configurar a su gusto:
//              1) Los 4 Planes (Descripciones, Beneficios y Costos Mensual/Anual)
//              2) Medios de Pago (Imágenes QR e instrucciones de Pichincha y Pacífico;
//                 Datos de Transferencia de Pichincha, Pacífico y Diners Club;
//                 Mensaje de 24 horas y estado de PayPhone)
//              3) Bandeja de Comprobantes Enviados (verificación y aprobación).
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Sliders,
  DollarSign,
  FileText,
  ListChecks,
  ShieldCheck,
  Sparkles,
  QrCode,
  Building2,
  Upload,
  CheckCircle2,
  Receipt,
  Clock
} from "lucide-react";
import {
  SubscriptionPlanConfig,
  PaymentMethodsAdminConfig,
  QRBankItemConfig,
  TransferBankAccountConfig
} from "../types";
import { useAuth } from "../context/AuthContext";
import { MASTER_ADMINS } from "../services/firebase";

interface MasterPlansEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "planes" | "medios_pago" | "comprobantes";
}

export const MasterPlansEditorModal: React.FC<MasterPlansEditorModalProps> = ({
  isOpen,
  onClose,
  initialTab = "planes"
}) => {
  const {
    plansCatalog,
    savePlansCatalog,
    resetPlansCatalogToDefault,
    paymentMethodsConfig,
    savePaymentMethodsConfig,
    resetPaymentMethodsConfigToDefault,
    paymentSubmissions,
    approvePaymentSubmission,
    user,
    isMaster
  } = useAuth();

  const [activeMainTab, setActiveMainTab] = useState<"planes" | "medios_pago" | "comprobantes">(
    initialTab
  );

  // Estado para edición de Planes (Paso 2)
  const [draftPlans, setDraftPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>("plan-basico-freemium");
  const [newBenefitText, setNewBenefitText] = useState<string>("");

  // Estado para edición de Medios de Pago (Paso 3)
  const [draftPaymentConfig, setDraftPaymentConfig] = useState<PaymentMethodsAdminConfig>(
    paymentMethodsConfig
  );
  const [newQrInstruction, setNewQrInstruction] = useState<string>("");
  const [newTransferInstruction, setNewTransferInstruction] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const clonedPlans = JSON.parse(JSON.stringify(plansCatalog)) as SubscriptionPlanConfig[];
      setDraftPlans(clonedPlans);
      if (clonedPlans.length > 0 && !clonedPlans.some((p) => p.id === activePlanId)) {
        setActivePlanId(clonedPlans[0].id);
      }

      const clonedPayment = JSON.parse(
        JSON.stringify(paymentMethodsConfig)
      ) as PaymentMethodsAdminConfig;
      setDraftPaymentConfig(clonedPayment);
      setSavedToast(null);
    }
  }, [isOpen, plansCatalog, paymentMethodsConfig]);

  if (!isOpen || !isMaster) return null;

  const currentPlan = draftPlans.find((p) => p.id === activePlanId) || draftPlans[0];

  // =========================================================================
  // HANDLERS PESTAÑA 1: PLANES DE SUSCRIPCIÓN
  // =========================================================================
  const updateCurrentPlanField = <K extends keyof SubscriptionPlanConfig>(
    field: K,
    value: SubscriptionPlanConfig[K]
  ) => {
    setDraftPlans((prev) =>
      prev.map((plan) => (plan.id === currentPlan.id ? { ...plan, [field]: value } : plan))
    );
    setSavedToast(null);
  };

  const handleBenefitChange = (idx: number, value: string) => {
    if (!currentPlan) return;
    const updated = [...currentPlan.beneficios];
    updated[idx] = value;
    updateCurrentPlanField("beneficios", updated);
  };

  const handleAddBenefit = () => {
    if (!currentPlan || !newBenefitText.trim()) return;
    updateCurrentPlanField("beneficios", [...currentPlan.beneficios, newBenefitText.trim()]);
    setNewBenefitText("");
  };

  const handleRemoveBenefit = (idx: number) => {
    if (!currentPlan) return;
    const updated = currentPlan.beneficios.filter((_, i) => i !== idx);
    updateCurrentPlanField("beneficios", updated);
  };

  // =========================================================================
  // HANDLERS PESTAÑA 2: MEDIOS DE PAGO (QR PICHINCHA/PACÍFICO Y TRANSFERENCIAS)
  // =========================================================================
  const updateQrBankField = <K extends keyof QRBankItemConfig>(
    bankId: string,
    field: K,
    value: QRBankItemConfig[K]
  ) => {
    setDraftPaymentConfig((prev) => ({
      ...prev,
      qrBancos: prev.qrBancos.map((b) => (b.id === bankId ? { ...b, [field]: value } : b))
    }));
    setSavedToast(null);
  };

  // Subir nueva imagen de QR (Pichincha o Pacífico) desde archivo local
  const handleQrImageUpload = (bankId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 650;
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
          updateQrBankField(bankId, "qrImageUrl", canvas.toDataURL("image/png", 0.92));
        } else {
          updateQrBankField(bankId, "qrImageUrl", String(ev.target?.result || ""));
        }
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const handleQrInstructionChange = (idx: number, val: string) => {
    const list = [...draftPaymentConfig.qrInstruccionesEvitarErrores];
    list[idx] = val;
    setDraftPaymentConfig((prev) => ({ ...prev, qrInstruccionesEvitarErrores: list }));
    setSavedToast(null);
  };

  const handleAddQrInstruction = () => {
    if (!newQrInstruction.trim()) return;
    setDraftPaymentConfig((prev) => ({
      ...prev,
      qrInstruccionesEvitarErrores: [
        ...prev.qrInstruccionesEvitarErrores,
        newQrInstruction.trim()
      ]
    }));
    setNewQrInstruction("");
  };

  const handleRemoveQrInstruction = (idx: number) => {
    setDraftPaymentConfig((prev) => ({
      ...prev,
      qrInstruccionesEvitarErrores: prev.qrInstruccionesEvitarErrores.filter((_, i) => i !== idx)
    }));
  };

  const updateTransferBankField = <K extends keyof TransferBankAccountConfig>(
    bankId: string,
    field: K,
    value: TransferBankAccountConfig[K]
  ) => {
    setDraftPaymentConfig((prev) => ({
      ...prev,
      cuentasTransferencia: prev.cuentasTransferencia.map((b) =>
        b.id === bankId ? { ...b, [field]: value } : b
      )
    }));
    setSavedToast(null);
  };

  const handleTransferInstructionChange = (idx: number, val: string) => {
    const list = [...draftPaymentConfig.transferenciaInstrucciones];
    list[idx] = val;
    setDraftPaymentConfig((prev) => ({ ...prev, transferenciaInstrucciones: list }));
    setSavedToast(null);
  };

  const handleAddTransferInstruction = () => {
    if (!newTransferInstruction.trim()) return;
    setDraftPaymentConfig((prev) => ({
      ...prev,
      transferenciaInstrucciones: [
        ...prev.transferenciaInstrucciones,
        newTransferInstruction.trim()
      ]
    }));
    setNewTransferInstruction("");
  };

  const handleRemoveTransferInstruction = (idx: number) => {
    setDraftPaymentConfig((prev) => ({
      ...prev,
      transferenciaInstrucciones: prev.transferenciaInstrucciones.filter((_, i) => i !== idx)
    }));
  };

  // =========================================================================
  // GUARDAR TODO EN FIREBASE FIRESTORE Y LOCALSTORAGE
  // =========================================================================
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await savePlansCatalog(draftPlans);
      await savePaymentMethodsConfig(draftPaymentConfig);
      setSavedToast(
        "¡Planes, Códigos QR, Cuentas Bancarias e Instrucciones guardados en tiempo real!"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetCurrentTab = async () => {
    setSaving(true);
    try {
      if (activeMainTab === "planes") {
        await resetPlansCatalogToDefault();
      } else if (activeMainTab === "medios_pago") {
        await resetPaymentMethodsConfigToDefault();
      }
      setSavedToast("Valores restaurados a la configuración base.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-surface-container border border-primary/40 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Cabecera del Panel Maestro */}
        <div className="px-6 py-4 bg-surface border-b border-surface-high flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/40 flex items-center justify-center text-warning">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Panel del Administrador Maestro • Configuración Total (Paso 2 y Paso 3)
                </h2>
                <span className="px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 text-[10px] font-mono uppercase">
                  CMS Maestro
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cuentas maestras autorizadas: {MASTER_ADMINS.join(" • ")}
                {user?.email && (
                  <span className="ml-2 text-primary font-mono">
                    ({isMaster ? `Sesión Master: ${user.email}` : `Vista previa: ${user.email}`})
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-surface-container hover:bg-surface-high text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pestañas Principales del Administrador Maestro */}
        <div className="px-6 py-3 bg-surface/70 border-b border-surface-high flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab("planes")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeMainTab === "planes"
                ? "bg-primary text-surface shadow"
                : "bg-surface-container text-slate-300 hover:text-white border border-surface-high"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            1. Configurar Planes, Beneficios y Costos (Paso 2)
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("medios_pago")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeMainTab === "medios_pago"
                ? "bg-secondary text-surface shadow"
                : "bg-surface-container text-slate-300 hover:text-white border border-surface-high"
            }`}
          >
            <QrCode className="w-4 h-4" />
            2. Configurar QR (Pichincha/Pacífico) y Cuentas Bancarias (Paso 3)
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("comprobantes")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeMainTab === "comprobantes"
                ? "bg-warning text-surface shadow"
                : "bg-surface-container text-slate-300 hover:text-white border border-surface-high"
            }`}
          >
            <Receipt className="w-4 h-4" />
            3. Comprobantes Recibidos ({paymentSubmissions.length})
          </button>
        </div>

        {/* ================================================================= */}
        {/* PESTAÑA 1: CONFIGURADOR DE LOS 4 PLANES (PASO 2)                  */}
        {/* ================================================================= */}
        {activeMainTab === "planes" && currentPlan && (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-surface-high">
            {/* Selector lateral de los 4 planes */}
            <div className="lg:col-span-4 p-5 bg-surface/50 space-y-3">
              <div className="text-xs font-mono uppercase text-slate-400 mb-2">
                Selecciona el Plan a Configurar
              </div>

              {draftPlans.map((plan) => {
                const isSelected = plan.id === currentPlan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setActivePlanId(plan.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-primary/15 border-primary text-white shadow-lg"
                        : "bg-surface border-surface-high text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{plan.nombre}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Mensual: ${Number(plan.costoMensual).toFixed(2)} • Anual: $
                        {Number(plan.costoAnual).toFixed(2)}
                      </div>
                    </div>
                    {plan.destacado && (
                      <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-mono">
                        Destacado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Formulario de edición del plan */}
            <div className="lg:col-span-8 p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Nombre del Plan
                  </label>
                  <input
                    type="text"
                    value={currentPlan.nombre}
                    onChange={(e) => updateCurrentPlanField("nombre", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high focus:border-primary focus:outline-none text-white text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Etiqueta / Badge Superior
                  </label>
                  <input
                    type="text"
                    value={currentPlan.badge}
                    onChange={(e) => updateCurrentPlanField("badge", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high focus:border-primary focus:outline-none text-white text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Subtítulo Corto
                </label>
                <input
                  type="text"
                  value={currentPlan.subtitulo}
                  onChange={(e) => updateCurrentPlanField("subtitulo", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high focus:border-primary focus:outline-none text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Descripción Completa del Plan
                </label>
                <textarea
                  rows={3}
                  value={currentPlan.descripcion}
                  onChange={(e) => updateCurrentPlanField("descripcion", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high focus:border-primary focus:outline-none text-white text-sm leading-relaxed"
                />
              </div>

              {/* Costos Mensual y Anual */}
              <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    Configuración de Cuotas (Mensual y Anual)
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPlan.destacado}
                      onChange={(e) => updateCurrentPlanField("destacado", e.target.checked)}
                      className="rounded border-surface-high text-primary focus:ring-primary"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-warning" />
                    Marcar como Plan Recomendado
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Costo Mensual (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentPlan.costoMensual}
                      onChange={(e) =>
                        updateCurrentPlanField("costoMensual", parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-high focus:border-primary focus:outline-none text-white font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Costo Anual (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentPlan.costoAnual}
                      onChange={(e) =>
                        updateCurrentPlanField("costoAnual", parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-high focus:border-primary focus:outline-none text-white font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Nota de Costo / Estado
                    </label>
                    <input
                      type="text"
                      value={currentPlan.etiquetaCostoPendiente}
                      onChange={(e) =>
                        updateCurrentPlanField("etiquetaCostoPendiente", e.target.value)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-high focus:border-primary focus:outline-none text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Beneficios */}
              <div className="space-y-3">
                <label className="block text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-secondary" />
                  Beneficios Incluidos en {currentPlan.nombre} ({currentPlan.beneficios.length})
                </label>

                <div className="space-y-2">
                  {currentPlan.beneficios.map((beneficio, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-6 text-right">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={beneficio}
                        onChange={(e) => handleBenefitChange(idx, e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-surface-high focus:border-primary focus:outline-none text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBenefit(idx)}
                        className="p-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newBenefitText}
                    onChange={(e) => setNewBenefitText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBenefit();
                      }
                    }}
                    placeholder="Escribe un nuevo beneficio para este plan..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface border border-surface-high focus:border-secondary focus:outline-none text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddBenefit}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary/15 hover:bg-secondary/25 border border-secondary/40 text-secondary text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PESTAÑA 2: CONFIGURADOR DE MEDIOS DE PAGO (PASO 3)                */}
        {/* ================================================================= */}
        {activeMainTab === "medios_pago" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* SECCIÓN A: CÓDIGOS QR (BANCO PICHINCHA Y BANCO DEL PACÍFICO) */}
            <div className="p-5 rounded-2xl bg-surface border border-primary/30 space-y-5">
              <div className="flex items-center justify-between border-b border-surface-high pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    1) Configuración de QR Bancario (Banco Pichincha y Banco del Pacífico)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sube las imágenes de tus códigos QR de Banco Pichincha y Banco del Pacífico y
                    personaliza los datos de verificación e instrucciones contra errores.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {draftPaymentConfig.qrBancos.map((qr) => (
                  <div
                    key={qr.id}
                    className="p-4 rounded-xl bg-surface-container border border-surface-high space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-primary">{qr.banco}</span>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qr.habilitado}
                          onChange={(e) =>
                            updateQrBankField(qr.id, "habilitado", e.target.checked)
                          }
                        />
                        Mostrar este QR
                      </label>
                    </div>

                    {/* Vista previa + botón para subir nueva imagen QR */}
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-surface border border-surface-high">
                      <div className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={qr.qrImageUrl}
                          alt={qr.banco}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary text-xs font-bold cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5" />
                          Subir Imagen QR de {qr.banco}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleQrImageUpload(qr.id, e)}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="text"
                          value={qr.qrImageUrl}
                          onChange={(e) =>
                            updateQrBankField(qr.id, "qrImageUrl", e.target.value)
                          }
                          placeholder="Ruta o URL de la imagen QR"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container border border-surface-high text-[11px] font-mono text-slate-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Nombre del Banco
                        </label>
                        <input
                          type="text"
                          value={qr.banco}
                          onChange={(e) => updateQrBankField(qr.id, "banco", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Aplicativo (Ej: Deuna! / Be / Móvil)
                        </label>
                        <input
                          type="text"
                          value={qr.nombreApp}
                          onChange={(e) => updateQrBankField(qr.id, "nombreApp", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Titular a Verificar
                        </label>
                        <input
                          type="text"
                          value={qr.titular}
                          onChange={(e) => updateQrBankField(qr.id, "titular", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Cédula / RUC
                        </label>
                        <input
                          type="text"
                          value={qr.cedulaRuc}
                          onChange={(e) => updateQrBankField(qr.id, "cedulaRuc", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Cuenta Referencia
                        </label>
                        <input
                          type="text"
                          value={qr.numeroCuenta}
                          onChange={(e) =>
                            updateQrBankField(qr.id, "numeroCuenta", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Nota Específica del QR
                        </label>
                        <input
                          type="text"
                          value={qr.notaEspecifica}
                          onChange={(e) =>
                            updateQrBankField(qr.id, "notaEspecifica", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Instrucciones para evitar errores en QR Bancario */}
              <div className="pt-3 border-t border-surface-high space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-warning font-bold mb-1">
                    Título de Instrucciones QR para Evitar Errores
                  </label>
                  <input
                    type="text"
                    value={draftPaymentConfig.qrTituloInstrucciones}
                    onChange={(e) =>
                      setDraftPaymentConfig((prev) => ({
                        ...prev,
                        qrTituloInstrucciones: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-container border border-surface-high text-xs text-white"
                  />
                </div>

                <div className="space-y-2">
                  {draftPaymentConfig.qrInstruccionesEvitarErrores.map((inst, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-warning w-6 text-right">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={inst}
                        onChange={(e) => handleQrInstructionChange(idx, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-container border border-surface-high text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveQrInstruction(idx)}
                        className="p-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newQrInstruction}
                    onChange={(e) => setNewQrInstruction(e.target.value)}
                    placeholder="Añadir nueva instrucción anti-errores para pago con QR..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-surface-container border border-surface-high text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddQrInstruction}
                    className="px-4 py-2 rounded-xl bg-warning/15 border border-warning/40 text-warning text-xs font-bold cursor-pointer"
                  >
                    + Añadir Instrucción QR
                  </button>
                </div>
              </div>
            </div>

            {/* SECCIÓN B: CUENTAS DE TRANSFERENCIA O DEPÓSITO (PICHINCHA, PACÍFICO Y DINERS CLUB) */}
            <div className="p-5 rounded-2xl bg-surface border border-secondary/30 space-y-5">
              <div className="border-b border-surface-high pb-3">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-secondary" />
                  2) Configuración de Transferencia o Depósito (Pichincha, Pacífico y Diners Club)
                </h3>
                <p className="text-xs text-slate-400">
                  Configura los números de cuenta, tipo de cuenta, nombre del titular, Cédula/RUC y
                  correo de notificación de tus 3 bancos.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {draftPaymentConfig.cuentasTransferencia.map((cta) => (
                  <div
                    key={cta.id}
                    className="p-4 rounded-xl bg-surface-container border border-surface-high space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-secondary">{cta.banco}</span>
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cta.habilitado}
                          onChange={(e) =>
                            updateTransferBankField(cta.id, "habilitado", e.target.checked)
                          }
                        />
                        Activa
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Nombre de Entidad Bancaria
                      </label>
                      <input
                        type="text"
                        value={cta.banco}
                        onChange={(e) => updateTransferBankField(cta.id, "banco", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Tipo de Cuenta
                      </label>
                      <input
                        type="text"
                        value={cta.tipoCuenta}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "tipoCuenta", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Número de Cuenta
                      </label>
                      <input
                        type="text"
                        value={cta.numeroCuenta}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "numeroCuenta", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs font-mono font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Nombre del Titular
                      </label>
                      <input
                        type="text"
                        value={cta.titular}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "titular", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Cédula / RUC
                      </label>
                      <input
                        type="text"
                        value={cta.cedulaRuc}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "cedulaRuc", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Correo de Notificación
                      </label>
                      <input
                        type="text"
                        value={cta.emailNotificacion}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "emailNotificacion", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Nota Adicional
                      </label>
                      <input
                        type="text"
                        value={cta.notaAdicional}
                        onChange={(e) =>
                          updateTransferBankField(cta.id, "notaAdicional", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-high text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Instrucciones de Transferencia o Depósito */}
              <div className="pt-3 border-t border-surface-high space-y-3">
                <label className="block text-xs font-mono uppercase text-secondary font-bold">
                  Instrucciones para Transferencia o Depósito
                </label>
                <div className="space-y-2">
                  {draftPaymentConfig.transferenciaInstrucciones.map((inst, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-secondary w-6 text-right">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={inst}
                        onChange={(e) => handleTransferInstructionChange(idx, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-surface-container border border-surface-high text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTransferInstruction(idx)}
                        className="p-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTransferInstruction}
                    onChange={(e) => setNewTransferInstruction(e.target.value)}
                    placeholder="Añadir instrucción para transferencias o depósitos..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-surface-container border border-surface-high text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTransferInstruction}
                    className="px-4 py-2 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary text-xs font-bold cursor-pointer"
                  >
                    + Añadir Instrucción
                  </button>
                </div>
              </div>
            </div>

            {/* SECCIÓN C: MENSAJE DE ACTIVACIÓN EN 24 HORAS Y PAYPHONE */}
            <div className="p-5 rounded-2xl bg-surface border border-surface-high grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono uppercase text-primary font-bold mb-1.5">
                  Mensaje Destacado de Activación en Plazo Máximo de 24 Horas
                </label>
                <textarea
                  rows={3}
                  value={draftPaymentConfig.mensajeActivacion24Horas}
                  onChange={(e) =>
                    setDraftPaymentConfig((prev) => ({
                      ...prev,
                      mensajeActivacion24Horas: e.target.value
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-high text-xs text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-warning font-bold mb-1.5">
                  Mensaje en Pantalla para Opción 3: Tarjeta de Crédito / Débito (PayPhone)
                </label>
                <textarea
                  rows={3}
                  value={draftPaymentConfig.payphoneMensajePendiente}
                  onChange={(e) =>
                    setDraftPaymentConfig((prev) => ({
                      ...prev,
                      payphoneMensajePendiente: e.target.value
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-high text-xs text-white leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PESTAÑA 3: BANDEJA DE COMPROBANTES RECIBIDOS (AUDITORÍA 24H)      */}
        {/* ================================================================= */}
        {activeMainTab === "comprobantes" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Comprobantes Enviados por los Usuarios (Paso 3)
                </h3>
                <p className="text-xs text-slate-400">
                  Verifica el número de comprobante y la captura adjunta para habilitar el plan
                  definitivo antes de las 24 horas.
                </p>
              </div>
            </div>

            {paymentSubmissions.length === 0 ? (
              <div className="p-10 rounded-2xl bg-surface border border-surface-high text-center text-slate-400 text-sm">
                Aún no se han recibido comprobantes en esta sesión. Cuando un usuario complete el
                Paso 3, aparecerá aquí con su número de comprobante y su foto adjunta.
              </div>
            ) : (
              <div className="space-y-4">
                {paymentSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-surface border border-surface-high flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      {sub.fotoComprobante && (
                        <a
                          href={sub.fotoComprobante}
                          target="_blank"
                          rel="noreferrer"
                          className="w-20 h-20 rounded-xl border border-primary/40 overflow-hidden shrink-0 bg-surface-container"
                        >
                          <img
                            src={sub.fotoComprobante}
                            alt="Evidencia Comprobante"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-white text-sm">
                            {sub.nombreUsuario}
                          </span>
                          <span className="font-mono text-slate-400">({sub.email})</span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase ${
                              sub.estadoVerificacion === "aprobado"
                                ? "bg-secondary/20 text-secondary border border-secondary/40"
                                : "bg-warning/20 text-warning border border-warning/40"
                            }`}
                          >
                            {sub.estadoVerificacion === "aprobado"
                              ? "Plan Habilitado"
                              : "Pendiente (En Plan Gratuito Temporal)"}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          <span className="text-slate-500 font-mono">Medio y Banco: </span>
                          <span className="font-semibold">{sub.entidadBancariaNombre}</span> •{" "}
                          <span className="text-slate-500 font-mono">N° Comprobante: </span>
                          <span className="font-mono font-bold text-primary">
                            {sub.numeroComprobante}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          <span className="text-slate-500 font-mono">Plan Solicitado: </span>
                          <span className="font-bold text-secondary">
                            {sub.planSolicitadoNombre} ({sub.cicloFacturacion})
                          </span>{" "}
                          — ${Number(sub.montoPagado).toFixed(2)} {sub.moneda}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {sub.estadoVerificacion !== "aprobado" ? (
                        <button
                          type="button"
                          onClick={() => approvePaymentSubmission(sub.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-surface font-extrabold text-xs hover:brightness-110 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprobar y Habilitar {sub.planSolicitadoNombre}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/15 text-secondary text-xs font-mono font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Aprobado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pie del Modal con botones de Guardado */}
        <div className="px-6 py-4 bg-surface border-t border-surface-high flex flex-wrap items-center justify-between gap-3">
          {activeMainTab !== "comprobantes" ? (
            <button
              type="button"
              onClick={handleResetCurrentTab}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-high border border-surface-high text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Valores por Defecto
            </button>
          ) : (
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Plazo máximo prometido al estudiante: 24 horas
            </div>
          )}

          <div className="flex items-center gap-3">
            {savedToast && (
              <span className="text-xs font-mono text-secondary flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {savedToast}
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-high text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-surface font-extrabold text-xs hover:brightness-110 transition shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar Cambios en Plataforma"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
