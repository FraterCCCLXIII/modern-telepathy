import { useState } from "react";
import { Tabs, TabPanel } from "@ui/components/primitives/Tabs";
import { ListItem } from "@ui/components/primitives/ListItem";
import { IconButton } from "@ui/components/primitives/IconButton";
import { Input } from "@ui/components/primitives/Input";
import { Button } from "@ui/components/primitives/Button";
import { Badge } from "@ui/components/primitives/Badge";
import { EmptyState } from "@ui/components/primitives/EmptyState";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Row, Live } from "./kit";

const ORDER = ["toread", "reading", "done"];
const LABEL: Record<string, string> = { toread: "To read", reading: "Reading", done: "Done" };
export default function ReadingList() {
  const [tab, setTab] = useState("toread"); const [say, setSay] = useState(""); const [title, setTitle] = useState("");
  const [books, setBooks] = useState([{ id: "b1", t: "The Left Hand of Darkness", a: "Le Guin", s: "reading" }, { id: "b2", t: "Piranesi", a: "Clarke", s: "toread" }, { id: "b3", t: "Kindred", a: "Butler", s: "toread" }, { id: "b4", t: "Solaris", a: "Lem", s: "done" }]);
  const adv = (id: string) => setBooks(books.map((b) => { if (b.id !== id) return b; const s = ORDER[Math.min(2, ORDER.indexOf(b.s) + 1)]; setSay(`${b.t} moved to ${LABEL[s]}`); return { ...b, s }; }));
  const add = () => { if (title.trim()) { setBooks([...books, { id: "b" + Date.now(), t: title.trim(), a: "Unknown", s: "toread" }]); setTitle(""); } };
  const list = books.filter((b) => b.s === tab);
  return (
    <Screen>
      <TopBar breadcrumb={[{ label: "Reading list" }]} actions={<Badge>{books.length} books</Badge>} />
      <Tabs aria-label="Status" items={ORDER.map((id) => ({ id, label: `${LABEL[id]} (${books.filter((b) => b.s === id).length})` }))} value={tab} onChange={setTab} />
      <TabPanel id={tab} active><Col gap={2}>
        {list.length === 0 && <EmptyState title="Nothing here" description="Move a book in, or add one." />}
        {list.map((b) => <Row key={b.id} gap={4} style={{ flexWrap: "nowrap" }}><div style={{ flex: 1, minWidth: 0 }}><ListItem label={b.t} description={b.a} trailing={b.s === "done" ? <Badge tone="success">Finished</Badge> : undefined} /></div>{b.s !== "done" && <IconButton icon="chevron-right" label={`Move ${b.t} forward`} size="sm" variant="secondary" onClick={() => adv(b.id)} />}</Row>)}
      </Col></TabPanel>
      <Row><Input aria-label="Add a book" placeholder="Add a book" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 1 }} /><Button variant="primary" onClick={add}>Add</Button></Row>
      <Live>{say}</Live>
    </Screen>
  );
}
