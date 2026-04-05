#!/usr/bin/env python3
"""
Chapter 10: Agent Negotiation Architecture

Designs a bi-directional system where two LLM agents (Engine Agent and Game Agent)
negotiate API contracts. Covers three implementation approaches with trade-offs,
the negotiation protocol, message schemas, and integration with existing infrastructure.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import (
    BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE,
    ACCENT_PURPLE, ACCENT_RED, TEXT_PRIMARY, TEXT_SECONDARY,
)

pdf = BookPDF("Ch.10 Agent Negotiation")
pdf.chapter_cover(10, "Agent Negotiation", "Bi-Directional LLM Architecture for SDK Evolution")

# ── 10.1 The Problem ───────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("The Problem: SDK Evolution at AI Speed")
pdf.body_text(
    "When Vision Hill Climb patches a game, it sometimes suggests imports that don't exist "
    "in the engine SDK. For example, the patch generator added 'drawTouchOverlay' from "
    "@engine/render -- but that function lives in @engine/touch. The static engine manifest "
    "helps, but the deeper issue is that games and the engine evolve at different speeds."
)
pdf.body_text(
    "Today's workflow is one-directional: games consume the SDK, and when something is "
    "missing, a human files an issue. But with AI-driven game generation, we need the "
    "feedback loop to close automatically. When a game agent discovers it needs a function "
    "that doesn't exist, it should be able to REQUEST that function from an engine agent, "
    "NEGOTIATE the API contract, and have the engine agent IMPLEMENT it -- all without "
    "human intervention for routine cases."
)

pdf.info_box(
    "Core Insight",
    "This is not pub/sub. It is a turn-based contract negotiation between two specialized "
    "agents, each with domain authority. The Game Agent knows WHAT it needs. The Engine "
    "Agent knows HOW to implement it safely. Neither should unilaterally decide the API.",
    ACCENT_BLUE,
)

# ── 10.2 Agent Roles ──────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Agent Roles and Authority")

pdf.section_title("Game Agent")
pdf.bullet_list([
    "Domain: game.js source code, ECS patterns, gameplay logic",
    "Authority: decides WHAT functionality is needed and WHY",
    "Tools: /api/compile, /api/eval, /api/specs, game source files",
    "Constraint: cannot modify engine modules directly",
    "Identity: speaks for a specific game (e.g., 'the Tetris game agent')",
])

pdf.section_title("Engine Agent")
pdf.bullet_list([
    "Domain: @engine/* module source code, export signatures, SDK design",
    "Authority: decides HOW to implement, WHERE to put it, and what SIGNATURE to use",
    "Tools: engine module files, /api/engine/manifest, /api/regression",
    "Constraint: must not break existing games (regression test gate)",
    "Identity: speaks for the entire SDK (e.g., 'the @engine maintainer')",
])

pdf.info_box(
    "Separation of Concerns",
    "The Game Agent never proposes implementation details for the engine. "
    "The Engine Agent never modifies game source code. Each agent has WRITE access "
    "only to its own domain and READ access to the other's.",
    ACCENT_GREEN,
)

# ── 10.3 Negotiation Protocol ─────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Negotiation Protocol")

pdf.body_text(
    "Every negotiation follows a strict state machine with 6 states. Each transition "
    "produces a structured message that both agents and the UI can parse."
)

pdf.section_title("State Machine")
pdf.code_block(
    "PROPOSE --> COUNTER --> ACCEPT --> IMPLEMENT --> VERIFY --> CLOSED\n"
    "   |          |                       |            |\n"
    "   +--REJECT--+                       +--REJECT----+\n"
    "   |                                               |\n"
    "   +--ESCALATE (human review needed)---------------+",
)

pdf.section_title("State Definitions")
pdf.bullet_list([
    "PROPOSE: Game Agent describes what it needs. Includes: function name suggestion, "
    "use case, expected signature, which module it thinks it belongs in, code context.",
    "COUNTER: Engine Agent proposes an alternative. Maybe the function exists under a "
    "different name, or belongs in a different module, or needs a different signature. "
    "Includes: rationale, proposed signature, module placement.",
    "ACCEPT: Both agents agree on the contract. The accepted message includes the final "
    "function signature, module, parameter types, return type, and usage example.",
    "IMPLEMENT: Engine Agent writes the implementation. Must pass: (1) unit-level sanity "
    "check, (2) full regression test against all 35 catalog games.",
    "VERIFY: Game Agent compiles its game with the new function. Must pass: (1) compile "
    "succeeds, (2) game runs without runtime errors, (3) the function produces expected behavior.",
    "CLOSED: Both agents confirm. The negotiation record is archived. The engine manifest "
    "is automatically updated.",
])

pdf.section_title("Rejection and Escalation")
pdf.body_text(
    "At any state, an agent can REJECT (with rationale) which returns to PROPOSE for "
    "a new attempt. After 3 rejections, the negotiation auto-escalates to ESCALATE state, "
    "which flags it for human review. Escalation reasons include: conflicting design "
    "philosophies, breaking changes to existing APIs, or ambiguous requirements."
)

# ── 10.4 Message Schema ──────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Message Schema")

pdf.code_block(
    '{\n'
    '  "negotiation_id": "uuid",\n'
    '  "turn": 3,\n'
    '  "state": "COUNTER",\n'
    '  "from": "engine_agent",\n'
    '  "to": "game_agent",\n'
    '  "timestamp": "2026-04-05T22:00:00Z",\n'
    '  "payload": {\n'
    '    "function_name": "drawTouchOverlay",\n'
    '    "module": "@engine/touch",\n'
    '    "signature": "drawTouchOverlay(ctx, actions, opts)",\n'
    '    "rationale": "Already exists in @engine/touch, not render",\n'
    '    "params": [\n'
    '      {"name": "ctx", "type": "CanvasRenderingContext2D"},\n'
    '      {"name": "actions", "type": "string[]"},\n'
    '      {"name": "opts", "type": "{fontSize?, color?}"}\n'
    '    ],\n'
    '    "returns": "void",\n'
    '    "usage_example": "import {drawTouchOverlay} from \'@engine/touch\';",\n'
    '    "breaking_changes": false\n'
    '  },\n'
    '  "context": {\n'
    '    "game": "snake",\n'
    '    "source_excerpt": "// render system, line 145-160",\n'
    '    "current_imports": ["@engine/core", "@engine/render"]\n'
    '  }\n'
    '}',
)

pdf.body_text(
    "Every message is self-contained: it includes enough context for either agent to "
    "resume the conversation without loading the full history. The 'context' field carries "
    "game-specific information that the Engine Agent needs to understand the request."
)

# ── 10.5 Three Implementation Approaches ─────────────────────────────────
pdf.add_page()
pdf.section_title("Implementation Approaches")

pdf.section_title("Option A: Single-Server, DB-Backed")
pdf.body_text(
    "All negotiation happens inside game-factory. A new SQLite table stores negotiation "
    "messages. Two Claude API calls per turn -- one with the Engine Agent system prompt, "
    "one with the Game Agent system prompt. The server orchestrates the conversation."
)
pdf.bullet_list([
    "Pros: simplest to build, fits existing SQLite + Express patterns, single deployment",
    "Pros: negotiations are fast (no network hops between agents)",
    "Pros: server can enforce turn order and validation rules",
    "Cons: both agents share the same process -- no true isolation",
    "Cons: a single Claude API key handles both roles (context bleed risk)",
    "Cons: harder to scale if negotiation volume grows",
])

pdf.code_block(
    "// Pseudo-code for single-server orchestration\n"
    "async function negotiate(proposal) {\n"
    "  let state = 'PROPOSE';\n"
    "  let messages = [proposal];\n"
    "  \n"
    "  while (state !== 'CLOSED' && state !== 'ESCALATE') {\n"
    "    if (state === 'PROPOSE' || state === 'ACCEPT') {\n"
    "      // Engine Agent's turn\n"
    "      const reply = await claude.messages.create({\n"
    "        system: ENGINE_AGENT_PROMPT,\n"
    "        messages: formatHistory(messages),\n"
    "      });\n"
    "      messages.push(parse(reply));\n"
    "    } else {\n"
    "      // Game Agent's turn\n"
    "      const reply = await claude.messages.create({\n"
    "        system: GAME_AGENT_PROMPT,\n"
    "        messages: formatHistory(messages),\n"
    "      });\n"
    "      messages.push(parse(reply));\n"
    "    }\n"
    "    state = messages.at(-1).state;\n"
    "    saveToDb(messages.at(-1));\n"
    "  }\n"
    "}",
)

pdf.add_page()
pdf.section_title("Option B: Dual-Agent with Claude Agent SDK")
pdf.body_text(
    "Two separate Claude Agent SDK processes, each with their own tools, system prompts, "
    "and file access. They communicate through a shared negotiation API (REST or message "
    "queue). Each agent runs as an independent process."
)
pdf.bullet_list([
    "Pros: true agent isolation -- each has its own context window and tools",
    "Pros: Engine Agent can have write access to engine/ files, Game Agent to game files",
    "Pros: agents can run on different machines or containers",
    "Pros: natural fit for the Claude Agent SDK's process model",
    "Cons: more complex deployment (two processes, shared state)",
    "Cons: higher latency (network round-trips between agents)",
    "Cons: need a coordination layer to manage turn order",
])

pdf.code_block(
    "// Engine Agent (separate process)\n"
    "const engineAgent = new Agent({\n"
    "  model: 'claude-sonnet-4-6',\n"
    "  system: ENGINE_AGENT_PROMPT,\n"
    "  tools: [\n"
    "    readEngineModule,    // read any src/engine/*.js\n"
    "    writeEngineModule,   // write to src/engine/*.js\n"
    "    runRegression,       // POST /api/regression\n"
    "    getManifest,         // GET /api/engine/manifest\n"
    "    respondToGame,       // POST negotiation message\n"
    "  ],\n"
    "});\n"
    "\n"
    "// Game Agent (separate process)\n"
    "const gameAgent = new Agent({\n"
    "  model: 'claude-sonnet-4-6',\n"
    "  system: GAME_AGENT_PROMPT,\n"
    "  tools: [\n"
    "    readGameSource,      // read game.js\n"
    "    compileGame,         // POST /api/compile\n"
    "    proposeToEngine,     // POST negotiation message\n"
    "    verifyFunction,      // compile + run with new import\n"
    "  ],\n"
    "});",
)

pdf.add_page()
pdf.section_title("Option C: GitHub-Native (Issues + Actions)")
pdf.body_text(
    "The negotiation happens as GitHub issue comments. The Game Agent files an issue on "
    "the engine repo with a structured proposal. A GitHub Action triggers the Engine Agent "
    "to respond. All negotiation is visible as issue comments. Implementation happens as "
    "PRs that must pass regression CI."
)
pdf.bullet_list([
    "Pros: fully transparent -- every negotiation is a public issue thread",
    "Pros: leverages existing GitHub integration (issues, PRs, Actions, CI)",
    "Pros: human can intervene at any point by commenting on the issue",
    "Pros: natural audit trail, searchable, linkable",
    "Cons: slow (GitHub Actions have cold start, API rate limits)",
    "Cons: GitHub Actions minutes cost money at scale",
    "Cons: harder to enforce structured message format in free-text comments",
    "Cons: requires GitHub App or fine-grained PAT for both repos",
])

pdf.code_block(
    "# Workflow: Game Agent files issue\n"
    "gh issue create --repo agadabanka/game-engine \\\n"
    "  --title '[API Request] drawTouchOverlay in @engine/render' \\\n"
    "  --body '$(cat negotiation-proposal.json)' \\\n"
    "  --label 'agent-negotiation'\n"
    "\n"
    "# GitHub Action triggers Engine Agent on issue creation\n"
    "on:\n"
    "  issues:\n"
    "    types: [opened, commented]\n"
    "    labels: [agent-negotiation]\n"
    "\n"
    "# Engine Agent responds via issue comment\n"
    "gh issue comment $ISSUE --body '$(cat counter-proposal.json)'",
)

# ── 10.6 Comparison Matrix ───────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Comparison Matrix")

pdf.body_text("Trade-off analysis across key dimensions:")

# Manual table using body_text
pdf.set_font("Helvetica", "B", 10)
pdf.cell(0, 8, "Dimension          | Single-Server | Agent SDK | GitHub-Native", ln=True)
pdf.set_font("Helvetica", "", 9)
rows = [
    "Complexity          |  Low          |  High     |  Medium",
    "Isolation           |  None         |  Full     |  Full",
    "Latency             |  ~30s/turn    |  ~45s/turn|  ~2min/turn",
    "Transparency        |  DB only      |  Logs     |  Public issues",
    "Human intervention  |  Manual       |  Manual   |  Natural (comment)",
    "Deployment          |  1 process    |  2+ procs |  GitHub Actions",
    "Cost per negotiation|  ~$0.10       |  ~$0.15   |  ~$0.10 + GHA mins",
    "Scalability         |  Limited      |  Good     |  Rate-limited",
    "Existing infra fit  |  Excellent    |  Moderate |  Good",
]
for row in rows:
    pdf.cell(0, 6, row, ln=True)

pdf.body_text("")
pdf.info_box(
    "Recommendation",
    "Start with Option A (single-server) for the MVP. The negotiation volume is low "
    "(~1-5 per game generation run), and the existing game-factory server already has "
    "all the infrastructure (SQLite, Claude API, engine files, regression endpoint). "
    "Migrate to Option B (Agent SDK) when negotiation complexity justifies true isolation -- "
    "for example, when the Engine Agent needs to run multi-file refactors or when "
    "negotiations span multiple sessions.",
    ACCENT_GREEN,
)

# ── 10.7 Database Schema ────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Database Schema")

pdf.code_block(
    "CREATE TABLE negotiations (\n"
    "  id TEXT PRIMARY KEY,\n"
    "  game_name TEXT NOT NULL,\n"
    "  status TEXT DEFAULT 'active',  -- active|closed|escalated\n"
    "  function_name TEXT,\n"
    "  target_module TEXT,\n"
    "  final_signature TEXT,\n"
    "  turns INTEGER DEFAULT 0,\n"
    "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n"
    "  closed_at DATETIME,\n"
    "  trigger TEXT  -- 'vision-hc' | 'eval' | 'manual'\n"
    ");\n"
    "\n"
    "CREATE TABLE negotiation_messages (\n"
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n"
    "  negotiation_id TEXT REFERENCES negotiations(id),\n"
    "  turn INTEGER NOT NULL,\n"
    "  from_agent TEXT NOT NULL,  -- 'game' | 'engine'\n"
    "  state TEXT NOT NULL,\n"
    "  payload JSON NOT NULL,\n"
    "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n"
    ");\n"
    "\n"
    "CREATE TABLE engine_changes (\n"
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n"
    "  negotiation_id TEXT REFERENCES negotiations(id),\n"
    "  module TEXT NOT NULL,\n"
    "  change_type TEXT,  -- 'add_export' | 'modify_export' | 'new_module'\n"
    "  diff TEXT,\n"
    "  regression_passed BOOLEAN,\n"
    "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n"
    ");",
)

# ── 10.8 Integration Points ─────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Integration with Existing Systems")

pdf.section_title("Vision Hill Climb Trigger")
pdf.body_text(
    "When the patch generator suggests an import that fails compilation, instead of "
    "silently reverting, it can trigger a negotiation:"
)
pdf.code_block(
    "// In runVisionIteration(), after compile failure:\n"
    "if (compileError.includes('No matching export')) {\n"
    "  const missing = parseMissingExport(compileError);\n"
    "  await startNegotiation({\n"
    "    trigger: 'vision-hc',\n"
    "    gameName,\n"
    "    functionName: missing.name,\n"
    "    suggestedModule: missing.module,\n"
    "    sourceContext: source.slice(errorLine-5, errorLine+5),\n"
    "  });\n"
    "}",
)

pdf.section_title("Engine Manifest as Source of Truth")
pdf.body_text(
    "The /api/engine/manifest endpoint becomes the ground truth for all negotiations. "
    "After every successful IMPLEMENT -> VERIFY cycle, the manifest auto-updates because "
    "it reads from the actual engine files. No manual manifest maintenance needed."
)

pdf.section_title("Regression Gate")
pdf.body_text(
    "No engine change ships without passing /api/regression. The Engine Agent must call "
    "this endpoint after implementing and include the result in its IMPLEMENT message. "
    "If regression fails, the negotiation returns to COUNTER state automatically."
)

pdf.section_title("Compiler Bug Linking")
pdf.body_text(
    "Successful negotiations auto-create a compiler_bug record (status: fixed) with "
    "links to the game that triggered it. This maintains the existing bug tracking "
    "infrastructure and provides a complete audit trail."
)

# ── 10.9 Safeguards ─────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Safeguards and Constraints")

pdf.bullet_list([
    "Max 6 turns per negotiation (3 round-trips). After that, auto-escalate.",
    "Engine Agent cannot delete existing exports (only add or modify with backward compat).",
    "Game Agent cannot request changes to another game's code.",
    "All engine changes must pass regression before IMPLEMENT is accepted.",
    "Breaking changes (modifying existing signatures) require human approval.",
    "Rate limit: max 3 active negotiations per game per hour.",
    "Budget cap: max $1.00 in Claude API costs per negotiation (tracked via token counts).",
    "Negotiation history is immutable -- no editing past messages.",
])

pdf.section_title("Anti-Patterns to Prevent")
pdf.bullet_list([
    "Infinite counter-proposal loops: hard cap at 3 COUNTERs before escalation",
    "Feature creep: Engine Agent should not expand scope beyond the original request",
    "Duplicate negotiations: check if a similar negotiation is active or recently closed",
    "Phantom exports: every proposed function must have at least one concrete use case",
    "Module sprawl: prefer adding to existing modules over creating new ones",
])

# ── 10.10 Future: Multi-Agent Ecosystem ──────────────────────────────────
pdf.add_page()
pdf.section_title("Future: Multi-Agent Ecosystem")

pdf.body_text(
    "The two-agent negotiation model is a stepping stone to a broader multi-agent "
    "architecture where specialized agents handle different aspects of the game "
    "creation pipeline:"
)

pdf.bullet_list([
    "Engine Agent: owns SDK modules, implements new APIs, runs regression",
    "Game Agent: owns game.js, knows gameplay patterns, requests features",
    "Sprite Agent: owns asset generation (already exists as sprite-factory)",
    "Eval Agent: owns quality scoring, knows what 'good' looks like",
    "Publish Agent: owns deployment, GitHub repos, title cards",
])

pdf.body_text(
    "Each agent has a well-defined domain and communicates through structured "
    "negotiation protocols. The game-factory server acts as the message broker "
    "and persistence layer. This is not a monolithic orchestrator -- each agent "
    "can initiate conversations with any other agent."
)

pdf.info_box(
    "Design Principle",
    "Agents should be NARROW and AUTHORITATIVE. A narrow agent with deep domain "
    "knowledge makes better decisions than a broad agent with shallow knowledge. "
    "The Engine Agent should know everything about the SDK and nothing about game "
    "design. The Game Agent should know everything about ECS patterns and nothing "
    "about module internals.",
    ACCENT_PURPLE,
)

# ── 10.11 Research References ────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Research References")

pdf.bullet_list([
    "Multi-Agent Debate (Du et al., 2023): LLMs improve through structured debate. "
    "Our negotiation protocol is a constrained form of debate with domain authority.",
    "AutoGen (Wu et al., 2023): Microsoft's multi-agent conversation framework. "
    "Demonstrates that agents with distinct roles produce better code than single agents.",
    "ChatDev (Qian et al., 2023): Software development via multi-agent collaboration. "
    "CEO/CTO/Programmer/Tester roles mirror our Engine/Game/Eval/Publish agents.",
    "Generative Agents (Park et al., 2023): Agents with persistent memory and identity. "
    "Our agents need negotiation history but not long-term personality.",
    "Constitutional AI (Bai et al., 2022): Self-improvement through structured critique. "
    "The COUNTER state is a form of constitutional critique.",
    "CAMEL (Li et al., 2023): Communicative agents for mind exploration. "
    "Role-playing between agents with inception prompting.",
    "MetaGPT (Hong et al., 2023): Multi-agent framework with SOPs. "
    "Our state machine is a lightweight SOP for API negotiation.",
])

# ── Generate PDF ─────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(__file__), "ch10.pdf")
pdf.output(out)
print(f"Chapter 10 generated: {out}")
