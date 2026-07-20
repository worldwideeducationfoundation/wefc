import { sanityClient, QUERIES, urlFor, portableTextToHtml } from './sanity.js';

async function loadPostFromSanity() {
  const bodyContainer = document.getElementById('sanity-post-body');
  const loader = document.getElementById('sanity-post-loader');
  if (!bodyContainer) return;

  try {
    // 1. Extract the unique slug current string from the URL path
    const pathname = window.location.pathname; // e.g. "/blog/ngo-launch-guide"
    const parts = pathname.split('/').filter(Boolean);
    
    // Find the slug. If we represent standard routing, it is the last segment
    let slug = parts[parts.length - 1];
    
    // Handle fallback or local test query string parameter ?slug=ngo-launch-guide
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) {
      slug = querySlug;
    }

    if (!slug || slug === 'post' || slug === 'post.html') {
      console.warn("No specific slug detected. Displaying empty skeleton.");
      if (loader) loader.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-search fa-3x text-muted mb-3"></i>
            <h4 class="font-weight-bold">Select an Article</h4>
            <p class="text-muted">Please visit our blog listing page to choose an article to read.</p>
            <a href="/blog" class="btn btn-primary" style="background: #b83b1d; border-color: #b83b1d;">Go to Blog</a>
        </div>
      `;
      return;
    }

    console.log(`Querying Sanity for blog post with slug: "${slug}"`);
    
    // 2. Fetch data from Sanity
    const post = await sanityClient.fetch(QUERIES.postBySlug, { slug });
    
    if (!post) {
      console.error(`No article found in Sanity for slug: "${slug}"`);
      if (loader) {
        loader.innerHTML = `
          <div class="text-center py-5">
              <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
              <h4 class="font-weight-bold">Article Not Found</h4>
              <p class="text-muted">We couldn't find an article matching "${slug}" inside your Sanity database.</p>
              <a href="/blog" class="btn btn-primary mt-3" style="background: #b83b1d; border-color: #b83b1d;">Back to Blog</a>
          </div>
        `;
      }
      return;
    }

    console.log(`Successfully fetched post: "${post.title}"`);

    // 3. Dynamic DOM Updates
    // Tab title
    const tabTitle = document.getElementById('sanity-tab-title');
    if (tabTitle) {
      tabTitle.innerText = `${post.title} | WEFC`;
    }

    // Header title (H1)
    const headerTitle = document.getElementById('sanity-header-title');
    if (headerTitle) {
      headerTitle.innerText = post.title;
    }

    // Breadcrumb label
    const breadcrumbLabel = document.getElementById('sanity-breadcrumb-label');
    if (breadcrumbLabel) {
      breadcrumbLabel.innerText = post.title;
    }

    // Featured Image
    if (post.mainImage) {
      const imgUrl = urlFor(post.mainImage).url();
      const mediaImg = document.querySelector('.pt-post-media img');
      if (mediaImg) {
        mediaImg.src = imgUrl;
        mediaImg.alt = post.title;
      }
    }

    // Meta elements (Author, Date, Category)
    // Author name
    const authorName = post.author ? post.author.name : 'WEFC';
    const authorLi = document.querySelector('.pt-post-meta li.pt-post-author');
    if (authorLi) {
      authorLi.innerText = authorName;
    }

    // Published date
    if (post.publishedAt) {
      const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const dateLink = document.querySelector('.pt-post-meta li.pt-post-date a');
      if (dateLink) {
        dateLink.innerText = formattedDate;
      }
    }

    // Category
    if (post.categories && post.categories.length > 0) {
      const catLink = document.querySelector('.pt-post-meta li.pt-post-category a');
      if (catLink) {
        catLink.innerText = post.categories[0].title;
        catLink.href = `/blog/category/${post.categories[0].slug}`;
      }
    }

    // 4. Render Rich Body Content
    const richTextHtml = portableTextToHtml(post.body);
    
    // Clear spinner and render
    bodyContainer.innerHTML = richTextHtml;

  } catch (err) {
    console.error('An error occurred during Sanity post initialization:', err);
    if (loader) {
      loader.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-times-circle fa-3x text-danger mb-3"></i>
            <h4 class="font-weight-bold">Error Loading Article</h4>
            <p class="text-muted">A connection issue occurred while connecting to the Sanity Studio backend.</p>
        </div>
      `;
    }
  }
}

// Fire loader on content ready
document.addEventListener('DOMContentLoaded', loadPostFromSanity);
