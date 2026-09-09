import { useMemo } from "react";
import type { MockupVersion } from "@/types";
import { previewDocument } from "@/lib/preview-document";

export default function LivePreview({
  code,
  colorScheme,
}: {
  code: string;
  colorScheme?: MockupVersion["mockupData"]["colorScheme"];
}) {
  const document = useMemo(
    () => previewDocument(code, colorScheme),
    [code, colorScheme],
  );
  return (
    <iframe
      title="Interactive prototype preview"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={document}
      className="h-full min-h-[540px] w-full border-0 bg-white"
    />
  );
}
