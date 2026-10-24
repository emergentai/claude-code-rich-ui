# rich-ui: Mermaid diagram type coverage (research)

Status: research, nothing decided. Branch `feature/mermaid-more-diagram-types`. Extends
[`mermaid-feature.md`](mermaid-feature.md); the type gate is `hooks/features/mermaid/sanity.ts`.

## 1. Where we are

Five types render: flowchart, sequence, state, class, ER. Everything else stays a code
block. The only renderer is the vendored `beautiful-mermaid` 1.1.3 (the latest release,
last published 2026-02-26), ASCII path only.

## 2. What the vendored renderer does today

I ran `renderMermaidASCII` from the installed 1.1.3 package against one sample of each type
(`tools/node_modules`, not the mod sandbox):

| Type | Result |
|---|---|
| flowchart, sequence, state, class, ER | renders (the five we ship) |
| `xychart-beta` | **renders** bars and lines; 22 rows by 63 to 77 columns for 3 to 12 categories. Horizontal, numeric x-axis and long labels all drew without error. |
| pie, gantt, journey, mindmap, gitGraph, timeline, quadrantChart, requirementDiagram, sankey, block, C4 | throw `Invalid mermaid header`; no support, and none is planned in the library |

So the cheapest gain is `xychart-beta`: it is a one-line allow-list change plus tests.
The earlier decision to hold it back (`verification-notes.md` item 5) was caution, not a
renderer limit. Caveats still to check before shipping it: a malformed body can draw a
bogus chart without throwing (the reason `sanity.ts` exists), the chart is a fixed
~63 columns wide so `fit.ts` must be checked on narrow windows, and I only tried small
charts.

## 3. Everything else needs our own renderer

No library found covers the rest in text form from inside the mod sandbox:

- `beautiful-mermaid`: no support, as above.
- `mermaid-ascii` (npm, 1.0.0): not evaluated further; the earlier spike rejected the Go
  `mermaid-ascii` for mangled labels and no sequence diagrams, and this npm package is a
  different project I have not run.
- `merman` (Rust): has ASCII/Unicode output, but Rust and not loadable here (no
  WebAssembly in the sandbox). Its type coverage I could not confirm from search results.
- `mermaid` / `mermaid-cli`: needs a DOM or a browser; rejected earlier.

Sandbox limits that shape any new renderer: no bare npm imports, files under 1,048,576
bytes, no DOM, `process`, `require` or WebAssembly (`mermaid-feature.md` section 10).
The current bundle is 84 KB, so there is room for hand-written renderers.

## 4. Candidates, ranked by my judgment

I did not measure how often each type appears in Claude's replies; the order below is a
judgment, and the first step should be to count real transcripts.

| Type | Value | Effort | Notes |
|---|---|---|---|
| `xychart-beta` | medium | trivial | library already draws it |
| `pie` | high | small | grammar is `"label" : number`; draw as horizontal bars with percentages (a text pie is unreadable) |
| `gantt` | high | medium | needs date math and `after x` dependencies; draw as rows of bars on a time axis, scaled to width |
| `gitGraph` | medium | medium | commit/branch/merge/checkout state machine; lanes per branch |
| `timeline` | medium | small | sections of period : events; vertical list with a rail |
| `mindmap` | medium | small | indentation tree; draw as a tree with box-drawing branches |
| `journey` | low | small | sections, tasks with a 1 to 5 score; rows with a score bar |
| `quadrantChart` | low | medium | 2D grid with point labels that collide easily |
| sankey, block, C4, requirement | low | large | skip |

Shape of a safe rollout, per type: add a parser that returns null on anything it does not
understand (so the block stays code), a renderer returning lines, a sanity check, and
tests for the happy path, malformed input and a narrow window. All of it sits behind the
same Mermaid switch, since one switch per feature is a charter rule; per-type switches
are not needed.

## 5. Recommendation

1. Count the mermaid types in real transcripts first (a one-off script over
   `~/.claude/projects/**/*.jsonl`) so the order above rests on data.
2. Ship `xychart-beta` (allow-list plus width and malformed-body checks).
3. Write small own renderers for `pie`, then `gantt` and `mindmap`/`timeline`, one PR each.
4. Revisit `gitGraph` and `journey` only if the count shows they appear.

## 6. Open questions

- Is the first-principle test met for these? A pie or gantt in a reply is rarer than a
  flowchart; the "large majority of sessions" bar may only be met by the existing five
  plus pie and gantt.
- Own renderers add maintenance and visual-quality risk that the library path avoided.
  Is a worse-looking diagram better than the code block? The fallback rule says only draw
  what we can draw well.
- Does `beautiful-mermaid` upstream plan more types? Not checked; look at its issue
  tracker before writing renderers it may ship.

## 7. Not done

I did not run anything inside the mod sandbox, did not evaluate the npm `mermaid-ascii`
package, did not measure type frequency, and wrote no renderer code.
