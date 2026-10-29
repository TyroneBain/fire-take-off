# Design research source register

Accessed 29 October 2026. Findings below are paraphrases. Public documentation describes the publisher's product/principles, not Fire Take Off acceptance evidence. No third-party interface assets are included in the wireframes.

## Apple Human Interface Guidelines

Entry point: [HIG](https://developer.apple.com/design/human-interface-guidelines/). The web reader often returned a JavaScript-only page; browser rendering was used where noted. Platform-specific native guidance is interpreted for a desktop web application, not copied as a web standard.

| Topic / actual source | Access and finding |
| --- | --- |
| [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) | Browser-rendered main content. Sustained precision work, keyboard/pointer interaction, flexible windows, information density and personalisation. |
| [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Indexed official content. Collection navigation, shallow hierarchy, hide/collapse when space is limited; avoid critical actions at the bottom. |
| [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Indexed official content. Frequent commands, logical grouping and stable placement. Platform-specific guidance is labelled; visionOS vertical-toolbar advice is not general desktop evidence. |
| [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Indexed official content. Hierarchy, grouping, alignment and adaptation while retaining consistency. No universal numeric desktop spacing system prescribed for our app. |
| [Windows](https://developer.apple.com/design/human-interface-guidelines/windows) | Indexed official macOS content. Document focus, resizing, supplementary inspection and status areas. |
| [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Browser-rendered main content. Follow appearance preferences, support legibility in both modes, semantic colours; dark-only is exceptional. White image softening is a consideration, not a mandate. |
| [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Browser-rendered main content. Readability, weight/hierarchy, minimal typeface variation, adaptable text; system font access rather than bundling font files. Native point-size tables are not CSS requirements. |
| [Color](https://developer.apple.com/design/human-interface-guidelines/color) | Browser-rendered main content. Consistent meaning, semantic roles, different appearances/lighting, additional non-colour cues. |
| [Icons](https://developer.apple.com/design/human-interface-guidelines/icons) | Browser-rendered main content after loading. Simple metaphors, consistent weight, optical alignment, vector assets and accessible descriptions. |
| [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Browser-rendered vision guidance. Adaptable text, contrast, alternative cues and VoiceOver descriptions. WCAG itself is the normative source for our web target. |
| [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards/) | Official indexed content. Respect familiar shortcuts, support complete keyboard access, reserve custom shortcuts for frequent tasks. |
| [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Browser-rendered main content. Honest determinate/indeterminate progress, consistent placement and safe cancellation. |

Access failures: the initial HIG Markdown link fetch did not provide usable content. A guessed `physical-keyboards` URL was inaccessible; the actual `keyboards` page was found. A guessed inspector topic was not usable; Windows supplies the inspector guidance. These failed requests are not research evidence.

## Professional UX

| Source | Access / bounded finding |
| --- | --- |
| [NNGroup: 8 Design Guidelines for Complex Applications](https://www.nngroup.com/articles/complex-application-design/) | Full article read; 8 November 2020. Support nonlinear work, interruptions, contextual learning and expert efficiency while reducing competing information. |
| [NNGroup: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Article body read. Prioritise common actions; disclose advanced options clearly. Distinguish progressive disclosure from sequential wizards. |

## Countfire

| Source | Access / bounded finding |
| --- | --- |
| [Takeoff software](https://www.countfire.com/product/takeoff-software) | Public product content. Example-based counting across drawings, measurements and output workflow. Marketing capacity claims are not our engineering acceptance evidence. |
| [New takeoff experience](https://www.countfire.com/blog/new-takeoff-experience) | Full public article, 2 April 2025. Persistent drawing access, Space pan, explicit save, tool and group changes. Historical documentation. |
| [Revised drawings](https://help.countfire.com/en/articles/64566-revised-drawings) | Public help read in prior same-day checkpoint; retained in repository evidence. Reuse definitions on revised drawings; not evidence of our full replacement implementation. |
| [Copying items](https://help.countfire.com/en/articles/87610-copying-items) | Public help and prior same-day normal modal observation. Copying is distinct from revision recount; F076 remains unbuilt. |
| [Itemising measurements](https://help.countfire.com/en/articles/64556-itemising-measurements) | Public help read in prior checkpoint. Tracked requirement, not an implemented feature. |
| [Device coverage](https://help.countfire.com/en/articles/400657-calculating-coverage-area-for-devices) | Existing dated public research/evidence. Coverage visualisation does not establish a compliance calculation or complete output parity. |
| Authorised beta demo interface | Fresh read-only accessibility snapshot and visual inspection this phase: breadcrumb/drawing selector, save, tool rail/context panel, scale/background and floating navigation. No saved mutations; no account URLs, drawings or private payloads copied into this report. Earlier interaction evidence remains separately dated. |

## Other product interfaces

| Source | Access / bounded finding |
| --- | --- |
| [Bluebeam Revu interface](https://support.bluebeam.com/user-manual/welcome/revu-interface.html) | Official documentation and its linked interface image visually inspected in browser. Toolbars, contextual properties, side panels, bottom Markups List/status. Illustration is documentation, not a current live-session test. |
| [Bluebeam selection](https://support.bluebeam.com/revu/how-to/select-markups.html) | Official text. Canvas/list selection and overlap-selection assistance; version-dependent details must be rechecked before imitation. |
| [Bluebeam measurement practice](https://support.bluebeam.com/revu/how-to/follow-best-practices-for-measurement-markups.html) | Official text. Scale, units, measurement properties and viewports. |
| [Bluebeam Markups List, Revu 20](https://support.bluebeam.com/online-help/revu20/Content/RevuHelp/Menus/Window/Panels/Markups/Markups-List--MTV.htm) | Historical official documentation. Linked rows, grouping, sorting and properties; not a current-version claim. |
| [Autodesk viewer tools](https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Viewer_Tools.html) | Official text. Bottom toolbar, selection modes, measure/count actions. |
| [Autodesk inventory](https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Inventory.html) | Official text. Cumulative package inventory, grouping, detail/context actions and XLSX export. |
| [Autodesk calibration](https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Set_Scale.html) | Full official page. Known-distance calibration and sheet-scoped scale; multi-sheet application has conditions. |
| [Figma design files](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files) | Official article body and linked annotated editor illustration visually inspected. Navigation/left structure, canvas, right properties and bottom floating tools in the illustration. |
| [Figma navigation and sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) | Official article body. Pages/layers, find, minimising UI and selection-dependent properties. |

No live Bluebeam, Autodesk or Figma workspace was tested. An older Figma Explore-editor link was inaccessible; the current Explore-design-files article replaced it. Initial empty search results were not treated as proof that documentation was unavailable. No claims are based on third-party mirrors or search-only rumours.

## Accessibility

Normative baseline: [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/). W3C Understanding documents explain criteria but are informative.

- [Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal/large text thresholds and unrounded comparison.
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): necessary control/state/graphical information versus decoration.
- [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24 CSS-pixel criterion and exceptions.
- [Focus not obscured minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): focused component not entirely hidden.
- [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): a non-drag single-pointer alternative, separate from keyboard access.
- [Keyboard](https://www.w3.org/TR/WCAG22/#keyboard-accessible), [character shortcuts](https://www.w3.org/TR/WCAG22/#character-key-shortcuts), [reflow](https://www.w3.org/TR/WCAG22/#reflow), [status messages](https://www.w3.org/TR/WCAG22/#status-messages): normative workflow requirements used in the assessment.

## Local evidence and limits

Source inspection covers the complete module/file inventory and critical workflows; it is not a claim of line-by-line verification of every branch. Automated test names/coverage and existing evidence were cross-checked against feature rows. Fresh suite log: ignored `.local/design-audit-tests.log`. Persistent result and preservation hashes: [design evidence](../evidence/design-research-2026-10-29.json).

Observed local viewport 1792×907. `resize_page(1280,800)` initially returned without changing the viewport; that attempt is not counted as a laptop check. Explicit viewport emulation then reported 1280×800 and confirmed the Count panel dimensions in the report. Emulation was reset afterwards. This is a layout inspection, not physical laptop/trackpad or 200%/400% accessibility testing.

No estimator study, screen-reader acceptance, recognition benchmark on representative customer drawings, or colour-vision participant trial took place. Proposed improvements and performance targets remain hypotheses.
