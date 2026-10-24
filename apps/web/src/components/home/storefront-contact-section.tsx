import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { StorefrontIdentityIcon } from "@/components/theme/storefront-identity-icon";
import type { StorefrontSlug } from "@/components/theme/storefront-tokens";

const inputClassName =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--contact-border)] bg-white/90 px-3 py-2 text-sm text-[#463b39] outline-none transition-colors hover:border-[var(--contact-accent)] focus-visible:border-[var(--contact-accent)] focus-visible:ring-2 focus-visible:ring-[var(--contact-accent)]/25";

const contactThemes: Record<
  StorefrontSlug,
  {
    accent: string;
    background: string;
    border: string;
    soft: string;
    image: string;
    position: string;
  }
> = {
  "mini-sprouts": {
    accent: "#C7656C",
    background: "#FFF8F4",
    border: "#EFD8D4",
    soft: "#FBE4DD",
    image: "/images/contact/mini-sprouts-contact.webp",
    position: "right center",
  },
  "teen-studio": {
    accent: "#875985",
    background: "#FBF7FC",
    border: "#E9DDE9",
    soft: "#F0E5F1",
    image: "/images/contact/teen-studio-contact.webp",
    position: "right center",
  },
  "aura-studio": {
    accent: "#8B6B50",
    background: "#FAF7F1",
    border: "#E8DDD0",
    soft: "#EEE3D5",
    image: "/images/contact/aura-studio-contact.webp",
    position: "right center",
  },
};

const contactItems = [
  { label: "Phone", value: "+92 335 0981321", href: "tel:+923350981321", icon: Phone },
  {
    label: "Email",
    value: "info@thekidswear.com",
    href: "mailto:info@thekidswear.com",
    icon: Mail,
  },
  {
    label: "Business Address",
    value: "Street-05, Darul Islam Colony, Attock, Pakistan",
    icon: MapPin,
  },
] as const;

export function StorefrontContactSection({ storefront }: { storefront: StorefrontSlug }) {
  const theme = contactThemes[storefront];
  const style = {
    "--contact-accent": theme.accent,
    "--contact-bg": theme.background,
    "--contact-border": theme.border,
    "--contact-soft": theme.soft,
  } as CSSProperties;

  return (
    <section
      id="contact"
      aria-labelledby={`${storefront}-contact-heading`}
      className="border-t border-border py-8 sm:py-10"
      style={style}
    >
      <div className="relative isolate overflow-hidden rounded-[28px] border border-[var(--contact-border)] bg-[var(--contact-bg)] shadow-[0_22px_65px_-42px_rgba(85,62,65,0.3)] sm:rounded-[36px]">
        <div className="absolute inset-y-0 right-0 hidden w-[35%] lg:block">
          <Image
            src={theme.image}
            alt={`${storefront.replaceAll("-", " ")} editorial model`}
            fill
            sizes="(min-width: 1024px) 960px, (min-width: 480px) 100vw, 480px"
            quality={90}
            className="object-cover"
            style={{ objectPosition: theme.position }}
          />
        </div>
        <div
          className="absolute inset-y-0 right-[26%] hidden w-[18%] lg:block"
          style={{
            background: `linear-gradient(to right, ${theme.background}, ${theme.background}dd 35%, transparent)`,
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--contact-soft)]/55 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 grid gap-8 px-6 py-8 sm:px-10 sm:py-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(160px,0.8fr)] lg:gap-7 lg:py-6 xl:px-12">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--contact-accent)]">
              <StorefrontIdentityIcon
                storefront={storefront}
                className="h-4 w-4 text-[var(--contact-accent)]"
              />
              Get in Touch
            </p>
            <h2
              id={`${storefront}-contact-heading`}
              className="max-w-[280px] font-editorial text-3xl leading-tight text-[#503d39] sm:text-4xl"
            >
              We’re Here to Help
            </h2>
            <p className="mt-3 max-w-[310px] text-sm leading-6 text-[#705d59]">
              Have a question about sizing, an order, or anything else? Our team is here to help.
            </p>

            <div className="mt-6 space-y-4">
              {contactItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--contact-border)] bg-white/65 text-[var(--contact-accent)]">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--contact-accent)]">
                      {item.label}
                    </p>
                    {"href" in item ? (
                      <a
                        href={item.href}
                        className="break-words text-sm leading-5 text-[#503d39] underline-offset-4 hover:text-[var(--contact-accent)] hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--contact-accent)]"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <address className="text-sm not-italic leading-5 text-[#503d39]">
                        {item.value}
                      </address>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="rounded-[24px] border border-white/80 bg-white/75 p-5 shadow-[0_16px_38px_-28px_rgba(85,62,65,0.3)] backdrop-blur-sm sm:p-6 lg:p-4">
            <h3 className="font-editorial text-2xl text-[#503d39]">Send us a Message</h3>
            {storefront === "mini-sprouts" && (
              <p className="mt-1 text-xs leading-4 text-[#705d59]">
                Fill out the form and we’ll get back to you.
              </p>
            )}
            <div
              className={`${storefront === "mini-sprouts" ? "mt-2" : "mt-4"} grid gap-x-3 gap-y-1.5 sm:grid-cols-2`}
            >
              <label className="block text-xs font-semibold text-[#684c49]">
                Full Name{" "}
                <span aria-hidden="true" className="text-[var(--contact-accent)]">
                  *
                </span>
                <input
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  className={inputClassName}
                />
              </label>
              <label className="block text-xs font-semibold text-[#684c49]">
                Email
                <input name="email" type="email" autoComplete="email" className={inputClassName} />
              </label>
              <label className="block text-xs font-semibold text-[#684c49]">
                Phone Number
                <input name="phone" type="tel" autoComplete="tel" className={inputClassName} />
              </label>
              <label className="block text-xs font-semibold text-[#684c49]">
                Subject
                <input name="subject" type="text" className={inputClassName} />
              </label>
              <label className="block text-xs font-semibold text-[#684c49] sm:col-span-2">
                Order Number (Optional)
                <input
                  name="orderNumber"
                  type="text"
                  autoComplete="off"
                  className={inputClassName}
                />
              </label>
              <label className="block text-xs font-semibold text-[#684c49] sm:col-span-2">
                Message{" "}
                <span aria-hidden="true" className="text-[var(--contact-accent)]">
                  *
                </span>
                <textarea
                  name="message"
                  rows={2}
                  required
                  className={`${inputClassName} resize-y`}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--contact-accent)] px-6 py-2.5 text-sm font-semibold text-white enabled:hover:brightness-95 enabled:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contact-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75"
            >
              Send Message <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="mt-2 text-xs leading-4 text-[#746660]">
              Online submission unavailable. Please call or email us.
            </p>
          </form>
          <div className="hidden lg:block" aria-hidden="true" />
        </div>

        <div className="relative h-64 sm:h-80 lg:hidden">
          <Image
            src={theme.image}
            alt={`${storefront.replaceAll("-", " ")} editorial model`}
            fill
            loading="eager"
            sizes="(min-width: 480px) 100vw, 480px"
            quality={90}
            className="object-cover"
            style={{ objectPosition: theme.position }}
          />
          <div
            className="absolute inset-x-0 top-0 h-20"
            style={{ background: `linear-gradient(to bottom, ${theme.background}, transparent)` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}
