"use client";
import * as React from "react";

export function Loader({
  size = "lg",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeMap = {
    sm: "h-6 w-6 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-[3px]",
    xl: "h-16 w-16 border-4",
  } as const;

  return (
    <span aria-hidden className={`relative inline-block ${className}`}>
      {/* anillo base */}
      <span className={`block rounded-full border-current/30 ${sizeMap[size]} border`} />
      {/* anillo animado (borde superior transparente) */}
      <span
        className={`absolute inset-0 rounded-full border-t-transparent border-current animate-spin ${sizeMap[size]} border`}
      />
    </span>
  );
}