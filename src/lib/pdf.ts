import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PX_POR_CM } from '@/lib/geometria'

// Todo pasa en el navegador: el PDF nunca sale de la compu. A la sala solo viaja la página elegida, como webp.
// Los archivos de /pdfjs los copia scripts/copiar-pdfjs.mjs desde node_modules (misma versión que la librería).
const RUTA = '/pdfjs/'

// Página exportada: 1200 px de ancho deja legibles subíndices de 7 pt (con 1000 px ya se empastan).
// Se prueba en orden hasta que el webp entre en PESO_OBJETIVO; si ninguno entra en BYTES_MAXIMOS, error.
const INTENTOS = [
  { ancho: 1200, calidad: 0.75 },
  { ancho: 1200, calidad: 0.6 },
  { ancho: 1000, calidad: 0.6 },
]
const LADO_MAXIMO = 1800
const PESO_OBJETIVO = 180 * 1024
const BYTES_MAXIMOS = 400 * 1024

// 1 pt = 1/72 de pulgada = 2,54/72 cm
const CM_POR_PT = 2.54 / 72

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let cargando: Promise<Pdfjs> | null = null

// Import dinámico: pdf.js toca DOMMatrix al cargarse y rompería el build estático (no hay window en el servidor).
function cargarPdfjs(): Promise<Pdfjs> {
  cargando ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `${RUTA}pdf.worker.min.mjs`
    return pdfjs
  })
  return cargando
}

export async function abrirPdf(archivo: File): Promise<PDFDocumentProxy> {
  const pdfjs = await cargarPdfjs()
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(await archivo.arrayBuffer()),
      cMapUrl: `${RUTA}cmaps/`,
      standardFontDataUrl: `${RUTA}standard_fonts/`,
      wasmUrl: `${RUTA}wasm/`,
    }).promise
  } catch (error) {
    if (error instanceof pdfjs.PasswordException) throw new Error('El PDF tiene contraseña: guardalo sin contraseña y probá de nuevo')
    if (error instanceof pdfjs.InvalidPDFException) throw new Error('El archivo no es un PDF válido')
    throw error
  }
}

// Una página cancelada por pasar rápido de hoja no es un error.
export const esCancelacion = (error: unknown): boolean =>
  error instanceof Error && error.name === 'RenderingCancelledException'

// Vista previa: el canvas mide anchoCss en pantalla y tiene anchoCss · devicePixelRatio píxeles reales (nítido en celular).
export function dibujarVista(pagina: PDFPageProxy, canvas: HTMLCanvasElement, anchoCss: number): RenderTask {
  const base = pagina.getViewport({ scale: 1 })
  const ratio = window.devicePixelRatio || 1
  const vista = pagina.getViewport({ scale: (anchoCss / base.width) * ratio })
  canvas.width = Math.floor(vista.width)
  canvas.height = Math.floor(vista.height)
  canvas.style.width = `${anchoCss}px`
  canvas.style.height = `${(anchoCss * base.height) / base.width}px`
  return pagina.render({ canvas, viewport: vista })
}

export type PaginaExportada = {
  src: string // data URL webp
  pxW: number // tamaño del webp
  pxH: number
  bytes: number
  w: number // tamaño en la pizarra: el real de la hoja (1 cm del PDF = 1 cm de la regla)
  h: number
}

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(blob)
  })
}

// Se dibuja aparte, en un canvas fuera de pantalla: el resultado no depende del tamaño del modal ni del celular.
export async function exportarPagina(pagina: PDFPageProxy): Promise<PaginaExportada> {
  const base = pagina.getViewport({ scale: 1 })
  const canvas = document.createElement('canvas')
  let elegido: { blob: Blob; pxW: number; pxH: number } | null = null
  try {
    for (const { ancho, calidad } of INTENTOS) {
      const escala = Math.min(ancho / base.width, LADO_MAXIMO / base.height)
      const vista = pagina.getViewport({ scale: escala })
      if (canvas.width !== Math.floor(vista.width)) {
        canvas.width = Math.floor(vista.width)
        canvas.height = Math.floor(vista.height)
        await pagina.render({ canvas, viewport: vista }).promise
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', calidad))
      if (!blob) throw new Error('El navegador no pudo generar la imagen')
      if (!elegido || blob.size < elegido.blob.size) elegido = { blob, pxW: canvas.width, pxH: canvas.height }
      if (blob.size <= PESO_OBJETIVO) break
    }
    if (!elegido || elegido.blob.size > BYTES_MAXIMOS) throw new Error('La página es demasiado pesada para la sala')
    return {
      src: await blobADataUrl(elegido.blob),
      pxW: elegido.pxW,
      pxH: elegido.pxH,
      bytes: elegido.blob.size,
      w: base.width * CM_POR_PT * PX_POR_CM,
      h: base.height * CM_POR_PT * PX_POR_CM,
    }
  } finally {
    // Libera la memoria del canvas enseguida (Safari en iPhone tiene un tope bajo).
    canvas.width = 0
    canvas.height = 0
  }
}
