import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { zefinaSanitizeSchema } from '../ast/rehypeSanitizeSchema';
import { remarkStructuredAnnotations } from '../ast/astSourceMap';
import { InlineThreadMessage, InlineSubThread, ActiveInlineInput } from '../types';

export interface InlineDiscussionViewerProps {
  /** The message object containing id, content, and subthreads */
  message: InlineThreadMessage;
  /** Active inline input draft if user is currently creating a discussion in this message */
  activeInput?: ActiveInlineInput | null;
  /** Set of thread IDs currently expanded */
  expandedThreadIds?: Set<string>;
  /** Callback fired when user clicks an anchor to toggle expansion */
  onToggleThread?: (threadId: string) => void;
  /** Custom render function for inline recursive thread branch */
  renderThread?: (thread: InlineSubThread, depth: number) => React.ReactNode;
  /** Custom render function for inline input block */
  renderInput?: (activeInput: ActiveInlineInput) => React.ReactNode;
  /** Custom render function for highlighted mark anchor */
  renderHighlightMark?: (threadId: string, children: React.ReactNode, isExpanded: boolean) => React.ReactNode;
  /** Current recursion depth level (starts at 0) */
  depth?: number;
  /** Additional wrapper CSS class */
  className?: string;
  /** Optional custom ReactMarkdown component overrides */
  components?: Record<string, React.ComponentType<any>>;
}

/**
 * Primary React component that renders Markdown with AST-injected inline discussion
 * threads and input blocks at exact source text locations.
 */
export function InlineDiscussionViewer({
  message,
  activeInput,
  expandedThreadIds,
  onToggleThread,
  renderThread,
  renderInput,
  renderHighlightMark,
  depth = 0,
  className = 'prose max-w-none',
  components: customComponents = {},
}: InlineDiscussionViewerProps) {
  const remarkPlugins = useMemo(() => {
    return [
      remarkGfm,
      () =>
        remarkStructuredAnnotations({
          subThreads: (message.subThreads as any) || [],
          activeInput: activeInput as any,
          msgId: message.id,
        }),
    ];
  }, [message.subThreads, activeInput, message.id]);

  return (
    <div data-msg-id={message.id} className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, zefinaSanitizeSchema]]}
        components={{
          ...customComponents,
          p: ({ children }: any) => {
            const hasBlock =
              Array.isArray(children) &&
              children.some(
                (c: any) =>
                  c?.type?.name === 'thread-block' ||
                  c?.type?.name === 'input-block' ||
                  c?.props?.['data-tid'] ||
                  c?.type === 'thread-block' ||
                  c?.type === 'input-block'
              );
            return hasBlock ? (
              <div className="mb-4 last:mb-0 w-full">{children}</div>
            ) : (
              <p className="mb-4 last:mb-0 inline-block w-full">{children}</p>
            );
          },
          mark: ({ node, ...props }: any) => {
            const tid = props['data-tid'];
            const isExpanded = !!expandedThreadIds?.has(tid);

            if (renderHighlightMark) {
              return <>{renderHighlightMark(tid, props.children, isExpanded)}</>;
            }

            if (tid === 'active') {
              return (
                <span className="bg-blue-600 text-white px-1 rounded font-bold shadow animate-pulse">
                  {props.children}
                </span>
              );
            }

            return (
              <mark
                data-tid={tid}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`Inline annotation: ${isExpanded ? 'Collapse' : 'Expand'} discussion thread`}
                onClick={() => onToggleThread?.(tid)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleThread?.(tid);
                  }
                }}
                className="cursor-pointer font-semibold underline decoration-2 decoration-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 px-0.5 rounded transition-colors"
              >
                {props.children}
              </mark>
            );
          },
          'thread-block': ({ node, ...props }: any) => {
            const tid = props['data-tid'];
            const thread = message.subThreads?.find((s) => s.id === tid);
            if (!thread || !expandedThreadIds?.has(tid)) return null;

            if (renderThread) {
              return <div data-is-thread="true">{renderThread(thread, depth)}</div>;
            }

            // Default unstyled thread container
            return (
              <div
                data-is-thread="true"
                className="my-4 pl-4 border-l-2 border-blue-500 bg-gray-50 dark:bg-gray-800/40 rounded-r p-3"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Discussion (Depth {depth + 1})
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleThread?.(tid)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Hide
                  </button>
                </div>
                {thread.messages.map((m) => (
                  <InlineDiscussionViewer
                    key={m.id}
                    message={m}
                    activeInput={activeInput}
                    expandedThreadIds={expandedThreadIds}
                    onToggleThread={onToggleThread}
                    renderThread={renderThread}
                    renderInput={renderInput}
                    renderHighlightMark={renderHighlightMark}
                    depth={depth + 1}
                  />
                ))}
              </div>
            );
          },
          'input-block': () => {
            if (!activeInput) return null;
            if (renderInput) {
              return <div data-is-input="true">{renderInput(activeInput)}</div>;
            }
            return (
              <div
                data-is-input="true"
                className="my-3 p-3 border border-blue-400 bg-blue-50/50 rounded-lg"
              >
                <p className="text-xs text-blue-700 font-medium">Create inline discussion...</p>
              </div>
            );
          },
        } as any}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  );
}
