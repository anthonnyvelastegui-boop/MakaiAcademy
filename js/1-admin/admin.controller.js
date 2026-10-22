// Fragmento de integración dentro de js/1-admin/admin.controller.js
import { initAdminBackups } from "./admin.backups.js";

export function initAdmin() {
    // Inicializa la Bóveda de Seguridad y enlaza los botones .JSON y .CSV
    initAdminBackups();
}
