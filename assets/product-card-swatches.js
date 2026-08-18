/**
 * Swatches de color en tarjetas de producto.
 *
 * Al seleccionar un swatch la tarjeta cambia por completo a esa variante:
 * imagen, precio, enlace al producto, id del formulario de añadir al carrito
 * y disponibilidad del botón.
 *
 * Se apoya en delegación de eventos, así que también funciona con las tarjetas
 * que llegan por section rendering (filtros, paginación, quick add).
 */
(function () {
  'use strict';

  if (window.__productCardSwatchesReady) return;
  window.__productCardSwatchesReady = true;

  var SWATCH = '.product-card-swatch[data-variant-id]';
  var CARD = 'product-card, .product-card, [data-product-card]';
  var IMAGE =
    'img.product-media__image, img.resource-card__image, .card-gallery img, .product-media img';

  function closest(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }

  function cardOf(el) {
    return closest(el, CARD);
  }

  /* ── Imagen ──────────────────────────────────────────────────── */

  function primaryImage(card) {
    return card.querySelector(IMAGE);
  }

  function setImage(card, src, srcset) {
    var img = primaryImage(card);
    if (!img || !src) return;

    if (img.dataset.pcsBaseSrc === undefined) {
      img.dataset.pcsBaseSrc = img.getAttribute('src') || '';
      img.dataset.pcsBaseSrcset = img.getAttribute('srcset') || '';
    }

    if (srcset) {
      img.setAttribute('srcset', srcset);
    } else {
      img.removeAttribute('srcset');
    }
    img.setAttribute('src', src);
  }

  function restoreImage(card) {
    var img = primaryImage(card);
    if (!img || img.dataset.pcsBaseSrc === undefined) return;

    var selected = card.querySelector(SWATCH + '.is-selected');
    if (selected && selected.dataset.image) {
      setImage(card, selected.dataset.image, selected.dataset.imageSrcset);
      return;
    }

    if (img.dataset.pcsBaseSrcset) {
      img.setAttribute('srcset', img.dataset.pcsBaseSrcset);
    } else {
      img.removeAttribute('srcset');
    }
    img.setAttribute('src', img.dataset.pcsBaseSrc);
  }

  /* ── Precio ──────────────────────────────────────────────────── */

  function setPrice(card, price, compareAt) {
    if (!price) return;

    var scope = card.querySelector('product-price') || card;
    var priceEl = scope.querySelector('.price');
    if (priceEl && priceEl.innerHTML !== price) priceEl.innerHTML = price;

    var compareEl = scope.querySelector('.compare-at-price');
    if (!compareEl) return;

    if (compareAt) {
      compareEl.innerHTML = compareAt;
      compareEl.hidden = false;
    } else {
      compareEl.hidden = true;
    }
  }

  /* ── Enlaces y formulario ────────────────────────────────────── */

  function setVariantUrl(card, url) {
    if (!url) return;

    card.setAttribute('data-product-url', url);

    var links = card.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', url);
  }

  function setFormVariant(card, variantId, available) {
    var input = card.querySelector('form input[name="id"]');
    if (input && variantId) input.value = variantId;

    var addButton = card.querySelector('form button[name="add"]');
    if (!addButton) return;

    addButton.disabled = !available;

    var label = addButton.querySelector('span:not(.btn-loader)');
    if (!label) return;

    if (label.dataset.pcsLabel === undefined) label.dataset.pcsLabel = label.textContent;
    label.textContent = available ? label.dataset.pcsLabel : 'Agotado';
  }

  /* ── Selección ───────────────────────────────────────────────── */

  function select(swatch, options) {
    var card = cardOf(swatch);
    if (!card) return;

    var list = closest(swatch, '.product-card-swatches__list') || card;
    var siblings = list.querySelectorAll(SWATCH);
    for (var i = 0; i < siblings.length; i++) {
      var isCurrent = siblings[i] === swatch;
      siblings[i].classList.toggle('is-selected', isCurrent);
      siblings[i].setAttribute('aria-pressed', String(isCurrent));
    }

    var data = swatch.dataset;
    var available = data.available !== 'false';

    setFormVariant(card, data.variantId, available);
    setVariantUrl(card, data.variantUrl);
    setPrice(card, data.price, data.compareAtPrice);

    if (!options || options.updateImage !== false) {
      setImage(card, data.image, data.imageSrcset);
    }

    card.dispatchEvent(
      new CustomEvent('product-card:variant-change', {
        bubbles: true,
        detail: { variantId: data.variantId, available: available }
      })
    );
  }

  /* ── Eventos ─────────────────────────────────────────────────── */

  document.addEventListener('click', function (event) {
    var swatch = closest(event.target, SWATCH);
    if (!swatch) return;

    // La tarjeta navega al producto al hacer clic en cualquier zona neutra.
    event.preventDefault();
    event.stopPropagation();

    select(swatch);
  });

  document.addEventListener(
    'mouseover',
    function (event) {
      var swatch = closest(event.target, SWATCH);
      if (!swatch || swatch.classList.contains('is-selected')) return;

      var card = cardOf(swatch);
      if (card && swatch.dataset.image) {
        setImage(card, swatch.dataset.image, swatch.dataset.imageSrcset);
      }
    },
    true
  );

  document.addEventListener(
    'mouseout',
    function (event) {
      var swatch = closest(event.target, SWATCH);
      if (!swatch) return;

      var related = event.relatedTarget;
      if (related && closest(related, SWATCH) === swatch) return;

      var card = cardOf(swatch);
      if (card) restoreImage(card);
    },
    true
  );

  /* ── Estado inicial ──────────────────────────────────────────── */

  function syncInitialState(root) {
    var selected = (root || document).querySelectorAll(SWATCH + '.is-selected');

    for (var i = 0; i < selected.length; i++) {
      // La imagen ya viene renderizada por Liquid; solo se alinean
      // formulario, enlaces y precio con el swatch marcado.
      select(selected[i], { updateImage: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncInitialState(document);
    });
  } else {
    syncInitialState(document);
  }

  // Tarjetas que llegan después (filtros, paginación, section rendering).
  if ('MutationObserver' in window) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;

        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.matches(CARD) || node.querySelector(SWATCH)) syncInitialState(node);
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
