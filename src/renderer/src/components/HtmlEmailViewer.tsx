import React, { useState, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Shield, Image as ImageIcon } from 'lucide-react'

interface HtmlEmailViewerProps {
  rawHtml: string
}

export const HtmlEmailViewer: React.FC<HtmlEmailViewerProps> = ({ rawHtml }) => {
  const [loadRemoteImages, setLoadRemoteImages] = useState<boolean>(false)

  // Check if HTML contains any external HTTP/HTTPS images
  const hasRemoteImages = useMemo(() => {
    if (!rawHtml) return false
    return /<img[^>]+src=["']https?:\/\//i.test(rawHtml)
  }, [rawHtml])

  // Sanitize and transform HTML based on privacy settings
  const sanitizedHtml = useMemo(() => {
    if (!rawHtml) return ''

    let htmlToSanitize = rawHtml

    // If remote images are blocked, replace http/https img src with privacy placeholder
    if (!loadRemoteImages && hasRemoteImages) {
      htmlToSanitize = htmlToSanitize.replace(
        /(<img[^>]+src=["'])(https?:\/\/[^"']+)(["'])/gi,
        '$1data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>$3 data-blocked-src="$2"'
      )
    }

    // Configure DOMPurify
    const clean = DOMPurify.sanitize(htmlToSanitize, {
      WHOLE_DOCUMENT: false,
      ADD_TAGS: ['style', 'font', 'center'],
      ADD_ATTR: ['target', 'style', 'align', 'valign', 'bgcolor', 'border', 'cellpadding', 'cellspacing'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    })

    return clean
  }, [rawHtml, loadRemoteImages, hasRemoteImages])

  // Wrap inside full HTML document with base styles for full-width iframe rendering
  const iframeDocument = useMemo(() => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base target="_blank">
    <style>
      html, body {
        margin: 0;
        padding: 20px;
        background-color: #ffffff;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        word-wrap: break-word;
        box-sizing: border-box;
        min-height: 100%;
        width: 100%;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      a {
        color: #4f46e5;
        text-decoration: underline;
      }
      blockquote {
        border-left: 3px solid #cbd5e1;
        margin: 1em 0;
        padding-left: 12px;
        color: #64748b;
      }
      table {
        border-collapse: collapse;
        max-width: 100%;
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: #f1f5f9;
        border-radius: 4px;
        padding: 2px 4px;
      }
      pre {
        padding: 12px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    ${sanitizedHtml}
  </body>
</html>`
  }, [sanitizedHtml])

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-slate-950">
      {/* Remote Images Privacy Banner */}
      {hasRemoteImages && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {loadRemoteImages
                ? 'Remote images are enabled for this message.'
                : 'Remote images are blocked to protect your privacy and prevent tracking.'}
            </span>
          </div>

          <button
            onClick={() => setLoadRemoteImages(!loadRemoteImages)}
            className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{loadRemoteImages ? 'Hide Remote Images' : 'Load Remote Images'}</span>
          </button>
        </div>
      )}

      {/* Full-width and full-height sandboxed iframe container */}
      <div className="flex-1 w-full h-full overflow-hidden flex flex-col bg-white">
        <iframe
          srcDoc={iframeDocument}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          title="Email Content"
          className="w-full h-full flex-1 border-0 m-0 p-0 block"
        />
      </div>
    </div>
  )
}
