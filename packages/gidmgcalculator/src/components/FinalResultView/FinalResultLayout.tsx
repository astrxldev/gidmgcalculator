import { ReactNode, useMemo, useState } from "react";
import { CollapseSpace } from "rond";
import { MdContentCopy, MdCheck } from "react-icons/md";

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as any)) return extractText((node as any).props.children);
  return "";
}

import type { Character } from "@/models";
import type { LevelableTalentType } from "@/types";

import { useTranslation } from "@/hooks";
import { SectionHeader } from "./SectionHeader";
import { SectionTable } from "./SectionTable";
import { TalentSection } from "./TalentSection";
import { GetRowConfig, HeaderConfig } from "./types";
import { getTableKeys } from "./utils";

export type FinalResultLayoutProps = {
  character: Character;
  /** Default true */
  showTalentLv?: boolean;
  showWeaponCalc?: boolean;
  headerConfigs: HeaderConfig[];
  talentMutable?: boolean;
  extraKeys?: string[];
  getRowConfig: GetRowConfig;
  onTalentLevelChange?: (talentType: LevelableTalentType, newLevel: number) => void;
};

export function FinalResultLayout({
  character,
  showTalentLv = true,
  showWeaponCalc,
  talentMutable,
  extraKeys,
  onTalentLevelChange,
  ...sectionProps
}: FinalResultLayoutProps) {
  const { t } = useTranslation();

  const [closedSections, setClosedSections] = useState<boolean[]>([]);
  const [lvlingSectionI, setLvlingSectionI] = useState(-1);
  const [copiedIndex, setCopiedIndex] = useState(-1);

  const tableKeys = useMemo(() => {
    return getTableKeys(
      character.data.calcList,
      showWeaponCalc ? character.weapon.data.calcItems : undefined,
      extraKeys,
    );
  }, [character.code, character.weapon.code, showWeaponCalc, extraKeys]);

  const toggleSection = (index: number, forcedClosed?: boolean) => {
    const newClosed = forcedClosed ?? !closedSections[index];

    setClosedSections(Object.assign([...closedSections], { [index]: newClosed }));

    if (newClosed && index === lvlingSectionI) {
      setLvlingSectionI(-1);
    }
  };

  const onRequestChangeLevel = (index: number, isLvling: boolean) => {
    setLvlingSectionI(isLvling ? -1 : index);

    if (!isLvling && closedSections[index]) {
      toggleSection(index);
    }
  };

  const labelByMainKey = {
    WP: "Weapon",
    RXN: "Reaction",
    XTRA: "Extra",
  };

  return (
    <div className="flex flex-col gap-4">
      {tableKeys.map((tableKey, sectionIndex) => {
        switch (tableKey.main) {
          case "WP":
          case "RXN":
          case "XTRA": {
            const isReactionDmg = tableKey.main === "RXN";
            const sectionLabel = labelByMainKey[tableKey.main];

            if (tableKey.subs.length === 0) {
              return null;
            }

            const onCopy = () => {
              const headers = sectionProps.headerConfigs.map((config) => {
                const node = typeof config.content === "function" ? config.content(undefined) : config.content;
                return extractText(node as ReactNode);
              });

              const rows = tableKey.subs.map((subKey) => {
                const config = sectionProps.getRowConfig(tableKey.main, subKey);
                const label = isReactionDmg ? t(subKey) : subKey;
                const cellValues = config.cells.map((cell) => extractText(cell.value as ReactNode));
                return [label, ...cellValues].join("\t");
              });

              const tsv = [["", ...headers].join("\t"), ...rows].join("\n");
              void navigator.clipboard.writeText(tsv);
              setCopiedIndex(sectionIndex);
              setTimeout(() => setCopiedIndex(-1), 2000);
            };

            return (
              <div key={tableKey.main}>
                <SectionHeader
                  title={sectionLabel}
                  open={!closedSections[sectionIndex]}
                  onClickTitle={() => toggleSection(sectionIndex)}
                  extra={
                    <button
                      className="px-2 py-1 text-xs bg-dark-2 hover:bg-dark-3 rounded text-light-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy();
                      }}
                    >
                      {copiedIndex === sectionIndex ? <MdCheck /> : <MdContentCopy />}
                    </button>
                  }
                />

                <CollapseSpace active={!closedSections[sectionIndex]}>
                  <div className="pt-2 custom-scrollbar">
                    <SectionTable
                      tableKey={tableKey}
                      label={sectionLabel}
                      getRowTitle={(subKey) => (isReactionDmg ? t(subKey) : subKey)}
                      {...sectionProps}
                    />
                  </div>
                </CollapseSpace>
              </div>
            );
          }
          default: {
            const isLvling = sectionIndex === lvlingSectionI;
            const talentLevel = showTalentLv ? character.finalTalentLv(tableKey.main) : undefined;

            const onCopy = () => {
              const headers = sectionProps.headerConfigs.map((config) => {
                const node = typeof config.content === "function" ? config.content(tableKey.main) : config.content;
                return extractText(node as ReactNode);
              });

              const rows = tableKey.subs.map((subKey) => {
                const config = sectionProps.getRowConfig(tableKey.main, subKey);
                const cellValues = config.cells.map((cell) => extractText(cell.value as ReactNode));
                return [subKey, ...cellValues].join("\t");
              });

              const tsv = [["", ...headers].join("\t"), ...rows].join("\n");
              void navigator.clipboard.writeText(tsv);
              setCopiedIndex(sectionIndex);
              setTimeout(() => setCopiedIndex(-1), 2000);
            };

            return (
              <TalentSection
                key={tableKey.main}
                tableKey={tableKey}
                open={!closedSections[sectionIndex]}
                level={talentLevel}
                talentMutable={talentMutable}
                isLvling={isLvling}
                onRequestChangeLevel={() => onRequestChangeLevel(sectionIndex, isLvling)}
                onToggle={() => toggleSection(sectionIndex)}
                onLevelChange={(talent, level) => {
                  onTalentLevelChange?.(talent, level);
                  setLvlingSectionI(-1);
                }}
                onCopy={onCopy}
                copied={copiedIndex === sectionIndex}
                {...sectionProps}
              />
            );
          }
        }
      })}
    </div>
  );
}
