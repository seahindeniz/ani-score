import { createContext, useContext } from 'solid-js';

import type { Marks } from '../logic/highlight';
import type { PickOptions } from '../logic/picker';

export interface EditorContextValue {
  /**
   * Lets the user click an element of the page; see `pickElement`. The editor itself is never picked.
   */
  pick: (options?: Omit<PickOptions, 'ignore'>) => Promise<Element | undefined>;
  /**
   * Whether the user is picking an element right now.
   */
  picking: () => boolean;
  /**
   * Changes whenever the page's content does, so what's read from the page is read again.
   */
  pageVersion: () => number;
  /**
   * Points out elements on the page, replacing what was pointed out before. Returns a function that takes these marks
   * away again, unless others replaced them since.
   */
  mark: (marks: Marks) => () => void;
  /**
   * Outlines the elements a setting is about while the user points at it, or none.
   */
  point: (elements: Element[]) => void;
}

export const EditorContext = createContext<EditorContextValue>();

export function useEditor() {
  const context = useContext(EditorContext);

  if (!context) throw new Error('useEditor is only available in the editor');

  return context;
}
