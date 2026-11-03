// ============================================================================
// ARCHIVO: src/App.tsx
// DESCRIPCIÓN: Punto de Entrada Principal — Página de Inicio y Paso 1 de 3
// ============================================================================

import React from "react";
import { AuthProvider } from "./context/AuthContext";
import { HomeAuthPage } from "./components/HomeAuthPage";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <HomeAuthPage />
    </AuthProvider>
  );
};

export default App;
