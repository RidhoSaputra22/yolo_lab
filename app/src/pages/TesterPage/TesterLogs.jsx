import React from "react";
import { Badge, Card } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";

/**
 * Logs display component for TesterPage
 */
export function TesterLogs({ job }) {
  return (
    <Card className="rounded-sm border border-base-300 bg-base-100/90 shadow-xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
              Log Runner
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight">stdout + stderr</h2>
          </div>
          <Badge type="ghost" className="px-3 py-3">
            {formatCount((job?.logs || []).length, "line")}
          </Badge>
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-sm bg-slate-950 p-5 text-xs leading-6 text-slate-100">
          {(job?.logs || []).length ? job.logs.join("\n") : "Belum ada proses yang dijalankan."}
        </pre>
      </div>
    </Card>
  );
}
