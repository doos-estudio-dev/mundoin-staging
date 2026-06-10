/**
 * Sistema de filtrado personalizado basado en metacampos
 * Permite más de 25 filtros sin depender de Search & Discovery
 */

class CustomFiltersSystem {
  constructor() {
    this.filters = {};
    this.activeFilters = {};
    this.products = [];
    this.filteredProducts = [];
    this.isLoading = false;
    this.collectionHandle = '';
    this.currentPage = 1;
    this.productsPerPage = 24;

    // Configuración de metacampos a usar como filtros
    this.metafieldFilters = window.customFiltersConfig || [];

    this.init();
  }

  async init() {
    // Obtener el handle de la colección desde la URL
    const pathParts = window.location.pathname.split('/');
    const collectionIndex = pathParts.indexOf('collections');
    if (collectionIndex !== -1 && pathParts[collectionIndex + 1]) {
      this.collectionHandle = pathParts[collectionIndex + 1];
    }

    if (!this.collectionHandle) return;

    // Parsear filtros activos de la URL
    this.parseURLFilters();

    // Cargar productos y construir filtros
    await this.loadAllProducts();
    this.buildFilters();
    this.renderFilters();
    this.applyFilters();
    this.setupEventListeners();
  }

  /**
   * Parsea los filtros activos desde la URL
   */
  parseURLFilters() {
    const params = new URLSearchParams(window.location.search);
    this.activeFilters = {};

    for (const [key, value] of params.entries()) {
      if (key.startsWith('cf_')) {
        const filterKey = key.replace('cf_', '');
        if (!this.activeFilters[filterKey]) {
          this.activeFilters[filterKey] = [];
        }
        this.activeFilters[filterKey].push(value);
      }
    }
  }

  /**
   * Carga todos los productos de la colección usando la API AJAX
   */
  async loadAllProducts() {
    this.isLoading = true;
    this.showLoading();

    try {
      let page = 1;
      let hasMore = true;
      this.products = [];

      while (hasMore) {
        const response = await fetch(
          `/collections/${this.collectionHandle}/products.json?limit=250&page=${page}`
        );
        const data = await response.json();

        if (data.products && data.products.length > 0) {
          this.products = this.products.concat(data.products);
          page++;
          // Shopify limita a 250 productos por página, si hay menos, no hay más páginas
          if (data.products.length < 250) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Cargar metacampos para cada producto
      await this.loadProductMetafields();

    } catch (error) {
      console.error('Error loading products:', error);
    }

    this.isLoading = false;
    this.hideLoading();
  }

  /**
   * Carga los metacampos de los productos
   * Nota: La API de productos.json no incluye metacampos,
   * necesitamos obtenerlos de otra manera
   */
  async loadProductMetafields() {
    // Los metacampos ya deberían estar en el HTML renderizado por Liquid
    // Vamos a extraerlos del DOM o usar los datos embebidos
    const productCards = document.querySelectorAll('[data-product-metafields]');

    productCards.forEach(card => {
      try {
        const productId = card.dataset.productId;
        const metafields = JSON.parse(card.dataset.productMetafields || '{}');

        const product = this.products.find(p => p.id.toString() === productId);
        if (product) {
          product.metafields = metafields;
        }
      } catch (e) {
        // Ignorar errores de parsing
      }
    });
  }

  /**
   * Construye los filtros basados en los metacampos de los productos
   */
  buildFilters() {
    this.filters = {};

    for (const filterConfig of this.metafieldFilters) {
      const { namespace, key, label } = filterConfig;
      const filterKey = `${namespace}_${key}`;

      this.filters[filterKey] = {
        label: label,
        namespace: namespace,
        key: key,
        values: new Map() // Map para mantener value -> count
      };
    }

    // Contar valores de cada filtro
    const productElements = document.querySelectorAll('[data-product-metafields]');

    productElements.forEach(element => {
      try {
        const metafields = JSON.parse(element.dataset.productMetafields || '{}');

        for (const filterConfig of this.metafieldFilters) {
          const { namespace, key } = filterConfig;
          const filterKey = `${namespace}_${key}`;
          const value = metafields[namespace]?.[key];

          if (value) {
            // Manejar valores de lista (arrays)
            const values = Array.isArray(value) ? value : [value];

            values.forEach(v => {
              const displayValue = typeof v === 'object' ? (v.value || v.display_name || v) : v;
              if (displayValue && this.filters[filterKey]) {
                const currentCount = this.filters[filterKey].values.get(displayValue) || 0;
                this.filters[filterKey].values.set(displayValue, currentCount + 1);
              }
            });
          }
        }
      } catch (e) {
        // Ignorar errores
      }
    });

    // Eliminar filtros sin valores
    for (const [key, filter] of Object.entries(this.filters)) {
      if (filter.values.size === 0) {
        delete this.filters[key];
      }
    }
  }

  /**
   * Renderiza los filtros en el contenedor
   */
  renderFilters() {
    const container = document.getElementById('custom-filters-container');
    if (!container) return;

    let html = '';

    for (const [filterKey, filter] of Object.entries(this.filters)) {
      const activeValues = this.activeFilters[filterKey] || [];
      const sortedValues = Array.from(filter.values.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      html += `
        <div class="custom-filter" data-filter-key="${filterKey}">
          <details class="custom-filter__panel" open>
            <summary class="custom-filter__summary">
              <span class="custom-filter__label">${filter.label}</span>
              ${activeValues.length > 0 ? `<span class="custom-filter__count">${activeValues.length}</span>` : ''}
              <span class="custom-filter__icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
            </summary>
            <div class="custom-filter__content">
              <ul class="custom-filter__list">
      `;

      for (const [value, count] of sortedValues) {
        const isActive = activeValues.includes(value);
        const inputId = `filter-${filterKey}-${this.slugify(value)}`;

        html += `
          <li class="custom-filter__item">
            <label class="custom-filter__checkbox" for="${inputId}">
              <input
                type="checkbox"
                id="${inputId}"
                name="cf_${filterKey}"
                value="${this.escapeHtml(value)}"
                ${isActive ? 'checked' : ''}
                class="custom-filter__input"
              >
              <span class="custom-filter__checkmark"></span>
              <span class="custom-filter__text">${this.escapeHtml(value)}</span>
              <span class="custom-filter__value-count">(${count})</span>
            </label>
          </li>
        `;
      }

      html += `
              </ul>
            </div>
          </details>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Aplica los filtros activos a los productos
   */
  applyFilters() {
    const productCards = document.querySelectorAll('[data-product-metafields]');
    let visibleCount = 0;

    productCards.forEach(card => {
      try {
        const metafields = JSON.parse(card.dataset.productMetafields || '{}');
        let shouldShow = true;

        // Verificar cada filtro activo
        for (const [filterKey, activeValues] of Object.entries(this.activeFilters)) {
          if (activeValues.length === 0) continue;

          const [namespace, key] = filterKey.split('_');
          const productValue = metafields[namespace]?.[key];

          if (!productValue) {
            shouldShow = false;
            break;
          }

          // Manejar valores de lista
          const productValues = Array.isArray(productValue)
            ? productValue.map(v => typeof v === 'object' ? (v.value || v.display_name || v) : v)
            : [typeof productValue === 'object' ? (productValue.value || productValue.display_name || productValue) : productValue];

          // Verificar si algún valor del producto coincide con los filtros activos
          const hasMatch = activeValues.some(av => productValues.includes(av));

          if (!hasMatch) {
            shouldShow = false;
            break;
          }
        }

        // Mostrar u ocultar el producto
        const listItem = card.closest('.product-grid__item');
        if (listItem) {
          if (shouldShow) {
            listItem.style.display = '';
            visibleCount++;
          } else {
            listItem.style.display = 'none';
          }
        }
      } catch (e) {
        // Ignorar errores
      }
    });

    // Actualizar contador de productos
    this.updateProductCount(visibleCount);
  }

  /**
   * Actualiza el contador de productos visibles
   */
  updateProductCount(count) {
    const countElement = document.querySelector('.products-count-wrapper span');
    if (countElement) {
      countElement.textContent = `${count} producto${count !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    const container = document.getElementById('custom-filters-container');
    if (!container) return;

    container.addEventListener('change', (e) => {
      if (e.target.matches('.custom-filter__input')) {
        this.handleFilterChange(e.target);
      }
    });

    // Botón de limpiar filtros
    const clearButton = document.querySelector('.custom-filters-clear');
    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearAllFilters());
    }
  }

  /**
   * Maneja el cambio de un filtro
   */
  handleFilterChange(input) {
    const filterKey = input.name.replace('cf_', '');
    const value = input.value;

    if (!this.activeFilters[filterKey]) {
      this.activeFilters[filterKey] = [];
    }

    if (input.checked) {
      if (!this.activeFilters[filterKey].includes(value)) {
        this.activeFilters[filterKey].push(value);
      }
    } else {
      this.activeFilters[filterKey] = this.activeFilters[filterKey].filter(v => v !== value);
      if (this.activeFilters[filterKey].length === 0) {
        delete this.activeFilters[filterKey];
      }
    }

    this.updateURL();
    this.applyFilters();
    this.updateFilterCounts();
  }

  /**
   * Actualiza la URL con los filtros activos
   */
  updateURL() {
    const url = new URL(window.location.href);

    // Eliminar todos los parámetros cf_
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith('cf_')) {
        url.searchParams.delete(key);
      }
    }

    // Agregar filtros activos
    for (const [filterKey, values] of Object.entries(this.activeFilters)) {
      for (const value of values) {
        url.searchParams.append(`cf_${filterKey}`, value);
      }
    }

    history.pushState({}, '', url.toString());
  }

  /**
   * Actualiza los contadores de los filtros
   */
  updateFilterCounts() {
    const filterElements = document.querySelectorAll('.custom-filter');

    filterElements.forEach(filterEl => {
      const filterKey = filterEl.dataset.filterKey;
      const activeValues = this.activeFilters[filterKey] || [];
      const countEl = filterEl.querySelector('.custom-filter__count');

      if (activeValues.length > 0) {
        if (countEl) {
          countEl.textContent = activeValues.length;
        } else {
          const summary = filterEl.querySelector('.custom-filter__summary');
          const label = summary.querySelector('.custom-filter__label');
          const countSpan = document.createElement('span');
          countSpan.className = 'custom-filter__count';
          countSpan.textContent = activeValues.length;
          label.after(countSpan);
        }
      } else if (countEl) {
        countEl.remove();
      }
    });
  }

  /**
   * Limpia todos los filtros
   */
  clearAllFilters() {
    this.activeFilters = {};
    this.updateURL();
    this.applyFilters();

    // Desmarcar todos los checkboxes
    document.querySelectorAll('.custom-filter__input:checked').forEach(input => {
      input.checked = false;
    });

    this.updateFilterCounts();
  }

  /**
   * Muestra indicador de carga
   */
  showLoading() {
    const container = document.getElementById('custom-filters-container');
    if (container) {
      container.innerHTML = '<div class="custom-filters-loading">Cargando filtros...</div>';
    }
  }

  /**
   * Oculta indicador de carga
   */
  hideLoading() {
    // Se reemplaza con renderFilters()
  }

  /**
   * Convierte texto a slug
   */
  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.customFiltersConfig && window.customFiltersConfig.length > 0) {
      window.customFiltersSystem = new CustomFiltersSystem();
    }
  });
} else {
  if (window.customFiltersConfig && window.customFiltersConfig.length > 0) {
    window.customFiltersSystem = new CustomFiltersSystem();
  }
}
