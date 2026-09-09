import { ReactNode } from "react";

import { ModalsProvider } from "./ModalsProvider";
import { SetupTransshiper } from "./SetupTransshiper";
import { RotationSheetProvider } from "../RotationSheet/context";

export function ContextProvider(props: { children: ReactNode }) {
  return (
    <RotationSheetProvider>
      <ModalsProvider>
        {props.children}
        <SetupTransshiper />
      </ModalsProvider>
    </RotationSheetProvider>
  );
}
