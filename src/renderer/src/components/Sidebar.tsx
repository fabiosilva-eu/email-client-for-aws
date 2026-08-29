import React from 'react'
import { Inbox, Send, Trash2, PenSquare, Mail, Layers } from 'lucide-react'
import type { FolderType } from '../types'

interface SidebarProps {
  activeFolder: FolderType
  onSelectFolder: (folder: FolderType) => void
  folderCounts: Record<FolderType, number>
  onCompose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeFolder,
  onSelectFolder,
  folderCounts,
  onCompose
}) => {
  const folders: Array<{
    id: FolderType
    label: string
    icon: React.ReactNode
    activeClass: string
    badgeColor: string
  }> = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4" />,
      activeClass: 'bg-indigo-600/15 text-indigo-300 border-indigo-500/30',
      badgeColor: 'bg-indigo-500/20 text-indigo-300'
    },
    {
      id: 'sent',
      label: 'Sent Mail',
      icon: <Send className="w-4 h-4" />,
      activeClass: 'bg-emerald-600/15 text-emerald-300 border-emerald-500/30',
      badgeColor: 'bg-emerald-500/20 text-emerald-300'
    },
    {
      id: 'trash',
      label: 'Trash',
      icon: <Trash2 className="w-4 h-4" />,
      activeClass: 'bg-rose-600/15 text-rose-300 border-rose-500/30',
      badgeColor: 'bg-rose-500/20 text-rose-300'
    }
  ]

  return (
    <aside className="w-56 bg-slate-900/70 border-r border-slate-800/80 flex flex-col justify-between select-none shrink-0 h-full">
      {/* Top Action & Navigation list */}
      <div className="p-3.5 space-y-4">
        {/* Compose Button */}
        <button
          onClick={onCompose}
          className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <PenSquare className="w-4 h-4" />
          <span>New Email</span>
        </button>

        {/* Folders Section */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            <span>Folders</span>
          </div>

          {folders.map((folder) => {
            const isActive = activeFolder === folder.id
            const count = folderCounts[folder.id] ?? 0

            return (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  isActive
                    ? `${folder.activeClass} shadow-xs font-semibold`
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? '' : 'text-slate-500'}>{folder.icon}</span>
                  <span>{folder.label}</span>
                </div>

                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? folder.badgeColor : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer info badge */}
      <div className="p-3.5 border-t border-slate-800/60">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 px-2">
          <Mail className="w-3.5 h-3.5 text-indigo-400/80" />
          <span className="truncate">S3 Direct Mailbox</span>
        </div>
      </div>
    </aside>
  )
}

