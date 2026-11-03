// ============================================================================
// ARCHIVO: src/data/plansConfig.ts
// DESCRIPCIÓN: Catálogo semilla de los 4 Planes de Makai Academy (Paso 2 de 3)
//              y Configuración por Defecto de los Medios de Pago (Paso 3 de 3).
//              100% configurables desde el Panel del Administrador Maestro.
// ============================================================================

import { SubscriptionPlanConfig, PaymentMethodsAdminConfig } from "../types";

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: "plan-basico-freemium",
    nombre: "Plan Básico Freemium",
    subtitulo: "Acceso inicial gratuito al ecosistema clínico",
    descripcion:
      "Ideal para conocer la plataforma, explorar la interfaz de entrenamiento y probar reactivos demostrativos de tu carrera de salud.",
    badge: "Acceso Inicial",
    destacado: false,
    costoMensual: 0,
    costoAnual: 0,
    moneda: "USD",
    etiquetaCostoPendiente: "Sin costo ($0.00) • Configurable en Panel Admin",
    beneficios: [
      "Acceso al perfil académico según tu carrera y semestre",
      "Muestra demostrativa de preguntas de autoevaluación",
      "Lectura introductoria de guías y algoritmos básicos",
      "Panel de seguimiento básico de progreso"
    ],
    orden: 1
  },
  {
    id: "plan-universitario",
    nombre: "Plan Universitario",
    subtitulo: "Refuerzo integral semestre a semestre",
    descripcion:
      "Diseñado para estudiantes en formación desde Nivelación hasta semestres clínicos y pre-internado de todas las carreras de Ciencias de la Salud.",
    badge: "Estudiantes de Pregrado",
    destacado: true,
    costoMensual: 0,
    costoAnual: 0,
    moneda: "USD",
    etiquetaCostoPendiente: "Por definir en Panel del Administrador Maestro",
    beneficios: [
      "Contenido organizado según tu carrera y nivel académico actual",
      "Repetición espaciada y tarjetas de estudio activo",
      "Bancos de preguntas por asignaturas de ciencias básicas y clínicas",
      "Resúmenes, infografías y algoritmos diagnósticos descargables",
      "Acceso a tutorías y aulas de refuerzo universitario"
    ],
    orden: 2
  },
  {
    id: "plan-caces",
    nombre: "Plan CACES",
    subtitulo: "Preparación intensiva para el Examen de Habilitación Profesional",
    descripcion:
      "Entrenamiento de alto rendimiento enfocado en aprobar el Examen de Habilitación para el Ejercicio Profesional (CACES) e Internado Rotativo.",
    badge: "Alto Rendimiento CACES",
    destacado: false,
    costoMensual: 0,
    costoAnual: 0,
    moneda: "USD",
    etiquetaCostoPendiente: "Por definir en Panel del Administrador Maestro",
    beneficios: [
      "Simuladores cronometrados con estructura oficial CACES",
      "Retroalimentación clínica detallada con bibliografía oficial y GPC",
      "Estadísticas avanzadas por áreas, componentes y subtemas",
      "Bootcamp intensivo de resolución de casos clínicos reales",
      "Simulación clínica interactiva para toma de decisiones"
    ],
    orden: 3
  },
  {
    id: "plan-profesional",
    nombre: "Plan Profesional",
    subtitulo: "Actualización continua, Rural, Posgrado y Homologación",
    descripcion:
      "Dirigido a profesionales de la salud en medicatura rural, preparación de posgrados, homologación internacional y educación médica continua.",
    badge: "Médicos y Profesionales",
    destacado: false,
    costoMensual: 0,
    costoAnual: 0,
    moneda: "USD",
    etiquetaCostoPendiente: "Por definir en Panel del Administrador Maestro",
    beneficios: [
      "Acceso completo a todos los motores de simulación y bancos clínicos",
      "Guías y protocolos para el Año de Salud Rural y emergencias",
      "Módulos de psicometría, inglés médico B2 y homologación profesional",
      "Herramientas de apoyo para titulación e investigación clínica",
      "Certificados de entrenamiento y soporte prioritario VIP"
    ],
    orden: 4
  }
];

export const DEFAULT_PAYMENT_METHODS_CONFIG: PaymentMethodsAdminConfig = {
  qrTituloInstrucciones:
    "Instrucciones obligatorias para evitar errores al pagar con QR Bancario",
  qrInstruccionesEvitarErrores: [
    "1. Abre el aplicativo móvil de tu banco (Banca Móvil Pichincha / Deuna! o Banca Móvil Pacífico / Be) y elige la opción 'Escanear QR'.",
    "2. Verifica SIEMPRE antes de confirmar que el nombre del beneficiario corresponda exactamente al titular oficial configurado.",
    "3. Revisa que el monto ingresado coincida exactamente con la cuota (Mensual o Anual) del plan que elegiste.",
    "4. Guarda la captura de pantalla del pago exitoso y copia el Número de Comprobante o Documento para pegarlo en el formulario inferior."
  ],
  qrBancos: [
    {
      id: "qr-pichincha",
      banco: "Banco Pichincha",
      nombreApp: "Banca Móvil Pichincha / Deuna!",
      titular: "Anthonny Velasteguí • Makai Academy",
      cedulaRuc: "Por configurar en Panel Maestro",
      numeroCuenta: "Por configurar en Panel Maestro",
      qrImageUrl: "assets/2-pagos-bancarios/codigos-qr/qr-deuna.png",
      notaEspecifica:
        "Escanea este código desde la app de Banco Pichincha o Deuna! y verifica el nombre del titular antes de confirmar.",
      habilitado: true
    },
    {
      id: "qr-pacifico",
      banco: "Banco del Pacífico",
      nombreApp: "Banca Móvil Pacífico / Be",
      titular: "Anthonny Velasteguí • Makai Academy",
      cedulaRuc: "Por configurar en Panel Maestro",
      numeroCuenta: "Por configurar en Panel Maestro",
      qrImageUrl: "assets/2-pagos-bancarios/codigos-qr/qr-pacifico.png",
      notaEspecifica:
        "Escanea este código desde el aplicativo móvil de Banco del Pacífico y verifica el nombre del beneficiario.",
      habilitado: true
    }
  ],
  transferenciaTituloInstrucciones:
    "Instrucciones para Transferencia Bancaria o Depósito en Ventanilla / Mi Vecino / Tu Banco Banco Aquí",
  transferenciaInstrucciones: [
    "1. Selecciona una de nuestras 3 entidades bancarias habilitadas: Banco Pichincha, Banco del Pacífico o Banco Diners Club.",
    "2. Verifica cuidadosamente el Número de Cuenta, Tipo de Cuenta, Cédula/RUC y Nombre del Titular antes de ejecutar la transferencia o depósito.",
    "3. En el concepto o motivo de la transferencia escribe tu Nombre y Apellido más el nombre del Plan elegido.",
    "4. Una vez realizada la transacción, copia y pega el Número de Comprobante/Papeleta y sube la captura o fotografía legible del comprobante."
  ],
  cuentasTransferencia: [
    {
      id: "trans-pichincha",
      banco: "Banco Pichincha",
      tipoCuenta: "Cuenta de Ahorros",
      numeroCuenta: "2200000000 (Configurable en Panel Admin)",
      titular: "Anthonny Velasteguí",
      cedulaRuc: "1800000000 (Configurable en Panel Admin)",
      emailNotificacion: "anthonnyvelastegui@gmail.com",
      notaAdicional:
        "Acepta transferencias directas interbancarias y depósitos en agencias o corresponsales Mi Vecino.",
      habilitado: true
    },
    {
      id: "trans-pacifico",
      banco: "Banco del Pacífico",
      tipoCuenta: "Cuenta de Ahorros",
      numeroCuenta: "1000000000 (Configurable en Panel Admin)",
      titular: "Anthonny Velasteguí",
      cedulaRuc: "1800000000 (Configurable en Panel Admin)",
      emailNotificacion: "anthonnyvelastegui@gmail.com",
      notaAdicional:
        "Acepta transferencias desde cualquier banco y depósitos en agencias o puntos Tu Banco Banco Aquí.",
      habilitado: true
    },
    {
      id: "trans-diners",
      banco: "Banco Diners Club",
      tipoCuenta: "Cuenta de Ahorros / Financiera",
      numeroCuenta: "4000000000 (Configurable en Panel Admin)",
      titular: "Anthonny Velasteguí",
      cedulaRuc: "1800000000 (Configurable en Panel Admin)",
      emailNotificacion: "aavemakaihc@gmail.com",
      notaAdicional:
        "Transferencias directas e interbancarias a Banco Diners Club del Ecuador.",
      habilitado: true
    }
  ],
  payphoneHabilitado: false,
  payphoneTitulo: "Tarjeta de Crédito o Débito (PayPhone)",
  payphoneMensajePendiente:
    "La pasarela de pago con Tarjeta de Crédito o Débito mediante PayPhone se encuentra actualmente en etapa de integración y estará disponible próximamente. Por ahora, selecciona 'QR Bancario' o 'Transferencia o Depósito' para activar tu suscripción.",
  mensajeActivacion24Horas:
    "Has ingresado a la plataforma con el Plan Básico Freemium activo. Hemos recibido tu comprobante y, en un plazo máximo de 24 horas tras la verificación financiera, se habilitarán automáticamente todas las funciones correspondientes al plan que seleccionaste."
};
