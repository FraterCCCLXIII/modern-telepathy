import { useState } from "react";
import { Textarea } from "@ui/components/primitives/Textarea";
import { Checkbox } from "@ui/components/primitives/Checkbox";
import { Badge } from "@ui/components/primitives/Badge";
import { Avatar } from "@ui/components/primitives/Avatar";
import { Divider } from "@ui/components/primitives/Divider";
import { Kbd } from "@ui/components/primitives/Kbd";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live, muted } from "./kit";

const SAMPLE = "Weekly sync\n\n- Roadmap looks good\n- [ ] @sam send the launch checklist\n- [ ] @jo book the venue\n- [x] @alex share last week's numbers\n";
export default function MeetingNotes() {
  const [text, setText] = useState(SAMPLE);
  const lines = text.split("\n");
  const items = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^- \[( |x)\]/.test(l)).map(({ l, i }) => ({ i, done: /^- \[x\]/.test(l), who: (l.match(/@(\w+)/) || [])[1] || "someone", what: l.replace(/^- \[( |x)\]\s*/, "").replace(/@\w+\s*/, "") }));
  const toggle = (i: number) => setText(lines.map((l, k) => (k === i ? (/^- \[x\]/.test(l) ? l.replace("- [x]", "- [ ]") : l.replace("- [ ]", "- [x]")) : l)).join("\n"));
  const open = items.filter((x) => !x.done).length;
  return (
    <Screen style={{ flexDirection: "row", alignItems: "stretch" }} gap={14}>
      <Col style={{ flex: 1.3 }}>
        <TopBar breadcrumb={[{ label: "Notes" }, { label: "Weekly sync" }]} />
        <Textarea aria-label="Meeting notes" value={text} onChange={(e) => setText(e.target.value)} rows={12} autoResize={false} style={{ minHeight: 280 }} />
        <p style={muted}>Lines like <Kbd>- [ ] @name task</Kbd> become action items.</p>
      </Col>
      <Divider orientation="vertical" />
      <Col style={{ flex: 1 }}>
        <Row style={{ justifyContent: "space-between" }}><strong>Action items</strong><Badge tone={open ? "warning" : "success"}>{open} open</Badge></Row>
        {items.length === 0 && <EmptyState title="No action items" description="Write a line starting with - [ ]" />}
        {items.map((x) => <Row key={x.i} style={{ justifyContent: "space-between" }}><Checkbox label={x.what} checked={x.done} onChange={() => toggle(x.i)} /><Avatar name={x.who} size="sm" /></Row>)}
      </Col>
      <Live>{open} action items open</Live>
    </Screen>
  );
}
