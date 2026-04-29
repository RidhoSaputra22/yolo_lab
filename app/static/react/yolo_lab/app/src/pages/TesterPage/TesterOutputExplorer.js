import React, { useEffect, useState } from "react";
import { Alert, Badge, Card, Button, Paragraph } from "../../ui.js";
import { formatCount, joinClasses } from "../../shared/utils.js";
function SummaryMetrics({ summaryData }) {
    const faceRegistry = summaryData?.face_registry;
    if (!faceRegistry) {
        return null;
    }
    return (React.createElement("div", { className: "grid gap-3" }, faceRegistry ? (React.createElement("div", { className: "rounded-md border border-base-300 bg-base-200/40 p-4" },
        React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" },
            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700" }, "Registry Wajah"),
            React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, faceRegistry.source || "-")),
        React.createElement("div", { className: "mt-4 grid gap-3 md:grid-cols-4" }, [
            ["Identitas", faceRegistry.loaded_count ?? faceRegistry.registry_size ?? 0],
            ["Sampel", faceRegistry.sample_count ?? faceRegistry.image_count ?? 0],
            ["Skip no face", faceRegistry.skipped_no_face ?? 0],
            ["Skip error", faceRegistry.skipped_read_error ?? 0],
        ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-md border border-base-300 bg-base-100/80 p-3" },
            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
            React.createElement("p", { className: "mt-2 text-sm font-semibold text-slate-900" }, value))))))) : null));
}
function RunVideoPreview({ run }) {
    const initialPlaybackError = run.video?.videoPlayback && run.video.videoPlayback.playable === false
        ? run.video.videoPlayback.issue
        : "";
    const [playbackError, setPlaybackError] = useState(initialPlaybackError);
    useEffect(() => {
        setPlaybackError(run.video?.videoPlayback && run.video.videoPlayback.playable === false
            ? run.video.videoPlayback.issue
            : "");
    }, [run.video?.path, run.video?.videoPlayback?.playable, run.video?.videoPlayback?.issue]);
    if (!run.video?.downloadUrl) {
        return (React.createElement("div", { className: "grid aspect-video place-items-center border-b border-base-300 bg-slate-950 px-4 text-center text-sm text-slate-400" }, "File video belum tersedia untuk run ini."));
    }
    if (playbackError) {
        return (React.createElement("div", { className: "grid aspect-video place-items-center border-b border-base-300 bg-slate-950 px-6 text-center" },
            React.createElement("div", { className: "max-w-xl space-y-3" },
                React.createElement("p", { className: "text-base font-semibold text-slate-100" }, "Video belum bisa diputar di browser"),
                React.createElement("p", { className: "text-sm leading-6 text-slate-400" }, playbackError))));
    }
    return (React.createElement("div", { className: "border-b border-base-300 bg-slate-950" },
        React.createElement("video", { className: "aspect-video w-full bg-slate-950", controls: true, preload: "metadata", onError: () => setPlaybackError("Browser gagal memutar video ini. Codec video mungkin tidak didukung atau file output belum final.") },
            React.createElement("source", { src: run.video.downloadUrl, type: "video/mp4" }))));
}
/**
 * Output explorer and results viewer for TesterPage
 */
export function TesterOutputExplorer({ folders, selectedFolderKey, selectedFolder, job, onSelectFolder, }) {
    return (React.createElement("div", { className: "grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]" },
        React.createElement(Card, { className: "rounded-md border border-base-300 bg-base-100/90 shadow-xl" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700" }, "Output Explorer"),
                        React.createElement("h2", { className: "mt-2 text-xl font-bold tracking-tight" }, "Folder Output"),
                        React.createElement(Paragraph, { className: "mt-2 text-sm leading-6 opacity-100" }, "Pilih folder untuk melihat run video hasil test.")),
                    React.createElement("div", { className: "flex flex-wrap gap-2" },
                        React.createElement(Badge, { type: "success", className: "px-3 py-3" }, formatCount(folders.length, "folder")),
                        React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, formatCount((job?.artifacts || []).length, "file")))),
                React.createElement("div", { className: "grid gap-3" }, folders.length ? (folders.map((folder) => (React.createElement("button", { key: folder.key, type: "button", onClick: () => onSelectFolder(folder.key), className: joinClasses("rounded-md border p-4 text-left transition duration-150", folder.key === selectedFolderKey
                        ? "border-success bg-success/10 shadow-md"
                        : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20") },
                    React.createElement("div", { className: "flex items-start justify-between gap-3" },
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-sm font-semibold text-slate-900" }, folder.label),
                            React.createElement("p", { className: "mt-1 text-[11px] text-slate-500" }, folder.path)),
                        React.createElement(Badge, { type: folder.key === selectedFolderKey ? "success" : "ghost", className: "px-3 py-3" }, folder.runCount)),
                    React.createElement("div", { className: "mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500" },
                        React.createElement("span", null, formatCount(folder.fileCount, "file")),
                        React.createElement("span", null, folder.totalSizeLabel)),
                    React.createElement("p", { className: "mt-2 text-[11px] text-slate-400" }, folder.updatedAt))))) : (React.createElement(Alert, { type: "info", className: "rounded-md text-sm" }, "Belum ada folder output yang berisi artifact."))))),
        React.createElement(Card, { className: "rounded-md border border-base-300 bg-base-100/90 shadow-xl" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, "Hasil Per Run"),
                        React.createElement("h2", { className: "mt-2 text-xl font-bold tracking-tight" }, selectedFolder ? selectedFolder.label : "Belum ada folder")),
                    selectedFolder ? (React.createElement(Badge, { type: "info", className: "px-3 py-3" }, selectedFolder.totalSizeLabel)) : null),
                selectedFolder ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "grid gap-3 md:grid-cols-3" }, [
                        ["Run", formatCount(selectedFolder.runCount, "run")],
                        ["File", formatCount(selectedFolder.fileCount, "file")],
                        ["Updated", selectedFolder.updatedAt],
                    ].map(([label, value]) => (React.createElement("div", { key: label, className: "rounded-md border border-base-300 bg-base-200/50 p-3" },
                        React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" }, label),
                        React.createElement("p", { className: "mt-2 text-sm font-semibold text-slate-900" }, value))))),
                    React.createElement("div", { className: "grid gap-4" }, selectedFolder.runs.length ? (selectedFolder.runs.map((run) => (React.createElement("article", { key: run.key, className: "overflow-hidden rounded-md border border-base-300 bg-base-100 shadow-md" },
                        React.createElement(RunVideoPreview, { run: run }),
                        React.createElement("div", { className: "grid gap-4 p-5" },
                            React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
                                React.createElement("div", null,
                                    React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, run.key),
                                    React.createElement(Paragraph, { className: "mt-1 text-xs opacity-100" },
                                        selectedFolder.label,
                                        " \u2022 ",
                                        run.updatedAt)),
                                React.createElement(Badge, { type: "ghost", className: "px-3 py-3" }, run.totalSizeLabel)),
                            React.createElement("div", { className: "flex flex-wrap gap-2" },
                                React.createElement(Badge, { type: run.video?.videoPlayback?.playable === false
                                        ? "warning"
                                        : run.video
                                            ? "success"
                                            : "ghost", className: "px-3 py-3" }, run.video?.videoPlayback?.playable === false
                                    ? "Video belum final"
                                    : run.video
                                        ? "Video"
                                        : "Tanpa video"),
                                run.summary ? (React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, "Summary JSON")) : null,
                                run.tracks ? (React.createElement(Badge, { type: "info", className: "px-3 py-3" }, "Tracks CSV")) : null,
                                run.others.length ? (React.createElement(Badge, { type: "ghost", className: "px-3 py-3" },
                                    "+",
                                    run.others.length,
                                    " file")) : null),
                            React.createElement("div", { className: "flex flex-wrap gap-2" },
                                run.video?.downloadUrl ? (React.createElement(Button, { href: run.video.downloadUrl, variant: "primary", isSubmit: false, className: "rounded-md", target: "_blank", rel: "noreferrer" }, "Buka video")) : null,
                                run.summary?.downloadUrl ? (React.createElement(Button, { href: run.summary.downloadUrl, variant: "warning", isSubmit: false, className: "rounded-md", target: "_blank", rel: "noreferrer" }, "Summary JSON")) : null,
                                run.tracks?.downloadUrl ? (React.createElement(Button, { href: run.tracks.downloadUrl, variant: "info", isSubmit: false, className: "rounded-md", target: "_blank", rel: "noreferrer" }, "Tracks CSV")) : null,
                                run.others.map((artifact, index) => (React.createElement(Button, { key: artifact.path, href: artifact.downloadUrl, variant: "ghost", isSubmit: false, className: "rounded-md border border-base-300 bg-base-100", target: "_blank", rel: "noreferrer" },
                                    "File ",
                                    index + 1)))),
                            React.createElement(SummaryMetrics, { summaryData: run.summary?.summaryData })))))) : (React.createElement(Alert, { type: "info", className: "rounded-md text-sm" }, "Folder ini belum memiliki run yang bisa dirangkum."))))) : (React.createElement(Alert, { type: "info", className: "rounded-md text-sm" }, "Belum ada hasil test yang bisa ditampilkan."))))));
}
