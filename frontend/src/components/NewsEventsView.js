/**
 * NewsEventsView - News and Events display component
 * Displays system events/news with pagination and lazy loading
 */
import { MenuView } from './MenuView.js';
import { eventBus } from '../eventBus.js';
import { ApiRequest } from '../events/Events.js';
import { Utils } from '../utils/Utils.js';

export class NewsEventsView extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.events = [];
      this.currentPage = 1;
      this.totalPages = 1;
      this.loading = false;
      this.limit = 10; // Events per page
      this.abortControl = null;

      // Register event handlers
      this.registerEventHandler('system:systemEventsResponse', this.handleSystemEventsResponse.bind(this));
   }

   /**
    * Create and return the news and events view container
    */
   create()
   {
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
   setupIntersectionObserver()
   {
      // Load next page when user scrolls near bottom
      Utils.requireChild(this.container, '#news-events-list-container');
      const options = 
      {
         root: null,
         rootMargin: '100px', // Start loading 100px before reaching bottom
         threshold: 0.1
      };

      const observer = new IntersectionObserver((entries) =>
      {
         entries.forEach(entry =>
         {
            if (entry.isIntersecting && !this.loading && this.currentPage < this.totalPages)
               this.loadNextPage();
         });
      }, options);

      // Observe the pagination container
      const paginationContainer = Utils.requireChild(this.container, '#news-pagination-container');
      if (paginationContainer)
         observer.observe(paginationContainer);
   }

   /**
    * Load events from API via events
    */
   loadEvents(page = 1, append = false)
   {
      if (this.loading) 
        return;
      
      const listContainer = Utils.requireChild(this.container, '#news-events-list-container');

      this.loading = true;
      this.currentPage = page;
      this.appendMode = append;

      if (!append)
      {
         listContainer.innerHTML = '<div class="events-loading">Loading news and events...</div>';
         this.events = [];
      }

      // Abort any previous request
      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      // Emit request event
      eventBus.emit('system:systemEventsRequest', new ApiRequest('system:systemEventsRequest', 
         { page, limit: this.limit }, 
         this.abortControl.signal));
   }

   /**
    * Handle system events response
    * @param {ApiResponse} event - System events response event
    */
   handleSystemEventsResponse(event)
   {
      if (event.isSuccess() && event.data)
      {
         const data = event.data;

         // Append new events or replace
         if (this.appendMode)
            this.events = [...this.events, ...(data.events || [])];
         else
            this.events = data.events || [];

         this.currentPage = data.pagination?.page || this.currentPage;
         this.totalPages = data.pagination?.totalPages || 1;

         this.renderEvents();
         this.renderPagination();
      }
      else if (event.isAborted())
         this.displayStatusMessage('News and events loading aborted.', 'error');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load news and events', 'error');

      this.loading = false;
      this.abortControl = null;
   }

   /**
    * Load next page (lazy loading)
    */
   loadNextPage()
   {
      if (this.currentPage < this.totalPages)
         this.loadEvents(this.currentPage + 1, true); // Append to existing
   }

   renderEvents()
   {
      const listContainer = Utils.requireChild(this.container, '#news-events-list-container');

      if (this.events.length === 0)
      {
         listContainer.innerHTML = '<div class="events-empty">No news or events available at this time.</div>';
         return;
      }

      const eventsHtml = this.events.map(event =>
      {
         return `
        <div class="news-event-item" data-event-id="${event.id}">
          <div class="news-event-header">
            <div class="news-event-date">${Utils.escapeHtml(Utils.getUTCTimeString(new Date(event.created_at)))}</div>
            ${event.creator_name ? `<div class="news-event-creator">by ${Utils.escapeHtml(event.creator_name)}</div>` : ''}
          </div>
          <div class="news-event-text">${Utils.escapeHtml(event.text)}</div>
        </div>
      `;
      }).join('');

      listContainer.innerHTML = eventsHtml;

      // Add loading indicator if there are more pages
      if (this.currentPage < this.totalPages)
      {
         const loadingIndicator = document.createElement('div');
         loadingIndicator.className = 'events-loading-more';
         loadingIndicator.id = 'loading-more-indicator';
         loadingIndicator.textContent = 'Loading more...';
         listContainer.appendChild(loadingIndicator);
      }
   }

   /**
    * Render pagination controls
    */
   renderPagination()
   {
      const paginationContainer = Utils.requireChild(this.container, '#news-pagination-container');

      // Don't show pagination if lazy loading is enabled and we're not at the last page
      // Instead, show page info and manual navigation
      if (this.totalPages <= 1 && this.events.length === 0)
      {
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
      paginationContainer.querySelectorAll('.btn-pagination').forEach(btn =>
      {
         btn.addEventListener('click', () =>
         {
            const page = parseInt(btn.getAttribute('data-page'));
            this.loadEvents(page, false); // Don't append, replace
         });
      });
   }

   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   dispose()
   {
      // Abort any pending requests
      if (this.abortControl)
         this.abortControl.abort();

      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.events = [];
      this.abortControl = null;
   }
}
