// ============================================================================
// ARCHIVO: js/2-core/firebase.service.js
// DESCRIPCIÓN: Conexión centralizada con Firebase v13.0.0 (Auth, Firestore y Analytics)
// PROYECTO: MakaiAcademy (makai-academy-f8039)
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Credenciales oficiales del servidor Firebase (makai-academy-f8039)
const firebaseConfig = {
    apiKey: "AIzaSyAfn6z_KCo3JplEtJ-U21LOCCzgo8QNzQc",
    authDomain: "makai-academy-f8039.firebaseapp.com",
    projectId: "makai-academy-f8039",
    storageBucket: "makai-academy-f8039.firebasestorage.app",
    messagingSenderId: "216653906049",
    appId: "1:216653906049:web:075f211989afe40e364d80",
    measurementId: "G-VG9DDP6JQV"
};

// Inicialización de la aplicación y servicios principales
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Firebase Analytics desactivado en entorno local o por bloqueador:", e);
}

const auth = getAuth(app);
auth.languageCode = "es"; // Correos de verificación y recuperación en español

const db = getFirestore(app);

// Proveedores OAuth preconfigurados
const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");

// Nombres estandarizados de colecciones en Firestore
export const COLLECTIONS = {
    USERS: "usuarios",
    PAYMENTS: "solicitudes_pago",
    QUESTIONS: "preguntas_caces",
    SINAPTICO: "tarjetas_sinaptico",
    MATERIALS: "materiales_estudio"
};

export {
    app,
    analytics,
    auth,
    db,
    googleProvider,
    microsoftProvider,
    // Funciones de Authentication
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    // Funciones de Cloud Firestore
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where
};
