import React from "react";
/**
 * Badge component styled after ui-laravel/badge.blade.php
 * @param {object} props
 * @param {"primary"|"secondary"|"accent"|"ghost"|"info"|"success"|"warning"|"error"|"neutral"} props.type
 * @param {"xs"|"sm"|"md"|"lg"} props.size
 * @param {boolean} props.outline
 * @param {string} props.className
 */
export default function Badge({ children, type = "primary", size = "md", outline = false, className = "", ...rest }) {
    const typeClass = {
        primary: "badge-primary",
        secondary: "badge-secondary",
        accent: "badge-accent",
        ghost: "badge-ghost",
        info: "badge-info",
        success: "badge-success",
        warning: "badge-warning",
        error: "badge-error",
        neutral: "badge-neutral",
    }[type] || "badge-primary";
    const sizeClass = {
        xs: "badge-xs",
        sm: "badge-sm",
        md: "",
        lg: "badge-lg",
    }[size] || "";
    let classes = `badge ${typeClass} ${sizeClass} inline-flex items-center justify-center whitespace-nowrap px-2 leading-none`;
    if (outline)
        classes += " badge-outline";
    if (className)
        classes += ` ${className}`;
    return (React.createElement("span", { className: classes, ...rest }, children));
}
