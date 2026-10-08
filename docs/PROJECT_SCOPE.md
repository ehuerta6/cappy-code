# Project Scope

## Product definition

CappyCode is **a live solution showcase platform for CIC Intro sessions**. CIC officers prepare interview-style problems and their solutions ahead of time, then present them to members during a session. Members join through an anonymous, read-only public view.

CappyCode is not an IDE, code translator, transpiler, AI product, online judge, or code-execution tool. Officers prepare Problem examples and source code; the runtime displays that content without generating or executing it.

## Users and access

### Officers

CIC Intro officers are the authenticated content managers and presenters. Firebase Authentication is used only for Officer Mode. The proof of concept has one shared CIC officer account. Officers can create and manage sessions, add and order problems, prepare solution content, and control answer visibility.

### Members

Members are anonymous viewers. They do not create accounts or authenticate. Member Mode provides anonymous, read-only access to every live and ended session. Draft sessions are officer-only. Problem descriptions and examples are public for live and ended sessions. Live-session Solution documents are readable only when their Problem's `answersVisible` is true. Every fixed-language Solution for an ended session is publicly readable under Firestore Security Rules.

## Persistence and architecture

Firestore is the canonical persistence layer. It stores session content, session history, prepared solutions, and each problem's answer visibility. Firebase Authentication protects Officer Mode; public membership does not depend on authentication.

Keep problem metadata separate from solution documents. Metadata includes the problem title, description, shared example input and expected output, order, and `answersVisible`. These fields are member-readable for live and ended sessions; a draft's metadata remains officer-only. Live solutions are protected until revealed, while ended-session solutions are public. Solution documents include manually prepared Python, Java, and C++ source. Separation lets Firestore Security Rules enforce answer access independently of what the UI renders.

Firestore Security Rules are the actual hidden-answer permission boundary. A hidden answer must not be readable by an anonymous member client. Live Solution-document reads require the parent Problem's `answersVisible` to be true. Ended-session Solution reads do not depend on `answersVisible`; draft Solutions remain officer-only. Rules also restrict session and problem management to authenticated officers. UI state such as **Hide Answers** is not a substitute for these rules.

Problem Bank publication intent is stored separately from temporary live-session
hiding. New Bank entries start unpublished. Member visibility requires an
Officer-published entry that is not temporarily hidden because the active live
Session uses it. Not Live, End, and supported live Session deletion release only
the temporary hide and retain publication intent. Firestore Rules enforce this
for Bank metadata and Bank Solutions.

## Session model and presentation behavior

Sessions have three states:

- `draft` — officers prepare and order session problems and their content; members cannot read the session or its problem metadata.
- `live` — members can read the session and its problem metadata; the officer controls each problem's answer visibility, which gates member Solution access.
- `ended` — the session remains in officer history and appears in the public Past sessions archive; all prepared Solutions are public regardless of `answersVisible`.

A session contains multiple ordered problems. Each problem has a description and examples, its own `answersVisible` field, and separately stored solution content. Members choose problems independently in their own view.

The public home shows Live now and Past sessions, including an explicit no-live state. **Show Answers** and **Hide Answers** update `answersVisible` only for a live session; members viewing that Problem receive changes in realtime. Ending a Session changes only its status and does not rewrite child Problems.

## Editors and presentation UI

Show the Problem's shared example input and expected output once before the three Python, Java, and C++ solutions. There is no source-language selector and no translation flow. Monaco editors are editable in Officer Mode for preparing solutions, and read-only in Member Mode.

The interface is presentation-focused: responsive, readable at a distance, and clear on the projected screen used during a CIC Intro session. Preserve a layout that keeps the problem and the three language panels easy to compare.

## Content scope

Officers prepare common interview-style problems and solutions, including topics such as arrays and strings, hash maps and sets, stacks and queues, linked lists, two pointers, sliding window, binary search, trees, graph traversal, recursion, and introductory dynamic programming. The app stores and displays prepared content; it does not assess whether a solution is correct.

## Out of scope

- Accounts, profiles, or authentication for public members.
- Multiple officer accounts or granular officer roles in the proof of concept; it uses one shared officer account.
- Runtime AI or LLM features, prompt engineering, coding model providers, model API keys, or generated explanations.
- Automatic or manual code translation, source-language selection, parsers, Tree-sitter, AST translation, intermediate representations, emitters, or transpilers.
- Code execution, compilers, interpreters, online judging, test runners, or sandboxing.
- Browser `localStorage` as canonical persistence; Firestore is the source of truth.
- Unrelated general-purpose IDE capabilities or arbitrary application translation.

## Product principle

New work should help CIC Intro officers present prepared solutions clearly and help members follow the live session safely and readably.
