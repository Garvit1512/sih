"use client";

import { useEffect, useMemo } from "react";

/** MIME types a browser can actually paint into an <img>. */
const BROWSER_RENDERABLE = ["image/png", "image/jpeg", "image/webp"];

/**
 * GeoTIFF is the format SAR products normally ship in, and no browser can
 * decode it natively — an <img> pointed at a .tif renders nothing at all.
 * Detect it so the UI can say so explicitly instead of showing an empty box.
 */
export function isBrowserRenderable(file: File | null): boolean {
  if (!file) return false;
  if (BROWSER_RENDERABLE.includes(file.type)) return true;
  // Some browsers report an empty type; fall back to the extension.
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

export function isGeoTiff(file: File | null): boolean {
  if (!file) return false;
  return file.type === "image/tiff" || /\.(tiff?)$/i.test(file.name);
}

/**
 * Object URL for a File, revoked when the file changes or the component
 * unmounts. Returns null for files the browser can't render, so callers
 * don't point an <img> at something that will silently stay blank.
 */
export function useObjectUrl(file: File | null): string | null {
  // Derived, not stored in state: creating it in a memo and revoking it in a
  // cleanup avoids a setState-inside-effect round trip (and the extra render
  // that comes with it).
  const url = useMemo(
    () => (file && isBrowserRenderable(file) ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
