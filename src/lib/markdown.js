import { marked } from 'marked'
import TerminalRenderer from 'marked-terminal'

marked.setOptions({ renderer: new TerminalRenderer() })

export function renderMarkdown(text) {
  if (!text) return text
  return marked(text).replace(/\n+$/, '\n')
}
