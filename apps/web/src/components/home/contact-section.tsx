import React from "react";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/section";

export interface ContactSectionProps {
  className?: string;
}

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=100057616711479",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/kidswearattire/",
  },
  {
    name: "Pinterest",
    href: "https://www.pinterest.com/khalil786tfw/",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@kids.wear251?_r=1&_t=ZS-9AU3ONhdbgm",
  },
  {
    name: "Threads",
    href: "https://www.threads.com/@kidswearattire?invite=0",
  },
];

/**
 * ContactSection displays approved customer care channels, studio location, and official social handles.
 * Contains exact contact details without inventing business hours or unapproved platforms.
 */
export function ContactSection({ className = "" }: ContactSectionProps) {
  return (
    <Section spacing="md" id="contact" className={className}>
      <SectionHeader
        kicker="Direct Customer Care"
        title="Contact Kids Wear"
        description="Have sizing questions or order inquiries? Reach out directly to our team."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Phone Inquiries Card */}
        <div className="p-6 rounded-lg bg-surface border border-border shadow-subtle flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
              <Phone className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-editorial text-lg text-ink font-normal mb-1">Phone Inquiries</h3>
            <p className="font-sans text-xs text-text-muted mb-4">
              Direct assistance for orders & sizing
            </p>
            <p className="font-sans text-base font-semibold text-ink">+92 335 0981 321</p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/50">
            <a
              href="tel:+923350981321"
              className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-accent-storefront hover:underline"
            >
              <span>Call +92 335 0981 321</span>
            </a>
          </div>
        </div>

        {/* Email Card */}
        <div className="p-6 rounded-lg bg-surface border border-border shadow-subtle flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-editorial text-lg text-ink font-normal mb-1">Email Inquiries</h3>
            <p className="font-sans text-xs text-text-muted mb-4">
              General feedback & bespoke queries
            </p>
            <p className="font-sans text-base font-semibold text-ink">info@thekidswear.com</p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/50">
            <a
              href="mailto:info@thekidswear.com"
              className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-accent-storefront hover:underline"
            >
              <span>Send an Email</span>
            </a>
          </div>
        </div>

        {/* Business Address Card */}
        <div className="p-6 rounded-lg bg-surface border border-border shadow-subtle flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-editorial text-lg text-ink font-normal mb-4">Business Address</h3>
            <address className="font-sans text-xs sm:text-sm text-text-base/80 not-italic leading-relaxed">
              Street-05
              <br />
              Darul Islam Colony
              <br />
              Attock, Pakistan
            </address>
          </div>
          <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap gap-2 text-xs">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-accent-storefront transition-colors"
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
