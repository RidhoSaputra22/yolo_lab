import React from "react";
import { Badge, Card } from "../../ui.js";
import { MetricTile } from "../../components/MetricComponents.jsx";

/**
 * TrainingSidebar - Compact runtime config + dataset snapshot
 * Actions and warnings have been moved to the top toolbar.
 */
export function TrainingSidebar({ workspace, runtimePaths }) {
  return (
    <aside className="grid h-fit min-w-0 gap-4 xl:sticky xl:top-28">
      {/* Runtime config */}
      <Card className="min-w-0 rounded-md border border-base-300 bg-slate-900 text-slate-50 shadow-xl">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200">
              Runtime
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Training Workspace</h2>
          </div>

          <div className="grid gap-2 text-xs text-slate-200">
            {[
              ["Project", runtimePaths?.projectDir || "-"],
              ["Trainer", runtimePaths?.trainScript || "-"],
              ["Python", runtimePaths?.pythonBin || "-"],
              ["Runs Dir", runtimePaths?.defaultRunsDir || "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="text-wrap-anywhere mt-1 font-mono text-[11px] text-slate-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Frames" value={String(workspace?.frameCount ?? "-")} />
            <MetricTile label="Labels" value={String(workspace?.labelCount ?? "-")} />
          </div>
        </div>
      </Card>

      {/* Compact dataset snapshot */}
      <Card className="min-w-0 rounded-md border border-base-300 bg-base-100/90 shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Dataset</h3>
            <Badge type={workspace?.dataYamlExists ? "success" : "warning"} className="px-3 py-2">
              {workspace?.dataYamlExists ? "data.yaml ✓" : "cek dataset"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Train"
              value={String(workspace?.datasetTrainImages ?? "-")}
              detail={`${workspace?.datasetTrainLabels ?? "-"} label`}
            />
            <MetricTile
              label="Val"
              value={String(workspace?.datasetValImages ?? "-")}
              detail={`${workspace?.datasetValLabels ?? "-"} label`}
            />
          </div>

          <div className="rounded-md border border-base-300 bg-base-200/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/60">
              Class
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(workspace?.classNames || []).length ? (
                workspace.classNames.map((className) => (
                  <Badge key={className} type="warning" className="px-2 py-1">
                    {className}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-slate-400">Belum ada class</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </aside>
  );
}
