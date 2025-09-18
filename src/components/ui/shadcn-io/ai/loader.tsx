"use client";
import * as React from "react";

type LoaderIconProps = { size?: number };

const LoaderIcon = ({ size = 16 }: LoaderIconProps) => (
  <svg
    height={size}
    width={size}
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeLinejoin="round"
    style={{ color: "currentcolor" }}
    aria-hidden="true"
  >
    <title>Loader</title>
    <g clipPath="url(#clip0_2393_1490)">
      <path d="M8 0V4" strokeWidth="1.5" />
      <path d="M8 16V12" opacity="0.5" strokeWidth="1.5" />
      <path d="M3.29773 1.52783L5.64887 4.7639" opacity="0.9" strokeWidth="1.5" />
      <path d="M12.7023 1.52783L10.3511 4.7639" opacity="0.1" strokeWidth="1.5" />
      <path d="M12.7023 14.472L10.3511 11.236" opacity="0.4" strokeWidth="1.5" />
      <path d="M3.29773 14.472L5.64887 11.236" opacity="0.6" strokeWidth="1.5" />
      <path d="M15.6085 5.52783L11.8043 6.7639" opacity="0.2" strokeWidth="1.5" />
      <path d="M0.391602 10.472L4.19583 9.23598" opacity="0.7" strokeWidth="1.5" />
      <path d="M15.6085 10.4722L11.8043 9.2361" opacity="0.3" strokeWidth="1.5" />
      <path d="M0.391602 5.52783L4.19583 6.7639" opacity="0.8" strokeWidth="1.5" />
    </g>
    <defs>
      <clipPath id="clip0_2393_1490">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export type LoaderProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Tamaño en píxeles (16, 24, 32, 48, …) */
  size?: number;
};

/** Loader “spokes” oficial estilo shadcn/ai — sin dependencias externas */
export const Loader = ({ className = "", size = 16, ...props }: LoaderProps) => (
  <div
    className={`inline-flex animate-spin items-center justify-center ${className}`}
    {...props}
    role="status"
    aria-label="Cargando"
  >
    <LoaderIcon size={size} />
  </div>
);
