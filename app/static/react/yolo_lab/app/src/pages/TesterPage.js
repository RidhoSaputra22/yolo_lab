import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button } from "../ui.js";
import { fetchJson } from "../shared/api.js";
import { mergeJobLog, useJobEventStream } from "../shared/jobStream.js";
import { formatCount, formatTimestamp, groupArtifactsByFolder } from "../shared/utils.js";
import { PREVIEW_DEBOUNCE_MS } from "../shared/formHelpers.js";
import { usePagePreferencesAutosave } from "../shared/pagePreferences.js";
import { useToast } from "../shared/toast.js";
import { TesterSidebar, TesterFormSection, TesterCommandPanel, TesterOutputExplorer, TesterLogs, } from "./TesterPage/index.js";
/**
 * TesterPage - Redesigned with top action bar and simplified layout.
 */
export default function TesterPage() {
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
    const [selectedFolderKey, setSelectedFolderKey] = useState("");
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const { setNotice } = useToast();
    const baseOutputDir = job?.outputDir || defaults.outputDir || "";
    const folders = useMemo(() => groupArtifactsByFolder(job?.artifacts || [], baseOutputDir), [job?.artifacts, baseOutputDir]);
    useEffect(() => {
        if (!folders.length) {
            setSelectedFolderKey("");
            return;
        }
        if (!folders.some((f) => f.key === selectedFolderKey)) {
            setSelectedFolderKey(folders[0].key);
        }
    }, [folders, selectedFolderKey]);
    const selectedFolder = folders.find((f) => f.key === selectedFolderKey) || folders[0] || null;
    const isFaceBenchmarkMode = formValues.testMode === "face-benchmark";
    const isVideoMode = formValues.testMode === "video";
    const usesLocalEmployeeFaces = formValues.testMode === "face-benchmark"
        || (formValues.testMode === "video"
            && Boolean(formValues.withFaceRecognition)
            && formValues.faceRegistrySource === "folder");
    const wantsEmployeeLabelingInVideo = isVideoMode && Boolean(formValues.withFaceRecognition);
    usePagePreferencesAutosave("tester", formValues, {
        enabled: !isConfigLoading && Object.keys(formValues).length > 0,
    });
    useEffect(() => {
        let cancelled = false;
        async function loadConfig() {
            setIsConfigLoading(true);
            try {
                const config = await fetchJson("/api/test/config");
                if (cancelled)
                    return;
                setLayout(config.layout || []);
                setSuggestions(config.suggestions || {});
                setDefaults(config.defaults || {});
                setFormValues(config.defaults || {});
                setRuntimePaths(config.paths || null);
                setRuntimeWarnings(config.runtimeWarnings || []);
                setPreview(config.preview || null);
                setPreviewError("");
                setPreviewState(config.preview?.commandDisplay ? "ready" : "idle");
                setJob(config.job || null);
            }
            catch (error) {
                if (!cancelled) {
                    setNotice({ type: "error", message: error.message });
                    setPreviewError(error.message);
                    setPreviewState("error");
                }
            }
            finally {
                if (!cancelled)
                    setIsConfigLoading(false);
            }
        }
        loadConfig();
        return () => { cancelled = true; };
    }, []);
    useJobEventStream("/api/test/stream", {
        onSnapshot: (nextJob) => {
            setJob(nextJob);
        },
        onLog: (event) => {
            setJob((current) => mergeJobLog(current, event));
        },
    });
    useEffect(() => {
        if (!Object.keys(formValues).length)
            return undefined;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setPreviewState("loading");
            try {
                const nextPreview = await fetchJson("/api/test/preview", {
                    method: "POST", body: JSON.stringify(formValues),
                });
                if (cancelled)
                    return;
                setPreview(nextPreview);
                setPreviewError("");
                setPreviewState("ready");
            }
            catch (error) {
                if (cancelled)
                    return;
                setPreviewError(error.message);
                setPreviewState("error");
            }
        }, PREVIEW_DEBOUNCE_MS);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [formValues]);
    useEffect(() => {
        const delay = job?.running ? 1800 : 5000;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const nextJob = await fetchJson("/api/test/status");
                if (!cancelled)
                    setJob(nextJob);
            }
            catch (error) {
                if (!cancelled)
                    setNotice({ type: "error", message: error.message });
            }
        }, delay);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [job?.running, job?.jobId, job?.state, job?.artifacts]);
    const handleFieldChange = (name, value) => {
        setFormValues((current) => ({ ...current, [name]: value }));
    };
    const handleRun = async () => {
        setNotice({ type: "info", message: "Menjalankan runner offline..." });
        try {
            const nextJob = await fetchJson("/api/test/run", { method: "POST", body: JSON.stringify(formValues) });
            setJob(nextJob);
            setNotice({ type: "success", message: "Runner berhasil dimulai." });
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const handleStop = async () => {
        try {
            const nextJob = await fetchJson("/api/test/stop", { method: "POST", body: JSON.stringify({}) });
            setJob(nextJob);
            setNotice({ type: "info", message: "Permintaan stop dikirim." });
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const handleRefresh = async () => {
        try {
            const nextJob = await fetchJson("/api/test/status");
            setJob(nextJob);
            setNotice(null);
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const stateBadgeType = job?.state === "failed" ? "error"
        : job?.state === "finished" ? "success"
            : job?.running ? "warning" : "ghost";
    return (React.createElement("div", { className: "grid gap-4 pb-[160px] md:pb-[100px]" },
        React.createElement("section", { className: "flex flex-col gap-3 rounded-sm border border-base-300 bg-base-100/90 p-4 shadow-lg xl:flex-row xl:items-center xl:justify-between" },
            React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
                React.createElement(Badge, { type: stateBadgeType, className: "px-4 py-3 text-xs font-bold uppercase" }, job?.state || "idle"),
                React.createElement("div", { className: "text-sm" },
                    React.createElement("span", { className: "font-semibold text-slate-900" }, job?.outputDir || defaults.outputDir || "-"),
                    React.createElement("span", { className: "ml-2 text-slate-500" },
                        job?.durationSeconds != null ? `${job.durationSeconds}s` : "",
                        job?.returnCode != null ? ` • code ${job.returnCode}` : "",
                        ` • ${formatCount((job?.artifacts || []).length, "artifact")}`))),
            React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                React.createElement(Button, { variant: "primary", isSubmit: false, size: "sm", className: "rounded-sm px-5", disabled: Boolean(job?.running) || isConfigLoading, onClick: handleRun }, "\u25B6 Jalankan Test"),
                React.createElement(Button, { variant: "error", outline: true, isSubmit: false, size: "sm", className: "rounded-sm px-4", disabled: !job?.running, onClick: handleStop }, "\u25A0 Stop"),
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-sm border border-base-300 px-4", onClick: handleRefresh }, "\u21BB Refresh"))),
        runtimeWarnings.length > 0 && (React.createElement("div", { className: "grid gap-2" }, runtimeWarnings.map((warning) => (React.createElement(Alert, { key: warning, type: "warning", className: "rounded-sm text-sm" }, warning))))),
        isFaceBenchmarkMode && (React.createElement(Alert, { type: "warning", className: "rounded-sm text-sm leading-6" }, "Mode ini tidak memakai footage input. Jika yang ingin diuji adalah video `footage` agar sistem mendeteksi visitor lalu melabeli petugas dari folder `petugas`, ubah `Mode test` ke `Video tracking + label petugas`.")),
        isVideoMode && !formValues.withFaceRecognition && (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm leading-6" }, "Untuk alur `YOLO -> tracking visitor -> label petugas dari folder petugas`, aktifkan section `Tracking Petugas` pada form ini.")),
        usesLocalEmployeeFaces && (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm leading-6" }, isFaceBenchmarkMode
            ? "Benchmark face recognition memakai gambar di folder petugas. Nama file dipakai sebagai label identitas; contoh `budi.png` atau `budi_2.png` akan dibaca sebagai `budi`."
            : "Pipeline video aktif: `YOLO -> tracking visitor -> cek wajah -> cocokkan ke folder petugas -> label petugas pada track yang match`. Pastikan folder berisi foto wajah yang cukup jelas agar face recognition bisa mengenali nama petugas dari nama file.")),
        wantsEmployeeLabelingInVideo && formValues.faceRegistrySource === "backend" && (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm leading-6" }, "Tracking petugas pada video sedang memakai registry dari backend. Jika ingin memaksa pembanding wajah dari folder lokal `petugas`, ubah `Sumber data petugas` menjadi `Folder lokal petugas`.")),
        React.createElement("div", { className: "grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]" },
            React.createElement(TesterSidebar, { runtimePaths: runtimePaths }),
            React.createElement("section", { className: "grid gap-4" },
                React.createElement(TesterFormSection, { layout: layout, formValues: formValues, suggestions: suggestions, onFieldChange: handleFieldChange }),
                React.createElement(TesterCommandPanel, { preview: preview, previewError: previewError, previewState: previewState, job: job, defaults: defaults }),
                React.createElement(TesterOutputExplorer, { folders: folders, selectedFolderKey: selectedFolderKey, selectedFolder: selectedFolder, job: job, onSelectFolder: setSelectedFolderKey }))),
        React.createElement(TesterLogs, { job: job })));
}
