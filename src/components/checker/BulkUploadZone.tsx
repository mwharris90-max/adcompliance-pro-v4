"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkUploadZoneProps {
  onFileParsed: (csvText: string, filename: string) => void;
  disabled?: boolean;
}

export function BulkUploadZone({ onFileParsed, disabled }: BulkUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Please upload a .csv file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File is too large. Maximum size is 10 MB.");
        return;
      }

      setLoading(true);
      try {
        const text = await file.text();
        onFileParsed(text, file.name);
      } catch {
        setError("Failed to read file. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onFileParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all",
          dragging
            ? "border-[#1A56DB] bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
          disabled && "opacity-50 cursor-not-allowed",
          loading && "pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />

        {loading ? (
          <Loader2 className="h-8 w-8 text-[#1A56DB] animate-spin" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1A56DB]/10 to-[#E4168A]/10">
            <FileSpreadsheet className="h-6 w-6 text-[#1A56DB]" />
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {loading ? "Reading file..." : "Drag your Google Ads bulk upload file here"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            or click to browse — supports .csv files up to 10 MB
          </p>
        </div>

        {!loading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Upload className="h-3.5 w-3.5" />
            <span>Google Ads Editor CSV format</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
