export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_CHARACTERS = 100_000;
export function fileError(file: Pick<File, "name" | "size" | "type">) {
  if (file.size > MAX_FILE_BYTES) return "Files must be 4 MB or smaller.";
  if (
    !/\.(pdf|txt)$/i.test(file.name) ||
    (file.type &&
      !["application/pdf", "text/plain", "application/octet-stream"].includes(
        file.type,
      ))
  )
    return "Upload a PDF or TXT file.";
  if (!file.size) return "The file is empty.";
  return null;
}
export function textError(text: string) {
  if (!text.trim())
    return "The document has no readable text. For scanned PDFs, paste the text instead.";
  if (text.length > MAX_TEXT_CHARACTERS)
    return "Keep document text under 100,000 characters.";
  return null;
}
