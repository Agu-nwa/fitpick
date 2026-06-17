export type StorageProvider = "s3_or_r2_or_cloudinary" | "s3" | "r2" | "cloudinary" | "local_placeholder";

const configuredProviders = new Set(["s3", "r2", "cloudinary"]);
const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const maxImageSizeBytes = 8 * 1024 * 1024;

export function storageProvider(): StorageProvider {
  return (process.env.STORAGE_PROVIDER as StorageProvider) || "local_placeholder";
}

export function getAllowedImageTypes() {
  return [...allowedImageTypes];
}

export function getMaxImageSizeBytes() {
  return maxImageSizeBytes;
}

export function validateImageMetadata(input: { mimeType: string; sizeBytes: number }) {
  return {
    valid: getAllowedImageTypes().includes(input.mimeType as any) && input.sizeBytes <= maxImageSizeBytes,
    allowedMimeTypes: getAllowedImageTypes(),
    maxSizeBytes: maxImageSizeBytes
  };
}

export function assertStorageConfigured() {
  const provider = storageProvider();

  return {
    provider,
    ready: configuredProviders.has(provider),
    message: configuredProviders.has(provider)
      ? "Storage provider selected. Signed upload implementation is scaffolded."
      : "Private wardrobe image storage is scaffolded with placeholder upload responses."
  };
}

export function createStorageKey(input: { userId: string; filename: string; purpose?: string }) {
  const safeFilename = input.filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return `${input.purpose || "wardrobe"}/${input.userId}/${Date.now()}-${crypto.randomUUID()}-${safeFilename || "upload"}`;
}

export function createWardrobeStorageKey(input: { userId: string; filename: string }) {
  return createStorageKey({ ...input, purpose: "wardrobe" });
}

export async function createSignedUploadUrl(input: {
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  purpose?: string;
}) {
  const storage = assertStorageConfigured();
  const validation = validateImageMetadata(input);
  const storageKey = createStorageKey({ userId: input.userId, filename: input.filename, purpose: input.purpose });

  return {
    ready: false,
    provider: storage.provider,
    storageKey,
    uploadUrl: storage.ready ? null : null,
    headers: storage.ready ? { "content-type": input.mimeType } : {},
    maxSizeBytes: validation.maxSizeBytes,
    allowedMimeTypes: validation.allowedMimeTypes,
    nextAction: storage.ready ? "connect_provider_signing" : "configure_storage_provider"
  };
}

export async function createSignedViewUrl(input: { storageKey: string }) {
  const storage = assertStorageConfigured();

  return {
    ready: false,
    provider: storage.provider,
    storageKey: input.storageKey,
    viewUrl: null,
    nextAction: storage.ready ? "connect_provider_view_signing" : "configure_storage_provider"
  };
}

export async function deleteStoredObject(input: { storageKey: string }) {
  return {
    ready: false,
    storageKey: input.storageKey,
    deleted: false,
    nextAction: "connect_storage_provider_delete"
  };
}
