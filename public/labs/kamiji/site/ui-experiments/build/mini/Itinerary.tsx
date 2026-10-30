import { useState } from "react";
import { Tabs, TabPanel } from "@ui/components/primitives/Tabs";
import { Input } from "@ui/components/primitives/Input";
import { Button } from "@ui/components/primitives/Button";
import { IconButton } from "@ui/components/primitives/IconButton";
import { Card } from "@ui/components/primitives/Card";
import { Badge } from "@ui/components/primitives/Badge";
import { TopBar } from "@ui/components/shell/TopBar";
import { EventCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/EventCardsBlock";
import { Screen, Col, Row, Live, muted } from "./kit";

type Stop = { id: string; title: string; start: string; end: string };
const INIT: Record<string, Stop[]> = {
  d1: [{ id: "a", title: "Old town walk", start: "09:00", end: "11:00" }, { id: "b", title: "Harbor lunch", start: "12:30", end: "14:00" }],
  d2: [{ id: "c", title: "Museum", start: "10:00", end: "12:00" }],
  d3: [],
};
export default function Itinerary() {
  const [day, setDay] = useState("d1");
  const [plan, setPlan] = useState(INIT);
  const [title, setTitle] = useState(""); const [start, setStart] = useState("15:00");
  const stops = [...plan[day]].sort((a, b) => a.start.localeCompare(b.start));
  const add = () => { if (!title.trim()) return; const [h, m] = start.split(":").map(Number); const end = `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`; setPlan({ ...plan, [day]: [...plan[day], { id: "s" + Date.now(), title: title.trim(), start, end }] }); setTitle(""); };
  const total = Object.values(plan).reduce((n, l) => n + l.length, 0);
  return (
    <Screen style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Col style={{ flex: 1.3 }}>
        <TopBar breadcrumb={[{ label: "Lisbon trip" }, { label: "Itinerary" }]} actions={<Badge tone="accent">{total} stops</Badge>} />
        <Tabs aria-label="Day" items={[{ id: "d1", label: "Day 1" }, { id: "d2", label: "Day 2" }, { id: "d3", label: "Day 3" }]} value={day} onChange={setDay} />
        <TabPanel id={day} active>{stops.length ? <EventCardsBlock block={{ id: "e", type: "eventCards", title: "Plan", cards: stops.map((s) => ({ id: s.id, title: s.title, startTime: s.start, endTime: s.end, timeLeft: { icon: "clock", label: `${s.start} to ${s.end}` } })) } as any} /> : <Card padding="md"><span style={muted}>Nothing planned for this day yet.</span></Card>}</TabPanel>
      </Col>
      <Col style={{ flex: 1 }}>
        <Card padding="md"><Col gap={8}>
          <strong>Add a stop</strong>
          <Input aria-label="Stop name" placeholder="Stop name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input aria-label="Start time" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Button variant="primary" onClick={add}>Add to day</Button>
        </Col></Card>
        <Card padding="md"><Col gap={4}>{stops.map((s) => <Row key={s.id} style={{ justifyContent: "space-between" }}><span>{s.title}</span><IconButton icon="trash" label={`Remove ${s.title}`} variant="ghost" size="sm" onClick={() => setPlan({ ...plan, [day]: plan[day].filter((x) => x.id !== s.id) })} /></Row>)}{!stops.length && <span style={muted}>No stops to remove.</span>}</Col></Card>
      </Col>
      <Live>{stops.length} stops on this day</Live>
    </Screen>
  );
}
