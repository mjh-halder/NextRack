# Scope rules

Work only in this project folder.

Do not modify anything outside this folder.
Do not suggest changes to shared library code or monorepo root config.
Treat all external folders as read-only.

Allowed:
- src/**
- style.css
- package.json only if strictly necessary

Forbidden:
- ../packages/**
- ../other examples/**
- ../root workspace config

Before making changes:
1. list the files you want to edit
2. explain why
3. keep changes minimal and local

If a requested feature would require changes outside this folder, stop and explain that first.

# Product Goal

This project is being evolved from the existing `examples/isometric` demo into a graphical modeling tool for data centers.

The target capabilities will be introduced in phases:

- MVP: visual modeling of components and connections with editable properties
- V1: validation and compatibility checks
- V2: hardware catalog, concrete product mapping, and suggestions

Always optimize for incremental progress toward this roadmap.
Do not invent features or abstractions that are not needed for the current phase.

---

# Scope Boundaries

Work only inside this project folder.

Do not modify anything outside this folder.
Do not suggest or perform changes to shared library code, monorepo root config, workspace structure, or unrelated demos.

Treat everything outside this folder as read-only.

Allowed:
- `src/**`
- `style.css`
- `package.json` only if strictly necessary
- new files only if they remain local to this folder and clearly support the current phase

Forbidden:
- shared package code
- root build configuration
- unrelated refactors
- introducing new frameworks without explicit need
- moving this demo into a new architecture unless requested

---

# Delivery Principles

Prefer the smallest change that cleanly advances the current goal.

Always prefer:
- local changes over cross-cutting changes
- simple data structures over elaborate abstractions
- explicit code over premature generalization
- stable extension points over deep refactors
- domain model clarity over UI cleverness

Do not optimize for theoretical elegance.
Optimize for maintainability, testability, and incremental extension.

---

# Phase Discipline

Before implementing anything, determine which phase the request belongs to:

- MVP = modeling and editing
- V1 = validation and rule checks
- V2 = catalog and product intelligence

Do not pull V1 or V2 concepts into MVP unless explicitly requested.

Examples:
- In MVP, do not build a rule engine unless asked.
- In MVP, do not build vendor catalog infrastructure unless asked.
- In MVP, do not introduce advanced recommendation logic.
- In V1, do not overbuild a full product catalog system if a small rules layer is sufficient.
- In V2, reuse stable structures from earlier phases instead of redesigning the app.

If a requested change risks pulling in future-phase complexity, say so explicitly and propose the simplest version that fits the current phase.

---

# Change Process

For every non-trivial task, follow this sequence:

1. Analyze first. Do not change files yet.
2. Name the files you want to change.
3. Explain why each file needs to change.
4. Keep the change set minimal.
5. Implement only what was agreed.
6. Summarize what changed and what remains out of scope.

If additional files become necessary during implementation, stop and explain why before continuing.

---

# File Change Limits

Default rule: change as few files as possible.

Target:
- small task: 1-3 files
- medium task: up to 5 files
- larger changes only if explicitly requested

Do not casually restructure folders, rename files, or move code unless there is a strong reason.

---

# Architecture Guidance

Treat the application as a graph editor with a domain model, not just as a drawing canvas.

Keep these concerns separated as much as practical:

- visual layer: rendering, layout, interaction
- domain layer: components, ports, connections, metadata
- validation layer: compatibility and completeness checks
- catalog layer: vendor and product data

Do not tightly couple domain logic to rendering logic unless there is a clear short-term reason.

However, do not create a full architecture upfront.
Only extract structure when the current code clearly benefits from it.

---

# Simplicity Rules

Do not introduce any of the following unless clearly justified by the current task:

- generic plugin systems
- complex inheritance hierarchies
- heavy state management libraries
- backend services
- databases
- advanced caching
- event buses
- elaborate rule DSLs
- speculative configuration systems

Prefer plain TypeScript objects and straightforward functions.

---

# Domain Modeling Rules

When adding new functionality, prefer stable, explicit domain concepts.

Examples of acceptable concepts:
- component
- connection
- port
- kind
- vendor
- model
- bandwidth
- medium
- encryption
- compatibility issue
- suggestion

Avoid vague or overengineered concepts unless required.

When in doubt, choose names and structures that support later validation and catalog work without requiring a rewrite.

---

# UX Rules

For UI changes:
- prefer functional, clear UI over decorative UI
- do not redesign the whole interface unless asked
- preserve existing working interactions where possible
- add only the UI necessary for the current task
- avoid introducing visual complexity before the underlying data model is stable

---

# Data Rules

When introducing data structures:
- make them explicit
- keep them serializable
- prefer formats that can later be saved/loaded as JSON
- avoid hidden state inside UI-only objects when domain data is intended to persist

Any structure introduced in MVP should not block later validation or catalog integration.

---

# Validation Against Future Complexity

Before finalizing a solution, check:

- Does this make the MVP harder to evolve into V1?
- Does this create unnecessary coupling?
- Does this force a rewrite for catalog support later?
- Is this more generic than the roadmap currently needs?

If yes, simplify.

---

# Interaction Style

Do not rush to code.

If the request is ambiguous, do not invent product decisions.
State the ambiguity briefly and choose the narrowest reasonable implementation.

Do not add “nice to have” features unless explicitly requested.
Do not silently expand scope.
Do not refactor broadly just because it seems cleaner.

Be pragmatic, conservative, and incremental.

---

# Output Expectations

For each implementation task, provide:

- short analysis
- files to change
- concise implementation plan
- the change itself
- short note on why this approach is roadmap-safe

Keep responses focused and practical.

# Mandatory Pre-Implementation Checklist

Before coding, answer briefly:

- What phase is this in: MVP, V1, or V2?
- What is the smallest useful implementation?
- Which files will change?
- What is explicitly out of scope?
- Why is this safe for the roadmap?

# Current UI Style Target

Current style target:
Carbon-inspired enterprise UI for a technical infrastructure modeling tool.

Keywords:
- enterprise
- structured
- technical
- calm
- compact
- modern

Not:
- playful
- flashy
- decorative
- consumer app style

# Use Carbon Design System strictly.

Requirements:
	•	Use official Carbon React components from @carbon/react wherever a matching component exists.
	•	Do not create custom-styled replacements for existing Carbon components.
	•	Use Carbon design tokens for color, type, spacing, layering, and states.
	•	Follow Carbon interaction and accessibility patterns.
	•	Keep custom CSS to layout-only concerns unless no Carbon token/component exists.
	•	If a requested UI pattern is not covered by Carbon, implement the smallest possible custom extension in a way that visually matches Carbon.
	•	Do not invent a new design language.

Implementation sources of truth:
	•	official Carbon React components
	•	official Carbon tokens/theming model
	•	official Carbon Figma kit for visual alignment