import { createContext, useContext } from 'solid-js';

import type { PickOptions } from '../logic/picker';

export interface EditorContextValue {
  /**
   * Lets the user click an element of the page; see `pickElement`. The editor itself is never picked.
   */
  pick: (options?: Omit<PickOptions, 'ignore'>) => Promise<Element | undefined>;
  /**
   * Changes whenever the page's content does, so what's read from the page is read again.
   */
  pageVersion: () => number;
}

export const EditorContext = createContext<EditorContextValue>();

export function useEditor() {
  const context = useContext(EditorContext);

  if (!context) throw new Error('useEditor is only available in the editor');

  return context;
}
