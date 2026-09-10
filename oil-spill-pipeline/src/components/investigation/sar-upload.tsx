"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { AlertTriangle, CheckCircle2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { MAX_SAR_FILE_SIZE_BYTES, SAR_ACCEPTED_TYPES } from "@/hooks/use-investigation";
import type { SarUploadState } from "@/types/investigation";

interface SarUploadProps {
  value: SarUploadState;
  onSelect: (file: File) => void;
  onReject: (reason: string) => void;
  onClear: () => void;
}

function describeRejection(rejection: FileRejection): string {
  const [firstError] = rejection.errors;
  if (!firstError) return "File was rejected.";
  switch (firstError.code) {
    case "file-too-large":
      return "File exceeds the 50 MB limit.";
    case "file-invalid-type":
      return "Unsupported file type. Use GeoTIFF, PNG, or JPG.";
    default:
      return firstError.message;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drag-and-drop SAR upload (oil-spill-pipeline/CLAUDE.md §11). No backend upload yet — file selection is local UI state only. */
export function SarUpload({ value, onSelect, onReject, onClear }: SarUploadProps) {
  const handleDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (acceptedFiles.length > 0) {
        onSelect(acceptedFiles[0]);
        return;
      }
      if (fileRejections.length > 0) {
        onReject(describeRejection(fileRejections[0]));
      }
    },
    [onSelect, onReject]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: SAR_ACCEPTED_TYPES,
    maxSize: MAX_SAR_FILE_SIZE_BYTES,
    multiple: false,
    disabled: value.status === "selected",
    onDrop: handleDrop,
  });

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
        SAR Ingestion
      </p>

      {value.status === "selected" && value.file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[#4FB8D9]/30 bg-[#4FB8D9]/[0.06] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-[#4FB8D9]" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[11px] text-white/85">{value.file.name}</p>
              <p className={cn("text-[10px] text-white/40", jetbrainsMono.className)}>
                {formatFileSize(value.file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Remove selected file"
            title="Remove selected file"
            onClick={onClear}
            className="flex size-6 shrink-0 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps({
            "aria-label":
              "Upload SAR imagery. Drag and drop a file, or press Enter to browse.",
            className: cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
              isDragActive
                ? "border-[#4FB8D9]/60 bg-[#4FB8D9]/[0.06]"
                : "border-white/15 hover:border-white/25 hover:bg-white/[0.02]"
            ),
          })}
        >
          <input {...getInputProps()} />
          <UploadCloud className="size-5 text-white/35" aria-hidden />
          <p className="text-[11px] text-white/60">Drag and drop or browse</p>
          <p className="text-[10px] text-white/30">GeoTIFF / PNG / JPG · MAX 50 MB</p>
        </div>
      )}

      {value.status === "rejected" && value.rejectionReason && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#E2685C]/30 bg-[#E2685C]/[0.07] px-3 py-2 text-[11px] text-[#E2685C]"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          <span>{value.rejectionReason}</span>
        </div>
      )}
    </div>
  );
}
