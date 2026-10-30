import { useState } from "react";
import { Tabs, TabPanel } from "@ui/components/primitives/Tabs";
import { Input } from "@ui/components/primitives/Input";
import { Chip } from "@ui/components/primitives/Chip";
import { IconButton } from "@ui/components/primitives/IconButton";
import { Card } from "@ui/components/primitives/Card";
import { CalculatorPad } from "@ui/components/primitives/CalculatorPad";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live } from "./kit";

const UNITS: Record<string, Record<string, number>> = { length: { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 }, weight: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.028349523 } };
const conv = (kind: string, v: number, from: string, to: string) => {
  if (kind === "temp") { const c = from === "C" ? v : from === "F" ? ((v - 32) * 5) / 9 : v - 273.15; return to === "C" ? c : to === "F" ? (c * 9) / 5 + 32 : c + 273.15; }
  return (v * UNITS[kind][from]) / UNITS[kind][to];
};
const LISTS: Record<string, string[]> = { length: Object.keys(UNITS.length), weight: Object.keys(UNITS.weight), temp: ["C", "F", "K"] };
export default function Converter() {
  const [tab, setTab] = useState("length"); const [val, setVal] = useState("10");
  const [from, setFrom] = useState("km"); const [to, setTo] = useState("mi");
  const pick = (t: string) => { setTab(t); if (t !== "calc") { setFrom(LISTS[t][0]); setTo(LISTS[t][1]); } };
  const n = parseFloat(val); const out = Number.isFinite(n) && tab !== "calc" ? conv(tab, n, from, to) : NaN;
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Converter" }]} />
      <Tabs aria-label="Mode" items={[{ id: "length", label: "Length" }, { id: "weight", label: "Weight" }, { id: "temp", label: "Temp" }, { id: "calc", label: "Calc" }]} value={tab} onChange={pick} />
      <TabPanel id={tab} active>{tab === "calc" ? <div style={{ maxWidth: 260, margin: "0 auto" }}><CalculatorPad /></div> : (
        <Col gap={10}>
          <Input aria-label="Value" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
          <Row>{LISTS[tab].map((u) => <Chip key={"f" + u} active={from === u} onClick={() => setFrom(u)}>{u}</Chip>)}</Row>
          <Row style={{ justifyContent: "center" }}><IconButton icon="refresh" label="Swap units" variant="secondary" onClick={() => { setFrom(to); setTo(from); }} /></Row>
          <Row>{LISTS[tab].map((u) => <Chip key={"t" + u} active={to === u} onClick={() => setTo(u)}>{u}</Chip>)}</Row>
          <Card padding="lg"><div style={{ fontSize: 28, fontWeight: 700 }} data-testid="result">{Number.isFinite(out) ? `${Math.round(out * 1000) / 1000} ${to}` : "Enter a number"}</div><div style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>{val || "0"} {from}</div></Card>
        </Col>
      )}</TabPanel>
      <Live>{Number.isFinite(out) ? `${Math.round(out * 1000) / 1000} ${to}` : ""}</Live>
    </Screen>
  );
}
