import { useEffect, useState } from "react";
import { Checkbox } from "@ui/components/primitives/Checkbox";
import { Chip } from "@ui/components/primitives/Chip";
import { Button } from "@ui/components/primitives/Button";
import { Card } from "@ui/components/primitives/Card";
import { Badge } from "@ui/components/primitives/Badge";
import { TopBar } from "@ui/components/shell/TopBar";
import { MediaCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MediaCardsBlock";
import { TimelineStepsBlock } from "@ui/components/workspaces/generated-ui/blocks/TimelineStepsBlock";
import { Screen, Col, Row, Live, muted } from "./kit";

const ING = [["Pasta", 100, "g"], ["Tomatoes", 200, "g"], ["Olive oil", 1, "tbsp"], ["Garlic", 1, "clove"]] as const;
const STEPS = [{ t: "Boil the pasta", secs: 600 }, { t: "Simmer the sauce", secs: 300 }, { t: "Combine and serve", secs: 0 }];
export default function Recipe() {
  const [serv, setServ] = useState(2);
  const [done, setDone] = useState<number[]>([]);
  const [timer, setTimer] = useState<{ i: number; left: number } | null>(null);
  useEffect(() => { if (!timer) return; const id = setInterval(() => setTimer((t) => (t && t.left > 0 ? { ...t, left: t.left - 30 } : t)), 1000); return () => clearInterval(id); }, [timer?.i]);
  const mm = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  return (
    <Screen style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Col style={{ flex: 1.1 }}>
        <MediaCardsBlock block={{ id: "m", type: "mediaCards", cards: [{ id: "r", tone: "success", title: "Tomato pasta", description: "A 20 minute weeknight dinner.", badges: [{ icon: "clock", label: "20 min" }, { label: `${serv} servings` }], actionLabel: "Cook mode" }] } as any} />
        <Row>{[2, 4, 6].map((n) => <Chip key={n} active={serv === n} onClick={() => setServ(n)}>{n} servings</Chip>)}</Row>
        <Card padding="md"><Col gap={6}>{ING.map(([n, q, u]) => <div key={n} style={{ display: "flex", justifyContent: "space-between" }}><span>{n}</span><span style={muted}>{Math.round((q * serv * 10) / 2) / 10} {u}</span></div>)}</Col></Card>
      </Col>
      <Col style={{ flex: 1 }}>
        <TopBar breadcrumb={[{ label: "Steps" }]} actions={<Badge tone={done.length === STEPS.length ? "success" : "neutral"}>{done.length}/{STEPS.length}</Badge>} />
        <TimelineStepsBlock block={{ id: "t", type: "timelineSteps", title: "Progress", steps: STEPS.map((s, i) => ({ id: "s" + i, label: s.t, completed: done.includes(i), showConnector: i < STEPS.length - 1 })) } as any} />
        {STEPS.map((s, i) => (
          <Card key={i} padding="md"><Col gap={6}>
            <Checkbox label={s.t} checked={done.includes(i)} onChange={() => setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i])} />
            {s.secs > 0 && <Row><Button size="sm" variant="secondary" onClick={() => setTimer({ i, left: s.secs })}>{timer && timer.i === i ? `Timer ${mm(timer.left)}` : `Start ${mm(s.secs)} timer`}</Button></Row>}
          </Col></Card>
        ))}
        <Live>{timer ? `Timer ${mm(timer.left)}` : ""}</Live>
      </Col>
    </Screen>
  );
}
