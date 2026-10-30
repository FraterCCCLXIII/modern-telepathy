// Bundle "miniapps": 17 small interactive apps composed only from the kit's components (plus local state).
import type { ComponentType } from "react";
import "@ui/tokens/theme.css";
import "./uix-light.css";
import { mountInto, noop } from "./common";
import { ThemeProvider } from "@ui/tokens/ThemeProvider";
import Habits from "./mini/Habits"; import FocusTimer from "./mini/FocusTimer"; import Expenses from "./mini/Expenses"; import Recipe from "./mini/Recipe";
import Flashcards from "./mini/Flashcards"; import Itinerary from "./mini/Itinerary"; import Mood from "./mini/Mood"; import Kanban from "./mini/Kanban";
import MusicQueue from "./mini/MusicQueue"; import MeetingNotes from "./mini/MeetingNotes"; import Standup from "./mini/Standup"; import AgentMonitor from "./mini/AgentMonitor";
import Converter from "./mini/Converter"; import GenChat from "./mini/GenChat"; import PlantCare from "./mini/PlantCare"; import ReadingList from "./mini/ReadingList"; import Crm from "./mini/Crm";

const APPS: Record<string, ComponentType> = {
  habits: Habits, "focus-timer": FocusTimer, "expense-splitter": Expenses, recipe: Recipe, flashcards: Flashcards, itinerary: Itinerary, "mood-journal": Mood,
  kanban: Kanban, "music-queue": MusicQueue, "meeting-notes": MeetingNotes, "standup-bot": Standup, "agent-monitor": AgentMonitor, converter: Converter,
  "agent-cards": GenChat, "plant-care": PlantCare, "reading-list": ReadingList, crm: Crm,
};
export function renderMini(el: Element, id: string) {
  const C = APPS[id];
  if (!C) throw new Error("No mini app " + id);
  mountInto(el, <ThemeProvider defaultTheme="light" persist={false} className="ux-fill"><div className="ux-cv" style={{ height: "100%", ["--lf-surface-canvas" as any]: "#f4f4f6" }}><C /></div></ThemeProvider>);
}
export const miniIds = Object.keys(APPS);
export { unmountTile } from "./common";
void noop;
