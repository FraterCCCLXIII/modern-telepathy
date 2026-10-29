import { useEffect, useState } from "react";
import { Button } from "@ui/components/primitives/Button";
import { Badge } from "@ui/components/primitives/Badge";
import { Card } from "@ui/components/primitives/Card";
import { ListItem } from "@ui/components/primitives/ListItem";
import { ComposerTaskList } from "@ui/components/workspaces/chat/ComposerTaskList";
import { ComposerNotice } from "@ui/components/workspaces/chat/ComposerNotice";
import { AgentActionBlock, AgentStatusLine } from "@ui/components/workspaces/chat/agent-blocks";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live } from "./kit";

const RUNS = [{ id: "r1", name: "Summarize inbox", steps: ["Fetch messages", "Cluster topics", "Write summary"] }, { id: "r2", name: "Update changelog", steps: ["Read commits", "Draft entries", "Open review"], failAt: 2 }, { id: "r3", name: "Nightly cleanup", steps: ["List files", "Archive old", "Report"] }];
export default function AgentMonitor() {
  const [sel, setSel] = useState("r1");
  const [prog, setProg] = useState<Record<string, { n: number; run: boolean; fail: boolean }>>({});
  useEffect(() => {
    const id = setInterval(() => setProg((p) => { const o = { ...p }; for (const r of RUNS) { const s = o[r.id]; if (s && s.run) { const n = s.n + 1; const fail = r.failAt === n && !s.fail && !(s as any).retried; o[r.id] = fail ? { ...s, run: false, fail: true } : { ...s, n, run: n < r.steps.length }; } } return o; }), 900);
    return () => clearInterval(id);
  }, []);
  const run = RUNS.find((r) => r.id === sel)!; const s = prog[sel] || { n: 0, run: false, fail: false };
  const status = (id: string) => { const x = prog[id]; const r = RUNS.find((q) => q.id === id)!; return !x ? "idle" : x.fail ? "failed" : x.run ? "running" : x.n >= r.steps.length ? "done" : "paused"; };
  const start = () => setProg({ ...prog, [sel]: { n: s.n >= run.steps.length || s.fail ? 0 : s.n, run: true, fail: false, ...(s.fail ? { retried: true } : {}) } as any });
  return (
    <Screen style={{ flexDirection: "row", alignItems: "stretch" }} gap={14}>
      <Col style={{ width: 260 }} gap={6}>
        <TopBar breadcrumb={[{ label: "Agent runs" }]} />
        {RUNS.map((r) => { const st = status(r.id); return <ListItem key={r.id} label={r.name} description={`${r.steps.length} steps`} active={sel === r.id} onClick={() => setSel(r.id)} trailing={<Badge tone={st === "done" ? "success" : st === "failed" ? "danger" : st === "running" ? "accent" : "neutral"} dot={st === "running"}>{st}</Badge>} />; })}
      </Col>
      <Col style={{ flex: 1 }} gap={10}>
        <Row style={{ justifyContent: "space-between" }}><strong>{run.name}</strong><Button variant="primary" onClick={start} disabled={s.run}>{s.fail ? "Retry" : s.n >= run.steps.length ? "Run again" : s.run ? "Running" : "Start run"}</Button></Row>
        <Card padding="md"><ComposerTaskList groupCompletedAfter={Infinity} items={run.steps.map((t, i) => ({ id: t, label: t, status: s.fail && i === s.n ? ("pending" as const) : i < s.n ? ("completed" as const) : i === s.n && s.run ? ("active" as const) : ("pending" as const) }))} /></Card>
        {s.fail && <ComposerNotice tone="danger" icon="close">Step failed: could not reach the (sample) review service. Retry to continue.</ComposerNotice>}
        {s.run && <AgentStatusLine>Working on: {run.steps[s.n]}</AgentStatusLine>}
        {(s.n > 0) && <AgentActionBlock title={`Log for ${run.name}`} command="agent run" output={run.steps.slice(0, s.n).map((t) => `ok  ${t}`)} defaultOpen />}
      </Col>
      <Live>{run.name}: {status(sel)}</Live>
    </Screen>
  );
}
