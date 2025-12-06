/**
 * RegisterScreen - Registration screen with form for new user registration
 */
import { eventBus } from './eventBus.js';
import { ApiRequest } from './events/Events.js';

export class RegisterScreen
{
   constructor()
   {
      this.container = null;
      this.isVisible = false;
      this.prefilledEmail = '';
      
      eventBus.on('system:registerResponse', this.handleRegisterResponse.bind(this));
      
      this.createRegisterScreen();
   }

   createRegisterScreen()
   {
      this.container = document.createElement('div');
      this.container.id = 'register-screen';
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

      const registerForm = document.createElement('div');
      registerForm.className = 'splash-login-form';
      registerForm.innerHTML = registerHTML;

      const formElement = registerForm.querySelector('#registration-form');
      formElement.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleRegistrationSubmit();
      });

      const backLink = registerForm.querySelector('#back-to-login-link');
      backLink.addEventListener('click', (e) =>
      {
         e.preventDefault();
         eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'login'));
      });

      content.appendChild(logoArea);
      content.appendChild(registerForm);
      this.container.appendChild(content);
      document.body.appendChild(this.container);
   }

   show()
   {
      if (this.container)
      {
         this.container.style.display = 'flex';
         this.isVisible = true;
         
         // Set prefilled email if available
         if (this.prefilledEmail)
         {
            const emailInput = document.getElementById('register-email');
            if (emailInput)
            {
               emailInput.value = this.prefilledEmail;
               setTimeout(() =>
               {
                  emailInput.focus();
                  emailInput.select();
               }, 100);
            }
         }
         else
         {
            setTimeout(() =>
            {
               const emailInput = document.getElementById('register-email');
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

   async handleRegistrationSubmit()
   {
      const emailInput = document.getElementById('register-email');
      const displayNameInput = document.getElementById('register-display-name');
      const passwordInput = document.getElementById('register-password');
      const passwordConfirmInput = document.getElementById('register-password-confirm');
      const submitBtn = document.getElementById('register-submit-btn');
      const errorDiv = document.getElementById('register-error');

      const email = emailInput.value.trim();
      const displayName = displayNameInput.value.trim();
      const password = passwordInput.value;
      const passwordConfirm = passwordConfirmInput.value;

      if (errorDiv)
      {
         errorDiv.style.display = 'none';
         errorDiv.textContent = '';
      }

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

      if (submitBtn)
      {
         submitBtn.disabled = true;
         submitBtn.textContent = 'Registering... ⭐';
      }

      // Store request data for auto-login later
      const requestData = { email, password, displayName };
      
      eventBus.emit('system:registerRequest', new ApiRequest('system:registerRequest', requestData));
   }

   handleRegisterResponse(event)
   {
      const submitBtn = document.getElementById('register-submit-btn');
      
      if (submitBtn)
      {
         submitBtn.disabled = false;
         submitBtn.textContent = 'Register! ⭐';
      }

      if (event.isSuccess())
      {
         // Get email and password from the original request
         const email = event.request?.email;
         const password = event.request?.password;
         this.showRegistrationSuccess(event.response, email, password);
      }
      else
      {
         this.handleRegistrationFailure(event.error);
      }
   }

   showRegistrationSuccess(data, email, password)
   {
      const registerForm = document.getElementById('registration-form');
      if (!registerForm) return;

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
      {
         setTimeout(() =>
         {
            eventBus.emit('system:loginRequest', new ApiRequest('system:loginRequest', {email, password}));
         }, 1000);
      }
      else
      {
         setTimeout(() =>
         {
            eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'login'));
         }, 2000);
      }
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

      this.showRegistrationError(errorMessage);
   }

   showRegistrationError(message)
   {
      const errorDiv = document.getElementById('register-error');
      if (errorDiv)
      {
         errorDiv.textContent = message;
         errorDiv.style.display = 'block';
         errorDiv.className = 'login-error error-message';
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
      eventBus.off('system:registerResponse', this.handleRegisterResponse.bind(this));
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);
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
    <a href="#" id="back-to-login-link" class="login-link">← Back to Login</a>
  </div>
</form>
`;

