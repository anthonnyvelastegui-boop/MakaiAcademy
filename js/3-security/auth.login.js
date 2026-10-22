// ============================================================================
// ARCHIVO: js/3-security/auth.login.js
// DESCRIPCIÓN: Controlador de Login, Registro Rápido y Gmail SSO en index.html
// ============================================================================

import {
    auth,
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    doc,
    setDoc,
    getDoc
} from "../2-core/firebase.service.js";

import { isMasterAdmin } from "../2-core/state.store.js";

let isRegistering = false;
let selectedBillingPeriod = "annual";
let isAuthLoginBound = false;

export function initAuthLogin() {
    if (isAuthLoginBound) return;
    const authForm = document.getElementById("auth-form");
    if (!authForm) return;
    isAuthLoginBound = true;

    setupAuthTabs();
    setupPasswordToggle();
    setupPasswordEntropyMeter();
    setupForgotPassword();
    setupFormSubmit(authForm);
    setupSocialSSO();
    setupBillingToggle();
    setupPlanButtons();
}

// 1. Pestañas Iniciar Sesión / Crear Cuenta
function setupAuthTabs() {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const regFields = document.getElementById("register-fields");
    const submitBtnText = document.getElementById("submit-btn-text") || document.getElementById("submit-btn");

    if (!tabLogin || !tabRegister) return;

    tabLogin.addEventListener("click", () => {
        isRegistering = false;
        tabLogin.className = "flex-1 py-2.5 rounded-lg bg-surface-high text-white font-semibold text-xs sm:text-sm transition-all shadow flex items-center justify-center gap-2";
        tabRegister.className = "flex-1 py-2.5 rounded-lg text-gray-400 hover:text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2";
        regFields?.classList.add("hidden");
        if (submitBtnText) submitBtnText.textContent = "Acceder al Portal de Salud";
        hideAlert();
    });

    tabRegister.addEventListener("click", () => {
        isRegistering = true;
        tabRegister.className = "flex-1 py-2.5 rounded-lg bg-surface-high text-white font-semibold text-xs sm:text-sm transition-all shadow flex items-center justify-center gap-2";
        tabLogin.className = "flex-1 py-2.5 rounded-lg text-gray-400 hover:text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2";
        regFields?.classList.remove("hidden");
        if (submitBtnText) submitBtnText.textContent = "Crear Cuenta Nueva";
        hideAlert();
    });
}

// 2. Mostrar / Ocultar Contraseña
function setupPasswordToggle() {
    const btnToggle = document.getElementById("btn-toggle-password");
    const passInput = document.getElementById("password");
    const iconToggle = document.getElementById("icon-toggle-password");
    const textToggle = document.getElementById("text-toggle-password");

    if (!btnToggle || !passInput) return;

    btnToggle.addEventListener("click", () => {
        const isPassword = passInput.type === "password";
        passInput.type = isPassword ? "text" : "password";
        if (iconToggle) iconToggle.textContent = isPassword ? "visibility_off" : "visibility";
        if (textToggle) textToggle.textContent = isPassword ? "Ocultar" : "Mostrar";
    });
}

// 3. Medidor de Seguridad de Contraseña
function setupPasswordEntropyMeter() {
    const passwordInput = document.getElementById("password");
    const strengthContainer = document.getElementById("password-strength");
    const strengthBar = document.getElementById("password-strength-bar") || strengthContainer?.querySelector("div");
    const strengthText = document.getElementById("password-strength-text");

    if (!passwordInput || !strengthContainer || !strengthBar) return;

    passwordInput.addEventListener("input", (e) => {
        const val = e.target.value;
        if (!val) {
            strengthContainer.classList.add("hidden");
            strengthText?.classList.add("hidden");
            return;
        }

        strengthContainer.classList.remove("hidden");
        strengthText?.classList.remove("hidden");

        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        strengthBar.className = "h-full transition-all duration-300 ";
        if (score <= 1) {
            strengthBar.classList.add("w-1/3", "bg-danger");
            if (strengthText) {
                strengthText.textContent = "Seguridad débil (mínimo 8 caracteres, números y mayúsculas)";
                strengthText.className = "text-[10px] font-mono text-danger mt-1";
            }
        } else if (score === 2 || score === 3) {
            strengthBar.classList.add("w-2/3", "bg-warning");
            if (strengthText) {
                strengthText.textContent = "Seguridad media • Entropía aceptable";
                strengthText.className = "text-[10px] font-mono text-warning mt-1";
            }
        } else {
            strengthBar.classList.add("w-full", "bg-secondary");
            if (strengthText) {
                strengthText.textContent = "Seguridad alta • Clave óptima";
                strengthText.className = "text-[10px] font-mono text-secondary mt-1";
            }
        }
    });
}

// 4. Recuperación de Contraseña
function setupForgotPassword() {
    const btnForgot = document.getElementById("btn-forgot-password");
    const emailInput = document.getElementById("email");

    if (!btnForgot || !emailInput) return;

    btnForgot.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        if (!email) {
            showAlert("Escribe tu correo arriba primero para enviarte el enlace de recuperación.", "warning");
            emailInput.focus();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            showAlert(`Enlace de recuperación enviado a ${email}. Revisa tu bandeja de entrada o Spam.`, "success");
        } catch (err) {
            showAlert(translateFirebaseError(err.code || err.message), "danger");
        }
    });
}

// 5. Envío del Formulario con Correo y Contraseña (Si no existe la cuenta en Login, te avisa o registra)
function setupFormSubmit(authForm) {
    const submitBtn = document.getElementById("submit-btn");
    const submitBtnText = document.getElementById("submit-btn-text");

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const fullName = document.getElementById("full-name")?.value.trim() || "";
        const university = document.getElementById("university")?.value.trim() || "";

        try {
            if (submitBtn) submitBtn.disabled = true;
            if (submitBtnText) submitBtnText.textContent = "Conectando con Firebase...";

            let cred;
            if (isRegistering) {
                cred = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                cred = await signInWithEmailAndPassword(auth, email, password);
            }

            await ensureUserProfile(cred.user, { nombre: fullName, universidad: university });
            window.location.href = "dashboard.html";
        } catch (err) {
            console.error("Error Auth Correo:", err);
            showAlert(translateFirebaseError(err.code || err.message), "danger");
            if (submitBtn) submitBtn.disabled = false;
            if (submitBtnText) {
                submitBtnText.textContent = isRegistering ? "Crear Cuenta Nueva" : "Acceder al Portal de Salud";
            }
        }
    });
}

// 6. Botón de Google (Gmail) Blindado con Selección de Cuenta Forzada
function setupSocialSSO() {
    const googleButtons = Array.from(document.querySelectorAll("button")).filter(
        btn => btn.id === "btn-google-login" || btn.textContent.toLowerCase().includes("google")
    );

    window.loginWithGoogle = async (btnElement) => {
        hideAlert();
        const targetBtn = btnElement || document.getElementById("btn-google-login");
        const originalHTML = targetBtn ? targetBtn.innerHTML : "Google";

        if (targetBtn) {
            targetBtn.disabled = true;
            targetBtn.innerHTML = `<span class="font-mono text-xs text-primary">Abriendo selector de Gmail...</span>`;
        }

        try {
            const provider = new GoogleAuthProvider();
            // Forzar que Google siempre muestre el selector de cuentas de Gmail
            provider.setCustomParameters({ prompt: "select_account" });

            const cred = await signInWithPopup(auth, provider);
            await ensureUserProfile(cred.user);
            window.location.href = "dashboard.html";
        } catch (err) {
            console.error("Detalle Error Google Auth:", err);
            showAlert(translateFirebaseError(err.code || err.message), "danger");
            if (targetBtn) {
                targetBtn.innerHTML = originalHTML;
                targetBtn.disabled = false;
            }
        }
    };

    googleButtons.forEach(btn => {
        btn.type = "button"; // Evita que recargue el formulario por error
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            window.loginWithGoogle(btn);
        });
    });

    const microsoftBtn = document.getElementById("btn-microsoft-login");
    if (microsoftBtn) {
        microsoftBtn.type = "button";
        microsoftBtn.addEventListener("click", async () => {
            try {
                const provider = new OAuthProvider("microsoft.com");
                const cred = await signInWithPopup(auth, provider);
                await ensureUserProfile(cred.user);
                window.location.href = "dashboard.html";
            } catch (err) {
                showAlert("Para acceso inmediato utiliza el botón de Google (Gmail) o tu correo y contraseña.", "warning");
            }
        });
    }

    const appleBtn = document.getElementById("btn-apple-login");
    if (appleBtn) {
        appleBtn.type = "button";
        appleBtn.addEventListener("click", () => window.loginWithGoogle(googleButtons[0]));
    }
}

// 7. Conmutador Mensual / Anual
function setupBillingToggle() {
    const btnMonthly = document.getElementById("bill-monthly");
    const btnAnnual = document.getElementById("bill-annual");
    const priceMain = document.getElementById("pro-price-main");
    const pricePeriod = document.getElementById("pro-price-period");
    const priceSub = document.getElementById("pro-price-sub");

    if (!btnMonthly || !btnAnnual) return;

    btnMonthly.addEventListener("click", () => {
        selectedBillingPeriod = "monthly";
        btnMonthly.className = "px-3.5 py-1.5 rounded-md text-xs font-bold bg-primary text-surface transition-all";
        btnAnnual.className = "px-3.5 py-1.5 rounded-md text-xs font-bold text-gray-400 hover:text-white transition-all";
        if (priceMain) priceMain.textContent = "$17.99";
        if (pricePeriod) pricePeriod.textContent = "USD / mes";
        if (priceSub) priceSub.textContent = "Ahorra 35% cambiando a plan anual ($139.99/año)";
    });

    btnAnnual.addEventListener("click", () => {
        selectedBillingPeriod = "annual";
        btnAnnual.className = "px-3.5 py-1.5 rounded-md text-xs font-bold bg-primary text-surface transition-all";
        btnMonthly.className = "px-3.5 py-1.5 rounded-md text-xs font-bold text-gray-400 hover:text-white transition-all";
        if (priceMain) priceMain.textContent = "$139.99";
        if (pricePeriod) pricePeriod.textContent = "USD / año";
        if (priceSub) priceSub.textContent = "Equivale a $11.66 USD / mes (Ahorras 35%)";
    });
}

// 8. Botones de Planes
function setupPlanButtons() {
    const planButtons = document.querySelectorAll(".btn-select-plan");
    const emailInput = document.getElementById("email");
    const tabRegister = document.getElementById("tab-register");

    planButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const plan = btn.dataset.plan || "Basico";
            sessionStorage.setItem("makai_selected_plan", plan);
            sessionStorage.setItem("makai_selected_billing", selectedBillingPeriod);

            if (plan === "PRO" || plan === "VIP") {
                showAlert(`Plan ${plan} seleccionado. Inicia sesión con Gmail o crea tu cuenta para continuar.`, "info");
            } else {
                showAlert("Plan Básico ($0) seleccionado. Ingresa con Gmail o crea tu cuenta gratuita.", "success");
            }

            tabRegister?.click();
            emailInput?.focus();
        });
    });
}

// Guardado seguro en Firestore con try/catch para no bloquear nunca la redirección
async function ensureUserProfile(user, extra = {}) {
    try {
        const isAdmin = isMasterAdmin(user.email);
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                nombre: extra.nombre || user.displayName || user.email.split("@")[0],
                universidad: extra.universidad || "No especificada",
                rol: isAdmin ? "admin" : "estudiante",
                subscriptionLevel: isAdmin ? "PRO" : "Básico",
                correoConfirmadoMakai: true,
                casesUsedThisMonth: 0,
                totalExamsCompleted: 0,
                globalAverage: 0,
                createdAt: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("Firestore pendiente de reglas, continuando inicio de sesión:", e);
    }
}

function showAlert(message, type = "danger") {
    const alertBox = document.getElementById("auth-alert");
    if (!alertBox) {
        alert(message);
        return;
    }

    const styles = {
        danger: "bg-danger/10 border-danger/40 text-danger",
        warning: "bg-warning/10 border-warning/40 text-warning",
        success: "bg-secondary/10 border-secondary/40 text-secondary",
        info: "bg-primary/10 border-primary/40 text-primary"
    };

    alertBox.className = `mb-5 p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${styles[type] || styles.danger}`;
    alertBox.innerHTML = `<span class="material-symbols-outlined text-base">info</span><span>${message}</span>`;
    alertBox.classList.remove("hidden");
}

function hideAlert() {
    document.getElementById("auth-alert")?.classList.add("hidden");
}

function translateFirebaseError(code = "") {
    if (code.includes("auth/operation-not-allowed")) {
        return "Falta activar 'Google' o 'Correo electrónico/contraseña' en Firebase Console -> Authentication -> Sign-in method.";
    }
    if (code.includes("auth/unauthorized-domain")) {
        return "Falta autorizar 'anthonnyvelastegui-boop.github.io' en Firebase Console -> Authentication -> Settings -> Authorized domains.";
    }
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
        return "Aún no has creado tu contraseña con este correo o es incorrecta. Haz clic arriba en la pestaña 'Crear Cuenta de Salud' o entra con el botón de Google.";
    }
    if (code.includes("auth/email-already-in-use")) {
        return "Este correo ya está registrado. Cambia a la pestaña 'Iniciar Sesión'.";
    }
    if (code.includes("auth/popup-closed-by-user")) {
        return "Cerraste la ventana de selección de cuenta de Gmail antes de terminar.";
    }
    return "Aviso de Firebase: " + code;
}
