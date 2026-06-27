export type AiOperation =
  | "wardrobeVision"
  | "ocrLabel"
  | "stylistChat"
  | "recommendationExplanation"
  | "imageGeneration"
  | "imagePrompt"
  | "embedding";

const defaults: Record<AiOperation, string> = {
  wardrobeVision: "gpt-4.1-mini",
  ocrLabel: "gpt-4.1-mini",
  stylistChat: "gpt-4.1-mini",
  recommendationExplanation: "gpt-4.1-mini",
  imageGeneration: "gpt-image-1",
  imagePrompt: "gpt-4.1-mini",
  embedding: "text-embedding-3-small"
};

const envNames: Record<AiOperation, string> = {
  wardrobeVision: "OPENAI_WARDROBE_MODEL",
  ocrLabel: "OPENAI_OCR_MODEL",
  stylistChat: "OPENAI_STYLIST_MODEL",
  recommendationExplanation: "OPENAI_RECOMMENDATION_MODEL",
  imageGeneration: "OPENAI_IMAGE_GENERATION_MODEL",
  imagePrompt: "OPENAI_IMAGE_PROMPT_MODEL",
  embedding: "OPENAI_EMBEDDING_MODEL"
};

export function getAiModel(operation: AiOperation) {
  return process.env[envNames[operation]] || defaults[operation];
}

export function getAiModelRegistry() {
  return Object.fromEntries(
    (Object.keys(defaults) as AiOperation[]).map((operation) => [operation, getAiModel(operation)])
  ) as Record<AiOperation, string>;
}
