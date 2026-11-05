# Counting delivery plan — research reset, 6 November 2026

**Implementation update,6 November:** owner resumed the build. The first versioned filled-context increment is implemented and independently improves the frozen upright case1→5 TP with0FP;31FN remain. Connected connector subdivision and all four quarter-turns pass original-PDF fixtures. See CURRENT_STATE for exact acceptance and limitations. The research-only pause below is historical. Do not expand this mechanism into arbitrary stroke shifts: a bounded investigation produced no additional real matches. A no-label diagnostic identifies the concealed required filled region as another geometry bottleneck; investigate complete fill-boundary/topology equivalence before integrating safe source/target boundary-pipe paint context. Admission alone would add no instances.

## Decision and scope

**Recommendation: retain the application and strict matcher; add a versioned matcher that recognises local symbol geometry independently of PDF path grouping. Combine indexed vector retrieval, controlled context handling, visible-shape verification and multiple examples per heading.**

The owner requested research and a complete plan, with implementation and testing paused. This phase changes documentation only. Three existing specialists researched competitor workflows, recognition architecture and independent risks; the lead reconciled their findings with current source and prior evidence. No new accuracy, live Countfire experiment or implementation is claimed.

This section supersedes the previous “test another unseen job first” instruction retained below. We already have a demonstrated architectural failure. The next build task is to address that representation failure, not collect another baseline.

The target remains: select → remove unwanted elements → save examples → count selected drawings → colour matches → correct/reclassify → recount without losing decisions → export reconciled quantities. Catalogue, cosmetic redesign, measurement expansion and speculative AI remain deferred.

## 1. Countfire research: evidence and implications

Accessed 6 November 2026. These are official documented behaviours/vendor guidance, not discoveries of proprietary implementation.

| Documented behaviour | Implication for our product |
| --- | --- |
| Edit by erasing elements or using erase-all/restore. [Editing selections](https://help.countfire.com/en/articles/89348-editing-selections) | Constituent selection is a first-class recognition input. A working editor alone is not successful counting. |
| Clean examples retain the body and distinguishing reference while excluding unrelated geometry. Excess detail reduces matches; oversimplification increases false positives. [Clean selections](https://help.countfire.com/en/articles/108485-making-clean-selections) | Neither identical surrounding pipework nor a generic circle alone is an adequate general recognition rule. |
| Matching is fuzzy; different appearances, widths, colours and element constructions can need additional examples. The guide suggests four or five selections per heading on average. [Multiple selections](https://help.countfire.com/en/articles/118318-making-multiple-selections) | An example library is part of the target workflow. Measure single-example and assisted results separately. The stated average is vendor guidance, not a guarantee. |
| Selections 2.0 documents automatic rotations and movable references; references can be configured. [Selections 2.0](https://feedback.countfire.com/changelog/selections-20), [Floating references](https://help.countfire.com/en/articles/10134063-floating-references) | Separate fitting body from reference. Older/mixed guidance still describes rotated misses; numeric angle and scale support remains unknown. |
| Additional selections of competing types can resolve similar-symbol false positives. [False positives](https://help.countfire.com/en/articles/64550-false-positives) | Our recommendation is class-aware assignment, not independent yes/no matchers with no conflict handling. This is an inference from the workflow. |
| Real text contributes character/font information; outlined text contributes shapes. [Text representations](https://help.countfire.com/en/articles/400649-real-text-and-text-like-elements) | Preserve reference semantics where present; do not discard every text-overlapping location. |
| Background definitions use properties such as colour and size, apply across a discipline and can accidentally hide useful content. [Background definitions](https://help.countfire.com/en/articles/431480-customising-drawing-backgrounds) | Background filtering must be explicit, reversible and scoped. Do not silently ignore all grey or black geometry. |
| Image-only symbols cannot be selected for automatic counting; manual counting is advised. Mixed PDFs can contain usable text over an image. [Image PDFs](https://help.countfire.com/en/articles/228982-pdfs-that-are-actually-images) | Prioritise structured/vector PDFs for this milestone. Preserve our raster fallback without making scanned-plan improvements the critical path. |
| Elements partly determine matches; selections sharing an unintended element can clash. [Elements](https://help.countfire.com/en/articles/89849-elements) | Assignment matters. “Element” is not publicly specified as exactly one PDF operator or CAD object. |
| Four checking stages, grouped check sheets and drawing/zone Excel breakdowns support the final takeoff. [Four checks](https://help.countfire.com/en/articles/364279-the-4-stages-of-checking), [Check sheets](https://help.countfire.com/en/articles/114653-check-sheets), [Excel](https://help.countfire.com/en/articles/114655-excel-spreadsheet) | Competitive performance is a correct reviewed takeoff with low preparation/correction effort, not unreviewed automatic totals. |

**Layers clarification:** named PDF layers are optional-content groups, distinct from vector drawing content. Public Countfire guidance does not establish an OCG-layer prerequisite. Cabramatta contains usable vector paths but no OCGs. [PDF Association terminology](https://pdfa.org/glossary-of-pdf-terms/)

**Unknowns:** Countfire's descriptors, indexes, thresholds, split/merge rules, pixel verification, white-paint/clipping/transparency handling, numeric rotation/scale coverage and accuracy on our inputs. No competitor code, hidden APIs or assets were inspected. Prior owner-visible white-element removal is recorded workflow evidence, not knowledge of its algorithm. No live account was used in this research phase.

Bluebeam explicitly documents sensitivity, rotation, colour, fine-detail and outside-selection vector controls. They are useful comparison options, not Countfire features or a proven solution for us. [Revu VisualSearch](https://support.bluebeam.com/online-help/revu20/Content/RevuHelp/Menus/Window/Panels/Search/Searching-PDFs--TV.htm)

## 2. What is actually wrong with our engine

The repository already contains vector extraction, selected-element editing, registration, bounded circle equivalence, native paint verification and multi-page counting. It is no longer only a raster matcher. Rebuilding everything would waste working functionality.

Prior results, not rerun in this phase:

| Case | Observed result | Meaning |
| --- | --- | --- |
| Gymea, four sheets, one family | 65 TP / 0 FP / 2 FN; two manual additions produce 67 reconciled quantities | One construction family works through the complete workflow. |
| Cabramatta upright | Editor repair moved 0/36 to 1 TP / 0 FP / 35 FN | Source editing improved, but matching remains inadequate. |
| Cabramatta concealed | Source verification blocked before target search; 36 instances unserved | Separate admission failure, not a completed classifier benchmark. |
| Prior regression suite | 478 passed | Preservation evidence; not real-drawing accuracy. |
| Padstow saved Countfire work | Matching original F03/P2, marked PDF, workbook and check SVG; 290 saved marks | Comparator evidence, not automatic accuracy or correction-time evidence. |

Current source confirms these mechanisms:

- In apps/local/web/vector-recognition.mjs, retained components are assigned to whole operations. Extra interior operations are allowed when they match equivalent erased source operations. Different connector subdivision/grouping therefore rejects otherwise matching rings.
- In apps/local/web/vector-pattern-review.mjs and vector-candidate-search.mjs, paint preparation receives empty context-ID lists. The adapter already supports explicit context. Cabramatta's concealed source verifies in a private diagnostic when the relevant excluded pipe paint is supplied; this is not an integrated fix.
- Original-paint verification protects extraction provenance. Isolated-paint agreement is not a complete definition of symbol presence when later drawing content overlaps it.
- A text-overlapping candidate can currently trigger a page-level fallback. Local ambiguity must not silently remove otherwise supported candidates.
- Native page-set runs are limited to 20 explicit pages, with separate element/proposal/audit budgets. Discipline-wide work requires explicit batching and completion accounting.
- Previous private cyclic/collinear, restricted-union and convex-containment experiments did not improve the whole Cabramatta count. Repeating these as isolated exceptions is not a new architecture.

**Diagnosis:** operation grouping and erased surrounding geometry influence identity too strongly. We need a representation of the required symbol and its distinguishing details, with separately justified context.

## 3. Approach selection

| Approach | Strength | Limitation here | Decision |
| --- | --- | --- | --- |
| More whole-operation exceptions | Small changes, known cases retained | Exporter-specific patch cycle | Keep strict matcher as fast path; stop treating it as the general solution. |
| Whole-page graph matching | Structural relations | Crossings and segmentation remain ambiguous; potentially expensive search | Use small local relations after retrieval. |
| Local canonical geometry + visible-shape verification | Retains vector editing/provenance while tolerating construction differences | Context and distinguishing detail need explicit rules | **Primary recommendation.** |
| Raster/contour query-by-example | Independent of PDF operation subdivision; no training set | Tiny details, clutter and rings inside other symbols cause confusion | Local verifier and bounded alternative; not sole class decision. |
| Learned CAD model | Promising grouping/context | Training, domain shift, licences, deployment and unknown-class issues | Defer from critical path. |
| Commercial SDK | Could shorten work if capabilities fit | No evaluated product currently proves our full requirements | Contingency requiring a concrete demonstration before procurement. |

Relevant research:

- Architectural symbol spotting research separates description/retrieval from verification and addresses clutter. This supports the architecture, not a prediction of our accuracy. [Rezvanifar et al., 2019](https://link.springer.com/article/10.1186/s41074-019-0055-1)
- Directional chamfer matching uses contour orientation and efficient distance calculations. Use it to corroborate local shape, not accept a class solely because part of its outline matches. [Liu et al., CVPR 2010](https://merl.com/publications/TR2010-045)
- Generalized Hough can propose location, scale and angle. Consider it only where indexed vector anchors cannot retrieve useful candidates; avoid exhaustive full-page pose search. [OpenCV](https://docs.opencv.org/4.12.0/d3/d20/classcv_1_1GeneralizedHoughGuil.html)
- CADTransformer and SymPoint use graphical primitives/points. Their published CAD tasks do not establish arbitrary-example PDF sprinkler accuracy. [CADTransformer](https://openaccess.thecvf.com/content/CVPR2022/html/Fan_CADTransformer_Panoptic_Symbol_Spotting_Transformer_for_CAD_Drawings_CVPR_2022_paper.html), [SymPoint](https://arxiv.org/abs/2401.10556)

## 4. Proposed engine contract

### Original paint and derived geometry remain separate

Preserve document hash, page, native coordinates, raw operation IDs, transforms, paint order, styles, clipping, visibility and renderer version. PDF bytes remain immutable. Reuse PDF.js 6.4.299 and the existing operation-mapping/provenance modules. Operator lists describe graphics, not semantic symbol objects. [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)

Derive local comparison fragments: lines, curves, contours, filled regions/holes, stroke support and text. One logical shape may span several operations; one operation may contain several pieces. Every fragment records contributing original paint plus subpath/segment or curve-parameter coverage and a reproducible support mask; operation-ID lists alone cannot safely colour part of a shared operation. Derived IDs must not replace persisted original identities.

Normalise translation and harmless segmentation/order differences while retaining meaningful endpoints, holes, fill rules, width, caps/joins, colour and paint order. Bound curve approximation in PDF units relative to the smallest distinguishing feature. Do not blindly inflate hairlines or globally union a page.

Use a proven fill-rule-aware geometry kernel for bounded local self-intersecting fills rather than inventing polygon booleans. Clipper2 supports relevant fill rules; its original upstream now points to PolyClipping. It still requires a pinned audited source/build, numerical error budget, licence notices and an evaluated worker/WASM bridge. No package is adopted by this plan. A kernel is a contingent local implementation choice, not a prerequisite universal-normalization or WASM project. [Capabilities](https://angusj.com/clipper2/Docs/Overview.htm), [official successor](https://github.com/PolyClipping/Clipper2)

The installed polygon-clipping package is not a direct interpreter of arbitrary PDF compound-fill semantics. Do not replace its input contract with unchecked assumptions; preserve winding and paint interpretation before any union. [Official API](https://github.com/mfogel/polygon-clipping)

### A query contains body, discriminators, context and references

Store five separate concepts:

1. Required retained symbol geometry.
2. Distinguishing detail: fill, holes, dots, bars, spokes, text and relationships. Absence is evidence only where it is actually visible.
3. Explicitly excluded context, with bounded rules for interference rather than an unrestricted ignore mask.
4. Associated references that may move relative to the body when supported.
5. Example identity, heading, original source, scope, permitted transformations and policy version.

The user still selects, erases/restores, adds examples and counts. Internal model fields should not become mandatory technical settings.

White paint is not blank paper. It can be backing, a defining hole or a later knockout. Expose original white-object identity where supported; retain compositing semantics. Never convert all erased white into wildcard space or automatically count a hidden symbol revealed by removing a covering object.

### Candidate retrieval comes before expensive comparison

Retain strict matches first. Index primitive bounds and distinctive geometric features. Use a few anchors and local relations to propose locations; retrieve only nearby fragments. Start with translation and existing quarter turns.

Allow bounded many-to-many fragment correspondence, not arbitrary subset search across a sheet. Cap neighbourhood size, alternative assignments, edges/intersections, crop pixels and elapsed work. A budget overflow is incomplete coverage, not a successful empty result.

Add arbitrary-angle pose estimation and controlled uniform scale after the representation works. Do not silently introduce reflections/nonuniform deformation. Different widths/colours can use separate examples rather than broadening every class.

### Verify the symbol separately from its surroundings

Each candidate must establish required-body coverage, discriminating detail, justified context and support in the original visible drawing.

A connector may have a different number of fills or a different length without invalidating the same head. But an erased source mark does not authorise ignoring an arbitrary target dot. Use local continuation, paint relationships and rival examples; unresolved interior evidence remains review-required.

Replay original target paint with independently justified context for provenance. Separately compare selected shape and visible support. Directional contour comparison must be accompanied by fill/topology and extra-detail checks; one-sided outline matching accepts a ring inside a different symbol.

Do not loosen the existing strict pixel thresholds globally. Introduce a separate, versioned contextual assessment. Context must not fabricate evidence for a missing body part.

Some distinctions cannot be inferred from a crop: a pipe endpoint versus an intrinsic dot, an obscured centre, or identical glyphs used for different items. Use another example, a reference/legend/scope rule or human classification. Unknown is not absent.

### Classes, duplicates and uncertainty have explicit rules

Combine examples under one heading while retaining which examples support each instance. Compare relevant rival headings; do not classify by whichever search runs first. Ties need review.

Deduplicate symmetric poses and multiple examples by physical support and constrained location, preserving nearby distinct symbols. Avoid allocating the same physical instance twice. A compound operation can contain pieces belonging to distinct items; raw operation sharing alone is not a sufficient universal conflict rule.

Return verified, uncertain and rejected outcomes with reasons. Uncertain candidates do not silently become verified/export-ready quantities. Scores are not calibrated probabilities.

### Preserve the existing count ledger

Version recognition policy/evidence; leave old saved selections readable and reproducible. Reuse headings, colours, manual marks, review/apply, zones, multipliers and workbook calculations.

Link new proposals to existing instances using document/page identity and constrained geometry, with explicit conflict handling. Do not replace accepted/rejected/reclassified decisions because extraction IDs changed. Preview before atomic Apply; cancellation, stale sources and incomplete scans cannot partially replace saved totals. A partial scan cannot replace a previous complete ledger. If later offered at all, verified additions from partial coverage require an explicit limited scope, with unserved coverage visible and uncertain candidates excluded from automatic totals.

Revisions retain old snapshots and expose deltas. New PDF revisions are not old operation IDs silently reused. Store enough target evidence to reproduce coloured glyphs without colouring unrelated pieces of a compound operation.

## 5. Ordered implementation plan

Implementation and test runs remain paused for this research turn. The table defines the next build sequence.

| Increment | Ownership | Concrete outcome |
| --- | --- | --- |
| 1. Local body/context equivalence | Vector engineer; bounded new helper beside existing matcher | One cleaned upright source can match equivalent heads despite split/overlapping connector fills, with required body/provenance retained. |
| 2. Context-aware source and target proof | Vector engineer, reviewed by integrity specialist | Concealed source can be processed with justified pipe context; missing/wrong defining detail is still refused or reviewed. |
| 3. Integrated preview, Apply and correction preservation | Lead/integration + integrity | Actual coloured results, saved selection, correct/recount/reopen; not another preview-only milestone. |
| 4. Example library and competing classes | Vector engineer + estimator-workflow specialist | Additional examples improve a heading's coverage; rival types remain distinguishable; no duplicates or repeated corrections. |
| 5. Remaining selection/identity capabilities | Vector engineer + workflow specialist, one feature at a time | Explicit white cleanup; real/outlined text and floating references; arbitrary rotation and controlled scale where required. |
| 6. Whole-discipline execution | Performance specialist + lead | Cached indexes, bounded verification, progress/cancel and all requested pages accounted for; explicit batching beyond 20 pages. |
| 7. Reviewed output and real comparison | QA + integrity/Excel after code freeze | Complete counts and reconciled exports on development jobs, submitted comparisons and independent whole-job holdouts. |
| 8. Readiness decision | Lead with estimator review | State supported input/workflow scope and whether comparison evidence supports competitiveness; otherwise identify the remaining blocker. |

Before increment 1, define the shared body/context/provenance evidence contract. The first increment must not become a universal geometry-framework rewrite. Begin with one connector construction family, including differently split/self-touching fills, and preserve genuine extra-dot/bar/hole and competing-class distinctions from the start. Full example-library interaction comes later, but class safety does not. Geometry-only proposals remain provisional until contextual visibility is supported in increment 2; increment 3 integrates only that declared scope. When validation resumes, evaluate this contract and then reuse the existing Cabramatta/Gymea cases. More candidates without correct classes and visible support are not completion.

Proposed boundaries: reuse vector-paint-provenance.mjs, vector-page-audit.mjs and operation mapping; add local geometry/context helpers; dispatch the versioned matcher through vector-pattern-review.mjs; deliberately pass context through pdf-contour-verification.mjs; integrate policy/ink/store adapters only after the evidence contract is stable. QA owns independent fixtures, not matcher code. One writer per module.

Nested forms/transforms, clip rules, opacity/blend states, dashes, caps/joins, nonzero page origins, thin/faint paint and text must remain in the input-capability matrix. Implement unsupported semantics individually where necessary; never relabel a fallback as full vector support.

## 6. Use submitted quotes correctly

Recognition input is always the original tender PDF. Saved Countfire outputs are comparison evidence.

Padstow F03/P2 is verified: workbook 27 Below + 263 EXPOSED = 290 saved marks, matching 290 sheet entries in its check SVG. Those totals do not reveal automatic accuracy or manual corrections.

Align revision, scope, drawings, class identity, legends/details, zones and multipliers. Preserve distinct rows with identical names. Original and marked PDFs have different coordinate origins; SVG positions are integer percentages and need visual adjudication. Equal totals can hide cancelling false positives and misses.

Independently label originals before showing the labeler comparison totals. Padstow is development/comparison material, not a sealed holdout because its totals are already known. UNSW needs visual revision verification; Mount Druitt scope/revision remains unresolved. Skip St Ives.

Never use marked or symbol-removed .rem.pdf outputs as recognition input. Keep customer drawings/exports out of GitHub and external inference services. No fresh competitor account is required for this architecture work.

## 7. Completion evidence after implementation resumes

The owner has paused tests for this phase. Later validation should verify delivered increments, not substitute for development.

- Report first-example accuracy separately from added-example coverage and manually corrected final quantities. Count source attempts, cleanup actions and extra examples.
- Account for every declared page/family: completed, partial or blocked, with reasons. Blocked searches have no classifier precision but leave instances unserved in overall task coverage.
- Report TP/FP/FN, duplicates and wrong classes per sheet/family/job; show the worst job rather than hiding it in an aggregate.
- Use five representative jobs and at least two whole-job/export-source holdouts as an initial engineering gate. These sample counts are not proof of a population accuracy rate. Replace a holdout once it informs a change.
- The existing 98% precision/recall floor is a proposed development target, not Countfire parity. Small families require raw counts; no failed family disappears into an average.
- Correct reviewed quantities and low estimator effort are the business outcome. Saved exports cannot establish comparable automatic accuracy or task time; equivalent timed authorised workflows are needed for that claim.
- Require zero lost explicit corrections and exact mark/heading/zone/multiplier/Excel reconciliation, including save/reopen/recount, overlapping zones and cancellation.
- Declare supported page/input limits, cold/warm processing time, memory accounting and responsiveness. Sampled JS heap is not peak process memory.
- Run focused checks during a coherent implementation increment, then full regression/browser/integrity validation at integration. Repeat broad runs only for changed code, failures or an unresolved concern.

## 8. Budget and decision discipline

The lead owns architecture, scope and stop/go decisions. Each mechanism gets one owner, a stated hypothesis, a bounded work allocation and a concrete intended result.

**At most two implementation attempts at the same mechanism** before changing representation, choosing a bounded contour alternative, or exposing an assisted/review limitation. Do not continue a non-improving approach because more tests pass. No threshold-tuning loop on one drawing or hidden widening of acceptance.

For the first connector-equivalence feasibility decision, the proposed cap per attempt is 90 minutes of cumulative lead/vector implementation work plus 30 minutes of independent review/verification: at most four active team-hours across two attempts. Log actual effort and tool/runtime waits separately; do not multiply this allowance by spawning more agents or restarting the same hypothesis under a new name. This is a spending-control proposal, not a completion estimate or a dollar-cost prediction. Production integration is a separately scoped increment only after useful evidence; reaching the cap requires a reported go/change/no-go decision, not silent extension.

Report progress as genuine additional instances found, new wrong counts, remaining unserved instances, user effort and whether the complete workflow works. Regression totals are secondary.

There is no evidence-backed completion date yet. The first two increments determine whether this approach removes the demonstrated bottleneck. If not, the lead must present a bounded alternative or a specialist/SDK feasibility decision promptly, rather than an open-ended patch queue. Paid external procurement would require a separate concrete decision.

## 9. Strongest objections and remaining risks

| Risk | Required response |
| --- | --- |
| A dot may be a connector or a class-defining feature | Require observable discriminators, another example/reference or review; do not invent hidden detail. |
| Canonicalization removes a tiny meaningful feature | Explicit approximation error budget; preserve holes, fill and paint semantics. |
| Context masks hide wrong/missing body geometry | Narrow context authorisation plus independent visible body evidence. |
| Some PDF semantics cannot be represented faithfully | Original renderer remains authoritative for visible pixels/compositing, not semantic class identity; explicit local fallback/coverage status. |
| Local graphs/unions still explode in complexity | Fixed edge/intersection/assignment budgets; no full-page boolean arrangement. |
| Example overlap causes duplicate/conflicting quantities | Class-aware instance assignment and reversible explicit decisions. |
| New fragments invalidate saved corrections/colour | Separate derived identities from stored paint/mark identity; versioned atomic migration. |
| New geometry dependency is difficult to build or maintain | Pin upstream/adapter, licence and numerical behaviour; avoid speculative package swaps. |
| Competitor exports use different scope or contain corrections | Align revisions/scope and compare instances; distinguish saved outcomes from automation. |
| Development-job success does not generalise | Per-job/family reporting and untouched whole-job holdouts. |

**Next build action after this research phase:** implement the bounded local body/context representation for connector variation, preserving raw provenance and the strict matcher. Specify concealed source/target compositing separately. Do not restart broad baseline testing, cosmetics or AI training before this concrete recognition increment exists.

---

# Historical plan — preserved below

# Counting delivery plan — updated 6 November 2026

## Active plan: reliable counts across real jobs

Owner instruction: keep working on counting until practical performance is competitive with Countfire, using an efficient, measurable plan. This section supersedes the historical starting position below. Current stage is broader real-drawing validation and targeted improvement, not another vector-engine feasibility study. No catalogue, AI, measurement expansion or cosmetic redesign.

### Verified starting point

**Execution update, later6 November:** the next unseen job is now measured. Cabramatta has36 upright+36 concealed labels: upright baseline0/36, native-editor fix1/36; concealed source proof remains blocked.478 regression tests pass, but the real-job acceptance gate fails. Do not repeat initial discovery or mistake the earlier Gymea result for generalisation. The next increment is a bounded original connector-fragment/context-equivalence fixture and safe matching proof; use CURRENT_STATE for exact evidence. Submitted Padstow quotes provide matching original drawings and saved Countfire outputs for a later independent comparison. The staged plan below remains applicable; step1 has executed for this additional development job.

Private preview commit `65a05bf837a299183d0b193c59be2e37c6c1931a`: 474 automated tests pass locally and on GitHub. Four complete Gymea sheets, one independently visually labelled sprinkler family: **65 TP / 0 FP / 2 FN**, 100% precision, 97.01% recall; actual Chrome matching and verification 10.855 / 10.177 seconds. Two manual additions produce 67 reconciled Excel quantities; corrections survive recount/reopen. Browser workflow333 checks and independent audit220 checks pass. Existing project data is unchanged.

This is one development job, not representative parity. Labels have independent AI visual tallies but no estimator certification. Native counting is exercised through the existing selection-editor workflow; the initial rectangle's raster result is not the native benchmark. Detailed evidence and limitations remain in CURRENT_STATE and BENCHMARK_AND_FAILURE_REGISTER.

### 1. Test the next unseen job before changing the engine

QA selects another authorised fire job from the existing Dropbox quoting folder, respecting the owner's exclusion of St Ives. Start with a bounded complete sheet or small sheet set containing at least two distinguishable sprinkler families, preferably a different drawing author/exporter. Do not cherry-pick a clean region or a source after seeing target results.

Before running recognition, freeze original file hashes, full scored scope, legend interpretation, instance locations, ambiguity rules, representative source examples and cleanup policy. A second reviewer checks positives and confusing negatives without matcher output. Keep original PDFs and detailed labels private. Run the currently delivered engine unchanged, including real selection cleanup; report admission failures as failures to complete the task, not as successfully scanned empty pages. Score all declared true instances, including unverified/refused candidates, in end-to-end recall; show admitted-only diagnostics separately.

Deliverable: one reproducible before-fix result with TP/FP/FN, source-selection success, unsupported coverage, elapsed time and corrections required. This is the **next executable task**. Do not wait for a large dataset to begin learning.

### 2. Fix the highest-impact demonstrated failure, one mechanism at a time

Rank failures by frequency across jobs, false-positive risk, correction effort and implementation cost. Fix source-admission blockers and incorrect detections before micro-optimising speed. Likely categories to investigate, only when demonstrated: annotation/crossing-line interference; constituent grouping; equivalent curve/polyline construction; rotations; scale variation; duplicate or near-identical symbol confusion.

The two Gymea annotation-overlap misses are regression cases, not permission to ignore all grey geometry or loosen every threshold. Build an original positive plus near-lookalike/hidden-detail negative before each fix. Preserve strict matches, original element identities, paint checks, explicit scopes and raster/manual fallback. Prefer existing multiple-example selection where it solves a real variant simply; record extra examples and cleanup actions as user effort. Keep one-example and assisted results separate. Arbitrary rotation/scale work is justified by failed real cases, not a speculative rewrite.

Each increment must show the same frozen input/source/policy before and after, improvement on the target failure and no unexplained regression elsewhere. If two bounded attempts fail to improve the case safely, stop that approach, record why, and choose the next evidence-backed approach or explicit review fallback. Do not spend an open-ended session tuning one drawing.

### 3. Build representative evidence incrementally

Grow to at least **five distinct authorised jobs**, covering clean vector drawings, dense crossing geometry/annotations, different CAD exports, rotated symbols and multiple drawings/classes. Maintain a separate raster/unsupported-input stratum: a safe fallback does not establish automatic vector accuracy. Aim for at least eight meaningful symbol families and about1,000 labelled instances where available; repeated easy circles must not dominate the evidence, and these sample counts alone do not establish statistical confidence.

Keep at least **two complete jobs as final holdouts**. QA can label them privately, but do not expose their outputs/failures to implementation tuning before the candidate release is frozen. Split by job/export source, not adjacent pages from the same job. Once a holdout guides a fix it becomes development data; replace it for final acceptance. Keep negative sheets and near-lookalikes in the corpus. Add a second reasonable source example as a robustness test with its policy frozen before execution; do not select the best-scoring source retrospectively.

QA reports each job, family and sheet, plus aggregate metrics. Zero-positive sheets report FP counts, not invented recall. Very small samples show raw counts; one error may legitimately fail the percentage target. Unsupported jobs stay in the coverage report and cannot silently disappear from the claimed product scope. An estimator validates class semantics and ambiguous cases before a commercial/parity acceptance claim; development proceeds without waiting on routine confirmations.

### 4. Prove the complete counting task and practical performance

On each release candidate, exercise the actual application in an isolated store: import → select → remove unwanted elements → name/save → count selected drawings → inspect coloured marks → accept/reject/add/reclassify → recount → reopen → Excel. Include multiple examples/headings, multipliers, overlapping zones, cancelled runs, stale selections and unchanged prior corrections. Exact instance-level reconciliation is mandatory, not just equal aggregate totals. Existing saved selections and outside-scope marks must remain intact.

Record time to reviewed export, source-cleanup actions, extra examples, review/correction actions, automatic latency and full application-process memory where measurable. Separate scripted UI execution time from human estimator time. Use the same hardware/browser and declared cold/warm conditions; collect at least 10 timing repeats before reporting a median and at least 20 before an observed p95. Use these repetitions at release/performance checkpoints, not after every edit. Retain raw runs and do not present these as population guarantees. Before each benchmark freeze the machine, supported page count, existing implementation work/deadline limits and proposed memory/cancellation limits in its run manifest; exceeding a limit is a recorded failure, not permission to raise it after observing results. Profile only a measured slow stage. Repeated import/count/recount/cancel runs must release resources and show no unexplained memory growth. Retain current hard caps; jobs beyond the current 20-page scope need explicit batching or a tested extension, never silent truncation.

### 5. Acceptance and honest competitive comparison

These are **proposed engineering targets**, not achieved results or a guarantee of competitor parity:

| Measure | Gate |
| --- | --- |
| Automatic accuracy on declared clean-vector scope | At least98% precision AND98% recall per evaluated job and family; aim for99%+ as the working target. Report every sheet and sparse sample; investigate each unexplained failure. |
| Human corrections and quantities | Zero lost reviewed decisions, duplicate included instances or unexplained export discrepancies. Corrected totals remain separate from automatic accuracy. |
| Unsupported content and failure | Explicit incomplete coverage/fallback, responsive cancellation, no partial publication or damage to prior counts. |
| Practical comparison, where permitted | Same original PDFs, classes, scope and independent truth. Record both products' instance-level errors, source preparation, extra examples, correction effort and full reviewed-export time. Initial speed threshold within1.25× comparator task time is an entry gate, not equality. |
| Claim of counting parity on tested scope | Comparable or better accuracy and correction effort across representative jobs and no material reviewed-task-time disadvantage; report actual differences and uncertainty. Passing our98% floor alone is insufficient if the comparator does better. |

Use only permitted normal competitor UI workflows or owner-provided outputs with provenance. A saved Countfire total is not ground truth; matching totals can conceal different errors. Access is not assumed and must not block our independent development. If comparable access/evidence is unavailable, report our independently validated accuracy and leave parity **unproven**. Do not expand this counting claim to the whole product.

### Efficient execution and delivery

- Lead integrates; vector engineer owns the one selected algorithm change; independent QA owns labels/scoring and untouched holdouts. Use integrity/performance specialists only for relevant changes. One writer per module; no duplicate investigations or idle agent work.
- Reuse existing benchmark runners, UI harnesses and failure register. Add only the missing fixture adapters/assertions. No additional strategy documents for routine increments.
- Focused tests after each change; full regression and actual browser acceptance after a coherent integrated batch. Rerun beyond that only for changed code or unresolved evidence. Preserve failed reports and source hashes.
- Every accepted batch delivers working code, before/after counts, correction effort, timing, integrity results, a private commit and one exact next task. Track active engineering time/tool usage where available; reassess low-yield work rather than hiding cost behind test counts.
- Preserve all existing staged/unpushed work and customer data. Tests use isolated copies; no drawings in Git, no destructive synchronisation, no production takeoff mutations.

Immediate sequence: **freeze another job → measure unchanged engine → fix its largest repeated failure → rerun old and new benchmarks → repeat across jobs → frozen holdout and practical comparison**. Continue counting work without routine approval pauses; escalate only genuinely missing access, semantic decisions or unsupported evidence. No fixed completion date is defensible until the next jobs reveal the remaining failure distribution.

## Historical plan — 5 November 2026

Preserved below as history. Its source-page-only starting evidence and first multi-page implementation task were superseded by the verified deliveries of5–6 November.

## Outcome
Select a sprinkler, remove unwanted vector elements, find and colour equivalent symbols across selected drawings, correct results, recount/reopen safely, and export quantities that agree with the reviewed marks. Keep the interface simple and original. Counts only; catalogue, AI and cosmetic redesign remain deferred.

## Starting evidence
The delivered source-page native matcher has 408 passing automated tests and 368 browser checks. One nine-label development region measured 9 TP / 0 FP / 0 FN; an earlier 31-label drawing measured 30 visible verified matches and one visibility refusal. These are narrow development results, not whole-project accuracy or competitor parity. An archived multi-page runner passes eight compatibility tests but is not connected to the active application.

Normal authorised observation of an existing Countfire job confirmed editable constituent elements, per-heading colour, multiple examples per heading and per-sheet quantities. Saved competitor totals are not ground truth. No proprietary implementation is needed or permitted.

## Delivery order and gates
1. **Complete multi-page native counting.** Reuse the tested matcher; prepare one cleaned source, search explicit pages, and qualify every result by drawing, digest and page. Add scope selection to the existing editor, page navigation in preview, original-symbol colouring and atomic save. Preserve v1 selections. Cancel/failure must publish no partial changes.
2. **Prove integrity independently.** QA freezes an original asymmetric two-page fixture before matching. Include quarter turns, crossing pipework, wrong-symbol controls, shifted page-local IDs and white overpaint. Test exclusions, additions, reclassification, multipliers, recount/reopen and overlapping-zone Excel reconciliation. Report actual TP/FP/FN and timing. Zero lost corrections and zero export discrepancy are mandatory.
3. **Broaden real-drawing accuracy.** Freeze independently checked instance labels on at least five authorised representative drawing sets. Keep development and unseen validation sheets separate. Report each page/type, including unsupported or failed pages; never average away a failed sheet. Compare equivalent tasks with Countfire only through permitted normal use and independently verify both outputs.
4. **Fix the largest measured failures.** Prioritise recurring misses/false positives and correction effort. Add regression examples before each bounded fix. Expand geometry/grouping, rotation and scale support only when benchmark failures justify it. Retain explicit raster/manual fallback.
5. **Competitive acceptance.** Proposed initial clean-vector target: at least 98% precision and 98% recall per evaluated set, no lost corrections, exact exports, and reviewed-task time within 1.25× the observed comparator on the same task. These are targets, not achieved results. Parity requires measured comparison across representative jobs; passing synthetic tests alone is insufficient.

## Cost and execution discipline
One writer per module; vector implementation, independent QA and persistence review work in parallel. Use existing code and archived work after review. Run focused tests per increment, full regression once integrated, then actual isolated-browser acceptance. Record each increment's code, observed tests, failures, accuracy, time and next smallest task in CURRENT_STATE. No speculative features or repeated planning. Do not promise a finish date or parity without evidence. Preserve local/index/unpushed work and all customer data; never commit drawings or overwrite live takeoffs for testing.

## Current first increment
Connect the existing page-set runner to versioned selection storage, page-specific glyphs and the existing review/editor workflow. Acceptance is the entire two-page select → clean → match → colour → correct → recount → reopen → reconciled export sequence, not merely a callable runner.
