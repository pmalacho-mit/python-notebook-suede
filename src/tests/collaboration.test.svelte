<script lang="ts" module>
  import { Sweater } from "../../sweater-vest-suede";
  import { Notebook } from "../../release";
  import {
    frames,
    identities,
    joined,
    newRoom,
    until,
    write,
  } from "./support";

  type Link = Awaited<ReturnType<typeof joined>>;

  class Pocket {
    peers = $state<Notebook.Model[]>([]);

    private links: Link[] = [];

    /** Two collaborators in a room of their own, one of whom seeds it. */
    async open(sources: string[]) {
      const room = newRoom();
      this.links = [await joined(room), await joined(room)];
      this.peers = this.links.map(({ shared }) => Notebook.Model.shared(shared));
      write(this.peers[0], sources);
      await until("the second peer to receive the notebook", () =>
        this.peers[1].cells.length === sources.length,
      );
      return this.peers;
    }

    close() {
      this.links.forEach(({ disconnect }) => disconnect());
    }
  }

  const panes = (within: HTMLElement) => [
    ...within.querySelectorAll<HTMLElement>('[data-testid="peer"]'),
  ];

  const agreed = (pocket: Pocket, count: number) =>
    until(`both peers to hold ${count} cells`, () =>
      pocket.peers.every((peer) => peer.cells.length === count),
    );
</script>

<Sweater config category="Collaboration" orientation="vertical" mode="serial" />

<Sweater
  lazy
  name="a cell added by one collaborator appears for the other"
  body={async (harness) => {
    const pocket = harness.set(new Pocket());
    harness.onAbort(() => pocket.close());

    const [first, second] = await pocket.open(["x = 1"]);
    await until("both peers to render", () => panes(harness.container).length === 2);

    first.add("code", 1).write("y = 2");
    await agreed(pocket, 2);

    harness.expect(second.cells.map((cell) => cell.source)).toEqual(["x = 1", "y = 2"]);
    await until("the second peer to show both cells", () =>
      frames(panes(harness.container)[1]).length === 2,
    );

    harness.capture("png");
    pocket.close();
  }}
>
  {#snippet vest(pocket: Pocket)}
    <div class="peers">
      {#each pocket.peers as peer (peer.path)}
        <div class="peer" data-testid="peer">
          <Notebook.Component notebook={peer} />
        </div>
      {/each}
    </div>
  {/snippet}
</Sweater>

<Sweater
  lazy
  name="cells added by both collaborators at once are all kept, in one order"
  body={async (harness) => {
    const pocket = harness.set(new Pocket());
    harness.onAbort(() => pocket.close());

    const [first, second] = await pocket.open(["shared = True"]);

    // Neither has heard from the other when it acts: this is the merge.
    first.add("code").write("from_first = 1");
    second.add("code").write("from_second = 2");

    await agreed(pocket, 3);

    const sources = first.cells.map((cell) => cell.source);
    harness.expect(sources).toContain("from_first = 1");
    harness.expect(sources).toContain("from_second = 2");
    harness.expect(second.cells.map((cell) => cell.source)).toEqual(sources);
    harness.expect(identities(panes(harness.container)[0])).toEqual(
      identities(panes(harness.container)[1]),
    );

    harness.note(`Converged order: ${sources.join(" | ")}`);
    harness.capture("png");
    pocket.close();
  }}
>
  {#snippet vest(pocket: Pocket)}
    <div class="peers">
      {#each pocket.peers as peer (peer.path)}
        <div class="peer" data-testid="peer">
          <Notebook.Component notebook={peer} />
        </div>
      {/each}
    </div>
  {/snippet}
</Sweater>

<Sweater
  lazy
  name="edits made to the same cell at once are merged rather than overwritten"
  body={async (harness) => {
    const pocket = harness.set(new Pocket());
    harness.onAbort(() => pocket.close());

    const [first, second] = await pocket.open(["value = "]);
    await until("both peers to render", () => panes(harness.container).length === 2);

    const ours = first.cells[0].store.sourceSync;
    const theirs = second.cells[0].store.sourceSync;
    harness.expect(ours).toBeDefined();

    ours!.insert(ours!.length, "1");
    theirs!.insert(0, "# ");

    await until("both peers to agree on the text", () => {
      const [a, b] = pocket.peers.map((peer) => peer.cells[0].source);
      return a === b && a.includes("1") && a.startsWith("# ");
    });

    harness.expect(first.cells[0].source).toBe("# value = 1");
    harness.expect(second.cells[0].source).toBe("# value = 1");
    harness.capture("png");
    pocket.close();
  }}
>
  {#snippet vest(pocket: Pocket)}
    <div class="peers">
      {#each pocket.peers as peer (peer.path)}
        <div class="peer" data-testid="peer">
          <Notebook.Component notebook={peer} />
        </div>
      {/each}
    </div>
  {/snippet}
</Sweater>

<Sweater
  lazy
  name="a cell deleted by one collaborator disappears for the other"
  body={async (harness) => {
    const pocket = harness.set(new Pocket());
    harness.onAbort(() => pocket.close());

    const [first, second] = await pocket.open(["keep = 1", "drop = 2"]);
    await until("the second peer to show both cells", () =>
      frames(panes(harness.container)[1]).length === 2,
    );

    const doomed = second.cells[1].id;
    first.remove(first.cells[1]);

    await agreed(pocket, 1);
    await until("the frame to go", () =>
      !identities(panes(harness.container)[1]).includes(doomed),
    );

    harness.expect(second.cells[0].source).toBe("keep = 1");
    pocket.close();
  }}
>
  {#snippet vest(pocket: Pocket)}
    <div class="peers">
      {#each pocket.peers as peer (peer.path)}
        <div class="peer" data-testid="peer">
          <Notebook.Component notebook={peer} />
        </div>
      {/each}
    </div>
  {/snippet}
</Sweater>

<style>
  .peers {
    display: flex;
    height: 100%;
    gap: 0.5rem;
  }

  .peer {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d1d5db;
  }
</style>
