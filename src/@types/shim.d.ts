import type { ProtocolWithReturn } from 'webext-bridge'
import type { fetchDetails } from '~/background/logic/fetchDetails'
import type { makeAnimeFavorite } from '~/background/logic/makeAnimeFavorite'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols
    'fetch-details': ProtocolWithReturn<Parameters<typeof fetchDetails>[0], ReturnType<typeof fetchDetails>>
    'make-anime-favorite': ProtocolWithReturn<Parameters<typeof makeAnimeFavorite>[0], ReturnType<typeof makeAnimeFavorite>>
  }
}
