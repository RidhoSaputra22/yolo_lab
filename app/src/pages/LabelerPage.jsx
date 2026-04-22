/**
 * LabelerPage - Main YOLO image labeling tool
 *
 * Manages:
 * - Frame list and navigation (sidebar component)
 * - Canvas rendering and box drawing (canvas component)
 * - Class and tool selection (tool panel component)
 * - Header with save/checkpoint controls
 * - State management and handlers
 *
 * Folder structure:
 * - LabelerPage/LabelerSidebar.jsx - Frame browser, filters, statistics
 * - LabelerPage/LabelerCanvas.jsx - Image/canvas rendering
 * - LabelerPage/LabelerToolPanel.jsx - Tools, class selection, boxes
 * - LabelerPage/LabelerHeader.jsx - Navigation and current image info
 * - LabelerPage/constants.js - Colors, zoom levels, undo limits
 * - LabelerPage/utils.js - Utility functions for geometry, filtering, boxes
 * - LabelerPage/hooks.js - Custom React hooks for canvas geometry and zoom
 * - LabelerPage/index.js - Barrel exports
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../shared/api.js";
import { mergeJobLog, useJobEventStream } from "../shared/jobStream.js";
import { usePagePreferencesAutosave } from "../shared/pagePreferences.js";
import { useToast } from "../shared/toast.js";
import { clamp } from "../shared/utils.js";
import {
  LabelerSidebar,
  LabelerCanvas,
  LabelerToolPanel,
  LabelerHeader,
  LabelerAutolabelModal,
  LabelerLogs,
  BOX_COLORS,
  MAX_UNDO_STEPS,
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  ZOOM_WHEEL_FACTOR,
  createNotice,
  filterImages,
  cloneBoxes,
  boxesEqual,
  getDisplayMetricsForZoom,
  getStageLayoutMetrics,
} from "./LabelerPage/index.js";

const AUTO_CHECKPOINT_SAVE_AND_NEXT_INTERVAL = 10;

export default function LabelerPage() {
  // State management
  const [classNames, setClassNames] = useState([]);
  const [images, setImages] = useState([]);
  const [frameFolders, setFrameFolders] = useState([]);
  const [activeFramesDir, setActiveFramesDir] = useState("");
  const [currentImageName, setCurrentImageName] = useState(null);
  const [checkpointImageName, setCheckpointImageName] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [hasLabelFile, setHasLabelFile] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [activeClassId, setActiveClassId] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filterValue, setFilterValue] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [undoStack, setUndoStack] = useState([]);
  const [imageSrc, setImageSrc] = useState("");
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [autolabelConfig, setAutolabelConfig] = useState({
    model: "",
    conf: 0.35,
    iou: 0.45,
    imgsz: 960,
    device: "auto",
    suppressNestedDuplicates: true,
    duplicateContainmentThreshold: 0.9,
  });
  const [autolabelSuggestions, setAutolabelSuggestions] = useState([]);
  const [autolabelWarnings, setAutolabelWarnings] = useState([]);
  const [autolabelJob, setAutolabelJob] = useState(null);
  const [isAutolabelModalOpen, setIsAutolabelModalOpen] = useState(false);
  const [autolabelSelectedImages, setAutolabelSelectedImages] = useState([]);
  const [isPreferenceReady, setIsPreferenceReady] = useState(false);

  // Refs for imperative updates and event handling
  const nextBoxIdRef = useRef(1);
  const loadTokenRef = useRef(0);
  const stageViewportRef = useRef(null);
  const frameShellRef = useRef(null);
  const overlayRef = useRef(null);
  const dirtyRef = useRef(dirty);
  const boxesRef = useRef(boxes);
  const selectedBoxIdRef = useRef(selectedBoxId);
  const activeClassIdRef = useRef(activeClassId);
  const interactionRef = useRef(null);
  const currentImageNameRef = useRef(currentImageName);
  const navigationImageNameRef = useRef(currentImageName);
  const checkpointImageNameRef = useRef(checkpointImageName);
  const selectedBoxArrowControlRef = useRef(false);
  const naturalSizeRef = useRef(naturalSize);
  const stageSizeRef = useRef(stageSize);
  const zoomLevelRef = useRef(zoomLevel);
  const undoStackRef = useRef(undoStack);
  const imagesRef = useRef(images);
  const saveAndNextSinceCheckpointRef = useRef(0);
  const draftBoxesRef = useRef(null);
  const overlayFrameRef = useRef(0);
  const preferencesHydratedRef = useRef(false);
  const previousAutolabelRunningRef = useRef(false);
  const { setNotice } = useToast();

  // Sync refs with state
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    selectedBoxIdRef.current = selectedBoxId;
  }, [selectedBoxId]);

  useEffect(() => {
    activeClassIdRef.current = activeClassId;
  }, [activeClassId]);

  useEffect(() => {
    currentImageNameRef.current = currentImageName;
    navigationImageNameRef.current = currentImageName;
  }, [currentImageName]);

  useEffect(() => {
    checkpointImageNameRef.current = checkpointImageName;
  }, [checkpointImageName]);

  useEffect(() => {
    naturalSizeRef.current = naturalSize;
  }, [naturalSize]);

  useEffect(() => {
    stageSizeRef.current = stageSize;
  }, [stageSize]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const availableImageNames = new Set(images.map((item) => item.name));
    setAutolabelSelectedImages((current) => {
      const nextSelection = current.filter((imageName) => availableImageNames.has(imageName));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [images]);

  useEffect(() => {
    setAutolabelSelectedImages([]);
  }, [activeFramesDir]);

  useEffect(() => {
    saveAndNextSinceCheckpointRef.current = 0;
  }, [activeFramesDir]);

  useEffect(() => {
    setZoomLevel((current) => {
      const nextZoom = clamp(current, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      zoomLevelRef.current = nextZoom;
      return nextZoom;
    });
  }, []);

  useEffect(
    () => () => {
      if (overlayFrameRef.current) {
        cancelAnimationFrame(overlayFrameRef.current);
      }
    },
    [],
  );

  const isLabelingLocked = Boolean(autolabelJob?.running);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) return;

    let frameId = 0;
    const measureStage = () => {
      frameId = 0;
      const style = window.getComputedStyle(viewport);
      const paddingX =
        Number.parseFloat(style.paddingLeft || "0") +
        Number.parseFloat(style.paddingRight || "0");
      const paddingY =
        Number.parseFloat(style.paddingTop || "0") +
        Number.parseFloat(style.paddingBottom || "0");

      const nextSize = {
        width: Math.max(0, Math.round(viewport.clientWidth - paddingX)),
        height: Math.max(0, Math.round(viewport.clientHeight - paddingY)),
      };

      setStageSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize,
      );
    };

    const scheduleMeasure = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measureStage);
    };

    scheduleMeasure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;

    observer?.observe(viewport);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [currentImageName]);

  const markDirty = (nextDirty) => {
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
  };

  const syncSelectedBoxId = (
    nextSelectedBoxId,
    { enableArrowBoxControl = nextSelectedBoxId != null ? selectedBoxArrowControlRef.current : false } = {},
  ) => {
    selectedBoxIdRef.current = nextSelectedBoxId;
    selectedBoxArrowControlRef.current = Boolean(
      nextSelectedBoxId != null && enableArrowBoxControl,
    );
    setSelectedBoxId(nextSelectedBoxId);
  };

  const getBoxesWithSelectedOnTop = (
    sourceBoxes,
    selectedId = selectedBoxIdRef.current,
  ) => {
    if (!Array.isArray(sourceBoxes) || sourceBoxes.length <= 1 || selectedId == null) {
      return sourceBoxes || [];
    }

    const selectedIndex = sourceBoxes.findIndex((box) => box.id === selectedId);
    if (selectedIndex < 0 || selectedIndex === sourceBoxes.length - 1) {
      return sourceBoxes;
    }

    return [
      ...sourceBoxes.slice(0, selectedIndex),
      ...sourceBoxes.slice(selectedIndex + 1),
      sourceBoxes[selectedIndex],
    ];
  };

  // Derived state
  const visibleImages = useMemo(
    () => filterImages(images, filterValue, searchQuery),
    [images, filterValue, searchQuery],
  );

  const currentImageItem = useMemo(
    () => images.find((item) => item.name === currentImageName) || null,
    [images, currentImageName],
  );

  const selectedBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) || null,
    [boxes, selectedBoxId],
  );

  const displayMetrics = useMemo(
    () => getDisplayMetricsForZoom(naturalSize, stageSize, zoomLevel),
    [naturalSize, stageSize, zoomLevel],
  );

  const stageLayout = useMemo(
    () => getStageLayoutMetrics(displayMetrics, stageSize),
    [displayMetrics, stageSize],
  );

  const labelerPreferences = useMemo(
    () => ({
      framesDir: activeFramesDir || "",
      filterValue,
      searchQuery,
      activeClassId,
      autolabelConfig,
    }),
    [activeFramesDir, filterValue, searchQuery, activeClassId, autolabelConfig],
  );

  usePagePreferencesAutosave("labeler", labelerPreferences, {
    enabled: isPreferenceReady && !isLoading,
  });

  // Box ID management
  const syncNextBoxId = (nextBoxes) => {
    nextBoxIdRef.current = nextBoxes.reduce(
      (maxId, box) => Math.max(maxId, Number(box.id) + 1),
      1,
    );
  };

  const createBox = (data) => ({
    id: data.id ?? nextBoxIdRef.current++,
    classId: Number(data.classId) || 0,
    x: Number(data.x) || 0,
    y: Number(data.y) || 0,
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
  });

  const duplicateSelectedBox = () => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Edit bounding box dikunci saat auto-label berjalan."));
      return;
    }

    const selected = boxesRef.current.find(
      (box) => box.id === selectedBoxIdRef.current,
    );
    if (!selected) {
      setNotice(createNotice("warning", "Pilih box yang ingin diduplikat."));
      return;
    }

    const currentNaturalSize = naturalSizeRef.current;
    const maxX = Math.max(0, currentNaturalSize.width - selected.width);
    const maxY = Math.max(0, currentNaturalSize.height - selected.height);
    const candidateOffsets = [
      { x: 12, y: 12 },
      { x: -12, y: 12 },
      { x: 12, y: -12 },
      { x: -12, y: -12 },
      { x: 0, y: 0 },
    ];

    const nextPosition =
      candidateOffsets
        .map((offset) => ({
          x: clamp(selected.x + offset.x, 0, maxX),
          y: clamp(selected.y + offset.y, 0, maxY),
        }))
        .find((candidate) => candidate.x !== selected.x || candidate.y !== selected.y) || {
        x: selected.x,
        y: selected.y,
      };

    const duplicatedBox = createBox({
      classId: selected.classId,
      width: selected.width,
      height: selected.height,
      x: nextPosition.x,
      y: nextPosition.y,
    });

    pushUndoSnapshot(takeUndoSnapshot());
    setBoxes([...boxesRef.current, duplicatedBox]);
    syncSelectedBoxId(duplicatedBox.id, { enableArrowBoxControl: true });
    markDirty(true);
  };

  const moveSelectedBoxBy = (deltaX, deltaY, { captureUndo = true } = {}) => {
    if (isLabelingLocked) {
      return false;
    }

    const selected = boxesRef.current.find(
      (box) => box.id === selectedBoxIdRef.current,
    );
    if (!selected) {
      return false;
    }

    const updated = getMovedBox(selected, { x: deltaX, y: deltaY });
    if (updated.x === selected.x && updated.y === selected.y) {
      return false;
    }

    if (captureUndo) {
      pushUndoSnapshot(takeUndoSnapshot());
    }

    setBoxes(
      boxesRef.current.map((box) =>
        box.id === selected.id ? updated : { ...box },
      ),
    );
    syncSelectedBoxId(selected.id, { enableArrowBoxControl: true });
    markDirty(true);
    return true;
  };

  // Undo management
  const takeUndoSnapshot = () => ({
    boxes: cloneBoxes(boxesRef.current),
    selectedBoxId: selectedBoxIdRef.current,
    activeClassId: activeClassIdRef.current,
  });

  const pushUndoSnapshot = (snapshot) => {
    if (!snapshot) return;
    setUndoStack((current) => [
      ...current.slice(-(MAX_UNDO_STEPS - 1)),
      snapshot,
    ]);
  };

  const restoreUndoSnapshot = (snapshot) => {
    const nextBoxes = cloneBoxes(snapshot.boxes || []);
    syncNextBoxId(nextBoxes);
    setBoxes(nextBoxes);
    syncSelectedBoxId(
      nextBoxes.some((box) => box.id === snapshot.selectedBoxId)
        ? snapshot.selectedBoxId
        : nextBoxes[0]?.id || null,
    );
    setActiveClassId(Number(snapshot.activeClassId) || 0);
  };

  const normalizedToBox = (item, frameSize) => {
    const width = item.width * frameSize.width;
    const height = item.height * frameSize.height;
    return createBox({
      classId: item.classId,
      x: item.cx * frameSize.width - width / 2,
      y: item.cy * frameSize.height - height / 2,
      width,
      height,
    });
  };

  const boxToPayload = (box) => ({
    classId: box.classId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  });

  const getLabelApiUrl = (name) =>
    `/api/labels?image=${encodeURIComponent(name)}`;

  const syncCheckpointState = (checkpointName) => {
    const normalized =
      typeof checkpointName === "string" ? checkpointName.trim() : "";
    const checkpointExists = imagesRef.current.some((item) => item.name === normalized);
    const nextCheckpointName = checkpointExists ? normalized : null;
    checkpointImageNameRef.current = nextCheckpointName;
    setImages((current) =>
      current.map((item) => ({
        ...item,
        isCheckpoint: item.name === nextCheckpointName,
      })),
    );
    setCheckpointImageName(nextCheckpointName);
    return nextCheckpointName;
  };

  const persistCheckpoint = async (
    name = currentImageNameRef.current,
    { silentSuccess = false, silentError = false } = {},
  ) => {
    if (isLabelingLocked) {
      if (!silentError) {
        setNotice(createNotice("warning", "Checkpoint dinonaktifkan saat auto-label berjalan."));
      }
      return { ok: false };
    }

    const checkpointTarget = typeof name === "string" ? name.trim() : "";
    if (!checkpointTarget) {
      if (!silentError) {
        setNotice(
          createNotice(
            "warning",
            "Frame harus dipilih untuk membuat checkpoint.",
          ),
        );
      }
      return { ok: false };
    }

    if (checkpointImageNameRef.current === checkpointTarget) {
      saveAndNextSinceCheckpointRef.current = 0;
      if (!silentSuccess) {
        setNotice(createNotice("success", "Checkpoint tersimpan."));
      }
      return {
        ok: true,
        checkpointImage: checkpointTarget,
        reused: true,
      };
    }

    try {
      const response = await fetchJson("/api/checkpoint", {
        method: "POST",
        body: JSON.stringify({ image: checkpointTarget }),
      });
      const nextCheckpointImage = syncCheckpointState(
        response.checkpointImage || checkpointTarget,
      );
      saveAndNextSinceCheckpointRef.current = 0;
      if (!silentSuccess) {
        setNotice(createNotice("success", "Checkpoint tersimpan."));
      }
      return {
        ok: true,
        checkpointImage: nextCheckpointImage || checkpointTarget,
        reused: false,
      };
    } catch (error) {
      if (!silentError) {
        setNotice(createNotice("error", error.message));
      }
      return {
        ok: false,
        error,
      };
    }
  };

  // Frame loading
  const loadFrameInfo = (name) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const src = `/frames/${encodeURIComponent(name)}`;
      image.onload = () => {
        setNaturalSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        setImageSrc(src);
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => {
        reject(new Error(`Failed to load frame: ${name}`));
      };
      image.src = src;
    });

  const selectImage = async (name, { force = false } = {}) => {
    if (!force && isLabelingLocked) {
      setNotice(createNotice("warning", "Tunggu auto-label selesai sebelum pindah frame."));
      return;
    }
    if (!force && dirtyRef.current) {
      setNotice(
        createNotice(
          "warning",
          "Frame belum disimpan. Klik tombol Simpan terlebih dahulu.",
        ),
      );
      return;
    }

    const requestToken = loadTokenRef.current + 1;
    loadTokenRef.current = requestToken;
    navigationImageNameRef.current = name;
    setNotice(createNotice("info", "Memuat frame dan label..."));

    try {
      const [frameInfo, labelData] = await Promise.all([
        loadFrameInfo(name),
        fetchJson(getLabelApiUrl(name)),
      ]);

      if (requestToken !== loadTokenRef.current) return;

      setHasLabelFile(Boolean(labelData?.hasLabelFile));
      setParseError(labelData?.parseError || null);
      setCurrentImageName(name);
      markDirty(false);
      interactionRef.current = null;
      draftBoxesRef.current = null;
      setBoxes([]);
      syncSelectedBoxId(null);
      setUndoStack([]);

      if (labelData?.boxes?.length) {
        const nextBoxes = labelData.boxes
          .map((item) => normalizedToBox(item, frameInfo))
          .filter((box) => box.width > 0 && box.height > 0);
        syncNextBoxId(nextBoxes);
        setBoxes(nextBoxes);
      syncSelectedBoxId(nextBoxes[0]?.id || null, { enableArrowBoxControl: false });
      }

      setNotice(null);
    } catch (error) {
      if (requestToken === loadTokenRef.current) {
        setNotice(createNotice("error", error.message));
      }
    }
  };

  const reloadConfig = async (preserveSelection = true) => {
    setIsLoading(true);
    try {
      const config = await fetchJson("/api/config");
      const checkpointName = config.checkpointImage || null;
      const autolabelDefaults = config.autolabel?.defaults || {};
      const pagePreferences = config.preferences || {};

      setClassNames(config.classNames || []);
      setCheckpointImageName(checkpointName);
      setFrameFolders(config.frameFolders || []);
      setActiveFramesDir(config.activeFramesDir || "");
      if (!preferencesHydratedRef.current) {
        setFilterValue(
          typeof pagePreferences.filterValue === "string" && pagePreferences.filterValue
            ? pagePreferences.filterValue
            : "all",
        );
        setSearchQuery(
          typeof pagePreferences.searchQuery === "string" ? pagePreferences.searchQuery : "",
        );
        setActiveClassId(
          Number.isFinite(Number(pagePreferences.activeClassId))
            ? Number(pagePreferences.activeClassId)
            : 0,
        );
        setAutolabelConfig({
          ...autolabelDefaults,
          ...(pagePreferences.autolabelConfig || {}),
        });
        preferencesHydratedRef.current = true;
        setIsPreferenceReady(true);
      } else {
        setAutolabelConfig((current) =>
          preserveSelection
            ? { ...autolabelDefaults, ...current }
            : { ...current, ...autolabelDefaults },
        );
      }
      setAutolabelSuggestions(config.autolabel?.suggestions?.model || []);
      setAutolabelWarnings(config.autolabel?.runtimeWarnings || []);
      setAutolabelJob(config.autolabel?.job || null);

      const nextImages = (config.images || []).map((item) => ({
        ...item,
        isCheckpoint: item.name === checkpointName,
      }));
      setImages(nextImages);

      if (preserveSelection && currentImageNameRef.current) {
        const stillExists = nextImages.some(
          (item) => item.name === currentImageNameRef.current,
        );
        if (stillExists) return { config, images: nextImages };
      }

      if (nextImages.length) {
        await selectImage(nextImages[0].name);
      } else {
        setCurrentImageName(null);
        setBoxes([]);
      }
      return { config, images: nextImages };
    } catch (error) {
      setNotice(createNotice("error", error.message));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const changeFramesDirectory = async (nextFramesDir) => {
    const normalizedDir = String(nextFramesDir || "").trim();
    if (!normalizedDir || normalizedDir === activeFramesDir) {
      return;
    }
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Tunggu auto-label selesai sebelum pindah folder."));
      return;
    }
    if (dirtyRef.current) {
      setNotice(
        createNotice(
          "warning",
          "Frame aktif punya perubahan yang belum disimpan. Simpan dulu sebelum pindah folder.",
        ),
      );
      return;
    }

    setNotice(createNotice("info", "Memindahkan labeler ke folder frame terpilih..."));
    try {
      await fetchJson("/api/frames/activate", {
        method: "POST",
        body: JSON.stringify({ framesDir: normalizedDir }),
      });
      await reloadConfig(false);
      setNotice(createNotice("success", `Folder frame aktif diganti ke ${normalizedDir}.`));
    } catch (error) {
      setNotice(createNotice("error", error.message));
    }
  };

  const navigate = (step) => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Navigasi frame dikunci saat auto-label berjalan."));
      return;
    }
    if (!visibleImages.length) {
      setNotice(createNotice("warning", "Tidak ada frame yang tersedia."));
      return;
    }
    const anchorImageName =
      navigationImageNameRef.current || currentImageNameRef.current;
    let currentIndex = visibleImages.findIndex(
      (item) => item.name === anchorImageName,
    );
    if (
      currentIndex < 0 &&
      currentImageNameRef.current &&
      anchorImageName !== currentImageNameRef.current
    ) {
      currentIndex = visibleImages.findIndex(
        (item) => item.name === currentImageNameRef.current,
      );
    }
    const nextIndex = clamp(
      currentIndex < 0
        ? step > 0
          ? 0
          : visibleImages.length - 1
        : currentIndex + step,
      0,
      visibleImages.length - 1,
    );
    const nextItem = visibleImages[nextIndex];
    if (nextItem && nextItem.name !== anchorImageName) {
      void selectImage(nextItem.name);
    }
  };

  const saveCurrentLabel = async (advance = false) => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Simpan label dinonaktifkan sampai auto-label selesai."));
      return;
    }
    if (!currentImageNameRef.current) {
      setNotice(createNotice("warning", "Tidak ada frame yang aktif."));
      return;
    }

    try {
      const imageName = currentImageNameRef.current;
      const payload = {
        imageWidth: naturalSizeRef.current.width,
        imageHeight: naturalSizeRef.current.height,
        boxes: boxesRef.current.map(boxToPayload),
      };
      const response = await fetchJson(getLabelApiUrl(imageName), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      markDirty(false);
      setHasLabelFile(true);
      setParseError(null);
      setImages((current) =>
        current.map((item) =>
          item.name === imageName
            ? {
                ...item,
                hasLabelFile: true,
                boxCount: Number(response.boxCount || 0),
              }
            : item,
        ),
      );
      let checkpointResult = null;
      if (advance) {
        saveAndNextSinceCheckpointRef.current += 1;
        if (
          saveAndNextSinceCheckpointRef.current
          >= AUTO_CHECKPOINT_SAVE_AND_NEXT_INTERVAL
        ) {
          checkpointResult = await persistCheckpoint(imageName, {
            silentSuccess: true,
            silentError: true,
          });
        }
      }

      if (checkpointResult?.ok) {
        setNotice(
          createNotice(
            "success",
            checkpointResult.reused
              ? "Label tersimpan. Checkpoint otomatis tetap aktif di frame ini."
              : "Label tersimpan. Checkpoint otomatis diperbarui.",
          ),
        );
      } else if (checkpointResult && !checkpointResult.ok) {
        setNotice(
          createNotice(
            "warning",
            "Label tersimpan, tetapi checkpoint otomatis gagal dibuat.",
          ),
        );
      } else {
        setNotice(createNotice("success", "Label tersimpan."));
      }

      if (advance) navigate(1);
    } catch (error) {
      setNotice(createNotice("error", error.message));
    }
  };

  const saveCheckpoint = async (name = currentImageNameRef.current) => {
    await persistCheckpoint(name);
  };

  const openCheckpoint = () => {
    if (!checkpointImageName) {
      setNotice(createNotice("warning", "Checkpoint belum diatur."));
      return;
    }
    if (checkpointImageName === currentImageNameRef.current) {
      setNotice(createNotice("info", "Frame ini adalah checkpoint aktif."));
      return;
    }
    void selectImage(checkpointImageName);
  };

  const replaceAutolabelSelection = (imageNames) => {
    const availableImageNames = new Set(imagesRef.current.map((item) => item.name));
    const nextSelection = Array.from(
      new Set(
        (Array.isArray(imageNames) ? imageNames : [])
          .map((imageName) => String(imageName || "").trim())
          .filter((imageName) => imageName && availableImageNames.has(imageName)),
      ),
    );
    setAutolabelSelectedImages(nextSelection);
  };

  const toggleAutolabelSelection = (imageName) => {
    const normalizedImageName = String(imageName || "").trim();
    if (!normalizedImageName) {
      return;
    }

    setAutolabelSelectedImages((current) =>
      current.includes(normalizedImageName)
        ? current.filter((item) => item !== normalizedImageName)
        : [...current, normalizedImageName],
    );
  };

  const selectCurrentAutolabelImage = () => {
    const imageName = currentImageNameRef.current;
    if (!imageName) {
      setNotice(createNotice("warning", "Tidak ada frame aktif untuk dipilih."));
      return;
    }
    replaceAutolabelSelection([imageName]);
  };

  const selectVisibleAutolabelImages = () => {
    if (!visibleImages.length) {
      setNotice(createNotice("warning", "Tidak ada frame yang terlihat untuk dipilih."));
      return;
    }
    replaceAutolabelSelection(visibleImages.map((item) => item.name));
  };

  const selectPendingAutolabelImages = () => {
    const pendingImageNames = visibleImages
      .filter((item) => !item.hasLabelFile)
      .map((item) => item.name);
    if (!pendingImageNames.length) {
      setNotice(createNotice("info", "Semua frame yang terlihat sudah punya label."));
      return;
    }
    replaceAutolabelSelection(pendingImageNames);
  };

  const openAutolabelWorkspace = () => {
    setAutolabelSelectedImages((current) => {
      const availableImageNames = new Set(imagesRef.current.map((item) => item.name));
      const existingSelection = current.filter((imageName) => availableImageNames.has(imageName));
      if (existingSelection.length) {
        return existingSelection;
      }

      const imageName = currentImageNameRef.current;
      if (imageName && availableImageNames.has(imageName)) {
        return [imageName];
      }
      return existingSelection;
    });
    setIsAutolabelModalOpen(true);
  };

  const ensureAutolabelReady = () => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Masih ada proses auto-label yang berjalan."));
      return false;
    }
    if (!String(autolabelConfig.model || "").trim()) {
      setNotice(createNotice("warning", "Model auto-label wajib diisi."));
      return false;
    }
    if (dirtyRef.current) {
      setNotice(
        createNotice(
          "warning",
          "Simpan perubahan frame aktif terlebih dahulu sebelum menjalankan auto-label.",
        ),
      );
      return false;
    }
    return true;
  };

  const removeBox = (boxId) => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Edit bounding box dikunci saat auto-label berjalan."));
      return;
    }
    const currentBoxes = boxesRef.current;
    const nextBoxes = currentBoxes.filter((box) => box.id !== boxId);
    if (nextBoxes.length === currentBoxes.length) return;
    pushUndoSnapshot(takeUndoSnapshot());
    syncNextBoxId(nextBoxes);
    setBoxes(nextBoxes);
    syncSelectedBoxId(nextBoxes[0]?.id || null);
    markDirty(true);
  };

  const clearAllBoxes = () => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Edit bounding box dikunci saat auto-label berjalan."));
      return;
    }
    if (!boxesRef.current.length) return;
    pushUndoSnapshot(takeUndoSnapshot());
    setBoxes([]);
    syncSelectedBoxId(null);
    markDirty(true);
  };

  const undoLastChange = () => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Undo dinonaktifkan saat auto-label berjalan."));
      return;
    }
    if (!undoStackRef.current.length) {
      setNotice(
        createNotice("warning", "Tidak ada perubahan untuk dibatalkan."),
      );
      return;
    }
    const nextStack = [...undoStackRef.current];
    const snapshot = nextStack.pop();
    setUndoStack(nextStack);
    restoreUndoSnapshot(snapshot);
    markDirty(true);
    setNotice(createNotice("info", "Perubahan terakhir dibatalkan."));
  };

  const syncSelectedBoxClass = (nextClassId) => {
    if (isLabelingLocked) {
      setNotice(createNotice("warning", "Perubahan class dikunci saat auto-label berjalan."));
      return;
    }
    const parsedClassId = Number(nextClassId) || 0;
    setActiveClassId(parsedClassId);
    const selected = boxesRef.current.find(
      (box) => box.id === selectedBoxIdRef.current,
    );
    if (!selected || selected.classId === parsedClassId) return;

    pushUndoSnapshot(takeUndoSnapshot());
    const nextBoxes = boxesRef.current.map((box) =>
      box.id === selected.id ? { ...box, classId: parsedClassId } : box,
    );
    setBoxes(nextBoxes);
    markDirty(true);
  };

  const resetZoom = () => {
    zoomLevelRef.current = 1;
    setZoomLevel(1);
    if (stageViewportRef.current) {
      stageViewportRef.current.scrollLeft = 0;
      stageViewportRef.current.scrollTop = 0;
    }
  };

  const zoomAtViewportPoint = (getNextZoom, anchorClientPoint = null) => {
    const viewport = stageViewportRef.current;
    const frameShell = frameShellRef.current;
    const currentNaturalSize = naturalSizeRef.current;
    const currentStageSize = stageSizeRef.current;
    if (
      !viewport ||
      !frameShell ||
      !currentNaturalSize.width ||
      !currentNaturalSize.height ||
      !currentStageSize.width ||
      !currentStageSize.height
    ) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const frameRect = frameShell.getBoundingClientRect();
    const currentZoom = zoomLevelRef.current;

    const anchorX =
      anchorClientPoint?.x ?? viewportRect.left + viewport.clientWidth / 2;
    const anchorY =
      anchorClientPoint?.y ?? viewportRect.top + viewport.clientHeight / 2;

    const currentScaleX = frameRect.width / currentNaturalSize.width;
    const currentScaleY = frameRect.height / currentNaturalSize.height;
    const imagePointX = clamp(
      (anchorX - frameRect.left) / currentScaleX,
      0,
      currentNaturalSize.width,
    );
    const imagePointY = clamp(
      (anchorY - frameRect.top) / currentScaleY,
      0,
      currentNaturalSize.height,
    );

    const nextZoom = clamp(
      getNextZoom(currentZoom),
      MIN_ZOOM_LEVEL,
      MAX_ZOOM_LEVEL,
    );
    if (Math.abs(nextZoom - currentZoom) < 0.0001) {
      return;
    }

    zoomLevelRef.current = nextZoom;
    setZoomLevel(nextZoom);

    requestAnimationFrame(() => {
      const nextViewport = stageViewportRef.current;
      if (!nextViewport) {
        return;
      }

      const nextDisplayMetrics = getDisplayMetricsForZoom(
        currentNaturalSize,
        currentStageSize,
        nextZoom,
      );
      const nextStageLayout = getStageLayoutMetrics(
        nextDisplayMetrics,
        currentStageSize,
      );
      const nextScaleX = nextDisplayMetrics.width / currentNaturalSize.width;
      const nextScaleY = nextDisplayMetrics.height / currentNaturalSize.height;
      const maxScrollLeft = Math.max(
        0,
        nextStageLayout.contentWidth - nextViewport.clientWidth,
      );
      const maxScrollTop = Math.max(
        0,
        nextStageLayout.contentHeight - nextViewport.clientHeight,
      );

      nextViewport.scrollLeft = clamp(
        nextStageLayout.frameOffsetX +
          imagePointX * nextScaleX -
          (anchorX - viewportRect.left),
        0,
        maxScrollLeft,
      );
      nextViewport.scrollTop = clamp(
        nextStageLayout.frameOffsetY +
          imagePointY * nextScaleY -
          (anchorY - viewportRect.top),
        0,
        maxScrollTop,
      );
    });
  };

  const zoomFromViewportCenter = (direction) => {
    zoomAtViewportPoint(
      (currentZoom) =>
        currentZoom *
        (direction > 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR),
    );
  };

  const zoomIn = () => {
    zoomFromViewportCenter(1);
  };

  const zoomOut = () => {
    zoomFromViewportCenter(-1);
  };

  const handleAutolabelCurrent = async () => {
    if (!currentImageNameRef.current) {
      setNotice(createNotice("warning", "Tidak ada frame aktif untuk auto-label."));
      return;
    }
    if (!ensureAutolabelReady()) {
      return;
    }

    const imageName = currentImageNameRef.current;
    try {
      const nextJob = await fetchJson("/api/autolabel", {
        method: "POST",
        body: JSON.stringify({
          image: imageName,
          ...autolabelConfig,
        }),
      });
      setAutolabelJob(nextJob);
      setIsAutolabelModalOpen(false);
      setNotice(createNotice("info", "Auto-label frame dimulai. Panel labeling dikunci sampai selesai."));
    } catch (error) {
      setNotice(createNotice("error", error.message));
    }
  };

  const handleAutolabelSelection = async () => {
    if (!autolabelSelectedImages.length) {
      setNotice(createNotice("warning", "Pilih minimal satu frame sebelum menjalankan selection auto-label."));
      return;
    }
    if (!ensureAutolabelReady()) {
      return;
    }

    const targetImages = [...autolabelSelectedImages];
    try {
      const nextJob = await fetchJson("/api/autolabel/selection", {
        method: "POST",
        body: JSON.stringify({
          images: targetImages,
          ...autolabelConfig,
        }),
      });
      setAutolabelJob(nextJob);
      setIsAutolabelModalOpen(false);
      setNotice(
        createNotice(
          "info",
          `Auto-label ${targetImages.length} frame terpilih dimulai. Panel labeling dikunci sampai selesai.`,
        ),
      );
    } catch (error) {
      setNotice(createNotice("error", error.message));
    }
  };

  const handleAutolabelAll = async () => {
    if (!imagesRef.current.length) {
      setNotice(createNotice("warning", "Folder frame aktif belum memiliki frame."));
      return;
    }
    if (!ensureAutolabelReady()) {
      return;
    }

    const confirmed = window.confirm(
      "Jalankan auto-label untuk semua frame pada folder aktif? Label yang sudah ada akan dipertahankan.",
    );
    if (!confirmed) {
      return;
    }

    try {
      const nextJob = await fetchJson("/api/autolabel/all", {
        method: "POST",
        body: JSON.stringify(autolabelConfig),
      });
      setAutolabelJob(nextJob);
      setIsAutolabelModalOpen(false);
      setNotice(
        createNotice(
          "info",
          `Auto-label semua frame dimulai untuk ${imagesRef.current.length} frame. Panel labeling dikunci sampai selesai.`,
        ),
      );
    } catch (error) {
      setNotice(createNotice("error", error.message));
    }
  };

  const toImagePointFromEvent = (event) => {
    const canvas = overlayRef.current;
    const currentNaturalSize = naturalSizeRef.current;
    if (
      !canvas ||
      !frameShellRef.current ||
      !displayMetrics.width ||
      !displayMetrics.height ||
      !currentNaturalSize.width ||
      !currentNaturalSize.height
    ) {
      return { x: 0, y: 0 };
    }
    const frameRect = frameShellRef.current.getBoundingClientRect();
    return {
      x: clamp(
        ((event.clientX - frameRect.left) / displayMetrics.width) *
          currentNaturalSize.width,
        0,
        currentNaturalSize.width,
      ),
      y: clamp(
        ((event.clientY - frameRect.top) / displayMetrics.height) *
          currentNaturalSize.height,
        0,
        currentNaturalSize.height,
      ),
    };
  };

  const isPointInsideBox = (point, box) =>
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height;

  const getHandleHit = (point, box) => {
    const threshold = 10;
    const left = box.x;
    const right = box.x + box.width;
    const top = box.y;
    const bottom = box.y + box.height;
    const withinHorizontalSpan =
      point.x >= left - threshold && point.x <= right + threshold;
    const withinVerticalSpan =
      point.y >= top - threshold && point.y <= bottom + threshold;
    const nearLeft =
      withinVerticalSpan && Math.abs(point.x - left) <= threshold;
    const nearRight =
      withinVerticalSpan && Math.abs(point.x - right) <= threshold;
    const nearTop =
      withinHorizontalSpan && Math.abs(point.y - top) <= threshold;
    const nearBottom =
      withinHorizontalSpan && Math.abs(point.y - bottom) <= threshold;

    if (nearLeft && nearTop) return "nw";
    if (nearRight && nearTop) return "ne";
    if (nearLeft && nearBottom) return "sw";
    if (nearRight && nearBottom) return "se";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";
    return null;
  };

  const findInteractionTarget = (point) => {
    const orderedBoxes = getBoxesWithSelectedOnTop(
      draftBoxesRef.current || boxesRef.current,
    );
    for (let i = orderedBoxes.length - 1; i >= 0; i--) {
      const box = orderedBoxes[i];
      const handle = getHandleHit(point, box);
      if (handle) {
        return { boxId: box.id, handle };
      }
      if (isPointInsideBox(point, box)) {
        return { boxId: box.id, handle: null };
      }
    }
    return null;
  };

  const getCursorForHandle = (handle) => {
    if (handle === "nw" || handle === "se") return "nwse-resize";
    if (handle === "ne" || handle === "sw") return "nesw-resize";
    if (handle === "n" || handle === "s") return "ns-resize";
    if (handle === "e" || handle === "w") return "ew-resize";
    return "move";
  };

  const getCursorForPoint = (point) => {
    const target = findInteractionTarget(point);
    if (!target) return "crosshair";
    return getCursorForHandle(target.handle);
  };

  const normalizeRect = (start, end) => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  });

  const getMovedBox = (startBox, delta) => ({
    ...startBox,
    x: clamp(
      startBox.x + delta.x,
      0,
      Math.max(0, naturalSizeRef.current.width - startBox.width),
    ),
    y: clamp(
      startBox.y + delta.y,
      0,
      Math.max(0, naturalSizeRef.current.height - startBox.height),
    ),
  });

  const getResizedBox = (interactionState, delta) => {
    const currentNaturalSize = naturalSizeRef.current;
    const startBox = interactionState.startBox;
    const minBoxSize = 6;
    let left = startBox.x;
    let top = startBox.y;
    let right = startBox.x + startBox.width;
    let bottom = startBox.y + startBox.height;

    if (interactionState.handle?.includes("w")) {
      left = clamp(
        left + delta.x,
        0,
        Math.max(0, right - minBoxSize),
      );
    }
    if (interactionState.handle?.includes("e")) {
      right = clamp(
        right + delta.x,
        Math.min(currentNaturalSize.width, left + minBoxSize),
        currentNaturalSize.width,
      );
    }
    if (interactionState.handle?.includes("n")) {
      top = clamp(
        top + delta.y,
        0,
        Math.max(0, bottom - minBoxSize),
      );
    }
    if (interactionState.handle?.includes("s")) {
      bottom = clamp(
        bottom + delta.y,
        Math.min(currentNaturalSize.height, top + minBoxSize),
        currentNaturalSize.height,
      );
    }

    return {
      ...startBox,
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width: Math.abs(right - left),
      height: Math.abs(bottom - top),
    };
  };

  const drawOverlay = () => {
    const svg = overlayRef.current;
    if (!svg || !frameShellRef.current || !displayMetrics.width || !displayMetrics.height) {
      return;
    }
    if (!naturalSizeRef.current.width || !naturalSizeRef.current.height) {
      return;
    }

    const currentNaturalSize = naturalSizeRef.current;
    const renderedBoxes = getBoxesWithSelectedOnTop(
      draftBoxesRef.current || boxesRef.current,
    );
    const interactionState = interactionRef.current;
    const scaleX = displayMetrics.width / currentNaturalSize.width;
    const scaleY = displayMetrics.height / currentNaturalSize.height;
    const cornerHandleSize = 8;
    const edgeHandleLength = 14;
    const edgeHandleThickness = 6;
    const shapes = [];

    const drawBoxMarkup = (box, isSelected) => {
      const color = BOX_COLORS[box.classId % BOX_COLORS.length];
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      const lineWidth = isSelected ? 3 : 2;

      if (isSelected) {
        shapes.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.2" stroke="none" />`,
        );
      }

      shapes.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${lineWidth}" />`,
      );

      if (isSelected) {
        [
          {
            x: x - cornerHandleSize / 2,
            y: y - cornerHandleSize / 2,
            width: cornerHandleSize,
            height: cornerHandleSize,
          },
          {
            x: x + w - cornerHandleSize / 2,
            y: y - cornerHandleSize / 2,
            width: cornerHandleSize,
            height: cornerHandleSize,
          },
          {
            x: x - cornerHandleSize / 2,
            y: y + h - cornerHandleSize / 2,
            width: cornerHandleSize,
            height: cornerHandleSize,
          },
          {
            x: x + w - cornerHandleSize / 2,
            y: y + h - cornerHandleSize / 2,
            width: cornerHandleSize,
            height: cornerHandleSize,
          },
          {
            x: x + w / 2 - edgeHandleLength / 2,
            y: y - edgeHandleThickness / 2,
            width: edgeHandleLength,
            height: edgeHandleThickness,
          },
          {
            x: x + w / 2 - edgeHandleLength / 2,
            y: y + h - edgeHandleThickness / 2,
            width: edgeHandleLength,
            height: edgeHandleThickness,
          },
          {
            x: x - edgeHandleThickness / 2,
            y: y + h / 2 - edgeHandleLength / 2,
            width: edgeHandleThickness,
            height: edgeHandleLength,
          },
          {
            x: x + w - edgeHandleThickness / 2,
            y: y + h / 2 - edgeHandleLength / 2,
            width: edgeHandleThickness,
            height: edgeHandleLength,
          },
        ].forEach((handleRect) => {
          shapes.push(
            `<rect x="${handleRect.x}" y="${handleRect.y}" width="${handleRect.width}" height="${handleRect.height}" fill="${color}" stroke="none" />`,
          );
        });
      }
    };

    renderedBoxes.forEach((box) =>
      drawBoxMarkup(box, box.id === selectedBoxIdRef.current),
    );

    if (interactionState?.type === "draw") {
      const start = interactionState.startPoint;
      const end = interactionState.endPoint;
      const sx = start.x * scaleX;
      const sy = start.y * scaleY;
      const ex = end.x * scaleX;
      const ey = end.y * scaleY;

      shapes.push(
        `<rect x="${Math.min(sx, ex)}" y="${Math.min(sy, ey)}" width="${Math.abs(ex - sx)}" height="${Math.abs(ey - sy)}" fill="none" stroke="#3b82f6" stroke-width="2" />`,
      );
    }

    svg.innerHTML = shapes.join("");
  };

  const scheduleOverlayDraw = () => {
    if (overlayFrameRef.current) {
      return;
    }

    overlayFrameRef.current = requestAnimationFrame(() => {
      overlayFrameRef.current = 0;
      drawOverlay();
    });
  };

  const handleCanvasMouseDown = (event) => {
    if (isLabelingLocked) {
      return;
    }
    if (!currentImageNameRef.current) return;

    event.preventDefault();
    const point = toImagePointFromEvent(event);
    const target = findInteractionTarget(point);

    if (target) {
      syncSelectedBoxId(target.boxId, { enableArrowBoxControl: true });
      overlayRef.current.style.cursor = getCursorForHandle(target.handle);
      interactionRef.current = {
        type: target.handle ? "resize" : "move",
        boxId: target.boxId,
        handle: target.handle,
        startPoint: point,
        startBox: {
          ...boxesRef.current.find((b) => b.id === target.boxId),
        },
      };
      draftBoxesRef.current = cloneBoxes(boxesRef.current);
    } else {
      syncSelectedBoxId(null, { enableArrowBoxControl: false });
      interactionRef.current = {
        type: "draw",
        startPoint: point,
        endPoint: point,
      };
      draftBoxesRef.current = null;
    }
    scheduleOverlayDraw();
  };

  // Canvas drawing and interaction
  useEffect(() => {
    scheduleOverlayDraw();
  }, [boxes, selectedBoxId, displayMetrics.width, displayMetrics.height, currentImageName]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const canvas = overlayRef.current;
    const handleHoverMove = (event) => {
      if (interactionRef.current || !currentImageNameRef.current) {
        return;
      }

      canvas.style.cursor = getCursorForPoint(toImagePointFromEvent(event));
    };

    const handleWindowMouseMove = (event) => {
      const interactionState = interactionRef.current;
      if (!interactionState) {
        return;
      }

      const point = toImagePointFromEvent(event);

      if (interactionState.type === "draw") {
        interactionRef.current = {
          ...interactionState,
          endPoint: point,
        };
      } else if (interactionState.type === "move" && interactionState.startBox) {
        const delta = {
          x: point.x - interactionState.startPoint.x,
          y: point.y - interactionState.startPoint.y,
        };
        const updated = getMovedBox(interactionState.startBox, delta);
        draftBoxesRef.current = boxesRef.current.map((box) =>
          box.id === interactionState.boxId ? updated : { ...box },
        );
      } else if (interactionState.type === "resize" && interactionState.startBox) {
        const delta = {
          x: point.x - interactionState.startPoint.x,
          y: point.y - interactionState.startPoint.y,
        };
        const updated = getResizedBox(interactionState, delta);
        draftBoxesRef.current = boxesRef.current.map((box) =>
          box.id === interactionState.boxId ? updated : { ...box },
        );
      }

      scheduleOverlayDraw();
    };

    const handleWindowMouseUp = () => {
      const interactionState = interactionRef.current;
      if (!interactionState) {
        return;
      }

      if (interactionState.type === "draw") {
        const rect = normalizeRect(
          interactionState.startPoint,
          interactionState.endPoint,
        );
        if (rect.width > 5 && rect.height > 5) {
          const newBox = createBox({
            classId: activeClassIdRef.current,
            ...rect,
          });
          pushUndoSnapshot(takeUndoSnapshot());
          setBoxes((current) => [...current, newBox]);
          syncSelectedBoxId(newBox.id, { enableArrowBoxControl: true });
          markDirty(true);
        }
      } else if (
        draftBoxesRef.current &&
        !boxesEqual(draftBoxesRef.current, boxesRef.current)
      ) {
        pushUndoSnapshot(takeUndoSnapshot());
        setBoxes(cloneBoxes(draftBoxesRef.current));
        markDirty(true);
      }

      interactionRef.current = null;
      draftBoxesRef.current = null;
      canvas.style.cursor = "crosshair";
      scheduleOverlayDraw();
    };

    canvas.addEventListener("mousemove", handleHoverMove);
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      canvas.removeEventListener("mousemove", handleHoverMove);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [displayMetrics.width, displayMetrics.height, currentImageName]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const handleViewportWheel = (event) => {
      if ((!event.ctrlKey && !event.metaKey) || !currentImageNameRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      zoomAtViewportPoint(
        (currentZoom) =>
          currentZoom *
          (event.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR),
        { x: event.clientX, y: event.clientY },
      );
    };

    viewport.addEventListener("wheel", handleViewportWheel, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleViewportWheel);
    };
  }, [zoomLevel, currentImageName, naturalSize, stageSize]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!currentImageName) return;
    if (isLabelingLocked) return;
    let keyboardNudgeActive = false;

    const handleKeyDown = (event) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTypingField) {
        return;
      }

      const hasSelectedBox = selectedBoxIdRef.current != null;
      const arrowBoxControlActive =
        hasSelectedBox && selectedBoxArrowControlRef.current;
      const isArrowKey =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown";
      const isHorizontalArrow =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      const isVerticalArrow =
        event.key === "ArrowUp" || event.key === "ArrowDown";
      const shouldMoveSelectedBoxWithArrow =
        hasSelectedBox &&
        isArrowKey &&
        !event.altKey &&
        (event.shiftKey || isVerticalArrow || arrowBoxControlActive);

      if (shouldMoveSelectedBoxWithArrow) {
        event.preventDefault();
        const nudgeStep =
          event.shiftKey || event.ctrlKey || event.metaKey ? 10 : 1;
        const deltaByKey = {
          ArrowLeft: { x: -nudgeStep, y: 0 },
          ArrowRight: { x: nudgeStep, y: 0 },
          ArrowUp: { x: 0, y: -nudgeStep },
          ArrowDown: { x: 0, y: nudgeStep },
        };
        const delta = deltaByKey[event.key];
        const moved = delta
          ? moveSelectedBoxBy(delta.x, delta.y, {
              captureUndo: !keyboardNudgeActive,
            })
          : false;
        keyboardNudgeActive = keyboardNudgeActive || moved;
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key === "z" || event.key === "Z") {
          event.preventDefault();
          undoLastChange();
        } else if (event.key === "s" || event.key === "S") {
          event.preventDefault();
          void saveCurrentLabel(event.shiftKey);
        } else if ((event.key === "x" || event.key === "X") && selectedBoxIdRef.current != null) {
          if (event.repeat) {
            return;
          }
          event.preventDefault();
          removeBox(selectedBoxIdRef.current);
        } else if (event.key === "0") {
          event.preventDefault();
          resetZoom();
        }
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        (event.altKey || (!event.shiftKey && isHorizontalArrow))
      ) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigate(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navigate(1);
          return;
        }
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedBoxIdRef.current != null
      ) {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        removeBox(selectedBoxIdRef.current);
      }
    };

    const handleKeyUp = (event) => {
      if (event.key.startsWith("Arrow")) {
        keyboardNudgeActive = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentImageName, isLabelingLocked]);

  // Initialize on mount
  useEffect(() => {
    void reloadConfig(false);
  }, []);

  useJobEventStream("/api/autolabel/stream", {
    onSnapshot: (nextJob) => {
      setAutolabelJob(nextJob);
    },
    onLog: (event) => {
      setAutolabelJob((current) => mergeJobLog(current, event));
    },
  });

  useEffect(() => {
    const delay = autolabelJob?.running ? 1500 : 5000;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextJob = await fetchJson("/api/autolabel/status");
        if (!cancelled) {
          setAutolabelJob(nextJob);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(createNotice("error", error.message));
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autolabelJob?.running, autolabelJob?.jobId, autolabelJob?.state]);

  useEffect(() => {
    const wasRunning = previousAutolabelRunningRef.current;
    const isRunning = Boolean(autolabelJob?.running);
    previousAutolabelRunningRef.current = isRunning;

    if (!wasRunning || isRunning || !autolabelJob?.jobId) {
      return;
    }

    const activeImageName = currentImageNameRef.current;
    void (async () => {
      const refreshedConfig = await reloadConfig(true);
      const refreshedImages = refreshedConfig?.images || [];
      if (activeImageName && refreshedImages.some((item) => item.name === activeImageName)) {
        await selectImage(activeImageName, { force: true });
      }

      if (autolabelJob.state === "finished") {
        const successMessage =
          autolabelJob.targetMode === "current"
            ? `Auto-label frame ${autolabelJob.targetImage || ""} selesai.`
            : autolabelJob.targetMode === "selection"
              ? `Auto-label ${autolabelJob.targetCount || 0} frame terpilih selesai.`
              : "Auto-label semua frame selesai. Cek log runner untuk detail output.";
        setNotice(createNotice("success", successMessage.trim()));
      } else if (autolabelJob.state === "failed") {
        setNotice(createNotice("error", autolabelJob.error || "Auto-label gagal dijalankan."));
      } else if (autolabelJob.state === "stopped") {
        setNotice(createNotice("warning", "Proses auto-label dihentikan."));
      }
    })();
  }, [
    autolabelJob?.running,
    autolabelJob?.jobId,
    autolabelJob?.state,
    autolabelJob?.targetMode,
    autolabelJob?.targetImage,
    autolabelJob?.error,
  ]);

  // Computed values
  const currentIsCheckpoint = Boolean(
    currentImageItem && currentImageItem.name === checkpointImageName,
  );
  const currentIndex = visibleImages.findIndex(
    (item) => item.name === currentImageName,
  );
  const zoomLabel = currentImageName
    ? Math.abs(zoomLevel - 1) < 0.001
      ? "Fit"
      : `${Math.round(zoomLevel * 100)}%`
    : "-";

  return (
    <>
      <div
        className="grid h-full min-h-0 gap-4 grid-rows-[minmax(280px,42vh)_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1"
        style={{
          height: "calc(100% - var(--yolo-log-dock-height, 0px))",
        }}
      >
        <aside className="min-h-0 h-[550px] overflow-y-scroll pr-1">
          <div className="grid gap-4">
            <LabelerHeader
              currentImageItem={currentImageItem}
              visibleImages={visibleImages}
              hasFrames={images.length > 0}
              interactionLocked={isLabelingLocked}
              currentIndex={currentIndex}
              currentIsCheckpoint={currentIsCheckpoint}
              checkpointImageName={checkpointImageName}
              naturalSize={naturalSize}
              zoomLabel={zoomLabel}
              onNavigate={navigate}
              onOpenCheckpoint={openCheckpoint}
              onSaveCheckpoint={saveCheckpoint}
              onOpenAutolabelModal={openAutolabelWorkspace}
              onSaveLabel={() => saveCurrentLabel(false)}
              onSaveLabelAndNext={() => saveCurrentLabel(true)}
            />

            <LabelerSidebar
              images={images}
              visibleImages={visibleImages}
              activeFramesDir={activeFramesDir}
              frameFolders={frameFolders}
              filterValue={filterValue}
              searchQuery={searchQuery}
              isLoading={isLoading}
              disabled={isLabelingLocked}
              onFramesDirChange={changeFramesDirectory}
              onFilterChange={setFilterValue}
              onSearchChange={setSearchQuery}
              onRefresh={() => reloadConfig(true)}
              onImageSelect={selectImage}
              currentImageName={currentImageName}
            />

            <LabelerToolPanel
              classNames={classNames}
              boxes={boxes}
              selectedBox={selectedBox}
              selectedBoxId={selectedBoxId}
              activeClassId={activeClassId}
              dirty={dirty}
              hasLabelFile={hasLabelFile}
              parseError={parseError}
              undoStack={undoStack}
              zoomLabel={zoomLabel}
              currentImageName={currentImageName}
              currentIsCheckpoint={currentIsCheckpoint}
              checkpointImageName={checkpointImageName}
              disabled={isLabelingLocked}
              onSyncSelectedBoxClass={syncSelectedBoxClass}
              onUndo={undoLastChange}
              onRemoveBox={removeBox}
              onDuplicateBox={duplicateSelectedBox}
              onClearAllBoxes={clearAllBoxes}
              onReloadLabel={() =>
                selectImage(currentImageNameRef.current || "", {
                  force: true,
                })
              }
              onBoxSelect={(boxId) =>
                syncSelectedBoxId(boxId, { enableArrowBoxControl: true })
              }
            />
          </div>
        </aside>

        <section className="min-h-0">
          <LabelerCanvas
            currentImageName={currentImageName}
            imageSrc={imageSrc}
            stageViewportRef={stageViewportRef}
            frameShellRef={frameShellRef}
            overlayRef={overlayRef}
            displayMetrics={displayMetrics}
            stageLayout={stageLayout}
            zoomLabel={zoomLabel}
            zoomLevel={zoomLevel}
            minZoomLevel={MIN_ZOOM_LEVEL}
            maxZoomLevel={MAX_ZOOM_LEVEL}
            interactionDisabled={isLabelingLocked}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetZoom={resetZoom}
            onCanvasMouseDown={handleCanvasMouseDown}
          />
        </section>
      </div>

      <LabelerLogs job={autolabelJob} />

      <LabelerAutolabelModal
        open={isAutolabelModalOpen}
        onClose={() => setIsAutolabelModalOpen(false)}
        activeFramesDir={activeFramesDir}
        images={images}
        visibleImages={visibleImages}
        totalImages={images.length}
        currentImageName={currentImageName}
        selectedImageNames={autolabelSelectedImages}
        autolabelConfig={autolabelConfig}
        autolabelSuggestions={autolabelSuggestions}
        autolabelWarnings={autolabelWarnings}
        job={autolabelJob}
        onAutolabelConfigChange={setAutolabelConfig}
        onSelectCurrentImage={selectCurrentAutolabelImage}
        onSelectVisibleImages={selectVisibleAutolabelImages}
        onSelectPendingImages={selectPendingAutolabelImages}
        onClearSelection={() => setAutolabelSelectedImages([])}
        onToggleImageSelection={toggleAutolabelSelection}
        onAutolabelCurrent={handleAutolabelCurrent}
        onAutolabelSelection={handleAutolabelSelection}
        onAutolabelAll={handleAutolabelAll}
      />
    </>
  );
}
