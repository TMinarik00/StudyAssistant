import type { ImportPayloadRequestSourceTypeHint } from "../api/generated/model";

function getSuggestedTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, "");
}

async function readPdfFile(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  GlobalWorkerOptions.workerSrc = workerModule.default;

  const buffer = await file.arrayBuffer();
  const document = await getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pageTexts.push(`[[PAGE:${pageNumber}]]\n${pageText}`);
    }
  }

  const extractedText = pageTexts.join("\n\n").trim();
  const hasExtractableText = Boolean(extractedText);

  return {
    payloadText: extractedText,
    pdfFileData: hasExtractableText
      ? undefined
      : `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`,
    pageCount: document.numPages,
    hasExtractableText,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function readImportFile(file: File): Promise<{
  payloadText: string;
  sourceTypeHint: ImportPayloadRequestSourceTypeHint;
  suggestedTitle: string;
  originalFileName: string;
  pdfFileData?: string;
  documentPageCount?: number;
  documentByteSize: number;
  hasExtractableText: boolean;
}> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt")) {
    return {
      payloadText: await file.text(),
      sourceTypeHint: "SCRIPT",
      suggestedTitle: getSuggestedTitle(file),
      originalFileName: file.name,
      documentByteSize: file.size,
      hasExtractableText: true,
    };
  }

  if (lowerName.endsWith(".pdf")) {
    const pdf = await readPdfFile(file);

    return {
      payloadText: pdf.payloadText,
      sourceTypeHint: "PDF",
      suggestedTitle: getSuggestedTitle(file),
      originalFileName: file.name,
      pdfFileData: pdf.pdfFileData,
      documentPageCount: pdf.pageCount,
      documentByteSize: file.size,
      hasExtractableText: pdf.hasExtractableText,
    };
  }

  throw new Error("Trenutno su podrzani samo TXT i PDF dokumenti.");
}
