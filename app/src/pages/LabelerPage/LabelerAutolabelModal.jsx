import React from "react";
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

        <Input
          name="autolabel-model"
          label="Auto-label model"
          placeholder="model/yolo26x.pt"
          helpText="Path file `.pt` lokal atau nama model Ultralytics untuk bootstrap label."
          value={modelValue}
          onChange={(event) =>
            onAutolabelConfigChange({
              ...autolabelConfig,
              model: event.target.value,
            })
          }
          list={autolabelSuggestions.length ? "autolabel-model-suggestions" : undefined}
          disabled={isRunning}
        />

        {autolabelSuggestions.length ? (
          <datalist id="autolabel-model-suggestions">
            {autolabelSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        ) : null}

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
