import React, { useEffect, useState } from "react";
import { Button, Input, Modal } from "../ui.js";
import { fetchJson } from "../shared/api.js";
/**
 * PathInput - File/folder picker with text input
 *
 * Features:
 * - Text input with datalist suggestions
 * - Modal dialog for browsing file system
 * - Shows directory structure and navigation
 * - Returns displayPath format for consistency
 */
export function PathInput({ name, label, value, suggestions = [], onChange, required = false, helpText = null, placeholder = "", }) {
    const [showBrowser, setShowBrowser] = useState(false);
    const [currentPath, setCurrentPath] = useState("");
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isRoot, setIsRoot] = useState(false);
    const [parentPath, setParentPath] = useState(null);
    // Load directory contents when browser path changes
    useEffect(() => {
        if (!showBrowser)
            return;
        const loadPath = async () => {
            setLoading(true);
            setError("");
            try {
                const queryPath = currentPath ? `?path=${encodeURIComponent(currentPath)}` : "";
                const result = await fetchJson(`/api/files/browse${queryPath}`);
                setCurrentPath(result.currentPath);
                setEntries(result.entries || []);
                setIsRoot(result.isRoot);
                setParentPath(result.parentPath);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        loadPath();
    }, [showBrowser, currentPath]);
    const handleSelectPath = (path) => {
        onChange(path);
        setShowBrowser(false);
    };
    const handleNavigateTo = (dirPath) => {
        setCurrentPath(dirPath);
    };
    const handleParentClick = () => {
        if (parentPath) {
            setCurrentPath(parentPath);
        }
    };
    return (React.createElement("div", null,
        React.createElement("div", { className: "flex gap-2" },
            React.createElement("div", { className: "flex-1" },
                React.createElement(Input, { name: name, label: label, type: "text", required: required, helpText: helpText, placeholder: placeholder, value: value, onChange: (event) => onChange(event.target.value), list: suggestions.length ? `suggestions-${name}` : undefined })),
            React.createElement("div", { className: "flex items-end" },
                React.createElement(Button, { type: "button", size: "sm", variant: "outline", onClick: () => {
                        setCurrentPath("");
                        setShowBrowser(true);
                    }, className: "mb-0" }, "Browse"))),
        suggestions.length > 0 && (React.createElement("datalist", { id: `suggestions-${name}` }, suggestions.map((item) => (React.createElement("option", { key: item, value: item }))))),
        React.createElement(Modal, { open: showBrowser, onClose: () => setShowBrowser(false), title: "Select Path" },
            React.createElement("div", { className: "max-h-96 overflow-hidden flex flex-col" },
                React.createElement("div", { className: "border-b border-base-300 px-6 py-4" },
                    React.createElement("div", { className: "flex items-center gap-2 justify-between" },
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("p", { className: "text-sm font-medium text-base-content/70" }, "Current path:"),
                            React.createElement("p", { className: "text-sm font-mono break-all text-base-content" }, currentPath)),
                        !isRoot && parentPath && (React.createElement(Button, { type: "button", size: "sm", variant: "outline", onClick: handleParentClick, className: "whitespace-nowrap" }, ".. Parent")))),
                React.createElement("div", { className: "flex-1 overflow-y-auto p-6" },
                    error && (React.createElement("div", { className: "rounded-sm border border-error bg-error/10 p-3 text-sm text-error mb-4" }, error)),
                    loading && (React.createElement("div", { className: "flex items-center justify-center py-8" },
                        React.createElement("span", { className: "loading loading-spinner loading-sm" }),
                        React.createElement("span", { className: "ml-2 text-sm" }, "Loading..."))),
                    !loading && entries.length === 0 && !error && (React.createElement("p", { className: "text-sm text-base-content/60" }, "Empty directory")),
                    !loading && entries.length > 0 && (React.createElement("div", { className: "space-y-1" }, entries.map((entry) => (React.createElement("div", { key: entry.path, className: "flex items-center gap-2 rounded-sm border border-base-300 bg-base-100 p-2 hover:border-primary hover:bg-primary/5 cursor-pointer transition", onClick: () => {
                            if (entry.isDirectory) {
                                handleNavigateTo(entry.path);
                            }
                            else {
                                handleSelectPath(entry.path);
                            }
                        } },
                        React.createElement("div", { className: "flex-shrink-0" }, entry.isDirectory ? (React.createElement("span", { className: "text-lg" }, "\uD83D\uDCC1")) : (React.createElement("span", { className: "text-lg" }, "\uD83D\uDCC4"))),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("p", { className: "text-sm font-medium truncate" }, entry.name),
                            !entry.isDirectory && (React.createElement("p", { className: "text-xs text-base-content/50" },
                                entry.size,
                                " bytes \u2022 ",
                                new Date(entry.modified).toLocaleDateString()))))))))),
                React.createElement("div", { className: "border-t border-base-300 px-6 py-4 flex gap-2 justify-end" },
                    React.createElement(Button, { type: "button", size: "sm", variant: "outline", onClick: () => setShowBrowser(false) }, "Cancel"),
                    React.createElement(Button, { type: "button", size: "sm", onClick: () => handleSelectPath(currentPath) }, "Select Current Path"))))));
}
