# rich-ui: Mermaid Feature

Status: draft for review. Depends on `architecture.md` (feature contract, gating, state). Evidence comes from two feasibility spikes, summarized in section 10.

## 1. What it does

When Claude's reply contains a complete fenced mermaid block, the transcript shows a text diagram drawn with box-drawing characters instead of the raw code. A small control under the diagram reveals the original source. Anything the feature cannot draw is left exactly as Claude Code would show it today.

Feature metadata (for the registry and pane):
- id `mermaid`, name "Mermaid diagrams", description "Draw mermaid diagrams as text diagrams", `defaultEnabled: true`.

## 2. Scope

In v1:
- Terminal surface only.
- Fences in assistant replies only (the `AssistantMessage` transcript component).
- Diagram types: flowchart (`graph` / `flowchart`), `sequenceDiagram`, `stateDiagram` / `stateDiagram-v2`, `classDiagram`, `erDiagram`.
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

Available size: width is the pane or transcript width (`columns` from the render props or viewport); height is the visible terminal rows minus a margin of 6 rows, which leaves room for the prompt, status line and surrounding text. The margin is one named constant so it can be adjusted after the manual terminal checks in section 7.
1. Render in the author's direction. If it fits, use it.
2. If it does not fit and the type has a direction (flowchart, state), render again in the perpendicular direction (top-down to left-right, and the reverse). If that fits, use it.
3. Otherwise leave the original code block.
Sequence, class and ER diagrams have no direction switch in v1, so they go from step 1 to step 3.
If the viewport size is unknown, leave the code block rather than guess. In that case the feature also posts a status note, "Diagrams left as code: terminal size unknown", which the `/rich-ui` pane shows on the Mermaid row (see `architecture.md` section 4.5). The note appears nowhere else.

### 3.4 Presentation

- The diagram is drawn as monospace `Text` lines inside a `Box`, using the terminal's default colors. Box-drawing and arrow characters are drawn dim; labels use the default tone. This keeps it correct in light and dark themes.
- Text before and after the fence stays as `Markdown`, so the rest of the reply looks normal.
- Under each diagram sits one `Button` acting as a toggle: "show source". Pressing it replaces the diagram with the original mermaid code, in a `Code` element, and the button changes to "show diagram". Pressing again swaps back. The diagram and the source are never shown at the same time. Nothing else is offered.
- The terminal has no switch element, so the toggle is a `Button` whose label reflects the current state.
- Which view each diagram shows is held in session state, keyed by message id plus the diagram's index in that message, and resets with the session. The default view is the diagram.

### 3.5 Toggling the feature

When the feature is off, its `ui.render` hook passes straight through and the engine draws the reply unchanged. Toggling affects new output only.

## 4. Components

```
hooks/features/mermaid/
  index.ts          # Feature object: metadata + register()
  detect.ts         # finds complete fences in a reply's text
  sanity.ts         # header and output checks (3.2)
  fit.ts            # direction and size decisions (3.3)
  render.ts         # DiagramRenderer interface + text renderer using the vendored bundle
  view.tsx          # builds the tree: Markdown, diagram, button, source
  *.test.ts(x)      # tests beside each file
hooks/vendor/
  beautiful-mermaid.js   # bundled, committed, under the 1,048,576 byte import cap
scripts/build-vendor.mjs  # reproducible build, pinned version
```

`register` adds one hook through the gated `on`: `ui.render` for component `AssistantMessage`. If the reply holds no complete mermaid fence, the hook returns `next(e)` untouched, so replies without mermaid cost one string scan.

Rendering results are cached in memory by a hash of the diagram source, direction and width, so redraws (scrolling, resizing) do not re-render.

## 5. Vendored renderer

- Library: `beautiful-mermaid` 1.1.3 (MIT), ASCII path only, with `elkjs` replaced by a stub because the ASCII path never calls it.
- Measured: 82 KB bundle, about 0.6 ms per render in the spike.
- The build script pins the exact version, produces the bundle deterministically, and fails if the output exceeds 800 KB, leaving headroom under the engine's cap.
- The MIT license text and attribution live in `THIRD_PARTY_NOTICES.md` at the repo root.
- Known limits: constructs that need the stubbed layout engine (subgraphs, XY charts) are untested and fall back to the code block if the renderer throws.

## 6. Failure handling

Any exception in detection, rendering or tree building is caught by the gate, recorded against the `mermaid` feature id, and the reply is drawn as the engine would draw it. Per the architecture, the user sees the failure only in the `/rich-ui` pane.

## 7. Testing

Automated (`claude plugin test`, terminal surface only):
- Detection: backtick and tilde fences, mixed case, several per reply, unclosed fence ignored, indented or nested fence ignored.
- Sanity: each supported header accepted, unknown header rejected, front matter and directives skipped, empty output rejected.
- Fit: author direction used when it fits, perpendicular direction used when it helps, raw fallback when neither fits, unknown viewport falls back.
- View: text before and after is preserved, button toggles source, per-diagram state is independent.
- Gating: feature off draws nothing different from the engine.
- Golden output: stored expected text for one flowchart, one sequence, one state, one class and one ER sample.

Manual, in a real terminal, before release:
- Diagram height and width on 80-column and wide windows, narrow and short windows.
- Light and dark themes: dim tone stays readable.
- Streaming: no flicker or half diagram while the fence is open.

## 8. Reserved for later: image output

The renderer sits behind one function, `renderDiagram(source, options)`, whose result is a tagged union. v1 has a single `text` variant (lines, width, height). An `image` variant (picture source, size in cells, alt text) can be added later without changing detection, fitting or the view's structure. For image output the `alt` text would be the text diagram, giving terminals that cannot draw images a built-in fallback. The follow-up order recommended by the spike is: improve the bundled rasterizer, then evaluate the `Raster` element, then offer host tools such as macOS `qlmanage` as an opt-in. None of this is built in v1.

## 9. Open items to verify during implementation

1. Does a streaming reply re-run the `AssistantMessage` hook with growing text, and does an unclosed fence stay stable? (Unobserved in the spike.)
2. Is `viewport` height always present for the transcript, and what margin feels right?
3. Can the vendored renderer be set to unicode-only output, and can box-drawing characters be separated from label text for dim styling (a character-class pass over each line is the fallback plan)?
4. Behavior of subgraphs and other ELK-dependent syntax with the stub in place.
5. Whether swapping the diagram for the source (and back) redraws only that message and keeps the scroll position stable.

## 10. Evidence from the spikes

- Bare npm imports are refused; only relative files and `claude-code`. Any imported file over 1,048,576 bytes is rejected, so the version bundling ELK (1.5 MB) failed.
- The sandbox has no DOM, `process`, `require`, `Buffer`, `WebAssembly` or `queueMicrotask`. `URL`, `TextEncoder` and `structuredClone` exist.
- `beautiful-mermaid` ASCII output rendered flowchart, sequence, state, class and ER. Sample sizes: a 6-node flowchart is 45 rows by 26 columns top-down and 15 rows by 69 columns left-right; a 3-participant sequence diagram is 19 rows by 38 columns.
- A malformed body can render a bogus box without throwing, which is why the sanity checks exist.
- A `claude plugin test` of a `Markdown` + diagram + toggle tree passed on the terminal surface.
- Rejected renderers: `mermaid-ascii` (mangles labels, no sequence diagrams) and `mermaid-cli` (about 1 GB on a clean machine, partly estimated, and images draw only in kitty, Ghostty and iTerm2 3.5+).
