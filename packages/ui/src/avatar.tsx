"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { cn } from "./cn";

const sizeClasses = {
  sm: "size-8 text-[0.6875rem]",
  md: "size-10 text-xs",
} as const;

function getInitials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (!parts.length) {
    return "?";
  }

  if (parts.length === 1) {
    return Array.from(parts[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return `${Array.from(parts[0] ?? "")[0] ?? ""}${
    Array.from(parts.at(-1) ?? "")[0] ?? ""
  }`.toUpperCase();
}

function getImageSource(src: string | null | undefined) {
  const value = src?.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

export type AvatarProps = Omit<ComponentProps<"span">, "children"> & {
  alt?: string;
  name?: string | null;
  size?: keyof typeof sizeClasses;
  src?: string | null;
};

export function Avatar({
  alt,
  className,
  name,
  size = "md",
  src,
  ...props
}: AvatarProps) {
  const imageSource = getImageSource(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = imageSource && imageSource !== failedSource;

  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border-strong bg-interactive font-semibold tracking-[-0.02em] text-secondary",
        sizeClasses[size],
        className,
      )}
      role={alt ? "img" : undefined}
      {...props}
    >
      {showImage ? (
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setFailedSource(imageSource)}
          referrerPolicy="no-referrer"
          src={imageSource}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}
