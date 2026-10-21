'use client'

import { useState, useSyncExternalStore } from 'react'
import { getUserPreferences } from 'tldraw'
import { Pizarra } from '@/components/Pizarra'
import { PantallaNombre } from '@/components/PantallaNombre'
import { salaDeLaUrl } from '@/lib/sala'

// La URL no cambia sin recargar la página, así que no hace falta suscribirse a nada.
const sinSuscripcion = () => () => {}

export default function PizarraPage() {
  // La sala sale de ?sala= (por defecto "general"). En el build estático no hay URL: ahí vale null.
  const sala = useSyncExternalStore(sinSuscripcion, salaDeLaUrl, () => null)
  if (!sala) return <main className="fixed inset-0 bg-zinc-950" />
  // key={sala}: al cambiar de sala se arma una pizarra nueva, sin mezclar documentos.
  return <ConNombre key={sala} sala={sala} />
}

// Antes de entrar pedimos el nombre: queda en el registro de visitas de la profe y en el cursor.
// Solo se monta en el navegador (en el build estático sala es null), así que puede leer localStorage.
function ConNombre({ sala }: { sala: string }) {
  const [listo, setListo] = useState(() => Boolean(getUserPreferences().name?.trim()))
  if (!listo) return <PantallaNombre alListo={() => setListo(true)} />
  return <Pizarra sala={sala} />
}
