import React, { useEffect, useState } from "react";
import { joinClasses } from "../../shared/utils.js";
import { Badge } from "../../ui.js";

export function LabelerSidebarSection({
  title,
  eyebrow,
  description = null,
  badge = null,
  defaultOpen = false,
  className = "",
  contentClassName = "",
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  return (
    <details
      className={joinClasses(
        "yolo-card snap-start overflow-visible rounded-md border border-base-300 bg-base-100/90 shadow-lg",
        className,
      )}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                {eyebrow}
              </p>
            ) : null}
            <h3 className="mt-1 text-lg font-bold text-base-content">{title}</h3>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {badge}
            <Badge type="ghost" className="px-2 py-2">
              <span
                className={joinClasses(
                  "font-semibold",
                  open ? "rotate-180" : "rotate-0",
                )}
              >
                ▼
              </span>
            </Badge>
          </div>
        </div>
      </summary>

      <div
        className={joinClasses(
          "border-t border-base-300 px-4 py-4",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
