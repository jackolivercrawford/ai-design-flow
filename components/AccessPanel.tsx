"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { resumeAccess } from "@/lib/api-client";

export default function AccessPanel({
  onUnlocked,
}: {
  onUnlocked: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCode("");
      resumeAccess();
      onUnlocked();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not unlock. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-emerald-700">Live generation</p>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        Create your own
      </h1>
      <p className="mt-3 text-gray-600">
        Enter your access code to use AI generation. Your saved work stays on
        this browser. Unlocking does not retry a previous request.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label
          className="block text-sm font-medium text-gray-800"
          htmlFor="access-code"
        >
          Access code
        </label>
        <input
          id="access-code"
          type="password"
          autoFocus
          autoComplete="off"
          maxLength={256}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:outline-emerald-600"
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Checking access..." : "Unlock live generation"}
        </button>
      </form>
      <Link
        href="/demo"
        className="mt-5 inline-block text-sm text-emerald-700 underline"
      >
        Explore the prepared example
      </Link>
    </section>
  );
}
