import { useState } from "react";
import { Chip } from "@ui/components/primitives/Chip";
import { Textarea } from "@ui/components/primitives/Textarea";
import { Button } from "@ui/components/primitives/Button";
import { Badge } from "@ui/components/primitives/Badge";
import { ListItem } from "@ui/components/primitives/ListItem";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { Icon } from "@ui/icons";
import { TopBar } from "@ui/components/shell/TopBar";
import { StatCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/StatCardsBlock";
import { Screen, Col, Row, Live } from "./kit";

const MOODS = [["great", "sun", 5], ["good", "leaf", 4], ["okay", "moon", 3], ["tense", "zap", 2], ["low", "heart", 1]] as const;
export default function Mood() {
  const [mood, setMood] = useState("good"); const [note, setNote] = useState("");
  const [log, setLog] = useState<{ id: string; mood: string; score: number; note: string }[]>([{ id: "x1", mood: "okay", score: 3, note: "Slow morning." }, { id: "x2", mood: "good", score: 4, note: "Walk after lunch." }]);
  const save = () => { const m = MOODS.find((x) => x[0] === mood)!; setLog([{ id: "x" + Date.now(), mood, score: m[2], note: note.trim() || "No note" }, ...log]); setNote(""); };
  const avg = log.length ? (log.reduce((s, l) => s + l.score, 0) / log.length).toFixed(1) : "0";
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Mood journal" }]} actions={<Badge tone="accent">{log.length} entries</Badge>} />
      <StatCardsBlock block={{ id: "s", type: "statCards", cards: [{ id: "c", icon: "heart", label: "Average mood", value: avg, tone: "accent", visualization: { type: "bars", values: [...log].reverse().slice(-8).map((l) => l.score) } }] } as any} />
      <Row>{MOODS.map(([n, ic]) => <Chip key={n} icon={ic as any} active={mood === n} onClick={() => setMood(n)}>{n}</Chip>)}</Row>
      <Textarea aria-label="Journal note" placeholder="How was today?" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <Button variant="primary" onClick={save}>Save entry</Button>
      <Col gap={2}>
        {log.length === 0 && <EmptyState title="No entries" description="Save your first one." />}
        {log.slice(0, 4).map((l) => <ListItem key={l.id} leading={<Icon name={(MOODS.find((m) => m[0] === l.mood)![1]) as any} size={16} />} label={l.note} description={l.mood} trailing={<Badge>{l.score}</Badge>} />)}
      </Col>
      <Live>{log.length} entries, average {avg}</Live>
    </Screen>
  );
}
