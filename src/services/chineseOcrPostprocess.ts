/** Fix common Tesseract artifacts in Chinese recipe OCR output. */

const CJK = "[\\u4e00-\\u9fff\\u3400-\\u4dbf]";

/** Remove spurious spaces inserted between Chinese characters. */
export function normalizeChineseOcrText(text: string): string {
  let result = text.normalize("NFKC");

  // Join spaces between CJK characters (repeat for chains)
  const cjkSpace = new RegExp(`(${CJK})\\s+(${CJK})`, "g");
  let prev = "";
  while (result !== prev) {
    prev = result;
    result = result.replace(cjkSpace, "$1$2");
  }

  // Normalize full-width punctuation
  result = result
    .replace(/[，]/g, "，")
    .replace(/[。]/g, "。")
    .replace(/[：]/g, "：")
    .replace(/[；]/g, "；");

  // Trim trailing spaces on each line
  result = result
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

  return result.trim();
}

export function countCjkChars(text: string): number {
  const matches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return matches?.length ?? 0;
}

export function looksLikeFailedChineseOcr(text: string): boolean {
  const cjk = countCjkChars(text);
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  // Mostly garbage Latin with almost no Chinese
  return text.length > 20 && cjk < 3 && latin > cjk * 4;
}
