// ============================================================================
// ARCHIVO: src/components/HomeAuthPage.tsx
// DESCRIPCIÓN: Página de Inicio con Visión y Misión oficial, Autenticación
//              (Iniciar Sesión primero y Crear Nuevo Usuario junto a él;
//              primero Correo, Contraseña y CAPTCHA, después Gmail).
//              Los usuarios con cuenta existente ingresan directo a su entorno.
//              Los nuevos usuarios pasan por Paso 1, Paso 2 y (si el plan > $0.00) Paso 3.
//              El Panel del Administrador Maestro es exclusivo de las 2 cuentas maestras.
// ============================================================================

import React, { useState, useMemo } from "react";
import {
  Clock,
  Sparkles,
  FileCheck2,
  Sliders,
  ShieldCheck,
  Receipt,
  Eye,
  Target
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CaptchaBox } from "./CaptchaBox";
import { PersonalDataStep1 } from "./PersonalDataStep1";
import { SelectPlanStep2 } from "./SelectPlanStep2";
import { PaymentMethodsStep3 } from "./PaymentMethodsStep3";
import { MasterPlansEditorModal } from "./MasterPlansEditorModal";

const OFFICIAL_LOGO_URL = "/assets/aistudio/logo_959094cf.png";

type OnboardingViewMode = "auto" | "portal" | "step1" | "step2" | "step3" | "app_inside";

export const HomeAuthPage: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isMaster,
    error,
    notice,
    paymentMethodsConfig,
    clearMessages,
    startWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout
  } = useAuth();

  // Primero "Iniciar Sesión" por defecto, y junto a él "Crear Nuevo Usuario"
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<OnboardingViewMode>("auto");
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [masterModalInitialTab, setMasterModalInitialTab] = useState<
    "planes" | "medios_pago" | "comprobantes"
  >("planes");

  const openMasterModalOnTab = (tab: "planes" | "medios_pago" | "comprobantes") => {
    if (!isMaster) return;
    setMasterModalInitialTab(tab);
    setIsMasterModalOpen(true);
  };

  // Regla de contraseña en creación de nuevo usuario: 1 mayúscula, 1 minúscula y 1 especial
  const passwordValid = useMemo(() => {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
    return hasUpper && hasLower && hasSpecial && password.length >= 6;
  }, [password]);

  // Resolver qué pantalla mostrar según el estado del usuario
  const activeScreen = useMemo(() => {
    if (viewMode !== "auto") return viewMode;
    if (!isAuthenticated || !user) return "portal";

    // Si inició sesión como usuario existente o ya completó su registro (o es cuenta maestra),
    // entra directamente al entorno del usuario sin pasar por los pasos de verificación.
    if (user.registroPasoActual === "completado" || isMaster) {
      return "app_inside";
    }

    if (user.registroPasoActual === 1 || !user.datosPersonales?.paso1CompletadoEn) {
      return "step1";
    }
    if (user.registroPasoActual === 2 || !user.datosPlanPaso2?.paso2CompletadoEn) {
      return "step2";
    }
    if (
      Number(user.datosPlanPaso2?.costoAplicado ?? 0) === 0 ||
      user.datosPlanPaso2?.planId === "plan-basico-freemium"
    ) {
      return "app_inside";
    }
    if (!user.datosPagoPaso3?.paso3CompletadoEn) {
      return "step3";
    }
    return "app_inside";
  }, [viewMode, isAuthenticated, user, isMaster]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearMessages();

    if (!captchaVerified) {
      setLocalError("Debes completar el código CAPTCHA antes de continuar.");
      return;
    }

    if (authTab === "register") {
      if (!passwordValid) {
        setLocalError(
          "La contraseña debe incluir al menos 1 letra mayúscula, 1 minúscula y 1 carácter especial."
        );
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Las contraseñas ingresadas no coinciden.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (authTab === "login") {
        // Usuario existente: inicia sesión y entra directo al entorno del usuario
        await loginWithEmail(email, password, captchaVerified);
        setViewMode("app_inside");
      } else {
        // Nuevo usuario: inicia el proceso en el Paso 1 de 3
        await registerWithEmail(email, password, captchaVerified);
        setViewMode("step1");
      }
    } catch {
      // Error gestionado en AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAccess = async () => {
    setLocalError(null);
    clearMessages();
    if (!captchaVerified) {
      setLocalError("Por favor completa el código CAPTCHA antes de continuar con Gmail.");
      return;
    }
    setSubmitting(true);
    try {
      await startWithGoogle(captchaVerified, authTab);
      if (authTab === "login") {
        setViewMode("app_inside");
      } else {
        setViewMode("step1");
      }
    } catch {
      // Error gestionado en AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-white font-sans flex flex-col selection:bg-primary selection:text-surface">
      {/* =================================================================== */}
      {/* CABECERA OFICIAL CON LOGO MAKAI ACADEMY                             */}
      {/* =================================================================== */}
      <header className="min-h-16 py-2.5 border-b border-surface-high bg-surface-container/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="h-11 px-2.5 py-1 rounded-xl bg-white flex items-center justify-center shadow-md border border-primary/40 shrink-0">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Makai Academy"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-white text-base sm:text-lg block leading-tight">
              MAKAI ACADEMY
            </span>
            <div className="text-[11px] font-mono text-primary">
              Panel de Acceso
            </div>
          </div>
        </div>

        {/* Acciones de Cabecera: Botón Admin Maestro EXCLUSIVO para las 2 cuentas maestras */}
        <div className="flex items-center gap-2.5">
          {isAuthenticated && isMaster && (
            <button
              type="button"
              onClick={() => openMasterModalOnTab("planes")}
              className="px-3.5 py-2 rounded-xl bg-warning/15 border border-warning/60 hover:bg-warning hover:text-surface text-warning text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Panel del Administrador Maestro</span>
            </button>
          )}

          {isAuthenticated && user && (
            <button
              type="button"
              onClick={() => {
                setViewMode("portal");
                logout();
              }}
              className="px-3.5 py-2 rounded-xl bg-surface border border-surface-high hover:border-danger text-gray-300 hover:text-danger text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      </header>

      {/* =================================================================== */}
      {/* CONTENIDO PRINCIPAL                                                 */}
      {/* =================================================================== */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {notice && (
          <div className="mb-6 p-4 rounded-xl bg-secondary/15 border border-secondary text-secondary text-xs font-mono flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button
              type="button"
              onClick={clearMessages}
              className="text-secondary hover:underline font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* PANTALLA 0: PORTAL DE ACCESO (VISIÓN, MISIÓN + INICIAR SESIÓN / CREAR NUEVO USUARIO) */}
        {activeScreen === "portal" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Columna Izquierda (6 cols): Logo + VISIÓN y MISIÓN */}
            <section className="lg:col-span-6 flex flex-col justify-center space-y-6">
              {/* Tarjeta de Identidad y Visión */}
              <div className="bg-surface-container border border-surface-high rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
                <div className="flex items-center gap-3 border-b border-surface-high pb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-primary tracking-wide uppercase font-mono">
                    VISIÓN
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  Convertir a Makai Academy en el ecosistema líder de educación, simulación
                  clínica, inteligencia artificial y desarrollo profesional para ciencias de la
                  salud en Latinoamérica y el Mundo, acompañando al estudiante desde su ingreso a
                  la universidad hasta el ejercicio profesional mediante tecnología innovadora,
                  aprendizaje personalizado y experiencias de formación de clase mundial.
                </p>
              </div>

              {/* Tarjeta de Misión */}
              <div className="bg-surface-container border border-surface-high rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
                <div className="flex items-center gap-3 border-b border-surface-high pb-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 border border-secondary/40 flex items-center justify-center text-secondary shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-secondary tracking-wide uppercase font-mono">
                    MISIÓN
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  Proporcionar a estudiantes y profesionales de ciencias de la salud herramientas
                  educativas de alta calidad que integren preparación académica, simulación
                  clínica, evaluación inteligente, recursos científicos y tecnologías emergentes,
                  con el fin de mejorar el aprendizaje, fortalecer las competencias profesionales y
                  contribuir a una atención sanitaria más segura y eficiente.
                </p>
              </div>
            </section>

            {/* Columna Derecha (6 cols): Primero Iniciar Sesión y Junto a eso Crear Nuevo Usuario */}
            <section className="lg:col-span-6 bg-surface-container border border-surface-high rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Encabezado con Logo Oficial */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-extrabold text-white">
                      {authTab === "login" ? "Iniciar Sesión" : "Crear Nuevo Usuario"}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {authTab === "login"
                        ? "Ingresa directamente a tu entorno académico de Makai Academy."
                        : "Registra tu cuenta nueva para configurar tu perfil y plan académico."}
                    </p>
                  </div>
                  <div className="h-10 px-2 py-1 rounded-lg bg-white flex items-center justify-center shrink-0">
                    <img
                      src={OFFICIAL_LOGO_URL}
                      alt="Makai Academy"
                      className="h-8 w-auto object-contain"
                    />
                  </div>
                </div>

                {/* Pestañas: 1° Iniciar Sesión | 2° Crear Nuevo Usuario */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface rounded-xl border border-surface-high">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("login");
                      setLocalError(null);
                      clearMessages();
                    }}
                    className={`py-2.5 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                      authTab === "login"
                        ? "bg-primary text-surface font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("register");
                      setLocalError(null);
                      clearMessages();
                    }}
                    className={`py-2.5 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                      authTab === "register"
                        ? "bg-primary text-surface font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Crear Nuevo Usuario
                  </button>
                </div>

                {(localError || error) && (
                  <div className="p-3.5 rounded-xl bg-danger/15 border border-danger text-danger text-xs font-mono">
                    {localError || error}
                  </div>
                )}

                {/* 1° FORMULARIO: CORREO ELECTRÓNICO, CONTRASEÑA Y CAPTCHA */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-surface border border-surface-high rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authTab === "register"
                          ? "1 mayúscula, 1 minúscula y 1 carácter especial"
                          : "Ingresa tu contraseña"
                      }
                      className="w-full bg-surface border border-surface-high rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  {authTab === "register" && (
                    <div>
                      <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                        Confirmar Contraseña *
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite tu contraseña"
                        className="w-full bg-surface border border-surface-high rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}

                  {/* CAPTCHA después de correo y contraseña */}
                  <CaptchaBox onVerifyChange={setCaptchaVerified} />

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl bg-primary text-surface font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting
                      ? "Procesando..."
                      : authTab === "login"
                      ? "Iniciar Sesión"
                      : "Crear Nuevo Usuario →"}
                  </button>
                </form>

                {/* DIVISOR */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-surface-high"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-mono text-gray-400 uppercase">
                    O continúa con tu cuenta de Google
                  </span>
                  <div className="flex-grow border-t border-surface-high"></div>
                </div>

                {/* 2° OPCIÓN DE GMAIL DESPUÉS DE CORREO, CONTRASEÑA Y CAPTCHA */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleAccess}
                  className="w-full py-3 px-4 rounded-xl bg-white text-gray-900 hover:bg-gray-100 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 .1 11.2.1 13.5s.5 4.5 1.5 6.5l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                    />
                  </svg>
                  <span>
                    {authTab === "login"
                      ? "Iniciar Sesión con Gmail"
                      : "Crear Nuevo Usuario con Gmail"}
                  </span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* PANTALLA 1: Paso 1 de 3 — Filtro de Datos Personales (Solo Nuevos Usuarios) */}
        {activeScreen === "step1" && (
          <PersonalDataStep1
            onBackToAccess={() => setViewMode("portal")}
            onSuccessStep1={() => setViewMode("step2")}
          />
        )}

        {/* PANTALLA 2: Paso 2 de 3 — Selecciona un Plan (Si cuesta $0.00 salta el Paso 3) */}
        {activeScreen === "step2" && (
          <SelectPlanStep2
            onBackToStep1={() => setViewMode("step1")}
            onSuccessStep2={() => setViewMode("step3")}
            onSkipToAppInside={() => setViewMode("app_inside")}
            onOpenMasterPlansEditor={() => openMasterModalOnTab("planes")}
          />
        )}

        {/* PANTALLA 3: Paso 3 de 3 — Elige tu Medio de Pago y Sube tu Comprobante */}
        {activeScreen === "step3" && (
          <PaymentMethodsStep3
            onOpenMasterEditor={() => openMasterModalOnTab("medios_pago")}
            onBackToStep2={() => setViewMode("step2")}
            onCompletedStep3={() => setViewMode("app_inside")}
          />
        )}

        {/* PANTALLA 4: ENTORNO DEL USUARIO ADENTRO DE LA APP */}
        {activeScreen === "app_inside" && (
          <div className="space-y-6">
            {/* BANNER DESTACADO DE ACTIVACIÓN EN PLAZO MÁXIMO DE 24 HORAS (Solo si subió comprobante de un plan de pago) */}
            {user?.planPendienteAprobacion && (
              <div className="p-6 rounded-2xl bg-warning/15 border-2 border-warning shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-warning text-surface flex items-center justify-center shrink-0 shadow-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-warning/25 text-warning font-mono text-[11px] font-extrabold uppercase">
                      VALIDACIÓN DE COMPROBANTE EN PROCESO • PLAZO MÁXIMO 24 HORAS
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-white">
                      ¡Estás dentro de Makai Academy con el{" "}
                      <span className="text-primary">Plan Básico Freemium</span> activo!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl">
                      {paymentMethodsConfig.mensajeActivacion24Horas} Plan solicitado:{" "}
                      <strong className="text-warning">
                        {user.planPendienteAprobacion.planNombre} (
                        {user.planPendienteAprobacion.cicloFacturacion.toUpperCase()})
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                {isMaster && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openMasterModalOnTab("comprobantes")}
                      className="px-4 py-2.5 rounded-xl bg-warning text-surface font-mono font-extrabold text-xs hover:brightness-110 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      Ver / Aprobar Comprobante (Admin Maestro)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Panel Principal del Entorno del Usuario */}
            <div className="bg-surface-container border border-surface-high rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-high pb-5">
                <div className="flex items-center gap-4">
                  <div className="h-14 px-3 py-1.5 rounded-2xl bg-white flex items-center justify-center shadow-md border border-primary/40 shrink-0">
                    <img
                      src={OFFICIAL_LOGO_URL}
                      alt="Makai Academy"
                      className="h-11 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-secondary font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>ENTORNO ACADÉMICO MAKAI ACADEMY</span>
                      {isMaster && (
                        <span className="px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/40">
                          ADMINISTRADOR MAESTRO
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                      Bienvenido,{" "}
                      {user?.datosPersonales?.nombreApellido || user?.nombre || "Estudiante"}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Plan activo en tu cuenta:{" "}
                      <span className="text-primary font-bold">
                        {user?.planActivoNombre || "Plan Básico Freemium"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Si es Administrador Maestro, acceso rápido a las 3 pestañas de configuración */}
                {isMaster && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMasterModalOnTab("planes")}
                      className="px-3.5 py-2 rounded-xl bg-warning/15 border border-warning/50 text-warning text-xs font-mono font-bold hover:bg-warning hover:text-surface transition-colors cursor-pointer"
                    >
                      Configurar Planes
                    </button>
                    <button
                      type="button"
                      onClick={() => openMasterModalOnTab("medios_pago")}
                      className="px-3.5 py-2 rounded-xl bg-warning/15 border border-warning/50 text-warning text-xs font-mono font-bold hover:bg-warning hover:text-surface transition-colors cursor-pointer"
                    >
                      Configurar QR y Bancos
                    </button>
                    <button
                      type="button"
                      onClick={() => openMasterModalOnTab("comprobantes")}
                      className="px-3.5 py-2 rounded-xl bg-warning/15 border border-warning/50 text-warning text-xs font-mono font-bold hover:bg-warning hover:text-surface transition-colors cursor-pointer"
                    >
                      Bandeja de Comprobantes
                    </button>
                  </div>
                )}
              </div>

              {/* Resumen del Perfil y Suscripción Activa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-1.5">
                  <span className="font-mono text-primary font-bold block">
                    PERFIL DE USUARIO
                  </span>
                  <span className="text-white font-bold text-sm block">
                    {user?.datosPersonales?.nombreApellido || user?.nombre}
                  </span>
                  <span className="text-gray-300 font-mono block">{user?.email}</span>
                  {user?.datosPersonales?.carreraNombre && (
                    <span className="text-secondary font-semibold block">
                      {user.datosPersonales.carreraNombre} · {user.datosPersonales.nivelAcademico}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-1.5">
                  <span className="font-mono text-primary font-bold block">
                    SUSCRIPCIÓN ACTUAL
                  </span>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-secondary shrink-0" />
                    <span className="text-white font-bold text-sm">
                      {user?.planActivoNombre || "Plan Básico Freemium"}
                    </span>
                  </div>
                  {user?.planPendienteAprobacion ? (
                    <span className="text-warning font-mono block">
                      En activación (&lt; 24h): {user.planPendienteAprobacion.planNombre} (
                      {user.planPendienteAprobacion.cicloFacturacion})
                    </span>
                  ) : (
                    <span className="text-secondary font-mono block">
                      Acceso habilitado en plataforma
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-surface border border-primary/40 space-y-1.5">
                  <span className="font-mono text-primary font-bold block">
                    ESTADO FINANCIERO
                  </span>
                  {user?.datosPagoPaso3 ? (
                    <div className="flex items-start gap-3">
                      {user.datosPagoPaso3.fotoComprobante && (
                        <img
                          src={user.datosPagoPaso3.fotoComprobante}
                          alt="Comprobante"
                          className="w-12 h-12 rounded-lg object-cover border border-primary/40 shrink-0"
                        />
                      )}
                      <div>
                        <span className="text-white font-bold block">
                          {user.datosPagoPaso3.entidadBancariaNombre}
                        </span>
                        <span className="text-primary font-mono block">
                          Comprobante #{user.datosPagoPaso3.numeroComprobante}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5 text-secondary" />
                          {user.datosPagoPaso3.estadoVerificacion === "aprobado"
                            ? "Verificado y Aprobado"
                            : "Verificación en máx. 24h"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-300 block">
                      Cuenta activa sin pagos pendientes ($0.00 USD)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal del Panel del Administrador Maestro (Exclusivo para isMaster) */}
      {isMaster && (
        <MasterPlansEditorModal
          isOpen={isMasterModalOpen}
          onClose={() => setIsMasterModalOpen(false)}
          initialTab={masterModalInitialTab}
        />
      )}
    </div>
  );
};
