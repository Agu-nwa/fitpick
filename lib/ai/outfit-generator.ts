import OpenAI from "openai";
import { getAiModel } from "@/lib/ai/models/registry";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateAiOutfit({
  wardrobe,
  occasion,
  weather,
  style
}: {
  wardrobe: any[];
  occasion: string;
  weather: string;
  style: string;
}) {

  const wardrobeSummary = wardrobe
    .slice(0, 100)
    .map(
      (item) =>
        `${item._id} | ${item.category} | ${item.color} | ${
          item.subcategory || ""
        }`
    )
    .join("\n");

  const response =
    await openai.responses.create({
      model: getAiModel("recommendationExplanation"),

      input: `
You are a professional fashion stylist.

Choose the BEST outfit from this wardrobe.

Wardrobe:

${wardrobeSummary}

Occasion: ${occasion}
Weather: ${weather}
Style preference: ${style}

Return ONLY JSON:

{
 "selectedItemIds": [],
 "summary": "",
 "confidence": "Strong match"
}
`
    });

  return JSON.parse(
    response.output_text || "{}"
  );
}
