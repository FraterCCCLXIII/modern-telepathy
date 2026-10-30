import { useState } from "react";
import { MessageBubble } from "@ui/components/workspaces/chat/MessageBubble";
import { Composer } from "@ui/components/workspaces/chat/Composer";
import { PromptChips } from "@ui/components/workspaces/chat/PromptChips";
import { AgentTodoCard } from "@ui/components/workspaces/chat/agent-blocks";
import { ComposerNotice } from "@ui/components/workspaces/chat/ComposerNotice";
import { TopBar } from "@ui/components/shell/TopBar";
import { Screen, Col, Live } from "./kit";

const QS = ["What did you finish yesterday?", "What are you working on today?", "Anything blocking you?"];
const QUICK = [["Shipped the header", "Starting the footer", "No blockers"], ["Fixed two bugs", "Reviewing PRs", "Waiting on design"]];
export default function Standup() {
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const step = answers.length;
  const send = (t: string) => { if (t.trim() && step < QS.length) { setAnswers([...answers, t.trim()]); setDraft(""); } };
  const msgs: any[] = [{ id: "g", role: "agent", content: "Hi! Quick standup. Three questions." }];
  QS.forEach((q, i) => { if (i <= step) msgs.push({ id: "q" + i, role: "agent", content: q }); if (answers[i]) msgs.push({ id: "a" + i, role: "user", content: answers[i] }); });
  return (
    <Screen gap={8} pad={10}>
      <TopBar breadcrumb={[{ label: "Standup bot" }]} />
      <Col gap={8} style={{ flex: 1, overflow: "auto", alignContent: "start" }}>
        {msgs.map((m) => <MessageBubble key={m.id} message={m} />)}
        {step >= QS.length && (<>
          <AgentTodoCard items={QS.map((q, i) => ({ id: "t" + i, label: `${q.replace("?", "")}: ${answers[i]}`, status: "completed" as const }))} />
          <ComposerNotice tone="success" icon="check">Summary ready. It stays on this page; nothing is posted.</ComposerNotice>
        </>)}
      </Col>
      {step < QS.length && <PromptChips items={QUICK.map((q, i) => ({ id: "c" + i, label: q[step] }))} onSelect={(c) => send(c.label)} />}
      {step < QS.length && <Composer value={draft} onChange={setDraft} onSubmit={() => send(draft)} placeholder="Type your answer" inputAriaLabel="Your answer" />}
      <Live>{step >= QS.length ? "Standup summary ready" : QS[step]}</Live>
    </Screen>
  );
}
