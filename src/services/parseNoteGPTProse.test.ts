import { describe, expect, it } from "vitest";
import { parseNoteGPTProse, parseNoteGPTText, reflowOcrLines } from "./parseNoteGPTProse";

const STEAMED_RICE_PORK_OCR = `Steamed Rice Powder
Pork. For 4509 of pork
belly, slice it into 2mm
thick pieces. Prepare
1/2 cu of rice and 1/2
cup of [glutinous rice,
grinding half into a
fine powder and half
into a coarse powder
(add star anise, a
small piece of |
cinnamon, and bay
leaf). Add 1 tsp of
Sichuan peppercorns,
2 tsp of sesame oil, a
pinch of salt, 69ml of
water, and marinate
for one night.`;

describe("reflowOcrLines", () => {
  it("joins broken OCR lines and fixes common misreads", () => {
    const reflowed = reflowOcrLines(STEAMED_RICE_PORK_OCR);

    expect(reflowed).toContain("Steamed Rice Powder Pork.");
    expect(reflowed).toContain("450g of pork belly");
    expect(reflowed).toContain("1/2 cup of rice");
    expect(reflowed).not.toContain("4509");
    expect(reflowed).not.toContain("1/2 cu");
  });
});

describe("parseNoteGPTProse", () => {
  it("extracts title, ingredients, and steps from prose NoteGPT OCR", () => {
    const parsed = parseNoteGPTProse(STEAMED_RICE_PORK_OCR);

    expect(parsed.title).toBe("Steamed Rice Powder Pork");
    expect(parsed.ingredients.length).toBeGreaterThanOrEqual(6);
    expect(parsed.ingredients.some((i) => /pork belly/i.test(i.text))).toBe(true);
    expect(parsed.ingredients.some((i) => /rice/i.test(i.text))).toBe(true);
    expect(parsed.ingredients.some((i) => /Sichuan peppercorns/i.test(i.text))).toBe(true);
    expect(parsed.steps.length).toBeGreaterThanOrEqual(2);
    expect(parsed.steps.some((s) => /slice/i.test(s))).toBe(true);
    expect(parsed.steps.some((s) => /marinate/i.test(s))).toBe(true);
  });

  it("does not treat every OCR line as a separate ingredient", () => {
    const parsed = parseNoteGPTProse(STEAMED_RICE_PORK_OCR);
    expect(parsed.ingredients.length).toBeLessThan(10);
  });
});

describe("parseNoteGPTText", () => {
  it("routes prose OCR to prose parser", () => {
    const parsed = parseNoteGPTText(STEAMED_RICE_PORK_OCR);
    expect(parsed.title).toBe("Steamed Rice Powder Pork");
  });
});
