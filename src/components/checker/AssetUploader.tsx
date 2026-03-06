"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, AlertTriangle, FileImage, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export interface UploadedAsset {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  name: string;
}

interface AssetUploaderProps {
  assets: UploadedAsset[];
  onChange: (assets: UploadedAsset[]) => void;
}

interface UploadTask {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

// Common ad dimensions for warning checks
const STANDARD_RATIOS = [
  { label: "1:1 (Square)", w: 1, h: 1 },
  { label: "4:5 (Portrait)", w: 4, h: 5 },
  { label: "16:9 (Landscape)", w: 16, h: 9 },
  { label: "9:16 (Story)", w: 9, h: 16 },
  { label: "1.91:1 (Facebook Feed)", w: 191, h: 100 },
];

function isStandardRatio(width: number, height: number): boolean {
  const epsilon = 0.05;
  return STANDARD_RATIOS.some(({ w, h }) => Math.abs(width / height - w / h) < epsilon);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetUploader({ assets, onChange }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadTask[]>([]);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    const taskId = Math.random().toString(36).slice(2);
    const task: UploadTask = { id: taskId, name: file.name, progress: 0 };
    setUploading((prev) => [...prev, task]);

    // Simulate progress while uploading
    const progressInterval = setInterval(() => {
      setUploading((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, progress: Math.min(t.progress + 10, 85) } : t
        )
      );
    }, 300);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      clearInterval(progressInterval);

      if (!res.ok || !data.success) {
        setUploading((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, progress: 100, error: data.error?.message ?? "Upload failed" }
              : t
          )
        );
        setTimeout(() => {
          setUploading((prev) => prev.filter((t) => t.id !== taskId));
        }, 3000);
        return;
      }

      setUploading((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 100 } : t))
      );

      const asset: UploadedAsset = {
        url: data.data.url,
        publicId: data.data.publicId,
        format: data.data.format,
        width: data.data.width,
        height: data.data.height,
        bytes: data.data.bytes,
        name: file.name,
      };

      onChange([...assets, asset]);

      setTimeout(() => {
        setUploading((prev) => prev.filter((t) => t.id !== taskId));
      }, 800);
    } catch {
      clearInterval(progressInterval);
      setUploading((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, progress: 100, error: "Network error" } : t
        )
      );
      setTimeout(() => {
        setUploading((prev) => prev.filter((t) => t.id !== taskId));
      }, 3000);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => uploadFile(file));
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets]
  );

  function removeAsset(index: number) {
    onChange(assets.filter((_, i) => i !== index));
  }

  const isVideo = (format: string) =>
    ["mp4", "mov", "avi", "webm"].includes(format.toLowerCase());

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Upload images or videos to validate dimensions, file sizes, and format
        requirements against each selected platform.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-10 px-6",
          dragOver
            ? "border-slate-500 bg-slate-50"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        <Upload className="h-8 w-8 text-slate-300" />
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            Drag &amp; drop files here, or click to browse
          </p>
          <p className="text-xs text-slate-400 mt-1">
            JPG, PNG, WebP, GIF, MP4, MOV · max 50 MB each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Uploading progress */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((task) => (
            <div key={task.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate max-w-56">{task.name}</span>
                {task.error ? (
                  <span className="text-red-500">{task.error}</span>
                ) : task.progress === 100 ? (
                  <span className="text-green-600">Done</span>
                ) : (
                  <span className="text-slate-400">{task.progress}%</span>
                )}
              </div>
              <Progress
                value={task.progress}
                className={cn("h-1.5", task.error && "[&>div]:bg-red-400")}
              />
            </div>
          ))}
        </div>
      )}

      {/* Asset thumbnails */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {assets.map((asset, i) => {
            const video = isVideo(asset.format);
            const nonStandard =
              asset.width > 0 &&
              asset.height > 0 &&
              !isStandardRatio(asset.width, asset.height);

            return (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
              >
                {/* Preview */}
                <div className="aspect-square relative">
                  {video ? (
                    <div className="flex h-full items-center justify-center bg-slate-100">
                      <FileVideo className="h-10 w-10 text-slate-400" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeAsset(i)}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  {/* Warning badge */}
                  {nonStandard && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-amber-500/90 px-1.5 py-0.5">
                      <AlertTriangle className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-medium">
                        Non-standard
                      </span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="px-2 py-1.5 space-y-0.5">
                  <p className="text-xs text-slate-700 truncate font-medium">
                    {asset.name}
                  </p>
                  <div className="flex items-center justify-between">
                    {asset.width > 0 ? (
                      <span className="text-xs text-slate-400">
                        {asset.width}×{asset.height}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-xs text-slate-400">
                        <FileImage className="h-3 w-3" />
                        {asset.format.toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatBytes(asset.bytes)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
