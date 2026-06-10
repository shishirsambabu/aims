"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_FILE_TYPES,
  ALL_DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import type { DocumentType } from "@/types";

export interface ContainerOption {
  id: string;
  containerNo: string;
  blNo: string;
  supplier: { name: string } | null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const IMAGE_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2200;

async function compressImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type) || file.size < IMAGE_COMPRESS_THRESHOLD) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function DocumentUpload({
  orgId,
  containers,
  presetContainerId,
  trigger,
}: {
  orgId: string;
  containers: ContainerOption[];
  presetContainerId?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [containerId, setContainerId] = useState(presetContainerId ?? "");
  const [type, setType] = useState<DocumentType>("BillOfLading");
  const [docNo, setDocNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function reset() {
    setContainerId(presetContainerId ?? "");
    setType("BillOfLading");
    setDocNo("");
    setIssueDate("");
    setExpiryDate("");
    setFile(null);
  }

  async function submit() {
    if (!containerId) return toast.error("Select a container");
    if (!file) return toast.error("Choose a file to upload");
    if (!ACCEPTED_FILE_TYPES.includes(file.type))
      return toast.error("Only PDF, JPG or PNG files are allowed");
    let uploadFile = file;
    let originalSize: number | null = null;
    try {
      const compressed = await compressImage(file);
      if (compressed.size !== file.size) {
        originalSize = file.size;
        uploadFile = compressed;
      }
    } catch {
      uploadFile = file;
    }

    if (uploadFile.size > MAX_FILE_SIZE)
      return toast.error("File exceeds the 25 MB limit");

    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = uploadFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${orgId}/${containerId}/${type}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, uploadFile, {
          upsert: true,
          contentType: uploadFile.type,
        });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerId,
          type,
          docNo,
          issueDate,
          expiryDate,
          filePath: path,
          fileUrl: pub?.publicUrl,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          status: "Uploaded",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save document");
        return;
      }

      if (originalSize) {
        toast.success(
          `Document uploaded. Image compressed from ${formatBytes(originalSize)} to ${formatBytes(uploadFile.size)}`
        );
      } else {
        toast.success("Document uploaded successfully");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error("Network error during upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Attach a document to a container. PDF, JPG or PNG, up to 25 MB.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!presetContainerId && (
            <div className="space-y-1.5">
              <Label>Container (by Container No or BL No)</Label>
              <select
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select container…</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.containerNo} · BL {c.blNo}
                    {c.supplier ? ` · ${c.supplier.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ALL_DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Doc Number</Label>
              <Input
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                placeholder="Optional"
                className="font-financial"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-surface-alt file:px-3 file:py-1 file:text-sm"
            />
            {file && (
              <p className="font-financial text-xs text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
            {file &&
              IMAGE_TYPES.includes(file.type) &&
              file.size >= IMAGE_COMPRESS_THRESHOLD && (
                <p className="text-xs text-primary">
                  This image will be compressed before upload.
                </p>
              )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
