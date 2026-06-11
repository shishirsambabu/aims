import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import type { DocumentType } from "@/types";

export function safeDossierFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_");
}

export function extensionFromName(name: string | null): string {
  if (!name) return ".bin";
  const match = name.match(/\.[A-Za-z0-9]{1,8}$/);
  return match?.[0] ?? ".bin";
}

export function dossierDocumentFileName(input: {
  index: number;
  type: string;
  docNo?: string | null;
  status: string;
  fileName?: string | null;
}) {
  const label = DOCUMENT_TYPE_LABELS[input.type as DocumentType] ?? input.type;
  const docNo = input.docNo ? `_${input.docNo}` : "";
  return safeDossierFileName(
    `${String(input.index).padStart(2, "0")}_${label}${docNo}_${input.status}${extensionFromName(input.fileName ?? null)}`
  );
}

export function dossierArchiveName(containerNo: string, blNo: string) {
  return safeDossierFileName(`${containerNo}_${blNo}_dossier.zip`);
}
