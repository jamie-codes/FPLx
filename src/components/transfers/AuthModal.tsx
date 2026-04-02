'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Mode = 'credentials' | 'manual'

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode>('credentials')

  // Credentials form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [credLoading, setCredLoading] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)

  // Manual token form state
  const [tokenInput, setTokenInput] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  // Control dialog open/close via showModal() / close()
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [open])

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setEmail('')
      setPassword('')
      setTokenInput('')
      setCredError(null)
      setManualError(null)
      setMode('credentials')
    }
  }, [open])

  // Sync React state when dialog closes natively (Escape key)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => onClose()
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [onClose])

  // Backdrop click to dismiss
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  const handleCredentialsLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setCredLoading(true)
    setCredError(null)
    try {
      const res = await fetch('/api/auth/fpl-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setCredError(body.error ?? 'Login failed — check your email and password')
        return
      }

      if (body.ok === false && body.code === 'NO_TOKEN') {
        // Credentials valid but FPL's OAuth flow requires client-side JS to
        // complete the token exchange — guide user to manual entry instead
        setCredError("Your FPL credentials are valid, but we couldn't extract the token automatically. Use the manual token method below.")
        setMode('manual')
        return
      }

      onSuccess()
    } catch {
      setCredError('Request failed — check your connection')
    } finally {
      setCredLoading(false)
    }
  }, [email, password, onSuccess])

  // Clipboard paste button
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setTokenInput(text.trim())
    } catch {
      // Permission denied — user can still paste manually
    }
  }, [])

  const handleManualLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setManualLoading(true)
    setManualError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setManualError(body.detail ?? body.error ?? 'Invalid token')
        return
      }
      onSuccess()
      setTokenInput('')
    } catch {
      setManualError('Request failed — check your connection')
    } finally {
      setManualLoading(false)
    }
  }, [tokenInput, onSuccess])

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 w-full max-w-lg shadow-lg"
    >
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Connect FPL Account
        </h2>

        {/* Mode tabs */}
        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setMode('credentials')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              mode === 'credentials'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Email &amp; password
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              mode === 'manual'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Manual token
          </button>
        </div>

        {/* Credentials form */}
        {mode === 'credentials' && (
          <form onSubmit={handleCredentialsLogin} className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your credentials are sent directly to FPL and never stored by this app.
            </p>
            <input
              type="email"
              placeholder="FPL email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm w-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <input
              type="password"
              placeholder="FPL password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm w-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            {credError && <p className="text-sm text-red-600 dark:text-red-400">{credError}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                type="submit"
                disabled={credLoading || !email.trim() || !password}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-50 cursor-pointer active:scale-95 transition-transform w-full sm:w-auto"
              >
                {credLoading ? 'Connecting…' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer w-full sm:w-auto text-center sm:text-left"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Manual token form */}
        {mode === 'manual' && (
          <form onSubmit={handleManualLogin} className="space-y-3">
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Open <span className="font-medium">fantasy.premierleague.com</span> and log in</li>
              <li>Press <span className="font-mono font-medium">F12</span> → <span className="font-medium">Network</span> tab</li>
              <li>Reload the page, click any <span className="font-mono">/api/</span> request</li>
              <li>In <span className="font-medium">Headers</span>, find <span className="font-mono">x-api-authorization</span></li>
              <li>Copy the value (starts with <span className="font-mono">&quot;Bearer eyJ…&quot;</span>) and paste below</li>
            </ol>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Paste Bearer token here…"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                required
                className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-xs w-full font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                className="px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer active:scale-95 transition-transform shrink-0"
              >
                &#x1F4CB; Paste
              </button>
            </div>
            {manualError && <p className="text-sm text-red-600 dark:text-red-400">{manualError}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                type="submit"
                disabled={manualLoading || !tokenInput.trim()}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-50 cursor-pointer active:scale-95 transition-transform w-full sm:w-auto"
              >
                {manualLoading ? 'Saving…' : 'Save token'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer w-full sm:w-auto text-center sm:text-left"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
