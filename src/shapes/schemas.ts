// Contrato de datos de los laboratorios. Sin React ni DOM: lo importan los ShapeUtil y el Worker.

import { T } from '@tldraw/validate'
import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type RecordProps,
  type TLShape,
} from '@tldraw/tlschema'
import type { Metodo } from '../lib/plot'
import type { Orden } from '../lib/surface3d'
import type { SistemaCoordenadas } from '../lib/coordenadas'
import { anchoRegla, ALTO_REGLA, PX_POR_CM, medidasEscuadra, medidasTransportador, type AngulosEscuadra } from '../lib/geometria'

// ── binomio-cuadrado ──
export type BinomioProps = {
  w: number
  h: number
  a: number
  b: number
}

export const binomioProps: RecordProps<TLShape<'binomio-cuadrado'>> = {
  w: T.number,
  h: T.number,
  a: T.number,
  b: T.number,
}

export const binomioDefaults: BinomioProps = {
  w: 380,
  h: 440,
  a: 6,
  b: 4,
}

// ── matriz-2x2 ──
export type MatrizProps = {
  w: number
  h: number
  a: number
  b: number
  c: number
  d: number
  showGrid: boolean
  showDet: boolean
}

export const matrizProps: RecordProps<TLShape<'matriz-2x2'>> = {
  w: T.number,
  h: T.number,
  a: T.number,
  b: T.number,
  c: T.number,
  d: T.number,
  showGrid: T.boolean,
  showDet: T.boolean,
}

export const matrizDefaults: MatrizProps = { w: 520, h: 600, a: 1, b: 1, c: 0, d: 1, showGrid: true, showDet: true }

// ── limite-funcion ──
export type PresetLimite = 'continua' | 'agujero' | 'salto' | 'asintota'
export type ModoLimite = 'laterales' | 'epsilon-delta'

export type LimiteProps = {
  w: number
  h: number
  preset: PresetLimite
  modo: ModoLimite
  dist: number
  epsilon: number
  delta: number
}

export const limiteProps: RecordProps<TLShape<'limite-funcion'>> = {
  w: T.number,
  h: T.number,
  preset: T.literalEnum('continua', 'agujero', 'salto', 'asintota'),
  modo: T.literalEnum('laterales', 'epsilon-delta'),
  dist: T.number,
  epsilon: T.number,
  delta: T.number,
}

export const limiteDefaults: LimiteProps = { w: 560, h: 640, preset: 'continua', modo: 'laterales', dist: 1, epsilon: 0.5, delta: 0.5 }

// ── integral-simple ──
export type PresetIntegralSimple = 'parabola' | 'seno' | 'exponencial'
export type ModoIntegralSimple = 'definida' | 'indefinida'

export type IntegralSimpleProps = {
  w: number
  h: number
  preset: PresetIntegralSimple
  modo: ModoIntegralSimple
  metodo: Metodo
  a: number
  b: number
  n: number
  c: number
  x0: number
}

export const integralSimpleProps: RecordProps<TLShape<'integral-simple'>> = {
  w: T.number,
  h: T.number,
  preset: T.literalEnum('parabola', 'seno', 'exponencial'),
  modo: T.literalEnum('definida', 'indefinida'),
  metodo: T.literalEnum('izquierda', 'derecha', 'medio', 'trapecio'),
  a: T.number,
  b: T.number,
  n: T.number,
  c: T.number,
  x0: T.number,
}

export const integralSimpleDefaults: IntegralSimpleProps = {
  w: 580,
  h: 680,
  preset: 'parabola',
  modo: 'definida',
  metodo: 'medio',
  a: -1,
  b: 3,
  n: 8,
  c: 0,
  x0: 1,
}

// ── coordenadas-polares ──
export type PresetPolares = 'cardioide' | 'rosa' | 'circulo' | 'espiral'
export type ModoPolares = 'trazado' | 'area'

export type PolaresProps = {
  w: number
  h: number
  preset: PresetPolares
  modo: ModoPolares
  theta: number
  alfa: number
  beta: number
  n: number
}

export const polaresProps: RecordProps<TLShape<'coordenadas-polares'>> = {
  w: T.number,
  h: T.number,
  preset: T.literalEnum('cardioide', 'rosa', 'circulo', 'espiral'),
  modo: T.literalEnum('trazado', 'area'),
  theta: T.number,
  alfa: T.number,
  beta: T.number,
  n: T.number,
}

export const polaresDefaults: PolaresProps = {
  w: 580,
  h: 700,
  preset: 'cardioide',
  modo: 'trazado',
  theta: Math.PI,
  alfa: 0,
  beta: 2 * Math.PI,
  n: 12,
}

// ── derivada-estudio ──
export type PresetDerivada = 'cubica' | 'cuadratica' | 'trig'
export type ModoDerivada = 'secante' | 'estudio'

export type DerivadaProps = {
  w: number
  h: number
  preset: PresetDerivada
  modo: ModoDerivada
  x0: number
  dx: number
  verDerivada: boolean
  verSegunda: boolean
  verNotables: boolean
}

export const derivadaProps: RecordProps<TLShape<'derivada-estudio'>> = {
  w: T.number,
  h: T.number,
  preset: T.literalEnum('cubica', 'cuadratica', 'trig'),
  modo: T.literalEnum('secante', 'estudio'),
  x0: T.number,
  dx: T.number,
  verDerivada: T.boolean,
  verSegunda: T.boolean,
  verNotables: T.boolean,
}

export const derivadaDefaults: DerivadaProps = {
  w: 580,
  h: 700,
  preset: 'cubica',
  modo: 'secante',
  x0: 0.5,
  dx: 1,
  verDerivada: true,
  verSegunda: true,
  verNotables: true,
}

// ── trigonometria-circulo ──
export type ModoTrigonometria = 'circulo' | 'onda'

export type TrigonometriaProps = {
  w: number
  h: number
  modo: ModoTrigonometria
  theta: number
  verTan: boolean
  verCos: boolean
  amp: number
  freq: number
  fase: number
}

export const trigonometriaProps: RecordProps<TLShape<'trigonometria-circulo'>> = {
  w: T.number,
  h: T.number,
  modo: T.literalEnum('circulo', 'onda'),
  theta: T.number,
  verTan: T.boolean,
  verCos: T.boolean,
  amp: T.number,
  freq: T.number,
  fase: T.number,
}

export const trigonometriaDefaults: TrigonometriaProps = {
  w: 780,
  h: 640,
  modo: 'circulo',
  theta: Math.PI / 6,
  verTan: true,
  verCos: false,
  amp: 1,
  freq: 1,
  fase: 0,
}

// ── conicas ──
export type TipoConica = 'circunferencia' | 'elipse' | 'parabola' | 'hiperbola'
export type OrientacionConica = 'horizontal' | 'vertical'

export type ConicasProps = {
  w: number
  h: number
  tipo: TipoConica
  orientacion: OrientacionConica
  cx: number
  cy: number
  a: number
  b: number
  p: number
  t: number
}

export const conicasProps: RecordProps<TLShape<'conicas'>> = {
  w: T.number,
  h: T.number,
  tipo: T.literalEnum('circunferencia', 'elipse', 'parabola', 'hiperbola'),
  orientacion: T.literalEnum('horizontal', 'vertical'),
  cx: T.number,
  cy: T.number,
  a: T.number,
  b: T.number,
  p: T.number,
  t: T.number,
}

export const conicasDefaults: ConicasProps = {
  w: 640,
  h: 780,
  tipo: 'elipse',
  orientacion: 'horizontal',
  cx: 0,
  cy: 0,
  a: 3,
  b: 2,
  p: 1,
  t: Math.PI / 4,
}

// ── graficador-libre ──
export type GraficadorLibreProps = {
  w: number
  h: number
  exprF: string
  exprG: string
  verG: boolean
  verNotables: boolean
  ox: number
  oy: number
  escala: number
}

export const graficadorLibreProps: RecordProps<TLShape<'graficador-libre'>> = {
  w: T.number,
  h: T.number,
  exprF: T.string,
  exprG: T.string,
  verG: T.boolean,
  verNotables: T.boolean,
  ox: T.number,
  oy: T.number,
  escala: T.number,
}

export const graficadorLibreDefaults: GraficadorLibreProps = {
  w: 640,
  h: 760,
  exprF: 'x^3 - 3x + 1',
  exprG: 'x - 1',
  verG: false,
  verNotables: true,
  ox: 0,
  oy: 0,
  escala: 4,
}

// ── graficador-3d ──
export type EscalaGraficador3D = 'ajustada' | 'real'
/** Variable que se calcula: z = f(x, y), x = f(y, z) o y = f(x, z). exprZ, zAuto, zMin y zMax se refieren a ella. */
export type DespejadaGraficador3D = 'z' | 'x' | 'y'

export type Graficador3DProps = {
  w: number
  h: number
  despejada: DespejadaGraficador3D
  exprZ: string
  rango: number
  zAuto: boolean
  zMin: number
  zMax: number
  escala: EscalaGraficador3D
  acimut: number
  elevacion: number
  zoom: number
  verNivel: boolean
  nivelEnAltura: boolean
  verSuperficie: boolean
  verCorte: boolean
  corte: number
  girando: boolean
}

export const graficador3DProps: RecordProps<TLShape<'graficador-3d'>> = {
  w: T.number,
  h: T.number,
  despejada: T.literalEnum('z', 'x', 'y'),
  exprZ: T.string,
  rango: T.number,
  zAuto: T.boolean,
  zMin: T.number,
  zMax: T.number,
  escala: T.literalEnum('ajustada', 'real'),
  acimut: T.number,
  elevacion: T.number,
  zoom: T.number,
  verNivel: T.boolean,
  nivelEnAltura: T.boolean,
  verSuperficie: T.boolean,
  verCorte: T.boolean,
  corte: T.number,
  girando: T.boolean,
}

export const graficador3DDefaults: Graficador3DProps = {
  w: 640,
  h: 840,
  despejada: 'z',
  exprZ: 'sen(x)*cos(y)',
  rango: 3,
  zAuto: true,
  zMin: -2,
  zMax: 2,
  escala: 'ajustada',
  acimut: -2.2,
  elevacion: 0.55,
  zoom: 1,
  verNivel: true,
  nivelEnAltura: false,
  verSuperficie: true,
  verCorte: false,
  corte: 0.5,
  girando: false,
}

const GRAFICADOR_3D_V1 = ['despejada', 'nivelEnAltura', 'verSuperficie', 'verCorte', 'corte']
const graficador3DVersiones = createShapePropsMigrationIds('graficador-3d', { DespejadaYCortes: 1 })

export const graficador3DMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: graficador3DVersiones.DespejadaYCortes,
      up: (props) => ({
        ...props,
        despejada: 'z',
        nivelEnAltura: false,
        verSuperficie: true,
        verCorte: false,
        corte: 0.5,
      }),
      down: (props) => Object.fromEntries(Object.entries(props).filter(([clave]) => !GRAFICADOR_3D_V1.includes(clave))),
    },
  ],
})

// ── superficie-3d ──
export type PresetSuperficie = 'paraboloide' | 'silla' | 'ondas' | 'gaussiana'
export type ModoSuperficie = 'parciales' | 'gradiente'

export type SuperficieDerivadas3DProps = {
  w: number
  h: number
  preset: PresetSuperficie
  modo: ModoSuperficie
  x0: number
  y0: number
  acimut: number
  elevacion: number
  zoom: number
  verNivel: boolean
  girando: boolean
}

export const superficieDerivadas3DProps: RecordProps<TLShape<'superficie-3d'>> = {
  w: T.number,
  h: T.number,
  preset: T.literalEnum('paraboloide', 'silla', 'ondas', 'gaussiana'),
  modo: T.literalEnum('parciales', 'gradiente'),
  x0: T.number,
  y0: T.number,
  acimut: T.number,
  elevacion: T.number,
  zoom: T.number,
  verNivel: T.boolean,
  girando: T.boolean,
}

export const superficieDerivadas3DDefaults: SuperficieDerivadas3DProps = {
  w: 640,
  h: 820,
  preset: 'paraboloide',
  modo: 'parciales',
  x0: 1,
  y0: 0.5,
  acimut: -2.2,
  elevacion: 0.55,
  zoom: 1,
  verNivel: true,
  girando: false,
}

const superficieDerivadas3DVersiones = createShapePropsMigrationIds('superficie-3d', { AgregarGirando: 1 })

export const superficieDerivadas3DMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: superficieDerivadas3DVersiones.AgregarGirando,
      up: (props) => ({ ...props, girando: false }),
      down: ({ girando: _girando, ...props }) => props,
    },
  ],
})

// ── integral-doble-3d ──
export type ModoIntegralDoble = 'riemann' | 'fubini'
export type PresetIntegralDoble = 'paraboloide' | 'plano' | 'silla'
export type RegionIntegralDoble = 'triangulo' | 'parabola' | 'circulo'

export type IntegralDoble3DProps = {
  w: number
  h: number
  modo: ModoIntegralDoble
  preset: PresetIntegralDoble
  nx: number
  ny: number
  verSuperficie: boolean
  region: RegionIntegralDoble
  orden: Orden
  t: number
  acimut: number
  elevacion: number
  zoom: number
  girando: boolean
}

export const integralDoble3DProps: RecordProps<TLShape<'integral-doble-3d'>> = {
  w: T.number,
  h: T.number,
  modo: T.literalEnum('riemann', 'fubini'),
  preset: T.literalEnum('paraboloide', 'plano', 'silla'),
  nx: T.number,
  ny: T.number,
  verSuperficie: T.boolean,
  region: T.literalEnum('triangulo', 'parabola', 'circulo'),
  orden: T.literalEnum('dydx', 'dxdy'),
  t: T.number,
  acimut: T.number,
  elevacion: T.number,
  zoom: T.number,
  girando: T.boolean,
}

export const integralDoble3DDefaults: IntegralDoble3DProps = {
  w: 640,
  h: 820,
  modo: 'riemann',
  preset: 'paraboloide',
  nx: 4,
  ny: 4,
  verSuperficie: true,
  region: 'parabola',
  orden: 'dydx',
  t: 0.5,
  acimut: -2.2,
  elevacion: 0.55,
  zoom: 1,
  girando: false,
}

const integralDoble3DVersiones = createShapePropsMigrationIds('integral-doble-3d', { AgregarGirando: 1 })

export const integralDoble3DMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: integralDoble3DVersiones.AgregarGirando,
      up: (props) => ({ ...props, girando: false }),
      down: ({ girando: _girando, ...props }) => props,
    },
  ],
})

// ── cambio-variables-3d ──
export type ModoCambioVariables = 'jacobiano' | 'superficies'

export type CambioVariables3DProps = {
  w: number
  h: number
  sistema: SistemaCoordenadas
  modo: ModoCambioVariables
  r: number
  rho: number
  theta: number
  phi: number
  z0: number
  delta: number
  verLineal: boolean
  acimut: number
  elevacion: number
  zoom: number
  girando: boolean
}

export const cambioVariables3DProps: RecordProps<TLShape<'cambio-variables-3d'>> = {
  w: T.number,
  h: T.number,
  sistema: T.literalEnum('polares', 'cilindricas', 'esfericas'),
  modo: T.literalEnum('jacobiano', 'superficies'),
  r: T.number,
  rho: T.number,
  theta: T.number,
  phi: T.number,
  z0: T.number,
  delta: T.number,
  verLineal: T.boolean,
  acimut: T.number,
  elevacion: T.number,
  zoom: T.number,
  girando: T.boolean,
}

export const cambioVariables3DDefaults: CambioVariables3DProps = {
  w: 640,
  h: 870,
  sistema: 'esfericas',
  modo: 'jacobiano',
  r: 1.5,
  rho: 2,
  theta: Math.PI / 4,
  phi: Math.PI / 3,
  z0: 0,
  delta: 0.5,
  verLineal: true,
  acimut: -2.2,
  elevacion: 0.45,
  zoom: 1,
  girando: false,
}

// ── regla ──
export type ReglaProps = {
  w: number
  h: number
  longitud: number
}

export const reglaProps: RecordProps<TLShape<'regla'>> = {
  w: T.number,
  h: T.number,
  longitud: T.number,
}

export const reglaDefaults: ReglaProps = { w: anchoRegla(20), h: ALTO_REGLA, longitud: 20 }

// ── transportador ──
export type TransportadorProps = {
  w: number
  h: number
  completo: boolean
}

export const transportadorProps: RecordProps<TLShape<'transportador'>> = {
  w: T.number,
  h: T.number,
  completo: T.boolean,
}

const transportadorInicial = medidasTransportador(false)

export const transportadorDefaults: TransportadorProps = {
  w: transportadorInicial.w,
  h: transportadorInicial.h,
  completo: false,
}

// ── escuadra ──
export type EscuadraProps = {
  w: number
  h: number
  angulos: AngulosEscuadra
}

export const escuadraProps: RecordProps<TLShape<'escuadra'>> = {
  w: T.number,
  h: T.number,
  angulos: T.literalEnum('45', '30-60'),
}

export const escuadraDefaults: EscuadraProps = { ...medidasEscuadra('45'), angulos: '45' }

// ── compás ──
/** enMano: sigue al puntero · abriendo: aguja clavada, se abre · abierto: quieto · girando: traza el arco */
export type FaseCompas = 'enMano' | 'abriendo' | 'abierto' | 'girando'

/** x, y del shape = la aguja. El giro va en `angulo` (rotation queda en 0). Ángulos en la hoja (y hacia abajo). */
export type CompasProps = {
  /** Abertura en unidades de la hoja, redondeada al mm */
  r: number
  /** Dirección aguja → lápiz */
  angulo: number
  fase: FaseCompas
  /** Dónde empezó el arco en curso */
  inicio: number
  /** Cuánto giró el arco en curso, con signo y acumulado (0 si no hay arco) */
  barrido: number
}

export const compasProps: RecordProps<TLShape<'compas'>> = {
  r: T.number,
  angulo: T.number,
  fase: T.literalEnum('enMano', 'abriendo', 'abierto', 'girando'),
  inicio: T.number,
  barrido: T.number,
}

/** Primera abertura: 3 cm */
export const compasDefaults: CompasProps = { r: 3 * PX_POR_CM, angulo: 0, fase: 'enMano', inicio: 0, barrido: 0 }

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'binomio-cuadrado': BinomioProps
    'matriz-2x2': MatrizProps
    'limite-funcion': LimiteProps
    'integral-simple': IntegralSimpleProps
    'coordenadas-polares': PolaresProps
    'derivada-estudio': DerivadaProps
    'trigonometria-circulo': TrigonometriaProps
    conicas: ConicasProps
    'graficador-libre': GraficadorLibreProps
    'graficador-3d': Graficador3DProps
    'superficie-3d': SuperficieDerivadas3DProps
    'integral-doble-3d': IntegralDoble3DProps
    'cambio-variables-3d': CambioVariables3DProps
    regla: ReglaProps
    transportador: TransportadorProps
    escuadra: EscuadraProps
    compas: CompasProps
  }
}

export const LAB_SCHEMAS = {
  'binomio-cuadrado': { props: binomioProps },
  'matriz-2x2': { props: matrizProps },
  'limite-funcion': { props: limiteProps },
  'integral-simple': { props: integralSimpleProps },
  'coordenadas-polares': { props: polaresProps },
  'derivada-estudio': { props: derivadaProps },
  'trigonometria-circulo': { props: trigonometriaProps },
  conicas: { props: conicasProps },
  'graficador-libre': { props: graficadorLibreProps },
  'graficador-3d': { props: graficador3DProps, migrations: graficador3DMigrations },
  'superficie-3d': { props: superficieDerivadas3DProps, migrations: superficieDerivadas3DMigrations },
  'integral-doble-3d': { props: integralDoble3DProps, migrations: integralDoble3DMigrations },
  'cambio-variables-3d': { props: cambioVariables3DProps },
  regla: { props: reglaProps },
  transportador: { props: transportadorProps },
  escuadra: { props: escuadraProps },
  compas: { props: compasProps },
} as const
