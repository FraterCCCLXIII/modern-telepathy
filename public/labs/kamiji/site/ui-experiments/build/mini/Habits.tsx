import { useState } from "react";
import { Card } from "@ui/components/primitives/Card";
import { Checkbox } from "@ui/components/primitives/Checkbox";
import { Badge } from "@ui/components/primitives/Badge";
import { Button } from "@ui/components/primitives/Button";
import { Input } from "@ui/components/primitives/Input";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { TopBar } from "@ui/components/shell/TopBar";
import { StatCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/StatCardsBlock";
import { WeeklyStreakCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/WeeklyStreakCardsBlock";
import { Screen, Col, Row, Live, muted } from "./kit";

const START = [{ id: "h1", name: "Drink water", streak: 4, done: false }, { id: "h2", name: "Stretch 10 min", streak: 2, done: true }, { id: "h3", name: "Read 20 pages", streak: 7, done: false }];
export default function Habits() {
  const [habits, setHabits] = useState(START);
  const [name, setName] = useState("");
  const done = habits.filter((h) => h.done).length;
  const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;
  const best = Math.max(0, ...habits.map((h) => h.streak));
  const toggle = (id: string) => setHabits(habits.map((h) => (h.id === id ? { ...h, done: !h.done, streak: h.streak + (h.done ? -1 : 1) } : h)));
  const add = () => { if (name.trim()) { setHabits([...habits, { id: "h" + Date.now(), name: name.trim(), streak: 0, done: false }]); setName(""); } };
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label, i) => ({ label, completed: i < Math.min(7, best) }));
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Habits" }, { label: "Today" }]} actions={<Badge tone={pct === 100 ? "success" : "neutral"}>{done}/{habits.length} done</Badge>} />
      <StatCardsBlock block={{ id: "s", type: "statCards", cards: [{ id: "c1", icon: "check", label: "Completed today", value: `${pct}%`, tone: pct === 100 ? "success" : "accent", visualization: { type: "ring", percent: pct } }] } as any} />
      <WeeklyStreakCardsBlock block={{ id: "w", type: "weeklyStreakCards", cards: [{ id: "w1", value: `${best} Days`, longestValue: "14 days", days }] } as any} />
      <Card padding="md">
        <Col gap={10}>
          {habits.length === 0 && <EmptyState title="No habits yet" description="Add one below." />}
          {habits.map((h) => (
            <Row key={h.id} style={{ justifyContent: "space-between" }}>
              <Checkbox label={h.name} checked={h.done} onChange={() => toggle(h.id)} />
              <span style={muted}>{h.streak} day streak</span>
            </Row>
          ))}
        </Col>
      </Card>
      <Row><Input aria-label="New habit" placeholder="New habit" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 1 }} /><Button variant="primary" onClick={add}>Add</Button></Row>
      <Live>{done} of {habits.length} habits done</Live>
    </Screen>
  );
}
