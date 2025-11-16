import type { createEncapsulatedContainer } from '../logic/createEncapsulatedContainer'
import type { Popover } from '~/components/Popover'

const store = {
  portalRoot: null as ReturnType<typeof createEncapsulatedContainer> | null,
  activeAnimeInfoPopoverRef: null as null | ComponentRef<typeof Popover>,
  activeAnimeInfoId: '',
}

const storeProxy = new Proxy(store, {
  get(target, prop) {
    if (!(prop in target)) {
      throw new Error(`RefStore: Property "${String(prop)}" has not been initialized yet.`)
    }

    return target[prop as keyof typeof target]
  },
  set(target, prop, value) {
    if (!(prop in target)) {
      throw new Error(`RefStore: Cannot set unknown property "${String(prop)}".`)
    }

    target[prop as keyof typeof target] = value

    return true
  },
})

export function useRefStore() {
  return storeProxy
}
