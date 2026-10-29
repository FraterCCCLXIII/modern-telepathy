// Browser entry for the UI Experiments gallery. Bundled by build.mjs into assets/uix.js + uix.css.
// Every tile renders a REAL component from the owner's workspace (packages/longformer-ui, longformer-demo mock data,
// longformer-www sections). Where a component needs a host (state, props, a frame), a minimal wrapper supplies it.
// Sample content inside the wrappers is written for this page and is marked as sample data in the UI.
import { createElement, useState, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@ui/tokens/theme.css";
import "./uix-light.css";

import { BLOCK_REGISTRY } from "@ui/components/workspaces/generated-ui/registry/registry";
import { EXAMPLES } from "@gen/examples";
import { mountInto } from "./common";

// shell + interactions
import { AppShell } from "@ui/components/shell/AppShell";
import { NavRail } from "@ui/components/shell/NavRail";
import { NavSidebar } from "@ui/components/shell/NavSidebar";
import { TopBar } from "@ui/components/shell/TopBar";
import { ListPane } from "@ui/components/shell/ListPane";
import { WorkspacePicker } from "@ui/components/shell/WorkspacePicker";
import { PhoneHomeScreen } from "@ui/components/interactions/PhoneHomeScreen";

// primitives
import { Avatar } from "@ui/components/primitives/Avatar";
import { Card } from "@ui/components/primitives/Card";
import { Checkbox } from "@ui/components/primitives/Checkbox";
import { Textarea } from "@ui/components/primitives/Textarea";
import { Label } from "@ui/components/primitives/Label";
import { Divider } from "@ui/components/primitives/Divider";
import { Kbd } from "@ui/components/primitives/Kbd";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { ListItem } from "@ui/components/primitives/ListItem";
import { Menu } from "@ui/components/primitives/Menu";
import { Modal } from "@ui/components/primitives/Modal";
import { Tooltip } from "@ui/components/primitives/Tooltip";
import { HoverCard } from "@ui/components/primitives/HoverCard";
import { IconButton } from "@ui/components/primitives/IconButton";
import { ScrollArea } from "@ui/components/primitives/ScrollArea";
import { ResizablePane } from "@ui/components/primitives/ResizablePane";
import { AppIcon } from "@ui/components/primitives/AppIcon";
import { Button } from "@ui/components/primitives/Button";
import { Input } from "@ui/components/primitives/Input";
import { CalculatorPad } from "@ui/components/primitives/CalculatorPad";
import { Icon } from "@ui/icons";

// chat
import { MessageBubble } from "@ui/components/workspaces/chat/MessageBubble";
import { ThinkingBlock } from "@ui/components/workspaces/chat/ThinkingBlock";
import { PromptChips } from "@ui/components/workspaces/chat/PromptChips";
import { Composer } from "@ui/components/workspaces/chat/Composer";
import { ComposerTaskList } from "@ui/components/workspaces/chat/ComposerTaskList";
import { ComposerNotice } from "@ui/components/workspaces/chat/ComposerNotice";
import { ComposerFileChangeList } from "@ui/components/workspaces/chat/ComposerFileChangeList";
import { ComposerErrorList } from "@ui/components/workspaces/chat/ComposerErrorList";
import { ComposerQueuedList } from "@ui/components/workspaces/chat/ComposerQueuedList";
import { ComposerStatusBar } from "@ui/components/workspaces/chat/ComposerStatusBar";
import { ConversationTabBar } from "@ui/components/workspaces/chat/ConversationTabBar";
import { AgentActionBlock, AgentThoughtBlock, AgentStatusLine, AgentTodoCard, AgentFileChip, AgentFileCreationBlock } from "@ui/components/workspaces/chat/agent-blocks";


import { ComposerAttachMenu } from "@ui/components/workspaces/chat/ComposerAttachMenu";
import { ComposerEmojiPicker } from "@ui/components/workspaces/chat/ComposerEmojiPicker";
import { ComposerTypeahead } from "@ui/components/workspaces/chat/ComposerTypeahead";
import { ComposerFormattingToolbar, ComposerFormattingToggle } from "@ui/components/workspaces/chat/ComposerFormattingToolbar";
import { ComposerDrawer } from "@ui/components/workspaces/chat/ComposerDrawer";
import { ComposerDrawerStack } from "@ui/components/workspaces/chat/ComposerDrawerStack";
import { NavRailBrandMark } from "@ui/components/shell/NavRail/NavRailBrandMark";
import { NavRailOverflowCard } from "@ui/components/shell/NavRail/NavRailOverflowCard";
import { SidebarPane } from "@ui/components/shell/NavSidebar/SidebarPane";
import { SidebarUserFooter, SidebarUserFooterBar, NavSidebarSectionHeader, NavSidebarSectionFilter, NavSidebarGroupedItems } from "@ui/components/shell/NavSidebar/NavSidebar";
import { ResizeHandle } from "@ui/components/primitives/ResizeHandle";
import { AppIconTile } from "@ui/app-tones/AppIconTile";
import { ThemeProvider } from "@ui/tokens/ThemeProvider";
import { ICON_NAMES } from "@ui/icons";
import { ToolDock, CanvasRulers, SideList } from "@ui/components/workspaces/design-shell";
import { Switch } from "@ui/components/primitives/Switch";
const noop = () => {};
const Col = ({ children, gap = 10, style }: { children: ReactNode; gap?: number; style?: React.CSSProperties }) => <div style={{ display: "grid", gap, ...style }}>{children}</div>;
const Row = ({ children, gap = 10 }: { children: ReactNode; gap?: number }) => <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "center" }}>{children}</div>;
const Fill = ({ children, border = true }: { children: ReactNode; border?: boolean }) => (
  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0, border: border ? "1px solid var(--lf-border-default)" : undefined, borderRadius: 12, overflow: "hidden", background: "var(--lf-surface-1)" }}>{children}</div>
);

// ---------- shell ----------
const RAIL_ITEMS = [
  { id: "chat", label: "Chat", icon: "chat" as const },
  { id: "notes", label: "Notes", icon: "notebook" as const },
  { id: "mail", label: "Email", icon: "mail" as const },
  { id: "tasks", label: "Tasks", icon: "check" as const },
  { id: "cal", label: "Calendar", icon: "calendar" as const },
];
function RailDemo({ expanded }: { expanded?: boolean }) {
  const [active, setActive] = useState("notes");
  return (
    <div style={{ height: 340, width: expanded ? 200 : 64, border: "1px solid var(--lf-border-default)", borderRadius: 12, overflow: "hidden", background: "var(--lf-surface-2)", margin: "0 auto" }}>
      <NavRail items={RAIL_ITEMS} activeId={active} onSelect={setActive} defaultExpanded={expanded} brand={<strong style={{ fontSize: 15 }}>L</strong>} />
    </div>
  );
}
const SIDEBAR_SECTIONS = [
  { id: "recent", title: "Recent", items: [{ id: "a", label: "Picnic planning notes", description: "2h ago", active: true }, { id: "b", label: "Vendor layout study", description: "3d ago" }, { id: "c", label: "Community forum recap", description: "1w ago" }] },
  { id: "priv", title: "Private", items: [{ id: "d", label: "Getting started" }, { id: "e", label: "Scratchpad" }] },
];
function SidebarDemo() {
  return (
    <div style={{ height: 380, maxWidth: 280, margin: "0 auto", border: "1px solid var(--lf-border-default)", borderRadius: 12, overflow: "hidden", background: "var(--lf-surface-2)" }}>
      <NavSidebar primaryAction={{ label: "New note", icon: "plus" }} quickLinks={[{ id: "s", label: "Search", icon: "search" }, { id: "t", label: "Templates", icon: "layers" }]} sections={SIDEBAR_SECTIONS} />
    </div>
  );
}
function ShellDemo() {
  const [active, setActive] = useState("notes");
  return (
    <Fill>
      <AppShell
        rail={<NavRail items={RAIL_ITEMS} activeId={active} onSelect={setActive} brand={<strong>L</strong>} />}
        sidebar={<NavSidebar primaryAction={{ label: "New note", icon: "plus" }} sections={SIDEBAR_SECTIONS} />}
        defaultSidebarWidth={230}
        main={
          <>
            <TopBar breadcrumb={[{ label: "Notes" }, { label: "Picnic planning notes" }]} collaborators={[{ name: "Ada Lee" }, { name: "Sam Ito" }]} actions={<Button size="sm" variant="secondary">Share</Button>} />
            <div style={{ padding: 24 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 22 }}>Picnic planning notes</h3>
              <p style={{ margin: 0, color: "var(--lf-text-secondary)", maxWidth: 420 }}>Sample content. AppShell is the rail | sidebar | main | context-panel frame; each workspace only fills in <code>main</code>. Drag the sidebar edge to resize.</p>
            </div>
          </>
        }
      />
    </Fill>
  );
}
function TopBarDemo() {
  return (
    <Col>
      <div style={{ border: "1px solid var(--lf-border-default)", borderRadius: 10, overflow: "hidden" }}>
        <TopBar breadcrumb={[{ label: "Files" }, { label: "Projects" }, { label: "Summer picnic" }]} collaborators={[{ name: "Ada Lee" }, { name: "Sam Ito" }, { name: "Noor K" }]} actions={<><IconButton icon="star" label="Star" variant="ghost" /><Button size="sm">Share</Button></>} />
      </div>
    </Col>
  );
}
function ListPaneDemo() {
  const [a, setA] = useState(0);
  const rows = [["Ada Lee", "Re: venue permit"], ["Sam Ito", "Volunteer list v2"], ["Noor K", "Supplies checklist"], ["Rui M", "Signage mockups"]];
  return (
    <div style={{ height: 320, maxWidth: 340, margin: "0 auto", border: "1px solid var(--lf-border-default)", borderRadius: 12, overflow: "hidden" }}>
      <ListPane title="Inbox" headerActions={<IconButton icon="edit" label="Compose" variant="ghost" size="sm" />} toolbar={<Input placeholder="Search mail" aria-label="Search mail" />}>
        {rows.map(([n, s], i) => <ListItem key={n} label={n} description={s} leading={<Avatar name={n} size="sm" />} trailing={<span style={{ fontSize: 11, color: "var(--lf-text-tertiary)" }}>{i + 1}h</span>} active={a === i} onClick={() => setA(i)} />)}
      </ListPane>
    </div>
  );
}
function PickerDemo() {
  const [v, setV] = useState("w1");
  return <div style={{ maxWidth: 260, margin: "0 auto", minHeight: 210 }}><WorkspacePicker value={v} onChange={setV} aria-label="Workspace" options={[{ id: "w1", name: "Personal", planLabel: "Free", icon: "home" }, { id: "w2", name: "Field Ops", planLabel: "Team", icon: "users" }, { id: "w3", name: "Design", planLabel: "Team", icon: "layers" }]} /></div>;
}

// ---------- primitives ----------
function AvatarDemo() {
  return <Row gap={18}>{(["sm", "md", "lg"] as const).map((s) => <Avatar key={s} name="Ada Lee" size={s} />)}<Avatar name="Sam Ito" status="online" /><Avatar name="Noor K" status="away" /><Avatar name="Rui M" status="offline" /></Row>;
}
function CardDemo() {
  return <Row>{(["sm", "md"] as const).map((p) => <Card key={p} padding={p} style={{ minWidth: 140 }}>padding="{p}"</Card>)}<Card interactive tabIndex={0} style={{ minWidth: 140 }}>interactive</Card></Row>;
}
function CheckDemo() {
  const [a, setA] = useState(true);
  return <Col><Checkbox label="Email me a summary" checked={a} onChange={(e) => setA(e.target.checked)} /><Checkbox label="Share with team" defaultChecked={false} /><Checkbox label="Disabled" disabled /></Col>;
}
function TextareaDemo() {
  return <Col><Label htmlFor="uix-ta" hint="Grows with content up to maxHeight.">Notes</Label><Textarea id="uix-ta" placeholder="Write something and press Enter a few times" maxHeight={140} autoResize rows={2} /></Col>;
}
function KbdDemo() {
  return <Col gap={14}><Row><span>Command palette</span><Kbd>Ctrl</Kbd><Kbd>K</Kbd></Row><Divider /><Row><span>Left</span><Divider orientation="vertical" /><span>Right</span></Row></Col>;
}
function EmptyDemo() {
  return <EmptyState icon={<Icon name="inbox" size={26} />} title="No messages yet" description="When someone writes to you, it will show up here." actions={<Button variant="primary" size="sm">Compose</Button>} />;
}
function ListItemDemo() {
  const [a, setA] = useState(1);
  const rows = ["Inbox", "Starred", "Sent"];
  return <Col gap={2} style={{ maxWidth: 320 }}>{rows.map((r, i) => <ListItem key={r} label={r} description={i === 0 ? "12 unread" : undefined} leading={<Icon name={i === 0 ? "inbox" : i === 1 ? "star" : "send"} size={16} />} trailing={i === 0 ? <span style={{ fontSize: 12 }}>12</span> : undefined} active={a === i} onClick={() => setA(i)} />)}</Col>;
}
function MenuDemo() {
  const [last, setLast] = useState("none yet");
  return (
    <Col gap={14}>
      <div style={{ minHeight: 190 }}>
        <Menu aria-label="Actions" trigger={<Button variant="secondary">Actions <Icon name="chevron-down" size={14} /></Button>} items={[{ id: "edit", label: "Rename", icon: "edit", onSelect: () => setLast("Rename") }, { id: "copy", label: "Duplicate", icon: "copy", shortcut: "Ctrl D", onSelect: () => setLast("Duplicate") }, { id: "del", label: "Delete", icon: "trash", danger: true, separatorAbove: true, onSelect: () => setLast("Delete") }]} />
      </div>
      <span style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>Last selected: {last}</span>
    </Col>
  );
}
function ModalDemo() {
  const [open, setOpen] = useState(false);
  return <><Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button><Modal open={open} onClose={() => setOpen(false)} title="Delete this note?" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => setOpen(false)}>Delete</Button></>}><p style={{ margin: 0 }}>This is a sample dialog. Escape or the scrim closes it.</p></Modal></>;
}
function TipDemo() {
  return <Row gap={24}><Tooltip label="Add a new item"><IconButton icon="plus" label="Add" variant="secondary" /></Tooltip><HoverCard content={<div style={{ padding: 4 }}><strong>Ada Lee</strong><div style={{ fontSize: 12, color: "var(--lf-text-secondary)" }}>Sample profile card</div></div>}><Button variant="ghost">Hover or focus me</Button></HoverCard></Row>;
}
function IconButtonDemo() {
  return <Row>{(["primary", "secondary", "ghost", "danger"] as const).map((v) => <IconButton key={v} icon={v === "danger" ? "trash" : v === "primary" ? "send" : "star"} label={`${v} icon button`} variant={v} />)}</Row>;
}
function ScrollDemo() {
  return <ScrollArea style={{ height: 150, border: "1px solid var(--lf-border-default)", borderRadius: 10, padding: 10 }} tabIndex={0} aria-label="Scrollable list">{Array.from({ length: 14 }, (_, i) => <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--lf-border-subtle)" }}>Scrollable row {i + 1}</div>)}</ScrollArea>;
}
function ResizeDemo() {
  const [w, setW] = useState(150);
  return <div style={{ display: "flex", height: 130, border: "1px solid var(--lf-border-default)", borderRadius: 10, overflow: "hidden" }}><ResizablePane width={w} onWidthChange={setW} minWidth={90} maxWidth={260} handleSide="right" handleLabel="Resize pane"><div style={{ padding: 10 }}>Pane {Math.round(w)}px</div></ResizablePane><div style={{ padding: 10, flex: 1, color: "var(--lf-text-secondary)" }}>Drag the edge, or focus it and use arrow keys.</div></div>;
}
function AppIconDemo() {
  return <Row gap={14}>{[["Mail", "mail", "mail"], ["Notes", "notebook", "notes"], ["Calendar", "calendar", "calendar"], ["Music", "play", "music"]].map(([l, i, id], n) => <AppIcon key={l} label={l} icon={i as any} appId={id} running={n === 1} badgeCount={n === 0 ? 3 : undefined} />)}</Row>;
}
function CalcDemo() {
  return <div style={{ maxWidth: 260, margin: "0 auto" }}><CalculatorPad branded /></div>;
}

// ---------- chat ----------
const THINK = { label: "Thinking", steps: [{ id: "s1", text: "List the relevant files" }, { id: "s2", text: "Read the registry and draft a plan" }] };
function BubbleDemo() {
  return (
    <Col gap={16}>
      <MessageBubble message={{ id: "u", role: "user", content: "Plan a summer picnic for 40 people.", timestamp: "10:02" }} onCopy={noop} onEdit={noop} />
      <MessageBubble message={{ id: "a", role: "agent", content: "Here is a short plan: venue, food, volunteers, and a rain backup.", timestamp: "10:02", thinking: THINK }} onAgentCopy={noop} onAgentRegenerate={noop} onAgentThumbsUp={noop} onAgentThumbsDown={noop} />
    </Col>
  );
}
function ChipsDemo() {
  const [last, setLast] = useState("");
  return <Col><PromptChips items={[{ id: "1", label: "Plan an event", icon: "calendar" }, { id: "2", label: "Summarize notes", icon: "notebook" }, { id: "3", label: "Draft an email", icon: "mail" }]} onSelect={(i) => setLast(i.label)} /><span style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>{last ? `Picked: ${last}` : "Pick a suggestion"}</span></Col>;
}
function ComposerDemo() {
  const [v, setV] = useState("");
  const [mode, setMode] = useState("agent");
  const [sent, setSent] = useState<string[]>([]);
  return (
    <Col gap={12}>
      {sent.length > 0 && <div style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>Sent (sample, not delivered anywhere): {sent[sent.length - 1]}</div>}
      <Composer value={v} onChange={setV} onSubmit={() => { if (v.trim()) { setSent([...sent, v]); setV(""); } }} placeholder="Ask anything" model="Sample model" modelOptions={[{ id: "m1", label: "Sample model" }, { id: "m2", label: "Another model" }]} navItems={[{ id: "agent", label: "Agent" }, { id: "ask", label: "Ask" }]} activeNavId={mode} onNavChange={setMode} usage={{ contextUsedK: 62.4, contextLimitK: 200, fiveHourPercent: 18, weeklyPercent: 41 }} />
    </Col>
  );
}
function TaskListDemo() {
  return <ComposerTaskList items={[{ id: "1", label: "Read the token file", status: "completed" }, { id: "2", label: "Draft the primitives list", status: "completed" }, { id: "3", label: "Write the block schema", status: "active" }, { id: "4", label: "Add examples", status: "pending" }]} groupCompletedAfter={1} />;
}
function NoticeDemo() {
  return <Col gap={8}>{(["info", "success", "warning", "danger"] as const).map((t) => <ComposerNotice key={t} tone={t} actionLabel={t === "warning" ? "Upgrade" : undefined} onAction={noop} onDismiss={noop}>This is a {t} notice.</ComposerNotice>)}</Col>;
}
function FileChangesDemo() {
  return <ComposerFileChangeList items={[{ id: "1", path: "src/components/Card.tsx", additions: 42, deletions: 6, kind: "tsx" }, { id: "2", path: "src/tokens/theme.css", additions: 12, kind: "css" }, { id: "3", path: "src/index.ts", additions: 2, deletions: 1, kind: "ts" }]} onSelect={noop} />;
}
function ErrorsQueuedDemo() {
  return <Col gap={10}><ComposerErrorList items={[{ id: "1", label: "Build failed", detail: "Cannot find module './Card'" }]} /><ComposerQueuedList items={[{ id: "q1", label: "Then add dark mode" }, { id: "q2", label: "Then write the tests" }]} /></Col>;
}
function StatusBarDemo() {
  return <ComposerStatusBar usage={{ contextUsedK: 148.2, contextLimitK: 200, fiveHourPercent: 64, weeklyPercent: 22 }} onPlanUsageClick={noop} />;
}
function TabBarDemo() {
  const [a, setA] = useState("t1");
  const [tabs, setTabs] = useState([{ id: "t1", label: "Picnic plan", icon: "chat" as const, closable: true }, { id: "t2", label: "Venue research", swatch: "#8a8a82", closable: true }, { id: "t3", label: "Signage", icon: "image" as const, closable: true }]);
  return <ConversationTabBar tabs={tabs} activeId={a} onSelect={setA} projectLabel="Event Planning" onClose={(id) => { setTabs(tabs.filter((t) => t.id !== id)); if (a === id) setA(tabs[0].id); }} onNewTab={noop} onHistory={noop} />;
}
function ActionBlockDemo() {
  return <Col gap={10}><AgentActionBlock title="List package structure" command="ls, head" output={["packages/longformer-ui", "packages/longformer-demo", "packages/longformer-www"]} defaultOpen /><AgentActionBlock title="Run the type check" command="npm run typecheck" output="No errors." icon="terminal" /></Col>;
}
function ThoughtDemo() {
  return <Col gap={10}><AgentThoughtBlock duration={12}>Compare the two token files, then decide which one is canonical.</AgentThoughtBlock><AgentThoughtBlock duration="brief" defaultOpen={false}>Quick check.</AgentThoughtBlock><AgentStatusLine>Reading 3 files</AgentStatusLine><Row><AgentFileChip path="src/theme.css" kind="css" /><AgentFileChip path="src/Card.tsx" kind="tsx" /></Row></Col>;
}
function TodoDemo() {
  return <AgentTodoCard items={[{ id: "1", label: "Inventory the primitives", status: "completed" }, { id: "2", label: "Pick a docs layout", status: "active" }, { id: "3", label: "Write the page", status: "pending" }]} />;
}
function FileCreationDemo() {
  return <AgentFileCreationBlock files={[{ id: "1", label: "Example manifest: task list app", filename: "tasklist.json" }, { id: "2", label: "Example manifest: contacts", filename: "contact.json" }]} defaultOpen />;
}
function ThinkingDemo() {
  return <ThinkingBlock label="Thinking"><div style={{ color: "var(--lf-text-secondary)", fontSize: 14 }}>Step 1: list the files. Step 2: read the registry. Step 3: draft the answer.</div></ThinkingBlock>;
}

// ---------- block cards (generic) ----------
function BlockTile({ type }: { type: string }) {
  const reg = (BLOCK_REGISTRY as any)[type];
  const ex = EXAMPLES[type];
  if (!reg || !ex) throw new Error("no block/example for " + type);
  const C = reg.Component as ComponentType<{ block: any }>;
  return <C block={ex} />;
}


// ---------- more chat parts ----------
function AttachMenuDemo() {
  const [a, setA] = useState(true); const [b, setB] = useState(false);
  return <div style={{ minHeight: 190 }}><ComposerAttachMenu onAddFile={noop} drawerToggles={[{ id: "tasks", label: "Task list", visible: a, onVisibleChange: setA }, { id: "files", label: "Changed files", visible: b, onVisibleChange: setB }]} /></div>;
}
function EmojiDemo() {
  const [v, setV] = useState("");
  return <Col><div style={{ minHeight: 60 }}><ComposerEmojiPicker onSelect={(e) => setV(v + e)} /></div><span style={{ fontSize: 13 }}>Picked: {v || "none yet"}</span></Col>;
}
function TypeaheadDemo() {
  const [v, setV] = useState("Plan a pic");
  return <Col><Input aria-label="Message draft" value={v} onChange={(e) => setV(e.target.value)} /><ComposerTypeahead value={v} items={[{ id: "1", text: "Plan a picnic for 40 people" }, { id: "2", text: "Plan a picnic menu with vegan options" }]} activeIndex={0} onSelect={(i) => setV(i.text)} /></Col>;
}
function FormattingDemo() {
  const [on, setOn] = useState(true);
  return <Col><ComposerFormattingToggle visible={on} onToggle={() => setOn(!on)} /><ComposerFormattingToolbar visible={on} /></Col>;
}
function DrawerDemo() {
  return <ComposerDrawerStack><ComposerDrawer title="Task 2 of 4 in progress" defaultOpen><ComposerTaskList items={[{ id: "1", label: "Read tokens", status: "completed" }, { id: "2", label: "Write schema", status: "active" }]} /></ComposerDrawer><ComposerDrawer title="1 error" tone="danger" defaultOpen={false}><ComposerErrorList items={[{ id: "e", label: "Build failed" }]} /></ComposerDrawer></ComposerDrawerStack>;
}
function SidebarPartsDemo() {
  const [f, setF] = useState("all");
  return <Col gap={14}><NavSidebarSectionHeader title="Recent" action={<IconButton icon="plus" label="Add" variant="ghost" size="sm" />} /><NavSidebarSectionFilter value={f} onChange={setF} aria-label="Filter conversations" options={[{ id: "all", label: "All" }, { id: "mine", label: "Mine" }]} /><NavSidebarGroupedItems groups={[{ id: "g1", label: "Event Planning", icon: "calendar", items: [{ id: "a", label: "Picnic plan" }, { id: "b", label: "Venue research" }] }]} /></Col>;
}
function FooterDemo() {
  return <Col gap={12} style={{ maxWidth: 280 }}><SidebarUserFooter name="Sample User" meta="Sample plan" /><SidebarUserFooterBar name="Sample User" meta="Online" actions={<IconButton icon="settings" label="Settings" variant="ghost" size="sm" />} /></Col>;
}
function BrandOverflowDemo() {
  return <Row gap={24}><div style={{ width: 40 }}><NavRailBrandMark /></div><div style={{ width: 220 }}><NavRailOverflowCard items={RAIL_ITEMS} activeId="notes" expanded onSelect={noop} onMoveToRail={noop} /></div></Row>;
}
function PaneDemo() {
  const [w, setW] = useState(190);
  return <div style={{ display: "flex", height: 130, border: "1px solid var(--lf-border-default)", borderRadius: 10, overflow: "hidden" }}><SidebarPane width={w} onWidthChange={setW} minWidth={120} maxWidth={260}><div style={{ padding: 10 }}>Sidebar {Math.round(w)}px</div></SidebarPane><div style={{ padding: 10, color: "var(--lf-text-secondary)" }}>Drag the edge.</div></div>;
}
function HandleDemo() {
  return <Row gap={40}><div style={{ height: 80, display: "flex" }}><ResizeHandle onPointerDown={noop} orientation="vertical" label="Resize width" /></div><div style={{ width: 120 }}><ResizeHandle onPointerDown={noop} orientation="horizontal" label="Resize height" /></div></Row>;
}
function IconTileDemo() {
  return <Row gap={14}>{(["xs", "sm", "md", "lg"] as const).map((z) => <AppIconTile key={z} icon="mail" appId="mail" size={z} />)}<AppIconTile icon="calendar" hue="orange" size="lg" surface="solid" /></Row>;
}
function IconSetDemo() {
  return <ScrollArea style={{ height: 220 }} tabIndex={0} aria-label="Icon names"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 8 }}>{(ICON_NAMES as string[]).map((n) => <div key={n} style={{ display: "grid", justifyItems: "center", gap: 4, fontSize: 10, color: "var(--lf-text-secondary)" }}><Icon name={n as any} size={18} /><span>{n}</span></div>)}</div></ScrollArea>;
}
function ThemeDemo() {
  return <ThemeProvider defaultTheme="light" persist={false}><Card padding="md">ThemeProvider sets <code>data-lf-theme</code> on a wrapper and exposes <code>useTheme()</code>. Here it wraps this card in the light theme without saving anything.</Card></ThemeProvider>;
}

function DesignShellDemo() {
  const [a, setA] = useState("move"); const [s, setS] = useState<string | null>("l1");
  return <Row gap={20}><div style={{ height: 220 }}><ToolDock aria-label="Tools" items={[{ id: "move", label: "Move", icon: "grid" }, { id: "draw", label: "Draw", icon: "edit" }, { id: "text", label: "Text", icon: "paragraph" }]} activeId={a} onSelect={setA} /></div><div style={{ width: 180 }}><SideList aria-label="Layers" items={[{ id: "l1", label: "Frame" }, { id: "l2", label: "Button" }]} activeId={s} onSelect={setS} /></div><div style={{ width: 200, height: 160 }}><CanvasRulers horizontalTicks={[0, 50, 100, 150]} verticalTicks={[0, 50, 100]}><div style={{ padding: 8 }}>Canvas</div></CanvasRulers></div></Row>;
}

const R: Record<string, () => JSX.Element> = {
  "composer-attach-menu": () => <AttachMenuDemo />,
  "composer-emoji-picker": () => <EmojiDemo />,
  "composer-typeahead": () => <TypeaheadDemo />,
  "composer-formatting": () => <FormattingDemo />,
  "composer-drawer": () => <DrawerDemo />,
  "nav-sidebar-parts": () => <SidebarPartsDemo />,
  "sidebar-user-footer": () => <FooterDemo />,
  "nav-rail-brand-overflow": () => <BrandOverflowDemo />,
  "sidebar-pane": () => <PaneDemo />,
  "resize-handle": () => <HandleDemo />,
  "app-icon-tile": () => <IconTileDemo />,
  "icon-set": () => <IconSetDemo />,
  "theme-provider": () => <ThemeDemo />,
  "design-shell": () => <DesignShellDemo />,
  "app-shell": () => <ShellDemo />,
  "nav-rail": () => <RailDemo />,
  "nav-rail-expanded": () => <RailDemo expanded />,
  "nav-sidebar": () => <SidebarDemo />,
  "top-bar": () => <TopBarDemo />,
  "list-pane": () => <ListPaneDemo />,
  "workspace-picker": () => <PickerDemo />,
  "phone-home": () => <div style={{ height: 600, maxWidth: 300, margin: "0 auto", position: "relative", borderRadius: 28, overflow: "hidden", border: "1px solid var(--lf-border-default)" }}><PhoneHomeScreen fill pageCount={2} carrier="Sample" /></div>,

  avatar: () => <AvatarDemo />,
  card: () => <CardDemo />,
  checkbox: () => <CheckDemo />,
  "textarea-label": () => <TextareaDemo />,
  "kbd-divider": () => <KbdDemo />,
  "empty-state": () => <EmptyDemo />,
  "list-item": () => <ListItemDemo />,
  menu: () => <MenuDemo />,
  modal: () => <ModalDemo />,
  "tooltip-hovercard": () => <TipDemo />,
  "icon-button": () => <IconButtonDemo />,
  "scroll-area": () => <ScrollDemo />,
  "resizable-pane": () => <ResizeDemo />,
  "app-icon": () => <AppIconDemo />,
  "calculator-pad": () => <CalcDemo />,

  "message-bubble": () => <BubbleDemo />,
  "thinking-block": () => <ThinkingDemo />,
  "prompt-chips": () => <ChipsDemo />,
  composer: () => <ComposerDemo />,
  "composer-task-list": () => <TaskListDemo />,
  "composer-notice": () => <NoticeDemo />,
  "composer-file-changes": () => <FileChangesDemo />,
  "composer-errors-queued": () => <ErrorsQueuedDemo />,
  "composer-status-bar": () => <StatusBarDemo />,
  "conversation-tab-bar": () => <TabBarDemo />,
  "agent-action-block": () => <ActionBlockDemo />,
  "agent-thought-block": () => <ThoughtDemo />,
  "agent-todo-card": () => <TodoDemo />,
  "agent-file-creation": () => <FileCreationDemo />,


};

export function renderTile(el: Element, id: string, kind: string, blockType?: string) {
  let node: JSX.Element;
  if (kind === "block") node = createElement(BlockTile, { type: blockType! });
  else {
    const f = R[id];
    if (!f) throw new Error("No renderer for " + id);
    node = f();
  }
  mountInto(el, node);
}
export const rendererIds = Object.keys(R);

export { unmountTile } from "./common";
