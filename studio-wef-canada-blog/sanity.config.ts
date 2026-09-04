import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

export default defineConfig({
  name: 'default',
  title: 'WEF Canada Blog',

  projectId: 'pvj2zu1w',
  dataset: 'production',

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,

    // Backs the "New" button inside each of the three post lists in
    // structure.ts, so a post created from "Project Updates" already has its
    // postType set instead of falling back to the schema default.
    templates: (prev) => [
      ...prev,
      {
        id: 'post-by-type',
        title: 'Post of a given type',
        schemaType: 'post',
        parameters: [{name: 'postType', type: 'string'}],
        value: ({postType}: {postType: string}) => ({postType}),
      },
    ],
  },
})
