"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Building2,
  Truck,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { fetchCheckoutConfig, CheckoutBankTransferConfig } from "@/lib/api";

export interface OrderSuccessClientViewProps {
  orderNumber?: string | null;
  paymentMethod?: string | null;
}

export function OrderSuccessClientView({
  orderNumber: propOrderNumber,
  paymentMethod: propPaymentMethod,
}: OrderSuccessClientViewProps = {}) {
  let searchParams: { get: (k: string) => string | null } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    searchParams = null;
  }

  const rawOrderNumber = propOrderNumber ?? searchParams?.get("orderNumber") ?? null;
  const paymentMethod = propPaymentMethod ?? searchParams?.get("paymentMethod") ?? null;

  // Validate strict KW-<digits> display shape
  const isValidOrderNumber = Boolean(rawOrderNumber && /^KW-\d+$/.test(rawOrderNumber.trim()));
  const orderNumber = isValidOrderNumber ? rawOrderNumber!.trim() : null;

  // Bank transfer configuration for payment guidance
  const [bankConfig, setBankConfig] = useState<CheckoutBankTransferConfig | null>(null);
  const [isLoadingBankConfig, setIsLoadingBankConfig] = useState<boolean>(
    paymentMethod === "BANK_TRANSFER"
  );

  useEffect(() => {
    if (paymentMethod !== "BANK_TRANSFER") {
      return;
    }
    let isCancelled = false;
    fetchCheckoutConfig().then((config) => {
      if (!isCancelled && config?.paymentMethods?.bankTransfer) {
        setBankConfig(config.paymentMethods.bankTransfer);
      }
      if (!isCancelled) {
        setIsLoadingBankConfig(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [paymentMethod]);

  // Fallback for invalid or missing order number
  // Does not perform a database lookup and reveals no order existence data
  if (!isValidOrderNumber || !orderNumber) {
    return (
      <div
        className="py-16 sm:py-24 max-w-xl mx-auto px-4 sm:px-6 text-center space-y-6"
        data-testid="invalid-order-reference"
      >
        <div className="h-14 w-14 rounded-full bg-surface-soft border border-border flex items-center justify-center mx-auto text-text-muted">
          <HelpCircle className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-normal tracking-tight">
            Order Reference Not Found
          </h1>
          <p className="font-sans text-xs sm:text-sm text-text-muted leading-relaxed">
            No valid order reference was provided. If you recently placed an order, please review
            your saved confirmation or contact our support team.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-ink text-white font-sans text-xs font-semibold hover:bg-ink/90 active:scale-[0.99] transition-all cursor-pointer shadow-subtle"
          >
            <span>Return to Home</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-12 sm:py-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8"
      data-testid="order-success-view"
    >
      {/* Success Hero Card */}
      <div className="p-8 sm:p-10 rounded-3xl border border-border bg-surface shadow-subtle text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-widest font-sans font-semibold text-emerald-700 dark:text-emerald-400">
            Order Placed Successfully
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
            Thank You for Your Order
          </h1>
          <p className="font-sans text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
            Your order has been recorded in our system. Please make note of your official order
            reference number below for any future inquiries.
          </p>
        </div>

        {/* Order Number Badge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-soft border border-border max-w-sm mx-auto space-y-1">
          <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-text-muted block">
            Order Reference Number
          </span>
          <span
            data-testid="order-number-display"
            className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-ink block select-all"
          >
            {orderNumber}
          </span>
        </div>
      </div>

      {/* Payment-Specific Guidance */}
      {paymentMethod === "BANK_TRANSFER" ? (
        <div className="p-6 sm:p-8 rounded-2xl border border-accent-storefront/30 bg-accent-storefront/5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/80">
            <Building2 className="h-5 w-5 text-accent-storefront shrink-0" aria-hidden="true" />
            <h3 className="font-editorial text-xl text-ink font-normal">
              Bank Transfer Instructions
            </h3>
          </div>

          <p className="text-xs sm:text-sm font-sans text-text-muted leading-relaxed">
            Please transfer your verified order total to our official bank account below. Include
            your order reference (
            <span className="font-mono font-semibold text-ink">{orderNumber}</span>) as the payment
            description or remarks.
          </p>

          {isLoadingBankConfig ? (
            <div className="py-4 text-center text-xs font-sans text-text-muted">
              Loading bank account details...
            </div>
          ) : bankConfig && bankConfig.available ? (
            <div className="p-4 rounded-xl bg-surface border border-border space-y-3 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bankConfig.bankName && (
                  <div>
                    <span className="text-text-muted block text-[11px]">Bank:</span>
                    <span className="font-semibold text-ink">{bankConfig.bankName}</span>
                  </div>
                )}
                {bankConfig.accountTitle && (
                  <div>
                    <span className="text-text-muted block text-[11px]">Account Title:</span>
                    <span className="font-semibold text-ink">{bankConfig.accountTitle}</span>
                  </div>
                )}
                {bankConfig.accountOrIban && (
                  <div className="sm:col-span-2">
                    <span className="text-text-muted block text-[11px]">
                      Account Number / IBAN:
                    </span>
                    <span className="font-mono font-bold text-sm text-ink select-all">
                      {bankConfig.accountOrIban}
                    </span>
                  </div>
                )}
                {bankConfig.branchCode && (
                  <div>
                    <span className="text-text-muted block text-[11px]">Branch Code:</span>
                    <span className="font-mono text-ink">{bankConfig.branchCode}</span>
                  </div>
                )}
                {bankConfig.branchLocation && (
                  <div>
                    <span className="text-text-muted block text-[11px]">Branch Location:</span>
                    <span className="text-ink">{bankConfig.branchLocation}</span>
                  </div>
                )}
              </div>

              {bankConfig.instructions && (
                <div className="pt-2 border-t border-border/60 text-text-muted leading-relaxed">
                  <span className="font-medium text-ink block text-[11px] mb-0.5">
                    Instructions:
                  </span>
                  <span>{bankConfig.instructions}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs font-sans text-text-muted">
              Bank details will be coordinated directly by our customer concierge team.
            </p>
          )}
        </div>
      ) : (
        <div className="p-6 sm:p-8 rounded-2xl border border-border bg-surface space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Truck className="h-5 w-5 text-accent-storefront shrink-0" aria-hidden="true" />
            <h3 className="font-editorial text-xl text-ink font-normal">Cash on Delivery</h3>
          </div>
          <p className="text-xs sm:text-sm font-sans text-text-muted leading-relaxed">
            Payment will be collected in cash by the courier upon delivery at your doorstep. Please
            have the exact verified order total ready when the delivery arrives.
          </p>
        </div>
      )}

      {/* What Happens Next Guidance */}
      <div className="p-6 sm:p-8 rounded-2xl border border-border bg-surface space-y-4">
        <h3 className="font-editorial text-xl text-ink font-normal pb-2 border-b border-border">
          What to Expect Next
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
          <div className="space-y-1.5 p-3 rounded-xl bg-surface-soft">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Clock className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <span>1. Order Review</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Our fulfillment team reviews and verifies all garment details and sizing.
            </p>
          </div>

          <div className="space-y-1.5 p-3 rounded-xl bg-surface-soft">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <span>2. Careful Packing</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Each ordered piece is carefully prepared, quality inspected, and packaged.
            </p>
          </div>

          <div className="space-y-1.5 p-3 rounded-xl bg-surface-soft">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Truck className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <span>3. Courier Delivery</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Standard delivery across Pakistan takes 3 to 5 business days.
            </p>
          </div>
        </div>
      </div>

      {/* Return Action */}
      <div className="text-center pt-2">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-ink text-white font-sans text-xs font-semibold hover:bg-ink/90 active:scale-[0.99] transition-all cursor-pointer shadow-subtle"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
