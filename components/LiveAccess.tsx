"use client";
import { ReactNode, useEffect, useState } from "react";
import AccessPanel from "./AccessPanel";

export default function LiveAccess({
  children,
  requireUnlock = false,
}: {
  children: ReactNode;
  requireUnlock?: boolean;
}) {
  const [ready, setReady] = useState(!requireUnlock);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(!requireUnlock);
  const [error, setError] = useState("");
  useEffect(() => {
    const lock = () => setLocked(true);
    const failed = (event: Event) =>
      setError((event as CustomEvent<string>).detail);
    window.addEventListener("access-required", lock);
    window.addEventListener("generation-error", failed);
    if (requireUnlock)
      fetch("/api/access", { cache: "no-store" })
        .then((res) => res.json())
        .then((body) => {
          setLocked(!body.authenticated);
          setStarted(body.authenticated);
          setReady(true);
        })
        .catch(() => {
          setLocked(true);
          setReady(true);
        });
    return () => {
      window.removeEventListener("access-required", lock);
      window.removeEventListener("generation-error", failed);
    };
  }, [requireUnlock]);
  if (!ready)
    return (
      <p role="status" className="p-8 text-gray-600">
        Checking access...
      </p>
    );
  return (
    <>
      {started && <div inert={locked}>{children}</div>}
      {locked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unlock live generation"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-gray-100/95 p-4"
        >
          <AccessPanel
            onUnlocked={() => {
              setLocked(false);
              setStarted(true);
              setError("Access restored. Choose your next action to continue.");
            }}
          />
        </div>
      )}
      {error && !locked && (
        <div
          role="alert"
          className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-white p-4 text-gray-900 shadow-lg"
        >
          <p>{error}</p>
          <button
            className="shrink-0 text-emerald-700 underline"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
