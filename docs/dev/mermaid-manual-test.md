# Manual test: mermaid diagram types

Run from the repo root, in a real terminal (not the desktop app):

```
cd tools && npm install && npm run build:vendor && cd ..
claude --plugin-dir .
```

Then paste this prompt:

> Reply with exactly these mermaid code blocks, one per diagram type, each in its own
> ```mermaid fence, with a one-line label above each. Do not change the diagram text.

followed by the diagrams below. Or paste each diagram yourself in a fence.

Expected: every block is drawn as text with a `show source` line above it, except the
"must stay code" ones.

## Should be drawn (existing types, check for regressions)

```mermaid
graph TD
  A[Start] --> B{OK?}
  B -->|yes| C[Go]
  B -->|no| D[Stop]
  subgraph S
    C --> E[Done]
  end
```

```mermaid
sequenceDiagram
  participant A
  participant B
  A->>B: hello
  B-->>A: hi
  Note over A,B: done
```

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Run: go
  Run --> [*]
```

```mermaid
classDiagram
  class Animal {
    +String name
    +eat()
  }
  Animal <|-- Dog
```

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    int id PK
    string name
  }
```

## Should be drawn (new types)

```mermaid
pie title Pets
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
```

```mermaid
xychart-beta
  title "Sales"
  x-axis [jan, feb, mar, apr]
  y-axis "Revenue" 0 --> 100
  bar [30, 55, 70, 90]
  line [30, 55, 70, 90]
```

```mermaid
C4Context
  title System context
  Person(user, "User", "Uses the app")
  System(app, "App", "Does the thing")
  Rel(user, app, "uses")
```

```mermaid
architecture-beta
  group api(cloud)[API]
  service db(database)[DB] in api
  service srv(server)[Server] in api
  srv:R --> L:db
```

## Must stay code (no renderer)

```mermaid
gantt
  title Plan
  dateFormat YYYY-MM-DD
  section A
  Task :a1, 2024-01-01, 30d
```

```mermaid
mindmap
  root((x))
    a
    b
```

```mermaid
timeline
  title T
  2020 : a
  2021 : b
```

## Checklist

1. Each "should be drawn" block shows a text diagram and a `show source` line; pressing
   it shows the code, `show diagram` goes back.
2. The three "must stay code" blocks look exactly like stock Claude Code code blocks.
3. Narrow the terminal to about 60 columns: the pie and XY chart (about 65 wide) fall
   back to code instead of wrapping badly; widen it and they draw again.
4. `/rich-ui`, turn Mermaid off: every block goes back to code; on again: they redraw.
5. Light and dark themes: the lines are readable in both.
6. Regression eye-check against the old renderer: state diagram (the start marker is
   known to be missing), ER and class diagrams look sensible.
7. Malformed input stays code and does not crash the reply, e.g. a `pie` fence with no
   rows, or an `xychart-beta` with `bar [` unclosed.
