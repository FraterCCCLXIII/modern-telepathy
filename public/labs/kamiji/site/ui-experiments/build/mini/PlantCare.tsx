import { useState } from "react";
import { Card } from "@ui/components/primitives/Card";
import { Button } from "@ui/components/primitives/Button";
import { Badge } from "@ui/components/primitives/Badge";
import { Switch } from "@ui/components/primitives/Switch";
import { Avatar } from "@ui/components/primitives/Avatar";
import { TopBar } from "@ui/components/shell/TopBar";
import { InsightCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/InsightCardsBlock";
import { Screen, Col, Row, Live, muted } from "./kit";

const START = [{ id: "p1", n: "Monstera", every: 7, due: 0 }, { id: "p2", n: "Snake plant", every: 14, due: 5 }, { id: "p3", n: "Basil", every: 3, due: -1 }];
export default function PlantCare() {
  const [plants, setPlants] = useState(START); const [remind, setRemind] = useState(true); const [say, setSay] = useState("");
  const dueNow = plants.filter((p) => p.due <= 0);
  const water = (id: string) => setPlants(plants.map((p) => { if (p.id !== id) return p; setSay(`${p.n} watered`); return { ...p, due: p.every }; }));
  const day = () => setPlants(plants.map((p) => ({ ...p, due: p.due - 1 })));
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Plants" }]} actions={<Badge tone={dueNow.length ? "warning" : "success"}>{dueNow.length} need water</Badge>} />
      {dueNow.length > 0 && <InsightCardsBlock block={{ id: "i", type: "insightCards", cards: [{ id: "x", label: "Reminder", title: `Water ${dueNow.map((p) => p.n).join(", ")}`, description: remind ? "Reminders are on." : "Reminders are off." }] } as any} />}
      <Col gap={8}>{plants.map((p) => (
        <Card key={p.id} padding="md"><Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Row><Avatar name={p.n} size="md" /><div><div>{p.n}</div><div style={muted}>{p.due <= 0 ? (p.due < 0 ? `${-p.due} days overdue` : "Due today") : `In ${p.due} days`}</div></div></Row>
          <Button size="sm" variant={p.due <= 0 ? "primary" : "secondary"} onClick={() => water(p.id)} aria-label={`Water ${p.n}`}>Water</Button>
        </Row></Card>
      ))}</Col>
      <Row style={{ justifyContent: "space-between" }}><Switch id="remind" label="Reminders" checked={remind} onChange={(e) => setRemind(e.target.checked)} /><Button size="sm" variant="ghost" onClick={day}>Skip a day</Button></Row>
      <Live>{say}</Live>
    </Screen>
  );
}
