import crypto from "crypto";

type CacheEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, CacheEntry>();

export type AiCacheStore = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

function safeSerialize(value: unknown) {
  return JSON.stringify(value);
}

function safeDeserialize<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export const aiCache: AiCacheStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = memoryCache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
      }
      return safeDeserialize<T>(entry.value);
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number) {
    try {
      memoryCache.set(key, {
        value: safeSerialize(value),
        expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000
      });
    } catch {
      // Cache failures should never block user flows.
    }
  },

  async del(key: string) {
    try {
      memoryCache.delete(key);
    } catch {
      // Cache failures should never block user flows.
    }
  }
};

function sanitizePayload(payload: unknown) {
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value !== "string") return value;
    if (value.includes("api_key") || value.includes("signature=") || value.includes("token=")) return "[redacted-url]";
    return value.slice(0, 260);
  });
}

export function createCacheKey(namespace: string, payload: unknown) {
  const hash = crypto.createHash("sha256").update(sanitizePayload(payload)).digest("hex");
  return `${namespace}:${hash}`;
}

export function namespacedCache(namespace: string, defaultTtlSeconds = 600) {
  return {
    get<T>(key: string) {
      return aiCache.get<T>(`${namespace}:${key}`);
    },
    set(key: string, value: unknown, ttlSeconds = defaultTtlSeconds) {
      return aiCache.set(`${namespace}:${key}`, value, ttlSeconds);
    },
    del(key: string) {
      return aiCache.del(`${namespace}:${key}`);
    }
  };
}
