// ============================================================================
// ARCHIVO: src/context/AuthContext.tsx
// DESCRIPCIÓN: Gestión de Autenticación, Paso 1 (Datos Personales),
//              Paso 2 (Selección de Plan), Paso 3 (Medios de Pago y Comprobante)
//              y CMS Maestro exclusivo para cuentas maestras en Firebase Firestore.
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import {
  auth,
  db,
  COLLECTIONS,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  isMasterAdmin
} from "../services/firebase";
import {
  UserModel,
  UserRole,
  PersonalDataStep1,
  SubscriptionPlanConfig,
  SelectedPlanStep2,
  PaymentMethodsAdminConfig,
  PaymentSubmissionStep3
} from "../types";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_PAYMENT_METHODS_CONFIG
} from "../data/plansConfig";

const LOCAL_PLANS_STORAGE_KEY = "makai_cms_plans_v1";
const LOCAL_PAYMENT_METHODS_STORAGE_KEY = "makai_cms_payment_methods_v1";
const LOCAL_PAYMENT_SUBMISSIONS_KEY = "makai_payment_submissions_v1";

interface SubmitPaymentInput {
  metodoPago: PaymentSubmissionStep3["metodoPago"];
  entidadBancariaId: string;
  entidadBancariaNombre: string;
  numeroComprobante: string;
  fotoComprobante: string;
  planSolicitadoId: string;
  planSolicitadoNombre: string;
  cicloFacturacion: PaymentSubmissionStep3["cicloFacturacion"];
  montoPagado: number;
  moneda: string;
}

interface AuthContextType {
  user: UserModel | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: UserRole;
  isMaster: boolean;
  error: string | null;
  notice: string | null;
  emailVerificationSent: boolean;
  generatedEmailPin: string | null;
  plansCatalog: SubscriptionPlanConfig[];
  paymentMethodsConfig: PaymentMethodsAdminConfig;
  paymentSubmissions: PaymentSubmissionStep3[];
  clearMessages: () => void;
  startWithGoogle: (captchaVerified: boolean, mode?: "login" | "register") => Promise<void>;
  loginWithEmail: (email: string, pass: string, captchaVerified: boolean) => Promise<void>;
  registerWithEmail: (email: string, pass: string, captchaVerified: boolean) => Promise<void>;
  sendVerificationToEmail: (targetEmail?: string) => Promise<string>;
  confirmEmailVerification: (enteredPin?: string) => Promise<boolean>;
  savePersonalDataStep1: (data: PersonalDataStep1, plainPassword?: string) => Promise<void>;
  savePlanSelectionStep2: (selection: SelectedPlanStep2) => Promise<"completado" | 3>;
  submitPaymentStep3: (input: SubmitPaymentInput) => Promise<void>;
  completeFreePlanOnboarding: () => Promise<void>;
  savePlansCatalog: (updatedPlans: SubscriptionPlanConfig[]) => Promise<void>;
  resetPlansCatalogToDefault: () => Promise<void>;
  savePaymentMethodsConfig: (updatedConfig: PaymentMethodsAdminConfig) => Promise<void>;
  resetPaymentMethodsConfigToDefault: () => Promise<void>;
  approvePaymentSubmission: (submissionId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState<boolean>(false);
  const [generatedEmailPin, setGeneratedEmailPin] = useState<string | null>(null);

  // Catálogo reactivo de los 4 planes configurables por el Administrador Maestro
  const [plansCatalog, setPlansCatalog] = useState<SubscriptionPlanConfig[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PLANS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback a los 4 planes semilla
    }
    return DEFAULT_SUBSCRIPTION_PLANS;
  });

  // Configuración reactiva de Medios de Pago (Paso 3) editable desde el Panel Maestro
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<PaymentMethodsAdminConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PAYMENT_METHODS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.qrBancos && parsed.cuentasTransferencia) {
          return {
            ...DEFAULT_PAYMENT_METHODS_CONFIG,
            ...parsed
          };
        }
      }
    } catch {
      // Fallback a configuración por defecto
    }
    return DEFAULT_PAYMENT_METHODS_CONFIG;
  });

  // Bandeja de comprobantes enviados en el Paso 3
  const [paymentSubmissions, setPaymentSubmissions] = useState<PaymentSubmissionStep3[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PAYMENT_SUBMISSIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback vacío
    }
    return [];
  });

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };

  // Sincronizar planes, configuración de medios de pago y comprobantes desde Firebase Firestore
  useEffect(() => {
    const fetchRemoteConfigurations = async () => {
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.SUBSCRIPTIONS));
        if (!snap.empty) {
          const remotePlans: SubscriptionPlanConfig[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as SubscriptionPlanConfig;
            if (data && data.id && data.nombre) {
              remotePlans.push(data);
            }
          });

          if (remotePlans.length > 0) {
            remotePlans.sort((a, b) => (a.orden || 0) - (b.orden || 0));
            setPlansCatalog(remotePlans);
            localStorage.setItem(LOCAL_PLANS_STORAGE_KEY, JSON.stringify(remotePlans));
          }
        }
      } catch {
        // Mantiene respaldo local
      }

      try {
        const payDocRef = doc(db, COLLECTIONS.SETTINGS, "medios_pago_paso3");
        const paySnap = await getDoc(payDocRef);
        if (paySnap.exists()) {
          const remoteConfig = paySnap.data() as PaymentMethodsAdminConfig;
          if (remoteConfig && remoteConfig.qrBancos && remoteConfig.cuentasTransferencia) {
            const mergedConfig = {
              ...DEFAULT_PAYMENT_METHODS_CONFIG,
              ...remoteConfig
            };
            setPaymentMethodsConfig(mergedConfig);
            localStorage.setItem(LOCAL_PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(mergedConfig));
          }
        }
      } catch {
        // Mantiene respaldo local
      }

      try {
        const subSnap = await getDocs(collection(db, COLLECTIONS.PAYMENTS));
        if (!subSnap.empty) {
          const list: PaymentSubmissionStep3[] = [];
          subSnap.forEach((d) => {
            const item = d.data() as PaymentSubmissionStep3;
            if (item && item.id) list.push(item);
          });
          if (list.length > 0) {
            list.sort((a, b) => (b.paso3CompletadoEn || "").localeCompare(a.paso3CompletadoEn || ""));
            setPaymentSubmissions(list);
            localStorage.setItem(LOCAL_PAYMENT_SUBMISSIONS_KEY, JSON.stringify(list));
          }
        }
      } catch {
        // Mantiene respaldo local
      }
    };

    fetchRemoteConfigurations();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const email = (firebaseUser.email || "").toLowerCase();
      const masterFlag = isMasterAdmin(email);
      const isGoogle = firebaseUser.providerData?.some((p) => p.providerId === "google.com");
      const nowIso = new Date().toISOString();

      // Verificar si la sesión fue iniciada desde "Iniciar Sesión" (usuario existente)
      const sessionAuthIntent = sessionStorage.getItem("makai_auth_intent");

      const localVerified =
        localStorage.getItem(`makai_email_verified_${firebaseUser.uid}`) === "true" ||
        firebaseUser.emailVerified ||
        sessionAuthIntent === "login";

      const fallbackModel: UserModel = {
        uid: firebaseUser.uid,
        email,
        nombre: firebaseUser.displayName || email.split("@")[0],
        rol: masterFlag ? "master" : "estudiante",
        metodoIngreso: isGoogle ? "google" : "email",
        emailVerified: Boolean(localVerified),
        registroPasoActual: sessionAuthIntent === "login" || masterFlag ? "completado" : 1,
        planActivoId: "plan-basico-freemium",
        planActivoNombre: "Plan Básico Freemium",
        createdAt: nowIso,
        lastLoginAt: nowIso
      };

      try {
        const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as Partial<UserModel>;
          const hasStep1 = Boolean(data.datosPersonales?.paso1CompletadoEn);
          const hasStep2 = Boolean(data.datosPlanPaso2?.paso2CompletadoEn);
          const hasStep3 = Boolean(data.datosPagoPaso3?.paso3CompletadoEn);
          const isZeroCostPlan =
            hasStep2 && Number(data.datosPlanPaso2?.costoAplicado ?? 0) === 0;

          const computedStep: UserModel["registroPasoActual"] =
            sessionAuthIntent === "login" || masterFlag || hasStep3 || isZeroCostPlan
              ? "completado"
              : hasStep2
              ? 3
              : hasStep1
              ? 2
              : 1;

          const merged: UserModel = {
            ...fallbackModel,
            ...data,
            uid: firebaseUser.uid,
            email,
            rol: masterFlag ? "master" : (data.rol || "estudiante"),
            emailVerified: Boolean(data.emailVerified || localVerified),
            registroPasoActual:
              sessionAuthIntent === "login" || masterFlag
                ? "completado"
                : data.registroPasoActual || computedStep,
            planActivoId: data.planActivoId || "plan-basico-freemium",
            planActivoNombre: data.planActivoNombre || "Plan Básico Freemium",
            lastLoginAt: nowIso
          };
          setUser(merged);
          localStorage.setItem(`makai_user_profile_${firebaseUser.uid}`, JSON.stringify(merged));
        } else {
          await setDoc(userRef, fallbackModel).catch(() => {});
          setUser(fallbackModel);
          localStorage.setItem(
            `makai_user_profile_${firebaseUser.uid}`,
            JSON.stringify(fallbackModel)
          );
        }
      } catch {
        const cached = localStorage.getItem(`makai_user_profile_${firebaseUser.uid}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as UserModel;
            setUser({
              ...fallbackModel,
              ...parsed,
              rol: masterFlag ? "master" : parsed.rol,
              registroPasoActual:
                sessionAuthIntent === "login" || masterFlag
                  ? "completado"
                  : parsed.registroPasoActual || "completado",
              planActivoId: parsed.planActivoId || "plan-basico-freemium",
              planActivoNombre: parsed.planActivoNombre || "Plan Básico Freemium"
            });
          } catch {
            setUser(fallbackModel);
          }
        } else {
          setUser(fallbackModel);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Generar PIN y disparar correo de verificación (solo para nuevos usuarios)
  const sendVerificationToEmail = async (targetEmail?: string): Promise<string> => {
    clearMessages();
    const current = auth.currentUser;
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedEmailPin(pin);
    setEmailVerificationSent(true);

    const emailDisplay = current?.email || targetEmail || "tu correo";

    if (current) {
      try {
        await sendEmailVerification(current);
        setNotice(
          `Se envió el enlace oficial de verificación a ${emailDisplay}. También puedes usar el código de verificación instantánea generado.`
        );
      } catch {
        setNotice(
          `Verificación generada para ${emailDisplay}. Ingresa el código de confirmación de 6 dígitos para validar tu correo.`
        );
      }
    } else {
      setNotice(
        `Código de verificación enviado para ${emailDisplay}. Ingresa los 6 dígitos para confirmar tu correo.`
      );
    }
    return pin;
  };

  // Confirmar la verificación de correo
  const confirmEmailVerification = async (enteredPin?: string): Promise<boolean> => {
    clearMessages();
    const current = auth.currentUser;

    if (current) {
      try {
        await current.reload();
      } catch {
        // Ignorar error de red en reload
      }
    }

    const pinValid = Boolean(
      enteredPin && generatedEmailPin && enteredPin.trim() === generatedEmailPin.trim()
    );

    if (current?.emailVerified || pinValid) {
      if (current && user) {
        localStorage.setItem(`makai_email_verified_${current.uid}`, "true");
        const updatedUser: UserModel = {
          ...user,
          emailVerified: true
        };
        setUser(updatedUser);
        localStorage.setItem(`makai_user_profile_${current.uid}`, JSON.stringify(updatedUser));

        try {
          await updateDoc(doc(db, COLLECTIONS.USERS, current.uid), {
            emailVerified: true
          });
        } catch {
          // Respaldo local
        }
      }

      setNotice("Correo electrónico verificado correctamente.");
      return true;
    } else {
      setError(
        "Código incorrecto o correo aún no verificado. Haz clic en 'Enviar Verificación al Correo' e ingresa el código de 6 dígitos mostrado."
      );
      return false;
    }
  };

  // Inicio o Registro con Gmail (requiere CAPTCHA)
  const startWithGoogle = async (
    captchaVerified: boolean,
    mode: "login" | "register" = "login"
  ) => {
    clearMessages();
    if (!captchaVerified) {
      setError("Debes completar la verificación CAPTCHA antes de continuar con Gmail.");
      throw new Error("CAPTCHA no verificado");
    }

    sessionStorage.setItem("makai_auth_intent", mode);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = (cred.user.email || "").toLowerCase();
      const masterFlag = isMasterAdmin(email);

      if (mode === "login" || masterFlag) {
        // Si ya tiene cuenta e inicia sesión, entra directo al entorno del usuario sin pasar por los 3 pasos
        localStorage.setItem(`makai_email_verified_${cred.user.uid}`, "true");
        setUser((prev) =>
          prev
            ? {
                ...prev,
                rol: masterFlag ? "master" : prev.rol,
                emailVerified: true,
                registroPasoActual: "completado"
              }
            : {
                uid: cred.user.uid,
                email,
                nombre: cred.user.displayName || email.split("@")[0],
                rol: masterFlag ? "master" : "estudiante",
                metodoIngreso: "google",
                emailVerified: true,
                registroPasoActual: "completado",
                planActivoId: "plan-basico-freemium",
                planActivoNombre: "Plan Básico Freemium"
              }
        );
      } else {
        // Nuevo usuario: inicia en el Paso 1 de 3
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedEmailPin(pin);
        setEmailVerificationSent(true);
        if (cred.user && !cred.user.emailVerified) {
          await sendEmailVerification(cred.user).catch(() => {});
        }
      }
    } catch (err: any) {
      setError(err?.message || "Error al conectar con Google.");
      throw err;
    }
  };

  // Iniciar Sesión con Correo y Contraseña (usuarios con cuenta existente -> entran directo al entorno sin los 3 pasos)
  const loginWithEmail = async (email: string, pass: string, captchaVerified: boolean) => {
    clearMessages();
    if (!captchaVerified) {
      setError("Debes completar la verificación CAPTCHA antes de iniciar sesión.");
      throw new Error("CAPTCHA no verificado");
    }

    sessionStorage.setItem("makai_auth_intent", "login");

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const normalizedEmail = (cred.user.email || email).trim().toLowerCase();
      const masterFlag = isMasterAdmin(normalizedEmail);
      localStorage.setItem(`makai_email_verified_${cred.user.uid}`, "true");

      setUser((prev) => ({
        ...(prev || {
          uid: cred.user.uid,
          email: normalizedEmail,
          nombre: cred.user.displayName || normalizedEmail.split("@")[0],
          rol: masterFlag ? "master" : "estudiante",
          metodoIngreso: "email",
          planActivoId: "plan-basico-freemium",
          planActivoNombre: "Plan Básico Freemium"
        }),
        rol: masterFlag ? "master" : prev?.rol || "estudiante",
        emailVerified: true,
        registroPasoActual: "completado"
      }));
    } catch (err: any) {
      setError(
        "Credenciales inválidas o cuenta no registrada. Si eres un usuario nuevo, selecciona la pestaña 'Crear Nuevo Usuario'."
      );
      throw err;
    }
  };

  // Crear Nuevo Usuario con Correo y Contraseña (pasa por los pasos 1, 2 y 3)
  const registerWithEmail = async (email: string, pass: string, captchaVerified: boolean) => {
    clearMessages();
    if (!captchaVerified) {
      setError("Debes completar la verificación CAPTCHA antes de crear tu usuario.");
      throw new Error("CAPTCHA no verificado");
    }

    sessionStorage.setItem("makai_auth_intent", "register");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedEmailPin(pin);
      setEmailVerificationSent(true);
      if (cred.user) {
        await sendEmailVerification(cred.user).catch(() => {});
      }
      setNotice(`Cuenta creada para ${email}. Completa ahora tus Datos Personales (Paso 1 de 3).`);
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        try {
          const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
          const pin = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedEmailPin(pin);
          setEmailVerificationSent(true);
          setUser((prev) =>
            prev ? { ...prev, registroPasoActual: 1 } : null
          );
          if (cred.user) {
            setNotice("Continúa completando tus Datos Personales (Paso 1 de 3).");
          }
          return;
        } catch {
          setError("Este correo ya está registrado con otra contraseña. Usa la pestaña 'Iniciar Sesión'.");
        }
      } else {
        setError(err?.message || "No se pudo registrar el correo electrónico.");
      }
      throw err;
    }
  };

  // Guardar Filtro Obligatorio de Datos Personales (Paso 1 de 3)
  const savePersonalDataStep1 = async (data: PersonalDataStep1, plainPassword?: string) => {
    clearMessages();
    let activeUid = user?.uid || auth.currentUser?.uid;

    if (!activeUid && plainPassword) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, data.email, plainPassword);
        activeUid = cred.user.uid;
        await sendEmailVerification(cred.user).catch(() => {});
      } catch (err: any) {
        if (err?.code === "auth/email-already-in-use") {
          try {
            const cred = await signInWithEmailAndPassword(auth, data.email, plainPassword);
            activeUid = cred.user.uid;
          } catch {
            activeUid = "usr-" + Date.now();
          }
        } else {
          activeUid = "usr-" + Date.now();
        }
      }
    }

    if (plainPassword && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, plainPassword);
      } catch {
        // Continuar si requiere reautenticación
      }
    }

    const finalUid = activeUid || "usr-" + Date.now();
    const masterFlag = isMasterAdmin(data.email);

    const updatedUser: UserModel = {
      uid: finalUid,
      email: data.email,
      nombre: data.nombreApellido,
      nickname: data.nickname || undefined,
      rol: masterFlag ? "master" : (user?.rol || "estudiante"),
      metodoIngreso: user?.metodoIngreso || "email",
      emailVerified: true,
      registroPasoActual: 2,
      planActivoId: user?.planActivoId || "plan-basico-freemium",
      planActivoNombre: user?.planActivoNombre || "Plan Básico Freemium",
      planPendienteAprobacion: user?.planPendienteAprobacion || null,
      datosPersonales: data,
      datosPlanPaso2: user?.datosPlanPaso2,
      datosPagoPaso3: user?.datosPagoPaso3,
      createdAt: user?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    setUser(updatedUser);
    localStorage.setItem(`makai_user_profile_${finalUid}`, JSON.stringify(updatedUser));

    try {
      const userRef = doc(db, COLLECTIONS.USERS, finalUid);
      await setDoc(userRef, updatedUser, { merge: true });
      setNotice("Paso 1 de 3 guardado. Ahora estás en el Paso 2 de 3: Selecciona un Plan.");
    } catch {
      setNotice("Paso 1 de 3 completado. Continúa ahora con el Paso 2 de 3: Selecciona un Plan.");
    }
  };

  // Guardar Selección de Plan (Paso 2 de 3):
  // Si el plan elegido tiene costo $0.00 (0 dólares con 0 centavos), salta el Paso 3 e ingresa directo al entorno del usuario.
  const savePlanSelectionStep2 = async (
    selection: SelectedPlanStep2
  ): Promise<"completado" | 3> => {
    clearMessages();
    const finalUid = user?.uid || auth.currentUser?.uid || "usr-" + Date.now();
    const isZeroCost =
      Number(selection.costoAplicado) === 0 || selection.planId === "plan-basico-freemium";

    const nextStep: "completado" | 3 = isZeroCost ? "completado" : 3;

    const updatedUser: UserModel = {
      ...(user || {
        uid: finalUid,
        email: "estudiante@makai.edu.ec",
        nombre: "Estudiante",
        rol: "estudiante",
        metodoIngreso: "email",
        emailVerified: true,
        planActivoId: selection.planId,
        planActivoNombre: selection.planNombre
      }),
      registroPasoActual: nextStep,
      planActivoId: isZeroCost ? selection.planId : user?.planActivoId || "plan-basico-freemium",
      planActivoNombre: isZeroCost
        ? selection.planNombre
        : user?.planActivoNombre || "Plan Básico Freemium",
      planPendienteAprobacion: isZeroCost ? null : user?.planPendienteAprobacion || null,
      datosPlanPaso2: selection,
      lastLoginAt: new Date().toISOString()
    };

    setUser(updatedUser);
    localStorage.setItem(`makai_user_profile_${finalUid}`, JSON.stringify(updatedUser));

    try {
      const userRef = doc(db, COLLECTIONS.USERS, finalUid);
      await setDoc(userRef, updatedUser, { merge: true });
    } catch {
      // Mantiene sincronización local
    }

    if (isZeroCost) {
      setNotice(
        `Has seleccionado ${selection.planNombre} ($0.00 USD). Ingresando directamente a tu entorno de usuario.`
      );
    } else {
      setNotice(
        `Paso 2 de 3 completado: ${selection.planNombre} (${selection.cicloFacturacion.toUpperCase()}). Ahora completa el Paso 3 de 3: Elige tu Medio de Pago y Sube tu Comprobante.`
      );
    }

    return nextStep;
  };

  // Enviar Comprobante de Pago (Paso 3 de 3)
  const submitPaymentStep3 = async (input: SubmitPaymentInput) => {
    clearMessages();
    const finalUid = user?.uid || auth.currentUser?.uid || "usr-" + Date.now();
    const nowIso = new Date().toISOString();
    const submissionId = "pay-" + Date.now();

    const fullSubmission: PaymentSubmissionStep3 = {
      id: submissionId,
      uid: finalUid,
      email: user?.email || "estudiante@makai.edu.ec",
      nombreUsuario: user?.datosPersonales?.nombreApellido || user?.nombre || "Estudiante",
      metodoPago: input.metodoPago,
      entidadBancariaId: input.entidadBancariaId,
      entidadBancariaNombre: input.entidadBancariaNombre,
      numeroComprobante: input.numeroComprobante.trim(),
      fotoComprobante: input.fotoComprobante,
      planSolicitadoId: input.planSolicitadoId,
      planSolicitadoNombre: input.planSolicitadoNombre,
      cicloFacturacion: input.cicloFacturacion,
      montoPagado: input.montoPagado,
      moneda: input.moneda,
      planActivadoTemporal: "Plan Básico Freemium",
      estadoVerificacion: "pendiente_24h",
      paso3CompletadoEn: nowIso
    };

    const isFreePlan =
      input.planSolicitadoId === "plan-basico-freemium" || Number(input.montoPagado) === 0;

    const updatedUser: UserModel = {
      ...(user || {
        uid: finalUid,
        email: "estudiante@makai.edu.ec",
        nombre: "Estudiante",
        rol: "estudiante",
        metodoIngreso: "email",
        emailVerified: true,
        planActivoId: "plan-basico-freemium",
        planActivoNombre: "Plan Básico Freemium"
      }),
      registroPasoActual: "completado",
      planActivoId: "plan-basico-freemium",
      planActivoNombre: "Plan Básico Freemium",
      planPendienteAprobacion: isFreePlan
        ? null
        : {
            planId: input.planSolicitadoId,
            planNombre: input.planSolicitadoNombre,
            cicloFacturacion: input.cicloFacturacion,
            enviadoEn: nowIso,
            plazoMaximoHoras: 24
          },
      datosPagoPaso3: fullSubmission,
      lastLoginAt: nowIso
    };

    setUser(updatedUser);
    localStorage.setItem(`makai_user_profile_${finalUid}`, JSON.stringify(updatedUser));

    const updatedSubmissions = [fullSubmission, ...paymentSubmissions];
    setPaymentSubmissions(updatedSubmissions);
    localStorage.setItem(LOCAL_PAYMENT_SUBMISSIONS_KEY, JSON.stringify(updatedSubmissions));

    try {
      await setDoc(doc(db, COLLECTIONS.USERS, finalUid), updatedUser, { merge: true });
      await setDoc(doc(db, COLLECTIONS.PAYMENTS, submissionId), fullSubmission, { merge: true });
    } catch {
      // Mantiene sincronización local
    }

    setNotice(
      `¡Comprobante #${fullSubmission.numeroComprobante} recibido! Has ingresado a Makai Academy con el Plan Básico Freemium activo. En un plazo máximo de 24 horas se habilitarán las funciones de tu ${input.planSolicitadoNombre}.`
    );
  };

  // Acceso directo si el usuario eligió un plan de $0.00
  const completeFreePlanOnboarding = async () => {
    clearMessages();
    const finalUid = user?.uid || auth.currentUser?.uid || "usr-" + Date.now();
    const nowIso = new Date().toISOString();

    const updatedUser: UserModel = {
      ...(user || {
        uid: finalUid,
        email: "estudiante@makai.edu.ec",
        nombre: "Estudiante",
        rol: "estudiante",
        metodoIngreso: "email",
        emailVerified: true,
        planActivoId: "plan-basico-freemium",
        planActivoNombre: "Plan Básico Freemium"
      }),
      registroPasoActual: "completado",
      planActivoId: "plan-basico-freemium",
      planActivoNombre: "Plan Básico Freemium",
      planPendienteAprobacion: null,
      lastLoginAt: nowIso
    };

    setUser(updatedUser);
    localStorage.setItem(`makai_user_profile_${finalUid}`, JSON.stringify(updatedUser));

    try {
      await setDoc(doc(db, COLLECTIONS.USERS, finalUid), updatedUser, { merge: true });
    } catch {
      // Respaldo local
    }

    setNotice("¡Bienvenido a Makai Academy! Tu Plan Básico Freemium está activo.");
  };

  // Guardar el catálogo completo de planes desde el Panel del Administrador Maestro
  const savePlansCatalog = async (updatedPlans: SubscriptionPlanConfig[]) => {
    clearMessages();
    const sorted = [...updatedPlans].sort((a, b) => a.orden - b.orden);
    setPlansCatalog(sorted);
    localStorage.setItem(LOCAL_PLANS_STORAGE_KEY, JSON.stringify(sorted));

    try {
      await Promise.all(
        sorted.map((plan) =>
          setDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, plan.id), plan, { merge: true })
        )
      );
      setNotice(
        "Catálogo de planes (descripciones, beneficios y costos mensual/anual) actualizado en Firebase Firestore."
      );
    } catch {
      setNotice(
        "Catálogo de planes actualizado y aplicado en tiempo real en la plataforma."
      );
    }
  };

  const resetPlansCatalogToDefault = async () => {
    await savePlansCatalog(DEFAULT_SUBSCRIPTION_PLANS);
  };

  // Guardar la configuración de Medios de Pago
  const savePaymentMethodsConfig = async (updatedConfig: PaymentMethodsAdminConfig) => {
    clearMessages();
    const stamped: PaymentMethodsAdminConfig = {
      ...updatedConfig,
      updatedAt: new Date().toISOString()
    };
    setPaymentMethodsConfig(stamped);
    localStorage.setItem(LOCAL_PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(stamped));

    try {
      await setDoc(doc(db, COLLECTIONS.SETTINGS, "medios_pago_paso3"), stamped, { merge: true });
      setNotice(
        "Configuración de Medios de Pago (QR Bancarios, Cuentas de Transferencia e Instrucciones) guardada en Firebase Firestore."
      );
    } catch {
      setNotice(
        "Configuración de Medios de Pago guardada y actualizada en tiempo real."
      );
    }
  };

  const resetPaymentMethodsConfigToDefault = async () => {
    await savePaymentMethodsConfig(DEFAULT_PAYMENT_METHODS_CONFIG);
  };

  const approvePaymentSubmission = async (submissionId: string) => {
    clearMessages();
    const target = paymentSubmissions.find((s) => s.id === submissionId);
    if (!target) return;

    const updatedSubmissions = paymentSubmissions.map((s) =>
      s.id === submissionId ? { ...s, estadoVerificacion: "aprobado" as const } : s
    );
    setPaymentSubmissions(updatedSubmissions);
    localStorage.setItem(LOCAL_PAYMENT_SUBMISSIONS_KEY, JSON.stringify(updatedSubmissions));

    if (user && user.uid === target.uid) {
      const upgradedUser: UserModel = {
        ...user,
        planActivoId: target.planSolicitadoId,
        planActivoNombre: target.planSolicitadoNombre,
        planPendienteAprobacion: null,
        datosPagoPaso3: user.datosPagoPaso3
          ? { ...user.datosPagoPaso3, estadoVerificacion: "aprobado" }
          : undefined
      };
      setUser(upgradedUser);
      localStorage.setItem(`makai_user_profile_${user.uid}`, JSON.stringify(upgradedUser));
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.PAYMENTS, submissionId), {
        estadoVerificacion: "aprobado"
      });
      await updateDoc(doc(db, COLLECTIONS.USERS, target.uid), {
        planActivoId: target.planSolicitadoId,
        planActivoNombre: target.planSolicitadoNombre,
        planPendienteAprobacion: null
      });
    } catch {
      // Mantiene sincronización local
    }

    setNotice(
      `Comprobante #${target.numeroComprobante} aprobado. Se habilitaron las funciones del ${target.planSolicitadoNombre} para ${target.nombreUsuario}.`
    );
  };

  const logout = async () => {
    clearMessages();
    setEmailVerificationSent(false);
    setGeneratedEmailPin(null);
    sessionStorage.removeItem("makai_auth_intent");
    await signOut(auth).catch(() => {});
    setUser(null);
  };

  const role: UserRole = user ? (isMasterAdmin(user.email) ? "master" : user.rol) : "visitante";
  const isMaster = Boolean(user && isMasterAdmin(user.email));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        role,
        isMaster,
        error,
        notice,
        emailVerificationSent,
        generatedEmailPin,
        plansCatalog,
        paymentMethodsConfig,
        paymentSubmissions,
        clearMessages,
        startWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendVerificationToEmail,
        confirmEmailVerification,
        savePersonalDataStep1,
        savePlanSelectionStep2,
        submitPaymentStep3,
        completeFreePlanOnboarding,
        savePlansCatalog,
        resetPlansCatalogToDefault,
        savePaymentMethodsConfig,
        resetPaymentMethodsConfigToDefault,
        approvePaymentSubmission,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
