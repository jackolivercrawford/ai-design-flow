"use client";
import { useState } from "react";
import Link from "next/link";
import CanvasTree from "@/components/CanvasTree";
import LivePreview from "@/components/LivePreview";
import {
  samplePrompt,
  sampleTree,
  sampleRequirements,
  sampleVersions,
} from "@/lib/demo";
import { previewDocument } from "@/lib/preview-document";

const tabs = ["Questions", "Requirements", "Prototype", "Code"] as const;
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Demo() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Questions");
  const [versionId, setVersionId] = useState("sample-v2");
  const version = sampleVersions.find((item) => item.id === versionId)!;
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="font-bold text-emerald-700">
            Protosynthetic
          </Link>
          <Link href="/create" className="text-sm text-emerald-700 underline">
            Create your own
          </Link>
        </nav>
        <header className="py-10">
          <p className="text-sm font-medium text-emerald-700">
            Prepared example · Focus room
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A little room to focus
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600">
            A daily planning concept, from the first question to a working
            prototype. This example was prepared for exploration. It is not live
            generation or a recovered historical session.
          </p>
        </header>
        <section className="mb-7 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-emerald-900">
            The design prompt
          </h2>
          <p className="mt-2 max-w-3xl text-emerald-950">{samplePrompt}</p>
        </section>
        <div
          role="tablist"
          aria-label="Explore the example"
          className="flex gap-1 overflow-x-auto border-b border-gray-200"
        >
          {tabs.map((label) => (
            <button
              key={label}
              role="tab"
              id={`tab-${label}`}
              aria-selected={tab === label}
              aria-controls={`panel-${label}`}
              tabIndex={tab === label ? 0 : -1}
              onKeyDown={(event) => {
                const index = tabs.indexOf(label);
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : -1;
                if (next >= 0) {
                  event.preventDefault();
                  setTab(tabs[next]);
                  document.getElementById(`tab-${tabs[next]}`)?.focus();
                }
              }}
              onClick={() => setTab(label)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium ${tab === label ? "border-emerald-700 text-emerald-800" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <section
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="mt-6"
        >
          {tab === "Questions" && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-8">
              <p className="mb-6 text-sm text-gray-500">
                Five answered questions connect the audience, experience, and
                refinements.
              </p>
              <CanvasTree node={sampleTree} />
            </div>
          )}
          {tab === "Requirements" && (
            <>
              <div className="mb-5 flex justify-end">
                <button
                  className="text-sm text-emerald-700 underline"
                  onClick={() =>
                    download(
                      "focus-room-requirements.json",
                      JSON.stringify(sampleRequirements, null, 2),
                      "application/json",
                    )
                  }
                >
                  Download requirements
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.values(sampleRequirements.categories).map(
                  (category) => (
                    <article
                      key={category.title}
                      className="rounded-xl border border-gray-200 bg-white p-6"
                    >
                      <h2 className="font-semibold">{category.title}</h2>
                      {category.requirements.map((requirement) => (
                        <div key={requirement.id}>
                          <p className="mt-3 leading-relaxed text-gray-600">
                            {requirement.text}
                          </p>
                          <p className="mt-3 text-xs text-emerald-700">
                            From answered question:{" "}
                            {requirement.sourceDetails?.questionId}
                          </p>
                        </div>
                      ))}
                    </article>
                  ),
                )}
              </div>
            </>
          )}
          {(tab === "Prototype" || tab === "Code") && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <label className="flex max-w-full flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center">
                  Prototype version
                  <select
                    value={versionId}
                    onChange={(event) => setVersionId(event.target.value)}
                    className="max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  >
                    {sampleVersions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-5 text-sm text-emerald-700">
                  <button
                    className="underline"
                    onClick={() =>
                      download(
                        `focus-room-${version.id}.tsx`,
                        version.mockupData.code,
                        "text/plain",
                      )
                    }
                  >
                    Download code
                  </button>
                  <button
                    className="underline"
                    onClick={() =>
                      download(
                        `focus-room-${version.id}.html`,
                        previewDocument(
                          version.mockupData.code,
                          version.mockupData.colorScheme,
                        ),
                        "text/html",
                      )
                    }
                  >
                    Download HTML
                  </button>
                </div>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                {version.mockupData.features.join(" · ")}. Changes stay in this
                preview. HTML previews use public CDN resources.
              </p>
              {tab === "Prototype" ? (
                <div className="h-[780px] overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <LivePreview key={version.id} {...version.mockupData} />
                </div>
              ) : (
                <pre className="max-h-[780px] overflow-auto rounded-xl bg-gray-900 p-6 text-sm leading-relaxed text-gray-100">
                  <code>{version.mockupData.code}</code>
                </pre>
              )}
            </>
          )}
        </section>
        <p className="py-8 text-sm text-gray-500">
          Sample interactions run in memory. Exploring this example does not
          read or change your saved sessions.
        </p>
      </div>
    </main>
  );
}
