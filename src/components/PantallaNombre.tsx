'use client'

import { useState, type FormEvent } from 'react'
import { getUserPreferences, setUserPreferences } from 'tldraw'

// Primera vez en este navegador: el nombre se guarda en las preferencias de tldraw (mismo lugar que "Tu nombre").
export function PantallaNombre({ alListo }: { alListo: () => void }) {
  const [nombre, setNombre] = useState('')

  const entrar = (e: FormEvent) => {
    e.preventDefault()
    const limpio = nombre.trim().slice(0, 40)
    if (!limpio) return
    setUserPreferences({ ...getUserPreferences(), name: limpio })
    alListo()
  }

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-zinc-950 px-6">
      <form onSubmit={entrar} className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-im.png" alt="Infinitamente Matemático" className="h-20 w-20" />
        <label className="flex w-full flex-col gap-2 text-sm font-medium text-white">
          ¿Cómo te llamás?
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            className="rounded-lg border border-purple-500/40 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-fuchsia-400"
          />
        </label>
        <button
          type="submit"
          disabled={!nombre.trim()}
          className="cursor-pointer rounded-full bg-fuchsia-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-40"
        >
          Entrar a la clase
        </button>
      </form>
    </main>
  )
}
