import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
export default function HelpTooltip({ text, label }) {
    const tooltipId = useId();
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const updatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current || typeof window === "undefined") {
            return;
        }
        const gap = 10;
        const viewportPadding = 12;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
        const left = Math.min(Math.max(triggerRect.left, viewportPadding), maxLeft);
        const fitsBelow = triggerRect.bottom + gap + tooltipRect.height <= window.innerHeight - viewportPadding;
        const top = fitsBelow
            ? triggerRect.bottom + gap
            : Math.max(viewportPadding, triggerRect.top - tooltipRect.height - gap);
        setPosition({
            left,
            top,
        });
    };
    useLayoutEffect(() => {
        if (!open) {
            return;
        }
        updatePosition();
    }, [open, text]);
    useEffect(() => {
        if (!open || typeof window === "undefined") {
            return undefined;
        }
        const syncPosition = () => updatePosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
        };
    }, [open, text]);
    if (!text) {
        return null;
    }
    const tooltipNode = open ? (React.createElement("span", { ref: tooltipRef, className: "pointer-events-none fixed z-[999] w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-slate-100 shadow-xl", id: tooltipId, role: "tooltip", style: {
            left: position?.left ?? 12,
            top: position?.top ?? 12,
            opacity: position ? 1 : 0,
        } }, text)) : null;
    return (React.createElement("span", { className: "inline-flex shrink-0 align-middle", onMouseEnter: () => setOpen(true), onMouseLeave: () => {
            setOpen(false);
            setPosition(null);
        } },
        React.createElement("button", { ref: triggerRef, type: "button", "aria-describedby": open ? tooltipId : undefined, "aria-label": `Info ${label}`, className: `inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border bg-base-200 text-[11px] font-bold leading-none transition-colors duration-150 ${open
                ? "border-amber-500 text-amber-700"
                : "border-base-300 text-base-content/60"}` }, "i"),
        globalThis.ReactDOM?.createPortal && typeof document !== "undefined"
            ? globalThis.ReactDOM.createPortal(tooltipNode, document.body)
            : tooltipNode));
}
