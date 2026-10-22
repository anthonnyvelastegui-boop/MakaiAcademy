/**
 * ============================================================================
 * MAKAI ACADEMY (PROYECTO ALICIZATION) — ESTRUCTURA OFICIAL
 * Archivo: js/3-security/auth.verifier.js
 * Dominio: 3-security (Guardia de Seguridad, Accesos y Verificación de Correo)
 * Proyecto Firebase: makai-academy-f8039 (SDK Modular v13.0.0)
 * ============================================================================
 */

import {
    auth,
    db,
    COLLECTIONS,
    sendEmailVerification,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "../2-core/firebase.service.js";

import {
    appState,
    isMasterAdmin,
    setSessionState
} from "../2-core/state.store.js";

// ============================================================================
// 1. ESTADO INTERNO DEL VERIFICADOR Y CONTROL DE TEMPORIZADORES
// ============================================================================
let verifierInitialized = false;
let verificationPollInterval = null;
let resendCooldownInterval = null;
let resendSecondsRemaining = 0;

const PLAN_LABELS = Object.freeze({
    basico: "PLAN BÁSICO ($0.00)",
    pro_mensual: "MAKAI PRO CACES MENSUAL ($17.99)",
    pro_anual: "MAKAI PRO CACES ANUAL ($139.99)",
    vip: "MENTORÍA ÉLITE VIP ($49.99)"
});

// ============================================================================
// 2. COMPROBACIÓN DE ESTADO DE VERIFICACIÓN (EMAIL Y GOOGLE OAUTH)
// ============================================================================

/**
 * Comprueba si el usuario autenticado ya verificó su correo electrónico.
 * Aplica bypass inmediato para las cuentas maestras:
 * - anthonnyvelastegui@gmail.com
 * - aavemakaihc@gmail.com
 *
 * @param {object} user Objeto User de Firebase Authentication
 * @returns {Promise<boolean>} true si el usuario está verificado o es Admin Maestro
 */
export async function checkIsVerifiedUser(user) {
    if (!user) return false;

    // 1. Bypass inmediato para Administradores Maestros
    if (isMasterAdmin(user.email)) {
        return true;
    }

    const usersCollection = COLLECTIONS?.USERS || "usuarios";
    const localVerifyKey = `makai_gmail_verified_${user.uid}`;
    const isGoogleProvider = Array.isArray(user.providerData) &&
        user.providerData.some((p) => p.providerId === "google.com");

    // 2. Validación específica para cuentas vinculadas con Google (Gmail)
    if (isGoogleProvider) {
        if (localStorage.getItem(localVerifyKey) === "true") {
            return true;
        }

        try {
            const userRef = doc(db, usersCollection, user.uid);
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data()?.correoConfirmadoMakai === true) {
                localStorage.setItem(localVerifyKey, "true");
                return true;
            }
        } catch (err) {
            console.warn("[MakaiVerifier] Aviso consultando estado Gmail en Firestore:", err);
        }

        return false;
    }

    // 3. Validación estándar para cuentas de Correo y Contraseña
    if (user.emailVerified === true) {
        localStorage.setItem(localVerifyKey, "true");
        try {
            const userRef = doc(db, usersCollection, user.uid);
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data()?.correoConfirmadoMakai !== true) {
                await updateDoc(userRef, {
                    correoConfirmadoMakai: true,
                    verifiedAt: new Date().toISOString()
                });
            }
        } catch (err) {
            console.warn("[MakaiVerifier] No se pudo sincronizar correoConfirmadoMakai:", err);
        }
        return true;
    }

    // 4. Respaldo en Firestore por si fue aprobado manualmente por un Administrador Maestro
    try {
        const userRef = doc(db, usersCollection, user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data()?.correoConfirmadoMakai === true) {
            localStorage.setItem(localVerifyKey, "true");
            return true;
        }
    } catch (err) {
        console.warn("[MakaiVerifier] Aviso leyendo respaldo de verificación en Firestore:", err);
    }

    return false;
}

// Alias compatible con js/2-core/app.orchestrator.js
export const verifyUserAccessStatus = checkIsVerifiedUser;

// ============================================================================
// 3. PUNTO DE ENTRADA DEL MÓDULO (initAuthVerifier)
// ============================================================================

/**
 * Inicializa el controlador de verificación de correo en registro.html.
 * Detecta si la URL incluye ?verify=pending o si el usuario actual requiere
 * confirmar su cuenta antes de pasar a dashboard.html.
 *
 * @param {object} [passedUser] Usuario opcional inyectado por app.orchestrator.js
 */
export async function initAuthVerifier(passedUser = null) {
    const verCard = document.getElementById("verification-card");
    if (!verCard) return;

    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get("verify");
    const chosenPlan = params.get("plan") || sessionStorage.getItem("makai_selected_plan") || "basico";
    const chosenPayment = params.get("pago") || sessionStorage.getItem("makai_selected_payment") || "ninguno";

    const activeUser = passedUser || auth.currentUser || appState.currentUser;

    if (activeUser) {
        if (isMasterAdmin(activeUser.email)) {
            stopVerificationPolling();
            window.location.href = "dashboard.html";
            return;
        }

        const alreadyVerified = await checkIsVerifiedUser(activeUser);
        if (alreadyVerified) {
            stopVerificationPolling();
            window.location.href = "dashboard.html";
            return;
        }

        if (verifyParam === "pending" || !verCard.classList.contains("hidden")) {
            showVerificationPendingScreen(activeUser, chosenPlan, chosenPayment);
        }
    } else if (verifyParam === "pending") {
        // Si la URL pide verificación pero Firebase Auth aún está restaurando la sesión
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (!user) {
                window.location.href = "index.html";
                return;
            }
            if (isMasterAdmin(user.email)) {
                window.location.href = "dashboard.html";
                return;
            }
            const verified = await checkIsVerifiedUser(user);
            if (verified) {
                window.location.href = "dashboard.html";
            } else {
                showVerificationPendingScreen(user, chosenPlan, chosenPayment);
            }
        });
    }

    verifierInitialized = true;
}

// Alias secundario para cargadores dinámicos
export const initVerifier = initAuthVerifier;

// ============================================================================
// 4. INTERFAZ DE VERIFICACIÓN PENDIENTE EN REGISTRO.HTML
// ============================================================================

/**
 * Muestra la tarjeta #verification-card, oculta #registration-card,
 * rellena los metadatos del estudiante y activa los botones de comprobación
 * y reenvío de enlace.
 *
 * @param {object} user Objeto User de Firebase Auth
 * @param {string} [chosenPlan="basico"] Plan solicitado (basico, pro_mensual, pro_anual, vip)
 * @param {string} [chosenPayment="ninguno"] Método de pago seleccionado (ninguno, qr, transferencia, tarjeta)
 */
export function showVerificationPendingScreen(user, chosenPlan = "basico", chosenPayment = "ninguno") {
    const targetUser = user || auth.currentUser || appState.currentUser;
    if (!targetUser) return;

    // Si es cuenta maestra, redirigir directamente al Dashboard
    if (isMasterAdmin(targetUser.email)) {
        stopVerificationPolling();
        window.location.href = "dashboard.html";
        return;
    }

    const regCard = document.getElementById("registration-card");
    const verCard = document.getElementById("verification-card");
    const emailDisplay = document.getElementById("verify-email-display");
    const statusMsg = document.getElementById("verify-status-msg");
    const payBox = document.getElementById("payment-instructions-box");
    const payPlanName = document.getElementById("pay-plan-name");

    // Conmutar visibilidad de tarjetas principales
    regCard?.classList.add("hidden");
    verCard?.classList.remove("hidden");

    if (emailDisplay) {
        emailDisplay.textContent = targetUser.email || "tu correo registrado";
    }

    // Recuperar plan del expediente o de los parámetros si aplica
    const normalizedPlan = (chosenPlan || appState.currentUserData?.planSolicitado || "basico").toLowerCase();
    const normalizedPayment = (chosenPayment || appState.currentUserData?.metodoPagoPreferido || "ninguno").toLowerCase();

    if (normalizedPlan !== "basico" && payBox) {
        payBox.classList.remove("hidden");
        if (payPlanName) {
            payPlanName.textContent = PLAN_LABELS[normalizedPlan] || normalizedPlan.toUpperCase();
        }
    } else if (payBox) {
        payBox.classList.add("hidden");
    }

    // Mostrar aviso contextual si el ingreso provino de Google OAuth
    const params = new URLSearchParams(window.location.search);
    const isGoogleParam = params.get("provider") === "google" ||
        targetUser.providerData?.some((p) => p.providerId === "google.com");

    if (isGoogleParam && statusMsg && statusMsg.classList.contains("hidden")) {
        renderVerifierStatusMessage(
            "info",
            `Cuenta de Google detectada (${targetUser.email}). Confirma tu acceso pulsando el botón inferior o abriendo el enlace de bienvenida enviado a tu Gmail.`
        );
    }

    // Enlazar botón principal: "Ya abrí el enlace • Acceder a los Simuladores"
    const btnCheck = document.getElementById("btn-check-verified");
    if (btnCheck && !btnCheck.dataset.bound) {
        btnCheck.dataset.bound = "1";
        btnCheck.addEventListener("click", () => handleCheckVerificationClick(targetUser));
    }

    // Enlazar botón secundario: "Reenviar enlace de verificación"
    const btnResend = document.getElementById("btn-resend-verification");
    if (btnResend && !btnResend.dataset.bound) {
        btnResend.dataset.bound = "1";
        btnResend.addEventListener("click", () => handleResendVerificationClick(targetUser));
    }

    // Inyectar botón auxiliar para cambiar de correo / cerrar sesión si el alumno se equivocó al escribirlo
    injectSwitchAccountAction(verCard);

    // Iniciar monitoreo automático silencioso
    startVerificationPolling(targetUser);
}

// ============================================================================
// 5. MANEJADORES DE BOTONES (COMPROBAR ACCESO Y REENVIAR ENLACE)
// ============================================================================

/**
 * Comprueba manualmente si el estudiante ya abrió el enlace de verificación,
 * actualiza `correoConfirmadoMakai: true` en Firestore y redirige a dashboard.html.
 *
 * @param {object} [user] Usuario activo de Firebase
 */
export async function handleCheckVerificationClick(user = null) {
    const btnCheck = document.getElementById("btn-check-verified");
    const activeUser = auth.currentUser || user || appState.currentUser;

    if (!activeUser) {
        renderVerifierStatusMessage(
            "danger",
            "Tu sesión ha expirado. Por favor vuelve a iniciar sesión desde el portal principal."
        );
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1800);
        return;
    }

    if (btnCheck) {
        btnCheck.disabled = true;
        btnCheck.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Comprobando verificación en Firebase...</span>';
    }

    try {
        if (typeof activeUser.reload === "function") {
            await activeUser.reload();
        }

        const refreshedUser = auth.currentUser || activeUser;
        const isGoogle = Array.isArray(refreshedUser.providerData) &&
            refreshedUser.providerData.some((p) => p.providerId === "google.com");

        const isVerified = isGoogle ||
            refreshedUser.emailVerified === true ||
            isMasterAdmin(refreshedUser.email);

        if (isVerified) {
            await markUserAsVerifiedInFirestore(refreshedUser);
            stopVerificationPolling();

            renderVerifierStatusMessage(
                "success",
                `✓ Correo confirmado exitosamente (${refreshedUser.email}). Redirigiendo a los Simuladores...`
            );

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 600);
            return;
        }

        // Revisar si un Administrador Maestro ya aprobó la cuenta en Firestore
        const firestoreVerified = await checkIsVerifiedUser(refreshedUser);
        if (firestoreVerified) {
            stopVerificationPolling();
            window.location.href = "dashboard.html";
            return;
        }

        renderVerifierStatusMessage(
            "warning",
            `Aún no detectamos la confirmación. Abre el enlace enviado a tu correo (${refreshedUser.email}) —revisa también Spam o Promociones— y vuelve a pulsar este botón.`
        );
    } catch (err) {
        console.error("[MakaiVerifier] Error al comprobar verificación:", err);
        renderVerifierStatusMessage(
            "danger",
            `No se pudo verificar el estado en este momento (${err.code || err.message}). Intenta nuevamente en unos segundos.`
        );
    } finally {
        if (btnCheck) {
            btnCheck.disabled = false;
            btnCheck.innerHTML = '<span class="material-symbols-outlined text-base">verified</span><span>Ya abrí el enlace • Acceder a los Simuladores</span>';
        }
    }
}

/**
 * Reenvía el correo de verificación de Firebase Authentication con control
 * de enfriamiento (60 segundos) para evitar el bloqueo auth/too-many-requests.
 *
 * @param {object} [user] Usuario activo de Firebase
 */
export async function handleResendVerificationClick(user = null) {
    const btnResend = document.getElementById("btn-resend-verification");
    const activeUser = auth.currentUser || user || appState.currentUser;

    if (!activeUser) {
        renderVerifierStatusMessage("danger", "No hay una sesión activa para reenviar el correo.");
        return;
    }

    if (resendSecondsRemaining > 0) {
        renderVerifierStatusMessage(
            "warning",
            `Por seguridad anti-spam, espera ${resendSecondsRemaining} segundos antes de solicitar otro enlace.`
        );
        return;
    }

    try {
        if (btnResend) {
            btnResend.disabled = true;
            btnResend.textContent = "Enviando nuevo enlace...";
        }

        await sendEmailVerification(activeUser);

        renderVerifierStatusMessage(
            "success",
            `✓ Nuevo enlace de verificación enviado a ${activeUser.email}. Revisa tu Bandeja de Entrada y carpeta de Spam.`
        );

        startResendCooldown(60);
    } catch (err) {
        console.warn("[MakaiVerifier] Aviso al reenviar verificación:", err);

        if (err.code === "auth/too-many-requests") {
            renderVerifierStatusMessage(
                "warning",
                "Firebase ya envió un enlace recientemente a tu correo. Espera un minuto antes de volver a solicitarlo."
            );
            startResendCooldown(45);
        } else {
            renderVerifierStatusMessage(
                "danger",
                `No se pudo reenviar el correo (${err.code || err.message}).`
            );
            if (btnResend) {
                btnResend.disabled = false;
                btnResend.textContent = "Reenviar enlace de verificación";
            }
        }
    }
}

/**
 * Dispara el envío inicial del correo de verificación justo después de crear
 * la cuenta en `auth.register.js` y despliega la pantalla de espera.
 *
 * @param {object} user Usuario recién creado en Firebase Auth
 * @param {string} [chosenPlan="basico"] Plan elegido
 * @param {string} [chosenPayment="ninguno"] Método de pago elegido
 */
export async function triggerInitialVerificationEmail(user, chosenPlan = "basico", chosenPayment = "ninguno") {
    if (!user) return;

    if (isMasterAdmin(user.email)) {
        await markUserAsVerifiedInFirestore(user);
        window.location.href = "dashboard.html";
        return;
    }

    try {
        await sendEmailVerification(user);
    } catch (err) {
        console.warn("[MakaiVerifier] Aviso enviando correo inicial de verificación:", err);
    }

    showVerificationPendingScreen(user, chosenPlan, chosenPayment);
}

// ============================================================================
// 6. SINCRONIZACIÓN CON FIRESTORE Y MONITOREO EN SEGUNDO PLANO
// ============================================================================

/**
 * Registra en Firestore (`usuarios`) y en `localStorage` que el correo del
 * estudiante ha sido confirmado en MakaiAcademy.
 *
 * @param {object} user Objeto User de Firebase Auth
 */
export async function markUserAsVerifiedInFirestore(user) {
    if (!user) return;

    const usersCollection = COLLECTIONS?.USERS || "usuarios";
    const localVerifyKey = `makai_gmail_verified_${user.uid}`;
    localStorage.setItem(localVerifyKey, "true");

    try {
        const userRef = doc(db, usersCollection, user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            await updateDoc(userRef, {
                correoConfirmadoMakai: true,
                verifiedAt: new Date().toISOString()
            });
            const updatedData = { ...snap.data(), correoConfirmadoMakai: true };
            setSessionState(user, updatedData);
        } else {
            const isUserAdmin = isMasterAdmin(user.email);
            const initialDoc = {
                uid: user.uid,
                email: user.email,
                nombre: user.displayName || user.email.split("@")[0],
                rol: isUserAdmin ? "admin" : "estudiante",
                subscriptionLevel: isUserAdmin ? "PRO" : "Básico",
                correoConfirmadoMakai: true,
                casesUsedThisMonth: 0,
                totalExamsCompleted: 0,
                globalAverage: 0,
                createdAt: new Date().toISOString(),
                verifiedAt: new Date().toISOString()
            };
            await setDoc(userRef, initialDoc, { merge: true });
            setSessionState(user, initialDoc);
        }
    } catch (err) {
        console.warn("[MakaiVerifier] Aviso actualizando correoConfirmadoMakai en Firestore:", err);
    }
}

/**
 * Inicia un sondeo silencioso cada 6 segundos para detectar automáticamente
 * si el estudiante ya abrió el enlace de verificación desde otro dispositivo
 * o pestaña, redirigiéndolo sin que tenga que pulsar el botón manualmente.
 *
 * @param {object} user Objeto User de Firebase Auth
 */
export function startVerificationPolling(user) {
    stopVerificationPolling();

    verificationPollInterval = setInterval(async () => {
        const currentUser = auth.currentUser || user;
        if (!currentUser) {
            stopVerificationPolling();
            return;
        }

        try {
            if (typeof currentUser.reload === "function") {
                await currentUser.reload();
            }

            const refreshed = auth.currentUser || currentUser;
            if (refreshed.emailVerified === true || isMasterAdmin(refreshed.email)) {
                stopVerificationPolling();
                await markUserAsVerifiedInFirestore(refreshed);

                renderVerifierStatusMessage(
                    "success",
                    "✓ ¡Verificación detectada en tiempo real! Ingresando al portal..."
                );

                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 700);
            }
        } catch (err) {
            // Silenciar errores transitorios de red durante el sondeo en segundo plano
        }
    }, 6000);
}

/**
 * Detiene el temporizador de sondeo automático de verificación.
 */
export function stopVerificationPolling() {
    if (verificationPollInterval) {
        clearInterval(verificationPollInterval);
        verificationPollInterval = null;
    }
}

// ============================================================================
// 7. UTILIDADES VISUALES Y AUXILIARES DE INTERFAZ
// ============================================================================

/**
 * Renderiza mensajes de estado formateados dentro de `#verify-status-msg`.
 *
 * @param {"success"|"warning"|"danger"|"info"} type Nivel de alerta visual
 * @param {string} message Texto descriptivo para el estudiante
 */
function renderVerifierStatusMessage(type, message) {
    const statusMsg = document.getElementById("verify-status-msg");
    if (!statusMsg) return;

    const palette = {
        success: "mt-4 p-3 rounded-xl text-xs font-mono bg-secondary/15 border border-secondary text-secondary",
        warning: "mt-4 p-3 rounded-xl text-xs font-mono bg-warning/15 border border-warning text-warning",
        danger: "mt-4 p-3 rounded-xl text-xs font-mono bg-danger/15 border border-danger text-danger",
        info: "mt-4 p-3 rounded-xl text-xs font-mono bg-primary/15 border border-primary text-primary"
    };

    statusMsg.className = palette[type] || palette.info;
    statusMsg.textContent = message;
    statusMsg.classList.remove("hidden");
}

/**
 * Inicia una cuenta regresiva visual en el botón `#btn-resend-verification`.
 *
 * @param {number} seconds Segundos de espera
 */
function startResendCooldown(seconds = 60) {
    const btnResend = document.getElementById("btn-resend-verification");
    if (resendCooldownInterval) clearInterval(resendCooldownInterval);

    resendSecondsRemaining = seconds;

    const updateBtnLabel = () => {
        if (!btnResend) return;
        if (resendSecondsRemaining > 0) {
            btnResend.disabled = true;
            btnResend.textContent = `Reenviar enlace disponible en ${resendSecondsRemaining}s`;
        } else {
            btnResend.disabled = false;
            btnResend.textContent = "Reenviar enlace de verificación";
        }
    };

    updateBtnLabel();

    resendCooldownInterval = setInterval(() => {
        resendSecondsRemaining -= 1;
        updateBtnLabel();
        if (resendSecondsRemaining <= 0) {
            clearInterval(resendCooldownInterval);
            resendCooldownInterval = null;
        }
    }, 1000);
}

/**
 * Inyecta un enlace discreto al pie de `#verification-card` para permitir que
 * el usuario cierre la sesión pendiente y corrija su correo si lo escribió mal.
 *
 * @param {HTMLElement} verCard Contenedor `#verification-card`
 */
function injectSwitchAccountAction(verCard) {
    if (!verCard || document.getElementById("btn-verifier-switch-account")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "mt-6 pt-4 border-t border-surface-high text-center";
    wrapper.innerHTML = `
        <button type="button" id="btn-verifier-switch-account" class="text-xs font-mono text-gray-400 hover:text-primary transition-colors">
            ¿Escribiste mal tu correo? Cerrar sesión y usar otra cuenta
        </button>
    `;

    verCard.appendChild(wrapper);

    document.getElementById("btn-verifier-switch-account")?.addEventListener("click", async () => {
        stopVerificationPolling();
        try {
            await signOut(auth);
        } catch (err) {
            console.warn("[MakaiVerifier] Error al cerrar sesión pendiente:", err);
        }
        window.location.href = "registro.html";
    });
}

// Exposición global controlada para interoperabilidad con otros módulos
if (typeof window !== "undefined") {
    window.MakaiAuthVerifier = {
        initAuthVerifier,
        checkIsVerifiedUser,
        verifyUserAccessStatus,
        showVerificationPendingScreen,
        handleCheckVerificationClick,
        handleResendVerificationClick,
        triggerInitialVerificationEmail,
        markUserAsVerifiedInFirestore,
        stopVerificationPolling
    };
}
