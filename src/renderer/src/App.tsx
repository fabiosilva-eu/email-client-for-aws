import React, { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { SettingsModal } from './components/SettingsModal'
import { EmailList } from './components/EmailList'
import { EmailViewer } from './components/EmailViewer'
import type { AwsConfig, EmailSummary } from './types'

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
  const [config, setConfig] = useState<AwsConfig>({
    bucket: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    prefix: '',
    maxKeys: 100
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch emails from S3
  const fetchEmails = useCallback(async (currentCfg?: AwsConfig) => {
    const activeCfg = currentCfg || config
    if (!activeCfg.bucket || !activeCfg.accessKeyId || !activeCfg.secretAccessKey) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (!window.electronAPI?.listEmails) {
        setError('Electron API bridge is not available. Please ensure the app is running within Electron.')
        setLoading(false)
        return
      }
      const res = await window.electronAPI.listEmails({
        prefix: activeCfg.prefix,
        maxKeys: activeCfg.maxKeys
      })
      if (res.success && res.data) {
        setEmails(res.data)
      } else {
        setError(res.error || 'Failed to list emails from S3.')
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while loading emails.')
    } finally {
      setLoading(false)
    }
  }, [config])

  // Load configuration on mount
  useEffect(() => {
    if (window.electronAPI?.getConfig) {
      window.electronAPI.getConfig().then((loadedConfig) => {
        if (loadedConfig) {
          setConfig(loadedConfig)
          if (loadedConfig.bucket && loadedConfig.accessKeyId && loadedConfig.secretAccessKey) {
            fetchEmails(loadedConfig)
          } else {
            // Open settings if no bucket is configured yet
            setIsSettingsOpen(true)
          }
        }
      })
    }
  }, [])

  const handleSaveSettings = (updated: AwsConfig) => {
    setConfig(updated)
    fetchEmails(updated)
  }

  const handleSelectEmail = (key: string) => {
    if (window.electronAPI?.openEmailViewer) {
      window.electronAPI.openEmailViewer(key)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header
        config={config}
        loading={loading}
        onRefresh={() => fetchEmails()}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <EmailList
          emails={emails}
          loading={loading}
          error={error}
          config={config}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectEmail={handleSelectEmail}
          onRefresh={() => fetchEmails()}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentConfig={config}
        onSaveSuccess={handleSaveSettings}
      />
    </div>
  )
}

export default App

