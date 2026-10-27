// ============================================================================
// ARCHIVO: js/9-graduation/thesis.marketplace.js
// DESCRIPCIÓN: Marketplace de Tutores Verificados de Tesis 1 a 1 (Carpeta 9).
//              Gestiona el catálogo de especialistas para las 11 Carreras de
//              Ciencias de la Salud, el registro del pago único de $10 USD de
//              comisión para Makai Academy en la colección `solicitudes_tesis`
//              de Firestore y el desbloqueo del contacto directo por WhatsApp.
// PROYECTO: MakaiAcademy (Proyecto ALICIZATION)
// ============================================================================

import { appState, isMasterAdmin } from "../2-core/state.store.js";
import { db, auth } from "../2-core/firebase.service.js";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ============================================================================
// 1. CONSTANTES, RUTAS MULTIMEDIA Y CATÁLOGO DE LAS 11 CARRERAS DE SALUD
// ============================================================================

export const MARKETPLACE_ASSETS = Object.freeze({
    avatarsPath: "assets/9-multimedia-titulacion/avatares-tutores/",
    templatesPath: "assets/9-multimedia-titulacion/plantillas-tesis/"
});

const MASTER_ADMIN_EMAILS = [
    "anthonnyvelastegui@gmail.com",
    "aavemakaihc@gmail.com"
];

export const HEALTH_CAREERS_MARKET = Object.freeze([
    { id: "medicina", nombre: "Medicina Humana", icono: "medical_services" },
    { id: "enfermeria", nombre: "Enfermería", icono: "vaccines" },
    { id: "odontologia", nombre: "Odontología", icono: "dentistry" },
    { id: "obstetricia", nombre: "Obstetricia y Puericultura", icono: "pregnant_woman" },
    { id: "fisioterapia", nombre: "Fisioterapia y Terapia Física", icono: "accessibility_new" },
    { id: "laboratorio_clinico", nombre: "Laboratorio Clínico", icono: "biotech" },
    { id: "psicologia_clinica", nombre: "Psicología Clínica", icono: "psychology" },
    { id: "nutricion_dietetica", nombre: "Nutrición y Dietética", icono: "nutrition" },
    { id: "bioquimica_farmacia", nombre: "Bioquímica y Farmacia", icono: "medication" },
    { id: "imagenologia_radiologia", nombre: "Imagenología y Radiología", icono: "radiology" },
    { id: "atencion_prehospitalaria", nombre: "Atención Prehospitalaria y Emergencias", icono: "ambulance" }
]);

// Catálogo Semilla Completo de Tutores Verificados (Cobertura de las 11 Carreras)
export const VERIFIED_TUTORS_CATALOG_SEED = Object.freeze([
    {
        id: "tutor_med_01",
        nombre: "Dr. Carlos Andrés Mendoza, MSc. Epidemiología Clínica",
        carrera: "medicina",
        carrerasCompatibles: ["medicina", "obstetricia", "atencion_prehospitalaria"],
        especialidad: "Estudios Analíticos (Casos y Controles / Cohortes), Revisión Sistemática PRISMA 2020 y SPSS",
        lineasInvestigacion: ["Medicina Interna", "Cuidados Intensivos", "Gineco-Obstetricia", "Salud Pública"],
        universidadesExperiencia: ["UCE", "UG", "UCUENCA", "PUCE", "USFQ", "UTA", "ESPOCH", "UTPL"],
        tesisAprobadas: 48,
        calificacion: 4.95,
        tiempoRespuesta: "< 2 horas",
        tarifaReferencialTutor: "$180 - $320 USD (Negociable directo con el tutor)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593991234567",
        emailDirecto: "cmendoza.epidemiologia@makai.ec",
        avatarFile: "tutor_mendoza.png",
        insignia: "TUTOR ÉLITE VERIFICADO",
        modalidadAsesoria: "Zoom 1 a 1 + Corrección en Google Docs + Simulación de Defensa"
    },
    {
        id: "tutor_enf_02",
        nombre: "Lic. Valeria Paredes, Mgtr. Gestión del Cuidado y Salud Pública",
        carrera: "enfermeria",
        carrerasCompatibles: ["enfermeria", "obstetricia", "nutricion_dietetica", "atencion_prehospitalaria"],
        especialidad: "Proceso de Atención de Enfermería (NANDA-NIC-NOC), Estudios Cuasi-Experimentales, MAIS-FCI y SPSS",
        lineasInvestigacion: ["Cuidados Críticos", "Salud Comunitaria", "Enfermería Materno-Infantil", "Seguridad del Paciente"],
        universidadesExperiencia: ["UCE", "UNACH", "ESPOCH", "UTA", "UTN", "UNEMI", "ULEAM"],
        tesisAprobadas: 39,
        calificacion: 4.92,
        tiempoRespuesta: "< 1 hora",
        tarifaReferencialTutor: "$150 - $260 USD (Negociable directo con la tutora)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593987654321",
        emailDirecto: "vparedes.enfermeria@makai.ec",
        avatarFile: "tutora_paredes.png",
        insignia: "ESPECIALISTA PAE & SPSS",
        modalidadAsesoria: "Meet 1 a 1 + Validación de Instrumentos + Base de Datos SPSS"
    },
    {
        id: "tutor_odo_03",
        nombre: "Od. Esp. Sebastián Villacreses, MSc. Investigación Odontológica",
        carrera: "odontologia",
        carrerasCompatibles: ["odontologia", "imagenologia_radiologia"],
        especialidad: "Estudios Experimentales In Vitro, Biomateriales Dentales, Tomografía Cone-Beam (CBCT) y Bioestadística",
        lineasInvestigacion: ["Endodoncia", "Rehabilitación Oral", "Cirugía Maxilofacial", "Odontopediatría"],
        universidadesExperiencia: ["UCE", "UG", "UDLA", "USFQ", "UCUENCA", "UNACH", "UCSG"],
        tesisAprobadas: 31,
        calificacion: 4.90,
        tiempoRespuesta: "< 3 horas",
        tarifaReferencialTutor: "$160 - $290 USD (Negociable directo con el tutor)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593998877665",
        emailDirecto: "svillacreses.odonto@makai.ec",
        avatarFile: "tutor_villacreses.png",
        insignia: "EXPERTO IN VITRO & CBCT",
        modalidadAsesoria: "Sesiones en Vivo + Protocolo de Laboratorio + Defensa Ante Tribunal"
    },
    {
        id: "tutor_diag_04",
        nombre: "Dra. Elena Santamaría, PhD. Bioestadística y Ciencias Diagnósticas",
        carrera: "laboratorio_clinico",
        carrerasCompatibles: [
            "laboratorio_clinico",
            "bioquimica_farmacia",
            "imagenologia_radiologia",
            "medicina"
        ],
        especialidad: "Validación de Pruebas Diagnósticas (Sensibilidad, Especificidad, Curvas ROC), Resistencia Antimicrobiana y R-Studio",
        lineasInvestigacion: ["Microbiología Clínica", "Farmacovigilancia", "Toxicología", "Radiodiagnóstico"],
        universidadesExperiencia: ["UCE", "UG", "UCUENCA", "ESPOCH", "UTA", "PUCE", "UTPL"],
        tesisAprobadas: 64,
        calificacion: 4.98,
        tiempoRespuesta: "< 2 horas",
        tarifaReferencialTutor: "$170 - $310 USD (Negociable directo con la tutora)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593994433221",
        emailDirecto: "esantamaria.bioestadistica@makai.ec",
        avatarFile: "tutora_santamaria.png",
        insignia: "CURVAS ROC & BIOESTADÍSTICA",
        modalidadAsesoria: "Procesamiento en SPSS/R + Tablas Normas Vancouver + Antiplagio < 5%"
    },
    {
        id: "tutor_rehab_05",
        nombre: "Ft. Mgtr. Diego Altamirano, Esp. Neurorrehabilitación y Biomecánica",
        carrera: "fisioterapia",
        carrerasCompatibles: ["fisioterapia", "atencion_prehospitalaria", "nutricion_dietetica"],
        especialidad: "Ensayos Clínicos Funcionales, Escalas Clínicas Validadas (Tinetti, Berg, EVA), Antropometría ISAK y SPSS",
        lineasInvestigacion: ["Fisioterapia Musculoesquelética", "Fisioterapia Deportiva", "Nutrición Clínica", "Trauma Prehospitalario"],
        universidadesExperiencia: ["UCE", "PUCE", "UTA", "UNACH", "ESPOCH", "UDLA", "UCUENCA"],
        tesisAprobadas: 29,
        calificacion: 4.91,
        tiempoRespuesta: "< 2 horas",
        tarifaReferencialTutor: "$140 - $250 USD (Negociable directo con el tutor)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593983344556",
        emailDirecto: "daltamirano.rehab@makai.ec",
        avatarFile: "tutor_altamirano.png",
        insignia: "ESCALAS CLÍNICAS & ENSAYOS",
        modalidadAsesoria: "Tutoría Semanal 1 a 1 + Análisis Pre/Post-Test (Wilcoxon / T-Student)"
    },
    {
        id: "tutor_psi_06",
        nombre: "Psic. Clín. Gabriela Montalvo, MSc. Psicometría y Salud Mental",
        carrera: "psicologia_clinica",
        carrerasCompatibles: ["psicologia_clinica", "medicina", "enfermeria", "nutricion_dietetica"],
        especialidad: "Validación Psicométrica (Alfa de Cronbach, Omega de McDonald), Análisis Factorial, Correlación de Spearman/Pearson",
        lineasInvestigacion: ["Psicopatología Clínica", "Salud Mental Hospitalaria", "Burnout en Personal Sanitario", "Conducta Alimentaria"],
        universidadesExperiencia: ["UCE", "PUCE", "USFQ", "UCUENCA", "UTA", "UNACH", "UTPL"],
        tesisAprobadas: 42,
        calificacion: 4.96,
        tiempoRespuesta: "< 1 hora",
        tarifaReferencialTutor: "$150 - $270 USD (Negociable directo con la tutora)",
        comisionMakaiUSD: 10,
        whatsappDirecto: "593992211448",
        emailDirecto: "gmontalvo.psicometria@makai.ec",
        avatarFile: "tutora_montalvo.png",
        insignia: "PSICOMETRÍA & ALFA CRONBACH",
        modalidadAsesoria: "Validación de Baterías Psicológicas + SPSS/JASP + Redacción Científica"
    }
]);

// ============================================================================
// 2. ESTADO REACTIVO DEL MARKETPLACE DE TESIS 1 A 1
// ============================================================================

export const marketplaceState = {
    initialized: false,
    mountElement: null,
    selectedCareer: "medicina",
    searchQuery: "",
    methodologyFilter: "ALL", // "ALL" | "ANALITICO" | "PRISMA" | "EXPERIMENTAL" | "PSICOMETRIA"
    tutors: [...VERIFIED_TUTORS_CATALOG_SEED],
    unlockedTutorIds: new Set(),
    pendingTutorIds: new Set(),
    myRequests: [],
    adminPendingRequests: [],
    activeTutorForModal: null,
    activeTutorForBriefing: null,
    voucherBase64: null,
    voucherFileName: ""
};

// ============================================================================
// 3. VERIFICACIÓN DE PERMISOS Y CUENTAS MAESTRAS
// ============================================================================

function isCurrentUserMasterAdmin() {
    const email = (
        appState?.currentUserData?.email ||
        auth?.currentUser?.email ||
        ""
    ).toLowerCase().trim();

    if (MASTER_ADMIN_EMAILS.includes(email)) return true;
    if (typeof isMasterAdmin === "function" && isMasterAdmin(email)) return true;
    return false;
}

function normalizeCareerId(rawCareer = "") {
    const clean = String(rawCareer).toLowerCase().trim();
    const aliasMap = {
        laboratorio: "laboratorio_clinico",
        psicologia: "psicologia_clinica",
        nutricion: "nutricion_dietetica",
        bioquimica: "bioquimica_farmacia",
        imagenologia: "imagenologia_radiologia",
        prehospitalaria: "atencion_prehospitalaria"
    };
    const mapped = aliasMap[clean] || clean;
    return HEALTH_CAREERS_MARKET.some((c) => c.id === mapped) ? mapped : "medicina";
}

// ============================================================================
// 4. INICIALIZADOR PRINCIPAL (initThesisMarketplace)
// ============================================================================

/**
 * Inicializa el Marketplace de Tutores de Tesis 1 a 1.
 * Invocado automáticamente por `graduation.controller.js` o `app.orchestrator.js`.
 * @param {Object} options - `{ mountSelector, defaultCareer }`
 */
export async function initThesisMarketplace(options = {}) {
    loadMarketplaceLocalState();

    const initialCareer = normalizeCareerId(
        options.defaultCareer ||
        appState?.currentCareer ||
        appState?.currentUserData?.carrera ||
        marketplaceState.selectedCareer
    );
    marketplaceState.selectedCareer = initialCareer;

    const mountEl = resolveMarketplaceMountElement(options.mountSelector);
    if (!mountEl) return;

    marketplaceState.mountElement = mountEl;
    marketplaceState.initialized = true;

    renderThesisMarketplaceUI();

    // Sincronizar con Cloud Firestore (`tutores_verificados` y `solicitudes_tesis`)
    await loadVerifiedTutors(marketplaceState.selectedCareer);
    await syncStudentAndAdminThesisRequests();

    renderThesisMarketplaceUI();
    exposeGlobalMarketplaceAPI();
}

// Alias de compatibilidad para cargadores dinámicos
export const initMarketplaceTesis = initThesisMarketplace;

function resolveMarketplaceMountElement(customSelector) {
    if (customSelector) {
        const el = document.querySelector(customSelector);
        if (el) return el;
    }
    const existingMount = document.getElementById("thesis-marketplace-mount");
    if (existingMount) return existingMount;

    const gradStage = document.getElementById("graduation-dynamic-stage");
    if (gradStage) return gradStage;

    const gradView = document.getElementById("view-graduation");
    if (gradView) return gradView;

    return null;
}

function exposeGlobalMarketplaceAPI() {
    window.MakaiThesisMarketplace = {
        init: (opts) => initThesisMarketplace(opts),
        loadVerifiedTutors: (careerId) => loadVerifiedTutors(careerId),
        submitThesisMatchRequest: (tutorId, studentData, voucherFile) =>
            submitThesisMatchRequest(tutorId, studentData, voucherFile),
        unlockTutorDirectContact: (tutorId, reqData) =>
            unlockTutorDirectContact(tutorId, reqData),
        openMatchModal: (tutorId) => openThesisMatchModal(tutorId),
        openBriefingRoom: (tutorId) => openTutorBriefingRoomModal(tutorId)
    };
}

// ============================================================================
// 5. FUNCIONES PRINCIPALES DE NEGOCIO (FIRESTORE + COMISIÓN $10 USD)
// ============================================================================

/**
 * Carga de Cloud Firestore (`tutores_verificados`) los tutores aprobados por
 * el Administrador Maestro para la carrera indicada, combinándolos con la semilla.
 * @param {string} careerId - Identificador de cualquiera de las 11 carreras
 * @returns {Promise<Array>} Lista de tutores verificados para la carrera
 */
export async function loadVerifiedTutors(careerId = marketplaceState.selectedCareer) {
    const normalizedCareer = normalizeCareerId(careerId);
    marketplaceState.selectedCareer = normalizedCareer;

    if (db) {
        try {
            const snap = await getDocs(collection(db, "tutores_verificados"));
            const firestoreTutors = [];
            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.activo !== false) {
                    firestoreTutors.push({
                        id: docSnap.id,
                        nombre: data.nombre || "Tutor Especialista Verificado",
                        carrera: normalizeCareerId(data.carrera || "medicina"),
                        carrerasCompatibles: Array.isArray(data.carrerasCompatibles)
                            ? data.carrerasCompatibles
                            : [normalizeCareerId(data.carrera || "medicina")],
                        especialidad: data.especialidad || "Metodología de la Investigación y Bioestadística",
                        lineasInvestigacion: Array.isArray(data.lineasInvestigacion)
                            ? data.lineasInvestigacion
                            : ["Investigación Clínica", "Salud Pública"],
                        universidadesExperiencia: Array.isArray(data.universidadesExperiencia)
                            ? data.universidadesExperiencia
                            : ["Universidades del Ecuador"],
                        tesisAprobadas: Number(data.tesisAprobadas) || 25,
                        calificacion: Number(data.calificacion) || 4.9,
                        tiempoRespuesta: data.tiempoRespuesta || "< 2 horas",
                        tarifaReferencialTutor:
                            data.tarifaReferencialTutor || "$160 - $280 USD (Negociable directo con el tutor)",
                        comisionMakaiUSD: 10,
                        whatsappDirecto: String(data.whatsappDirecto || "593991234567").replace(/\D/g, ""),
                        emailDirecto: data.emailDirecto || "tutoria.tesis@makai.ec",
                        avatarFile: data.avatarFile || "tutor_default.png",
                        insignia: data.insignia || "TUTOR VERIFICADO MAKAI",
                        modalidadAsesoria: data.modalidadAsesoria || "Asesoría 1 a 1 + Bioestadística + Defensa"
                    });
                }
            });

            if (firestoreTutors.length > 0) {
                const remoteIds = new Set(firestoreTutors.map((t) => t.id));
                marketplaceState.tutors = [
                    ...firestoreTutors,
                    ...VERIFIED_TUTORS_CATALOG_SEED.filter((seed) => !remoteIds.has(seed.id))
                ];
            }
        } catch (err) {
            console.warn("Usando catálogo semilla de tutores verificados:", err);
        }
    }

    return getFilteredTutors(normalizedCareer);
}

/**
 * Registra el pago único de $10 USD de comisión para Makai Academy en la
 * colección `solicitudes_tesis` de Cloud Firestore.
 * @param {string} tutorId - ID del tutor seleccionado
 * @param {Object} studentData - Datos del proyecto y del pago de $10 USD
 * @param {File|string|null} voucherFile - Archivo de imagen/PDF o cadena Base64 del comprobante
 */
export async function submitThesisMatchRequest(tutorId, studentData = {}, voucherFile = null) {
    const tutor =
        marketplaceState.tutors.find((t) => t.id === tutorId) ||
        VERIFIED_TUTORS_CATALOG_SEED[0];

    const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid || "estudiante_local";
    const email = auth?.currentUser?.email || appState?.currentUserData?.email || "alumno@makai.ec";
    const nombreEstudiante =
        studentData.nombreEstudiante ||
        appState?.currentUserData?.nombre ||
        auth?.currentUser?.displayName ||
        email;

    let comprobanteBase64 = marketplaceState.voucherBase64 || "";
    if (voucherFile instanceof File) {
        comprobanteBase64 = await compressVoucherImageToBase64(voucherFile);
    } else if (typeof voucherFile === "string" && voucherFile.startsWith("data:")) {
        comprobanteBase64 = voucherFile;
    }

    const autoApprove = isCurrentUserMasterAdmin();
    const requestRecord = {
        uidEstudiante: uid,
        emailEstudiante: email,
        nombreEstudiante,
        whatsappEstudiante: studentData.whatsappEstudiante || "",
        universidadEstudiante: studentData.universidadEstudiante || "Universidad del Ecuador",
        tutorId: tutor.id,
        tutorNombre: tutor.nombre,
        tutorWhatsapp: tutor.whatsappDirecto,
        carrera: normalizeCareerId(studentData.carrera || marketplaceState.selectedCareer),
        temaTentativo: studentData.temaTentativo || "Por definir en la primera sesión con el tutor",
        disenoMetodologico: studentData.disenoMetodologico || "Estudio Observacional / Analítico",
        metodoPago: studentData.metodoPago || "Deuna! QR Banco Pichincha",
        numeroComprobante: studentData.numeroComprobante || "S/N",
        comprobanteBase64,
        montoUSD: 10,
        comisionMakaiUSD: 10,
        estado: autoApprove ? "APROBADO" : "PENDIENTE",
        createdAt: new Date().toISOString()
    };

    marketplaceState.pendingTutorIds.add(tutor.id);
    marketplaceState.myRequests.unshift({ id: `local_${Date.now()}`, ...requestRecord });
    saveMarketplaceLocalState();

    if (db) {
        try {
            const docRef = await addDoc(collection(db, "solicitudes_tesis"), requestRecord);
            requestRecord.id = docRef.id;
        } catch (err) {
            console.warn("Solicitud $10 USD guardada en caché local:", err);
        }
    }

    if (autoApprove) {
        unlockTutorDirectContact(tutor.id, requestRecord);
    }

    return requestRecord;
}

/**
 * Desbloquea el botón directo al WhatsApp y la Sala Privada con el tutor una
 * vez que el Administrador Maestro aprueba los $10 USD en `solicitudes_tesis`.
 * @param {string} tutorId - ID del tutor a desbloquear
 * @param {Object} requestData - Metadatos opcionales de la solicitud aprobada
 */
export function unlockTutorDirectContact(tutorId, requestData = {}) {
    if (!tutorId) return null;

    marketplaceState.unlockedTutorIds.add(tutorId);
    marketplaceState.pendingTutorIds.delete(tutorId);
    saveMarketplaceLocalState();

    const tutor = marketplaceState.tutors.find((t) => t.id === tutorId);
    if (!tutor) return null;

    const careerObj =
        HEALTH_CAREERS_MARKET.find((c) => c.id === marketplaceState.selectedCareer) ||
        HEALTH_CAREERS_MARKET[0];

    const tema = requestData.temaTentativo || "mi proyecto de Tesis de Grado";
    const whatsappUrl = `https://wa.me/${tutor.whatsappDirecto}?text=${encodeURIComponent(
        `Hola ${tutor.nombre}, Makai Academy verificó mi vinculación 1 a 1 ($10 USD) en la carrera de ${careerObj.nombre}. Mi tema tentativo es: "${tema}". Quisiera coordinar nuestra primera sesión y acordar el presupuesto de asesoría.`
    )}`;

    if (marketplaceState.initialized) {
        renderThesisMarketplaceUI();
    }

    return {
        unlocked: true,
        tutorId: tutor.id,
        tutorNombre: tutor.nombre,
        whatsappDirecto: tutor.whatsappDirecto,
        whatsappUrl
    };
}

/**
 * Sincroniza desde Cloud Firestore las solicitudes del alumno actual y, si es
 * Administrador Maestro, carga las solicitudes pendientes de aprobación.
 */
async function syncStudentAndAdminThesisRequests() {
    if (!db) return;

    try {
        const uid = auth?.currentUser?.uid || appState?.currentUserData?.uid;
        if (uid) {
            const qStudent = query(
                collection(db, "solicitudes_tesis"),
                where("uidEstudiante", "==", uid)
            );
            const snapStudent = await getDocs(qStudent);
            const loadedRequests = [];

            snapStudent.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const item = { id: docSnap.id, ...data };
                loadedRequests.push(item);

                const status = String(data.estado || "").toUpperCase();
                if (status === "APROBADO" || status === "VERIFICADO") {
                    unlockTutorDirectContact(data.tutorId, item);
                } else if (status === "PENDIENTE" && data.tutorId) {
                    marketplaceState.pendingTutorIds.add(data.tutorId);
                }
            });

            if (loadedRequests.length > 0) {
                marketplaceState.myRequests = loadedRequests;
            }
        }

        // Si es Cuenta Maestra, cargar solicitudes pendientes globales para aprobación en 1 clic
        if (isCurrentUserMasterAdmin()) {
            const qPending = query(
                collection(db, "solicitudes_tesis"),
                where("estado", "==", "PENDIENTE")
            );
            const snapPending = await getDocs(qPending);
            const pendingList = [];
            snapPending.forEach((docSnap) => {
                pendingList.push({ id: docSnap.id, ...docSnap.data() });
            });
            marketplaceState.adminPendingRequests = pendingList;
        }

        saveMarketplaceLocalState();
    } catch (e) {
        // Continúa con el estado en memoria si la colección aún no existe
    }
}

/**
 * Permite al Administrador Maestro aprobar un comprobante de $10 USD directamente
 * y habilitar el contacto del tutor para el estudiante.
 */
export async function approveThesisRequestAsAdmin(requestId, tutorId) {
    if (!isCurrentUserMasterAdmin()) return;

    if (db && requestId && !String(requestId).startsWith("local_")) {
        try {
            await updateDoc(doc(db, "solicitudes_tesis", requestId), {
                estado: "APROBADO",
                aprobadoPor: auth?.currentUser?.email || "admin@makai.ec",
                approvedAt: new Date().toISOString()
            });
        } catch (err) {
            console.warn("No se pudo actualizar en Firestore:", err);
        }
    }

    marketplaceState.adminPendingRequests = marketplaceState.adminPendingRequests.filter(
        (r) => r.id !== requestId
    );
    unlockTutorDirectContact(tutorId);
}

// ============================================================================
// 6. FILTRADO INTELIGENTE POR LAS 11 CARRERAS Y METODOLOGÍA
// ============================================================================

function getFilteredTutors(careerId = marketplaceState.selectedCareer) {
    const queryText = marketplaceState.searchQuery.toLowerCase().trim();
    const methFilter = marketplaceState.methodologyFilter;

    return marketplaceState.tutors.filter((tutor) => {
        const matchesCareer =
            tutor.carrera === careerId ||
            (Array.isArray(tutor.carrerasCompatibles) &&
                tutor.carrerasCompatibles.includes(careerId));

        if (!matchesCareer) return false;

        if (methFilter !== "ALL") {
            const specUpper = String(tutor.especialidad || "").toUpperCase();
            if (methFilter === "ANALITICO" && !specUpper.includes("ANALÍTICO") && !specUpper.includes("COHORTE") && !specUpper.includes("SPSS")) {
                return false;
            }
            if (methFilter === "PRISMA" && !specUpper.includes("PRISMA") && !specUpper.includes("SISTEMÁTICA")) {
                return false;
            }
            if (methFilter === "EXPERIMENTAL" && !specUpper.includes("IN VITRO") && !specUpper.includes("EXPERIMENTAL") && !specUpper.includes("ENSAYO") && !specUpper.includes("CURVAS ROC")) {
                return false;
            }
            if (methFilter === "PSICOMETRIA" && !specUpper.includes("PSICOMETRÍA") && !specUpper.includes("CRONBACH") && !specUpper.includes("NANDA")) {
                return false;
            }
        }

        if (queryText) {
            const haystack = [
                tutor.nombre,
                tutor.especialidad,
                ...(tutor.lineasInvestigacion || []),
                ...(tutor.universidadesExperiencia || [])
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(queryText);
        }

        return true;
    });
}

// ============================================================================
// 7. RENDERIZADO DE LA INTERFAZ CYBER-MEDICAL DEL MARKETPLACE
// ============================================================================

function renderThesisMarketplaceUI() {
    const mount = marketplaceState.mountElement;
    if (!mount) return;

    const currentCareer =
        HEALTH_CAREERS_MARKET.find((c) => c.id === marketplaceState.selectedCareer) ||
        HEALTH_CAREERS_MARKET[0];

    const filteredTutors = getFilteredTutors(marketplaceState.selectedCareer);
    const isStandaloneMount = mount.id === "view-graduation";

    mount.innerHTML = `
        <div class="space-y-6">
            ${
                isStandaloneMount
                    ? `
                <!-- BARRA SUPERIOR CON BOTONES FIJOS DERECHOS SI SE MONTA EN MODO AUTÓNOMO -->
                <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-2xl">handshake</span>
                        <div>
                            <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">CARPETA 9 • THESIS MARKETPLACE</span>
                            <h2 class="text-base font-extrabold text-white">Directorio de Tutores Verificados 1 a 1</h2>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-mp-nav="view-classrooms" class="px-3.5 py-2 rounded-xl bg-surface hover:bg-primary hover:text-[#06090e] text-primary border border-primary/40 text-xs font-extrabold font-mono transition-all">
                            🎥 Aulas Virtuales
                        </button>
                        <button type="button" data-mp-nav="view-metrics" class="px-3.5 py-2 rounded-xl bg-surface hover:bg-secondary hover:text-[#06090e] text-secondary border border-secondary/40 text-xs font-extrabold font-mono transition-all">
                            📊 Mis Métricas
                        </button>
                    </div>
                </div>
            `
                    : ""
            }

            <!-- CABECERA DEL MARKETPLACE Y PASOS DE VINCULACIÓN ($10 USD) -->
            <div class="bg-[#0c1118] border border-primary/30 rounded-2xl p-6 space-y-5 shadow-[0_0_35px_rgba(0,229,255,0.06)]">
                <div class="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-surface-high">
                    <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-primary/15 text-primary border border-primary/40">
                                VINCULACIÓN DIRECTA 1 A 1 • COMISIÓN MAKAI $10.00 USD
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/40">
                                ${filteredTutors.length} Especialistas en ${escapeHtml(currentCareer.nombre)}
                            </span>
                        </div>
                        <h2 class="text-xl md:text-2xl font-extrabold text-white">
                            Tutores Verificados de Tesis para ${escapeHtml(currentCareer.nombre)}
                        </h2>
                        <p class="text-xs text-gray-400 max-w-3xl">
                            Elige tu asesor ideal según tu línea de investigación. Abonas únicamente <strong>$10 USD de derecho de vinculación a Makai Academy</strong> y desbloqueas el WhatsApp directo del especialista para negociar con él tu cronograma y presupuesto sin intermediarios.
                        </p>
                    </div>

                    ${
                        isCurrentUserMasterAdmin()
                            ? `
                        <div class="px-3.5 py-2 rounded-xl bg-secondary/15 border border-secondary text-secondary font-mono text-xs font-extrabold flex items-center gap-2">
                            <span class="material-symbols-outlined text-base">verified_user</span>
                            <span>MODO ADMIN MAESTRO ACTIVO</span>
                        </div>
                    `
                            : ""
                    }
                </div>

                <!-- CONTROLES DE FILTRADO: 11 CARRERAS, DISEÑO METODOLÓGICO Y BÚSQUEDA -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3">
                        <label for="mp-career-selector" class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                            1. Filtrar por Carrera de Salud (11 Áreas)
                        </label>
                        <select
                            id="mp-career-selector"
                            class="w-full bg-transparent text-xs font-extrabold text-primary focus:outline-none cursor-pointer"
                        >
                            ${HEALTH_CAREERS_MARKET.map(
                                (c) => `
                                <option value="${c.id}" class="bg-[#06090e] text-white" ${c.id === marketplaceState.selectedCareer ? "selected" : ""}>
                                    ${escapeHtml(c.nombre)}
                                </option>
                            `
                            ).join("")}
                        </select>
                    </div>

                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3">
                        <label for="mp-methodology-selector" class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                            2. Enfoque Metodológico / Estadístico
                        </label>
                        <select
                            id="mp-methodology-selector"
                            class="w-full bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" class="bg-[#06090e]" ${marketplaceState.methodologyFilter === "ALL" ? "selected" : ""}>Todos los diseños metodológicos</option>
                            <option value="ANALITICO" class="bg-[#06090e]" ${marketplaceState.methodologyFilter === "ANALITICO" ? "selected" : ""}>Estudios Analíticos (Cohortes / Casos y Controles / SPSS)</option>
                            <option value="PRISMA" class="bg-[#06090e]" ${marketplaceState.methodologyFilter === "PRISMA" ? "selected" : ""}>Revisión Sistemática PRISMA 2020 & Metaanálisis</option>
                            <option value="EXPERIMENTAL" class="bg-[#06090e]" ${marketplaceState.methodologyFilter === "EXPERIMENTAL" ? "selected" : ""}>In Vitro / Ensayos Clínicos / Curvas ROC Diagnósticas</option>
                            <option value="PSICOMETRIA" class="bg-[#06090e]" ${marketplaceState.methodologyFilter === "PSICOMETRIA" ? "selected" : ""}>Psicometría (Alfa Cronbach) & Taxonomía NANDA-NIC-NOC</option>
                        </select>
                    </div>

                    <div class="bg-[#06090e] border border-surface-high rounded-xl p-3">
                        <label for="mp-search-input" class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                            3. Buscar por Universidad, Línea o Tutor
                        </label>
                        <input
                            id="mp-search-input"
                            type="text"
                            value="${escapeHtml(marketplaceState.searchQuery)}"
                            placeholder="Ej: UCE, ESPOCH, PRISMA, Preeclampsia, SPSS..."
                            class="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                        />
                    </div>
                </div>

                <!-- TARJETAS DE LOS TUTORES VERIFICADOS -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                    ${filteredTutors
                        .map((tutor) => renderTutorCardHTML(tutor, currentCareer))
                        .join("")}
                </div>
            </div>

            ${renderAdminPendingRequestsSection()}
            ${renderStudentRequestsHistorySection()}

            <!-- CONTENEDOR DE MODALES DEL MARKETPLACE -->
            <div id="mp-modal-container" class="hidden"></div>
        </div>
    `;

    bindMarketplaceEvents(mount);
}

function renderTutorCardHTML(tutor, currentCareer) {
    const isUnlocked =
        isCurrentUserMasterAdmin() ||
        marketplaceState.unlockedTutorIds.has(tutor.id);
    const isPending = marketplaceState.pendingTutorIds.has(tutor.id);
    const avatarSrc = `${MARKETPLACE_ASSETS.avatarsPath}${tutor.avatarFile}`;
    const initials = getTutorInitials(tutor.nombre);

    const directWaLink = `https://wa.me/${tutor.whatsappDirecto}?text=${encodeURIComponent(
        `Hola ${tutor.nombre}, desbloqueé tu contacto verificado en Makai Academy para asesoría de Tesis 1 a 1 en ${currentCareer.nombre}.`
    )}`;

    return `
        <div class="bg-[#06090e] border ${
            isUnlocked ? "border-secondary/60" : "border-surface-high hover:border-primary/50"
        } rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-lg">
            <div class="space-y-3.5">
                <!-- Cabecera del Tutor con Avatar y Calificación -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3.5">
                        <div class="relative w-14 h-14 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src="${escapeHtml(avatarSrc)}"
                                alt="${escapeHtml(tutor.nombre)}"
                                class="w-full h-full object-cover"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <span style="display:none;" class="w-full h-full items-center justify-center font-mono font-extrabold text-primary text-base">
                                ${escapeHtml(initials)}
                            </span>
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-extrabold uppercase">
                                    ${escapeHtml(tutor.insignia)}
                                </span>
                                <span class="px-2 py-0.5 rounded bg-surface border border-surface-high text-gray-300 font-mono text-[10px]">
                                    ⏱ Resp. ${escapeHtml(tutor.tiempoRespuesta || "< 2h")}
                                </span>
                            </div>
                            <h3 class="text-sm md:text-base font-extrabold text-white mt-1">
                                ${escapeHtml(tutor.nombre)}
                            </h3>
                        </div>
                    </div>

                    <div class="text-right font-mono shrink-0">
                        <span class="px-2 py-0.5 rounded-lg bg-warning/15 text-warning text-xs font-extrabold border border-warning/30">
                            ★ ${Number(tutor.calificacion).toFixed(2)}
                        </span>
                        <span class="block text-[10px] text-gray-400 mt-1">
                            ${tutor.tesisAprobadas} tesis aprobadas
                        </span>
                    </div>
                </div>

                <!-- Especialidad Metodológica -->
                <p class="text-xs text-gray-300 leading-relaxed">
                    <strong class="text-primary font-mono uppercase text-[11px]">Dominio Metodológico:</strong>
                    ${escapeHtml(tutor.especialidad)}
                </p>

                <!-- Líneas de Investigación Clínica -->
                <div class="flex flex-wrap gap-1.5">
                    ${(tutor.lineasInvestigacion || [])
                        .map(
                            (linea) => `
                        <span class="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-[10px] font-mono text-primary">
                            #${escapeHtml(linea)}
                        </span>
                    `
                        )
                        .join("")}
                </div>

                <!-- Universidades con Experiencia -->
                <div>
                    <span class="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                        Experiencia en Reglamentos de Titulación:
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                        ${(tutor.universidadesExperiencia || [])
                            .map(
                                (uni) => `
                            <span class="px-2 py-0.5 rounded bg-surface border border-surface-high text-[10px] font-mono text-gray-300">
                                ${escapeHtml(uni)}
                            </span>
                        `
                            )
                            .join("")}
                    </div>
                </div>

                <!-- Desglose Transparente de Honorarios y Comisión Makai $10 USD -->
                <div class="p-3.5 rounded-xl bg-[#0c1118] border border-surface-high text-xs space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-gray-400">Modalidad de trabajo:</span>
                        <span class="font-bold text-gray-200 text-right">${escapeHtml(tutor.modalidadAsesoria || "Zoom 1 a 1 + SPSS")}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-gray-400">Honorario referencial del tutor:</span>
                        <span class="font-bold text-white text-right">${escapeHtml(tutor.tarifaReferencialTutor)}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 pt-1 border-t border-surface-high">
                        <span class="text-gray-400">Comisión de vinculación Makai Academy:</span>
                        <span class="font-mono font-extrabold text-secondary">$${tutor.comisionMakaiUSD}.00 USD (Pago único)</span>
                    </div>
                </div>
            </div>

            <!-- Botonera de Acción según Estado de Desbloqueo -->
            <div class="pt-3 border-t border-surface-high flex flex-col sm:flex-row items-center gap-2.5">
                ${
                    isUnlocked
                        ? `
                    <a
                        href="${directWaLink}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs text-center hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.25)]"
                    >
                        <span class="material-symbols-outlined text-base">chat</span>
                        <span>WhatsApp Directo (+${escapeHtml(tutor.whatsappDirecto)})</span>
                    </a>
                    <button
                        type="button"
                        data-open-briefing="${tutor.id}"
                        class="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-surface hover:bg-primary hover:text-[#06090e] text-primary border border-primary/40 font-mono font-extrabold text-xs transition-all"
                    >
                        Sala & Briefing
                    </button>
                `
                        : isPending
                        ? `
                    <div class="w-full py-2.5 px-4 rounded-xl bg-warning/15 border border-warning/50 text-warning font-mono text-xs font-extrabold text-center flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-base">hourglass_top</span>
                        <span>Comprobante de $10 USD en Verificación Admin</span>
                    </div>
                `
                        : `
                    <button
                        type="button"
                        data-open-match="${tutor.id}"
                        class="w-full py-2.5 px-4 rounded-xl bg-primary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                    >
                        <span class="material-symbols-outlined text-base">lock_open</span>
                        <span>Vincular Tutor 1 a 1 ($10 USD Comisión Makai)</span>
                    </button>
                `
                }
            </div>
        </div>
    `;
}

function renderAdminPendingRequestsSection() {
    if (!isCurrentUserMasterAdmin() || marketplaceState.adminPendingRequests.length === 0) {
        return "";
    }

    return `
        <div class="bg-[#0c1118] border-2 border-secondary/50 rounded-2xl p-5 space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        BÓVEDA ADMIN MAESTRO • APROBACIÓN RÁPIDA DE COMISIÓN $10 USD
                    </span>
                    <h3 class="text-base font-extrabold text-white">
                        Solicitudes Pendientes en \`solicitudes_tesis\` (${marketplaceState.adminPendingRequests.length})
                    </h3>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${marketplaceState.adminPendingRequests
                    .map(
                        (req) => `
                    <div class="p-3.5 rounded-xl bg-[#06090e] border border-surface-high flex items-center justify-between gap-3">
                        <div class="text-xs space-y-0.5">
                            <div class="font-extrabold text-white">${escapeHtml(req.nombreEstudiante || req.emailEstudiante)}</div>
                            <div class="text-gray-400">Tutor: <strong class="text-primary">${escapeHtml(req.tutorNombre)}</strong></div>
                            <div class="font-mono text-[11px] text-secondary">
                                ${escapeHtml(req.metodoPago)} • Comp: #${escapeHtml(req.numeroComprobante)} ($10 USD)
                            </div>
                        </div>
                        <button
                            type="button"
                            data-admin-approve-req="${req.id}"
                            data-admin-approve-tutor="${req.tutorId}"
                            class="px-3.5 py-2 rounded-xl bg-secondary text-[#06090e] font-mono font-extrabold text-xs hover:bg-opacity-90 shrink-0"
                        >
                            ✓ Aprobar $10
                        </button>
                    </div>
                `
                    )
                    .join("")}
            </div>
        </div>
    `;
}

function renderStudentRequestsHistorySection() {
    if (marketplaceState.myRequests.length === 0) return "";

    return `
        <div class="bg-[#0c1118] border border-surface-high rounded-2xl p-5 space-y-3">
            <span class="text-[10px] font-mono uppercase text-primary font-extrabold block">
                HISTORIAL DE VINCULACIONES DEL ESTUDIANTE • COLECCIÓN solicitudes_tesis
            </span>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${marketplaceState.myRequests
                    .slice(0, 4)
                    .map((req) => {
                        const isApproved =
                            String(req.estado || "").toUpperCase() === "APROBADO" ||
                            marketplaceState.unlockedTutorIds.has(req.tutorId);
                        return `
                            <div class="p-3 rounded-xl bg-[#06090e] border border-surface-high flex items-center justify-between gap-3 text-xs">
                                <div>
                                    <div class="font-bold text-white">${escapeHtml(req.tutorNombre || "Tutor Especialista")}</div>
                                    <div class="text-[11px] text-gray-400 truncate max-w-xs">${escapeHtml(req.temaTentativo || "")}</div>
                                </div>
                                <span class="px-2.5 py-1 rounded-lg font-mono text-[10px] font-extrabold ${
                                    isApproved
                                        ? "bg-secondary/15 text-secondary border border-secondary/40"
                                        : "bg-warning/15 text-warning border border-warning/40"
                                }">
                                    ${isApproved ? "APROBADO • WHATSAPP ACTIVO" : "EN VERIFICACIÓN ($10 USD)"}
                                </span>
                            </div>
                        `;
                    })
                    .join("")}
            </div>
        </div>
    `;
}

// ============================================================================
// 8. MODAL DE PAGO DE COMISIÓN $10 USD Y SALA PRIVADA DE BRIEFING
// ============================================================================

export function openThesisMatchModal(tutorId) {
    const tutor =
        marketplaceState.tutors.find((t) => t.id === tutorId) ||
        marketplaceState.tutors[0];

    marketplaceState.activeTutorForModal = tutor;
    marketplaceState.voucherBase64 = null;
    marketplaceState.voucherFileName = "";

    const modalContainer = document.getElementById("mp-modal-container");
    if (!modalContainer) return;

    const currentCareerObj =
        HEALTH_CAREERS_MARKET.find((c) => c.id === marketplaceState.selectedCareer) ||
        HEALTH_CAREERS_MARKET[0];

    modalContainer.className =
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto";

    modalContainer.innerHTML = `
        <div class="bg-[#0c1118] border-2 border-primary/50 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-auto">
            <div class="flex items-start justify-between gap-3 pb-3 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase text-primary font-extrabold">
                        PASARELA DE VINCULACIÓN 1 A 1 • $10.00 USD COMISIÓN MAKAI
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        Vincular con ${escapeHtml(tutor.nombre)}
                    </h3>
                    <p class="text-xs text-gray-400">
                        Carrera seleccionada: <strong class="text-primary">${escapeHtml(currentCareerObj.nombre)}</strong>
                    </p>
                </div>
                <button type="button" id="btn-mp-close-modal" class="text-gray-400 hover:text-white text-sm font-mono">
                    ✕
                </button>
            </div>

            <div class="p-3.5 rounded-xl bg-[#06090e] border border-surface-high text-xs text-gray-300 space-y-1.5">
                <div class="flex justify-between">
                    <span>Derecho único de vinculación Makai Academy:</span>
                    <strong class="text-secondary font-mono">$10.00 USD</strong>
                </div>
                <div class="flex justify-between">
                    <span>Honorario total de asesoría del tutor:</span>
                    <strong class="text-white">${escapeHtml(tutor.tarifaReferencialTutor)}</strong>
                </div>
                <p class="text-[11px] text-gray-400 pt-1 border-t border-surface-high">
                    Al verificarse tu comprobante de $10 USD en el Panel Admin, se desbloquea el botón directo al WhatsApp del especialista para que acuerden el plan de pagos de tu tesis.
                </p>
            </div>

            <div class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            1. Tu Universidad
                        </label>
                        <input
                            type="text"
                            id="mp-input-university"
                            placeholder="Ej: UCE, ESPOCH, UG, UCUENCA, PUCE..."
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            2. Tu WhatsApp de Contacto
                        </label>
                        <input
                            type="text"
                            id="mp-input-student-wa"
                            placeholder="Ej: 0991234567"
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        3. Tema Tentativo o Problema Clínico de tu Tesis
                    </label>
                    <input
                        type="text"
                        id="mp-input-topic"
                        placeholder="Ej: Factores de riesgo asociados a sepsis neonatal temprana en el Hospital..."
                        class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            4. Método de Pago ($10 USD)
                        </label>
                        <select
                            id="mp-input-method"
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white font-bold"
                        >
                            <option value="Deuna! QR Banco Pichincha">Deuna! QR Banco Pichincha</option>
                            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                            <option value="PayPhone">PayPhone</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                            5. N.° de Comprobante ($10 USD)
                        </label>
                        <input
                            type="text"
                            id="mp-input-voucher-num"
                            placeholder="Ej: 09485712"
                            class="w-full bg-[#06090e] border border-surface-high rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                        6. Adjuntar Captura del Comprobante de $10 USD (Imagen o PDF)
                    </label>
                    <input
                        type="file"
                        id="mp-input-voucher-file"
                        accept="image/*,.pdf"
                        class="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-[#06090e] hover:file:bg-opacity-90"
                    />
                    <div id="mp-voucher-status" class="text-[11px] font-mono text-gray-400 mt-1"></div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-surface-high">
                <button
                    type="button"
                    id="btn-mp-cancel-modal"
                    class="px-4 py-2 rounded-xl bg-surface text-gray-300 hover:text-white text-xs font-bold"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    id="btn-mp-confirm-match"
                    class="px-5 py-2.5 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,230,118,0.25)]"
                >
                    Registrar Pago de $10 USD →
                </button>
            </div>
        </div>
    `;

    const closeModal = () => {
        modalContainer.className = "hidden";
        modalContainer.innerHTML = "";
    };

    modalContainer.querySelector("#btn-mp-close-modal")?.addEventListener("click", closeModal);
    modalContainer.querySelector("#btn-mp-cancel-modal")?.addEventListener("click", closeModal);

    let selectedFileObj = null;
    modalContainer.querySelector("#mp-input-voucher-file")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        selectedFileObj = file;
        const statusEl = modalContainer.querySelector("#mp-voucher-status");
        if (statusEl) statusEl.textContent = "Comprimiendo comprobante en Base64...";
        marketplaceState.voucherBase64 = await compressVoucherImageToBase64(file);
        marketplaceState.voucherFileName = file.name;
        if (statusEl) statusEl.textContent = `✓ Comprobante listo: ${file.name}`;
    });

    modalContainer.querySelector("#btn-mp-confirm-match")?.addEventListener("click", async () => {
        const voucherNum = modalContainer.querySelector("#mp-input-voucher-num")?.value?.trim() || "";
        if (!voucherNum) {
            alert("Por favor ingresa el número de comprobante del pago de $10 USD.");
            return;
        }

        const studentData = {
            universidadEstudiante:
                modalContainer.querySelector("#mp-input-university")?.value?.trim() || "Universidad del Ecuador",
            whatsappEstudiante:
                modalContainer.querySelector("#mp-input-student-wa")?.value?.trim() || "",
            temaTentativo:
                modalContainer.querySelector("#mp-input-topic")?.value?.trim() ||
                "Por definir en la primera sesión con el tutor",
            metodoPago:
                modalContainer.querySelector("#mp-input-method")?.value || "Deuna! QR Banco Pichincha",
            numeroComprobante: voucherNum,
            carrera: marketplaceState.selectedCareer
        };

        await submitThesisMatchRequest(tutor.id, studentData, selectedFileObj);
        closeModal();
        renderThesisMarketplaceUI();
    });
}

/**
 * Abre la Sala Privada de Briefing para tutores cuyo contacto ya fue desbloqueado.
 */
export function openTutorBriefingRoomModal(tutorId) {
    const tutor =
        marketplaceState.tutors.find((t) => t.id === tutorId) ||
        marketplaceState.tutors[0];

    const modalContainer = document.getElementById("mp-modal-container");
    if (!modalContainer) return;

    const currentCareerObj =
        HEALTH_CAREERS_MARKET.find((c) => c.id === marketplaceState.selectedCareer) ||
        HEALTH_CAREERS_MARKET[0];

    const briefingMessage = `Hola ${tutor.nombre}, desbloqueé tu contacto en Makai Academy ($10 USD verificados) para mi Tesis de Grado en ${currentCareerObj.nombre}.\n\n• Etapa actual: Elaboración de Anteproyecto / Perfil PICO\n• Modalidad requerida: ${tutor.modalidadAsesoria}\n• Quisiera agendar nuestra primera reunión por Zoom/Meet para definir el presupuesto y cronograma.`;

    const waHref = `https://wa.me/${tutor.whatsappDirecto}?text=${encodeURIComponent(briefingMessage)}`;

    modalContainer.className =
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4";

    modalContainer.innerHTML = `
        <div class="bg-[#0c1118] border-2 border-secondary/60 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div class="flex items-start justify-between gap-3 pb-3 border-b border-surface-high">
                <div>
                    <span class="text-[10px] font-mono uppercase text-secondary font-extrabold">
                        CONTACTO DIRECTO DESBLOQUEADO • SALA PRIVADA 1 A 1
                    </span>
                    <h3 class="text-lg font-extrabold text-white mt-0.5">
                        ${escapeHtml(tutor.nombre)}
                    </h3>
                </div>
                <button type="button" id="btn-close-briefing" class="text-gray-400 hover:text-white text-sm font-mono">
                    ✕
                </button>
            </div>

            <div class="p-3.5 rounded-xl bg-[#06090e] border border-surface-high text-xs space-y-1.5">
                <div class="flex justify-between">
                    <span class="text-gray-400">WhatsApp Verificado:</span>
                    <strong class="text-secondary font-mono">+${escapeHtml(tutor.whatsappDirecto)}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Correo Académico:</span>
                    <strong class="text-primary font-mono">${escapeHtml(tutor.emailDirecto || "tutoria@makai.ec")}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Tarifa Referencial a Negociar:</span>
                    <strong class="text-white">${escapeHtml(tutor.tarifaReferencialTutor)}</strong>
                </div>
            </div>

            <div>
                <label class="block text-xs font-mono text-gray-300 font-bold mb-1">
                    Briefing Clínico-Metodológico Listo para Enviar:
                </label>
                <textarea
                    id="mp-briefing-textarea"
                    rows="5"
                    class="w-full bg-[#06090e] border border-surface-high rounded-xl p-3 text-xs text-gray-200 focus:border-secondary focus:outline-none"
                >${escapeHtml(briefingMessage)}</textarea>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
                <a
                    id="mp-briefing-wa-link"
                    href="${waHref}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full py-2.5 px-4 rounded-xl bg-secondary text-[#06090e] font-extrabold text-xs text-center hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                >
                    <span class="material-symbols-outlined text-base">send</span>
                    <span>Enviar Briefing al WhatsApp del Tutor</span>
                </a>
            </div>
        </div>
    `;

    modalContainer.querySelector("#btn-close-briefing")?.addEventListener("click", () => {
        modalContainer.className = "hidden";
        modalContainer.innerHTML = "";
    });

    modalContainer.querySelector("#mp-briefing-textarea")?.addEventListener("input", (e) => {
        const waBtn = modalContainer.querySelector("#mp-briefing-wa-link");
        if (waBtn) {
            waBtn.href = `https://wa.me/${tutor.whatsappDirecto}?text=${encodeURIComponent(e.target.value)}`;
        }
    });
}

// ============================================================================
// 9. EVENTOS DEL DOM Y UTILIDADES LOCALES
// ============================================================================

function bindMarketplaceEvents(mount) {
    mount.querySelector("#mp-career-selector")?.addEventListener("change", (e) => {
        marketplaceState.selectedCareer = normalizeCareerId(e.target.value);
        saveMarketplaceLocalState();
        renderThesisMarketplaceUI();
    });

    mount.querySelector("#mp-methodology-selector")?.addEventListener("change", (e) => {
        marketplaceState.methodologyFilter = e.target.value;
        renderThesisMarketplaceUI();
    });

    mount.querySelector("#mp-search-input")?.addEventListener("input", (e) => {
        marketplaceState.searchQuery = e.target.value;
        renderThesisMarketplaceUI();
    });

    mount.querySelectorAll("[data-open-match]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openThesisMatchModal(btn.dataset.openMatch);
        });
    });

    mount.querySelectorAll("[data-open-briefing]").forEach((btn) => {
        btn.addEventListener("click", () => {
            openTutorBriefingRoomModal(btn.dataset.openBriefing);
        });
    });

    mount.querySelectorAll("[data-admin-approve-req]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await approveThesisRequestAsAdmin(
                btn.dataset.adminApproveReq,
                btn.dataset.adminApproveTutor
            );
        });
    });

    mount.querySelectorAll("[data-mp-nav]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetView = btn.dataset.mpNav;
            if (typeof window.switchView === "function") {
                window.switchView(targetView);
            } else {
                document.querySelector(`[data-target="${targetView}"], [data-view="${targetView}"]`)?.click();
            }
        });
    });
}

function getTutorInitials(fullName = "") {
    const cleaned = String(fullName)
        .replace(/^(Dr\.|Dra\.|Lic\.|Od\.|Ft\.|Psic\.|Esp\.|Mgtr\.|MSc\.|PhD\.)\s*/gi, "")
        .trim();
    const parts = cleaned.split(/\s+/);
    const first = parts[0]?.[0] || "T";
    const second = parts[1]?.[0] || "M";
    return `${first}${second}`.toUpperCase();
}

function loadMarketplaceLocalState() {
    try {
        const raw = localStorage.getItem("makai_thesis_marketplace_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);

        if (parsed.selectedCareer) {
            marketplaceState.selectedCareer = normalizeCareerId(parsed.selectedCareer);
        }
        if (Array.isArray(parsed.unlockedTutorIds)) {
            marketplaceState.unlockedTutorIds = new Set(parsed.unlockedTutorIds);
        }
        if (Array.isArray(parsed.pendingTutorIds)) {
            marketplaceState.pendingTutorIds = new Set(parsed.pendingTutorIds);
        }
        if (Array.isArray(parsed.myRequests)) {
            marketplaceState.myRequests = parsed.myRequests;
        }
    } catch (e) {}
}

function saveMarketplaceLocalState() {
    try {
        localStorage.setItem(
            "makai_thesis_marketplace_v1",
            JSON.stringify({
                selectedCareer: marketplaceState.selectedCareer,
                unlockedTutorIds: Array.from(marketplaceState.unlockedTutorIds),
                pendingTutorIds: Array.from(marketplaceState.pendingTutorIds),
                myRequests: marketplaceState.myRequests.slice(0, 10)
            })
        );
    } catch (e) {}
}

function compressVoucherImageToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const rawDataUrl = String(ev.target?.result || "");
            if (!file.type.startsWith("image/")) {
                resolve(rawDataUrl);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const maxWidth = 900;
                const scale = Math.min(1, maxWidth / (img.width || maxWidth));
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            img.onerror = () => resolve(rawDataUrl);
            img.src = rawDataUrl;
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
