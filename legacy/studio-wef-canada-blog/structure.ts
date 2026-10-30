import type {StructureResolver} from 'sanity/structure'

/**
 * Posts are split by type in the sidebar so an editor opening the Studio sees
 * the same three groups the website has, rather than one long mixed list.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Project Updates')
        .child(
          S.documentList()
            .title('Project Updates')
            .filter('_type == "post" && postType == "update"')
            .defaultOrdering([{field: 'publishedAt', direction: 'desc'}])
            .initialValueTemplates([
              S.initialValueTemplateItem('post-by-type', {postType: 'update'}),
            ]),
        ),
      S.listItem()
        .title('Success Stories')
        .child(
          S.documentList()
            .title('Success Stories')
            .filter('_type == "post" && postType == "story"')
            .defaultOrdering([{field: 'publishedAt', direction: 'desc'}])
            .initialValueTemplates([
              S.initialValueTemplateItem('post-by-type', {postType: 'story'}),
            ]),
        ),
      S.listItem()
        .title('Active Projects')
        .child(
          S.documentList()
            .title('Active Projects')
            .filter('_type == "post" && postType == "project"')
            .defaultOrdering([{field: 'publishedAt', direction: 'desc'}])
            .initialValueTemplates([
              S.initialValueTemplateItem('post-by-type', {postType: 'project'}),
            ]),
        ),
      S.divider(),
      S.documentTypeListItem('category').title('Categories'),
      S.documentTypeListItem('author').title('Authors'),
      S.documentTypeListItem('teamMember').title('Team Members'),
      S.divider(),
      S.listItem()
        .title('All Posts')
        .child(
          S.documentTypeList('post')
            .title('All Posts')
            .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
        ),
    ])
