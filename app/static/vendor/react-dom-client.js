const ReactDOMGlobal = globalThis.ReactDOM;
if (!ReactDOMGlobal) {
  throw new Error("ReactDOM global belum termuat. Pastikan react-dom.development.js dimuat lebih dulu.");
}

export default ReactDOMGlobal;
export const { createRoot, flushSync, hydrateRoot, unstable_batchedUpdates } = ReactDOMGlobal;
