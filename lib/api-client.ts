let accessBlocked = false;
export function resumeAccess() {
  accessBlocked = false;
}
export async function apiFetch(url: string, init: RequestInit) {
  if (accessBlocked) {
    window.dispatchEvent(new Event("access-required"));
    throw new Error("ACCESS_REQUIRED");
  }
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    const message =
      "Could not connect. Your work is safe. Check your connection and retry manually.";
    window.dispatchEvent(
      new CustomEvent("generation-error", { detail: message }),
    );
    throw new Error(message);
  }
  if (response.status === 401) {
    accessBlocked = true;
    window.dispatchEvent(new Event("access-required"));
    throw new Error("ACCESS_REQUIRED");
  }
  if (!response.ok) {
    const body = await response
      .clone()
      .json()
      .catch(() => null);
    const message =
      body?.error || "The request failed. Your work is safe. Please try again.";
    window.dispatchEvent(
      new CustomEvent("generation-error", { detail: message }),
    );
    throw new Error(message);
  }
  return response;
}
