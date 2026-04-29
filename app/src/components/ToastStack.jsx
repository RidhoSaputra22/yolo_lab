import React from "react";
import { joinClasses } from "../shared/utils.js";

function ToastIcon({ type }) {
  if (type === "success") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0"
      >
        <path
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0"
      >
        <path
          d="M12 9v3.75m0 3h.008v.008H12v-.008Zm-8.25 3.3h16.5c1.35 0 2.192-1.462 1.515-2.632L13.515 4.418a1.75 1.75 0 0 0-3.03 0L2.235 16.668c-.677 1.17.165 2.632 1.515 2.632Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0"
      >
        <path
          d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0"
    >
      <path
        d="M11.25 11.25h1.5v5.25h-1.5v-5.25Zm0-3h1.5v1.5h-1.5v-1.5ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const toneClass = {
  info: "bg-info text-white ",
  success: "bg-success text-white ",
  warning: "bg-warning text-white ",
  error: "bg-error text-white ",
};

function ToastCard({ toast, onDismiss }) {
  const resolvedType = toast.type || "info";

  return (
    <div
      className={joinClasses(
        "pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-xl backdrop-blur-sm transition",
        toneClass[resolvedType] || toneClass.info,
      )}
      role={resolvedType === "error" ? "alert" : "status"}
    >
      <div className="mt-0.5">
        <ToastIcon type={resolvedType} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6">{toast.message}</p>
      </div>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md  text-sm font-semibold hover:border-current focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 "
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(toast.id)}
      >
        x
      </button>
    </div>
  );
}

export function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-0 z-[80] flex w-[min(430px,calc(100vw-2rem))] flex-col gap-3  "
      style={{
        bottom: "calc(var(--yolo-log-dock-height, 0px) + 10px)",
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
