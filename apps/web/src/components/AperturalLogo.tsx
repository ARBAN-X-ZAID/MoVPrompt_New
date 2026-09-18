interface Props {
  size?: number;
  className?: string;
  tone?: "amber" | "white";
}

/**
 * MovPrompt mark: asymmetric triangular wedge.
 * Top-right edge horizontal (half-width), sharp point at lower-left.
 */
export const AperturalLogo = ({ size = 28, className, tone = "amber" }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M16 2 L30 2 L2 30 Z"
      fill={tone === "white" ? "hsl(var(--foreground))" : "hsl(var(--accent))"}
    />
  </svg>
);
