/**
 * PlayerProfileView - Player Profile component with edit functionality
 */
import { MenuView } from './MenuView.js';
import { getHeaders, getHeadersForGet } from '../utils/apiHeaders.js';

export class PlayerProfileView extends MenuView {
  constructor(homePage) {
    super(homePage);
    this.container = null;
    this.profileData = null;
    this.isEditing = false;
  }

  /**
   * Create and return the player profile view container
   */
  async create() {
    this.container = document.createElement('div');
    this.container.className = 'player-profile-view';
    
    // Load profile data
    await this.loadProfile();
    
    this.render();
    return this.container;
  }

  /**
   * Load profile data from API
   */
  async loadProfile() {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: getHeadersForGet()
      });

      const data = await response.json();
      if (data.success) {
        this.profileData = data.user;
        // Update localStorage with latest data
        if (data.user.email) localStorage.setItem('user_email', data.user.email);
        if (data.user.displayName) localStorage.setItem('user_display_name', data.user.displayName);
      } else {
        console.error('Failed to load profile:', data.error);
        this.profileData = null;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.profileData = null;
    }
  }

  /**
   * Render the profile view
   */
  render() {
    if (!this.profileData) {
      this.container.innerHTML = `
        <div class="view-header">
          <h2>Player Profile</h2>
        </div>
        <div class="view-content">
          <p class="error-message">Failed to load profile data.</p>
        </div>
      `;
      return;
    }

    if (this.isEditing) {
      this.renderEditForm();
    } else {
      this.renderView();
    }
  }

  /**
   * Render view mode
   */
  renderView() {
    const user = this.profileData;
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Player Profile</h2>
        <button class="edit-profile-btn" style="
          padding: 8px 16px;
          background: #00ff88;
          color: black;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        ">Edit Profile</button>
      </div>
      <div class="view-content">
        <div class="profile-info">
          <div class="profile-section">
            <h3>Account Information</h3>
            <div class="profile-row">
              <span class="profile-label">Email:</span>
              <span class="profile-value" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                ${this.escapeHtml(user.email || 'N/A')}
                ${user.emailVerified ? '<span class="email-verified-badge" style="color: #00ff88;">✓ Verified</span>' : '<span class="email-unverified-badge" style="color: #ff4444;">✗ Unverified</span>'}
                ${!user.emailVerified ? `
                  <button class="verify-email-btn" style="padding: 4px 12px; background: rgba(0, 255, 136, 0.2); color: #00ff88; border: 1px solid #00ff88; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;">Verify Email</button>
                  <button class="resend-verification-btn" style="padding: 4px 12px; background: rgba(0, 150, 255, 0.2); color: #0096ff; border: 1px solid #0096ff; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;">Resend Token</button>
                ` : ''}
              </span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Display Name:</span>
              <span class="profile-value">${this.escapeHtml(user.displayName || 'N/A')}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Role:</span>
              <span class="profile-value role-badge role-${user.role || 'player'}">${this.escapeHtml(user.role || 'player')}</span>
            </div>
          </div>
          <div class="profile-section">
            <h3>Profile Information</h3>
            <div class="profile-row">
              <span class="profile-label">Bio/Message:</span>
              <span class="profile-value">${user.bio ? this.escapeHtml(user.bio) : '<em style="color: #888;">No bio set</em>'}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Text Message Contact:</span>
              <span class="profile-value">${user.textMessageContact ? this.formatPhoneNumber(user.textMessageContact) : '<em style="color: #888;">Not provided</em>'}</span>
            </div>
          </div>
          <div class="profile-section">
            <h3>Password</h3>
            <button class="change-password-btn" style="
              padding: 8px 16px;
              background: rgba(0, 255, 136, 0.2);
              color: #00ff88;
              border: 1px solid #00ff88;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
            ">Change Password</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.container.querySelector('.edit-profile-btn')?.addEventListener('click', () => {
      this.isEditing = true;
      this.render();
    });

    this.container.querySelector('.change-password-btn')?.addEventListener('click', () => {
      this.showChangePasswordDialog();
    });

    this.container.querySelector('.resend-verification-btn')?.addEventListener('click', () => {
      this.handleResendVerification();
    });

    this.container.querySelector('.verify-email-btn')?.addEventListener('click', () => {
      this.showVerifyEmailDialog();
    });
  }

  /**
   * Render edit form
   */
  renderEditForm() {
    const user = this.profileData;
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Edit Profile</h2>
        <button class="cancel-edit-btn" style="
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid #00ff88;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          margin-right: 10px;
        ">Cancel</button>
        <button class="save-profile-btn" style="
          padding: 8px 16px;
          background: #00ff88;
          color: black;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        ">Save Changes</button>
      </div>
      <div class="view-content">
        <form class="profile-edit-form" id="profile-edit-form">
          <div class="form-group">
            <label for="email-input">Email:</label>
            <input type="email" id="email-input" class="profile-input" value="${this.escapeHtml(user.email || '')}" required />
            <small class="form-hint">If changed, you will need to verify your new email address.</small>
          </div>
          <div class="form-group">
            <label for="display-name-input">Display Name:</label>
            <input type="text" id="display-name-input" class="profile-input" value="${this.escapeHtml(user.displayName || '')}" required />
          </div>
          <div class="form-group">
            <label for="bio-input">Bio/Message:</label>
            <textarea id="bio-input" class="profile-textarea" rows="5" placeholder="Tell us about yourself...">${this.escapeHtml(user.bio || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="text-message-contact-input">Text Message Contact (Phone Number):</label>
            <input type="tel" id="text-message-contact-input" class="profile-input" placeholder="1234567890" maxlength="10" pattern="[0-9]{10}" value="${user.textMessageContact ? this.escapeHtml(user.textMessageContact) : ''}" />
            <small class="form-hint">Enter a 10-digit phone number (digits only, no dashes or spaces)</small>
          </div>
          <div id="profile-error" class="error-message" style="display: none; color: #ff4444; margin-top: 15px;"></div>
          <div id="profile-success" class="success-message" style="display: none; color: #00ff88; margin-top: 15px;"></div>
        </form>
      </div>
    `;

    // Add event listeners
    this.container.querySelector('.cancel-edit-btn')?.addEventListener('click', () => {
      this.isEditing = false;
      this.render();
    });

    this.container.querySelector('.save-profile-btn')?.addEventListener('click', () => {
      this.saveProfile();
    });

    // Phone number input validation (digits only, max 10)
    const textMessageContactInput = this.container.querySelector('#text-message-contact-input');
    if (textMessageContactInput) {
      textMessageContactInput.addEventListener('input', (e) => {
        // Remove any non-digit characters
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      });
    }
  }

  /**
   * Save profile changes
   */
  async saveProfile() {
    const emailInput = this.container.querySelector('#email-input');
    const displayNameInput = this.container.querySelector('#display-name-input');
    const bioInput = this.container.querySelector('#bio-input');
    const textMessageContactInput = this.container.querySelector('#text-message-contact-input');
    const errorDiv = this.container.querySelector('#profile-error');
    const successDiv = this.container.querySelector('#profile-success');

    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    const email = emailInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const bio = bioInput.value.trim();
    const textMessageContact = textMessageContactInput.value.trim().replace(/\D/g, ''); // Remove non-digits

    // Validate
    if (!email || !displayName) {
      errorDiv.textContent = 'Email and display name are required.';
      errorDiv.style.display = 'block';
      return;
    }

    // Validate phone number if provided
    if (textMessageContact && textMessageContact.length !== 10) {
      errorDiv.textContent = 'Phone number must be exactly 10 digits.';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          email,
          displayName,
          bio,
          textMessageContact
        })
      });

      const data = await response.json();

      if (data.success) {
        this.profileData = data.user;
        successDiv.textContent = data.message || 'Profile updated successfully!';
        successDiv.style.display = 'block';
        
        // Update localStorage
        localStorage.setItem('user_email', data.user.email);
        localStorage.setItem('user_display_name', data.user.displayName);
        
        // Update header display name if it exists
        const headerDisplayName = document.querySelector('.header-center .player-name');
        if (headerDisplayName) {
          headerDisplayName.textContent = data.user.displayName;
        }

        // Switch back to view mode after a delay
        setTimeout(() => {
          this.isEditing = false;
          this.render();
        }, 2000);
      } else {
        errorDiv.textContent = data.message || 'Failed to update profile.';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      errorDiv.textContent = 'An error occurred while saving profile.';
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Show change password dialog
   */
  showChangePasswordDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'change-password-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff88;
      border-radius: 15px;
      padding: 30px;
      color: white;
      z-index: 10002;
      min-width: 400px;
      max-width: 500px;
      backdrop-filter: blur(10px);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #00ff88; text-align: center;">Change Password</h2>
      <form id="change-password-form">
        <div class="form-group" style="margin-bottom: 15px;">
          <label for="old-password" style="display: block; margin-bottom: 5px; color: #00ff88;">Old Password:</label>
          <input type="password" id="old-password" class="profile-input" required style="
            width: 100%;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            box-sizing: border-box;
          " />
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label for="new-password" style="display: block; margin-bottom: 5px; color: #00ff88;">New Password:</label>
          <input type="password" id="new-password" class="profile-input" required style="
            width: 100%;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            box-sizing: border-box;
          " />
          <small style="color: #888; font-size: 12px; display: block; margin-top: 5px;">Must be at least 8 characters with uppercase, lowercase, number, and symbol</small>
        </div>
        <div class="form-group" style="margin-bottom: 20px;">
          <label for="confirm-password" style="display: block; margin-bottom: 5px; color: #00ff88;">Confirm New Password:</label>
          <input type="password" id="confirm-password" class="profile-input" required style="
            width: 100%;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            box-sizing: border-box;
          " />
        </div>
        <div id="password-error" class="error-message" style="display: none; color: #ff4444; margin-bottom: 15px;"></div>
        <div id="password-success" class="success-message" style="display: none; color: #00ff88; margin-bottom: 15px;"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="cancel-password-btn" style="
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid #00ff88;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
          ">Cancel</button>
          <button type="submit" class="save-password-btn" style="
            padding: 10px 20px;
            background: #00ff88;
            color: black;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
          ">Change Password</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);

    const form = dialog.querySelector('#change-password-form');
    const errorDiv = dialog.querySelector('#password-error');
    const successDiv = dialog.querySelector('#password-success');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const oldPassword = dialog.querySelector('#old-password').value;
      const newPassword = dialog.querySelector('#new-password').value;
      const confirmPassword = dialog.querySelector('#confirm-password').value;

      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'New password and confirmation do not match.';
        errorDiv.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            oldPassword,
            newPassword,
            confirmPassword
          })
        });

        const data = await response.json();

        if (data.success) {
          successDiv.textContent = data.message || 'Password changed successfully!';
          successDiv.style.display = 'block';
          
          // Clear form
          form.reset();
          
          // Close dialog after delay
          setTimeout(() => {
            document.body.removeChild(dialog);
          }, 2000);
        } else {
          errorDiv.textContent = data.message || 'Failed to change password.';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        console.error('Error changing password:', error);
        errorDiv.textContent = 'An error occurred while changing password.';
        errorDiv.style.display = 'block';
      }
    });

    dialog.querySelector('.cancel-password-btn')?.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(dialog);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
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
   * Show dialog to enter verification token
   */
  showVerifyEmailDialog() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'verify-email-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(20, 20, 30, 0.95);
      border: 2px solid #00ff88;
      border-radius: 10px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      color: #ffffff;
    `;

    modalContent.innerHTML = `
      <h2 style="color: #00ff88; margin-top: 0; margin-bottom: 20px;">Verify Email Address</h2>
      <p style="margin-bottom: 20px; color: #cccccc;">
        Enter the verification token you received. You can get a new token by clicking "Resend Token".
      </p>
      <div style="margin-bottom: 20px;">
        <label for="verification-token-input" style="display: block; margin-bottom: 8px; color: #00ff88; font-weight: bold;">
          Verification Token:
        </label>
        <input 
          type="text" 
          id="verification-token-input" 
          placeholder="Paste your verification token here"
          style="
            width: 100%;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: #ffffff;
            font-size: 14px;
            box-sizing: border-box;
          "
        />
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="verify-cancel-btn" style="
          padding: 10px 20px;
          background: rgba(255, 68, 68, 0.2);
          color: #ff4444;
          border: 1px solid #ff4444;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        ">Cancel</button>
        <button class="verify-submit-btn" style="
          padding: 10px 20px;
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
          border: 1px solid #00ff88;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        ">Verify Email</button>
      </div>
      <div class="verify-error-message" style="
        margin-top: 15px;
        padding: 10px;
        background: rgba(255, 68, 68, 0.2);
        border: 1px solid #ff4444;
        border-radius: 5px;
        color: #ff4444;
        display: none;
      "></div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Focus on input
    const tokenInput = modalContent.querySelector('#verification-token-input');
    tokenInput.focus();

    // Handle Enter key
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        modalContent.querySelector('.verify-submit-btn').click();
      }
    });

    // Cancel button
    modalContent.querySelector('.verify-cancel-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Submit button
    modalContent.querySelector('.verify-submit-btn').addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        this.showVerifyError(modalContent, 'Please enter a verification token');
        return;
      }

      await this.handleVerifyEmail(token, modal, modalContent);
    });
  }

  /**
   * Handle email verification with token
   */
  async handleVerifyEmail(token, modal, modalContent) {
    const submitBtn = modalContent.querySelector('.verify-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    // Hide any previous error
    this.hideVerifyError(modalContent);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.success) {
        // Success - close modal and reload profile
        document.body.removeChild(modal);
        
        // Update localStorage if role changed
        if (data.roleUpdated && data.newRole) {
          localStorage.setItem('user_role', data.newRole);
        }
        localStorage.setItem('user_email_verified', 'true');

        // Reload profile
        await this.loadProfile();
        this.render();

        // Show success message
        const successMsg = 'Email verified successfully!' + (data.roleUpdated ? ` Your role has been updated to: ${data.newRole}` : '');
        this.displayStatusMessage(successMsg, 'success');

        // Refresh HomePage menu and header to reflect new role/verification status
        // Access homePage from window if available, or use eventBus to notify
        if (window.homePage && typeof window.homePage.refreshSidebar === 'function') {
          window.homePage.refreshSidebar();
          window.homePage.refreshHeader();
        } else {
          // Fallback: reload page to ensure menu updates
          window.location.reload();
        }
      } else {
        this.showVerifyError(modalContent, data.message || 'Verification failed. Please check your token and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      this.showVerifyError(modalContent, 'An error occurred while verifying your email. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Show error message in verify email dialog
   */
  showVerifyError(modalContent, message) {
    const errorDiv = modalContent.querySelector('.verify-error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * Hide error message in verify email dialog
   */
  hideVerifyError(modalContent) {
    const errorDiv = modalContent.querySelector('.verify-error-message');
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  /**
   * Handle resend verification email
   */
  async handleResendVerification() {
    const btn = this.container.querySelector('.resend-verification-btn');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const response = await fetch('/api/auth/profile/resend-verification', {
        method: 'POST',
        headers: getHeaders()
      });

      const data = await response.json();

      if (data.success) {
        const token = data.verificationToken || 'Check server logs';
        const message = `Verification token sent! Token: ${token}. Click "Verify Email" to enter this token and verify your email address.`;
        this.displayStatusMessage(message, 'success');
        // Reload profile to update verification status
        await this.loadProfile();
        this.render();
      } else {
        const errorMsg = 'Failed to send verification token: ' + (data.message || 'Unknown error');
        this.displayStatusMessage(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      this.displayStatusMessage('An error occurred while sending verification token.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  /**
   * Format phone number for display (e.g., (123) 456-7890)
   */
  formatPhoneNumber(phone) {
    if (!phone || phone.length !== 10) return this.escapeHtml(phone || '');
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) return this.escapeHtml(phone);
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
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
