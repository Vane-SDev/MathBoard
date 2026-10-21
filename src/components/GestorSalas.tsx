'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Actividad, InfoSala } from '@/lib/clausura'
import { ClaveIncorrecta, cambiarEstado, claveGuardada, guardarClave, listarSalas, verActividad } from '@/lib/gestorSalas'
import { irASala, nombreDeSalaNueva } from '@/lib/sala'

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const chip = 'text-xs whitespace-nowrap font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer disabled:opacity-40'
const chipNormal = `${chip} border-purple-500/40 text-purple-200 hover:bg-zinc-800`
const campo = 'rounded-lg border border-purple-500/40 bg-zinc-950 px-2 py-1 text-xs text-white outline-none focus:border-fuchsia-400'

function fecha(ms: number): string {
  return ms ? new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'sin registro'
}

function fechaHora(ms: number): string {
  return new Date(ms).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

function minutos(desde: number, hasta: number): string {
  const m = Math.max(1, Math.round((hasta - desde) / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

type Props = { salaActual: string; recientes: string[]; cerrar: () => void }

// Modal de la profe: crear salas (solo acá se pueden crear), ver quién entró y clausurar o reabrir.
export function GestorSalas({ salaActual, recientes, cerrar }: Props) {
  const [clave, setClave] = useState(claveGuardada)
  const [borrador, setBorrador] = useState('')
  const [salas, setSalas] = useState<InfoSala[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [alumno, setAlumno] = useState('')
  const [error, setError] = useState('')
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<{ sala: string; datos: Actividad | null } | null>(null)

  const fallar = (e: unknown) => {
    if (e instanceof ClaveIncorrecta) {
      guardarClave('')
      setClave('')
    }
    setError(e instanceof Error ? e.message : 'Error desconocido')
  }

  useEffect(() => {
    if (!clave) return
    let vigente = true
    listarSalas(clave)
      .then((lista) => vigente && setSalas(lista))
      .catch((e: unknown) => vigente && fallar(e))
    return () => {
      vigente = false
    }
  }, [clave])

  // Escape con el foco fuera del modal (los campos de adentro lo resuelven en onKeyDown).
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [cerrar])

  const entrar = (e: FormEvent) => {
    e.preventDefault()
    guardarClave(borrador.trim())
    setError('')
    setClave(borrador.trim())
  }

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    if (!alumno.trim()) return
    const nueva = nombreDeSalaNueva(alumno)
    setOcupada(nueva)
    try {
      await cambiarEstado(nueva, 'abrir', clave)
      irASala(nueva)
    } catch (err) {
      fallar(err)
      setOcupada(null)
    }
  }

  const alternar = async (s: InfoSala) => {
    const aviso = `¿Clausurar "${s.nombre}"? Quien tenga el link va a ver el aviso de sala no disponible. Podés reabrirla después.`
    if (!s.clausurada && !window.confirm(aviso)) return
    setOcupada(s.nombre)
    try {
      await cambiarEstado(s.nombre, s.clausurada ? 'abrir' : 'clausurar', clave)
      setSalas(await listarSalas(clave))
    } catch (e) {
      fallar(e)
    } finally {
      setOcupada(null)
    }
  }

  const mostrarActividad = async (sala: string) => {
    if (detalle?.sala === sala) return setDetalle(null)
    setDetalle({ sala, datos: null })
    try {
      const datos = await verActividad(sala, clave)
      setDetalle((d) => (d?.sala === sala ? { sala, datos } : d))
    } catch (e) {
      fallar(e)
      setDetalle(null)
    }
  }

  const registradas = new Set((salas ?? []).map((s) => s.nombre))
  const filas: InfoSala[] = [
    ...(salas ?? []),
    ...recientes.filter((r) => !registradas.has(r)).map((nombre) => ({ nombre, creada: 0, ultimoUso: 0, clausurada: false })),
  ].filter((s) => s.nombre.includes(filtro.trim().toLowerCase()))

  // Portal: el backdrop-blur de la barra encerraría a un `fixed` dentro de ella.
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/70 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && cerrar()}
      onKeyDown={(e) => {
        // Frenamos las teclas para que tldraw no las tome; Escape cierra aunque el foco esté en un campo.
        e.stopPropagation()
        if (e.key === 'Escape') cerrar()
      }}
      onKeyUp={frenar}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-2xl border border-purple-500/40 bg-zinc-900 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">🗂️ Mis salas</h2>
          <button onClick={cerrar} className="cursor-pointer text-purple-300 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && <p className="text-xs text-fuchsia-300">{error}</p>}

        {!clave ? (
          <form onSubmit={entrar} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-purple-300">
              Clave de profe (se guarda en este navegador)
              <input type="password" autoFocus value={borrador} onChange={(e) => setBorrador(e.target.value)} className={campo} />
            </label>
            <button type="submit" className={`${chip} w-fit bg-purple-600 border-purple-500 text-white hover:bg-purple-500`}>
              Entrar
            </button>
          </form>
        ) : !salas ? (
          <p className="text-xs text-zinc-400">Cargando salas…</p>
        ) : (
          <>
            <form onSubmit={crear} className="flex items-center gap-1.5">
              <input
                value={alumno}
                onChange={(e) => setAlumno(e.target.value)}
                placeholder="Alumno o grupo para una sala nueva"
                className={`${campo} flex-1`}
              />
              <button
                type="submit"
                disabled={!alumno.trim() || ocupada !== null}
                className={`${chip} bg-fuchsia-600 border-fuchsia-500 text-white hover:bg-fuchsia-500`}
              >
                + Crear y entrar
              </button>
            </form>

            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar sala…" className={campo} />

            <ul className="flex flex-col gap-1 overflow-y-auto">
              {filas.length === 0 && <li className="px-2 py-1 text-xs text-zinc-400">No hay salas.</li>}
              {filas.map((s) => (
                <li key={s.nombre} className="flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-xs font-medium ${s.clausurada ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {s.nombre}
                        {s.nombre === salaActual && <span className="ml-1 text-fuchsia-300">(actual)</span>}
                      </span>
                      <span className="text-[11px] text-zinc-400">Último uso: {fecha(s.ultimoUso)}</span>
                    </div>
                    <button onClick={() => mostrarActividad(s.nombre)} className={chipNormal} title="Quién entró y cuánto se quedó">
                      👁️
                    </button>
                    {!s.clausurada && s.nombre !== salaActual && (
                      <button onClick={() => irASala(s.nombre)} className={chipNormal}>
                        Abrir
                      </button>
                    )}
                    <button
                      onClick={() => alternar(s)}
                      disabled={ocupada !== null}
                      title={s.clausurada ? 'Reabrir sala' : 'Clausurar sala'}
                      className={
                        s.clausurada ? chipNormal : `${chip} border-fuchsia-500/60 text-fuchsia-200 hover:bg-fuchsia-600 hover:text-white`
                      }
                    >
                      {ocupada === s.nombre ? '…' : s.clausurada ? '♻️ Reabrir' : '🗑️ Clausurar'}
                    </button>
                  </div>

                  {detalle?.sala === s.nombre && (
                    <div className="flex flex-col gap-0.5 rounded-lg bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300">
                      {!detalle.datos ? (
                        <span className="text-zinc-400">Cargando…</span>
                      ) : (
                        <>
                          <span className="text-purple-300">
                            Ahora: {detalle.datos.enLinea.length ? detalle.datos.enLinea.join(', ') : 'nadie'}
                          </span>
                          {detalle.datos.visitas.length === 0 && <span className="text-zinc-400">Sin visitas registradas.</span>}
                          {detalle.datos.visitas.map((v, i) => (
                            <span key={i} className="flex justify-between gap-2">
                              <span className="truncate text-white">{v.nombre}</span>
                              <span className="whitespace-nowrap">
                                {fechaHora(v.entrada)} · {v.salida ? minutos(v.entrada, v.salida) : 'adentro'}
                              </span>
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
