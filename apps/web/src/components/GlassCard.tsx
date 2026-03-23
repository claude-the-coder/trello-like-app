import type { ReactNode, HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}

export default function GlassCard({
  children,
  interactive = false,
  className = "",
  ...rest
}: GlassCardProps) {
  const classes = [
    "glass-card",
    interactive ? "glass-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
