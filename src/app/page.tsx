'use client'

import { Tldraw, Editor, type TLShape } from 'tldraw'
import 'tldraw/tldraw.css'
import { useEffect, useState } from 'react'
import { BinomioShapeUtil } from '@/components/BinomioShape'
import { MatrizShapeUtil } from '@/components/MatrizShape'
import { LimiteShapeUtil } from '@/components/LimiteShape'
import { IntegralSimpleShapeUtil } from '@/components/IntegralSimpleShape'
import { PolaresShapeUtil } from '@/components/PolaresShape'
import { DerivadaShapeUtil } from '@/components/DerivadaShape'
import { TrigonometriaShapeUtil } from '@/components/TrigonometriaShape'
import { ConicasShapeUtil } from '@/components/ConicasShape'
import { GraficadorLibreShapeUtil } from '@/components/GraficadorLibreShape'
import { SuperficieDerivadas3DShapeUtil } from '@/components/SuperficieDerivadas3DShape'
import { IntegralDoble3DShapeUtil } from '@/components/IntegralDoble3DShape'

// 1. Declaramos el array AFUERA del componente para evitar re-renders
const misBloquesMatematicos = [
  BinomioShapeUtil,
  MatrizShapeUtil,
  LimiteShapeUtil,
  IntegralSimpleShapeUtil,
  PolaresShapeUtil,
  DerivadaShapeUtil,
  TrigonometriaShapeUtil,
  ConicasShapeUtil,
  GraficadorLibreShapeUtil,
  SuperficieDerivadas3DShapeUtil,
  IntegralDoble3DShapeUtil,
]

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
  { categoria: 'Graficador', label: 'Graficador libre', tipo: 'graficador-libre', w: 640, h: 760 },
]

export default function PizarraPage() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [abierta, setAbierta] = useState<Categoria | null>(null)

  useEffect(() => {
    if (!abierta) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [abierta])

  const insertar = ({ tipo, w, h }: Laboratorio) => {
    setAbierta(null)
    if (!editor) return
    const { x, y } = editor.getViewportPageBounds().center
    editor.createShape({
      type: tipo,
      x: x - w / 2,
      y: y - h / 2,
    })
  }

  return (
    <main className="fixed inset-0 w-screen h-screen bg-zinc-950">
      {/* Barra flotante superior de tu marca */}
      <div className="absolute top-16 sm:top-3 inset-x-0 mx-auto w-fit max-w-[calc(100vw-2rem)] z-50 flex flex-wrap items-center justify-center gap-1.5 bg-zinc-900/90 border border-purple-500/40 px-3 py-1.5 rounded-2xl shadow-lg backdrop-blur-md">
        <span className="text-xs font-bold text-purple-300 tracking-wide mr-1 whitespace-nowrap">
          Laboratorios:
        </span>
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            onClick={() => setAbierta(abierta === cat ? null : cat)}
            className={`text-xs whitespace-nowrap font-medium px-3 py-1 rounded-full border transition-colors cursor-pointer ${
              abierta === cat
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-zinc-900 border-purple-500/40 text-purple-200 hover:bg-zinc-800'
            }`}
          >
            {cat} ▾
          </button>
        ))}

        {abierta && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 min-w-48 max-w-[calc(100vw-2rem)] flex flex-col gap-1 bg-zinc-900/95 border border-purple-500/40 p-1.5 rounded-xl shadow-lg backdrop-blur-md">
            {LABORATORIOS.filter((l) => l.categoria === abierta).map((lab) => (
              <button
                key={lab.tipo}
                onClick={() => insertar(lab)}
                className="text-xs text-left whitespace-nowrap text-white font-medium px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors cursor-pointer"
              >
                + {lab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Tldraw
        persistenceKey="mi-pizarra-local"
        shapeUtils={misBloquesMatematicos}
        onMount={(instanciaEditor) => {
          // Activamos el modo oscuro de forma nativa en Tldraw v4+
          instanciaEditor.user.updateUserPreferences({ colorScheme: 'dark' })
          setEditor(instanciaEditor)
        }}
      />
    </main>
  )
}
