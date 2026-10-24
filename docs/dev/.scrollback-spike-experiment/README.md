# Scrollback spike experiment (not shipped)

A throwaway mod that wraps the result of a long Bash call with a button, and opens the
whole output in a pane with scrolling, line numbers and a copy button. It exists to settle
feasibility questions for [`../scrollback-spike.md`](../scrollback-spike.md); it is not a
rich-ui feature, is not listed in the registry and is not loaded by `hooks/register.tsx`.

Kept in a dot-folder so the repository's own `npm test` does not run these tests as part of
rich-ui.

```
claude plugin test docs/dev/.scrollback-spike-experiment
claude --plugin-dir <repo>/docs/dev/.scrollback-spike-experiment    # by hand
```
