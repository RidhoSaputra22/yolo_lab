import React from "react";
import { PathInput } from "../../components/PathInput.jsx";
import { Alert, Button, Input, Modal, Paragraph } from "../../ui.js";

export function LabelerAutolabelModal({
  open,
  onClose,
  activeFramesDir,
  totalImages,
  currentImageName,
  autolabelConfig,
  autolabelSuggestions,
  autolabelWarnings,
  job,
  onAutolabelConfigChange,
  onAutolabelCurrent,
  onAutolabelAll,
}) {
  const modelValue = String(autolabelConfig.model || "");
  const isRunning = Boolean(job?.running);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Auto Labeling"
      size="xl"
      
      actions={(
        <>
          <Button
            variant="ghost"
            outline
            isSubmit={false}
            className="rounded-sm"
            onClick={onClose}
          >
            Tutup
          </Button>
          <Button
            variant="warning"
            outline
            isSubmit={false}
            className="rounded-sm"
            disabled={!currentImageName || !modelValue.trim() || isRunning}
            onClick={onAutolabelCurrent}
          >
            Auto-label frame ini
          </Button>
          <Button
            variant="warning"
            isSubmit={false}
            className="rounded-sm"
            disabled={!totalImages || !modelValue.trim() || isRunning}
            onClick={onAutolabelAll}
          >
            Auto-label semua frame
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Folder aktif
            </p>
            <strong className="mt-2 block break-all text-slate-900">
              {activeFramesDir || "-"}
            </strong>
          </div>
          <div className="rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total frame
            </p>
            <strong className="mt-2 block text-slate-900">
              {totalImages || 0}
            </strong>
          </div>
          <div className="rounded-sm border border-base-300 bg-base-200/40 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Frame aktif
            </p>
            <strong className="mt-2 block break-all text-slate-900">
              {currentImageName || "Belum ada"}
            </strong>
          </div>
        </div>

        <PathInput
          name="autolabel-model"
          label="Auto-label model"
          placeholder="model/yolo26x.pt"
          helpText="Path file `.pt` lokal atau nama model Ultralytics untuk membuat label awal otomatis. Model yang lebih cocok dengan domain data biasanya memberi box awal yang lebih rapi, tetapi hasilnya tetap perlu dicek manual."
          value={modelValue}
          onChange={(newValue) =>
            onAutolabelConfigChange({
              ...autolabelConfig,
              model: newValue,
            })
          }
          suggestions={autolabelSuggestions}
          disabled={isRunning}
        />

        <div className="rounded-sm border border-base-300 bg-base-200/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Tuning YOLO
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              name="autolabel-conf"
              label="Confidence threshold"
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              helpText="Naikkan jika box liar atau duplikat terlalu banyak. Turunkan jika banyak objek valid justru hilang."
              value={String(autolabelConfig.conf ?? "")}
              onChange={(event) =>
                onAutolabelConfigChange({
                  ...autolabelConfig,
                  conf: event.target.value,
                })
              }
              disabled={isRunning}
            />
            <Input
              name="autolabel-iou"
              label="IoU / NMS threshold"
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              helpText="Turunkan untuk NMS yang lebih agresif saat dua box saling tumpang tindih pada objek yang sama."
              value={String(autolabelConfig.iou ?? "")}
              onChange={(event) =>
                onAutolabelConfigChange({
                  ...autolabelConfig,
                  iou: event.target.value,
                })
              }
              disabled={isRunning}
            />
            <Input
              name="autolabel-imgsz"
              label="Image size"
              type="number"
              step="32"
              min="32"
              helpText="Ukuran inferensi YOLO saat auto-label. Nilai lebih besar membantu objek kecil tetapi proses jadi lebih berat."
              value={String(autolabelConfig.imgsz ?? "")}
              onChange={(event) =>
                onAutolabelConfigChange({
                  ...autolabelConfig,
                  imgsz: event.target.value,
                })
              }
              disabled={isRunning}
            />
            <Input
              name="autolabel-device"
              label="Device"
              placeholder="auto / cpu / cuda:0"
              helpText="Perangkat inferensi YOLO untuk auto-label."
              value={String(autolabelConfig.device ?? "")}
              onChange={(event) =>
                onAutolabelConfigChange({
                  ...autolabelConfig,
                  device: event.target.value,
                })
              }
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="rounded-sm border border-base-300 bg-base-200/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Filter Double Detect
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Aktifkan filter ini untuk membuang box person yang lebih kecil tetapi hampir seluruhnya
            menempel di dalam box person yang lebih besar, seperti kasus torso + full body pada orang yang sama.
          </p>

          <div className="mt-4 grid gap-4">
            <div className="form-control w-full">
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-base-300 bg-base-100/80 px-4 transition-colors hover:border-base-content/20">
                <input
                  type="checkbox"
                  name="autolabel-suppress-nested-duplicates"
                  checked={Boolean(autolabelConfig.suppressNestedDuplicates)}
                  className="checkbox checkbox-primary"
                  onChange={(event) =>
                    onAutolabelConfigChange({
                      ...autolabelConfig,
                      suppressNestedDuplicates: event.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <div className="text-sm text-base-content/80">
                  <p className="font-medium text-slate-900">Suppress nested duplicate person boxes</p>
                  <p className="text-xs text-slate-500">
                    Cocok untuk mengurangi double detect orang yang sama pada auto-labeling.
                  </p>
                </div>
              </label>
            </div>

            {Boolean(autolabelConfig.suppressNestedDuplicates) && (
              <Input
                name="autolabel-duplicate-containment-threshold"
                label="Duplicate containment threshold"
                type="number"
                step="0.01"
                min="0.5"
                max="1"
                helpText="Semakin kecil nilainya, filter makin agresif menganggap dua box sebagai duplikat nested."
                value={String(autolabelConfig.duplicateContainmentThreshold ?? "")}
                onChange={(event) =>
                  onAutolabelConfigChange({
                    ...autolabelConfig,
                    duplicateContainmentThreshold: event.target.value,
                  })
                }
                disabled={isRunning}
              />
            )}
          </div>
        </div>

        <div className="rounded-sm border border-base-300 bg-base-200/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Alur kerja
          </p>
          <Paragraph className="mt-2 text-sm leading-6 opacity-100">
            Gunakan tombol frame aktif untuk refresh label pada gambar yang sedang dibuka. Tombol semua
            frame akan memproses seluruh folder aktif dan melewati label yang sudah ada agar hasil manual
            tetap aman.
          </Paragraph>
        </div>

        {isRunning ? (
          <Alert type="info" className="rounded-sm text-sm">
            Auto-label sedang berjalan. Panel labeling dikunci sementara dan output proses bisa dipantau dari
            log runner di bawah.
          </Alert>
        ) : null}

        {autolabelWarnings.length ? (
          <Alert type="warning" className="rounded-sm text-sm">
            <div className="space-y-2">
              {autolabelWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
