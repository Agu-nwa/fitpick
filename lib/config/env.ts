type EnvCheck = {
  ok: boolean;
  missing: string[];
  mode: "development" | "test" | "production";
};

const productionRequired = [
  "MONGODB_URI",
  "JWT_SECRET",
  "OPENAI_API_KEY",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "NEXT_PUBLIC_APP_URL"
] as const;

export class EnvConfigurationError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(`Missing required environment variables: ${missing.join(", ")}`);
    this.name = "ENV_CONFIGURATION_ERROR";
    this.missing = missing;
  }
}

export function validateEnv(options: { strict?: boolean } = {}): EnvCheck {
  const mode = (process.env.NODE_ENV || "development") as EnvCheck["mode"];
  const strict = options.strict ?? mode === "production";
  const missing: string[] = productionRequired.filter((key) => !process.env[key]);
  const hasCloudFront = Boolean(process.env.CLOUDFRONT_URL || process.env.NEXT_PUBLIC_CLOUDFRONT_URL || process.env.S3_PUBLIC_BASE_URL);

  if (!hasCloudFront && strict) missing.push("CLOUDFRONT_URL_OR_NEXT_PUBLIC_CLOUDFRONT_URL");

  return {
    ok: missing.length === 0,
    missing,
    mode
  };
}

export function assertEnvReady(options: { strict?: boolean } = {}) {
  const result = validateEnv(options);
  if (!result.ok && (options.strict ?? result.mode === "production")) {
    throw new EnvConfigurationError(result.missing);
  }
  return result;
}

export function safeEnvStatus() {
  const result = validateEnv({ strict: process.env.NODE_ENV === "production" });
  return {
    ok: result.ok,
    missing: result.missing,
    mode: result.mode
  };
}
