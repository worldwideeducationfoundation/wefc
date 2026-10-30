import author from './author'
import callToAction from './callToAction'
import category from './category'
import post from './post'
import statGroup from './statGroup'
import teamMember from './teamMember'

export const schemaTypes = [
  // Documents
  post,
  category,
  author,
  teamMember,
  // Reusable objects
  callToAction,
  statGroup,
]

export default schemaTypes
