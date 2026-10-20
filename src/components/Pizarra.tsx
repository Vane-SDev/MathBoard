'use client'

import { Tldraw, Editor, defaultShapeUtils, type TLComponents, type TLShape } from 'tldraw'
import { useSync } from '@tldraw/sync'
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
import { CambioVariables3DShapeUtil } from '@/components/CambioVariables3DShape'
import { assetsEnLinea } from '@/lib/assetsEnLinea'
import { urlDeSincronizacion } from '@/lib/sala'
import { BarraClase } from '@/components/BarraClase'
import { FondoCuaderno } from '@/components/FondoCuaderno'

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
  CambioVariables3DShapeUtil,
]

// useSync necesita todos los utils (los de tldraw + los nuestros) para armar el schema de la sala.
const utilsDeLaSala = [...defaultShapeUtils, ...misBloquesMatematicos]

// Sin R2 no guardamos videos. AFUERA del componente: un array nuevo en cada render remonta tldraw.
const SIN_VIDEOS: string[] = []

// Fondo de cuaderno en lugar del fondo liso. AFUERA del componente por la misma razón.
const COMPONENTES: TLComponents = { Background: FondoCuaderno }

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

export function Pizarra({ sala }: { sala: string }) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [abierta, setAbierta] = useState<Categoria | null>(null)

  // La sala vive en el Durable Object: es la única fuente de verdad (no hay persistenceKey).
  const store = useSync({
    uri: urlDeSincronizacion(sala),
    assets: assetsEnLinea,
    shapeUtils: utilsDeLaSala,
  })

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
    <main className="fixed inset-0 w-screen h-screen bg-white">
      {/* Barra flotante superior de tu marca */}
      <div className="absolute top-16 sm:top-3 inset-x-0 mx-auto w-fit max-w-[min(56rem,calc(100vw-2rem))] z-[1000] flex flex-wrap items-center justify-center gap-1.5 bg-zinc-900/90 border border-purple-500/40 px-3 py-1.5 rounded-2xl shadow-xl shadow-zinc-900/25 backdrop-blur-md">
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
        <BarraClase
          editor={editor}
          sala={sala}
          conectado={store.status === 'synced-remote' && store.connectionStatus === 'online'}
        />
      </div>

      {store.status !== 'synced-remote' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center text-zinc-500 text-sm">
          {store.status === 'loading' ? 'Conectando con la sala…' : 'No se pudo conectar con la sala. Revisá tu conexión y recargá.'}
        </div>
      )}
      <Tldraw
        store={store}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
        acceptedVideoMimeTypes={SIN_VIDEOS}
        shapeUtils={misBloquesMatematicos}
        components={COMPONENTES}
        onMount={(instanciaEditor) => {
          // Tema claro por defecto (hoja de cuaderno). Cada usuario puede cambiarlo desde el menú de tldraw.
          instanciaEditor.user.updateUserPreferences({ colorScheme: 'light' })
          setEditor(instanciaEditor)
        }}
      />
    </main>
  )
}
