import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RichTextRenderer, parseAndSanitizeRichText } from './RichTextRenderer';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

type EditorTab = 'visual' | 'markdown' | 'preview';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Add a detailed description... Use the toolbar above or write markdown',
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('visual');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const visualEditorRef = useRef<HTMLDivElement>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isInternalChangeRef = useRef(false);

  // Sync value into visual editor when initial value changes or tab changes
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

  // Execute a document formatting command in visual WYSIWYG mode
  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (readOnly) return;

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

  // Insert markdown wrappers or line prefixes in markdown source mode
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
      case 'insertLink':
        if (arg) {
          replacement = `[${selectedText || 'link'}](${arg})`;
          cursorOffset = replacement.length;
        }
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
    } else {
      applyMarkdownFormatting('insertChecklist');
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
    } else {
      applyMarkdownFormatting('insertCode');
    }
  };

  const handleInsertHighlight = () => {
    if (activeTab === 'visual') {
      const selection = window.getSelection()?.toString();
      const markHtml = `<mark>${selection || 'highlighted text'}</mark>`;
      executeCommand('insertHTML', markHtml);
    } else {
      const textarea = markdownTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      const replacement = `==${selected || 'highlighted text'}==`;
      const newText = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      onChange(newText);
    }
  };

  const handleOpenLinkModal = () => {
    if (readOnly) return;
    if (activeTab === 'visual') {
      const selection = window.getSelection()?.toString();
      setLinkText(selection || '');
    } else if (markdownTextareaRef.current) {
      const textarea = markdownTextareaRef.current;
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      setLinkText(selected || '');
    }
    setLinkUrl('');
    setShowLinkModal(true);
  };

  const handleConfirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    let formattedUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl) && !/^mailto:/i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    if (activeTab === 'visual') {
      if (visualEditorRef.current) {
        visualEditorRef.current.focus();
        if (linkText) {
          const aTag = `<a href="${formattedUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
          document.execCommand('insertHTML', false, aTag);
        } else {
          document.execCommand('createLink', false, formattedUrl);
        }
        handleVisualInput();
      }
    } else {
      const textarea = markdownTextareaRef.current;
      if (textarea) {
        const textToUse = linkText || selectedMarkdownText() || formattedUrl;
        const markdownLink = `[${textToUse}](${formattedUrl})`;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = textarea.value.substring(0, start) + markdownLink + textarea.value.substring(end);
        onChange(newText);
      }
    }

    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const selectedMarkdownText = () => {
    if (!markdownTextareaRef.current) return '';
    const { selectionStart, selectionEnd, value } = markdownTextareaRef.current;
    return value.substring(selectionStart, selectionEnd);
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
              onClick={handleOpenLinkModal}
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

      {/* Editor Body based on active tab */}
      <div className="rich-editor-body" onKeyDown={handleKeyDown}>
        {activeTab === 'visual' && (
          <div
            ref={visualEditorRef}
            className="rich-visual-editable"
            contentEditable
            onInput={handleVisualInput}
            data-placeholder={placeholder}
            role="textbox"
            aria-multiline="true"
          />
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
          <div className="rich-preview-canvas">
            <RichTextRenderer content={value} placeholder={placeholder} />
          </div>
        )}
      </div>

      {/* Quick Link Insert Modal */}
      {showLinkModal && (
        <div className="rich-link-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="rich-link-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rich-link-modal-header">
              <h4>Insert Link</h4>
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
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
