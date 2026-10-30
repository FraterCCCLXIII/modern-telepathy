// Bundle "apps": the owner's workspace views and shell overlays, wired the way longformer-demo wires them
// (its own state slices and workspace registry), inside a contained stage. Network calls are stubbed out in the build.
import { useMemo, useCallback, useState, type ReactNode } from "react";
import "@ui/tokens/theme.css";
import "./uix-light.css";
import {
  AppShell, NavRail, NavRailBrandMark, SidebarUserFooterMenu, ChatContextPanel, DesktopWorkspace, HoverAppTray,
  HoverAssistantBubble, HoverNavRail, HoverStatusBar, FloatingChat, ConversationPanel, ChatInlineSurface, ChatSidebar,
  ContextDiffPane, ContextFilesPane, ThemeProvider, GeneratedUIWorkspace, ChatContextDrawer, formFactorToAppPortViewport, type SurfaceWindow, type ChatContextDrawerTab,
} from "@ui/index";
import { primaryUser } from "@dsrc/demo-personas";
import { demoDiffHunks } from "@demo/context-drawer";
import { desktopIcons } from "@demo/desktop";
import { generatedSchema } from "@demo/generated";
import { WORKSPACES } from "@dsrc/workspace-config";
import { buildWorkspaceLayout, buildWorkspaceWindowContent } from "@dsrc/workspaces/registry";
import {
  allWidgetTiles, staticWorkspaceData, useAssistantState, useChatState, useCommsState, useDesktopState, useEmailState,
  useFilesState, useModelSelection, useNotesState, usePlannerState, useProductivityState,
} from "@dsrc/state";
import { mountInto, noop } from "./common";

const CANVAS: React.CSSProperties = { ["--lf-surface-canvas" as any]: "#f4f4f6", background: "var(--lf-surface-canvas)", width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0, position: "relative", overflow: "hidden" };

/** All demo state slices composed into the same view model App.tsx builds (no router). */
function useDemoHost(workspaceId: string) {
  const chat = useChatState();
  const assistant = useAssistantState();
  const comms = useCommsState();
  const email = useEmailState();
  const notes = useNotesState();
  const planner = usePlannerState();
  const files = useFilesState();
  const productivity = useProductivityState();
  const modelSelection = useModelSelection();
  const desktop = useDemoDesktop(workspaceId);
  const vmBase = useMemo(() => ({
    setWorkspaceId: noop, ...chat, ...comms, ...email, ...notes, ...planner, ...files, ...productivity, ...modelSelection, ...staticWorkspaceData,
    appsSubpage: desktop.appsSubpage, setAppsSubpage: desktop.setAppsSubpage, marketplaceCategory: desktop.marketplaceCategory,
    setMarketplaceCategory: desktop.setMarketplaceCategory, installedApps: desktop.installedApps, marketplaceApps: desktop.marketplaceApps,
    appSearch: desktop.appSearch, setAppSearch: desktop.setAppSearch,
    runningAppIds: new Set(desktop.surface.windows.filter((w: any) => w.state !== "minimized").map((w: any) => w.appId)),
    handleTrayLaunchApp: desktop.handleTrayLaunchApp, handleInstallApp: desktop.handleInstallApp,
    desktopWallpaperUrl: desktop.desktopWallpaperUrl, setDesktopWallpaperUrl: desktop.setDesktopWallpaperUrl,
  }) as any, [chat, comms, email, notes, planner, files, productivity, modelSelection, desktop.appsSubpage, desktop.marketplaceCategory, desktop.installedApps, desktop.marketplaceApps, desktop.appSearch, desktop.surface.windows, desktop.desktopWallpaperUrl]);
  return { chat, assistant, files, modelSelection, desktop, vmBase };
}
function useDemoDesktop(workspaceId: string) {
  return useDesktopState({ workspaceId: workspaceId as any, setWorkspaceId: noop as any });
}

function WorkspaceTile({ id }: { id: string }) {
  const h = useDemoHost(id);
  const { desktop, vmBase } = h;
  const renderDesktopWindowContent = useCallback((w: SurfaceWindow) => buildWorkspaceWindowContent(w.appId, vmBase, formFactorToAppPortViewport(desktop.surface.formFactor, w.layer)), [vmBase, desktop.surface.formFactor]);
  const renderDesktopWorkspace = () => (
    <DesktopWorkspace shell={desktop.surface.shell} onShellChange={desktop.surface.setShell} formFactor={desktop.surface.formFactor}
      onFormFactorChange={desktop.surface.setFormFactor} policy={desktop.surface.policy} apps={desktop.allDesktopApps} desktopIcons={desktopIcons}
      surfaceWindows={desktop.surface.renderableWindows} windows={desktop.surface.legacyWindows} activeWindowId={desktop.surface.activeWindowId}
      status={{ wifi: true, bluetooth: true, batteryPercent: 84 }} onLaunchApp={desktop.handleLaunchDesktopApp} onSelectDesktopIcon={desktop.handleSelectDesktopIcon}
      onFocusWindow={desktop.surface.focus} onCloseWindow={desktop.handleCloseDesktopWindow} onMinimizeWindow={desktop.handleMinimizeDesktopWindow}
      onMaximizeWindow={desktop.surface.maximize} onMoveWindow={desktop.surface.moveWindow} onResizeWindow={desktop.surface.resizeWindow}
      onPopPhoneStack={desktop.surface.pop} onMinimizeAll={desktop.handleMinimizeAllPhoneWindows} onNextGlance={desktop.surface.nextGlance} onPrevGlance={desktop.surface.prevGlance}
      widgetTiles={allWidgetTiles} onCreateApp={noop} trayApps={desktop.trayPinnedApps} trayOverflowApps={desktop.trayOverflowApps}
      renderWindowContent={renderDesktopWindowContent} fullscreen={false} onFullscreenChange={noop} wallpaperUrl={desktop.desktopWallpaperUrl} />
  );
  const { sidebar, main } = buildWorkspaceLayout({ ...vmBase, workspaceId: id as any, renderDesktopWorkspace } as any, { includeSidebar: true });
  const a = h.assistant;
  const isChat = id === "chat";
  const [tab, setTab] = useState<ChatContextDrawerTab>("diffs");
  return (
    <div className="ux-cv" style={CANVAS}>
      <AppShell sidebar={sidebar} main={main}
        contextPanel={isChat ? (
          <ChatContextPanel showConversation={false} drawerOpen drawerTab={tab} onDrawerTabChange={setTab} messages={[]} composerValue="" onComposerChange={noop} onSubmit={noop}
            diffHunks={demoDiffHunks} activeDiffId="diff-gateway" folders={h.files.folders} rootFolderId="root" />
        ) : undefined}
        defaultContextPanelWidth={360} />
    </div>
  );
}

// ---- overlays and chat parts that need demo state ----
function OverlayStage({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="ux-cv" style={CANVAS}>
      <div style={{ padding: 20, color: "var(--lf-text-secondary)", fontSize: 14 }}>{hint}</div>
      <div aria-hidden="true" style={{ padding: "0 20px", display: "grid", gap: 10 }}>{[70, 90, 55, 80, 40].map((w, i) => <div key={i} style={{ height: 14, width: w + "%", borderRadius: 7, background: "var(--lf-surface-3)" }} />)}</div>
      {children}
    </div>
  );
}
function OverlayTile({ kind }: { kind: string }) {
  const h = useDemoHost("chat");
  const { desktop, assistant: a, chat, modelSelection: m } = h;
  const [open, setOpen] = useState(kind === "floating-chat");
  const rail = <NavRail items={desktop.railWorkspaces} activeId="chat" onSelect={noop} brand={<NavRailBrandMark />} />;
  if (kind === "hover-nav-rail") return <OverlayStage hint="Move the pointer to the left edge to reveal the rail."><HoverNavRail enabled>{rail}</HoverNavRail></OverlayStage>;
  if (kind === "hover-status-bar") return <OverlayStage hint="Move the pointer to the top edge to reveal the status bar."><HoverStatusBar enabled shell={desktop.surface.shell} status={{ wifi: true, bluetooth: true, batteryPercent: 84, activeAppLabel: "Notes" }} /></OverlayStage>;
  if (kind === "hover-assistant-bubble") return <OverlayStage hint="Hover the bubble in the corner to see quick actions."><HoverAssistantBubble enabled items={a.assistantMenuItems} onOpenAssistant={noop} /></OverlayStage>;
  if (kind === "hover-app-tray") return <OverlayStage hint="Move the pointer to the bottom edge to raise the app tray."><HoverAppTray enabled shell={desktop.surface.shell} formFactor={desktop.surface.formFactor} apps={desktop.trayPinnedApps} overflowApps={desktop.trayOverflowApps} windows={desktop.surface.legacyWindows} activeWindowId={desktop.surface.activeWindowId} onLaunchApp={noop} onFocusWindow={noop} /></OverlayStage>;
  if (kind === "floating-chat") return <OverlayStage hint="The launcher opens a floating conversation panel. Replies use the demo's offline path."><FloatingChat open={open} onOpenChange={setOpen} messages={a.assistantMessages} composerValue={a.assistantComposerValue} onComposerChange={a.setAssistantComposerValue} onSubmit={a.handleAssistantSubmit} promptChips={a.assistantPromptChips} onPromptChipSelect={a.handleAssistantPromptChip} model={m.model} modelOptions={m.modelMenuItems} onNewConversation={a.handleAssistantNewTab} /></OverlayStage>;
  if (kind === "chat-context-panel") return (
    <div className="ux-cv" style={CANVAS}><ChatContextPanel showConversation tabs={a.assistantTabs} activeTabId={a.activeAssistantTabId} onTabChange={a.setActiveAssistantTabId} onTabClose={a.handleAssistantTabClose} projectLabel="Sample project" navItems={a.assistantNavItems} activeNavId={a.assistantNavId} onNavChange={a.setAssistantNavId} messages={a.assistantMessages} composerValue={a.assistantComposerValue} onComposerChange={a.setAssistantComposerValue} onSubmit={a.handleAssistantSubmit} promptChips={a.assistantPromptChips} onPromptChipSelect={a.handleAssistantPromptChip} model={m.model} modelOptions={m.modelMenuItems} drawerOpen drawerTab="diffs" onDrawerTabChange={noop} diffHunks={demoDiffHunks} activeDiffId="diff-gateway" folders={h.files.folders} rootFolderId="root" typeaheadItems={chat.composerTypeaheadItems} /></div>
  );
  if (kind === "conversation-panel") return (
    <div className="ux-cv" style={CANVAS}><ConversationPanel title="Assistant" tabs={a.assistantTabs} activeTabId={a.activeAssistantTabId} onTabChange={a.setActiveAssistantTabId} messages={a.assistantMessages} composerValue={a.assistantComposerValue} onComposerChange={a.setAssistantComposerValue} onSubmit={a.handleAssistantSubmit} promptChips={a.assistantPromptChips} onPromptChipSelect={a.handleAssistantPromptChip} model={m.model} modelOptions={m.modelMenuItems} onNewConversation={a.handleAssistantNewTab} /></div>
  );
  if (kind === "chat-sidebar") return (
    <div className="ux-cv" style={{ ...CANVAS, maxWidth: 300 }}><ChatSidebar conversations={chat.chatConversations} activeConversationId={chat.activeChatTabId} onConversationSelect={chat.setActiveChatTabId} openConversationIds={chat.chatTabs.map((t: any) => t.id)} onNewChat={noop} footerName={primaryUser.name} footerMeta="Sample plan" /></div>
  );
  if (kind === "chat-context-drawer") return <div className="ux-cv" style={CANVAS}><ChatContextDrawer activeTab="diffs" onTabChange={noop} diffHunks={demoDiffHunks} activeDiffId="diff-gateway" folders={h.files.folders} rootFolderId="root" /></div>;
  if (kind === "context-diff-pane") return <div className="ux-cv" style={CANVAS}><ContextDiffPane hunks={demoDiffHunks} activeHunkId="diff-gateway" /></div>;
  if (kind === "context-files-pane") return <div className="ux-cv" style={CANVAS}><ContextFilesPane folders={h.files.folders} rootFolderId="root" /></div>;
  if (kind === "chat-inline-surface") return <div className="ux-cv" style={{ ...CANVAS, padding: 16 }}><ChatInlineSurface schema={generatedSchema as any} label="Generated surface" /></div>;
  if (kind === "ws-generated-ui") return <div className="ux-cv" style={CANVAS}><GeneratedUIWorkspace title="Generated" schema={generatedSchema as any} /></div>;
  if (kind === "sidebar-user-footer-menu") return <div className="ux-cv" style={{ ...CANVAS, maxWidth: 260, justifyContent: "flex-end" }}><SidebarUserFooterMenu name="Sample User" meta="Sample plan" items={[{ id: "s", label: "Settings", icon: "settings" }, { id: "p", label: "Profile", icon: "contact" }, { id: "l", label: "Log out", icon: "external-link", danger: true, separatorAbove: true }]} /></div>;
  throw new Error("unknown overlay " + kind);
}

export function renderApp(el: Element, id: string, kind: string) {
  mountInto(el, <ThemeProvider defaultTheme="light" persist={false} className="ux-fill">{kind === "overlay" ? <OverlayTile kind={id} /> : <WorkspaceTile id={id} />}</ThemeProvider>);
}
export const workspaceIds = WORKSPACES.map((w: any) => w.id);

export { unmountTile } from "./common";
