'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { AssetRecordType, createShapeId, useEditor, type Editor, type TLImageShape } from 'tldraw'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { abrirPdf, dibujarVista, esCancelacion, exportarPagina, type PaginaExportada } from '@/lib/pdf'
import { PX_POR_CM } from '@/lib/geometria'

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const mensaje = (error: unknown): string => (error instanceof Error ? error.message : 'Algo salió mal con el PDF')

const boton =
  'text-xs whitespace-nowrap font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default'

// Más páginas juntas = más peso para todos los que entran a la sala (~150 KB por hoja densa).
const MAX_POR_VEZ = 20
const COLUMNAS = 5
const SEPARACION = PX_POR_CM // 1 cm entre hojas

type HojaConNombre = { hoja: PaginaExportada; nombre: string }

// Cada hoja entra como asset de imagen con su data URL (la sala lo guarda como cualquier otro registro)
// y un shape 'image'. Varias hojas se acomodan en grilla de hasta 5 columnas, centrada en lo que se ve ahora.
// Todo en un solo paso de historial: un Ctrl+Z las saca todas.
function insertarPaginas(editor: Editor, hojas: HojaConNombre[]) {
  const columnas = Math.min(hojas.length, COLUMNAS)
  const filas = Math.ceil(hojas.length / columnas)
  const anchoCelda = Math.max(...hojas.map((h) => h.hoja.w))
  const altoCelda = Math.max(...hojas.map((h) => h.hoja.h))
  const anchoTotal = columnas * anchoCelda + (columnas - 1) * SEPARACION
  const altoTotal = filas * altoCelda + (filas - 1) * SEPARACION
  // El centro de la pantalla en coordenadas de la PÁGINA (el lienzo), no en píxeles de la ventana.
  const centro = editor.getViewportPageBounds().center
  const x0 = centro.x - anchoTotal / 2
  const y0 = centro.y - altoTotal / 2
  const ids = hojas.map(() => createShapeId())
  editor.markHistoryStoppingPoint('pegar-paginas-pdf')
  editor.run(() => {
    hojas.forEach(({ hoja, nombre }, i) => {
      const assetId = AssetRecordType.createId()
      editor.createAssets([
        {
          id: assetId,
          typeName: 'asset',
          type: 'image',
          props: { name: nombre, src: hoja.src, w: hoja.pxW, h: hoja.pxH, mimeType: 'image/webp', isAnimated: false, fileSize: hoja.bytes },
          meta: {},
        },
      ])
      editor.createShape<TLImageShape>({
        id: ids[i],
        type: 'image',
        x: x0 + (i % columnas) * (anchoCelda + SEPARACION),
        y: y0 + Math.floor(i / columnas) * (altoCelda + SEPARACION),
        props: { assetId, w: hoja.w, h: hoja.h },
      })
    })
  })
  editor.select(...ids)
  const limites = editor.getSelectionPageBounds()
  // Que se vean todas las hojas sin pasar del 100 %
  if (limites) editor.zoomToBounds(limites, { targetZoom: 1, inset: 32, animation: { duration: 300 } })
}

// Queda montado aunque esté cerrado: así recuerda el PDF y la página para pegar la siguiente.
export function VisorPdfModal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const editor = useEditor()
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState(1)
  const [salto, setSalto] = useState('1')
  const [desde, setDesde] = useState('1')
  const [hasta, setHasta] = useState('1')
  const [ocupado, setOcupado] = useState<'abriendo' | 'pegando' | null>(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pegadas, setPegadas] = useState<number[]>([])
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tarea = useRef<RenderTask | null>(null)
  const total = doc?.numPages ?? 0

  // Al cambiar de PDF (o salir de la sala) se libera el anterior y su worker
  useEffect(() => () => void doc?.loadingTask.destroy(), [doc])

  // El foco entra al modal: Esc y las flechas llegan acá y no a tldraw
  useEffect(() => {
    if (abierto) panel.current?.focus()
  }, [abierto])

  // Dibuja la página actual ajustada al espacio libre. Si se pasa de hoja antes de terminar, se cancela la anterior.
  useEffect(() => {
    if (!abierto || !doc) return
    let vivo = true
    doc
      .getPage(numero)
      .then((pagina) => {
        const caja = contenedor.current
        const lienzo = canvas.current
        if (!vivo || !caja || !lienzo) return
        tarea.current?.cancel()
        const base = pagina.getViewport({ scale: 1 })
        const anchoCss = Math.min(caja.clientWidth - 16, ((caja.clientHeight - 16) * base.width) / base.height)
        tarea.current = dibujarVista(pagina, lienzo, Math.max(anchoCss, 200))
        return tarea.current.promise
      })
      .catch((e: unknown) => {
        if (vivo && !esCancelacion(e)) setError(mensaje(e))
      })
    return () => {
      vivo = false
      tarea.current?.cancel()
    }
  }, [abierto, doc, numero])

  const irA = (n: number) => {
    const destino = Math.min(Math.max(1, Math.round(n)), total)
    setNumero(destino)
    setSalto(String(destino))
    setError(null)
  }

  const elegirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setOcupado('abriendo')
    setError(null)
    try {
      const nuevo = await abrirPdf(archivo)
      setDoc(nuevo)
      setNombre(archivo.name.replace(/\.pdf$/i, ''))
      setNumero(1)
      setSalto('1')
      setDesde('1')
      setHasta(String(Math.min(nuevo.numPages, 5)))
      setPegadas([])
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(null)
    }
  }

  // Rango de páginas como lo escribió la profe, ordenado y dentro del PDF
  const rango = (): [number, number] => {
    const a = Math.min(Math.max(1, Math.round(Number(desde) || 1)), total)
    const b = Math.min(Math.max(1, Math.round(Number(hasta) || a)), total)
    return a <= b ? [a, b] : [b, a]
  }
  const [primera, ultima] = doc ? rango() : [1, 1]
  const cantidad = ultima - primera + 1

  // Exporta una por una (así no se juntan 20 canvas en memoria) y las pega todas juntas al final.
  const pegar = async (inicio: number, fin: number) => {
    if (!doc) return
    if (fin - inicio + 1 > MAX_POR_VEZ) {
      setError(`Máximo ${MAX_POR_VEZ} páginas por vez: cada hoja la descargan todos los que entran a la sala`)
      return
    }
    setOcupado('pegando')
    setError(null)
    try {
      const hojas: HojaConNombre[] = []
      for (let n = inicio; n <= fin; n++) {
        setProgreso(fin > inicio ? `Preparando ${n - inicio + 1} de ${fin - inicio + 1}…` : 'Pegando…')
        hojas.push({ hoja: await exportarPagina(await doc.getPage(n)), nombre: `${nombre} · pág. ${n}` })
      }
      insertarPaginas(editor, hojas)
      setPegadas((p) => [...new Set([...p, ...hojas.map((_, i) => inicio + i)])])
      alCerrar()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(null)
      setProgreso('')
    }
  }

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') alCerrar()
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowLeft' && numero > 1) irA(numero - 1)
    if (e.key === 'ArrowRight' && numero < total) irA(numero + 1)
  }

  if (!abierto) return null

  return (
    // fixed inset-0 (no h-screen): en el celular respeta la barra del navegador
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onPointerDown={frenar}
      onPointerUp={frenar}
      onKeyDown={teclas}
      onKeyUp={frenar}
      onWheel={frenar}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Visor de PDF"
        tabIndex={-1}
        className="flex flex-col w-full max-w-4xl h-full max-h-[60rem] bg-zinc-900 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-500/30">
          <span className="text-sm font-bold text-white shrink-0">📄 PDF</span>
          <span className="text-xs text-purple-200 truncate min-w-0 flex-1" title={nombre}>
            {doc ? nombre : 'Elegí un archivo de tu compu: no se sube a ningún lado'}
          </span>
          <button
            onClick={() => input.current?.click()}
            disabled={ocupado !== null}
            className={`${boton} bg-zinc-800 border-purple-500/40 text-purple-100 hover:bg-zinc-700`}
          >
            {doc ? 'Otro PDF' : 'Elegir PDF'}
          </button>
          <button onClick={alCerrar} className={`${boton} bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700`} title="Cerrar (Esc)">
            ✕
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={elegirArchivo} />
        </div>

        <div ref={contenedor} className="relative flex-1 min-h-0 overflow-auto flex items-start justify-center bg-zinc-800 p-2">
          {doc ? (
            <canvas ref={canvas} className="bg-white shadow-lg" />
          ) : (
            <button
              onClick={() => input.current?.click()}
              disabled={ocupado !== null}
              className="self-center text-sm font-medium px-5 py-3 rounded-xl border border-dashed border-purple-400/60 text-purple-100 hover:bg-zinc-700 cursor-pointer"
            >
              {ocupado === 'abriendo' ? 'Abriendo…' : 'Elegir un PDF'}
            </button>
          )}
          {doc && pegadas.includes(numero) && (
            <span className="absolute top-3 right-3 text-[11px] font-medium bg-fuchsia-600 text-white px-2 py-0.5 rounded-full">
              ✓ ya está en la pizarra
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-300 bg-red-950/60 px-3 py-1.5">{error}</p>}

        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 border-t border-purple-500/30">
          <button
            onClick={() => irA(numero - 1)}
            disabled={!doc || numero <= 1}
            className={`${boton} bg-zinc-800 border-purple-500/40 text-white hover:bg-zinc-700`}
          >
            ◀ Anterior
          </button>
          <label className="flex items-center gap-1.5 text-xs text-purple-100 whitespace-nowrap">
            Página
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={total || 1}
              value={salto}
              disabled={!doc}
              onChange={(e) => setSalto(e.target.value)}
              onBlur={() => irA(Number(salto) || numero)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') irA(Number(salto) || numero)
              }}
              className="w-14 bg-zinc-800 border border-purple-500/40 rounded-md px-1.5 py-1 text-white text-center"
            />
            de {total}
          </label>
          <button
            onClick={() => irA(numero + 1)}
            disabled={!doc || numero >= total}
            className={`${boton} bg-zinc-800 border-purple-500/40 text-white hover:bg-zinc-700`}
          >
            Siguiente ▶
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-3">
          <button
            onClick={() => pegar(numero, numero)}
            disabled={!doc || ocupado !== null}
            className={`${boton} bg-purple-600 border-purple-500 text-white hover:bg-purple-500`}
          >
            {ocupado === 'pegando' ? progreso : '📌 Pegar esta página'}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-purple-100 whitespace-nowrap border border-purple-500/40 rounded-lg pl-2.5 pr-1 py-1">
            Varias: de
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={total || 1}
              value={desde}
              disabled={!doc}
              onChange={(e) => setDesde(e.target.value)}
              className="w-12 bg-zinc-800 border border-purple-500/40 rounded-md px-1 py-0.5 text-white text-center"
              aria-label="Desde la página"
            />
            a
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={total || 1}
              value={hasta}
              disabled={!doc}
              onChange={(e) => setHasta(e.target.value)}
              className="w-12 bg-zinc-800 border border-purple-500/40 rounded-md px-1 py-0.5 text-white text-center"
              aria-label="Hasta la página"
            />
            <button
              onClick={() => pegar(primera, ultima)}
              disabled={!doc || ocupado !== null || cantidad > MAX_POR_VEZ}
              className={`${boton} bg-fuchsia-600 border-fuchsia-500 text-white hover:bg-fuchsia-500`}
              title={cantidad > MAX_POR_VEZ ? `Máximo ${MAX_POR_VEZ} páginas por vez` : undefined}
            >
              📌 Pegar {cantidad} {cantidad === 1 ? 'página' : 'páginas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
