import type { CalcResult } from "@/logic/calculator";

import { useTranslation } from "@/hooks";
import { attackCalcItemSubtitleParts, displayValues } from "./utils";

import { FinalResultLayout, type FinalResultLayoutProps } from "./FinalResultLayout";
import { useRotationSheetBridge } from "@/screens/Calculator/RotationSheet/context";

type FinalResultViewProps = Pick<
  FinalResultLayoutProps,
  "character" | "talentMutable" | "onTalentLevelChange" | "extraKeys"
> & {
  finalResult: CalcResult;
};

export function FinalResultView({ finalResult, ...props }: FinalResultViewProps) {
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
        const result = finalResult[mainKey][subKey];
        let title: string | undefined;

        switch (result?.type) {
          case "attack": {
            const parts = attackCalcItemSubtitleParts(result).map((part) => t(part));

            title = parts.join(" / ");
            break;
          }
          case "reaction": {
            title = t(`${result.attElmt}_attElmt`);
            break;
          }
          default: {
            break;
          }
        }

        return {
          title,
          cells: [
            {
              value: displayValues(result?.values, "base"),
              className: "text-right",
            },
            {
              value: displayValues(result?.values, "crit"),
              className: "text-right",
            },
            {
              value: displayValues(result?.values, "average"),
              className: `text-right text-primary-1${
                isPickingReference && result ? " cursor-pointer hover:bg-dark-2" : ""
              }`,
              title: isPickingReference ? "Insert this Average value into the Rotation Sheet" : undefined,
              onClick:
                isPickingReference && result
                  ? () => insertDamageReference?.({ mainKey, subKey })
                  : undefined,
            },
          ],
          onDoubleClick() {
            console.info(result);
          },
        };
      }}
    />
  );
}
