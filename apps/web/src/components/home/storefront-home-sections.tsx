import Link from "next/link";
import { Truck, CreditCard, Banknote, ArrowRight, Star } from "lucide-react";
import { STOREFRONT_THEMES, type StorefrontSlug } from "@/components/theme/storefront-tokens";
import { StorefrontContactSection } from "@/components/home/storefront-contact-section";
import { StorefrontSwitcher } from "@/components/shell/storefront-switcher";
import { formatPKR } from "@/components/commerce/price";
import { ProductCard } from "@/components/commerce/product-card";
import { ReviewCard } from "@/components/reviews/review-card";
import type { ApiProductCard, PublicReviewItem } from "@/lib/api";

function SectionHeading({
  eyebrow,
  title,
  href,
  action,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-storefront-contrast)]">
          {eyebrow}
        </p>
        <h2 className="font-editorial text-2xl sm:text-3xl text-ink">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-storefront-contrast)] hover:underline"
        >
          {action}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  storefront,
}: {
  products: ApiProductCard[];
  storefront: StorefrontSlug;
}) {
  if (!products.length)
    return (
      <p className="rounded-2xl border border-border bg-surface p-8 text-sm text-text-muted">
        No products are available in this collection yet.
      </p>
    );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          id={p.id}
          name={p.name}
          slug={p.slug}
          regularPrice={p.regularPrice}
          compareAtPrice={p.compareAtPrice}
          isNewArrival={p.isNewArrival}
          storefrontSlug={storefront}
          mainImage={p.mainImage}
          hoverImage={p.hoverImage}
          quickAdd={p.quickAdd}
        />
      ))}
    </div>
  );
}

export function selectStorefrontReviews(reviews: PublicReviewItem[], storefront: StorefrontSlug) {
  return reviews
    .filter((review) => review.product.storefrontSlug === storefront)
    .sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
}

export function StorefrontHomeSections({
  storefront,
  newArrivals,
  catalog,
  reviews,
  flatDeliveryCharge,
}: {
  storefront: StorefrontSlug;
  newArrivals: ApiProductCard[];
  catalog: ApiProductCard[];
  reviews: PublicReviewItem[];
  flatDeliveryCharge?: string | null;
}) {
  const theme = STOREFRONT_THEMES[storefront];
  const newIds = new Set(newArrivals.map((p) => p.id));
  const distinct = catalog.filter((p) => !newIds.has(p.id));
  const shopProducts = (
    distinct.length >= 4 ? distinct : [...distinct, ...catalog.filter((p) => newIds.has(p.id))]
  ).slice(0, 4);
  const scopedReviews = selectStorefrontReviews(reviews, storefront);
  const services = [
    { icon: Truck, title: "Pakistan-Wide Delivery", copy: "Delivery within 10 days" },
    {
      icon: CreditCard,
      title: "Flat Delivery Charge",
      copy: flatDeliveryCharge ? formatPKR(flatDeliveryCharge) : "Calculated at checkout",
    },
    { icon: Banknote, title: "Cash on Delivery", copy: "Available across Pakistan" },
    { icon: CreditCard, title: "Bank Transfer", copy: "Manual bank transfer available" },
  ];
  const reasons = [
    {
      title: "Three Age-Based Storefronts",
      copy: "Focused shopping experiences for different age groups.",
    },
    {
      title: "Pakistan-Wide Delivery",
      copy: "Orders are delivered across Pakistan within 10 days.",
    },
    { title: "Flexible Payment Options", copy: "Cash on Delivery and manual bank transfer." },
    { title: "Direct Contact", copy: "Reach Kids Wear by phone or email for order enquiries." },
  ];
  return (
    <>
      <section
        aria-label="Shopping and delivery"
        className="grid grid-cols-2 gap-3 border-b border-border py-6 lg:grid-cols-4 lg:gap-6"
      >
        {services.map((s) => (
          <div key={s.title} className="flex items-start gap-3">
            <s.icon
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-storefront-contrast)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-xs font-semibold text-ink sm:text-sm">{s.title}</h2>
              <p className="text-xs text-text-muted">{s.copy}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="flex justify-center border-b border-border py-7 sm:py-9">
        <StorefrontSwitcher currentStorefront={storefront} />
      </section>
      <section className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="Just arrived"
          title="New Arrivals"
          href={`/${storefront}/new-arrivals`}
          action="View all"
        />
        <ProductGrid products={newArrivals.slice(0, 4)} storefront={storefront} />
      </section>
      <section className="border-t border-border py-12 sm:py-16">
        <SectionHeading
          eyebrow={theme.ageRange}
          title={`Shop ${theme.name}`}
          href={`/${storefront}/shop`}
          action="Shop All"
        />
        <ProductGrid products={shopProducts} storefront={storefront} />
      </section>
      <section className="border-t border-border py-12 sm:py-16">
        <SectionHeading eyebrow="The Kids Wear experience" title="Why Choose Kids Wear" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r, i) => (
            <div key={r.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="mb-5 block font-editorial text-3xl text-[var(--color-storefront-contrast)]/60">
                0{i + 1}
              </span>
              <h3 className="mb-2 font-editorial text-lg text-ink">{r.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{r.copy}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="reviews" className="border-t border-border py-12 sm:py-16">
        <SectionHeading
          eyebrow="Customer voices"
          title="Reviews"
          href="/reviews"
          action="View More Reviews"
        />
        {scopedReviews.length ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="homepage-reviews-grid"
          >
            {scopedReviews.map((r) => (
              <ReviewCard key={r.id} review={r} className="h-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
            <Star className="mx-auto mb-3 h-6 w-6 text-[var(--color-storefront-contrast)]" />
            Reviews will appear here when published.
          </div>
        )}
      </section>
      <StorefrontContactSection storefront={storefront} />
    </>
  );
}
