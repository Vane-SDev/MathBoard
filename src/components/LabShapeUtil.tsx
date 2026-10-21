'use client'

import type { ReactNode } from 'react'
import { BaseBoxShapeUtil, type TLBaseBoxShape } from 'tldraw'

/**
 * Base de los laboratorios: al cambiar el tamaño de la caja, el lab se agranda o achica entero
 * (como un zoom), en vez de reacomodar su contenido. Así nada se desborda al achicarlo.
 * El contenido se arma siempre al tamaño por defecto (getDefaultProps) y se escala con CSS.
 */
export abstract class LabShapeUtil<Shape extends TLBaseBoxShape> extends BaseBoxShapeUtil<Shape> {
  /** Lo que antes devolvía component(): el lab a su tamaño por defecto */
  abstract contenido(shape: Shape): ReactNode

  // Manijas proporcionales: ancho y alto cambian juntos, así la escala es la misma en x y en y.
  override isAspectRatioLocked() {
    return true
  }

  override component(shape: Shape) {
    const base = this.getDefaultProps()
    // min por si una caja ya quedó deformada antes de este cambio: entra entera sin desbordarse
    const escala = Math.min(shape.props.w / base.w, shape.props.h / base.h)
    return (
      <div
        style={{
          position: 'relative',
          width: base.w,
          height: base.h,
          transform: `scale(${escala})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {this.contenido(shape)}
      </div>
    )
  }
}
