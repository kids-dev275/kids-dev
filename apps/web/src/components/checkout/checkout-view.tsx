"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import {
  validateCart,
  fetchCheckoutConfig,
  validateCheckout,
  createOrder,
  ApiCartValidationResult,
  CheckoutConfigData,
  CheckoutValidationResponseData,
} from "@/lib/api";
import { LoadingState, ErrorState, EmptyCartState } from "@/components/commerce/system-states";
import { CheckoutCustomerForm } from "./checkout-customer-form";
import { CheckoutPaymentSelection } from "./checkout-payment-selection";
import { CheckoutPrimaryAction } from "./checkout-primary-action";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import { CheckoutReviewView } from "./checkout-review-view";
import {
  checkoutFormSchema,
  normalizeCheckoutFormData,
  type CheckoutFormData,
} from "@/lib/checkout-validation";

export function CheckoutView() {
  const router = useRouter();
  const { items, isHydrated, totalUnits, clearCart } = useCart();

  // Cart Validation State
  const [cartValidation, setCartValidation] = useState<ApiCartValidationResult | null>(null);
  const [isValidatingCart, setIsValidatingCart] = useState<boolean>(true);
  const [cartValidationError, setCartValidationError] = useState<boolean>(false);

  // Checkout Config State
  const [config, setConfig] = useState<CheckoutConfigData | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);

  // Selected Payment Method (in-memory state)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "CASH_ON_DELIVERY" | "BANK_TRANSFER"
  >("CASH_ON_DELIVERY");

  // Reviewed State (authoritative post-preflight)
  const [reviewedData, setReviewedData] = useState<CheckoutValidationResponseData | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Idempotency Key State (UUID generated per order attempt, reused on submission retry)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "00000000-0000-0000-0000-000000000000"
  );

  // Order Placement State
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // In-memory Customer Form (Never persisted to localStorage or URL params)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      orderNotes: "",
      paymentMethod: "CASH_ON_DELIVERY",
    },
  });

  // Revalidate Cart authoritatively
  const revalidateCart = useCallback(async () => {
    if (items.length === 0) {
      setCartValidation({
        items: [],
        validItems: [],
        invalidItems: [],
        subtotal: "0.00",
        deliveryCharge: "0.00",
        total: "0.00",
      });
      setIsValidatingCart(false);
      setCartValidationError(false);
      return;
    }

    setIsValidatingCart(true);
    setCartValidationError(false);

    const payload = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    const result = await validateCart(payload);
    if (result) {
      setCartValidation(result);
      setCartValidationError(false);
    } else {
      setCartValidationError(true);
    }
    setIsValidatingCart(false);
  }, [items]);

  // Load Checkout Configuration
  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    const configData = await fetchCheckoutConfig();
    if (configData) {
      setConfig(configData);
    }
    setIsLoadingConfig(false);
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    if (!isHydrated) return;

    let isCancelled = false;

    const init = async () => {
      await Promise.resolve();
      if (isCancelled) return;
      await Promise.all([revalidateCart(), loadConfig()]);
    };

    void init();

    return () => {
      isCancelled = true;
    };
  }, [isHydrated, revalidateCart, loadConfig]);

  // Invalidate previous review if stored cart state changes
  useEffect(() => {
    let isCancelled = false;

    void Promise.resolve().then(() => {
      if (!isCancelled) {
        setReviewedData(null);
        setOrderError(null);
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          setIdempotencyKey(crypto.randomUUID());
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [items]);

  // Handle Invalidation on user edits
  const handleFieldChange = () => {
    if (reviewedData) {
      setReviewedData(null);
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        setIdempotencyKey(crypto.randomUUID());
      }
    }
    if (reviewError) {
      setReviewError(null);
    }
    if (orderError) {
      setOrderError(null);
    }
  };

  // Handle Edit Details action
  const handleEditDetails = () => {
    setReviewedData(null);
    setOrderError(null);
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  // Handle Final Order Placement
  const handlePlaceOrder = async () => {
    if (isSubmittingOrder || !reviewedData) return;

    setIsSubmittingOrder(true);
    setOrderError(null);

    const cartItemsPayload = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    const res = await createOrder({
      idempotencyKey,
      items: cartItemsPayload,
      customer: reviewedData.customer,
      paymentMethod: reviewedData.paymentMethod,
    });

    if (res.success) {
      // Order confirmed: clear local cart and navigate to order success
      clearCart();
      router.push(
        `/order-success?orderNumber=${encodeURIComponent(res.data.orderNumber)}&paymentMethod=${encodeURIComponent(res.data.paymentMethod)}`
      );
    } else {
      setIsSubmittingOrder(false);
      const errorMessage = res.error?.message || "Failed to place order. Please try again.";
      setOrderError(errorMessage);

      // If cart or payment became invalid, invalidate reviewed state and refresh authoritative data
      if (
        res.error?.code === "CART_INVALID" ||
        res.error?.code === "PAYMENT_METHOD_UNAVAILABLE" ||
        res.error?.code === "CART_EMPTY"
      ) {
        setReviewedData(null);
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          setIdempotencyKey(crypto.randomUUID());
        }
        void revalidateCart();
        void loadConfig();
      }
    }
  };

  // Handle Payment Method selection
  const handlePaymentMethodSelect = (method: "CASH_ON_DELIVERY" | "BANK_TRANSFER") => {
    setSelectedPaymentMethod(method);
    setValue("paymentMethod", method);
    handleFieldChange();
  };

  // Submit Review Handler
  const onSubmit = async (formData: CheckoutFormData) => {
    setReviewError(null);

    // Ensure payment method matches state
    formData.paymentMethod = selectedPaymentMethod;

    // Validate locally against Zod schema
    const clientValidation = checkoutFormSchema.safeParse(formData);
    if (!clientValidation.success) {
      for (const issue of clientValidation.error.issues) {
        const fieldName = issue.path[0] as keyof CheckoutFormData;
        if (fieldName) {
          setError(fieldName, { type: "manual", message: issue.message });
        }
      }
      return;
    }

    clearErrors();

    // Prepare fresh payload
    const normalizedCustomer = normalizeCheckoutFormData(formData);
    const cartItemsPayload = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    setIsReviewing(true);

    const res = await validateCheckout({
      items: cartItemsPayload,
      customer: normalizedCustomer,
      paymentMethod: selectedPaymentMethod,
    });

    setIsReviewing(false);

    if (res.success) {
      setReviewedData(res.data);
      setReviewError(null);
    } else {
      setReviewError(
        res.error?.message || "Checkout validation failed. Please check your details and cart."
      );
      if (res.error?.code === "CART_INVALID") {
        void revalidateCart();
      }
    }
  };

  // 1. Initial Hydration or Loading State
  if (!isHydrated || (isValidatingCart && !cartValidation) || isLoadingConfig) {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <LoadingState
          title="Preparing Checkout..."
          message="Validating your shopping bag and loading payment configuration..."
        />
      </div>
    );
  }

  // 2. Empty Cart Guard
  if (items.length === 0) {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <EmptyCartState shopHref="/" />
      </div>
    );
  }

  // 3. API Outage Error State
  if (cartValidationError && !cartValidation) {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <ErrorState
          title="Checkout Unavailable"
          description="We couldn't connect to our servers to verify your shopping bag. Your items remain safely in your bag."
          onRetry={revalidateCart}
          retryLabel="Retry Verification"
        />
      </div>
    );
  }

  const validItems = cartValidation?.validItems || [];
  const invalidItems = cartValidation?.invalidItems || [];
  const hasInvalidItems = invalidItems.length > 0;

  // 4. Stale / Invalid Cart Guard: Block Checkout if any items are invalid
  if (hasInvalidItems || validItems.length === 0) {
    return (
      <div className="py-12 sm:py-16 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="p-6 sm:p-8 rounded-2xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-editorial text-2xl text-ink font-normal tracking-tight">
              Shopping Bag Requires Attention
            </h2>
            <p className="font-sans text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              Some items in your shopping bag have changed or are currently unavailable. Please
              review your bag before proceeding to checkout.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/cart"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-ink text-white font-sans text-xs font-semibold hover:bg-ink/90 active:scale-[0.99] transition-all cursor-pointer shadow-subtle"
            >
              <span>Return to Shopping Bag</span>
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fallback default config if API returned null
  const paymentMethodsConfig = config?.paymentMethods || {
    cashOnDelivery: { available: true },
    bankTransfer: {
      available: false,
      bankName: null,
      accountTitle: null,
      accountOrIban: null,
    },
  };

  // 5. Reviewed State View (Rendered after successful pre-validation)
  if (reviewedData) {
    return (
      <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <span className="text-xs uppercase tracking-widest font-sans font-semibold text-text-muted">
              Checkout Step 2 of 2
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight mt-1">
              Review Your Order
            </h1>
          </div>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 text-xs font-sans text-text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Bag</span>
          </Link>
        </div>

        <CheckoutReviewView
          reviewedData={reviewedData}
          bankConfig={paymentMethodsConfig.bankTransfer}
          onEditDetails={handleEditDetails}
          onPlaceOrder={handlePlaceOrder}
          isSubmittingOrder={isSubmittingOrder}
          orderError={orderError}
        />
      </div>
    );
  }

  // 6. Checkout Form View (Step 1)
  return (
    <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="text-xs uppercase tracking-widest font-sans font-semibold text-text-muted">
            Guest Checkout
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight mt-1">
            Shipping & Payment
          </h1>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Back to Bag ({totalUnits} {totalUnits === 1 ? "unit" : "units"})
          </span>
        </Link>
      </div>

      {/* Review Error Notification */}
      {reviewError && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-xs font-sans text-danger flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <span className="font-semibold block">Validation Error:</span>
            <span>{reviewError}</span>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Customer Form & Payment Method Selection */}
          <div className="lg:col-span-7 space-y-8">
            <div className="p-6 sm:p-8 rounded-2xl border border-border bg-surface shadow-subtle space-y-8">
              <CheckoutCustomerForm
                register={register}
                errors={errors}
                onFieldChange={handleFieldChange}
                disabled={isReviewing}
              />

              <div className="pt-4 border-t border-border">
                <CheckoutPaymentSelection
                  paymentMethods={paymentMethodsConfig}
                  selectedMethod={selectedPaymentMethod}
                  onSelectMethod={handlePaymentMethodSelect}
                  disabled={isReviewing}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Review Order Action */}
          <div className="lg:col-span-5 sticky top-24 space-y-4">
            <CheckoutOrderSummary
              items={validItems}
              subtotal={cartValidation?.subtotal || "0.00"}
              deliveryCharge={cartValidation?.deliveryCharge || "0.00"}
              total={cartValidation?.total || "0.00"}
              isReviewing={isReviewing}
            />

            {/* Action Button: Review Order */}
            <div className="space-y-2">
              <CheckoutPrimaryAction
                type="submit"
                disabled={isReviewing}
              >
                <span>{isReviewing ? "Verifying with server..." : "Review Order"}</span>
                {!isReviewing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </CheckoutPrimaryAction>

              <p className="text-[11px] font-sans text-center text-text-muted">
                You will review your order before confirming it.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
