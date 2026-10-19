'use client'

import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, TLBaseShape } from 'tldraw'

// 1. REGISTRO GLOBAL PARA TLDRAW v4+ (Elimina los errores TS2344 de TLShape / TLBaseBoxShape)
declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'binomio-cuadrado': {
      w: number
      h: number
      a: number
      b: number
    }
  }
}

// 2. EL CONTRATO DE TYPESCRIPT: Estructura de datos del bloque
export type BinomioShape = TLBaseShape<
  'binomio-cuadrado',
  {
    w: number
    h: number
    a: number
    b: number
  }
>

// 3. LA CLASE CONTROLADORA DEL MICRO-LABORATORIO
export class BinomioShapeUtil extends BaseBoxShapeUtil<BinomioShape> {
  static override type = 'binomio-cuadrado' as const

  // Validador de esquema de Tldraw para la base de datos local (persistenceKey)
  static override props: RecordProps<BinomioShape> = {
    w: T.number,
    h: T.number,
    a: T.number,
    b: T.number,
  }

  // Valores iniciales cuando insertás el bloque en el lienzo
  override getDefaultProps(): BinomioShape['props'] {
    return {
      w: 380,
      h: 440,
      a: 6,
      b: 4,
    }
  }

  // 4. COMPONENTE VISUAL (React + SVG Geométrico Reactivo)
  override component(shape: BinomioShape) {
    const { a, b } = shape.props
    const total = a + b

    // Porcentajes proporcionales para el SVG de 100x100
    const pctA = (a / total) * 100
    const pctB = (b / total) * 100

    const actualizarValor = (clave: 'a' | 'b', nuevoValor: number) => {
      this.editor.updateShape<BinomioShape>({
        id: shape.id,
        type: 'binomio-cuadrado',
        props: { [clave]: nuevoValor },
      })
    }

    return (
      <HTMLContainer
        id={shape.id}
        style={{ pointerEvents: 'all' }}
        className="w-full h-full bg-zinc-900/95 border-2 border-purple-500/60 rounded-xl p-4 text-white shadow-2xl flex flex-col justify-between select-none pointer-events-auto"
      >
        {/* Encabezado y desarrollo algebraico en vivo */}
        <div className="border-b border-zinc-800 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Laboratorio Algebraico
          </span>
          <div className="text-sm font-mono mt-1 text-zinc-200">
            ({a} + {b})² = <span className="text-purple-400 font-bold">{a * a}</span> +{' '}
            <span className="text-fuchsia-300 font-bold">2·({a * b})</span> +{' '}
            <span className="text-indigo-400 font-bold">{b * b}</span> ={' '}
            <span className="text-white font-bold underline">{total * total}</span>
          </div>
        </div>

        {/* Representación Geométrica de Áreas (SVG) */}
        <div className="my-2 flex-1 flex items-center justify-center p-2">
          <svg
            viewBox="0 0 100 100"
            className="w-48 h-48 border border-zinc-700 rounded overflow-hidden"
          >
            {/* Cuadrado a² */}
            <rect
              x="0"
              y="0"
              width={pctA}
              height={pctA}
              className="fill-purple-600/80 stroke-zinc-900 stroke-[0.8]"
            />
            <text
              x={pctA / 2}
              y={pctA / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[6px] font-bold"
            >
              a² ({a * a})
            </text>

            {/* Rectángulo a·b superior derecho */}
            <rect
              x={pctA}
              y="0"
              width={pctB}
              height={pctA}
              className="fill-fuchsia-500/50 stroke-zinc-900 stroke-[0.8]"
            />
            <text
              x={pctA + pctB / 2}
              y={pctA / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[5px]"
            >
              ab ({a * b})
            </text>

            {/* Rectángulo a·b inferior izquierdo */}
            <rect
              x="0"
              y={pctA}
              width={pctA}
              height={pctB}
              className="fill-fuchsia-500/50 stroke-zinc-900 stroke-[0.8]"
            />
            <text
              x={pctA / 2}
              y={pctA + pctB / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[5px]"
            >
              ab ({a * b})
            </text>

            {/* Cuadrado b² */}
            <rect
              x={pctA}
              y={pctA}
              width={pctB}
              height={pctB}
              className="fill-indigo-600/80 stroke-zinc-900 stroke-[0.8]"
            />
            <text
              x={pctA + pctB / 2}
              y={pctA + pctB / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[6px] font-bold"
            >
              b² ({b * b})
            </text>
          </svg>
        </div>

        {/* Controles Deslizadores con escudo completo para Tldraw v4 */}
        <div
          className="space-y-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-xs">
            <label className="text-purple-300 font-mono">Valor a: {a}</label>
            <input
              type="range"
              min="1"
              max="15"
              value={a}
              onChange={(e) => actualizarValor('a', Number(e.target.value))}
              className="w-40 accent-purple-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="text-indigo-300 font-mono">Valor b: {b}</label>
            <input
              type="range"
              min="1"
              max="15"
              value={b}
              onChange={(e) => actualizarValor('b', Number(e.target.value))}
              className="w-40 accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </HTMLContainer>
    )
  }

  // 5. INDICADORES DE SELECCIÓN Y HOVER (Elimina el error TS2515 y el crash de indicatorPathCache)
  override indicator(shape: BinomioShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }

  override getIndicatorPath(shape: BinomioShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12)
    return path
  }
}