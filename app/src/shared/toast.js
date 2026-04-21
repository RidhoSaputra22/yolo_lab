import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastStack } from "../components/ToastStack.jsx";

const DEFAULT_TOAST_DURATION_MS = 3500;
const ToastContext = createContext(null);

function nextToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());
  const toastsRef = useRef([]);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const dismissToast = useCallback((toastId) => {
    const timerId = timeoutsRef.current.get(toastId);
    if (timerId) {
      window.clearTimeout(timerId);
      timeoutsRef.current.delete(toastId);
    }
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const scheduleDismiss = useCallback((toastId, durationMs = DEFAULT_TOAST_DURATION_MS) => {
    const previousTimerId = timeoutsRef.current.get(toastId);
    if (previousTimerId) {
      window.clearTimeout(previousTimerId);
    }
    const nextTimerId = window.setTimeout(() => {
      dismissToast(toastId);
    }, durationMs);
    timeoutsRef.current.set(toastId, nextTimerId);
  }, [dismissToast]);

  const pushToast = useCallback((notice) => {
    if (!notice?.message) {
      return null;
    }

    const message = String(notice.message).trim();
    if (!message) {
      return null;
    }

    const type = String(notice.type || "info").trim() || "info";
    const durationMs = Math.max(0, Number(notice.durationMs ?? DEFAULT_TOAST_DURATION_MS) || DEFAULT_TOAST_DURATION_MS);
    const existingToast = toastsRef.current.find((toast) => toast.type === type && toast.message === message);

    if (existingToast) {
      scheduleDismiss(existingToast.id, durationMs);
      return existingToast.id;
    }

    const toast = {
      id: nextToastId(),
      type,
      message,
      durationMs,
    };
    setToasts((current) => [toast, ...current]);
    scheduleDismiss(toast.id, durationMs);
    return toast.id;
  }, [scheduleDismiss]);

  const setNotice = useCallback((notice) => {
    if (!notice?.message) {
      return null;
    }
    return pushToast(notice);
  }, [pushToast]);

  useEffect(() => {
    return () => {
      for (const timerId of timeoutsRef.current.values()) {
        window.clearTimeout(timerId);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({
    dismissToast,
    pushToast,
    setNotice,
    toasts,
  }), [dismissToast, pushToast, setNotice, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast harus dipakai di dalam ToastProvider.");
  }
  return context;
}
