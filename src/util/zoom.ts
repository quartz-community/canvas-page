/**
 * The zoom a canvas opens at (and returns to on "reset view"): the zoom that fits the whole
 * canvas into its container (at most 1:1, shown at 90% for a margin), times `initialZoom`,
 * within `[minZoom, maxZoom]`. So `initialZoom: 1` (the default) shows the whole canvas, `2`
 * opens twice as close.
 */
export function initialViewZoom(
  containerWidth: number,
  containerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  initialZoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  const fit = Math.min(containerWidth / canvasWidth, containerHeight / canvasHeight, 1) * 0.9;
  return Math.max(minZoom, Math.min(maxZoom, fit * initialZoom));
}
