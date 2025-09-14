import { useWebExtensionStorage } from '~/composables/useWebExtensionStorage'

export const storageComposable = useWebExtensionStorage('webext-demo', 'Storage Demo')
export const storageDemo = storageComposable.data
export const setStorageDemo = storageComposable.setData
export const storageDemoReady = storageComposable.dataReady
