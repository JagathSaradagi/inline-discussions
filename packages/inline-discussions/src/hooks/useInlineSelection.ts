import React, { useState, useCallback } from 'react';
import { getCachedAstSourceMap, resolveDomSelectionToSourceRange } from '../ast/astSourceMap';
import { ResolvedSourceRange } from '../types';

export interface SelectionPayload {
  msgId: string;
  selectedText: string;
  anchorOffset: number;
  rawStart: number;
  rawEnd: number;
  boundingRect: DOMRect;
  domSelection: Selection;
}

export interface UseInlineSelectionOptions {
  containerRef?: React.RefObject<HTMLElement | null>;
  getContentForMessage?: (msgId: string) => string | undefined;
  onSelectRange?: (payload: SelectionPayload) => void;
  onClearSelection?: () => void;
  minSelectionLength?: number;
}

/**
 * Headless selection hook that bridges browser DOM ranges
 * back to exact raw Markdown source offsets using AST source maps.
 */
export function useInlineSelection({
  containerRef,
  getContentForMessage,
  onSelectRange,
  onClearSelection,
  minSelectionLength = 1,
}: UseInlineSelectionOptions = {}) {
  const [currentSelection, setCurrentSelection] = useState<SelectionPayload | null>(null);

  const clearSelection = useCallback(() => {
    setCurrentSelection(null);
    onClearSelection?.();
  }, [onClearSelection]);

  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    // Small timeout ensures selection is finalized in browser
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (!text || text.length < minSelectionLength || !selection || selection.rangeCount === 0) {
        clearSelection();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Find closest container with data-msg-id
      let node: HTMLElement | null = range.endContainer.parentElement;
      let msgId: string | null = null;

      while (node && node !== document.body) {
        if (node.hasAttribute && node.hasAttribute('data-msg-id')) {
          msgId = node.getAttribute('data-msg-id');
          break;
        }
        node = node.parentElement;
      }

      if (!msgId) {
        clearSelection();
        return;
      }

      // Helper to query data-ast-span-id, correctly inspecting child element spans if container is an element node
      const getSpanIdFromNode = (targetContainer: Node | null, isEnd: boolean): { spanId: string; offset: number } => {
        if (!targetContainer) return { spanId: 'span-0', offset: 0 };
        let target: Node | null = targetContainer;

        if (target.nodeType === Node.ELEMENT_NODE && target.childNodes.length > 0) {
          const childIndex = isEnd ? Math.max(0, range.endOffset - 1) : Math.min(range.startOffset, target.childNodes.length - 1);
          if (target.childNodes[childIndex]) {
            target = target.childNodes[childIndex];
          }
        }

        let el: any = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
        while (el && el !== node) {
          if (el.hasAttribute && el.hasAttribute('data-ast-span-id')) {
            return {
              spanId: el.getAttribute('data-ast-span-id') || 'span-0',
              offset: isEnd ? range.endOffset : range.startOffset,
            };
          }
          el = el.parentElement;
        }
        return { spanId: 'span-0', offset: 0 };
      };

      const startSpanInfo = getSpanIdFromNode(range.startContainer ?? null, false);
      const endSpanInfo = getSpanIdFromNode(range.endContainer ?? null, true);

      // Resolve content
      const rawContent = getContentForMessage ? getContentForMessage(msgId) : '';
      if (!rawContent) {
        clearSelection();
        return;
      }

      const astMap = getCachedAstSourceMap(msgId, rawContent);

      let resolved: ResolvedSourceRange = { rawStart: -1, rawEnd: -1, selectedText: '', found: false };

      if (
        startSpanInfo.spanId &&
        endSpanInfo.spanId &&
        astMap.spanMap.has(startSpanInfo.spanId) &&
        astMap.spanMap.has(endSpanInfo.spanId)
      ) {
        resolved = resolveDomSelectionToSourceRange(astMap, {
          startSpanId: startSpanInfo.spanId,
          startOffset: range.startOffset,
          endSpanId: endSpanInfo.spanId,
          endOffset: range.endOffset,
        });
      }

      // Exact substring verification: ensures resolved offsets never point to wrong paragraph
      let rawStart = resolved.rawStart;
      let rawEnd = resolved.rawEnd;

      const sliceMatches = resolved.found && rawContent.slice(rawStart, rawEnd).trim() === text;
      if (!sliceMatches) {
        const matchIdx = rawContent.indexOf(text);
        if (matchIdx !== -1) {
          rawStart = matchIdx;
          rawEnd = matchIdx + text.length;
          resolved = { rawStart, rawEnd, selectedText: text, found: true };
        }
      }

      if (resolved.found && rawEnd > 0) {
        const payload: SelectionPayload = {
          msgId,
          selectedText: text,
          anchorOffset: rawEnd,
          rawStart: rawStart,
          rawEnd: rawEnd,
          boundingRect: rect,
          domSelection: selection,
        };

        setCurrentSelection(payload);
        onSelectRange?.(payload);
        return;
      }

      clearSelection();
    }, 10);
  }, [clearSelection, getContentForMessage, minSelectionLength, onSelectRange]);

  return {
    handleMouseUp,
    currentSelection,
    clearSelection,
  };
}
