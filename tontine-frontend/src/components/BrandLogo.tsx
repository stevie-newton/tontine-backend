"use client";

import { useState } from "react";
import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
};

export default function BrandLogo({ size = 80, width, height, className = "" }: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedWidth = width ?? size;
  const resolvedHeight = height ?? size;

  if (hasError) {
    return (
      <span
        className={`grid place-items-center rounded-2xl bg-slate-900 text-sm font-bold text-white ${className}`}
        style={{ width: resolvedWidth, height: resolvedHeight }}
        aria-label="Cercora logo"
      >
        C
      </span>
    );
  }

  return (
    <Image
      src="/logo.png"
      alt="Cercora"
      width={resolvedWidth}
      height={resolvedHeight}
      className={`rounded-2xl object-contain ${className}`}
      unoptimized
      onError={() => setHasError(true)}
    />
  );
}
