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
judgment, which is enough since the aim is broad coverage.

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

## 4a. How xiaolai/claude-rich-terminal does it

Repo: <https://github.com/xiaolai/claude-rich-terminal> (plugin `rich-terminal` 1.0.0, MIT).
Read at its only commit (`d20c34a`). Same idea as ours (Mermaid in replies plus a status
line), with three differences that matter here.

**1. A different text renderer, and a newer one.** It vendors `@zombie-mermaid/ascii-renderer`
4.0.0 (272 KB bundled), which describes itself as the maintained continuation of
`beautiful-mermaid`. The current release is 5.9.1 (published 2026-10-23). I installed 5.9.1
in a scratch folder and ran the same probe as section 2:

| Type | beautiful-mermaid 1.1.3 (ours) | zombie ascii-renderer 5.9.1 |
|---|---|---|
| flowchart, sequence, state, class, ER, `xychart-beta` | renders | renders (output differs in size: ER sample 16x17 vs our 7x28) |
| **pie** | fails | **renders** as a stacked bar with a percentage legend |
| **C4** (`C4Context`) | fails | **renders** |
| **architecture-beta** | not tried | **renders** (grouped boxes with arrows) |
| gantt, journey, mindmap, gitGraph, timeline, quadrant, sankey, block, requirement | fails | fails |

So swapping the renderer gets pie, C4 and architecture for free, but not the types people
ask for next. Its README says pie stays source in text mode because it is pinned to 4.0.0;
5.x has since added it. Package sizes: ascii-renderer 200 KB plus parser 52 KB plus core
30 KB unminified, so well inside our 800 KB budget. I did not compare flowchart or
sequence output quality side by side, check whether 5.9.1 loads in the mod sandbox, or
read its licence file beyond the package metadata.

**2. Pictures for the rest, via headless Chrome.** For gantt, mindmap, timeline, gitGraph,
journey and pie it draws no text at all. Instead, when the terminal speaks the kitty
graphics protocol (Ghostty, kitty) and the user has turned on "images" and Chrome,
Chromium, Edge or Brave exists, it:
1. writes a small HTML page that loads a bundled `mermaid.min.js` (mermaid 12.1.0, 5.5 MB,
   outside `hooks/`) with a strict CSP that blocks the network,
2. runs `chrome --headless --dump-dom` to read the diagram's size from the page title,
3. runs `chrome --headless --screenshot` to write a PNG, one Chrome at a time, cached per
   diagram and theme, with a fresh file name each time so a failed screenshot can't
   pass off an old file,
4. shows it with the engine's `<Image source={{ file, format: 'png' }}>` element.
It uses `$.process.spawn`, `$.fs` and `$.env` (to detect Ghostty and kitty), so the engine
allows more than our feature has used. In text mode these types stay source. Images are off
by default; the user enables them in plugin config (`images`, `imageTheme`, `browser`).
A separate `/rich open` opens the same Mermaid 12 renderer in the browser as a zoomable page.

This is the "image-quality diagrams" path our own backlog describes (`FEATURES.md`:
bundled rasterizer, then `Raster`, then host tools). It confirms the host-tool route works
today, and it gets every Mermaid type with exact upstream fidelity. The costs are the
ones it states itself: only two terminals, needs a browser installed, about 1.5 s of
latency per diagram, and 5.5 MB of vendored JavaScript.

**3. Other details worth borrowing.**
- Diagrams inside quotes and lists are handled, with a fallback to rendering the whole
  Markdown when a diagram can't be lifted out (`needsWholeMarkdown`). Ours skips nested
  fences.
- A placeholder is shown while a fence is still open or the picture is being drawn.
- ctrl+o shows the source; the stored message is never changed.
- A private cache folder checked for ownership and mode 700 before use.

**Implications for us.** (a) Try `@zombie-mermaid/ascii-renderer` 5.x as a drop-in
replacement for `beautiful-mermaid`: it adds pie, C4 and architecture and is actively
maintained, while ours has been quiet since February. (b) For gantt, mindmap, timeline,
gitGraph and journey we write our own text renderers (section 4). The Chrome picture path
is ruled out by the owner.

## 5. Recommendation

Direction from the owner: picture rendering (the Chrome route above) is out, and there is
no need to count types in transcripts first. The aim is to support as many types as make
sense, all as text.

1. Spike swapping in `@zombie-mermaid/ascii-renderer` 5.x (section 4a): check it loads in
   the sandbox and that the five shipped types still look as good. If so, `xychart-beta`,
   `pie`, C4 and architecture come with it.
2. Allow those types in `sanity.ts`, with width and malformed-body checks and tests.
3. Write own text renderers for the types no library draws, one PR each, in this order:
   `gantt`, `mindmap`, `timeline`, `gitGraph`, `journey`, then `quadrantChart`. Each
   returns null on anything it doesn't understand so the block stays code.
4. Skip sankey, block and requirement unless a library starts drawing them.

## 6. Open questions

- Own renderers add maintenance and visual-quality risk that the library path avoided. The
  fallback rule still applies: only draw what we can draw well, otherwise leave the code.
- Does the zombie-mermaid renderer look as good as `beautiful-mermaid` on the five shipped
  types, and does it load in the mod sandbox?
- Gantt needs date math and `after x` dependencies; gitGraph needs lane layout. Both are
  the largest pieces of new code.

## 7. Not done

I did not run anything inside the mod sandbox, did not run the Chrome picture path of
claude-rich-terminal (ruled out), did not evaluate the npm `mermaid-ascii` package, did not measure type frequency, and wrote no renderer code.
