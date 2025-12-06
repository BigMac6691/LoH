/**
 * RecoverScreen - Password recovery screen with forms for password reset
 */
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class RecoverScreen
{
   constructor()
   {
      this.container = null;
      this.isVisible = false;
      this.prefilledEmail = '';
      
      eventBus.on('system:recoverResponse', this.handleRecoverResponse.bind(this));
      eventBus.on('system:resetPasswordResponse', this.handleResetPasswordResponse.bind(this));
      
      this.createRecoverScreen();
   }

   createRecoverScreen()
   {
      this.container = document.createElement('div');
      this.container.id = 'recover-screen';
      this.container.className = 'splash-screen';
      this.container.style.display = 'none';

      const content = document.createElement('div');
      content.className = 'splash-content';

      const logoArea = document.createElement('div');
      logoArea.className = 'splash-logo';
      logoArea.innerHTML = `
      <div class="splash-title">⚔️ LoH ⚔️</div>
      <div class="splash-subtitle">Lords of Hyperspace</div>
      `;

      const recoverForm = document.createElement('div');
      recoverForm.className = 'splash-login-form';
      recoverForm.innerHTML = recoveryHTML;

      const requestForm = recoverForm.querySelector('#recovery-request-form');
      const resetForm = recoverForm.querySelector('#recovery-reset-form');
      const backLink = recoverForm.querySelector('#recovery-back-link');

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

      backLink.addEventListener('click', (e) =>
      {
         e.preventDefault();
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'login'));
      });

      content.appendChild(logoArea);
      content.appendChild(recoverForm);
      this.container.appendChild(content);
      document.body.appendChild(this.container);
   }

   show()
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

         // Try to get prefilled email from login screen
         const loginEmailInput = document.getElementById('login-email');
         if (loginEmailInput && loginEmailInput.value.trim())
         {
            this.prefilledEmail = loginEmailInput.value.trim();
         }

         if (this.prefilledEmail)
         {
            const emailInput = document.getElementById('recovery-email');
            if (emailInput)
            {
               emailInput.value = this.prefilledEmail;
               setTimeout(() => emailInput.focus(), 100);
            }
         }
         else
         {
            setTimeout(() =>
            {
               const emailInput = document.getElementById('recovery-email');
               if (emailInput) emailInput.focus();
            }, 100);
         }
      }
   }

   hide()
   {
      if (this.container)
      {
         this.container.style.display = 'none';
         this.isVisible = false;
      }
   }

   async handleRecoveryRequest()
   {
      const emailInput = document.getElementById('recovery-email');
      const submitBtn = document.getElementById('recovery-request-btn');
      const errorDiv = document.getElementById('recovery-error');
      const successDiv = document.getElementById('recovery-success');

      const email = emailInput.value.trim();

      if (!this.validateEmail(email))
      {
         errorDiv.textContent = 'Please enter a valid email address.';
         errorDiv.style.display = 'block';
         successDiv.style.display = 'none';
         return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      eventBus.emit('system:recoverRequest', new ApiRequest('system:recoverRequest', {email}));
   }

   handleRecoverResponse(event)
   {
      const submitBtn = document.getElementById('recovery-request-btn');
      const errorDiv = document.getElementById('recovery-error');
      const successDiv = document.getElementById('recovery-success');

      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Recovery Token 🔓';

      if (event.isSuccess())
      {
         document.getElementById('recovery-step-1').style.display = 'none';
         document.getElementById('recovery-step-2').style.display = 'block';
         errorDiv.style.display = 'none';
         successDiv.style.display = 'block';
         successDiv.textContent = event.response?.message || 'Recovery token sent! Check console/logs for the token.';
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to send recovery token.';
         errorDiv.textContent = errorMsg;
         errorDiv.style.display = 'block';
         successDiv.style.display = 'none';
      }
   }

   async handlePasswordReset()
   {
      const tokenInput = document.getElementById('recovery-token');
      const newPasswordInput = document.getElementById('recovery-new-password');
      const confirmPasswordInput = document.getElementById('recovery-confirm-password');
      const submitBtn = document.getElementById('recovery-reset-btn');
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

      submitBtn.disabled = true;
      submitBtn.textContent = 'Resetting...';

      eventBus.emit('system:resetPasswordRequest', new ApiRequest('system:resetPasswordRequest', {
         token, newPassword
      }));
   }

   handleResetPasswordResponse(event)
   {
      const tokenInput = document.getElementById('recovery-token');
      const newPasswordInput = document.getElementById('recovery-new-password');
      const confirmPasswordInput = document.getElementById('recovery-confirm-password');
      const submitBtn = document.getElementById('recovery-reset-btn');
      const errorDiv = document.getElementById('recovery-error');
      const successDiv = document.getElementById('recovery-success');

      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password 🔓';

      if (event.isSuccess())
      {
         successDiv.textContent = event.response?.message || 'Password reset successfully! Redirecting to login...';
         successDiv.style.display = 'block';
         errorDiv.style.display = 'none';

         tokenInput.value = '';
         newPasswordInput.value = '';
         confirmPasswordInput.value = '';

         setTimeout(() =>
         {
            eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'login'));
         }, 2000);
      }
      else
      {
         const errorMsg = event.error?.message || event.message || 'Failed to reset password.';
         errorDiv.textContent = errorMsg;
         errorDiv.style.display = 'block';
         successDiv.style.display = 'none';
      }
   }

   validateEmail(email)
   {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
   }

   validatePassword(password)
   {
      const errors = [];
      if (!password || password.length < 8)
         errors.push('Password must be at least 8 characters long');
      if (password && !/[A-Z]/.test(password))
         errors.push('Password must contain at least one uppercase letter');
      if (password && !/[a-z]/.test(password))
         errors.push('Password must contain at least one lowercase letter');
      if (password && !/[0-9]/.test(password))
         errors.push('Password must contain at least one number');
      if (password && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password))
         errors.push('Password must contain at least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)');
      return { valid: errors.length === 0, errors };
   }

   dispose()
   {
      eventBus.off('system:recoverResponse', this.handleRecoverResponse.bind(this));
      eventBus.off('system:resetPasswordResponse', this.handleResetPasswordResponse.bind(this));
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);
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
  <a href="#" id="recovery-back-link" class="login-link">← Back to Login</a>
</div>
`;

