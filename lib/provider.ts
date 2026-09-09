import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const MODEL = "claude-sonnet-4-6";
export function createProvider() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("GENERATION_UNAVAILABLE");
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 240_000,
    maxRetries: 0,
  });
}
export function generationError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof TypeError)
    return NextResponse.json(
      {
        error:
          "Invalid input or model response. Review your input and try again.",
      },
      { status: 400 },
    );
  if (error instanceof Error && error.message === "GENERATION_UNAVAILABLE")
    return NextResponse.json(
      {
        error:
          "Live generation is temporarily unavailable. Your work is saved; the prepared example is still available.",
      },
      { status: 503 },
    );
  const timeout = error instanceof Anthropic.APIConnectionTimeoutError;
  return NextResponse.json(
    {
      error: timeout
        ? "Generation timed out. Your work is safe. Retry manually when ready."
        : "Generation could not be completed. Your work is safe. Please try again.",
    },
    { status: timeout ? 504 : 502 },
  );
}
