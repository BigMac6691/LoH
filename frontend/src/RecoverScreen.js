/**
 * RecoverScreen - Password recovery screen with forms for password reset
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class RecoverScreen extends BaseFormScreen
{
   constructor()
   {
      super('recover-screen');
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

      const requestForm = recoverForm.querySelector('#recovery-request-form');
      const resetForm = recoverForm.querySelector('#recovery-reset-form');
      this.inputControls.add(resetForm);
      const backLink = recoverForm.querySelector('#recovery-back-link');
      this.inputControls.add(backLink);
      
      // Add input fields to controls
      this.inputControls.add(recoverForm.querySelector('#recovery-request-btn'));
      this.inputControls.add(recoverForm.querySelector('#recovery-email'));
      this.inputControls.add(recoverForm.querySelector('#recovery-token'));
      this.inputControls.add(recoverForm.querySelector('#recovery-new-password'));
      this.inputControls.add(recoverForm.querySelector('#recovery-confirm-password'));
      
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
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {
            targetScreen: 'login'
         }));
      });

      if(this.inputControls.has(undefined))
         throw new Error('RecoverScreen: Input controls incomplete!');

      content.appendChild(recoverForm);
   }

   show(parameters = {})
   {
      if (this.container)
      {
         this.container.style.display = 'flex';
         this.isVisible = true;
         
         // Reset to step 1
         document.getElementById('recovery-step-1').style.display = 'block';
         document.getElementById('recovery-step-2').style.display = 'none';
         document.getElementById('recovery-success').style.display = 'none';
         document.getElementById('recovery-error').style.display = 'none';

         // Pre-fill email if provided in parameters
         const emailInput = document.getElementById('recovery-email');
         if (emailInput)
         {
            if (parameters.email)
            {
               emailInput.value = parameters.email;
               setTimeout(() => emailInput.focus(), 100);
            }
            else
            {
               emailInput.value = '';
               setTimeout(() => emailInput.focus(), 100);
            }
         }
         else
            throw new Error('RecoverScreen: Email input not found!');
      }
   }

   hide()
   {
      if (this.container)
      {
         this.container.style.display = 'none';
         this.isVisible = false;
      }
      else
         throw new Error('RecoverScreen: Container not found!');
   }

   async handleRecoveryRequest()
   {
      const emailInput = document.getElementById('recovery-email');
      const successDiv = document.getElementById('recovery-success');

      const email = emailInput.value.trim();

      if (!this.validateEmail(email))
      {
         this.showError('recovery-error', 'Please enter a valid email address.');
         successDiv.style.display = 'none';
         return;
      }

      this.updateViewState(true, email);

      eventBus.emit('system:recoverRequest', new ApiRequest('system:recoverRequest', {email}));
   }

   handleRecoverResponse(event)
   {
      const successDiv = document.getElementById('recovery-success');

      // Re-enable all inputs after response
      this.updateViewState(false, event.data?.email);

      if (event.isSuccess())
      {
         document.getElementById('recovery-step-1').style.display = 'none';
         document.getElementById('recovery-step-2').style.display = 'block';
         this.clearError('recovery-error');
         successDiv.style.display = 'block';
         successDiv.textContent = event.data?.message || 'Recovery token sent! Check console/logs for the token.';
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to send recovery token.';
         this.showError('recovery-error', errorMsg);
         successDiv.style.display = 'none';
      }
   }

   async handlePasswordReset()
   {
      const tokenInput = document.getElementById('recovery-token');
      const newPasswordInput = document.getElementById('recovery-new-password');
      const confirmPasswordInput = document.getElementById('recovery-confirm-password');
      const errorDiv = document.getElementById('recovery-error');
      const successDiv = document.getElementById('recovery-success');

      const token = tokenInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      if (!token || !newPassword || !confirmPassword)
      {
         errorDiv.textContent = 'Please fill in all fields.';
         errorDiv.style.display = 'block';
         return;
      }

      if (newPassword !== confirmPassword)
      {
         errorDiv.textContent = 'Passwords do not match.';
         errorDiv.style.display = 'block';
         return;
      }

      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.valid)
      {
         errorDiv.textContent = passwordValidation.errors.join('. ');
         errorDiv.style.display = 'block';
         return;
      }

      this.updateViewState(true, null);

      eventBus.emit('system:resetPasswordRequest', new ApiRequest('system:resetPasswordRequest', { token, newPassword }));
   }

   handleResetPasswordResponse(event)
   {
      const tokenInput = document.getElementById('recovery-token');
      const newPasswordInput = document.getElementById('recovery-new-password');
      const confirmPasswordInput = document.getElementById('recovery-confirm-password');
      const successDiv = document.getElementById('recovery-success');

      // Re-enable all inputs after response
      this.updateViewState(false, null);

      if (event.isSuccess())
      {
         successDiv.textContent = event.data?.message || 'Password reset successfully! Redirecting to login...';
         successDiv.style.display = 'block';
         this.clearError('recovery-error');

         tokenInput.value = '';
         newPasswordInput.value = '';
         confirmPasswordInput.value = '';

         setTimeout(() => { eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'login'})); }, 2000);
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to reset password.';
         this.showError('recovery-error', errorMsg);
         successDiv.style.display = 'none';
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

