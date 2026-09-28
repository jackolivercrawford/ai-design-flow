# Protosynthetic

A prototype that turns an ambiguous design brief into structured requirements and interface concepts through a branching interview.

- **Prepared public sample:** https://protosynthetic.vercel.app/demo
- **Case study:** https://www.jackolivercrawford.com/projects/protosynthetic

## What it does

You start with a brief. Protosynthetic asks questions about it, and each answer opens the next questions in a tree, so the requirements grow out of the brief rather than a fixed form. The prototype explored breadth-first and depth-first questioning, suggested answers, version comparison and live previews, and it generates interface concepts from the finished requirements.

The public sample is prepared content: a finished interview with its requirements, prototype versions and code. It is not a live generation. Live generation sits behind an access code.

## How it was built

Designed and built by Jack Crawford in three weeks in February 2025, with revisions in October 2025. The prepared public sample was added in September 2026. It is a prototype, not a commercial product.

## Stack

- Next.js 15 (App Router), React 19 and TypeScript
- Anthropic's Claude API for the questions, answer suggestions, requirements and generated interfaces
- Tailwind CSS and DaisyUI for the generated previews

## Project layout

- `app/create`, `app/qna` and `app/preview`: the interview, from brief to questions to previews
- `app/demo`: the prepared public sample, built from `lib/demo`
- `app/api`: server routes that generate questions, update and simplify requirements, process uploaded reference files and generate mockups, plus the access check
- `lib/provider.ts` and `lib/access.ts`: the model client and the access gate
- `tests/`: unit tests and Playwright browser tests

## Running it locally

```bash
npm install
npm run dev   # http://localhost:5000
```

The prepared sample at `/demo` works without any keys. Live generation needs two values in `.env.local`:

- `ANTHROPIC_API_KEY`
- `PROTOSYNTHETIC_ACCESS_CODE`: the access code, at least 32 characters

Other scripts: `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:browser`.
