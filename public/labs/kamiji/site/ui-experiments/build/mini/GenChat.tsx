import { useState, type ReactNode } from "react";
import { MessageBubble } from "@ui/components/workspaces/chat/MessageBubble";
import { Composer } from "@ui/components/workspaces/chat/Composer";
import { PromptChips } from "@ui/components/workspaces/chat/PromptChips";
import { ThinkingBlock } from "@ui/components/workspaces/chat/ThinkingBlock";
import { TopBar } from "@ui/components/shell/TopBar";
import { StatCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/StatCardsBlock";
import { EventCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/EventCardsBlock";
import { MiniStatChartCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MiniStatChartCardsBlock";
import { InsightCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/InsightCardsBlock";
import { MediaCardsBlock } from "@ui/components/workspaces/generated-ui/blocks/MediaCardsBlock";
import { TimelineStepsBlock } from "@ui/components/workspaces/generated-ui/blocks/TimelineStepsBlock";
import { Screen, Col, Live } from "./kit";

const REPLIES: Record<string, () => ReactNode> = {
  week: () => (<Col gap={8}><span>Here is your week at a glance.</span><EventCardsBlock block={{ id: "e", type: "eventCards", title: "Today", cards: [{ id: "1", title: "Design review", startTime: "10:00", endTime: "11:00", timeLeft: { icon: "clock", label: "In 40 min" } }, { id: "2", title: "Focus block", startTime: "14:00", endTime: "16:00", timeLeft: { icon: "calendar", label: "Later" } }] } as any} /><StatCardsBlock block={{ id: "s", type: "statCards", cards: [{ id: "a", icon: "calendar", label: "Meetings", value: "6", tone: "accent", visualization: { type: "dots", total: 10, filled: 6 } }] } as any} /></Col>),
  budget: () => (<Col gap={8}><span>Spending is up a little this month.</span><MiniStatChartCardsBlock block={{ id: "m", type: "miniStatChartCards", cards: [{ id: "1", title: "Food", subtitle: "Last month", value: "$420", change: "+4%", changeDirection: "up", chartType: "bar" }, { id: "2", title: "Travel", subtitle: "Last month", value: "$180", change: "-12%", changeDirection: "down", chartType: "line" }] } as any} /><InsightCardsBlock block={{ id: "i", type: "insightCards", cards: [{ id: "x", label: "Tip", title: "Cap dining out", description: "Two fewer takeaways saves about $60." }] } as any} /></Col>),
  trip: () => (<Col gap={8}><span>Two stays and a plan.</span><MediaCardsBlock block={{ id: "t", type: "mediaCards", cards: [{ id: "1", tone: "accent", title: "Harbor Inn", description: "Near the station, quiet rooms.", badges: [{ icon: "star", label: "4.7" }], actionLabel: "View" }] } as any} /><TimelineStepsBlock block={{ id: "l", type: "timelineSteps", title: "Plan", steps: [{ id: "1", label: "Book stay", completed: true }, { id: "2", label: "Pick days", completed: false }, { id: "3", label: "Pack", completed: false, showConnector: false }] } as any} /></Col>),
};
const CHIPS = [{ id: "week", label: "Show my week", icon: "calendar" as const }, { id: "budget", label: "Budget summary", icon: "dollar-sign" as const }, { id: "trip", label: "Plan a trip", icon: "plane" as const }];
export default function GenChat() {
  const [msgs, setMsgs] = useState<any[]>([{ id: "0", role: "agent", content: "Ask for your week, a budget summary, or a trip plan. I answer with cards." }]);
  const [draft, setDraft] = useState("");
  const ask = (text: string) => {
    const key = /week|calendar|schedule/i.test(text) ? "week" : /budget|spend|money/i.test(text) ? "budget" : /trip|travel|stay/i.test(text) ? "trip" : "";
    const reply = key ? { id: "a" + Date.now(), role: "agent", content: <Col gap={8}><ThinkingBlock label="Picked a card layout" defaultOpen={false}>Matched "{key}" to a registered block set.</ThinkingBlock>{REPLIES[key]()}</Col> } : { id: "a" + Date.now(), role: "agent", content: "I only know three tricks here: week, budget and trip." };
    setMsgs((m) => [...m, { id: "u" + Date.now(), role: "user", content: text }, reply]); setDraft("");
  };
  return (
    <Screen gap={8} pad={10}>
      <TopBar breadcrumb={[{ label: "Agent with cards" }]} />
      <Col gap={8} style={{ flex: 1, overflow: "auto", alignContent: "start" }}>{msgs.map((m) => <MessageBubble key={m.id} message={m} />)}</Col>
      <PromptChips items={CHIPS} onSelect={(c) => ask(c.label)} />
      <Composer value={draft} onChange={setDraft} onSubmit={() => draft.trim() && ask(draft)} placeholder="Ask for cards" inputAriaLabel="Ask the agent" />
      <Live>{msgs.length} messages</Live>
    </Screen>
  );
}
