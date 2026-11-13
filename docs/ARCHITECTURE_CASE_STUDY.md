# Architecture Case Study: Building an Inline Recursive Discussion Engine for AI Markdown Responses

**Author:** Jagath Saradagi  
**Repository:** [github.com/JagathSaradagi/zefina-inline-discussions](https://github.com/JagathSaradagi)  
**Package:** `@zefina/inline-discussions`  

---

## 1. Executive Summary

In current AI chat interfaces (ChatGPT, Claude, Gemini), user follow-ups are appended chronologically at the bottom of the conversation feed. When an AI generates a multi-paragraph technical explanation and the user has a doubt about a single sentence in paragraph one, quoting that text and asking at the bottom breaks reading flow and context.

`@zefina/inline-discussions` introduces **in-situ recursive discussion threading**: users highlight any sentence or phrase within an AI-generated Markdown response to anchor contextual questions directly at that exact passage. Subsequent clarifying messages and recursive discussions branch immediately below the referenced sentence without mutating or breaking the original Markdown document.

---

## 2. Key Technical Challenges & Solutions

### Challenge 1: The Markdown Delimiter Mismatch
When Markdown is compiled to HTML, raw Markdown delimiters (such as `**bold**`, `*italic*`, `` `code` ``) are parsed into DOM tags (`<strong>`, `<em>`, `<code>`). If a user selects text in the rendered browser window, standard DOM API offsets (`Range.startOffset`, `Range.endOffset`) index into rendered text, **not** raw Markdown source text.

Naive approaches (such as substring matching or simple regexes) fail when:
- Identical sentences appear multiple times.
- Selections span across formatted boundaries (e.g., half plain text, half bold).
- Formatting symbols shift indices.

**Our Solution: AST Text Span Character Mapping (`charMap`)**
1. During Markdown compilation via `unified` and `remark-parse`, we construct an `AstSourceMap`.
2. Each phrasing node receives a unique identifier (`span-0`, `span-1`, ...) rendered as a `data-ast-span-id` attribute in the DOM.
3. For each span, we generate a UTF-16 character map (`charMap: number[]`) mapping every rendered character index directly to its exact raw source byte/character offset.
4. When the user finishes a selection, `useInlineSelection` looks up `data-ast-span-id` on the selection container and performs an $O(1)$ coordinate translation back to raw Markdown source offsets.

```
Rendered:  "consensus algorithms"  (Offsets 0 to 20 inside span-2)
charMap:   [145, 146, 147, 148, 149, ...]
Raw Offset: rawStart: 145, rawEnd: 165
```

---

### Challenge 2: Sibling-Block Injection vs. Invalid HTML
Injecting discussion containers or textarea inputs directly inside an inline HTML `<p>` tag violates HTML5 specifications (a `<div>` cannot legally be a child of a `<p>`) and causes severe React DOM hydration mismatch warnings.

**Our Solution: Single-Pass Sibling-Block AST Splitting**
Instead of wrapping text inside block elements, our AST plugin (`remarkStructuredAnnotations`) splits the parent AST paragraph at the exact anchor boundary into two sibling paragraphs:

```markdown
<!-- Before Splitting -->
Paragraph: "Distributed systems require consensus. Raft is an alternative."

<!-- After AST Splitting -->
Paragraph 1: "Distributed systems require consensus."
<thread-block data-tid="t-101"> ... Discussion Container ... </thread-block>
Paragraph 2: "Raft is an alternative."
```

If the selection ends inside an inline formatting node (e.g. bold or code), `splitPhrasingNode` splits the phrasing node while cloning and preserving its outer formatting wrappers on both sides.

---

### Challenge 3: Decoupled Architecture & Monorepo Extraction
The feature initially lived inside Zefina's production chat application, tightly integrated with Firebase Firestore and Groq LLM streaming.

To release the engine as a standalone open-source developer tool:
1. **Generic Type System**: Replaced app-specific data models with `InlineThreadMessage` and `InlineSubThread`.
2. **Pluggable Render Slots**: Designed `InlineDiscussionViewer` to accept custom render props (`renderThread`, `renderInput`, `renderHighlightMark`), giving host developers total styling and behavioral freedom.
3. **Host-Controlled Persistence**: The library handles in-memory tree reconstruction and AST transformation; persistence is completely delegated to host-controlled callbacks (`onSubmit`, `onToggle`).

---

## 3. Automated Verification & Testing Matrix

To guarantee mathematical correctness and prevent regressions, the engine is covered by automated unit and E2E suites:

- **28 AST Unit Tests**: Validates phrasing node splits, formatting preservation, boundary snapping, and cache eviction.
- **19 Tree Reconstruction Tests**: Verifies recursive hierarchy hydration, chronological sorting, and duplicate pruning.
- **Browser Playwright E2E Tests**:
  - `session-lifecycle-stress.spec.ts`: Tests multi-anchor selection, rapid session switching, draft text purging, and browser page reload rehydration.
  - `standalone-demo.spec.ts`: End-to-end browser test proving the library functions independently in an external Vite app with zero Firebase dependencies.
