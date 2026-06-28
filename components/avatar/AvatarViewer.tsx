"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AvatarProfileData } from "@/lib/api-client";

type ViewerPosePreset = AvatarProfileData["profile"]["posePreset"];

const DynamicAvatarCanvas = dynamic(
  () => import("@/components/avatar/AvatarCanvas").then((module) => module.AvatarCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-canvas">
        <div className="h-16 w-16 animate-pulse rounded-full bg-line" />
      </div>
    )
  }
);

export function AvatarViewer({ profile }: { profile?: AvatarProfileData["profile"] | null }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [animatedPreview, setAnimatedPreview] = useState(false);
  const [posePreset, setPosePreset] = useState(profile?.posePreset || "standing");

  useEffect(() => {
    setPosePreset(profile?.posePreset || "standing");
  }, [profile?.posePreset]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Digital Human Preview</p>
          <p className="mt-1 text-xs leading-5 text-muted">AI fashion visualization, not exact body-measurement virtual try-on.</p>
        </div>
        <Badge tone={profile?.consentAccepted ? "premium" : "warning"}>
          {profile?.consentAccepted ? "Ready" : "Review"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-ink">
          Pose
          <select className="focus-ring mt-1 min-h-10 w-full rounded-2xl border border-line bg-white px-3 text-xs text-ink" value={posePreset} onChange={(event) => setPosePreset(event.target.value as ViewerPosePreset)}>
            <option value="standing">Standing</option>
            <option value="runway">Runway</option>
            <option value="walking">Walking</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
          </select>
        </label>
        <Button type="button" variant={autoRotate ? "primary" : "secondary"} className="self-end" onClick={() => setAutoRotate((value) => !value)}>
          {autoRotate ? "360 on" : "360 off"}
        </Button>
        <Button type="button" variant={animatedPreview ? "primary" : "secondary"} className="self-end" onClick={() => setAnimatedPreview((value) => !value)}>
          {animatedPreview ? "Walking on" : "Walking mode"}
        </Button>
      </div>

      <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-canvas">
        <DynamicAvatarCanvas
          avatarUrl={profile?.avatarUrl || null}
          bodyPreset={profile?.bodyPreset || "average"}
          visualizationStyle={profile?.visualizationStyle || "luxury"}
          posePreset={posePreset}
          autoRotate={autoRotate}
          animatedPreview={animatedPreview}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{profile?.avatarProvider === "ready_player_me" ? "Ready Player Me" : profile?.avatarProvider === "custom_glb" ? "Custom GLB" : "FitPick preset"}</Badge>
        <Badge tone="neutral">{posePreset}</Badge>
        <Badge tone="neutral">{profile?.visualizationStyle || "luxury"}</Badge>
        {autoRotate ? <Badge tone="info">360 view</Badge> : null}
        {animatedPreview ? <Badge tone="warning">Animated preview mode</Badge> : null}
      </div>
      <p className="text-xs leading-5 text-muted">Manual orbit controls are enabled. Animated preview mode uses available GLB animations when present, otherwise subtle viewer movement only.</p>
    </Card>
  );
}
