import type { CalcAspect } from "@/logic/calculation";
import { damageValue } from "@/screens/Calculator/RotationSheet/damageReferences";
import type { CalcResult } from "@/logic/calculator";

import { useTranslation } from "@/hooks";
import { attackCalcItemSubtitleParts, reactionCalcItemSubtitleParts } from "@/utils/ui.utils";
import { DEFAULT_RESULT_ITEM, displayResultItem } from "./utils";

import { FinalResultLayout, type FinalResultLayoutProps } from "./FinalResultLayout";
import { useRotationSheetBridge } from "@/screens/Calculator/RotationSheet/context";

type FinalResultViewProps = Pick<
  FinalResultLayoutProps,
  "character" | "talentMutable" | "onTalentLevelChange" | "extraKeys"
> & {
  calcResult: CalcResult;
};

export function FinalResultView({ calcResult, ...props }: FinalResultViewProps) {
  const { t } = useTranslation();
  const { insertDamageReference, isPickingReference } = useRotationSheetBridge();

  return (
    <FinalResultLayout
      {...props}
      showWeaponCalc
      headerConfigs={[
        {
          content: "Non-crit",
        },
        {
          content: "Crit",
        },
        {
          content: "Avg.",
          className: "text-primary-1",
        },
      ]}
      getRowConfig={(mainKey, subKey) => {
        const result = calcResult[mainKey].get(subKey);
        let title: string | undefined;

        switch (result?.type) {
          case "attack":
            title = attackCalcItemSubtitleParts(result)
              .map((part) => t(part))
              .join(" / ");
            break;
          case "reaction":
            title = reactionCalcItemSubtitleParts(result)
              .map((part) => t(part))
              .join(" / ");
            break;
          case "healing":
          case "shield":
          case "other":
            // No title for healing, shield, and other
            break;
          default: {
            result satisfies undefined;
          }
        }

        const values = result ? displayResultItem(result) : DEFAULT_RESULT_ITEM;

        return {
          title,
          cells: (["base", "crit", "average"] as const).map((aspect: CalcAspect) => {
            const selectable = isPickingReference && damageValue(result, aspect) !== undefined;
            const label = { base: "Non-crit", crit: "Crit", average: "Average" }[aspect];
            return {
              value: values[aspect],
              className: `text-right${aspect === "average" ? " text-primary-1" : ""}${
                selectable ? " cursor-pointer hover:bg-dark-2" : ""
              }`,
              title: selectable ? `Insert this ${label} value into the Rotation Sheet` : undefined,
              onClick: selectable
                ? () => insertDamageReference?.({ mainKey, subKey, aspect })
                : undefined,
            };
          }),
          onDoubleClick() {
            console.info(result);
          },
        };
      }}
    />
  );
}
