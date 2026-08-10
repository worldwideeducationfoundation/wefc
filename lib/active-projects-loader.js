import { sanityClient, QUERIES, urlFor } from './sanity.js';
import { esc, escUrl } from './html.js';

async function loadActiveProjects() {
  const grid = document.getElementById('ap-grid');
  const loader = document.getElementById('ap-loader');
  const empty = document.getElementById('ap-empty');
  if (!grid) return;

  try {
    const posts = await sanityClient.fetch(QUERIES.postsByCategory, { slug: 'active-projects' });

    if (loader) loader.hidden = true;

    if (!posts || posts.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }

    grid.innerHTML = posts.map((post) => {
      const imgUrl = post.mainImage
        ? urlFor(post.mainImage).width(760).height(520).fit('crop').url()
        : '/content/uploads/wef/bright-beginnings-program.jpg';
      const excerpt = post.excerpt || '';
      const href = `/blog/${post.slug}`;
      return `
        <a class="ap-card" href="${escUrl(href)}">
          <div class="ap-card-media">
            <img src="${escUrl(imgUrl)}" alt="" loading="lazy" />
          </div>
          <div class="ap-card-body">
            <h3>${esc(post.title)}</h3>
            ${excerpt ? `<p>${esc(excerpt)}</p>` : ''}
            <span class="ap-card-link">Read more
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load Active Projects from Sanity:', err);
    if (loader) loader.hidden = true;
    if (empty) {
      empty.hidden = false;
      const title = empty.querySelector('[data-empty-title]');
      const desc = empty.querySelector('[data-empty-desc]');
      if (title) title.textContent = 'Couldn’t load projects right now';
      if (desc) desc.textContent = 'There was a problem reaching our content server. Please try refreshing the page.';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadActiveProjects);
