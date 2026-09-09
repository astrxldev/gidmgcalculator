import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type DamageSourceKey = {
  mainKey: string;
  subKey: string;
};

type RotationSheetBridge = {
  isPickingReference: boolean;
  insertDamageReference?: (source: DamageSourceKey) => void;
  registerReferenceInserter: (inserter?: (source: DamageSourceKey) => void) => void;
  setPickingReference: (active: boolean) => void;
};

const EMPTY_BRIDGE: RotationSheetBridge = {
  isPickingReference: false,
  registerReferenceInserter: () => undefined,
  setPickingReference: () => undefined,
};

const RotationSheetContext = createContext<RotationSheetBridge>(EMPTY_BRIDGE);

export function RotationSheetProvider({ children }: { children: ReactNode }) {
  const [isPickingReference, setPickingReference] = useState(false);
  const [insertDamageReference, setInsertDamageReference] = useState<
    ((source: DamageSourceKey) => void) | undefined
  >();

  const registerReferenceInserter = useCallback(
    (inserter?: (source: DamageSourceKey) => void) => {
      setInsertDamageReference(() => inserter);
      if (!inserter) setPickingReference(false);
    },
    [],
  );

  const value = useMemo(
    () => ({
      isPickingReference,
      insertDamageReference,
      registerReferenceInserter,
      setPickingReference,
    }),
    [insertDamageReference, isPickingReference, registerReferenceInserter],
  );

  return <RotationSheetContext.Provider value={value}>{children}</RotationSheetContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRotationSheetBridge() {
  return useContext(RotationSheetContext);
}
