import React, { useState, useEffect } from 'react'
import {
  X,
  Key,
  Database,
  Globe,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCode,
  FolderTree,
  Send,
  Server,
  User,
  Mail,
  RefreshCw,
  Clock
} from 'lucide-react'
import type { AppConfig, SmtpConfig, TestConnectionResult, TestSmtpResult } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentConfig: AppConfig
  onSaveSuccess: (updatedConfig: AppConfig) => void
  initialTab?: 's3' | 'smtp'
}

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) [us-east-1]' },
  { value: 'us-east-2', label: 'US East (Ohio) [us-east-2]' },
  { value: 'us-west-1', label: 'US West (N. California) [us-west-1]' },
  { value: 'us-west-2', label: 'US West (Oregon) [us-west-2]' },
  { value: 'eu-west-1', label: 'Europe (Ireland) [eu-west-1]' },
  { value: 'eu-west-2', label: 'Europe (London) [eu-west-2]' },
  { value: 'eu-west-3', label: 'Europe (Paris) [eu-west-3]' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) [eu-central-1]' },
  { value: 'eu-north-1', label: 'Europe (Stockholm) [eu-north-1]' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) [ap-southeast-1]' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) [ap-southeast-2]' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) [ap-northeast-1]' },
  { value: 'sa-east-1', label: 'South America (São Paulo) [sa-east-1]' },
  { value: 'custom', label: 'Custom Region...' }
]

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveSuccess,
  initialTab = 's3'
}) => {
  const [activeTab, setActiveTab] = useState<'s3' | 'smtp'>(initialTab)
  const [formData, setFormData] = useState<AppConfig>(currentConfig)
  const [smtpData, setSmtpData] = useState<SmtpConfig>(
    currentConfig.smtp || {
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: '',
      fromName: '',
      fromEmail: ''
    }
  )

  const [selectedRegionPreset, setSelectedRegionPreset] = useState<string>('us-east-1')
  const [customRegion, setCustomRegion] = useState<string>('')
  const [showSecret, setShowSecret] = useState<boolean>(false)
  const [showSmtpSecret, setShowSmtpSecret] = useState<boolean>(false)
  const [showSessionToken, setShowSessionToken] = useState<boolean>(false)

  // S3 test states
  const [testingS3, setTestingS3] = useState<boolean>(false)
  const [s3TestResult, setS3TestResult] = useState<TestConnectionResult | null>(null)

  // SMTP test states
  const [testingSmtp, setTestingSmtp] = useState<boolean>(false)
  const [smtpTestResult, setSmtpTestResult] = useState<TestSmtpResult | null>(null)

  const [saving, setSaving] = useState<boolean>(false)
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message?: string } | null>(null)
  const [configFilePath, setConfigFilePath] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setFormData(currentConfig)
      setSmtpData(
        currentConfig.smtp || {
          host: '',
          port: 587,
          secure: false,
          user: '',
          password: '',
          fromName: '',
          fromEmail: ''
        }
      )

      const isKnown = AWS_REGIONS.some((r) => r.value === currentConfig.region)
      if (isKnown && currentConfig.region !== 'custom') {
        setSelectedRegionPreset(currentConfig.region || 'us-east-1')
        setCustomRegion('')
      } else if (currentConfig.region) {
        setSelectedRegionPreset('custom')
        setCustomRegion(currentConfig.region)
      } else {
        setSelectedRegionPreset('us-east-1')
        setCustomRegion('')
      }
      setS3TestResult(null)
      setSmtpTestResult(null)
      setSaveStatus(null)

      if (window.electronAPI?.getConfigPath) {
        window.electronAPI.getConfigPath().then(setConfigFilePath)
      }
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const handleRegionSelect = (val: string) => {
    setSelectedRegionPreset(val)
    if (val !== 'custom') {
      setFormData((prev) => ({ ...prev, region: val }))
    } else {
      setFormData((prev) => ({ ...prev, region: customRegion }))
    }
  }

  const handleCustomRegionChange = (val: string) => {
    setCustomRegion(val)
    setFormData((prev) => ({ ...prev, region: val }))
  }

  // Test S3 Connection
  const handleTestS3Connection = async () => {
    setTestingS3(true)
    setS3TestResult(null)
    if (!window.electronAPI?.testConnection) {
      setS3TestResult({
        success: false,
        message: 'Electron API bridge is not available. Please ensure the app is running within Electron.'
      })
      setTestingS3(false)
      return
    }
    try {
      const activeRegion = selectedRegionPreset === 'custom' ? customRegion : selectedRegionPreset
      const payload: AppConfig = { ...formData, region: activeRegion }
      const res = await window.electronAPI.testConnection(payload)
      setS3TestResult(res)
    } catch (err: any) {
      setS3TestResult({
        success: false,
        message: err?.message || 'Failed to communicate with AWS S3'
      })
    } finally {
      setTestingS3(false)
    }
  }

  // Test SMTP Connection
  const handleTestSmtpConnection = async () => {
    setTestingSmtp(true)
    setSmtpTestResult(null)
    if (!window.electronAPI?.testSmtpConnection) {
      setSmtpTestResult({
        success: false,
        message: 'Electron API bridge is not available. Please ensure the app is running within Electron.'
      })
      setTestingSmtp(false)
      return
    }
    try {
      const res = await window.electronAPI.testSmtpConnection(smtpData)
      setSmtpTestResult(res)
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err?.message || 'Failed to test SMTP connection'
      })
    } finally {
      setTestingSmtp(false)
    }
  }

  // Save full configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveStatus(null)

    if (!window.electronAPI?.saveConfig) {
      setSaveStatus({
        success: false,
        message: 'Electron API bridge is not available. Please ensure the app is running within Electron.'
      })
      setSaving(false)
      return
    }

    try {
      const activeRegion = selectedRegionPreset === 'custom' ? customRegion : selectedRegionPreset
      const updated: AppConfig = {
        ...formData,
        region: activeRegion,
        bucket: formData.bucket.trim(),
        accessKeyId: formData.accessKeyId.trim(),
        secretAccessKey: formData.secretAccessKey.trim(),
        sessionToken: formData.sessionToken ? formData.sessionToken.trim() : '',
        prefix: formData.prefix ? formData.prefix.trim() : '',
        maxKeys: Number(formData.maxKeys) || 100,
        smtp: {
          host: smtpData.host.trim(),
          port: Number(smtpData.port) || (smtpData.secure ? 465 : 587),
          secure: Boolean(smtpData.secure),
          user: smtpData.user.trim(),
          password: smtpData.password.trim(),
          fromName: smtpData.fromName ? smtpData.fromName.trim() : '',
          fromEmail: smtpData.fromEmail ? smtpData.fromEmail.trim() : ''
        }
      }

      const res = await window.electronAPI.saveConfig(updated)
      if (res.success) {
        setSaveStatus({ success: true, message: 'Settings saved successfully!' })
        onSaveSuccess(updated)
        setTimeout(() => {
          onClose()
        }, 600)
      } else {
        setSaveStatus({ success: false, message: res.message || 'Failed to save configuration.' })
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: err?.message || 'Error saving configuration.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 app-no-drag">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] app-no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Application Settings</h2>
            <p className="text-xs text-slate-400">Configure AWS S3 for reading emails and SMTP for sending</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 border-b border-slate-800 flex gap-2 bg-slate-950/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('s3')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 's3'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>AWS S3 (Incoming)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
              Required
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'smtp'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>SMTP (Outgoing Mail)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
              Optional
            </span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {/* TAB 1: AWS S3 Configuration */}
          {activeTab === 's3' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* S3 Bucket Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  S3 Bucket Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. my-company-emails-backup"
                  value={formData.bucket}
                  onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                />
              </div>

              {/* AWS Region */}
              <div className="grid grid-cols-1 gap-2">
                <label className="block text-xs font-medium text-slate-300 mb-0.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  AWS Region <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedRegionPreset}
                  onChange={(e) => handleRegionSelect(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                {selectedRegionPreset === 'custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom region, e.g. af-south-1"
                    value={customRegion}
                    onChange={(e) => handleCustomRegionChange(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                )}
              </div>

              {/* Access Key ID */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  AWS Access Key ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={formData.accessKeyId}
                  onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Secret Access Key */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  AWS Secret Access Key <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    required
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    value={formData.secretAccessKey}
                    onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
                    title={showSecret ? 'Hide secret key' : 'Show secret key'}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* S3 Prefix & Max Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                    Folder / Prefix <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. emails/ or incoming/"
                    value={formData.prefix || ''}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Max Objects Limit <span className="text-slate-500 font-normal">(Default: 100)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxKeys || 100}
                    onChange={(e) => setFormData({ ...formData, maxKeys: parseInt(e.target.value, 10) || 100 })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Background Auto-Refresh Preferences */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Automatic Background Refresh</span>
                      <span className="text-[11px] text-slate-400">Silently check for new incoming emails periodically</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoRefreshEnabled !== false}
                      onChange={(e) => setFormData({ ...formData, autoRefreshEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formData.autoRefreshEnabled !== false && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                    {/* Interval selector */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        Refresh Interval
                      </label>
                      <select
                        value={formData.autoRefreshInterval || 60}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            autoRefreshInterval: parseInt(e.target.value, 10) || 60
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-mono"
                      >
                        <option value={30}>Every 30 seconds</option>
                        <option value={60}>Every 1 minute (Default)</option>
                        <option value={120}>Every 2 minutes</option>
                        <option value={300}>Every 5 minutes</option>
                        <option value={600}>Every 10 minutes</option>
                      </select>
                    </div>

                    {/* Show Countdown Toggle */}
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={formData.showRefreshCountdown !== false}
                          onChange={(e) =>
                            setFormData({ ...formData, showRefreshCountdown: e.target.checked })
                          }
                          className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[11px] text-slate-300 font-medium select-none">
                          Show countdown on Refresh button
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-500 pl-6">
                        Displays timer e.g. "Refresh (45s)"
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Session Token (Collapsible) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowSessionToken(!showSessionToken)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                >
                  {showSessionToken ? '− Hide AWS Session Token (STS)' : '+ Add AWS Session Token (STS Temporary Credentials)'}
                </button>

                {showSessionToken && (
                  <div className="mt-2 animate-in fade-in duration-150">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      AWS Session Token <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Paste temporary STS session token if using assumed roles..."
                      value={formData.sessionToken || ''}
                      onChange={(e) => setFormData({ ...formData, sessionToken: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Test S3 Connection Banner */}
              {s3TestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                    s3TestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {s3TestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">
                    <p className="font-semibold">{s3TestResult.success ? 'Success' : 'Connection Failed'}</p>
                    <p className="mt-0.5 text-[11px] opacity-90">{s3TestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SMTP Outgoing Configuration */}
          {activeTab === 'smtp' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <p className="font-medium text-slate-200">Optional SMTP Server Setup</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Configure your SMTP credentials (AWS SES SMTP, Gmail, Outlook, Mailgun, etc.) to enable replying, forwarding, and sending emails directly from the client.
                </p>
              </div>

              {/* SMTP Host & Port */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    SMTP Host / Server
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. email-smtp.eu-west-1.amazonaws.com"
                    value={smtpData.host}
                    onChange={(e) => setSmtpData({ ...smtpData, host: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Port</label>
                  <input
                    type="number"
                    placeholder="587"
                    value={smtpData.port || 587}
                    onChange={(e) => setSmtpData({ ...smtpData, port: parseInt(e.target.value, 10) || 587 })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* SSL/TLS Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={smtpData.secure}
                  onChange={(e) => {
                    const isSecure = e.target.checked
                    setSmtpData({
                      ...smtpData,
                      secure: isSecure,
                      port: isSecure ? 465 : 587
                    })
                  }}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="smtpSecure" className="text-xs text-slate-300 cursor-pointer select-none">
                  Use SSL/TLS (Direct Secure on port 465). Uncheck for STARTTLS (port 587).
                </label>
              </div>

              {/* SMTP Username */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  SMTP Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. AKIA... or user@example.com"
                  value={smtpData.user}
                  onChange={(e) => setSmtpData({ ...smtpData, user: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  SMTP Password
                </label>
                <div className="relative">
                  <input
                    type={showSmtpSecret ? 'text' : 'password'}
                    placeholder="SMTP secret key or password"
                    value={smtpData.password}
                    onChange={(e) => setSmtpData({ ...smtpData, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpSecret(!showSmtpSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
                    title={showSmtpSecret ? 'Hide password' : 'Show password'}
                  >
                    {showSmtpSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sender Name & Email Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fábio Silva"
                    value={smtpData.fromName || ''}
                    onChange={(e) => setSmtpData({ ...smtpData, fromName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Sender "From" Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. me@fabiosilva.eu"
                    value={smtpData.fromEmail || ''}
                    onChange={(e) => setSmtpData({ ...smtpData, fromEmail: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Test SMTP Connection Banner */}
              {smtpTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                    smtpTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {smtpTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">
                    <p className="font-semibold">{smtpTestResult.success ? 'Success' : 'SMTP Connection Failed'}</p>
                    <p className="mt-0.5 text-[11px] opacity-90">{smtpTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Config File Location Info */}
          {configFilePath && (
            <div className="px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                Config stored in local file: <span className="font-mono text-slate-300">{configFilePath}</span>
              </span>
            </div>
          )}

          {/* Save Status Banner */}
          {saveStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                saveStatus.success
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {saveStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{saveStatus.message}</span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            {activeTab === 's3' ? (
              <button
                type="button"
                onClick={handleTestS3Connection}
                disabled={testingS3 || !formData.bucket || !formData.accessKeyId || !formData.secretAccessKey}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {testingS3 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>{testingS3 ? 'Testing S3...' : 'Test S3 Connection'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestSmtpConnection}
                disabled={testingSmtp || !smtpData.host || !smtpData.user || !smtpData.password}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{testingSmtp ? 'Testing SMTP...' : 'Test SMTP Connection'}</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
