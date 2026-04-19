import React from "react";
import { Alert, Badge, Button, Card, Input, Paragraph, Select } from "../../ui.js";
import { formatCount, joinClasses } from "../../shared/utils.js";
/**
 * Left sidebar component for LabelerPage
 * Shows dataset navigator, frames list, and summary stats
 */
export function LabelerSidebar({ images, visibleImages, currentImageName, filterValue, searchQuery, isLoading, onFilterChange, onSearchChange, onRefresh, onImageSelect, }) {
    const summaryCards = [
        { label: "Total frame", value: images.length },
        { label: "Sudah dilabel", value: images.filter((item) => item.hasLabelFile).length },
        {
            label: "Pending",
            value: images.length - images.filter((item) => item.hasLabelFile).length,
        },
        {
            label: "Total box",
            value: images.reduce((sum, item) => sum + Number(item.boxCount || 0), 0),
        },
    ];
    return (React.createElement("aside", { className: "grid h-fit gap-4 xl:sticky xl:top-28" },
        React.createElement(Card, { className: "rounded-sm border border-base-300 bg-base-100/90 shadow-lg" },
            React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "flex items-center justify-between gap-3" },
                    React.createElement("h3", { className: "text-lg font-bold" }, "Frames"),
                    React.createElement(Badge, { type: "info", className: "px-3 py-3" }, visibleImages.length)),
                React.createElement("div", { className: "max-h-[60vh] space-y-3 overflow-auto pr-1" }, visibleImages.length ? (visibleImages.map((item) => {
                    const itemState = item.parseError
                        ? { type: "error", label: "Label invalid" }
                        : item.hasLabelFile
                            ? { type: "success", label: "Ada file label" }
                            : { type: "ghost", label: "Belum ada file" };
                    return (React.createElement("button", { key: item.name, type: "button", onClick: () => onImageSelect(item.name), className: joinClasses("w-full rounded-sm border p-4 text-left transition duration-150", item.name === currentImageName
                            ? "border-warning bg-warning/10 shadow-md"
                            : "border-base-300 bg-base-100 hover:-translate-y-0.5 hover:border-base-content/20") },
                        React.createElement("div", { className: "flex items-start justify-between gap-3" },
                            React.createElement("p", { className: "break-all text-sm font-semibold text-slate-900" }, item.name),
                            React.createElement(Badge, { type: "warning", className: "px-3 py-3" }, item.boxCount || 0)),
                        React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" },
                            React.createElement(Badge, { type: itemState.type, className: "px-3 py-3" }, itemState.label),
                            item.isCheckpoint ? (React.createElement(Badge, { type: "warning", outline: true, className: "px-3 py-3" }, "Checkpoint")) : null)));
                })) : (React.createElement(Alert, { type: "info", className: "rounded-sm text-sm" }, "Tidak ada frame yang cocok dengan filter saat ini.")))))));
}
