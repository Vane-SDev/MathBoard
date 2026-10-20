'use client'

import { useEditor, useValue } from 'tldraw'

// Cuadrícula de cuaderno: un cuadradito cada CUADRO unidades de la hoja y una línea
// un poco más marcada cada MAYOR cuadraditos. Está en unidades de la hoja (no de pantalla),
// así que acompaña el paneo y el zoom igual que los dibujos.
const CUADRO = 24
const MAYOR = 5

// Por debajo de este tamaño en pantalla (px) los cuadraditos se vuelven una mancha gris y se ocultan.
const MINIMO_VISIBLE = 6

export function FondoCuaderno() {
  const editor = useEditor()
  const camara = useValue('camara', () => editor.getCamera(), [editor])
  const oscuro = useValue('oscuro', () => editor.user.getIsDarkMode(), [editor])

  // Un punto (px, py) de la hoja se ve en pantalla en ((px + x)·z, (py + y)·z).
  // El origen de la hoja cae en (x·z, y·z): de ahí arranca el patrón (+0,5 para líneas nítidas de 1 px).
  const lado = CUADRO * camara.z
  const ladoMayor = lado * MAYOR
  const origenX = camara.x * camara.z + 0.5
  const origenY = camara.y * camara.z + 0.5

  const fondo = oscuro ? 'hsl(240, 5%, 6.5%)' : '#ffffff'
  const fina = oscuro ? 'rgba(167, 139, 250, 0.07)' : 'rgba(99, 102, 241, 0.10)'
  const marcada = oscuro ? 'rgba(167, 139, 250, 0.14)' : 'rgba(99, 102, 241, 0.20)'

  return (
    <svg className="tl-background" style={{ backgroundColor: fondo }} aria-hidden="true">
      <defs>
        <pattern id="cuaderno-fino" width={lado} height={lado} x={origenX} y={origenY} patternUnits="userSpaceOnUse">
          <path d={`M ${lado} 0 L 0 0 0 ${lado}`} fill="none" stroke={fina} strokeWidth={1} />
        </pattern>
        <pattern id="cuaderno-mayor" width={ladoMayor} height={ladoMayor} x={origenX} y={origenY} patternUnits="userSpaceOnUse">
          <path d={`M ${ladoMayor} 0 L 0 0 0 ${ladoMayor}`} fill="none" stroke={marcada} strokeWidth={1} />
        </pattern>
      </defs>
      {lado >= MINIMO_VISIBLE && <rect width="100%" height="100%" fill="url(#cuaderno-fino)" />}
      {ladoMayor >= MINIMO_VISIBLE && <rect width="100%" height="100%" fill="url(#cuaderno-mayor)" />}
    </svg>
  )
}
