import React from "react";
import { LogDock } from "../../components/LogDock.jsx";

export function FootageLogs({ job }) {
  return (
    <LogDock
      eyebrow="Log Extract"
      title="stdout + stderr"
      emptyMessage="Belum ada proses ekstraksi yang dijalankan."
      logs={job?.logs || []}
      state={job?.state || "idle"}
      running={Boolean(job?.running)}
      accentClass="text-amber-700"
    />
  );
}
