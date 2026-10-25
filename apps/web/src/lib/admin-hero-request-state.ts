import {
  createAdminHeroSlide,
  updateAdminHeroSlide,
  type AdminHeroSlide,
} from "./admin-api";

type HeroSlidePayload = Parameters<typeof createAdminHeroSlide>[1];

export function saveHeroSlideOnce(
  storefrontId: string,
  editingSlideId: string | null,
  payload: HeroSlidePayload,
  api = { create: createAdminHeroSlide, update: updateAdminHeroSlide }
) {
  return editingSlideId
    ? api.update(storefrontId, editingSlideId, payload)
    : api.create(storefrontId, payload);
}

export function isAbortedAdminRequest(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "AbortError") return true;
  return "code" in error && error.code === "REQUEST_ABORTED";
}

export function upsertHeroSlide(
  current: AdminHeroSlide[],
  saved: AdminHeroSlide
): AdminHeroSlide[] {
  const existingIndex = current.findIndex((slide) => slide.id === saved.id);
  if (existingIndex === -1) return [...current, saved];
  return current.map((slide, index) => index === existingIndex ? saved : slide);
}
