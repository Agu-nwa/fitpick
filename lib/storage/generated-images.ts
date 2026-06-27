import crypto from "crypto";
import { assertEnvReady } from "@/lib/config/env";
import { errorCategory, logAiEvent } from "@/lib/ai/observability/ai-logger";
import { getPublicStorageUrl, normalizeStorageKey, s3PublicObjectUrl } from "@/lib/storage/url";

type UploadOptions = {
  userId: string;
  outfitId: string;
  cacheKey: string;
  contentType?: string;
  format?: "png" | "jpeg" | "webp";
  width?: number;
  height?: number;
};

type UploadedGeneratedImage = {
  provider: "s3";
  storageKey: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

const service = "s3";
const defaultBucket = "fitpick1";
const allowedGeneratedFormats = new Set(["png", "jpeg", "webp"]);
const allowedGeneratedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function s3Config() {
  return {
    bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || defaultBucket,
    region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_GENERATED_IMAGES_URL || process.env.CLOUDFRONT_URL || process.env.NEXT_PUBLIC_CLOUDFRONT_URL || ""
  };
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function hash(value: Buffer | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(amz: string) {
  return amz.slice(0, 8);
}

function encodePathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function objectUrl(bucket: string, region: string, key: string) {
  return s3PublicObjectUrl({ bucket, region, storageKey: key });
}

function signingKey(secret: string, stamp: string, region: string) {
  const kDate = hmac(`AWS4${secret}`, stamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function bufferFromImage(input: Buffer | string) {
  if (Buffer.isBuffer(input)) return input;
  const base64 = input.includes(",") ? input.split(",").pop() || "" : input;
  return Buffer.from(base64, "base64");
}

function makeStorageKey(options: UploadOptions) {
  const format = options.format || "png";
  if (!allowedGeneratedFormats.has(format)) throw new Error("Unsupported generated image format.");
  const hashPart = crypto.createHash("sha256").update(options.cacheKey).digest("hex").slice(0, 24);
  return normalizeStorageKey(`generated-previews/${options.userId}/${options.outfitId}/${hashPart}.${format}`);
}

function assertReady() {
  assertEnvReady({ strict: process.env.NODE_ENV === "production" });
  const config = s3Config();
  if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error("S3 generated image storage is not configured.");
  }
  return config;
}

export async function uploadGeneratedImage(bufferOrBase64: Buffer | string, options: UploadOptions): Promise<UploadedGeneratedImage> {
  const startedAt = Date.now();
  const config = assertReady();
  const body = bufferFromImage(bufferOrBase64);
  const contentType = options.contentType || `image/${options.format || "png"}`;
  if (!allowedGeneratedContentTypes.has(contentType)) throw new Error("Unsupported generated image content type.");
  if (!body.byteLength || body.byteLength > 12 * 1024 * 1024) throw new Error("Generated image size is invalid.");
  const storageKey = makeStorageKey(options);
  const host = config.region === "us-east-1" ? `${config.bucket}.s3.amazonaws.com` : `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const now = amzDate();
  const stamp = dateStamp(now);
  const payloadHash = hash(body);
  const canonicalUri = `/${storageKey.split("/").map(encodePathPart).join("/")}`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${now}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${stamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, hash(canonicalRequest)].join("\n");
  const signature = crypto.createHmac("sha256", signingKey(config.secretAccessKey, stamp, config.region)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = objectUrl(config.bucket, config.region, storageKey);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        authorization,
        "content-type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": now
      },
      body: body as unknown as BodyInit
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed with status ${response.status}.`);
    }
  } catch (error) {
    logAiEvent({
      operation: "storage-upload",
      model: "system",
      latencyMs: Date.now() - startedAt,
      status: "failed",
      provider: "s3",
      bytes: body.byteLength,
      errorCategory: errorCategory(error)
    });
    throw error;
  }

  logAiEvent({
    operation: "storage-upload",
    model: "system",
    latencyMs: Date.now() - startedAt,
    status: "success",
    provider: "s3",
    bytes: body.byteLength
  });

  return {
    provider: "s3",
    storageKey,
    url: await getGeneratedImageUrl(storageKey),
    format: options.format || "png",
    width: options.width || 1024,
    height: options.height || 1024,
    bytes: body.byteLength
  };
}

export async function getGeneratedImageUrl(storageKey: string) {
  return getPublicStorageUrl(storageKey);
}

export async function deleteGeneratedImage(storageKey: string) {
  const config = assertReady();
  const host = config.region === "us-east-1" ? `${config.bucket}.s3.amazonaws.com` : `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const now = amzDate();
  const stamp = dateStamp(now);
  const payloadHash = hash("");
  const canonicalUri = `/${normalizeStorageKey(storageKey).split("/").map(encodePathPart).join("/")}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${now}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${stamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, hash(canonicalRequest)].join("\n");
  const signature = crypto.createHmac("sha256", signingKey(config.secretAccessKey, stamp, config.region)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(objectUrl(config.bucket, config.region, storageKey), {
    method: "DELETE",
    headers: {
      authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": now
    }
  });

  return response.ok || response.status === 404;
}
