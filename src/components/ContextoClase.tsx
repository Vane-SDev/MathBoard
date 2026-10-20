'use client'

import { createContext, useContext } from 'react'

export type DatosClase = { sala: string; conectado: boolean }

// Datos de la sala para la UI que vive dentro de tldraw (TopPanel), donde no llegan props de Pizarra.
export const ContextoClase = createContext<DatosClase | null>(null)

export function useClase(): DatosClase {
  const datos = useContext(ContextoClase)
  if (!datos) throw new Error('useClase fuera de ContextoClase')
  return datos
}
