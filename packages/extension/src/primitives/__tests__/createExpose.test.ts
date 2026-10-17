import { describe, expect, it, mock } from 'bun:test'
import { createRoot } from 'solid-js'
import { createExpose } from '../createExpose'

function expose(props: unknown) {
  return createRoot((dispose) => {
    try {
      createExpose(props as { ref?: unknown }, () => ({ open: () => {} }))
    }
    finally {
      dispose()
    }
  })
}

describe('createExpose', () => {
  it('passes the exposed API to a ref callback', () => {
    const ref = mock()

    expose({ ref })

    expect(ref).toHaveBeenCalledWith({ open: expect.any(Function) })
  })

  it('does nothing without a ref', () => {
    expect(() => expose({})).not.toThrow()
    expect(() => expose({ ref: undefined })).not.toThrow()
    expect(() => expose(null)).not.toThrow()
  })

  it('rejects refs that are not callbacks', () => {
    expect(() => expose({ ref: {} })).toThrow(new TypeError('Unexpected ref type. Expected a function to set the ref.'))
  })
})
