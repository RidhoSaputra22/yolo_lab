/**
 * TrainingPage - YOLO training orchestrator and status dashboard
 *
 * Redesigned layout:
 * - Top: Action toolbar + status + runtime warnings (inline)
 * - Sidebar: Compact runtime config + dataset snapshot
 * - Main: Form + command preview + run explorer + logs
 */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button } from "../ui.js";
import { fetchJson } from "../shared/api.js";
import { formatCount, formatTimestamp, joinClasses } from "../shared/utils.js";
import { noticeTone, PREVIEW_DEBOUNCE_MS } from "../shared/formHelpers.js";
import { TrainingSidebar, TrainingCommandPanel, TrainingRunExplorer, TrainingLogs, } from "./TrainingPage/index.js";
export default function TrainingPage() {
    const [layout, setLayout] = useState([]);
    const [suggestions, setSuggestions] = useState({});
    const [defaults, setDefaults] = useState({});
    const [formValues, setFormValues] = useState({});
    const [runtimePaths, setRuntimePaths] = useState(null);
    const [runtimeWarnings, setRuntimeWarnings] = useState([]);
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState("");
    const [previewState, setPreviewState] = useState("idle");
    const [job, setJob] = useState(null);
    const [notice, setNotice] = useState(null);
    const [selectedRunKey, setSelectedRunKey] = useState("");
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const workspace = job?.workspace || null;
    const runs = job?.runs || [];
    useEffect(() => {
        if (!runs.length) {
            setSelectedRunKey("");
            return;
        }
        if (!runs.some((run) => run.key === selectedRunKey)) {
            setSelectedRunKey(runs[0].key);
        }
    }, [runs, selectedRunKey]);
    const selectedRun = useMemo(() => runs.find((run) => run.key === selectedRunKey) || runs[0] || null, [runs, selectedRunKey]);
    const latestRun = runs[0] || null;
    useEffect(() => {
        let cancelled = false;
        async function loadConfig() {
            setIsConfigLoading(true);
            try {
                const config = await fetchJson("/api/train/config");
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
    useEffect(() => {
        if (!Object.keys(formValues).length)
            return;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setPreviewState("loading");
            try {
                const nextPreview = await fetchJson("/api/train/preview", {
                    method: "POST", body: JSON.stringify(formValues),
                });
                if (!cancelled) {
                    setPreview(nextPreview);
                    setPreviewError("");
                    setPreviewState("ready");
                }
            }
            catch (error) {
                if (!cancelled) {
                    setPreviewError(error.message);
                    setPreviewState("error");
                }
            }
        }, PREVIEW_DEBOUNCE_MS);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [formValues]);
    useEffect(() => {
        const delay = job?.running ? 1800 : 5000;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const nextJob = await fetchJson("/api/train/status");
                if (!cancelled)
                    setJob(nextJob);
            }
            catch (error) {
                if (!cancelled)
                    setNotice({ type: "error", message: error.message });
            }
        }, delay);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [job?.running, job?.jobId, job?.state]);
    const handleFieldChange = (name, value) => {
        setFormValues((current) => ({ ...current, [name]: value }));
    };
    const handleRun = async () => {
        setNotice({ type: "info", message: "Menjalankan prepare + training YOLO..." });
        try {
            const nextJob = await fetchJson("/api/train/run", { method: "POST", body: JSON.stringify(formValues) });
            setJob(nextJob);
            setNotice({ type: "success", message: "Prepare + training dimulai." });
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const handleStop = async () => {
        try {
            const nextJob = await fetchJson("/api/train/stop", { method: "POST", body: JSON.stringify({}) });
            setJob(nextJob);
            setNotice({ type: "info", message: "Permintaan stop dikirim." });
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const handleRefresh = async () => {
        try {
            const nextJob = await fetchJson("/api/train/status");
            setJob(nextJob);
            setNotice(null);
        }
        catch (error) {
            setNotice({ type: "error", message: error.message });
        }
    };
    const presetSummary = [
        ["Train model", preview?.config?.trainModel || defaults.trainModel || "-"],
        ["Frames dir", preview?.config?.framesDir || defaults.framesDir || "-"],
        ["Labels dir", preview?.config?.labelsDir || defaults.labelsDir || "-"],
        ["Dataset dir", preview?.config?.datasetDir || defaults.datasetDir || "-"],
        ["Val ratio", String(preview?.config?.valRatio ?? defaults.valRatio ?? "-")],
        ["Image size", String(preview?.config?.imgsz ?? defaults.imgsz ?? "-")],
        ["Epoch", String(preview?.config?.epochs ?? defaults.epochs ?? "-")],
        ["Batch", String(preview?.config?.batch ?? defaults.batch ?? "-")],
        ["Worker", String(preview?.config?.workers ?? defaults.workers ?? "-")],
        ["Patience", String(preview?.config?.patience ?? defaults.patience ?? "-")],
        ["Device", preview?.config?.device || defaults.device || "-"],
        ["Run name", preview?.config?.runName || defaults.runName || "-"],
    ];
    const stateBadgeType = job?.state === "failed" ? "error"
        : job?.state === "finished" ? "success"
            : job?.running ? "warning" : "ghost";
    return (React.createElement("div", { className: "grid gap-4" },
        React.createElement("section", { className: "flex flex-col gap-3 rounded-sm border border-base-300 bg-base-100/90 p-4 shadow-lg xl:flex-row xl:items-center xl:justify-between" },
            React.createElement("div", { className: "flex flex-wrap items-center gap-3" },
                React.createElement(Badge, { type: stateBadgeType, className: "px-4 py-3 text-xs font-bold uppercase" }, job?.state || "idle"),
                React.createElement("div", { className: "text-sm" },
                    React.createElement("span", { className: "font-semibold text-slate-900" }, job?.activeRunName || preview?.config?.runName || defaults.runName || "-"),
                    React.createElement("span", { className: "ml-2 text-slate-500" },
                        job?.durationSeconds != null ? `${job.durationSeconds}s` : "",
                        " \u2022 ",
                        formatCount(runs.length, "run")))),
            React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                React.createElement(Button, { variant: "warning", isSubmit: false, size: "sm", className: "rounded-sm px-5", disabled: Boolean(job?.running) || isConfigLoading, onClick: handleRun }, "\u25B6 Jalankan Training"),
                React.createElement(Button, { variant: "error", outline: true, isSubmit: false, size: "sm", className: "rounded-sm px-4", disabled: !job?.running, onClick: handleStop }, "\u25A0 Stop"),
                React.createElement(Button, { variant: "ghost", isSubmit: false, size: "sm", className: "rounded-sm border border-base-300 px-4", onClick: handleRefresh }, "\u21BB Refresh"))),
        notice?.message && (React.createElement(Alert, { type: noticeTone(notice.type), dismissible: true, className: "rounded-sm shadow-md" }, notice.message)),
        runtimeWarnings.length > 0 && (React.createElement("div", { className: "grid gap-2" }, runtimeWarnings.map((warning) => (React.createElement(Alert, { key: warning, type: "warning", className: "rounded-sm text-sm" }, warning))))),
        React.createElement("div", { className: "grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]" },
            React.createElement(TrainingSidebar, { workspace: workspace, runtimePaths: runtimePaths }),
            React.createElement("section", { className: "grid gap-4" },
                React.createElement(TrainingCommandPanel, { layout: layout, formValues: formValues, suggestions: suggestions, defaults: defaults, preview: preview, previewError: previewError, previewState: previewState, presetSummary: presetSummary, onFieldChange: handleFieldChange }),
                React.createElement(TrainingRunExplorer, { runs: runs, selectedRunKey: selectedRunKey, selectedRun: selectedRun, onSelectRun: setSelectedRunKey }),
                React.createElement(TrainingLogs, { job: job })))));
}
