import React, { useState, useMemo } from 'react'
import {
  Search,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
  FolderOpen,
  ArrowUpDown,
  X
} from 'lucide-react'
import type { EmailSummary, AwsConfig, FolderType } from '../types'

interface EmailListProps {
  emails: EmailSummary[]
  loading: boolean
  error: string | null
  config: AwsConfig | null
  folder?: FolderType
  onOpenSettings: () => void
  onSelectEmail: (key: string) => void
  onRefresh: () => void
  onCompose?: () => void
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  error,
  config,
  folder = 'inbox',
  onOpenSettings,
  onSelectEmail,
  onRefresh,
  onCompose
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'date' | 'from' | 'subject' | 'size'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  const isConfigured = Boolean(config?.bucket && config?.accessKeyId && config?.secretAccessKey)

  // Filter and sort emails
  const filteredEmails = useMemo(() => {
    let list = emails.slice()

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((email) => {
        return (
          email.from.toLowerCase().includes(q) ||
          (email.to && email.to.toLowerCase().includes(q)) ||
          email.subject.toLowerCase().includes(q) ||
          email.key.toLowerCase().includes(q) ||
          email.date.toLowerCase().includes(q)
        )
      })
    }

    list.sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      if (sortField === 'from') {
        valA = folder === 'sent' ? (a.to || a.from).toLowerCase() : a.from.toLowerCase()
        valB = folder === 'sent' ? (b.to || b.from).toLowerCase() : b.from.toLowerCase()
      } else if (sortField === 'subject') {
        valA = a.subject.toLowerCase()
        valB = b.subject.toLowerCase()
      } else if (sortField === 'size') {
        valA = a.size
        valB = b.size
      } else {
        // Date sort (fallback to lastModified if date is missing)
        valA = a.date || a.lastModified
        valB = b.date || b.lastModified
      }

      if (valA < valB) return sortAsc ? -1 : 1
      if (valA > valB) return sortAsc ? 1 : -1
      return 0
    })

    return list
  }, [emails, searchQuery, sortField, sortAsc, folder])

  const handleSort = (field: 'date' | 'from' | 'subject' | 'size') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const getEmptyStateDetails = () => {
    if (searchQuery) {
      return {
        title: 'No matching emails found',
        description: 'Try adjusting your search query or clearing the filter.'
      }
    }
    if (folder === 'sent') {
      return {
        title: 'No sent messages yet',
        description: 'Emails sent via the client will be saved to your S3 bucket under the sent/ folder.'
      }
    }
    if (folder === 'trash') {
      return {
        title: 'Trash is empty',
        description: 'Deleted messages will appear in this folder.'
      }
    }
    return {
      title: 'No email objects found in bucket',
      description: `Bucket "${config?.bucket}" appears to have no incoming objects under prefix "${config?.prefix || '/'}"`
    }
  }

  const emptyInfo = getEmptyStateDetails()

  // Not Configured State
  if (!isConfigured) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">AWS S3 Not Configured</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          Please configure your AWS S3 bucket name, region, and access credentials in the Settings modal to start listing emails.
        </p>
        <button
          onClick={onOpenSettings}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
        >
          Configure AWS S3
        </button>
      </div>
    )
  }

  // Error State
  if (error && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Failed to Fetch S3 Emails</h2>
        <p className="text-xs text-rose-300 max-w-lg mb-6 bg-rose-950/40 p-4 rounded-xl border border-rose-900/50 font-mono leading-relaxed">
          {error}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer"
          >
            Retry Connection
          </button>
          <button
            onClick={onOpenSettings}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer"
          >
            Edit Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Top Search & Filter Bar */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-4 shrink-0">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              folder === 'sent'
                ? 'Search by recipient, subject, or date...'
                : 'Search by sender, subject, filename, or date...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Stats count */}
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-200">{filteredEmails.length}</strong> of{' '}
            <strong className="text-slate-200">{emails.length}</strong> messages
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-slate-900/60 border border-slate-800/60 animate-pulse flex items-center px-4 gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-800/60 rounded w-2/3" />
                </div>
                <div className="w-24 h-3 bg-slate-800 rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <Mail className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-300 mb-1">{emptyInfo.title}</h3>
            <p className="text-xs text-slate-500 max-w-sm">{emptyInfo.description}</p>
            {folder === 'sent' && onCompose && (
              <button
                onClick={onCompose}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Compose New Email
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900/80 sticky top-0 z-10 border-b border-slate-800 text-slate-400 font-medium select-none">
              <tr>
                <th
                  onClick={() => handleSort('from')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{folder === 'sent' ? 'To / Recipient' : 'Sender'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('subject')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Subject</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-200 transition w-44"
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('size')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-200 transition w-36"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>S3 Object / Size</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmails.map((email) => {
                const displayName = folder === 'sent' ? email.to || email.from : email.from
                const initial = displayName.replace(/["'<]/g, '').trim()[0]?.toUpperCase() || 'M'
                return (
                  <tr
                    key={email.key}
                    onClick={() => onSelectEmail(email.key)}
                    className="hover:bg-slate-900 active:bg-slate-800/80 transition-colors cursor-pointer group"
                  >
                    {/* Sender or Recipient */}
                    <td className="py-3.5 px-4 font-medium text-slate-200 max-w-xs">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            folder === 'sent'
                              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 group-hover:border-emerald-500/60 group-hover:text-emerald-200'
                              : 'bg-slate-800 border-slate-700 text-indigo-300 group-hover:border-indigo-500/50 group-hover:text-indigo-200'
                          }`}
                        >
                          {initial}
                        </div>
                        <span className="truncate group-hover:text-white transition-colors" title={displayName}>
                          {displayName}
                        </span>
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="py-3.5 px-4 text-slate-300 max-w-md">
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-slate-100 truncate group-hover:text-indigo-300 transition-colors"
                          title={email.subject}
                        >
                          {email.subject}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      <span title={`Email Date: ${email.date}\nS3 Last Modified: ${email.lastModified}`}>
                        {formatDate(email.date)}
                      </span>
                    </td>

                    {/* S3 Key & Size */}
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[120px] text-slate-300" title={email.key}>
                          {email.key.split('/').pop() || email.key}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px]">
                          {formatBytes(email.size)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

