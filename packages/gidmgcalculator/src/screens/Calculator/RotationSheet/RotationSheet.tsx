import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";

import type { CalcResult } from "@/logic/calculator";
import { useShallowCalcStore } from "@Store/calculator";
import { selectSetup } from "@Store/calculator/selectors";
import { useRotationSheetBridge, type DamageSourceKey } from "./context";
import { loadRotationSheet, saveRotationSheet } from "./storage";

import "@univerjs/preset-sheets-core/lib/index.css";

const SOURCE_SHEET = "Damage Data";

type UniverApi = ReturnType<typeof createUniver>["univerAPI"];

function serializeSourceKey(source: DamageSourceKey) {
  return JSON.stringify([source.mainKey, source.subKey]);
}

function collectAverageDamage(result: CalcResult) {
  const damageByKey: Record<string, number> = {};

  for (const [mainKey, group] of Object.entries(result)) {
    for (const [subKey, item] of group) {
      if (!item) continue;

      damageByKey[serializeSourceKey({ mainKey, subKey })] =
        item.type === "attack" || item.type === "reaction"
          ? item.results.reduce((total, part) => total + Math.round(part.average), 0)
          : Math.round(item.result);
    }
  }

  return damageByKey;
}

export function RotationSheet() {
  const { setupId, characterCode, result } = useShallowCalcStore((state) => ({
    setupId: state.activeId,
    characterCode: selectSetup(state)?.main.code,
    result: selectSetup(state)?.result,
  }));
  const damageByKey = useMemo(() => (result ? collectAverageDamage(result) : {}), [result]);
  const { registerReferenceInserter, setPickingReference } = useRotationSheetBridge();

  const legacySetupIdRef = useRef(setupId);
  legacySetupIdRef.current = setupId;

  const containerRef = useRef<HTMLDivElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<UniverApi>();
  const sourceRowsRef = useRef<Record<string, number>>({});
  const activeCellRef = useRef<ReturnType<NonNullable<ReturnType<UniverApi["getActiveWorkbook"]>>["getActiveCell"]>>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [activeCellLabel, setActiveCellLabel] = useState("A1");
  const [formulaInput, setFormulaInput] = useState("");

  useEffect(() => {
    let reopenFrame: number | undefined;

    const keepToolbarOverflowOpen = (event: MouseEvent) => {
      const moreButton = containerRef.current?.querySelector<HTMLButtonElement>(
        '[data-u-comp="ribbon-toolbar-more"] button[aria-expanded="true"]',
      );
      const popoverId = moreButton?.getAttribute("aria-controls");
      const target = event.target instanceof Element ? event.target : undefined;
      const popover = target?.closest<HTMLElement>('[data-slot="popover-content"]');

      if (
        !moreButton ||
        !popoverId ||
        popover?.id !== popoverId ||
        !target?.closest("[data-u-command]")
      ) {
        return;
      }

      // Univer closes the overflow popover after executing a toolbar command.
      // Restore it after that state update while leaving outside-click closing intact.
      if (reopenFrame !== undefined) cancelAnimationFrame(reopenFrame);
      reopenFrame = requestAnimationFrame(() => {
        reopenFrame = undefined;
        if (moreButton.isConnected && moreButton.getAttribute("aria-expanded") !== "true") {
          moreButton.click();
        }
      });
    };

    document.addEventListener("click", keepToolbarOverflowOpen, true);
    return () => {
      if (reopenFrame !== undefined) cancelAnimationFrame(reopenFrame);
      document.removeEventListener("click", keepToolbarOverflowOpen, true);
    };
  }, []);

  const persist = useCallback(() => {
    const workbook = apiRef.current?.getActiveWorkbook();
    if (!workbook || characterCode === undefined) return;

    saveRotationSheet(characterCode, {
      version: 1,
      workbook: workbook.save(),
      sourceRows: sourceRowsRef.current,
    });
  }, [characterCode]);

  const schedulePersist = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persist, 300);
  }, [persist]);

  useEffect(() => {
    if (!containerRef.current || characterCode === undefined) return;

    const saved = loadRotationSheet(characterCode, legacySetupIdRef.current);
    sourceRowsRef.current = saved?.sourceRows || {};

    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          header: true,
          toolbar: true,
          footer: {},
        }),
      ],
    });
    apiRef.current = univerAPI;

    const workbook = univerAPI.createWorkbook(saved?.workbook || { name: "Rotation" });
    const firstSheet = workbook.getSheets().find((sheet) => sheet.getSheetName() !== SOURCE_SHEET)
      || workbook.insertSheet("Rotation");
    if (firstSheet.getSheetName() !== "Rotation") firstSheet.setName("Rotation");
    if (firstSheet.isSheetHidden()) firstSheet.showSheet();

    let sourceSheet = workbook.getSheetByName(SOURCE_SHEET);
    if (!sourceSheet) sourceSheet = workbook.insertSheet(SOURCE_SHEET);
    if (!sourceSheet.isSheetHidden()) sourceSheet.hideSheet();
    workbook.setActiveSheet(firstSheet);

    const updateActiveCell = () => {
      const cell = workbook.getActiveCell();
      if (!cell || cell.getSheetName() === SOURCE_SHEET) return;

      activeCellRef.current = cell;
      setActiveCellLabel(cell.getA1Notation());
      const formula = cell.getFormula();
      setFormulaInput(formula || String(cell.getValue() ?? ""));
      setPickingReference(true);
    };

    const initializeSelection = () => {
      workbook.setActiveSheet(firstSheet);
      firstSheet.getRange("A1").activate();
      updateActiveCell();
    };
    const lifecycleDisposable = univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({ stage }) => {
      if (stage === univerAPI.Enum.LifecycleStages.Rendered) initializeSelection();
    });
    if (univerAPI.getCurrentLifecycleStage() >= univerAPI.Enum.LifecycleStages.Rendered) {
      initializeSelection();
    }
    const selectionDisposable = workbook.onSelectionChange(updateActiveCell);
    const commandDisposable = workbook.onCommandExecuted(schedulePersist);
    const flush = () => {
      clearTimeout(saveTimerRef.current);
      persist();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(saveTimerRef.current);
      const currentWorkbook = univerAPI.getActiveWorkbook();
      if (currentWorkbook) {
        saveRotationSheet(characterCode, {
          version: 1,
          workbook: currentWorkbook.save(),
          sourceRows: sourceRowsRef.current,
        });
      }
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lifecycleDisposable.dispose();
      selectionDisposable.dispose();
      commandDisposable.dispose();
      apiRef.current = undefined;
      activeCellRef.current = undefined;
      univerAPI.dispose();
    };
  }, [schedulePersist, persist, setPickingReference, characterCode]);

  useEffect(() => {
    const workbook = apiRef.current?.getActiveWorkbook();
    const sourceSheet = workbook?.getSheetByName(SOURCE_SHEET);
    if (!sourceSheet) return;

    const sourceRows = sourceRowsRef.current;
    for (const row of Object.values(sourceRows)) {
      sourceSheet.getRange(row, 1).setFormula("=NA()");
    }

    let nextRow = Math.max(0, ...Object.values(sourceRows)) + 1;
    for (const [key, value] of Object.entries(damageByKey)) {
      const row = sourceRows[key] ?? nextRow++;
      sourceRows[key] = row;
      sourceSheet.getRange(row, 0).setValue(key);
      sourceSheet.getRange(row, 1).setValue(value);
    }

    schedulePersist();
  }, [damageByKey, schedulePersist]);

  const insertDamageReference = useCallback(
    (source: DamageSourceKey) => {
      const key = serializeSourceKey(source);
      const row = sourceRowsRef.current[key];
      if (row === undefined) return;

      const reference = `'${SOURCE_SHEET}'!$B$${row + 1}`;
      setFormulaInput((current) => {
        const savedFormula = activeCellRef.current?.getFormula();
        const formulaStart = current.startsWith("=")
          ? current
          : savedFormula?.startsWith("=")
            ? savedFormula
            : "=";
        const nextFormula = `${formulaStart}${reference}`;
        activeCellRef.current?.setFormula(nextFormula);
        schedulePersist();
        return nextFormula;
      });
      requestAnimationFrame(() => formulaInputRef.current?.focus());
    },
    [schedulePersist],
  );

  useEffect(() => {
    registerReferenceInserter(insertDamageReference);
    return () => registerReferenceInserter(undefined);
  }, [insertDamageReference, registerReferenceInserter]);

  const applyFormula = (nextInput = formulaInput) => {
    const workbook = apiRef.current?.getActiveWorkbook();
    const currentCell = workbook?.getActiveCell();
    const cell =
      currentCell && currentCell.getSheetName() !== SOURCE_SHEET
        ? currentCell
        : activeCellRef.current;

    if (!cell) return;

    const input = nextInput.trim();
    if (input === "=") return;

    activeCellRef.current = cell;
    if (input.startsWith("=")) {
      cell.setFormula(input);
    } else if (input !== "" && Number.isFinite(Number(input))) {
      cell.setValue(Number(input));
    } else {
      cell.setValue(input);
    }

    setActiveCellLabel(cell.getA1Notation());
    setPickingReference(true);
    schedulePersist();
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div>
        <p className="font-bold text-center">Rotation Sheet</p>
        <p className="mt-1 text-xs text-light-hint text-center">
          Select a cell, then click an Avg. damage value in Results.
        </p>
      </div>

      <div className="shrink-0 flex gap-2">
        <span className="w-12 px-2 py-1 rounded bg-dark-2 text-center text-sm">{activeCellLabel}</span>
        <input
          ref={formulaInputRef}
          className="min-w-0 grow px-2 py-1 rounded bg-dark-2 border border-dark-line outline-none focus:border-active"
          aria-label="Rotation formula"
          value={formulaInput}
          onChange={(event) => {
            const value = event.target.value;
            setFormulaInput(value);
            setPickingReference(value.startsWith("="));
            applyFormula(value);
          }}
        />
        <span className="px-2 py-1 text-xs text-light-hint">Auto</span>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 grow overflow-hidden rounded"
        onKeyDownCapture={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;

          if (event.key === "=") {
            const cell = apiRef.current?.getActiveWorkbook()?.getActiveCell();
            if (cell && cell.getSheetName() !== SOURCE_SHEET) activeCellRef.current = cell;
            setFormulaInput("=");
            setPickingReference(true);
          } else if (event.key === "Backspace") {
            setFormulaInput((current) => current.slice(0, -1));
          } else if (event.key === "Enter" || event.key === "Escape") {
            setPickingReference(false);
          } else if (event.key.length === 1) {
            setFormulaInput((current) =>
              current.startsWith("=") ? `${current}${event.key}` : current,
            );
          }
        }}
      />
    </div>
  );
}
