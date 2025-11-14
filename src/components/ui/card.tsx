import { ElementType, HTMLAttributes } from "react";

type CardTone = "surface" | "panel" | "transparent";

const toneClasses: Record<CardTone, string> = {
  surface: "bg-[var(--surface-card)]",
  panel: "bg-[var(--surface-panel)]",
  transparent: "bg-transparent",
};

type CardProps<T extends ElementType = "div"> = HTMLAttributes<
  HTMLElementTagNameMap[Extract<T, keyof HTMLElementTagNameMap>]
> & {
  as?: T;
  tone?: CardTone;
};

export function Card<T extends ElementType = "div">({
  as,
  tone = "surface",
  className = "",
  children,
  ...props
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={`rounded-2xl border border-[var(--border-soft)] ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
