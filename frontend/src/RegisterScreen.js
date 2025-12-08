/**
 * RegisterScreen - Registration screen with form for new user registration
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class RegisterScreen extends BaseFormScreen
{
   constructor()
   {
      super('register-screen');
      this.registerEventHandler('system:registerResponse', this.handleRegisterResponse);
      this.createRegisterScreen();
   }

   createRegisterScreen()
   {
      const content = this.createBaseScreen();

      const registerForm = document.createElement('div');
      registerForm.className = 'splash-login-form';
      registerForm.innerHTML = registerHTML;

      const formElement = registerForm.querySelector('#registration-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleRegistrationSubmit();
      });

      // Add input fields to controls
      this.inputControls.add(registerForm.querySelector('#register-submit-btn'));
      this.inputControls.add(registerForm.querySelector('#register-email'));
      this.inputControls.add(registerForm.querySelector('#register-display-name'));
      this.inputControls.add(registerForm.querySelector('#register-password'));
      this.inputControls.add(registerForm.querySelector('#register-password-confirm'));

      const backLink = registerForm.querySelector('#back-to-login-link');
      this.inputControls.add(backLink);
      backLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'login'})); });

      if(this.inputControls.has(undefined))
         throw new Error('RegisterScreen: Input controls incomplete!');

      content.appendChild(registerForm);
   }

   onShow(parameters = {})
   {
      // Pre-fill email if provided in parameters
      const emailInput = document.getElementById('register-email');
      if (emailInput)
      {
         if (parameters.email)
         {
            this.prefillInput('register-email', parameters.email);
            this.focusInput('register-email', true); // Select text if email provided
         }
         else
         {
            emailInput.value = '';
            this.focusInput('register-email');
         }
      }
      else
         throw new Error('RegisterScreen: Email input not found!');
   }

   handleRegistrationSubmit()
   {
      const emailInput = document.getElementById('register-email');
      const displayNameInput = document.getElementById('register-display-name');
      const passwordInput = document.getElementById('register-password');
      const passwordConfirmInput = document.getElementById('register-password-confirm');

      const email = emailInput.value.trim();
      const displayName = displayNameInput.value.trim();
      const password = passwordInput.value;
      const passwordConfirm = passwordConfirmInput.value;

      this.clearError('register-error');

      if (!email || !displayName || !password || !passwordConfirm)
      {
         this.showRegistrationError('Please fill in all fields.');
         return;
      }

      if (!this.validateEmail(email))
      {
         this.showRegistrationError('Please enter a valid email address.');
         emailInput.focus();
         return;
      }

      if (password !== passwordConfirm)
      {
         this.showRegistrationError('Passwords do not match.');
         passwordConfirmInput.focus();
         return;
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid)
      {
         this.showRegistrationError(passwordValidation.errors.join('. '));
         passwordInput.focus();
         return;
      }

      // Disable all inputs during submission
      this.updateViewState(true, email);

      // Store request data for auto-login later
      const requestData = { email, password, displayName };
      
      eventBus.emit('system:registerRequest', new ApiRequest('system:registerRequest', requestData));
   }

   handleRegisterResponse(event)
   {
      // Re-enable all inputs after response
      this.updateViewState(false, event.response?.email);

      if (event.isSuccess())
      {
         // Get email and password from the original request
         const email = event.request?.email;
         const password = event.request?.password;
         this.showRegistrationSuccess(event.response, email, password);
      }
      else
         this.handleRegistrationFailure(event.error);
   }

   showRegistrationSuccess(data, email, password)
   {
      const registerForm = document.getElementById('registration-form');
      if (!registerForm) 
         throw new Error('RegisterScreen: Registration form not found!');

      let message = data?.message || 'Registration successful! Logging you in...';
      
      if (data?.verificationToken)
         console.log('🔐 Verification token (dev mode):', data.verificationToken);

      const successDiv = document.createElement('div');
      successDiv.className = 'login-error';
      successDiv.style.background = 'rgba(0, 255, 0, 0.2)';
      successDiv.style.border = '2px solid var(--color-success)';
      successDiv.style.color = 'var(--color-success)';
      successDiv.style.display = 'block';
      successDiv.style.whiteSpace = 'pre-line';
      successDiv.textContent = message;

      registerForm.style.display = 'none';
      this.container.querySelector('.splash-content').insertBefore(successDiv, registerForm.parentNode);

      // Attempt auto-login
      if (email && password)
         setTimeout(() => { eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password})); }, 1000);
      else
         setTimeout(() => { eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'login'})); }, 2000);
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

      this.showError('register-error', errorMessage);
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

