"use client";

import { useRef, useState } from "react";
import { WardrobeImageSlots } from "@/components/wardrobe/WardrobeImageSlots";
import type { WardrobeImagePurpose } from "@/types/ai-tagging";

export function MultiImageUpload({
  disabled = false,
  onFile
}: {
  disabled?: boolean;
  onFile: (purpose: WardrobeImagePurpose, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePurpose, setActivePurpose] = useState<WardrobeImagePurpose>("front");

  return (
    <div className="space-y-3">
      <WardrobeImageSlots
        disabled={disabled}
        onSelect={(purpose) => {
          setActivePurpose(purpose);
          inputRef.current?.click();
        }}
      />
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(activePurpose, file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
