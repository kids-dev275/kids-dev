export type StorefrontSlug = "mini-sprouts" | "teen-studio" | "aura-studio";

export interface StorefrontThemeMeta {
  slug: StorefrontSlug;
  name: string;
  ageRange: string;
  primaryAccent: string;
}

export const STOREFRONT_THEMES: Record<StorefrontSlug, StorefrontThemeMeta> = {
  "mini-sprouts": {
    slug: "mini-sprouts",
    name: "Mini Sprouts",
    ageRange: "0–10 Years",
    primaryAccent: "#C7656C",
  },
  "teen-studio": {
    slug: "teen-studio",
    name: "Teen Studio",
    ageRange: "11–16 Years",
    primaryAccent: "#875985",
  },
  "aura-studio": {
    slug: "aura-studio",
    name: "Aura Studio",
    ageRange: "17+ Years",
    primaryAccent: "#8B6B50",
  },
};

export const STOREFRONT_SLUGS: readonly StorefrontSlug[] = [
  "mini-sprouts",
  "teen-studio",
  "aura-studio",
];

export function isValidStorefrontSlug(slug: string): slug is StorefrontSlug {
  return slug === "mini-sprouts" || slug === "teen-studio" || slug === "aura-studio";
}
