// Contrato compartido entre el Worker y la web (sin React ni window).

// Motivo con el que el servidor cierra el WebSocket de una sala que no creó la profe o que clausuró
// (código 4099 de tldraw sync: el cliente no reintenta).
export const MOTIVO_SALA_CERRADA = 'SALA_NO_DISPONIBLE'

// Una fila del índice de salas. Fechas en milisegundos (Date.now()); 0 = sin datos.
export type InfoSala = {
  nombre: string
  creada: number
  ultimoUso: number
  clausurada: boolean
}

// Una entrada a la sala. salida null = sigue adentro (o la conexión se cortó sin avisar).
export type Visita = { nombre: string; entrada: number; salida: number | null }

export type Actividad = { enLinea: string[]; visitas: Visita[] }
