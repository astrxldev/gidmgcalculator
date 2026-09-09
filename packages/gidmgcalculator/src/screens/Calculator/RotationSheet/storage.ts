import type { IWorkbookData } from "@univerjs/presets";

export type RotationSheetSave = {
  version: 1;
  workbook: IWorkbookData;
  sourceRows: Record<string, number>;
};

const STORAGE_PREFIX = "gidmgcalculator.rotation-sheet.v1.";

export function loadRotationSheet(setupId: number): RotationSheetSave | undefined {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${setupId}`);
    if (!value) return undefined;

    const parsed = JSON.parse(value) as RotationSheetSave;
    return parsed.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveRotationSheet(setupId: number, value: RotationSheetSave) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${setupId}`, JSON.stringify(value));
  } catch {
    // A full or unavailable storage backend must not break the calculator.
  }
}
