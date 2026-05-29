# Local PRD Tracker

Lightweight Markdown-based replacement for an external issue tracker. Each PRD
is one file in this folder, numbered `NNNN-slug.md`, with YAML frontmatter at
the top.

## Frontmatter schema

```yaml
---
id: 0001
title: Short human-readable title
status: ready-for-agent
created: 2026-05-26
labels: []
---
```

## Status vocabulary

| Status | Meaning |
|---|---|
| `draft` | Author still iterating; not ready for an implementer. |
| `ready-for-agent` | Reviewed and ready to be picked up for implementation. |
| `in-progress` | Implementation in progress. |
| `done` | Shipped; left here as history. |
| `superseded` | Replaced by a newer PRD; link to the successor in the body. |

## Index

| ID   | Title                                                  | Status            |
|------|--------------------------------------------------------|-------------------|
| 0001 | Color Adjustment Developer Tool                        | `done`            |
| 0002 | 2D Icon-Only View and Icon Rendering Developer Tool    | `done`            |
| 0003 | User-Created Folders in the Component Designer         | `done`            |
| 0004 | Multilayer Component — Main-Icon Invariant & 2D Parity | `done`            |
| 0005 | Central Icon-Render Resolver — Family/Surface/Theme    | `ready-for-agent` |
| 0006 | Edge Routing — Native Manhattan and 2D/Iso bbox Parity | `done`            |
| 0007 | System Designer — Area Independence, Tree-Drop Extraction, Group-Move Link Waypoints | `ready-for-agent` |
| 0008 | System Designer — Display Settings Hub (Grid Visibility, Opacity, Pitch, Size) | `done`            |
