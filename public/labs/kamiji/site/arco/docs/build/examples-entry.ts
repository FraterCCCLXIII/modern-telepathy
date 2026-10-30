// Bundled for node by build.mjs: collects every example block the owner's workspace ships.
import { generatedSchema } from "@demo/generated";
import { cardCollectionExamples } from "@demo/card-collections";
import * as chat from "@demo/chat-ui-surfaces";
import { z } from "zod";
import * as schemas from "@ui/components/workspaces/generated-ui/registry/schemas";
import { CARD_FAMILY_SAMPLES, WIDGET_SAMPLES } from "@ui/components/workspaces/design-system/samples";

const out: { source: string; block: any }[] = [];
const add = (source: string, blocks: any[]) => blocks.forEach((block) => out.push({ source, block }));
add("longformer-demo/src/mock-data/generated.ts", generatedSchema.blocks);
add("longformer-demo/src/mock-data/card-collections.ts", cardCollectionExamples);
for (const v of Object.values(chat)) if (v && typeof v === "object" && Array.isArray((v as any).blocks)) add("longformer-demo/src/mock-data/chat-ui-surfaces.ts", (v as any).blocks);
for (const list of Object.values(CARD_FAMILY_SAMPLES)) add("longformer-ui/.../design-system/samples.ts", list);
add("longformer-ui/.../design-system/samples.ts", WIDGET_SAMPLES);
const STRICT: Record<string, z.ZodType> = {
  text: schemas.textBlockSchema, cardGrid: schemas.cardGridBlockSchema, mediaCards: schemas.mediaCardsBlockSchema,
  listingCards: schemas.listingCardsBlockSchema, statCards: schemas.statCardsBlockSchema,
  selectionTiles: schemas.selectionTilesBlockSchema, timelineSteps: schemas.timelineStepsBlockSchema,
  insightCards: schemas.insightCardsBlockSchema, eventCards: schemas.eventCardsBlockSchema,
  scheduleSlots: schemas.scheduleSlotsBlockSchema, taskChecklistCards: schemas.taskChecklistCardsBlockSchema,
  form: schemas.formBlockSchema, code: schemas.codeBlockSchema, terminal: schemas.terminalBlockSchema,
};
const envelope = z.looseObject({ id: z.string(), type: z.string() });
for (const o of out as any[]) {
  const strict = o.block.type in STRICT;
  const r = (STRICT[o.block.type] ?? envelope).safeParse(o.block);
  o.validation = { strict, ok: r.success, messages: r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
export default out;
