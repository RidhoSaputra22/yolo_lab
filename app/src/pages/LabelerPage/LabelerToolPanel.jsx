import React from "react";
import { Alert, Badge, Button, Paragraph, Select } from "../../ui.js";
import { LabelerSidebarSection } from "./LabelerSidebarSection.jsx";

/**
 * Right sidebar tool panel component for LabelerPage
 * Contains class selection, tools, undo, and box list
 */
export function LabelerToolPanel({
  classNames,
  selectedBox,
  selectedBoxId,
  activeClassId,
  dirty,
  boxes,
  currentImageName,
  undoStack,
  hasLabelFile,
  parseError,
  currentIsCheckpoint,
  checkpointImageName,
  zoomLabel,
  disabled = false,
  onSyncSelectedBoxClass,
  onUndo,
  onRemoveBox,
  onDuplicateBox,
  onClearAllBoxes,
  onReloadLabel,
  onBoxSelect,
}) {
  return (
    <div className="grid gap-4">
      <LabelerSidebarSection
        title="Class & Status"
        eyebrow="Annotator"
        description="Kelola class aktif, undo, dan utilitas frame dari satu panel ringkas."
        badge={
          <Badge type={dirty ? "warning" : "success"} className="px-3 py-3">
            {dirty ? "Belum disimpan" : "Sinkron"}
          </Badge>
        }
        defaultOpen
      >
        <div className="space-y-4">
          <Select
            name="active-class"
            label="Class aktif"
            value={String(selectedBox ? selectedBox.classId : activeClassId)}
            onChange={(event) => onSyncSelectedBoxClass(event.target.value)}
            options={classNames.map((name, index) => ({
              value: String(index),
              label: `${index} - ${name}`,
            }))}
            helpText="Class default untuk box baru. Jika ada box yang sedang dipilih, mengubah nilai ini juga akan mengganti class box tersebut."
            disabled={disabled}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!undoStack.length || disabled}
              onClick={onUndo}
            >
              Undo (Ctrl+Z)
            </Button>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!selectedBox || disabled}
              onClick={() => selectedBox && onRemoveBox(selectedBox.id)}
            >
              Hapus box (Del)
            </Button>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!selectedBox || disabled}
              onClick={onDuplicateBox}
            >
              Duplikat box
            </Button>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!boxes.length || disabled}
              onClick={() => {
                const ok = window.confirm("Hapus semua box pada frame ini?");
                if (ok) {
                  onClearAllBoxes();
                }
              }}
            >
              Kosongkan box
            </Button>
            <Button
              variant="ghost"
              isSubmit={false}
              size="sm"
              className="rounded-sm border border-base-300 bg-base-100"
              disabled={!currentImageName || disabled}
              onClick={onReloadLabel}
            >
              Reload label
            </Button>
          </div>

          <div className="grid gap-3">
            {[
              ["File label", hasLabelFile ? "Sudah ada" : "Belum ada"],
              ["Total box", String(boxes.length)],
              ["Checkpoint", currentIsCheckpoint ? "Frame ini" : checkpointImageName || "Belum diatur"],
              ["Zoom", zoomLabel],
              ["Undo", `${undoStack.length} langkah`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm"
              >
                <span className="text-slate-500">{label}</span>
                <strong className="max-w-[60%] break-all text-right text-slate-900">{value}</strong>
              </div>
            ))}
            {parseError ? (
              <Alert type="warning" className="rounded-sm text-sm">
                Label lama invalid, box dimulai kosong.
              </Alert>
            ) : null}
          </div>
        </div>
      </LabelerSidebarSection>

      <LabelerSidebarSection
        title="Boxes"
        eyebrow="Selection"
        description="Daftar box pada frame aktif untuk pindah seleksi dengan cepat."
        badge={
          <Badge type="warning" className="px-3 py-3">
            {boxes.length}
          </Badge>
        }
      >
        <div className="space-y-3">
          {currentImageName ? (
            boxes.length ? (
              boxes.map((box, index) => {
                const className = classNames[box.classId] || `class ${box.classId}`;
                return (
                  <button
                    key={box.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onBoxSelect(box.id)}
                    className={`w-full rounded-sm border bg-base-100 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      box.id === selectedBoxId
                        ? "border-warning bg-warning/10 shadow-md"
                        : "border-base-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Box {index + 1}</p>
                        <Paragraph className="mt-2 text-xs opacity-100">
                          x={Math.round(box.x)}, y={Math.round(box.y)}, w={Math.round(box.width)}, h=
                          {Math.round(box.height)}
                        </Paragraph>
                      </div>
                      <Badge type="info" className="px-3 py-3">
                        {className}
                      </Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <Alert type="info" className="rounded-sm text-sm">
                Belum ada box. Drag pada image untuk membuat box pertama.
              </Alert>
            )
          ) : (
            <Alert type="info" className="rounded-sm text-sm">
              Belum ada frame yang dibuka.
            </Alert>
          )}
        </div>
      </LabelerSidebarSection>

      <LabelerSidebarSection
        title="Petunjuk"
        eyebrow="Shortcut"
        description="Ringkasan gesture dan shortcut yang paling sering dipakai saat labeling."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Drag area kosong untuk membuat box baru.</li>
          <li>Klik box untuk pilih, lalu drag isi box untuk geser.</li>
          <li>Drag sudut atau sisi box untuk resize dari semua arah.</li>
          <li>
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Ctrl+Z</code> untuk undo,{" "}
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Ctrl+S</code> untuk simpan,{" "}
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Delete</code> untuk hapus box aktif.
          </li>
          <li>
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Arrow</code> untuk geser box 1 px,{" "}
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Shift+Arrow</code> untuk 10 px.
          </li>
          <li>
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Ctrl + scroll</code> untuk zoom,{" "}
            <code className="rounded-sm bg-base-200 px-2 py-1 text-xs">Ctrl+0</code> untuk kembali fit.
          </li>
          <li>Tombol duplikat membantu membuat box baru dari objek serupa dengan posisi awal yang sedikit digeser.</li>
          <li>Frame tanpa objek bisa disimpan sebagai label kosong.</li>
        </ul>
      </LabelerSidebarSection>
    </div>
  );
}
