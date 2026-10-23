# rich-ui: Mermaid Feature

Status: implemented in v0.1.0 and checked in a real terminal (`verification-notes.md`, `ui-style-study.md`). Depends on `architecture.md` (feature contract, gating, state). Evidence comes from two feasibility spikes, summarized in section 10.

## 1. What it does

When Claude's reply contains a complete fenced mermaid block, the transcript shows a text diagram drawn with box-drawing characters instead of the raw code. A small control above the diagram reveals the original source. Anything the feature cannot draw is left exactly as Claude Code would show it today.

Feature metadata (for the registry and pane):
- id `mermaid`, name "Mermaid diagrams", description "Draw mermaid diagrams as text diagrams", `defaultEnabled: true`.

## 2. Scope

In v1:
- Terminal surface only.
- Fences in assistant replies only (the `AssistantMessage` transcript component).
- Diagram types: flowchart (`graph` / `flowchart`, including subgraphs), `sequenceDiagram`, `stateDiagram` / `stateDiagram-v2`, `classDiagram`, `erDiagram`. These five, and only these, are supported; every other type (gantt, pie, journey, mindmap, `xychart-beta`, and so on) stays a normal code block. `xychart-beta` renders in the vendored library but is deliberately not allowed in v1.
- Text output with a unicode box-drawing character set.

Out of v1: fences in files Claude writes or reads; fences nested in lists or blockquotes; other diagram types (gantt, pie, and so on); image or raster output (planned, see section 8); export, editing, history; non-terminal surfaces.

## 3. Behavior

### 3.1 Detection

- A fence opens with three or more backticks or tildes at the start of a line, followed by `mermaid` in any letter case, and closes with a matching fence. Nothing indented or nested inside a list or blockquote is matched.
- Only complete fences are drawn. While a reply is still streaming, an unclosed fence stays as raw text; the diagram appears once the closing fence arrives.
- Several fences in one reply are handled independently, in order.

### 3.2 Sanity checks

A fence is drawn only if all of these hold; otherwise it is left as the original code block:
1. After optional YAML front matter (`---` block), comment lines (`%%`) and `%%{init: ...}%%` directives, the first line starts with a header for a supported type (section 2).
2. The renderer returns without throwing.
3. The output has at least one non-blank line.

### 3.3 Fitting

Available size: width is the viewport columns minus 4 (the bullet column and a margin); height is the visible terminal rows minus 6, which leaves room for the prompt, status line and surrounding text. Both are named constants (`COLUMN_MARGIN`, `ROW_MARGIN`); the live check found the viewport present and the margins right.
1. Render in the author's direction. If it fits, use it.
2. If it does not fit and the type is a flowchart, render again in the perpendicular direction (top-down to left-right, and the reverse). If that fits, use it.
3. Otherwise leave the original code block.
Sequence, class, ER and state diagrams are fitted as authored in v1 (state diagrams could take a direction switch later), so they go from step 1 to step 3. The renderer is called with `paddingY: 1`, which shrinks a tall top-down flowchart by about a third (25 rows to 17 for three nodes).
The engine does not redraw on a height-only change, so fit is decided at the last width or props change.
If the viewport size is unknown, leave the code block rather than guess. In that case the feature also posts a status note, "Diagrams left as code: terminal size unknown", which the `/rich-ui` pane shows on the Mermaid row (see `architecture.md` section 4.5). The note appears nowhere else.

### 3.4 Presentation

The feature replaces the whole assistant row, so it draws the frame the engine draws around every assistant block (measured in `ui-style-study.md`): a blank line above, the `⏺` bullet in a two-cell column on the first block of a reply (`isFirstOfReply`, theme color `text`), the content indented past it, and one blank line between the parts.
- The diagram is drawn as monospace `Text` lines in the default text color, like a native code block. No fixed or dim color is used on the lines: dim looked bad in the light theme and the `subtle` theme color is a very dark gray on dark backgrounds.
- Text before and after the fence stays as `Markdown`, so the rest of the reply looks normal.
- Above each diagram sits one dim `Button` acting as a toggle (where the native code block puts its language label): "show source". Pressing it replaces the diagram with the original fence, drawn as a native `Markdown` code block, and the button changes to "show diagram". Pressing again swaps back. The diagram and the source are never shown at the same time. Nothing else is offered.
- The terminal has no switch element, so the toggle is a `Button` whose label reflects the current state.
- Which view each diagram shows is held in session state, keyed by message id plus the diagram's index in that message, and resets with the session. The default view is the diagram.
- A row the engine marks as a summary (`isSummary`) is left to the engine.

### 3.5 Toggling the feature

When the feature is off, its `ui.render` hook passes straight through and the engine draws the reply unchanged. The flag is read each time a message is drawn, so toggling applies to every diagram in the chat at once, in both directions (off turns all of them back into code, on draws all of them). This was observed in the live check and is the intended behavior.

## 4. Components

```
hooks/features/mermaid/
  index.ts          # Feature metadata + the exported ui.render handler
  detect.ts         # finds complete fences in a reply's text
  sanity.ts         # header and output checks (3.2)
  fit.ts            # direction and size decisions (3.3)
  render.ts         # renderDiagram: the text renderer over the vendored bundle
  view.tsx          # buildReply: the frame, Markdown, diagram, toggle row, source
  *.test.ts(x)      # tests beside each file
hooks/vendor/
  beautiful-mermaid.js   # bundled, committed, under the 1,048,576 byte import cap
tools/build-vendor.mjs    # reproducible build, pinned version
```

`index.ts` exports one handler, `renderAssistantMessage`, which `register.tsx` hooks on `ui.render` for component `AssistantMessage` (the engine only accepts literal `on(...)` calls there; see `architecture.md` 4.0). It reads its feature flag, then returns `next(e)` untouched unless the reply holds a complete mermaid fence, so replies without mermaid cost one string scan. The view code receives plain data and callbacks, never `$`.

There is no render cache in v1: a render takes about 0.6 ms, so redraws re-render.

## 5. Vendored renderer

- Library: `beautiful-mermaid` 1.1.3 (MIT), ASCII path only, with `elkjs` replaced by a stub because the ASCII path never calls it.
- Measured: 82 KB bundle, about 0.6 ms per render in the spike.
- The build script pins the exact version, produces the bundle deterministically, and fails if the output exceeds 800 KB, leaving headroom under the engine's cap.
- The MIT license text and attribution live in `THIRD_PARTY_NOTICES.md` at the repo root.
- Known limits: the ELK stub is never reached on the ASCII path, so subgraphs (nested, with cross-boundary edges) render fine as boxes inside boxes. Types the renderer does not support throw "Invalid mermaid header" and fall back to code; the feature's own header check additionally keeps `xychart-beta` as code.

## 6. Failure handling

Any exception in detection, rendering or tree building is caught by `guard`, recorded against the `mermaid` feature id (deferred through `$.clock.after`, because the engine refuses state writes while a render hook draws), and the reply is drawn as the engine would draw it. Per the architecture, the user sees the failure only in the `/rich-ui` pane.

## 7. Testing

Automated (`claude plugin test`, terminal surface only):
- Detection: backtick and tilde fences, mixed case, several per reply, unclosed fence ignored, indented or nested fence ignored.
- Sanity: each supported header accepted, unknown header rejected, front matter and directives skipped, empty output rejected.
- Fit: author direction used when it fits, perpendicular direction used when it helps, raw fallback when neither fits (no pane note), unknown viewport falls back and posts the "terminal size unknown" note.
- View: text before and after is preserved, button toggles source, per-diagram state is independent, the first block of a reply carries the bullet and later blocks do not, summary rows go to the engine.
- Gating: feature off draws nothing different from the engine.
- Golden output: stored expected text for one flowchart, one sequence, one state, one class and one ER sample.

Manual, in a real terminal, before release:
- Diagram height and width on 80-column and wide windows, narrow and short windows.
- Light and dark themes: the diagram and the toggle row stay readable (done; owner checked).
- Streaming: no flicker or half diagram while the fence is open (done; yes).

## 8. Reserved for later: image output

The renderer sits behind one function, `renderDiagram(source, options)`, whose result is a tagged union. v1 has a single `text` variant (lines, width, height). An `image` variant (picture source, size in cells, alt text) can be added later without changing detection, fitting or the view's structure. For image output the `alt` text would be the text diagram, giving terminals that cannot draw images a built-in fallback. The follow-up order recommended by the spike is: improve the bundled rasterizer, then evaluate the `Raster` element, then offer host tools such as macOS `qlmanage` as an opt-in. None of this is built in v1.

## 9. Open items (closed by the live check)

1. Streaming: an unclosed fence stays raw and swaps to the diagram once closed, with no flicker. Yes.
2. Viewport: present for the transcript; the 6-row margin was fine and diagrams resize to fit. Yes.
3. Unicode-only output and styling: unicode-only works (`useAscii: false`); the line-versus-label dim styling was dropped in favor of the default text color (section 3.4).
4. ELK-dependent syntax: nothing falls back for that reason; subgraphs render (section 5).
5. Toggle redraw: only that message redraws. Yes.

Still open: the light-theme look of the diagram was confirmed by the owner; nothing else.

## 10. Evidence from the spikes

- Bare npm imports are refused; only relative files and `claude-code`. Any imported file over 1,048,576 bytes is rejected, so the version bundling ELK (1.5 MB) failed.
- The sandbox has no DOM, `process`, `require`, `Buffer`, `WebAssembly` or `queueMicrotask`. `URL`, `TextEncoder` and `structuredClone` exist.
- `beautiful-mermaid` ASCII output rendered flowchart, sequence, state, class and ER. Sample sizes: a 6-node flowchart is 45 rows by 26 columns top-down and 15 rows by 69 columns left-right; a 3-participant sequence diagram is 19 rows by 38 columns.
- A malformed body can render a bogus box without throwing, which is why the sanity checks exist.
- A `claude plugin test` of a `Markdown` + diagram + toggle tree passed on the terminal surface.
- Rejected renderers: `mermaid-ascii` (mangles labels, no sequence diagrams) and `mermaid-cli` (about 1 GB on a clean machine, partly estimated, and images draw only in kitty, Ghostty and iTerm2 3.5+).
