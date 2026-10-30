// Bundled for node by build.mjs: collects every example block the owner's workspace ships (same sources the Arco docs use).
import { generatedSchema } from "@demo/generated";
import { cardCollectionExamples } from "@demo/card-collections";
import * as chat from "@demo/chat-ui-surfaces";
import { CARD_FAMILY_SAMPLES, WIDGET_SAMPLES } from "@ui/components/workspaces/design-system/samples";

const out: { source: string; block: any }[] = [];
const add = (source: string, blocks: any[]) => blocks.forEach((block) => out.push({ source, block }));
add("packages/longformer-demo/src/mock-data/generated.ts", generatedSchema.blocks);
add("packages/longformer-demo/src/mock-data/card-collections.ts", cardCollectionExamples);
for (const v of Object.values(chat)) if (v && typeof v === "object" && Array.isArray((v as any).blocks)) add("packages/longformer-demo/src/mock-data/chat-ui-surfaces.ts", (v as any).blocks);
for (const list of Object.values(CARD_FAMILY_SAMPLES)) add("packages/longformer-ui/src/components/workspaces/design-system/samples.ts", list as any[]);
add("packages/longformer-ui/src/components/workspaces/design-system/samples.ts", WIDGET_SAMPLES as any[]);
export default out;
