/**
 * RecoverScreen - Password recovery screen with forms for password reset
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiEvent, ApiRequest } from './events/Events.js';
import { Utils } from './utils/Utils.js';

export class RecoverScreen extends BaseFormScreen
{
   constructor()
   {
      super('recovery');
      this.registerEventHandler('system:recoverResponse', this.handleRecoverResponse);
      this.registerEventHandler('system:resetPasswordResponse', this.handleResetPasswordResponse);
      this.createRecoverScreen();
   }

   createRecoverScreen()
   {
      const content = this.createBaseScreen();
      const recoverForm = document.createElement('div');
      recoverForm.className = 'splash-login-form';
      recoverForm.innerHTML = recoveryHTML;

      const requestForm = Utils.requireChild(recoverForm, '#recovery-request-form');
      const resetForm = Utils.requireChild(recoverForm, '#recovery-reset-form');
      this.inputControls.add(resetForm);

      const backLink = Utils.requireChild(recoverForm, '#recovery-back-link');
      this.inputControls.add(backLink);
      
      // Add input fields to controls
      this.inputControls.add(Utils.requireChild(recoverForm, '#recovery-request-btn'));
      this.inputControls.add(Utils.requireChild(recoverForm, '#recovery-email'));
      this.inputControls.add(Utils.requireChild(recoverForm, '#recovery-token'));
      this.inputControls.add(Utils.requireChild(recoverForm, '#recovery-new-password'));
      this.inputControls.add(Utils.requireChild(recoverForm, '#recovery-confirm-password'));
      
      requestForm.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleRecoveryRequest();
      });

      resetForm.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handlePasswordReset();
      });

      backLink.addEventListener('click', () =>
      {
         eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'login'}));
      });

      content.appendChild(recoverForm);
   }

   onShow(parameters = {})
   {
      // Reset to step 1
      Utils.requireElement('#recovery-step-1').style.display = 'block';
      Utils.requireElement('#recovery-step-2').style.display = 'none';
      Utils.requireElement('#recovery-success').style.display = 'none';
      Utils.requireElement('#recovery-error').style.display = 'none';

      // Pre-fill email if provided in parameters
      this.prefillInput('#recovery-email', parameters.email);
      this.focusInput('#recovery-email', true);
   }

   onHide()
   {
      // do nothing
      return;
   }

   showSuccess(message)
   {
      const successDiv = Utils.requireElement('#recovery-success');
      successDiv.textContent = message;
      successDiv.style.display = 'block';
   }

   hideSuccess()
   {
      const successDiv = Utils.requireElement('#recovery-success');
      successDiv.style.display = 'none';
   }

   handleRecoveryRequest()
   {
      const email = Utils.requireElement('#recovery-email').value.trim();

      console.log('🔐 RecoverScreen: Handling recovery request for email:', email);

      if (!Utils.validateEmail(email))
      {
         this.showError('#recovery-error', 'Please enter a valid email address.');
         this.hideSuccess();

         return;
      }

      this.updateViewState(true, email);

      eventBus.emit('system:recoverRequest', new ApiRequest('system:recoverRequest', {email}));
   }

   handleRecoverResponse(event)
   {
      // Re-enable all inputs after response
      this.updateViewState(false, event.data?.email);

      if (event.isSuccess())
      {
         Utils.requireElement('#recovery-step-1').style.display = 'none';
         Utils.requireElement('#recovery-step-2').style.display = 'block';

         this.clearError('#recovery-error');
         this.showSuccess(event.data?.message || 'Recovery token sent! Check console/logs for the token.');
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to send recovery token.';

         this.showError('#recovery-error', errorMsg);
         this.hideSuccess();
      }
   }

   handlePasswordReset()
   {
      const token = Utils.requireElement('#recovery-token').value.trim();
      const newPassword = Utils.requireElement('#recovery-new-password').value;
      const confirmPassword = Utils.requireElement('#recovery-confirm-password').value;

      if (!token || !newPassword || !confirmPassword)
      {
         this.showError('#recovery-error', 'Please fill in all fields.');
         this.hideSuccess();

         return;
      }

      if (newPassword !== confirmPassword)
      {
         this.showError('#recovery-error', 'Passwords do not match.');
         this.hideSuccess();

         return;
      }

      const passwordValidation = Utils.validatePassword(newPassword);
      if (!passwordValidation.valid)
      {
         this.showError('#recovery-error', passwordValidation.errors.join('. '));
         this.hideSuccess();

         return;
      }

      this.updateViewState(true, null);

      eventBus.emit('system:resetPasswordRequest', new ApiRequest('system:resetPasswordRequest', { token, newPassword }));
   }

   handleResetPasswordResponse(event)
   {
      // Re-enable all inputs after response
      this.updateViewState(false, null);

      if (event.isSuccess())
      {
         this.showSuccess(event.data?.message || 'Password reset successfully! Redirecting to login...');
         this.clearError('#recovery-error');

         setTimeout(() => { eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'login'})); }, 2000);
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to reset password.';

         this.showError('#recovery-error', errorMsg);
         this.hideSuccess();
      }
   }
}

const recoveryHTML = `
<div class="login-title">Password Recovery 🔓</div>
<div class="login-error" id="recovery-error" style="display: none;"></div>
<div class="login-success" id="recovery-success" style="display: none;"></div>

<div id="recovery-step-1">
  <p style="color: #ccc; margin-bottom: 20px; text-align: center;">
    Enter your email address to receive a recovery token.
  </p>
  <form id="recovery-request-form" class="login-form">
    <div class="form-group">
      <label for="recovery-email" class="form-label">
        <span class="form-icon">📧</span>
        Email Address
      </label>
      <input 
        type="email" 
        id="recovery-email" 
        class="form-input" 
        placeholder="your.email@example.com"
        value=""
        required
      />
    </div>
    <button type="submit" id="recovery-request-btn" class="login-button">
      Request Recovery Token 🔓
    </button>
  </form>
</div>
<div id="recovery-step-2" style="display: none;">
  <p style="color: #00ff88; margin-bottom: 10px; text-align: center; font-weight: bold;">
    ✓ Recovery token sent! Check the console/logs for the token.
  </p>
  <p style="color: #ccc; margin-bottom: 20px; text-align: center; font-size: 12px;">
    Enter the recovery token and your new password below.
  </p>
  <form id="recovery-reset-form" class="login-form">
    <div class="form-group">
      <label for="recovery-token" class="form-label">
        <span class="form-icon">🔑</span>
        Recovery Token
      </label>
      <input 
        type="text" 
        id="recovery-token" 
        class="form-input" 
        placeholder="Enter recovery token from console/logs"
        required
      />
    </div>
    <div class="form-group">
      <label for="recovery-new-password" class="form-label">
        <span class="form-icon">🔒</span>
        New Password
      </label>
      <input 
        type="password" 
        id="recovery-new-password" 
        class="form-input" 
        placeholder="Enter new password (8+ chars, upper, lower, number, symbol)"
        required
      />
    </div>
    <div class="form-group">
      <label for="recovery-confirm-password" class="form-label">
        <span class="form-icon">🔒</span>
        Confirm New Password
      </label>
      <input 
        type="password" 
        id="recovery-confirm-password" 
        class="form-input" 
        placeholder="Confirm new password"
        required
      />
    </div>
    <button type="submit" id="recovery-reset-btn" class="login-button">
      Reset Password 🔓
    </button>
  </form>
</div>
<div class="login-links" style="margin-top: 20px; text-align: center;">
  <button type="button" id="recovery-back-link" class="login-link">← Back to Login</button>
</div>
`;

