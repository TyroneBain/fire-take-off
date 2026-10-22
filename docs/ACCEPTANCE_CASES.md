# Executable acceptance planning

Phase 1 work, 2026-10-22. These cases specify our original application; they are not claims of tested Countfire behavior. Every product feature remains NOT STARTED. Fixture provenance and exact coordinates: [drawing corpus](../fixtures/drawings/README.md). No stack is adopted.

| Case | Parity IDs | Inputs/actions | Independent expected result | Unresolved prerequisite |
| --- | --- | --- | --- | --- |
| A001 | F001,F003 | Create projects A/B, two takeoffs in A, one discipline each; save/reopen | Stable IDs and independent names; A's content absent from B; blank name rejected; cancel creates nothing | Archive/restore and permission observation |
| A002 | F002,F006 | Import generated small-vector.pdf; reopen and switch drawings; import malformed bytes | Original SHA-256 retained; correct page dimensions; failed import leaves committed drawings intact | Duplicate/multipage limits and transactional UX |
| A003 | F004,F005 | Render fixture at two zooms and 90-degree rotation; place a mark at (100,100) | Inverse view transform recovers original coordinate; source geometry unchanged | Renderer benchmark and numerical tolerance agreement |
| A004 | F008,F009,F010,F016 | Select square-cross example; count fixture; review each match | Six labelled instances, no duplicate IDs, totals reconcile to six; report false positives and misses separately | Scope/correction reference workflow; performance targets |
| A005 | F013,F014 | Reject one match, manually restore one mark, hide/show layer; save/reopen | Five then six quantities; visibility alone changes no quantity; decision provenance survives reopen | Undo and recount correction precedence |
| A006 | F017,F018,F020 | Calibrate (50,400)→(350,400) to 30 m; measure run/rectangle | 50 m run; 100 m² area; zero/negative/nonfinite calibration rejected; zoom does not alter quantities | Reference units and rounding; tolerance agreement |
| A007 | F021,F034 | Draw fixture zone before and after counting; save/reopen | Six interior symbols both orders; schedule equals drawing total | Boundary, overlapping and cross-zone length rules require separate cases |
| A008 | F007 | Add note at original coordinate; edit/cancel/delete/reopen | Page attachment stable; cancelled edit retains original text; deletion persists | Reference formatting/export representation |
| A009 | F032,F033 | Use future labelled revision pair; recount after manual correction | Original revision retained and changes traceable; no silent correction loss | Revision pair and migration policy not yet defined |
| A010 | F034,F035 | Export six accepted fixture symbols and known measurements | Independently parsed workbook reconciles quantity 6, length 50 m and area 100 m² | Reference output schema and workbook inspection |
| A011 | F038,F041,F061 | Import approved quantity 6, set original unit buy 12.50 and labour 0.25 h at 100/h | Material 75.00; labour 1.5 h / 150.00 before adjustments | Currency, rate precedence, margins/markup and rounding policy |

All cases require environment/date, fixture SHA, commands or UI steps, observed results and failures before a feature can be VERIFIED. A001–A011 have not run. They refine existing parity requirements without waiving roadmap gates.
