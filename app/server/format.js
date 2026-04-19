/**
 * Fungsi formatting: shell quoting, file size, timestamp.
 */

export function shellQuote(part) {
  const value = String(part ?? "");
  if (!value) {
    return "''";
  }
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\\\\''`)}'`;
}

export function shellJoin(parts) {
  return parts.map((part) => shellQuote(part)).join(" ");
}

export function fileSizeLabel(sizeBytes) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function toLocalIso(timestampMs) {
  if (!timestampMs) {
    return null;
  }

  const value = new Date(timestampMs);
  const pad = (input) => String(input).padStart(2, "0");
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`,
  ].join("T");
}
