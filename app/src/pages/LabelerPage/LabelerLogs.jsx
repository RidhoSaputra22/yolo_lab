import React from "react";
import { Badge } from "../../ui.js";
import { formatCount } from "../../shared/utils.js";
import { LabelerSidebarSection } from "./LabelerSidebarSection.jsx";

export function LabelerLogs({ job }) {
  const logs = job?.logs || [];
  const state = job?.state || "idle";
  const running = Boolean(job?.running);
  const badgeType =
    state === "failed" ? "error" : state === "finished" ? "success" : running ? "warning" : "ghost";

  return (
    <LabelerSidebarSection
      title="stdout + stderr"
      eyebrow="Log Auto-Label"
      description="Pantau output runner auto-label langsung dari sidebar."
      badge={
        <div className="flex items-center gap-2">
          <Badge type={badgeType} className="px-3 py-3">
            {state}
          </Badge>
          <Badge type="ghost" className="px-3 py-3">
            {formatCount(logs.length, "line")}
          </Badge>
        </div>
      }
      defaultOpen={running}
    >
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-sm bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {logs.length ? logs.join("\n") : "Belum ada proses auto-label yang dijalankan."}
      </pre>
    </LabelerSidebarSection>
  );
}
