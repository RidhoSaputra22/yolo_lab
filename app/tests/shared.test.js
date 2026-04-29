import { afterEach, describe, expect, test } from "bun:test";
import {
  clamp,
  fileSizeLabel,
  groupArtifactsByFolder,
  inferArtifactDescriptor,
  joinClasses,
  normalizePath,
  relativeFolderPath,
} from "../src/shared/utils.js";
import { fetchJson } from "../src/shared/api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("shared UI utilities", () => {
  test("joins class names, clamps numbers, formats sizes, and normalizes folder paths", () => {
    expect(joinClasses("btn", false, "btn-primary", null)).toBe("btn btn-primary");
    expect(clamp(20, 0, 10)).toBe(10);
    expect(fileSizeLabel(1024 * 1024)).toBe("1.0 MB");
    expect(normalizePath("train\\\\frames//camera/")).toBe("train/frames/camera");
    expect(relativeFolderPath("test/output", "test/output/run-a")).toBe("run-a");
    expect(relativeFolderPath("test/output", "other/output/run-a")).toBe("other/output/run-a");
  });

  test("infers and groups runner artifacts by folder and run key", () => {
    expect(inferArtifactDescriptor("lobby_tracking.mp4")).toEqual({ kind: "video", runKey: "lobby" });
    expect(inferArtifactDescriptor("lobby_summary.json")).toEqual({ kind: "summary", runKey: "lobby" });

    const grouped = groupArtifactsByFolder(
      [
        {
          name: "lobby_tracking.mp4",
          parent: "test/output/day-1",
          sizeBytes: 1024,
          modifiedAt: "2026-04-01T10:00:00",
        },
        {
          name: "lobby_summary.json",
          parent: "test/output/day-1",
          sizeBytes: 100,
          modifiedAt: "2026-04-01T10:01:00",
        },
        {
          name: "door_predictions.csv",
          parent: "test/output",
          sizeBytes: 2048,
          modifiedAt: "2026-04-02T08:00:00",
        },
      ],
      "test/output",
    );

    expect(grouped[0]).toMatchObject({
      key: ".",
      label: "Folder utama",
      fileCount: 1,
      runCount: 1,
      totalSizeLabel: "2.0 KB",
    });
    expect(grouped[1]).toMatchObject({
      key: "day-1",
      fileCount: 2,
      runCount: 1,
    });
    expect(grouped[1].runs[0]).toMatchObject({
      key: "lobby",
      video: expect.objectContaining({ name: "lobby_tracking.mp4" }),
      summary: expect.objectContaining({ name: "lobby_summary.json" }),
    });
  });
});

describe("fetchJson helper", () => {
  test("adds JSON content type for non-FormData requests and returns parsed payload", async () => {
    let captured = null;
    globalThis.fetch = async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await expect(fetchJson("/api/example", { method: "POST", body: JSON.stringify({ a: 1 }) }))
      .resolves.toEqual({ ok: true });
    expect(captured.url).toBe("/api/example");
    expect(captured.options.headers.get("Content-Type")).toBe("application/json");
  });

  test("keeps FormData content type unset and throws server error messages", async () => {
    let captured = null;
    globalThis.fetch = async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ saved: true }), { status: 200 });
    };

    const formData = new FormData();
    formData.set("name", "video");
    await expect(fetchJson("/api/upload", { method: "POST", body: formData }))
      .resolves.toEqual({ saved: true });
    expect(captured.options.headers.has("Content-Type")).toBe(false);

    globalThis.fetch = async () => new Response(JSON.stringify({ error: "Gagal" }), { status: 400 });
    await expect(fetchJson("/api/error")).rejects.toThrow("Gagal");
  });
});
