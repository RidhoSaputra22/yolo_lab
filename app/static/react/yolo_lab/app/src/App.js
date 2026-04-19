import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Paragraph } from "./ui.js";
import LabelerPage from "./pages/LabelerPage.js";
import TesterPage from "./pages/TesterPage.js";
import TrainingPage from "./pages/TrainingPage.js";
import { joinClasses } from "./shared/utils.js";
const ROUTES = {
    labeler: "/",
    tester: "/tester",
    training: "/training",
};
function routeFromPath(pathname) {
    if (pathname.startsWith("/tester")) {
        return "tester";
    }
    if (pathname.startsWith("/training")) {
        return "training";
    }
    return "labeler";
}
export default function App() {
    const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
    useEffect(() => {
        const handlePopState = () => {
            setRoute(routeFromPath(window.location.pathname));
        };
        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);
    const navigate = (nextRoute) => {
        const nextPath = ROUTES[nextRoute];
        if (!nextPath) {
            return;
        }
        if (window.location.pathname !== nextPath) {
            window.history.pushState({}, "", nextPath);
        }
        setRoute(nextRoute);
    };
    const pageMeta = useMemo(() => route === "tester"
        ? {
            eyebrow: "Offline Video Runner",
            title: "YOLO Tester React",
            description: "Jalankan runner test video, preview command, dan review hasil output per folder dalam app React yang berjalan di atas Bun.",
        }
        : route === "training"
            ? {
                eyebrow: "Dataset Training Pipeline",
                title: "YOLO Training React",
                description: "Bangun dataset dari label aktif lalu jalankan training YOLO tanpa auto-label ulang, lengkap dengan preview command dan monitoring run.",
            }
            : {
                eyebrow: "Frame Annotation Workspace",
                title: "Manual Labeler React",
                description: "Review frame, koreksi bounding box YOLO, dan simpan label langsung dari canvas interaktif dalam app React Bun.",
            }, [route]);
    return (React.createElement("div", { className: "min-h-screen bg-white text-base-content" },
        React.createElement("header", { className: "sticky top-0 z-30 border-b border-base-300/70 bg-base-100/85 backdrop-blur-xl" },
            React.createElement("div", { className: "mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-6" },
                React.createElement("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between" },
                    React.createElement("div", { className: "space-y-2" },
                        React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                            React.createElement(Badge, { type: "warning", className: "gap-1 border-none px-3 py-3" }, "Train Toolkit"),
                            React.createElement(Badge, { type: "info", outline: true, className: "px-3 py-3" }, "React + Bun")),
                        React.createElement("div", null,
                            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700" }, pageMeta.eyebrow),
                            React.createElement("h1", { className: "mt-2 text-3xl font-bold tracking-tight text-slate-900" }, pageMeta.title),
                            React.createElement(Paragraph, { className: "mt-2 max-w-4xl text-sm leading-6 text-slate-600 opacity-100" }, pageMeta.description))),
                    React.createElement("nav", { className: "flex flex-wrap gap-2" },
                        React.createElement(Button, { variant: route === "labeler" ? "primary" : "ghost", isSubmit: false, className: joinClasses("rounded-sm px-5", route !== "labeler" && "border border-base-300 bg-base-100"), onClick: () => navigate("labeler") }, "Manual Labeler"),
                        React.createElement(Button, { variant: route === "tester" ? "secondary" : "ghost", isSubmit: false, className: joinClasses("rounded-sm px-5", route !== "tester" && "border border-base-300 bg-base-100"), onClick: () => navigate("tester") }, "YOLO Tester"),
                        React.createElement(Button, { variant: route === "training" ? "warning" : "ghost", isSubmit: false, className: joinClasses("rounded-sm px-5", route !== "training" && "border border-base-300 bg-base-100"), onClick: () => navigate("training") }, "YOLO Training"))))),
        React.createElement("main", { className: "mx-auto w-full max-w-[1800px] px-4 py-5 lg:px-6 lg:py-6" }, route === "tester" ? (React.createElement(TesterPage, { onNavigate: navigate })) : route === "training" ? (React.createElement(TrainingPage, { onNavigate: navigate })) : (React.createElement(LabelerPage, { onNavigate: navigate })))));
}
