import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StyleProfileForm } from "@/components/style-profile/StyleProfileForm";

export default function StyleProfilePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Personalization"
        title="Your Style DNA"
        subtitle="Teach FitPick how you like to dress."
      />
      <div className="mt-7">
        <StyleProfileForm />
      </div>
    </AppShell>
  );
}
