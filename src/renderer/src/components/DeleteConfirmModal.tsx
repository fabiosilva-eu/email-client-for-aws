import React from 'react'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  emailSubject?: string
  emailKey: string
  isPermanent?: boolean
  loading?: boolean
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  emailSubject,
  emailKey,
  isPermanent = false,
  loading = false
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isPermanent
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isPermanent ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {isPermanent ? 'Permanently Delete Email' : 'Move Email to Trash'}
              </h3>
              <p className="text-[11px] text-slate-400">Confirmation required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            {isPermanent
              ? 'Are you sure you want to permanently delete this email from your S3 bucket? This action cannot be undone.'
              : 'Are you sure you want to move this email to the Trash folder in your S3 bucket?'}
          </p>

          {/* Email Info Card */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-start gap-2">
              <span className="text-slate-500 font-sans shrink-0">Subject:</span>
              <span className="text-slate-200 font-sans font-medium truncate" title={emailSubject || '(No Subject)'}>
                {emailSubject || '(No Subject)'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-500 font-sans shrink-0">S3 Key:</span>
              <span className="text-slate-400 truncate text-[10px]" title={emailKey}>
                {emailKey}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950/50 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50 ${
              isPermanent
                ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-rose-600/30'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/30'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPermanent ? 'Permanently Delete' : 'Move to Trash'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

