/**
 * PlayerProfileView - Player Profile component with edit functionality
 */
import { MenuView } from './MenuView.js';
import { Dialog } from './Dialog.js';
import { eventBus } from '../eventBus.js';
import { ApiRequest } from '../events/Events.js';
import { Utils } from '../utils/Utils.js';

export class PlayerProfileView extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.dialog = null;
      this.profileData = null;
      this.isEditing = false;

      this._boundFormatPhoneNumber = this.formatPhoneNumber.bind(this);

      // Register event handlers
      this.registerEventHandler('system:profileResponse', this.handleProfileResponse.bind(this));
      this.registerEventHandler('system:updateProfileResponse', this.handleUpdateProfileResponse.bind(this));
      this.registerEventHandler('system:changePasswordResponse', this.handleChangePasswordResponse.bind(this));
      this.registerEventHandler('system:verifyEmailResponse', this.handleVerifyEmailResponse.bind(this));
      this.registerEventHandler('system:resendVerificationResponse', this.handleResendVerificationResponse.bind(this));
   }

   /**
    * Create and return the player profile view container
    */
   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'player-profile-view';
      
      this.loadProfile(); // Load profile data (will trigger render when response arrives)
      this.render(); // Render initial state (will be updated when profile loads)

      return this.container;
   }

   loadProfile()
   {
    setTimeout(() =>
      {
      eventBus.emit('system:profileRequest', new ApiRequest('system:profileRequest'));
      }, 12000);
   }

   /**
    * Handle profile response
    * @param {ApiResponse} event - Profile response event
    */
   handleProfileResponse(event)
   {
      this.profileData = event.data?.user || null;
    
      if (event.isSuccess() && event.data?.success)
      {
         localStorage.setItem('user_email', this.profileData?.email);
         localStorage.setItem('user_display_name', this.profileData?.displayName);

         this.displayStatusMessage('Profile loaded successfully!', 'success');
      }
      else
         this.displayStatusMessage('Failed to load profile: ' + event.error?.message || event.data?.message || 'Unknown error', 'error');

      if (this.container)
         this.render();
      else
         throw new Error('PlayerProfileView: Missing container element');
   }

   render()
   {
      // if (!this.profileData)
      // {
      //    this.container.innerHTML = profileErrorHTML;
      //    return;
      // }

      if (this.isEditing)
         this.renderEditForm();
      else
         this.renderView();
   }

   renderView()
   {
      this.container.innerHTML = getProfileViewHTML(this.profileData, this._boundFormatPhoneNumber);

      // Add event listeners
      Utils.requireChild(this.container, '.change-password-btn').addEventListener('click', () => { this.showChangePasswordDialog(); });
      Utils.requireChild(this.container, '.resend-verification-btn').addEventListener('click', () => { this.handleResendVerification(); });
      Utils.requireChild(this.container, '.verify-email-btn').addEventListener('click', () => { this.showVerifyEmailDialog(); });
      Utils.requireChild(this.container, '.edit-profile-btn').addEventListener('click', () =>
      {
         this.isEditing = true;
         this.render();
      });
   }

   renderEditForm()
   {
      this.container.innerHTML = getProfileEditFormHTML(this.profileData);

      // Add event listeners
      Utils.requireChild(this.container, '.save-profile-btn').addEventListener('click', () => { this.saveProfile(); });
      Utils.requireChild(this.container, '.cancel-edit-btn').addEventListener('click', () =>
      {
         this.isEditing = false;
         this.render();
      });

      // Phone number input validation (digits only, max 10)
      Utils.requireChild(this.container, '#text-message-contact-input')
         .addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });
   }

   saveProfile()
   {
      const email = Utils.requireChild(this.container, '#email-input').value.trim();
      const displayName = Utils.requireChild(this.container, '#display-name-input').value.trim();
      const bio = Utils.requireChild(this.container, '#bio-input').value.trim();
      const textMessageContact = Utils.requireChild(this.container, '#text-message-contact-input').value.trim().replace(/\D/g, ''); // Remove non-digits

      let error = null;
      this.displayStatusMessage('Validating profile...', 'info');

      if (!email)
        error = this.displayStatusMessage('Email is required.', 'error');
      else if (!Utils.validateEmail(email))
        error = this.displayStatusMessage('Please enter a valid email address.', 'error');

      if (!displayName)
        error = this.displayStatusMessage('Display name is required.', 'error');

      if (textMessageContact && textMessageContact.length !== 10) // is optional, but if provided, must be exactly 10 digits
        error = this.displayStatusMessage('Phone number must be exactly 10 digits.', 'error');

      if (error !== null)
        return;

      setTimeout(() =>
        {
      eventBus.emit('system:updateProfileRequest', new ApiRequest('system:updateProfileRequest', {email, displayName, bio, textMessageContact}));
        }, 12000);
   }

   /**
    * Handle update profile response
    * @param {ApiResponse} event - Update profile response event
    */
   handleUpdateProfileResponse(event)
   {
      if (event.isSuccess() && event.data?.success)
      {
         this.profileData = event.data.user;
         this.displayStatusMessage('Profile updated successfully!', 'success');

         localStorage.setItem('user_email', event.data.user.email);
         localStorage.setItem('user_display_name', event.data.user.displayName);

         // Update header display name if it exists
         Utils.requireElement('.header-center .player-name').textContent = event.data.user.displayName;

         // Switch back to view mode after a delay
         setTimeout(() =>
         {
            this.isEditing = false;
            this.render();
         }, 2000);
      }
      else
         this.displayStatusMessage('Failed to update profile: ' + event.error?.message || event.data?.message || 'Unknown error', 'error');
   }

   showChangePasswordDialog()
   {
      if (this.dialog)
         throw new Error('PlayerProfileView: Change password dialog is open');

      this.dialog = new Dialog(
      {
         title: 'Change Password',
         contentHTML: changePasswordDialogHTML,
         className: 'change-password-dialog',
         onClose: () => { this.statusComponent.mount(Utils.requireElement('.home-main-content')); }
      });

      this.statusComponent.mount(Utils.requireChild(this.dialog.getDialog(), '#password-mount-point'));

      Utils.requireChild(this.dialog.getDialog(), '#change-password-form').addEventListener('submit', (e) =>
      {
         e.preventDefault();

         const oldPassword = Utils.requireChild(this.dialog.getDialog(), '#old-password').value;
         const newPassword = Utils.requireChild(this.dialog.getDialog(), '#new-password').value;
         const confirmPassword = Utils.requireChild(this.dialog.getDialog(), '#confirm-password').value;

         const statuses = [];

         statuses.push({valid: true, errors: ['Validating old password...']});
         statuses.push(Utils.validatePassword(oldPassword));
         statuses.push({valid: true, errors: ['Validating new password...']});
         statuses.push(Utils.validatePassword(newPassword));
         statuses.push({valid: true, errors: ['Validating confirm password...']});
         statuses.push(Utils.validatePassword(confirmPassword));   

         if (newPassword !== confirmPassword)
            statuses.push({valid: false, errors: ['Passwords do not match']});

         for(const status of statuses)
            for(const error of status.errors)
               this.displayStatusMessage(error, status.valid ? 'info' : 'error');

         if(statuses.some(status => !status.valid))
            return;

         eventBus.emit('system:changePasswordRequest', new ApiRequest('system:changePasswordRequest', {oldPassword, newPassword, confirmPassword}));
      });

      Utils.requireChild(this.dialog.getDialog(), '.cancel-password-btn').addEventListener('click', () => { this.dialog.close(); });

      this.dialog.show();
   }

   /**
    * Handle change password response
    * @param {ApiResponse} event - Change password response event
    */
   handleChangePasswordResponse(event)
   {
      if (event.isSuccess() && event.data?.success)
      {
         this.dialog.close();
         this.dialog = null;

         this.displayStatusMessage(event.data.message || 'Password changed successfully!', 'success');
         
         Utils.requireChild(this.dialog.getDialog(), '#change-password-form').reset(); // Clear form

         setTimeout(() => { this.dialog.close(); }, 2000);
      }
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to change password.', 'error');
   }

   /**
    * Get the container element, create if not exists
    */
   getContainer()
   {
      return this.container ? this.container : this.create();
   }

   dispose()
   {
      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.profileData = null;
      this.isEditing = false;
      this.dialog = null;
      this._boundFormatPhoneNumber = null;
   }

   showVerifyEmailDialog()
   {
      if (this.dialog)
         throw new Error('PlayerProfileView: Verify email dialog is open');

      this.dialog = new Dialog(
      {
         title: 'Verify Email Address',
         contentHTML: verifyEmailDialogHTML,
         className: 'verify-email-dialog',
         styles: 'background: rgba(20, 20, 30, 0.95);',
         onClose: () => { this.statusComponent.mount(Utils.requireElement('.home-main-content')); }
      });

      this.statusComponent.mount(Utils.requireChild(this.dialog.getDialog(), '#email-mount-point'));

      const tokenInput = Utils.requireChild(this.dialog.getDialog(), '#verification-token-input');
      tokenInput.focus();
      tokenInput.addEventListener('keypress', (e) =>
      {
         if (e.key === 'Enter')
            Utils.requireChild(this.dialog.getDialog(), '.verify-submit-btn').click();
      });

      Utils.requireChild(this.dialog.getDialog(), '.verify-cancel-btn').addEventListener('click', () => { this.dialog.close(); });
      Utils.requireChild(this.dialog.getDialog(), '.verify-submit-btn').addEventListener('click', () =>
      {
         const token = tokenInput.value.trim();
         if (!token)
            return this.displayStatusMessage('Please enter a verification token', 'error');

         eventBus.emit('system:verifyEmailRequest', new ApiRequest('system:verifyEmailRequest', { token }));
      });

      this.dialog.show();
   }

   /**
    * Handle verify email response
    * @param {ApiResponse} event - Verify email response event
    */
   handleVerifyEmailResponse(event)
   {
      if (event.isSuccess() && event.data?.success)
      {
         this.dialog.close();
         this.dialog = null;

         if (event.data.roleUpdated && event.data.newRole) // Update localStorage if role changed
            localStorage.setItem('user_role', event.data.newRole);

         localStorage.setItem('user_email_verified', 'true');

         this.loadProfile(); // Reload profile to get email verified and role updated
         eventBus.emit('system:userUpdated');

         const successMsg = 'Email verified successfully!' + (event.data.roleUpdated ? ` Your role has been updated to: ${event.data.newRole}` : '');
         this.displayStatusMessage(successMsg, 'success');
      }
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Email verification failed. Please check your token and try again.', 'error');
   }

   /**
    * Handle resend verification email
    */
   handleResendVerification()
   {
      const btn = this.container.querySelector('.resend-verification-btn');
      if (!btn) 
        return;

      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';

      // Store button reference for response handler
      this.pendingResendVerification = { btn, originalText };

      eventBus.emit('system:resendVerificationRequest', new ApiRequest('system:resendVerificationRequest'));
   }

   /**
    * Handle resend verification response
    * @param {ApiResponse} event - Resend verification response event
    */
   handleResendVerificationResponse(event)
   {
      const { btn, originalText } = this.pendingResendVerification || {};
      this.pendingResendVerification = null;

      if (!btn)
         return;

      if (event.isSuccess() && event.data?.success)
      {
         const token = event.data.verificationToken || 'Check server logs';
         const message = `Verification token sent! Token: ${token}. Click "Verify Email" to enter this token and verify your email address.`;
         this.displayStatusMessage(message, 'success');
         // Reload profile to update verification status
         this.loadProfile();
      }
      else
      {
         const errorMsg = 'Failed to send verification token: ' + (event.error?.message || event.data?.message || 'Unknown error');
         this.displayStatusMessage(errorMsg, 'error');
      }

      btn.disabled = false;
      btn.textContent = originalText;
   }

   /**
    * Format phone number for display (e.g., (123) 456-7890)
    */
   formatPhoneNumber(phone)
   {
      if (!phone || phone.length !== 10) 
        return Utils.escapeHtml(phone || '');

      const cleaned = phone.replace(/\D/g, '');

      if (cleaned.length !== 10) 
        return Utils.escapeHtml(phone);
      
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
   }
}

// ============================================================================
// HTML Templates
// ============================================================================

const profileErrorHTML = `
<div class="view-header">
  <h2>Player Profile</h2>
</div>
<div class="view-content">
  <p class="error-message">Failed to load profile data.</p>
</div>
`;

const getProfileViewHTML = (user, formatPhoneNumber) => `
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
          ${Utils.escapeHtml(user?.email || 'N/A')}
          ${user?.emailVerified ? '<span id="email-verified-badge" class="email-verified-badge">✓ Verified</span>' : '<span id="email-unverified-badge" class="email-unverified-badge">✗ Unverified</span>'}
          ${!user?.emailVerified ? 
          ` <button class="verify-email-btn" style="padding: 4px 12px; background: rgba(0, 255, 136, 0.2); color: #00ff88; border: 1px solid #00ff88; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;">Verify Email</button>
            <button class="resend-verification-btn" style="padding: 4px 12px; background: rgba(0, 150, 255, 0.2); color: #0096ff; border: 1px solid #0096ff; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;">Resend Token</button>
          ` : ''}
        </span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Display Name:</span>
        <span class="profile-value">${Utils.escapeHtml(user?.displayName || 'N/A')}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Role:</span>
        <span class="profile-value role-badge role-${user?.role || 'visitor'}">${Utils.escapeHtml(user?.role || 'visitor')}</span>
      </div>
    </div>
    <div class="profile-section">
      <h3>Profile Information</h3>
      <div class="profile-row">
        <span class="profile-label">Bio/Message:</span>
        <span class="profile-value">${user?.bio ? Utils.escapeHtml(user?.bio) : '<em style="color: #888;">No bio set</em>'}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Text Message Contact:</span>
        <span class="profile-value">${user?.textMessageContact ? formatPhoneNumber(user?.textMessageContact) : '<em style="color: #888;">Not provided</em>'}</span>
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

const getProfileEditFormHTML = (user) => `
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
      <input type="email" id="email-input" class="profile-input" value="${Utils.escapeHtml(user.email || '')}" required />
      <small class="form-hint">If changed, you will need to verify your new email address.</small>
    </div>
    <div class="form-group">
      <label for="display-name-input">Display Name:</label>
      <input type="text" id="display-name-input" class="profile-input" value="${Utils.escapeHtml(user.displayName || '')}" required />
    </div>
    <div class="form-group">
      <label for="bio-input">Bio/Message:</label>
      <textarea id="bio-input" class="profile-textarea" rows="5" placeholder="Tell us about yourself...">${Utils.escapeHtml(user.bio || '')}</textarea>
    </div>
    <div class="form-group">
      <label for="text-message-contact-input">Text Message Contact (Phone Number):</label>
      <input type="tel" id="text-message-contact-input" class="profile-input" placeholder="1234567890" maxlength="10" pattern="[0-9]{10}" value="${user.textMessageContact ? Utils.escapeHtml(user.textMessageContact) : ''}" />
      <small class="form-hint">Enter a 10-digit phone number (digits only, no dashes or spaces)</small>
    </div>
    <div id="profile-error" class="error-message" style="display: none; color: #ff4444; margin-top: 15px;"></div>
    <div id="profile-success" class="success-message" style="display: none; color: #00ff88; margin-top: 15px;"></div>
  </form>
</div>
`;

const changePasswordDialogHTML = `
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
  <div id="password-mount-point"></div>
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

const verifyEmailDialogHTML = `
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
<div id="email-mount-point"></div>
`;
