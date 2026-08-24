# Genshin Calculator Implementation and Production Deployment Runbook

## AI Execution Contract

When this file is given to an AI, execute every applicable instruction exactly as written.

- Work from the repository root unless a step specifies another directory.
- Do not replace the requested behavior with a different design.
- Do not skip the `ron-utils` or `rond` library builds.
- Do not deploy until the production bundle renders successfully in a browser without an application exception.
- Do not use a Git branch argument for the final Cloudflare production upload.
- A `*.gidmgcalculator.pages.dev` hash URL or branch alias is not proof of production. Confirm the deployment environment is `Production`.
- Production is complete only when both `https://gidmgcalculator.pages.dev` and `https://gidmgcal.gunshiz.top` serve the new hashed JavaScript asset.

---

# Artifact Substats Control - Implementation Reference

This document outlines the exact implementation details for the "Artifact Substats Control" dual-input system. Use this as a perfect reference for replicating the exact same logic, formula parsing, and UI in the future.

## 1. Substat Base Values Data
First, define the core values for substat calculations based on artifact rarity.

```typescript
const SUBSTAT_BASE_VALUES: Record<number, Record<string, number>> = {
  5: { hp_: 4.96, hp: 253.94, atk_: 4.96, atk: 16.54, def_: 6.2, def: 19.68, em: 19.82, cRate_: 3.31, cDmg_: 6.62, er_: 5.51 },
  4: { hp_: 3.97, hp: 203.15, atk_: 3.97, atk: 13.23, def_: 4.96, def: 15.74, em: 15.86, cRate_: 2.65, cDmg_: 5.3, er_: 4.41 }
};
```

## 2. Dual-Input UI Layout
The substat row should contain a primary `InputNumber` for the absolute value, followed by a vertical separator, and a secondary native `<input>` for the multiplier/formula.

```tsx
<div key={i} className="h-9 flex-center bg-dark-2 relative">
  <VersatileSelect
    title="Select Sub-stat"
    className={[
      "w-44 h-full",
      statTypeCount[type] === 1 ? "text-light-1" : "text-danger-2",
    ]}
    transparent
    arrowAt="start"
    options={ARTIFACT_SUBSTAT_TYPES.map((type) => ({ label: t(type), value: type }))}
    value={type}
    onChange={(value) => onChangeSubStat?.(i, { type: value })}
  />
  <span>+</span>
  <InputNumber
    transparent
    className={`w-14 h-full pt-1.5 ${isValid ? "text-light-1" : "text-danger-2"}`}
    maxDecimalDigits={1}
    value={value}
    onChange={(value) => onChangeSubStat?.(i, { value })}
    onKeyDown={onKeyDownValue(i)}
  />
  <span className="w-4 pt-2 pb-1">{suffixOf(type)}</span>

  <div className="mx-1 h-1/2 w-px bg-dark-1" />

  <input
    key={value}
    type="number"
    defaultValue={(() => {
      const base = SUBSTAT_BASE_VALUES[rarity]?.[type];
      if (base && value > 0) return Math.round(value / base) || "";
      return "";
    })()}
    placeholder={`${SUBSTAT_BASE_VALUES[rarity]?.[type] || ""}`}
    className="w-16 h-full bg-transparent text-sm text-center outline-none border-none placeholder:text-light-1/20 text-light-1"
    onChange={(e) => {
      const input = e.target.value.trim();

      const formulaMatch = input.match(/^(\d+)x([\d.]+)%?$/);
      if (formulaMatch) {
        const multiplier = parseInt(formulaMatch[1]);
        const base = parseFloat(formulaMatch[2]);
        if (!isNaN(multiplier) && !isNaN(base)) onChangeSubStat?.(i, { value: multiplier * base });
      }
      else if (/^\d+$/.test(input)) {
        const multiplier = parseInt(input);
        const base = SUBSTAT_BASE_VALUES[rarity]?.[type];
        if (!isNaN(multiplier) && base) onChangeSubStat?.(i, { value: multiplier * base });
      }
    }}
  />
</div>
```

## 3. Footer Sum (Substat Rolls Counter)
Below the mapped list of substats, display the total roll count by dividing each substat's absolute value by its base value and summing them up.

```tsx
{mutable && (
  <div className="flex justify-end pr-2 text-sm text-light-1/50">
    <span>
      {subStats.reduce((acc, { type, value }) => {
        const base = SUBSTAT_BASE_VALUES[rarity]?.[type];
        return acc + (base && value > 0 ? Math.round(value / base) : 0);
      }, 0)} substats
    </span>
  </div>
)}
```

## Key Things to Note
- **State Updates**: Both inputs call the exact same `onChangeSubStat(index, { value })` function, keeping everything strictly synced.
- **`key={value}` Trick**: The native input uses `key={value}` so that it re-renders entirely when the primary value changes, ensuring the `defaultValue` stays correctly synced.
- **Input Type Note**: The secondary input is `type="number"`. Be aware that native HTML `number` inputs do not allow alphabetical characters (like `x` in `3x4.96`) in most browsers. If complex `x` formula matching is needed in the future, it must be switched back to `type="text"`.

---

## 4. Final Results TSV Export
Added a "Copy TSV" button to the result tables, which generates tab-separated values for easy spreadsheet pasting.

### `CopyTsvButton` Component
The logic and UI are extracted into a dedicated `CopyTsvButton` component that is rendered inside the `SectionHeader` next to the section title (or the edit pencil icon for talents).

```tsx
import { useState, type ReactNode } from "react";
import { MdContentCopy, MdCheck } from "react-icons/md";
import { Button } from "rond";

import type { SectionTableProps } from "./SectionTable";

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as any)) return extractText((node as any).props.children);
  return "";
}

export function CopyTsvButton({
  talentType,
  headerConfigs,
  tableKey,
  getRowConfig,
  getRowTitle,
}: Omit<SectionTableProps, "label">) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    // ... TSV extraction logic ...
  };

  return (
    <Button
      boneOnly
      size="custom"
      title="Copy TSV"
      className="w-7 h-7 text-lg text-light-4 transition-colors hover:text-light-1"
      icon={copied ? <MdCheck className="text-bonus" /> : <MdContentCopy />}
      onClick={onCopy}
    />
  );
}
```

### The `onCopy` Logic
Generates the TSV string from the table headers and rows, writes it to `navigator.clipboard`, and sets a temporary `copied` state to show a checkmark icon.

```tsx
const [copied, setCopied] = useState(false);

const onCopy = () => {
  const headers = headerConfigs.map((config) => {
    const node = typeof config.content === "function" ? config.content(talentType) : config.content;
    return extractText(node as ReactNode);
  });

  const rows = tableKey.subs.map((subKey) => {
    const config = getRowConfig(tableKey.main, subKey);
    const rowLabel = getRowTitle(subKey);
    const cellValues = config.cells.map((cell) => extractText(cell.value as ReactNode));
    return [rowLabel, ...cellValues].join("\t");
  });

  const tsv = [["", ...headers].join("\t"), ...rows].join("\n");
  void navigator.clipboard.writeText(tsv);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```
*Note: Uses `MdContentCopy` and `MdCheck` from `react-icons/md` to display the copy and copied states.*

---

## 5. Attribute Table Visibility Optimization
Optimized the character stats table by hiding zero values to reduce clutter.

Implemented by checking if the rounded value is strictly `0` inside the `.map()` function for each stat group:
```tsx
{(["cRate_", "cDmg_", "er_", "healB_", "inHealB_", "shieldS_"] as const).map((type) => {
  const val = attributes.get(type);
  if (Math.round(val * 10) / 10 === 0) return null;

  const label = t(type);
  return (
    <Row key={type} aria-label={label}>
      <Cell>{label}</Cell>
      <Cell className="mr-2">{Math.round(val * 10) / 10}%</Cell>
    </Row>
  );
})}

// The same logic is applied sequentially to ATTACK_ELEMENTS and ["naAtkSpd_", "caAtkSpd_"].
```

---

## 6. Case Sensitivity Fix (Span Component)
Fixed a critical build error that occurs in Docker (Alpine Linux) due to case-sensitive file systems.
- The `Span` component folder was originally named `span` (lowercase).
- Imports were trying to resolve `../../Span` (uppercase).
- **Solution**: The folder `src/components/span` was carefully renamed to `src/components/Span` using `git mv`, and its internal component was updated from `span.tsx` to `Span.tsx` along with its `index.ts` export to ensure successful Docker builds.

---
---

## 7. Mandatory `rond` React Runtime Fix

The `rond` package must not bundle its own React or ReactDOM runtime. If it does, the final application contains two React instances and loads as a blank white page with this browser-console exception:

```text
TypeError: Cannot read properties of null (reading 'useState')
```

In `packages/rond/vite-build.config.ts`, the `build.rollupOptions.external` array must contain all four entries exactly:

```typescript
rollupOptions: {
  external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  output: {
    // Keep the existing output configuration here.
  },
},
```

Do not externalize only `react`. `rond` imports both `react-dom` and `react-dom/client`, and bundling either can recreate the duplicate-runtime failure.

### Remove stale package-local dependency links

Bun may leave package-local `node_modules` symlinks pointing at an old cache. These stale links can create two React instances even after fixing the Vite configuration.

From the repository root, inspect them:

```bash
readlink -f packages/gidmgcalculator/node_modules/react
readlink -f packages/rond/node_modules/react
readlink -f node_modules/react
```

If either package-local path resolves somewhere different from the root `node_modules/react`, move the entire stale directory out of the repository. Use these exact recoverable backup locations after first confirming they do not already exist:

```bash
test ! -e /tmp/gidmgcalculator-node_modules-stale
mv packages/gidmgcalculator/node_modules /tmp/gidmgcalculator-node_modules-stale

test ! -e /tmp/rond-node_modules-stale
mv packages/rond/node_modules /tmp/rond-node_modules-stale
```

Then create one hoisted dependency installation:

```bash
BUN_TMPDIR=/tmp BUN_INSTALL=/tmp/bun-install bun install --force --linker hoisted
```

Do not restore the stale package-local dependency directories after the hoisted install succeeds.

---

## 8. Exact Build Order

Prerequisites:

- Bun is installed.
- Wrangler is authenticated with `bunx wrangler login`, or valid Cloudflare credentials are available in the environment.
- The current source changes are present in the working tree.

Run these commands separately and in this exact order:

```bash
cd packages/ron-utils
bun run build
```

```bash
cd ../rond
bunx vite build --config vite-build.config.ts
```

```bash
cd ../gidmgcalculator
bunx vite build
```

Required results:

- `packages/ron-utils/dist` is generated successfully.
- `packages/rond/dist/main.js` is generated successfully.
- The `rond` bundle is approximately 320 KB, not approximately 990 KB. A roughly 990 KB `rond/dist/main.js` indicates ReactDOM was bundled incorrectly.
- `packages/gidmgcalculator/dist/index.html` and hashed files under `dist/assets` are generated successfully.
- The application build finishes with exit code `0`. A large-chunk warning does not block deployment.

### Browser runtime verification before deployment

Serve the production output:

```bash
cd packages/gidmgcalculator
bunx vite preview --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173` in a real or headless browser and verify all of the following:

- `#root` is not empty.
- The navigation and calculator cards render.
- The browser console does not contain `Cannot read properties of null (reading 'useState')`.
- Failures from Google Tag Manager or Google Ads in a restricted test environment may be ignored; they are unrelated to application rendering.

Do not deploy if `#root` is empty or an application exception is present.

---

## 9. Cloudflare Pages Production Deployment

Cloudflare project details:

```text
Project: gidmgcalculator
Production domain: https://gidmgcalculator.pages.dev
Custom production domain: https://gidmgcal.gunshiz.top
Build directory: /home/gunshiz/gaming-tools/packages/gidmgcalculator/dist
```

### Critical production rule

This is a Cloudflare Pages Direct Upload project. Running the deploy command inside the Git repository causes Wrangler to infer the current Git branch and create a `Preview` deployment. Passing `--branch` also creates a preview deployment.

The following commands are preview-only and must not be used for a production release:

```bash
bunx wrangler pages deploy dist --project-name gidmgcalculator --branch genshin-v7.1
bunx wrangler pages deploy dist --project-name gidmgcalculator --branch genshin-v7.0
```

For production, run Wrangler from `/tmp`, outside the Git repository, pass the build directory as an absolute path, and omit `--branch` completely:

```bash
cd /tmp
bunx wrangler pages deploy /home/gunshiz/gaming-tools/packages/gidmgcalculator/dist --project-name gidmgcalculator --commit-dirty=true
```

The success output must provide an immutable deployment URL similar to:

```text
https://<deployment-id>.gidmgcalculator.pages.dev
```

### Verify the environment is Production

Run:

```bash
cd /home/gunshiz/gaming-tools/packages/gidmgcalculator
bunx wrangler pages deployment list --project-name gidmgcalculator
```

The newest deployment row must say `Production` in the `Environment` column. If it says `Preview`, do not report success. Redeploy from `/tmp` with no `--branch` option.

### Verify production domains received the same build

First, obtain the JavaScript asset name from the immutable deployment URL:

```bash
curl -fsS https://<deployment-id>.gidmgcalculator.pages.dev
```

Then inspect both production domains:

```bash
curl -fsS https://gidmgcalculator.pages.dev
curl -fsS https://gidmgcal.gunshiz.top
```

The `<script type="module" ... src="/assets/index-<hash>.js">` hash must match on the immutable deployment and both production domains. Cloudflare edge propagation can briefly return the prior hash; wait and repeat the checks until all three match.

Finally, load at least one production domain in a browser and repeat the runtime checks from section 8. Production is complete only when the page renders and there is no React hook exception.

---

## 10. Final Completion Checklist

- [ ] Sections 1–6 are implemented where applicable to the current branch.
- [ ] `rond` externalizes React, JSX runtime, ReactDOM, and ReactDOM client.
- [ ] Package-local stale React symlinks are absent.
- [ ] `ron-utils` builds successfully.
- [ ] `rond` builds successfully and its bundle size indicates ReactDOM is external.
- [ ] `gidmgcalculator` builds successfully.
- [ ] The local production preview renders with a non-empty `#root`.
- [ ] The Cloudflare deployment list marks the newest release as `Production`.
- [ ] The immutable deployment and both production domains serve the same asset hash.
- [ ] A production domain renders without the duplicate-React `useState` exception.
