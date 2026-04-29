import React, { useEffect, useState } from "react";
import { joinClasses } from "../../shared/utils.js";
import { Badge } from "../../ui.js";
export function LabelerSidebarSection({ title, eyebrow, description = null, badge = null, defaultOpen = false, className = "", contentClassName = "", children, }) {
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (defaultOpen) {
            setOpen(true);
        }
    }, [defaultOpen]);
    return (React.createElement("details", { className: joinClasses("snap-start overflow-visible rounded-md border border-base-300 bg-base-100/90 shadow-lg", className), open: open, onToggle: (event) => setOpen(event.currentTarget.open) },
        React.createElement("summary", { className: "cursor-pointer list-none px-4 py-4" },
            React.createElement("div", { className: "flex items-start justify-between gap-3" },
                React.createElement("div", { className: "min-w-0" },
                    eyebrow ? (React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700" }, eyebrow)) : null,
                    React.createElement("h3", { className: "mt-1 text-lg font-bold text-slate-900" }, title),
                    description ? (React.createElement("p", { className: "mt-2 text-sm leading-6 text-slate-600" }, description)) : null),
                React.createElement("div", { className: "flex items-center gap-2" },
                    React.createElement(Badge, null,
                        React.createElement("span", { className: joinClasses("font-semibold text-white ", open ? "rotate-180" : "rotate-0") }, "\u25BC"))))),
        React.createElement("div", { className: joinClasses("border-t border-base-300 px-4 py-4", contentClassName) }, children)));
}
