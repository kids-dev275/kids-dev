export type AdminRequestErrorCode = "REQUEST_ABORTED" | "TIMEOUT" | "NETWORK_ERROR" | "UNKNOWN_ERROR";

export function classifyAdminRequestError(error: unknown): { code: AdminRequestErrorCode; message: string } {
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "REQUEST_ABORTED", message: "Request cancelled." };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "The Admin service took too long to respond. Please try again." };
  }
  if (error instanceof TypeError) {
    return { code: "NETWORK_ERROR", message: "Could not connect to the Admin service. Please check your connection and try again." };
  }
  return { code: "UNKNOWN_ERROR", message: "The Admin request could not be completed. Please try again." };
}
