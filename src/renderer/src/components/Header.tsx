import React from 'react'
import { Settings, RefreshCw, Database, Mail } from 'lucide-react'
import type { AwsConfig } from '../types'

interface HeaderProps {
  config: AwsConfig | null
  loading: boolean
  onRefresh: () => void
  onOpenSettings: () => void
  onCompose: () => void
}

export const Header: React.FC<HeaderProps> = ({
  config,
  loading,
  onRefresh,
  onOpenSettings,
  onCompose
}) => {
  const isConfigured = Boolean(config?.bucket && config?.accessKeyId && config?.secretAccessKey)

  return (
    <header className="app-drag-region h-14 bg-slate-900/90 border-b border-slate-800/80 px-4 flex items-center justify-between select-none backdrop-blur-md z-10 sticky top-0">
      {/* Left branding & Mac traffic lights spacing */}
      <div className="flex items-center gap-3 pl-16 app-no-drag">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Mail className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            S3 Email Client
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              v0.1
            </span>
          </h1>
        </div>
      </div>

      {/* Center S3 Bucket & Region Badge */}
      <div className="flex items-center gap-2 text-xs app-no-drag">
        {isConfigured ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-emerald-300 font-medium">{config?.bucket}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{config?.region}</span>
            {config?.prefix && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-amber-400 font-mono">prefix: {config.prefix}</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Bucket Not Configured
          </div>
        )}
      </div>

      {/* Right Action buttons */}
      <div className="flex items-center gap-2 app-no-drag">
        <button
          onClick={onCompose}
          title="Compose New Email"
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Compose</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={loading || !isConfigured}
          title="Refresh emails from S3"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings and AWS Credentials"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-300 hover:rotate-45 transition-transform duration-300" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  )
}

