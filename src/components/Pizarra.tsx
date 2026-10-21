'use client'

import { Tldraw, defaultShapeUtils, type TLComponents } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { useMemo } from 'react'
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
import { Graficador3DShapeUtil } from '@/components/Graficador3DShape'
import { IntegralDoble3DShapeUtil } from '@/components/IntegralDoble3DShape'
import { CambioVariables3DShapeUtil } from '@/components/CambioVariables3DShape'
import { ReglaShapeUtil } from '@/components/ReglaShape'
import { TransportadorShapeUtil } from '@/components/TransportadorShape'
import { EscuadraShapeUtil } from '@/components/EscuadraShape'
import { CompasTool, GuiaCompas } from '@/components/CompasTool'
import { assetsEnLinea } from '@/lib/assetsEnLinea'
import { registrarTrazoConRegla } from '@/lib/trazos'
import { urlDeSincronizacion } from '@/lib/sala'
import { BarraSuperior } from '@/components/BarraSuperior'
import { ContextoClase } from '@/components/ContextoClase'
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
  Graficador3DShapeUtil,
  SuperficieDerivadas3DShapeUtil,
  IntegralDoble3DShapeUtil,
  CambioVariables3DShapeUtil,
  ReglaShapeUtil,
  TransportadorShapeUtil,
  EscuadraShapeUtil,
]

// useSync necesita todos los utils (los de tldraw + los nuestros) para armar el schema de la sala.
const utilsDeLaSala = [...defaultShapeUtils, ...misBloquesMatematicos]

// Sin R2 no guardamos videos. AFUERA del componente: un array nuevo en cada render remonta tldraw.
const SIN_VIDEOS: string[] = []

// Herramientas propias (StateNode). AFUERA del componente por la misma razón.
const HERRAMIENTAS = [CompasTool]

// Fondo de cuaderno, barra de marca en el TopPanel y guía del compás. AFUERA del componente por la misma razón.
const COMPONENTES: TLComponents = { Background: FondoCuaderno, TopPanel: BarraSuperior, OnTheCanvas: GuiaCompas }

export function Pizarra({ sala }: { sala: string }) {
  // La sala vive en el Durable Object: es la única fuente de verdad (no hay persistenceKey).
  const store = useSync({
    uri: urlDeSincronizacion(sala),
    assets: assetsEnLinea,
    shapeUtils: utilsDeLaSala,
  })

  // Datos de la sala para la barra del TopPanel (vive dentro de tldraw)
  const datosClase = useMemo(
    () => ({ sala, conectado: store.status === 'synced-remote' && store.connectionStatus === 'online' }),
    [sala, store],
  )

  return (
    <main className="fixed inset-0 bg-white">
      {store.status !== 'synced-remote' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center text-zinc-500 text-sm">
          {store.status === 'loading' ? 'Conectando con la sala…' : 'No se pudo conectar con la sala. Revisá tu conexión y recargá.'}
        </div>
      )}
      <ContextoClase.Provider value={datosClase}>
        <Tldraw
          store={store}
          licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
          acceptedVideoMimeTypes={SIN_VIDEOS}
          tools={HERRAMIENTAS}
          shapeUtils={misBloquesMatematicos}
          components={COMPONENTES}
          onMount={(instanciaEditor) => {
            // Tema claro por defecto (hoja de cuaderno). Cada usuario puede cambiarlo desde el menú de tldraw.
            instanciaEditor.user.updateUserPreferences({ colorScheme: 'light' })
            // Trazos a mano sobre el canto de una regla o escuadra quedan rectos
            return registrarTrazoConRegla(instanciaEditor)
          }}
        />
      </ContextoClase.Provider>
    </main>
  )
}
