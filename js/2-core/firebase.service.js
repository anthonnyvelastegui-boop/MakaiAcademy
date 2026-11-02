// ============================================================================
// ARCHIVO: js/2-core/firebase.service.js
// DESCRIPCIÓN: Conexión centralizada con Firebase v13.0.0 y Base de Datos
// FILOSOFÍA: "Rieles de Acero" - Conexión única, colecciones inmutables.
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

// 1. CREDENCIALES OFICIALES DEL SERVIDOR FIREBASE (makai-academy-f8039)
export const firebaseConfig = {
    apiKey: "AIzaSyAfn6z_KCo3JplEtJ-U21LOCCzgo8QNzQc",
    authDomain: "makai-academy-f8039.firebaseapp.com",
    projectId: "makai-academy-f8039",
    storageBucket: "makai-academy-f8039.firebasestorage.app",
    messagingSenderId: "216653906049",
    appId: "1:216653906049:web:075f211989afe40e364d80",
    measurementId: "G-VG9DDP6JQV"
};

// 2. INICIALIZACIÓN DE INSTANCIAS PRINCIPALES (SINGLETON)
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
    if (typeof window !== "undefined") {
        analytics = getAnalytics(app);
    }
} catch (err) {
    console.warn("[Firebase] Analytics bloqueado por el navegador, operando en modo silencioso.");
}

const auth = getAuth(app);
auth.languageCode = "es"; 

const db = getFirestore(app);

// 3. DICCIONARIO ESTANDARIZADO DE COLECCIONES (Incluye Motor Dinámico de Precios)
export const COLLECTIONS = Object.freeze({
    USERS: "usuarios",
    PAYMENTS: "solicitudes_pago",
    QUESTIONS: "preguntas_caces",
    SINAPTICO: "tarjetas_sinaptico",
    MATERIALS: "materiales_estudio",
    SUBSCRIPTIONS: "planes_suscripcion", // Nueva colección para precios sin tocar HTML
    TUTORS: "perfiles_docentes"          // Nueva colección para Marketplace 1a1
});

// 4. PROVEEDORES OAUTH
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// 5. FUNCIONES CRUD DE ALTO NIVEL Y BLINDADAS
export async function fetchCollectionData(collectionName) {
    if (!collectionName) return [];
    try {
        const snap = await getDocs(collection(db, collectionName));
        const items = [];
        snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        return items;
    } catch (error) {
        console.error(`[Firebase] Error al descargar ${collectionName}:`, error);
        return []; // Fallback seguro, no rompe la app
    }
}

export {
    app,
    analytics,
    auth,
    db,
    googleProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
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
