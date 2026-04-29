import React from "react";
import { Card } from "../../ui.js";

/**
 * TesterSidebar - Compact runtime config only.
 * Actions and warnings have been moved to the top toolbar.
 */
export function TesterSidebar({ runtimePaths }) {
  return (
    <aside className="grid h-fit gap-4 xl:sticky xl:top-28">
      <Card className="rounded-md border border-base-300 bg-slate-900 text-slate-50 shadow-xl">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200">
              Runtime
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Tester Workspace</h2>
          </div>

          {runtimePaths ? (
            <div className="grid gap-2 text-xs text-slate-200">
              {[
                ["Project", runtimePaths.projectDir],
                ["Runner", runtimePaths.runnerScript],
                ["Python", runtimePaths.pythonBin],
                ["Output", runtimePaths.defaultOutputDir],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300">Memuat runtime config...</p>
          )}
        </div>
      </Card>
    </aside>
  );
}
