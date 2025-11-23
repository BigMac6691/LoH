/**
 * UserManagerView - User Manager component (admin/owner only)
 * Displays list of users with pagination and lazy loading, allows editing user fields
 */
import { MenuView } from './MenuView.js';

export class UserManagerView extends MenuView {
  constructor(homePage) {
    super(homePage);
    this.container = null;
    this.users = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.loading = false;
    this.limit = 20; // Users per page
    this.selectedUser = null;
  }

  /**
   * Create and return the user manager view container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'user-manager-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>User Manager</h2>
      </div>
      <div class="view-content">
        <div class="user-manager-container">
          <div class="users-list-panel">
            <div class="panel-header">
              <h3>Users</h3>
            </div>
            <div class="users-table-container">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Email Verified</th>
                    <th>Created</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody id="users-table-body">
                  <tr><td colspan="7" class="users-loading">Loading users...</td></tr>
                </tbody>
              </table>
            </div>
            <div class="pagination-container" id="users-pagination-container"></div>
          </div>
          
          <div class="user-editor-panel">
            <div class="panel-header">
              <h3 id="editor-title">Select a user to edit</h3>
            </div>
            <div class="editor-content" id="user-editor-content">
              <p class="editor-placeholder">Select a user from the list to view or edit their information.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.setupIntersectionObserver();
    this.loadUsers(this.currentPage);
    
    return this.container;
  }

  /**
   * Setup intersection observer for lazy loading
   */
  setupIntersectionObserver() {
    const paginationContainer = this.container?.querySelector('#users-pagination-container');
    if (!paginationContainer) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loading && this.currentPage < this.totalPages) {
          this.loadNextPage();
        }
      });
    }, options);

    observer.observe(paginationContainer);
  }

  /**
   * Load users from API
   */
  async loadUsers(page = 1, append = false) {
    if (this.loading) return;

    const tableBody = this.container?.querySelector('#users-table-body');
    if (!tableBody) return;

    try {
      this.loading = true;

      if (!append) {
        tableBody.innerHTML = '<tr><td colspan="7" class="users-loading">Loading users...</td></tr>';
        this.users = [];
      }

      const response = await fetch(`/api/admin/users?page=${page}&limit=${this.limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load users');
      }

      // Append new users or replace
      if (append) {
        this.users = [...this.users, ...(data.users || [])];
      } else {
        this.users = data.users || [];
      }

      this.currentPage = data.pagination?.page || page;
      this.totalPages = data.pagination?.totalPages || 1;

      this.renderUsersTable();
      this.renderPagination();

    } catch (error) {
      console.error('Error loading users:', error);
      this.showError(error.message || 'Failed to load users');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load next page (lazy loading)
   */
  async loadNextPage() {
    if (this.currentPage < this.totalPages) {
      await this.loadUsers(this.currentPage + 1, true);
    }
  }

  /**
   * Render users table
   */
  renderUsersTable() {
    const tableBody = this.container?.querySelector('#users-table-body');
    if (!tableBody) return;

    if (this.users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="users-empty">No users found.</td></tr>';
      return;
    }

    const rowsHtml = this.users.map(user => {
      const createdDate = new Date(user.created_at).toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }) + ' UTC';

      const updatedDate = new Date(user.updated_at).toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }) + ' UTC';

      const isSelected = this.selectedUser?.id === user.id ? 'selected' : '';

      return `
        <tr class="user-row ${isSelected}" data-user-id="${user.id}">
          <td>${this.escapeHtml(user.email)}</td>
          <td>${this.escapeHtml(user.display_name)}</td>
          <td><span class="role-badge role-${user.role}">${this.escapeHtml(user.role)}</span></td>
          <td><span class="status-badge status-${user.status}">${this.escapeHtml(user.status)}</span></td>
          <td>${user.email_verified ? '✓' : '✗'}</td>
          <td class="date-cell">${this.escapeHtml(createdDate)}</td>
          <td class="date-cell">${this.escapeHtml(updatedDate)}</td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rowsHtml;

    // Add click handlers
    tableBody.querySelectorAll('.user-row').forEach(row => {
      row.addEventListener('click', () => {
        const userId = row.getAttribute('data-user-id');
        this.selectUser(userId);
      });
    });

    // Add loading indicator if there are more pages
    if (this.currentPage < this.totalPages) {
      const loadingRow = document.createElement('tr');
      loadingRow.className = 'users-loading-more';
      loadingRow.innerHTML = '<td colspan="7" class="loading-more-cell">Loading more users...</td>';
      tableBody.appendChild(loadingRow);
    }
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const paginationContainer = this.container?.querySelector('#users-pagination-container');
    if (!paginationContainer) return;

    if (this.totalPages <= 1 && this.users.length === 0) {
      paginationContainer.innerHTML = '';
      return;
    }

    const hasNext = this.currentPage < this.totalPages;
    const hasPrev = this.currentPage > 1;

    paginationContainer.innerHTML = `
      <div class="users-pagination">
        ${hasPrev ? `
          <button class="btn-pagination btn-prev" data-page="${this.currentPage - 1}">
            ← Previous
          </button>
        ` : '<div></div>'}
        
        <span class="pagination-info">
          Page ${this.currentPage} of ${this.totalPages} 
          ${this.users.length > 0 ? `(${this.users.length} user${this.users.length === 1 ? '' : 's'} loaded)` : ''}
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
        this.loadUsers(page, false);
      });
    });
  }

  /**
   * Select a user to edit
   */
  async selectUser(userId) {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load user');
      }

      this.selectedUser = data.user;
      
      // Update selected state in table
      this.renderUsersTable();
      
      // Show editor
      this.showEditor();
    } catch (error) {
      console.error('Error loading user:', error);
      this.displayStatusMessage(`Failed to load user: ${error.message}`, 'error');
    }
  }

  /**
   * Show editor panel
   */
  showEditor() {
    const editorTitle = this.container?.querySelector('#editor-title');
    const editorContent = this.container?.querySelector('#user-editor-content');
    
    if (!editorTitle || !editorContent || !this.selectedUser) return;

    const user = this.selectedUser;
    const createdDate = new Date(user.created_at).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';

    const updatedDate = new Date(user.updated_at).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';

    editorTitle.textContent = `Edit User: ${this.escapeHtml(user.email)}`;
    editorContent.innerHTML = `
      <div class="user-editor-form">
        <div class="form-group">
          <label>User ID:</label>
          <div class="readonly-field">${this.escapeHtml(user.id)}</div>
        </div>
        
        <div class="form-group">
          <label for="user-email">Email:</label>
          <input type="email" id="user-email" class="form-input" value="${this.escapeHtml(user.email)}" />
        </div>
        
        <div class="form-group">
          <label for="user-display-name">Display Name:</label>
          <input type="text" id="user-display-name" class="form-input" value="${this.escapeHtml(user.display_name)}" />
        </div>
        
        <div class="form-group">
          <label for="user-role">Role:</label>
          <select id="user-role" class="form-select">
            <option value="player" ${user.role === 'player' ? 'selected' : ''}>Player</option>
            <option value="sponsor" ${user.role === 'sponsor' ? 'selected' : ''}>Sponsor</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="user-status">Status:</label>
          <select id="user-status" class="form-select">
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspended</option>
            <option value="deleted" ${user.status === 'deleted' ? 'selected' : ''}>Deleted</option>
          </select>
        </div>
        
        <div class="form-group checkbox-group">
          <input type="checkbox" id="user-email-verified" ${user.email_verified ? 'checked' : ''} />
          <label for="user-email-verified">Email Verified</label>
        </div>
        
        <div class="form-group">
          <label>Created:</label>
          <div class="readonly-field">${this.escapeHtml(createdDate)}</div>
        </div>
        
        <div class="form-group">
          <label>Last Updated:</label>
          <div class="readonly-field">${this.escapeHtml(updatedDate)}</div>
        </div>
        
        <div class="editor-actions">
          <button class="btn-save" id="btn-save-user">Save Changes</button>
          <button class="btn-reset-password" id="btn-reset-password">Reset Password</button>
        </div>
      </div>
    `;

    // Add event listeners
    const saveBtn = editorContent.querySelector('#btn-save-user');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveUser());
    }

    const resetBtn = editorContent.querySelector('#btn-reset-password');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetPassword());
    }
  }

  /**
   * Save user changes
   */
  async saveUser() {
    if (!this.selectedUser) return;

    const email = this.container?.querySelector('#user-email')?.value.trim();
    const displayName = this.container?.querySelector('#user-display-name')?.value.trim();
    const role = this.container?.querySelector('#user-role')?.value;
    const status = this.container?.querySelector('#user-status')?.value;
    const emailVerified = this.container?.querySelector('#user-email-verified')?.checked;

    // Validate
    if (!email || !displayName) {
      this.displayStatusMessage('Email and Display Name are required', 'warning');
      return;
    }

    try {
      const saveBtn = this.container?.querySelector('#btn-save-user');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      const response = await fetch(`/api/admin/users/${this.selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify({
          email,
          display_name: displayName,
          role,
          status,
          email_verified: emailVerified
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save user');
      }

      // Update selected user
      this.selectedUser = data.user;
      
      // Reload users list to reflect changes
      await this.loadUsers(this.currentPage, false);
      
      // Re-select the user
      this.selectUser(this.selectedUser.id);

      this.displayStatusMessage('User updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving user:', error);
      this.displayStatusMessage(`Failed to save user: ${error.message}`, 'error');
      
      const saveBtn = this.container?.querySelector('#btn-save-user');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  }

  /**
   * Reset user password
   */
  async resetPassword() {
    if (!this.selectedUser) return;

    if (!confirm(`Reset password for ${this.selectedUser.email}?\n\nA password recovery token will be generated and logged to the console (in development mode).`)) {
      return;
    }

    try {
      const resetBtn = this.container?.querySelector('#btn-reset-password');
      if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.textContent = 'Resetting...';
      }

      const response = await fetch(`/api/admin/users/${this.selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      let message = 'Password reset token generated successfully!\n\n';
      if (data.recoveryToken) {
        message += `Recovery Token: ${data.recoveryToken}\n`;
        message += `Expires: ${new Date(data.expiresAt).toLocaleString()}\n\n`;
        message += 'This token has been logged to the console.';
        console.log(`Password reset token for ${this.selectedUser.email}:`, data.recoveryToken);
      } else {
        message += 'A recovery email has been sent to the user.';
      }

      this.displayStatusMessage(message.replace(/\n/g, ' '), 'success');
    } catch (error) {
      console.error('Error resetting password:', error);
      this.displayStatusMessage(`Failed to reset password: ${error.message}`, 'error');
    } finally {
      const resetBtn = this.container?.querySelector('#btn-reset-password');
      if (resetBtn) {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Reset Password';
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const tableBody = this.container?.querySelector('#users-table-body');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="users-error">Error: ${this.escapeHtml(message)}</td></tr>`;
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
    this.users = [];
    this.selectedUser = null;
  }
}
