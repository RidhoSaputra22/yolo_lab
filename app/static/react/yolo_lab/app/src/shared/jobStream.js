import { useEffect, useRef } from "react";
export function mergeJobLog(job, event) {
    if (!job || !event || job.jobId !== event.jobId) {
        return job;
    }
    const nextLogs = Array.isArray(job.logs) ? [...job.logs] : [];
    const trimmedCount = Math.max(0, Number(event.trimmedCount) || 0);
    if (trimmedCount > 0) {
        nextLogs.splice(0, Math.min(trimmedCount, nextLogs.length));
    }
    if (event.line) {
        nextLogs.push(event.line);
    }
    return {
        ...job,
        logs: nextLogs,
    };
}
export function useJobEventStream(url, { enabled = true, onSnapshot, onLog } = {}) {
    const snapshotRef = useRef(onSnapshot);
    const logRef = useRef(onLog);
    useEffect(() => {
        snapshotRef.current = onSnapshot;
    }, [onSnapshot]);
    useEffect(() => {
        logRef.current = onLog;
    }, [onLog]);
    useEffect(() => {
        if (!enabled || typeof EventSource === "undefined") {
            return undefined;
        }
        const source = new EventSource(url);
        const parseEventPayload = (event) => {
            try {
                return JSON.parse(event.data);
            }
            catch (error) {
                console.error(`[yolo-lab-app] gagal parse event stream ${url}:`, error);
                return null;
            }
        };
        const handleSnapshot = (event) => {
            const payload = parseEventPayload(event);
            if (payload) {
                snapshotRef.current?.(payload);
            }
        };
        const handleLog = (event) => {
            const payload = parseEventPayload(event);
            if (payload) {
                logRef.current?.(payload);
            }
        };
        source.addEventListener("snapshot", handleSnapshot);
        source.addEventListener("log", handleLog);
        source.onerror = () => { };
        return () => {
            source.removeEventListener("snapshot", handleSnapshot);
            source.removeEventListener("log", handleLog);
            source.close();
        };
    }, [enabled, url]);
}
