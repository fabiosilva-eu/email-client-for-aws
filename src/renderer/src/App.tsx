import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { SettingsModal } from './components/SettingsModal'
import { EmailList } from './components/EmailList'
import { EmailViewer } from './components/EmailViewer'
import { EmailComposer } from './components/EmailComposer'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import type { AppConfig, EmailSummary, FolderType } from './types'

export const App: React.FC = () => {
  // Check if we are in viewer window mode
  const [isViewerWindow, setIsViewerWindow] = useState(() => {
    return window.location.hash.startsWith('#viewer')
  })

  useEffect(() => {
    const handleHashChange = () => {
      setIsViewerWindow(window.location.hash.startsWith('#viewer'))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // If in standalone viewer window, render only EmailViewer
  if (isViewerWindow) {
    return <EmailViewer />
  }

  // Otherwise, render Main Application Window
  return <MainWindow />
}

const MainWindow: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    bucket: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    prefix: '',
    maxKeys: 100,
    autoRefreshEnabled: true,
    autoRefreshInterval: 60,
    showRefreshCountdown: true
  })
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox')
  const [folderCache, setFolderCache] = useState<Record<FolderType, EmailSummary[]>>({
    inbox: [],
    sent: [],
    trash: []
  })
  const [folderCounts, setFolderCounts] = useState<Record<FolderType, number>>({
    inbox: 0,
    sent: 0,
    trash: 0
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [settingsTab, setSettingsTab] = useState<'s3' | 'smtp'>('s3')
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; subject: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Auto-refresh countdown state
  const [countdown, setCountdown] = useState<number>(60)

  // Fetch emails for a specific folder from S3
  const fetchFolderEmails = useCallback(
    async (folder: FolderType, currentCfg?: AppConfig, isBackground = false) => {
      const activeCfg = currentCfg || config
      if (!activeCfg.bucket || !activeCfg.accessKeyId || !activeCfg.secretAccessKey) {
        return
      }

      if (!isBackground) {
        setLoading(true)
        setError(null)
      }

      try {
        if (!window.electronAPI?.listEmails) {
          setError('Electron API bridge is not available. Please ensure the app is running within Electron.')
          if (!isBackground) setLoading(false)
          return
        }

        const res = await window.electronAPI.listEmails({
          folder,
          prefix: folder === 'inbox' ? activeCfg.prefix : undefined,
          maxKeys: activeCfg.maxKeys
        })

        if (res.success && res.data) {
          setFolderCache((prev) => ({ ...prev, [folder]: res.data! }))
          setFolderCounts((prev) => ({ ...prev, [folder]: res.data!.length }))
        } else if (!isBackground) {
          setError(res.error || `Failed to list ${folder} emails from S3.`)
        }
      } catch (err: any) {
        if (!isBackground) {
          setError(err?.message || `Error occurred while loading ${folder} emails.`)
        }
      } finally {
        if (!isBackground) {
          setLoading(false)
        }
      }
    },
    [config]
  )

  // Refresh current folder and background update other folder counts
  const refreshAllFolders = useCallback(
    async (currentCfg?: AppConfig, isBackground = false) => {
      const activeCfg = currentCfg || config
      await fetchFolderEmails(activeFolder, activeCfg, isBackground)
      // Fetch other folder counts in the background
      if (activeFolder !== 'inbox') fetchFolderEmails('inbox', activeCfg, true)
      if (activeFolder !== 'sent') fetchFolderEmails('sent', activeCfg, true)
      if (activeFolder !== 'trash') fetchFolderEmails('trash', activeCfg, true)
    },
    [activeFolder, config, fetchFolderEmails]
  )

  // Keep a stable ref for refreshAllFolders to use inside timer interval
  const refreshAllFoldersRef = useRef(refreshAllFolders)
  useEffect(() => {
    refreshAllFoldersRef.current = refreshAllFolders
  }, [refreshAllFolders])

  // Is auto-refresh actively enabled
  const isAutoRefreshActive = Boolean(
    config.autoRefreshEnabled !== false &&
    config.bucket &&
    config.accessKeyId &&
    config.secretAccessKey
  )

  // Reset countdown whenever auto-refresh settings change
  useEffect(() => {
    setCountdown(config.autoRefreshInterval || 60)
  }, [config.autoRefreshInterval, config.autoRefreshEnabled])

  // Background auto-refresh timer ticker
  useEffect(() => {
    if (!isAutoRefreshActive) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger silent background poll
          refreshAllFoldersRef.current(undefined, true)
          return config.autoRefreshInterval || 60
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isAutoRefreshActive, config.autoRefreshInterval])

  // Manual refresh resets countdown
  const handleManualRefresh = () => {
    setCountdown(config.autoRefreshInterval || 60)
    refreshAllFolders(config, false)
  }

  // Handle switching folders
  const handleSelectFolder = (folder: FolderType) => {
    setActiveFolder(folder)
    setError(null)
    const hasCache = folderCache[folder] && folderCache[folder].length > 0
    fetchFolderEmails(folder, config, hasCache)
  }

  // Handle email deletion confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      if (window.electronAPI?.deleteEmail) {
        const isPermanent = activeFolder === 'trash' || deleteTarget.key.startsWith('trash/')
        const res = await window.electronAPI.deleteEmail(deleteTarget.key, isPermanent)

        if (res.success) {
          // Remove from current folder list
          setFolderCache((prev) => {
            const updated = prev[activeFolder].filter((e) => e.key !== deleteTarget.key)
            return { ...prev, [activeFolder]: updated }
          })
          setFolderCounts((prev) => ({
            ...prev,
            [activeFolder]: Math.max(0, (prev[activeFolder] || 1) - 1)
          }))

          // If moved to trash, refresh trash folder in the background
          if (!isPermanent) {
            fetchFolderEmails('trash', config, true)
          }
        } else {
          alert(res.error || 'Failed to delete email.')
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred while deleting email.')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Load configuration on mount
  useEffect(() => {
    if (window.electronAPI?.getConfig) {
      window.electronAPI.getConfig().then((loadedConfig) => {
        if (loadedConfig) {
          setConfig(loadedConfig)
          if (loadedConfig.autoRefreshInterval) {
            setCountdown(loadedConfig.autoRefreshInterval)
          }
          if (loadedConfig.bucket && loadedConfig.accessKeyId && loadedConfig.secretAccessKey) {
            refreshAllFolders(loadedConfig)
          } else {
            // Open settings if no bucket is configured yet
            setSettingsTab('s3')
            setIsSettingsOpen(true)
          }
        }
      })
    }
  }, [])

  const handleSaveSettings = (updated: AppConfig) => {
    setConfig(updated)
    setCountdown(updated.autoRefreshInterval || 60)
    refreshAllFolders(updated)
  }

  const handleSelectEmail = (key: string) => {
    if (window.electronAPI?.openEmailViewer) {
      window.electronAPI.openEmailViewer(key)
    }
  }

  const currentEmails = folderCache[activeFolder] || []

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header
        config={config}
        loading={loading}
        countdownSeconds={isAutoRefreshActive ? countdown : null}
        showCountdown={config.showRefreshCountdown !== false}
        onRefresh={handleManualRefresh}
        onOpenSettings={() => {
          setSettingsTab('s3')
          setIsSettingsOpen(true)
        }}
        onCompose={() => setIsComposerOpen(true)}
      />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeFolder={activeFolder}
          onSelectFolder={handleSelectFolder}
          folderCounts={folderCounts}
          onCompose={() => setIsComposerOpen(true)}
        />

        {/* Email Listing Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EmailList
            emails={currentEmails}
            loading={loading}
            error={error}
            config={config}
            folder={activeFolder}
            onOpenSettings={() => {
              setSettingsTab('s3')
              setIsSettingsOpen(true)
            }}
            onSelectEmail={handleSelectEmail}
            onRefresh={handleManualRefresh}
            onCompose={() => setIsComposerOpen(true)}
            onDeleteEmail={(key, subject) => setDeleteTarget({ key, subject })}
          />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        currentConfig={config}
        onSaveSuccess={handleSaveSettings}
      />

      {/* Email Composer Modal */}
      <EmailComposer
        isOpen={isComposerOpen}
        onClose={() => {
          setIsComposerOpen(false)
          fetchFolderEmails('sent', config, true)
        }}
        onOpenSmtpSettings={() => {
          setSettingsTab('smtp')
          setIsSettingsOpen(true)
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        emailSubject={deleteTarget?.subject}
        emailKey={deleteTarget?.key || ''}
        isPermanent={activeFolder === 'trash' || deleteTarget?.key.startsWith('trash/')}
        loading={isDeleting}
      />
    </div>
  )
}

export default App
