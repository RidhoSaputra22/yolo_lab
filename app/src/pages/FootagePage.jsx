import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button } from "../ui.js";
import { fetchJson } from "../shared/api.js";
import { mergeJobLog, useJobEventStream } from "../shared/jobStream.js";
import { formatCount } from "../shared/utils.js";
import { PREVIEW_DEBOUNCE_MS } from "../shared/formHelpers.js";
import { usePagePreferencesAutosave } from "../shared/pagePreferences.js";
import { useToast } from "../shared/toast.js";
import {
  FootageSidebar,
  FootageImportPanel,
  FootageExtractPanel,
  FootageCommandPanel,
  FootageLibrary,
  FootageLogs,
} from "./FootagePage/index.js";

export default function FootagePage({ onNavigate }) {
  const [layout, setLayout] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [defaults, setDefaults] = useState({});
  const [formValues, setFormValues] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewState, setPreviewState] = useState("idle");
  const [runtimePaths, setRuntimePaths] = useState(null);
  const [runtimeWarnings, setRuntimeWarnings] = useState([]);
  const [job, setJob] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [selectedFootagePath, setSelectedFootagePath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { setNotice } = useToast();

  const library = preview?.library || job?.library || null;
  const footageItems = library?.footageItems || [];

  useEffect(() => {
    if (!footageItems.length) {
      setSelectedFootagePath("");
      return;
    }
    if (!footageItems.some((item) => item.path === selectedFootagePath)) {
      setSelectedFootagePath(footageItems[0].path);
    }
  }, [footageItems, selectedFootagePath]);

  const selectedFootage = useMemo(
    () => footageItems.find((item) => item.path === selectedFootagePath) || footageItems[0] || null,
    [footageItems, selectedFootagePath],
  );
  const activeFramesDir = preview?.config?.framesDir || job?.config?.framesDir || library?.framesDir || "";

  usePagePreferencesAutosave("footage", formValues, {
    enabled: !isConfigLoading && Object.keys(formValues).length > 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setIsConfigLoading(true);
      try {
        const config = await fetchJson("/api/footage/config");
        if (cancelled) {
          return;
        }
        const initialConfig = config.preview?.config || config.defaults || {};
        setLayout(config.layout || []);
        setSuggestions(config.suggestions || {});
        setDefaults(initialConfig);
        setFormValues(initialConfig);
        setRuntimePaths(config.paths || null);
        setRuntimeWarnings(config.runtimeWarnings || []);
        setPreview(config.preview || null);
        setPreviewError("");
        setPreviewState(config.preview?.commandDisplay ? "ready" : "idle");
        setJob(config.job || null);
      } catch (error) {
        if (!cancelled) {
          setNotice({ type: "error", message: error.message });
          setPreviewError(error.message);
          setPreviewState("error");
        }
      } finally {
        if (!cancelled) {
          setIsConfigLoading(false);
        }
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useJobEventStream("/api/footage/stream", {
    onSnapshot: (nextJob) => {
      setJob(nextJob);
      setPreview((current) => (current ? { ...current, library: nextJob.library } : current));
    },
    onLog: (event) => {
      setJob((current) => mergeJobLog(current, event));
    },
  });

  useEffect(() => {
    if (!Object.keys(formValues).length) {
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewState("loading");
      try {
        const nextPreview = await fetchJson("/api/footage/preview", {
          method: "POST",
          body: JSON.stringify(formValues),
        });
        if (cancelled) {
          return;
        }
        setPreview(nextPreview);
        setPreviewError("");
        setPreviewState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPreviewError(error.message);
        setPreviewState("error");
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formValues]);

  useEffect(() => {
    const nextFramesDir = preview?.config?.framesDir;
    if (!nextFramesDir) {
      return;
    }
    setFormValues((current) => (
      current.framesDir === nextFramesDir
        ? current
        : { ...current, framesDir: nextFramesDir }
    ));
    setDefaults((current) => (
      current.framesDir === nextFramesDir
        ? current
        : { ...current, framesDir: nextFramesDir }
    ));
  }, [preview?.config?.framesDir]);

  useEffect(() => {
    const delay = job?.running ? 1800 : 5000;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextJob = await fetchJson("/api/footage/status");
        if (!cancelled) {
          setJob(nextJob);
          if (nextJob.running || job?.running) {
            setPreview((current) => (current ? { ...current, library: nextJob.library } : current));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ type: "error", message: error.message });
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job?.running, job?.jobId, job?.state]);

  const handleFieldChange = (name, value) => {
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleRun = async () => {
    setNotice({ type: "info", message: "Menjalankan ekstraksi frame..." });
    try {
      const nextJob = await fetchJson("/api/footage/extract", {
        method: "POST",
        body: JSON.stringify(formValues),
      });
      await fetchJson("/api/footage/activate", {
        method: "POST",
        body: JSON.stringify({ framesDir: nextJob.config?.framesDir || formValues.framesDir }),
      });
      setJob(nextJob);
      setPreview((current) => (current ? { ...current, library: nextJob.library } : current));
      setNotice({ type: "success", message: "Ekstraksi frame dimulai." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  const handleStop = async () => {
    try {
      const nextJob = await fetchJson("/api/footage/stop", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setJob(nextJob);
      setPreview((current) => (current ? { ...current, library: nextJob.library } : current));
      setNotice({ type: "info", message: "Permintaan stop dikirim." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  const handleRefresh = async () => {
    try {
      const [nextJob, nextPreview] = await Promise.all([
        fetchJson("/api/footage/status"),
        fetchJson("/api/footage/preview", {
          method: "POST",
          body: JSON.stringify(formValues),
        }),
      ]);
      setJob(nextJob);
      setPreview(nextPreview);
      setPreviewError("");
      setPreviewState("ready");
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  const handleImport = async () => {
    if (!selectedFiles.length) {
      setNotice({ type: "warning", message: "Pilih minimal satu file video sebelum import." });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("footageDir", formValues.footageDir || defaults.footageDir || "");
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const result = await fetchJson("/api/footage/import", {
        method: "POST",
        body: formData,
      });
      const [nextJob, nextPreview] = await Promise.all([
        fetchJson("/api/footage/status"),
        fetchJson("/api/footage/preview", {
          method: "POST",
          body: JSON.stringify(formValues),
        }),
      ]);

      setJob(nextJob);
      setPreview(nextPreview);
      setPreviewError("");
      setPreviewState("ready");
      setNotice({
        type: "success",
        message:
          result.skippedCount > 0
            ? `${result.importedCount} footage berhasil diimport, ${result.skippedCount} file dilewati.`
            : `${result.importedCount} footage berhasil diimport.`,
      });
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenLabeler = async () => {
    if (!activeFramesDir) {
      setNotice({ type: "warning", message: "Folder frame aktif belum tersedia." });
      return;
    }

    try {
      await fetchJson("/api/footage/activate", {
        method: "POST",
        body: JSON.stringify({ framesDir: activeFramesDir }),
      });
      if (typeof onNavigate === "function") {
        onNavigate("labeler");
        return;
      }
      window.location.assign("/");
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  const stateBadgeType =
    job?.state === "failed"
      ? "error"
      : job?.state === "finished"
        ? "success"
        : job?.running
          ? "warning"
          : "ghost";

  return (
    <div className="grid gap-4 pb-[160px] md:pb-[100px]">
      <section className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100/90 p-4 shadow-lg xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Badge type={stateBadgeType} className="px-4 py-3 text-xs font-bold uppercase">
            {job?.state || "idle"}
          </Badge>
          <div className="text-sm">
            <span className="font-semibold text-slate-900">
              {library?.footageDir || defaults.footageDir || "-"}
            </span>
            <span className="ml-2 text-slate-500">
              {job?.durationSeconds != null ? `${job.durationSeconds}s` : ""}
              {job?.returnCode != null ? ` • code ${job.returnCode}` : ""}
              {` • ${formatCount(library?.footageCount || 0, "footage")}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="info"
            isSubmit={false}
            size="sm"
            className="rounded-md px-5"
            disabled={Boolean(job?.running) || isConfigLoading}
            onClick={handleRun}
          >
            ▶ Ekstrak Frame
          </Button>
          <Button
            variant="error"
            outline
            isSubmit={false}
            size="sm"
            className="rounded-md px-4"
            disabled={!job?.running}
            onClick={handleStop}
          >
            ■ Stop
          </Button>
          <Button
            variant="ghost"
            isSubmit={false}
            size="sm"
            className="rounded-md border border-base-300 px-4"
            onClick={handleRefresh}
          >
            ↻ Refresh
          </Button>
        </div>
      </section>

      {runtimeWarnings.length > 0 && (
        <div className="grid gap-2">
          {runtimeWarnings.map((warning) => (
            <Alert key={warning} type="warning" className="rounded-md text-sm">
              {warning}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <FootageSidebar runtimePaths={runtimePaths} library={library} />

        <section className="grid gap-4">
          <FootageImportPanel
            fileInputRef={fileInputRef}
            selectedFiles={selectedFiles}
            isImporting={isImporting}
            targetDir={formValues.footageDir || defaults.footageDir || "-"}
            onFileChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            onImport={handleImport}
          />

          <FootageExtractPanel
            layout={layout}
            formValues={formValues}
            suggestions={suggestions}
            onFieldChange={handleFieldChange}
          />

        

          <FootageLibrary
            library={library}
            selectedFootage={selectedFootage}
            selectedFootagePath={selectedFootagePath}
            onSelectFootage={setSelectedFootagePath}
            onOpenLabeler={handleOpenLabeler}
          />
        </section>
      </div>

      <FootageLogs job={job} />
    </div>
  );
}
