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

    let defaultZoom = zoom;
    let defaultPanX = panX;
    let defaultPanY = panY;

    const resetBtn = container.querySelector(".canvas-reset-view");

    function updateResetButton() {
      if (!resetBtn) return;
      const changed =
        Math.abs(zoom - defaultZoom) > 0.001 ||
        Math.abs(panX - defaultPanX) > 1 ||
        Math.abs(panY - defaultPanY) > 1;
      resetBtn.style.display = changed ? "flex" : "none";
    }

    const cleanupFns = [];

    if (enableInteraction) {
      function onWheel(e) {
        // If the wheel target is inside a scrollable text node, let it scroll naturally
        const scrollable = e.target.closest(".canvas-node-content");
        if (scrollable) {
          const canScroll = scrollable.scrollHeight > scrollable.clientHeight;
          if (canScroll) {
            const atTop = scrollable.scrollTop <= 0;
            const atBottom =
              scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;
            // Only let it through to zoom if at boundary AND scrolling past it
            if (!(atTop && scrollingUp) && !(atBottom && scrollingDown)) {
              return; // Let the browser scroll the text node
            }
          }
        }

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
        updateResetButton();
      }

      function onPointerDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest("a") || e.target.closest("button")) return;

        // Don't start panning when clicking on a scrollbar
        const scrollable = e.target.closest(".canvas-node-content");
        if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
          const rect = scrollable.getBoundingClientRect();
          if (e.clientX >= rect.right - 16) return;
        }

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
        updateResetButton();
      }

      function onPointerUp() {
        isPanning = false;
      }

      container.addEventListener("wheel", onWheel, { passive: false });
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);

      let lastTouchDist = 0;
      let lastTouchMidX = 0;
      let lastTouchMidY = 0;
      let isTouchZooming = false;

      function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      function onTouchStart(e) {
        if (e.touches.length === 2) {
          e.preventDefault();
          isTouchZooming = true;
          isPanning = false;
          lastTouchDist = getTouchDistance(e.touches);
          lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
      }

      function onTouchMove(e) {
        if (e.touches.length === 2 && isTouchZooming) {
          e.preventDefault();
          const dist = getTouchDistance(e.touches);
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          const rect = container.getBoundingClientRect();
          const cx = midX - rect.left;
          const cy = midY - rect.top;

          const scale = dist / lastTouchDist;
          const prevZoom = zoom;
          zoom = Math.max(minZoom, Math.min(maxZoom, zoom * scale));

          panX = cx - (cx - panX) * (zoom / prevZoom);
          panY = cy - (cy - panY) * (zoom / prevZoom);

          panX += midX - lastTouchMidX;
          panY += midY - lastTouchMidY;

          lastTouchDist = dist;
          lastTouchMidX = midX;
          lastTouchMidY = midY;
          applyTransform();
          updateResetButton();
        }
      }

      function onTouchEnd(e) {
        if (e.touches.length < 2) {
          isTouchZooming = false;
        }
      }

      container.addEventListener("touchstart", onTouchStart, { passive: false });
      container.addEventListener("touchmove", onTouchMove, { passive: false });
      container.addEventListener("touchend", onTouchEnd);

      cleanupFns.push(() => {
        container.removeEventListener("wheel", onWheel);
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("touchstart", onTouchStart);
        container.removeEventListener("touchmove", onTouchMove);
        container.removeEventListener("touchend", onTouchEnd);
      });
    }

    const fullscreenToggle = container.querySelector(".canvas-fullscreen-toggle");
    if (fullscreenToggle) {
      function toggleFullscreen() {
        container.classList.toggle("canvas-fullscreen");
        centerViewport();
        defaultZoom = zoom;
        defaultPanX = panX;
        defaultPanY = panY;
        updateResetButton();
      }

      function onEscape(e) {
        if (e.key === "Escape" && container.classList.contains("canvas-fullscreen")) {
          container.classList.remove("canvas-fullscreen");
          centerViewport();
          defaultZoom = zoom;
          defaultPanX = panX;
          defaultPanY = panY;
          updateResetButton();
        }
      }

      fullscreenToggle.addEventListener("click", toggleFullscreen);
      document.addEventListener("keydown", onEscape);

      cleanupFns.push(() => {
        fullscreenToggle.removeEventListener("click", toggleFullscreen);
        document.removeEventListener("keydown", onEscape);
      });
    }

    const zoomInBtn = container.querySelector(".canvas-zoom-in");
    const zoomOutBtn = container.querySelector(".canvas-zoom-out");

    function zoomAtCenter(factor) {
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const prevZoom = zoom;
      zoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
      panX = cx - (cx - panX) * (zoom / prevZoom);
      panY = cy - (cy - panY) * (zoom / prevZoom);
      applyTransform();
      updateResetButton();
    }

    if (zoomInBtn) {
      function onZoomIn() {
        zoomAtCenter(1.25);
      }
      zoomInBtn.addEventListener("click", onZoomIn);
      cleanupFns.push(() => zoomInBtn.removeEventListener("click", onZoomIn));
    }

    if (zoomOutBtn) {
      function onZoomOut() {
        zoomAtCenter(0.8);
      }
      zoomOutBtn.addEventListener("click", onZoomOut);
      cleanupFns.push(() => zoomOutBtn.removeEventListener("click", onZoomOut));
    }

    if (resetBtn) {
      function onReset() {
        centerViewport();
        defaultZoom = zoom;
        defaultPanX = panX;
        defaultPanY = panY;
        updateResetButton();
      }
      resetBtn.addEventListener("click", onReset);
      cleanupFns.push(() => resetBtn.removeEventListener("click", onReset));
    }

    // Handle iframe load errors (CSP/X-Frame-Options blocks)
    const iframes = container.querySelectorAll(".canvas-iframe-wrapper iframe");
    for (const iframe of iframes) {
      iframe.addEventListener("error", () => {
        const fallback = iframe.parentElement?.querySelector(".canvas-iframe-fallback");
        if (fallback) {
          iframe.style.display = "none";
          fallback.style.display = "flex";
        }
      });
    }

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
