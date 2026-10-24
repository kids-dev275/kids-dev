export type CartViewState = "loading" | "empty" | "error" | "validated";

export function getCartViewState(
  isHydrated: boolean,
  itemCount: number,
  isValidating: boolean,
  hasValidationData: boolean,
  validationError: boolean
): CartViewState {
  if (!isHydrated) return "loading";
  if (itemCount === 0) return "empty";
  if (validationError && !hasValidationData) return "error";
  if (isValidating && !hasValidationData) return "loading";
  return hasValidationData ? "validated" : "error";
}
