// ============================================================================
// ARCHIVO: src/types/index.ts
// DESCRIPCIÓN: Modelos de Usuario, Paso 1 (Datos Personales), Paso 2 (Planes),
//              Paso 3 (Medios de Pago y Comprobante) y Configuración Admin.
// ============================================================================

export type UserRole = "master" | "admin" | "docente" | "estudiante" | "visitante";

export type IdentificationType = "cedula" | "pasaporte";

export type PlanBillingCycle = "mensual" | "anual";
export type BillingCycle = PlanBillingCycle;

export type PaymentMethodType = "qr_bancario" | "transferencia_deposito" | "tarjeta_payphone";

export interface PersonalDataStep1 {
  nombreApellido: string;
  nickname?: string;
  codigoPais: string;
  telefono: string;
  telefonoCompleto: string;
  email: string;
  tipoDocumento: IdentificationType;
  numeroDocumento: string;
  fotoDocumentoFrente: string; // Base64 / DataURL
  fotoDocumentoReverso: string; // Base64 / DataURL
  carreraId: string;
  carreraNombre: string;
  nivelAcademico: string;
  universidad?: string;
  emailVerificado: boolean;
  captchaVerificado: boolean;
  paso1CompletadoEn: string;
}

export interface SubscriptionPlanConfig {
  id: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  badge: string;
  destacado: boolean;
  costoMensual: number;
  costoAnual: number;
  moneda: string;
  etiquetaCostoPendiente: string;
  beneficios: string[];
  orden: number;
}

export interface SelectedPlanStep2 {
  planId: string;
  planNombre: string;
  cicloFacturacion: PlanBillingCycle;
  costoAplicado: number;
  moneda: string;
  paso2CompletadoEn: string;
}

// 1) Configuración de cada QR Bancario (Banco Pichincha y Banco del Pacífico)
export interface QRBankItemConfig {
  id: string; // "qr-pichincha" | "qr-pacifico"
  banco: string;
  nombreApp: string;
  titular: string;
  cedulaRuc: string;
  numeroCuenta: string;
  qrImageUrl: string;
  notaEspecifica: string;
  habilitado: boolean;
}

// 2) Configuración de cada Cuenta para Transferencia o Depósito (Pichincha, Pacífico y Diners Club)
export interface TransferBankAccountConfig {
  id: string; // "trans-pichincha" | "trans-pacifico" | "trans-diners"
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  cedulaRuc: string;
  emailNotificacion: string;
  notaAdicional: string;
  habilitado: boolean;
}

// Configuración Global de Medios de Pago editable desde el Panel del Administrador Maestro
export interface PaymentMethodsAdminConfig {
  qrTituloInstrucciones: string;
  qrInstruccionesEvitarErrores: string[];
  qrBancos: QRBankItemConfig[];
  transferenciaTituloInstrucciones: string;
  transferenciaInstrucciones: string[];
  cuentasTransferencia: TransferBankAccountConfig[];
  payphoneHabilitado: boolean;
  payphoneTitulo: string;
  payphoneMensajePendiente: string;
  mensajeActivacion24Horas: string;
  updatedAt?: string;
}

// Registro de Comprobante enviado por el usuario en el Paso 3 de 3
export interface PaymentSubmissionStep3 {
  id: string;
  uid: string;
  email: string;
  nombreUsuario: string;
  metodoPago: PaymentMethodType;
  entidadBancariaId: string;
  entidadBancariaNombre: string;
  numeroComprobante: string;
  fotoComprobante: string; // Base64 / DataURL de la captura o foto del comprobante
  planSolicitadoId: string;
  planSolicitadoNombre: string;
  cicloFacturacion: PlanBillingCycle;
  montoPagado: number;
  moneda: string;
  planActivadoTemporal: string; // "Plan Básico Freemium"
  estadoVerificacion: "pendiente_24h" | "aprobado" | "rechazado";
  paso3CompletadoEn: string;
}

export interface UserModel {
  uid: string;
  email: string;
  nombre: string;
  nickname?: string;
  rol: UserRole;
  metodoIngreso: "google" | "email";
  emailVerified: boolean;
  registroPasoActual: 1 | 2 | 3 | "completado";
  planActivoId: string; // "plan-basico-freemium" mientras está pendiente de validación 24h
  planActivoNombre: string;
  planPendienteAprobacion?: {
    planId: string;
    planNombre: string;
    cicloFacturacion: PlanBillingCycle;
    enviadoEn: string;
    plazoMaximoHoras: number;
  } | null;
  datosPersonales?: PersonalDataStep1;
  datosPlanPaso2?: SelectedPlanStep2;
  datosPagoPaso3?: PaymentSubmissionStep3;
  createdAt?: string;
  lastLoginAt?: string;
}
