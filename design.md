# CappyCode UI/UX design specification

Design source of truth for [Issue #49](https://github.com/ehuerta6/multi-language-ide/issues/49).
Use with [README.md](README.md), [Project Scope](docs/PROJECT_SCOPE.md), and
[Feature Tracker](docs/FEATURES.md). This document specifies future UI; it does
not implement components, persistence, authentication, or presentation behavior.

## 1. Design goals

CappyCode is **a live solution showcase platform for CIC Intro sessions**.
Make it clean, cozy, minimal, modern, calm, code-first, and readable on classroom
projectors. Desktop/laptop presentation is the primary use case. Prepared code
and Problem content carry the visual weight; controls support the presentation.

Avoid giant gradients, neon/cyberpunk/gamer styling, purple SaaS visuals, excessive
card nesting, heavy navigation, permanent sidebars, flashy animation,
gamification, and unnecessary modals. Cappy may appear as a small brand mark,
never as a competing illustration. No giant hero header or onboarding flow.

## 2. Product UX model

- **Member Mode:** anonymous, public, read-only access to eligible Sessions. No
  account, content editing, or submission flow.
- **Officer Mode:** Firebase Authentication with one shared CIC officer account
  for the POC. Officers prepare content and control presentation.
- **Session:** `draft`, `live`, or `ended`; contains ordered Problems and a
  session-level `activeProblemId`. Design for 1–3 Problems, plus the empty draft
  preparation state.
- **Problem:** title, description, examples, constraints, order, and its own
  `answersVisible`. Public metadata and protected Solution documents are separate.
- **Solution:** manually prepared source and static output for each **Language**:
  Python, Java, and C++. All three are presented together.
- Firestore is canonical persistence and synchronizes presentation state in
  realtime. Browser `localStorage` is not canonical persistence.

Draft Sessions and their metadata are officer-only. Member access to live and
ended Sessions follows publication rules; history does not make every Session
public. Solution reads also require the parent Problem's `answersVisible` under
Firestore Security Rules. Visual hiding is not the authorization boundary.

Scope clarification: repository docs say “multiple” Problems; Issue #49 normally
expects 1–3 and this task uses that range. This is a layout target, not a new
validation implementation. Publication eligibility mechanics and ended-Session
editing policy are unspecified in the product docs; this spec does not invent
publishing controls, reopening, or automatic public access.

## 3. Visual language

Use integrated document content with neutral surfaces and restrained blue
accents. Reserve containers for editors, examples, outputs, and small contextual
popovers. Separate sections through whitespace and thin rules, not nested cards.

Dark mode uses charcoal surfaces with distinct editor and panel backgrounds.
Light mode uses soft gray surroundings and white primary surfaces. Both are
first-class themes with identical hierarchy, spacing, dimensions, and behavior;
dark mode is not an inversion. Honor the system theme initially; a compact,
accessibly labeled theme control in AppHeader can override it without a modal.

Use a 1px subtle border for quiet separation. Use stronger borders for controls
and projection where necessary. No shadows on ordinary document sections or
Solution panels; reserve a small shadow for floating menus/popovers:
`0 4px 12px rgb(0 0 0 / 12%)` in light, `0 4px 12px rgb(0 0 0 / 24%)` in dark.

## 4. Theme tokens

Baseline values are preserved below. Additional light interaction colors fill
in states absent from the supplied baseline.

| Role              | Dark      | Light     |
| ----------------- | --------- | --------- |
| App background    | `#0F1318` | `#F6F8FA` |
| Primary surface   | `#151A20` | `#FFFFFF` |
| Raised surface    | `#1A2028` | `#F1F4F7` |
| Monaco background | `#12171D` | `#FAFBFC` |
| Hover surface     | `#202731` | `#E8EDF3` |
| Border subtle     | `#28313B` | `#DCE2E8` |
| Border strong     | `#35404C` | `#B8C2CC` |
| Primary text      | `#E6EBF0` | `#18212B` |
| Secondary text    | `#A0AAB5` | `#65717D` |
| Muted text        | `#707B87` | `#8A949E` |
| Accent            | `#4D8DFF` | `#2563EB` |
| Accent hover      | `#69A0FF` | `#1D4ED8` |
| Live / success    | `#5BAF7A` | `#3F8F5F` |
| Warning           | `#C99A4A` | `#8A5A16` |
| Danger            | `#D96C75` | `#B42335` |

Use primary text for content and secondary text for supporting labels. Muted
baseline colors are for nonessential decoration or disabled content: they are
not approved for small essential text. Promote required hints, dates, statuses,
and editor line numbers to secondary text and validate their actual contrast.
Status colors accompany text/icons rather than replacing them.

Interactive state rules:

- Primary action: accent fill; light-theme label `#FFFFFF`, dark-theme label
  `#0F1318`. Hover uses accent hover; pressed uses the same fill with an inset
  border, without scaling. Secondary controls use primary surface, strong border,
  and primary text; hover uses hover surface.
- Selected Problem: primary text, a 2px accent underline, and semantic selection.
  Inactive tabs use secondary text; hovering adds the hover surface.
- Focus: 2px accent outline with 2px offset. Inputs also gain an accent border;
  editors show focus on EditorShell. Never remove focus without a visible replacement.
- Disabled: raised surface, secondary text, no hover response, and semantic
  disabled state. Explain the reason next to a disabled critical action. Do not
  fade an entire toolbar or rely on opacity alone.
- Loading: keep control dimensions stable, label the operation, prevent duplicate
  actions, and use a small progress indicator. Error: danger icon/text plus a
  useful recovery action, with the failed content retained.

Monaco themes use the matching background and primary foreground. Starting
syntax palette: dark keywords `#9DBBFF`, strings `#A3C998`, numbers `#D8B780`,
comments `#A0AAB5`; light keywords `#1D4ED8`, strings `#326647`, numbers `#805514`,
comments `#65717D`. Keep selection and cursor visible in both themes; validate
syntax, selection, and line-number contrast before implementation is accepted.

## 5. Typography and spacing

Use the system sans-serif stack for UI and a system monospace stack for source,
examples, and output. No decorative fonts or source font files are needed.

| Use                      | Size / line height | Weight  |
| ------------------------ | ------------------ | ------- |
| Session title            | 28px / 36px        | 600     |
| Problem title            | 24px / 32px        | 600     |
| Section heading          | 18px / 26px        | 600     |
| Body / description       | 16px / 26px        | 400     |
| Controls / useful labels | 15px / 22px        | 400–600 |
| Supporting metadata      | 14px / 20px        | 400     |
| Monaco / prepared output | 15px / 23px        | 400     |

Spacing scale: **4, 8, 12, 16, 24, 32, 48px**. Use 8px for related control gaps,
12–16px within surfaces, 24px between content subsections, and 32px between major
sections. Page gutters: 24–32px desktop, 16px mobile. Use rem equivalents so text
preferences remain respected. No tiny uppercase labels or tight body leading.

Radius scale: 4px for compact controls, 6px for inputs/examples, 8px for integrated
Solution panels/popovers. Avoid pill-shaped containers except small status badges.

## 6. App shell

AppHeader is approximately 56px tall with a subtle bottom rule, a small CappyCode
mark/name on the left, and compact Live / Officer Mode context plus theme/access
controls on the right. Officer access opens a simple labeled sign-in form; signed-in
officers can return to Sessions and sign out. Members need no sign-in step.
No permanent sidebar.

Below it, use one fluid content column with consistent gutters and a desktop
maximum width around 1440px. Session content dominates. Description prose may
use a narrower reading width around 80 characters; Solutions use the full width.
Do not make all content a giant card. Avoid sticky layers that cover code or
consume projector space.

## 7. Member live session

Hierarchy, in document order:

```text
AppHeader
SessionHeader (title, date, status; optional small CIC Intro Session context)
ProblemTabs + FollowPresenterControl
ProblemContent (title, description)
Examples / Constraints
Solutions (AnswerGate or SolutionGrid)
```

SessionHeader uses the title scale with date and a labeled Draft / Live / Ended
status beside or below it; members never receive a Draft view. Keep context small.
Problem content uses a heading, readable paragraphs/lists, compact examples with
explicit **Input** and **Output** labels, and a separate Constraints heading/list.
Use code-style raised surfaces for example values, preserving whitespace and
horizontal scrolling for long values. No giant enclosing Problem card.

ProblemTabs are a restrained integrated bar, not Language selectors:
`Contains Duplicate | Valid Anagram | Two Sum`. Use primary text and an accent
underline for the active tab, secondary text and minimal decoration for others.

Place the labeled checkbox/switch **Follow presenter** at the right of the same
row when space permits. It defaults ON and follows session `activeProblemId`.
Selecting another Problem manually turns it OFF; OFF allows independent browsing.
Re-enabling immediately selects the current `activeProblemId`. No modal or
confirmation is involved. Explain the behavior in a short accessible description.
Reveal updates still apply to the viewed Problem while Follow Presenter is OFF.

If a viewed Problem is removed, select an available Problem and announce the
change; preserve the member's Follow Presenter preference. An unresolved presenter
pointer shows a brief synchronization state rather than an unrelated Problem as
if it were the presenter's selection. Ended Sessions retain the final pointer;
following it does not imply the Session is still live.

## 8. Answer reveal states

The Solutions heading stays stable across states.

| State                       | Treatment                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `answersVisible: false`     | One AnswerGate: **Answers hidden** / “Waiting for the officer to reveal the solution…”    |
| Revealed, content loading   | One restrained “Loading solutions…” status; no blank Monaco panels or source placeholders |
| Revealed, content available | All three integrated Solution panels                                                      |
| Revealed, read fails        | “Solutions could not be loaded” with Retry; no stale hidden content                       |
| Answers hidden again        | Remove source/output from the member view and restore AnswerGate                          |

AnswerGate uses a quiet rule/surface and generous whitespace, optionally a small
muted icon. Never mount empty editors, blur secret content, or use giant locks.
Hidden source and prepared output must not be fetched or exposed to members;
Firestore Security Rules enforce reads. When answers are hidden again, remove
previously displayed content and release its member view state. Hiding cannot
undo what a member already saw during an authorized reveal.

Reveal the three panels together over about **200ms** using opacity and at most
4px vertical motion. No bounce, scale, stagger, or celebration. Reduced-motion
preferences remove motion. Do not animate hiding in a way that prolongs exposure.
For an ended Session with hidden answers, use “Answers are hidden for this
Problem” instead of promising a future officer reveal.

## 9. Solution panels / Monaco

SolutionGrid presents **Python, Java, C++** in that fixed order with three equal
columns and 16px gaps. Each SolutionPanel integrates a 40px LanguageHeader, Monaco
code region, separator, and labeled **Output** region. Header/output use primary
surface; Monaco uses Monaco background. In dark mode these are `#151A20`,
`#12171D`, and separator `#28313B`, forming one panel rather than disconnected
black rectangles.

Language names are sufficient identity. Optional small indicators use desaturated
blue for Python, muted amber for Java, cool cyan/blue for C++; no large logos.
Keep panel headers, editor heights, and output boundaries aligned for comparison.
Start editors around 360px tall, use internal scrolling for long source, and allow
more height when presentation space permits. Code readability outranks fitting
all source into the viewport. Output preserves whitespace in a monospace region;
long lines scroll, and unusually long output gets its own bounded scroll area.

Member Monaco is read-only but selectable/copyable. Officer Monaco is editable.
Use 15px text, useful line numbers, clear cursor/selection, no minimap, and no
unnecessary editor toolbars. Do not wrap source by default. Keep keyboard escape
from editors available and labels such as “Python Solution, read-only” meaningful.
**Output** is prepared static text, never a terminal. There are no Run, Translate,
Submit, source-Language, judging, or generation controls. An absent prepared
output shows “No prepared output” rather than suggesting execution is pending.

## 10. Officer session editor

Use the same shell, Problem hierarchy, and Solution panels as Member Mode.
OfficerToolbar adds clear Officer Mode context, SaveStatus, and SessionActions;
keep critical actions visible near SessionHeader while presenting. Officers can
view/edit prepared Solutions even when they are hidden from members. Label
“Answers hidden from members” / “Answers visible to members” for the selected
Problem to avoid confusing officer access with member visibility.

| Session / selected Problem | Visible actions and status                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| Draft                      | Draft · Saved ✓ · **Go Live**                                                  |
| Live / answers hidden      | ● Live · Saved ✓ · **Show Answers** · End Session                              |
| Live / answers revealed    | ● Live · Saved ✓ · Hide Answers · End Session                                  |
| Ended                      | Ended; preserve reveal indicators and a return to Sessions; no live action bar |

Show Answers is directly accessible, never in overflow. Hide Answers becomes a
secondary outlined/text control after reveal. End Session uses a secondary action
with clear confirmation. Go Live is disabled when there are no Problems, with
“Add a Problem before going live” nearby. While an action is pending, use an
explicit label such as “Starting…”; reflect confirmed shared state and show errors
with recovery instead of implying a failed action succeeded.

### Autosave and editing

Design around **Saving…**, **Saved ✓**, and **Save failed — Retry** in a stable,
visible location. Preserve unsaved edits, identify failed content, and do not show
Saved until persistence confirms it. Retry is contextual, not a permanent primary
Save button. If unsaved changes prevent a presentation action from applying to
the prepared content, explain why the action is unavailable. A disconnected view
shows “Connection lost — changes not saved” and does not imply realtime sync.
This is a UX contract; persistence behavior is outside this issue.

Session title/date and Problem title use labeled inline inputs. Description and
constraints use labeled multiline fields following the document reading order.
Examples provide labeled Input/Output fields in compact example groups. All three
Solutions remain editable in Monaco, with labeled multiline prepared-output fields
beneath each Language. Use subtle resting borders, an accent focus border and
visible ring, consistent spacing, and no extra card around each field. Error text
belongs next to the affected field. Keep labels visible rather than relying on
placeholder text.

### Problem management

Use `Contains Duplicate | Valid Anagram | Two Sum | +` with a labeled Add Problem
button. Click selects; officer selection during a live Session sets `activeProblemId`.
Drag reorders; a keyboard-accessible contextual menu offers Rename, Delete, and
Move earlier/later. Do not place permanent management buttons on every tab.
Rename uses a compact inline input; `+` creates/selects a new Problem directly.

Deletion uses a compact confirmation popover naming the Problem and consequences,
with Cancel and Delete. Dangerous live actions, especially deleting the active
Problem, require explicit confirmation and explain which remaining Problem becomes
active. Deleting the final Problem exposes EmptySessionState and no valid presenter
pointer; do not silently end a live Session. Return focus to a remaining tab or
Add Problem. Keep contextual menus accessible by keyboard as well as pointer.

Reveal and navigation are independent:

```text
Session
└── activeProblemId

Problem
└── answersVisible

Contains Duplicate: revealed
Valid Anagram:      hidden
Two Sum:            hidden
```

Selecting another Problem never reveals it automatically. Show/Hide Answers acts
on the selected Problem, not every Problem in the Session.

## 11. Sessions dashboard

Officer Sessions is a library of grouped rows, not analytics or a default card
grid. Top row: **Sessions** and **+ New session**. Group by **Live**, **Upcoming**
(drafts), and **Past Sessions** (ended); use date order within groups, upcoming
soonest first and past newest first. Upcoming is a library label, not an additional
Session state.

Each whole row links to its Session and contains date, title, Problem count, and
text status, for example `Oct 8 | Arrays & Hashing | 3 Problems | ● Live`. Provide
a clear row hover/focus treatment; avoid many per-row action buttons. On narrow
screens wrap metadata beneath the title without losing status.

**+ New session** creates/opens a draft directly, without a wizard. Use a quiet
“No Sessions yet” message and the same creation action when the library is empty.
Loading and failures occupy the list region with explicit text and Retry; they
must not masquerade as an empty library. Officer history includes ended Sessions;
member history includes only those allowed by publication rules and retains each
Problem's reveal state.

## 12. Empty session

Keep the normal shell and editable Session information:

```text
Untitled Session
Draft

Problems
No problems yet
Add the first problem to this session.
+ Add problem
```

Go Live remains disabled with the reason visible. No illustrations, checklist,
progress tracker, or Welcome to CappyCode flow. The officer action is immediate
and obvious. If an eligible member Session has no available Problems, show a
read-only “No Problems available” state without officer controls or blank editors.

## 13. Responsive behavior

- **Wide, approximately 1200px+:** three equal Solution columns filling the content
  width. Preserve equal heights, shared header/output alignment, and 16px gaps.
- **Medium:** retain three columns while readable; use a starting minimum panel
  width around 360px and horizontal scrolling in SolutionGrid when necessary.
  Confine overflow to the Solution region, not the whole page.
- **Mobile:** stack normal document content; use a horizontal Solution rail with
  approximately one full Language panel visible and a small next-panel cue.
  Each panel fits the available width; code can scroll internally without shrinking
  fonts. All three Languages remain reachable in the same fixed order.
- Scroll ProblemTabs horizontally for long titles; wrap Follow Presenter below
  them if it cannot fit. Wrap officer actions with Show/Hide Answers still directly
  visible. Do not clip controls or hide presentation actions in overflow.

Use actual content/readability to determine wrapping rather than hard device
categories. Maintain usable text at 200% zoom and let document content reflow;
code comparison can retain its necessary horizontal scroll.

## 14. Projector considerations

Use body text 15–16px, editors 14–15px, and Session titles 24–28px at minimum;
the default scale above takes the upper values. Preserve browser zoom and avoid
shrinking text to fit more code. Keep essential metadata readable and use secondary
or primary text rather than faint muted labels.

Check both themes on a washed-out projection: syntax colors must remain distinct
and readable, selection/focus must be clear, and separators must remain visible.
Use strong borders where subtle borders disappear. Prefer whitespace, weight,
labels, and underlines for hierarchy rather than color nuance alone. Keep code
and Problem content dominant and avoid large sticky headers or decorative chrome.

## 15. Accessibility

Use semantic landmarks/headings, buttons for actions, links for navigation,
labeled inputs, and an actual checkbox/switch for Follow Presenter. ProblemTabs
use tablist/tab/tabpanel semantics with explicit selection, arrow-key navigation,
Home/End, and Enter/Space activation. Merely moving keyboard focus must not disable
Follow Presenter; activating another Problem does. Provide keyboard alternatives
for drag reordering, and return focus predictably after deletion/popover dismissal.

Every control has visible focus and a meaningful accessible name. Use at least
44px practical touch targets on mobile. Do not trap keyboard focus in Monaco;
keep editor escape instructions available. Label source and output by Language.
Scrollable regions must be keyboard reachable and distinguishable from editors.

Validate WCAG AA contrast on actual theme pairs: 4.5:1 normal text, 3:1 large text,
and 3:1 for necessary control/state indicators. Baseline muted colors and subtle
borders are decorative, not sufficient for essential text or a control's only
boundary. Use stronger accessible treatment where needed. Status includes words
and/or meaningful icons: Live, Ended, Answers hidden, Saved, Save failed; never
color alone. Selected state includes underline and semantic state.

Announce save errors, reveal changes, and presenter-driven Problem changes politely
without moving the member's keyboard focus. Avoid announcing every autosave
keystroke. Intentional loading, empty, disabled, permission/unavailable, and error
states use useful text and recovery actions where applicable. An inaccessible
Session shows “Session unavailable” without exposing draft metadata. During loss
of synchronization, show a connection status rather than falsely implying the
presenter's state is current; hidden/unauthorized Solutions must not remain visible.
Honor reduced motion and text zoom in both themes.

## 16. Reusable component vocabulary

These names describe design responsibilities, not mandatory one-to-one React
component boundaries. Do not implement them in this issue.

| Vocabulary               | Responsibility                                           |
| ------------------------ | -------------------------------------------------------- |
| `AppHeader`              | Compact brand, mode/access context, theme control        |
| `SessionHeader`          | Session title, date, and context                         |
| `SessionStatus`          | Labeled draft/live/ended state                           |
| `ProblemTabs`            | Ordered Problem navigation and officer management entry  |
| `ProblemTab`             | Problem label, selected state, contextual actions        |
| `FollowPresenterControl` | Member follow preference and behavior description        |
| `ProblemContent`         | Integrated Problem document hierarchy                    |
| `ProblemDescription`     | Readable statement or officer editing field              |
| `ProblemExample`         | Labeled example Input/Output pair                        |
| `CodeBlock`              | Compact whitespace-preserving static example surface     |
| `AnswerGate`             | Unified hidden-answer message without Solution content   |
| `SolutionGrid`           | Equal comparison columns or responsive horizontal rail   |
| `SolutionPanel`          | Integrated Language header, source, and output           |
| `LanguageHeader`         | Language name and optional restrained identity           |
| `EditorShell`            | Monaco sizing, theme, loading, focus, and editability    |
| `PreparedOutput`         | Labeled static output or officer output field            |
| `OfficerToolbar`         | Visible officer context, autosave, presentation controls |
| `SessionActions`         | Lifecycle and selected-Problem reveal actions            |
| `SaveStatus`             | Saving / confirmed saved / actionable failure            |
| `SessionList`            | Grouped Session library, including loading/error states  |
| `SessionRow`             | Whole-row navigation with date, title, count, status     |
| `EmptySessionState`      | Quiet no-Problem state and officer Add Problem action    |

## 17. UX invariants / product rules

1. Reveal state belongs to each **Problem**: `answersVisible` is not Session-wide.
2. Session status (`draft`, `live`, `ended`) and reveal status are separate concepts.
3. Follow Presenter OFF permits independent Problem browsing.
4. Manually selecting another Problem while Follow Presenter is ON disables it.
5. Re-enabling Follow Presenter immediately jumps to the presenter's current
   session-level `activeProblemId`.
6. Draft Sessions and their metadata are never part of the public member experience.
7. Go Live has an intentional disabled state when the Session contains no Problems.
8. Dangerous live-Session actions require clear confirmation, especially deleting
   the active Problem and ending the Session.
9. Officer editing is designed around autosave with visible success/failure states.
10. Hidden state never exposes Solution source or prepared output before reveal;
    backend authorization and the member UI must agree.
11. Past Sessions preserve intended per-Problem revealed/hidden states; ending a
    Session never automatically makes all Solutions public. Publication eligibility
    still governs member access.
12. Three-Language comparison is central: Python, Java, and C++ are shown together,
    with Monaco editable for officers and read-only for members.

No runtime AI/LLMs, translation/transpilation, code generation, execution,
compilers/interpreters, online judging, submissions, or gamification. This issue
adds design documentation and the explicitly authorized supplied app icon only;
UI libraries, React components, CSS redesign, and product behavior are later work.
