import { useState } from "react";

import { TOUR_STEP_ID } from "@/constants/ui";
import { useCalcStore } from "@Store/calculator";
import { useSettingsStore } from "@Store/settings";
import { updateUI } from "@Store/ui";

// Components
import { ContextProvider } from "../ContextProvider";
import { BottomNavSmall, BottomNavSmallProps } from "./BottomNavSmall";
import {
  ModifiersCard,
  OverviewCard,
  ResultsCard,
  RotationSheetCard,
  SetupCard,
} from "./CardComponents";

type CalculatorPanelType = "OVERVIEW" | "MODIFIERS" | "SETUP" | "RESULTS" | "ROTATION";

export function CalculatorSmall() {
  const touched = useCalcStore((state) => state.setupManagers.length !== 0);
  const isModernUI = useSettingsStore((state) => state.isTabLayout);

  const [activePanel, setActivePanel] = useState<CalculatorPanelType>("OVERVIEW");

  const handleSelectPanel = (type: CalculatorPanelType) => {
    setActivePanel(type);
    updateUI({ setupDirectorActive: false });
  };

  const panelOptions: BottomNavSmallProps<CalculatorPanelType>["options"] = [
    {
      id: TOUR_STEP_ID.overviewPanel,
      label: "Overview",
      value: "OVERVIEW",
    },
    {
      id: TOUR_STEP_ID.modifiersPanel,
      label: "Modifiers",
      value: "MODIFIERS",
    },
    {
      id: TOUR_STEP_ID.setupPanel,
      label: "Setup",
      value: "SETUP",
    },
    { label: "Results", value: "RESULTS" },
    { label: "Rotation", value: "ROTATION" },
  ];

  const activeIndex = panelOptions.findIndex((option) => option.value === activePanel) ?? 0;

  return (
    <ContextProvider>
      {isModernUI ? (
        <div className="h-full flex flex-col border-t border-dark-line">
          <div className="grow overflow-hidden relative">
            <div
              className="h-full overflow-auto flex absolute left-0 top-0"
              style={{ width: "500%", transform: `translateX(calc(-20% * ${activeIndex}))` }}
            >
              <OverviewCard touched={touched} className="w-1/5" />
              <ModifiersCard touched={touched} className="w-1/5" />
              <SetupCard touched={touched} className="w-1/5" />
              <ResultsCard touched={touched} className="w-1/5" />
              <RotationSheetCard touched={touched} className="w-1/5" />
            </div>
          </div>

          {touched ? (
            <BottomNavSmall
              value={activePanel}
              options={panelOptions}
              onSelect={(option) => handleSelectPanel(option.value)}
            />
          ) : null}
        </div>
      ) : (
        <div
          id={TOUR_STEP_ID.scrollCalculator}
          className="h-full flex hide-scrollbar border-t border-dark-line relative snap-x snap-mandatory"
        >
          <OverviewCard touched={touched} />
          <ModifiersCard touched={touched} />
          <SetupCard touched={touched} />
          <ResultsCard touched={touched} />
          <RotationSheetCard touched={touched} />
        </div>
      )}
    </ContextProvider>
  );
}
