"use client";

import React from "react";
import type { CheckoutValidationResponseData, CheckoutBankTransferConfig } from "@/lib/api";
import { formatPKR } from "@/components/commerce/price";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import {
  CheckCircle2,
  Edit3,
  MapPin,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export interface CheckoutReviewViewProps {
  reviewedData: CheckoutValidationResponseData;
  bankConfig?: CheckoutBankTransferConfig;
  onEditDetails: () => void;
  onPlaceOrder?: () => void;
  isSubmittingOrder?: boolean;
  orderError?: string | null;
}

export function CheckoutReviewView({
  reviewedData,
  bankConfig,
  onEditDetails,
  onPlaceOrder,
  isSubmittingOrder = false,
  orderError = null,
}: CheckoutReviewViewProps) {
  const { customer, paymentMethod, items, subtotal, deliveryCharge, total } = reviewedData;

  return (
    <div className="space-y-8" data-testid="checkout-reviewed-state">
      {/* Review Confirmation Banner */}
      <div className="p-4 sm:p-5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-sans text-sm font-semibold text-ink">Order Details Verified</h3>
            <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
              Your items, shipping details, and pricing have been authoritatively validated with the
              server. Review the summary below.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditDetails}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-ink font-sans text-xs font-medium hover:bg-surface-soft active:scale-[0.99] transition-all shrink-0 cursor-pointer"
        >
          <Edit3 className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <span>Edit Details</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Verified Customer & Payment Information */}
        <div className="lg:col-span-7 space-y-6">
          {/* Shipping Information Card */}
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <MapPin className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <h4 className="font-editorial text-lg text-ink font-normal tracking-tight">
                Delivery Address
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans text-ink">
              <div>
                <span className="text-text-muted block text-[11px]">Recipient Name:</span>
                <span className="font-semibold text-sm">{customer.fullName}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Contact Phone:</span>
                <span className="font-semibold">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="sm:col-span-2">
                  <span className="text-text-muted block text-[11px]">Email Address:</span>
                  <span>{customer.email}</span>
                </div>
              )}
              <div className="sm:col-span-2">
                <span className="text-text-muted block text-[11px]">Street Address:</span>
                <span className="leading-relaxed">{customer.address}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">City:</span>
                <span className="font-medium">{customer.city}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Province:</span>
                <span className="font-medium">{customer.province}</span>
              </div>
              {customer.postalCode && (
                <div>
                  <span className="text-text-muted block text-[11px]">Postal Code:</span>
                  <span>{customer.postalCode}</span>
                </div>
              )}
            </div>

            {customer.orderNotes && (
              <div className="pt-3 border-t border-border/60 text-xs font-sans text-text-muted">
                <span className="font-medium text-ink block text-[11px] mb-0.5">Order Notes:</span>
                <span className="italic leading-relaxed">{customer.orderNotes}</span>
              </div>
            )}
          </div>

          {/* Payment Method Card */}
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <CreditCard className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <h4 className="font-editorial text-lg text-ink font-normal tracking-tight">
                Selected Payment Method
              </h4>
            </div>

            <div className="text-xs font-sans space-y-2">
              <div className="font-semibold text-sm text-ink">
                {paymentMethod === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "Manual Bank Transfer"}
              </div>

              {paymentMethod === "CASH_ON_DELIVERY" ? (
                <p className="text-text-muted leading-relaxed">
                  Payment of {formatPKR(total, true)} will be collected in cash by courier at your
                  doorstep upon delivery.
                </p>
              ) : (
                <div className="p-3.5 rounded-lg bg-surface-soft border border-border/80 space-y-2 text-xs">
                  <p className="text-text-muted leading-relaxed">
                    Please transfer the verified total of {formatPKR(total, true)} to our official
                    bank account:
                  </p>
                  {bankConfig && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs pt-1">
                      {bankConfig.bankName && (
                        <div>
                          <span className="text-text-muted text-[11px]">Bank: </span>
                          <span className="font-semibold">{bankConfig.bankName}</span>
                        </div>
                      )}
                      {bankConfig.accountTitle && (
                        <div>
                          <span className="text-text-muted text-[11px]">Title: </span>
                          <span className="font-semibold">{bankConfig.accountTitle}</span>
                        </div>
                      )}
                      {bankConfig.accountOrIban && (
                        <div className="sm:col-span-2">
                          <span className="text-text-muted text-[11px]">Account / IBAN: </span>
                          <span className="font-mono font-semibold select-all">
                            {bankConfig.accountOrIban}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order Placement Notice */}
          <div className="p-4 rounded-xl border border-dashed border-border bg-surface-soft text-xs font-sans text-text-muted space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <FileText className="h-4 w-4 text-text-muted" aria-hidden="true" />
              <span>Verified Order Summary</span>
            </div>
            <p className="leading-relaxed">
              All line items, product availability, shipping charges, and payment requirements are
              authoritatively verified with the server. Press Place Order to complete your purchase.
            </p>
          </div>
        </div>

        {/* Right Column: Authoritative Order Summary & Place Order Action */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <CheckoutOrderSummary
            items={items}
            subtotal={subtotal}
            deliveryCharge={deliveryCharge}
            total={total}
            isReviewing={true}
          />

          {orderError && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-xs font-sans text-danger flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <span className="font-semibold block">Order Error:</span>
                <span>{orderError}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={onPlaceOrder}
              disabled={isSubmittingOrder}
              aria-busy={isSubmittingOrder}
              data-testid="place-order-button"
              className="w-full min-h-[50px] px-6 py-3.5 rounded-xl font-sans text-sm font-semibold tracking-wide bg-ink text-white hover:bg-ink/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 shadow-subtle cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{isSubmittingOrder ? "Placing Order..." : "Place Order"}</span>
              {!isSubmittingOrder && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>

            <p className="text-[11px] font-sans text-center text-text-muted">
              {paymentMethod === "CASH_ON_DELIVERY"
                ? "Payment will be collected in cash upon courier delivery."
                : "Payment details will be provided upon order confirmation."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
