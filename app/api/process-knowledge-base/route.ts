import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { requireAccess } from "@/lib/access";
import { createProvider, MODEL, generationError } from "@/lib/provider";
import { fileError, textError, MAX_FILE_BYTES } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const denied = requireAccess(request);
  if (denied) return denied;
  try {
    // Permit multipart headers while bounding the file itself separately.
    if (
      Number(request.headers.get("content-length")) >
      MAX_FILE_BYTES + 64 * 1024
    )
      return NextResponse.json(
        { error: "Files must be 4 MB or smaller." },
        { status: 413 },
      );
    const form = await request.formData();
    let content: string;
    const file = form.get("file");
    if (form.get("type") === "file" && file instanceof File) {
      const invalid = fileError(file);
      if (invalid)
        return NextResponse.json(
          { error: invalid },
          { status: file.size > MAX_FILE_BYTES ? 413 : 400 },
        );
      const buffer = Buffer.from(await file.arrayBuffer());
      if (/\.pdf$/i.test(file.name)) {
        if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
          return NextResponse.json(
            { error: "This file is not a valid PDF." },
            { status: 400 },
          );
        try {
          content = (await pdfParse(buffer)).text;
        } catch {
          return NextResponse.json(
            {
              error:
                "This PDF could not be read. Try a text PDF or paste its text.",
            },
            { status: 400 },
          );
        }
      } else {
        content = buffer.toString("utf8");
      }
    } else if (
      form.get("type") === "text" &&
      typeof form.get("content") === "string"
    ) {
      content = form.get("content") as string;
    } else {
      return NextResponse.json(
        { error: "Upload a PDF or TXT file, or paste text." },
        { status: 400 },
      );
    }
    const invalid = textError(content);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const completion = await createProvider().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system:
        "Extract requirements, technical specifications, design guidelines, user preferences and industry standards. Return only a JSON object with arrays named requirements, technicalSpecifications, designGuidelines, userPreferences, industryStandards.",
      messages: [{ role: "user", content }],
    });
    const result = completion.content[0];
    if (result?.type !== "text") throw new Error("No document response");
    return NextResponse.json({
      success: true,
      processedContent: JSON.parse(result.text),
    });
  } catch (error) {
    return generationError(error);
  }
}
