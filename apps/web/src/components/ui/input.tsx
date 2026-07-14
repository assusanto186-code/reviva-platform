import type { ComponentProps } from "react";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={[
        "h-11 w-full rounded-md border border-border bg-surface px-4 py-2",
        "text-sm text-foreground shadow-sm outline-none transition-colors",
        "placeholder:text-subtle hover:border-muted",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
