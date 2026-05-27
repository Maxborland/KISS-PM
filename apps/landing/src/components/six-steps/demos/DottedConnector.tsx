type DottedConnectorProps = {
  className?: string;
  variant?: "horizontal" | "horizontal-long";
};

export function DottedConnector({ className = "", variant = "horizontal" }: DottedConnectorProps) {
  const w = variant === "horizontal-long" ? 72 : 48;
  return (
    <svg
      className={`six-connector ${className}`.trim()}
      width={w}
      height="24"
      viewBox={`0 0 ${w} 24`}
      fill="none"
      aria-hidden="true"
    >
      <path
        className="six-connector__path"
        d={`M2 12 H${w - 10} M${w - 10} 12 l-6 -5 M${w - 10} 12 l-6 5`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 5"
      />
    </svg>
  );
}
