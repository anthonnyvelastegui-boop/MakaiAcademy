// js/2-core/router.spa.js
import { auth, db, signOut, doc, getDocs, addDoc, updateDoc, collection } from "./firebase.service.js";
import { appState, isMasterAdmin } from "./state.store.js";
import { HEALTH_CAREERS_11, CACES_OFFICIAL_SUBJECTS, getUniversalSubjectsByLevel, SEED_CLINICAL_CASES } from "./curriculum.data.js";

let selectedCarreraId = "medicina";
let selectedLevelKey = "preuniversitario";
let selectedCacesCareer = "medicina";
let selectedCacesSubject = null;
let selectedCacesDifficulty = "Intermedio";
let selectedExamMode = "tutor";

let examQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let markedForReview = new Set();
let examTimerInterval = null;
let examTimeRemaining = 0;

let spacedDeck = [];
let spacedIndex = 0;
let reviewedTodayCount = 0;

export function initDashboardSPA(user, userData) {
    // 1. Poner datos reales del usuario en Sidebar, Header y Vista de Perfil
    const displayName = userData.nombre || user.displayName || user.email.split("@")[0];
    const planName = `Plan ${userData.subscriptionLevel || "Básico"}`;

    const elName = document.getElementById("user-name");
    const elAvatar = document.getElementById("user-avatar");
    const elPlan = document.getElementById("user-plan");
    const elHeaderName = document.getElementById("header-user-name");

    if (elName) elName.textContent = displayName;
    if (elAvatar) elAvatar.textContent = displayName.charAt(0).toUpperCase();
    if (elPlan) elPlan.textContent = planName;
    if (elHeaderName) elHeaderName.textContent = displayName;

    // 2. Desbloquear Bóveda Admin para cuentas maestras autorizadas
    if (isMasterAdmin(user.email)) {
        document.getElementById("admin-nav-btn")?.classList.remove("hidden");
        document.getElementById("header-admin-btn")?.classList.remove("hidden");
    }

    // 3. Cerrar Sesión
    document.getElementById("btn-logout")?.addEventListener("click", () => signOut(auth));

    // 4. Navegación Principal del Sidebar
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            if (appState.isExamActive) {
                if (!confirm("Tienes un simulacro CACES en curso. ¿Deseas salir y cancelar el intento?")) return;
                quitExam();
            }
            highlightSidebarBtn(btn);
            switchView(btn.dataset.target);
        });
    });

    // 5. Desplegable SIMULADORES (1D, 2D y 3D) en el Sidebar
    const btnToggleSim = document.getElementById("btn-toggle-simulators");
    const simSubmenu = document.getElementById("simulators-submenu");
    const simChevron = document.getElementById("simulators-chevron");

    btnToggleSim?.addEventListener("click", () => {
        simSubmenu?.classList.toggle("hidden");
        simChevron?.classList.toggle("rotate-180");
    });

    document.querySelectorAll(".sim-engine-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const engine = btn.dataset.engine || "2D";
            openSimulatorsEngine(engine);
        });
    });

    // 6. Accesos Rápidos a Aulas Virtuales, Mis Métricas, Sináptico, Perfil y Admin
    document.querySelectorAll(".btn-quick-classrooms").forEach(b => b.addEventListener("click", () => switchView("view-classrooms")));
    document.querySelectorAll(".btn-quick-metrics").forEach(b => b.addEventListener("click", () => { renderMetrics(); switchView("view-metrics"); }));
    document.querySelectorAll(".btn-quick-spaced").forEach(b => b.addEventListener("click", () => { initSpacedView(); switchView("view-spaced"); }));

    document.getElementById("user-profile-btn")?.addEventListener("click", () => openProfileView(user, userData));
    document.getElementById("header-profile-pill")?.addEventListener("click", () => openProfileView(user, userData));
    document.getElementById("header-admin-btn")?.addEventListener("click", () => switchView("view-admin"));

    // 7. Inicializar Submódulos
    initMusicPlayerCC0();
    initCarreraFlow();
    initCacesFlow();
    initSimulatorControls();
    initSpacedControls();
    initRuralControls();
    initUCI104Actions();
    initAdminVault();
    renderMetrics();

    document.querySelectorAll(".upcoming-feature").forEach(btn => {
        btn.addEventListener("click", () => showToast("Módulo en calibración final", "Disponible próximamente en Makai Academy"));
    });
}

function highlightSidebarBtn(activeBtn) {
    document.querySelectorAll(".nav-btn").forEach(b => {
        b.classList.remove("bg-primary", "text-surface", "shadow-[0_0_20px_rgba(0,229,255,0.25)]");
        if (!b.id.includes("admin")) b.classList.add("text-gray-300");
    });
    activeBtn.classList.remove("text-gray-300");
    activeBtn.classList.add("bg-primary", "text-surface", "shadow-[0_0_20px_rgba(0,229,255,0.25)]");
}

export function switchView(viewId) {
    document.querySelectorAll(".tab-content").forEach(el => {
        el.classList.remove("active");
        el.classList.add("hidden");
    });
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }
}

export function showToast(title, subtitle) {
    const toast = document.getElementById("toast");
    const tTitle = document.getElementById("toast-title");
    const tSub = document.getElementById("toast-subtitle");
    if (!toast) return;
    if (tTitle) tTitle.textContent = title;
    if (tSub) tSub.textContent = subtitle;
    toast.classList.remove("translate-y-24", "opacity-0");
    setTimeout(() => toast.classList.add("translate-y-24", "opacity-0"), 3200);
}

// ============================================================================
// FLUJO 1: CARRERA (11 CARRERAS -> NIVELES/SEMESTRES -> MATERIAS UNIVERSALES)
// ============================================================================
function initCarreraFlow() {
    const step1 = document.getElementById("carrera-step-1-list");
    const step2 = document.getElementById("carrera-step-2-levels");
    const step3 = document.getElementById("carrera-step-3-subjects");
    const breadcrumb = document.getElementById("carrera-breadcrumb");
    const title = document.getElementById("carrera-main-title");
    const subtitle = document.getElementById("carrera-main-subtitle");

    function renderStep1Careers() {
        step1.classList.remove("hidden");
        step2.classList.add("hidden");
        step3.classList.add("hidden");
        breadcrumb.textContent = "MÓDULO UNIVERSITARIO • PASO 1 DE 3";
        title.textContent = "Carreras de Ciencias de la Salud";
        subtitle.textContent = "Selecciona tu carrera para acceder a Preuniversitario, Nivelación y todos los semestres académicos.";

        step1.innerHTML = "";
        HEALTH_CAREERS_11.forEach(c => {
            const card = document.createElement("div");
            card.className = "bg-surface-container border border-surface-high hover:border-primary rounded-2xl p-5 cursor-pointer transition-all group flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-surface transition-colors">
                            <span class="material-symbols-outlined">${c.icono}</span>
                        </div>
                        <span class="text-[10px] font-mono px-2.5 py-1 rounded-full ${c.caces ? "bg-secondary/15 text-secondary border border-secondary/30" : "bg-surface text-gray-400 border border-surface-high"}">
                            ${c.semestres} Semestres
                        </span>
                    </div>
                    <h3 class="text-base font-extrabold text-white group-hover:text-primary transition-colors mb-1">${c.nombre}</h3>
                    <p class="text-xs text-gray-400 leading-relaxed">${c.descripcion}</p>
                </div>
                <div class="mt-4 pt-3 border-t border-surface-high flex items-center justify-between text-xs font-mono text-primary">
                    <span>Abrir Niveles y Semestres</span>
                    <span class="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
            `;
            card.addEventListener("click", () => {
                selectedCarreraId = c.id;
                renderStep2Levels(c);
            });
            step1.appendChild(card);
        });
    }

    function renderStep2Levels(careerObj) {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
        step3.classList.add("hidden");
        breadcrumb.textContent = `${careerObj.nombre.toUpperCase()} • PASO 2 DE 3`;
        title.textContent = `${careerObj.nombre} • Niveles Académicos`;
        subtitle.textContent = "Selecciona Preuniversitario, Nivelación o el semestre que estás cursando actualmente.";

        const grid = document.getElementById("carrera-levels-grid");
        grid.innerHTML = "";

        const levels = [
            { key: "preuniversitario", label: "Preuniversitario", tag: "ADMISIÓN", desc: "Biología, Química, Anatomía de Admisión y Razonamiento." },
            { key: "nivelacion", label: "Nivelación General", tag: "BASES", desc: "Morfofisiología, Terminología Médica y Química Orgánica." }
        ];

        for (let i = 1; i <= careerObj.semestres; i++) {
            const isInternado = careerObj.id === "medicina" && i >= 11;
            levels.push({
                key: `sem-${i}`,
                label: isInternado ? `${i}.º Nivel (Internado Rotativo)` : `${i}.º Semestre`,
                tag: isInternado ? "HOSPITALARIO" : `NIVEL ${i}`,
                desc: `Malla curricular universal de ${i}.º semestre para universidades del Ecuador.`
            });
        }

        levels.forEach(lvl => {
            const btn = document.createElement("div");
            btn.className = "bg-surface-container border border-surface-high hover:border-primary rounded-2xl p-4 cursor-pointer transition-all group";
            btn.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold">${lvl.tag}</span>
                    <span class="material-symbols-outlined text-gray-500 group-hover:text-primary text-base">folder_open</span>
                </div>
                <h4 class="text-sm font-extrabold text-white group-hover:text-primary mb-1">${lvl.label}</h4>
                <p class="text-[11px] text-gray-400">${lvl.desc}</p>
            `;
            btn.addEventListener("click", () => {
                selectedLevelKey = lvl.key;
                renderStep3Subjects(careerObj, lvl);
            });
            grid.appendChild(btn);
        });
    }

    function renderStep3Subjects(careerObj, lvlObj) {
        step1.classList.add("hidden");
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
        breadcrumb.textContent = `${careerObj.nombre.toUpperCase()} • ${lvlObj.label.toUpperCase()} • PASO 3 DE 3`;
        title.textContent = `Materias de ${lvlObj.label}`;
        subtitle.textContent = `Pensum universal de ${careerObj.nombre}. Elige cómo deseas estudiar cada materia.`;

        const badge = document.getElementById("selected-level-badge");
        if (badge) badge.textContent = `${careerObj.nombre} • ${lvlObj.label}`;

        const sGrid = document.getElementById("carrera-subjects-grid");
        sGrid.innerHTML = "";
        const subjects = getUniversalSubjectsByLevel(careerObj.id, lvlObj.key);

        subjects.forEach(subj => {
            const item = document.createElement("div");
            item.className = "bg-surface-container border border-surface-high rounded-2xl p-5 flex flex-col justify-between";
            item.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-mono text-secondary bg-secondary/10 border border-secondary/30 px-2.5 py-0.5 rounded font-bold">MATERIA UNIVERSAL</span>
                        <span class="material-symbols-outlined text-primary">menu_book</span>
                    </div>
                    <h4 class="text-base font-extrabold text-white mb-2">${subj}</h4>
                    <p class="text-xs text-gray-400 mb-4">Banco de preguntas por asignatura, tarjetas Sináptico v4.4, resúmenes PDF y clases grabadas.</p>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-3 border-t border-surface-high">
                    <button class="btn-subj-sim bg-primary/15 border border-primary/40 hover:bg-primary hover:text-surface text-primary text-xs font-mono font-bold py-2 px-3 rounded-xl transition-all">
                        🎯 Simulador
                    </button>
                    <button class="btn-subj-spaced bg-secondary/15 border border-secondary/40 hover:bg-secondary hover:text-surface text-secondary text-xs font-mono font-bold py-2 px-3 rounded-xl transition-all">
                        🧠 Sináptico
                    </button>
                </div>
            `;
            item.querySelector(".btn-subj-sim")?.addEventListener("click", () => {
                selectedCacesCareer = careerObj.caces ? careerObj.id : "medicina";
                selectedCacesSubject = subj;
                startExam();
            });
            item.querySelector(".btn-subj-spaced")?.addEventListener("click", () => {
                initSpacedView(careerObj.caces ? careerObj.id : "medicina", subj);
                switchView("view-spaced");
            });
            sGrid.appendChild(item);
        });
    }

    document.getElementById("btn-back-to-careers")?.addEventListener("click", renderStep1Careers);
    document.getElementById("btn-back-to-levels")?.addEventListener("click", () => {
        const c = HEALTH_CAREERS_11.find(x => x.id === selectedCarreraId) || HEALTH_CAREERS_11[0];
        renderStep2Levels(c);
    });

    renderStep1Careers();
}

// ============================================================================
// FLUJO 2: CACES (4 CARRERAS OFICIALES + MATERIAS + 4 NIVELES DE DIFICULTAD)
// ============================================================================
function initCacesFlow() {
    const cacesStep1 = document.getElementById("caces-step-1-careers");
    const cacesStep2 = document.getElementById("caces-step-2-dashboard");
    const cacesCareers = HEALTH_CAREERS_11.filter(c => c.caces);

    function renderCacesStep1() {
        cacesStep1.classList.remove("hidden");
        cacesStep2.classList.add("hidden");
        cacesStep1.innerHTML = "";

        cacesCareers.forEach(c => {
            const card = document.createElement("div");
            card.className = "bg-surface-container border border-surface-high hover:border-primary rounded-2xl p-6 cursor-pointer transition-all group flex flex-col justify-between";
            const subjects = CACES_OFFICIAL_SUBJECTS[c.id] || [];
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-surface transition-all">
                            <span class="material-symbols-outlined text-2xl">${c.icono}</span>
                        </div>
                        <span class="text-xs font-mono font-bold bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full">
                            HABILITADA CACES
                        </span>
                    </div>
                    <h3 class="text-xl font-extrabold text-white group-hover:text-primary transition-colors mb-2">${c.nombre}</h3>
                    <p class="text-xs text-gray-400 mb-4">Incluye los ${subjects.length} ejes curriculares oficiales evaluados en el examen nacional CACES, simuladores por nivel y repetición sináptica.</p>
                </div>
                <div class="pt-4 border-t border-surface-high flex items-center justify-between text-xs font-mono font-bold text-primary">
                    <span>Entrar al Módulo CACES de ${c.nombre}</span>
                    <span class="material-symbols-outlined text-base">arrow_forward</span>
                </div>
            `;
            card.addEventListener("click", () => {
                selectedCacesCareer = c.id;
                selectedCacesSubject = null;
                renderCacesStep2(c);
            });
            cacesStep1.appendChild(card);
        });
    }

    function renderCacesStep2(careerObj) {
        cacesStep1.classList.add("hidden");
        cacesStep2.classList.remove("hidden");

        const badge = document.getElementById("caces-active-career-badge");
        if (badge) badge.textContent = `${careerObj.nombre} • CACES Oficial`;

        const sGrid = document.getElementById("caces-subjects-interactive-grid");
        sGrid.innerHTML = "";
        const subjects = CACES_OFFICIAL_SUBJECTS[careerObj.id] || [];

        subjects.forEach(subj => {
            const card = document.createElement("div");
            card.className = "bg-surface border border-surface-high hover:border-primary/60 rounded-xl p-4 transition-all";
            card.innerHTML = `
                <button class="w-full flex items-center justify-between text-left font-bold text-sm text-white hover:text-primary transition-colors">
                    <span>${subj}</span>
                    <span class="material-symbols-outlined text-primary text-base">expand_more</span>
                </button>
                <div class="subj-actions hidden mt-3 pt-3 border-t border-surface-high space-y-2">
                    <button class="btn-caces-subj-sim w-full py-2 px-3 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-surface text-xs font-mono font-bold text-left flex items-center justify-between transition-all">
                        <span>🎯 Simulador de la materia</span>
                        <span class="material-symbols-outlined text-sm">play_arrow</span>
                    </button>
                    <button class="btn-caces-subj-spaced w-full py-2 px-3 rounded-lg bg-secondary/15 border border-secondary/40 text-secondary hover:bg-secondary hover:text-surface text-xs font-mono font-bold text-left flex items-center justify-between transition-all">
                        <span>🧠 Repetición Sináptica</span>
                        <span class="material-symbols-outlined text-sm">bolt</span>
                    </button>
                </div>
            `;
            const headerBtn = card.querySelector("button");
            const actionsDiv = card.querySelector(".subj-actions");
            headerBtn.addEventListener("click", () => {
                actionsDiv.classList.toggle("hidden");
            });

            card.querySelector(".btn-caces-subj-sim")?.addEventListener("click", () => {
                selectedCacesSubject = subj;
                startExam();
            });
            card.querySelector(".btn-caces-subj-spaced")?.addEventListener("click", () => {
                initSpacedView(careerObj.id, subj);
                switchView("view-spaced");
            });
            sGrid.appendChild(card);
        });
    }

    document.getElementById("btn-back-caces-careers")?.addEventListener("click", renderCacesStep1);

    // Selección de los 4 Niveles de Dificultad CACES
    document.querySelectorAll(".caces-diff-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".caces-diff-btn").forEach(b => {
                b.classList.remove("border-2", "border-primary", "bg-surface-high");
                b.classList.add("border", "border-surface-high", "bg-surface");
            });
            btn.classList.remove("border", "border-surface-high", "bg-surface");
            btn.classList.add("border-2", "border-primary", "bg-surface-high");
            selectedCacesDifficulty = btn.dataset.diff || "Intermedio";
        });
    });

    // Selección de los 3 Modos (Estándar, Tutor, Crítico)
    document.querySelectorAll(".exam-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            if (mode === "standard" && appState.currentUserData?.subscriptionLevel === "Básico" && !isMasterAdmin(appState.currentUser?.email)) {
                showFreemiumModal();
                return;
            }
            document.querySelectorAll(".exam-mode-btn").forEach(b => {
                b.classList.remove("border-2", "border-primary", "bg-surface-high");
                b.classList.add("border", "border-surface-high", "bg-surface");
            });
            btn.classList.remove("border", "border-surface-high", "bg-surface");
            btn.classList.add("border-2", "border-primary", "bg-surface-high");
            selectedExamMode = mode;
        });
    });

    document.getElementById("btn-start-exam")?.addEventListener("click", () => {
        selectedCacesSubject = null;
        startExam();
    });

    document.getElementById("btn-open-general-sinaptico")?.addEventListener("click", () => {
        initSpacedView(selectedCacesCareer, null);
        switchView("view-spaced");
    });

    renderCacesStep1();
}

// ============================================================================
// SIMULADOR CACES ACTIVO (CRONÓMETRO AISLADO + MATRIZ + CALIFICACIÓN)
// ============================================================================
export async function startExam() {
    const userData = appState.currentUserData;
    if (userData?.subscriptionLevel === "Básico" && (userData?.casesUsedThisMonth || 0) >= 15 && !isMasterAdmin(appState.currentUser?.email)) {
        showFreemiumModal();
        return;
    }

    let pool = [...SEED_CLINICAL_CASES.filter(c => c.carrera === selectedCacesCareer)];

    try {
        const snap = await getDocs(collection(db, "preguntas_caces"));
        snap.forEach(d => {
            const q = d.data();
            if (q.carrera === selectedCacesCareer) {
                pool.push({ id: d.id, ...q });
            }
        });
    } catch (e) {
        console.warn("Usando banco semilla local:", e);
    }

    if (selectedCacesSubject) {
        const filteredBySubj = pool.filter(q => q.materia === selectedCacesSubject);
        if (filteredBySubj.length > 0) pool = filteredBySubj;
    }

    if (pool.length === 0) {
        pool = [...SEED_CLINICAL_CASES];
    }

    pool.sort(() => 0.5 - Math.random());
    const maxLen = selectedExamMode === "tutor" ? 20 : (selectedExamMode === "critical" ? 30 : 100);
    examQuestions = pool.slice(0, Math.min(maxLen, pool.length));

    appState.isExamActive = true;
    currentQuestionIndex = 0;
    userAnswers = {};
    markedForReview = new Set();

    const durationMap = { standard: 150 * 60, tutor: 30 * 60, critical: 45 * 60 };
    examTimeRemaining = durationMap[selectedExamMode] || 1800;

    const careerName = HEALTH_CAREERS_11.find(c => c.id === selectedCacesCareer)?.nombre || "CACES";
    const subjText = selectedCacesSubject ? ` • ${selectedCacesSubject}` : ` • Nivel ${selectedCacesDifficulty}`;
    document.getElementById("exam-context").textContent = `${careerName}${subjText} • Modo ${selectedExamMode.toUpperCase()}`;

    switchView("view-simulator");
    renderExamQuestion();
    renderMatrix();

    clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        examTimeRemaining--;
        if (examTimeRemaining <= 0) {
            clearInterval(examTimerInterval);
            submitExam();
        } else {
            const h = Math.floor(examTimeRemaining / 3600).toString().padStart(2, "0");
            const m = Math.floor((examTimeRemaining % 3600) / 60).toString().padStart(2, "0");
            const s = (examTimeRemaining % 60).toString().padStart(2, "0");
            const timerEl = document.getElementById("exam-timer");
            if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
        }
    }, 1000);
}

function initSimulatorControls() {
    document.getElementById("btn-exit-exam")?.addEventListener("click", () => {
        if (confirm("¿Deseas salir del simulacro actual?")) quitExam();
    });
    document.getElementById("btn-submit-exam")?.addEventListener("click", () => {
        if (confirm("¿Deseas concluir el simulacro y calificar tu intento?")) submitExam();
    });
    document.getElementById("btn-mark-review")?.addEventListener("click", () => {
        if (markedForReview.has(currentQuestionIndex)) {
            markedForReview.delete(currentQuestionIndex);
        } else {
            markedForReview.add(currentQuestionIndex);
        }
        renderMatrix();
    });
    document.getElementById("btn-next-tutor")?.addEventListener("click", () => {
        if (currentQuestionIndex < examQuestions.length - 1) {
            currentQuestionIndex++;
            renderExamQuestion();
            renderMatrix();
        } else {
            submitExam();
        }
    });
}

function renderExamQuestion() {
    const q = examQuestions[currentQuestionIndex];
    if (!q) return;

    document.getElementById("q-counter").textContent = `Reactivo ${currentQuestionIndex + 1} / ${examQuestions.length}`;
    document.getElementById("q-difficulty").textContent = `Nivel: ${q.dificultad || selectedCacesDifficulty}`;
    document.getElementById("q-subject-label").textContent = q.materia || "Caso Clínico CACES";
    document.getElementById("q-text").textContent = q.enunciado;

    const rationalDiv = document.getElementById("q-rational");
    rationalDiv.classList.add("hidden");

    const optContainer = document.getElementById("q-options");
    optContainer.innerHTML = "";
    const isAnswered = userAnswers[currentQuestionIndex] !== undefined;

    ["A", "B", "C", "D"].forEach(letter => {
        if (q.opciones && q.opciones[letter]) {
            const btn = document.createElement("button");
            let cls = "w-full text-left p-4 rounded-xl border text-sm transition-all flex gap-3 items-start ";

            if (isAnswered && selectedExamMode === "tutor") {
                if (letter === q.respuestaCorrecta) {
                    cls += "border-secondary bg-secondary/10 text-white font-semibold";
                } else if (userAnswers[currentQuestionIndex].chosen === letter) {
                    cls += "border-danger bg-danger/10 text-white";
                } else {
                    cls += "border-surface-high bg-surface text-gray-500 opacity-55";
                }
                btn.disabled = true;
            } else if (isAnswered && userAnswers[currentQuestionIndex].chosen === letter) {
                cls += "border-primary bg-primary/15 text-white font-semibold";
            } else {
                cls += "border-surface-high bg-surface text-gray-200 hover:border-primary/60 hover:bg-surface-high";
            }

            btn.className = cls;
            btn.innerHTML = `<span class="font-mono font-extrabold text-primary">${letter}.</span> <span>${q.opciones[letter]}</span>`;
            if (!btn.disabled) {
                btn.addEventListener("click", () => {
                    userAnswers[currentQuestionIndex] = {
                        chosen: letter,
                        isCorrect: letter === q.respuestaCorrecta
                    };
                    renderExamQuestion();
                    renderMatrix();
                });
            }
            optContainer.appendChild(btn);
        }
    });

    if (isAnswered && selectedExamMode === "tutor") {
        rationalDiv.classList.remove("hidden");
        document.getElementById("q-rational-text").textContent = q.racional || "Justificación clínica verificada según GPC-MSP.";
    }
}

function renderMatrix() {
    const grid = document.getElementById("matrix-grid");
    if (!grid) return;
    grid.innerHTML = "";

    for (let i = 0; i < examQuestions.length; i++) {
        const btn = document.createElement("button");
        btn.textContent = i + 1;
        let cls = "w-full aspect-square rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all border ";

        if (i === currentQuestionIndex) cls += "ring-2 ring-white ";
        if (userAnswers[i]) {
            cls += "bg-primary text-surface border-primary";
        } else if (markedForReview.has(i)) {
            cls += "bg-warning text-surface border-warning";
        } else {
            cls += "bg-surface text-gray-400 border-surface-high hover:border-gray-500";
        }
        btn.className = cls;
        btn.addEventListener("click", () => {
            currentQuestionIndex = i;
            renderExamQuestion();
            renderMatrix();
        });
        grid.appendChild(btn);
    }
}

function quitExam() {
    clearInterval(examTimerInterval);
    appState.isExamActive = false;
    switchView("view-caces");
}

async function submitExam() {
    clearInterval(examTimerInterval);
    appState.isExamActive = false;

    let correct = 0;
    Object.values(userAnswers).forEach(a => { if (a.isCorrect) correct++; });
    const score = examQuestions.length > 0 ? (correct / examQuestions.length) * 100 : 0;
    const passed = score >= 70;

    alert(`Simulacro CACES Concluido\nNota Final: ${score.toFixed(1)} / 100\nEstado: ${passed ? "✅ APROBADO (Estándar CACES >=70%)" : "❌ EN REFUERZO (<70%)"}`);

    if (appState.currentUserData && appState.currentUser) {
        const uData = appState.currentUserData;
        uData.totalExamsCompleted = (uData.totalExamsCompleted || 0) + 1;
        uData.casesUsedThisMonth = (uData.casesUsedThisMonth || 0) + (Object.keys(userAnswers).length || examQuestions.length);
        uData.globalAverage = (((uData.globalAverage || 0) * (uData.totalExamsCompleted - 1)) + score) / uData.totalExamsCompleted;

        try {
            await updateDoc(doc(db, "usuarios", appState.currentUser.uid), {
                totalExamsCompleted: uData.totalExamsCompleted,
                casesUsedThisMonth: uData.casesUsedThisMonth,
                globalAverage: uData.globalAverage
            });
        } catch (err) {
            console.warn("No se pudo sincronizar métrica en Firestore:", err);
        }
    }

    renderMetrics();
    switchView("view-metrics");
}

// ============================================================================
// REPETICIÓN ESPACIADA • SINÁPTICO v4.4
// ============================================================================
function initSpacedView(careerFilter = "medicina", subjectFilter = null) {
    spacedDeck = SEED_CLINICAL_CASES.filter(c => !careerFilter || c.carrera === careerFilter);
    if (subjectFilter) {
        const bySubj = spacedDeck.filter(c => c.materia === subjectFilter);
        if (bySubj.length > 0) spacedDeck = bySubj;
    }
    if (spacedDeck.length === 0) spacedDeck = [...SEED_CLINICAL_CASES];
    spacedIndex = 0;
    renderSpacedCard();
}

function renderSpacedCard() {
    const fcFront = document.getElementById("fc-front");
    const fcBack = document.getElementById("fc-back");
    const fcAnswer = document.getElementById("fc-answer");
    const fcCategory = document.getElementById("fc-category");
    const btnShow = document.getElementById("btn-show-answer");
    const controls = document.getElementById("fc-controls");

    if (spacedDeck.length === 0) {
        fcFront.textContent = "¡Excelente! Has completado todas las tarjetas programadas para esta sesión.";
        fcBack.classList.add("hidden");
        btnShow.classList.add("hidden");
        controls.classList.add("hidden");
        return;
    }

    const card = spacedDeck[spacedIndex % spacedDeck.length];
    fcCategory.textContent = `${card.carrera.toUpperCase()} • ${card.materia}`;
    fcFront.textContent = card.enunciado;
    fcAnswer.textContent = `${card.opciones[card.respuestaCorrecta]} — ${card.racional}`;

    document.getElementById("spaced-counter-badge").textContent = `Tarjeta ${(spacedIndex % spacedDeck.length) + 1} de ${spacedDeck.length}`;
    document.getElementById("fc-reviewed-today").textContent = reviewedTodayCount;
    document.getElementById("fc-remaining-queue").textContent = spacedDeck.length;

    fcBack.classList.add("hidden");
    btnShow.classList.remove("hidden");
    controls.classList.add("hidden");
}

function initSpacedControls() {
    const btnShow = document.getElementById("btn-show-answer");
    const fcBack = document.getElementById("fc-back");
    const controls = document.getElementById("fc-controls");

    btnShow?.addEventListener("click", () => {
        fcBack.classList.remove("hidden");
        btnShow.classList.add("hidden");
        controls.classList.remove("hidden");
    });

    controls?.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            reviewedTodayCount++;
            spacedIndex++;
            renderSpacedCard();
        });
    });

    document.getElementById("spaced-deck-selector")?.addEventListener("change", (e) => {
        initSpacedView(e.target.value, null);
    });

    document.getElementById("btn-back-from-spaced")?.addEventListener("click", () => switchView("view-caces"));

    document.addEventListener("keydown", (e) => {
        const spacedView = document.getElementById("view-spaced");
        if (spacedView && spacedView.classList.contains("active") && e.code === "Space" && !btnShow.classList.contains("hidden")) {
            e.preventDefault();
            btnShow.click();
        }
    });

    initSpacedView("medicina", null);
}

// ============================================================================
// REPRODUCTOR DE MÚSICA LIBRE DE DERECHOS DE AUTOR (CC0 WEB AUDIO + MP3)
// ============================================================================
function initMusicPlayerCC0() {
    let audioCtx = null;
    let isPlaying = false;
    let oscNode = null;
    let gainNode = null;

    const btnPlay = document.getElementById("btn-music-Toggle");
    const playIcon = document.getElementById("music-play-icon");
    const eqBox = document.getElementById("music-eq");
    const statusLabel = document.getElementById("music-status-label");
    const trackSelect = document.getElementById("cc0-track-select");
    const volSlider = document.getElementById("music-volume");
    const localInput = document.getElementById("local-mp3-input");
    const audioEl = document.getElementById("cc0-audio-element");

    function stopAmbientSynth() {
        if (oscNode) {
            try { oscNode.stop(); oscNode.disconnect(); } catch (e) {}
            oscNode = null;
        }
    }

    function startAmbientSynth(mode) {
        stopAmbientSynth();
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        oscNode = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();
        const freqMap = { alpha: 432, lofi: 285, ambient: 396 };
        oscNode.type = "sine";
        oscNode.frequency.setValueAtTime(freqMap[mode] || 432, audioCtx.currentTime);
        gainNode.gain.setValueAtTime((parseFloat(volSlider?.value || "0.5") * 0.08), audioCtx.currentTime);
        oscNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscNode.start();
    }

    function toggleMusic() {
        if (isPlaying) {
            isPlaying = false;
            audioEl?.pause();
            stopAmbientSynth();
            if (playIcon) playIcon.textContent = "play_arrow";
            eqBox?.classList.remove("eq-playing");
            if (statusLabel) statusLabel.textContent = "PAUSA";
        } else {
            isPlaying = true;
            if (audioEl && audioEl.src && audioEl.src.startsWith("blob:")) {
                audioEl.volume = parseFloat(volSlider?.value || "0.5");
                audioEl.play();
            } else {
                startAmbientSynth(trackSelect?.value || "alpha");
            }
            if (playIcon) playIcon.textContent = "pause";
            eqBox?.classList.add("eq-playing");
            if (statusLabel) statusLabel.textContent = "ON AIR";
        }
    }

    btnPlay?.addEventListener("click", toggleMusic);
    trackSelect?.addEventListener("change", () => {
        if (audioEl) audioEl.src = "";
        if (isPlaying) startAmbientSynth(trackSelect.value);
    });
    volSlider?.addEventListener("input", () => {
        const v = parseFloat(volSlider.value);
        if (audioEl) audioEl.volume = v;
        if (gainNode && audioCtx) gainNode.gain.setValueAtTime(v * 0.08, audioCtx.currentTime);
    });
    localInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file || !audioEl) return;
        stopAmbientSynth();
        audioEl.src = URL.createObjectURL(file);
        isPlaying = false;
        toggleMusic();
        showToast("MP3 Personal Cargado", file.name);
    });
}

// ============================================================================
// SIMULADORES 1D, 2D Y 3D + MONITOR HEMODINÁMICO UCI-104
// ============================================================================
function openSimulatorsEngine(engineType) {
    switchView("view-simulators-engine");
    const badge = document.getElementById("sim-engine-badge");
    const title = document.getElementById("sim-engine-title");
    const narrative = document.getElementById("sim-case-narrative");

    if (engineType === "1D") {
        badge.textContent = "MOTOR CLÍNICO LINEAL • SIMULADOR 1D";
        title.textContent = "Simulador 1D • Árbol de Lectura Secuencial y Algoritmos";
        narrative.textContent = "Modo 1D Activo: Resolución secuencial paso a paso basada en algoritmos clínicos y guías de práctica clínica.";
    } else if (engineType === "3D") {
        badge.textContent = "MOTOR INMERSIVO WEBGL • SIMULADOR 3D";
        title.textContent = "Simulador 3D • Sala de Trauma y Cuidados Intensivos (WebGL)";
        narrative.textContent = "Modo 3D UCI: Puente WebGL preparado para entornos Unity 3D en primera persona y maniobras cooperativas.";
        showToast("Motor 3D UCI", "Previsualización de telemetría activa • Build WebGL en calibración");
    } else {
        badge.textContent = "MOTOR CLÍNICO INTERACTIVO • SIMULADOR 2D";
        title.textContent = "Monitor Multiparámetro UCI-104 & Lienzo Clínico 2D";
        narrative.textContent = "Modo 2D Activo: Evalúa signos vitales en vivo, ausculta focos y toma decisiones terapéuticas sobre el paciente.";
    }
}

function initUCI104Actions() {
    document.querySelectorAll(".sim-action-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.action;
            const narrative = document.getElementById("sim-case-narrative");
            const hr = document.getElementById("vital-hr");
            const spo2 = document.getElementById("vital-spo2");

            if (act === "auscultar") {
                narrative.textContent = "🩺 Auscultación Cardiopulmonar: Ruidos cardíacos taquicárdicos rítmicos sin soplos; murmullo vesicular conservado con crepitantes bibasales leves.";
            } else if (act === "oxigeno") {
                narrative.textContent = "💨 Intervención Aplicada: Oxigenoterapia por cánula nasal a 3 L/min y acceso venoso periférico permeable. SpO2 mejora a 96%.";
                if (spo2) spo2.textContent = "96%";
                if (hr) hr.textContent = "98";
            } else if (act === "ecg12") {
                narrative.textContent = "⚡ ECG de 12 Derivaciones adquirido: Supradesnivel del ST en cara anterior (V1-V4). Activar código infarto de inmediato.";
            }
        });
    });
}

function initRuralControls() {
    document.querySelectorAll(".btn-open-pdf-reader").forEach(btn => {
        btn.addEventListener("click", () => {
            const docName = btn.dataset.pdf || "Guía MSP";
            showToast(`Visor 1D: ${docName}`, "Conectado a assets/5-multimedia-1d/guias-pdf/");
        });
    });
}

// ============================================================================
// MÉTRICAS, PERFIL Y CANDADO FREEMIUM
// ============================================================================
function renderMetrics() {
    const uData = appState.currentUserData;
    if (!uData) return;
    const avgEl = document.getElementById("metric-avg");
    const exEl = document.getElementById("metric-exams");
    const casEl = document.getElementById("metric-cases");

    if (avgEl) avgEl.textContent = `${(uData.globalAverage || 0).toFixed(1)}%`;
    if (exEl) exEl.textContent = uData.totalExamsCompleted || 0;
    if (casEl) casEl.textContent = `${uData.casesUsedThisMonth || 0} / 15`;
}

function openProfileView(user, userData) {
    switchView("view-profile");
    const nameIn = document.getElementById("profile-name-input");
    const emailIn = document.getElementById("profile-email-input");
    const planBadge = document.getElementById("profile-plan-badge");

    if (nameIn) nameIn.value = userData.nombre || user.displayName || "";
    if (emailIn) emailIn.value = user.email || "";
    if (planBadge) planBadge.textContent = `Plan ${userData.subscriptionLevel || "Básico"}`;

    document.getElementById("btn-upgrade-from-profile")?.addEventListener("click", () => {
        window.location.href = "registro.html?plan=PRO";
    });

    document.getElementById("btn-save-profile")?.addEventListener("click", async () => {
        const newName = nameIn.value.trim();
        if (!newName) return;
        appState.currentUserData.nombre = newName;
        document.getElementById("user-name").textContent = newName;
        document.getElementById("header-user-name").textContent = newName;
        try {
            await updateDoc(doc(db, "usuarios", user.uid), { nombre: newName });
            showToast("Perfil Actualizado", "Tus datos se guardaron en Cloud Firestore");
        } catch (e) {
            showToast("Guardado en sesión", "Cambios aplicados localmente");
        }
    });
}

export function showFreemiumModal() {
    const modal = document.getElementById("freemium-modal");
    if (!modal) return;
    modal.innerHTML = `
        <div class="bg-surface-container border-2 border-primary p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_35px_rgba(0,229,255,0.25)]">
            <span class="text-[10px] font-mono uppercase bg-primary/15 text-primary border border-primary/30 px-3 py-1 rounded-full font-bold">Desbloqueo Académico Total</span>
            <h3 class="text-2xl font-extrabold text-white mt-3 mb-2">Actualiza a Makai PRO CACES</h3>
            <p class="text-xs text-gray-400 mb-6 leading-relaxed">
                El Modo Estándar (100 preguntas) y los bancos clínicos ilimitados requieren el Plan Makai PRO ($17.99/mes o $139.99/año).
            </p>
            <div class="space-y-3">
                <a href="registro.html?plan=PRO" class="block w-full bg-primary text-surface font-extrabold py-3.5 rounded-xl hover:bg-opacity-90 text-sm">
                    Subir Comprobante / Activar PRO ($17.99)
                </a>
                <div class="flex justify-center gap-2 py-2 text-[11px] font-mono text-gray-300">
                    <span class="bg-surface px-2.5 py-1 rounded border border-surface-high">Deuna! QR</span>
                    <span class="bg-surface px-2.5 py-1 rounded border border-surface-high">PayPhone</span>
                    <span class="bg-surface px-2.5 py-1 rounded border border-surface-high">Transferencia</span>
                </div>
                <button id="btn-close-freemium" class="w-full text-gray-400 text-xs font-mono hover:text-white py-2">Cerrar ventana</button>
            </div>
        </div>
    `;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("btn-close-freemium")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });
}

// ============================================================================
// BÓVEDA DE ADMINISTRADOR (REACTIVOS, PAGOS Y BACKUPS JSON/CSV)
// ============================================================================
function initAdminVault() {
    if (!isMasterAdmin(appState.currentUser?.email)) return;

    const adminCarrera = document.getElementById("admin-carrera");
    const adminMateria = document.getElementById("admin-materia");

    function updateAdminSubjects() {
        if (!adminCarrera || !adminMateria) return;
        adminMateria.innerHTML = "";
        const list = CACES_OFFICIAL_SUBJECTS[adminCarrera.value] || [];
        list.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            adminMateria.appendChild(opt);
        });
    }

    adminCarrera?.addEventListener("change", updateAdminSubjects);
    updateAdminSubjects();

    document.getElementById("admin-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const reactivo = {
            carrera: adminCarrera.value,
            materia: adminMateria.value,
            dificultad: document.getElementById("admin-dificultad").value,
            enunciado: document.getElementById("admin-enunciado").value,
            opciones: {
                A: document.getElementById("admin-opA").value,
                B: document.getElementById("admin-opB").value,
                C: document.getElementById("admin-opC").value,
                D: document.getElementById("admin-opD").value
            },
            respuestaCorrecta: document.getElementById("admin-correcta").value,
            racional: document.getElementById("admin-racional").value,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "preguntas_caces"), reactivo);
            showToast("Reactivo Guardado", "Añadido exitosamente a preguntas_caces");
            e.target.reset();
            updateAdminSubjects();
        } catch (err) {
            alert("Error al guardar en Firestore: " + err.message);
        }
    });

    document.getElementById("btn-import-json")?.addEventListener("click", async () => {
        const raw = document.getElementById("admin-json-import")?.value;
        if (!raw) return;
        try {
            const items = JSON.parse(raw);
            if (!Array.isArray(items)) throw new Error("El formato debe ser un arreglo JSON [ ... ]");
            let count = 0;
            for (const item of items) {
                await addDoc(collection(db, "preguntas_caces"), { ...item, createdAt: new Date().toISOString() });
                count++;
            }
            showToast("Importación Exitosa", `${count} reactivos subidos a Firestore`);
            document.getElementById("admin-json-import").value = "";
        } catch (err) {
            alert("Error en el JSON: " + err.message);
        }
    });

    // Descarga de Respaldo Completo .JSON
    document.getElementById("btn-backup-json")?.addEventListener("click", async () => {
        try {
            const qSnap = await getDocs(collection(db, "preguntas_caces"));
            const questions = [];
            qSnap.forEach(d => questions.push({ id: d.id, ...d.data() }));
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), preguntas_caces: questions }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `makai-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
        } catch (err) {
            alert("Error al generar Backup JSON: " + err.message);
        }
    });

    // Descarga de Reporte de Usuarios en .CSV para Excel
    document.getElementById("btn-backup-csv")?.addEventListener("click", async () => {
        try {
            const uSnap = await getDocs(collection(db, "usuarios"));
            let csv = "UID,Nombre,Email,Plan,CasosUsados,Simulacros,PromedioGlobal\n";
            uSnap.forEach(d => {
                const u = d.data();
                csv += `"${d.id}","${u.nombre || ""}","${u.email || ""}","${u.subscriptionLevel || "Básico"}",${u.casesUsedThisMonth || 0},${u.totalExamsCompleted || 0},${(u.globalAverage || 0).toFixed(1)}\n`;
            });
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `makai-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        } catch (err) {
            alert("Error al exportar CSV: " + err.message);
        }
    });
}
