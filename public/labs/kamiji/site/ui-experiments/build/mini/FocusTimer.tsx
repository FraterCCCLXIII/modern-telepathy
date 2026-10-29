import { useEffect, useRef, useState } from "react";
import { Button } from "@ui/components/primitives/Button";
import { Tabs, TabPanel } from "@ui/components/primitives/Tabs";
import { Switch } from "@ui/components/primitives/Switch";
import { Badge } from "@ui/components/primitives/Badge";
import { Chip } from "@ui/components/primitives/Chip";
import { Card } from "@ui/components/primitives/Card";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live, muted } from "./kit";

const MODES: Record<string, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export default function FocusTimer() {
  const [mode, setMode] = useState("focus");
  const [left, setLeft] = useState(MODES.focus);
  const [running, setRunning] = useState(false);
  const [fast, setFast] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [say, setSay] = useState("");
  const tick = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((l) => Math.max(0, l - (fast ? 30 : 1))), 1000);
    return () => clearInterval(tick.current);
  }, [running, fast]);
  useEffect(() => {
    if (left === 0 && running) { setRunning(false); if (mode === "focus") setSessions((n) => n + 1); setSay(mode === "focus" ? "Focus session complete" : "Break over"); }
  }, [left, running, mode]);
  const pick = (m: string) => { setMode(m); setLeft(MODES[m]); setRunning(false); setSay(""); };
  const pct = Math.round((1 - left / MODES[mode]) * 100);
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Focus" }]} actions={<Badge tone="accent">{sessions} sessions</Badge>} />
      <Tabs aria-label="Timer mode" items={[{ id: "focus", label: "Focus" }, { id: "short", label: "Short break" }, { id: "long", label: "Long break" }]} value={mode} onChange={pick} />
      <TabPanel id={mode} active><Card padding="lg">
        <Col gap={10} style={{ textAlign: "center", justifyItems: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="time">{fmt(left)}</div>
          <progress value={pct} max={100} aria-label="Session progress" style={{ width: "100%" }} />
          <Row><Chip icon="target" active>Write the report</Chip></Row>
          <Row>
            <Button variant="primary" onClick={() => { setRunning(!running); setSay(running ? "Paused" : "Started"); }}>{running ? "Pause" : "Start"}</Button>
            <Button variant="secondary" onClick={() => pick(mode)}>Reset</Button>
          </Row>
        </Col>
      </Card></TabPanel>
      <Switch id="fast-timer" label="Demo speed (30x)" checked={fast} onChange={(e) => setFast(e.target.checked)} />
      <p style={muted}>Timers run locally in this page. Nothing is saved.</p>
      <Live>{say}{running && left % 60 === 0 ? ` ${left / 60} minutes left` : ""}</Live>
    </Screen>
  );
}
