import { createContext, useContext } from 'solid-js'

export interface AppContext {
  context: string
}

const AppContextProvider = createContext<AppContext>()

export function AppContextProviderComponent(props: { context: string, children: any }) {
  const value: AppContext = {
    context: props.context,
  }

  return (
    <AppContextProvider.Provider value={value}>
      {props.children}
    </AppContextProvider.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContextProvider)
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider')
  }
  return context
}
