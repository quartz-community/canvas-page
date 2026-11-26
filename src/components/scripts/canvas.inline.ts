function initCanvas() {
  const containers = document.querySelectorAll(".canvas-container") as NodeListOf<HTMLElement>;
  if (containers.length === 0) return;

  for (const container of Array.from(containers)) {
    if (container.dataset.initialized === "true") continue;
    container.dataset.initialized = "true";

    const viewport = container.querySelector(".canvas-viewport") as HTMLElement | null;
    if (!viewport) continue;

    const enableInteraction = container.dataset.enableInteraction !== "false";

    const minZoom = parseFloat(container.dataset.minZoom ?? "") || 0.1;
    const maxZoom = parseFloat(container.dataset.maxZoom ?? "") || 5;
    let zoom = parseFloat(container.dataset.initialZoom ?? "") || 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const applyTransform = () => {
      viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    };

    const centerViewport = () => {
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
    };

    centerViewport();

    let defaultZoom = zoom;
    let defaultPanX = panX;
    let defaultPanY = panY;

    const resetBtn = container.querySelector(".canvas-reset-view") as HTMLButtonElement | null;

    const updateResetButton = () => {
      if (!resetBtn) return;
      const changed =
        Math.abs(zoom - defaultZoom) > 0.001 ||
        Math.abs(panX - defaultPanX) > 1 ||
        Math.abs(panY - defaultPanY) > 1;
      resetBtn.style.display = changed ? "flex" : "none";
    };

    const cleanupFns: Array<() => void> = [];

    if (enableInteraction) {
      const zoomAt = (clientX: number, clientY: number, factor: number) => {
        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const prevZoom = zoom;
        zoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
        panX = x - (x - panX) * (zoom / prevZoom);
        panY = y - (y - panY) * (zoom / prevZoom);
        applyTransform();
        updateResetButton();
      };

      // Like Obsidian (and Figma): the wheel / two-finger scroll pans, Ctrl/Cmd + wheel and a
      // trackpad pinch (which browsers send as a wheel event with ctrlKey) zoom.
      // `wheelBehavior: "zoom"` keeps the old behaviour: the plain wheel zooms too.
      const wheelZooms = container.dataset.wheelBehavior === "zoom";

      const onWheel = (e: WheelEvent) => {
        const zoomGesture = e.ctrlKey || e.metaKey || wheelZooms;
        // Line/page deltas (Firefox with a mouse wheel) to pixels
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? container.clientHeight : 1;
        let dx = e.deltaX * unit;
        let dy = e.deltaY * unit;
        // Shift + mouse wheel scrolls sideways (some platforms already swap the axes)
        if (e.shiftKey && dx === 0) {
          dx = dy;
          dy = 0;
        }

        // A wheel over a scrollable text node scrolls the node until it hits its edge
        const scrollable =
          !e.ctrlKey && !e.metaKey && e.target instanceof HTMLElement
            ? e.target.closest(".canvas-node-content")
            : null;
        if (scrollable && scrollable.scrollHeight > scrollable.clientHeight && dy !== 0) {
          const atTop = scrollable.scrollTop <= 0;
          const atBottom =
            scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
          if (!(atTop && dy < 0) && !(atBottom && dy > 0)) {
            return; // Let the browser scroll the text node
          }
        }

        e.preventDefault();
        if (zoomGesture) {
          // Pinches send many small deltas, mouse wheels few large ones (capped at a 10% step)
          const step = Math.min(Math.abs(dy || dx), 10) / 100;
          const sign = Math.sign(dy || dx);
          zoomAt(e.clientX, e.clientY, Math.exp(-sign * step));
        } else {
          panX -= dx;
          panY -= dy;
          applyTransform();
          updateResetButton();
        }
      };

      // Safari sends trackpad pinches as gesture events instead of ctrl + wheel
      let gestureStartZoom = 1;
      const onGestureStart = (e: Event) => {
        e.preventDefault();
        gestureStartZoom = zoom;
      };
      const onGestureChange = (e: Event) => {
        const ge = e as Event & { scale?: number; clientX?: number; clientY?: number };
        if (typeof ge.scale !== "number") return;
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cx = ge.clientX ?? rect.left + rect.width / 2;
        const cy = ge.clientY ?? rect.top + rect.height / 2;
        zoomAt(cx, cy, (gestureStartZoom * ge.scale) / zoom);
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        if (e.target instanceof HTMLElement) {
          if (e.target.closest("a") || e.target.closest("button")) return;
        }

        // Don't start panning when clicking on a scrollbar
        if (e.target instanceof HTMLElement) {
          const scrollable = e.target.closest(".canvas-node-content");
          if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
            const rect = scrollable.getBoundingClientRect();
            if (e.clientX >= rect.right - 16) return;
          }
        }

        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        container.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
        updateResetButton();
      };

      const onPointerUp = () => {
        isPanning = false;
      };

      container.addEventListener("wheel", onWheel, { passive: false });
      container.addEventListener("gesturestart", onGestureStart);
      container.addEventListener("gesturechange", onGestureChange);
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);

      let lastTouchDist = 0;
      let lastTouchMidX = 0;
      let lastTouchMidY = 0;
      let isTouchZooming = false;

      const getTouchDistance = (touches: TouchList) => {
        if (touches.length < 2 || !touches[0] || !touches[1]) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      };

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const first = e.touches[0];
          const second = e.touches[1];
          if (!first || !second) return;
          e.preventDefault();
          isTouchZooming = true;
          isPanning = false;
          lastTouchDist = getTouchDistance(e.touches);
          lastTouchMidX = (first.clientX + second.clientX) / 2;
          lastTouchMidY = (first.clientY + second.clientY) / 2;
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && isTouchZooming) {
          const first = e.touches[0];
          const second = e.touches[1];
          if (!first || !second) return;
          e.preventDefault();
          const dist = getTouchDistance(e.touches);
          const midX = (first.clientX + second.clientX) / 2;
          const midY = (first.clientY + second.clientY) / 2;

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
      };

      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
          isTouchZooming = false;
        }
      };

      container.addEventListener("touchstart", onTouchStart, { passive: false });
      container.addEventListener("touchmove", onTouchMove, { passive: false });
      container.addEventListener("touchend", onTouchEnd);

      cleanupFns.push(() => {
        container.removeEventListener("wheel", onWheel);
        container.removeEventListener("gesturestart", onGestureStart);
        container.removeEventListener("gesturechange", onGestureChange);
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("touchstart", onTouchStart);
        container.removeEventListener("touchmove", onTouchMove);
        container.removeEventListener("touchend", onTouchEnd);
      });
    }

    const frame = container.closest('.page[data-frame="canvas"]') as HTMLElement | null;
    const sidebarToggle = frame?.querySelector(
      ".canvas-sidebar-toggle",
    ) as HTMLButtonElement | null;
    if (frame && sidebarToggle) {
      const toggleSidebar = () => {
        const oldRect = container.getBoundingClientRect();
        frame.classList.toggle("canvas-sidebar-open");

        requestAnimationFrame(() => {
          const newRect = container.getBoundingClientRect();
          const shiftX = newRect.left - oldRect.left;
          panX += shiftX;
          defaultPanX += shiftX;
          applyTransform();
          updateResetButton();
        });
      };

      sidebarToggle.addEventListener("click", toggleSidebar);

      cleanupFns.push(() => {
        sidebarToggle.removeEventListener("click", toggleSidebar);
      });
    }

    const zoomInBtn = container.querySelector(".canvas-zoom-in") as HTMLButtonElement | null;
    const zoomOutBtn = container.querySelector(".canvas-zoom-out") as HTMLButtonElement | null;

    const zoomAtCenter = (factor: number) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const prevZoom = zoom;
      zoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
      panX = cx - (cx - panX) * (zoom / prevZoom);
      panY = cy - (cy - panY) * (zoom / prevZoom);
      applyTransform();
      updateResetButton();
    };

    if (zoomInBtn) {
      const onZoomIn = () => {
        zoomAtCenter(1.25);
      };
      zoomInBtn.addEventListener("click", onZoomIn);
      cleanupFns.push(() => zoomInBtn.removeEventListener("click", onZoomIn));
    }

    if (zoomOutBtn) {
      const onZoomOut = () => {
        zoomAtCenter(0.8);
      };
      zoomOutBtn.addEventListener("click", onZoomOut);
      cleanupFns.push(() => zoomOutBtn.removeEventListener("click", onZoomOut));
    }

    if (resetBtn) {
      const onReset = () => {
        centerViewport();
        defaultZoom = zoom;
        defaultPanX = panX;
        defaultPanY = panY;
        updateResetButton();
      };
      resetBtn.addEventListener("click", onReset);
      cleanupFns.push(() => resetBtn.removeEventListener("click", onReset));
    }

    // Fullscreen toggle for embedded canvases
    const fullscreenBtn = container.querySelector(
      ".canvas-fullscreen-toggle",
    ) as HTMLButtonElement | null;
    if (fullscreenBtn) {
      const enterIcon = fullscreenBtn.querySelector(
        ".canvas-fullscreen-enter",
      ) as HTMLElement | null;
      const exitIcon = fullscreenBtn.querySelector(".canvas-fullscreen-exit") as HTMLElement | null;

      const updateFullscreenIcons = () => {
        const isFs = document.fullscreenElement === container;
        if (enterIcon) enterIcon.style.display = isFs ? "none" : "";
        if (exitIcon) exitIcon.style.display = isFs ? "" : "none";
      };

      const onFullscreenToggle = () => {
        if (document.fullscreenElement === container) {
          document.exitFullscreen();
        } else {
          container.requestFullscreen();
        }
      };

      const onFullscreenChange = () => {
        updateFullscreenIcons();
        // Re-center after entering/exiting fullscreen
        requestAnimationFrame(() => {
          centerViewport();
          defaultZoom = zoom;
          defaultPanX = panX;
          defaultPanY = panY;
          updateResetButton();
        });
      };

      fullscreenBtn.addEventListener("click", onFullscreenToggle);
      document.addEventListener("fullscreenchange", onFullscreenChange);
      cleanupFns.push(() => {
        fullscreenBtn.removeEventListener("click", onFullscreenToggle);
        document.removeEventListener("fullscreenchange", onFullscreenChange);
      });
    }

    // Handle iframe load errors (CSP/X-Frame-Options blocks)
    const iframes = container.querySelectorAll(
      ".canvas-iframe-wrapper iframe",
    ) as NodeListOf<HTMLIFrameElement>;
    for (const iframe of Array.from(iframes)) {
      iframe.addEventListener("error", () => {
        const fallback = iframe.parentElement?.querySelector(
          ".canvas-iframe-fallback",
        ) as HTMLElement | null;
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
  const handleCanvasInit = () => {
    initCanvas();
  };
  document.addEventListener("nav", handleCanvasInit);
  document.addEventListener("render", handleCanvasInit);
}
