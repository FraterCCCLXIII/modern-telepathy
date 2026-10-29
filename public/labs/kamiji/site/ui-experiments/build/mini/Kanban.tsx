import { useState } from "react";
import { Card } from "@ui/components/primitives/Card";
import { Badge } from "@ui/components/primitives/Badge";
import { IconButton } from "@ui/components/primitives/IconButton";
import { Input } from "@ui/components/primitives/Input";
import { Button } from "@ui/components/primitives/Button";
import { ScrollArea } from "@ui/components/primitives/ScrollArea";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live, muted } from "./kit";

const COLS = [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]] as const;
export default function Kanban() {
  const [cards, setCards] = useState([{ id: "k1", t: "Draft the brief", c: "todo" }, { id: "k2", t: "Sketch the layout", c: "doing" }, { id: "k3", t: "Pick a palette", c: "todo" }, { id: "k4", t: "Kickoff call", c: "done" }]);
  const [txt, setTxt] = useState(""); const [say, setSay] = useState("");
  const move = (id: string, dir: number) => setCards(cards.map((c) => { if (c.id !== id) return c; const i = COLS.findIndex((x) => x[0] === c.c) + dir; if (i < 0 || i >= COLS.length) return c; setSay(`${c.t} moved to ${COLS[i][1]}`); return { ...c, c: COLS[i][0] }; }));
  const add = () => { if (txt.trim()) { setCards([...cards, { id: "k" + Date.now(), t: txt.trim(), c: "todo" }]); setTxt(""); } };
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Project board" }]} actions={<Badge>{cards.length} cards</Badge>} />
      <Row><Input aria-label="New card" placeholder="New card" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 1 }} /><Button variant="primary" onClick={add}>Add card</Button></Row>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, flex: 1, minHeight: 0 }}>
        {COLS.map(([id, label]) => (
          <Card key={id} padding="sm" style={{ minHeight: 0 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 8 }}><strong>{label}</strong><Badge tone={id === "done" ? "success" : "neutral"}>{cards.filter((c) => c.c === id).length}</Badge></Row>
            <ScrollArea style={{ maxHeight: 300 }}><Col gap={8}>
              {cards.filter((c) => c.c === id).map((c) => (
                <Card key={c.id} padding="sm"><Col gap={6}><span>{c.t}</span><Row gap={2}>
                  <IconButton icon="chevron-left" label={`Move ${c.t} left`} size="sm" variant="ghost" disabled={id === "todo"} onClick={() => move(c.id, -1)} />
                  <IconButton icon="chevron-right" label={`Move ${c.t} right`} size="sm" variant="ghost" disabled={id === "done"} onClick={() => move(c.id, 1)} />
                </Row></Col></Card>
              ))}
              {!cards.some((c) => c.c === id) && <span style={muted}>Empty</span>}
            </Col></ScrollArea>
          </Card>
        ))}
      </div>
      <Live>{say}</Live>
    </Screen>
  );
}
