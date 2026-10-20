import type { TLAssetStore } from 'tldraw'

// Sin R2: cada imagen pegada se achica y se guarda adentro de la sala como data URL webp.
const LADO_MAXIMO = 900
const CALIDAD_WEBP = 0.65
const BYTES_MAXIMOS = 500 * 1024

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(blob)
  })
}

async function comprimirImagen(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imagen.width * escala)
  canvas.height = Math.round(imagen.height * escala)
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('No se pudo preparar la imagen')
  contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height)
  imagen.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', CALIDAD_WEBP))
  if (!blob) throw new Error('No se pudo comprimir la imagen')
  return blob
}

export const assetsEnLinea: TLAssetStore = {
  async upload(_asset, archivo) {
    if (!archivo.type.startsWith('image/')) throw new Error('Solo se pueden pegar imágenes')
    const comprimida = await comprimirImagen(archivo)
    if (comprimida.size > BYTES_MAXIMOS) throw new Error('La imagen es demasiado grande')
    return { src: await blobADataUrl(comprimida) }
  },
  resolve(asset) {
    return asset.props.src
  },
}
