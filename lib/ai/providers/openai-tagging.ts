import { openai } from "@/lib/ai/openai";
import type {
    AiTaggingInput,
    AiTaggingResult
} from "@/types/ai-tagging";

export async function suggestWithOpenAiProvider(
    input: AiTaggingInput
): Promise<AiTaggingResult> {
    if (!process.env.OPENAI_API_KEY) {
        return {
            ok: false,
            provider: "openai",
            aiTagStatus: "failed",
            safeMessage: "OpenAI API key is missing."
        };
    }

    try {
        const response = await openai.responses.create({
            model: "gpt-4.1-mini",

            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `
You are an AI fashion stylist.

Analyze this clothing image and return ONLY JSON.

{
  "category":"",
  "subcategory":"",
  "color":"",
  "pattern":"",
  "fabric":"",
  "fit":"",
  "formality":[],
  "occasions":[],
  "weather":[],
  "confidence":0.9
}
`
                        },
                        {
                            type: "input_image",
                            image_url: input.imageUrl || "",
                            detail: "auto"
                        }
                    ]
                }
            ]
        });

        const tags = JSON.parse(
            response.output_text || "{}"
        );

        return {
            ok: true,
            provider: "openai",
            confidence: tags.confidence ?? 0.85,
            aiTagStatus: "completed",
            suggestedTags: {
                category: tags.category || "",
                subcategory: tags.subcategory || "",
                color: tags.color || "",
                pattern: tags.pattern || "",
                fabric: tags.fabric || "",
                fit: tags.fit || "",
                formality: Array.isArray(tags.formality)
                    ? tags.formality
                    : [],
                occasions: Array.isArray(tags.occasions)
                    ? tags.occasions
                    : [],
                weather: Array.isArray(tags.weather)
                    ? tags.weather
                    : [],
                confidence: tags.confidence || 0.85,
                needsReview: true
            }
        };
    } catch (error) {
        console.error("OpenAI tagging error:", error);

        return {
            ok: false,
            provider: "openai",
            aiTagStatus: "failed",
            safeMessage:
                "We could not analyze this image."
        };
    }
}
