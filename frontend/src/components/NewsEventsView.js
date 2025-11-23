/**
 * NewsEventsView - News and Events display component
 * Displays system events/news with pagination and lazy loading
 */
import { MenuView } from './MenuView.js';
import { RB } from '../utils/RequestBuilder.js';

export class NewsEventsView extends MenuView {
  constructor(statusComponent) {
    super(statusComponent);
    this.container = null;
    this.events = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.loading = false;
    this.limit = 10; // Events per page
  }

  /**
   * Create and return the news and events view container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'news-events-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>News and Events</h2>
      </div>
      <div class="view-content">
        <div class="news-events-list-container" id="news-events-list-container">
          <div class="events-loading">Loading news and events...</div>
        </div>
        <div class="pagination-container" id="news-pagination-container"></div>
      </div>
    `;
    
    this.loadEvents(this.currentPage);
    this.setupIntersectionObserver();
    
    return this.container;
  }

  /**
   * Setup intersection observer for lazy loading
   */
  setupIntersectionObserver() {
    // Load next page when user scrolls near bottom
    const listContainer = this.container?.querySelector('#news-events-list-container');
    if (!listContainer) return;

    const options = {
      root: null,
      rootMargin: '100px', // Start loading 100px before reaching bottom
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loading && this.currentPage < this.totalPages) {
          this.loadNextPage();
        }
      });
    }, options);

    // Observe the pagination container
    const paginationContainer = this.container?.querySelector('#news-pagination-container');
    if (paginationContainer) {
      observer.observe(paginationContainer);
    }
  }

  /**
   * Load events from API
   */
  async loadEvents(page = 1, append = false) {
    if (this.loading) return;

    const listContainer = this.container?.querySelector('#news-events-list-container');
    if (!listContainer) return;

    try {
      this.loading = true;

      if (!append) {
        listContainer.innerHTML = '<div class="events-loading">Loading news and events...</div>';
        this.events = [];
      }

      const response = await fetch(`/api/system-events?page=${page}&limit=${this.limit}`, {
        headers: RB.getHeadersForGet()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load events');
      }

      // Append new events or replace
      if (append) {
        this.events = [...this.events, ...(data.events || [])];
      } else {
        this.events = data.events || [];
      }

      this.currentPage = data.pagination?.page || page;
      this.totalPages = data.pagination?.totalPages || 1;

      this.renderEvents();
      this.renderPagination();

    } catch (error) {
      console.error('Error loading events:', error);
      this.showError(error.message || 'Failed to load news and events');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load next page (lazy loading)
   */
  async loadNextPage() {
    if (this.currentPage < this.totalPages) {
      await this.loadEvents(this.currentPage + 1, true); // Append to existing
    }
  }

  /**
   * Render events list
   */
  renderEvents() {
    const listContainer = this.container?.querySelector('#news-events-list-container');
    if (!listContainer) return;

    if (this.events.length === 0) {
      listContainer.innerHTML = '<div class="events-empty">No news or events available at this time.</div>';
      return;
    }

    const eventsHtml = this.events.map(event => {
      const createdDate = new Date(event.created_at);
      const dateStr = createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }) + ' UTC';

      return `
        <div class="news-event-item" data-event-id="${event.id}">
          <div class="news-event-header">
            <div class="news-event-date">${this.escapeHtml(dateStr)}</div>
            ${event.creator_name ? `<div class="news-event-creator">by ${this.escapeHtml(event.creator_name)}</div>` : ''}
          </div>
          <div class="news-event-text">${this.formatEventText(event.text)}</div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = eventsHtml;

    // Add loading indicator if there are more pages
    if (this.currentPage < this.totalPages) {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'events-loading-more';
      loadingIndicator.id = 'loading-more-indicator';
      loadingIndicator.textContent = 'Loading more...';
      listContainer.appendChild(loadingIndicator);
    }
  }

  /**
   * Format event text (preserve line breaks, escape HTML)
   */
  formatEventText(text) {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;
    
    // Convert line breaks to <br>
    return escaped.replace(/\n/g, '<br>');
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const paginationContainer = this.container?.querySelector('#news-pagination-container');
    if (!paginationContainer) return;

    // Don't show pagination if lazy loading is enabled and we're not at the last page
    // Instead, show page info and manual navigation
    if (this.totalPages <= 1 && this.events.length === 0) {
      paginationContainer.innerHTML = '';
      return;
    }

    const hasNext = this.currentPage < this.totalPages;
    const hasPrev = this.currentPage > 1;

    paginationContainer.innerHTML = `
      <div class="news-pagination">
        ${hasPrev ? `
          <button class="btn-pagination btn-prev" data-page="${this.currentPage - 1}">
            ← Previous
          </button>
        ` : '<div></div>'}
        
        <span class="pagination-info">
          Page ${this.currentPage} of ${this.totalPages} 
          ${this.events.length > 0 ? `(${this.events.length} event${this.events.length === 1 ? '' : 's'} loaded)` : ''}
        </span>
        
        ${hasNext ? `
          <button class="btn-pagination btn-next" data-page="${this.currentPage + 1}">
            Next →
          </button>
        ` : '<div></div>'}
      </div>
    `;

    // Add click handlers
    paginationContainer.querySelectorAll('.btn-pagination').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.getAttribute('data-page'));
        this.loadEvents(page, false); // Don't append, replace
      });
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    const listContainer = this.container?.querySelector('#news-events-list-container');
    if (listContainer) {
      listContainer.innerHTML = `<div class="events-error">Error: ${this.escapeHtml(message)}</div>`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get the container element
   */
  getContainer() {
    if (!this.container) {
      this.create();
    }
    return this.container;
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.events = [];
  }
}
