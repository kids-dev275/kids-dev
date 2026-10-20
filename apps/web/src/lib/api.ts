/**
 * Kids Wear — Public API Client
 *
 * Environment-driven HTTP client for public backend endpoints.
 * Never exposes secrets; gracefully handles offline or unreachable backend states.
 */

export interface ApiAnnouncement {
  text: string | null;
  link: string | null;
  isActive: boolean;
}

export interface ApiShippingSettings {
  flatDeliveryCharge: string;
}

export interface ApiPublicSettings {
  announcement: ApiAnnouncement;
  shipping: ApiShippingSettings;
}

export interface ApiImageAsset {
  id: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
}

export interface ApiHeroSlide {
  id: string;
  storefrontId: string;
  heading: string | null;
  text: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
  desktopImageAsset: ApiImageAsset;
  mobileImageAsset: ApiImageAsset | null;
}

export interface ApiStorefrontDetails {
  id: string;
  name: string;
  slug: string;
  ageLabel: string;
  heroSlides: ApiHeroSlide[];
}

export interface ApiProductCard {
  id: string;
  name: string;
  slug: string;
  regularPrice: string;
  compareAtPrice: string | null;
  isNewArrival: boolean;
  mainImage: {
    url: string;
    altText: string | null;
  };
  hoverImage: {
    url: string;
    altText: string | null;
  } | null;
}

export interface ApiProductsResponse {
  items: ApiProductCard[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Resolves the backend API base URL from environment variables.
 * In production, a missing or invalid URL is treated as a critical configuration defect
 * and throws an observable error rather than silently defaulting to an unreachable address.
 */
export function getApiBaseUrl(): string {
  const isServer = typeof window === "undefined";
  const isProduction = process.env.NODE_ENV === "production";

  let rawUrl: string | undefined;
  if (isServer && process.env.INTERNAL_API_URL) {
    rawUrl = process.env.INTERNAL_API_URL;
  } else if (process.env.NEXT_PUBLIC_API_URL) {
    rawUrl = process.env.NEXT_PUBLIC_API_URL;
  } else if (!isProduction) {
    rawUrl = "http://localhost:4000/api/v1";
  }

  if (!rawUrl) {
    console.error(
      "[Config Error] Neither INTERNAL_API_URL nor NEXT_PUBLIC_API_URL is configured in production environment."
    );
    throw new Error("Backend API base URL is not configured in production environment.");
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}`);
    }
    return rawUrl.replace(/\/$/, "");
  } catch (err) {
    console.error("[Config Error] Invalid backend API base URL:", rawUrl);
    throw new Error("Invalid backend API base URL configuration.");
  }
}

/**
 * Fetch public settings (announcement bar + shipping rate).
 * Employs request-time fetching ({ cache: "no-store" }) for live freshness.
 */
export async function fetchPublicSettings(): Promise<ApiPublicSettings | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/public/settings`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch public settings (${res.status}) from ${url}`);
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as ApiPublicSettings;
    }
    return null;
  } catch (err) {
    console.warn(`[API] Network error fetching public settings:`, (err as Error)?.message);
    return null;
  }
}

/**
 * Fetch public storefront data including active hero slides.
 * Employs request-time fetching ({ cache: "no-store" }) for live freshness.
 */
export async function fetchStorefront(slug: string): Promise<ApiStorefrontDetails | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/storefronts/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch storefront "${slug}" (${res.status}) from ${url}`);
      return null;
    }
    const json = await res.json();
    if (json.success && json.data?.storefront) {
      return json.data.storefront as ApiStorefrontDetails;
    }
    return null;
  } catch (err) {
    console.warn(`[API] Network error fetching storefront "${slug}":`, (err as Error)?.message);
    return null;
  }
}

/**
 * Fetch public product cards for a storefront (with optional new-arrivals filter).
 * Employs request-time fetching ({ cache: "no-store" }) for live freshness.
 */
export async function fetchStorefrontProducts(
  slug: string,
  options?: { isNewArrival?: boolean; limit?: number; page?: number }
): Promise<ApiProductsResponse | null> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();
  if (options?.isNewArrival) {
    searchParams.set("new", "true");
  }
  if (options?.limit) {
    searchParams.set("limit", String(options.limit));
  }
  if (options?.page) {
    searchParams.set("page", String(options.page));
  }

  const queryString = searchParams.toString();
  const url = `${baseUrl}/storefronts/${encodeURIComponent(slug)}/products${
    queryString ? `?${queryString}` : ""
  }`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch products for "${slug}" (${res.status}) from ${url}`);
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as ApiProductsResponse;
    }
    return null;
  } catch (err) {
    console.warn(`[API] Network error fetching products for "${slug}":`, (err as Error)?.message);
    return null;
  }
}

export interface ApiSizeGuideRow {
  id?: string;
  label: string;
  values: Record<string, string | number>;
  sortOrder?: number;
}

export interface ApiSizeGuideColumn {
  key: string;
  label: string;
}

export interface ApiSizeGuide {
  columns: ApiSizeGuideColumn[] | Array<Record<string, unknown>>;
  rows: ApiSizeGuideRow[];
}

export interface ApiProductMediaItem {
  type: "IMAGE" | "VIDEO";
  url: string;
  altText: string | null;
  isMain: boolean;
  isHover: boolean;
  sortOrder: number;
}

export interface ApiProductOption {
  id: string;
  name: string;
}

export interface ApiProductVariant {
  id: string;
  productSizeId: string;
  productColorId: string;
  isAvailable: boolean;
}

export interface ApiProductDetail {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  regularPrice: string;
  compareAtPrice: string | null;
  productType: string | null;
  gender: string | null;
  fabric: string | null;
  includedPieces: string | null;
  fit: string | null;
  patternDesign: string | null;
  occasion: string | null;
  season: string | null;
  careInstructions: string | null;
  isNewArrival: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  media: ApiProductMediaItem[];
  sizes: ApiProductOption[];
  colors: ApiProductOption[];
  variants: ApiProductVariant[];
  sizeGuide: ApiSizeGuide | null;
}

export interface ApiSearchResponse {
  items: ApiProductCard[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  query: string;
}

/**
 * Execute storefront-specific search with query and pagination.
 * Employs request-time fetching ({ cache: "no-store" }) for live freshness.
 */
export async function searchStorefrontProducts(
  storefrontSlug: string,
  options: { q: string; page?: number; limit?: number }
): Promise<ApiSearchResponse | null> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();
  searchParams.set("q", options.q);
  if (options.page) {
    searchParams.set("page", String(options.page));
  }
  if (options.limit) {
    searchParams.set("limit", String(options.limit));
  }

  const url = `${baseUrl}/storefronts/${encodeURIComponent(storefrontSlug)}/search?${searchParams.toString()}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[API] Search failed for "${storefrontSlug}" (${res.status}) from ${url}`);
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as ApiSearchResponse;
    }
    return null;
  } catch (err) {
    console.warn(`[API] Network error searching in "${storefrontSlug}":`, (err as Error)?.message);
    return null;
  }
}

/**
 * Fetch public product detail for PDP.
 * Returns null if the product is not found, inactive, or not published.
 * Employs request-time fetching ({ cache: "no-store" }) for live freshness.
 */
export async function fetchStorefrontProduct(
  storefrontSlug: string,
  productSlug: string
): Promise<ApiProductDetail | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/storefronts/${encodeURIComponent(storefrontSlug)}/products/${encodeURIComponent(productSlug)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[API] PDP fetch returned ${res.status} for ${storefrontSlug}/${productSlug}`);
      }
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      return (json.data.product ?? json.data) as ApiProductDetail;
    }
    return null;
  } catch (err) {
    console.warn(
      `[API] Network error fetching PDP for ${storefrontSlug}/${productSlug}:`,
      (err as Error)?.message
    );
    return null;
  }
}

export interface CartValidateItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ApiCartValidatedItem {
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    name: string;
    slug: string;
    storefrontSlug: string;
    mainImage: {
      url: string;
      altText: string | null;
    } | null;
  };
  variant: {
    size: string;
    color: string;
    isAvailable: boolean;
  };
  unitPrice: string;
  lineSubtotal: string;
}

export interface ApiCartInvalidItem {
  productId: string;
  variantId: string;
  reason:
    | "PRODUCT_NOT_FOUND"
    | "PRODUCT_UNPUBLISHED"
    | "PRODUCT_UNAVAILABLE"
    | "PRODUCT_MISMATCH"
    | "VARIANT_NOT_FOUND"
    | "VARIANT_UNAVAILABLE"
    | "SIZE_INACTIVE"
    | "COLOR_INACTIVE";
  message: string;
}

export interface ApiCartValidationResult {
  items: ApiCartValidatedItem[];
  validItems: ApiCartValidatedItem[];
  invalidItems: ApiCartInvalidItem[];
  subtotal: string;
  deliveryCharge: string;
  total: string;
}

/**
 * Validates a guest cart payload authoritatively against the backend.
 * Public endpoint; does not require auth or CSRF.
 */
export async function validateCart(
  items: CartValidateItemInput[]
): Promise<ApiCartValidationResult | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/cart/validate`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      console.warn(`[API] Cart validation failed with status ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.success && json.data) {
      return json.data as ApiCartValidationResult;
    }
    return null;
  } catch (err) {
    console.warn("[API] Network error validating cart:", (err as Error)?.message);
    return null;
  }
}

export type {
  CheckoutConfigData,
  CheckoutConfigPaymentMethods,
  CheckoutBankTransferConfig,
  CheckoutCustomerInput,
  CheckoutValidationItem,
  CheckoutValidationResponseData,
  PaymentMethodType,
} from "@kids-wear/shared";

import type {
  CheckoutConfigData,
  CheckoutValidationResponseData,
  OrderCreateResponseData,
  PaymentMethodType,
  ApiResponse,
  CustomerProfileData,
  CustomerOrdersResponseData,
  CustomerOrderDetailData,
} from "@kids-wear/shared";

export interface CheckoutValidateRequestPayload {
  items: CartValidateItemInput[];
  customer: {
    fullName: string;
    phone: string;
    email?: string | null;
    address: string;
    city: string;
    province: string;
    postalCode?: string | null;
    orderNotes?: string | null;
  };
  paymentMethod: PaymentMethodType;
}

export interface OrderCreateRequestPayload {
  idempotencyKey: string;
  items: CartValidateItemInput[];
  customer: {
    fullName: string;
    phone: string;
    email?: string | null;
    address: string;
    city: string;
    province: string;
    postalCode?: string | null;
    orderNotes?: string | null;
  };
  paymentMethod: PaymentMethodType;
}

/**
 * Fetch customer-facing checkout and payment method configuration.
 * Public endpoint; read-only.
 */
export async function fetchCheckoutConfig(): Promise<CheckoutConfigData | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/checkout/config`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(`[API] Failed to fetch checkout config (${res.status}) from ${url}`);
      return null;
    }

    const json = await res.json();
    if (json.success && json.data) {
      return json.data as CheckoutConfigData;
    }
    return null;
  } catch (err) {
    console.warn(`[API] Network error fetching checkout config:`, (err as Error)?.message);
    return null;
  }
}

/**
 * Authoritative checkout pre-validation.
 * Sends cart items, customer details, and selected payment method for validation.
 * Creates no orders, reservations, or persistent state.
 */
export async function validateCheckout(
  payload: CheckoutValidateRequestPayload
): Promise<ApiResponse<CheckoutValidationResponseData>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/checkout/validate`;

  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<CheckoutValidationResponseData>;
  } catch (err) {
    console.warn("[API] Network error validating checkout:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect to the checkout validation service. Please try again.",
      },
    };
  }
}

/**
 * Public transactional order creation endpoint.
 * Submits customer intent, items, and client idempotency key to create an order.
 * Clears no carts and persists no client-calculated prices.
 */
export async function createOrder(
  payload: OrderCreateRequestPayload
): Promise<ApiResponse<OrderCreateResponseData>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/orders`;

  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<OrderCreateResponseData>;
  } catch (err) {
    console.warn("[API] Network error creating order:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect to the order creation service. Please try again.",
      },
    };
  }
}

// ============================================================================
// Customer Account & Authentication API Functions
// ============================================================================

export interface CustomerRegisterPayload {
  fullName: string;
  email: string;
  phone?: string | null;
  password: string;
  confirmPassword?: string;
}

export interface CustomerLoginPayload {
  email: string;
  password: string;
}

export interface CustomerProfileUpdatePayload {
  fullName?: string;
  email?: string;
  phone?: string | null;
}

/**
 * Register a new Customer account.
 * Upon success, backend automatically sets HttpOnly customer session cookie.
 */
export async function registerCustomer(
  payload: CustomerRegisterPayload
): Promise<ApiResponse<{ customer: CustomerProfileData }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/register`;

  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<{ customer: CustomerProfileData }>;
  } catch (err) {
    console.warn("[API] Network error registering customer:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect to the registration service. Please try again.",
      },
    };
  }
}

/**
 * Authenticate customer with email and password.
 * Sets HttpOnly session cookie on response.
 */
export async function loginCustomer(
  payload: CustomerLoginPayload
): Promise<ApiResponse<{ customer: CustomerProfileData }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/login`;

  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<{ customer: CustomerProfileData }>;
  } catch (err) {
    console.warn("[API] Network error logging in customer:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect to the login service. Please try again.",
      },
    };
  }
}

/**
 * Fetch currently authenticated Customer session profile.
 */
export async function getCurrentCustomer(): Promise<
  ApiResponse<{ customer: CustomerProfileData }>
> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/me`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json();
    return json as ApiResponse<{ customer: CustomerProfileData }>;
  } catch (err) {
    console.warn("[API] Network error fetching current customer:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to resolve session. Please try again.",
      },
    };
  }
}

/**
 * Fetch Customer CSRF token for state-changing requests.
 */
export async function getCustomerCsrf(): Promise<ApiResponse<{ csrfToken: string }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/csrf`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json();
    return json as ApiResponse<{ csrfToken: string }>;
  } catch (err) {
    console.warn("[API] Network error fetching customer CSRF token:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to retrieve security token.",
      },
    };
  }
}

/**
 * Log out Customer. Requires valid CSRF token.
 * Clears Customer session only; preserves guest Cart.
 */
export async function logoutCustomer(
  csrfToken?: string
): Promise<ApiResponse<{ message: string }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/logout`;

  try {
    let token = csrfToken;
    if (!token) {
      const csrfRes = await getCustomerCsrf();
      if (csrfRes.success) {
        token = csrfRes.data.csrfToken;
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (token) {
      headers["X-CSRF-Token"] = token;
    }

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
    });

    const json = await res.json();
    return json as ApiResponse<{ message: string }>;
  } catch (err) {
    console.warn("[API] Network error logging out customer:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to connect to the logout service.",
      },
    };
  }
}

/**
 * Fetch Customer profile data.
 */
export async function getCustomerProfile(): Promise<
  ApiResponse<{ customer: CustomerProfileData }>
> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/account/profile`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json();
    return json as ApiResponse<{ customer: CustomerProfileData }>;
  } catch (err) {
    console.warn("[API] Network error fetching customer profile:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to load customer profile.",
      },
    };
  }
}

/**
 * Update Customer profile (name, email, phone).
 * Requires CSRF token.
 */
export async function updateCustomerProfile(
  payload: CustomerProfileUpdatePayload,
  csrfToken?: string
): Promise<ApiResponse<{ customer: CustomerProfileData }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/account/profile`;

  try {
    let token = csrfToken;
    if (!token) {
      const csrfRes = await getCustomerCsrf();
      if (csrfRes.success) {
        token = csrfRes.data.csrfToken;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) {
      headers["X-CSRF-Token"] = token;
    }

    const res = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<{ customer: CustomerProfileData }>;
  } catch (err) {
    console.warn("[API] Network error updating customer profile:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to update profile. Please try again.",
      },
    };
  }
}

/**
 * Fetch authenticated Customer's orders list (newest first).
 */
export async function getCustomerOrders(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiResponse<CustomerOrdersResponseData>> {
  const baseUrl = getApiBaseUrl();
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const url = `${baseUrl}/account/orders?page=${page}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json();
    return json as ApiResponse<CustomerOrdersResponseData>;
  } catch (err) {
    console.warn("[API] Network error fetching customer orders:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to load order history.",
      },
    };
  }
}

/**
 * Fetch detail snapshot for an authenticated Customer's order.
 */
export async function getCustomerOrder(
  orderNumber: string
): Promise<ApiResponse<CustomerOrderDetailData>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/account/orders/${encodeURIComponent(orderNumber)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json();
    return json as ApiResponse<CustomerOrderDetailData>;
  } catch (err) {
    console.warn("[API] Network error fetching customer order detail:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to load order details.",
      },
    };
  }
}

// ============================================================================
// Public Review APIs (Work Unit 18)
// ============================================================================

import type {
  PublicReviewItem,
  PublicReviewsResponseData,
  CreateReviewPayload,
  CreateReviewResponseData,
  ReviewMediaSignResponseData,
} from "@kids-wear/shared";

export type {
  PublicReviewItem,
  PublicReviewsResponseData,
  CreateReviewPayload,
  CreateReviewResponseData,
  ReviewMediaSignResponseData,
};

/**
 * Fetch public approved reviews with optional filters.
 */
export async function fetchPublicReviews(params?: {
  page?: number;
  limit?: number;
  productId?: string;
  storefrontSlug?: string;
}): Promise<PublicReviewsResponseData | null> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.productId) searchParams.set("productId", params.productId);
  if (params?.storefrontSlug) searchParams.set("storefrontSlug", params.storefrontSlug);

  const queryStr = searchParams.toString();
  const url = `${baseUrl}/reviews${queryStr ? `?${queryStr}` : ""}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[API] Failed to fetch public reviews: ${res.status}`);
      return null;
    }

    const json = await res.json();
    return json?.data as PublicReviewsResponseData;
  } catch (err) {
    console.warn("[API] Network error fetching public reviews:", (err as Error)?.message);
    return null;
  }
}

/**
 * Request short-lived signed upload parameters for a review image.
 */
export async function signReviewMedia(
  reviewSubmissionId: string
): Promise<ApiResponse<ReviewMediaSignResponseData>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/reviews/media/sign`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ reviewSubmissionId }),
    });

    const json = await res.json();
    return json as ApiResponse<ReviewMediaSignResponseData>;
  } catch (err) {
    console.warn("[API] Network error signing review media:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Failed to sign review media upload.",
      },
    };
  }
}

/**
 * Submit an anonymous customer review for admin moderation.
 */
export async function submitReview(
  payload: CreateReviewPayload
): Promise<ApiResponse<CreateReviewResponseData>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/reviews`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    return json as ApiResponse<CreateReviewResponseData>;
  } catch (err) {
    console.warn("[API] Network error submitting review:", (err as Error)?.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to submit review. Please try again.",
      },
    };
  }
}

/**
 * Fetch all eligible public products across all storefronts for review submission.
 */
export async function fetchEligibleProductsForReview(): Promise<
  Array<{ id: string; name: string; slug: string; storefrontSlug: string }>
> {
  const storefronts = ["mini-sprouts", "teen-studio", "aura-studio"] as const;
  const productLists = await Promise.all(
    storefronts.map(async (sf) => {
      const data = await fetchStorefrontProducts(sf, { limit: 50 });
      if (!data || !data.items) return [];
      return data.items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        storefrontSlug: sf,
      }));
    })
  );

  return productLists.flat();
}
