import { clamp } from "../../shared/utils.js";
import { MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL } from "./constants.js";

/**
 * Create a notice object for display
 */
export function createNotice(type, message) {
  if (!message) {
    return null;
  }
  return { type, message };
}

/**
 * Filter images based on filter value and search query
 */
export function filterImages(images, filterValue, query) {
  const normalizedQuery = query.trim().toLowerCase();
  return images.filter((item) => {
    if (filterValue === "pending" && item.hasLabelFile) {
      return false;
    }
    if (filterValue === "done" && !item.hasLabelFile) {
      return false;
    }
    if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return true;
  });
}

/**
 * Deep clone boxes array
 */
export function cloneBoxes(boxes = []) {
  return boxes.map((box) => ({ ...box }));
}

/**
 * Check if two box arrays are equal
 */
export function boxesEqual(leftBoxes, rightBoxes) {
  if (leftBoxes.length !== rightBoxes.length) {
    return false;
  }

  return leftBoxes.every((leftBox, index) => {
    const rightBox = rightBoxes[index];
    return (
      leftBox.id === rightBox.id &&
      leftBox.classId === rightBox.classId &&
      leftBox.x === rightBox.x &&
      leftBox.y === rightBox.y &&
      leftBox.width === rightBox.width &&
      leftBox.height === rightBox.height
    );
  });
}

/**
 * Calculate fit zoom level so frame stays fully visible in the viewport
 */
export function getFitZoomLevel(naturalSize, stageSize) {
  if (!naturalSize.width || !naturalSize.height) {
    return 1;
  }

  const viewportWidth = Math.max(0, Number(stageSize?.width) || 0);
  const viewportHeight = Math.max(0, Number(stageSize?.height) || 0);
  if (!viewportWidth || !viewportHeight) {
    return 1;
  }

  const widthScale = viewportWidth / naturalSize.width;
  const heightScale = viewportHeight / naturalSize.height;
  const fitScale = Math.min(widthScale, heightScale);
  return Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
}

/**
 * Calculate display metrics for image with zoom level
 */
export function getDisplayMetricsForZoom(naturalSize, stageSize, zoomLevel) {
  if (!naturalSize.width || !naturalSize.height) {
    return {
      fitScale: 1,
      displayScale: 0,
      width: 0,
      height: 0,
    };
  }

  const fitScale = getFitZoomLevel(naturalSize, stageSize);
  const requestedScale = Number.isFinite(Number(zoomLevel)) ? Number(zoomLevel) : fitScale;
  const displayScale = clamp(requestedScale, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

  return {
    fitScale,
    displayScale,
    width: Math.max(1, Math.round(naturalSize.width * displayScale)),
    height: Math.max(1, Math.round(naturalSize.height * displayScale)),
  };
}

/**
 * Calculate stage layout metrics
 */
export function getStageLayoutMetrics(displayMetrics, stageSize) {
  const viewportWidth = Math.max(0, Math.round(stageSize.width || 0));
  const viewportHeight = Math.max(0, Math.round(stageSize.height || 0));
  const frameWidth = Math.max(0, Math.round(displayMetrics.width || 0));
  const frameHeight = Math.max(0, Math.round(displayMetrics.height || 0));

  return {
    contentWidth: Math.max(viewportWidth, frameWidth),
    contentHeight: Math.max(viewportHeight, frameHeight),
    frameOffsetX: frameWidth && frameWidth < viewportWidth ? Math.round((viewportWidth - frameWidth) / 2) : 0,
    frameOffsetY:
      frameHeight && frameHeight < viewportHeight ? Math.round((viewportHeight - frameHeight) / 2) : 0,
  };
}
