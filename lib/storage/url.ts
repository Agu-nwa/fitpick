function cleanBaseUrl(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function encodeStorageKey(storageKey: string) {
  return storageKey
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

export function normalizeStorageKey(storageKey: string) {
  return storageKey
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .replace(/^\/+/, "")
    .slice(0, 512);
}

export function s3PublicObjectUrl(input: { bucket?: string; region?: string; storageKey: string }) {
  const bucket = input.bucket || process.env.S3_BUCKET || "fitpick1";
  const region = input.region || process.env.S3_REGION || "eu-north-1";
  const host = region === "us-east-1" ? `${bucket}.s3.amazonaws.com` : `${bucket}.s3.${region}.amazonaws.com`;
  return `https://${host}/${encodeStorageKey(normalizeStorageKey(input.storageKey))}`;
}

export function getPublicStorageUrl(storageKey: string) {
  const key = normalizeStorageKey(storageKey);
  const cloudFront =
    cleanBaseUrl(process.env.CLOUDFRONT_URL) ||
    cleanBaseUrl(process.env.NEXT_PUBLIC_CLOUDFRONT_URL) ||
    cleanBaseUrl(process.env.S3_PUBLIC_BASE_URL);

  if (cloudFront) return `${cloudFront}/${encodeStorageKey(key)}`;
  return s3PublicObjectUrl({ storageKey: key });
}

export function redactSensitiveUrl(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.search = url.search ? "?[redacted]" : "";
    return url.toString();
  } catch {
    return value.replace(/\?.+$/, "?[redacted]");
  }
}
