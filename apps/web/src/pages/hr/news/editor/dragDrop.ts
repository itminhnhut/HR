/** A block's place on screen (top and bottom, in the same coordinates as the pointer). */
export interface BlockBox {
  top: number;
  bottom: number;
}

export interface DropPlace {
  /** Index of the block the dragged one goes next to. */
  index: number;
  /** Before that block (pointer in its top half or above it), else after it. */
  before: boolean;
}

/**
 * Where a block dragged with the ⋮⋮ handle lands for a pointer at `y`: next to the block under the pointer,
 * before it when the pointer is in its top half (or in the gap above it), after it otherwise; below the last
 * block, after it. Lexical's plugin compares page and window coordinates and almost always drops after.
 */
export function dropPlace(boxes: readonly BlockBox[], y: number): DropPlace | null {
  if (boxes.length === 0) return null;
  const index = boxes.findIndex((box) => y < box.bottom);
  const box = boxes[index];
  if (index === -1 || !box) return { index: boxes.length - 1, before: false };
  return { index, before: y < (box.top + box.bottom) / 2 };
}
