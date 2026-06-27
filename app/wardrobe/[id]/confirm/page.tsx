import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WardrobeUploadConfirmClient } from "@/components/wardrobe/WardrobeUploadConfirmClient";

export default function WardrobeConfirmPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <PageHeader eyebrow="AI confirmation" title="Review your garment intelligence" subtitle="Confirm what FitPick detected before it becomes trusted wardrobe data." />
      <WardrobeUploadConfirmClient uploadId={params.id} />
    </AppShell>
  );
}
