import { useRef, useCallback } from "react";
import { clamp } from "../../shared/utils.js";
import {
  getDisplayMetricsForZoom,
  getStageLayoutMetrics,
} from "./utils.js";
import { MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL, ZOOM_WHEEL_FACTOR } from "./constants.js";

/**
 * Custom hook for canvas geometry and interaction calculations
 * Handles scaling, point conversion, and interactive element detection
 */
export function useCanvasGeometry() {
  const overlayRef = useRef(null);

  /**
   * Get canvas scale factors for converting client coordinates to image coordinates
   */
  const getScale = useCallback((displayMetrics, naturalSize) => {
    const canvas = overlayRef.current;
    const rect = canvas?.getBoundingClientRect();
    const renderedWidth = rect?.width || displayMetrics.width || 0;
    const renderedHeight = rect?.height || displayMetrics.height || 0;

    if (!naturalSize.width || !naturalSize.height || !renderedWidth || !renderedHeight) {
      return { x: 1, y: 1 };
    }
    return {
      x: renderedWidth / naturalSize.width,
      y: renderedHeight / naturalSize.height,
    };
  }, []);

  /**
   * Convert mouse event to image coordinate
   */
  const toImagePointFromEvent = useCallback(
    (event, displayMetrics, naturalSize) => {
      const canvas = overlayRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }
      const rect = canvas.getBoundingClientRect();
      const scale = getScale(displayMetrics, naturalSize);
      return {
        x: clamp((event.clientX - rect.left) / scale.x, 0, naturalSize.width),
        y: clamp((event.clientY - rect.top) / scale.y, 0, naturalSize.height),
      };
    },
    [getScale],
  );

  /**
   * Check if a point is inside a box
   */
  const isPointInsideBox = useCallback((point, box) => {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }, []);

  /**
   * Get handle hit on box corners
   */
  const getHandleHit = useCallback((point, box, scale) => {
    const threshold = 10 / Math.max(scale.x, 0.0001);
    const handles = {
      nw: { x: box.x, y: box.y },
      ne: { x: box.x + box.width, y: box.y },
      sw: { x: box.x, y: box.y + box.height },
      se: { x: box.x + box.width, y: box.y + box.height },
    };

    for (const [name, handle] of Object.entries(handles)) {
      const hit =
        Math.abs(point.x - handle.x) <= threshold && Math.abs(point.y - handle.y) <= threshold;
      if (hit) {
        return name;
      }
    }
    return null;
  }, []);

  /**
   * Find interaction target (box or handle) at point
   */
  const findInteractionTarget = useCallback((point, boxes, scale) => {
    for (const box of [...boxes].reverse()) {
      const handle = getHandleHit(point, box, scale);
      if (handle) {
        return { type: "resize", boxId: box.id, handle };
      }
      if (isPointInsideBox(point, box)) {
        return { type: "move", boxId: box.id };
      }
    }
    return null;
  }, [getHandleHit, isPointInsideBox]);

  /**
   * Get appropriate cursor for point
   */
  const getCursorForPoint = useCallback(
    (point, boxes, scale) => {
      const target = findInteractionTarget(point, boxes, scale);
      if (!target) {
        return "crosshair";
      }
      if (target.type === "move") {
        return "move";
      }
      if (target.handle === "nw" || target.handle === "se") {
        return "nwse-resize";
      }
      return "nesw-resize";
    },
    [findInteractionTarget],
  );

  /**
   * Normalize a rectangle to ensure positive width/height
   */
  const normalizeRect = useCallback((start, end, naturalSize) => {
    const x1 = clamp(Math.min(start.x, end.x), 0, naturalSize.width);
    const y1 = clamp(Math.min(start.y, end.y), 0, naturalSize.height);
    const x2 = clamp(Math.max(start.x, end.x), 0, naturalSize.width);
    const y2 = clamp(Math.max(start.y, end.y), 0, naturalSize.height);
    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
    };
  }, []);

  return {
    overlayRef,
    getScale,
    toImagePointFromEvent,
    isPointInsideBox,
    getHandleHit,
    findInteractionTarget,
    getCursorForPoint,
    normalizeRect,
  };
}

/**
 * Custom hook for zoom interactions
 */
export function useZoomInteraction() {
  const zoomAtViewportPoint = useCallback(
    (stageViewportRef, frameShellRef, naturalSize, stageSize, zoomLevel, getNextZoom) => {
      const viewport = stageViewportRef.current;
      const frameShell = frameShellRef.current;

      if (
        !viewport ||
        !frameShell ||
        !naturalSize.width ||
        !naturalSize.height ||
        !stageSize.width ||
        !stageSize.height
      ) {
        return zoomLevel;
      }

      const rect = viewport.getBoundingClientRect();
      const frameRect = frameShell.getBoundingClientRect();
      if (!frameRect.width || !frameRect.height) {
        return zoomLevel;
      }

      const pointerX = viewport.clientWidth / 2;
      const pointerY = viewport.clientHeight / 2;
      const pointerClientX = rect.left + pointerX;
      const pointerClientY = rect.top + pointerY;
      const currentScaleX = frameRect.width / naturalSize.width;
      const currentScaleY = frameRect.height / naturalSize.height;
      const imagePointX = clamp((pointerClientX - frameRect.left) / currentScaleX, 0, naturalSize.width);
      const imagePointY = clamp((pointerClientY - frameRect.top) / currentScaleY, 0, naturalSize.height);

      const nextZoom = clamp(getNextZoom(zoomLevel), MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

      if (Math.abs(nextZoom - zoomLevel) < 0.0001) {
        return zoomLevel;
      }

      requestAnimationFrame(() => {
        const nextViewport = stageViewportRef.current;
        if (!nextViewport) {
          return;
        }

        const nextDisplayMetrics = getDisplayMetricsForZoom(naturalSize, stageSize, nextZoom);
        const nextStageLayout = getStageLayoutMetrics(nextDisplayMetrics, stageSize);
        const nextScaleX = nextDisplayMetrics.width / naturalSize.width;
        const nextScaleY = nextDisplayMetrics.height / naturalSize.height;
        const maxScrollLeft = Math.max(0, nextStageLayout.contentWidth - nextViewport.clientWidth);
        const maxScrollTop = Math.max(0, nextStageLayout.contentHeight - nextViewport.clientHeight);

        nextViewport.scrollLeft = clamp(
          nextStageLayout.frameOffsetX + imagePointX * nextScaleX - pointerX,
          0,
          maxScrollLeft,
        );
        nextViewport.scrollTop = clamp(
          nextStageLayout.frameOffsetY + imagePointY * nextScaleY - pointerY,
          0,
          maxScrollTop,
        );
      });

      return nextZoom;
    },
    [],
  );

  return {
    zoomAtViewportPoint,
    ZOOM_WHEEL_FACTOR,
    MIN_ZOOM_LEVEL,
    MAX_ZOOM_LEVEL,
  };
}
