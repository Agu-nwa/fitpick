import { AuthStatusCard } from "@/components/auth/AuthStatusCard";
import Link from "next/link";
import { BackendHealthCard } from "@/components/integration/BackendHealthCard";
import { AppShell } from "@/components/layout/AppShell";
import { BackendReadyCard } from "@/components/system/BackendReadyCard";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiContracts } from "@/lib/api-contract";

const integrationSteps = [
  "Integration complete: auth, wardrobe, uploads, AI tag review, outfits, looks, preferences, and Plus status",
  "Testing complete: route checks, safety copy scan, secret scan, build, and backend smoke are ready",
  "Deployment path: EC2, PM2, Nginx reverse proxy, and HTTPS-ready production notes"
];

export default function BackendReadyPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Deployment Phase 8"
        title="Production path ready"
        subtitle="Frontend, backend, storage, AI tagging foundation, integration, and testing are complete. FitPick is prepared for EC2, PM2, and Nginx deployment."
      />

      <Card className="bg-cocoa text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Integration status</p>
          <StatusBadge tone="success">complete</StatusBadge>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">FitPick is ready for deployment hardening.</h2>
        <p className="mt-3 text-sm leading-6 text-white/75">
          Mock fallback remains available while live auth, wardrobe, outfits, looks, preferences, Plus, storage, and AI tagging flows move toward production.
        </p>
      </Card>

      <section className="mt-7">
        <SectionHeader title="Live integration checks" />
        <div className="space-y-3">
          <BackendHealthCard />
          <AuthStatusCard />
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Phase status" />
        <div className="space-y-3">
          {[
            ["Frontend complete", "Mobile app shell, routes, components, states, and mock fallbacks are preserved.", "complete"],
            ["Backend complete", "Auth, wardrobe, outfits, Plus, uploads, admin seed, audit, and smoke checks are available.", "complete"],
            ["API client available", "Safe requests include credentials and mobile-friendly fallback messages.", "complete"],
            ["Health endpoint connected", "GET /api/health is checked from the readiness screen.", "complete"],
            ["Session check connected", "GET /api/auth/me is checked without forcing route protection yet.", "complete"],
            ["S3 storage integrated", "Signed upload, wardrobe image metadata, and generated previews use S3.", "complete"],
            ["AI tagging foundation integrated", "Uploaded clothing photos can request suggested tags before user review.", "complete"],
            ["Testing complete", "Route, safety, secret, build, and smoke-test scripts are available.", "complete"],
            ["Deployment started", "PM2, Nginx, security group, HTTPS, and production checklist docs are available.", "next"]
          ].map(([title, detail, status]) => (
            <Card key={title} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
                </div>
                <StatusBadge tone={status === "complete" ? "success" : "warning"}>{status}</StatusBadge>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Next integration phases" />
        <Card className="p-4">
          <div className="space-y-3">
            {integrationSteps.map((step) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl bg-canvas px-3 py-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-cocoa" aria-hidden />
                <p className="text-sm leading-5 text-ink">{step}</p>
              </div>
            ))}
          </div>
          <Link href="/states" className="mt-4 block text-sm font-semibold text-cocoa">Review QA state patterns</Link>
        </Card>
      </section>

      <section className="mt-7">
        <SectionHeader title="API contracts" />
        <div className="space-y-3">
          {apiContracts.map((contract) => <BackendReadyCard key={contract.id} contract={contract} />)}
        </div>
      </section>
    </AppShell>
  );
}
