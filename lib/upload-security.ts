import {
  ACCEPTED_FILE_TYPES,
  ALL_DOCUMENT_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/constants";
import type { DocumentType } from "@/types";

const EXTENSION_TO_TYPE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function extensionOf(name: string) {
  return name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0].toLowerCase() ?? "";
}

function hasUnsafePathSegment(value: string) {
  return (
    value.includes("..") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value) ||
    value.startsWith("/") ||
    value.length > 512
  );
}

export function validateDocumentUploadMetadata(input: {
  orgId: string;
  containerId: string;
  type: DocumentType;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
}) {
  if (input.fileUrl) {
    return "Public document URLs are not allowed. Upload to private storage instead.";
  }

  if (!input.filePath && !input.fileName && input.fileSize == null) {
    return null;
  }

  if (!input.filePath || !input.fileName || input.fileSize == null) {
    return "Uploaded documents must include file path, file name and file size.";
  }

  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    return "Document file size is invalid.";
  }

  if (input.fileSize > MAX_FILE_SIZE) {
    return "Document exceeds the 25 MB upload limit.";
  }

  if (hasUnsafePathSegment(input.filePath) || hasUnsafePathSegment(input.fileName)) {
    return "Document file name or path contains unsafe characters.";
  }

  if (!ALL_DOCUMENT_TYPES.includes(input.type)) {
    return "Document type is invalid.";
  }

  const expectedPrefix = `${input.orgId}/${input.containerId}/${input.type}/`;
  if (!input.filePath.startsWith(expectedPrefix)) {
    return "Document storage path does not match this organisation, container and document type.";
  }

  const ext = extensionOf(input.fileName);
  const storageExt = extensionOf(input.filePath);
  if (!ext || ext !== storageExt) {
    return "Document file extension is invalid.";
  }

  const mime = EXTENSION_TO_TYPE[ext];
  if (!mime || !ACCEPTED_FILE_TYPES.includes(mime)) {
    return "Only PDF, JPG and PNG documents are allowed.";
  }

  return null;
}
