// Lightweight, dependency-free "Know More" bio popup for team member cards.
// Works for both the static fallback cards and cards injected later by team-loader.js,
// since it listens on document via event delegation rather than binding per-button.

function closeBioModal() {
  const modal = document.getElementById('wefBioModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('wef-modal-lock');
}

function openBioModal(trigger) {
  const modal = document.getElementById('wefBioModal');
  if (!modal) return;

  const name = trigger.getAttribute('data-bio-name') || '';
  const role = trigger.getAttribute('data-bio-role') || '';
  const photo = trigger.getAttribute('data-bio-photo') || '';
  const templateId = trigger.getAttribute('data-bio-open');
  const template = templateId ? document.getElementById(templateId) : null;

  modal.querySelector('#wefBioModalName').textContent = name;
  modal.querySelector('#wefBioModalRole').textContent = role;

  const photoEl = modal.querySelector('#wefBioModalPhoto');
  photoEl.src = photo;
  photoEl.alt = name;

  modal.querySelector('#wefBioModalContent').innerHTML = template ? template.innerHTML : '';

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('wef-modal-lock');
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-bio-open]');
  if (opener) {
    e.preventDefault();
    openBioModal(opener);
    return;
  }
  if (e.target.closest('[data-bio-close]')) {
    closeBioModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBioModal();
});
