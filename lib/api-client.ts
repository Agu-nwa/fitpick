import type { ApiFailure, ApiResponse } from "@/types/api";
import type { AiSuggestedWardrobeTags, WardrobeImageAsset } from "@/types/ai-tagging";
import type { WardrobeAiAnalysis } from "@/lib/ai/schemas/wardrobe-ai.schema";
import type { Occasion } from "@/types/occasion";
import type { FitLockSummary, OutfitRecommendation, PreviewAccuracySummary, StylistAvatarPreview, StylistResponse, StylistVisualMode } from "@/types/outfit";
import type { WardrobeItem, WardrobeSummary } from "@/types/wardrobe";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const backendUnavailable: ApiFailure = {
  ok: false,
  error: {
    code: "INTERNAL_ERROR",
    message: "FitPick services are not reachable right now. Please try again shortly."
  }
};

const invalidResponse: ApiFailure = {
  ok: false,
  error: {
    code: "INTERNAL_ERROR",
    message: "FitPick received an unexpected response. Please try again."
  }
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include"
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return invalidResponse;

    const payload = (await response.json()) as ApiResponse<T>;
    if (payload && typeof payload === "object" && "ok" in payload) return payload;

    return invalidResponse;
  } catch {
    return backendUnavailable;
  }
}

export type BackendHealth = {
  ok?: boolean;
  service: string;
  version?: string;
  status: string;
  databaseConfigured: boolean;
  timestamp: string;
  time?: string;
  checks?: {
    app: "ok" | "skipped" | "degraded" | "not_checked" | string;
    database: "ok" | "skipped" | "degraded" | "not_checked" | string;
    storage: "ok" | "skipped" | "degraded" | "not_checked" | string;
    worker: "ok" | "skipped" | "degraded" | "not_checked" | string;
  };
};

export type CurrentUserSummary = {
  user?: {
    id: string;
    name: string;
    email: string;
    plan: "free" | "plus";
  };
};

export type WardrobeListData = {
  items: WardrobeItem[];
  summary: WardrobeSummary;
};

export type WardrobeItemData = {
  item: WardrobeItem;
};

export type WardrobeArchiveData = {
  item?: WardrobeItem;
  archived?: boolean;
  deleted?: boolean;
};

export type ImageProcessingData = {
  processing: {
    ok?: boolean;
    status: "not_started" | "processing" | "ready" | "failed" | "unavailable" | string;
    safeMessage?: string;
    variants?: Record<string, unknown>;
    image?: Record<string, unknown> | null;
  };
  job?: JobStatusData["job"];
};

export type WardrobeUploadRecord = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  uploadStatus: string;
  aiTagStatus: string;
  aiProvider?: string;
  aiConfidence?: number;
  aiErrorSafeMessage?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: {
    front?: WardrobeImageAsset;
    back?: WardrobeImageAsset;
    fabricCloseUp?: WardrobeImageAsset;
    label?: WardrobeImageAsset;
    additional?: WardrobeImageAsset[];
  };
  aiAnalysis?: WardrobeAiAnalysis | null;
  suggestedTags: Record<string, unknown>;
  taggedSize?: WardrobeItem["taggedSize"];
  sizeSystem?: WardrobeItem["sizeSystem"];
  garmentFit?: WardrobeItem["garmentFit"];
  garmentMeasurements?: WardrobeItem["garmentMeasurements"];
  stretchLevel?: WardrobeItem["stretchLevel"];
  fabricDrape?: WardrobeItem["fabricDrape"];
  fitConfidence?: number;
  measurementSource?: WardrobeItem["measurementSource"];
  reviewedAt: string | null;
  createdItemId: string | null;
};

export type SignedUploadData = {
  upload: {
    ready: boolean;
    provider: string;
    storageKey: string;
    uploadUrl?: string;
    method?: string;
    headers?: Record<string, string>;
    publicUrl?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    cloudName?: string;
    folder?: string;
    publicId?: string;
    maxSizeBytes: number;
    allowedMimeTypes: string[];
    message?: string;
    nextAction: string;
  };
};

export type WardrobeUploadData = {
  upload: WardrobeUploadRecord;
  storage?: {
    provider: string;
    ready: boolean;
    mode: string;
  };
  nextAction?: string;
};

export type WardrobeUploadDetailData = {
  upload: WardrobeUploadRecord;
};

export type WardrobeUploadReviewData = {
  item: WardrobeItem;
  upload: WardrobeUploadRecord;
  nextAction?: string;
};

export type WardrobeTagSuggestionData = {
  uploadId: string;
  aiTagStatus: string;
  suggestedTags: AiSuggestedWardrobeTags;
  aiAnalysis?: WardrobeAiAnalysis | null;
  safeMessage?: string;
  job?: JobStatusData["job"];
};

export type OccasionsData = {
  occasions: Occasion[];
};

export type OccasionData = {
  occasion: Occasion;
};

export type OutfitData = {
  outfit: OutfitRecommendation;
};

export type OutfitPreviewData = {
  preview: {
    id: string;
    status: "not_started" | "generating" | "ready" | "failed" | string;
    provider: string;
    storageKey: string;
    imageUrl: string;
    previewUrl: string;
    cacheKey: string;
    promptVersion: string;
    model: string;
    accuracyLevel?: PreviewAccuracySummary;
    fitWarnings?: string[];
    generatedAt: string | null;
    errorMessage: string;
    attempts: number;
    cached: boolean;
    visualizationNote: string;
  };
  job?: JobStatusData["job"];
};

export type JobStatusData = {
  job: {
    id: string;
    type: string;
    status: "queued" | "processing" | "completed" | "failed" | "cancelled";
    attempts: number;
    maxAttempts: number;
    result: Record<string, any>;
    errorMessage: string;
    availableAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export type SavedLookSummary = {
  id: string;
  outfitId: string;
  title: string;
  occasion: string;
  itemIds: string[];
  favorite: boolean;
  savedAt: string | null;
};

export type WornLookSummary = {
  id: string;
  outfitId: string;
  occasion: string;
  itemIds: string[];
  wornAt: string | null;
  rating: string;
  repeatWarning?: string;
};

export type LooksData = {
  saved: SavedLookSummary[];
  worn: WornLookSummary[];
  favorites: SavedLookSummary[];
  counts: {
    saved: number;
    worn: number;
    favorites: number;
  };
};

export type PreferencesData = {
  preferences: Record<string, any>;
  privacy?: Record<string, any>;
};

export type NotificationPreferencesData = {
  preferences: {
    morningReminder: boolean;
    weatherAlerts: boolean;
    eventPrep: boolean;
    repeatWarnings: boolean;
    pushTokenExists?: boolean;
    quietHours?: { enabled?: boolean; start?: string; end?: string };
    timezone?: string;
  };
};

export type StyleProfileData = {
  profile: {
    id: string;
    favoriteColors: string[];
    dislikedColors: string[];
    favoriteBrands: string[];
    dislikedBrands: string[];
    preferredFits: string[];
    dislikedFits: string[];
    preferredFormality: number | null;
    preferredOccasions: string[];
    culturalStylePreferences: string[];
    preferredCategories: string[];
    avoidedCategories: string[];
    fashionRiskLevel: "conservative" | "balanced" | "expressive";
    comfortPriority: "low" | "medium" | "high";
    luxuryPreference: "low" | "medium" | "high";
    notes: string[];
    inferredFrom: string[];
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export type AvatarProfileData = {
  profile: {
    id: string;
    genderPresentation: "masculine" | "feminine" | "neutral";
    bodyPreset: "slim" | "average" | "athletic" | "curvy" | "plus";
    heightPreset: "short" | "average" | "tall" | null;
    skinTonePreset: string | null;
    hairStylePreset: string | null;
    posePreset: "standing" | "walking" | "editorial" | "runway" | "casual" | "side" | "back";
    visualizationStyle: "minimal" | "luxury" | "streetwear" | "editorial";
    avatarProvider: "ready_player_me" | "fitpick_preset" | "custom_glb";
    avatarUrl: string | null;
    glbStorageKey: string | null;
    heightCm: number | null;
    weightKg: number | null;
    chestCm: number | null;
    bustCm: number | null;
    waistCm: number | null;
    hipsCm: number | null;
    shoulderWidthCm: number | null;
    inseamCm: number | null;
    armLengthCm: number | null;
    neckCm: number | null;
    thighCm: number | null;
    shoeSize: string;
    bodyMeasurementSource: "manual" | "estimated" | "body_scan" | "unknown";
    bodyMeasurementConfidence: number;
    bodyFitPreference: "true_to_size" | "slim" | "regular" | "relaxed" | "oversized";
    consentAccepted: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export type AvatarPreviewData = {
  preview: {
    id: string;
    status: "not_started" | "generating" | "ready" | "failed" | string;
    provider: "s3" | string;
    storageKey: string;
    imageUrl: string;
    previewUrl: string;
    cacheKey: string;
    promptVersion: string;
    model: string;
    visualizationStyle: "minimal" | "luxury" | "streetwear" | "editorial" | string;
    posePreset: "standing" | "walking" | "editorial" | "runway" | "casual" | "side" | "back" | string;
    accuracyLevel?: PreviewAccuracySummary;
    fitStatus?: string;
    fitConfidence?: number;
    fitWarnings?: string[];
    fitLockInstructions?: string[];
    generatedAt: string | null;
    errorMessage: string;
    attempts: number;
    cached: boolean;
    visualizationNote: string;
  };
  avatarProfile?: AvatarProfileData["profile"];
  job?: JobStatusData["job"];
};

export type StylistChatData = {
  reply: string;
  stylist: StylistResponse;
  outfitRecommendationId: string | null;
  avatarPreview: StylistAvatarPreview;
  visualization: {
    visualMode: StylistVisualMode;
    outfitRecommendationId: string | null;
    avatarPreview: StylistAvatarPreview;
    visualizationDisclaimer: string;
    fitLock?: FitLockSummary;
    job?: JobStatusData["job"];
  };
  outfit: OutfitRecommendation | null;
  job?: JobStatusData["job"];
  groundedItemCount: number;
};

export type SendStylistMessageOptions = {
  allowShoppingAdvice?: boolean;
  includeVisualization?: boolean;
  visualMode?: StylistVisualMode;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type FashionMemorySummary = {
  eventCount: number;
  positive: {
    itemIds: string[];
    colors: string[];
    categories: string[];
    brands: string[];
    fits: string[];
  };
  negative: {
    itemIds: string[];
    colors: string[];
    categories: string[];
    brands: string[];
    fits: string[];
  };
  recentlyWornItemIds: string[];
  savedItemIds: string[];
  occasions: string[];
  culturalContext: string[];
  season: string[];
  weather: string[];
  lastEventAt: string | null;
};

export type FashionMemoryData = {
  summary: FashionMemorySummary;
  memory?: {
    id: string;
    type: string;
    createdAt: string | null;
  };
};

export type PlusStatusData = {
  plan: "free" | "plus";
  provider?: string;
  status: string;
  currency?: string;
  amount?: number;
  interval?: string;
  currentPeriodEnd: string | null;
  limits: Record<string, unknown>;
  usageToday: number;
  remainingDailyPicks: number;
  features: Record<string, boolean> | string[];
  billingReady?: boolean;
  availableProviders?: Record<string, { configured: boolean; currencies: string[]; supportsRecurring: boolean }>;
};

export type CheckoutData = {
  checkout: {
    ready: boolean;
    plan: string;
    checkoutUrl?: string | null;
    authorizationUrl?: string | null;
    accessCode?: string | null;
    reference?: string | null;
    currency?: string;
    provider?: string;
    message?: string;
    nextAction?: string;
  };
};

export type BillingProvidersData = {
  billingReady: boolean;
  providers: Record<string, { configured: boolean; currencies: string[]; supportsRecurring: boolean }>;
};

export const getBackendHealth = () => apiRequest<BackendHealth>("/api/health", { cache: "no-store" });
export const getCurrentUser = () => apiRequest<CurrentUserSummary>("/api/auth/me", { cache: "no-store" });
export const register = (body: unknown) => apiRequest("/api/auth/register", { method: "POST", body });
export const login = (body: unknown) => apiRequest("/api/auth/login", { method: "POST", body });
export const logout = () => apiRequest("/api/auth/logout", { method: "POST" });
export const getPreferences = () => apiRequest<PreferencesData>("/api/preferences", { cache: "no-store" });
export const updatePreferences = (body: unknown) => apiRequest<PreferencesData>("/api/preferences", { method: "PATCH", body });
export const getOccasions = () => apiRequest<OccasionsData>("/api/occasions", { cache: "no-store" });
export const createCustomOccasion = (body: unknown) => apiRequest<OccasionData>("/api/occasions/custom", { method: "POST", body });
export const getWardrobe = () => apiRequest<WardrobeListData>("/api/wardrobe", { cache: "no-store" });
export const createWardrobeItem = (body: unknown) => apiRequest<WardrobeItemData>("/api/wardrobe", { method: "POST", body });
export const getWardrobeItem = (id: string) => apiRequest<WardrobeItemData>(`/api/wardrobe/${id}`, { cache: "no-store" });
export const updateWardrobeItem = (id: string, body: unknown) =>
  apiRequest<WardrobeItemData>(`/api/wardrobe/${id}`, { method: "PATCH", body });
export const updateWardrobeTags = (id: string, body: unknown) =>
  apiRequest<WardrobeItemData>(`/api/wardrobe/${id}/tags`, { method: "PATCH", body });
export const archiveWardrobeItem = (id: string) =>
  apiRequest<WardrobeArchiveData>(`/api/wardrobe/${id}`, { method: "DELETE" });
export const uploadWardrobeMetadata = (body: unknown) => apiRequest<WardrobeUploadData>("/api/wardrobe/upload", { method: "POST", body });
export const getWardrobeUpload = (uploadId: string) =>
  apiRequest<WardrobeUploadDetailData>(`/api/wardrobe/upload/${uploadId}`, { cache: "no-store" });
export const reviewWardrobeUploadTags = (uploadId: string, body: unknown) =>
  apiRequest<WardrobeUploadReviewData>(`/api/wardrobe/upload/${uploadId}/review-tags`, { method: "POST", body });
export const suggestWardrobeUploadTags = (uploadId: string) =>
  apiRequest<WardrobeTagSuggestionData>(`/api/wardrobe/upload/${uploadId}/suggest-tags`, { method: "POST" });
export const analyzeWardrobeUpload = (uploadId: string) =>
  apiRequest<WardrobeTagSuggestionData>(`/api/wardrobe/upload/${uploadId}/analyze`, { method: "POST" });
export const confirmWardrobeUploadTags = (uploadId: string, body: unknown) =>
  apiRequest<WardrobeUploadReviewData>(`/api/wardrobe/upload/${uploadId}/confirm-tags`, { method: "POST", body });
export const createRecommendation = (body: unknown) => apiRequest<OutfitData>("/api/outfits/recommend", { method: "POST", body });
export const getOutfit = (id: string) => apiRequest<OutfitData>(`/api/outfits/${id}`, { cache: "no-store" });
export const swapOutfitItem = (id: string, body: unknown) => apiRequest<OutfitData>(`/api/outfits/${id}/swap`, { method: "POST", body });
export const getOutfitPreview = (id: string) => apiRequest<OutfitPreviewData>(`/api/outfits/${id}/preview`, { cache: "no-store" });
export const generateOutfitPreview = (id: string, options: unknown = {}) =>
  apiRequest<OutfitPreviewData>(`/api/outfits/${id}/preview`, { method: "POST", body: options });
export const getJobStatus = (id: string) => apiRequest<JobStatusData>(`/api/jobs/${id}`, { cache: "no-store" });
export const getImageProcessingStatus = (jobId: string) => getJobStatus(jobId);
export const reprocessWardrobeImage = (id: string, body: unknown) =>
  apiRequest<ImageProcessingData>(`/api/wardrobe/${id}/image-processing`, { method: "POST", body });
export const saveOutfit = (id: string, body: unknown) => apiRequest(`/api/outfits/${id}/save`, { method: "POST", body });
export const wearOutfit = (id: string, body: unknown) => apiRequest(`/api/outfits/${id}/wear`, { method: "POST", body });
export const submitOutfitFeedback = (id: string, body: unknown) => apiRequest(`/api/outfits/${id}/feedback`, { method: "POST", body });
export const getLooks = () => apiRequest<LooksData>("/api/looks", { cache: "no-store" });
export const getFashionMemorySummary = () => apiRequest<FashionMemoryData>("/api/fashion-memory", { cache: "no-store" });
export const recordFashionMemory = (event: unknown) => apiRequest<FashionMemoryData>("/api/fashion-memory", { method: "POST", body: event });
export const getPlusStatus = () => apiRequest<PlusStatusData>("/api/billing/plus-status", { cache: "no-store" });
export const startCheckout = (body: unknown) => apiRequest<CheckoutData>("/api/billing/checkout", { method: "POST", body });
export const getBillingProviders = () => apiRequest<BillingProvidersData>("/api/billing/providers", { cache: "no-store" });
export const updateCurrentUser = (body: unknown) => apiRequest<CurrentUserSummary>("/api/users/me", { method: "PATCH", body });
export const getNotificationPreferences = () => apiRequest<NotificationPreferencesData>("/api/notifications/preferences", { cache: "no-store" });
export const updateNotificationPreferences = (body: unknown) =>
  apiRequest<NotificationPreferencesData>("/api/notifications/preferences", { method: "PATCH", body });
export const requestSignedUploadUrl = (body: unknown) => apiRequest<SignedUploadData>("/api/uploads/signed-url", { method: "POST", body });
export const getStyleProfile = () => apiRequest<StyleProfileData>("/api/style-profile", { cache: "no-store" });
export const updateStyleProfile = (body: unknown) => apiRequest<StyleProfileData>("/api/style-profile", { method: "PATCH", body });
export const getAvatarProfile = () => apiRequest<AvatarProfileData>("/api/avatar-profile", { cache: "no-store" });
export const updateAvatarProfile = (body: unknown) => apiRequest<AvatarProfileData>("/api/avatar-profile", { method: "PATCH", body });
export const getAvatarPreview = (id: string) => apiRequest<AvatarPreviewData>(`/api/outfits/${id}/avatar-preview`, { cache: "no-store" });
export const generateAvatarPreview = (id: string, options: unknown = {}) =>
  apiRequest<AvatarPreviewData>(`/api/outfits/${id}/avatar-preview`, { method: "POST", body: options });
export const sendStylistMessage = (message: string, options: SendStylistMessageOptions = {}) =>
  apiRequest<StylistChatData>("/api/stylist/chat", {
    method: "POST",
    body: {
      message,
      ...options
    }
  });
export const pollStylistVisualization = (input: { jobId?: string | null; outfitRecommendationId?: string | null }) => {
  if (input.jobId) return getJobStatus(input.jobId);
  if (input.outfitRecommendationId) return getAvatarPreview(input.outfitRecommendationId);
  return Promise.resolve(invalidResponse);
};
