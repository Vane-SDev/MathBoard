// Trazos rectos que dejan los instrumentos: segmentos nativos de tldraw (shape 'line'), así sincronizan sin tocar el Worker.

import {
  createShapeId,
  getIndices,
  type Editor,
  type TLDefaultColorStyle,
  type TLDefaultSizeStyle,
  type TLDrawShape,
  type TLLineShape,
  type VecLike,
} from 'tldraw'
import type { ReglaShape } from '@/components/ReglaShape'
import { MARGEN_REGLA, PX_POR_MM } from '@/lib/geometria'

/** Segmento recto de A a B (coordenadas de la hoja) */
export function crearSegmento(
  editor: Editor,
  a: VecLike,
  b: VecLike,
  estilo: { color: TLDefaultColorStyle; size: TLDefaultSizeStyle },
) {
  const [i0, i1] = getIndices(2)
  editor.createShape<TLLineShape>({
    id: createShapeId(),
    type: 'line',
    x: a.x,
    y: a.y,
    props: {
      color: estilo.color,
      size: estilo.size,
      dash: 'solid',
      spline: 'line',
      points: {
        a: { id: 'a', index: i0, x: 0, y: 0 },
        b: { id: 'b', index: i1, x: b.x - a.x, y: b.y - a.y },
      },
    },
  })
}

/** Qué tan lejos del canto (en unidades de la hoja, ≈ 3 mm) puede pasar el lápiz para "apoyarse" en la regla */
const TOLERANCIA = 14

/** Lleva x a la marca de milímetro más cercana de la regla (el 0 está en MARGEN_REGLA) */
const aMm = (x: number) => MARGEN_REGLA + Math.round((x - MARGEN_REGLA) / PX_POR_MM) * PX_POR_MM

/**
 * Si el trazo a mano alzada corre pegado a un canto de alguna regla, lo reemplaza por un segmento
 * sobre ese canto, con los extremos redondeados al milímetro.
 */
function enderezarSobreRegla(editor: Editor, trazo: TLDrawShape) {
  const aHoja = editor.getShapePageTransform(trazo)
  const puntos = editor.getShapeGeometry(trazo).vertices.map((v) => aHoja.applyToPoint(v))
  if (puntos.length < 2) return

  const reglas = editor.getCurrentPageShapes().filter((s): s is ReglaShape => s.type === 'regla')
  for (const regla of reglas) {
    const { w, h } = regla.props
    // Los puntos en el sistema de la regla: x a lo largo del canto, y perpendicular (ya contempla la rotación)
    const locales = puntos.map((p) => editor.getPointInShapeSpace(regla, p))
    for (const canto of [0, h]) {
      const pegado = locales.every((q) => Math.abs(q.y - canto) <= TOLERANCIA && q.x >= -TOLERANCIA && q.x <= w + TOLERANCIA)
      if (!pegado) continue
      const xs = locales.map((q) => q.x)
      const desde = Math.max(0, aMm(Math.min(...xs)))
      const hasta = Math.min(w, aMm(Math.max(...xs)))
      if (hasta - desde < PX_POR_MM) return
      const aPagina = editor.getShapePageTransform(regla)
      editor.run(() => {
        editor.deleteShape(trazo.id)
        crearSegmento(editor, aPagina.applyToPoint({ x: desde, y: canto }), aPagina.applyToPoint({ x: hasta, y: canto }), {
          color: trazo.props.color,
          size: trazo.props.size,
        })
      })
      return
    }
  }
}

/** Se llama en onMount. Devuelve la función que quita el listener. */
export function registrarTrazoConRegla(editor: Editor) {
  return editor.sideEffects.registerAfterChangeHandler('shape', (antes, despues, origen) => {
    // Solo trazos propios recién terminados: los de otros alumnos ya llegan enderezados por la sala
    if (origen !== 'user' || despues.type !== 'draw' || antes.type !== 'draw') return
    if (antes.props.isComplete || !despues.props.isComplete) return
    enderezarSobreRegla(editor, despues)
  })
}
