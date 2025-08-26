"use client";

import React from "react";

type Variant = "neutral" | "info" | "success" | "warning" | "danger";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

const palettes: Record<Variant, string> = {
  neutral: "bg-gray-100 text-gray-700 border border-gray-200",
  info: "bg-blue-50 text-blue-700 border border-blue-200",
  success: "bg-green-50 text-green-700 border border-green-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  danger: "bg-red-50 text-red-700 border border-red-200",
};

export function Badge({ children, variant = "neutral", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full text-[12px] leading-none px-2 py-1 ${palettes[variant]} ${className}`}>
      {children}
    </span>
  );
}
