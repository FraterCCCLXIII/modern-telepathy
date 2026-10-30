import { useState } from "react";
import { Card } from "@ui/components/primitives/Card";
import { Button } from "@ui/components/primitives/Button";
import { Tabs, TabPanel } from "@ui/components/primitives/Tabs";
import { Badge } from "@ui/components/primitives/Badge";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { Kbd } from "@ui/components/primitives/Kbd";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live, muted } from "./kit";

const DECKS: Record<string, [string, string][]> = {
  food: [["mizu", "water"], ["pan", "bread"], ["ringo", "apple"], ["tamago", "egg"]],
  travel: [["eki", "station"], ["kippu", "ticket"], ["chizu", "map"]],
};
export default function Flashcards() {
  const [deck, setDeck] = useState("food");
  const [i, setI] = useState(0); const [flip, setFlip] = useState(false); const [known, setKnown] = useState(0);
  const cards = DECKS[deck]; const finished = i >= cards.length;
  const next = (ok: boolean) => { if (ok) setKnown(known + 1); setFlip(false); setI(i + 1); };
  const pick = (d: string) => { setDeck(d); setI(0); setFlip(false); setKnown(0); };
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Words" }]} actions={<Badge tone="accent">{Math.min(i + 1, cards.length)}/{cards.length}</Badge>} />
      <Tabs aria-label="Deck" items={[{ id: "food", label: "Food" }, { id: "travel", label: "Travel" }]} value={deck} onChange={pick} />
      <TabPanel id={deck} active>{finished ? (
        <EmptyState title="Deck finished" description={`You knew ${known} of ${cards.length}.`} actions={<Button variant="primary" onClick={() => pick(deck)}>Restart deck</Button>} />
      ) : (
        <Col gap={12}>
          <Card padding="lg" interactive onClick={() => setFlip(!flip)} role="button" tabIndex={0} aria-label={flip ? `Meaning: ${cards[i][1]}. Press to flip back` : `Word: ${cards[i][0]}. Press to flip`} onKeyDown={(e: any) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFlip(!flip))} style={{ minHeight: 190, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div><div style={{ fontSize: 36, fontWeight: 700 }}>{flip ? cards[i][1] : cards[i][0]}</div><div style={muted}>{flip ? "meaning" : "tap to flip"}</div></div>
          </Card>
          <Row style={{ justifyContent: "center" }}><Button variant="secondary" onClick={() => next(false)}>Again</Button><Button variant="primary" onClick={() => next(true)}>I knew it</Button></Row>
          <p style={{ ...muted, textAlign: "center" }}>Press <Kbd>Enter</Kbd> on the card to flip.</p>
        </Col>
      )}</TabPanel>
      <Live>{finished ? "Deck finished" : flip ? `Meaning ${cards[i][1]}` : `Word ${cards[i][0]}`}</Live>
    </Screen>
  );
}
