/**
 * @zefina/inline-discussions
 * Reusable contextual discussion engine for AI-generated Markdown content.
 */

// Core Types
export * from './types';

// AST Transformation & Source Mapping
export {
  buildAstSourceMap,
  getCachedAstSourceMap,
  invalidateAstSourceMapCache,
  getAstSourceMapCacheSize,
  resolveDomSelectionToSourceRange,
  partitionOverlappingThreads,
  remarkStructuredAnnotations,
} from './ast/astSourceMap';

// HTML Sanitization Schema
export { zefinaSanitizeSchema } from './ast/rehypeSanitizeSchema';

// Tree Reconstruction & Immediate Injection
export { reconstructTree } from './tree/treeReconstruction';
export { findMarkdownOffset, findAndAddMessageFlat } from './tree/messageInsertion';

// React Components & Headless Hooks
export { InlineDiscussionViewer } from './components/InlineDiscussionViewer';
export type { InlineDiscussionViewerProps } from './components/InlineDiscussionViewer';
export { useInlineSelection } from './hooks/useInlineSelection';
export type { UseInlineSelectionOptions, SelectionPayload } from './hooks/useInlineSelection';
export { useThreadExpansion } from './hooks/useThreadExpansion';
