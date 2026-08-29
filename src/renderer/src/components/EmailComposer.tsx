import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Send,
  Paperclip,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Settings,
  Reply,
  ReplyAll,
  Forward,
  PenSquare
} from 'lucide-react'
import type { OutgoingEmailPayload } from '../types'

export interface EmailComposerInitialData {
  mode: 'compose' | 'reply' | 'replyAll' | 'forward'
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  textBody?: string
  inReplyTo?: string
  references?: string
  attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>
}

interface EmailComposerProps {
  isOpen: boolean
  onClose: () => void
  onOpenSmtpSettings: () => void
  initialData?: EmailComposerInitialData | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  isOpen,
  onClose,
  onOpenSmtpSettings,
  initialData
}) => {
  const [toInput, setToInput] = useState<string>('')
  const [ccInput, setCcInput] = useState<string>('')
  const [bccInput, setBccInput] = useState<string>('')
  const [showCc, setShowCc] = useState<boolean>(false)
  const [showBcc, setShowBcc] = useState<boolean>(false)
  const [subject, setSubject] = useState<string>('')
  const [textBody, setTextBody] = useState<string>('')
  const [attachments, setAttachments] = useState<Array<{ filename: string; contentBase64: string; contentType: string; size?: number }>>([])

  const [hasSmtpConfig, setHasSmtpConfig] = useState<boolean>(true)
  const [senderInfo, setSenderInfo] = useState<string>('')
  const [sending, setSending] = useState<boolean>(false)
  const [sendSuccess, setSendSuccess] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const toInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize data when opened
  useEffect(() => {
    if (isOpen) {
      // Check SMTP configuration status
      if (window.electronAPI?.getConfig) {
        window.electronAPI.getConfig().then((cfg) => {
          const isConfigured = Boolean(
            cfg.smtp &&
            cfg.smtp.host &&
            cfg.smtp.host.trim() &&
            cfg.smtp.user &&
            cfg.smtp.user.trim() &&
            cfg.smtp.password &&
            cfg.smtp.password.trim()
          )
          setHasSmtpConfig(isConfigured)
          if (cfg.smtp?.fromEmail || cfg.smtp?.user) {
            setSenderInfo(cfg.smtp.fromName ? `From: ${cfg.smtp.fromName} <${cfg.smtp.fromEmail || cfg.smtp.user}>` : `From: ${cfg.smtp.fromEmail || cfg.smtp.user}`)
          }
        })
      }

      if (initialData) {
        setToInput((initialData.to || []).join(', '))
        setCcInput((initialData.cc || []).join(', '))
        setBccInput((initialData.bcc || []).join(', '))
        setShowCc(Boolean(initialData.cc && initialData.cc.length > 0))
        setShowBcc(Boolean(initialData.bcc && initialData.bcc.length > 0))
        setSubject(initialData.subject || '')
        setTextBody(initialData.textBody || '')
        setAttachments(initialData.attachments || [])
      } else {
        setToInput('')
        setCcInput('')
        setBccInput('')
        setShowCc(false)
        setShowBcc(false)
        setSubject('')
        setTextBody('')
        setAttachments([])
      }

      setSending(false)
      setSendSuccess(false)
      setErrorMessage(null)

      setTimeout(() => {
        if (!initialData || initialData.mode === 'compose' || !initialData.to || initialData.to.length === 0) {
          toInputRef.current?.focus()
        } else {
          if (textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.setSelectionRange(0, 0)
            textareaRef.current.scrollTop = 0
          }
        }
      }, 60)
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  // Handle local file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || ''
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            contentBase64: base64,
            contentType: file.type || 'application/octet-stream',
            size: file.size
          }
        ])
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  // Parse comma/space-separated recipients
  const parseRecipients = (raw: string): string[] => {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const toRecipients = parseRecipients(toInput)
    const ccRecipients = parseRecipients(ccInput)
    const bccRecipients = parseRecipients(bccInput)

    if (toRecipients.length === 0) {
      setErrorMessage('Please specify at least one recipient in "To".')
      return
    }

    if (!hasSmtpConfig) {
      setErrorMessage('SMTP credentials are not configured. Please open Settings -> SMTP to configure outgoing mail.')
      return
    }

    setSending(true)
    setErrorMessage(null)

    const payload: OutgoingEmailPayload = {
      to: toRecipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
      subject: subject || '(No Subject)',
      textBody,
      inReplyTo: initialData?.inReplyTo,
      references: initialData?.references,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        contentBase64: a.contentBase64,
        contentType: a.contentType
      }))
    }

    try {
      if (!window.electronAPI?.sendEmail) {
        throw new Error('Electron API bridge is not available.')
      }

      const result = await window.electronAPI.sendEmail(payload)
      if (result.success) {
        setSendSuccess(true)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setErrorMessage(result.error || 'Failed to send email.')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error occurred while sending email.')
    } finally {
      setSending(false)
    }
  }

  const getModeTitle = () => {
    switch (initialData?.mode) {
      case 'reply':
        return { icon: <Reply className="w-4 h-4 text-indigo-400" />, title: 'Reply to Message' }
      case 'replyAll':
        return { icon: <ReplyAll className="w-4 h-4 text-indigo-400" />, title: 'Reply to All' }
      case 'forward':
        return { icon: <Forward className="w-4 h-4 text-indigo-400" />, title: 'Forward Message' }
      default:
        return { icon: <PenSquare className="w-4 h-4 text-indigo-400" />, title: 'New Message' }
    }
  }

  const modeInfo = getModeTitle()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 app-no-drag">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] app-no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Composer Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2">
            {modeInfo.icon}
            <span className="text-sm font-semibold text-slate-100">{modeInfo.title}</span>
            {senderInfo && <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">({senderInfo})</span>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unconfigured SMTP Warning Banner */}
        {!hasSmtpConfig && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Outgoing SMTP server is not configured. Email cannot be sent until configured.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenSmtpSettings()
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>Configure SMTP</span>
            </button>
          </div>
        )}

        {/* Composer Form */}
        <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden">
          {/* Header Fields (To, Cc, Bcc, Subject) */}
          <div className="px-5 py-3 border-b border-slate-800/80 space-y-2 bg-slate-950/30 shrink-0">
            {/* TO Field */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-12 text-slate-400 font-medium">To:</span>
              <input
                ref={toInputRef}
                type="text"
                required
                placeholder="recipient@example.com (comma separated)"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              />
              <div className="flex items-center gap-1 text-[11px]">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="text-slate-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="text-slate-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* CC Field (Optional) */}
            {showCc && (
              <div className="flex items-center gap-2 text-xs animate-in fade-in duration-100">
                <span className="w-12 text-slate-400 font-medium">Cc:</span>
                <input
                  type="text"
                  placeholder="cc@example.com"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>
            )}

            {/* BCC Field (Optional) */}
            {showBcc && (
              <div className="flex items-center gap-2 text-xs animate-in fade-in duration-100">
                <span className="w-12 text-slate-400 font-medium">Bcc:</span>
                <input
                  type="text"
                  placeholder="bcc@example.com"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>
            )}

            {/* Subject Field */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-12 text-slate-400 font-medium">Subject:</span>
              <input
                type="text"
                required
                placeholder="Subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Attachments Chips Bar */}
          {attachments.length > 0 && (
            <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-2 shrink-0 max-h-24 overflow-y-auto">
              {attachments.map((att, i) => (
                <div
                  key={`${att.filename}-${i}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
                >
                  <Paperclip className="w-3 h-3 text-indigo-400" />
                  <span className="font-medium truncate max-w-[150px]">{att.filename}</span>
                  {att.size && <span className="text-[10px] text-slate-400">({formatBytes(att.size)})</span>}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Message Body Editor */}
          <div className="flex-1 p-5 flex flex-col bg-slate-950">
            <textarea
              ref={textareaRef}
              required
              rows={12}
              placeholder="Write your email message here..."
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              className="flex-1 w-full bg-transparent border-0 text-slate-100 placeholder-slate-500 text-sm leading-relaxed focus:outline-none resize-none font-sans"
            />
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />

          {/* Status & Error Alerts */}
          {errorMessage && (
            <div className="px-5 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {sendSuccess && (
            <div className="px-5 py-2 bg-emerald-500/10 border-t border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Email sent successfully!</span>
            </div>
          )}

          {/* Composer Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>Attach Files</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={sending || sendSuccess}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{sending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

