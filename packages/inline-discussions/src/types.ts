/**
 * @zefina/inline-discussions
 * Core generic data models for inline contextual threads.
 * Free of Firebase, AI models, and host application state.
 */

export interface AstTextSpan {
  id: string;
  type: string;
  text: string;
  rawStart: number;
  rawEnd: number;
  parentType: string | null;
  charMap: number[];
}

export interface AstSourceMap {
  rawContent: string;
  spans: AstTextSpan[];
  spanMap: Map<string, AstTextSpan>;
}

export interface DomSelectionCoordinates {
  startSpanId: string;
  startOffset: number;
  endSpanId: string;
  endOffset: number;
}

export interface ResolvedSourceRange {
  rawStart: number;
  rawEnd: number;
  selectedText: string;
  found: boolean;
}

export interface OverlappingThread {
  id: string;
  start: number;
  end: number;
}

export interface SegmentedSpan {
  start: number;
  end: number;
  threadIds: string[];
}

export interface InlineThreadMessage {
  id: string;
  content: string;
  sender?: 'user' | 'assistant' | string;
  authorRole?: 'user' | 'assistant' | string;
  parentId?: string | null;
  threadId?: string | null;
  timestamp?: number;
  subThreads?: InlineSubThread[];
  [key: string]: unknown;
}

export interface InlineSubThread {
  id: string;
  anchorOffset: number;
  highlightStart?: number;
  highlightEnd?: number;
  highlightedText?: string;
  messages: InlineThreadMessage[];
  [key: string]: unknown;
}

export interface ActiveInlineInput {
  msgId: string;
  anchorOffset: number;
  text: string;
  draftText?: string;
  errorState?: string | null;
}
