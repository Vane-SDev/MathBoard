'use client'

import { useEffect, useRef, useState } from 'react'
import { CenteredTopPanelContainer, useEditor, type TLShape } from 'tldraw'
import { BarraClase } from '@/components/BarraClase'

type Categoria = 'Álgebra y Geometría' | 'Cálculo I' | 'Cálculo II' | 'Graficador'

type Laboratorio = { categoria: Categoria; label: string; tipo: TLShape['type']; w: number; h: number }

const CATEGORIAS: Categoria[] = ['Álgebra y Geometría', 'Cálculo I', 'Cálculo II', 'Graficador']

// w/h: tamaño usado para centrar el bloque en el viewport
const LABORATORIOS: Laboratorio[] = [
  { categoria: 'Álgebra y Geometría', label: 'Cuadrado del Binomio', tipo: 'binomio-cuadrado', w: 380, h: 440 },
  { categoria: 'Álgebra y Geometría', label: 'Matriz 2x2', tipo: 'matriz-2x2', w: 520, h: 600 },
  { categoria: 'Álgebra y Geometría', label: 'Trigonometría', tipo: 'trigonometria-circulo', w: 780, h: 640 },
  { categoria: 'Álgebra y Geometría', label: 'Cónicas', tipo: 'conicas', w: 640, h: 780 },
  { categoria: 'Cálculo I', label: 'Límites', tipo: 'limite-funcion', w: 560, h: 640 },
  { categoria: 'Cálculo I', label: 'Derivada', tipo: 'derivada-estudio', w: 580, h: 700 },
  { categoria: 'Cálculo I', label: 'Integral', tipo: 'integral-simple', w: 580, h: 680 },
  { categoria: 'Cálculo II', label: 'Polares', tipo: 'coordenadas-polares', w: 580, h: 700 },
  { categoria: 'Cálculo II', label: 'Superficies y derivadas', tipo: 'superficie-3d', w: 640, h: 820 },
  { categoria: 'Cálculo II', label: 'Integral doble', tipo: 'integral-doble-3d', w: 640, h: 820 },
  { categoria: 'Cálculo II', label: 'Cambio de variables', tipo: 'cambio-variables-3d', w: 640, h: 870 },
  { categoria: 'Graficador', label: 'Graficador libre', tipo: 'graficador-libre', w: 640, h: 760 },
]

type Abierto = 'labs' | 'clase' | null

const frenar = (e: { stopPropagation: () => void }) => e.stopPropagation()

const chip = 'text-xs whitespace-nowrap font-medium px-3 py-1 rounded-full border transition-colors cursor-pointer'

// Barra de marca en el TopPanel de tldraw: se centra sola entre el menú y el panel de estilos.
export function BarraSuperior() {
  const editor = useEditor()
  const [abierto, setAbierto] = useState<Abierto>(null)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(null)
    }
    // En captura: el lienzo de tldraw puede frenar el evento antes de que llegue a window
    const alTocarFuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(null)
    }
    window.addEventListener('keydown', alPresionar)
    window.addEventListener('pointerdown', alTocarFuera, true)
    return () => {
      window.removeEventListener('keydown', alPresionar)
      window.removeEventListener('pointerdown', alTocarFuera, true)
    }
  }, [abierto])

  const insertar = ({ tipo, w, h }: Laboratorio) => {
    setAbierto(null)
    const { x, y } = editor.getViewportPageBounds().center
    editor.createShape({
      type: tipo,
      x: x - w / 2,
      y: y - h / 2,
    })
  }

  return (
    <CenteredTopPanelContainer maxWidth={680}>
      <div
        ref={raiz}
        style={{ pointerEvents: 'all' }}
        onPointerDown={frenar}
        className="relative flex items-center gap-1.5 mt-2 w-fit mx-auto bg-zinc-900/90 border border-purple-500/40 rounded-2xl px-2 py-1 shadow-xl shadow-zinc-900/25 backdrop-blur-md"
      >
        <div className="flex items-center gap-1.5 border-r border-purple-500/40 pr-2 mr-1 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-im.png" alt="" aria-hidden className="h-8 w-8 shrink-0" />
          <span className="hidden md:inline text-xs font-bold text-white whitespace-nowrap">Infinitamente Matemático</span>
        </div>

        <button
          onClick={() => setAbierto(abierto === 'labs' ? null : 'labs')}
          className={`${chip} ${
            abierto === 'labs'
              ? 'bg-purple-600 border-purple-500 text-white'
              : 'bg-zinc-900 border-purple-500/40 text-purple-200 hover:bg-zinc-800'
          }`}
          title="Laboratorios"
        >
          🧪 <span className="hidden sm:inline">Laboratorios</span> ▾
        </button>

        <BarraClase abierto={abierto === 'clase'} alternar={() => setAbierto(abierto === 'clase' ? null : 'clase')} />

        {abierto === 'labs' && (
          <div className="absolute top-full left-0 mt-2 w-64 max-h-[70vh] overflow-y-auto flex flex-col gap-1 bg-zinc-900/95 border border-purple-500/40 p-1.5 rounded-xl shadow-lg backdrop-blur-md">
            {CATEGORIAS.map((cat) => (
              <div key={cat} className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase text-purple-300 px-3 pt-1.5">{cat}</span>
                {LABORATORIOS.filter((l) => l.categoria === cat).map((lab) => (
                  <button
                    key={lab.tipo}
                    onClick={() => insertar(lab)}
                    className="text-xs text-left whitespace-nowrap text-white font-medium px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors cursor-pointer"
                  >
                    + {lab.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </CenteredTopPanelContainer>
  )
}
