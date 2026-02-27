import { EventManager } from './event_manager';
import { SentenceHighlightStorage, generateSentenceHighlightId, getConfiguredHighlightColor, type SentenceHighlightData } from './sentence_highlight_storage';
import { resolveRangeFromAnchor, resolveRangeFromTextQuote, serializeRange } from './text_anchor';

export class SentenceHighlightRenderer {
  private static readonly HIGHLIGHT_ATTRIBUTE = 'data-sentence-highlight-id';
  private static isRendering = false;

  static isRenderInProgress(): boolean {
    return this.isRendering;
  }

  static async renderHighlights() {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      this.clearHighlights();

      const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);
      for (const highlight of highlights) {
        await this.renderSingleHighlight(highlight);
      }
    } catch (error) {
      console.error('Error rendering sentence highlights:', error);
    } finally {
      this.isRendering = false;
    }
  }

  static async renderSingleHighlight(highlight: SentenceHighlightData) {
    try {
      const range = this.resolveRange(highlight);
      if (!range) {
        console.warn('Range not found for sentence highlight:', highlight);
        return;
      }

      this.wrapRangeWithHighlight(range, highlight);
    } catch (error) {
      console.error('Error rendering single sentence highlight:', error);
    }
  }

  static clearHighlights() {
    const highlightElements = document.querySelectorAll(`[${this.HIGHLIGHT_ATTRIBUTE}]`);
    highlightElements.forEach((element) => {
      const parent = element.parentNode;
      if (!parent) return;

      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      parent.normalize();
    });
  }

  static addHighlightClickListeners(eventManager: EventManager) {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const highlightElement = target.closest?.(`[${this.HIGHLIGHT_ATTRIBUTE}]`) as HTMLElement | null;
      if (!highlightElement) return;

      const highlightId = highlightElement.getAttribute(this.HIGHLIGHT_ATTRIBUTE);
      if (!highlightId) return;

      try {
        const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);
        const highlightData = highlights.find(h => h.id === highlightId);
        if (!highlightData) return;

        const rect = highlightElement.getBoundingClientRect();
        const removeButton = document.createElement('div');
        removeButton.style.cssText = `
          position: absolute;
          left: ${rect.left + window.scrollX + rect.width - 10}px;
          top: ${rect.top + window.scrollY - 10}px;
          width: 20px;
          height: 20px;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10002;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        `;

        removeButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="white" style="width: 12px; height: 12px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        `;

        removeButton.addEventListener('mouseenter', () => {
          removeButton.style.transform = 'scale(1.1)';
          removeButton.style.backgroundColor = '#dc2626';
        });

        removeButton.addEventListener('mouseleave', () => {
          removeButton.style.transform = 'scale(1)';
          removeButton.style.backgroundColor = '#ef4444';
        });

        removeButton.addEventListener('click', async (evt) => {
          evt.stopPropagation();
          await SentenceHighlightStorage.removeHighlight(highlightId);
          await SentenceHighlightRenderer.renderHighlights();
          removeButton.remove();
        });

        document.body.appendChild(removeButton);

        setTimeout(() => {
          const removeButtonHandler = (evt: MouseEvent) => {
            if (!removeButton.contains(evt.target as Node)) {
              removeButton.remove();
              document.removeEventListener('click', removeButtonHandler);
            }
          };
          document.addEventListener('click', removeButtonHandler);
        }, 100);
      } catch (error) {
        console.error('Error handling sentence highlight click:', error);
      }
    });

    document.addEventListener('contextmenu', async (e) => {
      const target = e.target as HTMLElement;
      const highlightElement = target.closest?.(`[${this.HIGHLIGHT_ATTRIBUTE}]`) as HTMLElement | null;
      if (!highlightElement) return;

      e.preventDefault();
      const highlightId = highlightElement.getAttribute(this.HIGHLIGHT_ATTRIBUTE);
      if (!highlightId) return;

      const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);
      const highlightData = highlights.find(h => h.id === highlightId);
      if (!highlightData) return;

      eventManager.emit('show-sentence-highlight-context-menu', {
        highlightData,
        position: { x: e.clientX, y: e.clientY },
        target: highlightElement,
      });
    });
  }

  static async highlightSelection(currentSelection: any) {
    if (!currentSelection) {
      console.warn('No current selection available for sentence highlighting');
      return false;
    }

    const { range, text } = currentSelection;
    if (!text || text.trim().length === 0) {
      console.warn('No selected text for sentence highlighting');
      return false;
    }

    const anchor = serializeRange(range);
    if (!anchor) {
      console.warn('Unable to serialize selection range');
      return false;
    }

    const color = await getConfiguredHighlightColor();
    const highlightData: SentenceHighlightData = {
      id: generateSentenceHighlightId(),
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      startXPath: anchor.startXPath,
      endXPath: anchor.endXPath,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
      exact: anchor.exact,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      color,
    };

    await SentenceHighlightStorage.saveHighlight(highlightData);
    await this.renderHighlights();
    return true;
  }

  private static resolveRange(highlight: SentenceHighlightData): Range | null {
    const range = resolveRangeFromAnchor({
      startXPath: highlight.startXPath,
      endXPath: highlight.endXPath,
      startOffset: highlight.startOffset,
      endOffset: highlight.endOffset,
    });

    if (range) {
      const currentText = range.toString();
      if (currentText === highlight.exact) {
        return range;
      }
    }

    return resolveRangeFromTextQuote({
      exact: highlight.exact,
      prefix: highlight.prefix,
      suffix: highlight.suffix,
    });
  }

  private static wrapRangeWithHighlight(range: Range, highlight: SentenceHighlightData) {
    if (range.collapsed) return;

    const highlightSpan = document.createElement('span');
    highlightSpan.setAttribute(this.HIGHLIGHT_ATTRIBUTE, highlight.id);
    highlightSpan.style.cssText = `
      background-color: ${highlight.color || '#FFF59D'} !important;
      border-radius: 3px !important;
      padding: 2px 4px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      position: relative !important;
      display: inline !important;
    `;
    if (highlight.note) {
      highlightSpan.title = highlight.note;
    }

    highlightSpan.addEventListener('mouseenter', () => {
      highlightSpan.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      highlightSpan.style.transform = 'scale(1.02)';
    });
    highlightSpan.addEventListener('mouseleave', () => {
      highlightSpan.style.boxShadow = 'none';
      highlightSpan.style.transform = 'scale(1)';
    });

    try {
      const fragment = range.extractContents();
      highlightSpan.appendChild(fragment);
      range.insertNode(highlightSpan);
      highlightSpan.normalize();
    } catch (error) {
      console.warn('Unable to wrap range for sentence highlight:', error);
    }
  }
}
