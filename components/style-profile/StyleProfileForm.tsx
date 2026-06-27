"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getStyleProfile, updateStyleProfile, type StyleProfileData } from "@/lib/api-client";

const inputClass =
  "focus-ring min-h-11 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted";

function splitList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function joinList(values?: string[]) {
  return (values || []).join(", ");
}

export function StyleProfileForm() {
  const [profile, setProfile] = useState<StyleProfileData["profile"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [favoriteColors, setFavoriteColors] = useState("");
  const [dislikedColors, setDislikedColors] = useState("");
  const [preferredFits, setPreferredFits] = useState("");
  const [preferredOccasions, setPreferredOccasions] = useState("");
  const [culturalStylePreferences, setCulturalStylePreferences] = useState("");
  const [notes, setNotes] = useState("");
  const [fashionRiskLevel, setFashionRiskLevel] = useState<"conservative" | "balanced" | "expressive">("balanced");
  const [comfortPriority, setComfortPriority] = useState<"low" | "medium" | "high">("medium");
  const [luxuryPreference, setLuxuryPreference] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    void (async () => {
      const result = await getStyleProfile();
      setLoading(false);
      if (!result.ok) {
        setError("Unable to load your Style DNA.");
        return;
      }

      const next = result.data.profile;
      setProfile(next);
      setFavoriteColors(joinList(next.favoriteColors));
      setDislikedColors(joinList(next.dislikedColors));
      setPreferredFits(joinList(next.preferredFits));
      setPreferredOccasions(joinList(next.preferredOccasions));
      setCulturalStylePreferences(joinList(next.culturalStylePreferences));
      setNotes(joinList(next.notes));
      setFashionRiskLevel(next.fashionRiskLevel);
      setComfortPriority(next.comfortPriority);
      setLuxuryPreference(next.luxuryPreference);
    })();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setNotice("");
    setError("");
    const result = await updateStyleProfile({
      favoriteColors: splitList(favoriteColors),
      dislikedColors: splitList(dislikedColors),
      preferredFits: splitList(preferredFits),
      preferredOccasions: splitList(preferredOccasions),
      culturalStylePreferences: splitList(culturalStylePreferences),
      notes: splitList(notes),
      fashionRiskLevel,
      comfortPriority,
      luxuryPreference
    });
    setSaving(false);

    if (!result.ok) {
      setError("Unable to save your Style DNA.");
      return;
    }

    setProfile(result.data.profile);
    setNotice("Style DNA saved.");
  }

  if (loading) {
    return <Card><p className="text-sm text-muted">Loading your Style DNA...</p></Card>;
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        These preferences help your AI stylist refine every recommendation. You can change them anytime.
      </p>

      {error ? <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-ink">{error}</p> : null}
      {notice ? <p className="rounded-2xl bg-success/10 px-3 py-2 text-xs font-semibold text-ink">{notice}</p> : null}

      <label className="block text-xs font-semibold text-ink">
        Favorite colors
        <input className={inputClass} value={favoriteColors} onChange={(event) => setFavoriteColors(event.target.value)} placeholder="navy, white, olive" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Disliked colors
        <input className={inputClass} value={dislikedColors} onChange={(event) => setDislikedColors(event.target.value)} placeholder="yellow, neon green" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Preferred fits
        <input className={inputClass} value={preferredFits} onChange={(event) => setPreferredFits(event.target.value)} placeholder="slim, tailored, relaxed" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Preferred occasions
        <input className={inputClass} value={preferredOccasions} onChange={(event) => setPreferredOccasions(event.target.value)} placeholder="church, business casual, date night" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Cultural style preferences
        <input className={inputClass} value={culturalStylePreferences} onChange={(event) => setCulturalStylePreferences(event.target.value)} placeholder="native wear, ankara, senator wear" />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-ink">
          Fashion risk
          <select className={inputClass} value={fashionRiskLevel} onChange={(event) => setFashionRiskLevel(event.target.value as any)}>
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="expressive">Expressive</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink">
          Comfort priority
          <select className={inputClass} value={comfortPriority} onChange={(event) => setComfortPriority(event.target.value as any)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink">
          Luxury preference
          <select className={inputClass} value={luxuryPreference} onChange={(event) => setLuxuryPreference(event.target.value as any)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-semibold text-ink">
        Notes
        <textarea className={`${inputClass} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="I like clean lines, breathable fabrics, and polished shoes." />
      </label>

      {profile?.inferredFrom?.length ? (
        <p className="text-xs leading-5 text-muted">Inferred gently from: {profile.inferredFrom.join(", ")}. You stay in control of what FitPick remembers.</p>
      ) : null}

      <Button type="button" className="w-full" onClick={() => void saveProfile()} disabled={saving}>
        {saving ? "Saving..." : "Save Style DNA"}
      </Button>
    </Card>
  );
}
