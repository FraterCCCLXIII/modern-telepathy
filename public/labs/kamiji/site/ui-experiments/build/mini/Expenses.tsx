import { useState } from "react";
import { Input } from "@ui/components/primitives/Input";
import { Button } from "@ui/components/primitives/Button";
import { Chip } from "@ui/components/primitives/Chip";
import { Avatar } from "@ui/components/primitives/Avatar";
import { ListItem } from "@ui/components/primitives/ListItem";
import { Badge } from "@ui/components/primitives/Badge";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { TopBar } from "@ui/components/shell/TopBar";
import { InsightCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/InsightCardsBlock";
import { Screen, Col, Row, Live } from "./kit";

const PEOPLE = ["Alex", "Sam", "Jo"];
export default function Expenses() {
  const [items, setItems] = useState([{ id: "e1", what: "Groceries", amt: 45, by: "Alex" }, { id: "e2", what: "Taxi", amt: 18, by: "Sam" }]);
  const [what, setWhat] = useState(""); const [amt, setAmt] = useState(""); const [by, setBy] = useState("Alex");
  const total = items.reduce((s, i) => s + i.amt, 0);
  const share = total / PEOPLE.length;
  const bal = Object.fromEntries(PEOPLE.map((p) => [p, items.filter((i) => i.by === p).reduce((s, i) => s + i.amt, 0) - share]));
  const debtors = PEOPLE.filter((p) => bal[p] < -0.005); const creditors = PEOPLE.filter((p) => bal[p] > 0.005);
  const settle: any[] = [];
  const d = debtors.map((p) => ({ p, v: -bal[p] })); const c = creditors.map((p) => ({ p, v: bal[p] }));
  for (const x of d) for (const y of c) { const m = Math.min(x.v, y.v); if (m > 0.005) { settle.push({ id: x.p + y.p, label: "Settle up", title: `${x.p} pays ${y.p} $${m.toFixed(2)}`, description: "Equal split between all three." }); x.v -= m; y.v -= m; } }
  const add = () => { const n = parseFloat(amt); if (what.trim() && n > 0) { setItems([...items, { id: "e" + Date.now(), what: what.trim(), amt: n, by }]); setWhat(""); setAmt(""); } };
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Trip expenses" }]} actions={<Badge tone="accent">Total ${total.toFixed(2)}</Badge>} />
      <Row>{PEOPLE.map((p) => <Row key={p} gap={4}><Avatar name={p} size="sm" /><span style={{ fontSize: 13 }}>{p} ${(bal[p] + share).toFixed(0)}</span></Row>)}</Row>
      <Col gap={6}>
        <Input aria-label="What for" placeholder="What for" value={what} onChange={(e) => setWhat(e.target.value)} />
        <Input aria-label="Amount" placeholder="Amount" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <Row>{PEOPLE.map((p) => <Chip key={p} active={by === p} onClick={() => setBy(p)}>{p} paid</Chip>)}</Row>
        <Button variant="primary" onClick={add}>Add expense</Button>
      </Col>
      <Col gap={2}>
        {items.length === 0 && <EmptyState title="No expenses" description="Add the first one." />}
        {items.map((i) => <ListItem key={i.id} leading={<Avatar name={i.by} size="sm" />} label={i.what} description={`Paid by ${i.by}`} trailing={`$${i.amt.toFixed(2)}`} />)}
      </Col>
      {settle.length > 0 && <InsightCardsBlock block={{ id: "i", type: "insightCards", title: "Settle up", cards: settle } as any} />}
      <Live>Total {total.toFixed(2)} dollars</Live>
    </Screen>
  );
}
