// Copia el worker de pdf.js (y sus datos) a public/pdfjs para que el export estático los sirva tal cual.
// Sale de node_modules en cada install/build: el worker siempre tiene la misma versión que la librería.
import { cpSync, mkdirSync, rmSync } from 'node:fs'

const origen = 'node_modules/pdfjs-dist'
const destino = 'public/pdfjs'

rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })
// Build "legacy": la moderna usa métodos de JS de 2026 que Safari y Chrome de hace un año no tienen.
cpSync(`${origen}/legacy/build/pdf.worker.min.mjs`, `${destino}/pdf.worker.min.mjs`)
// Fuentes estándar (PDF sin fuentes incrustadas), cmaps (texto CJK) y wasm (imágenes JPEG 2000).
for (const carpeta of ['standard_fonts', 'cmaps', 'wasm']) {
  cpSync(`${origen}/${carpeta}`, `${destino}/${carpeta}`, { recursive: true })
}
console.log('pdf.js copiado a public/pdfjs')
