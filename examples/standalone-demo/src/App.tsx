import React, { useState, useRef, useEffect } from 'react';
import {
  InlineDiscussionViewer,
  useInlineSelection,
  useThreadExpansion,
  reconstructTree,
  findAndAddMessageFlat,
  InlineThreadMessage,
  ActiveInlineInput,
} from '@zefina/inline-discussions';

interface Scenario {
  id: string;
  title: string;
  category: string;
  initialMessage: InlineThreadMessage;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'systems',
    title: 'Distributed Systems Architecture',
    category: 'Engineering / Systems',
    initialMessage: {
      id: 'msg-sys-1',
      authorRole: 'assistant',
      content: `## Distributed State & Consensus

Distributed systems require deterministic consensus algorithms to achieve fault tolerance across independent network partitions.

Raft provides a comprehensible alternative to Paxos, relying on leader election, log replication, and strict safety invariants.

When an election timeout occurs, a follower increments its current term and transitions into candidate state to request votes. Randomized election timeouts prevent split-vote deadlocks during concurrent partition recovery.`,
      timestamp: 1000,
      subThreads: [],
    },
  },
  {
    id: 'security',
    title: 'Code Review & Security Audit',
    category: 'Developer Tools / Security',
    initialMessage: {
      id: 'msg-sec-1',
      authorRole: 'assistant',
      content: `## Memory Safety & Concurrency Audit

The proposed asynchronous worker pool utilizes atomic reference counting combined with read-write mutex locks to protect the shared ring buffer.

However, a potential race condition exists during thread pool teardown: worker threads may access the deallocated channel if the shutdown coordinator terminates prematurely.

To guarantee zero-cost safety, we must replace raw pointer synchronization with crossbeam channels and enforce strict RAII guard drops.`,
      timestamp: 1000,
      subThreads: [],
    },
  },
  {
    id: 'legal',
    title: 'AI Compliance & Legal Analysis',
    category: 'LegalTech / Enterprise',
    initialMessage: {
      id: 'msg-leg-1',
      authorRole: 'assistant',
      content: `## Intellectual Property & Indemnification

Under Section 4.2 of the Enterprise AI Services Master Agreement, the vendor shall defend, indemnify, and hold harmless the customer against third-party copyright claims.

This indemnification is conditioned upon prompt written notice and sole control over legal defense.

Exceptions apply if the customer utilizes proprietary customer datasets that violate third-party confidential disclosures or export regulations.`,
      timestamp: 1000,
      subThreads: [],
    },
  },
];

interface InlineInputBoxProps {
  input: ActiveInlineInput;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

function InlineInputBox({ input, onSubmit, onCancel }: InlineInputBoxProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const nextCursor = e.target.selectionStart;
    setText(nextVal);
    requestAnimationFrame(() => {
      if (textareaRef.current && nextCursor !== null) {
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSubmit(text.trim());
      }
    }
  };

  return (
    <div
      className="input-box"
      data-testid="inline-input-box"
      onClick={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '12px', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
        In-Situ Question: &ldquo;{input.text}&rdquo;
      </div>
      <textarea
        ref={textareaRef}
        rows={2}
        dir="ltr"
        value={text}
        placeholder="Ask a clarifying question at this exact sentence... (Enter to post)"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
      />
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (text.trim()) {
              onSubmit(text.trim());
            }
          }}
        >
          Post Inline Doubt
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState('systems');
  const [scenarioMessages, setScenarioMessages] = useState<Record<string, InlineThreadMessage[]>>({
    systems: [SCENARIOS[0].initialMessage],
    security: [SCENARIOS[1].initialMessage],
    legal: [SCENARIOS[2].initialMessage],
  });

  const activeMessages = scenarioMessages[selectedScenarioId] || [];
  const [activeInput, setActiveInput] = useState<ActiveInlineInput | null>(null);
  const { expandedThreads, toggleThread, expandThread } = useThreadExpansion();
  const containerRef = useRef<HTMLDivElement>(null);

  const { handleMouseUp } = useInlineSelection({
    containerRef,
    getContentForMessage: (msgId) => {
      for (const list of Object.values(scenarioMessages)) {
        const found = list.find((m) => m.id === msgId);
        if (found) return found.content;
      }
      return undefined;
    },
    onSelectRange: ({ msgId, anchorOffset, selectedText }) => {
      setActiveInput({
        msgId,
        anchorOffset,
        text: selectedText,
        draftText: '',
      });
    },
    onClearSelection: () => {
      // Keep activeInput if user is typing
    },
  });

  const handleSubmitDiscussion = (submittedText: string) => {
    if (!activeInput || !submittedText.trim()) return;

    const userMessage: InlineThreadMessage = {
      id: `msg-user-${Date.now()}`,
      content: submittedText.trim(),
      authorRole: 'user',
      timestamp: Date.now(),
    };

    const aiFollowUp: InlineThreadMessage = {
      id: `msg-ai-${Date.now() + 1}`,
      content: `Clarification for "${activeInput.text}": Under asynchronous execution, this invariant ensures linearizability by requiring a deterministic consensus quorum before acknowledging state transitions.`,
      authorRole: 'assistant',
      timestamp: Date.now() + 1,
    };

    // Immediate injection into the message tree
    let { nodes: updatedNodes, subThreadId } = findAndAddMessageFlat(
      activeMessages,
      activeInput.msgId,
      activeInput.anchorOffset,
      activeInput.text,
      userMessage
    );

    if (subThreadId) {
      const { nodes: withAiNodes } = findAndAddMessageFlat(
        updatedNodes,
        activeInput.msgId,
        activeInput.anchorOffset,
        activeInput.text,
        aiFollowUp
      );
      setScenarioMessages((prev) => ({
        ...prev,
        [selectedScenarioId]: withAiNodes,
      }));
      expandThread(subThreadId);
    } else {
      setScenarioMessages((prev) => ({
        ...prev,
        [selectedScenarioId]: updatedNodes,
      }));
    }

    setActiveInput(null);
  };

  const renderHighlightMark = (tid: string, children: React.ReactNode, isExpanded: boolean) => (
    <mark
      data-tid={tid}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={(e) => {
        e.stopPropagation();
        toggleThread(tid);
      }}
      style={{
        cursor: 'pointer',
        borderBottom: isExpanded ? '2px solid #38bdf8' : '2px dashed #38bdf8',
      }}
    >
      {children}
      <span
        style={{
          marginLeft: '4px',
          fontSize: '11px',
          opacity: 0.9,
          verticalAlign: 'baseline',
        }}
      >
        {isExpanded ? '▴' : '💬'}
      </span>
    </mark>
  );

  const renderInputContent = (input: ActiveInlineInput) => (
    <InlineInputBox
      input={input}
      onSubmit={handleSubmitDiscussion}
      onCancel={() => setActiveInput(null)}
    />
  );

  const renderThreadContent = (thread: InlineSubThread, depth: number): React.ReactNode => (
    <div
      className="in-situ-thread-card"
      data-testid="in-situ-thread-card"
      style={
        depth > 0
          ? {
              marginLeft: `${Math.min(depth * 10, 28)}px`,
              borderLeftColor: depth % 2 === 1 ? '#a855f7' : '#38bdf8',
            }
          : undefined
      }
    >
      <div className="in-situ-thread-header">
        <div className="in-situ-thread-title">
          <span
            className="in-situ-badge"
            style={
              depth > 0
                ? {
                    color: depth % 2 === 1 ? '#c084fc' : '#38bdf8',
                    background: depth % 2 === 1 ? 'rgba(192, 132, 252, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                  }
                : undefined
            }
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {depth > 0 ? `Nested Reply (Depth ${depth + 1})` : 'Contextual Clarification'}
          </span>
          {thread.highlightedText && (
            <span className="in-situ-quote-preview">
              &ldquo;{thread.highlightedText}&rdquo;
            </span>
          )}
        </div>
        <button
          type="button"
          className="in-situ-collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggleThread(thread.id);
          }}
          title="Collapse clarification"
        >
          ▲ Collapse
        </button>
      </div>

      <div className="in-situ-messages-list">
        {thread.messages.map((m) => {
          const isUser = m.authorRole === 'user' || m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`in-situ-bubble ${isUser ? 'in-situ-bubble-user' : 'in-situ-bubble-ai'}`}
            >
              <div className="in-situ-bubble-header">
                <span className={`in-situ-author ${isUser ? 'author-user' : 'author-ai'}`}>
                  {isUser ? '👤 Your Question' : `✨ AI Clarification${depth > 0 ? ` (Depth ${depth + 1})` : ''}`}
                </span>
              </div>
              <div className="in-situ-bubble-content">
                <InlineDiscussionViewer
                  message={m}
                  activeInput={activeInput}
                  expandedThreadIds={expandedThreads}
                  onToggleThread={toggleThread}
                  renderHighlightMark={renderHighlightMark}
                  renderThread={renderThreadContent}
                  renderInput={renderInputContent}
                  depth={depth + 1}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const tree = reconstructTree(activeMessages);

  return (
    <div className="container" ref={containerRef} onMouseUp={handleMouseUp}>
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge">Zero-Login Interactive Playground</span>
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
            Standard: Saradagi AST Spec v1.0
          </span>
        </div>
        <h1 style={{ margin: '12px 0 4px', fontSize: '22px', fontWeight: 800 }}>
          In-Situ Recursive Discussions for AI
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
          Highlight any sentence or phrase in the AI document below to branch a contextual discussion right where your question originates.
        </p>

        {/* 3 Pre-Loaded Scenarios */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                setSelectedScenarioId(sc.id);
                setActiveInput(null);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedScenarioId === sc.id ? '1px solid #38bdf8' : '1px solid #334155',
                background: selectedScenarioId === sc.id ? '#0284c7' : '#1e293b',
                color: 'white',
                transition: 'all 0.2s',
              }}
            >
              {sc.title}
            </button>
          ))}
        </div>
      </div>

      <div style={{ lineHeight: '1.8', fontSize: '15px' }}>
        {tree.map((msg) => (
          <InlineDiscussionViewer
            key={msg.id}
            message={msg}
            activeInput={activeInput}
            expandedThreadIds={expandedThreads}
            onToggleThread={toggleThread}
            renderHighlightMark={renderHighlightMark}
            renderThread={renderThreadContent}
            renderInput={renderInputContent}
          />
        ))}
      </div>

      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #334155', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>Engine: @zefina/inline-discussions (AGPL-3.0)</span>
        <span>Creator & Architect: Jagath Saradagi</span>
      </div>
    </div>
  );
}
