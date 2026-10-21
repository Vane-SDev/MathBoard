'use client'

import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { parseTldrawJsonFile, serializeTldrawJsonBlob, useEditor, useValue } from 'tldraw'
import { irASala, linkDeSala, recordarSala } from '@/lib/sala'
import { useClase } from '@/components/ContextoClase'
import { GestorSalas } from '@/components/GestorSalas'
import { detectarProfe } from '@/lib/rol'

// Colores de cursor en la gama de la marca + algunos contrastantes para distinguir alumnos.
const COLORES = ['#a855f7', '#d946ef', '#6366f1', '#f472b6', '#22d3ee', '#4ade80', '#facc15', '#fb923c']

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

export function BarraClase({ abierto, alternar }: { abierto: boolean; alternar: () => void }) {
  const editor = useEditor()
  const { sala, conectado } = useClase()
  // Al entrar, la sala actual pasa a ser la primera de "mis salas" (la Pizarra se remonta por sala).
  const [recientes] = useState(() => recordarSala(sala))
  const [esProfe] = useState(detectarProfe)
  const [copiado, setCopiado] = useState(false)
  const [conGestor, setConGestor] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  // Nombre y color los guarda tldraw en este navegador; viajan en la presencia (cursor) a los demás.
  const nombre = useValue('nombre', () => editor.user.getName(), [editor])
  const color = useValue('color', () => editor.user.getColor(), [editor])
  const gente = useValue('gente', () => editor.getCollaborators(), [editor])
  const siguiendo = useValue('siguiendo', () => editor.getInstanceState().followingUserId, [editor])

  const cerrarGestor = useCallback(() => setConGestor(false), [])

  // Las salas nuevas se crean en el gestor: el Worker solo acepta salas que creó la profe con su clave.
  const nuevaSala = () => setConGestor(true)

  const copiarLink = async () => {
    await navigator.clipboard.writeText(linkDeSala(sala))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const guardar = async () => {
    const blob = await serializeTldrawJsonBlob(editor)
    const fecha = new Date().toISOString().slice(0, 10)
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = `${sala}-${fecha}.tldr`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  const cargar = async (e: ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (!esProfe || !elegido) return
    if (!window.confirm(`Esto reemplaza TODO lo que hay en la sala "${sala}", también en las pantallas de tus alumnos. ¿Seguir?`)) return
    const resultado = parseTldrawJsonFile({ schema: editor.store.schema, json: await elegido.text() })
    if (!resultado.ok) {
      window.alert('No se pudo abrir el archivo: no es un .tldr de esta pizarra o está dañado.')
      return
    }
    editor.loadSnapshot(resultado.value.getStoreSnapshot())
    editor.clearHistory()
  }

  const chip = 'text-xs whitespace-nowrap font-medium px-3 py-1 rounded-full border transition-colors cursor-pointer'
  const chipNormal = `${chip} bg-zinc-900 border-purple-500/40 text-purple-200 hover:bg-zinc-800`
  const subtitulo = 'text-[11px] uppercase text-purple-300'

  return (
    <>
      <button onClick={alternar} className={chipNormal} title="Sala, tu nombre y quién está conectado">
        👥 <span className="hidden sm:inline">Clase</span> ▾ {conectado ? '🟢' : '🔴'} {gente.length + 1}
      </button>

      {esProfe && (
        <button onClick={() => setConGestor(true)} className={chipNormal} title="Mis salas: abrir, clausurar o reabrir">
          🗂️ <span className="hidden sm:inline">Salas</span>
        </button>
      )}
      {conGestor && <GestorSalas salaActual={sala} recientes={recientes} cerrar={cerrarGestor} />}

      <button
        onClick={copiarLink}
        className={`${chip} bg-fuchsia-600 border-fuchsia-500 hover:bg-fuchsia-500 text-white`}
        title="Copiar link de clase"
      >
        🔗 <span className="hidden sm:inline">{copiado ? '¡Copiado!' : 'Copiar link'}</span>
      </button>

      {abierto && (
        <div className="absolute top-full right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto flex flex-col gap-3 bg-zinc-900/95 border border-purple-500/40 p-3 rounded-xl shadow-lg backdrop-blur-md">
          <section className="flex flex-col gap-1.5">
            <span className={subtitulo}>Sala</span>
            {esProfe ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={sala}
                  onChange={(e) => irASala(e.target.value)}
                  className="text-xs bg-zinc-950 border border-purple-500/40 rounded-full px-2 py-1 text-white outline-none cursor-pointer max-w-40"
                  title="Mis salas"
                >
                  {recientes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button onClick={nuevaSala} className={chipNormal}>
                  + Nueva sala
                </button>
              </div>
            ) : (
              <span
                className="w-fit text-xs whitespace-nowrap font-medium px-3 py-1 rounded-full border bg-zinc-950 border-purple-500/40 text-white max-w-full truncate"
                title="Sala de la clase"
              >
                Sala: {sala}
              </span>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <span className={subtitulo}>Vos</span>
            <label className="flex flex-col gap-1 text-xs text-purple-300">
              Tu nombre (lo ven en tu cursor)
              <input
                value={nombre}
                onChange={(e) => editor.user.updateUserPreferences({ name: e.target.value })}
                onKeyDown={frenar}
                onKeyUp={frenar}
                className="bg-zinc-950 border border-purple-500/40 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-fuchsia-400"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COLORES.map((c) => (
                <button
                  key={c}
                  onClick={() => editor.user.updateUserPreferences({ color: c })}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 ${c === color ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-1">
            <span className={subtitulo}>En línea ({gente.length + 1})</span>
            {gente.length === 0 && <span className="text-xs text-zinc-400 px-2 py-1">Todavía no entró nadie más.</span>}
            {gente.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-800">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-xs text-white truncate flex-1">{p.userName || 'Sin nombre'}</span>
                {siguiendo === p.userId ? (
                  <button onClick={() => editor.stopFollowingUser()} className="text-xs text-fuchsia-300 cursor-pointer">
                    Dejar de seguir
                  </button>
                ) : (
                  <button onClick={() => editor.startFollowingUser(p.userId)} className="text-xs text-purple-300 cursor-pointer">
                    Seguir
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-1.5">
            <span className={subtitulo}>Respaldo</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={guardar} className={chipNormal} title="Descargar un respaldo de la sala">
                💾 Guardar
              </button>
              {esProfe && (
                <>
                  <button onClick={() => archivo.current?.click()} className={chipNormal} title="Restaurar un respaldo .tldr">
                    📂 Cargar
                  </button>
                  <input ref={archivo} type="file" accept=".tldr" className="hidden" onChange={cargar} />
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
