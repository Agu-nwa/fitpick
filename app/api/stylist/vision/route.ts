import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAiModel } from "@/lib/ai/models/registry";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const imageUrl = body.imageUrl;
    const question =
      body.question ||
      "Analyze this clothing item.";

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL required" },
        { status: 400 }
      );
    }

    const response =
      await openai.responses.create({
        model: getAiModel("wardrobeVision"),

        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: question
              },

              {
                type: "input_image",
                image_url: imageUrl,
                detail: "high"
              }
            ]
          }
        ]
      });

    return NextResponse.json({
      reply: response.output_text
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        reply:
          "Unable to analyze image."
      },
      { status: 500 }
    );
  }
}
