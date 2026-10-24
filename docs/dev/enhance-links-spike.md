# rich-ui: Enhance links, a spike

Status: spike, 2026-10-24, no feature code. Checked against Claude Code 2.1.310. Question
from [`feature-ideas.md`](feature-ideas.md) (candidate 2): can `src/foo.ts:42`, a bare path
or a backticked path in a reply become a link that opens the file in a pane, and the
editor on request?

Evidence comes from four places, and each claim says which:

- **real**: a real Claude Code session in tmux (inside Ghostty) with a throwaway mod that
  draws a `Markdown` element full of test links. Synthetic mouse clicks were sent as SGR
  mouse bytes (`tmux send-keys -H`), which the fullscreen UI accepts as real clicks.
  The throwaway mod is described in the appendix; it is not in the repo.
- **types**: the API types of 2.1.310 (`claude-code.d.ts`).
- **source**: the engine's own source, read as text from the binary.
- **harness**: the experiments kept in
  [`hooks/spike/enhance-links.spike.test.tsx`](../../hooks/spike/enhance-links.spike.test.tsx)
  (throwaway, marked SPIKE; none of it ships and `register.tsx` does not import it).

## Summary

| # | Question | Answer |
|---|---|---|
| 1 | Can a plugin answer links, and can paths be rewritten into them? | **Yes**, in any `Markdown` the plugin draws (a reply it rewrites). `src/foo.ts:42` works as written; a name with a line and no directory (`foo.ts:42`) needs `./` in the href. Real. |
| 2 | Open any text file in a pane with `Code`? | **Yes**: language from the path, gutter from `startLine`, scrolled to the line with a keyed box and `$.ui.scroll`. Two quirks: gutter width per block, and one control character drops the whole pane. Real. |
| 3 | Existence checks? | **Cheap**: 200 `$.fs.exists` took 24 ms in a row, 6 ms in parallel. Check every candidate, cache by path. Real. |
| 4 | Open in the editor? | `$.process.run(argv)` runs with **no approval prompt**. But `$EDITOR` was unset here, and a terminal editor cannot run. Plain click is the plugin's, so the editor needs its own button. Real, with the permission model from types. |
| 5 | Terminals without hyperlinks? | A link whose label equals its href prints once, clean. **But in a simulated no-hyperlink terminal, plain clicks did not reach the plugin at all.** Open question for the user's terminal. Real. |
| 6 | Markdown preview and mermaid? | They already answer the reply, so a new hook beside them would never run. Links must be answered by **one shared reply pass**. Harness. |

One more finding that changes the value of the whole idea: **a plain click reaches a plugin
only in the fullscreen UI.** In the default (main screen) UI the app does not ask the
terminal for mouse events, so `onLinkPress` never fires. Real (tmux reported no mouse mode
in the main screen).

## 1. Which links can a plugin answer

**Where.** Only links in a `Markdown` element that the plugin itself draws, with
`onLinkPress` (types: `MarkdownProps`). In practice that is a rewrite of the
`AssistantMessage` render, as markdown preview already does. Links in tool output, user
messages and the engine's other rows are not reachable without rewriting those sites too.
A link not listed in `pressableLinks` keeps the engine's behaviour. The list holds at most
256 entries of 2048 characters (types), so a reply with more candidates answers the first
256.

**What the engine does with an href** (real, hyperlinks on, fullscreen). Each row is a
`[label](href)` I clicked; "press href" is what the plugin's `onLinkPress` received.

| Href as written | Drawn | Press href |
|---|---|---|
| `src/foo.ts:42` | link | `src/foo.ts:42` |
| `./foo.ts:42`, `foo.ts#L42`, `../up/foo.ts:5`, `~/foo.ts`, `foo.ts` | link | as written |
| `src/foo.ts:42-50` | link | as written |
| `/abs/path.ts` | link | `file:///abs/path.ts` (the engine rewrites it) |
| `/abs/x.ts:7:3` | link | `file:///abs/x.ts:7:3` |
| `file:///abs/foo.ts#L42` | link | as written |
| **`foo.ts:42`** (no directory) | plain text, **no press** | none |
| **`a.ts:3`** | plain text, no press | none |
| `<with space.ts:3>`, `with%20space.ts:3` | `x (with space.ts:3)`, **no press** | none |
| `https://example.com` | link | as written |

Three consequences:

- `foo.ts:42` reads to the engine as a URL with the scheme `foo.ts:`, so it is not drawn as
  a link. Prefixing `./` fixes it (`[foo.ts:42](./foo.ts:42)` presses as `./foo.ts:42`).
- A path with a space is not a link the engine will draw. Such paths are skipped.
- `pressableLinks` accepts either spelling of an absolute path: `/abs/path.ts` and
  `file:///abs/path.ts` both matched (real). Markdown preview, which lists hrefs as
  written and resolves `file:` in `pathFromHref`, is therefore fine.

**Can `path:line` be rewritten?** Yes, and the href stays in `pressableLinks`. The rewrite
tested (harness: "the rewrite keeps the text", "a prototype hook rewrites a reply"):

```
`src/foo.ts:42`   ->  [`src/foo.ts:42`](src/foo.ts:42)     label equals href
`foo.ts:7`        ->  [`foo.ts:7`](./foo.ts:7)             ./ because there is no directory
`package.json`    ->  [`package.json`](package.json)
```

Stripping the markup gives back the original words, and fences, existing links, images and
autolinks are never rewritten (harness). A backticked label keeps its text but not its code
colour: a link is drawn in the link colour (bright blue in the test terminal), so a
linked path looks different from an unlinked one in the same sentence (real, ANSI `94`
against `38;5;153` for plain inline code).

**Which tokens to link.** The grammar tested: an optional `./`, `../`, `~/` or `/`,
directories, a file name with a known extension, then `:line`, `:line:col`, `:line-line`
or `#Lline`. See section 3 for what it lets through.

## 2. Open any text file in a pane

Built and drawn in a real session (docked pane, 80 columns, 120-column fullscreen window):
press, then `$.ui.open` first (still inside the press, as markdown preview does), then
`$.fs.read`, then a `ui.render` for the pane returning `Code`.

- **Language** came from `path` (the highlighter coloured a `.ts` file; no `language` given).
- **Gutter** numbered from `startLine`, so a window cut from the middle of a file shows the
  true line numbers.
- **Scroll to the line.** `Code` has no key, so the file is drawn as two blocks, the lines
  above and the lines from the target on, the second inside `<Box key="target">`.
  After the pane drew, `$.ui.scroll({ to: { key: 'target' }, in: paneId, block: 'start' })`
  answered `{}` and line 60 sat at the top of the pane. I waited 150 ms after the state
  change before scrolling; asked before the keyed element is drawn, the call answers
  `{ deny: "no element drawn under that key" }`. Not tested without the wait.
- **Highlighting the line.** A `backgroundColor` on the box around the target line coloured
  the gutter cell only; the code text keeps the engine's colours. Enough to find the line.

Quirks found:

1. **Gutter width is per `Code` block.** Splitting at line 60 of a 140-line file drew
   ` 60 ` and `  61 ` one cell apart, because the first block's widest number has two
   digits and the second's three. A split across 99/100 misaligns by a column. The
   alternative that avoids it: no split, one `Code` that starts a few lines above the
   target (the window below), a dim "N lines above" row, and no scroll call at all.
2. **One control character drops the whole pane tree.** A file with an ESC (0x1b, as in a
   log with colours) left the pane blank, with no message in the pane. CRLF line ends drew
   fine. Control characters therefore have to be replaced before drawing, and a file
   with a NUL is treated as binary (`codeSafe` in the harness file).
3. **Size.** One drawing takes 100000 characters in all (types), and `$.fs.read` rejects
   over 4 MiB (types). Markdown preview already cuts at 99000 and says so. For code the
   better cut is a window around the line: 20 lines above, then as many as the budget allows,
   with "N lines above / below" rows (`windowAround`, tested at 5000 lines and with
   out-of-range lines). A file over 4 MiB shows the reason, as `describeError` does today.
4. A line wider than the pane wraps under its gutter (`wrap` default); `truncate-end`
   is available if wrapped code is judged worse.

## 3. Existence checks, cost and false positives

**Cost** (real, one session, the probe called these from a press):

| Calls | Time |
|---|---|
| 200 `$.fs.exists`, awaited one after another, all missing | 24 ms |
| 200 `$.fs.exists` with `Promise.all` | 6 ms |
| 50 `$.fs.stat` | 3 ms |

About 0.1 ms a call, so a reply with 30 candidates costs 3 ms. The check is not a
performance problem. The cache is there so a render that runs again, as it does for each
change while a reply streams (assumed from how `AssistantMessage` is redrawn; not measured),
does not repeat the calls:

- key: the resolved absolute path; value: a promise, so concurrent draws share one call;
- a rejection counts as "not there" (`exists` rejects only for a network location);
- an entry for a path Claude writes or edits is dropped from the `tool.call` hook that
  markdown preview already has for `Write` and `Edit`, so a file created this turn
  becomes a link on the next draw;
- cap at 256 checks a reply, which is also the `pressableLinks` limit (harness: 500
  candidates cause exactly 256 calls).

`$.fs.exists` is true for a directory. Use `$.fs.stat` (`kind === 'file'`) when the
candidate has a line number, so a directory is not opened as code.

**False positives** (harness, `findRefs`). Linking only **inline code** found every real
reference and no prose accident:

| Text | Inline code only | Any word (bare scan) |
|---|---|---|
| `src/foo.ts:42`, `foo.test.ts:12:5`, `./a/b.py#L9-L12`, `../up/x.go:3-9`, `~/notes.txt` | linked | linked |
| `Node.js`, `Next.js`, `vue.js` in prose | not linked | **linked (wrong)**; removed by the existence check |
| `v1.2.3`, `2.0.1`, `3:4`, `10:30`, `a:b`, `e.g.`, `and/or`, `TCP/IP`, `w/o`, `foo.bar.baz`, `me@host.com` | not linked | not linked |
| `https://example.com/a.ts:42`, `http://localhost:3000/x.js` | not linked | not linked |
| paths inside a fence, an existing link `[x](y)`, an image, an autolink | not linked | not linked |

So: the grammar (a known extension, a separator-or-name shape, no scheme) rejects versions,
times, ratios, URLs and `a:b`. What it cannot reject is a word that ends in a known
extension; only the existence check does that. Inline code is the author saying "this is a
name", so it needs the check least. A bare word in prose needs it always, and still turns
`package.json` mentioned in a sentence into a link when the file exists, which is
probably what the reader wants but is a visible change to prose.

## 4. Open in the user's editor

**What runs.** `$.process.run(argv)` runs a host command by argument vector, with no
shell, as the user (types: "Commands on the host, run as the user the session runs as").
In the probe a press ran `echo hi` and got `exitCode 0` back in 13 ms, with **no approval
prompt and no notice** that I could see.
Consequences for the trust model:

- Installing and enabling the plugin is the only consent. The README and the feature page
  must say "clicking opens your editor" in as many words.
- Other plugins can see and deny the call (`process.run` is a hookable event), but nothing
  in the engine asks the user.
- It must run only from a press the user made, never from a draw, never from model
  text without a click (harness: nothing runs on mount).

**What is safe.** Always `argv`, never a shell string. The editor name comes from a fixed
list; the file path is always absolute (so it never starts with `-` and cannot be taken
for an option); nothing from `$EDITOR` beyond its first word's base name is used
(`code --wait` becomes `code`, `code; rm -rf ~` is rejected because `code;` is not on the
list). `editorArgv` in the harness file does this and its edge cases are tested:

| `$EDITOR` / `$VISUAL` | Command |
|---|---|
| `code`, `cursor`, `windsurf`, `code-insiders` | `[name, "-g", "/abs/file:42"]` |
| `zed`, `subl` | `[name, "/abs/file:42"]` |
| `mate` | `["mate", "-l", "42", "/abs/file"]` |
| `vim`, `nvim`, `nano`, `emacs`, `hx`, `micro`, ... | none: a child with no terminal cannot run a terminal editor |
| unset, empty, unknown, `$(whoami)` | none |

**What `$.env.get` gives.** `$.env.get("EDITOR")` takes a string literal name, and
`claude plugin validate` lists the names. On this machine **both `EDITOR` and `VISUAL` are
unset**, in the shell and in the session's environment (real), and `code` is not
installed while `cursor` is. So `$EDITOR` alone leaves this user with nothing. A
fallback chain is needed: `VISUAL`, `EDITOR`, then a choice the user makes once (a
`/rich-ui` setting would be a new kind of control for the manager pane), or the platform
opener (`open -t` on macOS, `xdg-open` on Linux), which opens the file in the default
editor with no line number. `open` without `-t` must never be used, since it would launch an
application file as a program.

**Does the engine's modified click coexist?** Types say a plain click is the plugin's,
and "a ctrl, alt or terminal-kept cmd click opens it as before". So the plugin cannot
claim the modified click, and the editor needs its own trigger: a button in the pane
(and in the pane only, so a reply gains no row). What the terminal does with the
modified click on these links is **not verified** (tmux swallowed it, and I had no GUI
terminal to click in). What I did see: the engine emits the link to the terminal as an
OSC 8 hyperlink, with a relative href kept relative (`8;;src/foo.ts:42`) and an absolute
one as `file:///abs/path.ts`. Terminals that open `file:` hyperlinks would open the
absolute form in the default application on cmd+click; a relative href probably does
nothing. So if modified-click-to-open matters, use absolute hrefs; that costs the clean
output in terminals without hyperlinks (section 5).

## 5. Terminals without hyperlink support

The engine prints a link it cannot hyperlink as `label (target)`, unless the label equals
the target. Real, `FORCE_HYPERLINK=0` (the engine's own switch, which makes its support
check answer "no"), same replies as section 1:

| Markdown | Hyperlinks on | Hyperlinks off |
|---|---|---|
| `[src/foo.ts:42](src/foo.ts:42)` (label equals href) | `src/foo.ts:42`, link colour | `src/foo.ts:42`, **plain, uncoloured** |
| `` [`src/foo.ts:42`](src/foo.ts:42) `` | same | same |
| `[label](src/foo.ts:42)` | `label` | `label (src/foo.ts:42)` |
| `[foo.ts:42](./foo.ts:42)` | `foo.ts:42` | `foo.ts:42 (./foo.ts:42)` |
| `[label](/abs/path.ts)` | `label` | `label (/abs/path.ts)` |
| `[label](file:///abs/path.ts#L42)` | `label` | `label (file:///abs/path.ts#L42)` |

So the right form is **label equal to href**: it prints once, with nothing added, in both
modes. It needs the path to have a directory (or the label to carry the `./`), and it uses
relative hrefs, which gives up the absolute-href trick in section 4.

Two problems remain:

1. With hyperlinks off a linked path is drawn as plain text, without the code colour or
   the link colour, so the reader cannot tell it is clickable. In a terminal that cannot
   show it, the rewrite also takes away the inline-code tint.
2. **In that mode, clicks did not reach the plugin at all.** In two fullscreen sessions
   with `FORCE_HYPERLINK=0`, clicking at several columns of a `label (target)` link and
   of a label-equals-href link opened nothing. The same click with hyperlinks on opened
   the pane (control run, same reply, same position).
   This contradicts what the git history of markdown preview records (the author's
   terminal draws every link as `label (target)` and a click opened the pane), so
   either `FORCE_HYPERLINK=0` is not the same as that terminal's state or the two
   observations differ for a reason I did not find. This **needs a hand test in the
   user's terminal**, for the shipped markdown preview as much as for this idea. It decides
   whether links work "in most sessions".

## 6. Markdown preview and mermaid

- **Both already answer the reply.** A hook that returns a tree without calling `next`
  ends the chain. Markdown preview answers any reply with a markdown-file link, and the
  mermaid feature any reply with a mermaid fence. Harness: with a hook standing for a new
  feature placed beneath the plugin, a reply with `[plan](/repo/plan.md)` and
  `` `src/foo.ts:42` `` reached it **0 times**; a reply with a mermaid fence and a backticked
  path reached it **0 times**; a reply with only a path reached it once.
- So a separate `AssistantMessage` hook for code references would silently lose every
  reply that also links a markdown file, or holds a diagram: the replies that
  mention files most.
- **Therefore one shared reply pass.** One handler, `renderReplyLinks`, resolves the
  elements once, decides which kinds of link are on (two flags, two toggle rows), finds
  `.md` links and code references together, and passes one `pressableLinks` list and one
  `onLinkPress` that dispatches on the href (markdown file: open preview; code
  reference: open code). Mermaid's text segments are already separate `Markdown`
  elements with a `key` each (`view.tsx`); the same pass can give them
  `pressableLinks`, which also removes markdown preview's "no links next to a diagram"
  limit. Both panes use a different `id`, so a preview and a code view can be open together.
- Each feature still has its own toggle row and, off, the stock UI is untouched. The
  handler may be shared; the flags are not (`isOn` is checked per kind, and a reply with
  no kind on goes to `next(e)`).
- A reply drawn by the plugin re-creates the engine's frame (the bullet column and the top
  margin, `buildLinkedReply`). Every reply with a linked path is then drawn by our code
  instead of the engine's, which is the cost to watch: sessions where every reply has a
  path (most coding sessions) move to our frame.
- The gate on `e.viewport.isFullscreen` is available on render (types). Since a plain
  click works only in the fullscreen UI, the feature should leave the reply to the engine
  elsewhere (see the recommendation).

## Ranked recommendation

1. **Build "Code references" v1** (size: M, about two days, mostly tests and the shared
   reply pass).
   - Backticked path references only (no bare prose), checked with `$.fs.stat`, linked as
     label-equals-href with `./` for names without a directory, up to 256 a reply.
   - A plain click opens the file in a pane: `Code`, language from the path, a window of
     up to about 97000 characters around the line, "N lines above / below" rows, control
     characters replaced, binary and over-4-MiB files explained.
   - Refactor markdown preview's reply hook and the mermaid reply into the shared pass
     (section 6) in the same PR, since it cannot ship without it.
   - Only when the reply is drawn in the fullscreen UI; otherwise stock.
   - Risks: (a) clicks in a terminal without hyperlink support (section 5, unresolved);
     (b) the visual change from code tint to link colour; (c) every reply with a path is
     now drawn by us; (d) the pane's gutter quirk.
2. **"Open in editor" as a button in the pane** (size: S, half a day, after 1). Allow-listed
   GUI editors, a platform-opener fallback, and the README line that clicking runs a host
   command. Risks: the editor is unset for some users, and the engine gives no approval
   step for host commands.
3. **Copy `path:line`** from the same pane (size: XS). `$.ui.copy` needs no host command;
   a safer stand-in for 2 if the user does not want the plugin running commands.
4. **Do not build:** linking bare paths in prose (false positives on `Node.js`; needs the
   check on every word), claiming the modified click, and paths with spaces.

**Decided by the user:**

- Whether a feature that works only in the fullscreen UI, and perhaps only in
  terminals with hyperlink support, still passes the first principle. This depends on
  the hand test below; if their terminal or most users' terminals fail it, the answer is
  to not build this and to fix the markdown preview note.
- Backticked only, or also bare paths with the existence check.
- Default on or off (a changed link colour on most replies argues for off at first).
- Whether the plugin may run the editor on a click, and which editors and fallback.
- Whether to do the shared reply pass first on its own: a small change that lifts markdown
  preview's "no links next to a mermaid diagram" limit and adds no new feature.

## What to test by hand

In the user's real terminal, with `claude --plugin-dir <this worktree>`:

1. Fullscreen on (`/tui fullscreen`), ask Claude to reply with exactly:
   ``See [the plan](docs/FEATURES.md) and `hooks/register.tsx:12` and `README.md`.``
   Click the plan link. Does the pane open? (This is the shipped markdown preview.)
2. The same with the default UI (`/tui default`). Does a click do anything?
3. Start `FORCE_HYPERLINK=0 claude --plugin-dir <worktree>` and repeat 1. Do links
   print `label (target)`? Does a click still open the pane?
4. In your terminal's own settings, check whether it reports hyperlink support, and
   compare 1 with 3.

## How the real checks were made

A throwaway mod outside the repo drew a `Markdown` of test links in place of every reply,
logged the presses as toasts, and (for section 2) drew a `Code` pane. It ran with
`claude --plugin-dir <mod>` in tmux, one fresh session per variant:

```
tmux new-session -d -s probe -x 120 -y 40 -c <workdir> \
  "FORCE_HYPERLINK=0 claude --settings '{\"tui\":\"fullscreen\"}' --plugin-dir <mod>"
tmux send-keys -t probe -l "say ok" ; tmux send-keys -t probe Enter
# a plain click at column 6, row 11 (1-based), as SGR mouse bytes:
tmux send-keys -t probe -H 1b 5b 3c 30 3b 36 3b 31 31 4d  1b 5b 3c 30 3b 36 3b 31 31 6d
tmux capture-pane -t probe -p -e      # -e keeps the escapes: the OSC 8 spans show
```

`--settings` is used so the user's own `~/.claude/settings.json` is not changed (an early
run changed it by `/tui fullscreen`; it was put back).

Not checked: the modified click in a GUI terminal, terminals other than Ghostty under tmux,
streaming replies, light themes, Windows paths, symlinks, and the main-screen UI beyond
"no mouse events are requested".
