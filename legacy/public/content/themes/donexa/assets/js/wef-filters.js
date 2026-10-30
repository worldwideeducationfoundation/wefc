/* Category filtering for the listing pages.
 *
 * The chips and each card's data-categories are written by
 * scripts/sanity-sync.mjs from the Sanity category slugs, so the filter set is
 * whatever Sanity says it is — this file never hard-codes a category.
 *
 * Filtering is client-side over cards that are already in the page: the whole
 * list is server-rendered for SEO, and switching topics costs no request. The
 * selected topic is mirrored into ?category= so a filtered view is shareable
 * and survives reload and the back button.
 */
(function () {
  'use strict';

  var bar = document.querySelector('[data-filter-bar]');
  var grid = document.querySelector('[data-filter-grid]');
  if (!bar || !grid) return;

  var chips = Array.prototype.slice.call(bar.querySelectorAll('.ap-filter'));
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.ap-card'));

  var empty = document.createElement('p');
  empty.className = 'ap-empty';
  empty.hidden = true;
  empty.textContent = 'Nothing here yet under this topic.';
  grid.parentNode.insertBefore(empty, grid.nextSibling);

  function apply(slug, push) {
    var shown = 0;

    cards.forEach(function (card) {
      var list = (card.getAttribute('data-categories') || '').split(' ');
      var match = !slug || list.indexOf(slug) !== -1;
      card.hidden = !match;
      if (match) shown++;
    });

    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('data-category') === slug));
    });

    empty.hidden = shown !== 0;
    grid.hidden = shown === 0;

    if (!push) return;
    var url = new URL(window.location.href);
    if (slug) url.searchParams.set('category', slug);
    else url.searchParams.delete('category');
    window.history.pushState({ category: slug }, '', url);
  }

  function fromUrl() {
    return new URL(window.location.href).searchParams.get('category') || '';
  }

  bar.addEventListener('click', function (event) {
    var chip = event.target.closest('.ap-filter');
    if (!chip || !bar.contains(chip)) return;
    event.preventDefault();
    var slug = chip.getAttribute('data-category') || '';
    // Clicking the active chip clears the filter.
    apply(slug && slug === fromUrl() ? '' : slug, true);
  });

  window.addEventListener('popstate', function () {
    apply(fromUrl(), false);
  });

  apply(fromUrl(), false);
})();
