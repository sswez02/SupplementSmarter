let nextColorIndex = 0;
const lastColorForEl = new WeakMap();

/*
 * Returns the next color from the given palette, avoiding giving the same color
 * twice in a row to the same element
 *
 * So if palette is ['red', 'green', 'blue'] and nextColorIndex starts at 0, calls would pick:
 *  idx = 0 : 'red'
 *  idx = 1 : 'green'
 *  idx = 2 : 'blue'
 *  idx = 0 : 'red'
 */

export function claimNextColor(
  forElement: Element | null | undefined,
  palette: string[] | null | undefined
): string | null {
  if (!forElement || !Array.isArray(palette) || palette.length === 0) return null;

  const idx = nextColorIndex % palette.length;
  nextColorIndex = (nextColorIndex + 1) % palette.length;

  // Avoid repeating the same color for this element
  const last = lastColorForEl.get(forElement);
  let chosenIdx = idx;

  if (palette.length > 1 && last === palette[idx]) {
    chosenIdx = nextColorIndex;
    nextColorIndex = (nextColorIndex + 1) % palette.length;
  }

  const chosen = palette[chosenIdx];
  lastColorForEl.set(forElement, chosen);
  return chosen;
}
