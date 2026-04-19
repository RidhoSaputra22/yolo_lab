import React from "react";
export default function Paragraph({ children, className = "" }) {
    return React.createElement("p", { className: `text-sm opacity-70 ${className}` }, children);
}
