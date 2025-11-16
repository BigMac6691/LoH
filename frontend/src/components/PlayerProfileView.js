/**
 * PlayerProfileView - Player Profile placeholder component
 */
export class PlayerProfileView {
  constructor() {
    this.container = null;
  }

  /**
   * Create and return the player profile view container
   */
  create() {
    const userId = localStorage.getItem('user_id');
    const userEmail = localStorage.getItem('user_email');
    const userDisplayName = localStorage.getItem('user_display_name');
    const userRole = localStorage.getItem('user_role');

    this.container = document.createElement('div');
    this.container.className = 'player-profile-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Player Profile</h2>
      </div>
      <div class="view-content">
        <div class="profile-info">
          <div class="profile-section">
            <h3>Account Information</h3>
            <div class="profile-row">
              <span class="profile-label">Email:</span>
              <span class="profile-value">${this.escapeHtml(userEmail || 'N/A')}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Display Name:</span>
              <span class="profile-value">${this.escapeHtml(userDisplayName || 'N/A')}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Role:</span>
              <span class="profile-value role-badge role-${userRole || 'player'}">${this.escapeHtml(userRole || 'player')}</span>
            </div>
          </div>
          <div class="profile-section">
            <p class="placeholder-text">Profile management features coming soon.</p>
            <p class="placeholder-text">You will be able to change your email, update your display name, and manage other account settings here.</p>
          </div>
        </div>
      </div>
    `;
    return this.container;
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
}

