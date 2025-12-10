/**
 * LoginScreen - Login screen with form for user authentication
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class LoginScreen extends BaseFormScreen
{
   constructor()
   {
      super('login-screen');
      this.registerEventHandler('system:loginResponse', this.handleLoginResponse);
      this.createLoginScreen();
   }

   createLoginScreen()
   {
      const content = this.createBaseScreen();

      const loginForm = document.createElement('div');
      loginForm.className = 'splash-login-form';
      loginForm.innerHTML = loginHTML;

      const formElement = loginForm.querySelector('#login-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleLogin();
      });

      // Add input fields to controls
      this.inputControls.add(loginForm.querySelector('#login-submit-btn'));
      this.inputControls.add(loginForm.querySelector('#login-email'));
      this.inputControls.add(loginForm.querySelector('#login-password'));

      const recoverLink = loginForm.querySelector('#recover-link');
      this.inputControls.add(recoverLink);
      recoverLink.addEventListener('click', () =>
      {
         const email = document.getElementById('login-email')?.value.trim() || '';
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'recover', parameters: email ? { email } : {}}));
      });

      const registerLink = loginForm.querySelector('#register-link');
      this.inputControls.add(registerLink);
      registerLink.addEventListener('click', () =>
      {
         const email = document.getElementById('login-email')?.value.trim() || '';
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'register', parameters: email ? { email } : {}}));
      });
      
      if(this.inputControls.has(undefined))
         throw new Error('LoginScreen: Input controls incomplete!');

      content.appendChild(loginForm);
   }

   handleLogin()
   {
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      this.clearError('login-error');

      if (!this.validateEmail(email))
      {
         this.showError('login-error', 'Please enter a valid email address.');
         emailInput.focus();
         return;
      }

      if (!password || password.trim().length === 0)
      {
         this.showErrorWithLinks('login-error', 'Password is required. If you forgot your password, please use password recovery.', {recover: true, email: email});
         return;
      }

      this.updateViewState(true, email);
      eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password}));
   }

   handleLoginResponse(event)
   {
      console.log('🔐 LoginScreen: Login response:', event);
      this.updateViewState(false, event.data?.email);

      if (event.isSuccess())
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'home'}));
      else
         this.handleLoginFailure(event.error, event.data?.email);
   }

   handleLoginFailure(data, email)
   {
      if (data?.error === 'PASSWORD_REQUIRED')
         this.showErrorWithLinks('login-error', data.message || 'Password is required. If you forgot your password, please use password recovery.', {recover: true, email: email});
      else if (data?.errorType === 1 || data?.error === 'INVALID_PASSWORD')
         this.showErrorWithLinks('login-error', 'Login failed. Incorrect password.', {recover: true, email: email});
      else if (data?.errorType === 2 || data?.error === 'USER_NOT_FOUND')
         this.showErrorWithLinks('login-error', 'Email address not found.', {register: true, email: email});
      else
         this.showError('login-error', data?.message || 'Login failed. Please try again.');
   }

   /**
    * Show error with action links (specialized for LoginScreen)
    * @param {string} errorId - ID of the error div
    * @param {string} message - Error message
    * @param {Object} links - Links configuration {recover: boolean, register: boolean, email: string}
    */
   showErrorWithLinks(errorId, message, links = null)
   {
      const errorDiv = document.getElementById(errorId);
      if (!errorDiv) 
         throw new Error('LoginScreen: Error div not found!');

      let errorHtml = message;
      if (links)
      {
         let linkHtml = '<div class="error-links" style="margin-top: 10px; display: flex; flex-direction: row; gap: 20px; justify-content: center;">';

         if (links.recover)
            linkHtml += `<a href="#" id="error-recover-link" class="login-link">🔓 Recover Password</a>`;

         if (links.register)
            linkHtml += `<a href="#" id="error-register-link" class="login-link">⭐ New Commander?</a>`;

         linkHtml += '</div>';
         errorHtml += linkHtml;
      }

      errorDiv.innerHTML = errorHtml;
      errorDiv.style.display = 'block';
      errorDiv.className = 'login-error error-message';

      if (links)
      {
         if (links.recover)
         {
            const recoverLink = errorDiv.querySelector('#error-recover-link');

            if (recoverLink)
               recoverLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'recover', parameters: links.email ? { email: links.email } : {}})); });
            else
               throw new Error('LoginScreen: Recover link not found!');
         }

         if (links.register)
         {
            const registerLink = errorDiv.querySelector('#error-register-link');

            if (registerLink)
               registerLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', {targetScreen: 'register', parameters: links.email ? { email: links.email } : {}})); });
            else
               throw new Error('LoginScreen: Register link not found!');
         }
      }
   }
}

const loginHTML = `
<div class="login-title">Welcome Back, Commander!</div>
<div class="login-error" id="login-error" style="display: none;"></div>

<form id="login-form" class="login-form">
  <div class="form-group">
    <label for="login-email" class="form-label">
      <span class="form-icon">📧</span>
      Email Address
    </label>
    <input 
      type="email" 
      id="login-email" 
      class="form-input" 
      placeholder="commander@hyperspace.space"
      required
      autocomplete="email"
    />
  </div>
  
  <div class="form-group">
    <label for="login-password" class="form-label">
      <span class="form-icon">🔑</span>
      Password
    </label>
    <input 
      type="password" 
      id="login-password" 
      class="form-input" 
      placeholder="Enter your password"
      required
      autocomplete="current-password"
      minlength="8"
    />
  </div>
  
  <div class="login-actions">
    <button type="submit" class="btn btn-primary btn-login" id="login-submit-btn">
      Launch! 🚀
    </button>
  </div>
  
  <div class="login-links" id="login-links" style="display: flex; flex-direction: row; gap: 20px; justify-content: center;">
    <button type="button" id="recover-link" class="login-link">🔓 Forgot Password?</button>
    <button type="button" id="register-link" class="login-link">✨ New Commander?</button>
  </div>
</form>
`;

