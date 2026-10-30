import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'pvj2zu1w',
    dataset: 'production'
  },
  /**
   * Hosted Studio address: https://wefcanada-cms.sanity.studio
   * Pinned here so `sanity deploy` never prompts for a hostname and can never
   * publish to a different one by accident.
   */
  studioHost: 'wefcanada-cms',
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
    // Pinned so `sanity deploy` never prompts for an application id, and can
    // never create a second application by accident.
    appId: 'og9wypo774ys87uatw256kv4',
  },
})
