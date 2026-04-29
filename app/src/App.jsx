import React, { useEffect, useMemo, useState } from "react";
import { Button } from "./ui.js";
import LabelerPage from "./pages/LabelerPage.jsx";
import FootagePage from "./pages/FootagePage.jsx";
import TesterPage from "./pages/TesterPage.jsx";
import TrainingPage from "./pages/TrainingPage.jsx";
import { joinClasses } from "./shared/utils.js";
import { ToastProvider } from "./shared/toast.js";

const ROUTES = {
  labeler: "/",
  footage: "/footage",
  tester: "/tester",
  training: "/training",
};

const NAV_ITEMS = [
  { route: "labeler", label: "Manual Labeler", variant: "primary" },
  { route: "footage", label: "Footage Dataset", variant: "info" },
  { route: "tester", label: "YOLO Tester", variant: "secondary" },
  { route: "training", label: "YOLO Training", variant: "warning" },
];

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
  const isLabelerRoute = route === "labeler";

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
            title: "Footage Dataset",
            description:
              "Preview video dataset di train/footage, import footage baru, lalu ekstrak frame dengan step yang bisa diatur sebelum lanjut ke labeling.",
          }
        : route === "tester"
        ? {
            eyebrow: "Offline Video Runner",
            title: "YOLO Tester",
            description:
              "Jalankan inferensi video offline, simpan output, dan cek artifact hasil tracking dari satu workspace.",
          }
        : route === "training"
          ? {
              eyebrow: "Dataset Training Pipeline",
              title: "YOLO Training",
              description:
                "Siapkan split dataset dari label aktif, preview command, lalu jalankan training YOLO dengan konfigurasi yang tersimpan.",
            }
          : {
              eyebrow: "Frame Annotation Workspace",
              title: "Manual Labeler",
              description:
                "Label bounding box frame CCTV secara manual dengan navigasi cepat, checkpoint, dan auto-label pendukung.",
            },
    [route],
  );

  return (
    <ToastProvider>
      <div
        className={joinClasses(
          isLabelerRoute ? "flex pb-32 flex-col overflow-hidden" : "min-h-screen",
          "yolo-app-shell text-base-content",
        )}
      >
        <header
          className="yolo-app-header sticky top-0 z-30 border-b border-base-300/70 bg-base-100/90 backdrop-blur-xl"
        >
          <div
            className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-6"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-2 xl:max-w-[560px] 2xl:max-w-4xl">
                <p className="yolo-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  {pageMeta.eyebrow}
                </p>
                <div className="max-w-4xl">
                  <h1 className="text-3xl font-bold tracking-tight text-base-content">
                    {pageMeta.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/70">
                    {pageMeta.description}
                  </p>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2 lg:justify-end">
                {NAV_ITEMS.map((item) => (
                  <Button
                    key={item.route}
                    variant={route === item.route ? item.variant : "ghost"}
                    isSubmit={false}
                    className={joinClasses(
                      "yolo-nav-button rounded-md px-4",
                      route !== item.route && "border border-base-300 bg-base-100/80",
                    )}
                    onClick={() => navigate(item.route)}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-[1800px] px-4 py-5 lg:px-6 lg:py-6"
        >
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
    </ToastProvider>
  );
}
