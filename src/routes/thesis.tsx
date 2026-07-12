import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/thesis")({
  head: () => ({
    meta: [
      { title: "Thesis — Modern Telepathy" },
      {
        name: "description",
        content:
          "Our thesis on open-source AI — why shared intelligence should stay public, inspectable, and builder-owned.",
      },
      { property: "og:title", content: "Thesis — Modern Telepathy" },
      {
        property: "og:description",
        content:
          "Our thesis on open-source AI — why shared intelligence should stay public, inspectable, and builder-owned.",
      },
    ],
  }),
  component: ThesisPage,
});

const pillars = [
  {
    title: "Open by default",
    body: "Models, weights, evals, and tooling should be releasable—so progress compounds in public instead of locking behind a few labs.",
  },
  {
    title: "Inspectable systems",
    body: "If intelligence is going to mediate how we work and decide, its stack must be auditable: data, training, interfaces, and failure modes.",
  },
  {
    title: "Builder agency",
    body: "The people closest to real problems need the right to fork, fine-tune, and ship. Open-source AI keeps capability in their hands.",
  },
  {
    title: "Shared sense",
    body: "Telepathy was always a metaphor for thought moving between minds. Open AI is how we build that as infrastructure—not as a closed product.",
  },
];

function ThesisPage() {
  return (
    <div className="bg-canvas pt-16 pb-32">
      <div className="max-w-screen-xl mx-auto px-6">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-6">
          Thesis
        </p>
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-none max-w-[18ch] mb-8">
          Intelligence should stay a commons.
        </h1>
        <p className="text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed mb-20">
          Modern Telepathy exists to advance open-source AI—research, models, and systems that
          make intelligence public infrastructure rather than a private utility.
        </p>

        <div className="grid md:grid-cols-2 gap-x-12 gap-y-14 max-w-4xl">
          {pillars.map(({ title, body }) => (
            <div key={title}>
              <h2 className="text-xl font-medium tracking-tight mb-3">{title}</h2>
              <p className="text-zinc-500 text-pretty leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-24 max-w-[56ch]">
          <h2 className="text-2xl font-medium tracking-tight mb-4">What we fund and build</h2>
          <p className="text-zinc-500 text-pretty leading-relaxed mb-4">
            We back and ship work that moves open models from demos to durable systems: training
            infrastructure, evaluation, safety tooling, and products that keep their intelligence
            layer remixable.
          </p>
          <p className="text-zinc-500 text-pretty leading-relaxed">
            Closed stacks can move fast. Open stacks can move forever. Our bet is on the latter—
            and on the builders who make shared intelligence feel like a sense we all get to use.
          </p>
        </div>
      </div>
    </div>
  );
}
