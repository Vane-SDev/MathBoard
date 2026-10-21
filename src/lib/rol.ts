const CLAVE_PROFE = 'mathboard-es-profe'

// ?rol=profe deja este navegador marcado como profe; ?rol=alumno lo desmarca (para probar como alumna).
// Es solo comodidad de interfaz: no protege nada en el servidor.
export function detectarProfe(): boolean {
  const rol = new URLSearchParams(window.location.search).get('rol')
  try {
    if (rol === 'profe') localStorage.setItem(CLAVE_PROFE, 'true')
    if (rol === 'alumno') localStorage.removeItem(CLAVE_PROFE)
    return rol === 'profe' || (rol !== 'alumno' && localStorage.getItem(CLAVE_PROFE) === 'true')
  } catch {
    return rol === 'profe'
  }
}
