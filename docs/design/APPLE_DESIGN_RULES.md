# Permanent UI/UX rules from the Apple study

User instruction, 2026-10-29: “please stick to the apple info - save it remember it - for design and ui ux”. Read this file before every Fire Take Off design or interface change. Apply the findings to interaction structure, not merely colours, fonts and rounded corners.

## Source of truth

The retained [research report](PHASE_1_UI_UX_RESEARCH.md#apple-learn-the-structure-not-the-surface-decoration) and [source register](SOURCE_REGISTER.md#apple-human-interface-guidelines) record what was accessed and its limits. Use Apple's actual guidance as the design foundation; distinguish it from our application-specific interpretation. Native macOS guidance is not automatically a web implementation specification. Do not use visionOS toolbar advice to justify a desktop layout. Do not invent an Apple mandate for a particular panel side, breakpoint or colour.

## Principles to apply in every design decision

| Retained principle / Apple source | Fire Take Off application rule |
|---|---|
| Hierarchy, grouping and alignment — [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Visually group a tool selector with its frequently used options and associated working information. The relationship must be apparent before clicking. Avoid making users scan across the drawing to connect a mode to its controls. |
| Logical grouping and stable access to frequent commands — [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Separate project-wide commands from active-tool commands. Put the primary next action in the active work area. Do not scatter the same task across unrelated bars/panels or duplicate commands without a demonstrated need. |
| Document focus and supplemental inspection — [Windows](https://developer.apple.com/design/human-interface-guidelines/windows) | Preserve the drawing as the working surface. Distinguish an active tool's work panel from occasional selection properties; a panel that contains the whole counting workflow is not merely a passive inspector. |
| Collection navigation — [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Keep drawing/discipline navigation recognisable, searchable and independent of the active estimating task. Adapt/collapse deliberately while preserving context. |
| Desktop precision and familiar interaction — [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) | Support accurate pointer input, keyboard operation, predictable resizing and uninterrupted work. Preserve the active tool, selection, draft and drawing view when navigating. |
| Readable hierarchy — [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Use legible system typography, a restrained weight/size hierarchy and aligned numeric columns. Do not shrink labels to rescue a crowded layout. |
| Clear visual meaning — [Icons](https://developer.apple.com/design/human-interface-guidelines/icons), [Color](https://developer.apple.com/design/human-interface-guidelines/color) | Use consistent original icons and labels for specialist tools. Separate action, selection, category and status roles. Never communicate important state with colour alone. |
| Adaptation and accessibility — [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Maintain contrast, visible focus and distinguishable states. Test larger text and reduced motion. Graphite is the user's current preference; dark-only styling is not an Apple requirement. Preserve technical drawing legibility. |
| Feedback and keyboard conventions — [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators), [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards/) | Show honest progress, recoverable errors and actual save state. Respect familiar shortcuts and provide discoverable alternatives. Avoid claiming persistence or recognition from a demonstration. |

The right-hand column is our design policy derived from the study and user feedback, not verbatim Apple guidance. Progressive disclosure and professional workflow support also draw on the NNGroup sources in the retained register; do not attribute all UX concepts solely to Apple.

## Specific correction to retain

Tyrone has **not approved the current layout**. He identified that Count/Measure/Zone/Note sit at the top left while their working information appears far to the right. Prior A Compact work improved canvas width and inspector stability but did not resolve this task separation. Do not present its recommendation as settled or ask for approval of the unchanged arrangement again.

Next prototype refinement must address this relationship directly: evaluate a coherent tool/work panel with the mode selector, primary action, options and relevant list close together. Keeping the inspector on the right does not justify leaving its task selectors across the screen. Do not blindly move every global command to the right; group by task and scope. Preserve the user's visual identity and drawing priority while evaluating the resulting task flow.

## Design review before presenting another revision

Trace one complete Count, Measure and Zone task: tool choice → setup → drawing action → feedback → correction. Identify where the user's attention and pointer must travel at each step. Check that the selected mode and next action are obvious; controls have clear scope; frequent actions remain nearby; and occasional details do not dominate the working list. Evaluate this at1280,1440 and1920, with keyboard use and panel collapse/restore.

Canvas width, screenshots and passing code tests are insufficient to establish UX quality. Record observed interaction behaviour separately from design judgment and actual user-test results. Validate Countfire workflow fidelity separately; Apple provides the interaction-design foundation, not authority to invent extra estimating steps.

Production code/calculations/saved data remain gated. Catalogue remains deferred. This file records a permanent project instruction, not approval of any particular revised layout.

## Access note

This consolidation uses the previously recorded Apple study. A2026-10-29 re-open of Toolbars through the web reader returned a JavaScript shell; its Markdown link failed with unsupported content-type. Neither failure is counted as new research evidence. The earlier source register retains its original access descriptions.

## Implementation response — prototype only

The [task-panel revision](TASK_PANEL_REVIEW.md) now groups four tool selectors with their local controls, removes the distant strip/extra Select mode, hides unrelated tabs and reduces default explanation text. Tests and screenshots support those bounded observations. This addresses the recorded defect in the prototype; it does not replace user review or establish perfect UX, production approval or Countfire workflow parity.
