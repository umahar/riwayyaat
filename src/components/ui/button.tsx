import { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children?: ReactNode;
};

const BASE_ICON_BUTTON =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[#e5f6ef] text-base text-[var(--text-secondary)] shadow-sm transition hover:-translate-y-0.5 hover:text-[var(--accent-emerald)] dark:bg-[#0f2f24] dark:text-[#e2e8f0] dark:border-white/15";

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`${BASE_ICON_BUTTON} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
