import crypto from "crypto";
import { assertEnvReady } from "@/lib/config/env";
import { deleteGeneratedImage, getGeneratedImageUrl } from "@/lib/storage/generated-images";
import { normalizeStorageKey } from "@/lib/storage/url";

export type StorageProvider = "s3" | "local_placeholder";

const defaultAllowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const maxImageSizeBytes = 8 * 1024 * 1024;
const service = "s3";
const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif"
};

export function storageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "local_placeholder" ? "local_placeholder" : "s3";
}

function s3Config() {
  return {
    bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "fitpick1",
    region: process.env.S3_REGION || process.env.AWS_REGION || "eu-north-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || ""
  };
}

function isS3Ready() {
  assertEnvReady({ strict: process.env.NODE_ENV === "production" });
  const config = s3Config();
  return Boolean(config.bucket && config.region && config.accessKeyId && config.secretAccessKey);
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signingKey(secret: string, stamp: string, region: string) {
  const kDate = hmac(`AWS4${secret}`, stamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodePathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function objectHost(bucket: string, region: string) {
  return region === "us-east-1" ? `${bucket}.s3.amazonaws.com` : `${bucket}.s3.${region}.amazonaws.com`;
}

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export function getAllowedImageTypes() {
  const configured = (process.env.ALLOWED_IMAGE_MIME_TYPES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length ? configured : [...defaultAllowedImageTypes];
}

export function getMaxImageSizeBytes() {
  return maxImageSizeBytes;
}

export function validateImageMetadata(input: { mimeType: string; sizeBytes: number }) {
  const allowedMimeTypes = getAllowedImageTypes();
  const normalizedMime = input.mimeType.toLowerCase();

  return {
    valid: allowedMimeTypes.includes(normalizedMime as any) && normalizedMime.startsWith("image/") && input.sizeBytes > 0 && input.sizeBytes <= maxImageSizeBytes,
    allowedMimeTypes,
    maxSizeBytes: maxImageSizeBytes
  };
}

export function assertStorageConfigured() {
  const provider = storageProvider();
  const ready = provider === "s3" && isS3Ready();

  return {
    provider,
    ready,
    message: ready ? "S3 image upload is configured." : "S3 image upload is not configured yet."
  };
}

export function createStorageKey(input: { userId: string; filename: string; purpose?: string }) {
  const extension = input.filename.includes(".") ? input.filename.split(".").pop()?.toLowerCase() : "";
  const safeFilename = input.filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return normalizeStorageKey(`wardrobe/${input.userId}/${input.purpose || "original"}-${Date.now()}-${crypto.randomUUID()}-${safeFilename || `upload.${extension || "jpg"}`}`);
}

export function createWardrobeStorageKey(input: { userId: string; filename: string }) {
  return createStorageKey({ ...input, purpose: "wardrobe" });
}

function createPresignedPutUrl(input: { storageKey: string; mimeType: string; expiresSeconds?: number }) {
  const config = s3Config();
  const now = amzDate();
  const stamp = now.slice(0, 8);
  const scope = `${stamp}/${config.region}/${service}/aws4_request`;
  const host = objectHost(config.bucket, config.region);
  const signedHeaders = "host";
  const credential = `${config.accessKeyId}/${scope}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": now,
    "X-Amz-Expires": String(input.expiresSeconds || 900),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalUri = `/${normalizeStorageKey(input.storageKey).split("/").map(encodePathPart).join("/")}`;
  const canonicalRequest = ["PUT", canonicalUri, canonicalQuery(params), `host:${host}\n`, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, hash(canonicalRequest)].join("\n");
  const signature = crypto.createHmac("sha256", signingKey(config.secretAccessKey, stamp, config.region)).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery({ ...params, "X-Amz-Signature": signature })}`;
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
  const extension = extensionByMime[input.mimeType.toLowerCase()] || input.filename.split(".").pop() || "jpg";
  const filename = input.filename.includes(".") ? input.filename : `${input.filename}.${extension}`;
  const storageKey = createStorageKey({ userId: input.userId, filename, purpose: input.purpose });

  if (!validation.valid) {
    return {
      ready: false,
      provider: storage.provider,
      storageKey,
      maxSizeBytes: validation.maxSizeBytes,
      allowedMimeTypes: validation.allowedMimeTypes,
      message: "Choose a JPG, PNG, WebP, or HEIC image under 8 MB.",
      nextAction: "choose_supported_image"
    };
  }

  if (!storage.ready) {
    return {
      ready: false,
      provider: storage.provider,
      storageKey,
      maxSizeBytes: validation.maxSizeBytes,
      allowedMimeTypes: validation.allowedMimeTypes,
      message: "S3 image upload is not configured yet.",
      nextAction: "configure_s3"
    };
  }

  return {
    ready: true,
    provider: "s3",
    storageKey,
    uploadUrl: createPresignedPutUrl({ storageKey, mimeType: input.mimeType }),
    method: "PUT",
    headers: {
      "content-type": input.mimeType
    },
    publicUrl: await getGeneratedImageUrl(storageKey),
    maxSizeBytes: validation.maxSizeBytes,
    allowedMimeTypes: validation.allowedMimeTypes,
    nextAction: "upload_to_s3"
  };
}

export async function createSignedViewUrl(input: { storageKey: string }) {
  const storage = assertStorageConfigured();

  return {
    ready: storage.ready,
    provider: storage.provider,
    storageKey: input.storageKey,
    viewUrl: storage.ready ? await getGeneratedImageUrl(input.storageKey) : null,
    nextAction: storage.ready ? "view" : "configure_s3"
  };
}

export async function deleteStoredObject(input: { storageKey: string }) {
  const storage = assertStorageConfigured();

  if (!storage.ready) {
    return {
      ready: false,
      provider: storage.provider,
      storageKey: input.storageKey,
      deleted: false,
      nextAction: "configure_s3"
    };
  }

  const deleted = await deleteGeneratedImage(input.storageKey);

  return {
    ready: true,
    provider: storage.provider,
    storageKey: input.storageKey,
    deleted,
    nextAction: deleted ? "deleted" : "delete_failed"
  };
}
