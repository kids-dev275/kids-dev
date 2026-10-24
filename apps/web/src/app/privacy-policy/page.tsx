import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — Kids Wear Data & Privacy Practices",
  description:
    "Factual overview of data collection, storage, and privacy practices across Kids Wear services and storefronts.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default async function PrivacyPolicyPage() {
  const settings = await fetchPublicSettings();

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <PolicyContainer
        badge="Data & Privacy"
        title="Privacy Policy"
        description="This policy outlines how Kids Wear collects, uses, and safeguards information when you visit our website, place an order, or create an account."
        lastUpdated="Effective for Kids Wear V1 Platform"
      >
        <section className="space-y-4">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            1. Information We Collect
          </h2>
          <p>
            Kids Wear collects only the information necessary to provide our apparel e-commerce
            services, process orders, and maintain platform security:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Checkout & Order Information:</strong> When you place an order, we collect
              your full name, telephone number, optional email address, delivery address (including
              street, colony/area, city, province, and optional postal code), and optional delivery
              notes.
            </li>
            <li>
              <strong>Customer Account Information:</strong> If you choose to register an optional
              customer account, we collect your full name, email address, optional telephone number,
              and a securely salted and hashed representation of your password.
            </li>
            <li>
              <strong>Customer Reviews:</strong> When submitting an anonymous product review, we
              collect your reviewer name, star rating (1–5), review text, and any optional garment
              photographs you choose to upload (maximum 3 images).
            </li>
            <li>
              <strong>Technical & Browser Storage:</strong> To operate our service, we utilize
              first-party session cookies and browser storage (such as localStorage for maintaining
              your guest shopping cart across browser reloads).
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            2. How We Use Your Information
          </h2>
          <p>We use collected data strictly for factual operational purposes:</p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>To process, fulfill, package, and deliver your apparel orders.</li>
            <li>
              To provide customer account authentication and display authenticated order history.
            </li>
            <li>To maintain your shopping cart selections as you navigate between storefronts.</li>
            <li>To respond to your support, sizing, or order inquiries.</li>
            <li>
              To moderate and display approved customer reviews publicly on product and review
              pages.
            </li>
            <li>
              To protect our platform against automated abuse, fraudulent orders, and security
              threats.
            </li>
            <li>
              To transmit operational new-order notification alerts to Kids Wear administration.
            </li>
          </ul>
          <p className="text-xs text-text-muted">
            Kids Wear does not engage in behavioral ad targeting, third-party user profiling, or
            unsolicited commercial email marketing.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            3. Service Providers & Technical Infrastructure
          </h2>
          <p>
            To deliver a secure and reliable platform, Kids Wear relies on specialized
            infrastructure service providers who process data strictly as necessary to execute
            platform functions:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Vercel:</strong> Cloud hosting provider for our frontend Next.js web
              application.
            </li>
            <li>
              <strong>Belmo:</strong> Cloud hosting infrastructure for our Fastify REST API backend.
            </li>
            <li>
              <strong>Supabase / PostgreSQL:</strong> Secure relational database infrastructure
              where application records and order snapshots are stored.
            </li>
            <li>
              <strong>Cloudinary:</strong> Content delivery network (CDN) and media storage provider
              used for product photography and approved customer review images.
            </li>
            <li>
              <strong>Resend:</strong> Operational email dispatch service used for internal order
              notification dispatches to Kids Wear administration.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            4. Passwords, Sessions & Browser Storage
          </h2>
          <p>We implement strict security practices to safeguard customer credentials:</p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Password Protection:</strong> Customer passwords are processed server-side and
              stored as Argon2id password hashes. Passwords are never stored in plain text.
            </li>
            <li>
              <strong>Server-Managed Sessions:</strong> Authenticated sessions use server-managed
              session records and secure HttpOnly session cookies. These session cookies cannot be
              read or modified by client-side JavaScript.
            </li>
            <li>
              <strong>Browser Autofill & Password Managers:</strong> Your web browser or third-party
              password manager may independently prompt you to save your credentials. Such features
              operate locally on your device outside the control of Kids Wear.
            </li>
            <li>
              <strong>Guest Cart Storage:</strong> For guest shoppers, cart contents are stored
              locally in your browser&apos;s localStorage so your items remain available across page
              reloads.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            5. Payment Methods
          </h2>
          <p>
            V1 payment methods are Cash on Delivery and Manual Bank Transfer. There is no online
            card-payment gateway.
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Cash on Delivery (COD):</strong> Handled in physical cash directly between you
              and the courier rider upon package arrival.
            </li>
            <li>
              <strong>Manual Bank Transfer:</strong> Handled through your own independent banking
              app or online portal to the Kids Wear bank account displayed at checkout.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            6. Public Reviews & Submissions
          </h2>
          <p>
            Customer reviews submitted on Kids Wear undergo internal moderation before public
            display. Once approved by our team, your reviewer name, star rating, review text, and
            approved garment photographs become publicly visible to other shoppers. Reviews are
            anonymous public submissions and are not linked to customer accounts or verified
            purchase records.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            7. Data Retention & Privacy Inquiries
          </h2>
          <p>
            Order and account information is retained in our secure database for ongoing customer
            support, historical order records, and accounting records. If you have questions
            regarding your data, wish to update your account details, or have general privacy
            questions, please contact us at:
          </p>
          <address className="not-italic p-4 rounded-lg bg-surface-soft border border-border text-sm leading-relaxed">
            <span className="font-semibold text-ink block">Kids Wear Privacy Inquiries</span>
            Email:{" "}
            <a
              href="mailto:info@thekidswear.com"
              className="text-accent-storefront underline hover:text-ink"
            >
              info@thekidswear.com
            </a>
            <br />
            Telephone:{" "}
            <a href="tel:+923350981321" className="text-accent-storefront underline hover:text-ink">
              +92 335 0981 321
            </a>
            <br />
            Business Address: Street-05, Darul Islam Colony, Attock, Pakistan
          </address>
        </section>
      </PolicyContainer>
    </SharedStorefrontShell>
  );
}
