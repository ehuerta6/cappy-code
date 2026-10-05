# Project Scope

## Product definition

CappyCode is **a live solution showcase platform for CIC Intro sessions**. CIC officers prepare interview-style problems and their solutions ahead of time, then present them to members during a session. Members join through an anonymous, read-only public view.

CappyCode is not an IDE, code translator, transpiler, AI product, online judge, or code-execution tool. All presented source and output are prepared and stored by an officer; the runtime displays that content without generating or executing it.

## Users and access

### Officers

CIC Intro officers are the authenticated content managers and presenters. Firebase Authentication is used only for Officer Mode. The proof of concept has one shared CIC officer account. Officers can create and manage sessions, add and order problems, prepare solution content, and control answer visibility.

### Members

Members are anonymous viewers. They do not create accounts or authenticate. Member Mode provides read-only access only to sessions whose status and publication rules permit member access, such as an eligible `live` session or a published `ended` session. A `draft` session is officer-only. Problem descriptions and examples are safe member-facing metadata for an eligible session, but they are not always publicly readable. Solution documents are readable only when their problem's `answersVisible` is true and the session permits member access under Firestore Security Rules.

## Persistence and architecture

Firestore is the canonical persistence layer. It stores session content, session history, prepared solutions, and each problem's answer visibility. Firebase Authentication protects Officer Mode; public membership does not depend on authentication.

Keep problem metadata separate from solution documents. Metadata includes the problem title, description, examples, order, and `answersVisible`. These fields are member-readable only when the session's status/publication rules permit access; a draft's metadata remains officer-only. Protected solution documents include manually prepared Python, Java, and C++ source and prepared static output for each language. Separation lets Firestore Security Rules enforce answer access independently of what the UI renders.

Firestore Security Rules are the actual hidden-answer permission boundary. A hidden answer must not be readable by an anonymous member client. Solution-document reads require the parent problem's `answersVisible` to be true and the session to permit member access. Rules also restrict session and problem management to authenticated officers. UI state such as **Hide Answers** is not a substitute for these rules.

## Session model and presentation behavior

Sessions have three states:

- `draft` — officers prepare and order session problems and their content; members cannot read the session or its problem metadata.
- `live` — member access is allowed by publication rules; the officer controls the active problem and each problem's answer visibility.
- `ended` — the live presentation is over and the session remains in officer session history; member reads are allowed only if the session is published under the publication rules.

A session contains multiple ordered problems. Each problem has a description and examples, its own `answersVisible` field, and separately stored solution content. Members choose problems independently in their own view.

The officer dashboard provides session creation and management, access to session history, and controls for starting and ending sessions. **Show Answers** and **Hide Answers** update `answersVisible` on the selected problem. Members viewing that problem receive reveal changes in realtime; their problem selection remains local.

## Editors and presentation UI

Show Python, Java, and C++ solutions together. There is no source-language selector and no translation flow. Monaco editors are editable in Officer Mode for preparing solutions, and read-only in Member Mode. Display each language's prepared static output alongside its source where appropriate.

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
