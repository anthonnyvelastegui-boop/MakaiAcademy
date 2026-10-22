// ============================================================================
// ARCHIVO: js/2-core/firebase.service.js
// DESCRIPCIÓN: Conexión centralizada con Firebase v13.0.0 (Auth, Firestore y Analytics)
// PROYECTO: MakaiAcademy (makai-academy-f8039)
// ESTRUCTURA OFICIAL: Nivel 2 - El Director de Orquesta (Núcleo)
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

// 2. CUENTAS MAESTRAS DE ADMINISTRACIÓN AUTORIZADAS
export const MASTER_ADMIN_EMAILS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

/**
 * Verifica si un correo electrónico pertenece a una cuenta maestra de administración.
 * @param {string} email
 * @returns {boolean}
 */
export function isAdminAccount(email) {
    if (!email || typeof email !== "string") return false;
    return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// 3. DICCIONARIO ESTANDARIZADO DE COLECCIONES EN CLOUD FIRESTORE
export const COLLECTIONS = Object.freeze({
    USERS: "usuarios",
    PAYMENTS: "solicitudes_pago",
    QUESTIONS: "preguntas_caces",
    SINAPTICO: "tarjetas_sinaptico",
    MATERIALS: "materiales_estudio"
});

// 4. INICIALIZACIÓN DE INSTANCIAS PRINCIPALES (SINGLETON)
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
    if (typeof window !== "undefined") {
        analytics = getAnalytics(app);
    }
} catch (err) {
    console.warn("[Firebase Service] Analytics desactivado en entorno local o por bloqueador:", err.message);
}

const auth = getAuth(app);
auth.languageCode = "es"; // Correos de verificación y restablecimiento en español

const db = getFirestore(app);

// 5. PROVEEDORES DE AUTENTICACIÓN EXTERNA (GOOGLE & MICROSOFT)
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: "select_account"
});

const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({
    prompt: "select_account"
});

// ============================================================================
// 6. FUNCIONES DE ALTO NIVEL PARA GESTIÓN DE EXPEDIENTES Y DATOS EN FIRESTORE
// ============================================================================

/**
 * Obtiene el documento de un usuario desde la colección `usuarios`.
 * @param {string} uid - UID de Firebase Authentication
 * @returns {Promise<Object|null>} Datos del usuario o null si no existe
 */
export async function getUserDocument(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, COLLECTIONS.USERS, uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { id: userSnap.id, ...userSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("[Firebase Service] Error al leer expediente de usuario:", error);
        throw error;
    }
}

/**
 * Crea o actualiza el expediente de un usuario en la colección `usuarios`.
 * @param {string} uid - UID del usuario
 * @param {Object} profileData - Datos a guardar
 * @param {boolean} merge - Si es true, combina los campos sin sobrescribir todo el documento
 * @returns {Promise<Object>} Expediente guardado
 */
export async function upsertUserDocument(uid, profileData = {}, merge = true) {
    if (!uid) throw new Error("Se requiere un UID válido para guardar el expediente.");
    try {
        const userRef = doc(db, COLLECTIONS.USERS, uid);
        const isMaster = isAdminAccount(profileData.email || auth.currentUser?.email);

        const payload = {
            ...profileData,
            ...(isMaster ? { rol: "admin", subscriptionLevel: "PRO", correoConfirmadoMakai: true } : {}),
            updatedAt: new Date().toISOString()
        };

        await setDoc(userRef, payload, { merge });
        return { id: uid, ...payload };
    } catch (error) {
        console.error("[Firebase Service] Error al guardar expediente de usuario:", error);
        throw error;
    }
}

/**
 * Descarga todos los documentos de una colección de Cloud Firestore.
 * @param {string} collectionName - Nombre de la colección (usar constante COLLECTIONS)
 * @returns {Promise<Array<Object>>} Lista de documentos con su respectivo `id`
 */
export async function fetchCollectionData(collectionName) {
    if (!collectionName) return [];
    try {
        const snap = await getDocs(collection(db, collectionName));
        const items = [];
        snap.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...docSnap.data() });
        });
        return items;
    } catch (error) {
        console.error(`[Firebase Service] Error al consultar la colección ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Consulta documentos de una colección filtrados por un campo específico.
 * @param {string} collectionName - Nombre de la colección
 * @param {string} field - Campo a evaluar (ej. "carrera", "estado", "uid")
 * @param {string} operator - Operador de comparación (ej. "==", "!=", "in")
 * @param {*} value - Valor buscado
 * @returns {Promise<Array<Object>>}
 */
export async function queryCollectionByField(collectionName, field, operator, value) {
    if (!collectionName || !field) return [];
    try {
        const q = query(collection(db, collectionName), where(field, operator, value));
        const snap = await getDocs(q);
        const results = [];
        snap.forEach((docSnap) => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error(`[Firebase Service] Error en consulta filtrada de ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Crea un documento nuevo o actualiza uno existente dentro de una colección.
 * @param {string} collectionName - Nombre de la colección
 * @param {Object} data - Objeto con los datos a almacenar
 * @param {string|null} customDocId - ID opcional si se desea actualizar o fijar el ID del documento
 * @returns {Promise<Object>} Documento con su ID asignado
 */
export async function saveDocumentData(collectionName, data, customDocId = null) {
    if (!collectionName || !data) {
        throw new Error("Se requiere el nombre de la colección y los datos del documento.");
    }
    try {
        const nowIso = new Date().toISOString();
        const payload = {
            ...data,
            updatedAt: nowIso,
            ...(data.createdAt ? {} : { createdAt: nowIso })
        };

        if (customDocId) {
            const docRef = doc(db, collectionName, customDocId);
            await setDoc(docRef, payload, { merge: true });
            return { id: customDocId, ...payload };
        } else {
            const docRef = await addDoc(collection(db, collectionName), payload);
            return { id: docRef.id, ...payload };
        }
    } catch (error) {
        console.error(`[Firebase Service] Error al guardar documento en ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Elimina un documento específico de cualquier colección en Firestore.
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento a eliminar
 * @returns {Promise<boolean>}
 */
export async function deleteDocumentById(collectionName, docId) {
    if (!collectionName || !docId) {
        throw new Error("Se requiere la colección y el ID del documento para eliminarlo.");
    }
    try {
        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error(`[Firebase Service] Error al eliminar documento ${docId} de ${collectionName}:`, error);
        throw error;
    }
}

// ============================================================================
// 7. EXPORTACIÓN UNIFICADA DE INSTANCIAS Y PRIMITIVAS DEL SDK v13.0.0
// ============================================================================
export {
    app,
    analytics,
    auth,
    db,
    googleProvider,
    microsoftProvider,
    // Funciones nativas de Firebase Authentication
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    // Funciones nativas de Cloud Firestore
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
};
