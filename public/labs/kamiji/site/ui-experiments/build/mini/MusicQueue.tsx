import { useEffect, useState } from "react";
import { IconButton } from "@ui/components/primitives/IconButton";
import { Switch } from "@ui/components/primitives/Switch";
import { ListItem } from "@ui/components/primitives/ListItem";
import { Badge } from "@ui/components/primitives/Badge";
import { TopBar } from "@ui/components/shell/TopBar";
import { MusicPlayerCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MusicPlayerCardsBlock";
import { Screen, Col, Row, Live } from "./kit";

const TRACKS = [["Morning Light", "Aya Nori", 180], ["Paper Boats", "The Lanterns", 214], ["Slow Tide", "Mika Rowe", 197], ["Night Bus", "Aya Nori", 165]] as const;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export default function MusicQueue() {
  const [idx, setIdx] = useState(0); const [playing, setPlaying] = useState(false); const [pos, setPos] = useState(0); const [shuffle, setShuffle] = useState(false);
  const [name, artist, dur] = TRACKS[idx];
  const go = (n: number) => { setIdx(n); setPos(0); };
  const next = () => go(shuffle ? Math.floor(Math.random() * TRACKS.length) : (idx + 1) % TRACKS.length);
  useEffect(() => { if (!playing) return; const id = setInterval(() => setPos((p) => p + 10), 1000); return () => clearInterval(id); }, [playing]);
  useEffect(() => { if (pos >= dur) next(); }, [pos]);
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Queue" }]} actions={<Badge tone={playing ? "success" : "neutral"} dot>{playing ? "Playing" : "Paused"}</Badge>} />
      <MusicPlayerCardsBlock block={{ id: "m", type: "musicPlayerCards", cards: [{ id: "p", title: name, artist, sourceLabel: "Local sample", progress: Math.round((pos / dur) * 100), elapsed: mmss(pos), duration: mmss(dur), playing }] } as any} />
      <Row style={{ justifyContent: "center" }}>
        <IconButton icon="skip-back" label="Previous track" variant="secondary" onClick={() => go((idx + TRACKS.length - 1) % TRACKS.length)} />
        <IconButton icon={playing ? "pause" : "play"} label={playing ? "Pause queue" : "Play queue"} variant="primary" onClick={() => setPlaying(!playing)} />
        <IconButton icon="skip-forward" label="Next track" variant="secondary" onClick={next} />
      </Row>
      <Switch id="shuffle" label="Shuffle" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
      <Col gap={2}>{TRACKS.map(([t, a, d], i) => <ListItem key={t} label={t} description={a} trailing={mmss(d)} active={i === idx} onClick={() => go(i)} />)}</Col>
      <p style={{ fontSize: 12, color: "var(--lf-text-secondary)", margin: 0 }}>No audio plays: progress is simulated.</p>
      <Live>{playing ? "Playing" : "Paused"} {name}</Live>
    </Screen>
  );
}
