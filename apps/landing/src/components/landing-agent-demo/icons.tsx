type IconProps = {
  name:
    | "agent"
    | "calendar"
    | "check"
    | "chevron"
    | "clock"
    | "file"
    | "folder"
    | "history"
    | "list"
    | "menu"
    | "message"
    | "panel"
    | "paperclip"
    | "reset"
    | "send"
    | "settings"
    | "shield"
    | "sliders"
    | "users"
    | "x";
};

export function Icon({ name }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "send") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="m4 12 15-7-4 14-3-6-8-1Z" />
      </svg>
    );
  }

  if (name === "chevron") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="m7 10 5 5 5-5" />
      </svg>
    );
  }

  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  }

  if (name === "reset") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 7v5h5M20 17a8 8 0 0 1-13.7-5.6L4 12M20 12A8 8 0 0 0 6.3 6.4" />
      </svg>
    );
  }

  if (name === "panel" || name === "menu") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 5h16M4 12h16M4 19h16" />
      </svg>
    );
  }

  if (name === "sliders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
        <path {...common} d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  if (name === "paperclip") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="m8 13 6-6a4 4 0 0 1 6 6l-8 8a6 6 0 0 1-8-8l8-8" />
      </svg>
    );
  }

  if (name === "agent") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M8 10h8M9 15h6M7 4h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
        <path {...common} d="M12 4V2" />
      </svg>
    );
  }

  const pathByName: Record<string, string> = {
    calendar: "M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    file: "M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 3v5h5",
    folder: "M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z",
    history: "M4 12a8 8 0 1 0 3-6M4 5v5h5M12 8v5l3 2",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    message: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12h2M3 12h2M12 3v2M12 19v2M17 5l-1.5 1.5M8.5 17.5 7 19M19 19l-1.5-1.5M8.5 6.5 7 5",
    users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6",
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d={pathByName[name] ?? pathByName.list} />
    </svg>
  );
}
