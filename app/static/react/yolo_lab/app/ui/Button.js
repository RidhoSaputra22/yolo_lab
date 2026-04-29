import React from "react";
/**
 * Button component styled after ui-laravel/button.blade.php
 * @param {object} props
 * @param {"primary"|"secondary"|"accent"|"ghost"|"link"|"info"|"success"|"warning"|"error"|"neutral"} props.variant
 * @param {"xs"|"sm"|"md"|"lg"} props.size
 * @param {boolean} props.outline
 * @param {boolean} props.loading
 * @param {string} props.href
 * @param {boolean} props.disabled
 * @param {boolean} props.isSubmit
 * @param {string} props.className
 * @param {string} props.toolTip
 * @param {"top"|"bottom"|"left"|"right"} props.toolTipPosition
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Button({ children, variant = "primary", size = "md", outline = false, loading = false, href = null, disabled = false, isSubmit = true, className = "", toolTip = "", toolTipPosition = "bottom", ...rest }) {
    const triggerRef = React.useRef(null);
    const tooltipRef = React.useRef(null);
    const tooltipId = React.useId();
    const [tooltipOpen, setTooltipOpen] = React.useState(false);
    const [tooltipStyle, setTooltipStyle] = React.useState(null);
    const { ["aria-label"]: ariaLabel, onMouseEnter, onMouseLeave, onFocus, onBlur, ...buttonProps } = rest;
    const variantClass = {
        primary: "btn-primary text-white",
        secondary: "btn-secondary text-white",
        accent: "btn-accent text-white",
        ghost: "btn-ghost text-base-content",
        link: "btn-link text-base-content",
        info: "btn-info text-white",
        success: "btn-success text-white",
        warning: "btn-warning text-white",
        error: "btn-error text-white",
        neutral: "btn-neutral text-white",
    }[variant] || "btn-primary text-white";
    const sizeClass = {
        xs: "btn-xs",
        sm: "btn-sm",
        md: "btn-md",
        lg: "btn-lg",
    }[size] || "";
    let classes = `flex btn ${variantClass} ${sizeClass} gap-2 justify-center`;
    if (outline)
        classes += " btn-outline";
    if (className)
        classes += ` ${className}`;
    const closeTooltip = () => {
        setTooltipOpen(false);
        setTooltipStyle(null);
    };
    const updateTooltipPosition = () => {
        if (!toolTip ||
            !triggerRef.current ||
            !tooltipRef.current ||
            typeof window === "undefined") {
            return;
        }
        const gap = 8;
        const viewportPadding = 12;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
        const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding);
        const centeredLeft = Math.min(Math.max(triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2, viewportPadding), maxLeft);
        const centeredTop = Math.min(Math.max(triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2, viewportPadding), maxTop);
        let left = centeredLeft;
        let top = triggerRect.bottom + gap;
        if (toolTipPosition === "top") {
            top =
                triggerRect.top - tooltipRect.height - gap >= viewportPadding
                    ? triggerRect.top - tooltipRect.height - gap
                    : Math.min(triggerRect.bottom + gap, maxTop);
        }
        else if (toolTipPosition === "bottom") {
            top =
                triggerRect.bottom + gap <= maxTop
                    ? triggerRect.bottom + gap
                    : Math.max(viewportPadding, triggerRect.top - tooltipRect.height - gap);
        }
        else if (toolTipPosition === "left") {
            left =
                triggerRect.left - tooltipRect.width - gap >= viewportPadding
                    ? triggerRect.left - tooltipRect.width - gap
                    : Math.min(triggerRect.right + gap, maxLeft);
            top = centeredTop;
        }
        else if (toolTipPosition === "right") {
            left =
                triggerRect.right + gap <= maxLeft
                    ? triggerRect.right + gap
                    : Math.max(viewportPadding, triggerRect.left - tooltipRect.width - gap);
            top = centeredTop;
        }
        setTooltipStyle({
            left: Math.min(Math.max(left, viewportPadding), maxLeft),
            top: Math.min(Math.max(top, viewportPadding), maxTop),
        });
    };
    React.useLayoutEffect(() => {
        if (!tooltipOpen) {
            return;
        }
        updateTooltipPosition();
    }, [tooltipOpen, toolTip, toolTipPosition]);
    React.useEffect(() => {
        if (!tooltipOpen || typeof window === "undefined") {
            return undefined;
        }
        const syncPosition = () => updateTooltipPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
        };
    }, [tooltipOpen, toolTip, toolTipPosition]);
    const handleMouseEnter = (event) => {
        if (toolTip) {
            setTooltipOpen(true);
        }
        onMouseEnter?.(event);
    };
    const handleMouseLeave = (event) => {
        closeTooltip();
        onMouseLeave?.(event);
    };
    const handleFocus = (event) => {
        if (toolTip) {
            setTooltipOpen(true);
        }
        onFocus?.(event);
    };
    const handleBlur = (event) => {
        closeTooltip();
        onBlur?.(event);
    };
    const content = (React.createElement(React.Fragment, null,
        loading && React.createElement("span", { className: "loading loading-spinner loading-sm" }),
        children));
    const tooltipNode = toolTip && tooltipOpen ? (React.createElement("span", { ref: tooltipRef, id: tooltipId, role: "tooltip", className: "pointer-events-none fixed z-[999] w-max max-w-[16rem] whitespace-normal rounded bg-slate-900 px-2 py-1 text-center text-xs font-medium leading-4 text-white shadow-lg", style: {
            left: tooltipStyle?.left ?? 12,
            top: tooltipStyle?.top ?? 12,
            opacity: tooltipStyle ? 1 : 0,
        } }, toolTip)) : null;
    const renderedTooltip = tooltipNode && globalThis.ReactDOM?.createPortal && typeof document !== "undefined"
        ? globalThis.ReactDOM.createPortal(tooltipNode, document.body)
        : tooltipNode;
    if (href) {
        return (React.createElement(React.Fragment, null,
            React.createElement("a", { ref: triggerRef, href: href, className: classes, "aria-disabled": disabled, "aria-label": ariaLabel || toolTip || undefined, "aria-describedby": tooltipOpen ? tooltipId : undefined, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onFocus: handleFocus, onBlur: handleBlur, ...buttonProps }, content),
            renderedTooltip));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("button", { ref: triggerRef, type: isSubmit ? "submit" : "button", className: classes, disabled: disabled || loading, "aria-busy": loading, "aria-label": ariaLabel || toolTip || undefined, "aria-describedby": tooltipOpen ? tooltipId : undefined, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onFocus: handleFocus, onBlur: handleBlur, ...buttonProps }, content),
        renderedTooltip));
}
