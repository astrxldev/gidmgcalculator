import type { CalcAspect } from "../../../logic/calculation";
import type { CalcResult, CalcResultItem } from "../../../logic/calculator";

export const SOURCE_SHEET = "Damage Data";
export const DAMAGE_ASPECTS = ["average", "base", "crit"] as const;
export const ASPECT_COLUMNS: Record<CalcAspect, number> = { average: 1, base: 2, crit: 3 };
const SUFFIXES: Record<CalcAspect, string> = { average: "Avg", base: "NonCrit", crit: "Crit" };
const SECTION_NAMES: Record<string, string> = {
  NAs: "Normal_Attack", ES: "Elemental_Skill", EB: "Elemental_Burst",
  WP: "Weapon", RXN: "Reaction", EXTRA: "Extra",
};

export function serializeSourceKey(source: { mainKey: string; subKey: string }) {
  return JSON.stringify([source.mainKey, source.subKey]);
}

export function damageValue(item: CalcResultItem | undefined, aspect: CalcAspect): number | undefined {
  if (!item) return undefined;
  if (item.type === "attack" || item.type === "reaction") {
    if (!item.results.length || Math.round(item.results[0][aspect]) === 0) return undefined;
    return item.results.reduce((total, part) => total + Math.round(part[aspect]), 0);
  }
  return aspect === "crit" ? undefined : Math.round(item.result) || undefined;
}

export function collectDamageSources(result: CalcResult, tables: { main: string; subs: string[] }[]) {
  return tables.flatMap(({ main, subs }) => subs.map((subKey, index) => ({
    key: serializeSourceKey({ mainKey: main, subKey }),
    aspects: DAMAGE_ASPECTS.map((aspect) => ({
      aspect,
      name: `${SECTION_NAMES[main]}_${index + 1}_${SUFFIXES[aspect]}`,
      value: damageValue(result[main as keyof CalcResult]?.get(subKey), aspect),
    })),
  })));
}

// Match complete references outside string literals. Ranges must retain their original shape.
export function replaceDamageReferences(formula: string, namesByRow: Record<number, string>) {
  return formula.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'!(?:\$?[A-Z]+\$?\d+)?/gi,
    (token, offset: number) => {
      const match = /^'Damage Data'!\$?B\$?(\d+)$/i.exec(token);
      if (!match) return token;
      const before = formula.slice(0, offset).trimEnd().slice(-1);
      const after = formula.slice(offset + token.length).trimStart();
      if (before === ":" || before === "]" || /[\w.!]/.test(before) || /^[:\w.(]/.test(after)) return token;
      return namesByRow[Number(match[1]) - 1] || token;
    });
}
