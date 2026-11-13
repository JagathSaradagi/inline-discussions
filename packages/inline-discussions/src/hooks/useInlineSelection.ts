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

      // Helper to query data-ast-span-id
      const getSpanIdFromNode = (targetContainer: Node | null): { spanId: string; offset: number } => {
        if (!targetContainer) return { spanId: 'span-0', offset: 0 };
        let el: any = targetContainer.nodeType === Node.TEXT_NODE ? targetContainer.parentElement : targetContainer;
        while (el && el !== node) {
          if (el.hasAttribute && el.hasAttribute('data-ast-span-id')) {
            return {
              spanId: el.getAttribute('data-ast-span-id') || 'span-0',
              offset: range.startOffset || 0,
            };
          }
          el = el.parentElement;
        }
        return { spanId: 'span-0', offset: 0 };
      };

      const startSpanInfo = getSpanIdFromNode(range.startContainer ?? null);
      const endSpanInfo = getSpanIdFromNode(range.endContainer ?? null);

      // Resolve content
      const rawContent = getContentForMessage ? getContentForMessage(msgId) : '';
      if (!rawContent) {
        clearSelection();
        return;
      }

      const astMap = getCachedAstSourceMap(msgId, rawContent);

      if (
        startSpanInfo.spanId &&
        endSpanInfo.spanId &&
        astMap.spanMap.has(startSpanInfo.spanId) &&
        astMap.spanMap.has(endSpanInfo.spanId)
      ) {
        const resolved: ResolvedSourceRange = resolveDomSelectionToSourceRange(astMap, {
          startSpanId: startSpanInfo.spanId,
          startOffset: range.startOffset,
          endSpanId: endSpanInfo.spanId,
          endOffset: range.endOffset,
        });

        if (resolved.found && resolved.rawEnd > 0) {
          const payload: SelectionPayload = {
            msgId,
            selectedText: text,
            anchorOffset: resolved.rawEnd,
            rawStart: resolved.rawStart,
            rawEnd: resolved.rawEnd,
            boundingRect: rect,
            domSelection: selection,
          };

          setCurrentSelection(payload);
          onSelectRange?.(payload);
          return;
        }
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
