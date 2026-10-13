import type { CalcResult, CalcResultItem } from "../../../logic/calculator";
import { collectDamageSources, damageValue, replaceDamageReferences } from "./damageReferences";

const attack = {
  type: "attack",
  results: [
    { base: 10.4, crit: 20.6, average: 15.4 },
    { base: 5.4, crit: 10.6, average: 7.4 },
  ],
} as CalcResultItem;

describe("rotation damage references", () => {
  it("sums rounded parts separately for each aspect", () => {
    expect(damageValue(attack, "base")).toBe(15);
    expect(damageValue(attack, "crit")).toBe(32);
    expect(damageValue(attack, "average")).toBe(22);
    expect(damageValue({ ...attack, type: "reaction" } as CalcResultItem, "crit")).toBe(32);
  });

  it("keeps unavailable and non-damage crit values unavailable", () => {
    expect(damageValue(undefined, "average")).toBeUndefined();
    const healing = { type: "healing", result: 120.6 } as CalcResultItem;
    expect(damageValue(healing, "base")).toBe(121);
    expect(damageValue(healing, "average")).toBe(121);
    expect(damageValue(healing, "crit")).toBeUndefined();
    expect(damageValue({ ...attack, results: [{ base: 0, crit: 0, average: 0 }] } as CalcResultItem, "crit"))
      .toBeUndefined();
  });

  it("numbers displayed lines independently of result map order and missing rows", () => {
    const result = {
      NAs: new Map([["2-Hit", attack], ["1-Hit", attack]]),
      ES: new Map([["Skill DMG", attack]]),
      EB: new Map(),
      WP: new Map(),
      RXN: new Map(),
      EXTRA: new Map(),
    } as CalcResult;
    const sources = collectDamageSources(result, [
      { main: "NAs", subs: ["1-Hit", "Missing", "2-Hit"] },
      { main: "ES", subs: ["Skill DMG"] },
    ]);
    expect(sources.map((source) => source.aspects[0].name)).toEqual([
      "Normal_Attack_1_Avg", "Normal_Attack_2_Avg", "Normal_Attack_3_Avg", "Elemental_Skill_1_Avg",
    ]);
    expect(sources[0].aspects.map(({ name }) => name)).toEqual([
      "Normal_Attack_1_Avg", "Normal_Attack_1_NonCrit", "Normal_Attack_1_Crit",
    ]);
    expect(sources[1].aspects.every(({ value }) => value === undefined)).toBe(true);
  });

  const names = { 5: "Normal_Attack_1_Avg", 9: "Elemental_Skill_1_Avg" };
  it("converts combined and relative references without changing arithmetic", () => {
    expect(replaceDamageReferences("='Damage Data'!$B$6*3+'Damage Data'!B10", names))
      .toBe("=Normal_Attack_1_Avg*3+Elemental_Skill_1_Avg");
  });

  it.each([
    '=IF(A1="\'Damage Data\'!$B$6", "escaped ""\'Damage Data\'!$B$6""", 0)',
    "=SUM('Damage Data'!$B$6:$B$10)",
    "=SUM('Damage Data'!$B$6 : 'Damage Data'!$B$10)",
    "='Other'!$B$6+'Damage Data'!$C$6+'Damage Data'!$B$60",
    "='[External]Damage Data'!$B$6",
  ])("preserves strings, ranges, unrelated sheets, and unknown rows: %s", (formula) => {
    expect(replaceDamageReferences(formula, names)).toBe(formula);
  });
});
