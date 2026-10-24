import { cookies } from "next/headers";
import {
  STOREFRONT_COOKIE,
  isValidStorefrontSlug,
  type StorefrontSlug,
} from "@/components/theme/storefront-tokens";

// Shared pages previously used Mini Sprouts when no storefront had been selected.
export const DEFAULT_STOREFRONT: StorefrontSlug = "mini-sprouts";

export function resolveStorefrontPreference(value: string | undefined): StorefrontSlug {
  return value && isValidStorefrontSlug(value) ? value : DEFAULT_STOREFRONT;
}

export async function getActiveStorefront(): Promise<StorefrontSlug> {
  const cookieStore = await cookies();
  return resolveStorefrontPreference(cookieStore.get(STOREFRONT_COOKIE)?.value);
}
