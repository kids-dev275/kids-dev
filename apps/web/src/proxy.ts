import { NextResponse, type NextRequest } from "next/server";
import { STOREFRONT_COOKIE, isValidStorefrontSlug } from "@/components/theme/storefront-tokens";

export function proxy(request: NextRequest) {
  // Link prefetches must not change the active storefront before a visit.
  if (
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return NextResponse.next();
  }

  const slug = request.nextUrl.pathname.split("/")[1];
  const response = NextResponse.next();
  if (isValidStorefrontSlug(slug)) {
    response.cookies.set(STOREFRONT_COOKIE, slug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/mini-sprouts/:path*", "/teen-studio/:path*", "/aura-studio/:path*"],
};
