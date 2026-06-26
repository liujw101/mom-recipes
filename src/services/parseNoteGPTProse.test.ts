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

function findIngredient(
  parsed: ReturnType<typeof parseNoteGPTProse>,
  re: RegExp
) {
  return parsed.ingredients.find((i) => re.test(i.text));
}

describe("reflowOcrLines", () => {
  it("joins broken OCR lines and fixes common misreads", () => {
    const reflowed = reflowOcrLines(STEAMED_RICE_PORK_OCR);

    expect(reflowed).toContain("Steamed Rice Powder Pork.");
    expect(reflowed).toContain("450g of pork belly");
    expect(reflowed).toContain("1/2 cup of rice");
    expect(reflowed).toContain("of cinnamon");
    expect(reflowed).not.toContain("4509");
    expect(reflowed).not.toContain("1/2 cu ");
    expect(reflowed).not.toContain("[");
    expect(reflowed).not.toContain("|");
  });
});

describe("parseNoteGPTProse", () => {
  const parsed = parseNoteGPTProse(STEAMED_RICE_PORK_OCR);

  it("extracts the dish name as title", () => {
    expect(parsed.title).toBe("Steamed Rice Powder Pork");
  });

  it("splits rice and glutinous rice into separate ingredients", () => {
    const texts = parsed.ingredients.map((i) => i.text.toLowerCase());
    expect(texts).toContain("rice");
    expect(texts).toContain("glutinous rice");
  });

  it("captures amounts for measured ingredients", () => {
    expect(findIngredient(parsed, /pork belly/i)?.amount).toBe("450g");
    expect(findIngredient(parsed, /^rice$/i)?.amount).toBe("1/2 cup");
    expect(findIngredient(parsed, /Sichuan peppercorns/i)?.amount).toBe("1 tsp");
    expect(findIngredient(parsed, /sesame oil/i)?.amount).toBe("2 tsp");
    expect(findIngredient(parsed, /water/i)?.amount).toBe("69ml");
    expect(findIngredient(parsed, /salt/i)?.amount).toBe("a pinch of");
  });

  it("extracts parenthetical spices cleanly without OCR artifacts", () => {
    const cinnamon = findIngredient(parsed, /cinnamon/i);
    expect(cinnamon?.text).toBe("cinnamon");
    expect(findIngredient(parsed, /star anise/i)).toBeTruthy();
    expect(findIngredient(parsed, /bay leaf/i)).toBeTruthy();
  });

  it("returns a sensible ingredient count, not one row per OCR line", () => {
    expect(parsed.ingredients.length).toBeGreaterThanOrEqual(8);
    expect(parsed.ingredients.length).toBeLessThanOrEqual(11);
  });

  it("orders ingredients by appearance in the recipe", () => {
    const texts = parsed.ingredients.map((i) => i.text.toLowerCase());
    expect(texts.indexOf("pork belly")).toBeLessThan(texts.indexOf("rice"));
    expect(texts.indexOf("rice")).toBeLessThan(texts.indexOf("glutinous rice"));
  });

  it("splits the body into ordered cooking steps", () => {
    expect(parsed.steps.length).toBeGreaterThanOrEqual(2);
    expect(parsed.steps.some((s) => /slice/i.test(s))).toBe(true);
    expect(parsed.steps.some((s) => /marinate/i.test(s))).toBe(true);
  });
});

describe("parseNoteGPTText", () => {
  it("routes prose OCR to prose parser", () => {
    const parsed = parseNoteGPTText(STEAMED_RICE_PORK_OCR);
    expect(parsed.title).toBe("Steamed Rice Powder Pork");
  });
});
