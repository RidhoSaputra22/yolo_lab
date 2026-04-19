import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Paragraph } from "./ui.js";
import LabelerPage from "./pages/LabelerPage.jsx";
import FootagePage from "./pages/FootagePage.jsx";
import TesterPage from "./pages/TesterPage.jsx";
import TrainingPage from "./pages/TrainingPage.jsx";
import { joinClasses } from "./shared/utils.js";

const ROUTES = {
  labeler: "/",
  footage: "/footage",
  tester: "/tester",
  training: "/training",
};

function routeFromPath(pathname) {
  if (pathname.startsWith("/footage")) {
    return "footage";
  }
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

  const pageMeta = useMemo(
    () =>
      route === "footage"
        ? {
            eyebrow: "Footage Dataset Workspace",
            title: "Footage Dataset React",
            description:
              "Preview video dataset di train/footage, import footage baru, lalu ekstrak frame dengan step yang bisa diatur sebelum lanjut ke labeling.",
          }
        : route === "tester"
        ? {
            eyebrow: "Offline Video Runner",
            title: "YOLO Tester React",
            description:
              "Jalankan runner test video, preview command, dan review hasil output per folder dalam app React yang berjalan di atas Bun.",
          }
        : route === "training"
          ? {
              eyebrow: "Dataset Training Pipeline",
              title: "YOLO Training React",
              description:
                "Bangun dataset dari label aktif lalu jalankan training YOLO tanpa auto-label ulang, lengkap dengan preview command dan monitoring run.",
            }
          : {
              eyebrow: "Frame Annotation Workspace",
              title: "Manual Labeler React",
              description:
                "Review frame, koreksi bounding box YOLO, dan simpan label langsung dari canvas interaktif dalam app React Bun.",
            },
    [route],
  );

  return (
    <div className="min-h-screen bg-white text-base-content">
      <header className="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge type="warning" className="gap-1 border-none px-3 py-3">
                  Train Toolkit
                </Badge>
                <Badge type="info" outline className="px-3 py-3">
                  React + Bun
                </Badge>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                  {pageMeta.eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {pageMeta.title}
                </h1>
                <Paragraph className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 opacity-100">
                  {pageMeta.description}
                </Paragraph>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              <Button
                variant={route === "labeler" ? "primary" : "ghost"}
                isSubmit={false}
                className={joinClasses(
                  "rounded-sm px-5",
                  route !== "labeler" && "border border-base-300 bg-base-100",
                )}
                onClick={() => navigate("labeler")}
              >
                Manual Labeler
              </Button>
              <Button
                variant={route === "footage" ? "info" : "ghost"}
                isSubmit={false}
                className={joinClasses(
                  "rounded-sm px-5",
                  route !== "footage" && "border border-base-300 bg-base-100",
                )}
                onClick={() => navigate("footage")}
              >
                Footage Dataset
              </Button>
              <Button
                variant={route === "tester" ? "secondary" : "ghost"}
                isSubmit={false}
                className={joinClasses(
                  "rounded-sm px-5",
                  route !== "tester" && "border border-base-300 bg-base-100",
                )}
                onClick={() => navigate("tester")}
              >
                YOLO Tester
              </Button>
              <Button
                variant={route === "training" ? "warning" : "ghost"}
                isSubmit={false}
                className={joinClasses(
                  "rounded-sm px-5",
                  route !== "training" && "border border-base-300 bg-base-100",
                )}
                onClick={() => navigate("training")}
              >
                YOLO Training
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-4 py-5 lg:px-6 lg:py-6">
        {route === "footage" ? (
          <FootagePage onNavigate={navigate} />
        ) : route === "tester" ? (
          <TesterPage onNavigate={navigate} />
        ) : route === "training" ? (
          <TrainingPage onNavigate={navigate} />
        ) : (
          <LabelerPage onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}
