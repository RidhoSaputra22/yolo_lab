import React, { useEffect, useRef, useState } from "react";
import { Badge, Button } from "../ui.js";
import { formatCount, joinClasses } from "../shared/utils.js";

const LOG_DOCK_HEIGHT_VAR = "--yolo-log-dock-height";

function stateBadgeType(state, running) {
  if (state === "failed") {
    return "error";
  }
  if (state === "finished") {
    return "success";
  }
  if (running) {
    return "warning";
  }
  return "ghost";
}

export function LogDock({
  eyebrow,
  title,
  emptyMessage,
  logs = [],
  state = "idle",
  running = false,
  accentClass = "text-amber-700",
}) {
  const [collapsed, setCollapsed] = useState(true);
  const preRef = useRef(null);
  const dockRef = useRef(null);

  useEffect(() => {
    if (collapsed || !preRef.current) {
      return;
    }
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [collapsed, logs]);

  useEffect(() => {
    if (running) {
      setCollapsed(false);
    }
  }, [running]);

  useEffect(() => {
    const dockElement = dockRef.current;
    const rootStyle = document.documentElement.style;

    if (!dockElement) {
      rootStyle.setProperty(LOG_DOCK_HEIGHT_VAR, "0px");
      return undefined;
    }

    const updateDockHeight = () => {
      const nextHeight = Math.max(0, Math.round(dockElement.getBoundingClientRect().height));
      rootStyle.setProperty(LOG_DOCK_HEIGHT_VAR, `${nextHeight}px`);
    };

    updateDockHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        updateDockHeight();
      });
      observer.observe(dockElement);
      return () => {
        observer.disconnect();
        rootStyle.setProperty(LOG_DOCK_HEIGHT_VAR, "0px");
      };
    }

    window.addEventListener("resize", updateDockHeight);
    return () => {
      window.removeEventListener("resize", updateDockHeight);
      rootStyle.setProperty(LOG_DOCK_HEIGHT_VAR, "0px");
    };
  }, []);

  return (
    <div
      ref={dockRef}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/90 shadow-2xl backdrop-blur-xl"
    >
      <div className="w-full">
        <div className="overflow-hidden border border-base-300 bg-base-100/90 shadow-lg md:rounded-t-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className={joinClasses("text-[11px] font-semibold uppercase tracking-[0.28em]", accentClass)}>
                {eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge type={stateBadgeType(state, running)} className="px-3 py-3">
                {state}
              </Badge>
              <Badge type="ghost" className="px-3 py-3">
                {formatCount(logs.length, "line")}
              </Badge>
              <Button
                variant="ghost"
                isSubmit={false}
                size="sm"
                className="rounded-md border border-base-300 bg-base-100/80 px-4"
                onClick={() => setCollapsed((current) => !current)}
              >
                {collapsed ? "▲" : "▼"}
              </Button>
            </div>
          </div>

          {!collapsed && (
            <div className="border-t border-base-300 px-4 pb-4">
              <pre
                ref={preRef}
                className="yolo-code-panel max-h-[30vh] min-h-[160px] overflow-auto rounded-md p-4 text-xs leading-6 text-slate-100"
              >
                {logs.length ? logs.join("\n") : emptyMessage}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
