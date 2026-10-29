// Tile metadata for the UI Experiments gallery. `source` is relative to the owner's workspace root.
// Status rules (see ../README.md): "available" = named as a Tier 1 primitive in the workspace plan (APP-INDEX-AND-LIBRARY-PLAN.md)
// or a block whose registry entry has strict: true; "prototype" = exists in the workspace but is a demo/reference-tier or
// planned-extraction piece per that plan, or a block with envelope-only validation; "unverified" = not classified by the plan or registry.
export const CATEGORIES = [
  { id: "mini", label: "Mini apps" },
  { id: "shell", label: "Shells & layout" },
  { id: "chat", label: "Chat" },
  { id: "primitives", label: "Primitives & forms" },
  { id: "cards", label: "Cards" },
  { id: "apps", label: "App views" },
  { id: "site", label: "Site sections" },
  { id: "output", label: "Generated pages" },
  { id: "overlays", label: "Overlays" },
  { id: "planned", label: "Planned" },
];

const U = "packages/longformer-ui/src/";
const C = U + "components/";
const t = (id, name, cat, source, status, desc, snippet, extra = {}) => ({ id, name, cat, kind: "component", source, status, desc, snippet, ...extra });
const T1 = "Named as a Tier 1 primitive in the workspace plan.";
const P_SHELL = "Shell piece: the plan lists the shell as Tier 3, a v1 target, not yet extracted.";
const P_CHAT = "Part of the chat/composer stack the plan marks P1 for extraction.";
const P_APP = "A workspace view: the plan calls these demo/reference tier, not library exports.";

export const STATIC_TILES = [
  // ---- shell
  t("app-shell", "AppShell", "shell", C + "shell/AppShell/AppShell.tsx", "prototype", "The rail | sidebar | main | context-panel frame every reference app shares. Here with NavRail, NavSidebar and TopBar.",
    `<AppShell\n  rail={<NavRail items={items} activeId={id} onSelect={setId} />}\n  sidebar={<NavSidebar sections={sections} />}\n  main={<><TopBar breadcrumb={[{ label: "Notes" }]} />…</>}\n/>`, { statusNote: P_SHELL, stage: { w: 860, h: 400 }, wide: true }),
  t("nav-rail", "NavRail", "shell", C + "shell/NavRail/NavRail.tsx", "prototype", "Far-left icon rail for switching workspaces; icons with tooltips.", `<NavRail items={[{ id: "chat", label: "Chat", icon: "chat" }]}\n  activeId={id} onSelect={setId} brand={<b>L</b>} />`, { statusNote: P_SHELL }),
  t("nav-rail-expanded", "NavRail, expanded", "shell", C + "shell/NavRail/NavRail.tsx", "prototype", "The same rail with icon and label rows. It can also reorder and overflow items (props not shown here).", `<NavRail items={items} activeId={id} onSelect={setId}\n  defaultExpanded collapsible />`, { statusNote: P_SHELL }),
  t("nav-sidebar", "NavSidebar", "shell", C + "shell/NavSidebar/NavSidebar.tsx", "prototype", "Contextual sidebar: primary action, quick links and titled sections of list items.", `<NavSidebar\n  primaryAction={{ label: "New note", icon: "plus" }}\n  quickLinks={[{ id: "s", label: "Search", icon: "search" }]}\n  sections={[{ id: "recent", title: "Recent", items }]} />`, { statusNote: P_SHELL }),
  t("top-bar", "TopBar", "shell", C + "shell/TopBar/TopBar.tsx", "prototype", "Breadcrumb, overlapping collaborator avatars and an action slot.", `<TopBar breadcrumb={[{ label: "Files" }, { label: "Projects" }]}\n  collaborators={[{ name: "Ada Lee" }]} actions={<Button size="sm">Share</Button>} />`, { statusNote: P_SHELL }),
  t("list-pane", "ListPane", "shell", C + "shell/ListPane/ListPane.tsx", "prototype", "List column with a title row, header actions, a toolbar slot and a scrolling body.", `<ListPane title="Inbox" toolbar={<Input placeholder="Search" />}>\n  <ListItem label="Ada Lee" description="Re: permit" />\n</ListPane>`, { statusNote: P_SHELL }),
  t("workspace-picker", "WorkspacePicker", "shell", C + "shell/WorkspacePicker/WorkspacePicker.tsx", "prototype", "Dropdown to switch between workspaces, each with a plan label.", `<WorkspacePicker value={id} onChange={setId}\n  options={[{ id: "w1", name: "Personal", planLabel: "Free", icon: "home" }]} />`, { statusNote: P_SHELL }),
  t("phone-home", "PhoneHomeScreen", "apps", C + "interactions/PhoneHomeScreen/PhoneHomeScreen.tsx", "prototype", "A phone home screen with paged app grid, folders and a dock. The default layout is seeded randomly, so it differs per load.", `<PhoneHomeScreen fill pageCount={2} carrier="Sample" />`, { statusNote: "Registered as a block with envelope-only validation.", extraSources: [C + "interactions/PhoneHomeScreen/types.ts"], comps: ["PhoneHomeScreen"], note: "Layout is random on each load." }),

  // ---- primitives
  t("avatar", "Avatar", "primitives", C + "primitives/Avatar/Avatar.tsx", "available", "Initials avatar in three sizes with an online / away / offline dot.", `<Avatar name="Ada Lee" size="md" status="online" />`, { statusNote: T1 }),
  t("card", "Card", "primitives", C + "primitives/Card/Card.tsx", "available", "Surface container with four paddings and an interactive state.", `<Card padding="md" interactive>…</Card>`, { statusNote: T1 }),
  t("checkbox", "Checkbox", "primitives", C + "primitives/Checkbox/Checkbox.tsx", "available", "Native checkbox with a styled box and optional label.", `<Checkbox label="Email me a summary" checked={on}\n  onChange={(e) => setOn(e.target.checked)} />`, { statusNote: T1 }),
  t("textarea-label", "Textarea and Label", "primitives", C + "primitives/Textarea/Textarea.tsx", "available", "Auto-growing textarea (up to maxHeight) paired with a Label that has hint text.", `<Label htmlFor="n" hint="Grows with content">Notes</Label>\n<Textarea id="n" autoResize maxHeight={140} />`, { statusNote: T1, extraSources: [C + "primitives/Label/Label.tsx"] }),
  t("kbd-divider", "Kbd and Divider", "primitives", C + "primitives/Kbd/Kbd.tsx", "available", "Inline keyboard-key badge and horizontal or vertical divider.", `<Kbd>Ctrl</Kbd> <Kbd>K</Kbd>\n<Divider orientation="vertical" />`, { statusNote: T1, extraSources: [C + "primitives/Divider/Divider.tsx"] }),
  t("empty-state", "EmptyState", "primitives", C + "primitives/EmptyState/EmptyState.tsx", "available", "Empty-list placeholder with icon, title, description and actions.", `<EmptyState icon={<Icon name="inbox" />} title="No messages yet"\n  description="…" actions={<Button>Compose</Button>} />`, { statusNote: T1 }),
  t("list-item", "ListItem", "primitives", C + "primitives/ListItem/ListItem.tsx", "available", "Row with leading slot, label, description, trailing slot and an active state.", `<ListItem leading={<Icon name="inbox" />} label="Inbox"\n  description="12 unread" trailing="12" active />`, { statusNote: T1 }),
  t("menu", "Menu", "primitives", C + "primitives/Menu/Menu.tsx", "available", "Popup menu: icons, shortcuts, danger items, separators, keyboard navigation.", `<Menu trigger={<Button>Actions</Button>} items={[\n  { id: "edit", label: "Rename", icon: "edit" },\n  { id: "del", label: "Delete", danger: true, separatorAbove: true },\n]} />`, { statusNote: T1 }),
  t("modal", "Modal", "primitives", C + "primitives/Modal/Modal.tsx", "available", "Dialog with title, body and footer; closes on Escape or the scrim.", `<Modal open={open} onClose={close} title="Delete this note?"\n  footer={<Button variant="danger">Delete</Button>}>…</Modal>`, { statusNote: T1 }),
  t("tooltip-hovercard", "Tooltip and HoverCard", "primitives", C + "primitives/Tooltip/Tooltip.tsx", "available", "A short label tooltip and a richer card shown on hover or keyboard focus.", `<Tooltip label="Add"><IconButton icon="plus" label="Add" /></Tooltip>\n<HoverCard content={<Profile />}><Button>Hover me</Button></HoverCard>`, { statusNote: T1, extraSources: [C + "primitives/HoverCard/HoverCard.tsx"] }),
  t("icon-button", "IconButton", "primitives", C + "primitives/IconButton/IconButton.tsx", "unverified", "Square button with an icon and a required accessible label; four variants.", `<IconButton icon="send" label="Send" variant="primary" />`, { statusNote: "Not named in the plan's Tier 1 list, so its status is not classified." }),
  t("scroll-area", "ScrollArea", "primitives", C + "primitives/ScrollArea/ScrollArea.tsx", "available", "Scroll container with the kit's thin scrollbar.", `<ScrollArea direction="vertical" style={{ height: 150 }}>…</ScrollArea>`, { statusNote: T1 }),
  t("resizable-pane", "ResizablePane", "primitives", C + "primitives/ResizablePane/ResizablePane.tsx", "available", "Pane with a drag grip (and keyboard resize) on one edge.", `<ResizablePane width={w} onWidthChange={setW} minWidth={90}\n  maxWidth={260} handleSide="right">…</ResizablePane>`, { statusNote: T1 }),
  t("app-icon", "AppIcon", "primitives", C + "primitives/AppIcon/AppIcon.tsx", "unverified", "Launcher tile with a hue per app, running dot and unread badge.", `<AppIcon label="Mail" icon="mail" appId="mail" badgeCount={3} running />`, { statusNote: "Not named in the plan's Tier 1 list, so its status is not classified." }),
  t("calculator-pad", "CalculatorPad", "primitives", C + "primitives/CalculatorPad/CalculatorPad.tsx", "unverified", "A working retro calculator keypad with an optional brand strip.", `<CalculatorPad branded />`, { statusNote: "A domain widget; the plan does not classify it." }),

  // ---- chat
  t("message-bubble", "MessageBubble", "chat", C + "workspaces/chat/MessageBubble.tsx", "unverified", "User and agent messages with hover actions (copy, edit, regenerate, thumbs) and an optional thinking trace.", `<MessageBubble message={{ id, role: "agent", content, thinking }}\n  onAgentCopy={copy} onAgentRegenerate={retry} />`, { statusNote: "Not named in the plan, so its status is not classified." }),
  t("thinking-block", "ThinkingBlock", "chat", C + "workspaces/chat/ThinkingBlock.tsx", "unverified", "Collapsible reasoning trace shown above an agent reply.", `<ThinkingBlock label="Thinking">…steps…</ThinkingBlock>`, { statusNote: "Not named in the plan, so its status is not classified." }),
  t("prompt-chips", "PromptChips", "chat", C + "workspaces/chat/PromptChips.tsx", "prototype", "Suggestion chips shown under an empty chat.", `<PromptChips items={[{ id: "1", label: "Plan an event", icon: "calendar" }]}\n  onSelect={(item) => send(item.label)} />`, { statusNote: P_CHAT }),
  t("composer", "Composer", "chat", C + "workspaces/chat/Composer.tsx", "prototype", "The chat input: auto-growing textarea, attach menu, mode tabs, model menu, mic and send, plus a usage bar. Nothing is sent anywhere on this page.", `<Composer value={v} onChange={setV} onSubmit={send}\n  model="Sample model" modelOptions={models}\n  navItems={[{ id: "agent", label: "Agent" }]} activeNavId={mode}\n  usage={{ contextUsedK: 62, contextLimitK: 200, fiveHourPercent: 18, weeklyPercent: 41 }} />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/ComposerControlsRow.tsx", C + "workspaces/chat/ComposerAttachMenu.tsx"] }),
  t("composer-task-list", "ComposerTaskList", "chat", C + "workspaces/chat/ComposerTaskList.tsx", "prototype", "Docked task list with completed, active and pending items; finished tasks collapse into a row.", `<ComposerTaskList groupCompletedAfter={1} items={[\n  { id: "1", label: "Read tokens", status: "completed" },\n  { id: "2", label: "Write schema", status: "active" },\n]} />`, { statusNote: P_CHAT }),
  t("composer-notice", "ComposerNotice", "chat", C + "workspaces/chat/ComposerNotice.tsx", "prototype", "Banner under the input in five tones, with an optional action and dismiss.", `<ComposerNotice tone="warning" actionLabel="Upgrade" onAction={up}\n  onDismiss={close}>You are near your limit.</ComposerNotice>`, { statusNote: P_CHAT }),
  t("composer-file-changes", "ComposerFileChangeList", "chat", C + "workspaces/chat/ComposerFileChangeList.tsx", "prototype", "Changed-files list with +/- counts and file-kind marks.", `<ComposerFileChangeList onSelect={open} items={[\n  { id: "1", path: "src/Card.tsx", additions: 42, deletions: 6, kind: "tsx" },\n]} />`, { statusNote: P_CHAT }),
  t("composer-errors-queued", "Error and queued lists", "chat", C + "workspaces/chat/ComposerErrorList.tsx", "prototype", "Two small docked lists: build errors, and messages queued to send next.", `<ComposerErrorList items={[{ id: "1", label: "Build failed", detail: "…" }]} />\n<ComposerQueuedList items={[{ id: "q1", label: "Then add dark mode" }]} />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/ComposerQueuedList.tsx"] }),
  t("composer-status-bar", "ComposerStatusBar", "chat", C + "workspaces/chat/ComposerStatusBar.tsx", "prototype", "Context and plan usage with a popover (click the meter).", `<ComposerStatusBar usage={{ contextUsedK: 148, contextLimitK: 200,\n  fiveHourPercent: 64, weeklyPercent: 22 }} />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/UsagePopover.tsx"] }),
  t("conversation-tab-bar", "ConversationTabBar", "chat", C + "workspaces/chat/ConversationTabBar.tsx", "unverified", "Tabs for parallel conversations with a project label, close, new and history buttons.", `<ConversationTabBar tabs={tabs} activeId={id} onSelect={setId}\n  projectLabel="Event Planning" onClose={close} onNewTab={add} />`, { statusNote: "Not named in the plan, so its status is not classified." }),
  t("agent-action-block", "AgentActionBlock", "chat", C + "workspaces/chat/agent-blocks/AgentActionBlock.tsx", "prototype", "A tool call with command hint and collapsible monospace output.", `<AgentActionBlock title="List package structure" command="ls"\n  output={["packages/a", "packages/b"]} defaultOpen />`, { statusNote: P_CHAT }),
  t("agent-thought-block", "Agent thought, status and file chip", "chat", C + "workspaces/chat/agent-blocks/AgentThoughtBlock.tsx", "prototype", "Reasoning block with a duration label, a status line and file chips.", `<AgentThoughtBlock duration={12}>…</AgentThoughtBlock>\n<AgentStatusLine>Reading 3 files</AgentStatusLine>\n<AgentFileChip path="src/Card.tsx" kind="tsx" />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/agent-blocks/AgentStatusLine.tsx", C + "workspaces/chat/agent-blocks/AgentFileChip.tsx"] }),
  t("agent-todo-card", "AgentTodoCard", "chat", C + "workspaces/chat/agent-blocks/AgentTodoCard.tsx", "prototype", "The agent's own to-do list with active, pending and completed states.", `<AgentTodoCard items={[{ id: "1", label: "Inventory", status: "completed" }]} />`, { statusNote: P_CHAT }),
  t("agent-file-creation", "AgentFileCreationBlock", "chat", C + "workspaces/chat/agent-blocks/AgentFileCreationBlock.tsx", "prototype", "A collapsible 'Created N files' summary with filename pills.", `<AgentFileCreationBlock files={[\n  { id: "1", label: "Example manifest", filename: "tasklist.json" },\n]} />`, { statusNote: P_CHAT }),

  // ---- more shell / chat / primitives parts (core bundle)
  t("sidebar-pane", "SidebarPane", "shell", C + "shell/NavSidebar/SidebarPane.tsx", "prototype", "A resizable pane wrapper for sidebars.", `<SidebarPane width={w} onWidthChange={setW} minWidth={120} maxWidth={260}>…</SidebarPane>`, { statusNote: P_SHELL }),
  t("nav-sidebar-parts", "NavSidebar parts", "shell", C + "shell/NavSidebar/NavSidebar.tsx", "prototype", "Section header, filter, and grouped-items parts exported next to NavSidebar.", `<NavSidebarSectionHeader title="Recent" action={…} />\n<NavSidebarSectionFilter value={f} onChange={setF} options={…} />\n<NavSidebarGroupedItems groups={groups} />`, { statusNote: P_SHELL, comps: ["NavSidebarSectionHeader", "NavSidebarSectionFilter", "NavSidebarGroupedItems", "NavSidebarSectionAction"] }),
  t("sidebar-user-footer", "SidebarUserFooter", "shell", C + "shell/NavSidebar/NavSidebar.tsx", "prototype", "The avatar, name and plan row anchored to the bottom of a sidebar, plus a non-interactive bar variant.", `<SidebarUserFooter name="Sample User" meta="Sample plan" />\n<SidebarUserFooterBar name="Sample User" actions={…} />`, { statusNote: P_SHELL, comps: ["SidebarUserFooter", "SidebarUserFooterBar"] }),
  t("nav-rail-brand-overflow", "NavRailBrandMark and overflow card", "shell", C + "shell/NavRail/NavRailOverflowCard.tsx", "prototype", "The rail's brand mark and the card listing apps moved off the rail.", `<NavRailBrandMark />\n<NavRailOverflowCard items={items} activeId={id} expanded onSelect={s} onMoveToRail={m} />`, { statusNote: P_SHELL, extraSources: [C + "shell/NavRail/NavRailBrandMark.tsx"], comps: ["NavRailOverflowCard"] }),
  t("resize-handle", "ResizeHandle", "primitives", C + "primitives/ResizeHandle/ResizeHandle.tsx", "unverified", "The drag grip used by resizable panes, vertical and horizontal (static here: no pointer handler).", `<ResizeHandle onPointerDown={start} orientation="vertical" label="Resize width" />`, { statusNote: "Not named in the plan's Tier 1 list." }),
  t("design-shell", "DesignShell parts", "shell", C + "workspaces/design-shell/DesignShell.tsx", "prototype", "Parts shared by the design tools: a tool dock, canvas rulers and a side list.", `<ToolDock items={tools} activeId={id} onSelect={setId} />\n<CanvasRulers horizontalTicks={[0, 50, 100]} verticalTicks={[0, 50]}>…</CanvasRulers>`, { statusNote: P_SHELL, comps: ["ToolDock", "CanvasRulers", "SideList"] }),
  t("composer-attach-menu", "ComposerAttachMenu", "chat", C + "workspaces/chat/ComposerAttachMenu.tsx", "prototype", "The plus-button menu: add a file, and show or hide composer drawers.", `<ComposerAttachMenu onAddFile={add} drawerToggles={[{ id: "tasks", label: "Task list", visible, onVisibleChange }]} />`, { statusNote: P_CHAT }),
  t("composer-emoji-picker", "ComposerEmojiPicker", "chat", C + "workspaces/chat/ComposerEmojiPicker.tsx", "prototype", "Searchable emoji popover with category tabs. The emoji list (emoji-data.ts) is a data file of unclear provenance; it was not reviewed.", `<ComposerEmojiPicker onSelect={(emoji) => insert(emoji)} />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/emoji-data.ts"] }),
  t("composer-typeahead", "ComposerTypeahead", "chat", C + "workspaces/chat/ComposerTypeahead.tsx", "prototype", "Suggestion list that completes what you are typing.", `<ComposerTypeahead value={draft} items={items} activeIndex={0} onSelect={pick} />`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/ComposerTypeahead.types.ts"] }),
  t("composer-formatting", "ComposerFormattingToolbar", "chat", C + "workspaces/chat/ComposerFormattingToolbar.tsx", "prototype", "Inline formatting toolbar and its show/hide toggle.", `<ComposerFormattingToggle visible={on} onToggle={flip} />\n<ComposerFormattingToolbar visible={on} />`, { statusNote: P_CHAT, comps: ["ComposerFormattingToolbar", "ComposerFormattingToggle"] }),
  t("composer-drawer", "ComposerDrawer and stack", "chat", C + "workspaces/chat/ComposerDrawer.tsx", "prototype", "Collapsible docked panels above the input, stacked, with an error tone.", `<ComposerDrawerStack>\n  <ComposerDrawer title="Task 2 of 4" defaultOpen>…</ComposerDrawer>\n  <ComposerDrawer title="1 error" tone="danger" />\n</ComposerDrawerStack>`, { statusNote: P_CHAT, extraSources: [C + "workspaces/chat/ComposerDrawerStack.tsx"], comps: ["ComposerDrawer", "ComposerDrawerStack"] }),
  t("app-icon-tile", "AppIconTile", "primitives", U + "app-tones/AppIconTile.tsx", "unverified", "The colored launcher tile behind AppIcon, in eight sizes and two surfaces.", `<AppIconTile icon="mail" appId="mail" size="lg" />`, { statusNote: "Not classified by the plan or registry.", extraSources: [U + "app-tones/app-tones.ts"] }),
  t("icon-set", "Icon set", "primitives", U + "icons/Icon.tsx", "unverified", "Every icon name the kit exposes (a typed subset of lucide).", `<Icon name="mail" size={18} />`, { statusNote: "Not classified by the plan or registry.", comps: ["Icon"] }),
  t("theme-provider", "ThemeProvider", "primitives", U + "tokens/ThemeProvider.tsx", "unverified", "Wraps a subtree in a light or dark theme and exposes useTheme().", `<ThemeProvider defaultTheme="light" persist={false}>…</ThemeProvider>`, { statusNote: "Not classified by the plan or registry." }),

  // ---- generated pages (static output of the proto/ renderer and the Forge landing page)
  ...[
    ["out-tasklist-phone", "Task list, phone", "proto/static/gallery_tasklist_list_view_phone.html", 420, 560, "list_view template for a task-list manifest, rendered for a phone."],
    ["out-habits-watch", "Habits, watch", "proto/static/gallery_habits_glance_view_watch.html", 300, 420, "glance_view template for a habit-tracker manifest, rendered for a watch."],
    ["out-tasklist-tv", "Task list, TV", "proto/static/gallery_tasklist_tv_focus_list_tv.html", 900, 520, "focus_list template for a task-list manifest, rendered for a TV."],
    ["out-projects-tablet", "Projects, tablet", "proto/static/gallery_projects_list_detail_tablet.html", 900, 560, "list_detail template for a project manifest, rendered for a tablet."],
    ["out-projects-dash", "Projects dashboard, desktop", "proto/static/gallery_projects_stat_dashboard_desktop.html", 980, 560, "stat_dashboard template for a project manifest, rendered for a desktop."],
    ["out-tasklist-phone-plain", "Task list, phone (plain)", "proto/static/tasklist_phone.html", 420, 380, "The first, unstyled task-list render for a phone."],
    ["out-tasklist-phone-manual", "Task list, phone (manual)", "proto/static/tasklist_phone_manual.html", 420, 380, "A task-list render written without the model's template selection, as a reference."],
    ["out-habits-watch-plain", "Habits, watch (plain)", "proto/static/habits_watch.html", 300, 300, "The first, unstyled habit-tracker render for a watch."],
    ["out-contacts-desktop-plain", "Contacts, desktop (plain)", "proto/static/contacts_desktop.html", 560, 300, "The first, unstyled contact-list render for a desktop."],
    ["out-contacts-desktop", "Contact detail card, desktop", "proto/static/gallery_contacts_detail_card_desktop.html", 980, 560, "detail_card template for a contact manifest, rendered for a desktop."],
  ].map(([id, name, file, w, h, desc]) =>
    ({ id, name, cat: "output", kind: "iframe", src: "assets/static/" + file.split("/").pop(), source: file, status: "prototype", statusNote: "Output of the workspace's proto/ renderer, which the plan marks Harvest + retire.", desc: desc + " Static preview: an HTML file the Python renderer wrote, shown in a sandboxed frame.", snippet: "# proto/main.py picks a template from a manifest and a device class;\n# proto/renderer.py writes the HTML deterministically.", stage: { w, h }, wide: w > 600, note: "Static preview (a frame of a generated file, not a React component)." })),
  { id: "out-forge", name: "Forge template catalog", cat: "output", kind: "iframe", src: "assets/static/forge-landing.html", source: "index.html", status: "unverified", statusNote: "A single-file landing page the plan marks Harvest + retire. Its template links point to GitHub repositories that were not checked.", desc: "A standalone 'build apps from a prompt' catalog page with search and filter. Static preview: the original file, shown in a sandboxed frame with scripts allowed and links disabled.", snippet: "# Single self-contained index.html at the workspace root: no build step.", stage: { w: 1100, h: 600 }, wide: true, note: "Static preview. Template links and counts are the file's own sample content." },
];

// Card blocks from the registry (types NOT already on the Arco docs page). Examples come from the workspace's own mock data.
export const CARD_TYPES = [
  "activityCards", "activeProjectsCards", "profileSummaryCards", "profileGridCards", "routeCards", "courseCards", "quizScoreCards", "timezoneCards",
  "vpnConnectionCards", "webinarCtaCards", "translationCards", "colorPaletteCards", "deviceCards", "filterSections", "expenseGaugeCards", "meetingCountdownCards",
  "sessionCards", "globalRankingCards", "targetChartCards", "salesOverviewCards", "earningReportsCards", "assetShowcaseCards", "subscribersChartCards", "cardCollection",
  "creatorWidgets", "designCards", "enrollmentChartCards", "expenseCards", "flowReportCards", "glassWidgets", "phoneHomeScreen", "spentThisMonthCards", "statisticsProgressCards", "timeSpentCards",
];

// Blocks the Arco docs page already covers (24); kept here so the build can refuse an overlap.
export const ARCO_TYPES = ["text", "cardGrid", "mediaCards", "listingCards", "insightCards", "newsFeedCards", "statCards", "metricChartCards", "miniStatChartCards", "savedMoneyCards", "fearGreedCards", "weeklyStreakCards", "cryptoMarketCards", "taskChecklistCards", "calendarScheduleCards", "eventCards", "scheduleSlots", "timelineSteps", "selectionTiles", "form", "musicPlayerCards", "videoPlayerCards", "code", "terminal", "batteryStatusCards"];

// ---- app views: every layout the demo's workspace registry builds, rendered with the demo's own state slices ----
const DEMO_FILE = { chat: "chat", messages: "comms", slack: "comms", social: "comms", contacts: "comms", phone: "comms", email: "content", notes: "content", files: "content", calendar: "planner", schedule: "planner", tasks: "planner", notifications: "planner", apps: "platform", settings: "platform", desktop: "platform" };
const WS_DIR = { generated: "design-system" };
export const WORKSPACE_IDS = ["chat", "messages", "slack", "social", "contacts", "notes", "email", "calendar", "schedule", "files", "sheets", "wallet", "bank-crypto", "music", "composer", "generator", "vision", "reader", "maps", "camera", "weather", "calculator", "browser", "phone", "tasks", "notifications", "apps", "bento", "app-port", "extensions", "passport", "settings", "desktop", "server", "orchestrator", "tickets", "transcribe", "life-planning", "psyche", "generated", "wireframe", "nodal", "creative-studio"];
export const wsTile = (id, label, srcFile, compName) => ({
  id: "ws-" + id, name: compName, cat: "apps", kind: "app", wsId: id, source: srcFile, status: "prototype", statusNote: P_APP,
  desc: `The demo's "${label}" workspace: its layout builder plus the demo's own state and sample data. Interactions work inside the tile; the tile never changes workspace.`,
  snippet: `// packages/longformer-demo/src/workspaces/${DEMO_FILE[id] || "showcase"}.tsx builds this view from a view model:\nconst { sidebar, main } = buildWorkspaceLayout({ ...vm, workspaceId: "${id}" }, { includeSidebar: true });`,
  stage: { w: 1000, h: 600 }, wide: true, comps: [compName],
  extraSources: ["packages/longformer-demo/src/workspaces/" + (DEMO_FILE[id] || "showcase") + ".tsx"],
  note: "Sample data from the workspace's mock-data. Name-brand sample text is replaced with neutral placeholders in this page's copy.",
});
export const WS_DIR_MAP = WS_DIR;

export const OVERLAY_TILES = [
  ["ws-generated-ui", "GeneratedUIWorkspace", "apps", "workspaces/generated-ui/GeneratedUIWorkspace.tsx", "A workspace that renders one generated surface schema with the block registry.", `<GeneratedUIWorkspace title="Generated" schema={schema} />`],
  ["hover-nav-rail", "HoverNavRail", "overlays", "shell/HoverNavRail/HoverNavRail.tsx", "Reveals the workspace rail when the pointer rests on the left edge.", `<HoverNavRail enabled expanded={false}>{rail}</HoverNavRail>`],
  ["hover-status-bar", "HoverStatusBar", "overlays", "shell/HoverStatusBar/HoverStatusBar.tsx", "A status bar (wifi, battery, active app) that drops from the top edge on hover.", `<HoverStatusBar enabled shell="macos" status={{ wifi: true, batteryPercent: 84 }} />`],
  ["hover-assistant-bubble", "HoverAssistantBubble", "overlays", "shell/HoverAssistantBubble/HoverAssistantBubble.tsx", "A corner bubble that opens a quick-action menu on hover.", `<HoverAssistantBubble enabled items={menuItems} onOpenAssistant={open} />`],
  ["hover-app-tray", "HoverAppTray", "overlays", "shell/HoverAppTray/HoverAppTray.tsx", "The desktop app tray, revealed from the bottom edge.", `<HoverAppTray enabled shell="macos" apps={apps} windows={windows} onLaunchApp={launch} onFocusWindow={focus} />`],
  ["floating-chat", "FloatingChat", "overlays", "shell/FloatingChat/FloatingChat.tsx", "A launcher that opens a floating conversation panel.", `<FloatingChat open={open} onOpenChange={setOpen} messages={m} composerValue={v} onComposerChange={setV} onSubmit={send} />`],
].map(([id, name, cat, p, desc, snippet]) => ({ id, name, cat, kind: "overlay", source: "packages/longformer-ui/src/components/" + p, status: "prototype", statusNote: P_SHELL, desc, snippet, stage: id === "ws-generated-ui" ? { w: 900, h: 560 } : { w: 760, h: 420 }, wide: true, note: "Contained in a fixed frame. Hover or use the keyboard to reveal it.", comps: [name] }));

export const CHAT_STATE_TILES = [
  ["chat-context-panel", "ChatContextPanel", "workspaces/chat/ChatContextPanel.tsx", "The assistant panel: conversation tabs, messages, composer, and the diff/files tool drawer.", `<ChatContextPanel messages={m} composerValue={v} onComposerChange={setV} onSubmit={send} drawerTab="diffs" diffHunks={hunks} />`, { w: 760, h: 560 }],
  ["conversation-panel", "ConversationPanel", "workspaces/chat/ConversationPanel.tsx", "A full conversation: tab bar, message list, prompt chips and composer.", `<ConversationPanel messages={m} composerValue={v} onComposerChange={setV} onSubmit={send} promptChips={chips} />`, { w: 480, h: 560 }],
  ["chat-sidebar", "ChatSidebar", "workspaces/chat/ChatSidebar.tsx", "Conversation list with recent and grouped views.", `<ChatSidebar conversations={c} activeConversationId={id} onConversationSelect={sel} openConversationIds={open} footerName="Sample User" />`, { w: 300, h: 520 }],
  ["chat-context-drawer", "ChatContextDrawer", "workspaces/chat/ChatContextDrawer.tsx", "The tool drawer with Browser, Diffs and Files tabs (shown on the Diffs tab).", `<ChatContextDrawer activeTab="diffs" onTabChange={setTab} diffHunks={hunks} folders={folders} />`, { w: 460, h: 480 }],
  ["context-diff-pane", "ContextDiffPane", "workspaces/chat/ContextDiffPane.tsx", "A unified diff view with line numbers.", `<ContextDiffPane hunks={hunks} activeHunkId="diff-gateway" />`, { w: 460, h: 420 }],
  ["context-files-pane", "ContextFilesPane", "workspaces/chat/ContextFilesPane.tsx", "A file tree with a resizable tree column.", `<ContextFilesPane folders={folders} rootFolderId="root" />`, { w: 460, h: 420 }],
  ["chat-inline-surface", "ChatInlineSurface", "workspaces/chat/ChatInlineSurface.tsx", "A generated-UI surface rendered inside a chat message.", `<ChatInlineSurface schema={generatedSchema} label="Generated surface" />`, { w: 600, h: 520 }],
].map(([id, name, p, desc, snippet, stage]) => ({ id, name, cat: "chat", kind: "overlay", source: "packages/longformer-ui/src/components/" + p, status: "prototype", statusNote: P_CHAT, desc, snippet, stage, wide: stage.w > 500, note: "Uses the demo's state and sample data; replies use its offline path.", comps: [name] }));
CHAT_STATE_TILES.push({ id: "sidebar-user-footer-menu", name: "SidebarUserFooterMenu", cat: "shell", kind: "overlay", source: C + "shell/NavSidebar/SidebarUserFooterMenu.tsx", status: "prototype", statusNote: P_SHELL, desc: "Footer user row that opens a menu with items and a theme switch.", snippet: `<SidebarUserFooterMenu name="Sample User" meta="Sample plan" items={[{ id: "s", label: "Settings", icon: "settings" }]} />`, stage: { w: 300, h: 360 }, comps: ["SidebarUserFooterMenu"] });

// ---- site sections ----
const WW = "packages/longformer-www/src/components/";
const SITE_NOTE = "Links are disabled in this preview and point nowhere.";
const SITE_STATUS = "From longformer-www, which the plan marks Keep (re-base as a theme override); its parchment palette is intentionally different from the kit. Fonts fall back to system fonts here.";
export const SITE_TILES = [
  ["www-features", "FeatureSection", "FeatureSection.tsx", "Three-up feature cards.", 1400],
  ["www-principles", "PrinciplesSection", "PrinciplesSection.tsx", "Numbered design principles.", 1400],
  ["www-faq", "FAQSection", "FAQSection.tsx", "Accordion of questions and answers.", 1400],
  ["www-architecture", "ArchitectureSection", "ArchitectureSection.tsx", "Layered architecture diagram.", 1400],
  ["www-hero", "HeroSection", "HeroSection.tsx", "Landing hero with headline, actions and a preview card.", 1400],
  ["www-cta", "CTASection", "CTASection.tsx", "Call-to-action card.", 1400],
  ["www-footer", "SiteFooter", "CTASection.tsx", "Site footer.", 1400],
  ["www-header", "SiteHeader", "SiteHeader.tsx", "Site header with a nav pill.", 1400],
  ["www-marquee", "IntegrationsMarquee", "IntegrationsMarquee.tsx", "Scrolling strip of integration names (text only).", 1400],
  ["www-isometric", "IsometricTile", "IsometricTile.tsx", "Isometric cube art in four variants.", 900],
  ["spec-hero", "SpecHero", "spec/SpecHero.tsx", "Hero of the spec page.", 1400],
  ["spec-foundation", "FoundationSection", "spec/FoundationSection.tsx", "Spec: foundation.", 1400],
  ["spec-decisions", "DecisionsSection", "spec/DecisionsSection.tsx", "Spec: decision records.", 1400],
  ["spec-architecture", "SpecArchitectureSection", "spec/SpecArchitectureSection.tsx", "Spec: architecture.", 1400],
  ["spec-roadmap", "RoadmapSection", "spec/RoadmapSection.tsx", "Spec: roadmap.", 1400],
  ["spec-adoption", "AdoptionSection", "spec/AdoptionSection.tsx", "Spec: adoption.", 1400],
  ["spec-product", "ProductSection", "spec/ProductSection.tsx", "Spec: product.", 1400],
  ["spec-appendix", "AppendixSection", "spec/AppendixSection.tsx", "Spec: appendix.", 1400],
].map(([id, name, file, desc, w]) => ({ id, name, cat: "site", kind: "site", source: WW + file, status: "prototype", statusNote: SITE_STATUS, desc, snippet: `<${name} />`, stage: { w }, wide: true, note: SITE_NOTE, comps: [name] }));
SITE_TILES.push({ id: "spec-page", name: "SpecPage", cat: "site", kind: "site", source: "packages/longformer-www/src/SpecPage.tsx", status: "prototype", statusNote: SITE_STATUS, desc: "The whole spec page (header, every spec section, call-to-action), scrollable inside the frame.", snippet: `<SpecPage />`, stage: { w: 1400, h: 800, scroll: true }, wide: true, note: SITE_NOTE, comps: ["SpecPage"] });

// ---- planned: named in the workspace's plan or spec documents, no source found (placeholders, not components) ----
const PL = (id, name, where, desc, status = "planned") => ({ id: "plan-" + id, name, cat: "planned", kind: "planned", source: where, status, statusNote: status === "planned" ? "Named in the workspace's own planning documents; no source file was found for it. This tile is a placeholder, not a component." : "Not named as a plan item; a gap compared with a typical component kit. No source file exists. This tile is a placeholder.", desc, snippet: null });
export const PLANNED_TILES = [
  PL("context-meter", "ContextMeter / token ring", "APP-INDEX-AND-LIBRARY-PLAN.md (section 5, P2)", "A ring showing how much of the model's context is used. The plan cites reference apps only; nothing exists in the kit."),
  PL("action-binder", "ActionBinder and EntityProvider", "DESIGN-SYSTEM-SPEC.md; APP-INDEX-AND-LIBRARY-PLAN.md (section 6)", "Interfaces for binding block actions to entities. Interfaces only in the documents; no code."),
  PL("canonical-layouts", "Canonical layouts", "APP-INDEX-AND-LIBRARY-PLAN.md (sections 4 and 5, P2)", "Named layouts the AI would pick: list-detail, supporting-pane, feed, single-focus. Today they exist ad hoc inside the email, notes and messages views."),
  PL("mobile-shell", "MobileShell", "DESIGN-SYSTEM-SPEC.md", "A shell for phone-size surfaces. No source; mobile surfaces currently live in the desktop workspace."),
  PL("app-surface", "AppSurface", "APP-INDEX-AND-LIBRARY-PLAN.md (section 6)", "The Arco-side surface that would host generated apps. Lives in a different repository."),
  PL("crons-view", "CronsView and CronDetailTray", "Project-planning.md", "Scheduled-job list and detail tray, noted from a reference client. Not in the kit."),
  PL("memory-manager", "MemoryManager, WorkspaceFocusProvider, thin CodeWorkspace", "Project-planning.md", "Planned agent-memory and focus pieces. Not implemented."),
  PL("lf-packages", "@lf/tokens, @lf/primitives, @lf/blocks, @lf/runtime", "APP-INDEX-AND-LIBRARY-PLAN.md (phases 1 and 2)", "The planned package split, an `lf add` CLI, and defineBlock manifests with adaptivity descriptors. The registry and defineBlock exist today, without adaptivity."),
  PL("missing-atoms", "Select, Popover, Toast, Slider, Radio, Spinner, Skeleton, Table, Accordion, Breadcrumb", "packages/longformer-ui/src/components/primitives (absent)", "Common atoms the primitives folder does not contain. The documents do not plan them explicitly.", "unverified"),
];
