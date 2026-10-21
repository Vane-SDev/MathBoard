'use client'

// Reemplaza a la pizarra cuando el servidor avisa que la sala fue clausurada.
export function PantallaClausurada() {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      {/* Lugar del logo de Infinitamente Matemático */}
      <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-purple-500/40 bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-im.png" alt="Infinitamente Matemático" className="h-20 w-20" />
      </div>
      <p className="max-w-md text-lg font-medium text-white">
        Esta sala ya no está disponible. Comunicate con Vane para agendar una clase.
      </p>
            <div className="flex flex-wrap justify-center gap-3">
        <a
          href="https://wa.me/5492643171733?text=Hola%20Vane%2C%20quiero%20agendar%20una%20clase"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-fuchsia-600 px-5 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
        >
          💬 Escribirle por WhatsApp
        </a>
        <a
          href="https://infinitamentematematico.com"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-purple-500/40 px-5 py-2 text-sm font-medium text-purple-200 hover:bg-zinc-900"
        >
          🌐 infinitamentematematico.com
        </a>
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-purple-300">Infinitamente Matemático</span>
    </main>
  )
}
