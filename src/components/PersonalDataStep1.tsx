// ============================================================================
// ARCHIVO: src/components/PersonalDataStep1.tsx
// DESCRIPCIÓN: Paso 1 de 3 — Filtro Obligatorio de Datos Personales,
//              Verificación de Correo/Contraseña, Documento (Ambos Lados)
//              y Selección Dinámica de Carrera y Nivel Académico.
// ============================================================================

import React, { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { CAREERS_ALPHABETICAL, COUNTRY_PHONE_CODES } from "../data/careersConfig";
import { IdentificationType, PersonalDataStep1 as PersonalDataStep1Model } from "../types";
import { CaptchaBox } from "./CaptchaBox";

interface PersonalDataStep1Props {
  onBackToAccess?: () => void;
  onSuccessStep1?: () => void;
}

export const PersonalDataStep1: React.FC<PersonalDataStep1Props> = ({
  onBackToAccess,
  onSuccessStep1
}) => {
  const {
    user,
    isAuthenticated,
    savePersonalDataStep1,
    sendVerificationToEmail,
    confirmEmailVerification,
    generatedEmailPin,
    logout
  } = useAuth();

  const existing = user?.datosPersonales;

  // 1. Campos de Identidad Personal
  const [nombreApellido, setNombreApellido] = useState(
    existing?.nombreApellido || user?.nombre || ""
  );
  const [nickname, setNickname] = useState(existing?.nickname || user?.nickname || "");
  const [codigoPais, setCodigoPais] = useState(existing?.codigoPais || "+593");
  const [telefono, setTelefono] = useState(existing?.telefono || "");

  // 2. Correo y Confirmación de Correo
  const [email, setEmail] = useState(existing?.email || user?.email || "");
  const [confirmEmail, setConfirmEmail] = useState(existing?.email || user?.email || "");
  const [emailPinInput, setEmailPinInput] = useState("");
  const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>(
    Boolean(user?.emailVerified || existing?.emailVerificado)
  );
  const [sendingPin, setSendingPin] = useState(false);

  // 3. Contraseña y Confirmación de Contraseña
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 4. Documento de Identificación y Fotos a Ambos Lados
  const [tipoDocumento, setTipoDocumento] = useState<IdentificationType>(
    existing?.tipoDocumento || "cedula"
  );
  const [numeroDocumento, setNumeroDocumento] = useState(existing?.numeroDocumento || "");
  const [fotoFrente, setFotoFrente] = useState<string>(existing?.fotoDocumentoFrente || "");
  const [fotoReverso, setFotoReverso] = useState<string>(existing?.fotoDocumentoReverso || "");

  // 5. Carrera (Orden Alfabético) y Nivel Académico Dinámico
  const [carreraId, setCarreraId] = useState<string>(existing?.carreraId || "");
  const [nivelAcademico, setNivelAcademico] = useState<string>(existing?.nivelAcademico || "");
  const [universidad, setUniversidad] = useState<string>(existing?.universidad || "");

  // 6. CAPTCHA y Mensajes de Validación del Formulario
  const [captchaVerified, setCaptchaVerified] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Carrera seleccionada actualmente
  const selectedCareerObj = useMemo(
    () => CAREERS_ALPHABETICAL.find((c) => c.id === carreraId) || null,
    [carreraId]
  );

  // País seleccionado actualmente
  const selectedCountryObj = useMemo(
    () => COUNTRY_PHONE_CODES.find((c) => c.dial === codigoPais) || COUNTRY_PHONE_CODES[0],
    [codigoPais]
  );

  // Validaciones en tiempo real de contraseña: 1 mayúscula, 1 minúscula, 1 especial
  const passwordChecks = useMemo(() => {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
    const minLength = password.length >= 6;
    const matches = password.length > 0 && password === confirmPassword;
    return {
      hasUpper,
      hasLower,
      hasSpecial,
      minLength,
      matches,
      isValid: hasUpper && hasLower && hasSpecial && minLength && matches
    };
  }, [password, confirmPassword]);

  // Validación de coincidencia de correo
  const emailChecks = useMemo(() => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanConfirm = confirmEmail.trim().toLowerCase();
    const isFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    const matches = cleanEmail.length > 0 && cleanEmail === cleanConfirm;
    return {
      isFormatValid,
      matches,
      isValid: isFormatValid && matches
    };
  }, [email, confirmEmail]);

  // Manejador de subida de imágenes de Cédula/Pasaporte
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "frente" | "reverso"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("El archivo seleccionado debe ser una imagen válida (JPG, PNG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (side === "frente") {
        setFotoFrente(result);
      } else {
        setFotoReverso(result);
      }
      setFormError(null);
    };
    reader.readAsDataURL(file);
  };

  // Manejador de cambio de carrera: reinicia el nivel académico para que el usuario elija uno válido
  const handleCareerChange = (newCareerId: string) => {
    setCarreraId(newCareerId);
    const found = CAREERS_ALPHABETICAL.find((c) => c.id === newCareerId);
    if (found && found.niveles.length > 0) {
      setNivelAcademico(found.niveles[0]);
    } else {
      setNivelAcademico("");
    }
  };

  // Enviar código/enlace de verificación al correo
  const handleSendVerificationEmail = async () => {
    setFormError(null);
    if (!emailChecks.isValid) {
      setFormError(
        "Primero asegúrate de que ambos campos de correo electrónico coincidan y tengan un formato válido."
      );
      return;
    }
    setSendingPin(true);
    try {
      await sendVerificationToEmail(email.trim());
    } finally {
      setSendingPin(false);
    }
  };

  // Confirmar código de verificación de correo
  const handleVerifyEmailPin = async () => {
    setFormError(null);
    const ok = await confirmEmailVerification(emailPinInput);
    if (ok) {
      setIsEmailConfirmed(true);
    }
  };

  // Envío final del Paso 1 de 3
  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nombreApellido.trim() || nombreApellido.trim().split(" ").length < 2) {
      setFormError("Por favor ingresa al menos un Nombre y un Apellido.");
      return;
    }

    if (!telefono.trim() || telefono.replace(/\D/g, "").length < 7) {
      setFormError("Ingresa un número de teléfono válido con la extensión de tu país.");
      return;
    }

    if (!emailChecks.isValid) {
      setFormError("El correo electrónico y su confirmación deben coincidir exactamente.");
      return;
    }

    if (!isEmailConfirmed) {
      setFormError("Debes completar la verificación de tu correo electrónico antes de continuar.");
      return;
    }

    if (!passwordChecks.isValid) {
      setFormError(
        "La contraseña debe contener al menos 1 mayúscula, 1 minúscula, 1 carácter especial y coincidir en ambos campos."
      );
      return;
    }

    if (!numeroDocumento.trim()) {
      setFormError(
        `Ingresa el número de tu ${tipoDocumento === "cedula" ? "Cédula de Identidad" : "Pasaporte"}.`
      );
      return;
    }

    if (!fotoFrente || !fotoReverso) {
      setFormError(
        `Debes subir las fotografías de ambos lados (Frente y Reverso) de tu ${
          tipoDocumento === "cedula" ? "Cédula" : "Pasaporte"
        }.`
      );
      return;
    }

    if (!selectedCareerObj) {
      setFormError("Selecciona tu Carrera en la lista desplegable.");
      return;
    }

    if (!nivelAcademico) {
      setFormError("Selecciona el semestre, nivel o módulo en el que te encuentras.");
      return;
    }

    if (!captchaVerified) {
      setFormError("Por favor completa el código de seguridad CAPTCHA al final del formulario.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: PersonalDataStep1Model = {
        nombreApellido: nombreApellido.trim(),
        nickname: nickname.trim() || undefined,
        codigoPais,
        telefono: telefono.trim(),
        telefonoCompleto: `${codigoPais} ${telefono.trim()}`,
        email: email.trim().toLowerCase(),
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        fotoDocumentoFrente: fotoFrente,
        fotoDocumentoReverso: fotoReverso,
        carreraId: selectedCareerObj.id,
        carreraNombre: selectedCareerObj.nombre,
        nivelAcademico,
        universidad: universidad.trim() || undefined,
        emailVerificado: true,
        captchaVerificado: true,
        paso1CompletadoEn: new Date().toISOString()
      };

      await savePersonalDataStep1(payload, password);
      onSuccessStep1?.();
    } catch (err: any) {
      setFormError(err?.message || "Ocurrió un error al guardar el Paso 1.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 py-2">
      {/* Barra de Progreso: Paso 1 de 3 */}
      <div className="bg-surface-container border border-surface-high rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
            <span>SISTEMA DE CREACIÓN DE NUEVOS USUARIOS</span>
            <span aria-hidden="true">·</span>
            <span>FILTRO OBLIGATORIO</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            Paso 1 de 3: Filtro de Datos Personales y Académicos
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Tanto si ingresaste con Gmail como con Correo Electrónico, completa y verifica tu expediente de identidad para continuar.
          </p>
        </div>

        {/* Indicador Visual de 3 Pasos */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-primary text-surface font-extrabold">
            1. Datos Personales
          </div>
          <span className="text-gray-600">→</span>
          <div className="px-3 py-1.5 rounded-lg bg-surface border border-surface-high text-gray-400">
            2. Paso 2
          </div>
          <span className="text-gray-600">→</span>
          <div className="px-3 py-1.5 rounded-lg bg-surface border border-surface-high text-gray-400">
            3. Paso 3
          </div>
        </div>
      </div>

      {/* Formulario Maestro del Paso 1 */}
      <form onSubmit={handleSubmitStep1} className="space-y-6">
        {formError && (
          <div className="p-4 rounded-xl bg-danger/15 border border-danger text-danger text-xs font-mono flex items-start gap-2.5">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{formError}</span>
          </div>
        )}

        {/* =============================================================== */}
        {/* SECCIÓN A: IDENTIDAD PERSONAL Y CONTACTO TELEFÓNICO             */}
        {/* =============================================================== */}
        <section className="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5">
          <div className="border-b border-surface-high pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-primary font-bold">
                01. IDENTIDAD Y CONTACTO
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                Datos Personales Básicos
              </h2>
            </div>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className="text-xs font-mono text-gray-400 hover:text-danger underline cursor-pointer"
              >
                Cambiar cuenta de inicio
              </button>
            ) : (
              onBackToAccess && (
                <button
                  type="button"
                  onClick={onBackToAccess}
                  className="text-xs font-mono text-gray-400 hover:text-primary underline cursor-pointer"
                >
                  ← Volver a opciones de inicio
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre y Apellido (Obligatorio) */}
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Nombres y Apellidos *
              </label>
              <input
                type="text"
                required
                value={nombreApellido}
                onChange={(e) => setNombreApellido(e.target.value)}
                placeholder="Ej: Carlos Andrés Mendoza"
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>

            {/* Nickname (Opcional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-gray-300 font-semibold">
                  Nickname / Alias
                </label>
                <span className="text-[11px] font-mono text-gray-500">Opcional</span>
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej: DrMendoza99"
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>

            {/* Teléfono con extensión según país (Obligatorio) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Número de Teléfono Móvil (con extensión según país) *
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  value={codigoPais}
                  onChange={(e) => setCodigoPais(e.target.value)}
                  className="sm:w-64 bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white focus:border-primary focus:outline-none"
                >
                  {COUNTRY_PHONE_CODES.map((c) => (
                    <option key={c.code} value={c.dial}>
                      {c.country} ({c.dial})
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder={`Ej: ${selectedCountryObj.placeholder}`}
                  className="flex-1 bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* SECCIÓN B: CORREO ELECTRÓNICO, VERIFICACIÓN Y CONTRASEÑA SEGURA */}
        {/* =============================================================== */}
        <section className="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5">
          <div className="border-b border-surface-high pb-3">
            <span className="text-xs font-mono text-primary font-bold">
              02. CREDENCIALES Y VERIFICACIÓN DE CORREO
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
              Confirmación de Correo Electrónico y Contraseña
            </h2>
          </div>

          {/* Correo y Confirmar Correo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsEmailConfirmed(false);
                }}
                placeholder="usuario@correo.com"
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-gray-300 font-semibold">
                  Verificar Correo Electrónico *
                </label>
                {confirmEmail.length > 0 && (
                  <span
                    className={`text-[11px] font-mono ${
                      emailChecks.matches ? "text-secondary" : "text-danger"
                    }`}
                  >
                    {emailChecks.matches ? "Coinciden" : "No coinciden"}
                  </span>
                )}
              </div>
              <input
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="Repite tu correo electrónico"
                className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none ${
                  confirmEmail.length > 0
                    ? emailChecks.matches
                      ? "border-secondary"
                      : "border-danger"
                    : "border-surface-high focus:border-primary"
                }`}
              />
            </div>
          </div>

          {/* Bloque de Verificación al Correo */}
          <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">
                  mark_email_read
                </span>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Estado de Verificación al Correo Electrónico
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Obligatorio tanto para Gmail como para Correo Electrónico
                  </span>
                </div>
              </div>

              {isEmailConfirmed ? (
                <span className="text-xs font-mono font-bold text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Correo Verificado</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={sendingPin || !emailChecks.isValid}
                  onClick={handleSendVerificationEmail}
                  className="px-3.5 py-2 rounded-lg bg-primary text-surface font-mono font-bold text-xs hover:bg-opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  {sendingPin ? "Enviando..." : "Enviar Verificación al Correo"}
                </button>
              )}
            </div>

            {!isEmailConfirmed && (
              <div className="pt-2 border-t border-surface-high space-y-2.5">
                {generatedEmailPin && (
                  <div className="p-2.5 rounded-lg bg-surface-container border border-primary/40 text-xs font-mono text-gray-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Verificación generada para <strong>{email}</strong>. Código de confirmación:
                    </span>
                    <span className="text-primary font-extrabold tracking-widest text-sm">
                      {generatedEmailPin}
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={emailPinInput}
                    onChange={(e) => setEmailPinInput(e.target.value)}
                    placeholder="Ingresa el código de 6 dígitos enviado"
                    className="flex-1 bg-surface-container border border-surface-high rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmailPin}
                    className="px-4 py-2 rounded-lg bg-secondary text-surface font-mono font-extrabold text-xs cursor-pointer"
                  >
                    Confirmar Correo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contraseña y Verificar Contraseña */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-gray-300 font-semibold">
                  Contraseña *
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 1 mayúscula, 1 minúscula y 1 especial"
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-gray-300 font-semibold">
                  Verificar Contraseña *
                </label>
                {confirmPassword.length > 0 && (
                  <span
                    className={`text-[11px] font-mono ${
                      passwordChecks.matches ? "text-secondary" : "text-danger"
                    }`}
                  >
                    {passwordChecks.matches ? "Coinciden" : "No coinciden"}
                  </span>
                )}
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none ${
                  confirmPassword.length > 0
                    ? passwordChecks.matches
                      ? "border-secondary"
                      : "border-danger"
                    : "border-surface-high focus:border-primary"
                }`}
              />
            </div>
          </div>

          {/* Indicadores de Reglas de Contraseña */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono pt-1">
            <div
              className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                passwordChecks.hasUpper
                  ? "bg-secondary/10 border-secondary/40 text-secondary"
                  : "bg-surface border-surface-high text-gray-400"
              }`}
            >
              <span>{passwordChecks.hasUpper ? "✓" : "○"}</span>
              <span>1 Mayúscula (A-Z)</span>
            </div>
            <div
              className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                passwordChecks.hasLower
                  ? "bg-secondary/10 border-secondary/40 text-secondary"
                  : "bg-surface border-surface-high text-gray-400"
              }`}
            >
              <span>{passwordChecks.hasLower ? "✓" : "○"}</span>
              <span>1 Minúscula (a-z)</span>
            </div>
            <div
              className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                passwordChecks.hasSpecial
                  ? "bg-secondary/10 border-secondary/40 text-secondary"
                  : "bg-surface border-surface-high text-gray-400"
              }`}
            >
              <span>{passwordChecks.hasSpecial ? "✓" : "○"}</span>
              <span>1 Carácter especial</span>
            </div>
            <div
              className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                passwordChecks.matches
                  ? "bg-secondary/10 border-secondary/40 text-secondary"
                  : "bg-surface border-surface-high text-gray-400"
              }`}
            >
              <span>{passwordChecks.matches ? "✓" : "○"}</span>
              <span>Ambas coinciden</span>
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* SECCIÓN C: DOCUMENTO DE IDENTIFICACIÓN (CÉDULA O PASAPORTE)     */}
        {/*            Y FOTOGRAFÍAS DE AMBOS LADOS                         */}
        {/* =============================================================== */}
        <section className="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5">
          <div className="border-b border-surface-high pb-3">
            <span className="text-xs font-mono text-primary font-bold">
              03. VERIFICACIÓN DOCUMENTAL DE IDENTIDAD
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
              Documento de Identificación (Cédula o Pasaporte) — Ambos Lados *
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector Cédula o Pasaporte */}
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Tipo de Documento *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTipoDocumento("cedula")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                    tipoDocumento === "cedula"
                      ? "bg-primary text-surface border-primary"
                      : "bg-surface border-surface-high text-gray-300 hover:border-gray-500"
                  }`}
                >
                  Cédula de Identidad
                </button>
                <button
                  type="button"
                  onClick={() => setTipoDocumento("pasaporte")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                    tipoDocumento === "pasaporte"
                      ? "bg-primary text-surface border-primary"
                      : "bg-surface border-surface-high text-gray-300 hover:border-gray-500"
                  }`}
                >
                  Pasaporte
                </button>
              </div>
            </div>

            {/* Número de Documento */}
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Número de {tipoDocumento === "cedula" ? "Cédula" : "Pasaporte"} *
              </label>
              <input
                type="text"
                required
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder={
                  tipoDocumento === "cedula" ? "Ej: 1712345678" : "Ej: A12345678"
                }
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Carga de Fotos de Ambos Lados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Lado Frontal / Anverso */}
            <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">
                  Lado 1: Frente / Anverso ({tipoDocumento === "cedula" ? "Cédula" : "Pasaporte"}) *
                </span>
                {fotoFrente && (
                  <span className="text-[11px] font-mono text-secondary font-bold">
                    Cargado
                  </span>
                )}
              </div>

              {fotoFrente ? (
                <div className="space-y-2">
                  <img
                    src={fotoFrente}
                    alt="Frente del documento"
                    className="w-full h-36 object-cover rounded-lg border border-primary/40"
                  />
                  <label className="block text-center py-1.5 px-3 rounded-lg bg-surface-container border border-surface-high hover:border-primary text-xs font-mono text-gray-300 cursor-pointer">
                    Cambiar fotografía frontal
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "frente")}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="h-36 rounded-lg border-2 border-dashed border-surface-high hover:border-primary flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-4 text-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    badge
                  </span>
                  <span className="text-xs text-gray-300 font-medium">
                    Subir foto frontal de tu {tipoDocumento === "cedula" ? "cédula" : "pasaporte"}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    JPG, PNG o WEBP nítido
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "frente")}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Lado Posterior / Reverso */}
            <div className="p-4 rounded-xl bg-surface border border-surface-high space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">
                  Lado 2: Reverso / Dorso ({tipoDocumento === "cedula" ? "Cédula" : "Pasaporte"}) *
                </span>
                {fotoReverso && (
                  <span className="text-[11px] font-mono text-secondary font-bold">
                    Cargado
                  </span>
                )}
              </div>

              {fotoReverso ? (
                <div className="space-y-2">
                  <img
                    src={fotoReverso}
                    alt="Reverso del documento"
                    className="w-full h-36 object-cover rounded-lg border border-primary/40"
                  />
                  <label className="block text-center py-1.5 px-3 rounded-lg bg-surface-container border border-surface-high hover:border-primary text-xs font-mono text-gray-300 cursor-pointer">
                    Cambiar fotografía posterior
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "reverso")}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="h-36 rounded-lg border-2 border-dashed border-surface-high hover:border-primary flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-4 text-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    flip_camera_android
                  </span>
                  <span className="text-xs text-gray-300 font-medium">
                    Subir foto posterior de tu {tipoDocumento === "cedula" ? "cédula" : "pasaporte"}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    JPG, PNG o WEBP nítido
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "reverso")}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* SECCIÓN D: PERFIL ACADÉMICO (CARRERA EN ORDEN ALFABÉTICO,       */}
        {/*            SEMESTRE/NIVEL DINÁMICO Y UNIVERSIDAD OPCIONAL)      */}
        {/* =============================================================== */}
        <section className="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5">
          <div className="border-b border-surface-high pb-3">
            <span className="text-xs font-mono text-primary font-bold">
              04. TÚNEL ACADÉMICO Y NIVEL DE CARRERA
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
              Selección de Carrera, Semestre/Nivel y Universidad
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lista desplegable de Carrera (A-Z) */}
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Carrera en Ciencias de la Salud (Orden Alfabético) *
              </label>
              <select
                required
                value={carreraId}
                onChange={(e) => handleCareerChange(e.target.value)}
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="" disabled>
                  -- Selecciona tu Carrera --
                </option>
                {CAREERS_ALPHABETICAL.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Selección Dinámica de Semestre / Nivel según Carrera */}
            <div>
              <label className="block text-xs font-mono text-gray-300 font-semibold mb-1.5">
                Semestre, Nivel o Módulo Actual *
              </label>
              <select
                required
                disabled={!selectedCareerObj}
                value={nivelAcademico}
                onChange={(e) => setNivelAcademico(e.target.value)}
                className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none disabled:opacity-40"
              >
                {!selectedCareerObj ? (
                  <option value="">Primero elige una carrera</option>
                ) : (
                  selectedCareerObj.niveles.map((nivel) => (
                    <option key={nivel} value={nivel}>
                      {nivel}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Nota informativa de la estructura de niveles de la carrera seleccionada */}
          {selectedCareerObj && (
            <div className="p-3.5 rounded-xl bg-surface border border-primary/30 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-mono font-bold text-primary block">
                  Estructura Curricular: {selectedCareerObj.nombre}
                </span>
                <span className="text-gray-300">
                  {selectedCareerObj.duracionDescripcion}
                </span>
              </div>
              <span className="font-mono text-secondary font-bold shrink-0">
                {selectedCareerObj.niveles.length} niveles disponibles
              </span>
            </div>
          )}

          {/* Universidad de procedencia (Opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-gray-300 font-semibold">
                Universidad o Instituto de Procedencia
              </label>
              <span className="text-[11px] font-mono text-gray-500">
                Opcional (No obligatorio)
              </span>
            </div>
            <input
              type="text"
              value={universidad}
              onChange={(e) => setUniversidad(e.target.value)}
              placeholder="Ej: Universidad Central del Ecuador, Universidad de Guayaquil, UTPL, USFQ, PUCE..."
              className="w-full bg-surface border border-surface-high rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
            />
          </div>
        </section>

        {/* =============================================================== */}
        {/* SECCIÓN E: VERIFICACIÓN CAPTCHA Y BOTÓN DE GUARDADO PASO 1      */}
        {/* =============================================================== */}
        <section className="bg-surface-container border border-surface-high rounded-2xl p-6 space-y-5">
          <CaptchaBox onVerifyChange={setCaptchaVerified} />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-gray-400">
              Al guardar el Paso 1 de 3, tus datos quedarán vinculados a tu expediente en Firebase.
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-surface font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Guardando Expediente..." : "Guardar Paso 1 de 3 y Continuar →"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};
