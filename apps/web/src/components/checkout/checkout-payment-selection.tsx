"use client";

import React from "react";
import type { CheckoutConfigPaymentMethods } from "@/lib/api";
import { Banknote, Building2, AlertCircle } from "lucide-react";

export interface CheckoutPaymentSelectionProps {
  paymentMethods: CheckoutConfigPaymentMethods;
  selectedMethod: "CASH_ON_DELIVERY" | "BANK_TRANSFER";
  onSelectMethod: (method: "CASH_ON_DELIVERY" | "BANK_TRANSFER") => void;
  disabled?: boolean;
}

export function CheckoutPaymentSelection({
  paymentMethods,
  selectedMethod,
  onSelectMethod,
  disabled = false,
}: CheckoutPaymentSelectionProps) {
  const bankConfig = paymentMethods.bankTransfer;
  const isBankAvailable =
    Boolean(bankConfig.available) &&
    Boolean(bankConfig.bankName?.trim()) &&
    Boolean(bankConfig.accountTitle?.trim()) &&
    Boolean(bankConfig.accountOrIban?.trim()) &&
    Boolean(bankConfig.instructions?.trim());

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="font-editorial text-2xl text-ink font-normal tracking-tight pb-3 border-b border-border w-full">
        Payment Method
      </legend>
      <p className="font-sans text-xs text-text-muted -mt-2">
        Select how you would like to pay for your order.
      </p>

      <div className="space-y-3 pt-1">
        {/* Cash on Delivery */}
        <label
          htmlFor="payment-cod"
          className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMethod === "CASH_ON_DELIVERY"
              ? "border-accent-storefront bg-surface-soft shadow-subtle"
              : "border-border hover:border-text-muted/40 bg-surface"
          }`}
        >
          <div className="pt-0.5">
            <input
              type="radio"
              id="payment-cod"
              name="paymentMethod"
              value="CASH_ON_DELIVERY"
              checked={selectedMethod === "CASH_ON_DELIVERY"}
              onChange={() => onSelectMethod("CASH_ON_DELIVERY")}
              className="h-4 w-4 text-accent-storefront border-border focus:ring-accent-storefront focus:ring-offset-2"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <span className="font-sans text-sm font-semibold text-ink">Cash on Delivery</span>
            </div>
            <p className="font-sans text-xs text-text-muted leading-relaxed">
              Pay in cash to the courier representative upon delivery at your doorstep.
            </p>
          </div>
        </label>

        {/* Manual Bank Transfer */}
        <label
          htmlFor="payment-bank"
          className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all ${
            !isBankAvailable
              ? "opacity-60 border-border/60 bg-surface-soft/40 cursor-not-allowed"
              : selectedMethod === "BANK_TRANSFER"
                ? "border-accent-storefront bg-surface-soft shadow-subtle cursor-pointer"
                : "border-border hover:border-text-muted/40 bg-surface cursor-pointer"
          }`}
        >
          <div className="pt-0.5">
            <input
              type="radio"
              id="payment-bank"
              name="paymentMethod"
              value="BANK_TRANSFER"
              checked={selectedMethod === "BANK_TRANSFER"}
              disabled={!isBankAvailable}
              onChange={() => {
                if (isBankAvailable) {
                  onSelectMethod("BANK_TRANSFER");
                }
              }}
              className="h-4 w-4 text-accent-storefront border-border focus:ring-accent-storefront focus:ring-offset-2 disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
              <span className="font-sans text-sm font-semibold text-ink">Bank Transfer</span>
              {!isBankAvailable && (
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded bg-surface-soft text-text-muted border border-border">
                  Unavailable
                </span>
              )}
            </div>

            {isBankAvailable ? (
              <div className="space-y-3">
                <p className="font-sans text-xs text-text-muted leading-relaxed">
                  Transfer directly to our verified bank account and have your transaction details
                  ready.
                </p>

                {/* Bank Details Presentation (shown when Bank Transfer is selected) */}
                {selectedMethod === "BANK_TRANSFER" && (
                  <div
                    data-testid="bank-transfer-details"
                    className="p-4 rounded-lg bg-surface border border-border/80 space-y-2.5 text-xs font-sans text-ink"
                  >
                    <div className="font-semibold text-xs tracking-wider uppercase text-text-muted border-b border-border/60 pb-1.5">
                      Bank Account Details
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {bankConfig.bankName && (
                        <div>
                          <span className="text-text-muted block text-[11px]">Bank Name:</span>
                          <span className="font-semibold">{bankConfig.bankName}</span>
                        </div>
                      )}
                      {bankConfig.accountTitle && (
                        <div>
                          <span className="text-text-muted block text-[11px]">Account Title:</span>
                          <span className="font-semibold">{bankConfig.accountTitle}</span>
                        </div>
                      )}
                      {bankConfig.accountOrIban && (
                        <div className="sm:col-span-2">
                          <span className="text-text-muted block text-[11px]">Account / IBAN:</span>
                          <span className="font-mono font-semibold tracking-wide select-all">
                            {bankConfig.accountOrIban}
                          </span>
                        </div>
                      )}
                      {bankConfig.branchCode && (
                        <div>
                          <span className="text-text-muted block text-[11px]">Branch Code:</span>
                          <span>{bankConfig.branchCode}</span>
                        </div>
                      )}
                      {bankConfig.branchLocation && (
                        <div>
                          <span className="text-text-muted block text-[11px]">
                            Branch Location:
                          </span>
                          <span>{bankConfig.branchLocation}</span>
                        </div>
                      )}
                    </div>

                    {bankConfig.instructions && (
                      <div className="pt-2 border-t border-border/60 text-text-muted text-[11px] leading-relaxed">
                        <span className="font-medium text-ink">Instructions: </span>
                        {bankConfig.instructions}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="font-sans text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Manual Bank Transfer is currently undergoing configuration and is unavailable.
                  Please select Cash on Delivery.
                </span>
              </p>
            )}
          </div>
        </label>
      </div>
    </fieldset>
  );
}
