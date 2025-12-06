/**
 * LoginScreen - Login screen with form for user authentication
 */
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class LoginScreen
{
   constructor()
   {
      this.container = null;
      this.isVisible = false;
      
      eventBus.on('system:loginResponse', this.handleLoginResponse.bind(this));
      
      this.createLoginScreen();
   }

   createLoginScreen()
   {
      this.container = document.createElement('div');
      this.container.id = 'login-screen';
      this.container.className = 'splash-screen'; // Reuse splash styling
      this.container.style.display = 'none';

      const content = document.createElement('div');
      content.className = 'splash-content';

      const logoArea = document.createElement('div');
      logoArea.className = 'splash-logo';
      logoArea.innerHTML = `
      <div class="splash-title">⚔️ LoH ⚔️</div>
      <div class="splash-subtitle">Lords of Hyperspace</div>
      `;

      const loginForm = document.createElement('div');
      loginForm.className = 'splash-login-form';
      loginForm.innerHTML = loginHTML;

      const formElement = loginForm.querySelector('#login-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleLogin();
      });

      const recoverLink = loginForm.querySelector('#recover-link');
      recoverLink.addEventListener('click', (e) =>
      {
         e.preventDefault();
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'recover'));
      });

      const registerLink = loginForm.querySelector('#register-link');
      registerLink.addEventListener('click', (e) =>
      {
         e.preventDefault();
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'register'));
      });

      content.appendChild(logoArea);
      content.appendChild(loginForm);
      this.container.appendChild(content);
      document.body.appendChild(this.container);
   }

   handleLogin()
   {
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      this.clearError();

      if (!this.validateEmail(email))
      {
         this.showError('Please enter a valid email address.');
         emailInput.focus();
         return;
      }

      if (!password || password.trim().length === 0)
      {
         this.showError('Password is required. If you forgot your password, please use password recovery.', 
            {recover: true, email: email});
         return;
      }

      this.updateViewState(true, email);
      eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password}));
   }

   handleLoginResponse(event)
   {
      console.log('🔐 LoginScreen: Login response:', event);
      this.updateViewState(false, event.response?.email);

      if (event.isSuccess())
      {
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'home'));
      }
      else
      {
         this.handleLoginFailure(event.error, event.response?.email);
      }
   }

   updateViewState(loading, email)
   {
      const submitBtn = document.getElementById('login-submit-btn');
      if (submitBtn)
      {
         submitBtn.disabled = loading;
         submitBtn.textContent = loading ? 'Launching... 🚀' : 'Launch! 🚀';
      }

      const emailInput = document.getElementById('login-email');
      if (emailInput && email)
         emailInput.value = email;
   }

   handleLoginFailure(data, email)
   {
      if (data?.error === 'PASSWORD_REQUIRED')
         this.showError(data.message || 'Password is required. If you forgot your password, please use password recovery.', 
            {recover: true, email: email});
      else if (data?.errorType === 1 || data?.error === 'INVALID_PASSWORD')
         this.showError('Login failed. Incorrect password.', {recover: true, email: email});
      else if (data?.errorType === 2 || data?.error === 'USER_NOT_FOUND')
         this.showError('Email address not found.', {register: true});
      else
         this.showError(data?.message || 'Login failed. Please try again.');
   }

   validateEmail(email)
   {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
   }

   showError(message, links = null)
   {
      const errorDiv = document.getElementById('login-error');
      if (!errorDiv) return;

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
            {
               recoverLink.addEventListener('click', (e) =>
               {
                  e.preventDefault();
                  eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'recover'));
               });
            }
         }
         if (links.register)
         {
            const registerLink = errorDiv.querySelector('#error-register-link');
            if (registerLink)
            {
               registerLink.addEventListener('click', (e) =>
               {
                  e.preventDefault();
                  eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'register'));
               });
            }
         }
      }
   }

   clearError()
   {
      const errorDiv = document.getElementById('login-error');
      if (errorDiv)
      {
         errorDiv.style.display = 'none';
         errorDiv.textContent = '';
      }
   }

   show()
   {
      if (this.container)
      {
         this.container.style.display = 'flex';
         this.isVisible = true;
         setTimeout(() =>
         {
            const emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.focus();
         }, 100);
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

   dispose()
   {
      eventBus.off('system:loginResponse', this.handleLoginResponse.bind(this));
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);
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
    <a href="#" id="recover-link" class="login-link">🔓 Forgot Password?</a>
    <a href="#" id="register-link" class="login-link">✨ New Commander?</a>
  </div>
</form>
`;

