// Create a new custom element for product links with images for transitions to PDP
class ProductCardLink extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#handleClick);
  }

  get productTransitionEnabled() {
    return this.getAttribute('data-product-transition') === 'true';
  }

  get featuredMediaUrl() {
    return this.getAttribute('data-featured-media-url');
  }

  get productUrl() {
    return this.getAttribute('data-product-url');
  }

  /**
   * Handles the click event for the product link
   * @param {Event} event
   */
  #handleClick = (event) => {
    // If the event has been prevented, don't do anything, another component is handling the click
    if (event.defaultPrevented) {
      return;
    }

    // Check if click is within slideshow arrows - ignore completely
    if (event.target instanceof Element) {
      const slideshowArrowsOrControl = event.target.closest('slideshow-arrows, .slideshow-control');
      if (slideshowArrowsOrControl) {
        return; // Don't interfere at all with slideshow
      }
    }

    // If the event was on an interactive element or link, don't do anything, this is not a navigation
    // Let the event propagate to inner components
    if (event.target instanceof Element) {
      const interactiveElement = event.target.closest('button, input, label, select, a, [tabindex="1"]');
      if (interactiveElement) {
        return; // Event continues to propagate
      }
    }

    const gallery = this.querySelector('[data-view-transition-to-main-product]');
    if (!this.productTransitionEnabled || !(gallery instanceof HTMLElement)) {
      return; // Event continues to propagate
    }

    // Check on the current active image, whether it's a product card image or a resource card image
    const activeImage =
      gallery.querySelector('slideshow-slide[aria-hidden="false"] [transitionToProduct="true"]') ||
      gallery.querySelector('[transitionToProduct="true"]:last-child');

    if (activeImage instanceof HTMLImageElement) this.#setImageSrcset(activeImage);

    gallery.setAttribute('data-view-transition-type', 'product-image-transition');
    gallery.setAttribute('data-view-transition-triggered', 'true');

    // Navigate to the product after setting up the transition
    if (this.productUrl) {
      window.location.href = this.productUrl;
    }
  };

  /**
   * Sets the srcset for the image
   * @param {HTMLImageElement} image
   */
  #setImageSrcset(image) {
    if (!this.featuredMediaUrl) return;
    if (!image.currentSrc) return;

    try {
      const currentImageUrl = new URL(image.currentSrc);

      // Deliberately not using origin, as it includes the protocol, which is usually skipped for featured media
      const currentImageRawUrl = currentImageUrl.host + currentImageUrl.pathname;

      if (!this.featuredMediaUrl.includes(currentImageRawUrl)) {
        const imageFade = image.animate([{ opacity: 0.8 }, { opacity: 1 }], {
          duration: 125,
          easing: 'ease-in-out',
        });

        imageFade.onfinish = () => {
          image.srcset = this.featuredMediaUrl ?? '';
        };
      }
    } catch (error) {
      // Invalid URL, silently fail
      return;
    }
  }
}

if (!customElements.get('product-card-link')) {
  customElements.define('product-card-link', ProductCardLink);
}
