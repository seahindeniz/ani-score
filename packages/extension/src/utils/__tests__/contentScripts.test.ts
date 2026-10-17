import { describe, expect, it } from 'bun:test'
import { contentScriptPaths, getContentScriptScope } from '../contentScripts'

function entry(path: string) {
  return { path, name: path.split('/').pop()!, dirent: {} } as Parameters<typeof getContentScriptScope>[0]
}

describe('getContentScriptScope', () => {
  it('maps a site entry to its build directory', () => {
    expect(getContentScriptScope(entry('/repo/packages/extension/src/contentScripts/site/anizm/main.ts'))).toEqual({
      path: '/repo/packages/extension/src/contentScripts/site/anizm/main.ts',
      directory: 'site/anizm',
      relativePath: 'src/contentScripts/site/anizm/main.ts',
      relativeDir: 'src/contentScripts/site/anizm/',
      name: 'main.js',
    })
  })

  it('gives top-level scripts their own directory under root/', () => {
    expect(getContentScriptScope(entry('/repo/src/contentScripts/messageGateway.ts'))).toMatchObject({
      directory: 'root/messageGateway',
      name: 'main.js',
    })
  })

  it('strips .tsx extensions too', () => {
    expect(getContentScriptScope(entry('/repo/src/contentScripts/engagement/main.tsx'))).toMatchObject({
      directory: 'engagement',
      name: 'main.js',
    })
  })
})

describe('contentScriptPaths', () => {
  it('lists the message gateway first, then the engagement and site scripts, without the widget', () => {
    const directories = contentScriptPaths.map(script => script.directory)

    expect(directories[0]).toBe('root/messageGateway')
    expect(directories).toContain('engagement')
    expect(directories).toContain('site/anizm')
    expect(directories).toContain('site/tranimeizle')
    expect(directories).not.toContain('widget')
  })
})
