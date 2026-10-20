'use client'

import { useSyncExternalStore } from 'react'
import { Pizarra } from '@/components/Pizarra'
import { salaDeLaUrl } from '@/lib/sala'

// La URL no cambia sin recargar la página, así que no hace falta suscribirse a nada.
const sinSuscripcion = () => () => {}

export default function PizarraPage() {
  // La sala sale de ?sala= (por defecto "general"). En el build estático no hay URL: ahí vale null.
  const sala = useSyncExternalStore(sinSuscripcion, salaDeLaUrl, () => null)
  if (!sala) return <main className="fixed inset-0 bg-zinc-950" />
  // key={sala}: al cambiar de sala se arma una pizarra nueva, sin mezclar documentos.
  return <Pizarra key={sala} sala={sala} />
}
