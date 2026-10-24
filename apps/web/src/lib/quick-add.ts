import type { ApiProductCard, ApiProductOption } from "@/lib/api";
import type { CartState, AddItemResult } from "@/lib/cart-store";

type QuickAddOptions = NonNullable<ApiProductCard["quickAdd"]>;
type QuickAddProduct = Pick<ApiProductCard, "id" | "name" | "slug" | "regularPrice" | "quickAdd"> & {
  mainImage: { url: string };
};

export function availableQuickAddColors(options?: QuickAddOptions): ApiProductOption[] {
  if (!options) return [];
  const availableColorIds = new Set(options.variants.map((variant) => variant.productColorId));
  return options.colors.filter((color) => availableColorIds.has(color.id));
}

export function quickAddSizesForColor(options: QuickAddOptions, colorId: string) {
  const availableSizeIds = new Set(
    options.variants
      .filter((variant) => variant.productColorId === colorId)
      .map((variant) => variant.productSizeId)
  );
  return options.sizes.map((size) => ({ ...size, isAvailable: availableSizeIds.has(size.id) }));
}

export function resolveQuickAddVariant(
  options: QuickAddOptions | undefined,
  colorId: string | null,
  sizeId: string | null
) {
  if (!options || !colorId || !sizeId) return null;
  const color = availableQuickAddColors(options).find((option) => option.id === colorId);
  const size = options.sizes.find((option) => option.id === sizeId);
  const variant = options.variants.find(
    (option) => option.productColorId === colorId && option.productSizeId === sizeId
  );
  if (!color || !size || !variant) return null;
  return { variant, color, size };
}

export function retainQuickAddSize(
  options: QuickAddOptions | undefined,
  nextColorId: string,
  currentSizeId: string | null
): string | null {
  return resolveQuickAddVariant(options, nextColorId, currentSizeId) ? currentSizeId : null;
}

export function addProductCardVariant(
  product: QuickAddProduct,
  storefrontSlug: string,
  colorId: string | null,
  sizeId: string | null,
  addItem: CartState["addItem"]
): AddItemResult | null {
  const resolved = resolveQuickAddVariant(product.quickAdd, colorId, sizeId);
  if (!resolved) return null;
  return addItem({
    productId: product.id,
    variantId: resolved.variant.id,
    quantity: 1,
    cachedProduct: {
      name: product.name,
      slug: product.slug,
      storefrontSlug,
      mainImageUrl: product.mainImage.url,
      sizeName: resolved.size.name,
      colorName: resolved.color.name,
      unitPrice: product.regularPrice,
    },
  });
}
