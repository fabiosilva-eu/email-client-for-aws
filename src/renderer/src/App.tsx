import React, { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { SettingsModal } from './components/SettingsModal'
import { EmailList } from './components/EmailList'
import { EmailViewer } from './components/EmailViewer'
import { EmailComposer } from './components/EmailComposer'
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
    maxKeys: 100
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
    async (currentCfg?: AppConfig) => {
      const activeCfg = currentCfg || config
      await fetchFolderEmails(activeFolder, activeCfg, false)
      // Fetch other folder counts in the background
      if (activeFolder !== 'inbox') fetchFolderEmails('inbox', activeCfg, true)
      if (activeFolder !== 'sent') fetchFolderEmails('sent', activeCfg, true)
      if (activeFolder !== 'trash') fetchFolderEmails('trash', activeCfg, true)
    },
    [activeFolder, config, fetchFolderEmails]
  )

  // Handle switching folders
  const handleSelectFolder = (folder: FolderType) => {
    setActiveFolder(folder)
    setError(null)
    // If not cached, fetch immediately; if cached, fetch fresh in background
    const hasCache = folderCache[folder] && folderCache[folder].length > 0
    fetchFolderEmails(folder, config, hasCache)
  }

  // Load configuration on mount
  useEffect(() => {
    if (window.electronAPI?.getConfig) {
      window.electronAPI.getConfig().then((loadedConfig) => {
        if (loadedConfig) {
          setConfig(loadedConfig)
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
        onRefresh={() => refreshAllFolders()}
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
            onRefresh={() => fetchFolderEmails(activeFolder, config, false)}
            onCompose={() => setIsComposerOpen(true)}
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
          // Refresh sent and inbox folders when composer closes (in case email was sent)
          fetchFolderEmails('sent', config, true)
        }}
        onOpenSmtpSettings={() => {
          setSettingsTab('smtp')
          setIsSettingsOpen(true)
        }}
      />
    </div>
  )
}

export default App
