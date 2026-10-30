import './RichTextEditor.scss';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RichTextRenderer, parseAndSanitizeRichText } from '../RichTextRenderer';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  defaultTab?: EditorTab;
}

type EditorTab = 'visual' | 'markdown' | 'preview';

interface LinkPopoverState {
  visible: boolean;
  url: string;
  text: string;
  top: number;
  left: number;
  targetElement: HTMLAnchorElement | null;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Add a detailed description... Use the toolbar above or write markdown',
  readOnly = false,
  defaultTab = 'preview',
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>(defaultTab);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkPopover, setLinkPopover] = useState<LinkPopoverState>({
    visible: false,
    url: '',
    text: '',
    top: 0,
    left: 0,
    targetElement: null,
  });

  const visualEditorRef = useRef<HTMLDivElement>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isInternalChangeRef = useRef(false);

  // Stored cursor / range positions to prevent inserting at the start
  const savedRangeRef = useRef<Range | null>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const editingLinkElementRef = useRef<HTMLAnchorElement | null>(null);
  const linkOverlayMouseDownRef = useRef(false);

  // Sync value into visual editor when value changes externally or tab switches
  useEffect(() => {
    if (activeTab === 'visual' && visualEditorRef.current) {
      if (!isInternalChangeRef.current) {
        visualEditorRef.current.innerHTML = value ? parseAndSanitizeRichText(value) : '';
      }
      isInternalChangeRef.current = false;
    }
  }, [value, activeTab]);

  const handleVisualInput = useCallback(() => {
    if (!visualEditorRef.current) return;
    isInternalChangeRef.current = true;
    const currentHtml = visualEditorRef.current.innerHTML;
    onChange(currentHtml === '<br>' ? '' : currentHtml);
  }, [onChange]);

  // Execute formatting command in Visual, Markdown, or Preview mode
  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (readOnly) return;

    if (activeTab === 'preview') {
      setActiveTab('visual');
      setTimeout(() => {
        if (visualEditorRef.current) {
          visualEditorRef.current.focus();
          document.execCommand(command, false, arg);
          handleVisualInput();
        }
      }, 0);
      return;
    }

    if (activeTab === 'visual') {
      if (visualEditorRef.current) {
        visualEditorRef.current.focus();
        document.execCommand(command, false, arg);
        handleVisualInput();
      }
    } else if (activeTab === 'markdown') {
      applyMarkdownFormatting(command, arg);
    }
  };

  // Insert markdown wrappers or line prefixes in markdown mode
  const applyMarkdownFormatting = (command: string, arg?: string) => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (command) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'underline':
        replacement = `<u>${selectedText || 'underlined text'}</u>`;
        cursorOffset = selectedText ? replacement.length : 3;
        break;
      case 'strikeThrough':
        replacement = `~~${selectedText || 'strikethrough text'}~~`;
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'h1':
        replacement = `\n# ${selectedText || 'Heading 1'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'h2':
        replacement = `\n## ${selectedText || 'Heading 2'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'h3':
        replacement = `\n### ${selectedText || 'Heading 3'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'insertUnorderedList':
        replacement = `\n- ${selectedText || 'List item'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'insertOrderedList':
        replacement = `\n1. ${selectedText || 'Numbered item'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'insertChecklist':
        replacement = `\n- [ ] ${selectedText || 'Task item'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'formatBlock':
        if (arg === 'blockquote') {
          replacement = `\n> ${selectedText || 'Quote'}\n`;
        } else if (arg === 'pre') {
          replacement = `\n\`\`\`\n${selectedText || 'code'}\n\`\`\`\n`;
        }
        cursorOffset = replacement.length;
        break;
      case 'insertCode':
        replacement = selectedText.includes('\n')
          ? `\n\`\`\`\n${selectedText}\n\`\`\`\n`
          : `\`${selectedText || 'code'}\``;
        cursorOffset = replacement.length;
        break;
      case 'insertHorizontalRule':
        replacement = `\n---\n`;
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };

  const handleInsertChecklist = () => {
    if (activeTab === 'visual') {
      const checklistHtml = `<ul class="rich-checklist"><li class="rich-checklist-item"><input type="checkbox" /> <span>Task item</span></li></ul>`;
      executeCommand('insertHTML', checklistHtml);
    } else if (activeTab === 'markdown') {
      applyMarkdownFormatting('insertChecklist');
    } else {
      setActiveTab('visual');
      setTimeout(() => {
        const checklistHtml = `<ul class="rich-checklist"><li class="rich-checklist-item"><input type="checkbox" /> <span>Task item</span></li></ul>`;
        executeCommand('insertHTML', checklistHtml);
      }, 0);
    }
  };

  const handleInsertCode = () => {
    if (activeTab === 'visual') {
      const selection = window.getSelection()?.toString();
      if (selection && selection.includes('\n')) {
        executeCommand('formatBlock', '<pre>');
      } else {
        const codeHtml = `<code>${selection || 'code'}</code>`;
        executeCommand('insertHTML', codeHtml);
      }
    } else if (activeTab === 'markdown') {
      applyMarkdownFormatting('insertCode');
    } else {
      setActiveTab('visual');
      setTimeout(() => {
        const selection = window.getSelection()?.toString();
        if (selection && selection.includes('\n')) {
          executeCommand('formatBlock', '<pre>');
        } else {
          const codeHtml = `<code>${selection || 'code'}</code>`;
          executeCommand('insertHTML', codeHtml);
        }
      }, 0);
    }
  };

  const handleInsertHighlight = () => {
    if (activeTab === 'visual') {
      const selection = window.getSelection()?.toString();
      const markHtml = `<mark>${selection || 'highlighted text'}</mark>`;
      executeCommand('insertHTML', markHtml);
    } else if (activeTab === 'markdown') {
      const textarea = markdownTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      const replacement = `==${selected || 'highlighted text'}==`;
      const newText = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      onChange(newText);
    } else {
      setActiveTab('visual');
      setTimeout(() => {
        const selection = window.getSelection()?.toString();
        const markHtml = `<mark>${selection || 'highlighted text'}</mark>`;
        executeCommand('insertHTML', markHtml);
      }, 0);
    }
  };

  // Open Link Modal with exact cursor range preserved
  const handleOpenLinkModal = (existingLinkEl?: HTMLAnchorElement | null) => {
    if (readOnly) return;

    if (activeTab === 'preview') {
      setActiveTab('visual');
    }

    if (existingLinkEl) {
      editingLinkElementRef.current = existingLinkEl;
      setLinkUrl(existingLinkEl.getAttribute('href') || '');
      const rawText = existingLinkEl.textContent || '';
      setLinkText(rawText.replace(/^blank["']\s+rel=["'][^"']*["'][^>]*>\s*/i, ''));
      savedRangeRef.current = null;
    } else if (activeTab === 'visual' || activeTab === 'preview') {
      editingLinkElementRef.current = null;
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Ensure range is within our editor
        if (visualEditorRef.current?.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        } else {
          savedRangeRef.current = null;
        }
      } else {
        savedRangeRef.current = null;
      }
      setLinkText(selection?.toString() || '');
      setLinkUrl('');
    } else if (markdownTextareaRef.current) {
      editingLinkElementRef.current = null;
      const textarea = markdownTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      savedSelectionRef.current = { start, end };
      setLinkText(textarea.value.substring(start, end));
      setLinkUrl('');
    }

    setLinkPopover((prev) => ({ ...prev, visible: false }));
    setShowLinkModal(true);
  };

  // Confirm Link insertion at exact preserved cursor position
  const handleConfirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    let formattedUrl = linkUrl.trim();
    if (
      !/^https?:\/\//i.test(formattedUrl) &&
      !/^mailto:/i.test(formattedUrl) &&
      !formattedUrl.startsWith('#') &&
      !formattedUrl.startsWith('/')
    ) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const textToDisplay = linkText.trim() || formattedUrl;

    if (activeTab === 'visual' && visualEditorRef.current) {
      visualEditorRef.current.focus();

      // If editing an existing link element
      if (editingLinkElementRef.current && visualEditorRef.current.contains(editingLinkElementRef.current)) {
        editingLinkElementRef.current.setAttribute('href', formattedUrl);
        editingLinkElementRef.current.setAttribute('title', formattedUrl);
        editingLinkElementRef.current.textContent = textToDisplay;
        editingLinkElementRef.current = null;
      } else {
        // Restore saved range so the link is NOT placed at the beginning
        const selection = window.getSelection();
        let range = savedRangeRef.current;

        if (!range && selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
        }

        const aTag = document.createElement('a');
        aTag.setAttribute('href', formattedUrl);
        aTag.setAttribute('target', '_blank');
        aTag.setAttribute('rel', 'noopener noreferrer');
        aTag.setAttribute('title', formattedUrl);
        aTag.textContent = textToDisplay;

        if (range && visualEditorRef.current.contains(range.commonAncestorContainer)) {
          range.extractContents();
          range.insertNode(aTag);

          // Place caret right after the inserted link
          const newRange = document.createRange();
          newRange.setStartAfter(aTag);
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } else {
          // If no range found, append at the end
          visualEditorRef.current.appendChild(aTag);
        }
      }

      savedRangeRef.current = null;
      handleVisualInput();
    } else if (markdownTextareaRef.current) {
      const textarea = markdownTextareaRef.current;
      const start = savedSelectionRef.current ? savedSelectionRef.current.start : textarea.value.length;
      const end = savedSelectionRef.current ? savedSelectionRef.current.end : textarea.value.length;
      const markdownLink = `[${textToDisplay}](${formattedUrl})`;
      const newText = textarea.value.substring(0, start) + markdownLink + textarea.value.substring(end);
      onChange(newText);
      savedSelectionRef.current = null;

      setTimeout(() => {
        textarea.focus();
        const nextPos = start + markdownLink.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 0);
    }

    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Handle click on links inside Visual WYSIWYG mode
  const handleVisualClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');

    if (link && link.href) {
      // 1. If Ctrl / Cmd key is pressed, open immediately!
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(link.href, '_blank', 'noopener,noreferrer');
        return;
      }

      // 2. Otherwise display interactive floating link bubble
      const rect = link.getBoundingClientRect();
      const containerRect = visualEditorRef.current?.getBoundingClientRect();

      if (containerRect) {
        setLinkPopover({
          visible: true,
          url: link.href,
          text: link.textContent || '',
          top: rect.bottom - containerRect.top + 6,
          left: Math.max(8, rect.left - containerRect.left),
          targetElement: link as HTMLAnchorElement,
        });
      }
    } else {
      // Clicked outside any link
      if (linkPopover.visible) {
        setLinkPopover((prev) => ({ ...prev, visible: false }));
      }
    }
  };

  // Popover Actions
  const handleOpenPopoverLink = () => {
    if (linkPopover.url) {
      window.open(linkPopover.url, '_blank', 'noopener,noreferrer');
    }
    setLinkPopover((prev) => ({ ...prev, visible: false }));
  };

  const handleEditPopoverLink = () => {
    if (linkPopover.targetElement) {
      handleOpenLinkModal(linkPopover.targetElement);
    }
  };

  const handleRemovePopoverLink = () => {
    if (linkPopover.targetElement && visualEditorRef.current) {
      const text = linkPopover.targetElement.textContent || '';
      const textNode = document.createTextNode(text);
      linkPopover.targetElement.parentNode?.replaceChild(textNode, linkPopover.targetElement);
      handleVisualInput();
    }
    setLinkPopover((prev) => ({ ...prev, visible: false }));
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        executeCommand('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        executeCommand('italic');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        executeCommand('underline');
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleOpenLinkModal();
      }
    }
  };

  if (readOnly) {
    return (
      <div className="rich-editor-readonly">
        <div className="rich-readonly-badge">
          <span>Read Only</span>
        </div>
        <RichTextRenderer content={value} />
      </div>
    );
  }

  return (
    <div className="rich-editor-container">
      {/* Top Header: Toolbar & Mode Tabs */}
      <div className="rich-editor-header">
        <div className="rich-editor-toolbar" role="toolbar" aria-label="Rich text formatting">
          {/* Format Group */}
          <div className="rich-toolbar-group">
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('bold')}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('italic')}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('underline')}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('strikeThrough')}
              title="Strikethrough"
            >
              <s>S</s>
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={handleInsertHighlight}
              title="Highlight"
            >
              <span className="rich-highlight-icon">H</span>
            </button>
          </div>

          <div className="rich-toolbar-divider" />

          {/* Headings */}
          <div className="rich-toolbar-group">
            <button
              type="button"
              className="rich-toolbar-btn rich-btn-heading"
              onClick={() => {
                if (activeTab === 'visual') executeCommand('formatBlock', '<h1>');
                else applyMarkdownFormatting('h1');
              }}
              title="Heading 1"
            >
              H1
            </button>
            <button
              type="button"
              className="rich-toolbar-btn rich-btn-heading"
              onClick={() => {
                if (activeTab === 'visual') executeCommand('formatBlock', '<h2>');
                else applyMarkdownFormatting('h2');
              }}
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              className="rich-toolbar-btn rich-btn-heading"
              onClick={() => {
                if (activeTab === 'visual') executeCommand('formatBlock', '<h3>');
                else applyMarkdownFormatting('h3');
              }}
              title="Heading 3"
            >
              H3
            </button>
          </div>

          <div className="rich-toolbar-divider" />

          {/* Lists & Checklists */}
          <div className="rich-toolbar-group">
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('insertUnorderedList')}
              title="Bullet List"
            >
              •≡
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('insertOrderedList')}
              title="Numbered List"
            >
              1≡
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={handleInsertChecklist}
              title="Checklist / Task List"
            >
              ☑
            </button>
          </div>

          <div className="rich-toolbar-divider" />

          {/* Inserts & Quotes */}
          <div className="rich-toolbar-group">
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => {
                if (activeTab === 'visual') executeCommand('formatBlock', '<blockquote>');
                else applyMarkdownFormatting('formatBlock', 'blockquote');
              }}
              title="Blockquote"
            >
              &rdquo;
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={handleInsertCode}
              title="Inline Code / Code Block"
            >
              &lt;&gt;
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => handleOpenLinkModal()}
              title="Insert Link (Ctrl+K)"
            >
              🔗
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => {
                if (activeTab === 'visual') executeCommand('insertHorizontalRule');
                else applyMarkdownFormatting('insertHorizontalRule');
              }}
              title="Horizontal Divider"
            >
              &mdash;
            </button>
          </div>

          <div className="rich-toolbar-divider" />

          {/* Undo / Clean */}
          <div className="rich-toolbar-group">
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('undo')}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="rich-toolbar-btn"
              onClick={() => executeCommand('removeFormat')}
              title="Clear Formatting"
            >
              🧹
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="rich-editor-tabs">
          <button
            type="button"
            className={`rich-tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
            onClick={() => setActiveTab('visual')}
            title="Visual WYSIWYG Editor"
          >
            Visual
          </button>
          <button
            type="button"
            className={`rich-tab-btn ${activeTab === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('markdown')}
            title="Markdown Source Editor"
          >
            Markdown
          </button>
          <button
            type="button"
            className={`rich-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
            title="Rendered Output Preview"
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="rich-editor-body" onKeyDown={handleKeyDown}>
        {activeTab === 'visual' && (
          <div
            ref={visualEditorRef}
            className="rich-visual-editable"
            contentEditable
            onInput={handleVisualInput}
            onClick={handleVisualClick}
            data-placeholder={placeholder}
            role="textbox"
            aria-multiline="true"
          />
        )}

        {/* Floating Link Popover in Visual Mode */}
        {activeTab === 'visual' && linkPopover.visible && (
          <div
            className="rich-link-popover"
            style={{ top: `${linkPopover.top}px`, left: `${linkPopover.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rich-link-popover-url" title={linkPopover.url}>
              🔗 {linkPopover.url}
            </span>
            <button
              type="button"
              className="rich-link-popover-btn"
              onClick={handleOpenPopoverLink}
              title="Open link in new tab"
            >
              ↗ Open
            </button>
            <button
              type="button"
              className="rich-link-popover-btn"
              onClick={handleEditPopoverLink}
              title="Edit link URL or text"
            >
              ✎ Edit
            </button>
            <button
              type="button"
              className="rich-link-popover-btn btn-remove"
              onClick={handleRemovePopoverLink}
              title="Remove link"
            >
              ✕ Unlink
            </button>
          </div>
        )}

        {activeTab === 'markdown' && (
          <textarea
            ref={markdownTextareaRef}
            className="rich-markdown-textarea"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={7}
          />
        )}

        {activeTab === 'preview' && (
          <div
            className="rich-preview-canvas"
            onDoubleClick={() => !readOnly && setActiveTab('visual')}
            title={!readOnly ? "Double-click to edit description" : undefined}
          >
            <RichTextRenderer content={value} placeholder={placeholder} />
          </div>
        )}
      </div>

      {/* Quick Link Insert / Edit Modal */}
      {showLinkModal && (
        <div
          className="rich-link-modal-overlay"
          onMouseDown={(e) => {
            linkOverlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (linkOverlayMouseDownRef.current && e.target === e.currentTarget) {
              setShowLinkModal(false);
            }
            linkOverlayMouseDownRef.current = false;
          }}
        >
          <div
            className="rich-link-modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rich-link-modal-header">
              <h4>{editingLinkElementRef.current ? 'Edit Link' : 'Insert Link'}</h4>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowLinkModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleConfirmLink}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label>Text (optional)</label>
                <input
                  type="text"
                  placeholder="Link display text..."
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>Web Address (URL) *</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLinkModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingLinkElementRef.current ? 'Save Link' : 'Insert Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
