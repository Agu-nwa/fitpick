import OpenAI from "openai";

let cachedOpenAI: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_ADMIN_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  if (!cachedOpenAI) {
    cachedOpenAI = new OpenAI({ apiKey });
  }

  return cachedOpenAI;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, property, receiver) {
    return Reflect.get(getOpenAIClient(), property, receiver);
  }
});
