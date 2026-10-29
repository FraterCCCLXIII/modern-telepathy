// Glue shared by the mini apps (layout only; no new visual primitives).
import type { CSSProperties, ReactNode } from "react";
export const Screen = ({ children, pad = 14, gap = 12, style }: { children: ReactNode; pad?: number; gap?: number; style?: CSSProperties }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column", gap, padding: pad, background: "var(--lf-surface-2)", color: "var(--lf-text-primary)", overflow: "auto", minHeight: 0, ...style }}>{children}</div>
);
export const Row = ({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: CSSProperties }) => <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "center", ...style }}>{children}</div>;
export const Col = ({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: CSSProperties }) => <div style={{ display: "grid", gap, minWidth: 0, alignContent: "start", ...style }}>{children}</div>;
export const Live = ({ children }: { children: ReactNode }) => <div aria-live="polite" role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{children}</div>;
export const muted: CSSProperties = { color: "var(--lf-text-secondary)", fontSize: 13 };
