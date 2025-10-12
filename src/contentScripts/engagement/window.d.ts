type EngageWithSite = (config: import('../site/base').SiteBaseConfig, scope: string) => void

interface Window {
  engageWithSite: EngageWithSite
  messageGateway: typeof import('webext-bridge/content-script')
}
