# Saradagi Coordinate-Mapping & Sibling-Block AST Specification (v1.0)

**Standard Title:** In-Situ Recursive Discussion Architecture for AI Markdown Responses  
**Author:** Jagath Saradagi (`jagathsaradagi@gmail.com`)  
**Status:** Living Standard / Reference Specification  
**Version:** 1.0.0 (November 2026)  

---

## 1. Abstract

This specification defines the architectural standard for **In-Situ Recursive Discussions** within AI-generated Markdown content. It addresses the fundamental flaw of linear chat feeds by anchoring contextual discussions directly at precise text passages within rendered Markdown without mutating or invalidating the underlying source document.

---

## 2. Terminology & Definitions

1. **In-Situ Discussion**: A conversational branch instantiated directly beneath the passage that provoked the inquiry, rather than appended to the end of a chronological conversation feed.
2. **Coordinate Drift**: The positional divergence between browser DOM text selection offsets and raw Markdown source string offsets caused by Markdown delimiters (`**`, `*`, `_`, `` ` ``) being stripped or transformed during HTML compilation.
3. **Saradagi AST Span (`AstTextSpan`)**: An atomic text phrasing node in a Markdown Abstract Syntax Tree (mdast) tagged with a unique identifier and an exact index-by-index character mapping array.
4. **Sibling-Block AST Injection**: The structural transformation of an AST block node (e.g. `paragraph`) into multiple sibling blocks at anchor boundaries to host peer discussion blocks (`<thread-block>`, `<input-block>`) without violating HTML5 nesting rules.
5. **Immediate Injection**: Spawning a discussion branch at the exact end-offset of a selection boundary rather than snapping to the end of a sentence or paragraph.

---

## 3. Mathematical Coordinate Mapping Algorithm

### 3.1 The Character Map Formulation
Let $S_{\text{raw}}$ be the raw Markdown source string of length $L_{\text{raw}}$.  
Let $T_{\text{rendered}}$ be the rendered plain-text string of a phrasing node of length $L_{\text{rendered}}$.

For each phrasing node $N$, we compute a character mapping array:
$$\text{charMap}: [0, \dots, L_{\text{rendered}} - 1] \to [0, \dots, L_{\text{raw}} - 1]$$

Where:
$$\text{charMap}[i] = \text{index of rendered character } i \text{ in } S_{\text{raw}}$$

### 3.2 O(1) DOM Range Resolution
Given a browser `Range` with start container span $S_{\text{start}}$, start offset $o_1$, end container span $S_{\text{end}}$, and end offset $o_2$:

1. Lookup span metadata from the cached `AstSourceMap`:
   $$N_{\text{start}} = \text{spanMap}[S_{\text{start}}], \quad N_{\text{end}} = \text{spanMap}[S_{\text{end}}]$$
2. Compute raw boundaries:
   $$\text{rawStart} = N_{\text{start}}.\text{charMap}[o_1]$$
   $$\text{rawEnd} = N_{\text{end}}.\text{charMap}[o_2 - 1] + 1$$
3. Both operations execute in $O(1)$ time complexity, completely eliminating heuristic substring or regular expression searches.

---

## 4. Sibling-Block AST Transformation Algorithm

### 4.1 HTML5 Nesting Constraint
HTML5 specification explicitly forbids block-level containers (`<div>`, `<section>`, `<article>`) as direct descendants of inline paragraph (`<p>`) elements. Injecting an inline discussion thread inside a paragraph triggers browser auto-closing of `<p>` tags, invalidating the DOM hierarchy and causing React hydration mismatches.

### 4.2 Sibling Splitting Operation
When one or more anchor offsets $A = \{a_1, a_2, \dots, a_k\}$ fall within a paragraph $P$ spanning $[p_{\text{start}}, p_{\text{end}}]$:

1. Phrasing children of $P$ are traversed in a single pass.
2. For each anchor $a_i$, phrasing nodes intersecting $a_i$ are split using `splitPhrasingNode()`, cloning parent formatting wrappers (e.g. `emphasis`, `strong`, `inlineCode`) for both fragments.
3. Left-hand phrasing children are enclosed in a new paragraph block:
   $$P_{\text{left}} = \text{Paragraph}(\text{children}_{0 \dots a_i})$$
4. The discussion node is emitted as a peer block:
   $$B_{\text{thread}} = \text{Block}(\text{HTML}(\text{thread-block}))$$
5. Right-hand phrasing children form the subsequent sibling paragraph or undergo further splitting for subsequent anchors.

---

## 5. Persistence & Invariant Guarantees

1. **Source Immutability**: The raw Markdown string $S_{\text{raw}}$ transmitted by the LLM MUST remain 100% byte-for-byte immutable. No markup tags or discussion tokens may be injected into the stored string.
2. **Anchor Determinism**: An inline discussion anchor is uniquely keyed by:
   $$\text{AnchorKey} = (\text{messageId}, \text{rawAnchorOffset})$$
3. **Reconstruction Invariant**: On page reload or session hydration, re-evaluating the AST with stored anchor keys MUST produce a visually and structurally identical DOM tree.

---

## 6. Citation

To cite this specification:
```bibtex
@techreport{saradagi2026specification,
  author = {Jagath Saradagi},
  title = {Saradagi Coordinate-Mapping & Sibling-Block AST Specification (v1.0)},
  institution = {Zefina Labs},
  year = {2026},
  url = {https://github.com/JagathSaradagi/inline-discussions}
}
```
