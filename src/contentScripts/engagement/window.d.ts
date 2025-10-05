type EngageWithSite = (config: import('../site/base').SiteBaseConfig, scope: string) => void

interface Window {
  engageWithSite: EngageWithSite
  messageGateway: {
    sendMessage: typeof import('webext-bridge/content-script').sendMessage
    onMessage: typeof import('webext-bridge/content-script').onMessage
  }
}

// declare global {
//   // eslint-disable-next-line vars-on-top
//   var engageWithSite: EngageWithSite
// }

// // declare global {
// //   namespace NodeJS {
// //     interface Global {
// //       engageWithSite: (config: import('../site/base').SiteBaseConfig) => void
// //     }
// //   }
// // }
// export {}
