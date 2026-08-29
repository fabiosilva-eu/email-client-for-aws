import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Mail,
  Copy,
  Check,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  WrapText,
  FileText,
  Clock,
  User,
  Send,
  Loader2,
  AlertCircle,
  Code,
  Globe,
  AlignLeft,
  Users
} from 'lucide-react'
import { HtmlEmailViewer } from './HtmlEmailViewer'
import { AttachmentList } from './AttachmentList'
import type { EmailDetail } from '../types'

interface EmailViewerProps {
  emailKey?: string
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString(undefined, {
      dateStyle: 'full',
      timeStyle: 'medium'
    })
  } catch {
    return dateStr
  }
}

export const EmailViewer: React.FC<EmailViewerProps> = ({ emailKey: propKey }) => {
  const [key, setKey] = useState<string>('')
  const [email, setEmail] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean>(false)
  const [wordWrap, setWordWrap] = useState<boolean>(true)
  const [showAllHeaders, setShowAllHeaders] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'raw'>('html')

  const contentRef = useRef<HTMLPreElement>(null)

  // Extract key from prop or window hash
  useEffect(() => {
    let extractedKey = propKey || ''
    if (!extractedKey && window.location.hash.includes('key=')) {
      const match = window.location.hash.match(/key=([^&]+)/)
      if (match && match[1]) {
        extractedKey = decodeURIComponent(match[1])
      }
    }
    setKey(extractedKey)
  }, [propKey])

  // Fetch full email content
  useEffect(() => {
    if (!key) return
    let isMounted = true
    setLoading(true)
    setError(null)

    if (!window.electronAPI?.getEmailContent) {
      setError('Electron API bridge is not available. Please ensure the app is running within Electron.')
      setLoading(false)
      return
    }

    window.electronAPI
      .getEmailContent(key)
      .then((res) => {
        if (!isMounted) return
        if (res.success && res.data) {
          setEmail(res.data)
          // Default tab: HTML if present, else Plain Text if present, else Raw
          if (res.data.parsed?.html) {
            setActiveTab('html')
          } else if (res.data.parsed?.text) {
            setActiveTab('text')
          } else {
            setActiveTab('raw')
          }
        } else {
          setError(res.error || 'Failed to load email content from S3.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err?.message || 'Error communicating with S3.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [key])

  // Copy raw content
  const handleCopy = async () => {
    if (!email?.rawContent) return
    try {
      await navigator.clipboard.writeText(email.rawContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy raw email content:', err)
    }
  }

  // Download raw email file
  const handleDownload = () => {
    if (!email?.rawContent) return
    const filename = (email.key.split('/').pop() || 'email') + (email.key.endsWith('.eml') ? '' : '.eml')
    const blob = new Blob([email.rawContent], { type: 'message/rfc822' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Highlight search matches in raw content
  const renderedContent = useMemo(() => {
    if (!email?.rawContent) return null
    if (!searchQuery.trim()) return email.rawContent

    const q = searchQuery.trim()
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = email.rawContent.split(regex)

    return parts.map((part, i) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return (
          <mark key={i} className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">
            {part}
          </mark>
        )
      }
      return part
    })
  }, [email?.rawContent, searchQuery])

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Parsing and fetching email from S3...</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">{key}</p>
      </div>
    )
  }

  if (error || !email) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 bg-slate-950 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Failed to Load Email</h2>
        <p className="text-xs text-rose-300 max-w-md bg-rose-950/40 p-4 rounded-xl border border-rose-900/50 font-mono mb-4">
          {error || 'Object not found'}
        </p>
        <p className="text-xs text-slate-500 font-mono">{key}</p>
      </div>
    )
  }

  const headerList = Object.entries(email.headers || {})
  const hasHtml = Boolean(email.parsed?.html || email.parsed?.textAsHtml)
  const hasText = Boolean(email.parsed?.text)
  const attachments = email.parsed?.attachments || []

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-text">
      {/* Title / Drag bar for window */}
      <div className="app-drag-region h-11 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 select-none shrink-0">
        <div className="flex items-center gap-2.5 pl-16 app-no-drag">
          <Mail className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200 truncate max-w-md">
            {email.subject || '(No Subject)'}
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400 app-no-drag flex items-center gap-2">
          <span>{formatBytes(email.size)}</span>
        </div>
      </div>

      {/* Header Summary Card */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 p-5 shrink-0">
        <h1 className="text-lg font-bold text-slate-100 mb-3 select-text leading-snug">
          {email.subject || '(No Subject)'}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-xs">
          {/* Sender */}
          <div className="flex items-center gap-2 text-slate-300">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-400">From:</span>
            <span className="truncate text-slate-100 select-text font-medium">{email.from}</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-400">Date:</span>
            <span className="truncate text-slate-200 select-text">{formatDate(email.date)}</span>
          </div>

          {/* Recipient */}
          {email.to && (
            <div className="flex items-center gap-2 text-slate-300">
              <Send className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold text-slate-400">To:</span>
              <span className="truncate text-slate-200 select-text">{email.to}</span>
            </div>
          )}

          {/* CC */}
          {email.parsed?.cc && (
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-400">Cc:</span>
              <span className="truncate text-slate-200 select-text">{email.parsed.cc}</span>
            </div>
          )}

          {/* S3 Key */}
          <div className="flex items-center gap-2 text-slate-300">
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-400">S3 Key:</span>
            <span className="font-mono text-[11px] text-slate-300 truncate select-text" title={email.key}>
              {email.key}
            </span>
          </div>
        </div>

        {/* Collapsible All Headers Inspector */}
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          <button
            onClick={() => setShowAllHeaders(!showAllHeaders)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showAllHeaders ? 'Hide All MIME Headers' : `View All MIME Headers (${headerList.length})`}</span>
            {showAllHeaders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAllHeaders && (
            <div className="mt-2.5 max-h-48 overflow-auto rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] select-text">
              <table className="w-full text-left">
                <tbody>
                  {headerList.map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-800/40 last:border-0">
                      <td className="py-1 pr-3 font-semibold text-indigo-300 align-top whitespace-nowrap">{k}:</td>
                      <td className="py-1 text-slate-300 break-all select-text">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Attachment List Drawer */}
      {attachments.length > 0 && <AttachmentList attachments={attachments} />}

      {/* Tab Switcher & Action Toolbar */}
      <div className="h-11 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1">
          {hasHtml && (
            <button
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'html'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>HTML View</span>
            </button>
          )}

          {hasText && (
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'text'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Plain Text</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw RFC 822</span>
          </button>
        </div>

        {/* Action Tools (Right) */}
        <div className="flex items-center gap-2">
          {activeTab === 'raw' && (
            <>
              {/* Search inside text */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search in raw..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:w-48 transition-all"
                />
              </div>

              {/* Word Wrap Toggle */}
              <button
                onClick={() => setWordWrap(!wordWrap)}
                title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
                className={`p-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
                  wordWrap
                    ? 'bg-slate-800 text-indigo-300 border-indigo-500/30'
                    : 'text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700/60 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Raw'}</span>
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .eml</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content View */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#070b14]">
        {activeTab === 'html' && (
          <HtmlEmailViewer rawHtml={email.parsed?.html || email.parsed?.textAsHtml || ''} />
        )}

        {activeTab === 'text' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-950 flex flex-col">
            <div className="w-full flex-1 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl text-slate-200 text-sm leading-relaxed whitespace-pre-wrap break-words font-sans">
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="flex-1 overflow-auto bg-[#070b14] p-4 font-mono text-xs">
            <pre
              ref={contentRef}
              className={`text-slate-200 leading-relaxed ${
                wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
              }`}
            >
              {renderedContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
