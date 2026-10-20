import type { Metadata } from "next";
import { Prata, Montserrat } from "next/font/google";
import "./globals.css";
import { CustomerAuthProvider } from "@/lib/customer-auth-context";

const prata = Prata({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-prata",
  display: "swap",
});

const montserrat = Montserrat({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const isProd = process.env.NODE_ENV === "production";
const siteUrl =
  rawUrl && rawUrl !== "undefined"
    ? rawUrl.replace(/\/$/, "")
    : !isProd
      ? "http://localhost:3000"
      : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Kids Wear",
    template: "%s | Kids Wear",
  },
  description:
    "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.",
  openGraph: {
    title: "Kids Wear",
    description:
      "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.",
    siteName: "Kids Wear",
    type: "website",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kids Wear",
    description:
      "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${prata.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-brand-canvas text-brand-ink antialiased">
        <CustomerAuthProvider>{children}</CustomerAuthProvider>
      </body>
    </html>
  );
}
