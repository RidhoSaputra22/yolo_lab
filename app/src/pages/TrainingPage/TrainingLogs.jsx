import React from "react";
import { LogDock } from "../../components/LogDock.jsx";

/**
 * Training logs display component
 * Shows stdout + stderr output from training process
 */
export function TrainingLogs({ job }) {
  return (
    <LogDock
      eyebrow="Log Training"
      title="stdout + stderr"
      emptyMessage="Belum ada proses training yang dijalankan."
      logs={job?.logs || []}
      state={job?.state || "idle"}
      running={Boolean(job?.running)}
      accentClass="text-amber-700"
    />
  );
}
