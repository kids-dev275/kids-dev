import React from "react";
import { Truck, Scissors, MessageCircle, ShieldCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/section";
import { formatPKR } from "@/components/commerce/price";

export interface WhyKidsWearProps {
  className?: string;
  flatDeliveryCharge?: string | null;
}

const TRUST_PILLARS = [
  {
    icon: Truck,
    title: "Pakistan-Wide Delivery",
    description:
      "Reliable parcel logistics across all cities in Pakistan. Delivery within 10 days.",
  },
  {
    icon: Scissors,
    title: "Made to Order",
    description: "Each garment is prepared upon order confirmation.",
  },
  {
    icon: MessageCircle,
    title: "Dedicated Support",
    description:
      "Personalized sizing guidance and order assistance available via Telephone and Email.",
  },
  {
    icon: ShieldCheck,
    title: "Cash on Delivery",
    description:
      "Convenient payment options supporting Cash on Delivery and direct manual bank transfer.",
  },
];

/**
 * WhyKidsWear presents approved brand trust and logistics standards.
 * Dynamically displays the Admin-managed flat delivery charge from public settings.
 */
export function WhyKidsWear({ className = "", flatDeliveryCharge }: WhyKidsWearProps) {
  return (
    <Section spacing="md" className={className}>
      <SectionHeader
        kicker="Our Standards"
        title="Why Choose Kids Wear"
        description="Thoughtfully presented Kids Wear apparel backed by reliable nationwide logistics."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {TRUST_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.title}
              className="p-6 rounded-lg bg-surface border border-border flex flex-col justify-between shadow-subtle"
            >
              <div>
                <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-editorial text-lg text-ink font-normal mb-2">{pillar.title}</h3>
                <p className="font-sans text-xs sm:text-sm text-text-base/80 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              {pillar.title === "Pakistan-Wide Delivery" && flatDeliveryCharge && (
                <div className="mt-4 pt-3 border-t border-border/50 text-[11px] font-sans text-text-muted">
                  Flat delivery charge: {formatPKR(flatDeliveryCharge)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
