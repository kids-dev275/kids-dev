/**
 * @kids-wear/shared
 * Shared TypeScript primitives, types, and constants.
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthStatus {
  status: "ok";
}

// ============================================================================
// Shared Constants
// ============================================================================

export const API_V1_PREFIX = "/api/v1" as const;

export const STOREFRONTS = {
  MINI_SPROUTS: "mini-sprouts",
  TEEN_STUDIO: "teen-studio",
  AURA_STUDIO: "aura-studio",
} as const;

export type StorefrontId = (typeof STOREFRONTS)[keyof typeof STOREFRONTS];

// ============================================================================
// Checkout Types & Constants
// ============================================================================

export const PAYMENT_METHODS = {
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;

export type PaymentMethodType = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export interface CheckoutCustomerInput {
  fullName: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  orderNotes: string | null;
}

export interface CheckoutBankTransferConfig {
  available: boolean;
  bankName: string | null;
  accountTitle: string | null;
  accountOrIban: string | null;
  branchCode?: string | null;
  branchLocation?: string | null;
  instructions?: string | null;
}

export interface CheckoutConfigPaymentMethods {
  cashOnDelivery: {
    available: boolean;
  };
  bankTransfer: CheckoutBankTransferConfig;
}

export interface CheckoutConfigData {
  paymentMethods: CheckoutConfigPaymentMethods;
}

export interface CheckoutValidationItem {
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

export interface CheckoutValidationResponseData {
  customer: CheckoutCustomerInput;
  paymentMethod: PaymentMethodType;
  items: CheckoutValidationItem[];
  subtotal: string;
  deliveryCharge: string;
  total: string;
}

export interface OrderCreateResponseData {
  orderNumber: string;
  paymentMethod: PaymentMethodType;
}

// ============================================================================
// Order Status Constants & Customer Account Types
// ============================================================================

export const ORDER_STATUSES = {
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  ORDER_RECEIVED: "ORDER_RECEIVED",
  CONFIRMED: "CONFIRMED",
  IN_PRODUCTION: "IN_PRODUCTION",
  READY_TO_SHIP: "READY_TO_SHIP",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatusType = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_LABELS: Record<OrderStatusType, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  ORDER_RECEIVED: "Order Received",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "Stitching / In Production",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export interface CustomerProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface CustomerOrderListItem {
  orderNumber: string;
  status: OrderStatusType;
  statusLabel: string;
  paymentMethod: PaymentMethodType;
  createdAt: string;
  subtotal: string;
  deliveryCharge: string;
  grandTotal: string;
  itemCount: number;
  firstItemThumbnail: string | null;
}

export interface CustomerOrdersResponseData {
  orders: CustomerOrderListItem[];
  pagination: {
    page: number;
    limit: number;
    totalOrders: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CustomerOrderItemSnapshot {
  productName: string;
  productSlug: string | null;
  storefrontSlug: string | null;
  sizeLabel: string;
  colorName: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  thumbnailUrl: string | null;
}

export interface CustomerOrderStatusTimelineEntry {
  status: OrderStatusType;
  statusLabel: string;
  changedAt: string;
}

export interface CustomerOrderDetailData {
  orderNumber: string;
  createdAt: string;
  status: OrderStatusType;
  statusLabel: string;
  paymentMethod: PaymentMethodType;
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    address: string;
    city: string;
    province: string;
    postalCode: string | null;
    orderNotes: string | null;
  };
  items: CustomerOrderItemSnapshot[];
  timeline: CustomerOrderStatusTimelineEntry[];
  subtotal: string;
  deliveryCharge: string;
  grandTotal: string;
}

// ============================================================================
// Admin Order Management Types
// ============================================================================

export interface AdminOrderListItem {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  phone: string;
  email: string | null;
  status: OrderStatusType;
  statusLabel: string;
  paymentMethod: PaymentMethodType;
  itemCount: number;
  grandTotal: string;
  firstItemThumbnail: string | null;
}

export interface AdminOrdersResponseData {
  orders: AdminOrderListItem[];
  pagination: {
    page: number;
    limit: number;
    totalOrders: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminOrderItemSnapshot {
  productName: string;
  productSku: string;
  productSlug: string | null;
  storefrontSlug: string | null;
  sizeLabel: string;
  colorName: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  thumbnailUrl: string | null;
}

export interface AdminOrderStatusHistoryEntry {
  id: string;
  status: OrderStatusType;
  statusLabel: string;
  changedAt: string;
  changedByAdminId: string | null;
  changedByAdminEmail: string | null;
}

export interface AdminOrderDetailData {
  orderNumber: string;
  createdAt: string;
  status: OrderStatusType;
  statusLabel: string;
  paymentMethod: PaymentMethodType;
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    address: string;
    city: string;
    province: string;
    postalCode: string | null;
    orderNotes: string | null;
  };
  items: AdminOrderItemSnapshot[];
  statusHistory: AdminOrderStatusHistoryEntry[];
  subtotal: string;
  deliveryCharge: string;
  grandTotal: string;
}

export interface AdminOrderStatusUpdateResponseData {
  orderNumber: string;
  status: OrderStatusType;
  statusLabel: string;
  updated: boolean;
}

// ============================================================================
// Review Types & Contracts (Work Unit 18)
// ============================================================================

export type ReviewStatusType = "PENDING" | "APPROVED" | "HIDDEN";

export const REVIEW_STATUS_LABELS: Record<ReviewStatusType, string> = {
  PENDING: "Pending Moderation",
  APPROVED: "Approved",
  HIDDEN: "Hidden",
};

export interface PublicReviewImage {
  url: string;
  altText?: string | null;
}

export interface PublicReviewItem {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  createdAt: string;
  images: PublicReviewImage[];
  product: {
    id: string;
    name: string;
    slug: string;
    storefrontSlug: string;
  };
}

export interface PublicReviewsResponseData {
  reviews: PublicReviewItem[];
  pagination: {
    page: number;
    limit: number;
    totalReviews: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateReviewImageInput {
  publicId: string;
}

export interface CreateReviewPayload {
  name: string;
  productId: string;
  rating: number;
  reviewText: string;
  reviewSubmissionId?: string | null;
  images?: CreateReviewImageInput[];
}

export interface CreateReviewResponseData {
  submitted: true;
  message: string;
}

export interface ReviewMediaSignResponseData {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  resourceType: "image";
  folder: string;
  publicId: string;
}

export interface AdminReviewListItem {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  status: ReviewStatusType;
  statusLabel: string;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    storefrontSlug: string;
  };
}

export interface AdminReviewsResponseData {
  reviews: AdminReviewListItem[];
  pagination: {
    page: number;
    limit: number;
    totalReviews: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminReviewDetailData {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  status: ReviewStatusType;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    storefrontSlug: string;
  };
  images: Array<{
    id: string;
    mediaAssetId: string;
    secureUrl: string;
    providerPublicId: string;
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number | null;
    sortOrder: number;
  }>;
}

export interface AdminReviewStatusUpdateResponseData {
  updated: boolean;
  status: ReviewStatusType;
  statusLabel: string;
}

// ============================================================================
// Admin Dashboard Types (Work Unit 19)
// ============================================================================

export interface AdminDashboardRecentOrder {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  status: OrderStatusType;
  statusLabel: string;
  paymentMethod: PaymentMethodType;
  grandTotal: string;
}

export interface AdminDashboardData {
  totalProducts: number;
  totalOrders: number;
  activeOrders: number;
  unavailableVariants: number;
  recentOrders: AdminDashboardRecentOrder[];
}

// ============================================================================
// Media Optimization Helpers (Work Unit 23)
// ============================================================================

export interface MediaTransformOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "scale" | "thumb";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
}

/**
 * Generates an optimized Cloudinary delivery URL with automatic format and compression.
 * Non-Cloudinary URLs (e.g. local assets or external demo URLs) are safely returned unchanged.
 */
export function getOptimizedMediaUrl(
  url: string | null | undefined,
  options: MediaTransformOptions = {}
): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  const uploadIndex = url.indexOf("/image/upload/");
  if (uploadIndex === -1) return url;

  const prefix = url.slice(0, uploadIndex + "/image/upload/".length);
  const rest = url.slice(uploadIndex + "/image/upload/".length);

  // If already transformed with f_auto or w_, avoid duplicate nesting
  if (rest.startsWith("f_auto") || rest.startsWith("w_")) {
    return url;
  }

  const parts: string[] = ["f_auto", "q_auto"];

  if (options.width) {
    parts.push(`w_${options.width}`);
  }
  if (options.height) {
    parts.push(`h_${options.height}`);
  }
  if (options.crop) {
    parts.push(`c_${options.crop}`);
  }

  const transformString = parts.join(",");
  return `${prefix}${transformString}/${rest}`;
}
