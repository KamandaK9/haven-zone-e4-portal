import { Globe } from "lucide-react";

export function BrandMark({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="absolute inset-0"
        role="img"
        aria-label="Haven Zone E4"
      >
        <path d="M6 4 H37 V95 L21.5 82 L6 95 Z" fill="#7c3aed" />
        <path d="M94 4 H63 V95 L78.5 82 L94 95 Z" fill="#7c3aed" />
        <circle cx="50" cy="46" r="35" fill="white" />
        <circle cx="50" cy="46" r="35" fill="none" stroke="#7c3aed" strokeWidth="2" />
      </svg>
      <Globe
        className="absolute"
        style={{
          color: "#7c3aed",
          width: size * 0.4,
          height: size * 0.4,
          top: size * 0.46 - (size * 0.4) / 2,
          left: size * 0.5 - (size * 0.4) / 2,
        }}
        strokeWidth={1.75}
      />
    </div>
  );
}
