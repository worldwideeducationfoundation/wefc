import { isSupabaseConfigured, saveContactMessage, subscribeToNewsletter } from './supabase.js';

/**
 * Declarative Supabase form wiring — no per-page JavaScript required.
 *
 * Markup contract:
 *   <form data-supabase-form="newsletter" data-source="homepage" novalidate>
 *     <input name="email" required />
 *     <input name="name" />
 *     <div class="wef-hp" aria-hidden="true">
 *       <input type="text" name="wef_hp" tabindex="-1" autocomplete="off" />
 *     </div>
 *     <button type="submit">Subscribe</button>
 *     <p data-form-status role="status"><span></span></p>
 *   </form>
 *
 * - `data-supabase-form` picks a handler from HANDLERS below. Adding a new form
 *   type means adding one entry there plus the table in supabase/schema.sql.
 * - `data-source` labels where the submission came from; defaults to the path.
 * - `data-mailto-fallback` (optional) opens the visitor's mail app if the
 *   database is unreachable or not configured yet, so no message is ever lost.
 * - Any `[data-form-status]` element inside the form receives the result.
 * - The `wef_hp` field is a honeypot: bots fill it, humans never see it.
 *
 * Import this module on any page that has such a form; it self-initialises.
 */

const HONEYPOT_FIELD = 'wef_hp';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Every named control in the form as a plain object, strings trimmed. */
function readFields(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else data[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
  }
  return data;
}

/** Empty strings become null so the database stores absence, not "". */
function blankToNull(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}

function setStatus(form, message, kind) {
  const host = form.querySelector('[data-form-status]');
  if (!host) return;
  const target = host.querySelector('span') || host;
  target.textContent = message;
  host.classList.remove('is-error', 'is-success');
  if (kind) host.classList.add(`is-${kind}`);
  host.classList.add('show');
}

function setBusy(form, busy) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.dataset.idleLabel || button.textContent.trim();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/** Required fields plus an email sanity check. Returns an error string or null. */
function validate(form, fields) {
  for (const el of form.elements) {
    if (!el.name || el.disabled || !el.required) continue;
    const value = fields[el.name];
    if (value === '' || value === undefined || value === false) {
      return el.dataset.errorMessage || 'Please fill in all the required fields.';
    }
  }
  if (fields.email && !EMAIL_RE.test(fields.email)) {
    return 'That email address does not look right — please check it.';
  }
  return null;
}

function contextOf(form) {
  return {
    source: form.dataset.source || window.location.pathname,
    pageUrl: window.location.href,
  };
}

/* -------------------------------------------------------------------------- */
/* Handlers — one per `data-supabase-form` value                               */
/* -------------------------------------------------------------------------- */

const HANDLERS = {
  async newsletter(fields, form) {
    const { source, pageUrl } = contextOf(form);
    await subscribeToNewsletter({
      email: fields.email.toLowerCase(),
      name: blankToNull(fields.name),
      source,
      pageUrl,
    });
    return "You're on the list — thank you. Watch your inbox for our next update.";
  },

  async contact(fields, form) {
    const { source, pageUrl } = contextOf(form);
    const subscribe = fields.subscribe === true;

    await saveContactMessage({
      name: fields.name,
      email: fields.email.toLowerCase(),
      phone: blankToNull(fields.phone),
      topic: blankToNull(fields.topic),
      message: fields.message,
      subscribe_newsletter: subscribe,
      source,
      page_url: pageUrl,
    });

    if (subscribe) {
      // A failed opt-in must not make a delivered message look undelivered.
      try {
        await subscribeToNewsletter({
          email: fields.email.toLowerCase(),
          name: blankToNull(fields.name),
          source: `${source} (contact form)`,
          pageUrl,
        });
      } catch (error) {
        console.warn('Newsletter opt-in failed for a contact submission', error);
      }
    }

    return subscribe
      ? "Thank you — your message has reached us and you're subscribed to our updates. We'll be in touch soon."
      : "Thank you — your message has reached us. We'll be in touch soon.";
  },
};

/* -------------------------------------------------------------------------- */
/* Mailto fallback                                                             */
/* -------------------------------------------------------------------------- */

function openMailtoFallback(form, fields) {
  const to = form.dataset.mailtoFallback;
  if (!to) return false;

  const subject = `Website enquiry${fields.topic ? `: ${fields.topic}` : ''}${fields.name ? ` — ${fields.name}` : ''}`;
  const body = [
    fields.name ? `Name: ${fields.name}` : '',
    fields.email ? `Email: ${fields.email}` : '',
    fields.phone ? `Phone: ${fields.phone}` : '',
    fields.topic ? `Topic: ${fields.topic}` : '',
    '',
    fields.message || '',
  ].filter(Boolean).join('\n');

  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setStatus(
    form,
    `Opening your email app with your message ready to send. If nothing happens, email us at ${to}.`,
    'success'
  );
  return true;
}

/* -------------------------------------------------------------------------- */
/* Binding                                                                     */
/* -------------------------------------------------------------------------- */

export function bindSupabaseForm(form) {
  if (form.dataset.supabaseBound === 'true') return;
  form.dataset.supabaseBound = 'true';

  const kind = form.dataset.supabaseForm;
  const handler = HANDLERS[kind];
  if (!handler) {
    console.warn(`No Supabase form handler named "${kind}"`, form);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = readFields(form);

    // Honeypot: pretend it worked, save nothing.
    if (fields[HONEYPOT_FIELD]) {
      setStatus(form, form.dataset.successMessage || 'Thank you.', 'success');
      form.reset();
      return;
    }

    const problem = validate(form, fields);
    if (problem) {
      setStatus(form, problem, 'error');
      return;
    }

    if (!isSupabaseConfigured) {
      if (openMailtoFallback(form, fields)) return;
      setStatus(form, 'Sorry — our form is temporarily unavailable. Please email info@wefcanada.org.', 'error');
      return;
    }

    setBusy(form, true);
    setStatus(form, 'Sending…', null);

    try {
      const message = await handler(fields, form);
      setStatus(form, form.dataset.successMessage || message, 'success');
      form.reset();
    } catch (error) {
      console.error('Form submission failed', error);
      if (!openMailtoFallback(form, fields)) {
        setStatus(
          form,
          'Sorry — we could not send that just now. Please try again, or email info@wefcanada.org.',
          'error'
        );
      }
    } finally {
      setBusy(form, false);
    }
  });
}

export function initSupabaseForms(root = document) {
  root.querySelectorAll('form[data-supabase-form]').forEach(bindSupabaseForm);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initSupabaseForms());
} else {
  initSupabaseForms();
}
