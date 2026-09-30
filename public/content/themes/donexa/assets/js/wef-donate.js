/* ==========================================================================
   WEF donation widget — PayPal
   --------------------------------------------------------------------------
   Progressive enhancement only. Without this file every widget still works:
   the amount chips are links that already carry their own &amount=, and the
   primary button links to the bare PayPal donate URL.

   What the script adds:
     - clicking a chip selects it rather than leaving the page, so the donor
       can change their mind before committing
     - an "other amount" field, which is markup-hidden until now because a
       text input cannot do anything without script
     - the chosen amount folded into the primary button's href and label

   The amount rides along as ?amount= on the hosted button URL. PayPal
   prefills it when the button accepts a donor-chosen amount and falls back
   to its own amount field otherwise, so a mismatch degrades to "type the
   amount on PayPal" rather than to an error.
   ========================================================================== */
(function () {
  'use strict';

  var widgets = document.querySelectorAll('[data-wef-donate]');
  if (!widgets.length) return;

  /* PayPal wants a plain decimal: strip currency symbols, spaces and
     thousands separators, keep at most two decimal places, reject zero. */
  function normalizeAmount(raw) {
    if (!raw) return '';
    var cleaned = String(raw).replace(/[^0-9.]/g, '');
    var parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    var value = parseFloat(cleaned);
    if (!isFinite(value) || value <= 0) return '';
    return (Math.round(value * 100) / 100).toString();
  }

  function formatAmount(amount) {
    var value = parseFloat(amount);
    if (!isFinite(value)) return '';
    var whole = value % 1 === 0;
    return '$' + value.toLocaleString('en-CA', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function withAmount(baseUrl, amount) {
    if (!amount) return baseUrl;
    return baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + 'amount=' + encodeURIComponent(amount);
  }

  function setup(widget) {
    var link = widget.querySelector('[data-wef-donate-link]');
    if (!link) return;

    var baseUrl = widget.getAttribute('data-donate-url') || link.getAttribute('href');
    var chips = widget.querySelectorAll('[data-amount]');
    var customRow = widget.querySelector('[data-wef-donate-custom]');
    var input = widget.querySelector('[data-wef-donate-input]');
    var label = widget.querySelector('[data-wef-donate-label]');
    var selected = '';

    function render() {
      link.setAttribute('href', withAmount(baseUrl, selected));
      if (label) {
        var pretty = selected ? formatAmount(selected) : '';
        label.textContent = pretty ? ' ' + pretty : '';
      }
      for (var i = 0; i < chips.length; i++) {
        var chipAmount = normalizeAmount(chips[i].getAttribute('data-amount'));
        chips[i].setAttribute('aria-pressed', chipAmount === selected && selected !== '' ? 'true' : 'false');
      }
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.setAttribute('role', 'button');
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', function (event) {
          event.preventDefault();
          var amount = normalizeAmount(chip.getAttribute('data-amount'));
          // A second click on the active chip clears it, which is the only
          // way back to "let me decide on PayPal" once one is chosen.
          selected = amount === selected ? '' : amount;
          if (input) input.value = selected && amount === selected ? selected : '';
          render();
        });
      })(chips[i]);
    }

    if (customRow) customRow.hidden = false;

    if (input) {
      input.addEventListener('input', function () {
        selected = normalizeAmount(input.value);
        render();
      });
      // Enter in the amount field should start the donation, not submit
      // whatever form the widget happens to sit inside.
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          link.click();
        }
      });
    }

    render();
  }

  for (var i = 0; i < widgets.length; i++) setup(widgets[i]);
})();
