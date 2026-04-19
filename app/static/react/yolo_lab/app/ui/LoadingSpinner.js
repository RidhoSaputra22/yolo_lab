import React from "react";
export default function LoadingSpinner({ text = "Loading..." }) {
    return (React.createElement("div", { className: "flex flex-col items-center justify-center py-10" },
        React.createElement("span", { className: "loading loading-spinner loading-lg text-success" }),
        React.createElement("p", { className: "mt-3 text-sm opacity-70" }, text)));
}
