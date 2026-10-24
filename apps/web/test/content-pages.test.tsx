import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import AboutPage from "../src/app/about/page";
import ContactPage from "../src/app/contact/page";
import ShippingPolicyPage from "../src/app/shipping-policy/page";
import ReturnExchangePolicyPage from "../src/app/return-exchange-policy/page";
import PrivacyPolicyPage from "../src/app/privacy-policy/page";
import TermsPage from "../src/app/terms/page";
import NotFoundPage from "../src/app/not-found";
import { Footer } from "../src/components/shell/footer";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    console.error(`  ✗ ${name}`);
    console.error(`    ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Source Helper
// ---------------------------------------------------------------------------

function readPageSource(relPath: string): string {
  const fullPath = path.join(__dirname, "..", "src", "app", relPath);
  return fs.readFileSync(fullPath, "utf8");
}

function renderSharedPageContent(element: React.ReactElement): string {
  return renderToStaticMarkup((element.props as { children: React.ReactNode }).children);
}

async function runAllTests(): Promise<void> {
  console.log("\n=======================================================");
  console.log("Kids Wear — Work Unit 20: Content & Policy Pages Test Suite");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // 1. Routes (Tests 1–7)
  // ---------------------------------------------------------------------------
  console.log("--- Section 1: Route Existence & Component Export (Tests 1–7) ---");

  await runTest("1. /about page exists and exports default function", () => {
    assert.strictEqual(typeof AboutPage, "function", "AboutPage must be a function");
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/about/page.tsx")),
      "about/page.tsx must exist"
    );
  });

  await runTest("2. /contact page exists and exports default function", () => {
    assert.strictEqual(typeof ContactPage, "function", "ContactPage must be a function");
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/contact/page.tsx")),
      "contact/page.tsx must exist"
    );
  });

  await runTest("3. /shipping-policy page exists and exports default function", () => {
    assert.strictEqual(
      typeof ShippingPolicyPage,
      "function",
      "ShippingPolicyPage must be a function"
    );
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/shipping-policy/page.tsx")),
      "shipping-policy/page.tsx must exist"
    );
  });

  await runTest("4. /return-exchange-policy page exists and exports default function", () => {
    assert.strictEqual(
      typeof ReturnExchangePolicyPage,
      "function",
      "ReturnExchangePolicyPage must be a function"
    );
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/return-exchange-policy/page.tsx")),
      "return-exchange-policy/page.tsx must exist"
    );
  });

  await runTest("5. /privacy-policy page exists and exports default function", () => {
    assert.strictEqual(
      typeof PrivacyPolicyPage,
      "function",
      "PrivacyPolicyPage must be a function"
    );
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/privacy-policy/page.tsx")),
      "privacy-policy/page.tsx must exist"
    );
  });

  await runTest("6. /terms page exists and exports default function", () => {
    assert.strictEqual(typeof TermsPage, "function", "TermsPage must be a function");
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/terms/page.tsx")),
      "terms/page.tsx must exist"
    );
  });

  await runTest("7. global 404 (not-found.tsx) exists and exports default function", () => {
    assert.strictEqual(typeof NotFoundPage, "function", "NotFoundPage must be a function");
    assert(
      fs.existsSync(path.join(__dirname, "../src/app/not-found.tsx")),
      "not-found.tsx must exist"
    );
  });

  // ---------------------------------------------------------------------------
  // 2. About Page (Tests 8–10)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 2: About Page Content & Scope (Tests 8–10) ---");

  const aboutSource = readPageSource("about/page.tsx");
  const aboutElement = await AboutPage();
  const aboutHtml = renderSharedPageContent(aboutElement);

  await runTest("8. Kids Wear identity and location rendered without unconfirmed claims", () => {
    assert(aboutHtml.includes("Kids Wear"), "Must include brand name");
    assert(aboutHtml.includes("Attock, Pakistan"), "Must include confirmed business location");
    assert(
      aboutHtml.includes("Street-05, Darul Islam Colony"),
      "Must include confirmed street/colony"
    );
    assert(aboutHtml.includes("Pakistan-wide delivery"), "Must state nationwide delivery");
    assert(!aboutHtml.includes("boutique"), "Must not claim boutique studio");
    assert(!aboutHtml.includes("handcrafted"), "Must not claim handcrafted");
  });

  await runTest("9. three approved age storefronts represented correctly", () => {
    assert(aboutHtml.includes("Mini Sprouts"), "Must mention Mini Sprouts");
    assert(aboutHtml.includes("0–10 Years"), "Must mention Mini Sprouts age range");
    assert(aboutHtml.includes("Teen Studio"), "Must mention Teen Studio");
    assert(aboutHtml.includes("11–16 Years"), "Must mention Teen Studio age range");
    assert(aboutHtml.includes("Aura Studio"), "Must mention Aura Studio");
    assert(aboutHtml.includes("17+ Years"), "Must mention Aura Studio age range");
  });

  await runTest("10. no fabricated founder, history, or sustainability claims", () => {
    const forbiddenClaims = [
      "boutique",
      "handcrafted",
      "sustainable",
      "sustainability",
      "mass-factory",
      "waste",
      "made-to-order",
      "family-owned",
      "since 20",
      "locally manufactured",
      "award-winning",
      "leading kidswear brand",
      "ethical",
      "100% original",
    ];
    for (const claim of forbiddenClaims) {
      assert(
        !aboutSource.toLowerCase().includes(claim),
        `About page source must not include '${claim}'`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Contact Page (Tests 11–17)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 3: Contact Page Content & Exclusions (Tests 11–17) ---");

  const contactSource = readPageSource("contact/page.tsx");
  const contactElement = await ContactPage();
  const contactHtml = renderSharedPageContent(contactElement);

  await runTest("11. correct address rendered neutrally rather than Physical Studio", () => {
    assert(contactHtml.includes("Street-05"), "Must include Street-05");
    assert(contactHtml.includes("Darul Islam Colony"), "Must include Darul Islam Colony");
    assert(contactHtml.includes("Attock, Pakistan"), "Must include Attock, Pakistan");
    assert(
      contactHtml.includes("Business Address"),
      "Must label address neutrally as Business Address"
    );
    assert(!contactHtml.includes("Physical Studio"), "Must not use Physical Studio");
    assert(!contactHtml.includes("showroom"), "Must not claim showroom");
    assert(!contactHtml.includes("retail store"), "Must not claim retail store");
    assert(
      !contactSource.toLowerCase().includes("mailing address"),
      "Must not use Mailing Address"
    );
    assert(
      !contactSource.toLowerCase().includes("mailing & business address"),
      "Must not use Mailing & business address"
    );
    assert(!contactSource.toLowerCase().includes("studio address"), "Must not use Studio Address");
    assert(!contactSource.toLowerCase().includes("store address"), "Must not use Store Address");
  });

  await runTest("12. correct phone rendered", () => {
    assert(
      contactHtml.includes("+92 335 0981 321") || contactHtml.includes("+92 335 0981321"),
      "Must display phone"
    );
  });

  await runTest("13. correct email rendered", () => {
    assert(contactHtml.includes("info@thekidswear.com"), "Must display email");
  });

  await runTest("14. valid tel: link rendered", () => {
    assert(contactHtml.includes('href="tel:+923350981321"'), "Must include valid tel: link");
  });

  await runTest("15. valid mailto: link rendered", () => {
    assert(
      contactHtml.includes('href="mailto:info@thekidswear.com"'),
      "Must include valid mailto: link"
    );
  });

  await runTest("16. no invented WhatsApp or social links in Contact page", () => {
    assert(!contactSource.toLowerCase().includes("wa.me"), "No wa.me link");
    assert(
      !contactSource.toLowerCase().includes("whatsapp"),
      "No WhatsApp mentions in contact source"
    );
    assert(!contactSource.toLowerCase().includes("facebook.com"), "No Facebook link");
    assert(!contactSource.toLowerCase().includes("instagram.com"), "No Instagram link");
    assert(!contactSource.toLowerCase().includes("tiktok.com"), "No TikTok link");
  });

  await runTest("17. no fake Contact form", () => {
    assert(!contactHtml.includes("<form"), "Must not render a <form> tag");
    assert(!contactHtml.includes('type="submit"'), "Must not render a submit button");
  });

  // ---------------------------------------------------------------------------
  // 4. Shipping Policy (Tests 18–24)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 4: Shipping Policy Page (Tests 18–24) ---");

  const shippingSource = readPageSource("shipping-policy/page.tsx");
  const shippingElement = await ShippingPolicyPage();
  const shippingHtml = renderSharedPageContent(shippingElement);

  await runTest("18. Pakistan-wide delivery wording present", () => {
    assert(
      shippingHtml.includes("Pakistan-Wide") || shippingHtml.includes("across Pakistan"),
      "Must state nationwide delivery"
    );
  });

  await runTest("19. one flat charge per Order structure explained", () => {
    assert(
      shippingHtml.includes("flat") || shippingHtml.includes("Flat"),
      "Must describe flat charge"
    );
    assert(
      shippingHtml.includes("per order") ||
        shippingHtml.includes("per Order") ||
        shippingHtml.includes("per completed order"),
      "Must state charge is per order"
    );
  });

  await runTest("20. dynamic Commerce Settings source used", () => {
    assert(shippingSource.includes("fetchPublicSettings"), "Source must use fetchPublicSettings");
    assert(
      shippingSource.includes("flatDeliveryCharge"),
      "Source must reference flatDeliveryCharge"
    );
  });

  await runTest("21. no hardcoded PKR 300 source-of-truth in shipping policy source", () => {
    assert(!shippingSource.includes('"300.00"'), "Source must not hardcode 300.00");
    assert(!shippingSource.includes('"PKR 300"'), "Source must not hardcode PKR 300");
    assert(!shippingSource.includes('"Rs. 300"'), "Source must not hardcode Rs. 300");
  });

  await runTest(
    "22. delivery-within-10-days commitment stated without made-to-order/production interpretation",
    () => {
      assert(shippingHtml.includes("10 days"), "Must state delivery within 10 days");
      assert(
        !shippingSource.toLowerCase().includes("made-to-order"),
        "Must not interpret as made-to-order production"
      );
      assert(
        !shippingSource.toLowerCase().includes("production window"),
        "Must not interpret as production window"
      );
      assert(
        !shippingSource.toLowerCase().includes("manufacturing lead time"),
        "Must not interpret as manufacturing lead time"
      );
      assert(!shippingSource.includes("SUBMITTED"), "Shipping Policy contains no SUBMITTED status");
      assert(
        !shippingHtml.includes("SUBMITTED"),
        "Shipping Policy contains no rendered SUBMITTED status"
      );
      assert(
        !shippingSource.toLowerCase().includes("processing"),
        "Shipping Policy contains no PROCESSING alias"
      );
      assert(
        !shippingHtml.toLowerCase().includes("processing"),
        "Shipping Policy contains no rendered PROCESSING alias"
      );
    }
  );

  await runTest("23. no free-shipping threshold or promotional claims", () => {
    assert(
      !shippingSource.toLowerCase().includes("free shipping"),
      "No free shipping claims in source"
    );
    assert(
      !shippingSource.toLowerCase().includes("free delivery"),
      "No free delivery claims in source"
    );
    assert(!shippingSource.toLowerCase().includes("threshold"), "No threshold claims in source");
  });

  await runTest("24. API failure does not invent a charge and provides safe wording", () => {
    // If settings are null, the page handles it gracefully
    assert(shippingSource.includes("currentFlatRate ?"), "Source must conditionally handle rate");
    assert(
      shippingSource.includes("Order Summary"),
      "Fallback explains rate is confirmed in Order Summary"
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Return & Exchange Policy (Tests 25–28)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 5: Return & Exchange Policy (Tests 25–28) ---");

  const returnSource = readPageSource("return-exchange-policy/page.tsx");
  const returnElement = await ReturnExchangePolicyPage();
  const returnHtml = renderSharedPageContent(returnElement);

  await runTest("25. page does not invent return window", () => {
    assert(!returnSource.toLowerCase().includes("7-day"), "No 7-day return window");
    assert(!returnSource.toLowerCase().includes("14-day"), "No 14-day return window");
    assert(!returnSource.toLowerCase().includes("30-day"), "No 30-day return window");
  });

  await runTest("26. page does not invent refund rule", () => {
    assert(!returnSource.toLowerCase().includes("no refund"), "No invented 'no refund' rule");
    assert(
      !returnSource.toLowerCase().includes("exchange only"),
      "No invented 'exchange only' rule"
    );
  });

  await runTest("27. page introduces no damaged-item deadline or guaranteed remedy", () => {
    assert(!returnSource.toLowerCase().includes("24 hours"), "No 24 hours deadline");
    assert(!returnSource.toLowerCase().includes("48 hours"), "No 48 hours deadline");
    assert(!returnSource.toLowerCase().includes("immediately"), "No immediate deadline");
    assert(
      !returnSource.toLowerCase().includes("replacement guarantee"),
      "No replacement guarantee"
    );
    assert(!returnSource.toLowerCase().includes("refund entitlement"), "No refund entitlement");
    assert(!returnSource.toLowerCase().includes("exchange entitlement"), "No exchange entitlement");
    assert(!returnSource.toLowerCase().includes("photograph"), "No photograph requirement");
    assert(!returnSource.toLowerCase().includes("photo"), "No photo requirement");
    assert(!returnSource.toLowerCase().includes("video"), "No video requirement");
    assert(!returnSource.toLowerCase().includes("evidence"), "No evidence requirement");
    assert(
      returnHtml.includes(
        "If you have a concern about a damaged or incorrect item, please contact Kids Wear by phone or email with your order details."
      ),
      "Must include exact safe wording for damaged or incorrect item"
    );
  });

  await runTest("28. Pending Client policy state is presented professionally", () => {
    assert(
      returnHtml.includes("Being Finalized") || returnHtml.includes("being finalized"),
      "Must state terms are being finalized"
    );
    assert(!returnSource.includes("TODO"), "No TODO tokens");
    assert(!returnSource.includes("FIXME"), "No FIXME tokens");
    assert(!returnSource.includes("CLIENT TBD"), "No CLIENT TBD tokens");
  });

  // ---------------------------------------------------------------------------
  // 6. Privacy Policy (Tests 29–35)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 6: Privacy Policy Page (Tests 29–35) ---");

  const privacySource = readPageSource("privacy-policy/page.tsx");
  const privacyElement = await PrivacyPolicyPage();
  const privacyHtml = renderSharedPageContent(privacyElement);

  await runTest(
    "29. no absolute 'never share' claim; accurately lists infrastructure providers",
    () => {
      assert(
        !privacySource.toLowerCase().includes("we never share"),
        "Must not make absolute 'we never share' claim"
      );
      assert(privacyHtml.includes("Vercel"), "Discloses Vercel");
      assert(privacyHtml.includes("Belmo"), "Discloses Belmo");
      assert(
        privacyHtml.includes("Supabase") || privacyHtml.includes("PostgreSQL"),
        "Discloses Supabase/PostgreSQL"
      );
      assert(privacyHtml.includes("Cloudinary"), "Discloses Cloudinary");
      assert(privacyHtml.includes("Resend"), "Discloses Resend");
    }
  );

  await runTest("30. no generic card-storage claims or PCI claims", () => {
    assert(
      !privacySource.toLowerCase().includes("we never collect credit card"),
      "No generic card collection claim"
    );
    assert(
      !privacySource.toLowerCase().includes("we never store debit or credit card"),
      "No generic card storage claim"
    );
    assert(!privacySource.toLowerCase().includes("pci certified"), "No PCI claims");
    assert(privacyHtml.includes("Cash on Delivery"), "Discloses Cash on Delivery");
    assert(privacyHtml.includes("Manual Bank Transfer"), "Discloses Manual Bank Transfer");
    assert(
      privacyHtml.includes("card-payment gateway"),
      "Discloses no online card-payment gateway"
    );
  });

  await runTest("31. browser & password-manager behavior not falsely denied", () => {
    assert(privacySource.toLowerCase().includes("password manager"), "Discloses password managers");
    assert(
      !privacySource.toLowerCase().includes("passwords can never be stored by your browser"),
      "Does not deny browser capability"
    );
  });

  await runTest("32. guest Cart browser storage disclosed", () => {
    assert(privacyHtml.includes("localStorage"), "Discloses localStorage usage for cart");
  });

  await runTest(
    "33. account & session cookie behavior described accurately without storing passwords in cookies",
    () => {
      assert(privacyHtml.includes("HttpOnly"), "Discloses HttpOnly cookie security");
      assert(privacyHtml.includes("Argon2id"), "Discloses Argon2id hashing");
      assert(
        privacyHtml.includes("server-managed session records"),
        "Discloses server-managed session records"
      );
      assert(
        privacyHtml.includes("secure HttpOnly session cookies"),
        "Discloses secure HttpOnly session cookies"
      );
      assert(
        !privacySource.toLowerCase().includes("passwords are stored in an httponly cookie") &&
          !privacySource.toLowerCase().includes("stored in an httponly cookie") &&
          !privacySource.toLowerCase().includes("passwords are stored in cookies"),
        "Must not state passwords are stored in cookies"
      );
      assert(
        !privacySource.includes("SameSite=Lax"),
        "Privacy page must not hardcode SameSite=Lax"
      );
      assert(!privacySource.includes("SameSite"), "Privacy page must not hardcode SameSite values");
    }
  );

  await runTest("34. Review public-display behavior described accurately", () => {
    assert(privacyHtml.includes("moderation"), "Discloses review moderation");
    assert(privacyHtml.includes("publicly"), "Discloses approved reviews are public");
  });

  await runTest(
    "35. no invented retention duration and no order tracking claim in privacy policy",
    () => {
      assert(
        !privacySource.toLowerCase().includes("30-day deletion"),
        "No fake 30-day deletion schedule"
      );
      assert(
        !privacySource.toLowerCase().includes("7-year retention"),
        "No fake 7-year retention schedule"
      );
      assert(
        !privacySource.toLowerCase().includes("gdpr controller"),
        "No fake GDPR controller claim"
      );
      assert(
        !privacySource.toLowerCase().includes("order tracking"),
        "No unapproved order tracking claim in privacy policy"
      );
      assert(
        privacySource.includes("historical order records"),
        "Uses factual historical order records wording"
      );
    }
  );

  // ---------------------------------------------------------------------------
  // 7. Terms of Service (Tests 36–43)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 7: Terms of Service Page (Tests 36–43) ---");

  const termsSource = readPageSource("terms/page.tsx");
  const termsElement = await TermsPage();
  const termsHtml = renderSharedPageContent(termsElement);

  await runTest("36. Cash on Delivery (COD) represented", () => {
    assert(termsHtml.includes("Cash on Delivery"), "Must describe COD");
  });

  await runTest("37. Manual Bank Transfer represented", () => {
    assert(termsHtml.includes("Manual Bank Transfer"), "Must describe Manual Bank Transfer");
  });

  await runTest("38. guest Checkout represented", () => {
    assert(
      termsHtml.includes("Guest Checkout") || termsHtml.includes("guest"),
      "Must state guest checkout is supported"
    );
  });

  await runTest("39. optional Account behavior represented", () => {
    assert(termsHtml.includes("optional"), "Must state customer accounts are optional");
  });

  await runTest("40. no guest-order auto-claim promise", () => {
    assert(
      termsSource.includes("not retroactively attached"),
      "Explains past guest orders are not automatically linked"
    );
  });

  await runTest(
    "41. terms contains no 'out of stock' wording and uses Available / Unavailable language",
    () => {
      assert(!termsSource.toLowerCase().includes("out of stock"), "No 'out of stock' in terms");
      assert(!termsSource.toLowerCase().includes("low stock"), "No 'low stock' in terms");
      assert(
        !termsSource.toLowerCase().includes("stock remaining"),
        "No 'stock remaining' in terms"
      );
      assert(!termsSource.toLowerCase().includes("stock count"), "No 'stock count' in terms");
      assert(termsHtml.includes("Available"), "Must use Available language");
      assert(termsHtml.includes("Unavailable"), "Must use Unavailable language");
      assert(
        !termsSource.toLowerCase().includes("7-day return"),
        "No invented return window in terms"
      );
      assert(
        !termsSource.toLowerCase().includes("refund guarantee"),
        "No refund guarantee in terms"
      );
    }
  );

  await runTest("42. no governing-law or arbitration boilerplate added without approval", () => {
    const legalBoilerplate = [
      "exclusive jurisdiction",
      "arbitration",
      "liquidated damages",
      "indemnify and hold harmless",
      "limitation of liability shall not exceed",
    ];
    for (const term of legalBoilerplate) {
      assert(!termsSource.toLowerCase().includes(term), `Terms must not include '${term}'`);
    }
  });

  await runTest("43. Review moderation described without Verified Purchase claim", () => {
    assert(termsHtml.includes("moderation"), "Explains reviews are moderated");
    assert(
      !termsHtml.toLowerCase().includes("verified purchase"),
      "Must not claim verified purchase"
    );
  });

  // ---------------------------------------------------------------------------
  // 8. Global 404 (Tests 44–46)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 8: Global 404 Experience (Tests 44–46) ---");

  const notFoundSource = readPageSource("not-found.tsx");
  const notFoundHtml = renderToStaticMarkup(<NotFoundPage />);

  await runTest("44. safe 404 heading rendered", () => {
    assert(notFoundHtml.includes("404"), "Must display 404 badge");
    assert(notFoundHtml.includes("Page Not Found"), "Must display Page Not Found heading");
  });

  await runTest("45. Home link rendered", () => {
    assert(notFoundHtml.includes('href="/"'), "Must provide link back to Home");
  });

  await runTest(
    "46. all 3 storefront links resolve to actual route convention with no route leakage",
    () => {
      assert(notFoundHtml.includes('href="/mini-sprouts"'), "Links to /mini-sprouts");
      assert(notFoundHtml.includes('href="/teen-studio"'), "Links to /teen-studio");
      assert(notFoundHtml.includes('href="/aura-studio"'), "Links to /aura-studio");
      assert(
        !notFoundHtml.includes('href="/storefront/'),
        "Must not use non-existent /storefront/ prefix"
      );
      assert(!notFoundSource.includes("stack"), "No stack traces in 404 source");
      assert(!notFoundSource.includes("process.env"), "No environment leakage in 404 source");
    }
  );

  // ---------------------------------------------------------------------------
  // 9. Footer Navigation (Tests 47–49)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 9: Footer Navigation (Tests 47–49) ---");

  const footerHtml = renderToStaticMarkup(<Footer />);

  await runTest("47. informational and policy links resolve to real canonical routes", () => {
    assert(footerHtml.includes('href="/about"'), "Footer must link to /about");
    assert(footerHtml.includes('href="/contact"'), "Footer must link to /contact");
    assert(footerHtml.includes('href="/shipping-policy"'), "Footer must link to /shipping-policy");
    assert(
      footerHtml.includes('href="/return-exchange-policy"'),
      "Footer must link to /return-exchange-policy"
    );
    assert(footerHtml.includes('href="/privacy-policy"'), "Footer must link to /privacy-policy");
    assert(footerHtml.includes('href="/terms"'), "Footer must link to /terms");
  });

  await runTest("48. strictly zero public Admin links in footer", () => {
    assert(!footerHtml.includes('href="/admin"'), "Footer must not contain /admin link");
  });

  await runTest("49. no dead social icon or link introduced", () => {
    assert(!footerHtml.includes('href="#"'), "Footer must not have dead '#' links");
    assert(!footerHtml.includes('href=""'), "Footer must not have empty links");
  });

  // ---------------------------------------------------------------------------
  // 10. Security & Rendering (Tests 50–51)
  // ---------------------------------------------------------------------------
  console.log("\n--- Section 10: Content Security & Rendering (Tests 50–51) ---");

  const pageSources = [
    aboutSource,
    contactSource,
    shippingSource,
    returnSource,
    privacySource,
    termsSource,
    notFoundSource,
  ];

  await runTest(
    "50. zero dangerouslySetInnerHTML; checkout contains no Quality inspection guarantee or unsupported guarantee",
    () => {
      for (const src of pageSources) {
        assert(
          !src.includes("dangerouslySetInnerHTML"),
          "Must never use dangerouslySetInnerHTML in policy pages"
        );
      }
      const checkoutSummarySrc = fs.readFileSync(
        path.join(__dirname, "..", "src", "components", "checkout", "checkout-order-summary.tsx"),
        "utf8"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("quality inspection guarantee"),
        "Checkout contains no Quality inspection guarantee"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("quality guaranteed"),
        "Checkout contains no unsupported quality guarantee"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("satisfaction guaranteed"),
        "Checkout contains no unsupported satisfaction guarantee"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("100% quality"),
        "Checkout contains no 100% quality claims"
      );
      assert(
        checkoutSummarySrc.includes("Pakistan-wide delivery within 10 days"),
        "Checkout must state factual delivery without tracking promise"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("tracked delivery"),
        "Checkout contains no tracked delivery promise"
      );
      assert(
        !checkoutSummarySrc.toLowerCase().includes("track your order"),
        "Checkout contains no track your order promise"
      );
    }
  );

  await runTest("51. zero runtime HTML or Markdown parser libraries used in policy pages", () => {
    for (const src of pageSources) {
      assert(!src.includes("marked"), "Must not use marked");
      assert(!src.includes("react-markdown"), "Must not use react-markdown");
      assert(!src.includes("html-react-parser"), "Must not use html-react-parser");
    }
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`Content Pages Test Summary: ${passed} passed, ${failed} failed, total ${total}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
