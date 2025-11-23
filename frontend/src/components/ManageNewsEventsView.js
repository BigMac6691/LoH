/**
 * ManageNewsEventsView - Manage News and Events component (admin/owner only)
 */
import { MenuView } from './MenuView.js';
import { RB } from '../utils/RequestBuilder.js';

export class ManageNewsEventsView extends MenuView {
  constructor(statusComponent) {
    super(statusComponent);
    this.container = null;
    this.events = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.selectedEvent = null;
    this.isCreating = false;
  }

  /**
   * Create and return the manage news and events view container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'manage-news-events-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Manage News and Events</h2>
      </div>
      <div class="view-content">
        <div class="news-events-manager">
          <div class="events-list-panel">
            <div class="panel-header">
              <h3>System Events</h3>
              <button class="btn-create" id="btn-create-event">+ Create New</button>
            </div>
            <div class="events-list-container" id="events-list-container">
              <div class="events-loading">Loading events...</div>
            </div>
            <div class="pagination-container" id="pagination-container"></div>
          </div>
          
          <div class="event-editor-panel">
            <div class="panel-header">
              <h3 id="editor-title">Select an event to edit</h3>
            </div>
            <div class="editor-content" id="editor-content">
              <p class="editor-placeholder">Select an event from the list to view or edit it.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
    this.loadEvents();
    
    return this.container;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Create button
    const createBtn = this.container.querySelector('#btn-create-event');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateForm());
    }
  }

  /**
   * Load events from API
   */
  async loadEvents(page = 1) {
    const listContainer = this.container?.querySelector('#events-list-container');
    if (!listContainer) return;

    try {
      listContainer.innerHTML = '<div class="events-loading">Loading events...</div>';

      const data = await RB.fetchGet(`/api/system-events?page=${page}&limit=5`);

      this.events = data.events || [];
      this.currentPage = data.pagination?.page || 1;
      this.totalPages = data.pagination?.totalPages || 1;

      this.renderEventsList();
      this.renderPagination();
    } catch (error) {
      console.error('Error loading events:', error);
      this.showError(error.message || 'Failed to load events');
    }
  }

  /**
   * Render events list
   */
  renderEventsList() {
    const listContainer = this.container?.querySelector('#events-list-container');
    if (!listContainer) return;

    if (this.events.length === 0) {
      listContainer.innerHTML = '<div class="events-empty">No events found. Click "Create New" to add one.</div>';
      return;
    }

    const listHtml = this.events.map(event => {
      const textPreview = this.getTextPreview(event.text, 50);
      const createdDate = new Date(event.created_at).toLocaleString();
      
      return `
        <div class="event-item ${this.selectedEvent?.id === event.id ? 'selected' : ''}" 
             data-event-id="${event.id}">
          <div class="event-item-preview">
            <div class="event-text-preview">${this.escapeHtml(textPreview)}</div>
            <div class="event-meta">
              <span class="event-date">${this.escapeHtml(createdDate)}</span>
              ${event.creator_name ? `<span class="event-creator">by ${this.escapeHtml(event.creator_name)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = listHtml;

    // Add click handlers
    listContainer.querySelectorAll('.event-item').forEach(item => {
      item.addEventListener('click', () => {
        const eventId = item.getAttribute('data-event-id');
        this.selectEvent(eventId);
      });
    });
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const paginationContainer = this.container?.querySelector('#pagination-container');
    if (!paginationContainer) return;

    if (this.totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    const prevDisabled = this.currentPage === 1 ? 'disabled' : '';
    const nextDisabled = this.currentPage === this.totalPages ? 'disabled' : '';

    paginationContainer.innerHTML = `
      <div class="pagination">
        <button class="btn-pagination btn-prev" ${prevDisabled} data-page="${this.currentPage - 1}">
          ← Previous
        </button>
        <span class="pagination-info">
          Page ${this.currentPage} of ${this.totalPages}
        </span>
        <button class="btn-pagination btn-next" ${nextDisabled} data-page="${this.currentPage + 1}">
          Next →
        </button>
      </div>
    `;

    // Add click handlers
    paginationContainer.querySelectorAll('.btn-pagination').forEach(btn => {
      if (!btn.disabled) {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'));
          this.loadEvents(page);
        });
      }
    });
  }

  /**
   * Select an event to edit
   */
  async selectEvent(eventId) {
    try {
      const data = await RB.fetchGet(`/api/system-events/${eventId}`);

      this.selectedEvent = data.event;
      this.isCreating = false;
      
      // Update selected state in list
      this.renderEventsList();
      
      // Show editor
      this.showEditor();
    } catch (error) {
      console.error('Error loading event:', error);
      this.displayStatusMessage(`Failed to load event: ${error.message}`, 'error');
    }
  }

  /**
   * Show create form
   */
  showCreateForm() {
    this.selectedEvent = null;
    this.isCreating = true;
    
    // Clear selection in list
    const listContainer = this.container?.querySelector('#events-list-container');
    if (listContainer) {
      listContainer.querySelectorAll('.event-item').forEach(item => {
        item.classList.remove('selected');
      });
    }
    
    // Show editor with create form
    this.showEditor(true);
  }

  /**
   * Show editor panel
   */
  showEditor(isCreating = false) {
    const editorTitle = this.container?.querySelector('#editor-title');
    const editorContent = this.container?.querySelector('#editor-content');
    
    if (!editorTitle || !editorContent) return;

    if (isCreating) {
      editorTitle.textContent = 'Create New Event';
      editorContent.innerHTML = `
        <div class="editor-form">
          <div class="form-group">
            <label for="event-text-create">Event Text <span class="char-count">(<span id="char-count-create">0</span>/1024)</span></label>
            <textarea 
              id="event-text-create" 
              class="event-text-input" 
              rows="10" 
              maxlength="1024"
              placeholder="Enter event text (max 1024 characters)..."></textarea>
          </div>
          <div class="editor-actions">
            <button class="btn-save" id="btn-save-create">Save</button>
            <button class="btn-cancel" id="btn-cancel-create">Cancel</button>
          </div>
        </div>
      `;

      // Character count
      const textarea = editorContent.querySelector('#event-text-create');
      const charCount = editorContent.querySelector('#char-count-create');
      if (textarea && charCount) {
        textarea.addEventListener('input', () => {
          charCount.textContent = textarea.value.length;
        });
      }

      // Save button
      const saveBtn = editorContent.querySelector('#btn-save-create');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveEvent(true));
      }

      // Cancel button
      const cancelBtn = editorContent.querySelector('#btn-cancel-create');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancelEdit());
      }
    } else if (this.selectedEvent) {
      const createdDate = new Date(this.selectedEvent.created_at).toLocaleString();
      editorTitle.textContent = 'Edit Event';
      editorContent.innerHTML = `
        <div class="editor-form">
          <div class="form-group">
            <label>Created: <span class="event-meta-display">${this.escapeHtml(createdDate)}</span></label>
          </div>
          ${this.selectedEvent.creator_name ? `
            <div class="form-group">
              <label>Creator: <span class="event-meta-display">${this.escapeHtml(this.selectedEvent.creator_name)}</span></label>
            </div>
          ` : ''}
          <div class="form-group">
            <label for="event-text-edit">Event Text <span class="char-count">(<span id="char-count-edit">${this.selectedEvent.text.length}</span>/1024)</span></label>
            <textarea 
              id="event-text-edit" 
              class="event-text-input" 
              rows="10" 
              maxlength="1024"
              placeholder="Enter event text (max 1024 characters)...">${this.escapeHtml(this.selectedEvent.text)}</textarea>
          </div>
          <div class="editor-actions">
            <button class="btn-save" id="btn-save-edit">Save</button>
            <button class="btn-delete" id="btn-delete-edit">Delete</button>
            <button class="btn-cancel" id="btn-cancel-edit">Cancel</button>
          </div>
        </div>
      `;

      // Character count
      const textarea = editorContent.querySelector('#event-text-edit');
      const charCount = editorContent.querySelector('#char-count-edit');
      if (textarea && charCount) {
        textarea.addEventListener('input', () => {
          charCount.textContent = textarea.value.length;
        });
      }

      // Save button
      const saveBtn = editorContent.querySelector('#btn-save-edit');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveEvent(false));
      }

      // Delete button
      const deleteBtn = editorContent.querySelector('#btn-delete-edit');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteEvent());
      }

      // Cancel button
      const cancelBtn = editorContent.querySelector('#btn-cancel-edit');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancelEdit());
      }
    } else {
      editorTitle.textContent = 'Select an event to edit';
      editorContent.innerHTML = '<p class="editor-placeholder">Select an event from the list to view or edit it.</p>';
    }
  }

  /**
   * Save event (create or update)
   */
  async saveEvent(isCreating) {
    const textareaId = isCreating ? '#event-text-create' : '#event-text-edit';
    const textarea = this.container?.querySelector(textareaId);
    
    if (!textarea) return;

    const text = textarea.value.trim();

    if (!text) {
      this.displayStatusMessage('Event text cannot be empty', 'warning');
      return;
    }

    if (text.length > 1024) {
      this.displayStatusMessage('Event text cannot exceed 1024 characters', 'warning');
      return;
    }

    try {
      const url = isCreating 
        ? '/api/system-events'
        : `/api/system-events/${this.selectedEvent.id}`;
      
      const method = isCreating ? 'POST' : 'PUT';

      const saveBtn = this.container?.querySelector(isCreating ? '#btn-save-create' : '#btn-save-edit');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      const data = method === 'POST' 
        ? await RB.fetchPost(url, { text })
        : await RB.fetchPut(url, { text });

      // Reload events list
      await this.loadEvents(this.currentPage);

      // Select the saved event if it's new
      if (isCreating && data.event) {
        this.selectEvent(data.event.id);
      }

      this.displayStatusMessage('Event saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving event:', error);
      this.displayStatusMessage(`Failed to save event: ${error.message}`, 'error');
      
      const saveBtn = this.container?.querySelector(isCreating ? '#btn-save-create' : '#btn-save-edit');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  }

  /**
   * Delete event
   */
  async deleteEvent() {
    if (!this.selectedEvent) return;

    if (!confirm(`Are you sure you want to delete this event?\n\n"${this.getTextPreview(this.selectedEvent.text, 100)}"`)) {
      return;
    }

    try {
      const deleteBtn = this.container?.querySelector('#btn-delete-edit');
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
      }

      const data = await RB.fetchDelete(`/api/system-events/${this.selectedEvent.id}`);

      // Clear selection and reload
      this.selectedEvent = null;
      this.isCreating = false;
      await this.loadEvents(this.currentPage);
      
      // Clear editor
      const editorTitle = this.container?.querySelector('#editor-title');
      const editorContent = this.container?.querySelector('#editor-content');
      if (editorTitle) editorTitle.textContent = 'Select an event to edit';
      if (editorContent) {
        editorContent.innerHTML = '<p class="editor-placeholder">Select an event from the list to view or edit it.</p>';
      }

      this.displayStatusMessage('Event deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting event:', error);
      this.displayStatusMessage(`Failed to delete event: ${error.message}`, 'error');
      
      const deleteBtn = this.container?.querySelector('#btn-delete-edit');
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
      }
    }
  }

  /**
   * Cancel edit
   */
  cancelEdit() {
    this.isCreating = false;
    if (this.selectedEvent) {
      this.showEditor();
    } else {
      const editorTitle = this.container?.querySelector('#editor-title');
      const editorContent = this.container?.querySelector('#editor-content');
      if (editorTitle) editorTitle.textContent = 'Select an event to edit';
      if (editorContent) {
        editorContent.innerHTML = '<p class="editor-placeholder">Select an event from the list to view or edit it.</p>';
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const listContainer = this.container?.querySelector('#events-list-container');
    if (listContainer) {
      listContainer.innerHTML = `<div class="events-error">Error: ${this.escapeHtml(message)}</div>`;
    }
  }

  /**
   * Get text preview (first N characters)
   */
  getTextPreview(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
    this.selectedEvent = null;
  }
}
