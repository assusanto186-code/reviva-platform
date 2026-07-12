import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-400 text-slate-950 hover:bg-emerald-300 focus-visible:outline-emerald-400",
  secondary:
    "border border-slate-700 bg-transparent text-white hover:bg-slate-900 focus-visible:outline-slate-400",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3",
        "text-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
