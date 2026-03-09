"use client";

import { useState } from "react";
import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 80, className = "" }: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span
        className={`grid place-items-center rounded-2xl bg-slate-900 text-sm font-bold text-white ${className}`}
        style={{ width: size, height: size }}
        aria-label="Tontine logo"
      >
        T
      </span>
    );
  }

  return (
    <Image
      src="/logo.png"
      alt="Tontine"
      width={size}
      height={size}
      className={`rounded-2xl object-contain ${className}`}
      unoptimized
      onError={() => setHasError(true)}
    />
  );
}
