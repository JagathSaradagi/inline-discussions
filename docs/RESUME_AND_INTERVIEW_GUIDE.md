# Resume & Technical Interview Guide: Zefina Inline Discussion Engine

## 1. Resume Bullet Points

### For Software Engineering / Full-Stack Roles:
- **Open-Source Inline Discussion Engine (TypeScript, React, Markdown AST)**
  - Engineered and released `@zefina/inline-discussions`, a reusable React engine for anchoring contextual, recursive discussion threads directly inside AI-generated Markdown responses.
  - Implemented precise DOM-to-AST source coordinate mapping using `unified` and `remark-parse`, translating browser text selections across Markdown formatting delimiters without modifying original source text.
  - Designed single-pass sibling-block AST paragraph splitting to insert discussion containers and input drafts while preserving HTML5 DOM compliance and React hydration integrity.
  - Built an automated testing suite comprising 47 unit tests and multi-scenario Playwright E2E suites validating multi-anchor persistence, session hydration, and recursive thread reconstruction.
  - Extracted the engine into an independent npm package (26 kB payload) accompanied by an isolated Vite demo and documentation.

### For AI Product / Frontend Specialist Roles:
- **Contextual Discussion Architecture for LLM Interfaces**
  - Architected an in-situ discussion framework that eliminates the need to ask follow-up questions at the bottom of long AI conversations, placing threads where questions originate.
  - Built headless React hooks (`useInlineSelection`, `useThreadExpansion`) and unstyled component slots supporting arbitrary nested discussions at infinite depth levels.
  - Optimized AST compilation latency using an LRU-bounded source map cache, achieving sub-millisecond selection lookups and eliminating re-parse overhead.

---

## 2. Technical Interview Questions & Answers

### Q1: "Why not just do a simple substring search or regex on the selected text?"
> **Answer:** "A naive substring search has three critical failure modes:
> 1. **Ambiguity**: The same word or sentence can appear multiple times in a document, causing discussions to anchor to the wrong paragraph.
> 2. **Delimiter Mismatch**: If the user highlights text styled with Markdown (like `**bold**` or `` `code` ``), the browser DOM selection contains plain text without delimiters, making string indices inconsistent with raw Markdown.
> 3. **Formatting Boundary Splits**: When a selection starts in plain text and ends inside an italicized word, naive string insertion breaks the Markdown syntax tree.
> By compiling an `AstSourceMap` with exact character-to-source maps (`charMap: number[]`) tied to DOM span IDs (`data-ast-span-id`), we resolve exact UTF-16 source indices in $O(1)$ time regardless of repeated words or markdown syntax."

---

### Q2: "Why did you use sibling-block AST injection instead of just wrapping text in a `<div>`?"
> **Answer:** "HTML5 specifications forbid block-level elements (such as `<div>`, `<section>`, or `<article>`) inside `<p>` paragraphs. Doing so causes the browser's DOM parser to auto-close the paragraph prematurely, which breaks React DOM reconciliation and leads to hydration mismatch warnings.
> Instead, our AST compiler plugin (`remarkStructuredAnnotations`) splits the AST paragraph node into two sibling paragraphs and inserts the discussion block as a true peer between them. This maintains 100% valid HTML, avoids hydration bugs, and allows rich interactive UI blocks to expand naturally."

---

### Q3: "How does the engine handle multiple overlapping discussions or nested discussions?"
> **Answer:** "We implemented `partitionOverlappingThreads` which sorts anchor positions and partitions them into non-overlapping interval slices before emitting sibling blocks. For recursive nesting, each message in the thread is hydrated into an identical AST pipeline with an incremented `depth` counter, allowing conversations to branch infinitely while preserving deterministic chronological order."

---

### Q4: "How does this engine integrate with different databases or AI providers?"
> **Answer:** "The library is completely headless regarding persistence and inference. The host application provides message data as a flat array with `parentId` and `threadId` pointers. The library's pure function `reconstructTree` builds the hierarchy in memory. When a user submits an inline question, the library's `findAndAddMessageFlat` computes the exact injection boundary and emits updated immutable state. The host application then saves this to whatever database it uses (Firebase, PostgreSQL, Supabase) and streams AI tokens via standard callbacks."
