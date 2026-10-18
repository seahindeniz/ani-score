// web-ext ships no types; this covers the part of its API that pack.ts uses
declare module 'web-ext' {
  interface SignParams {
    sourceDir: string;
    artifactsDir: string;
    apiKey: string;
    apiSecret: string;
    channel: 'listed' | 'unlisted';
  }

  const webExt: {
    cmd: {
      sign: (
        params: SignParams,
        options?: { shouldExitProgram?: boolean },
      ) => Promise<{ id: string; downloadedFiles: string[] }>;
    };
  };

  export default webExt;
}
