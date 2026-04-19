/**
 * Form utility functions shared across pages
 */

export function fieldValueToString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

export function noticeTone(type) {
  if (type === "error") {
    return "error";
  }
  if (type === "success") {
    return "success";
  }
  if (type === "warning") {
    return "warning";
  }
  return "info";
}

export function formatMetric(value, { digits = 3, percent = false } = {}) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (percent) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return Number(value).toFixed(digits);
}

export const PREVIEW_DEBOUNCE_MS = 220;
