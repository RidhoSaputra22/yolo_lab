import React, { useEffect, useState } from "react";
import { Button, FieldLabel, Input, Modal } from "../ui.js";
import { fetchJson } from "../shared/api.js";
import { displayProjectPath, normalizeProjectRelativePath } from "../shared/formHelpers.js";

/**
 * PathInput - File/folder picker with text input
 *
 * Features:
 * - Text input with datalist suggestions
 * - Modal dialog for browsing file system
 * - Shows directory structure and navigation
 * - Returns displayPath format for consistency
 */
export function PathInput({
  name,
  label,
  value,
  suggestions = [],
  onChange,
  required = false,
  helpText = null,
  placeholder = "",
  disabled = false,
}) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRoot, setIsRoot] = useState(false);
  const [parentPath, setParentPath] = useState(null);
  const [rootName, setRootName] = useState("yolo_lab");
  const [selectedPath, setSelectedPath] = useState("");

  // Load directory contents when browser path changes
  useEffect(() => {
    if (!showBrowser) return;

    const loadPath = async () => {
      setLoading(true);
      setError("");
      try {
        const normalizedCurrentPath = normalizeProjectRelativePath(currentPath, rootName);
        const queryPath = normalizedCurrentPath
          ? `?path=${encodeURIComponent(normalizedCurrentPath)}`
          : "";
        const result = await fetchJson(`/api/files/browse${queryPath}`);
        const nextRootName = result.rootName || "yolo_lab";
        setCurrentPath(normalizeProjectRelativePath(result.currentPath, nextRootName));
        setEntries(result.entries || []);
        setIsRoot(result.isRoot);
        setParentPath(normalizeProjectRelativePath(result.parentPath, nextRootName));
        setRootName(nextRootName);
        setSelectedPath(normalizeProjectRelativePath(result.selectedPath, nextRootName));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPath();
  }, [showBrowser, currentPath]);

  const handleSelectPath = (path) => {
    const normalizedPath = normalizeProjectRelativePath(path, rootName);
    onChange(normalizedPath || rootName);
    setShowBrowser(false);
  };

  const handleNavigateTo = (dirPath) => {
    setCurrentPath(normalizeProjectRelativePath(dirPath, rootName));
  };

  const handleParentClick = () => {
    if (parentPath) {
      setCurrentPath(normalizeProjectRelativePath(parentPath, rootName));
    }
  };

  const displayCurrentPath = displayProjectPath(currentPath, rootName);

  return (
    <div>
      <FieldLabel htmlFor={name} label={label} required={required} helpText={helpText} />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <Input
            name={name}
            type="text"
            required={required}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            list={suggestions.length ? `suggestions-${name}` : undefined}
            disabled={disabled}
          />
        </div>
        <div>
          <Button
            type="button"
            size="md"
            variant="outline"
            onClick={() => {
              setCurrentPath(normalizeProjectRelativePath(value, rootName));
              setShowBrowser(true);
            }}
            className="w-full justify-center px-5 sm:w-auto sm:min-w-[108px]"
            disabled={disabled}
          >
            Browse
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <datalist id={`suggestions-${name}`}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}

      <Modal open={showBrowser} onClose={() => setShowBrowser(false)} title="Select Path">
        <div className="max-h-96 overflow-hidden flex flex-col">
          {/* Header: Current path and navigation */}
          <div className="border-b border-base-300 px-6 py-4">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-base-content/70">Current path:</p>
                <p className="text-sm font-mono break-all text-base-content">{displayCurrentPath}</p>
              </div>
              {!isRoot && parentPath && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleParentClick}
                  className="whitespace-nowrap"
                >
                  .. Parent
                </Button>
              )}
            </div>
          </div>

          {/* File browser: Entries list */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="rounded-md border border-error bg-error/10 p-3 text-sm text-error mb-4">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <span className="loading loading-spinner loading-sm"></span>
                <span className="ml-2 text-sm">Loading...</span>
              </div>
            )}

            {!loading && entries.length === 0 && !error && (
              <p className="text-sm text-base-content/60">Empty directory</p>
            )}

            {!loading && entries.length > 0 && (
              <div className="space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.path}
                    className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition ${
                      entry.path === selectedPath
                        ? "border-primary bg-primary/5"
                        : "border-base-300 bg-base-100 hover:border-primary hover:bg-primary/5"
                    }`}
                    onClick={() => {
                      if (entry.isDirectory) {
                        handleNavigateTo(entry.path);
                      } else {
                        handleSelectPath(entry.path);
                      }
                    }}
                  >
                    <div className="flex-shrink-0">
                      {entry.isDirectory ? (
                        <span className="text-lg">📁</span>
                      ) : (
                        <span className="text-lg">📄</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      {!entry.isDirectory && (
                        <p className="text-xs text-base-content/50">
                          {entry.size} bytes • {new Date(entry.modified).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: Action buttons */}
          <div className="border-t border-base-300 px-6 py-4 flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowBrowser(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSelectPath(currentPath)}
            >
              Select Current Path
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
