import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-surface shadow-sm ${className}`}
      {...props}
    />
  );
}

export function CardHeader({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return <div className={`space-y-2 p-6 ${className}`} {...props} />;
}

export function CardTitle({
  className = "",
  ...props
}: ComponentProps<"h2">) {
  return (
    <h2
      className={`text-lg font-semibold tracking-tight text-foreground ${className}`}
      {...props}
    />
  );
}

export function CardDescription({
  className = "",
  ...props
}: ComponentProps<"p">) {
  return (
    <p className={`text-sm leading-6 text-muted ${className}`} {...props} />
  );
}

export function CardContent({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return <div className={`px-6 pb-6 ${className}`} {...props} />;
}

export function CardFooter({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={`flex items-center border-t border-border-subtle px-6 py-4 ${className}`}
      {...props}
    />
  );
}
