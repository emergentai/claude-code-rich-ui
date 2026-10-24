import { expect, test } from 'claude-code/testing'

import { fitDiagram, flipDirection } from './fit'
import type { DiagramResult } from './render'

function fake(width: number, height: number): DiagramResult {
  return {
    kind: 'text',
    lines: Array.from({ length: height }, () => 'x'.repeat(width)),
    width,
    height,
  }
}

const VIEWPORT = { columns: 80, rows: 30 }

test('the authored direction is used when it fits', async () => {
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(20, 10))
  expect(lines?.length).toBe(10)
})

test('the other direction is tried when the first does not fit', async () => {
  const render = (source: string) =>
    /^graph LR/m.test(source) ? fake(60, 8) : fake(30, 50)
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, render)
  expect(lines?.length).toBe(8)
})

test('nothing is returned when neither direction fits', async () => {
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(200, 100))
  expect(lines).toBe(null)
})

test('non-flowcharts are rendered once and never flipped', async () => {
  let calls = 0
  const lines = fitDiagram('sequenceDiagram\n A->>B: hi', VIEWPORT, () => {
    calls++

    return fake(200, 100)
  })
  expect(lines).toBe(null)
  expect(calls).toBe(1)
})

test('an unsupported header is never rendered', async () => {
  let calls = 0
  const lines = fitDiagram('gantt\n title x', VIEWPORT, () => {
    calls++

    return fake(10, 5)
  })
  expect(lines).toBe(null)
  expect(calls).toBe(0)
})

test('the viewport margins are respected', async () => {
  // columns 80 minus 4 = 76 wide, rows 30 minus 6 = 24 tall
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(76, 24))?.length).toBe(24)
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(77, 24))).toBe(null)
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(76, 25))).toBe(null)
})

test('flipDirection swaps top-down and left-right', async () => {
  expect(flipDirection('graph TD\nA-->B')).toBe('graph LR\nA-->B')
  expect(flipDirection('flowchart LR\nA-->B')).toBe('flowchart TD\nA-->B')
  expect(flipDirection('flowchart BT\nA-->B')).toBe('flowchart LR\nA-->B')
  expect(flipDirection('graph\nA-->B')).toBe('graph LR\nA-->B')
  expect(flipDirection('sequenceDiagram\nA->>B: hi')).toBe(null)
})

test('the other direction is not tried when the diagram overflows both ways', async () => {
  let calls = 0
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, () => {
    calls++

    return fake(200, 100)
  })
  expect(lines).toBe(null)
  expect(calls).toBe(1)
})

test('a result is kept per source and window size', async () => {
  const source = 'graph TD\n Cache1-->Cache2'
  const first = fitDiagram(source, { columns: 100, rows: 40 })
  expect(first).not.toBe(null)
  expect(fitDiagram(source, { columns: 100, rows: 40 })).toBe(first)
  expect(fitDiagram(source, { columns: 100, rows: 41 })).not.toBe(first)
})

// A large four-subgraph flowchart. Drawing it sideways takes seconds and froze
// the session on every redraw; it must now be given up on after one drawing, and
// asking again must be instant.
const BIG = `flowchart TB
    subgraph Client["Frontend (React + Vite)"]
        UI["AgentChat / ChatInterface<br/>ConversationSidebar"]
        AUTH["useAuth + authConfig<br/>(MSAL, Entra ID)"]
        CS["chatService.ts<br/>(SSE stream)"]
        UI --> CS
        UI --> AUTH
        AUTH -->|"access token"| CS
    end

    subgraph Backend["Backend (ASP.NET Core, Container Apps)"]
        JWT["JwtBearer auth<br/>+ scope policy"]
        EP["Program.cs endpoints"]
        SVC["AgentFrameworkService"]
        CRED{"Credential"}
        JWT --> EP --> SVC --> CRED
        CRED -->|"OBO (user identity)"| PC
        CRED -->|"Managed identity"| PC
        PC["AIProjectClient<br/>ProjectResponsesClient"]
    end

    subgraph Foundry["Microsoft Foundry"]
        AG["console-sense-ai agent<br/>(v2 Agents API)"]
        CONV[("Server-managed<br/>conversations")]
        WS["web_search tool"]
        AG --> WS
        AG <--> CONV
    end

    subgraph Dev["Agent & Eval Tooling"]
        INS["agent/instructions.md"]
        SYNC["scripts/sync_agent.py"]
        EV["evals/mlflow_eval.py"]
        SC["evals/score.py"]
        ML[("MLflow<br/>mlflow.db / mlruns")]
        INS <-->|"pull / push"| SYNC
        EV --> SC
        EV --> ML
        SC --> ML
    end

    CS -->|"POST /api/chat/stream"| JWT
    CS -->|"GET /api/conversations<br/>/api/agent, /api/files"| JWT
    EP -.->|"SSE tokens + citations"| CS
    PC -->|"Responses API"| AG
    SYNC <-->|"agent version"| AG
    EV -->|"queries agent"| AG
`

test('a very large flowchart stays code without a slow second drawing', async () => {
  const viewport = { columns: 120, rows: 50 }
  let started = Date.now()
  expect(fitDiagram(BIG, viewport)).toBe(null)
  expect(Date.now() - started < 1500).toBe(true)

  started = Date.now()
  expect(fitDiagram(BIG, viewport)).toBe(null)
  expect(Date.now() - started < 50).toBe(true)
})
