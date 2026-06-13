"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface MascotImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  placeholderLabel?: string;
}

export default function MascotImage({
  src,
  alt = "XP Career Wallet mascot",
  width = 400,
  height = 400,
  className,
  placeholderLabel,
}: MascotImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-3xl",
          "bg-[var(--color-shadow-grey)] text-[var(--color-text-dark)]",
          "opacity-60 select-none",
          className
        )}
        style={{ width, height }}
        aria-label={alt}
      >
        <span className="text-5xl">🐹</span>
        {placeholderLabel && (
          <span className="mt-2 text-xs font-semibold opacity-60">
            {placeholderLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
}
