/**
 * Sistema de Swatches de Colores - JavaScript
 *
 * Funcionalidades:
 * - Cambio de imagen al seleccionar swatch en tarjetas de producto
 * - Actualización de disponibilidad de swatches
 * - Actualización de texto de valor seleccionado
 * - Botón "Mostrar más swatches"
 * - Navegación por teclado
 * - Integración con sistema de variantes de Shopify
 */

(function() {
  'use strict';

  // ============================================================================
  // INICIALIZACIÓN
  // ============================================================================

  document.addEventListener('DOMContentLoaded', function() {
    initProductCardSwatches();
    initProductPageSwatches();
    initShowMoreButtons();
  });

  // ============================================================================
  // SWATCHES EN TARJETAS DE PRODUCTO
  // ============================================================================

  /**
   * Inicializa los swatches en las tarjetas de producto (colecciones)
   */
  function initProductCardSwatches() {
    const productCards = document.querySelectorAll('[data-product-swatches]');

    productCards.forEach(function(card) {
      const swatchDataElement = card.querySelector('[data-swatch-data]');
      if (!swatchDataElement) return;

      try {
        const swatchData = JSON.parse(swatchDataElement.textContent);
        const swatchInputs = card.querySelectorAll('[data-swatch-value]');
        const productCard = card.closest('.product-card') || card.closest('[data-product-card]');

        if (!productCard) return;

        const productImages = productCard.querySelectorAll('img[data-media-id], .product-card__image img, .product-image img');

        swatchInputs.forEach(function(input) {
          // Cambio de imagen en hover
          input.addEventListener('mouseenter', function() {
            handleSwatchHover(this, swatchData, productImages);
          });

          // Cambio de imagen en click
          input.addEventListener('change', function() {
            if (this.checked) {
              handleSwatchChange(this, swatchData, productImages, productCard);
            }
          });
        });

        // Restaurar imagen original al salir del hover
        card.addEventListener('mouseleave', function() {
          resetProductImages(productImages);
        });
      } catch (error) {
        console.error('Error parsing swatch data:', error);
      }
    });
  }

  /**
   * Maneja el hover sobre un swatch
   */
  function handleSwatchHover(input, swatchData, productImages) {
    const selectedValue = input.value;
    const optionKey = swatchData.swatchOptionKey;

    // Buscar variante que coincida
    const variant = swatchData.variants.find(function(v) {
      return v[optionKey] === selectedValue;
    });

    if (variant && variant.image && productImages.length > 0) {
      // Cambiar a la imagen de la variante
      productImages.forEach(function(img) {
        if (img.dataset.mediaId === String(variant.image.id) ||
            img.src.includes(variant.image.src) ||
            img.dataset.src && img.dataset.src.includes(variant.image.src)) {
          img.style.display = 'block';
          img.style.opacity = '1';
        } else {
          img.style.display = 'none';
          img.style.opacity = '0';
        }
      });
    }
  }

  /**
   * Maneja el cambio de selección de un swatch
   */
  function handleSwatchChange(input, swatchData, productImages, productCard) {
    const selectedValue = input.value;
    const optionKey = swatchData.swatchOptionKey;

    // Buscar variante que coincida
    const variant = swatchData.variants.find(function(v) {
      return v[optionKey] === selectedValue;
    });

    if (variant) {
      // Actualizar imagen
      if (variant.image && productImages.length > 0) {
        productImages.forEach(function(img) {
          if (img.dataset.mediaId === String(variant.image.id) ||
              img.src.includes(variant.image.src)) {
            img.style.display = 'block';
            img.style.opacity = '1';
          } else {
            img.style.display = 'none';
            img.style.opacity = '0';
          }
        });
      }

      // Actualizar precio si existe
      const priceElement = productCard.querySelector('[data-product-price]');
      if (priceElement && variant.price) {
        priceElement.textContent = formatMoney(variant.price);
      }

      // Actualizar URL del producto si existe
      const productLink = productCard.querySelector('a[href*="/products/"]');
      if (productLink && variant.id) {
        const baseUrl = productLink.href.split('?')[0];
        productLink.href = baseUrl + '?variant=' + variant.id;
      }
    }
  }

  /**
   * Restaura las imágenes originales del producto
   */
  function resetProductImages(productImages) {
    if (productImages.length === 0) return;

    // Mostrar la primera imagen
    productImages.forEach(function(img, index) {
      if (index === 0) {
        img.style.display = 'block';
        img.style.opacity = '1';
      } else {
        img.style.display = 'none';
        img.style.opacity = '0';
      }
    });
  }

  // ============================================================================
  // SWATCHES EN PÁGINA DE PRODUCTO
  // ============================================================================

  /**
   * Inicializa los swatches en la página de producto
   */
  function initProductPageSwatches() {
    const swatchContainers = document.querySelectorAll('[data-option-swatches]');

    swatchContainers.forEach(function(container) {
      const swatchInputs = container.querySelectorAll('.swatch-input');
      const selectedValueText = container.querySelector('[data-selected-value-text]');

      swatchInputs.forEach(function(input) {
        input.addEventListener('change', function() {
          if (this.checked) {
            // Actualizar texto del valor seleccionado
            if (selectedValueText) {
              selectedValueText.textContent = this.value;
            }

            // Trigger custom event para integración con otros scripts
            const event = new CustomEvent('swatch:changed', {
              detail: {
                value: this.value,
                optionIndex: this.dataset.optionIndex,
                variantId: this.dataset.variantId,
                available: this.dataset.available === 'true'
              },
              bubbles: true
            });
            this.dispatchEvent(event);
          }
        });

        // Navegación por teclado
        input.addEventListener('keydown', function(e) {
          handleSwatchKeyboardNavigation(e, this, swatchInputs);
        });
      });
    });
  }

  /**
   * Maneja la navegación por teclado entre swatches
   */
  function handleSwatchKeyboardNavigation(event, currentInput, allInputs) {
    const inputs = Array.from(allInputs).filter(function(input) {
      return !input.disabled && input.offsetParent !== null; // Solo inputs visibles y habilitados
    });

    const currentIndex = inputs.indexOf(currentInput);

    switch(event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % inputs.length;
        inputs[nextIndex].focus();
        inputs[nextIndex].click();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + inputs.length) % inputs.length;
        inputs[prevIndex].focus();
        inputs[prevIndex].click();
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        currentInput.click();
        break;
    }
  }

  /**
   * Actualiza la disponibilidad de swatches basándose en otras opciones seleccionadas
   */
  function updateSwatchAvailability(productId, selectedOptions, productVariants) {
    const swatchInputs = document.querySelectorAll('.swatch-input[data-product-id="' + productId + '"]');

    swatchInputs.forEach(function(input) {
      const optionIndex = parseInt(input.dataset.optionIndex);
      const optionValue = input.value;

      // Verificar si existe alguna variante disponible con este valor
      const hasAvailableVariant = productVariants.some(function(variant) {
        const variantOptionKey = 'option' + (optionIndex + 1);
        return variant[variantOptionKey] === optionValue && variant.available;
      });

      // Actualizar atributos
      input.dataset.available = hasAvailableVariant;
      input.disabled = !hasAvailableVariant;

      // Actualizar label visual
      const label = input.nextElementSibling;
      if (label) {
        if (hasAvailableVariant) {
          label.classList.remove('swatch-unavailable');
        } else {
          label.classList.add('swatch-unavailable');
        }
      }
    });
  }

  // ============================================================================
  // BOTÓN "MOSTRAR MÁS SWATCHES"
  // ============================================================================

  /**
   * Inicializa los botones "Mostrar más"
   */
  function initShowMoreButtons() {
    const showMoreButtons = document.querySelectorAll('[data-swatch-show-more]');

    showMoreButtons.forEach(function(button) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const container = this.previousElementSibling || this.closest('[data-product-swatches]').querySelector('[data-swatches-container]');
        if (!container) return;

        const hiddenSwatches = container.querySelectorAll('.swatch-card.hidden, .product-card-swatch.hidden');

        hiddenSwatches.forEach(function(swatch) {
          swatch.classList.remove('hidden');
        });

        // Ocultar el botón
        this.style.display = 'none';
        this.setAttribute('aria-hidden', 'true');
      });
    });
  }

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  /**
   * Formatea precio en formato de moneda
   * @param {number} cents - Precio en centavos
   * @returns {string} - Precio formateado
   */
  function formatMoney(cents) {
    if (typeof cents === 'string') {
      cents = cents.replace('.', '');
    }

    let value = '';
    const placeholderRegex = /\{\{\s*amount\s*\}\}/;
    const formatString = window.theme && window.theme.moneyFormat ? window.theme.moneyFormat : '${{amount}}';

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = precision || 2;
      thousands = thousands || ',';
      decimal = decimal || '.';

      if (isNaN(number) || number == null) {
        return '0';
      }

      number = (number / 100.0).toFixed(precision);

      const parts = number.split('.');
      const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      const centsAmount = parts[1] ? (decimal + parts[1]) : '';

      return dollarsAmount + centsAmount;
    }

    switch (formatString.match(placeholderRegex)[0]) {
      case '{{amount}}':
        value = formatWithDelimiters(cents, 2);
        break;
      case '{{amount_no_decimals}}':
        value = formatWithDelimiters(cents, 0);
        break;
      case '{{amount_with_comma_separator}}':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case '{{amount_no_decimals_with_comma_separator}}':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
    }

    return formatString.replace(placeholderRegex, value);
  }

  /**
   * Obtiene parámetros de URL
   */
  function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  // ============================================================================
  // API PÚBLICA
  // ============================================================================

  // Exponer funciones para uso externo
  window.SwatchesAPI = {
    updateAvailability: updateSwatchAvailability,
    resetImages: resetProductImages,
    formatMoney: formatMoney
  };

  // ============================================================================
  // INTEGRACIÓN CON SHOPIFY AJAX API
  // ============================================================================

  /**
   * Actualiza swatches cuando cambia la variante via Ajax
   */
  document.addEventListener('variant:changed', function(e) {
    const variant = e.detail.variant;
    const productId = e.detail.productId;

    if (variant && productId) {
      const swatchInputs = document.querySelectorAll('.swatch-input[data-product-id="' + productId + '"]');

      swatchInputs.forEach(function(input) {
        const optionIndex = parseInt(input.dataset.optionIndex);
        const optionKey = 'option' + (optionIndex + 1);
        const variantOptionValue = variant[optionKey];

        if (input.value === variantOptionValue) {
          input.checked = true;

          // Actualizar texto
          const selectedValueText = input.closest('[data-option-swatches]').querySelector('[data-selected-value-text]');
          if (selectedValueText) {
            selectedValueText.textContent = variantOptionValue;
          }
        }
      });
    }
  });

  // ============================================================================
  // PRELOAD DE IMÁGENES (OPCIONAL - MEJORA PERFORMANCE)
  // ============================================================================

  /**
   * Precarga imágenes de variantes para mejorar la experiencia
   */
  function preloadVariantImages() {
    const swatchData = document.querySelectorAll('[data-swatch-data]');

    swatchData.forEach(function(dataElement) {
      try {
        const data = JSON.parse(dataElement.textContent);
        if (data.variants) {
          data.variants.forEach(function(variant) {
            if (variant.image && variant.image.src) {
              const img = new Image();
              img.src = variant.image.src;
            }
          });
        }
      } catch (error) {
        console.error('Error preloading variant images:', error);
      }
    });
  }

  // Precargar imágenes después de que la página cargue completamente
  window.addEventListener('load', function() {
    // Esperar 1 segundo antes de precargar para no interferir con el render inicial
    setTimeout(preloadVariantImages, 1000);
  });

})();
