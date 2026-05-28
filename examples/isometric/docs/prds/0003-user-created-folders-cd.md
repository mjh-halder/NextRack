---
id: 0003
title: User-Created Folders in the Component Designer
status: done
created: 2026-05-26
labels: [component-designer, palette, folders, drag-and-drop]
---

# PRD 0003 — User-Created Folders in the Component Designer

## Problem Statement

As a NextRack user authoring my own Components in the Component
Designer, I want to organise the Shapes I create into folders of my
choosing — not just dump everything into a flat "User Components"
bucket that gets longer and harder to scan every time I add a new
Shape. Today, every Shape I create lands in one undifferentiated list,
and there is no way to group, name, or visually separate them — so as
soon as I have more than a handful of user Shapes, finding the one I
want becomes browsing instead of navigating.

I also want the folders I create to be visually distinct from the
system-shipped collections (General, Oracle, NetApp, …) so I can tell
at a glance which groups are part of the app and which I built
myself. And when I drag a Shape into a folder, I want the move to
behave like a normal file-manager move — single-highlight as I hover
candidate targets, no highlight when I'm hovering somewhere the move
would be a no-op (the Shape is already in that folder).

Finally, when I delete a folder I want clear reassurance that I'm only
removing the folder structure — not the Shapes that lived inside it.

## Solution

Introduce a **User-Created Folder** primitive in the Component
Designer palette. A user-created folder is an arbitrary named group
that lives as a sub-folder of the top-level "User Created" collection.
Other collections (system-shipped vendor groups) are not affected.

The Component Designer's plus-button becomes a small dropdown with two
entries — **New Component** (Cube icon) and **New Folder**
(Folder-Add icon) — instead of going straight into the Create-Shape
modal. New Folder opens a modal that asks for a name and produces a
folder. New Component continues to work exactly as before.

Each folder in the palette renders with one of two glyphs:

- System collections (those that ship with the app) → standard
  Folder icon.
- User-created folders → "Folder Shared" icon, so the two groups
  are unambiguous at a glance.

Inside the "User Created" section, user folders are nested **one level
deep** under the section header, and the Shapes inside a user folder
are nested **another level deeper** still. The indentation makes the
hierarchy visible without forcing the user to read the glyphs.

User folders can be **renamed** or **deleted** via a right-click
context menu on the folder row in the tree. Rename re-uses the same
modal as Create — only the submit-button label switches between
"Create Folder" and "Rename Folder". Delete opens a confirmation
modal that explicitly states the folder structure is removed but
the Components inside it are not — they return to the top level
of "User Created".

Shapes move into and out of user folders **exclusively via drag and
drop** in the palette. While dragging:

- Only one drop-target node can be highlighted at a time — bubbling
  artefacts that previously caused both the inner user folder AND
  the outer "User Created" parent to highlight simultaneously are
  suppressed.
- If the dragged Shape is already in the candidate target folder,
  the drop-target highlight does not appear and a drop is a no-op.

The previously-existing "User Components" collection label is renamed
to **"User Created"** for naming consistency between the section and
the user-folder concept.

To remove a recurring authoring pitfall where a new Shape could end
up with an empty icon slot, every new Shape now ships with the
**Cube** glyph as its Main IconEntry. The Inspector's Main IconEntry
cannot be removed — its remove button is disabled when more than
one Icon exists, and hidden entirely when the Shape has just one
Icon. Adding additional Icons via the "+" button also defaults the
new entry to the Cube glyph, so an Icon row is never empty.

## User Stories

1. As a NextRack user, I want to create my own named folders inside the Component Designer palette, so that I can organise the Shapes I author by my own taxonomy instead of being stuck with a flat list.
2. As a NextRack user, I want the plus-button to offer a clear choice between "New Component" and "New Folder", so that I don't have to remember a separate path for folder management.
3. As a NextRack user, I want the New Folder action to open a modal asking for a name, so that the folder is named the moment it's created.
4. As a NextRack user, I want a folder-name validation that prevents two user folders with the same name (case-insensitive), so that I don't accidentally end up with confusing duplicates.
5. As a NextRack user, I want the folder modal to be re-used for renaming — same layout, only the submit button reading "Rename Folder" — so that the UI for naming a folder is consistent across create and edit.
6. As a NextRack user, I want my user folders to sit underneath the existing "User Created" section, so that the palette layout stays predictable and system collections remain at their own level.
7. As a NextRack user, I want user-created folders to render with a distinct icon (Folder Shared) compared to system collections (regular Folder), so that I can tell at a glance which folders are mine.
8. As a NextRack user, I want the dropdown items in the plus-button to carry meaningful icons (Cube for New Component, Folder-Add for New Folder), so that the action is recognisable before I read the label.
9. As a NextRack user, I want user folders to appear visually indented underneath the "User Created" section, so that the parent–child relationship is clear from layout alone.
10. As a NextRack user, I want Components inside a user folder to be indented one level deeper than the folder, so that the hierarchy is consistent and scannable.
11. As a NextRack user, I want a right-click on a user folder to open a context menu with Rename and Delete entries, so that folder management is reachable without dedicated buttons in the tree row.
12. As a NextRack user, I want the Delete entry in the context menu to use the danger-style colour, so that the destructive action stands out.
13. As a NextRack user, I want to drag a user-generated Shape onto a user folder and have it move into that folder, so that organising Shapes feels like ordinary file-manager interaction.
14. As a NextRack user, I want to drag a user-generated Shape back onto the "User Created" header to move it out of any folder, so that I can promote it back to top-level without an inspector dialog.
15. As a NextRack user, I want the highlighted drop-target to flicker between only one node at a time as I move the cursor across nested folders, so that the visual cue is unambiguous about where the drop will land.
16. As a NextRack user, I want the drop highlight to disappear when I'm hovering over the folder the Shape already lives in, so that the UI signals that drop would be a no-op.
17. As a NextRack user, I want the move to apply immediately on drop with no confirmation step, so that re-organising feels lightweight.
18. As a NextRack user, I want my user folders to persist across reloads, so that organisation work isn't lost between sessions.
19. As a NextRack user, I want Shapes I have created to remember which user folder they belong to across reloads, so that the hierarchy survives without re-organising every session.
20. As a NextRack user, I want the Delete-Folder confirmation modal to tell me explicitly that the Components inside are NOT deleted — only the folder structure is removed — so that I'm not afraid to clean up empty / outdated folders.
21. As a NextRack user, I want the Delete-Folder modal to count and surface how many Components will be moved back to "User Created", so that I know the impact before I confirm.
22. As a NextRack user, I want deleted-folder Components to fall back into the top level of "User Created", so that nothing gets lost or hidden.
23. As a NextRack user, I want the dropdown / context-menu interactions to dismiss on outside click and on Escape, so that they don't get in my way once I've made my choice.
24. As a NextRack user, I want every new Component I create to ship with the Cube glyph as its main Icon, so that I never see a Shape rendered as a coloured rectangle with no recognisable mark.
25. As a NextRack user, I want every additional Icon I add inside a Shape to also default to the Cube glyph, so that a freshly-added Icon row is never empty.
26. As a NextRack user, I want the Main IconEntry's remove button to disappear when the Shape has only one Icon, so that I can't put the Shape into a state where it has no Icons at all.
27. As a NextRack user, I want the Main IconEntry's remove button to be disabled (but visible) when the Shape has multiple Icons, so that I understand the Main entry is protected without the row layout shifting.
28. As a NextRack user, I want the legacy "User Components" header to be renamed to "User Created" across the Component Designer AND the System Designer palette, so that the section name matches the User Folder concept and stays consistent in both designers.
29. As a NextRack user, I want the Component Designer's row-selection highlight to live as an inset accent that does not shift the row's text indent, so that selecting a Component (especially inside an indented user folder) doesn't make the label jump.
30. As a NextRack user, I want the "No icon" / dash entry to be removed from the Icon selector catalog in the Icon editor, so that I can't accidentally pick an empty Icon.

## Implementation Decisions

### Module shape

- **`shape-store` (deep, testable)** — owns the User-Folder primitive.
  Pure CRUD + localStorage persistence. The user-folder API extends
  the existing `shape-store` module with:
  - `UserFolder` type: `{ id, name, createdAt }`.
  - `listUserFolders()` → reads the current list from localStorage.
  - `createUserFolder(name)` → generates a stable id from the name +
    timestamp, persists, dispatches the change event.
  - `renameUserFolder(id, name)` → in-place update, persists.
  - `deleteUserFolder(id)` → removes from list, persists. **Does
    not** mutate any Shape's `userFolderId` — re-assignment is the
    caller's responsibility (the Component Designer's delete-confirm
    handler).
  - `userFolderNameExists(name, ignoreId?)` → case-insensitive
    look-up, used by both Create and Rename modals to gate the
    submit button.
  - `USER_FOLDERS_CHANGED_EVENT` constant + automatic dispatch on
    every mutation.

  The store does **not** know about Shape registry or rendering —
  only about the folder list itself.

- **`shape-registry`** — `ShapeDefinition` gains an optional
  `userFolderId` field. Only meaningful for user-generated Shapes;
  ignored for built-ins and system-collection Shapes.

- **`component-tree`** — owns the palette presentation:
  - Replaces the single `onCreateClick` callback with two:
    `onCreateComponent` and `onCreateFolder`. Renders the plus-button
    as a dropdown when either is provided.
  - New `userFolders: UserFolderDescriptor[]` config field so empty
    folders still render in the tree.
  - New `onRenameUserFolder` / `onDeleteUserFolder` callbacks for
    the right-click context menu on user folders.
  - New `onMoveShapeToUserFolder(shapeId, folderId | null)` callback
    for drag-and-drop; `null` = move back to top-level inside
    "User Created".
  - `USER_CREATED_COLLECTION` constant — the public name of the
    section. Item collection field uses this exact string for
    user-generated Shapes.
  - Internal module-level `dragSourceFolderId` state: set on
    `dragstart` of a user-generated leaf, consulted by drop targets
    to decide whether to highlight + accept. Cleared on `dragend`.

- **`component-designer`** — wires the UI:
  - `showFolderModal({ mode, folderId?, initialName? })` — single
    modal used for both Create and Rename. The submit-button label
    switches between "Create Folder" and "Rename Folder". Validates
    name length and uniqueness via `userFolderNameExists`.
  - `onMoveUserShape(shapeId, folderId | null)` — updates
    `ShapeDefinition.userFolderId`, persists the registry, rebuilds
    the palette.
  - `onDeleteUserFolderConfirm(folderId)` — opens the delete-confirm
    modal, counts contained Shapes, on confirmation re-assigns those
    Shapes to top-level THEN deletes the folder.
  - `onCreateShape` — every new Shape ships with a Cube Main
    IconEntry by construction.
  - `addIcon` (+ button in the inspector's Icon list) — seeds new
    entries with `iconId: 'cube'`.
  - `removeIcon` — defense-in-depth: returns false if asked to remove
    a Main IconEntry, regardless of UI state.
  - Removes the `simplified2D` flag plumbing from the Component
    Designer UI (the toggle was obsolete).
  - Removes the "Show admin controls" toggle from the inspector
    header.

- **`inspector` (Icon list row)** — Remove button is **hidden** when
  the Shape has only one IconEntry, and **disabled** for the Main
  entry when ≥2 entries exist. The "No icon" placeholder option is
  dropped from the Icon selector catalog.

- **`palette` (System Designer)** — `User Components` → `User Created`
  string update for consistency with the CD palette.

### Token / Schema

```ts
interface UserFolder {
    id: string;        // "uf-{slug}-{base36-timestamp}"
    name: string;
    createdAt: number; // Date.now()
}

interface ShapeDefinition {
    // ... existing fields ...
    userFolderId?: string;  // matches UserFolder.id when set
}
```

### Persistence

- **User folders:** localStorage key `nextrack-user-folders-v1`,
  JSON array of `UserFolder`. Written on every mutation.
- **Shape → folder assignment:** lives on `ShapeDefinition.userFolderId`
  inside the existing `nextrack-shape-registry-v2` storage. Written
  by `saveRegistryToStorage()` whenever a move/delete handler runs.

### Re-render trigger

The Component Designer's palette rebuild (`buildPalettePanel`) reads
both stores on every rebuild — there is no diff/patch pipeline. Move,
create, rename, and delete handlers all call `buildPalettePanel()`
explicitly. A dedicated `nextrack:user-folders-changed` event exists
for external listeners but is not consumed inside the Component
Designer itself (since the designer owns the mutations).

### Backward compatibility

- Existing user-generated Shapes have no `userFolderId` — they render
  at the top level of "User Created" automatically.
- The System Designer's palette path (`palette.ts`) was updated to
  use the new "User Created" label so the section name matches the
  Component Designer; existing placed Components are unaffected
  because they reference shape ids, not collection names.
- Existing Shapes whose registry entries pre-date the cube-default
  guarantee continue to render with whatever icon they have; the
  cube-default only applies to newly-created Shapes and newly-added
  IconEntries going forward.

### Out-of-flow concern: CSS and selection highlight

The Component Designer's row-selection style was migrated from
`border-left + padding-left` to an `inset box-shadow` accent. The
border-left approach forced a per-state padding adjustment that
broke the nested padding for user-folder leaves; the inset
box-shadow paints without taking layout space, so the label x
position stays fixed regardless of selection or nesting depth.

## Testing Decisions

### What makes a good test here

A good test exercises the **external behaviour** of the
user-folder API — given a folder name, what does
`createUserFolder` return? Does `listUserFolders` round-trip the
write? Does `userFolderNameExists` respect the `ignoreId` parameter
for rename-collision detection? Does `deleteUserFolder` leave the
list shorter by one entry without touching Shape definitions?

Tests should NOT assert on:
- Specific id-generation algorithm details (the id is opaque outside
  the module).
- localStorage key naming (the storage strategy can change).
- DOM rendering behaviour (the tree, modals, and event wiring are
  shallow UI glue tested by visual inspection in the app).

### Modules to test

- **`shape-store` User-Folder API** — the deep CRUD module. Unit
  tests against an in-memory localStorage shim:
  - List/Create round-trip
  - Rename in-place: updates name, leaves id stable
  - Delete: removes entry, leaves other entries untouched
  - `userFolderNameExists`: case-insensitive match, respects
    `ignoreId`
  - IDs are unique and stable across reads
  - Dispatches `nextrack:user-folders-changed` on each mutation

Tree-D&D, modal UI, and Shape re-assignment in the Component
Designer's delete-confirm handler are out of test scope — they are
shallow compositions over the deep store and are easier to verify
visually in the app.

### Prior art

PRD 0001 introduced Vitest in this repo with
`src/color-derivation.test.ts` as the reference test file. The new
`shape-store` user-folder tests follow the same shape: ESM, Node
environment, fixture-driven, `expect`-based assertions on pure
function output, no jsdom.

## Out of Scope

- **Folder hierarchies deeper than one level.** A user folder cannot
  contain other user folders. Re-evaluate if real-world usage shows
  > ~20 user folders crammed at one level.
- **Folders for system-collection Shapes** (General, Oracle, …). The
  user-folder concept applies only to user-generated Shapes.
- **A separate "Folder of folders" / Workspace concept.** Folder
  membership is a single string id on the Shape; no nesting.
- **Bulk move / multi-select drag.** One Shape per drop.
- **Cross-collection drag.** A user-generated Shape can move between
  user folders and top-level inside "User Created"; it cannot be
  dragged into a system collection from the Component Designer.
- **Folder-level metadata** beyond name (description, colour, sort
  order). Folders are name + id + creation timestamp only.
- **Drag-and-drop within a folder for re-ordering.** Order inside a
  folder follows the Component-tree's default sort.
- **Folder management for the System Designer's palette.** The SD
  palette presents the same Shape list grouped by `collection`; user
  folders are a CD-only authoring affordance.
- **Migration / renaming of existing per-vendor system collections.**
  Only the "User Components" → "User Created" rename is in scope;
  vendor collection names are untouched.

## Further Notes

- The Cube glyph is the existing `cube` entry from the custom-icon
  catalog (not the Carbon `cube` icon). They look similar; the
  custom entry was already present and avoids adding a fifth Carbon
  icon to the catalog purely for this default.
- The plus-button dropdown re-uses the existing `nr-palette-ctx`
  menu styling — same primitive as the existing "View options"
  overflow menu. The new entries gain an icon slot
  (`nr-ctx-menu__icon`) that's already supported by the
  stylesheet.
- The drag highlight is a 1px dashed outline + background tint on
  the target's row. The single-highlight invariant is enforced
  imperatively (clear all other `--drop-target` classes before
  adding the new one) rather than via CSS exclusion — DOM
  bubbling makes the CSS-only approach unreliable across nested
  folders.
- The Delete-Folder modal counts contained Shapes at confirmation
  time, so a user re-assigning Shapes via D&D between opening the
  modal and confirming sees the updated count next time they
  re-open it.
- The icon-orientation work (front-face flip fix, simplified-2D
  toggle removal, Display-Preview HUD mode-sync, default
  bottom-middle label position, base-plate hidden on bottom-chamfer,
  Azure colour tune, top-bar Admin / Help menu cleanup,
  fit-to-screen wiring, grid cell-size input, multi-select layout
  HUD threshold, SD wheel-zoom step) is **not** part of this PRD —
  those are separate small fixes committed alongside but tracked at
  the commit level, not as PRDs.
