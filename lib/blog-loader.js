import { sanityClient, QUERIES, urlFor } from './sanity.js';
import { esc, escUrl } from './html.js';

async function loadBlogFromSanity() {
  // Target the container that holds the blog post list inside the main column
  const blogContainer = document.querySelector('.col-lg-8.col-xl-8 .row');
  if (!blogContainer) return;

  try {
    const posts = await sanityClient.fetch(QUERIES.allPosts);
    
    // If no posts are returned from Sanity, preserve our static high-fidelity fallbacks
    if (!posts || posts.length === 0) {
      console.log('No posts found in Sanity CMS. Keeping high-fidelity static placeholders.');
      return;
    }

    console.log(`Loaded ${posts.length} blog posts dynamically from Sanity Studio.`);
    
    let listHtml = '';
    
    posts.forEach(post => {
      const imgUrl = post.mainImage ? urlFor(post.mainImage).url() : '/content/uploads/2026/03/gallery-03.jpg';
      const formattedDate = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'July 8, 2026';
      
      const authorName = post.author ? post.author.name : 'WEFC';
      const excerpt = post.excerpt || '';
      
      listHtml += `
        <div class="col-xl-12 col-lg-12 col-md-12 mb-5">
            <article class="post type-post status-publish format-standard has-post-thumbnail hentry" style="box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; background: #fff; display: flex; flex-direction: column; height: 100%;">
                <div class="pt-blog-box pt-style-3">
                    <div class="pt-blog-image" style="height: 380px; overflow: hidden; position: relative;">
                        <a href="/blog/${esc(post.slug)}">
                            <img src="${escUrl(imgUrl)}" alt="${esc(post.title)}" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy" />
                        </a>
                    </div>
                    <div class="pt-blog-info" style="padding: 30px 25px;">
                        <div class="pt-blog-meta mb-3" style="display: flex; gap: 20px; font-size: 0.85rem; color: #b83b1d; font-weight: 600;">
                            <span class="pt-blog-date">
                                <i class="far fa-calendar-alt mr-1"></i> ${esc(formattedDate)}
                            </span>
                            <span class="pt-blog-author">
                                <i class="far fa-user mr-1"></i> by ${esc(authorName)}
                            </span>
                        </div>
                        <h3 class="pt-blog-title" style="font-size: 1.6rem; font-weight: 700; line-height: 1.3; margin-bottom: 15px;">
                            <a href="/blog/${esc(post.slug)}" style="color: #1e1e1e; text-decoration: none; transition: color 0.2s ease;">
                                ${esc(post.title)}
                            </a>
                        </h3>
                        <p class="pt-blog-desc text-muted mb-4" style="font-size: 0.95rem; line-height: 1.6;">
                            ${esc(excerpt)}
                        </p>
                        <div class="pt-blog-btn">
                            <a class="pt-btn-link" href="/blog/${esc(post.slug)}" style="color: #b83b1d; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; font-size: 0.9rem;">
                                Read More <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </article>
        </div>
      `;
    });
    
    // Replace hardcoded feed items with dynamic live posts
    blogContainer.innerHTML = listHtml;
    
  } catch (err) {
    console.error('Failed to load blog posts from Sanity Studio:', err);
  }
}

// Bind load operation
document.addEventListener('DOMContentLoaded', loadBlogFromSanity);
