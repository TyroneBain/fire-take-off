# Apple HIG reference and Fire Take Off design contract
Updated 2026-10-30. This is a curated, linked interpretation of Apple's public Human Interface Guidelines (HIG), **not a complete offline copy** or a claim to contain every Apple rule. Before each significant design task, consult the live official HIG and check recent changes.

## Primary official sources
- HIG home and updates: https://developer.apple.com/design/human-interface-guidelines/
- Design principles (simplicity, flexibility, craft): https://developer.apple.com/design/human-interface-guidelines/design-principles
- Designing for macOS: https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/
- Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Toolbars: https://developer.apple.com/design/human-interface-guidelines/toolbars
- Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Focus and selection: https://developer.apple.com/design/human-interface-guidelines/focus-and-selection
- Color: https://developer.apple.com/design/human-interface-guidelines/color
- Foundations index (typography, dark mode, materials, motion, SF Symbols, privacy, writing): https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple Design Resources: https://developer.apple.com/design/resources/

Also review the current official HIG pages for typography, buttons, menus, search fields, alerts, undo/redo, keyboard shortcuts, drag and drop, progress indicators, feedback, onboarding, and writing when relevant. Do not assume an old design screenshot is current guidance.

## Principles to apply to this browser-based desktop estimating tool
1. **Drawing first:** large legible PDF workspace; tool panels subordinate to drawing; no decorative chrome that steals precision space.
2. **Recognizable macOS-inspired structure:** leading collapsible navigation/selection sidebar, restrained contextual toolbar, consistent command locations, understandable selection/focus. Adapt the principles to a web app; don't pretend browser chrome is native AppKit.
3. **Hierarchy and typography:** use a small coherent type scale, legible numbers/units, clear primary/secondary emphasis, concise language; avoid tiny dense labels and gratuitous all-caps.
4. **Color semantics:** separate selection, inclusion, exclusion, pending review, error and zone categories; do not communicate status through color alone; ensure light/dark/high-contrast legibility.
5. **Precise inputs:** cursor/pan/zoom anchoring, hit targets, visible focus, keyboard navigation, reversible edits, undo where supported, context menus with accessible alternatives.
6. **Honest state:** explicitly distinguish saved vs draft, reviewed vs unchecked, detected vs manually added, scaled vs unscaled, and displayed vs exportable quantity. Never fake a global Save.
7. **Progressive disclosure:** show the active task first; expose advanced settings locally; avoid multiple competing panels or duplicate totals.
8. **Responsive desktop density:** test 1280×800, 1440×900 and 1920×1080; resizing, zoom, long item names, empty/loading/error states, and scroll. Don't use a fixed screenshot as the acceptance test.
9. **Accessibility:** keyboard-only completion of critical tasks; logical tab/focus order; meaningful control labels; screen-reader semantics; zoom/text scaling; contrast tests and reduced-motion consideration.
10. **Product integrity:** design must preserve counts, corrections, zone allocation, revision state, file privacy and exports. Visual polish never substitutes for recognition accuracy.

## Required deliverables for every UX change
- Problem, user task, official Apple HIG links and specific rationale; distinguish Apple guidance from original product judgment.
- Before/after task flow and states (empty, loading, saving, saved, failure, pending review, disabled, unscaled).
- One annotated desktop proposal, not a broad redesign unless requested.
- Keyboard/pointer/accessibility checks and layouts at three viewport sizes.
- Explicit no-regression list for counting, correction persistence, zones and export.
- Independent visual and usability validation with screenshots or browser observations; never call a mockup production-tested.

## Scope and priority
Countfire user workflows can be observed through permitted normal UI access, but copy neither proprietary source/assets nor distinctive visual expression. Aim for Apple-level clarity and independent product identity. The vector recognition and QA benchmark agents have priority; the designer stays read-only/advisory until lead assigns a bounded UI task.

## Maintenance
Check Apple's HIG change log and links before major design decisions; record the review date and any changed guidance. Apple's HIG evolves; this file is a working source index and implementation checklist, not 'all Apple information'.
