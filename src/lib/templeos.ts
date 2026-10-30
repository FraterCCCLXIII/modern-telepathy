/** Content for the /templeos showcase. Screenshots are real captures in public/templeos/img (webp). */
export const IMG = "/templeos/img";

export type Profile = { id: string; name: string; mood: string };
export const profiles: Profile[] = [
  { id: "raster", name: "Raster", mood: "Swiss grid, red on paper" },
  { id: "folio", name: "Folio", mood: "Editorial serif, oxblood on cream" },
  { id: "slab", name: "Slab", mood: "Brutalist mono, hazard orange" },
  { id: "blocks", name: "Blocks", mood: "Bauhaus primaries" },
  { id: "whisper", name: "Whisper", mood: "Minimal, with the time in words" },
  { id: "tategaki", name: "Tategaki", mood: "Japanese vertical, hanko red" },
  { id: "phosphor", name: "Phosphor", mood: "Retro terminal, scanlines" },
  { id: "pebble", name: "Pebble", mood: "Soft rounded pastel cards" },
  { id: "gazette", name: "Gazette", mood: "Newspaper masthead" },
  { id: "gilded", name: "Gilded", mood: "Art deco, gold on black" },
];

export const styles = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "glass", name: "Glass" },
  { id: "macos", name: "Mac" },
  { id: "windows", name: "Windows" },
];

export type AppState = "Built" | "Prototype" | "Planned";
export const apps: { name: string; note: string; state: AppState }[] = [
  { name: "Files", note: "Browse the file system and open anything in Notes.", state: "Built" },
  { name: "Notes", note: "A plain text editor that saves to disk.", state: "Built" },
  { name: "Calculator", note: "Keyboard-first, with a basic and a scientific layout planned.", state: "Built" },
  { name: "Clock", note: "World clock, timer, stopwatch and alarms.", state: "Built" },
  { name: "Launchpad", note: "A full-screen grid of apps with search and arrow-key navigation.", state: "Built" },
  { name: "Browser", note: "Real pages, painted by the desktop's own renderer.", state: "Built" },
  { name: "Monitor", note: "Frame-time graph and a built-in benchmark suite.", state: "Built" },
  { name: "Settings", note: "Themes, accent, wallpaper, display, dock and about.", state: "Built" },
  { name: "Icons and Windows", note: "Live editors for every icon and window style.", state: "Built" },
  { name: "Projects, Viewport, Scene, Palette", note: "A 3D viewport and tools for the Kosmos engine.", state: "Built" },
  { name: "Weather", note: "Live forecasts for twelve cities, in C or F.", state: "Prototype" },
  { name: "Music", note: "Play a folder: pause, seek, volume, spectrum.", state: "Prototype" },
  { name: "Kamiji Studio", note: "The character creator, opened inside the desktop.", state: "Prototype" },
  { name: "Maps", note: "Tiles and search through the host.", state: "Planned" },
  { name: "Mail and Contacts", note: "Read and write, with a prompt before anything is sent.", state: "Planned" },
  { name: "Slides and Spreadsheets", note: "Documents you can open and edit.", state: "Planned" },
  { name: "Podcasts", note: "Subscribe and play.", state: "Planned" },
  { name: "AI IDE and Dev Box", note: "Code, containers and language servers behind the host.", state: "Planned" },
];

export const perf = [
  { n: "3.6 s", l: "From launching QEMU to a ready desktop, from a saved image on Apple Silicon" },
  { n: "1.3 ms", l: "Frame time dragging a large window at 1440 × 900" },
  { n: "5 ms", l: "Frame time dragging that window at 2880 × 1800, the 2x retina size" },
  { n: "3.4 ms", l: "A full redraw at 1440 × 900, down from 19.8 ms" },
];

export const hubServices = ["Files", "Git", "Weather", "Music", "Wallpapers", "Kamiji", "Podcasts", "Sheets"];
