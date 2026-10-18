import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import {
  PRIVACY_POLICY_DRAFT_LABEL,
  PRIVACY_POLICY_LINK_LABEL,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_UPDATED_AT,
  PRIVACY_POLICY_VERSION,
} from '@/lib/privacy-policy';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: `${PRIVACY_POLICY_LINK_LABEL} · ${BRAND_NAME}`,
};

// Public page (outside every role tree, no guard): it must be readable before
// an account exists, from the consent box on the sign-up forms. Content lives
// in lib/privacy-policy.ts next to the version the sign-up records.
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle className="fixed right-4 top-4 z-30" />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-24 md:p-8 md:pb-24">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1.5 text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft size={14} aria-hidden="true" />
            กลับหน้าหลัก
          </Link>
        </Button>

        <div className="space-y-3">
          <Badge tone="warning">{PRIVACY_POLICY_DRAFT_LABEL}</Badge>
          <PageHeader
            title={PRIVACY_POLICY_LINK_LABEL}
            description={`${BRAND_NAME} · เวอร์ชัน ${PRIVACY_POLICY_VERSION} · ปรับปรุงเมื่อ ${PRIVACY_POLICY_UPDATED_AT}`}
          />
        </div>

        {PRIVACY_POLICY_SECTIONS.map((section, index) => (
          <Card key={section.id} id={section.id}>
            <CardHeader>
              <h2 className="text-base font-semibold leading-snug text-primary">
                {index + 1}. {section.title}
              </h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul className="list-disc space-y-2 pl-5">
                  {section.items.map((item) => (
                    <li key={item} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
