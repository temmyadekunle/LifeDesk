import type { CSSProperties } from "react";

/**
 * Brand artwork, drawn in SVG rather than shipped as photographs.
 *
 * Two reasons: stock photos of people would need per-image licensing and
 * attribution that cannot be enforced from the repo, and a local-first app
 * should not depend on a third-party image host being reachable. The motifs
 * below are geometric patterns in the style of Adire and Ankara wax prints,
 * which is the visual register the brand is going for anyway.
 */

let uid = 0;
function nextId(prefix: string) {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function AdirePattern({
  tone = "var(--brand-600)",
  className,
  style,
}: {
  tone?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const id = nextId("adire");
  return (
    <svg
      className={className}
      style={style}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M14 2 26 14 14 26 2 14Z"
            fill="none"
            stroke={tone}
            strokeWidth="1.1"
            opacity="0.5"
          />
          <circle cx="14" cy="14" r="2.4" fill={tone} opacity="0.35" />
          <path d="M14 0v6M14 22v6M0 14h6M22 14h6" stroke={tone} strokeWidth="1" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function ChevronPattern({
  tone = "var(--brand-700)",
  className,
  style,
}: {
  tone?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const id = nextId("chev");
  return (
    <svg
      className={className}
      style={style}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={id}
          width="24"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(0)"
        >
          <path
            d="M0 16 12 2l12 14"
            fill="none"
            stroke={tone}
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A soft gradient panel with a motif, used behind onboarding headlines. */
export function BrandPanel({
  variant = "adire",
  height = 132,
  children,
}: {
  variant?: "adire" | "chevron";
  height?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="ob-art"
      style={{
        height,
        position: "relative",
        display: "grid",
        placeItems: "center",
background:
        "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 58%, var(--accent-400) 100%)",
        border: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          mixBlendMode: "soft-light",
        }}
      >
        {variant === "adire" ? <AdirePattern tone="#ffffff" /> : <ChevronPattern tone="#ffffff" />}
      </div>
      <div style={{ position: "relative", color: "#fff", textAlign: "center", padding: "0 1rem" }}>
        {children}
      </div>
    </div>
  );
}