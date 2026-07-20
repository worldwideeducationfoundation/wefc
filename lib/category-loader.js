import { sanityClient, QUERIES, urlFor } from './sanity.js';

async function loadCategoryPosts() {
  const gridContainer = document.getElementById('sanity-blog-list-container');
  const loader = document.getElementById('sanity-category-loader');
  
  if (!gridContainer) return;

  try {
    // 1. Parse category slug from pathname (e.g., /blog/category/success-stories -> success-stories)
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(Boolean);
    let slug = parts[parts.length - 1];

    // Handle test query parameter fallback (e.g. ?category=success-stories)
    const urlParams = new URLSearchParams(window.location.search);
    const queryCategory = urlParams.get('category');
    if (queryCategory) {
      slug = queryCategory;
    }

    if (!slug || slug === 'category' || slug === 'category.html') {
      console.warn("No category slug detected in route.");
      return;
    }

    console.log(`Querying Sanity for category details and posts with slug: "${slug}"`);

    // 2. Query Category Info & Posts concurrently
    const [category, posts] = await Promise.all([
      sanityClient.fetch(QUERIES.categoryBySlug, { slug }),
      sanityClient.fetch(QUERIES.postsByCategory, { slug })
    ]);

    // 3. Dynamic Title & Heading Updates
    const displayTitle = category ? category.title : slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Update Tab Title
    const tabTitle = document.getElementById('sanity-tab-title');
    if (tabTitle) tabTitle.innerText = `${displayTitle} | WEFC`;

    // Update Header H1
    const headerTitle = document.getElementById('sanity-header-title');
    if (headerTitle) headerTitle.innerText = displayTitle;

    // Update Breadcrumb
    const breadcrumbLabel = document.getElementById('sanity-breadcrumb-label');
    if (breadcrumbLabel) breadcrumbLabel.innerText = displayTitle;

    // If category description is present, we could optionally draw it.
    
    // 4. Render Grid Contents
    if (!posts || posts.length === 0) {
      console.log(`No live posts found in Sanity CMS for category "${slug}".`);
      gridContainer.innerHTML = `
        <div class="col-12 py-5 text-center">
            <div class="pt-empty-state py-5" style="background: #fafafa; border-radius: 12px; border: 2px dashed #eaeaea;">
                <i class="fas fa-box-open fa-3x text-muted mb-3" style="color: #b83b1d !important;"></i>
                <h4 class="font-weight-bold" style="color: #1e1e1e;">No stories found here yet</h4>
                <p class="text-muted">Dynamic posts are currently being compiled for the "${displayTitle}" category.</p>
                <a href="/" class="btn btn-primary mt-3" style="background: #b83b1d; border-color: #b83b1d; border-radius: 50px; padding: 10px 24px; font-weight: 600;">Go to Home</a>
            </div>
        </div>
      `;
      if (loader) loader.style.display = 'none';
      return;
    }

    console.log(`Loaded ${posts.length} articles under "${displayTitle}".`);
    
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
        <div class="col-xl-6 col-lg-6 col-md-12 mb-5">
            <article class="post type-post status-publish format-standard has-post-thumbnail hentry" style="box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; background: #fff; display: flex; flex-direction: column; height: 100%;">
                <div class="pt-blog-box pt-style-3" style="height: 100%; display: flex; flex-direction: column;">
                    <div class="pt-blog-image" style="height: 250px; overflow: hidden; position: relative;">
                        <a href="/blog/${post.slug}">
                            <img src="${imgUrl}" alt="${post.title}" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy" />
                        </a>
                    </div>
                    <div class="pt-blog-info" style="padding: 25px 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="pt-blog-meta mb-2" style="display: flex; gap: 15px; font-size: 0.8rem; color: #b83b1d; font-weight: 600;">
                                <span class="pt-blog-date">
                                    <i class="far fa-calendar-alt mr-1"></i> ${formattedDate}
                                </span>
                                <span class="pt-blog-author">
                                    <i class="far fa-user mr-1"></i> by ${authorName}
                                </span>
                            </div>
                            <h3 class="pt-blog-title" style="font-size: 1.25rem; font-weight: 700; line-height: 1.3; margin-bottom: 12px;">
                                <a href="/blog/${post.slug}" style="color: #1e1e1e; text-decoration: none; transition: color 0.2s ease;">
                                    ${post.title}
                                </a>
                            </h3>
                            <p class="pt-blog-desc text-muted mb-3" style="font-size: 0.85rem; line-height: 1.5; min-height: 50px;">
                                ${excerpt}
                            </p>
                        </div>
                        <div class="pt-blog-btn mt-3">
                            <a class="pt-btn-link" href="/blog/${post.slug}" style="color: #b83b1d; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; font-size: 0.85rem;">
                                Read More <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </article>
        </div>
      `;
    });
    
    // Clear and draw dynamic posts
    gridContainer.innerHTML = listHtml;
    if (loader) loader.style.display = 'none';

  } catch (err) {
    console.error("An error occurred during category feed compilation:", err);
    if (loader) {
      loader.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-times-circle fa-3x text-danger mb-3"></i>
            <h4 class="font-weight-bold">Connection Refused</h4>
            <p class="text-muted">A network error occurred while querying the Sanity CMS server.</p>
        </div>
      `;
    }
  }
}

// Hook content ready event
document.addEventListener('DOMContentLoaded', loadCategoryPosts);
