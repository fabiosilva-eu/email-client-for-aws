import React, { useState } from 'react'
import {
  Paperclip,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  File,
  X,
  Loader2,
  Check
} from 'lucide-react'
import type { ParsedAttachment } from '../types'

interface AttachmentListProps {
  attachments: ParsedAttachment[]
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function getFileIcon(contentType: string, filename: string) {
  const ct = contentType.toLowerCase()
  const fn = filename.toLowerCase()

  if (ct.startsWith('image/') || fn.match(/\.(png|jpe?g|gif|webp|svg)$/)) {
    return <ImageIcon className="w-4 h-4 text-emerald-400" />
  }
  if (ct === 'application/pdf' || fn.endsWith('.pdf')) {
    return <FileText className="w-4 h-4 text-rose-400" />
  }
  if (ct.includes('zip') || ct.includes('tar') || ct.includes('compressed') || fn.match(/\.(zip|tar|gz|7z|rar)$/)) {
    return <FileArchive className="w-4 h-4 text-amber-400" />
  }
  if (ct.startsWith('text/') || fn.match(/\.(txt|json|js|ts|html|css|py|md|xml|csv)$/)) {
    return <FileCode className="w-4 h-4 text-cyan-400" />
  }
  return <File className="w-4 h-4 text-indigo-400" />
}

export const AttachmentList: React.FC<AttachmentListProps> = ({ attachments }) => {
  const [savingFile, setSavingFile] = useState<string | null>(null)
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set())
  const [previewAttachment, setPreviewAttachment] = useState<ParsedAttachment | null>(null)

  if (!attachments || attachments.length === 0) return null

  // Filter regular attachments (and non-inline ones or show inline with tag)
  const visibleAttachments = attachments.filter((a) => !a.isInline || attachments.length === 1)
  const displayList = visibleAttachments.length > 0 ? visibleAttachments : attachments

  const handleDownload = async (att: ParsedAttachment) => {
    setSavingFile(att.filename)
    try {
      if (window.electronAPI?.saveAttachment) {
        const res = await window.electronAPI.saveAttachment({
          filename: att.filename,
          contentBase64: att.contentBase64,
          contentType: att.contentType
        })
        if (res.success) {
          setDownloadedFiles((prev) => new Set(prev).add(att.filename))
          setTimeout(() => {
            setDownloadedFiles((prev) => {
              const next = new Set(prev)
              next.delete(att.filename)
              return next
            })
          }, 3000)
        }
      } else {
        // Web fallback
        const byteCharacters = atob(att.contentBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: att.contentType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = att.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to download attachment:', err)
    } finally {
      setSavingFile(null)
    }
  }

  const handleDownloadAll = async () => {
    for (const att of displayList) {
      await handleDownload(att)
    }
  }

  const canPreview = (att: ParsedAttachment) => {
    const ct = att.contentType.toLowerCase()
    const fn = att.filename.toLowerCase()
    return ct.startsWith('image/') || ct.startsWith('text/') || fn.match(/\.(png|jpe?g|gif|webp|svg|txt|json|md|csv)$/)
  }

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-4 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Paperclip className="w-4 h-4 text-indigo-400" />
          <span>Attachments ({displayList.length})</span>
        </div>
        {displayList.length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save All</span>
          </button>
        )}
      </div>

      {/* Attachment Chips Grid */}
      <div className="flex flex-wrap gap-2.5">
        {displayList.map((att, index) => {
          const isImage = att.contentType.startsWith('image/')
          const isSaving = savingFile === att.filename
          const isDownloaded = downloadedFiles.has(att.filename)

          return (
            <div
              key={`${att.filename}-${index}`}
              className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-200 transition shadow-xs group"
            >
              {/* Thumbnail or Icon */}
              {isImage && att.contentBase64 ? (
                <img
                  src={`data:${att.contentType};base64,${att.contentBase64}`}
                  alt={att.filename}
                  className="w-6 h-6 object-cover rounded shrink-0 border border-slate-700/50 cursor-pointer"
                  onClick={() => setPreviewAttachment(att)}
                />
              ) : (
                <div className="shrink-0">{getFileIcon(att.contentType, att.filename)}</div>
              )}

              {/* Filename & size */}
              <div className="flex flex-col min-w-0 max-w-[180px]">
                <span className="font-medium truncate text-slate-200" title={att.filename}>
                  {att.filename}
                </span>
                <span className="text-[10px] text-slate-400">{formatBytes(att.size)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-1 border-l border-slate-800/80 pl-1.5">
                {canPreview(att) && (
                  <button
                    onClick={() => setPreviewAttachment(att)}
                    title="Preview attachment"
                    className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleDownload(att)}
                  disabled={isSaving}
                  title="Download attachment"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-indigo-600 transition cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : isDownloaded ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xs app-no-drag"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                {getFileIcon(previewAttachment.contentType, previewAttachment.filename)}
                <span className="font-semibold text-sm text-slate-100 truncate">{previewAttachment.filename}</span>
                <span className="text-xs text-slate-400">({formatBytes(previewAttachment.size)})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewAttachment)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-4">
              {previewAttachment.contentType.startsWith('image/') ? (
                <img
                  src={`data:${previewAttachment.contentType};base64,${previewAttachment.contentBase64}`}
                  alt={previewAttachment.filename}
                  className="max-h-[65vh] max-w-full object-contain rounded"
                />
              ) : (
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-words max-h-[60vh] overflow-auto w-full p-2">
                  {atob(previewAttachment.contentBase64)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

