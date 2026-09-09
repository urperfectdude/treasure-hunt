import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700",
  secondary: "bg-stone-800 text-white hover:bg-stone-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100 border border-stone-300",
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-xl px-6 py-4 text-lg font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
