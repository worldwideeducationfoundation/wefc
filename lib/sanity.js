import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

// 1. Initialize Typed/Configured Sanity Client pulling from Vite Env Vars
export const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'wgy1a1gg',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION || '2026-07-08',
  useCdn: true, // Use Edge CDN for sub-second, cached responses
});

// 2. Initialize Responsive Image URL Builder
const builder = imageUrlBuilder(sanityClient);

export function urlFor(source) {
  return builder.image(source);
}

// 3. Documented GROQ Queries for Consistency & Backend Scaling
export const QUERIES = {
  // Fetch all blog posts (sorted by date descending)
  allPosts: `*[_type == "post" && !(_id in path("drafts.**"))] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    mainImage,
    excerpt,
    publishedAt,
    author-> {
      name,
      image
    },
    categories[]-> {
      title,
      "slug": slug.current
    }
  }`,

  // Fetch a singular post by its slug current string
  postBySlug: `*[_type == "post" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
    title,
    "slug": slug.current,
    mainImage,
    excerpt,
    body,
    publishedAt,
    author-> {
      name,
      image,
      bio
    },
    categories[]-> {
      title,
      "slug": slug.current
    }
  }`,

  // Fetch a single category info
  categoryBySlug: `*[_type == "category" && slug.current == $slug][0] {
    title,
    description
  }`,

  // Fetch all posts matching a specific category slug reference
  postsByCategory: `*[_type == "post" && references(*[_type == "category" && slug.current == $slug]._id) && !(_id in path("drafts.**"))] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    mainImage,
    excerpt,
    publishedAt,
    author-> {
      name,
      image
    },
    categories[]-> {
      title,
      "slug": slug.current
    }
  }`,

  // Fetch all team members (sorted by custom manual drag control 'order')
  allTeamMembers: `*[_type == "teamMember" && !(_id in path("drafts.**"))] | order(order asc) {
    name,
    role,
    photo,
    bio,
    teamType,
    socialLinks[] {
      platform,
      url
    }
  }`
};

// 4. Native Portable Text Parser to Standard HTML
export function portableTextToHtml(blocks) {
  if (!blocks || !Array.isArray(blocks)) return '';
  
  return blocks.map(block => {
    if (block._type !== 'block' || !block.children) {
      if (block._type === 'image' && block.asset) {
        const imgUrl = urlFor(block.asset).url();
        const alt = block.alt || 'Sanity CMS Editorial Asset';
        return `<figure class="my-4"><img src="${imgUrl}" alt="${alt}" class="img-fluid rounded" /></figure>`;
      }
      return '';
    }

    const headingTag = block.style && /^h[1-6]$/.test(block.style) ? block.style : 'p';
    
    const childrenHtml = block.children.map(child => {
      let text = child.text || '';
      
      text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (child.marks && Array.isArray(child.marks)) {
        child.marks.forEach(mark => {
          if (mark === 'strong') text = `<strong>${text}</strong>`;
          if (mark === 'em') text = `<em>${text}</em>`;
          if (mark === 'code') text = `<code>${text}</code>`;
        });
      }
      return text;
    }).join('');

    return `<${headingTag} class="mb-3">${childrenHtml}</${headingTag}>`;
  }).join('');
}
