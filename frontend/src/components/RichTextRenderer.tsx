import React from 'react';

/**
 * Strips HTML and Markdown formatting to extract a clean single-line plain-text snippet
 * for compact display on Kanban cards, table cells, and list rows.
 */
export const stripRichTextToSnippet = (content?: string | null): string => {
  if (!content) return '';
  return content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/-\s+\[[ xX]\]\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Parses markdown syntax and sanitizes HTML tags to produce safe, fully clickable rich HTML markup.
 */
export const parseAndSanitizeRichText = (rawContent?: string | null): string => {
  if (!rawContent || !rawContent.trim()) return '';

  let html = rawContent;

  // 1. Preserve fenced code blocks so internal markdown is not modified
  const codeBlocks: string[] = [];
  html = html.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</code></pre>`);
    return placeholder;
  });

  // 2. Convert markdown links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 3. Convert markdown headers (#, ##, ###)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Convert blockquotes (> quote)
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 5. Convert horizontal rules (---, ***, ___)
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr />');

  // 6. Convert task checklists (- [ ] or - [x])
  html = html.replace(
    /^[-*]\s+\[ \]\s+(.*)$/gim,
    '<li class="rich-checklist-item"><input type="checkbox" disabled /> <span>$1</span></li>'
  );
  html = html.replace(
    /^[-*]\s+\[[xX]\]\s+(.*)$/gim,
    '<li class="rich-checklist-item"><input type="checkbox" checked disabled /> <span style="text-decoration: line-through; opacity: 0.8;">$1</span></li>'
  );

  // 7. Convert unordered lists (- or *)
  html = html.replace(/^[-*]\s+(?!\[[ xX]\])(.*)$/gim, '<li>$1</li>');

  // 8. Convert ordered lists (1. )
  html = html.replace(/^\d+\.\s+(.*)$/gim, '<li>$1</li>');

  // 9. Wrap adjacent list items in <ul>
  html = html.replace(/(<li[\s\S]*?<\/li>)+/gi, (match) => {
    if (match.includes('rich-checklist-item')) {
      return `<ul class="rich-checklist">${match}</ul>`;
    }
    return `<ul>${match}</ul>`;
  });

  // 10. Convert bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 11. Convert italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 12. Convert strikethrough (~~text~~)
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 13. Convert highlight (==text==)
  html = html.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  // 14. Convert inline code (`code`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 15. Restore fenced code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  // 16. Wrap plain paragraphs if no block tags exist
  const hasBlocks = /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|hr)\b/i.test(html);
  if (!hasBlocks) {
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  // 17. Ensure all <a> tags have target="_blank", rel="noopener noreferrer", and valid protocol
  html = html.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, (_match, url, text) => {
    let safeUrl = url.trim();
    if (
      !/^https?:\/\//i.test(safeUrl) &&
      !/^mailto:/i.test(safeUrl) &&
      !safeUrl.startsWith('#') &&
      !safeUrl.startsWith('/')
    ) {
      safeUrl = `https://${safeUrl}`;
    }
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeUrl}">${text}</a>`;
  });

  // 18. Security Sanitization: Remove dangerous script, style, iframe tags and inline event handlers
  html = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');

  return html;
};

interface RichTextRendererProps {
  content?: string | null;
  className?: string;
  placeholder?: string;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
  placeholder = 'No description provided.',
}) => {
  if (!content || !content.trim()) {
    return <div className={`rich-text-placeholder ${className}`}>{placeholder}</div>;
  }

  const sanitizedHtml = parseAndSanitizeRichText(content);

  return (
    <div
      className={`rich-text-rendered-body ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      onClick={(e) => {
        // Ensure link clicks open properly even in containers
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          e.stopPropagation();
        }
      }}
    />
  );
};
