"use client";

import React from "react";
import { BRAND_ORANGE, TEXT_PRIMARY } from "@/styles/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const base =
  "inline-flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-black text-white hover:bg-gray-900 focus-visible:ring-black",
  secondary: "bg-white text-gray-900 border hover:bg-gray-50 focus-visible:ring-black",
  ghost: "bg-transparent text-gray-800 hover:bg-gray-100 focus-visible:ring-black",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
  // Brand CTA: teal background with black text; colors applied via inline style using theme tokens
  brand: "border focus-visible:ring-black",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-2.5 py-1.5",
  md: "text-sm px-3.5 py-2",
  lg: "text-base px-4.5 py-2.5",
};

export function Button({ variant = "primary", size = "md", className = "", loading, children, style: styleProp, ...rest }: Props) {
  const isBrand = variant === "brand";
  // Spinner colors per variant (brand uses TEXT_PRIMARY; primary/danger use white; others default to TEXT_PRIMARY)
  const spinnerMain = isBrand ? TEXT_PRIMARY : (variant === "primary" || variant === "danger") ? "#FFFFFF" : TEXT_PRIMARY;
  const spinnerAlpha = `${spinnerMain}99` as const; // ~60% alpha in 8-digit hex
  const finalStyle = isBrand
    ? { backgroundColor: BRAND_ORANGE, color: TEXT_PRIMARY, borderColor: BRAND_ORANGE, ...(styleProp || {}) }
    : styleProp;
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      aria-busy={loading || undefined}
      style={finalStyle}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2"
            style={{ borderColor: spinnerAlpha as any, borderTopColor: spinnerMain as any }}
            aria-hidden
          />
          <span>Chargement…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
