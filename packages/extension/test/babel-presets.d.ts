// The presets ship without type declarations; Babel accepts them as opaque plugin objects
declare module '@babel/preset-typescript' {
  import type { PluginItem } from '@babel/core';

  const preset: PluginItem;
  export default preset;
}

declare module 'babel-preset-solid' {
  import type { PluginItem } from '@babel/core';

  const preset: PluginItem;
  export default preset;
}
