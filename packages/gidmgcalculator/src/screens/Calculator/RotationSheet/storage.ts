import type { IWorkbookData } from "@univerjs/presets";

export type RotationSheetSave = {
  version: 1;
  workbook: IWorkbookData;
  sourceRows: Record<string, number>;
};

const STORAGE_PREFIX = "gidmgcalculator.rotation-sheet.character.v1.";
const LEGACY_STORAGE_PREFIX = "gidmgcalculator.rotation-sheet.v1.";

function loadSave(key: string): RotationSheetSave | undefined {
  try {
    const value = localStorage.getItem(key);
    if (!value) return undefined;

    const parsed = JSON.parse(value) as RotationSheetSave;
    return parsed?.version === 1 && parsed.workbook && parsed.sourceRows
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export function loadRotationSheet(characterCode: number, legacySetupId: number): RotationSheetSave | undefined {
  const saved = loadSave(`${STORAGE_PREFIX}${characterCode}`);
  if (saved) return saved;

  const legacy = loadSave(`${LEGACY_STORAGE_PREFIX}${legacySetupId}`);
  if (legacy) saveRotationSheet(characterCode, legacy);
  return legacy;
}

export function saveRotationSheet(characterCode: number, value: RotationSheetSave) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${characterCode}`, JSON.stringify(value));
  } catch {
    // A full or unavailable storage backend must not break the calculator.
  }
}
