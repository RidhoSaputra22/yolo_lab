import React from "react";
import { Card, Paragraph } from "../ui.js";
import { joinClasses } from "../shared/utils.js";

/**
 * Status metric card component used in dashboard/overview
 */
export function StatusMetric({ label, value, detail, tone = "" }) {
  return (
    <Card compact className="rounded-md border border-base-300 bg-base-100/90 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-base-content/60">
        {label}
      </p>
      <p className={joinClasses("mt-2 break-all text-sm font-semibold text-base-content", tone)}>
        {value}
      </p>
      <Paragraph className="mt-2 text-xs">{detail}</Paragraph>
    </Card>
  );
}

/**
 * Metric tile component for displaying key metrics
 */
export function MetricTile({ label, value, detail, tone = "", textColor = "" }) {
  return (
    <div className="yolo-muted-panel rounded-md border border-base-300 bg-base-200/40 p-3">
      <p className={joinClasses("text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/60", textColor)}>
        {label}
      </p>
      <p className={joinClasses("mt-2 text-base font-semibold text-base-content", tone)}>{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-base-content/60">{detail}</p> : null}
    </div>
  );
}
