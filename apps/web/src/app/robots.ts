import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isStaging =
    process.env.APP_ENV === "staging" ||
    process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
    process.env.VERCEL_ENV === "preview";

  if (isStaging) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = rawUrl && rawUrl !== "undefined" ? rawUrl.replace(/\/$/, "") : undefined;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/cart",
          "/checkout",
          "/order-success",
          "/design-system",
        ],
      },
    ],
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
