// Parser de expresiones en x, y, z, sin eval: tokenizer + descenso recursivo → closures

type Fn1 = (x: number) => number
type Fn = (x: number, y: number, z: number) => number
export type Variable = 'x' | 'y' | 'z'

const FUNCIONES = {
  sen: Math.sin,
  sin: Math.sin,
  cos: Math.cos,
  tg: Math.tan,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  raiz: Math.sqrt,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
} as const satisfies Record<string, Fn1>

type NombreFn = keyof typeof FUNCIONES
type Constante = 'pi' | 'π' | 'e'
type Op = '+' | '-' | '*' | '/' | '^' | '(' | ')' | '|'

type Token =
  | { tipo: 'num'; valor: number; pos: number }
  | { tipo: 'var'; nombre: Variable; pos: number }
  | { tipo: 'const'; nombre: Constante; pos: number }
  | { tipo: 'fn'; nombre: NombreFn; pos: number }
  | { tipo: 'op'; op: Op; pos: number }
  | { tipo: 'fin'; pos: number }

type Nodo =
  | { k: 'num'; v: number }
  | { k: 'var'; nombre: Variable }
  | { k: 'neg'; a: Nodo }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Nodo; b: Nodo }
  | { k: 'fn'; nombre: NombreFn; a: Nodo }

export type Parseo = { ok: true; f: (x: number) => number } | { ok: false; error: string; pos: number }
export type Parseo2 = { ok: true; f: (x: number, y: number) => number } | { ok: false; error: string; pos: number }

class ErrorParseo extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message)
  }
}

const OPS = '+-*/^()|'
const esFn = (w: string): w is NombreFn => Object.prototype.hasOwnProperty.call(FUNCIONES, w)
const esConst = (w: string): w is Constante => w === 'pi' || w === 'π' || w === 'e'

function tokenizar(texto: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < texto.length) {
    const ch = texto[i]
    if (/\s/.test(ch)) {
      i++
    } else if (/[0-9.,]/.test(ch)) {
      const ini = i
      while (i < texto.length && /[0-9.,]/.test(texto[i])) i++
      const crudo = texto.slice(ini, i).replace(',', '.')
      const valor = Number(crudo)
      if (!/^(\d+\.?\d*|\.\d+)$/.test(crudo) || !Number.isFinite(valor)) {
        throw new ErrorParseo(`No reconozco '${texto.slice(ini, i)}'`, ini)
      }
      tokens.push({ tipo: 'num', valor, pos: ini })
    } else if (/[a-zA-ZáéíóúñÑπ]/.test(ch)) {
      const ini = i
      while (i < texto.length && /[a-zA-ZáéíóúñÑπ]/.test(texto[i])) i++
      const w = texto.slice(ini, i).toLowerCase()
      if (esConst(w)) tokens.push({ tipo: 'const', nombre: w, pos: ini })
      else if (esFn(w)) tokens.push({ tipo: 'fn', nombre: w, pos: ini })
      // 'xy' o 'yzz': una variable por letra; la multiplicación implícita las junta
      else if (/^[xyz]+$/.test(w)) {
        for (let k = 0; k < w.length; k++) tokens.push({ tipo: 'var', nombre: w[k] as Variable, pos: ini + k })
      }
      else throw new ErrorParseo(`No reconozco '${texto.slice(ini, i)}'`, ini)
    } else if (OPS.includes(ch)) {
      tokens.push({ tipo: 'op', op: ch as Op, pos: i })
      i++
    } else {
      throw new ErrorParseo(`No reconozco '${ch}'`, i)
    }
  }
  tokens.push({ tipo: 'fin', pos: texto.length })
  return tokens
}

function analizar(tokens: Token[]): Nodo {
  let i = 0
  const actual = () => tokens[i]
  const esOp = (op: Op) => {
    const t = actual()
    return t.tipo === 'op' && t.op === op
  }
  const empiezaPrimary = () => {
    const t = actual()
    return t.tipo === 'num' || t.tipo === 'var' || t.tipo === 'const' || t.tipo === 'fn' || (t.tipo === 'op' && t.op === '(')
  }
  const cerrar = (op: ')' | '|') => {
    if (!esOp(op)) {
      throw new ErrorParseo(op === ')' ? 'Falta cerrar un paréntesis' : "Falta cerrar el valor absoluto '|'", actual().pos)
    }
    i++
  }

  const expr = (): Nodo => {
    let a = term()
    while (esOp('+') || esOp('-')) {
      const op = esOp('+') ? '+' : '-'
      i++
      a = { k: 'bin', op, a, b: term() }
    }
    return a
  }

  const term = (): Nodo => {
    let a = unary()
    for (;;) {
      if (esOp('*') || esOp('/')) {
        const op = esOp('*') ? '*' : '/'
        i++
        a = { k: 'bin', op, a, b: unary() }
      } else if (empiezaPrimary()) {
        a = { k: 'bin', op: '*', a, b: unary() }
      } else {
        return a
      }
    }
  }

  const unary = (): Nodo => {
    if (esOp('-')) {
      i++
      return { k: 'neg', a: unary() }
    }
    if (esOp('+')) {
      i++
      return unary()
    }
    return power()
  }

  const power = (): Nodo => {
    const base = primary()
    if (esOp('^')) {
      i++
      return { k: 'bin', op: '^', a: base, b: unary() }
    }
    return base
  }

  const primary = (): Nodo => {
    const t = actual()
    if (t.tipo === 'num') {
      i++
      return { k: 'num', v: t.valor }
    }
    if (t.tipo === 'var') {
      i++
      return { k: 'var', nombre: t.nombre }
    }
    if (t.tipo === 'const') {
      i++
      return { k: 'num', v: t.nombre === 'e' ? Math.E : Math.PI }
    }
    if (t.tipo === 'fn') {
      i++
      if (!esOp('(')) throw new ErrorParseo(`Esperaba '(' después de ${t.nombre}`, actual().pos)
      i++
      const a = expr()
      cerrar(')')
      return { k: 'fn', nombre: t.nombre, a }
    }
    if (esOp('(')) {
      i++
      const a = expr()
      cerrar(')')
      return a
    }
    if (esOp('|')) {
      i++
      const a = expr()
      cerrar('|')
      return { k: 'fn', nombre: 'abs', a }
    }
    throw new ErrorParseo("Esperaba un número, una variable o '('", t.pos)
  }

  const raiz = expr()
  const resto = actual()
  if (resto.tipo !== 'fin') {
    const msg = resto.tipo === 'op' && resto.op === ')' ? "Sobra un ')'" : "Esperaba un operador (+ − * / ^)"
    throw new ErrorParseo(msg, resto.pos)
  }
  return raiz
}

function compilar(n: Nodo): Fn {
  switch (n.k) {
    case 'num': {
      const v = n.v
      return () => v
    }
    case 'var':
      return n.nombre === 'x' ? (x) => x : n.nombre === 'y' ? (_x, y) => y : (_x, _y, z) => z
    case 'neg': {
      const a = compilar(n.a)
      return (x, y, z) => -a(x, y, z)
    }
    case 'fn': {
      const g: Fn1 = FUNCIONES[n.nombre]
      const a = compilar(n.a)
      return (x, y, z) => g(a(x, y, z))
    }
    case 'bin': {
      const a = compilar(n.a)
      const b = compilar(n.b)
      switch (n.op) {
        case '+':
          return (x, y, z) => a(x, y, z) + b(x, y, z)
        case '-':
          return (x, y, z) => a(x, y, z) - b(x, y, z)
        case '*':
          return (x, y, z) => a(x, y, z) * b(x, y, z)
        case '/':
          return (x, y, z) => a(x, y, z) / b(x, y, z)
        case '^':
          return (x, y, z) => Math.pow(a(x, y, z), b(x, y, z))
      }
    }
  }
}

export function parsear(texto: string): Parseo {
  if (texto.trim() === '') return { ok: false, error: 'Expresión vacía', pos: 0 }
  try {
    const tokens = tokenizar(texto)
    const otra = tokens.find((t) => t.tipo === 'var' && t.nombre !== 'x')
    if (otra) return { ok: false, error: 'Esta función solo usa x', pos: otra.pos }
    const g = compilar(analizar(tokens))
    return { ok: true, f: (x) => g(x, 0, 0) }
  } catch (e) {
    if (e instanceof ErrorParseo) return { ok: false, error: e.message, pos: e.pos }
    throw e
  }
}

/**
 * Función de dos variables para superficies: vars dice cuáles se permiten y en qué orden,
 * ['x', 'y'] para z = f(x, y), ['y', 'z'] para x = f(y, z). Devuelve f(u, v) con u = vars[0], v = vars[1].
 */
export function parsear2(texto: string, vars: readonly [Variable, Variable] = ['x', 'y']): Parseo2 {
  if (texto.trim() === '') return { ok: false, error: 'Expresión vacía', pos: 0 }
  try {
    const tokens = tokenizar(texto)
    const otra = tokens.find((t) => t.tipo === 'var' && !vars.includes(t.nombre))
    if (otra) return { ok: false, error: `Usá solo las variables ${vars[0]}, ${vars[1]}`, pos: otra.pos }
    const g = compilar(analizar(tokens))
    // Posición de x, y, z dentro de [u, v, 0]: la variable que no se usa vale 0
    const lugar = (w: Variable) => (w === vars[0] ? 0 : w === vars[1] ? 1 : 2)
    const ix = lugar('x')
    const iy = lugar('y')
    const iz = lugar('z')
    return {
      ok: true,
      f: (u, v) => {
        const t = [u, v, 0]
        return g(t[ix], t[iy], t[iz])
      },
    }
  } catch (e) {
    if (e instanceof ErrorParseo) return { ok: false, error: e.message, pos: e.pos }
    throw e
  }
}
