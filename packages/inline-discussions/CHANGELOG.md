# Changelog

All notable changes to `@zefina/inline-discussions` will be documented in this file.

## [0.1.0] - 2026-11-13

### Added
- **Core AST Engine**: `buildAstSourceMap`, `getCachedAstSourceMap`, `resolveDomSelectionToSourceRange`.
- **Single-Pass Sibling-Block Splitting**: `remarkStructuredAnnotations` partitions overlapping thread intervals and splits paragraph blocks into valid siblings with `<thread-block>` and `<input-block>`.
- **Sanitization Schema**: `zefinaSanitizeSchema` permits custom tags (`<mark>`, `<thread-block>`, `<input-block>`) and data attributes (`data-tid`, `data-ast-span-id`).
- **Tree Reconstruction**: `reconstructTree` and `findAndAddMessageFlat` for flat array hydration and immediate injection.
- **React Components & Hooks**: `InlineDiscussionViewer`, `useInlineSelection`, and `useThreadExpansion`.
- **Standalone Demo**: Minimal Vite/React integration demo running independently without Firebase or backend APIs.
