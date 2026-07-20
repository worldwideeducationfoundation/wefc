// sanity/schemas/index.ts
import category from './category';
import author from './author';
import post from './post';
import { navItem, navigation } from './navigation';

export const schemaTypes = [
  category,
  author,
  post,
  navItem,
  navigation
];

export default schemaTypes;
