'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { AssetRecordType, createShapeId, useEditor, type Editor, type TLImageShape } from 'tldraw'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { abrirPdf, dibujarVista, esCancelacion, exportarPagina, type PaginaExportada } from '@/lib/pdf'

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const mensaje = (error: unknown): string => (error instanceof Error ? error.message : 'Algo salió mal con el PDF')

const boton =
  'text-xs whitespace-nowrap font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default'

// La hoja entra como asset de imagen con su data URL (la sala la guarda como cualquier otro registro)
// y un shape 'image' centrado en lo que se ve ahora. Un Ctrl+Z la saca entera.
function insertarPagina(editor: Editor, hoja: PaginaExportada, nombre: string) {
  const assetId = AssetRecordType.createId()
  const id = createShapeId()
  // El centro de la pantalla en coordenadas de la PÁGINA (el lienzo), no en píxeles de la ventana.
  const { x, y } = editor.getViewportPageBounds().center
  editor.markHistoryStoppingPoint('pegar-pagina-pdf')
  editor.run(() => {
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
      id,
      type: 'image',
      x: x - hoja.w / 2,
      y: y - hoja.h / 2,
      props: { assetId, w: hoja.w, h: hoja.h },
    })
  })
  editor.select(id)
  const limites = editor.getShapePageBounds(id)
  // Que se vea la hoja entera sin pasar del 100 %
  if (limites) editor.zoomToBounds(limites, { targetZoom: 1, inset: 32, animation: { duration: 300 } })
}

// Queda montado aunque esté cerrado: así recuerda el PDF y la página para pegar la siguiente.
export function VisorPdfModal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const editor = useEditor()
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState(1)
  const [salto, setSalto] = useState('1')
  const [ocupado, setOcupado] = useState<'abriendo' | 'pegando' | null>(null)
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
      setPegadas([])
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(null)
    }
  }

  const pegar = async () => {
    if (!doc) return
    setOcupado('pegando')
    setError(null)
    try {
      const hoja = await exportarPagina(await doc.getPage(numero))
      insertarPagina(editor, hoja, `${nombre} · pág. ${numero}`)
      setPegadas((p) => (p.includes(numero) ? p : [...p, numero]))
      alCerrar()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(null)
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
          <button
            onClick={pegar}
            disabled={!doc || ocupado !== null}
            className={`${boton} sm:ml-auto bg-purple-600 border-purple-500 text-white hover:bg-purple-500`}
          >
            {ocupado === 'pegando' ? 'Pegando…' : '📌 Pegar esta página en la pizarra'}
          </button>
        </div>
      </div>
    </div>
  )
}
