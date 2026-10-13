/**
 * Noam AI window box. Hard maximum: 1/16 of the viewport area.
 * The 25% × 25% box meets that maximum exactly.
 * A wider floor is used only when 25% of the width is too narrow to read,
 * and the height shrinks so the area stays within the maximum.
 */
export function companionPanelSize(viewportWidth, viewportHeight) {
  const vw = Math.max(1, Math.floor(Number(viewportWidth) || 1));
  const vh = Math.max(1, Math.floor(Number(viewportHeight) || 1));
  const maxArea = (vw * vh) / 16;
  let width = Math.floor(vw * 0.25);
  let height = Math.floor(vh * 0.25);
  const readableWidth = 168;
  if (width < readableWidth) {
    const widthCap = Math.max(1, Math.floor(maxArea / 96));
    width = Math.min(readableWidth, widthCap);
    height = Math.floor(maxArea / width);
  }
  if (width * height > maxArea) {
    height = Math.floor(maxArea / Math.max(1, width));
  }
  width = Math.max(1, Math.min(width, vw));
  height = Math.max(1, Math.min(height, vh));
  if (width * height > maxArea) {
    height = Math.max(1, Math.floor(maxArea / width));
  }
  return {
    width,
    height,
    maxArea,
    area: width * height,
    anchor: "right",
  };
}
