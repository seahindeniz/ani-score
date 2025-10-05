import svgDataUrl from '../assets/logo-animated.svg?raw'

type ExtractCallableMethods<Target> = {
  [Key in keyof Target]: Target[Key] extends () => void ? Key : never
}[keyof Target]

const mainStyle = `
background-image: url(data:image/svg+xml;base64,${globalThis.btoa(svgDataUrl)});
padding: 1ch 0 1ch 4ch;
background-size: contain;
background-position: center center;
background-repeat: no-repeat;
`
const scopeStyle = `
font-size: 1.3em;
padding: 3.5px 1ch;
display: block;
border: 1px solid gray;
border-radius: 4px;
`

const methods = ['log', 'info', 'warn', 'error'] as const satisfies ExtractCallableMethods<Console>[]

function methodFacilitator<Method extends typeof methods[number]>(method: Method, scope?: string) {
  // if (!__DEV__) {
  //   return () => {}
  // }

  return Function.prototype.bind.call(
    // eslint-disable-next-line no-console
    console[method],
    console,
    `%c ${scope ? `%c${scope}` : ''}`,
    mainStyle,
    ...scope ? [scopeStyle] : [],
  ) as Console[Method]
}

export function createLogger(scope: string) {
  return methods.reduce((acc, method) => {
    acc[method] = methodFacilitator(method, scope)

    return acc
  }, {} as Pick<Console, typeof methods[number]>)
}

export const logger = createLogger('')
