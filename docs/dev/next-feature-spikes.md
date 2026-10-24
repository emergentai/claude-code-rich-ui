# rich-ui: Next feature spikes

Status: spikes, 2026-10-24, no code. Three backlog candidates checked against stock Claude
Code 2.1.310 (run in tmux with `tools/ui-capture.sh`, no plugin) and the mods API types
in `.claude-plugin/types/claude-code/index.d.ts`. The test is the first principle in
[`PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md): better in the large majority of sessions,
no clutter, switchable. The rendered tables spike is [`tables-spike.md`](tables-spike.md).

## Summary

| Candidate | Stock already does it? | API feasible? | Verdict |
|---|---|---|---|
| Inline edit diffs | **Yes**, fully | n/a | Drop: nothing to add |
| Status band round two | Partly (model and cost are in `/status` and `/cost`) | model and cost yes; cache state no | Small; one segment worth doing (cost) |
| Markdown preview pane | **No**: files Claude writes show as plain numbered text | Yes, with a width limit | Best of the three; worth a design doc |

## 1. Inline edit diffs

Asked stock Claude Code to create a five-line file and change line 3 with Edit, at 110
columns. Result: the `Write` row prints the new file with line numbers, and the `Update`
row prints "Added 1 line, removed 1 line" with a diff hunk: unchanged lines in dim, the
removed line on a red background (`-gamma`), the added line on a green one
(`+GAMMA changed`), three lines of context each side. That is exactly the proposed
feature, already inline and coloured, so the backlog entry is moot.

Not checked: very large edits (stock may collapse them), multi-hunk edits, and a light
theme. None of those is a reason to rebuild the feature.

**Verdict: remove from the backlog.**

## 2. Status band, round two

The original idea listed model, prompt-cache state and a switch per segment. What the
API gives (`SessionMeasureInput`, `$.session.model()`):

| Segment | Source | Feasible? | Notes |
|---|---|---|---|
| model | `$.session.model()` returns the id; `PostModelSwitch` event on `/model` | Yes | Almost never worth showing; the model rarely changes, and a quiet-by-default band would show it only after a switch. |
| cost | `session.measure` input has `cost.usd`, raised when the total grows | Yes | Useful for API-key users; on a subscription the dollars mean little. Natural rule: show from a threshold (for example 5 USD), configurable only later. |
| cache cold | no cache figure on `session.measure` or `$.session.usage()` | **No direct source** | Only a guess from time since the last response (the cache lives minutes), which would sometimes be wrong. Do not build on a guess. |
| per-segment switch | The pane lists features, one switch each | Only by making each segment its own feature | One switch per feature is a charter rule, so a cost segment would be a second feature, "Cost in the status band", sharing the row. |

**Verdict:** small and safe, but only a cost segment is worth it, and only for the
minority on API billing. Low priority. Model and cache segments: drop.

## 3. Markdown preview pane

Stock draws a file Claude writes as numbered plain text, so a spec, plan or README is
shown as raw markdown. A pane that draws it rendered fills a real gap.

What the API provides:
- `$.ui.open({ id, title, ... })` opens a pane from a hook, and the plugin draws it by
  hooking `ui.render` for `{ component: 'Pane' }`, as the manager already does.
- A `Markdown` element exists on the terminal surface (`MarkdownProps`), so headings,
  lists, tables and code come from the engine's own renderer, with no library to vendor.
- `$.fs.read` reads the file (up to 4 MiB). `tool.call` events name `Write` and `Edit`
  with their target path, so the pane can open for `*.md` files Claude writes and refresh
  when it edits them. `$.ui.invalidate` redraws a pane.

Limits found in the types:
- **Width.** A pane opened without the person asking is placed only from 144 columns
  (110 once asked, by a command or keypress). Below that it waits undrawn. So automatic
  opening works only in wide fullscreen terminals; on a normal window it needs a command
  such as `/rich-ui preview` (a trigger the manager does not have yet) or a keypress.
- **Layout.** Docked beside the transcript from 110 columns in fullscreen; elsewhere it
  sits inline above the prompt, which takes room from the conversation.
- **Focus and scrolling.** A pane can be scrolled (`$.ui.scroll`) and focused, but the
  earlier attempt to put the manager in the band failed on focus, so the pane's keyboard
  behaviour must be checked in a real terminal before relying on it.

Open questions: which files qualify (only `.md` that Claude wrote this session, or any
it reads?), what closes the pane, and whether auto-opening is wanted at all or the pane
should be on request only, which fits "no clutter" better.

**Verdict:** the one candidate with a genuine gap and a feasible path. It is a feature of
several PRs: a pane skeleton with a command trigger, then refresh on `Edit`/`Write`, then
the auto-open and width behaviour.

## Recommendation

1. Build the markdown preview pane, starting with a design doc and a throwaway pane that
   draws a hard-coded markdown string with `Markdown`, to confirm focus, scroll and the
   110/144 column behaviour in a real terminal.
2. Park the cost segment as a small follow-up if API-billing users ask for it.
3. Remove inline edit diffs from the backlog.

## Not done

No prototype or live pane was run; the API facts come from the type declarations and are
unconfirmed in a real session. Edit diffs were checked at one size and one theme.
