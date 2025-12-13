/**
 * RegisterScreen - Registration screen with form for new user registration
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiEvent, ApiRequest } from './events/Events.js';
import { Utils } from './utils/Utils.js';

export class RegisterScreen extends BaseFormScreen
{
   constructor()
   {
      super('register');
      this.registerEventHandler('system:registerResponse', this.handleRegisterResponse);
      this.createRegisterScreen();
   }

   createRegisterScreen()
   {
      const content = this.createBaseScreen();
      const registerForm = document.createElement('div');
      registerForm.className = 'splash-login-form';
      registerForm.innerHTML = registerHTML;

      const formElement = Utils.requireChild(registerForm, '#registration-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleRegistrationSubmit();
      });

      // Add input fields to controls
      this.inputControls.add(Utils.requireChild(registerForm, '#register-submit-btn'));
      this.inputControls.add(Utils.requireChild(registerForm, '#register-email'));
      this.inputControls.add(Utils.requireChild(registerForm, '#register-display-name'));
      this.inputControls.add(Utils.requireChild(registerForm, '#register-password'));
      this.inputControls.add(Utils.requireChild(registerForm, '#register-password-confirm'));

      const backLink = Utils.requireChild(registerForm, '#back-to-login-link');
      this.inputControls.add(backLink);
      backLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'login'})); });

      content.append(this.createSuccessPanel(), registerForm);
   }

   createSuccessPanel()
   {
      const successPanel = document.createElement('div');
      successPanel.id = 'register-success';
      successPanel.className = 'login-error';
      successPanel.style.display = 'none';
      successPanel.style.background = 'rgba(0, 255, 0, 0.2)';
      successPanel.style.border = '2px solid var(--color-success)';
      successPanel.style.color = 'var(--color-success)';
      successPanel.style.whiteSpace = 'pre-line';
      successPanel.textContent = 'Registration successful! Logging you in...';

      return successPanel;
   }

   onShow(parameters = {})
   {
      this.prefillInput('#register-email', parameters.email);
      this.focusInput('#register-email', true);
   }

   handleRegistrationSubmit()
   {
      const email = Utils.requireElement('#register-email').value.trim();
      const displayName = Utils.requireElement('#register-display-name').value.trim();
      const password = Utils.requireElement('#register-password').value;
      const passwordConfirm = Utils.requireElement('#register-password-confirm').value;

      this.clearError('#register-error');

      if (!email || !displayName || !password || !passwordConfirm)
      {
         this.showError('#register-error', 'Please fill in all fields.');

         return;
      }

      if (!this.validateEmail(email))
      {
         this.showError('#register-error', 'Please enter a valid email address.');
         this.focusInput('#register-email', true);

         return;
      }

      if (password !== passwordConfirm)
      {
         this.showError('#register-error', 'Passwords do not match.');
         this.focusInput('#register-password-confirm', true);

         return;
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid)
      {
         this.showError('#register-error', passwordValidation.errors.join('. '));
         this.focusInput('#register-password', true);

         return;
      }

      this.updateViewState(true, email); // Disable all inputs during submission

      eventBus.emit('system:registerRequest', new ApiRequest('system:registerRequest', { email, password, displayName }));
   }

   handleRegisterResponse(event)
   {
      if (event.isSuccess())
         this.showRegistrationSuccess(event.data);
      else
      {
         this.updateViewState(false, null); // Re-enable all inputs after response
         this.handleRegistrationFailure(event.error);
      }
   }

   showRegistrationSuccess(data)
   {
      Utils.requireElement('#registration-form').style.display = 'none';

      const successPanel = Utils.requireElement('#register-success');
      successPanel.style.display = 'block';
      successPanel.textContent = data?.message || 'Registration successful! Logging you in...';

      const email = data.user.email;
      const password = Utils.requireElement('#register-password').value;
      
      // Attempt auto-login
      if (email && password)
         setTimeout(() => { eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password})); }, 1000);
      else
         setTimeout(() => { eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'login'})); }, 2000);
   }

   handleRegistrationFailure(data)
   {
      let errorMessage = data?.message || 'Registration failed. Please try again.';
      
      if (data?.error === 'EMAIL_ALREADY_EXISTS')
         errorMessage = 'This email address is already registered. Try logging in instead.';
      else if (data?.error === 'PASSWORD_INVALID')
         errorMessage = data.message || 'Password does not meet requirements.';
      else if (data?.error === 'MISSING_FIELDS')
         errorMessage = 'Please fill in all required fields.';
      else if (data?.error === 'TOO_MANY_REGISTRATION_ATTEMPTS')
         errorMessage = data.message || 'Too many registration attempts. Please try again in 1 hour.';

      this.showError('#register-error', errorMessage);
   }
}

const registerHTML = `
<div class="login-title">New Commander Registration ⭐</div>
<div class="login-error" id="register-error" style="display: none;"></div>

<form id="registration-form" class="login-form">
  <div class="form-group">
    <label for="register-email" class="form-label">
      <span class="form-icon">📧</span>
      Email Address
    </label>
    <input 
      type="email" 
      id="register-email" 
      class="form-input" 
      placeholder="commander@hyperspace.space"
      required
      autocomplete="email"
    />
  </div>
  
  <div class="form-group">
    <label for="register-display-name" class="form-label">
      <span class="form-icon">👤</span>
      Display Name
    </label>
    <input 
      type="text" 
      id="register-display-name" 
      class="form-input" 
      placeholder="Commander Name"
      required
      autocomplete="name"
    />
  </div>
  
  <div class="form-group">
    <label for="register-password" class="form-label">
      <span class="form-icon">🔑</span>
      Password
    </label>
    <input 
      type="password" 
      id="register-password" 
      class="form-input" 
      placeholder="Enter password (8+ chars, upper, lower, number, symbol)"
      required
      autocomplete="new-password"
      minlength="8"
    />
    <div class="password-hint" style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">
      Must include: uppercase, lowercase, number, and symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)
    </div>
  </div>
  
  <div class="form-group">
    <label for="register-password-confirm" class="form-label">
      <span class="form-icon">🔒</span>
      Confirm Password
    </label>
    <input 
      type="password" 
      id="register-password-confirm" 
      class="form-input" 
      placeholder="Confirm your password"
      required
      autocomplete="new-password"
      minlength="8"
    />
  </div>
  
  <div class="login-actions">
    <button type="submit" class="btn btn-primary btn-login" id="register-submit-btn">
      Register! ⭐
    </button>
  </div>
  
  <div class="login-links" style="margin-top: 15px; text-align: center;">
    <button type="button" id="back-to-login-link" class="login-link">← Back to Login</button>
  </div>
</form>
`;

