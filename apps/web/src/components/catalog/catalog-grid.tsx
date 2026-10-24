import React from "react";
import { ProductCard } from "@/components/commerce/product-card";
import { StorefrontSlug } from "@/components/theme/storefront-tokens";
import type { ApiProductCard } from "@/lib/api";

export interface CatalogGridProps {
  products: ApiProductCard[];
  storefront: StorefrontSlug;
  className?: string;
}

export function CatalogGrid({ products, storefront, className = "" }: CatalogGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 ${className}`.trim()}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          slug={product.slug}
          regularPrice={product.regularPrice}
          compareAtPrice={product.compareAtPrice}
          isNewArrival={product.isNewArrival}
          mainImage={product.mainImage}
          hoverImage={product.hoverImage}
          storefrontSlug={storefront}
          quickAdd={product.quickAdd}
        />
      ))}
    </div>
  );
}
