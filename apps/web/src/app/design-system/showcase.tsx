"use client";

import React, { useState } from "react";
import {
  StorefrontScope,
  StorefrontSlug,
  STOREFRONT_THEMES,
} from "@/components/theme/storefront-theme";
import { PageContainer } from "@/components/layout/page-container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Stack, Cluster } from "@/components/layout/stack";
import { Typography, Heading, Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Surface, Panel, Divider } from "@/components/ui/card";
import {
  FormField,
  FieldLabel,
  FieldError,
  FieldHint,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
} from "@/components/ui/form";
import { Price } from "@/components/commerce/price";
import { ProductCard } from "@/components/commerce/product-card";
import {
  Alert,
  InlineError,
  SuccessMessage,
  LoadingSpinner,
  Skeleton,
} from "@/components/ui/feedback";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  NoResultsState,
  EmptyCartState,
  OutOfStockState,
} from "@/components/commerce/system-states";
import { NavLink, IconButton } from "@/components/ui/navigation";
import { Sparkles, ArrowRight, Search } from "lucide-react";

export function DesignSystemShowcase() {
  const [activeStorefront, setActiveStorefront] = useState<StorefrontSlug>("mini-sprouts");
  const [formInput, setFormInput] = useState("Amir Khan");
  const [formError, setFormError] = useState("");
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [selectedRadio, setSelectedRadio] = useState("option1");

  return (
    <StorefrontScope storefront={activeStorefront} className="min-h-screen bg-canvas pb-24">
      {/* Internal Development Banner */}
      <div className="bg-surface-soft border-b border-border py-2 px-4 text-center text-xs font-sans text-text-muted">
        <span className="font-semibold text-text-primary">INTERNAL DEVELOPMENT SURFACE:</span> Kids
        Wear Design System Foundation (Work Unit 10). Not accessible via customer navigation.
      </div>

      <PageContainer className="pt-8">
        {/* Header & Storefront Theme Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border">
          <div>
            <Text variant="label" className="text-accent-storefront">
              Design System Showcase
            </Text>
            <Heading level={1} variant="h1" className="mt-1">
              Kids Wear Foundation
            </Heading>
            <Text variant="body" className="text-text-secondary mt-1">
              Premium Editorial Fashion Commerce • Modern Bento Tokens & Primitives
            </Text>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-surface p-3 rounded-lg border border-border shadow-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Active Storefront:
            </span>
            <div className="flex items-center gap-1.5">
              {(Object.keys(STOREFRONT_THEMES) as StorefrontSlug[]).map((slug) => {
                const theme = STOREFRONT_THEMES[slug];
                const isActive = activeStorefront === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setActiveStorefront(slug)}
                    className={`px-3 py-1.5 rounded text-xs font-sans font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? "bg-accent-storefront text-white shadow-subtle"
                        : "bg-surface-soft text-text-primary hover:bg-border/40"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full border border-white/40"
                      style={{ backgroundColor: theme.primaryAccent }}
                    />
                    {theme.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 1. Master Palette & Storefront Theme Tokens */}
        <Section spacing="sm">
          <SectionHeader
            title="1. Master Color System & Storefront Theme"
            description="Verified master palette tokens with dynamic CSS attribute-scoped storefront accents."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Canvas", hex: "#FBF7F2", bg: "bg-canvas", border: true },
              { label: "Surface", hex: "#FFFDFC", bg: "bg-surface", border: true },
              { label: "Surface Soft", hex: "#F6EFE8", bg: "bg-surface-soft", border: true },
              { label: "Ink (Primary)", hex: "#3F2B24", bg: "bg-text-primary", textWhite: true },
              { label: "Text (Body)", hex: "#5F4A42", bg: "bg-text-secondary", textWhite: true },
              { label: "Muted", hex: "#8E7B73", bg: "bg-text-muted", textWhite: true },
              { label: "Border", hex: "#E7DDD5", bg: "bg-border" },
              { label: "Champagne", hex: "#C6A56A", bg: "bg-accent-champagne", textWhite: true },
              {
                label: "Storefront Accent",
                hex: STOREFRONT_THEMES[activeStorefront].primaryAccent,
                bg: "bg-accent-storefront",
                textWhite: true,
              },
              {
                label: "Accent Hover",
                hex: "Derived",
                bg: "bg-accent-storefront-hover",
                textWhite: true,
              },
              { label: "Accent Soft", hex: "Derived", bg: "bg-accent-storefront-soft" },
              { label: "White", hex: "#FFFFFF", bg: "bg-white", border: true },
            ].map((c) => (
              <div
                key={c.label}
                className={`p-3 rounded-md flex flex-col justify-between h-24 ${c.bg} ${
                  c.border ? "border border-border" : ""
                } ${c.textWhite ? "text-white" : "text-text-primary"}`}
              >
                <span className="text-xs font-semibold">{c.label}</span>
                <span className="text-[10px] opacity-80 font-mono">{c.hex}</span>
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        {/* 2. Typography Hierarchy */}
        <Section spacing="sm">
          <SectionHeader
            title="2. Typography Hierarchy"
            description="Editorial serif headings (Prata) paired with clean geometric UI sans (Montserrat)."
          />
          <Card className="space-y-6">
            <div>
              <Text variant="label">Display • 48-60px</Text>
              <Typography variant="display">Timeless Kids Wear Apparel</Typography>
            </div>
            <div>
              <Text variant="label">H1 • 36-48px</Text>
              <Heading level={1} variant="h1">
                Apparel Heading Scale
              </Heading>
            </div>
            <div>
              <Text variant="label">H2 • 28-36px</Text>
              <Heading level={2} variant="h2">
                Structured Section Heading
              </Heading>
            </div>
            <div>
              <Text variant="label">H3 • 20-24px</Text>
              <Heading level={3} variant="h3">
                Fabric & Care Guide
              </Heading>
            </div>
            <div>
              <Text variant="label">H4 • 18-20px</Text>
              <Heading level={4} variant="h4">
                Product Specifications
              </Heading>
            </div>
            <div>
              <Text variant="label">Body Large • 18px</Text>
              <Typography variant="body-large">
                A thoughtfully presented collection for celebratory milestones across Pakistan.
              </Typography>
            </div>
            <div>
              <Text variant="label">Body • 16px</Text>
              <Typography variant="body">
                Each garment is made to order upon confirmation. Delivered across Pakistan within 10
                days.
              </Typography>
            </div>
            <div>
              <Text variant="label">Body Small • 14px</Text>
              <Typography variant="body-small">
                Deliveries across Pakistan take 3–5 business days. Flat delivery charge Rs. 300
                applied at checkout.
              </Typography>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <Text variant="label">Label • 12px Uppercase</Text>
                <div className="mt-1">
                  <Text variant="label" className="text-accent-storefront">
                    New Collection 2026
                  </Text>
                </div>
              </div>
              <div>
                <Text variant="label">Caption • 12px</Text>
                <div className="mt-1">
                  <Typography variant="caption">SKU KW-MS-KRT-01 • Made in Pakistan</Typography>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        <Divider />

        {/* 3. Buttons & Interactive Primitives */}
        <Section spacing="sm">
          <SectionHeader
            title="3. Button Primitives"
            description="Strictly typed buttons supporting primary, secondary, outline, and ghost variants in 3 responsive sizes."
          />
          <Stack gap="md">
            <div>
              <Text variant="label" className="mb-2 block">
                Variants (MD Size)
              </Text>
              <Cluster gap="sm">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline Action</Button>
                <Button variant="ghost">Ghost Action</Button>
              </Cluster>
            </div>

            <div>
              <Text variant="label" className="mb-2 block">
                Sizes (Primary Variant)
              </Text>
              <Cluster gap="sm">
                <Button variant="primary" size="sm">
                  Small (36px)
                </Button>
                <Button variant="primary" size="md">
                  Medium (44px)
                </Button>
                <Button variant="primary" size="lg">
                  Large (48px)
                </Button>
              </Cluster>
            </div>

            <div>
              <Text variant="label" className="mb-2 block">
                States & Icons
              </Text>
              <Cluster gap="sm">
                <Button variant="primary" isLoading>
                  Saving Order
                </Button>
                <Button variant="primary" disabled>
                  Disabled State
                </Button>
                <Button variant="outline" leftIcon={<Sparkles className="h-4 w-4" />}>
                  Featured View
                </Button>
                <Button variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Explore Storefront
                </Button>
                <Button variant="outline" href="#navigation">
                  Link Composition (href)
                </Button>
              </Cluster>
            </div>
          </Stack>
        </Section>

        <Divider />

        {/* 4. Form Controls */}
        <Section spacing="sm">
          <SectionHeader
            title="4. Accessible Form Controls"
            description="Semantic inputs with visible labels, ARIA associations, focus rings, and validation feedback."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <FormField id="demo-name" isRequired>
                <FieldLabel>Full Customer Name</FieldLabel>
                <Input
                  value={formInput}
                  onChange={(e) => setFormInput(e.target.value)}
                  placeholder="e.g. Fatima Ali"
                />
                <FieldHint>Enter the full legal name for parcel delivery.</FieldHint>
              </FormField>

              <FormField id="demo-error" isInvalid={Boolean(formError)}>
                <FieldLabel>Delivery Street Address</FieldLabel>
                <Input
                  defaultValue="12 Gulberg III"
                  isInvalid={Boolean(formError)}
                  onChange={(e) => {
                    if (e.target.value.length < 5) {
                      setFormError("Address must be at least 5 characters.");
                    } else {
                      setFormError("");
                    }
                  }}
                />
                <FieldError>
                  {formError || "Sample error message active on invalid state."}
                </FieldError>
              </FormField>

              <FormField id="demo-city">
                <FieldLabel>Destination City</FieldLabel>
                <Select defaultValue="Lahore">
                  <option value="Lahore">Lahore</option>
                  <option value="Karachi">Karachi</option>
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Faisalabad">Faisalabad</option>
                </Select>
                <FieldHint>All cities covered with flat Rs. 300 delivery.</FieldHint>
              </FormField>
            </Card>

            <Card className="space-y-4">
              <FormField id="demo-notes">
                <FieldLabel>Order Instructions (Optional)</FieldLabel>
                <Textarea
                  placeholder="Special tailoring requests, delivery landmarks, etc."
                  rows={3}
                />
                <FieldHint>Maximum 500 characters.</FieldHint>
              </FormField>

              <div className="pt-2">
                <Text variant="label" className="mb-2 block">
                  Checkboxes
                </Text>
                <div className="space-y-1">
                  <Checkbox
                    label="Accept Cash on Delivery"
                    hint="Pay Rs. 300 delivery + garment price upon physical receipt."
                    checked={checkboxChecked}
                    onChange={(e) => setCheckboxChecked(e.target.checked)}
                  />
                  <Checkbox
                    label="Disabled Option Example"
                    hint="This field cannot be selected."
                    disabled
                  />
                </div>
              </div>

              <div className="pt-2">
                <Text variant="label" className="mb-2 block">
                  Radio Buttons
                </Text>
                <div className="space-y-1">
                  <Radio
                    name="payment-method"
                    label="Cash on Delivery (COD)"
                    hint="Pay courier upon delivery."
                    checked={selectedRadio === "option1"}
                    onChange={() => setSelectedRadio("option1")}
                  />
                  <Radio
                    name="payment-method"
                    label="Manual Bank Transfer"
                    hint="Upload transfer receipt following order placement."
                    checked={selectedRadio === "option2"}
                    onChange={() => setSelectedRadio("option2")}
                  />
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <Divider />

        {/* 5. Badges & Price Display */}
        <Section spacing="sm">
          <SectionHeader
            title="5. Badges & PKR Price Presentation"
            description="Restrained generic badge tokens and authoritative PKR money formatting."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <Text variant="label" className="mb-3 block">
                Presentation Badges
              </Text>
              <Cluster gap="xs">
                <Badge variant="new">New</Badge>
                <Badge variant="unavailable">Unavailable</Badge>
                <Badge variant="published">Published</Badge>
                <Badge variant="draft">Draft</Badge>
                <Badge variant="inactive">Inactive</Badge>
                <Badge variant="neutral">Order: Confirmed</Badge>
                <Badge variant="success">Order: Delivered</Badge>
                <Badge variant="warning">Order: Pending Bank</Badge>
                <Badge variant="danger">Order: Cancelled</Badge>
              </Cluster>
            </Card>

            <Card>
              <Text variant="label" className="mb-3 block">
                Price Component (PKR)
              </Text>
              <Stack gap="sm">
                <div>
                  <Typography variant="caption" className="block mb-1">
                    Standard Regular Price
                  </Typography>
                  <Price price="2499.00" size="lg" />
                </div>
                <div>
                  <Typography variant="caption" className="block mb-1">
                    Sale with Compare-At Price
                  </Typography>
                  <Price price="2499.00" compareAtPrice="3499.00" size="lg" />
                </div>
                <div>
                  <Typography variant="caption" className="block mb-1">
                    Small Price (Card/Listing)
                  </Typography>
                  <Price price="1200.00" compareAtPrice="1500.00" size="sm" />
                </div>
              </Stack>
            </Card>
          </div>
        </Section>

        <Divider />

        {/* 6. ProductCard Presentation Primitive */}
        <Section spacing="sm">
          <SectionHeader
            title="6. ProductCard Presentation Primitive"
            description="Pure presentation component with 4:5 aspect ratio, mobile-safe main image, desktop hover swap, and zero excluded features."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: New Arrival with Hover Image */}
            <ProductCard
              name="Embroidered Festive Kurta"
              slug="embroidered-festive-kurta"
              regularPrice="2999.00"
              compareAtPrice="3799.00"
              isNewArrival={true}
              storefrontSlug={activeStorefront}
              mainImage={{
                url: "/images/demo/festive-kurta-1.jpg",
                altText: "Embroidered Festive Kurta Front View",
              }}
              hoverImage={{
                url: "/images/demo/festive-kurta-2.jpg",
                altText: "Embroidered Festive Kurta Detail View",
              }}
            />

            {/* Card 2: Regular without Hover Image */}
            <ProductCard
              name="Organic Linen Kurta"
              slug="organic-linen-kurta"
              regularPrice="2499.00"
              compareAtPrice={null}
              isNewArrival={false}
              storefrontSlug={activeStorefront}
              mainImage={{
                url: "/images/demo/organic-linen.jpg",
                altText: "Organic Linen Kurta",
              }}
              hoverImage={null}
            />

            {/* Card 3: New Arrival without Discount */}
            <ProductCard
              name="Raw Silk Waistcoat Set"
              slug="raw-silk-waistcoat-set"
              regularPrice="4999.00"
              compareAtPrice={null}
              isNewArrival={true}
              storefrontSlug={activeStorefront}
              mainImage={{
                url: "/images/demo/waistcoat-set-1.jpg",
                altText: "Raw Silk Waistcoat Set",
              }}
              hoverImage={{
                url: "/images/demo/waistcoat-set-2.jpg",
                altText: "Raw Silk Waistcoat Set Angle",
              }}
            />

            {/* Card 4: Standard Product */}
            <ProductCard
              name="Classic Cotton Shalwar"
              slug="classic-cotton-shalwar"
              regularPrice="1499.00"
              compareAtPrice="1899.00"
              isNewArrival={false}
              storefrontSlug={activeStorefront}
              mainImage={{
                url: "/images/demo/classic-shalwar.jpg",
                altText: "Classic Cotton Shalwar",
              }}
            />
          </div>
        </Section>

        <Divider />

        {/* 7. Feedback & System States */}
        <Section spacing="sm">
          <SectionHeader
            title="7. Feedback & System-State Components"
            description="WCAG AA-oriented feedback, loading states, error boundaries, and empty collection states."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Stack gap="md">
              <Alert variant="info" title="Made to Order">
                All garments are freshly tailored upon order confirmation. Please allow 3–5 working
                days for production.
              </Alert>
              <Alert variant="success" title="Order Placed">
                Your order #1001 has been confirmed via Cash on Delivery.
              </Alert>
              <Alert variant="warning" title="Variant Limited">
                This exact Size + Color variant is currently unavailable.
              </Alert>
              <Alert variant="error" title="Payment Verification Required">
                Please attach a valid image receipt for bank transfer verification.
              </Alert>

              <div className="flex items-center gap-4 pt-2">
                <InlineError>Please select a valid size</InlineError>
                <SuccessMessage>Saved to collection</SuccessMessage>
              </div>

              <div className="pt-2 space-y-2">
                <Text variant="label">Skeletons (Reduced Motion Safe)</Text>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </Stack>

            <Stack gap="md">
              <Card>
                <NoResultsState query="Sequin Lehenga" />
              </Card>
              <Card>
                <EmptyCartState shopHref="/mini-sprouts" />
              </Card>
              <div className="pt-2">
                <OutOfStockState />
              </div>
            </Stack>
          </div>
        </Section>

        <Divider />

        {/* 8. Navigation Primitives */}
        <Section spacing="sm" id="navigation">
          <SectionHeader
            title="8. Navigation Primitives"
            description="Foundation navigation building blocks with 44px touch targets and active underline styling."
          />
          <Card className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <NavLink href="/design-system" exact>
                Active NavLink
              </NavLink>
              <NavLink href="/collections">Inactive NavLink</NavLink>
              <NavLink href="/about">About Fabric</NavLink>
            </div>
            <div className="flex items-center gap-2">
              <IconButton aria-label="Search demo" disabled>
                <Search className="h-5 w-5" />
              </IconButton>
              <Button variant="primary" size="sm">
                Shop {STOREFRONT_THEMES[activeStorefront].name}
              </Button>
            </div>
          </Card>
        </Section>
      </PageContainer>
    </StorefrontScope>
  );
}
