// ============================================================================
// ARCHIVO: src/components/CaptchaBox.tsx
// DESCRIPCIÓN: Verificación de Seguridad CAPTCHA en Canvas HTML5
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";

interface CaptchaBoxProps {
  onVerifyChange: (verified: boolean) => void;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CaptchaBox: React.FC<CaptchaBoxProps> = ({ onVerifyChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [captchaCode, setCaptchaCode] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const generateNewCaptcha = useCallback(() => {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    setCaptchaCode(code);
    setUserInput("");
    setIsVerified(false);
    onVerifyChange(false);
  }, [onVerifyChange]);

  useEffect(() => {
    generateNewCaptcha();
  }, [generateNewCaptcha]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !captchaCode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Fondo oscuro Cyber-Medical
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula sutil de fondo
    ctx.strokeStyle = "#1c2536";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Líneas de interferencia anti-bots
    const colors = ["#00e5ff", "#94de2d", "#ffbe0b"];
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = colors[i % colors.length] + "55";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width * 0.2, Math.random() * height);
      ctx.bezierCurveTo(
        width * 0.35,
        Math.random() * height,
        width * 0.65,
        Math.random() * height,
        width * 0.8 + Math.random() * width * 0.2,
        Math.random() * height
      );
      ctx.stroke();
    }

    // Dibujar caracteres con rotación e inclinación individual
    ctx.font = "800 22px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";

    const charSpacing = width / (captchaCode.length + 1);
    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      ctx.save();
      const x = charSpacing * (i + 1);
      const y = height / 2 + (Math.random() * 8 - 4);
      const angle = (Math.random() - 0.5) * 0.42;

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = i % 2 === 0 ? "#00e5ff" : "#94de2d";
      ctx.fillText(char, -7, 0);
      ctx.restore();
    }

    // Puntos de ruido
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = "#ffffff33";
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }
  }, [captchaCode]);

  const handleInput = (val: string) => {
    const clean = val.toUpperCase().replace(/\s+/g, "");
    setUserInput(clean);
    const match = clean.length === captchaCode.length && clean === captchaCode;
    setIsVerified(match);
    onVerifyChange(match);
  };

  return (
    <div className="p-3.5 rounded-xl bg-surface border border-surface-high space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-gray-300 font-semibold">
          Verificación de Seguridad CAPTCHA *
        </span>
        {isVerified ? (
          <span className="font-mono text-secondary font-bold">
            Verificado correctamente
          </span>
        ) : (
          <span className="font-mono text-gray-400">
            Escribe los 6 caracteres
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex items-center bg-surface-container border border-surface-high rounded-lg overflow-hidden shrink-0">
          <canvas
            ref={canvasRef}
            width={185}
            height={48}
            className="block select-none"
          />
          <button
            type="button"
            onClick={generateNewCaptcha}
            title="Generar nuevo código CAPTCHA"
            className="px-2.5 h-12 bg-surface-high/60 hover:bg-surface-high text-gray-300 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>

        <div className="flex-1 relative">
          <input
            type="text"
            maxLength={6}
            value={userInput}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="CÓDIGO AQUÍ"
            className={`w-full bg-surface-container border rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest uppercase focus:outline-none transition-colors ${
              isVerified
                ? "border-secondary text-secondary"
                : userInput.length === 6
                ? "border-danger text-danger"
                : "border-surface-high text-white focus:border-primary"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
