const injectionPatterns = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal.*(secret|key|token|prompt)/i,
  /you are now/i,
  /act as/i
];

export function containsPromptInjectionSignals(text = "") {
  return injectionPatterns.some((pattern) => pattern.test(text));
}

export function sanitizeUserPrompt(input = "") {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 800);
}

export function sanitizeExtractedText(input = "") {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 1200);
}

export function assertWardrobeGrounding(responseItemIds: string[], ownedItemIds: string[]) {
  const owned = new Set(ownedItemIds.map(String));
  return responseItemIds.every((id) => owned.has(String(id)));
}

export function safeAIError(error: unknown) {
  if (error instanceof Error && containsPromptInjectionSignals(error.message)) return "AI request failed safely.";
  return "AI service is unavailable right now.";
}
