// ============================================================================
// ARCHIVO: src/services/firebase.ts
// DESCRIPCIÓN: Conexión centralizada con Firebase (makai-academy-f8039)
//              y Cuentas Maestras de Administración (El Olimpo).
// ============================================================================

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
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
} from "firebase/firestore";

// 1. CUENTAS MAESTRAS DE ADMINISTRACIÓN (EL OLIMPO)
export const MASTER_ADMINS = Object.freeze([
  "anthonnyvelastegui@gmail.com",
  "aavemakaihc@gmail.com"
]);

export function isMasterAdmin(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  return MASTER_ADMINS.includes(email.trim().toLowerCase());
}

// 2. CREDENCIALES OFICIALES DEL SERVIDOR FIREBASE (makai-academy-f8039)
export const firebaseConfig = {
  apiKey: "AIzaSyAfn6z_KCo3JplEtJ-U21LOCCzgo8QNzQc",
  authDomain: "makai-academy-f8039.firebaseapp.com",
  projectId: "makai-academy-f8039",
  storageBucket: "makai-academy-f8039.firebasestorage.app",
  messagingSenderId: "216653906049",
  appId: "1:216653906049:web:075f211989afe40e364d80",
  measurementId: "G-VG9DDP6JQV"
};

// 3. INICIALIZACIÓN DE INSTANCIAS PRINCIPALES (SINGLETON)
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
  if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
  }
} catch (err) {
  // Modo silencioso si el navegador bloquea Analytics
}

const auth = getAuth(app);
auth.languageCode = "es";

const db = getFirestore(app);

// 4. DICCIONARIO BASE DE COLECCIONES
export const COLLECTIONS = Object.freeze({
  USERS: "usuarios",
  PAYMENTS: "solicitudes_pago",
  QUESTIONS: "preguntas_caces",
  SINAPTICO: "tarjetas_sinaptico",
  MATERIALS: "materiales_estudio",
  SUBSCRIPTIONS: "planes_suscripcion",
  TUTORS: "perfiles_docentes",
  SETTINGS: "configuracion_sistema"
});

// 5. PROVEEDOR GOOGLE OAUTH
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

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
