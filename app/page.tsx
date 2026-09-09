import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-16 text-gray-900">
      <div className="w-full max-w-3xl">
        <p className="mb-10 text-xl font-bold tracking-tight text-emerald-700">
          Protosynthetic
        </p>
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          From questions to a working idea
        </p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Make the thinking behind a prototype visible.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
          Follow one idea from a design prompt through questions, clear
          requirements, and two interactive prototype versions.
        </p>
        <div className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="rounded-xl bg-emerald-700 px-6 py-4 font-medium text-white hover:bg-emerald-800"
          >
            Explore an example
          </Link>
          <Link
            href="/create"
            className="rounded-xl border border-gray-300 bg-white px-6 py-4 font-medium hover:border-emerald-600"
          >
            Create your own
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          The prepared example is open to everyone. Live AI generation requires
          an access code.
        </p>
        <div className="mt-14 grid gap-6 border-t border-gray-200 pt-8 sm:grid-cols-3">
          {[
            [
              "01",
              "Ask better questions",
              "Explore the choices that shape an interface.",
            ],
            [
              "02",
              "Connect the requirements",
              "See how each answer becomes a design decision.",
            ],
            [
              "03",
              "Try the prototype",
              "Compare versions and take the code with you.",
            ],
          ].map(([number, title, detail]) => (
            <div key={number}>
              <p className="text-sm font-medium text-emerald-700">{number}</p>
              <h2 className="mt-2 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {detail}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/qna"
          className="mt-8 inline-block text-sm text-emerald-700 underline"
        >
          Continue previous session
        </Link>
      </div>
    </main>
  );
}
