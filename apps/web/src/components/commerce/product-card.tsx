import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getOptimizedMediaUrl } from "@kids-wear/shared";
import { Badge } from "../ui/badge";
import { Price } from "./price";

export interface ProductCardMediaItem {
  url: string;
  altText?: string | null;
}

export interface ProductCardProps {
  id?: string;
  name: string;
  slug: string;
  regularPrice: string;
  compareAtPrice?: string | null;
  isNewArrival?: boolean;
  mainImage: ProductCardMediaItem;
  hoverImage?: ProductCardMediaItem | null;
  storefrontSlug?: string;
  href?: string;
  className?: string;
}

/**
 * Presentational ProductCard component adhering strictly to the V1 editorial design.
 * Features 4:5 aspect ratio, mobile-safe main image display, optional desktop hover
 * image replacement, and strict adherence to made-to-order V1 scope.
 */
export function ProductCard({
  name,
  slug,
  regularPrice,
  compareAtPrice,
  isNewArrival = false,
  mainImage,
  hoverImage,
  storefrontSlug,
  href,
  className = "",
}: ProductCardProps) {
  // Resolve link: custom href takes precedence, otherwise storefront-scoped PDP link
  const productHref =
    href || (storefrontSlug ? `/${storefrontSlug}/products/${slug}` : `/products/${slug}`);

  const mainAlt = mainImage.altText || name;
  const hoverAlt = hoverImage?.altText || `${name} - alternate view`;

  return (
    <article
      className={`group relative flex flex-col bg-surface overflow-hidden rounded-md transition-colors ${className}`.trim()}
    >
      {/* 4:5 Aspect Ratio Image Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-soft">
        {/* Main Image */}
        <Image
          src={getOptimizedMediaUrl(mainImage.url, { width: 600, height: 750, crop: "fill" })}
          alt={mainAlt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-all duration-300 group-hover:scale-[1.02]"
        />

        {/* Optional Desktop Hover Image */}
        {hoverImage?.url && (
          <Image
            src={getOptimizedMediaUrl(hoverImage.url, { width: 600, height: 750, crop: "fill" })}
            alt={hoverAlt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="hidden md:block object-cover object-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
            aria-hidden="true"
          />
        )}

        {/* New Badge */}
        {isNewArrival && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <Badge variant="new" size="sm">
              New
            </Badge>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex flex-1 flex-col pt-3 pb-2 px-1">
        <h3 className="font-serif text-base font-normal text-text-primary tracking-normal line-clamp-1 group-hover:text-accent-storefront transition-colors">
          <Link
            href={productHref}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 rounded"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-1">
          <Price price={regularPrice} compareAtPrice={compareAtPrice} size="sm" />
        </div>
      </div>
    </article>
  );
}
