/**
 * Kids Wear — Typed Admin API Client
 *
 * Dedicated client for operational Admin panel requests.
 * Uses credentialed session requests (HttpOnly kw_admin_session),
 * automated session-bound CSRF token acquisition for mutations,
 * and zero browser-token persistence.
 */

import { getApiBaseUrl } from "./api";
import { classifyAdminRequestError } from "./admin-request-error";
import type {
  AdminDashboardData,
  AdminOrdersResponseData,
  AdminOrderDetailData,
  AdminOrderStatusUpdateResponseData,
  AdminReviewsResponseData,
  AdminReviewDetailData,
  AdminReviewStatusUpdateResponseData,
  OrderStatusType,
  PaymentMethodType,
  ReviewStatusType,
} from "@kids-wear/shared";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface AdminUser {
  id: string;
  email: string;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  sku: string;
  slug: string;
  storefrontId: string;
  regularPrice: string;
  compareAtPrice: string | null;
  status: "DRAFT" | "PUBLISHED" | "INACTIVE";
  isNewArrival: boolean;
  updatedAt: string;
  thumbnailUrl?: string | null;
  variantCount?: number;
  availableVariantCount?: number;
  storefront?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface AdminProductsResponseData {
  items: AdminProductListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminProductDetail extends AdminProductListItem {
  description: string;
  shortDescription: string | null;
  productType: string | null;
  gender: string | null;
  fabric: string | null;
  includedPieces: string | null;
  fit: string | null;
  patternDesign: string | null;
  occasion: string | null;
  season: string | null;
  careInstructions: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

export interface AdminProductSize {
  id: string;
  productId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminProductColor {
  id: string;
  productId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminProductVariant {
  id: string;
  productId: string;
  productSizeId: string;
  productColorId: string;
  isAvailable: boolean;
  size?: AdminProductSize;
  color?: AdminProductColor;
}

export interface AdminProductMedia {
  id: string;
  productId: string;
  mediaAssetId: string;
  mediaType: "IMAGE" | "VIDEO";
  provider: string;
  providerPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  format: string | null;
  bytes: number | null;
  altText: string | null;
  sortOrder: number;
  isMain: boolean;
  isHover: boolean;
  createdAt: string;
}

export interface AdminStorefrontItem {
  id: string;
  name: string;
  slug: string;
  ageLabel: string;
}

export interface AdminHeroSlide {
  id: string;
  storefrontId: string;
  heading: string | null;
  text: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
  desktopImageAsset: {
    id: string;
    secureUrl: string;
    width: number;
    height: number;
    format: string;
  };
  mobileImageAsset: {
    id: string;
    secureUrl: string;
    width: number;
    height: number;
    format: string;
  } | null;
}

export interface AdminHeroImageAsset {
  id: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  format: string | null;
}

export interface AdminAnnouncementSettings {
  text: string | null;
  link: string | null;
  isActive: boolean;
  updatedAt?: string;
}

export interface AdminShippingSettings {
  flatDeliveryCharge: string;
  updatedAt?: string;
}

export interface AdminBankTransferSettings {
  bankName: string | null;
  accountTitle: string | null;
  accountOrIban: string | null;
  branchCode?: string | null;
  branchLocation?: string | null;
  instructions: string | null;
  updatedAt?: string;
}

export interface AdminNotificationSettings {
  newOrderEmailEnabled: boolean;
  newOrderNotificationRecipient: string | null;
  updatedAt?: string;
}

// In-memory CSRF cache
let cachedCsrfToken: string | null = null;

export async function getAdminCsrfToken(): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const requestId = crypto.randomUUID();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/admin/auth/csrf`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    const category = classifyAdminRequestError(error).code;
    if (category !== "REQUEST_ABORTED") {
      console.warn("[Admin API] CSRF request failed", { clientAttemptId: requestId, category });
    }
    throw error;
  }
  if (!res.ok) {
    throw new Error("Failed to fetch admin CSRF token");
  }
  const json = (await res.json()) as { success: boolean; data?: { csrfToken: string } };
  if (!json.success || !json.data?.csrfToken) {
    throw new Error("Admin CSRF token response invalid");
  }
  cachedCsrfToken = json.data.csrfToken;
  return json.data.csrfToken;
}

async function adminFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCsrf = true
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const requestId = crypto.randomUUID();
  const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  if (isMutation) headers.set("X-Request-ID", requestId);

  if (isMutation) {
    if (!cachedCsrfToken) {
      try {
        await getAdminCsrfToken();
      } catch {
        // Continue, request may fail with CSRF_MISSING and be handled
      }
    }
    if (cachedCsrfToken) {
      headers.set("x-csrf-token", cachedCsrfToken);
    }
  }

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

    // Handle CSRF expiration / invalid retry
    if (
      !res.ok &&
      retryCsrf &&
      json?.error?.code &&
      (json.error.code === "CSRF_INVALID" || json.error.code === "CSRF_MISSING")
    ) {
      cachedCsrfToken = null;
      await getAdminCsrfToken();
      return adminFetch<T>(endpoint, options, false);
    }

    if (!json) {
      return {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: `Request failed with status ${res.status}`,
          requestId: res.headers.get("X-Request-ID") ?? (isMutation ? requestId : undefined),
        },
      };
    }

    if (!json.success && json.error) {
      return { ...json, error: { ...json.error, requestId: res.headers.get("X-Request-ID") ?? (isMutation ? requestId : undefined) } };
    }
    return json;
  } catch (err: unknown) {
    const error = classifyAdminRequestError(err);
    if (error.code !== "REQUEST_ABORTED") {
      console.warn("[Admin API] Request failed", { requestId: isMutation ? requestId : undefined, clientAttemptId: isMutation ? undefined : requestId, method, path: endpoint.split("?")[0], category: error.code });
    }
    return {
      success: false,
      error: { ...error, requestId: isMutation ? requestId : undefined },
    };
  }
}

// ============================================================================
// Auth Helpers
// ============================================================================

export async function adminLogin(
  email: string,
  password: string
): Promise<ApiResponse<{ admin: AdminUser }>> {
  const res = await adminFetch<{ admin: AdminUser }>(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false
  );
  if (res.success) {
    try {
      await getAdminCsrfToken();
    } catch {
      // CSRF token will be fetched lazily on first mutation
    }
  }
  return res;
}

export async function adminLogout(): Promise<ApiResponse<{ message: string }>> {
  const res = await adminFetch<{ message: string }>("/admin/auth/logout", {
    method: "POST",
  });
  cachedCsrfToken = null;
  return res;
}

export async function getAdminMe(): Promise<ApiResponse<{ admin: AdminUser }>> {
  return adminFetch<{ admin: AdminUser }>("/admin/auth/me", {
    method: "GET",
  });
}

// ============================================================================
// Dashboard Helpers
// ============================================================================

export async function getAdminDashboard(): Promise<ApiResponse<AdminDashboardData>> {
  return adminFetch<AdminDashboardData>("/admin/dashboard", {
    method: "GET",
  });
}

// ============================================================================
// Product Helpers
// ============================================================================

export async function getAdminProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  storefront?: string;
  status?: string;
}): Promise<ApiResponse<AdminProductsResponseData>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.storefront) query.set("storefront", params.storefront);
  if (params?.status) query.set("status", params.status);

  const qs = query.toString();
  return adminFetch<AdminProductsResponseData>(`/admin/products${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function getAdminProduct(
  productId: string
): Promise<ApiResponse<{ product: AdminProductDetail }>> {
  return adminFetch<{ product: AdminProductDetail }>(`/admin/products/${productId}`, {
    method: "GET",
  });
}

export async function createAdminProduct(
  data: Record<string, unknown>
): Promise<ApiResponse<{ product: AdminProductDetail }>> {
  return adminFetch<{ product: AdminProductDetail }>("/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminProduct(
  productId: string,
  data: Record<string, unknown>
): Promise<ApiResponse<{ product: AdminProductDetail }>> {
  return adminFetch<{ product: AdminProductDetail }>(`/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminProduct(
  productId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/products/${productId}`, {
    method: "DELETE",
  });
}

export async function updateAdminProductStatus(
  productId: string,
  status: "DRAFT" | "PUBLISHED" | "INACTIVE"
): Promise<ApiResponse<{ product: AdminProductDetail }>> {
  return adminFetch<{ product: AdminProductDetail }>(`/admin/products/${productId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Options & Variants
export async function getAdminProductSizes(
  productId: string
): Promise<ApiResponse<{ sizes: AdminProductSize[] }>> {
  return adminFetch<{ sizes: AdminProductSize[] }>(`/admin/products/${productId}/sizes`, {
    method: "GET",
  });
}

export async function createAdminProductSize(
  productId: string,
  data: { name: string; sortOrder?: number; isActive?: boolean }
): Promise<ApiResponse<{ size: AdminProductSize }>> {
  return adminFetch<{ size: AdminProductSize }>(`/admin/products/${productId}/sizes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminProductSize(
  productId: string,
  sizeId: string,
  data: { name?: string; sortOrder?: number; isActive?: boolean }
): Promise<ApiResponse<{ size: AdminProductSize }>> {
  return adminFetch<{ size: AdminProductSize }>(`/admin/products/${productId}/sizes/${sizeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminProductSize(
  productId: string,
  sizeId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/products/${productId}/sizes/${sizeId}`, {
    method: "DELETE",
  });
}

export async function getAdminProductColors(
  productId: string
): Promise<ApiResponse<{ colors: AdminProductColor[] }>> {
  return adminFetch<{ colors: AdminProductColor[] }>(`/admin/products/${productId}/colors`, {
    method: "GET",
  });
}

export async function createAdminProductColor(
  productId: string,
  data: { name: string; sortOrder?: number; isActive?: boolean }
): Promise<ApiResponse<{ color: AdminProductColor }>> {
  return adminFetch<{ color: AdminProductColor }>(`/admin/products/${productId}/colors`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminProductColor(
  productId: string,
  colorId: string,
  data: { name?: string; sortOrder?: number; isActive?: boolean }
): Promise<ApiResponse<{ color: AdminProductColor }>> {
  return adminFetch<{ color: AdminProductColor }>(
    `/admin/products/${productId}/colors/${colorId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteAdminProductColor(
  productId: string,
  colorId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/products/${productId}/colors/${colorId}`, {
    method: "DELETE",
  });
}

export async function getAdminProductVariants(
  productId: string
): Promise<ApiResponse<{ variants: AdminProductVariant[] }>> {
  return adminFetch<{ variants: AdminProductVariant[] }>(`/admin/products/${productId}/variants`, {
    method: "GET",
  });
}

export async function bulkCreateAdminProductVariants(
  productId: string,
  variants: Array<{ productSizeId: string; productColorId: string; isAvailable?: boolean }>
): Promise<ApiResponse<{ variants: AdminProductVariant[] }>> {
  return adminFetch<{ variants: AdminProductVariant[] }>(
    `/admin/products/${productId}/variants/bulk`,
    {
      method: "POST",
      body: JSON.stringify({ variants }),
    }
  );
}

export async function updateAdminProductVariant(
  productId: string,
  variantId: string,
  isAvailable: boolean
): Promise<ApiResponse<{ variant: AdminProductVariant }>> {
  return adminFetch<{ variant: AdminProductVariant }>(
    `/admin/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
    }
  );
}

// Product Media
export async function getAdminProductMediaUploadSignature(
  productId: string,
  mediaType: "IMAGE" | "VIDEO",
  videoCrop?: { x: number; y: number; width: number; height: number }
): Promise<
  ApiResponse<{
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
    publicId: string;
    resourceType: "image" | "video";
    transformation?: string;
  }>
> {
  return adminFetch(`/admin/products/${productId}/media/upload-signature`, {
    method: "POST",
    body: JSON.stringify({ mediaType, ...(videoCrop && { videoCrop }) }),
  });
}

export async function registerAdminProductMedia(
  productId: string,
  data: {
    publicId: string;
    mediaType: "IMAGE" | "VIDEO";
    altText?: string | null;
    sortOrder?: number;
  }
): Promise<ApiResponse<{ media: AdminProductMedia }>> {
  return adminFetch<{ media: AdminProductMedia }>(`/admin/products/${productId}/media`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function replaceAdminProductVideo(
  productId: string,
  publicId: string
): Promise<ApiResponse<{ media: AdminProductMedia }>> {
  return adminFetch<{ media: AdminProductMedia }>(
    `/admin/products/${productId}/media/replace-video`,
    { method: "POST", body: JSON.stringify({ publicId, mediaType: "VIDEO" }) }
  );
}

export async function getAdminProductMedia(
  productId: string
): Promise<ApiResponse<{ media: AdminProductMedia[] }>> {
  return adminFetch<{ media: AdminProductMedia[] }>(`/admin/products/${productId}/media`, {
    method: "GET",
  });
}

export async function reorderAdminProductMedia(
  productId: string,
  mediaIds: string[]
): Promise<ApiResponse<{ media: AdminProductMedia[] }>> {
  return adminFetch<{ media: AdminProductMedia[] }>(`/admin/products/${productId}/media/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ mediaIds }),
  });
}

export async function updateAdminProductMediaAlt(
  productId: string,
  productMediaId: string,
  altText: string | null
): Promise<ApiResponse<{ media: AdminProductMedia }>> {
  return adminFetch<{ media: AdminProductMedia }>(
    `/admin/products/${productId}/media/${productMediaId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ altText }),
    }
  );
}

export async function setAdminProductMediaMain(
  productId: string,
  productMediaId: string
): Promise<ApiResponse<{ media: AdminProductMedia }>> {
  return adminFetch<{ media: AdminProductMedia }>(
    `/admin/products/${productId}/media/${productMediaId}/main`,
    {
      method: "PATCH",
    }
  );
}

export async function setAdminProductMediaHover(
  productId: string,
  productMediaId: string
): Promise<ApiResponse<{ media: AdminProductMedia }>> {
  return adminFetch<{ media: AdminProductMedia }>(
    `/admin/products/${productId}/media/${productMediaId}/hover`,
    {
      method: "PATCH",
    }
  );
}

export async function clearAdminProductMediaHover(
  productId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/products/${productId}/media/hover`, {
    method: "DELETE",
  });
}

export async function deleteAdminProductMedia(
  productId: string,
  productMediaId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/products/${productId}/media/${productMediaId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Order Helpers
// ============================================================================

export async function getAdminOrders(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: OrderStatusType;
  paymentMethod?: PaymentMethodType;
}): Promise<ApiResponse<AdminOrdersResponseData>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);

  const qs = query.toString();
  return adminFetch<AdminOrdersResponseData>(`/admin/orders${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function getAdminOrder(
  orderNumber: string
): Promise<ApiResponse<AdminOrderDetailData>> {
  return adminFetch<AdminOrderDetailData>(`/admin/orders/${orderNumber}`, {
    method: "GET",
  });
}

export async function updateAdminOrderStatus(
  orderNumber: string,
  status: OrderStatusType,
  note?: string
): Promise<ApiResponse<AdminOrderStatusUpdateResponseData>> {
  return adminFetch<AdminOrderStatusUpdateResponseData>(`/admin/orders/${orderNumber}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

// ============================================================================
// Review Helpers
// ============================================================================

export async function getAdminReviews(params?: {
  page?: number;
  limit?: number;
  status?: ReviewStatusType;
  productId?: string;
  rating?: number;
  q?: string;
}): Promise<ApiResponse<AdminReviewsResponseData>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  if (params?.productId) query.set("productId", params.productId);
  if (params?.rating) query.set("rating", String(params.rating));
  if (params?.q) query.set("q", params.q);

  const qs = query.toString();
  return adminFetch<AdminReviewsResponseData>(`/admin/reviews${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function getAdminReview(
  reviewId: string
): Promise<ApiResponse<AdminReviewDetailData>> {
  return adminFetch<AdminReviewDetailData>(`/admin/reviews/${reviewId}`, {
    method: "GET",
  });
}

export async function updateAdminReviewStatus(
  reviewId: string,
  status: ReviewStatusType
): Promise<ApiResponse<AdminReviewStatusUpdateResponseData>> {
  return adminFetch<AdminReviewStatusUpdateResponseData>(`/admin/reviews/${reviewId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminReview(
  reviewId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(`/admin/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Storefront & Hero Helpers
// ============================================================================

export async function getAdminStorefronts(): Promise<
  ApiResponse<{ storefronts: AdminStorefrontItem[] }>
> {
  return adminFetch<{ storefronts: AdminStorefrontItem[] }>("/storefronts", {
    method: "GET",
  });
}

export async function getAdminStorefrontHeroSlides(
  storefrontId: string
): Promise<ApiResponse<{ heroSlides: AdminHeroSlide[] }>> {
  return adminFetch<{ heroSlides: AdminHeroSlide[] }>(
    `/admin/storefronts/${storefrontId}/hero-slides`,
    {
      method: "GET",
    }
  );
}

export async function getAdminHeroUploadSignature(
  storefrontId: string,
  placement: "desktop" | "mobile"
): Promise<ApiResponse<{
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  resourceType: "image";
}>> {
  return adminFetch(`/admin/storefronts/${storefrontId}/hero-media/upload-signature`, {
    method: "POST",
    body: JSON.stringify({ placement }),
  });
}

export async function registerAdminHeroImage(
  storefrontId: string,
  data: { placement: "desktop" | "mobile"; publicId: string }
): Promise<ApiResponse<{ mediaAsset: AdminHeroImageAsset }>> {
  return adminFetch(`/admin/storefronts/${storefrontId}/hero-media`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createAdminHeroSlide(
  storefrontId: string,
  data: {
    heading: string;
    text?: string | null;
    ctaLabel?: string | null;
    ctaLink?: string | null;
    desktopImageAssetId: string;
    mobileImageAssetId?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<ApiResponse<{ heroSlide: AdminHeroSlide }>> {
  return adminFetch<{ heroSlide: AdminHeroSlide }>(
    `/admin/storefronts/${storefrontId}/hero-slides`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateAdminHeroSlide(
  storefrontId: string,
  slideId: string,
  data: {
    heading?: string;
    text?: string | null;
    ctaLabel?: string | null;
    ctaLink?: string | null;
    desktopImageAssetId?: string;
    mobileImageAssetId?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<ApiResponse<{ heroSlide: AdminHeroSlide }>> {
  return adminFetch<{ heroSlide: AdminHeroSlide }>(
    `/admin/storefronts/${storefrontId}/hero-slides/${slideId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteAdminHeroSlide(
  storefrontId: string,
  slideId: string
): Promise<ApiResponse<{ message: string }>> {
  return adminFetch<{ message: string }>(
    `/admin/storefronts/${storefrontId}/hero-slides/${slideId}`,
    {
      method: "DELETE",
    }
  );
}

export async function reorderAdminHeroSlides(
  storefrontId: string,
  slideIds: string[]
): Promise<ApiResponse<{ heroSlides: AdminHeroSlide[] }>> {
  return adminFetch<{ heroSlides: AdminHeroSlide[] }>(
    `/admin/storefronts/${storefrontId}/hero-slides`,
    {
      method: "PATCH",
      body: JSON.stringify({ slideIds }),
    }
  );
}

// ============================================================================
// Settings Helpers
// ============================================================================

export async function getAdminAnnouncementSettings(): Promise<
  ApiResponse<{ announcement: AdminAnnouncementSettings }>
> {
  return adminFetch<{ announcement: AdminAnnouncementSettings }>("/admin/settings/announcement", {
    method: "GET",
  });
}

export async function updateAdminAnnouncementSettings(
  data: Partial<AdminAnnouncementSettings>
): Promise<ApiResponse<{ announcement: AdminAnnouncementSettings }>> {
  return adminFetch<{ announcement: AdminAnnouncementSettings }>("/admin/settings/announcement", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminShippingSettings(): Promise<
  ApiResponse<{ shipping: AdminShippingSettings }>
> {
  return adminFetch<{ shipping: AdminShippingSettings }>("/admin/settings/shipping", {
    method: "GET",
  });
}

export async function updateAdminShippingSettings(data: {
  flatDeliveryCharge: string;
}): Promise<ApiResponse<{ shipping: AdminShippingSettings }>> {
  return adminFetch<{ shipping: AdminShippingSettings }>("/admin/settings/shipping", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminBankTransferSettings(): Promise<
  ApiResponse<{ bankTransfer: AdminBankTransferSettings }>
> {
  return adminFetch<{ bankTransfer: AdminBankTransferSettings }>("/admin/settings/bank-transfer", {
    method: "GET",
  });
}

export async function updateAdminBankTransferSettings(
  data: Partial<AdminBankTransferSettings>
): Promise<ApiResponse<{ bankTransfer: AdminBankTransferSettings }>> {
  return adminFetch<{ bankTransfer: AdminBankTransferSettings }>("/admin/settings/bank-transfer", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminNotificationSettings(): Promise<
  ApiResponse<{ notifications: AdminNotificationSettings }>
> {
  return adminFetch<{ notifications: AdminNotificationSettings }>("/admin/settings/notifications", {
    method: "GET",
  });
}

export async function updateAdminNotificationSettings(
  data: Partial<AdminNotificationSettings>
): Promise<ApiResponse<{ notifications: AdminNotificationSettings }>> {
  return adminFetch<{ notifications: AdminNotificationSettings }>("/admin/settings/notifications", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
