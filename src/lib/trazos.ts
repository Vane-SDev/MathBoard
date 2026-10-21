// Trazos rectos que dejan los instrumentos: segmentos nativos de tldraw (shape 'line'), así sincronizan sin tocar el Worker.

import {
  createShapeId,
  getIndices,
  Vec,
  type Editor,
  type TLDefaultColorStyle,
  type TLDefaultSizeStyle,
  type TLDrawShape,
  type TLLineShape,
  type TLShape,
  type VecLike,
} from 'tldraw'
import type { ReglaShape } from '@/components/ReglaShape'
import type { EscuadraShape } from '@/components/EscuadraShape'
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

/** Qué tan lejos del canto (en unidades de la hoja, ≈ 3 mm) puede pasar el lápiz para "apoyarse" en el instrumento */
const TOLERANCIA = 14

/** Un canto recto de un instrumento, en sus coordenadas: de `a` a `b`, con el 0 de la escala a `cero` de `a` */
type Canto = { a: Vec; b: Vec; cero: number }

/** Cantos donde se puede apoyar el lápiz: los dos de la regla y los tres de la escuadra */
function cantos(editor: Editor, shape: TLShape): Canto[] {
  if (editor.isShapeOfType<ReglaShape>(shape, 'regla')) {
    const { w, h } = shape.props
    return [
      { a: new Vec(0, 0), b: new Vec(w, 0), cero: MARGEN_REGLA },
      { a: new Vec(0, h), b: new Vec(w, h), cero: MARGEN_REGLA },
    ]
  }
  if (editor.isShapeOfType<EscuadraShape>(shape, 'escuadra')) {
    const { w, h } = shape.props
    const recto = new Vec(0, h)
    return [
      { a: recto, b: new Vec(w, h), cero: 0 },
      { a: recto, b: new Vec(0, 0), cero: 0 },
      { a: new Vec(0, 0), b: new Vec(w, h), cero: 0 },
    ]
  }
  return []
}

/**
 * Si el trazo a mano alzada corre pegado a un canto de una regla o escuadra, lo reemplaza por un segmento
 * sobre ese canto, con los extremos redondeados al milímetro de su escala.
 * Para cada punto q (en el sistema del instrumento): t = (q − a)·û es cuánto avanza a lo largo del canto
 * y d = (q − a) × û qué tan lejos queda de él.
 */
function enderezarSobreInstrumento(editor: Editor, trazo: TLDrawShape) {
  const aHoja = editor.getShapePageTransform(trazo)
  const puntos = editor.getShapeGeometry(trazo).vertices.map((v) => aHoja.applyToPoint(v))
  if (puntos.length < 2) return

  for (const instrumento of editor.getCurrentPageShapes()) {
    const lista = cantos(editor, instrumento)
    if (!lista.length) continue
    const locales = puntos.map((p) => editor.getPointInShapeSpace(instrumento, p))
    for (const { a, b, cero } of lista) {
      const largo = Vec.Dist(a, b)
      const u = Vec.Sub(b, a).uni()
      const ts = locales.map((q) => Vec.Dpr(Vec.Sub(q, a), u))
      const pegado = locales.every((q, k) => Math.abs(Vec.Cpr(Vec.Sub(q, a), u)) <= TOLERANCIA && ts[k] >= -TOLERANCIA && ts[k] <= largo + TOLERANCIA)
      if (!pegado) continue
      const aMm = (t: number) => cero + Math.round((t - cero) / PX_POR_MM) * PX_POR_MM
      const desde = Math.max(0, aMm(Math.min(...ts)))
      const hasta = Math.min(largo, aMm(Math.max(...ts)))
      if (hasta - desde < PX_POR_MM) return
      const aPagina = editor.getShapePageTransform(instrumento)
      editor.run(() => {
        editor.deleteShape(trazo.id)
        crearSegmento(editor, aPagina.applyToPoint(Vec.Add(a, Vec.Mul(u, desde))), aPagina.applyToPoint(Vec.Add(a, Vec.Mul(u, hasta))), {
          color: trazo.props.color,
          size: trazo.props.size,
        })
      })
      return
    }
  }
}

/** Se llama en onMount: trazos a mano sobre el canto de una regla o escuadra quedan rectos. Devuelve la función que quita el listener. */
export function registrarTrazoConRegla(editor: Editor) {
  return editor.sideEffects.registerAfterChangeHandler('shape', (antes, despues, origen) => {
    // Solo trazos propios recién terminados: los de otros alumnos ya llegan enderezados por la sala
    if (origen !== 'user' || despues.type !== 'draw' || antes.type !== 'draw') return
    if (antes.props.isComplete || !despues.props.isComplete) return
    enderezarSobreInstrumento(editor, despues)
  })
}
