import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";

import type { CalcResult } from "@/logic/calculator";
import type { CalcResultItem } from "@/calculation/types";
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
    for (const [subKey, item] of Object.entries(group)) {
      if (!item) continue;

      const typedItem = item as CalcResultItem;
      damageByKey[serializeSourceKey({ mainKey, subKey })] = typedItem.values.reduce(
        (total: number, part: { average: number }) => total + Math.round(part.average),
        0,
      );
    }
  }

  return damageByKey;
}

export function RotationSheet() {
  const { setupId, result } = useShallowCalcStore((state) => ({
    setupId: state.activeId,
    result: selectSetup(state)?.result,
  }));
  const damageByKey = useMemo(() => (result ? collectAverageDamage(result) : {}), [result]);
  const { registerReferenceInserter, setPickingReference } = useRotationSheetBridge();

  const containerRef = useRef<HTMLDivElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<UniverApi>();
  const sourceRowsRef = useRef<Record<string, number>>({});
  const activeCellRef = useRef<ReturnType<NonNullable<ReturnType<UniverApi["getActiveWorkbook"]>>["getActiveCell"]>>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [activeCellLabel, setActiveCellLabel] = useState("A1");
  const [formulaInput, setFormulaInput] = useState("");

  const persist = useCallback(() => {
    const workbook = apiRef.current?.getActiveWorkbook();
    if (!workbook) return;

    saveRotationSheet(setupId, {
      version: 1,
      workbook: workbook.save(),
      sourceRows: sourceRowsRef.current,
    });
  }, [setupId]);

  const schedulePersist = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persist, 300);
  }, [persist]);

  useEffect(() => {
    if (!containerRef.current) return;

    const saved = loadRotationSheet(setupId);
    sourceRowsRef.current = saved?.sourceRows || {};

    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          header: false,
          toolbar: false,
          footer: false,
        }),
      ],
    });
    apiRef.current = univerAPI;

    const workbook = univerAPI.createWorkbook(saved?.workbook || { name: "Rotation" });
    const firstSheet = workbook.getSheets()[0];
    if (firstSheet && firstSheet.getSheetName() !== "Rotation") firstSheet.setName("Rotation");

    let sourceSheet = workbook.getSheetByName(SOURCE_SHEET);
    if (!sourceSheet) sourceSheet = workbook.insertSheet(SOURCE_SHEET);
    sourceSheet.hideSheet();
    if (firstSheet) workbook.setActiveSheet(firstSheet);

    const updateActiveCell = () => {
      const cell = workbook.getActiveCell();
      if (!cell || cell.getSheetName() === SOURCE_SHEET) return;

      activeCellRef.current = cell;
      setActiveCellLabel(cell.getA1Notation());
      const formula = cell.getFormula();
      setFormulaInput(formula || String(cell.getValue() ?? ""));
      setPickingReference(true);
    };

    updateActiveCell();
    const selectionDisposable = workbook.onSelectionChange(updateActiveCell);
    const commandDisposable = workbook.onCommandExecuted(schedulePersist);

    return () => {
      clearTimeout(saveTimerRef.current);
      const currentWorkbook = univerAPI.getActiveWorkbook();
      if (currentWorkbook) {
        saveRotationSheet(setupId, {
          version: 1,
          workbook: currentWorkbook.save(),
          sourceRows: sourceRowsRef.current,
        });
      }
      selectionDisposable.dispose();
      commandDisposable.dispose();
      apiRef.current = undefined;
      activeCellRef.current = undefined;
      univerAPI.dispose();
    };
  }, [schedulePersist, setPickingReference, setupId]);

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
