# rich-ui: Rendered tables spike

Status: spike, 2026-10-24. Question: does a rendered-tables feature pass the first
principle in [`PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md), improving the experience in the
large majority of sessions? Answer: **not for markdown tables, which stock Claude Code
already draws well; only JSON and CSV in code fences remain, and those are rare.**

## Method

Ran stock Claude Code 2.1.310 (no plugin) in tmux with `tools/ui-capture.sh`, asked it to
echo fixed markdown, and read the captured screen. Three captures: 120 columns, 60
columns, and a JSON plus CSV reply at 100 columns. One run each; Claude Code version and
terminal as above.

## Findings

**Markdown tables are already drawn as grids.** At 120 columns a five-column table with
long cell text came out as a box-drawing grid with a header row, a rule between rows,
cell text wrapped inside its column, and `:---:` / `---:` alignment honoured (center and
right). Inline `code`, `**bold**` and `[link](url)` lost their markup (the link shows only
its text, not the URL).

**Narrow windows fall back to records.** At 60 columns the same wide table became one
block per row (`Service: ...`, `Owner: ...`), separated by rules, while the small table
stayed a grid. This is a deliberate fallback, so nothing is clipped or garbled. Wrapped
lines in that layout break oddly (a lone `for` on a line), which is the only visible flaw
found.

**JSON and CSV in code fences are left as text.** The JSON array was shown as one long
wrapped line (the fence was not kept), and the CSV as a labelled code block. Nothing
turns either into a table.

## What this means for the feature

- The backlog entry "Rendered tables: markdown, JSON and CSV tables as aligned grids
  instead of wrapped text" is mostly already true for markdown. A mod would re-draw what
  stock draws, with no clear gain, and would risk worse results than the built-in
  renderer, which knows about the theme and window.
- The gap is data in code fences: JSON arrays of objects and CSV. A feature could draw
  those as a grid with the source one press away, like mermaid. It is additive, but by
  my guess appears in a small share of sessions, so it likely fails the "large majority"
  test alone. I did not measure how often they occur.
- Stock link handling (URL dropped) and the odd wrap in the narrow layout are too small
  to justify a feature, and a mod cannot change them without replacing the whole
  markdown renderer.

## Recommendation

Do not build markdown table rendering. Change the backlog entry to JSON and CSV only,
mark it low priority, and pick another feature first. If it is revisited, first count how
often JSON or CSV fences appear in real replies, and check feasibility: a
`ui.render` hook for `AssistantMessage` already splits fenced blocks for mermaid
(`detect.ts`), so the same split could route `json` and `csv` fences to a grid renderer
written without any library (parsing is trivial; layout is a column-width pass).

## Not done

I did not build a prototype, check other Claude Code versions or terminals, or test
tables inside lists and quotes.
