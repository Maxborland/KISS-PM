import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  /** Крупная карточка сделки: сводка + активность + обсуждение */
  variant?: "default" | "workspace";
}

export function ScreenShell({ title, subtitle, toolbar, children, variant = "default" }: Props) {
  return (
    <div className={`screen${variant === "workspace" ? " screen--workspace" : ""}`}>
      <header className="screen__head">
        <div>
          <h3 className="screen__title">{title}</h3>
          {subtitle && <p className="screen__subtitle">{subtitle}</p>}
        </div>
        {toolbar && <div className="screen__toolbar">{toolbar}</div>}
      </header>

      <div className="screen__body">{children}</div>

      <style>{`
        .screen {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .screen__head {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: var(--panel-subtle);
        }
        .screen__title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--text-strong);
          margin: 0;
        }
        .screen__subtitle {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .screen__toolbar {
          display: inline-flex;
          gap: 8px;
        }
        .screen__body {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}

interface CtaProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
  /** Мягкий акцент для ключевого действия сценария */
  emphasis?: boolean;
}

export function Cta({ label, onClick, variant = "primary", emphasis = false }: CtaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cta cta--${variant}${emphasis ? " cta--emphasis" : ""}`}
    >
      {label}
      <style>{`
        .cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding-inline: 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background var(--duration-ui) var(--ease-ui),
            border-color var(--duration-ui) var(--ease-ui),
            box-shadow var(--duration-ui) var(--ease-ui);
          border: 1px solid transparent;
        }
        .cta--primary {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.35);
        }
        .cta--primary:hover { background: var(--accent-hover); }
        .cta--emphasis {
          animation: cta-emphasis 2.8s ease-in-out infinite;
        }
        @keyframes cta-emphasis {
          0%, 100% { box-shadow: 0 4px 14px -2px rgba(37, 99, 235, 0.35); }
          50% { box-shadow: 0 6px 20px -2px rgba(37, 99, 235, 0.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cta--emphasis { animation: none; }
        }
        .cta--ghost {
          background: var(--panel);
          color: var(--text-strong);
          border-color: var(--border);
        }
        .cta--ghost:hover { border-color: var(--border-strong); }
        .cta:focus-visible {
          outline: none;
          box-shadow: var(--ring-focus);
        }
      `}</style>
    </button>
  );
}
