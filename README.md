# Makai Academy • Ecosistema de Entrenamiento Clínico & CACES

Aplicación web médica interactiva construida en **React 19 + TypeScript + Vite + Tailwind CSS v4**, portando con total fidelidad la arquitectura de **Rieles de Acero v4.4** para las 11 carreras de la salud en Ecuador.

## Características Principales

1. **Túnel Académico de Carrera & Semestres**: Malla curricular oficial para 11 carreras de la salud (Medicina Humana, Enfermería, Odontología, Obstetricia, Fisioterapia, Laboratorio Clínico, Psicología, Nutrición, Bioquímica, Imagenología, Atención Prehospitalaria) con lanzadores contextuales de simuladores por materia.
2. **Simulador de Examen CACES**: Modos Estándar Oficial (100 reactivos con calificación sobre 100 y mínimo aprobatorio de 70), Práctica Rápida (Modo Tutor con Racional Clínico inmediato) y Refuerzo Crítico IA. Matriz de reactivos interactiva y cronómetro en vivo.
3. **Motor 1D: Sináptico v4.4 & Biblioteca DRM**: Repetición espaciada con curva del olvido de Ebbinghaus (intervalos de repaso) y Visor de Guías Clínicas (GPC del MSP de Ecuador).
4. **Estación de Simulación de Guardia y UCI (2D / 3D)**:
   - **Motor 2D**: Monitor multiparámetro con trazado electrocardiográfico (ECG) en vivo sobre canvas HTML5, instrumental médico (fonendoscopio con auscultación, ECG 12 derivaciones, oxígeno) y árbol de decisiones clínicas ramificadas.
   - **Motor 3D**: Entorno WebGL de reanimación UCI y trauma, examen cefalocaudal interactivo, administración de fármacos de reanimación y compresiones torácicas RCP.
5. **Aula Virtual & Streaming VOD**: Clases magistrales con protección DRM y chat en directo interactivo.
6. **Titulación, Examen Complexivo & Marketplace de Tutores VIP**: Conexión con especialistas verificados por SENESCYT, simulador de estaciones ECOE y Toolkit bioestadístico PICO con calculadora de tamaño muestral de Cochran.
7. **Salud Rural MSP & Inglés Médico B2**: Protocolos de emergencia para centros de salud rurales tipo A/B (CIE-10) y flashcards de inglés médico clínico.
8. **Telemetría & Copiloto Makai AI**: Diagnóstico de fortalezas y debilidades clínicas con historial de simulacros.
9. **Bóveda del Administrador Maestro (RBAC)**: Auditoría de comprobantes bancarios (Pichincha / DeUna / Banco del Pacífico), CMS en vivo de planes de suscripción y reseteo de dispositivos de hardware (1 PC + 1 Móvil).

## Ejecución

- `npm run dev`: Inicia el servidor de desarrollo en el puerto 3000 (`--host 0.0.0.0 --port 3000`).
- `npm run build`: Compila el proyecto con TypeScript y Vite.