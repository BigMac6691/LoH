/**
 * LoginScreen - Login screen with form for user authentication
 */
import { BaseFormScreen } from './BaseFormScreen.js';
import { eventBus } from './eventBus.js';
import { ApiEvent, ApiRequest } from './events/Events.js';
import { Utils } from './utils/Utils.js';

export class LoginScreen extends BaseFormScreen
{
   constructor()
   {
      super('login');
      this.registerEventHandler('system:loginSuccess', this.handleLoginSuccess);
      this.registerEventHandler('system:loginFailure', this.handleLoginFailure);
      this.createLoginScreen();
   }

   createLoginScreen()
   {
      const content = this.createBaseScreen();
      const loginForm = document.createElement('div');
      loginForm.className = 'splash-login-form';
      loginForm.innerHTML = loginHTML;

      const formElement = Utils.requireChild(loginForm, '#login-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleLogin();
      });

      // Add input fields to controls
      this.inputControls.add(Utils.requireChild(loginForm, '#login-submit-btn'));
      this.inputControls.add(Utils.requireChild(loginForm, '#login-email'));
      this.inputControls.add(Utils.requireChild(loginForm, '#login-password'));

      const recoverLink = Utils.requireChild(loginForm, '#recover-link');
      this.inputControls.add(recoverLink);
      recoverLink.addEventListener('click', () =>
      {
         const email = Utils.requireElement('#login-email')?.value.trim() || '';
         eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'recover', parameters: email ? { email } : {}}));
      });

      const registerLink = Utils.requireChild(loginForm, '#register-link');
      this.inputControls.add(registerLink);
      registerLink.addEventListener('click', () =>
      {
         const email = Utils.requireElement('#login-email')?.value.trim() || '';
         eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'register', parameters: email ? { email } : {}}));
      });
      
      content.appendChild(loginForm);
   }

   handleLogin()
   {
      const emailInput = Utils.requireElement('#login-email');
      const email = emailInput.value.trim();
      const password = Utils.requireElement('#login-password').value;

      this.clearError('#login-error');

      if (!Utils.validateEmail(email))
      {
         this.showError('#login-error', 'Please enter a valid email address.');
         emailInput.focus();
         return;
      }

      if (!password || password.trim().length === 0)
      {
         this.showErrorWithLinks('#login-error', 'Password is required. If you forgot your password, please use password recovery.', {recover: true, email: email});
         return;
      }

      this.updateViewState(true, email);
      eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password}));
   }

   handleLoginSuccess(event)
   {
      this.updateViewState(false, event.data?.email);

      Utils.requireElement('#login-form').reset();
      eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'home'}));
   }

   handleLoginFailure(event)
   {
      this.updateViewState(false, event.data?.email);
      
      const error = event.error;
      const email = event.data?.email;

      if (error.error === 'PASSWORD_REQUIRED')
         this.showErrorWithLinks('#login-error', error.message || 'Password is required. If you forgot your password, please use password recovery.', {recover: true, email: email});
      else if (error.errorType === 1 || error.error === 'INVALID_PASSWORD')
         this.showErrorWithLinks('#login-error', 'Login failed. Incorrect password.', {recover: true, email: email});
      else if (error.errorType === 2 || error.error === 'USER_NOT_FOUND')
         this.showErrorWithLinks('#login-error', 'Email address not found.', {register: true, email: email});
      else
         this.showError('#login-error', error.message || 'Login failed. Please try again.');
   }

   /**
    * Show error with action links (specialized for LoginScreen)
    * @param {string} errorId - ID of the error div
    * @param {string} message - Error message
    * @param {Object} links - Links configuration {recover: boolean, register: boolean, email: string}
    */
   showErrorWithLinks(errorId, message, links = null)
   {
      const errorDiv = Utils.requireElement(errorId);
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
            const recoverLink = Utils.requireChild(errorDiv, '#error-recover-link');
            recoverLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'recover', parameters: links.email ? { email: links.email } : {}})); });
         }

         if (links.register)
         {
            const registerLink = Utils.requireChild(errorDiv, '#error-register-link');
            registerLink.addEventListener('click', () => { eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'register', parameters: links.email ? { email: links.email } : {}})); });
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

