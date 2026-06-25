export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { OutfitRecommendation } from "@/models/OutfitRecommendation";
import { StylePreference } from "@/models/StylePreference";
import { WardrobeItem } from "@/models/WardrobeItem";
import { learnFromFeedback } from "@/lib/recommendation/learning";
import { readJson, validateBody } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({
  liked: z.boolean(),
  reason: z.string().optional()
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await requireUser();

    if (!auth.ok) {
      return auth.response;
    }

    const parsed = validateBody(
      schema,
      await readJson(request)
    );

    if (!parsed.ok) {
      return parsed.response;
    }

    const outfit =
      await OutfitRecommendation.findOne({
        _id: context.params.id,
        userId: auth.user._id
      });

    if (!outfit) {
      return apiError(
        "NOT_FOUND",
        "Outfit not found."
      );
    }

    const items =
      await WardrobeItem.find({
        _id: {
          $in: outfit.itemIds
        }
      });

    const preferences =
      await StylePreference.findOne({
        userId: auth.user._id
      });

    if (preferences) {
      const updated =
        learnFromFeedback({
          liked: parsed.data.liked,
          reason: parsed.data.reason,
          outfitItems: items,
          preferences: preferences?.toObject?.() ?? JSON.parse(JSON.stringify(preferences))
        });

      // preferences' exact fields may differ from the learning result shape.
      // Use a typed escape to assign whatever updated fields exist.
      const prefAny = preferences as any;

      if (updated.favoriteColors) {
        prefAny.favoriteColors = updated.favoriteColors;
      }

      if (updated.favoriteCategories) {
        prefAny.favoriteCategories = updated.favoriteCategories;
      }

      await preferences.save();
    }

    return apiSuccess({
      message:
        "Feedback saved successfully."
    });
  } catch (error) {
    console.error(
      "Feedback error:",
      error
    );

    return apiError(
      "INTERNAL_ERROR",
      "Unable to save feedback."
    );
  }
}