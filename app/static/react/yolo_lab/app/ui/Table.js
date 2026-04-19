import React from "react";
/**
 * Reusable table using DaisyUI.
 * @param {string[]} columns   — header labels
 * @param {Array}    rows      — data arrays (each row = array of cells)
 * @param {string}   emptyText — shown when rows is empty
 */
export default function Table({ columns = [], rows = [], emptyText = "Tidak ada data.", }) {
    return (React.createElement("div", { className: "w-[80dvw] lg:w-full overflow-x-auto" },
        React.createElement("table", { className: "table table-zebra w-full" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "No."),
                    columns.map((col, i) => (React.createElement("th", { key: i }, col))))),
            React.createElement("tbody", null, rows.length === 0 ? (React.createElement("tr", null,
                React.createElement("td", { colSpan: columns.length + 1, className: "text-center opacity-60" }, emptyText))) : (rows.map((row, ri) => (React.createElement("tr", { key: ri, className: "hover" },
                React.createElement("td", null,
                    " ",
                    ri + 1,
                    " "),
                row.map((cell, ci) => (React.createElement("td", { key: ci }, cell)))))))))));
}
