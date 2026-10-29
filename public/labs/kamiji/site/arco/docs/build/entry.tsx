// Browser entry for the Arco docs previews. Bundled by build.mjs into assets/arco-ui.js + arco-ui.css.
// It registers ONLY the chosen blocks (a subset of the owner's BLOCK_REGISTRY) and a few primitive demos.
import { createElement, useState, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@ui/tokens/theme.css";
import "./arco-light.css";

import { TextBlock } from "@ui/components/workspaces/generated-ui/blocks/TextBlock";
import { CardGridBlock } from "@ui/components/workspaces/generated-ui/blocks/CardGridBlock";
import { MediaCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MediaCardsBlock";
import { ListingCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/ListingCardsBlock";
import { InsightCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/InsightCardsBlock";
import { NewsFeedCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/NewsFeedCardsBlock";
import { StatCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/StatCardsBlock";
import { MetricChartCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MetricChartCardsBlock";
import { MiniStatChartCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MiniStatChartCardsBlock";
import { SavedMoneyCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/SavedMoneyCardsBlock";
import { FearGreedCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/FearGreedCardsBlock";
import { WeeklyStreakCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/WeeklyStreakCardsBlock";
import { CryptoMarketCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/CryptoMarketCardsBlock";
import { TaskChecklistCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/TaskChecklistCardsBlock";
import { CalendarScheduleCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/CalendarScheduleCardsBlock";
import { EventCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/EventCardsBlock";
import { ScheduleSlotsBlock } from "@ui/components/workspaces/generated-ui/blocks/ScheduleSlotsBlock";
import { TimelineStepsBlock } from "@ui/components/workspaces/generated-ui/blocks/TimelineStepsBlock";
import { SelectionTilesBlock } from "@ui/components/workspaces/generated-ui/blocks/SelectionTilesBlock";
import { FormBlock } from "@ui/components/workspaces/generated-ui/blocks/FormBlock";
import { MusicPlayerCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MusicPlayerCardsBlock";
import { VideoPlayerCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/VideoPlayerCardsBlock";
import { CodeBlock } from "@ui/components/workspaces/generated-ui/blocks/CodeBlock";
import { TerminalBlock } from "@ui/components/workspaces/generated-ui/blocks/TerminalBlock";
import { BatteryStatusCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/BatteryStatusCardsBlock";

import { Button } from "@ui/components/primitives/Button";
import { Badge } from "@ui/components/primitives/Badge";
import { Chip } from "@ui/components/primitives/Chip";
import { Switch } from "@ui/components/primitives/Switch";
import { Input } from "@ui/components/primitives/Input";
import { Tabs } from "@ui/components/primitives/Tabs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCKS: Record<string, ComponentType<{ block: any }>> = {
  text: TextBlock, cardGrid: CardGridBlock, mediaCards: MediaCardsBlock, listingCards: ListingCardsBlock,
  insightCards: InsightCardsBlock, newsFeedCards: NewsFeedCardsBlock, statCards: StatCardsBlock,
  metricChartCards: MetricChartCardsBlock, miniStatChartCards: MiniStatChartCardsBlock,
  savedMoneyCards: SavedMoneyCardsBlock, fearGreedCards: FearGreedCardsBlock,
  weeklyStreakCards: WeeklyStreakCardsBlock, cryptoMarketCards: CryptoMarketCardsBlock,
  taskChecklistCards: TaskChecklistCardsBlock, calendarScheduleCards: CalendarScheduleCardsBlock,
  eventCards: EventCardsBlock, scheduleSlots: ScheduleSlotsBlock, timelineSteps: TimelineStepsBlock,
  selectionTiles: SelectionTilesBlock, form: FormBlock, musicPlayerCards: MusicPlayerCardsBlock,
  videoPlayerCards: VideoPlayerCardsBlock, code: CodeBlock, terminal: TerminalBlock,
  batteryStatusCards: BatteryStatusCardsBlock,
};

// --- Primitive demos (composed for this docs page from the real components; props are the real ones) ---
function ButtonDemo({ variant }: { variant: string }) {
  const v = ["primary", "secondary", "ghost", "danger"] as const;
  if (variant === "sizes")
    return <Row>{(["sm", "md", "lg"] as const).map((s) => <Button key={s} variant="primary" size={s}>Size {s}</Button>)}</Row>;
  if (variant === "disabled") return <Row><Button disabled>Disabled</Button><Button variant="primary" disabled>Disabled</Button></Row>;
  return <Row>{v.map((x) => <Button key={x} variant={x}>{x}</Button>)}</Row>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>{children}</div>;
}
function BadgeDemo() {
  return <Row>{(["neutral", "accent", "success", "warning", "danger"] as const).map((t) => <Badge key={t} tone={t}>{t}</Badge>)}<Badge tone="success" dot>Active</Badge></Row>;
}
function ChipDemo() {
  const [on, setOn] = useState(true);
  return <Row><Chip>Suggestion</Chip><Chip active={on} onClick={() => setOn(!on)}>Toggle me</Chip><Chip icon="star" active>With icon</Chip></Row>;
}
function SwitchDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return <Row><Switch id="sw-a" label="Remember me" checked={a} onChange={(e) => setA(e.target.checked)} /><Switch id="sw-b" label="Feature flag" labelPosition="start" checked={b} onChange={(e) => setB(e.target.checked)} /><Switch id="sw-c" label="Disabled" checked={false} disabled onChange={() => {}} /></Row>;
}
function InputDemo() {
  return <div style={{ display: "grid", gap: 10, maxWidth: 320 }}><Input placeholder="Search anything" aria-label="Search" /><Input placeholder="Invalid value" aria-label="Invalid example" invalid defaultValue="not-an-email" /></div>;
}
function TabsDemo({ variant }: { variant: "pill" | "underline" }) {
  const items = [{ id: "a", label: "Overview" }, { id: "b", label: "Activity" }, { id: "c", label: "Settings" }];
  const [v, setV] = useState("a");
  return <Tabs items={items} value={v} onChange={setV} variant={variant} aria-label={`${variant} tabs example`} />;
}
const PRIMS: Record<string, (variant: string) => JSX.Element> = {
  Button: (v) => <ButtonDemo variant={v} />,
  Badge: () => <BadgeDemo />,
  Chip: () => <ChipDemo />,
  Switch: () => <SwitchDemo />,
  Input: () => <InputDemo />,
  Tabs: (v) => <TabsDemo variant={v === "underline" ? "underline" : "pill"} />,
};

const roots = new WeakMap<Element, Root>();
function mountInto(el: Element, node: React.ReactNode) {
  let root = roots.get(el);
  if (!root) { root = createRoot(el); roots.set(el, root); }
  root.render(<div className="lf-root arco-lf" data-lf-theme="light">{node}</div>);
}

export function renderBlock(el: Element, block: { type: string }) {
  const C = BLOCKS[block.type];
  if (!C) throw new Error(`No renderer for ${block.type}`);
  mountInto(el, createElement(C, { block }));
}
export function renderPrimitive(el: Element, name: string, variant: string) {
  mountInto(el, PRIMS[name](variant));
}
export const versions = { react: "18.3.1" };
