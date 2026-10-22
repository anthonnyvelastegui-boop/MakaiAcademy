// ============================================================================
// ARCHIVO: js/3-security/auth.login.js
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// RESPONSABILIDAD: Controlador de Inicio de Sesión (Correo/Contraseña y OAuth),
//                  Recuperación de Clave, Verificación Inicial y Enrutamiento
//                  de Planes desde index.html hacia dashboard.html / registro.html.
// ============================================================================

import {
    auth,
    db,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    doc,
    getDoc,
    setDoc
} from "../2-core/firebase.service.js";

import * as StateStore from "../2-core/state.store.js";

// --- LISTA DE RESPALDO DE ADMINISTRADORES MAESTROS ---
const FALLBACK_MASTER_ADMINS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

// Bandera para evitar enlaces duplicados de eventos en el DOM
let authLoginInitialized = false;
let isRegisterModeInIndex = false;

/**
 * Comprueba si un correo electrónico pertenece a una cuenta maestra de administración.
 * @param {string} email
 * @returns {boolean}
 */
function checkIsAdminEmail(email) {
    if (!email) return false;
    if (typeof StateStore.isMasterAdmin === "function") {
        return StateStore.isMasterAdmin(email);
    }
    return FALLBACK_MASTER_ADMINS.includes(email.trim().toLowerCase());
}

/**
 * Verifica si el usuario autenticado ya confirmó su correo electrónico.
 * Las cuentas maestras tienen pase directo automático.
 * @param {Object} user - Objeto User de Firebase Auth
 * @returns {Promise<boolean>}
 */
async function checkUserVerificationStatus(user) {
    if (!user) return false;
    if (checkIsAdminEmail(user.email)) return true;

    const isGoogle = user.providerData?.some(p => p.providerId === "google.com");
    if (isGoogle) {
        try {
            const snap = await getDoc(doc(db, "usuarios", user.uid));
            if (snap.exists() && snap.data().correoConfirmadoMakai === true) {
                return true;
            }
        } catch (err) {
            console.warn("[AuthLogin] Verificando estado Gmail en Firestore:", err);
        }
        if (localStorage.getItem(`makai_gmail_verified_${user.uid}`) === "true") {
            return true;
        }
        return !!user.emailVerified;
    }

    return !!user.emailVerified;
}

/**
 * Traduce los códigos de error de Firebase Authentication v13.0.0 a mensajes
 * claros en español para mostrar en la interfaz de index.html.
 * @param {Object|Error} error
 * @returns {string}
 */
export function translateFirebaseAuthError(error) {
    const code = error?.code || "";
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Correo electrónico o contraseña incorrectos. Verifica tus datos o crea tu expediente si eres nuevo.";
        case "auth/invalid-email":
            return "El formato del correo electrónico ingresado no es válido.";
        case "auth/user-disabled":
            return "Esta cuenta ha sido suspendida temporalmente. Contacta a soporte de Makai Academy.";
        case "auth/email-already-in-use":
            return "Este correo electrónico ya está registrado. Inicia sesión o recupera tu contraseña.";
        case "auth/weak-password":
            return "La contraseña debe tener al menos 6 caracteres.";
        case "auth/too-many-requests":
            return "Demasiados intentos seguidos. Por seguridad, espera unos minutos o restablece tu contraseña.";
        case "auth/popup-closed-by-user":
            return "Se cerró la ventana emergente antes de completar el acceso con Google.";
        case "auth/popup-blocked":
            return "Tu navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio.";
        case "auth/unauthorized-domain":
            return "Dominio no autorizado en Firebase Authentication. Asegúrate de autorizar el dominio en Firebase Console.";
        case "auth/network-request-failed":
            return "Error de conexión a internet. Verifica tu red e inténtalo nuevamente.";
        default:
            return `No se pudo completar la autenticación (${code || error?.message || "Error desconocido"}).`;
    }
}

/**
 * Muestra un mensaje de retroalimentación visual dentro del formulario de login
 * o utiliza alert() como respaldo si no existe un contenedor de errores en el DOM.
 * @param {string} message - Texto a mostrar
 * @param {"error"|"success"|"warning"} type - Tipo de alerta
 */
function showAuthFeedback(message, type = "error") {
    let feedbackBox = document.getElementById("auth-feedback-box") || document.getElementById("login-error-box");

    // Si no existe contenedor de feedback en index.html, lo inyectamos dinámicamente sobre el botón submit
    const authForm = document.getElementById("auth-form");
    const submitBtn = document.getElementById("submit-btn");

    if (!feedbackBox && authForm) {
        feedbackBox = document.createElement("div");
        feedbackBox.id = "auth-feedback-box";
        if (submitBtn && submitBtn.parentNode === authForm) {
            authForm.insertBefore(feedbackBox, submitBtn);
        } else {
            authForm.prepend(feedbackBox);
        }
    }

    if (feedbackBox) {
        const styles = {
            error: "mb-4 p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger",
            warning: "mb-4 p-3 rounded-xl text-xs font-mono bg-warning/15 border border-warning text-warning",
            success: "mb-4 p-3 rounded-xl text-xs font-mono bg-secondary/15 border border-secondary text-secondary"
        };
        feedbackBox.className = styles[type] || styles.error;
        feedbackBox.textContent = message;
        feedbackBox.classList.remove("hidden");
    } else {
        alert(message);
    }
}

/**
 * Oculta el cuadro de retroalimentación de errores del formulario de login.
 */
function clearAuthFeedback() {
    const feedbackBox = document.getElementById("auth-feedback-box") || document.getElementById("login-error-box");
    feedbackBox?.classList.add("hidden");
}

/**
 * Determina la URL de destino tras un inicio de sesión exitoso y verificado,
 * respetando si el estudiante había elegido previamente un plan PRO o VIP.
 * @param {string} email - Correo del usuario autenticado
 * @returns {string} URL de redirección
 */
function resolvePostLoginDestination(email) {
    const isAdmin = checkIsAdminEmail(email);
    const pendingPlan = sessionStorage.getItem("makai_selected_plan");
    const pendingBilling = sessionStorage.getItem("makai_selected_billing") || "annual";

    if (pendingPlan && (pendingPlan === "PRO" || pendingPlan === "VIP" || pendingPlan === "pro_anual" || pendingPlan === "pro_mensual" || pendingPlan === "vip") && !isAdmin) {
        sessionStorage.removeItem("makai_selected_plan");
        if (pendingPlan === "pro_anual" || pendingPlan === "pro_mensual" || pendingPlan === "vip") {
            return `registro.html?plan=${pendingPlan}&pago=qr`;
        }
        const normalizedPlan = pendingPlan === "VIP"
            ? "vip"
            : (pendingBilling === "monthly" ? "pro_mensual" : "pro_anual");
        return `registro.html?plan=${normalizedPlan}&pago=qr`;
    }

    return "dashboard.html";
}

/**
 * Procesa el envío del formulario principal (#auth-form) con correo y contraseña.
 * @param {Event} e - Evento submit del formulario
 */
export async function handleEmailPasswordSubmit(e) {
    e.preventDefault();
    clearAuthFeedback();

    const emailInput = document.getElementById("email");
    const passInput = document.getElementById("password");
    const submitBtn = document.getElementById("submit-btn");

    const email = (emailInput?.value || "").trim();
    const pass = passInput?.value || "";

    if (!email || !pass) {
        showAuthFeedback("⚠️ Por favor ingresa tu correo electrónico y contraseña.");
        return;
    }

    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "Ingresar al Portal";

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "<span>Verificando credenciales...</span>";
        }

        let cred;
        if (isRegisterModeInIndex) {
            cred = await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            cred = await signInWithEmailAndPassword(auth, email, pass);
        }

        await cred.user.reload();

        // Pase directo inmediato para las cuentas maestras de administración
        if (checkIsAdminEmail(cred.user.email)) {
            window.location.href = "dashboard.html";
            return;
        }

        const verified = await checkUserVerificationStatus(cred.user);
        if (!verified) {
            try {
                await sendEmailVerification(cred.user);
            } catch (verifyErr) {
                console.warn("[AuthLogin] Enlace de verificación ya enviado recientemente:", verifyErr);
            }
            showAuthFeedback(
                "Hemos enviado un enlace de verificación a tu correo electrónico. Ábrelo para activar tu acceso.",
                "warning"
            );
            setTimeout(() => {
                window.location.href = "registro.html?verify=pending";
            }, 1200);
            return;
        }

        window.location.href = resolvePostLoginDestination(cred.user.email);
    } catch (err) {
        console.error("[AuthLogin] Error en autenticación:", err);
        showAuthFeedback(translateFirebaseAuthError(err), "error");

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    }
}

/**
 * Ejecuta el inicio de sesión mediante ventana emergente de Google (GoogleAuthProvider).
 * Sincroniza el documento inicial en la colección `usuarios` y verifica el estado del correo.
 * @param {HTMLElement|null} btnElement - Botón que disparó la acción
 */
export async function loginWithGoogle(btnElement = null) {
    clearAuthFeedback();
    const googleBtn = btnElement || document.getElementById("btn-google-login");
    const originalHTML = googleBtn ? googleBtn.innerHTML : "Continuar con Google";

    if (googleBtn) {
        googleBtn.disabled = true;
        googleBtn.innerHTML = "<span>Conectando con Gmail...</span>";
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        const result = await signInWithPopup(auth, provider);
        const gUser = result.user;

        // 1. Pase directo para cuentas maestras de administración
        if (checkIsAdminEmail(gUser.email)) {
            const adminRef = doc(db, "usuarios", gUser.uid);
            await setDoc(adminRef, {
                uid: gUser.uid,
                email: gUser.email,
                nombre: gUser.displayName || gUser.email.split("@")[0],
                rol: "admin",
                subscriptionLevel: "PRO",
                estadoPago: "activo_verificado",
                correoConfirmadoMakai: true,
                lastLoginAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});

            window.location.href = "dashboard.html";
            return;
        }

        // 2. Comprobar expediente del estudiante en Cloud Firestore
        const userRef = doc(db, "usuarios", gUser.uid);
        let snap = null;
        try {
            snap = await getDoc(userRef);
        } catch (fireErr) {
            console.warn("[AuthLogin] Lectura inicial de Firestore en espera:", fireErr);
        }

        const isConfirmedInFirestore = snap?.exists() && snap.data()?.correoConfirmadoMakai === true;
        const isConfirmedInLocal = localStorage.getItem(`makai_gmail_verified_${gUser.uid}`) === "true";

        if (!isConfirmedInFirestore && !isConfirmedInLocal) {
            try {
                await setDoc(userRef, {
                    uid: gUser.uid,
                    email: gUser.email,
                    nombre: gUser.displayName || gUser.email.split("@")[0],
                    primerNombre: (gUser.displayName || gUser.email.split("@")[0]).split(" ")[0],
                    rol: "estudiante",
                    subscriptionLevel: "Básico",
                    estadoPago: "activo_gratis",
                    carrera: "medicina",
                    correoConfirmadoMakai: false,
                    casesUsedThisMonth: 0,
                    totalExamsCompleted: 0,
                    globalAverage: 0,
                    createdAt: new Date().toISOString()
                }, { merge: true });
            } catch (writeErr) {
                console.warn("[AuthLogin] Aviso creando perfil inicial Gmail:", writeErr);
            }

            try {
                await sendEmailVerification(gUser);
            } catch (verifyErr) {
                console.warn("[AuthLogin] Aviso envío de enlace Gmail:", verifyErr);
            }

            window.location.href = "registro.html?verify=pending&provider=google";
            return;
        }

        window.location.href = resolvePostLoginDestination(gUser.email);
    } catch (err) {
        console.error("[AuthLogin] Detalle error Google Auth:", err);
        showAuthFeedback(translateFirebaseAuthError(err), "error");

        if (googleBtn) {
            googleBtn.innerHTML = originalHTML;
            googleBtn.disabled = false;
        }
    }
}

/**
 * Ejecuta el inicio de sesión opcional con cuenta Microsoft (OAuthProvider).
 * @param {HTMLElement|null} btnElement
 */
export async function loginWithMicrosoft(btnElement = null) {
    clearAuthFeedback();
    const msBtn = btnElement || document.getElementById("btn-microsoft-login");
    const originalHTML = msBtn ? msBtn.innerHTML : "Microsoft";

    if (msBtn) {
        msBtn.disabled = true;
        msBtn.innerHTML = "<span>Conectando con Microsoft...</span>";
    }

    const provider = new OAuthProvider("microsoft.com");
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        const result = await signInWithPopup(auth, provider);
        window.location.href = resolvePostLoginDestination(result.user.email);
    } catch (err) {
        console.error("[AuthLogin] Error Microsoft Auth:", err);
        showAuthFeedback(translateFirebaseAuthError(err), "error");
        if (msBtn) {
            msBtn.innerHTML = originalHTML;
            msBtn.disabled = false;
        }
    }
}

/**
 * Inicializa el modal de recuperación de contraseña (#forgot-password-modal) en index.html.
 */
export function initForgotPasswordModal() {
    const forgotBtn = document.getElementById("btn-forgot-password");
    const forgotModal = document.getElementById("forgot-password-modal");
    const closeForgot = document.getElementById("close-forgot-modal");
    const cancelForgot = document.getElementById("cancel-forgot-btn");
    const forgotForm = document.getElementById("forgot-password-form");
    const resetFeedback = document.getElementById("reset-feedback");

    if (!forgotModal && !forgotBtn) return;

    const hideForgotModal = () => {
        forgotModal?.classList.add("hidden");
        forgotModal?.classList.remove("flex");
        resetFeedback?.classList.add("hidden");
    };

    if (forgotBtn && !forgotBtn.dataset.boundForgot) {
        forgotBtn.dataset.boundForgot = "1";
        forgotBtn.addEventListener("click", () => {
            const currentTypedEmail = document.getElementById("email")?.value?.trim() || "";
            const resetInput = document.getElementById("reset-email-input");
            if (resetInput && currentTypedEmail) {
                resetInput.value = currentTypedEmail;
            }
            forgotModal?.classList.remove("hidden");
            forgotModal?.classList.add("flex");
        });
    }

    closeForgot?.addEventListener("click", hideForgotModal);
    cancelForgot?.addEventListener("click", hideForgotModal);

    // Cerrar modal al hacer clic en el fondo oscuro exterior
    forgotModal?.addEventListener("click", (e) => {
        if (e.target === forgotModal) hideForgotModal();
    });

    if (forgotForm && !forgotForm.dataset.boundResetForm) {
        forgotForm.dataset.boundResetForm = "1";
        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const resetInput = document.getElementById("reset-email-input");
            const submitForgotBtn = document.getElementById("submit-forgot-btn");
            const emailToReset = (resetInput?.value || "").trim();

            if (!emailToReset) return;

            try {
                if (submitForgotBtn) {
                    submitForgotBtn.disabled = true;
                    submitForgotBtn.textContent = "Enviando enlace...";
                }

                await sendPasswordResetEmail(auth, emailToReset);

                if (resetFeedback) {
                    resetFeedback.className = "text-xs font-mono p-3 rounded-xl bg-secondary/15 border border-secondary text-secondary";
                    resetFeedback.textContent = `✓ Enlace enviado a ${emailToReset}. Revisa tu bandeja de entrada o carpeta de Spam.`;
                    resetFeedback.classList.remove("hidden");
                }
            } catch (err) {
                if (resetFeedback) {
                    resetFeedback.className = "text-xs font-mono p-3 rounded-xl bg-danger/15 border border-danger text-danger";
                    resetFeedback.textContent = translateFirebaseAuthError(err);
                    resetFeedback.classList.remove("hidden");
                }
            } finally {
                if (submitForgotBtn) {
                    submitForgotBtn.disabled = false;
                    submitForgotBtn.textContent = "Enviar Enlace al Correo";
                }
            }
        });
    }
}

/**
 * Inicializa las pestañas de Login / Registro (#tab-login, #tab-register),
 * el medidor de fortaleza de contraseña (#password-strength) y el botón
 * para mostrar u ocultar la contraseña si están presentes en index.html.
 */
export function initPasswordControls() {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const regFields = document.getElementById("register-fields");
    const submitBtn = document.getElementById("submit-btn");

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => {
            isRegisterModeInIndex = false;
            tabLogin.classList.replace("text-gray-400", "text-white");
            tabLogin.classList.replace("hover:text-white", "bg-surface-high");
            tabLogin.classList.add("shadow");
            tabRegister.classList.replace("bg-surface-high", "hover:text-white");
            tabRegister.classList.replace("text-white", "text-gray-400");
            tabRegister.classList.remove("shadow");
            regFields?.classList.add("hidden");
            if (submitBtn) {
                submitBtn.innerHTML = '<span>Ingresar al Portal</span><span class="material-symbols-outlined text-lg">arrow_forward</span>';
            }
        });

        tabRegister.addEventListener("click", () => {
            // Si no hay campos de registro incrustados en index.html, redirigir a la bóveda registro.html
            if (!regFields) {
                window.location.href = "registro.html";
                return;
            }
            isRegisterModeInIndex = true;
            tabRegister.classList.replace("text-gray-400", "text-white");
            tabRegister.classList.replace("hover:text-white", "bg-surface-high");
            tabRegister.classList.add("shadow");
            tabLogin.classList.replace("bg-surface-high", "hover:text-white");
            tabLogin.classList.replace("text-white", "text-gray-400");
            tabLogin.classList.remove("shadow");
            regFields.classList.remove("hidden");
            if (submitBtn) {
                submitBtn.textContent = "Crear Cuenta Nueva";
            }
        });
    }

    // Medidor de seguridad de contraseña en tiempo real
    const passwordInput = document.getElementById("password");
    const strengthBar = document.getElementById("password-strength");
    const strengthIndicator = strengthBar?.querySelector("div");

    if (passwordInput && strengthBar && strengthIndicator) {
        passwordInput.addEventListener("input", (e) => {
            const val = e.target.value;
            if (!val) {
                strengthBar.classList.add("hidden");
                return;
            }
            strengthBar.classList.remove("hidden");

            let strength = 0;
            if (val.length >= 8) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;

            strengthIndicator.className = "h-full transition-all ";
            if (strength <= 1) {
                strengthIndicator.classList.add("w-1/3", "bg-danger");
            } else if (strength === 2 || strength === 3) {
                strengthIndicator.classList.add("w-2/3", "bg-warning");
            } else {
                strengthIndicator.classList.add("w-full", "bg-secondary");
            }
        });
    }

    // Conmutador opcional de visibilidad de contraseña (mostrar/ocultar)
    const togglePassBtn = document.getElementById("btn-toggle-password");
    if (togglePassBtn && passwordInput) {
        togglePassBtn.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            const icon = togglePassBtn.querySelector(".material-symbols-outlined");
            if (icon) {
                icon.textContent = isPassword ? "visibility_off" : "visibility";
            }
        });
    }
}

/**
 * Inicializa los selectores de facturación (Mensual vs. Anual) y botones de
 * planes académicos en index.html (Básico $0, PRO CACES $17.99/$139.99 y VIP $49.99),
 * guardando la intención en sessionStorage para registro.html.
 */
export function initPlanSelectionButtons() {
    const planButtons = document.querySelectorAll("[data-select-plan]");
    planButtons.forEach(btn => {
        if (btn.dataset.boundPlanBtn) return;
        btn.dataset.boundPlanBtn = "1";
        btn.addEventListener("click", () => {
            const selectedPlan = btn.dataset.selectPlan || "basico";
            const selectedBilling = btn.dataset.billing || "annual";
            const paymentMethod = btn.dataset.pago || "qr";

            sessionStorage.setItem("makai_selected_plan", selectedPlan);
            sessionStorage.setItem("makai_selected_billing", selectedBilling);

            window.location.href = `registro.html?plan=${encodeURIComponent(selectedPlan)}&pago=${encodeURIComponent(paymentMethod)}`;
        });
    });
}

/**
 * Punto de entrada principal del módulo de Login en index.html.
 * Invocado automáticamente por `js/2-core/app.orchestrator.js`.
 */
export function initAuthLogin() {
    if (authLoginInitialized) return;
    authLoginInitialized = true;

    // 1. Enlazar formulario principal de inicio de sesión (#auth-form)
    const authForm = document.getElementById("auth-form");
    if (authForm && !authForm.dataset.boundLoginSubmit) {
        authForm.dataset.boundLoginSubmit = "1";
        authForm.addEventListener("submit", handleEmailPasswordSubmit);
    }

    // 2. Exponer función global y enlazar botón de acceso con Google (#btn-google-login)
    window.loginWithGoogle = loginWithGoogle;
    const googleBtn = document.getElementById("btn-google-login");
    if (googleBtn && !googleBtn.dataset.boundGoogle) {
        googleBtn.dataset.boundGoogle = "1";
        googleBtn.addEventListener("click", () => loginWithGoogle(googleBtn));
    }

    // 3. Enlazar botón opcional de Microsoft (#btn-microsoft-login)
    window.loginWithMicrosoft = loginWithMicrosoft;
    const msBtn = document.getElementById("btn-microsoft-login");
    if (msBtn && !msBtn.dataset.boundMicrosoft) {
        msBtn.dataset.boundMicrosoft = "1";
        msBtn.addEventListener("click", () => loginWithMicrosoft(msBtn));
    }

    // 4. Inicializar modal de recuperación de contraseña (#forgot-password-modal)
    initForgotPasswordModal();

    // 5. Inicializar pestañas, barra de fortaleza y visibilidad de contraseña
    initPasswordControls();

    // 6. Inicializar botones de planes académicos hacia registro.html
    initPlanSelectionButtons();

    console.info("[AuthLogin] Controlador de autenticación inicializado en index.html.");
}

// Alias de compatibilidad para llamadas desde app.orchestrator.js
export const initAuthUI = initAuthLogin;
