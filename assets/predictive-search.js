import { Component } from '@theme/component';
import { debounce, onAnimationEnd, prefersReducedMotion, onDocumentLoaded } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';
import { morph } from '@theme/morph';
import { RecentlyViewed } from '@theme/recently-viewed-products';
import { DialogCloseEvent, DialogComponent } from '@theme/dialog';

/**
 * A custom element that allows the user to search for resources available on the store.
 *
 * @typedef {object} Refs
 * @property {HTMLInputElement} searchInput - The search input element.
 * @property {HTMLElement} predictiveSearchResults - The predictive search results container.
 * @property {HTMLElement} resetButton - The reset button element.
 * @property {HTMLElement[]} [resultsItems] - The search results items elements.
 * @property {HTMLElement} [recentlyViewedWrapper] - The recently viewed products wrapper.
 * @property {HTMLElement[]} [recentlyViewedTitle] - The recently viewed title elements.
 * @property {HTMLElement[]} [recentlyViewedItems] - The recently viewed product items.
 * @extends {Component<Refs>}
 */
class PredictiveSearchComponent extends Component {
  requiredRefs = ['searchInput', 'predictiveSearchResults', 'resetButton'];

  #controller = new AbortController();

  /**
   * @type {AbortController | null}
   */
  #activeFetch = null;

  /**
   * Get the dialog component.
   * @returns {DialogComponent | null} The dialog component.
   */
  get dialog() {
    return this.closest('dialog-component');
  }

  connectedCallback() {
    super.connectedCallback();

    const { dialog } = this;
    const { signal } = this.#controller;

    if (this.refs.searchInput.value.length > 0) {
      this.#showResetButton();
    }

    if (dialog) {
      document.addEventListener('keydown', this.#handleKeyboardShortcut, { signal });
      dialog.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose, { signal });

      this.addEventListener('click', this.#handleModalClick, { signal });
    }

    onDocumentLoaded(() => {
      this.resetSearch(false); // Pass false to avoid focusing the input
    });
  }

  /**
   * Handles clicks within the predictive search modal to maintain focus on the input
   * @param {MouseEvent} event - The mouse event
   */
  #handleModalClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const isInteractiveElement =
      target instanceof HTMLButtonElement ||
      target instanceof HTMLAnchorElement ||
      target instanceof HTMLInputElement ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input');

    if (!isInteractiveElement && this.refs.searchInput) {
      this.refs.searchInput.focus();
    }
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller.abort();
  }

  /**
   * Handles the CMD+K key combination.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  #handleKeyboardShortcut = (event) => {
    if (event.metaKey && event.key === 'k') {
      this.dialog?.toggleDialog();
    }
  };

  /**
   * Handles the dialog close event.
   */
  #handleDialogClose = () => {
    this.#resetSearch();
  };

  get #allResultsItems() {
    const containers = Array.from(
      this.querySelectorAll(
        '.predictive-search-results__wrapper-queries, ' +
          '.predictive-search-results__wrapper-products, ' +
          '.predictive-search-results__list'
      )
    );

    const allItems = containers
      .flatMap((container) => {
        if (container.classList.contains('predictive-search-results__wrapper-products')) {
          return Array.from(container.querySelectorAll('.predictive-search-results__card'));
        }
        return Array.from(container.querySelectorAll('[ref="resultsItems[]"], .predictive-search-results__card'));
      })
      .filter((item) => item instanceof HTMLElement);

    return /** @type {HTMLElement[]} */ (allItems);
  }

  /**
   * Track whether the last interaction was keyboard-based
   * @type {boolean}
   */
  #isKeyboardNavigation = false;

  get #currentIndex() {
    return this.#allResultsItems?.findIndex((item) => item.getAttribute('aria-selected') === 'true') ?? -1;
  }

  set #currentIndex(index) {
    if (!this.#allResultsItems?.length) return;

    this.#allResultsItems.forEach((item) => {
      item.classList.remove('keyboard-focus');
    });

    for (const [itemIndex, item] of this.#allResultsItems.entries()) {
      if (itemIndex === index) {
        item.setAttribute('aria-selected', 'true');

        if (this.#isKeyboardNavigation) {
          item.classList.add('keyboard-focus');
        }
        item.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
      } else {
        item.removeAttribute('aria-selected');
      }
    }
    this.refs.searchInput.focus();
  }

  get #currentItem() {
    return this.#allResultsItems?.[this.#currentIndex];
  }

  /**
   * Navigate through the predictive search results using arrow keys or close them with the Escape key.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      this.#resetSearch();
      return;
    }

    if (!this.#allResultsItems?.length || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      return;
    }

    const currentIndex = this.#currentIndex;
    const totalItems = this.#allResultsItems.length;

    switch (event.key) {
      case 'ArrowDown':
        this.#isKeyboardNavigation = true;
        event.preventDefault();
        this.#currentIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
        break;

      case 'Tab':
        if (event.shiftKey) {
          this.#isKeyboardNavigation = true;
          event.preventDefault();
          this.#currentIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
        } else {
          this.#isKeyboardNavigation = true;
          event.preventDefault();
          this.#currentIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
        }
        break;

      case 'ArrowUp':
        this.#isKeyboardNavigation = true;
        event.preventDefault();
        this.#currentIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
        break;

      case 'Enter': {
        const singleResultContainer = this.refs.predictiveSearchResults.querySelector('[data-single-result-url]');
        if (singleResultContainer instanceof HTMLElement && singleResultContainer.dataset.singleResultUrl) {
          event.preventDefault();
          window.location.href = singleResultContainer.dataset.singleResultUrl;
          return;
        }

        if (this.#currentIndex >= 0) {
          event.preventDefault();
          this.#currentItem?.querySelector('a')?.click();
        } else {
          const searchUrl = new URL(Theme.routes.search_url, location.origin);
          searchUrl.searchParams.set('q', this.refs.searchInput.value);
          window.location.href = searchUrl.toString();
        }
        break;
      }
    }
  };

  /**
   * Clears the recently viewed products.
   * @param {Event} event - The event.
   */
  clearRecentlyViewedProducts(event) {
    event.stopPropagation();

    RecentlyViewed.clearProducts();

    const { recentlyViewedItems, recentlyViewedTitle, recentlyViewedWrapper } = this.refs;

    const allRecentlyViewedElements = [...(recentlyViewedItems || []), ...(recentlyViewedTitle || [])];

    if (allRecentlyViewedElements.length === 0) {
      return;
    }

    if (recentlyViewedWrapper) {
      recentlyViewedWrapper.classList.add('removing');

      onAnimationEnd(recentlyViewedWrapper, () => {
        recentlyViewedWrapper.remove();
      });
    }
  }

  /**
   * Reset the search state.
   * @param {boolean} [keepFocus=true] - Whether to keep focus on input after reset
   */
  resetSearch = debounce((keepFocus = true) => {
    if (keepFocus) {
      this.refs.searchInput.focus();
    }
    this.#resetSearch();
  }, 100);

  /**
   * Debounce the search handler to fetch and display search results based on the input value.
   * Reset the current selection index and close results if the search term is empty.
   */
  search = debounce((event) => {
    // If the input is not a text input (like using the Escape key), don't search
    if (!event.inputType) return;

    const searchTerm = this.refs.searchInput.value.trim();
    this.#currentIndex = -1;

    if (!searchTerm.length) {
      this.#resetSearch();
      return;
    }

    this.#showResetButton();
    this.#getSearchResults(searchTerm);
  }, 200);

  /**
   * Resets scroll positions for search results containers
   */
  #resetScrollPositions() {
    requestAnimationFrame(() => {
      const resultsInner = this.refs.predictiveSearchResults.querySelector('.predictive-search-results__inner');
      if (resultsInner instanceof HTMLElement) {
        resultsInner.scrollTop = 0;
      }

      const formContent = this.querySelector('.predictive-search-form__content');
      if (formContent instanceof HTMLElement) {
        formContent.scrollTop = 0;
      }
    });
  }

  /**
   * Synonym dictionary for intelligent search - MUNDO IN Store
   * Based on actual product inventory (13,192 products)
   * Maps search terms to their synonyms
   */
  #synonyms = {
    // ===== SILLAS (Categoría principal: 123 productos) =====
    'silla': ['chair', 'asiento', 'sillas'],
    'chair': ['silla', 'asiento', 'sillas'],
    'sillas': ['silla', 'chair', 'asiento'],
    'silla de comedor': ['silla para comedor', 'silla cocina', 'dining chair'],
    'silla oficina': ['silla ejecutiva', 'silla escritorio', 'office chair', 'silla ergonomica'],
    'silla ejecutiva': ['silla oficina', 'silla escritorio', 'executive chair'],
    'silla gaming': ['silla gamer', 'gaming chair'],

    // ===== ESCRITORIOS (47 productos) =====
    'escritorio': ['desk', 'mesa de trabajo', 'escritorios', 'mesa escritorio'],
    'desk': ['escritorio', 'mesa de trabajo', 'escritorios'],
    'escritorio oficina': ['desk office', 'mesa oficina', 'escritorio ejecutivo'],
    'escritorio hogar': ['escritorio casa', 'desk home', 'escritorio estudio'],

    // ===== MESAS (44 productos) =====
    'mesa': ['table', 'mesas'],
    'table': ['mesa', 'mesas'],
    'mesa comedor': ['mesa para comedor', 'dining table', 'mesa cocina'],
    'mesa centro': ['mesa de centro', 'mesa sala', 'coffee table'],
    'mesa lateral': ['mesa auxiliar', 'side table', 'mesita'],

    // ===== SALAS (16 productos) =====
    'sala': ['sofa', 'sillon', 'living', 'salas'],
    'sofa': ['sala', 'sillon', 'couch', 'divan', 'sofas'],
    'sillon': ['sofa', 'sala', 'couch', 'sillones'],
    'love seat': ['sofa 2 plazas', 'sillon dos personas', 'loveseat'],

    // ===== BANCOS (25 productos) =====
    'banco': ['stool', 'banqueta', 'bancos', 'taburete'],
    'stool': ['banco', 'banqueta', 'bancos', 'taburete'],
    'banqueta': ['banco', 'stool', 'bancos'],

    // ===== ALMACENAJE (45 productos) =====
    'almacenaje': ['storage', 'organizacion', 'guardado', 'almacenamiento'],
    'storage': ['almacenaje', 'organizacion', 'guardado'],
    'archivero': ['archivo', 'cajonera', 'filing cabinet', 'archiveros'],
    'cajonera': ['archivo', 'archivero', 'drawer', 'cajones'],
    'librero': ['estante', 'repisa', 'bookcase', 'biblioteca', 'libreros'],
    'estante': ['librero', 'repisa', 'shelf', 'estantes'],
    'organizador': ['organizadores', 'organizer', 'storage'],

    // ===== CAMAS Y RECÁMARAS (productos de dormitorio) =====
    'cama': ['bed', 'camas'],
    'bed': ['cama', 'camas'],
    'base': ['base cama', 'bed base', 'bases'],
    'cabecera': ['headboard', 'respaldo cama', 'cabeceras'],
    'recamara': ['dormitorio', 'habitacion', 'cuarto', 'bedroom'],
    'dormitorio': ['recamara', 'habitacion', 'bedroom', 'cuarto'],
    'habitacion': ['recamara', 'dormitorio', 'bedroom', 'cuarto'],

    // ===== ESPACIOS =====
    'hogar': ['casa', 'home', 'residencial'],
    'casa': ['hogar', 'home', 'residencial'],
    'oficina': ['office', 'trabajo', 'comercial'],
    'office': ['oficina', 'trabajo', 'comercial'],
    'comedor': ['dining', 'area comida', 'cocina'],
    'cocina': ['kitchen', 'comedor', 'area comida'],

    // ===== SETS Y PAQUETES =====
    'set': ['paquete', 'combo', 'juego', 'sets'],
    'paquete': ['set', 'combo', 'juego', 'paquetes'],
    'juego': ['set', 'paquete', 'combo'],
    'paquete comedor': ['set comedor', 'juego comedor', 'dining set'],

    // ===== COLORES (basado en tags reales de la tienda) =====
    'blanco': ['white', 'blancos'],
    'white': ['blanco', 'blancos'],
    'negro': ['black', 'negros'],
    'black': ['negro', 'negros'],
    'gris': ['gray', 'grey', 'grises'],
    'gray': ['gris', 'grey', 'grises'],
    'azul': ['blue', 'azules'],
    'blue': ['azul', 'azules'],
    'rojo': ['red', 'rojos'],
    'red': ['rojo', 'rojos'],
    'verde': ['green', 'verdes'],
    'green': ['verde', 'verdes'],
    'amarillo': ['yellow', 'amarillos'],
    'yellow': ['amarillo', 'amarillos'],
    'cafe': ['brown', 'cafes', 'marron'],
    'brown': ['cafe', 'cafes', 'marron'],
    'beige': ['beiges', 'crema'],

    // ===== MATERIALES =====
    'madera': ['wood', 'wooden'],
    'wood': ['madera', 'wooden'],
    'metal': ['metalico', 'acero', 'hierro'],
    'acero': ['metal', 'metalico', 'steel'],
    'tela': ['fabric', 'textil', 'tapizado'],
    'fabric': ['tela', 'textil', 'tapizado'],
    'piel': ['leather', 'cuero'],
    'leather': ['piel', 'cuero'],
    'plastico': ['plastic'],
    'plastic': ['plastico'],
    'vidrio': ['glass', 'cristal'],
    'glass': ['vidrio', 'cristal'],

    // ===== ESTILOS =====
    'moderno': ['modern', 'contemporaneo', 'modernos'],
    'modern': ['moderno', 'contemporaneo', 'modernos'],
    'minimalista': ['minimalist', 'minimal', 'minimalistas'],
    'minimalist': ['minimalista', 'minimal', 'minimalistas'],
    'industrial': ['industriales'],
    'clasico': ['classic', 'tradicional', 'clasicos'],
    'classic': ['clasico', 'tradicional', 'clasicos']
  };

  /**
   * Expand search term with synonyms
   * @param {string} searchTerm - The original search term
   * @returns {string} - Expanded search query with synonyms
   */
  #expandWithSynonyms(searchTerm) {
    const lowerTerm = searchTerm.toLowerCase().trim();
    const words = lowerTerm.split(/\s+/);

    // Build an array of search terms including synonyms
    const expandedTerms = [];

    // First, try exact phrase match with wildcards for partial matching
    expandedTerms.push(searchTerm + '*');

    words.forEach(word => {
      // Remove accents for better matching
      const normalizedWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Add the word with wildcard for partial matching
      if (word.length > 2) {
        expandedTerms.push(word + '*');
      }

      // Check for synonyms
      if (this.#synonyms[normalizedWord]) {
        // Add all synonyms with wildcards for better matching
        this.#synonyms[normalizedWord].forEach(synonym => {
          if (synonym.length > 2) {
            expandedTerms.push(synonym + '*');
            expandedTerms.push(synonym); // Also exact match
          }
        });
      }
    });

    // Remove duplicates and join with OR operator
    const uniqueTerms = [...new Set(expandedTerms)];

    // Log for debugging (remove in production if needed)

    return uniqueTerms.join(' OR ');
  }

  /**
   * Fetch search results using the section renderer and update the results container.
   * @param {string} searchTerm - The term to search for
   */
  async #getSearchResults(searchTerm) {
    if (!this.dataset.sectionId) return;

    // Expand search term with synonyms
    const expandedQuery = this.#expandWithSynonyms(searchTerm);

    const url = new URL(Theme.routes.predictive_search_url, location.origin);
    url.searchParams.set('q', expandedQuery);
    url.searchParams.set('resources[limit_scope]', 'each');

    // Use prefix matching for partial word search
    url.searchParams.set('options[prefix]', 'last');

    // Show unavailable products
    url.searchParams.set('options[unavailable_products]', 'show');

    const { predictiveSearchResults } = this.refs;

    const abortController = this.#createAbortController();

    sectionRenderer
      .getSectionHTML(this.dataset.sectionId, false, url)
      .then((resultsMarkup) => {
        if (!resultsMarkup) return;

        if (abortController.signal.aborted) return;

        morph(predictiveSearchResults, resultsMarkup);

        this.#resetScrollPositions();
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        throw error;
      });
  }

  /**
   * Fetch the markup for the recently viewed products.
   * @returns {Promise<string | null>} The markup for the recently viewed products.
   */
  async #getRecentlyViewedProductsMarkup() {
    if (!this.dataset.sectionId) return null;

    const viewedProducts = RecentlyViewed.getProducts();
    if (viewedProducts.length === 0) return null;

    const url = new URL(Theme.routes.search_url, location.origin);
    url.searchParams.set('q', viewedProducts.map(/** @param {string} id */ (id) => `id:${id}`).join(' OR '));
    url.searchParams.set('resources[type]', 'product');

    return sectionRenderer.getSectionHTML(this.dataset.sectionId, false, url);
  }

  #hideResetButton() {
    const { resetButton } = this.refs;

    resetButton.hidden = true;
  }

  #showResetButton() {
    const { resetButton } = this.refs;

    resetButton.hidden = false;
  }

  #createAbortController() {
    const abortController = new AbortController();
    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }
    this.#activeFetch = abortController;
    return abortController;
  }

  #resetSearch = async () => {
    const { predictiveSearchResults, searchInput } = this.refs;
    const emptySectionId = 'predictive-search-empty';

    this.#currentIndex = -1;
    searchInput.value = '';
    this.#hideResetButton();

    const abortController = this.#createAbortController();
    const url = new URL(window.location.href);
    url.searchParams.delete('page');

    const emptySectionMarkup = await sectionRenderer.getSectionHTML(emptySectionId, false, url);
    const parsedEmptySectionMarkup = new DOMParser()
      .parseFromString(emptySectionMarkup, 'text/html')
      .querySelector('.predictive-search-empty-section');

    if (!parsedEmptySectionMarkup) throw new Error('No empty section markup found');

    /** This needs to be awaited and not .then so the DOM is already morphed
     * when #closeResults is called and therefore the height is animated */
    const viewedProducts = RecentlyViewed.getProducts();

    if (viewedProducts.length > 0) {
      const recentlyViewedMarkup = await this.#getRecentlyViewedProductsMarkup();
      if (!recentlyViewedMarkup) return;

      const parsedRecentlyViewedMarkup = new DOMParser().parseFromString(recentlyViewedMarkup, 'text/html');
      const recentlyViewedProductsHtml = parsedRecentlyViewedMarkup.getElementById('predictive-search-products');
      if (!recentlyViewedProductsHtml) return;

      for (const child of recentlyViewedProductsHtml.children) {
        if (child instanceof HTMLElement) {
          child.setAttribute('ref', 'recentlyViewedWrapper');
        }
      }

      const collectionElement = parsedEmptySectionMarkup.querySelector('#predictive-search-products');
      if (!collectionElement) return;
      collectionElement.prepend(...recentlyViewedProductsHtml.children);
    }

    if (abortController.signal.aborted) return;

    morph(predictiveSearchResults, parsedEmptySectionMarkup);
    this.#resetScrollPositions();
  };
}

if (!customElements.get('predictive-search-component')) {
  customElements.define('predictive-search-component', PredictiveSearchComponent);
}
