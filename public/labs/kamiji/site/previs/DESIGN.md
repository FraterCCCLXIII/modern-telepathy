# PREVIS: design notes (prototype)

Previs is a story map plus a timeline plus a storyboard plus a script, where every scene is a live 3D window and every scene opens into its own artboard of typed sub-nodes.
It runs as a static page: three.js 0.186.1 from the import map, no build step, no network calls beyond loading the library and the repository's GLBs.

## Users and jobs

| User | Job | What they need first |
|---|---|---|
| Director | Decide the order and the alternates of the story; see the cut play; hand it off | Story map, flow edges, play the cut, import / export nodes |
| Animator | Build a scene: who is in it, which clip, light, camera A to B | Artboard (sub-nodes), viewport with orbit, inspector |
| Storyboard artist | Turn shots into a board with captions and shot types | Strip of frames with real renders, 6-up print |
| Writer | Own every line, by character, in story order | Script drawer, script import, Fountain / Markdown export |

## Zones

1. **Left rail** (collapsible, 56 px icons or 280 px open; pushes the layout at >= 1100 px, overlay drawer below). Sections: Outline, Library, Script, Sources & Exports, Project, Help.
2. **Canvas** (centre). Two levels on one implementation (`graph.js`): the **story map** and the **artboard** of the open scene. Breadcrumb `Story map > Scene name`.
3. **Viewport + inspector** (right). The selected scene at large size with orbit; the inspector edits whatever is selected at either level.
4. **Storyboard strip** (resizable, open by default) and **timeline** (bottom).
5. **Script drawer** (right, resizable, a full sheet below 1100 px). All lines of the project, by character.

The cut is derived, not stored: follow the story map's main path from each start node (scenes and branches only; import and export nodes sit outside the cut).
The top-most outgoing edge is the main path; other targets are alternates. One source of truth means map, strip, timeline and script cannot disagree.

## Data model (version 2)

```
project { v:2, name, fps, markers[], notes[ {frame,len,label,wave?} ], range, loop,
          nodes[], edges[ {from,to,kind: cut|dissolve|branch|import|export} ],
          script { lines[], names{charId:name}, cast[ {id,name,ref} ],
                   voices{charId:{voice,speed,shift}} },
          assets { models[ {id,name,size,rigged,clips} ] } }          // metadata only, GLB bytes stay in the tab

node  = scene   { id, name, x,y, status, notes, shots[], art, props }  // props is DERIVED from art (compile)
      | branch  { id, name, x,y }
      | source  { id, kind, name, x,y, info{file,summary,at} }         // import, output port only
      | sink    { id, kind, name, x,y, opts{format}, last{ok,msg,at} } // export, input port only

shot  { id, label, len, off, type, move, notes, cam{ a{p,t,fov}, b{p,t,fov}, ease } }   // no caption / dialogue: those are lines

art   { nodes[ sub ], edges[ {from,fp,to,tp} ] }
sub   = model {ref} | content {kind: character|prop|shape|accessory|background, ref|acc|color, label}
      | control {kind: clip|expression|mouth|effects|morph, value} | script {char}
      | camera {shot}            // one per shot, kept in sync; owns the A/B keyframes of that shot
      | light {preset} | audio {text,frame,len} | other {kind: note|group|reference, text,w,h,img} | output

line  { id, char: charId|"narrator", kind: dialogue|action|paren, text, node, shot, status: draft|approved|cut, t0?,t1? }
```

Diagram of one scene artboard:

```
 Model --model--> Content(character) --scene--> Scene output ---> story-map card, viewport, thumbnails
 Control(clip) --ctrl--^      ^--attach-- Content(accessory)         ^--cam-- Camera (one per shot, A/B keyframes)
 Script --script--^                                                  ^--light-- Light   ^--audio-- Audio cue
 Content(background) --scene--> Scene output          Note / Group / Reference: free, or --ref--> Content / Output
```

`compile(node)` turns the artboard into `node.props = {cast, bg, light}`, which is all the renderer reads. Nothing else decides what a scene shows.
`syncCameras` keeps exactly one Camera sub-node per shot. Characters are identified project-wide by their model id (for example `mochi/kumo`), so a character's lines follow it across scenes; imported names become `cast:<slug>`.

## Port typing (shape-coded, no hue)

| Type | Shape | Output of | Input of | Limit |
|---|---|---|---|---|
| model | square | Model | Content: model | 1 |
| entity (scene) | circle | Content (not accessory) | Scene output: scene | many |
| ctrl | diamond | Control | Content: control | many |
| text (script) | triangle | Script | Content (character): script | many |
| attach | cross | Content (accessory) | Content (character): attach | many |
| cam | pill | Camera | Scene output: camera | many |
| light | ring | Light | Scene output: light | 1 |
| audio | hexagon | Audio | Scene output: audio | many |
| link (ref) | dot | Note, Reference | Content: refs, Scene output: refs | many |
| flow | circle | story-map node | scenes and branches; sources feed scenes only, sinks accept scenes and branches | |

A refused connection says why ("Camera output does not fit a model input. Cameras feed the Scene output.") in a floating hint while dragging and in the live region. Compatible ports light up while dragging, others dim.
Sub-nodes with no path to the Scene output are drawn dashed ("not in scene").

## Script: one list, four views

`project.script.lines` is the only place words live. The drawer, the Script sub-nodes (lines of one character in one scene), the timeline Dialogue track (dialogue lines on a shot) and the storyboard caption / dialogue fields (first action / dialogue line of that shot) all read and write it.
Story order = cut order of the line's scene, then the shot's position, then list order. Dragging a line adopts the scene and shot of its new neighbour. Per-character markers are a shape plus an initial. Spoken duration is words / 2.7 per second.

## Subtitles (shared module `site/subtitles/`, not edited from Previs)

`subsmod.js` loads the module dynamically; if it fails, Previs keeps working with built-in fallbacks (own SRT parser and writer, no on-screen subtitles).
`subs.js` is the adapter:

- **Lines**: dialogue lines (and the parenthetical that precedes one) of `project.script`, timed from their shot with `fromPrevisScript`. A shot's dialogue lines share its frames in proportion to their words; lines imported with times keep them. Action lines are storyboard captions and are not shown as subtitles. Rebuilt (only when the text, shot spans, fps or names changed) after every script / shot edit, undo, redo, import and migration.
- **Overlay**: a sibling `div` over the viewport canvas (never the WebGL canvas). Shown whenever captions are on (shot camera, free orbit, playing or paused). Paused with nothing spoken at the playhead, it previews the selected shot's own line; playing and scrubbing follow the playhead exactly.
- **Clock**: Previs' transport. Every playhead change calls `subs.tick(ms, {seeking})` (`seeking` is true unless playing). The module's own `play()` is never used.
- **UI**: the Viewport header shows an explicit "Captions on / off" button (pressed = on; also `T`); the default is on, in the bubble style at size 1.3, a style menu (classic, boxed, karaoke, bubble, cinematic, typewriter), size, background opacity, speaker labels, a title-safe guide and "Auto-extend short lines". Style and safe area are remembered in `kamiji.previs.subs`; size, opacity, on/off and labels are also kept by the module. Reduced motion is handled by the module (no fades, typing or bounce).
- **Bubble**: the tail anchors to the speaker's head projected through the active viewport camera (`stage.headScreen`); it is re-laid-out about every 300 ms while playing so it follows camera moves.
- **Thumbnails**: the storyboard / timeline / print thumbnails paint the shot's first dialogue line with `drawSubtitleToCanvas`; the thumbnail cache key includes the line text, speaker, style, size, opacity and labels, so editing any of them re-renders only what changed.
- **Reading speed**: the Dialogue track marks a shot `!` (dashed outline, title and screen-reader text) when `checkLine` finds a line faster than the limit, too short or too long. "Auto-extend short lines" lengthens the shot so that each line reaches the module's comfortable duration (one undo step).
- **Export**: the Subtitles sink writes SRT / WebVTT with the module's `toSRT` / `toVTT` (speaker names, italics, paragraph splitting); the Subtitles import reads SRT / WebVTT / the module's JSON with `parseAuto` (speakers, parentheticals). Image sequence and Animatic video have an "Include subtitles" option (default on) that burns the active line into every frame with `drawSubtitleToCanvas`. The print board shows the subtitles in the thumbnails plus the dialogue as text.
- **Mouth**: the module's `talking` event drives the avatar. Only a rig with a mouth hook takes part: the Kamiji hand (`FaceMesh` morph targets `mouthOpen`, `mouthO`; the viseme O/U uses `mouthO`). Kamikin (no morph targets) and Rubbernose (hand-pose morphs only) have no mouth, so nothing is done for them.
- **Accessibility**: the visible captions are `aria-hidden`; the module's hidden live region is the only place the line text is announced. Previs announces shot changes, not subtitle text.

## Audio and voices (`speech.js`, `voiceui.js`, `../voice.js`)

- **Audio on / off**: a speaker button in the Viewport header and in the transport (also `A`). Off by default and remembered (`kamiji.previs.audio`). Turning it on is the user gesture browsers require; a visible notice under the viewport says whether the local voice server (127.0.0.1:4650, Qwen / Kokoro) answered or the system voice is used (dashed outline = warning with the start command).
- **Sync**: while playing, the dialogue line under the playhead is spoken once, in its character's voice, if the playhead is in the first 60% of its window. Pause, stop, a seek (jump over half a second) and a loop wrap cancel speech (server fetch aborted, `speechSynthesis.cancel`). A line that starts while another is still speaking interrupts it. The bubble and the speech read the same timeline, so they start together; bubbles do not follow measured TTS word timing yet.
- **Voice per character**: `script.voices[charId] = { voice: "" (auto) | "qwen:..." | "kokoro:..." | "system:Name", speed 0.6..1.5, shift -6..8 semitones }`. Saved with the project, undoable, exported, merged on "Previous project" import. Chips sit on Model (rigged), Content (character) and Script sub-nodes and, as "N voices", on story-map scene cards; they open one shared picker with a voice list (server voices from `/v1/voices`, else system voices), Preview, speed and pitch.
- **Thumbnails**: story-map cards show a small caption chip (the line being spoken while the cut plays through the scene, otherwise the scene's first line); storyboard and timeline thumbnails already paint the bubble.

## Import and export nodes

Honest status on every node: **Works** (does it in the browser), **File download**, **Stub**, **Planned**. Everything runs locally; the UI says so. Limit 25 MB per file.

| Import | Status | Does |
|---|---|---|
| Script | works | .txt / Markdown / Fountain to lines by character and action |
| Subtitles | works | SRT / WebVTT to timed dialogue lines placed on the shot at that time (own tiny parser; `site/subtitles/` was not available) |
| Storyboard images | works | PNG / JPEG to reference sub-nodes (scaled to 640 px) |
| Audio | works | WebAudio decode; waveform and duration become an audio note; never played |
| 3D model | works | GLB to a Model sub-node; the file lives in this tab only (re-import after reload) |
| Previous project | works | merges scenes and script of a Previs JSON |
| Cast list | works | CSV / JSON of names |
| Shot list | works | CSV rows become shots in the connected scene |
| Link | stub | disabled placeholder, nothing fetched |

| Export | Status | Does |
|---|---|---|
| Project JSON, Shot list CSV, EDL (CMX3600), Subtitles SRT / WebVTT, Script (Fountain / Markdown / text), Kosmos scene JSON (Previs' own format, not validated against the engine), Blender (Python, untested in Blender) | file | download |
| Storyboard PDF | works | opens the 6-up print view |
| Image sequence | file | PNG frames in a client-side zip (at most 240 frames) |
| Animatic video | file | MediaRecorder to .webm in real time, no sound |
| glTF / GLB | file | scenes side by side, first-frame pose, one camera per shot, no animation |
| Godot, Unreal, Yakopop, Castbook, Longformer, Share link | planned | disabled, explain themselves |

A sink fed by the last scene exports the whole cut; fed by another scene it exports that scene alone.

## Pipeline mockup (prompt chat, generation provider, review, publish presets)

A clearly labelled MOCKUP in `pipeline.js`. It makes no network call, takes no key and uploads nothing. Everything below is saved in the project JSON (undo, export, import all work).

```
Prompt chat --prompt--> Provider <--gen-- Scene(s)         Provider --result--> Scene (version badge on its shots)
                         |  take (v1, v2, ...)              Provider --export--> YouTube / Shorts / TikTok-style / Reels-style / X / Vimeo-style / Podcast / Download
```

- **Nodes**: `chat` {msgs[], agent}, `provider` {kind: seedance|veo|runway|kling|local, opts{res,dur,aspect,seed,style,outcome}, run{state}, takes[], view, cmp} and social `sink` kinds with `social {title,desc,tags,privacy,thumb,captions}`. New edge kinds: `prompt` (chat to provider), `gen` (scene to provider), `result` (provider to scene). They sit outside the cut; the cut is still derived only from scenes and branches.
- **Provider**: names are plain text. Badges: Mockup, Not connected, Needs your own key (a disabled field; no value is ever accepted or stored), API details unverified (Local stand-in needs no key). Inputs read from the linked scenes (shots, script lines, cameras, characters, reference images, prompt chats). Settings: resolution, duration, aspect, seed, style (faithful, repaint, reprocess, stylise). Resolutions, durations and aspects are ASSUMED, not taken from any provider's documentation.
- **Run simulation**: queued (0.8 s), rendering (progress, about 2.4 s), then done or failed ("Simulate a failure on the next run"). Timers live in the tab; a render in flight at reload goes back to idle. Each run adds a take (v1, v2, ...) with its prompt, prompt history, seed and settings.
- **Output card**: before / after compare with a vertical grip (pointer drag or arrow keys): left is the previs frame, right is the same frame with a local CSS filter, labelled SIMULATED. Thumbnail strip, version buttons, duration and cost shown as an estimate placeholder (no price list exists). Accept / Reject / Regenerate only change local state; Accept also sets the badge on the linked shots and feeds the export nodes.
- **Prompt chat**: a scripted agent (not a model). A prompt such as "make scene 3 moodier, slow push-in" gets a plan reply, pulses the `prompt` and `gen` edges, runs the provider and, on completion, writes back through the `result` edge: the camera move label (the normal `applyMove`), a mood note on the first shot, optionally an inserted shot ("add a new shot"), and `shot.gen {v, prompt, by, take, accepted}`. The storyboard frame and the story-map scene card show "gen vN" with the prompt as its tooltip; the take keeps the chat history that led to it. One undo step reverts the whole result. The artboard has a "Prompt chat (mockup)" dock bound to the open scene (it can create a chat + Seedance pair for that scene).
- **Publish presets** (`SOCIAL` in `nodekinds.js`): each card shows aspect, max duration, resolution, title / description / tags, privacy, thumbnail pick, caption track (SRT or WebVTT, a real download from the Subtitles layer), a pass / warn checklist computed from the source (accepted take if the node hangs off a provider, else the cut), and a disabled "Connect account" labelled "Not connected (mockup)". The Podcast / RSS preset can only warn (Previs renders no audio). Download writes a real PNG poster of the accepted take, burned with "SIMULATED".
- **Pipeline view**: a toolbar toggle that lays the same nodes out as lanes Cut, Provider, Review, Export (read only; chips select the node).

Platform limits are NOT verified. They were written from memory and no source was checked: YouTube 16:9, 900 s, 1920x1080; Shorts 9:16, 60 s; TikTok-style 9:16, 180 s; Reels-style 9:16, 90 s; X 16:9, 140 s; Vimeo-style 16:9, no limit modelled. Every card and checklist row says "unverified". Check each platform's current upload specification before trusting any number, and cite it here when that is done.

## Migration (v1 to v2)

Old projects (no `v`, or `v:1`) are upgraded when read from a file, from `localStorage` (the v1 key is read once and saved under the v2 key) or by Import:
flat `props` (cast, clip, accessory, background, light) become an artboard (Model + Content + Control + Accessory + Background + Light + Output, one Camera per shot, laid out in six columns);
`shot.caption` becomes a narrator action line and `shot.dialogue` a dialogue line (an `NAME:` prefix that matches a cast member picks the character); Script sub-nodes are created for every character with lines.
Imported art is sanitised (unknown types, dangling edges and bad references are dropped). Export is always v2.

## Interaction model

- Both canvases: drag background = pan (or Space+drag), wheel zooms at the cursor, Shift+wheel pans, drag a card to move, drag from a port to connect, Shift+drag = marquee, minimap, Fit. LOD: below 40% zoom cards become titled thumbnails.
- Story map: double-click or Enter on a selected scene opens its artboard; Escape (nothing selected) or the breadcrumb goes back.
- Rail Outline is an ARIA tree: arrows, Right/Left expand and collapse, Enter selects and frames, Enter again opens a scene, F2 renames, drag scenes to reorder the cut (straight chains), drag a sub-node onto another to reconnect where the typing rules allow.
- Rail Library: drag a tile (or press Enter) to add a scene, a one-actor scene, an artboard Content node, a light or an accessory. Thumbnails are cached renders, not live.

## Keyboard map

Global (when focus is not in a text field): `?` help, `Space` play/pause, `K` pause, `J` / `L` +-1 s, `,` `.` one frame, `Home` `End`, `I` `O` in/out, `M` marker, `\` loop, `F` fit, `N` add menu, `D` duplicate, `C` connect, `E` cycle edge kind, `S` Script drawer, `A` audio on / off, `T` captions, `Shift+S` add a shot, `B` rail, `F2` rename, `Delete`, `P` print board, `G` performance overlay (never remembered), `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` undo and redo (both levels, one history).
Canvas card focus: arrows move to the nearest card, `Enter` select (and open a scene), `Space` select, `Alt+arrows` nudge, `Ctrl+arrows` pan, `+ - 0` zoom. Timeline clip: `Left/Right`, `Alt+Left/Right` reorder, `Shift+Left/Right` trim. Viewport: arrows orbit. Script line grip and storyboard grip: `Alt+Up/Down` or `Alt+Left/Right`.

## States

- **Empty**: new project, empty outline, call to action on the map, script drawer says what to do.
- **Loading / error**: card "Loading model" / "3D unavailable"; a GLB from an earlier session says "re-import". Corrupt JSON or a file over 25 MB: message, project untouched.
- **Playing**: aria-live announces shots; the active scene is highlighted; reduced motion = posters only, nothing auto-plays.
- **Running an export**: progress bar on the sink card, result or error in `role=status`, last result saved on the node.

## Performance rules

One shared WebGL renderer draws every view into 2D canvases. At most `MAX_LIVE` (6) cards render live across the story map and the open artboard together; the selected card at the 30 fps cap, others round-robin at most 10 fps each inside a 12 ms budget with a starvation guard; everything else is a cached poster. IntersectionObserver gates off-screen cards; bubble LOD and reduced motion turn live rendering off. Library and avatar thumbnails are one-off cached snapshots queued one at a time.

## Intentionally out of scope

Audio mixing (only dialogue is spoken; audio cues and imported audio are never played), real dissolve blending (plays as a cut), multi-user editing, character animation retargeting, rendering of Expression / Mouth / Effects / Morph controls (stored only), accessories that follow every rig (placed on a head estimate), persistent storage of imported GLBs, any network export or share link, any real provider call, key, account connection or upload (the pipeline mockup above only simulates them).
