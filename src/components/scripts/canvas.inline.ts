// @ts-nocheck

function initCanvas() {
  const containers = document.querySelectorAll(".canvas-container");
  if (containers.length === 0) return;

  for (const container of containers) {
    if (container.dataset.initialized === "true") continue;
    container.dataset.initialized = "true";

    const viewport = container.querySelector(".canvas-viewport");
    if (!viewport) continue;

    const enableInteraction = container.dataset.enableInteraction !== "false";
    if (!enableInteraction) continue;

    const minZoom = parseFloat(container.dataset.minZoom) || 0.1;
    const maxZoom = parseFloat(container.dataset.maxZoom) || 5;
    let zoom = parseFloat(container.dataset.initialZoom) || 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    function applyTransform() {
      viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function centerViewport() {
      const containerRect = container.getBoundingClientRect();
      const vw = parseFloat(viewport.style.width) || 1000;
      const vh = parseFloat(viewport.style.height) || 1000;

      const scaleX = containerRect.width / vw;
      const scaleY = containerRect.height / vh;
      zoom = Math.min(scaleX, scaleY, 1) * 0.9;
      zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

      panX = (containerRect.width - vw * zoom) / 2;
      panY = (containerRect.height - vh * zoom) / 2;
      applyTransform();
    }

    centerViewport();

    const cleanupFns = [];

    function onWheel(e) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevZoom = zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta));

      panX = mouseX - (mouseX - panX) * (zoom / prevZoom);
      panY = mouseY - (mouseY - panY) * (zoom / prevZoom);
      applyTransform();
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    }

    function onPointerUp() {
      isPanning = false;
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);

    cleanupFns.push(() => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
    });

    if (typeof window !== "undefined" && window.addCleanup) {
      window.addCleanup(() => {
        for (const fn of cleanupFns) fn();
        container.dataset.initialized = "false";
      });
    }
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("nav", () => {
    initCanvas();
  });
}
