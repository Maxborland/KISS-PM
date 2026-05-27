import type { ReactNode } from "react";
import { Cta } from "./ScreenShell";

interface Props {
  title: string;
  meta: string;
  status?: string;
  statusTone?: "success" | "warning" | "info" | "neutral";
  syncNote?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DemoScreenFrame({
  title,
  meta,
  status,
  statusTone = "neutral",
  syncNote,
  toolbar,
  children,
  className,
}: Props) {
  return (
    <div className={`demo-screen${className ? ` ${className}` : ""}`}>
      <header className="demo-screen__head">
        <div className="demo-screen__title-block">
          <div className="demo-screen__title-row">
            <h2 className="demo-screen__title">{title}</h2>
            {status ? (
              <span className={`demo-screen__status demo-screen__status--${statusTone}`}>
                {status}
              </span>
            ) : null}
          </div>
          <p className="demo-screen__meta">
            {meta}
            {syncNote ? <span className="demo-screen__sync"> · {syncNote}</span> : null}
          </p>
        </div>
        {toolbar ? <div className="demo-screen__toolbar">{toolbar}</div> : null}
      </header>
      <div className="demo-screen__body">{children}</div>
    </div>
  );
}

export { Cta };
