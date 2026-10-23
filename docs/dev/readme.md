# rich-ui: README and User Docs

Status: draft for review. This document designs the GitHub landing page (`README.md`) and the one user-docs page it links to (`docs/usage.md`). It contains the working copy for both. Nothing here is final until every command has been run on a clean Claude Code profile after v1 works.

## 1. Goals

- A visitor understands what rich-ui does in the first screen: pitch, a moving demo, then install.
- From landing page to a rendered diagram takes two commands.
- Toggling and uninstalling are each one line.
- The page stays honest: it states only what ships today, and its limits sit in one short block.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Length | One screen: pitch, demo, install, use, uninstall, plus short roadmap and footer |
| Tone | Plain and confident, light personality |
| Badges | None |
| Demo | Animated GIF: a diagram appears, then the source toggle. You record it once v1 works |
| Roadmap | A short section, labelled as planned and not promised |
| Caveats | One short "Requirements" block under Install |
| User docs | One page, `docs/usage.md`: usage, troubleshooting, FAQ |
| Org / repo / plugin | `emergentai` / `claude-code-rich-ui` / `rich-ui` |
| License | MIT (already in the repo) |

## 3. Pitch

Direction from you: allude to a terminal that feels like a proper GUI. Candidates, in order of preference:
1. Your terminal, with the polish of a GUI.
2. GUI-grade output, still in your terminal.
3. A terminal that feels like a GUI.
4. Claude Code in your terminal, with the feel of a proper GUI.

The working README uses candidate 1; the final choice is yours. Whatever is chosen, the line directly under it must say plainly what the product is, so the pitch is not carrying that job alone. The body must also not overclaim: v1 draws text diagrams, not pictures.

## 4. README structure and working copy

````markdown
# rich-ui

**Your terminal, with the polish of a GUI.**

rich-ui makes Claude Code's output richer and easier to read: diagrams drawn
instead of dumped as code, and more on the way. Every feature has its own
switch.

![rich-ui drawing a mermaid diagram in Claude Code](docs/assets/demo.gif)

## Install

In Claude Code:

```
/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui
```

Answer `y` to add the marketplace, then pick a scope. That's it: the next time
Claude replies with a mermaid diagram, you'll see it drawn.

**Requirements:** a terminal session of Claude Code (not the desktop app),
version 2.1.287 or later, tested on <version recorded at release>. The mods API
is early access and can change between Claude Code releases.

## Use

Type `/rich-ui` to open the feature list. Press a row to turn it on or off. Your
choices are remembered.

| Feature | What it does |
|---|---|
| Mermaid diagrams | Draws mermaid diagrams as text diagrams, with one press to see the source |

## Uninstall

```
/plugin uninstall rich-ui
```

Your saved on/off choices stay put in case you reinstall.

## Coming next

Planned, not promised: rendered tables, a markdown preview pane, a context bar,
inline edit diffs, and image-quality diagrams.

## Docs and help

[Usage, troubleshooting and FAQ](docs/usage.md) · [Report an issue](../../issues)

MIT licensed. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
````

Notes on the copy:
- The tagline line and first paragraph are the whole pitch; nothing above the demo except the title.
- The shell form (`claude plugin install ...`) goes in `docs/usage.md`, not the README, to keep one install command on the landing page.
- "Answer `y`, then pick a scope" matches what the engine shows on first install of a marketplace plugin.
- The uninstall line and "choices stay put" depend on checks listed in section 7.

## 5. `docs/usage.md` outline

1. **Using rich-ui:** opening `/rich-ui`, what the checkboxes mean, that toggles affect new output only and persist across sessions.
2. **Install from a shell:** `claude plugin install rich-ui --marketplace emergentai/claude-code-rich-ui`.
3. **Mermaid diagrams:** what is drawn (flowchart, sequence, state, class, ER); that an unsupported type, an unfinished reply, or a diagram that does not fit stays as a code block; how the source toggle works.
4. **Troubleshooting:** my diagram stays as code (check the type, check the feature is on, check the `/rich-ui` pane for a note; terminal too small or size unknown); a feature shows a warning in the pane (what it means, how to report it); `/rich-ui` is not found (plugin not installed or Claude Code too old; use `/plugin` to check); behavior after a Claude Code upgrade (early-access API; report with your version).
5. **FAQ:** Does it work in the desktop app or VS Code (no, terminal only for now)? Does it send my data anywhere (no, everything runs locally, no network, no telemetry)? Why text and not images (works in every terminal with no extra install; image diagrams are planned)? How do I remove it (uninstall command)?
6. **Reporting a problem:** what to include (Claude Code version, rich-ui version from the pane footer, the diagram source).

Each troubleshooting entry is two to four lines: symptom, cause, fix.

## 6. Assets and repo hygiene

- `docs/assets/demo.gif`: you record it after v1. Target a short loop (under about 15 seconds), a readable terminal size and theme, and a file size small enough for the README to load quickly. Until then the README carries a clearly marked placeholder image, and it is not published.
- `THIRD_PARTY_NOTICES.md`: the vendored renderer's MIT license text and attribution (see `mermaid-feature.md` section 5).
- `LICENSE`: already MIT.
- Issue link: the README points at the repository's issues page; an issue template is out of scope for v1.

## 7. Verification before the README is final

Run on a clean Claude Code profile (no prior marketplaces, no rich-ui store data):
1. The install line works exactly as written and the prompts match the README's wording.
2. A mermaid diagram in a reply is drawn without any further setup.
3. `/rich-ui` opens the list and toggles work.
4. `/plugin uninstall rich-ui` is the correct removal command and removes the plugin.
5. After reinstalling, saved choices are as the README claims (confirm what happens to stored data on uninstall; reword the README to match reality).
6. The minimum version claim (2.1.287) is checked, and the tested version is recorded.
7. Every link in the README and `docs/usage.md` resolves.

## 8. Open items

1. Final pitch choice (section 3).
2. Exact uninstall syntax and what survives it (checks 4 and 5 above).
3. The tested Claude Code version to print in Requirements (to be filled at release).
4. Whether the GIF can show the diagram clearly at a README-friendly size.
