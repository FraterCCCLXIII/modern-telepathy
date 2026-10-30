// The chosen set: 25 generated-UI blocks + 6 primitives from the owner's longformer-ui package.
// `file` is the component's source file relative to packages/longformer-ui/src/components.
export const CATEGORIES = [
  { id: "primitives", label: "Primitives" },
  { id: "cards", label: "Cards" },
  { id: "charts", label: "Charts & stats" },
  { id: "tasks", label: "Tasks & calendar" },
  { id: "forms", label: "Forms" },
  { id: "media", label: "Media" },
  { id: "code", label: "Code & text" },
  { id: "status", label: "Status" },
];

const b = (type, category, file) => ({ kind: "block", type, category, file: `workspaces/generated-ui/blocks/${file}.tsx` });
const p = (name, category, extra = {}) => ({ kind: "primitive", type: name, category, file: `primitives/${name}/${name}.tsx`, ...extra });

export const COMPONENTS = [
  p("Button", "primitives", { props: ["ButtonProps"] }),
  p("Badge", "primitives", { props: ["BadgeProps"] }),
  p("Chip", "primitives", { props: ["ChipProps"] }),
  p("Switch", "primitives", { props: ["SwitchProps"] }),
  p("Input", "primitives", { props: ["InputProps"] }),
  p("Tabs", "primitives", { props: ["TabsProps", "TabItem"] }),

  b("cardGrid", "cards", "CardGridBlock"),
  b("mediaCards", "cards", "MediaCardsBlock"),
  b("listingCards", "cards", "ListingCardsBlock"),
  b("insightCards", "cards", "InsightCardsBlock"),
  b("newsFeedCards", "cards", "NewsFeedCardsBlock"),

  b("statCards", "charts", "StatCardsBlock"),
  b("metricChartCards", "charts", "MetricChartCardsBlock"),
  b("miniStatChartCards", "charts", "MiniStatChartCardsBlock"),
  b("savedMoneyCards", "charts", "SavedMoneyCardsBlock"),
  b("fearGreedCards", "charts", "FearGreedCardsBlock"),
  b("weeklyStreakCards", "charts", "WeeklyStreakCardsBlock"),
  b("cryptoMarketCards", "charts", "CryptoMarketCardsBlock"),

  b("taskChecklistCards", "tasks", "TaskChecklistCardsBlock"),
  b("calendarScheduleCards", "tasks", "CalendarScheduleCardsBlock"),
  b("eventCards", "tasks", "EventCardsBlock"),
  b("scheduleSlots", "tasks", "ScheduleSlotsBlock"),
  b("timelineSteps", "tasks", "TimelineStepsBlock"),
  b("selectionTiles", "tasks", "SelectionTilesBlock"),

  b("form", "forms", "FormBlock"),

  b("musicPlayerCards", "media", "MusicPlayerCardsBlock"),
  b("videoPlayerCards", "media", "VideoPlayerCardsBlock"),

  b("text", "code", "TextBlock"),
  b("code", "code", "CodeBlock"),
  b("terminal", "code", "TerminalBlock"),

  b("batteryStatusCards", "status", "BatteryStatusCardsBlock"),
];
