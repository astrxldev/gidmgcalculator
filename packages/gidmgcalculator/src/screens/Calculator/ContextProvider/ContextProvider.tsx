import { ReactNode } from "react";

import { RotationSheetProvider } from "../RotationSheet/context";

export function ContextProvider(props: { children: ReactNode }) {
  return <RotationSheetProvider>{props.children}</RotationSheetProvider>;
}
