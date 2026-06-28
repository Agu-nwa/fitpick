import { AppShell } from "@/components/layout/AppShell";
import { AvatarStudioClient } from "@/components/avatar/AvatarStudioClient";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AvatarPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Luxury tier"
        title="Create your Digital Human"
        subtitle="Add measurements, fit preference, and 360° controls so FitPick can reduce random fit changes. This remains an AI visualization until true 3D simulation is connected."
      />
      <div className="mt-7">
        <AvatarStudioClient />
      </div>
    </AppShell>
  );
}
