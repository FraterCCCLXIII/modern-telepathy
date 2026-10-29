import { useState } from "react";
import { ListPane } from "@ui/components/shell/ListPane";
import { TopBar } from "@ui/components/shell/TopBar";
import { ListItem } from "@ui/components/primitives/ListItem";
import { Input } from "@ui/components/primitives/Input";
import { Avatar } from "@ui/components/primitives/Avatar";
import { Badge } from "@ui/components/primitives/Badge";
import { Chip } from "@ui/components/primitives/Chip";
import { Textarea } from "@ui/components/primitives/Textarea";
import { Button } from "@ui/components/primitives/Button";
import { Card } from "@ui/components/primitives/Card";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { TimelineStepsBlock } from "@ui/components/workspaces/generated-ui/blocks/TimelineStepsBlock";
import { Screen, Col, Row, Live } from "./kit";

const STAGES = ["lead", "talking", "won"];
const START = [{ id: "c1", n: "Maya Okafor", co: "Northwind Co", st: "talking", log: ["Intro call"] }, { id: "c2", n: "Leo Brandt", co: "Fabrik Ltd", st: "lead", log: [] as string[] }, { id: "c3", n: "Priya Nair", co: "Harbor Labs", st: "won", log: ["Intro call", "Sent quote", "Signed"] }];
export default function Crm() {
  const [people, setPeople] = useState(START); const [sel, setSel] = useState("c1"); const [q, setQ] = useState(""); const [note, setNote] = useState("");
  const shown = people.filter((p) => (p.n + p.co).toLowerCase().includes(q.toLowerCase()));
  const cur = people.find((p) => p.id === sel);
  const upd = (patch: any) => setPeople(people.map((p) => (p.id === sel ? { ...p, ...patch } : p)));
  return (
    <Screen pad={0} gap={0} style={{ flexDirection: "row" }}>
      <div style={{ width: 270, borderRight: "1px solid var(--lf-border-default)", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ListPane title="Contacts" toolbar={<Input aria-label="Search contacts" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />}>
          {shown.map((p) => <ListItem key={p.id} leading={<Avatar name={p.n} size="sm" />} label={p.n} description={p.co} active={sel === p.id} onClick={() => setSel(p.id)} trailing={<Badge tone={p.st === "won" ? "success" : p.st === "talking" ? "accent" : "neutral"}>{p.st}</Badge>} />)}
          {shown.length === 0 && <EmptyState title="No match" />}
        </ListPane>
      </div>
      <Col style={{ flex: 1, padding: 16, alignContent: "start", overflow: "auto" }} gap={12}>
        {cur ? (<>
          <TopBar breadcrumb={[{ label: "Contacts" }, { label: cur.n }]} />
          <Card padding="md"><Row><Avatar name={cur.n} size="lg" /><div><strong>{cur.n}</strong><div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{cur.co}</div></div></Row></Card>
          <Row>{STAGES.map((s) => <Chip key={s} active={cur.st === s} onClick={() => upd({ st: s })}>{s}</Chip>)}</Row>
          <Textarea aria-label="Activity note" placeholder="Log a call or note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          <Button variant="primary" onClick={() => { if (note.trim()) { upd({ log: [...cur.log, note.trim()] }); setNote(""); } }}>Log activity</Button>
          {cur.log.length > 0 ? <TimelineStepsBlock block={{ id: "t", type: "timelineSteps", title: "Activity", steps: cur.log.map((l, i) => ({ id: "l" + i, label: l, completed: true, showConnector: i < cur.log.length - 1 })) } as any} /> : <EmptyState title="No activity yet" />}
        </>) : <EmptyState title="Select a contact" />}
      </Col>
      <Live>{cur ? `${cur.n}, ${cur.st}, ${cur.log.length} activities` : ""}</Live>
    </Screen>
  );
}
