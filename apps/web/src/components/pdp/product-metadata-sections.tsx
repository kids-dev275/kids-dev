import React from "react";
import type { ApiProductDetail } from "@/lib/api";

export interface ProductMetadataSectionsProps {
  product: ApiProductDetail;
  className?: string;
}

export function ProductMetadataSections({ product, className = "" }: ProductMetadataSectionsProps) {
  // Collect details items that have actual content
  const detailItems: Array<{ label: string; value: string }> = [];

  if (product.productType) detailItems.push({ label: "Product Type", value: product.productType });
  if (product.gender) detailItems.push({ label: "Gender", value: product.gender });
  if (product.includedPieces)
    detailItems.push({ label: "Included Pieces", value: product.includedPieces });
  if (product.fit) detailItems.push({ label: "Fit", value: product.fit });
  if (product.patternDesign)
    detailItems.push({ label: "Pattern / Design", value: product.patternDesign });
  if (product.occasion) detailItems.push({ label: "Occasion", value: product.occasion });
  if (product.season) detailItems.push({ label: "Season", value: product.season });

  const hasDetails = detailItems.length > 0;
  const hasMaterialCare = Boolean(product.fabric || product.careInstructions);

  if (!product.description && !hasDetails && !hasMaterialCare) {
    return null;
  }

  return (
    <div className={`space-y-8 pt-8 border-t border-border ${className}`.trim()}>
      {/* Product Description */}
      {product.description && (
        <section aria-labelledby="product-description-heading" className="space-y-3">
          <h2
            id="product-description-heading"
            className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight"
          >
            Description
          </h2>
          <div className="font-sans text-sm text-text-base/85 leading-relaxed space-y-2 whitespace-pre-line">
            {product.description}
          </div>
        </section>
      )}

      {/* Garment Details */}
      {hasDetails && (
        <section aria-labelledby="product-details-heading" className="space-y-3">
          <h2
            id="product-details-heading"
            className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight"
          >
            Product Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs font-sans">
            {detailItems.map((item) => (
              <div
                key={item.label}
                className="flex justify-between py-1.5 border-b border-border/50"
              >
                <dt className="text-text-muted">{item.label}</dt>
                <dd className="font-medium text-ink text-right">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Material & Care */}
      {hasMaterialCare && (
        <section aria-labelledby="material-care-heading" className="space-y-3">
          <h2
            id="material-care-heading"
            className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight"
          >
            Material & Care
          </h2>
          <dl className="space-y-2 text-xs font-sans">
            {product.fabric && (
              <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-border/50 gap-1">
                <dt className="text-text-muted">Fabric / Material</dt>
                <dd className="font-medium text-ink">{product.fabric}</dd>
              </div>
            )}
            {product.careInstructions && (
              <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-border/50 gap-1">
                <dt className="text-text-muted">Care Instructions</dt>
                <dd className="font-medium text-ink">{product.careInstructions}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
