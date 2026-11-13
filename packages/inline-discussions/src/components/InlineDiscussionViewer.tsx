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

            // Default clean thread container fallback
            return (
              <div
                data-is-thread="true"
                style={{
                  margin: '12px 0',
                  padding: '12px 16px',
                  borderLeft: '3px solid #38bdf8',
                  background: 'rgba(15, 23, 42, 0.65)',
                  borderRadius: '0 8px 8px 0',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Contextual Clarification
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleThread?.(tid)}
                    style={{ fontSize: '11px', color: '#94a3b8', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                  >
                    ▲ Collapse
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {thread.messages.map((m) => {
                    const isUser = m.authorRole === 'user' || m.sender === 'user';
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isUser ? '#1e293b' : '#0f172a',
                          border: `1px solid ${isUser ? '#334155' : 'rgba(56, 189, 248, 0.2)'}`,
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: isUser ? '#cbd5e1' : '#38bdf8', marginBottom: '4px' }}>
                          {isUser ? '👤 Question' : '✨ AI Clarification'}
                        </div>
                        <div style={{ fontSize: '13.5px', color: '#f1f5f9', lineHeight: '1.5' }}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
