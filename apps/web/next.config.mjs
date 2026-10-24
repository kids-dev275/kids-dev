/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

export function buildCsp(forProd = isProd) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  let apiOrigin = "";
  if (apiUrl) {
    try {
      apiOrigin = new URL(apiUrl).origin;
    } catch {
      apiOrigin = apiUrl;
    }
  }

  if (forProd) {
    const connectSrc = ["'self'", apiOrigin, "https://api.cloudinary.com"]
      .filter(Boolean)
      .join(" ");

    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "media-src 'self' blob: https://res.cloudinary.com",
      `connect-src ${connectSrc}`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
  }

  const devConnectSrc = [
    "'self'",
    "http://localhost:*",
    "ws://localhost:*",
    "http://127.0.0.1:*",
    "ws://127.0.0.1:*",
    "https://api.cloudinary.com",
    apiOrigin,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    `connect-src ${devConnectSrc}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kids-wear/shared"],
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/policies/shipping",
        destination: "/shipping-policy",
        permanent: true,
      },
      {
        source: "/policies/returns",
        destination: "/return-exchange-policy",
        permanent: true,
      },
      {
        source: "/policies/privacy",
        destination: "/privacy-policy",
        permanent: true,
      },
      {
        source: "/policies/terms",
        destination: "/terms",
        permanent: true,
      },
    ];
  },
  async headers() {
    const isStaging =
      process.env.APP_ENV === "staging" ||
      process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
      process.env.VERCEL_ENV === "preview";

    const baseHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
      {
        key: "Content-Security-Policy",
        value: buildCsp(),
      },
    ];

    if (isStaging) {
      baseHeaders.push({
        key: "X-Robots-Tag",
        value: "noindex, nofollow",
      });
    }

    return [
      {
        source: "/:path*",
        headers: baseHeaders,
      },
    ];
  },
};

export default nextConfig;
