import type { MetadataRoute } from "next";
import { STOREFRONT_SLUGS } from "@/components/theme/storefront-tokens";
import { fetchStorefrontProducts } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";
  const siteUrl =
    rawUrl && rawUrl !== "undefined"
      ? rawUrl.replace(/\/$/, "")
      : !isProd
        ? "http://localhost:3000"
        : undefined;

  // In production without an authoritative site URL, never silently emit localhost canonicals
  if (!siteUrl) {
    return [];
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    // Gateway Page
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    // Informational & Policy Pages
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/shipping-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/return-exchange-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/reviews`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Storefront Category & Index Pages
  for (const slug of STOREFRONT_SLUGS) {
    staticRoutes.push(
      {
        url: `${siteUrl}/${slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${siteUrl}/${slug}/shop`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      },
      {
        url: `${siteUrl}/${slug}/new-arrivals`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      }
    );
  }

  // Published Product Detail Pages
  const productRoutes: MetadataRoute.Sitemap = [];
  const visitedSlugs = new Set<string>();

  for (const storefrontSlug of STOREFRONT_SLUGS) {
    try {
      const response = await fetchStorefrontProducts(storefrontSlug, { limit: 100 });
      if (response?.items) {
        for (const item of response.items) {
          const key = `${storefrontSlug}/${item.slug}`;
          if (!visitedSlugs.has(key)) {
            visitedSlugs.add(key);
            productRoutes.push({
              url: `${siteUrl}/${storefrontSlug}/products/${item.slug}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }
      }
    } catch {
      // In offline / build environments where backend is unreachable, gracefully proceed
    }
  }

  return [...staticRoutes, ...productRoutes];
}
