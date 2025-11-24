/**
 * SplashScreen - Login screen that appears while assets load
 * Shows a cartoon-style loading animation, then login form once assets are ready
 */

import { assetManager } from './engine/AssetManager.js';
import { RB, ApiError } from './utils/RequestBuilder.js';
import { eventBus } from './eventBus.js';

export class SplashScreen {
  constructor() {
    this.container = null;
    this.loginForm = null;
    this.loadingAnimation = null;
    this.isVisible = false;
    this.assetsReady = false;
    
    // Track which assets we need
    this.requiredAssets = {
      font: 'fonts/helvetiker_regular.typeface.json',
      gltf: 'models/toy_rocket_4k_free_3d_model_gltf/scene.gltf'
    };
    
    this.assetStatus = {
      font: false,
      gltf: false
    };
  }

  /**
   * Initialize and show the splash screen
   */
  init() {
    this.createSplashScreen();
    this.setupAssetListeners();
    this.show();
    
    // Start loading assets if not already loaded
    this.loadRequiredAssets();
  }

  /**
   * Create the splash screen DOM structure
   */
  createSplashScreen() {
    this.container = document.createElement('div');
    this.container.id = 'splash-screen';
    this.container.className = 'splash-screen';
    
    // Create main content wrapper
    const content = document.createElement('div');
    content.className = 'splash-content';
    
    // Create logo/title area with cartoon style
    const logoArea = document.createElement('div');
    logoArea.className = 'splash-logo';
    logoArea.innerHTML = `
      <div class="splash-title">⚔️ LoH ⚔️</div>
      <div class="splash-subtitle">Lords of Hyperspace</div>
    `;
    
    // Loading animation (shown while assets load)
    this.loadingAnimation = document.createElement('div');
    this.loadingAnimation.className = 'splash-loading';
    this.loadingAnimation.innerHTML = `
      <div class="loading-rocket">🚀</div>
      <div class="loading-text">Preparing for launch...</div>
      <div class="loading-bar">
        <div class="loading-bar-fill"></div>
      </div>
    `;
    
    // Login form (hidden until assets are ready)
    this.loginForm = this.createLoginForm();
    this.loginForm.style.display = 'none';
    
    content.appendChild(logoArea);
    content.appendChild(this.loadingAnimation);
    content.appendChild(this.loginForm);
    
    this.container.appendChild(content);
    document.body.appendChild(this.container);
  }

  /**
   * Create the login form
   */
  createLoginForm() {
    const form = document.createElement('div');
    form.className = 'splash-login-form';
    
    form.innerHTML = `
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
        
        <div class="login-links" id="login-links" style="display: none;">
          <a href="#" id="recover-link" class="login-link">🔓 Forgot Password?</a>
          <a href="#" id="register-link" class="login-link">✨ New Commander?</a>
        </div>
      </form>
    `;
    
    // Setup form handler
    const formElement = form.querySelector('#login-form');
    formElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
    
    // Setup link handlers (for single button approach)
    const recoverLink = form.querySelector('#recover-link');
    const registerLink = form.querySelector('#register-link');
    
    recoverLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleRecover();
    });
    
    registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleRegister();
    });
    
    return form;
  }

  /**
   * Setup listeners for asset loading
   */
  setupAssetListeners() {
    assetManager.addEventListener('asset:loaded', (event) => {
      const { type, path } = event.detail;
      
      // Check if this is one of our required assets
      if (type === 'font' && path.includes('helvetiker')) {
        this.assetStatus.font = true;
      } else if (type === 'gltf' && path.includes('rocket')) {
        this.assetStatus.gltf = true;
      }
      
      this.checkAssetsReady();
    });
    
    // Also check if assets are already loaded
    this.checkExistingAssets();
  }

  /**
   * Check if assets are already loaded
   */
  checkExistingAssets() {
    // Check font
    if (assetManager.isLoaded(this.requiredAssets.font)) {
      this.assetStatus.font = true;
    }
    
    // Check GLTF
    if (assetManager.isLoaded(this.requiredAssets.gltf)) {
      this.assetStatus.gltf = true;
    }
    
    this.checkAssetsReady();
  }

  /**
   * Load required assets if not already loading
   */
  loadRequiredAssets() {
    if (!assetManager.isLoaded(this.requiredAssets.font) && !assetManager.isLoading(this.requiredAssets.font)) {
      assetManager.loadFont(this.requiredAssets.font).catch(err => {
        console.warn('Failed to load font:', err);
        // Mark as loaded anyway to proceed (graceful degradation)
        this.assetStatus.font = true;
        this.checkAssetsReady();
      });
    }
    
    if (!assetManager.isLoaded(this.requiredAssets.gltf) && !assetManager.isLoading(this.requiredAssets.gltf)) {
      assetManager.loadGLTF(this.requiredAssets.gltf).catch(err => {
        console.warn('Failed to load GLTF:', err);
        // Mark as loaded anyway to proceed (graceful degradation)
        this.assetStatus.gltf = true;
        this.checkAssetsReady();
      });
    }
  }

  /**
   * Check if all assets are ready and show login form
   */
  checkAssetsReady() {
    if (this.assetsReady) return; // Already shown
    
    const allReady = this.assetStatus.font && this.assetStatus.gltf;
    
    if (allReady && !this.assetsReady) {
      this.assetsReady = true;
      this.showLoginForm();
    }
  }

  /**
   * Show login form with animation
   * @param {boolean} showRegisterLink - Whether to show the registration link (default: true)
   */
  showLoginForm(showRegisterLink = true) {
    // Hide registration form if visible
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.style.opacity = '0';
      registerForm.style.transform = 'translateY(20px)';
      setTimeout(() => {
        registerForm.remove();
      }, 500);
    }

    // Fade out loading animation
    if (this.loadingAnimation) {
      this.loadingAnimation.style.opacity = '0';
      this.loadingAnimation.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        this.loadingAnimation.style.display = 'none';
      }, 500);
    }
    
    // Fade in login form
    if (this.loginForm) {
      this.loginForm.style.display = 'block';
      this.loginForm.style.opacity = '0';
      this.loginForm.style.transform = 'translateY(20px)';
      
      // Show/hide registration link based on parameter
      const linksDiv = this.loginForm.querySelector('#login-links');
      if (linksDiv) {
        linksDiv.style.display = showRegisterLink ? 'block' : 'none';
      }
      
      // Trigger animation
      setTimeout(() => {
        this.loginForm.style.transition = 'all 0.5s ease-out';
        this.loginForm.style.opacity = '1';
        this.loginForm.style.transform = 'translateY(0)';
      }, 100);
    }
    
    // Focus on email input
    setTimeout(() => {
      const emailInput = document.getElementById('login-email');
      if (emailInput) {
        emailInput.focus();
      }
    }, 600);
  }

  /**
   * Show the splash screen
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      this.isVisible = true;
    }
  }

  /**
   * Hide the splash screen
   */
  hide() {
    if (this.container) {
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container.style.display = 'none';
        this.isVisible = false;
      }, 500);
    }
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Validate password complexity
   * Requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)
   */
  validatePassword(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (password && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (password && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Safe symbols: !@#$%^&*()_+-=[]{}|;:,.<>?
    if (password && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      errors.push('Password must contain at least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Show error message
   */
  showError(message, links = null) {
    const errorDiv = document.getElementById('login-error');
    if (!errorDiv) return;

    // Build error message with links if provided
    let errorHtml = message;
    
    if (links) {
      let linkHtml = '<div class="error-links" style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">';
      
      if (links.recover) {
        linkHtml += `<a href="#" id="error-recover-link" class="login-link">🔓 Recover Password</a>`;
      }
      
      if (links.register) {
        linkHtml += `<a href="#" id="error-register-link" class="login-link">⭐ New Commander?</a>`;
      }
      
      linkHtml += '</div>';
      errorHtml += linkHtml;
    }

    errorDiv.innerHTML = errorHtml;
    errorDiv.style.display = 'block';
    errorDiv.className = 'login-error error-message';

    // Add event listeners for links
    if (links) {
      if (links.recover) {
        const recoverLink = errorDiv.querySelector('#error-recover-link');
        if (recoverLink) {
          recoverLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleRecover(links.email || null);
          });
        }
      }

      if (links.register) {
        const registerLink = errorDiv.querySelector('#error-register-link');
        if (registerLink) {
          registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleRegister();
          });
        }
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clear error message
   */
  clearError() {
    const errorDiv = document.getElementById('login-error');
    const linksDiv = document.getElementById('login-links');
    
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }
    
    if (linksDiv) {
      linksDiv.style.display = 'none';
    }
  }

  /**
   * Handle login form submission
   */
  async handleLogin() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Clear previous errors
    this.clearError();
    
    // Validate input
    if (!this.validateEmail(email)) {
      this.showError('Please enter a valid email address.');
      emailInput.focus();
      return;
    }
    
    // If password is blank, show recovery option
    if (!password || password.trim().length === 0) {
      this.showError(
        'Password is required. If you forgot your password, please use password recovery.',
        { recover: true, email: email }
      );
      return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Launching... 🚀';
    
    try {
      // Attempt login via API
      const data = await RB.fetchPostUnauthenticated('/api/auth/login', { email, password });
      
      if (data.success) {
        // Success - hide splash and proceed
        this.hide();
        
        // Store JWT tokens if provided
        if (data.accessToken) {
          localStorage.setItem('access_token', data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        
        // Store user info
        if (data.user) {
          localStorage.setItem('user_email', data.user.email);
          if (data.user.id) {
            localStorage.setItem('user_id', data.user.id);
          }
          if (data.user.displayName) {
            localStorage.setItem('user_display_name', data.user.displayName);
          }
          if (data.user.role) {
            localStorage.setItem('user_role', data.user.role);
          }
          if (data.user.emailVerified !== undefined) {
            localStorage.setItem('user_email_verified', data.user.emailVerified.toString());
          }
        }
        
        // Emit login success event
        eventBus.emit('auth:loginSuccess', { user: data.user, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken } });
      } else {
        // Handle different failure types
        this.handleLoginFailure(data, email);
      }
    } catch (error) {
      console.error('Login error:', error);
      // If it's an ApiError, try to extract error data for handling
      if (error instanceof ApiError && error.body) {
        this.handleLoginFailure(error.body, email);
      } else {
        this.showError('Connection error. Please try again.', null);
      }
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Launch! 🚀';
    }
  }

  /**
   * Handle login failure with different types
   */
  handleLoginFailure(data, email) {
    // Password required (blank password)
    if (data.error === 'PASSWORD_REQUIRED') {
      this.showError(
        data.message || 'Password is required. If you forgot your password, please use password recovery.',
        { recover: true, email: email }
      );
    }
    // Type 1: Email exists but wrong password
    else if (data.errorType === 1 || data.error === 'INVALID_PASSWORD') {
      this.showError(
        'Login failed. Incorrect password.',
        { recover: true, email: email }
      );
    }
    // Type 2: Email not registered
    else if (data.errorType === 2 || data.error === 'USER_NOT_FOUND') {
      this.showError(
        'Email address not found.',
        { register: true }
      );
    }
    // Other errors
    else {
      this.showError(data.message || 'Login failed. Please try again.');
    }
  }

  /**
   * Handle password recovery
   */
  async handleRecover(email = null) {
    // Get email from parameter or input field
    const emailInput = document.getElementById('login-email');
    const emailToRecover = email || emailInput?.value.trim() || '';
    
    if (!emailToRecover) {
      this.showError('Please enter your email address first.');
      if (emailInput) emailInput.focus();
      return;
    }
    
    // Show recovery form
    this.showRecoveryForm(emailToRecover);
  }

  /**
   * Show password recovery form
   */
  showRecoveryForm(email = '') {
    // Hide login form
    if (this.loginForm) {
      this.loginForm.style.display = 'none';
    }

    // Remove existing recovery form if any
    const existingRecovery = document.getElementById('recovery-form');
    if (existingRecovery) {
      existingRecovery.remove();
    }

    // Create recovery form
    const recoveryForm = document.createElement('div');
    recoveryForm.id = 'recovery-form';
    recoveryForm.className = 'splash-login-form';

    recoveryForm.innerHTML = `
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
              value="${this.escapeHtml(email)}"
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

    // Insert recovery form after login form container
    const loginContainer = document.querySelector('.splash-content');
    if (loginContainer) {
      loginContainer.appendChild(recoveryForm);
    }

    // Setup event listeners
    const requestForm = recoveryForm.querySelector('#recovery-request-form');
    const resetForm = recoveryForm.querySelector('#recovery-reset-form');
    const backLink = recoveryForm.querySelector('#recovery-back-link');

    // Request recovery token
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRecoveryRequest();
    });

    // Reset password
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handlePasswordReset();
    });

    // Back to login
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      recoveryForm.remove();
      if (this.loginForm) {
        this.loginForm.style.display = 'block';
      }
    });
  }

  /**
   * Handle recovery token request
   */
  async handleRecoveryRequest() {
    const emailInput = document.getElementById('recovery-email');
    const submitBtn = document.getElementById('recovery-request-btn');
    const errorDiv = document.getElementById('recovery-error');
    const successDiv = document.getElementById('recovery-success');

    const email = emailInput.value.trim();

    if (!this.validateEmail(email)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const data = await RB.fetchPostUnauthenticated('/api/auth/recover', { email });

      if (data.success) {
        // Show step 2 (token entry)
        document.getElementById('recovery-step-1').style.display = 'none';
        document.getElementById('recovery-step-2').style.display = 'block';
        errorDiv.style.display = 'none';
        successDiv.style.display = 'block';
        successDiv.textContent = data.message || 'Recovery token sent! Check console/logs for the token.';
      } else {
        errorDiv.textContent = data.message || 'Failed to send recovery token.';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
      }
    } catch (error) {
      console.error('Recovery request error:', error);
      // If it's an ApiError, try to extract error message
      if (error instanceof ApiError && error.body) {
        errorDiv.textContent = error.body.message || error.message || 'Failed to send recovery token.';
      } else {
        errorDiv.textContent = 'Connection error. Please try again.';
      }
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Recovery Token 🔓';
    }
  }

  /**
   * Handle password reset with recovery token
   */
  async handlePasswordReset() {
    const tokenInput = document.getElementById('recovery-token');
    const newPasswordInput = document.getElementById('recovery-new-password');
    const confirmPasswordInput = document.getElementById('recovery-confirm-password');
    const submitBtn = document.getElementById('recovery-reset-btn');
    const errorDiv = document.getElementById('recovery-error');
    const successDiv = document.getElementById('recovery-success');

    const token = tokenInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validate
    if (!token || !newPassword || !confirmPassword) {
      errorDiv.textContent = 'Please fill in all fields.';
      errorDiv.style.display = 'block';
      return;
    }

    if (newPassword !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match.';
      errorDiv.style.display = 'block';
      return;
    }

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      errorDiv.textContent = passwordValidation.errors.join('. ');
      errorDiv.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    try {
      const data = await RB.fetchPostUnauthenticated('/api/auth/reset-password', {
        token,
        newPassword
      });

      if (data.success) {
        successDiv.textContent = data.message || 'Password reset successfully! Redirecting to login...';
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';

        // Clear form
        tokenInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        // Redirect to login after delay
        setTimeout(() => {
          const recoveryForm = document.getElementById('recovery-form');
          if (recoveryForm) {
            recoveryForm.remove();
          }
          if (this.loginForm) {
            this.loginForm.style.display = 'block';
          }
          this.clearError();
        }, 2000);
      } else {
        errorDiv.textContent = data.message || 'Failed to reset password.';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
      }
    } catch (error) {
      console.error('Password reset error:', error);
      // If it's an ApiError, try to extract error message
      if (error instanceof ApiError && error.body) {
        errorDiv.textContent = error.body.message || error.message || 'Failed to reset password.';
      } else {
        errorDiv.textContent = 'Connection error. Please try again.';
      }
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password 🔓';
    }
  }

  /**
   * Handle registration - Show registration form
   */
  async handleRegister() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput.value.trim() || '';
    
    // Hide login form and show registration form
    this.showRegistrationForm(email);
  }

  /**
   * Show registration form
   */
  showRegistrationForm(prefilledEmail = '') {
    // Hide login form
    if (this.loginForm) {
      this.loginForm.style.display = 'none';
    }

    // Remove existing registration form if any
    const existingRegister = document.getElementById('register-form');
    if (existingRegister) {
      existingRegister.remove();
    }

    // Create registration form
    const registerForm = document.createElement('div');
    registerForm.id = 'register-form';
    registerForm.className = 'splash-login-form';

    registerForm.innerHTML = `
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

    // Insert after login form (or in same container)
    if (this.loginForm && this.loginForm.parentNode) {
      this.loginForm.parentNode.insertBefore(registerForm, this.loginForm.nextSibling);
    } else if (this.container) {
      const content = this.container.querySelector('.splash-content');
      if (content) {
        content.appendChild(registerForm);
      }
    }

    // Fade in registration form
    registerForm.style.opacity = '0';
    registerForm.style.transform = 'translateY(20px)';
    setTimeout(() => {
      registerForm.style.transition = 'all 0.5s ease-out';
      registerForm.style.opacity = '1';
      registerForm.style.transform = 'translateY(0)';
    }, 100);

    // Setup form handler
    const formElement = registerForm.querySelector('#registration-form');
    formElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegistrationSubmit();
    });

    // Setup back to login link
    const backLink = registerForm.querySelector('#back-to-login-link');
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
      registerForm.remove();
    });

    // Focus on first input and set prefilled email
    setTimeout(() => {
      const emailInput = registerForm.querySelector('#register-email');
      if (emailInput) {
        // Safely set email value (browser will escape)
        if (prefilledEmail) {
          emailInput.value = prefilledEmail;
        }
        emailInput.focus();
        if (prefilledEmail) {
          emailInput.select();
        }
      }
    }, 200);
  }

  /**
   * Handle registration form submission
   */
  async handleRegistrationSubmit() {
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

    // Clear previous errors
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    // Validate inputs
    if (!email || !displayName || !password || !passwordConfirm) {
      this.showRegistrationError('Please fill in all fields.');
      return;
    }

    if (!this.validateEmail(email)) {
      this.showRegistrationError('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    if (password !== passwordConfirm) {
      this.showRegistrationError('Passwords do not match.');
      passwordConfirmInput.focus();
      return;
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      this.showRegistrationError(passwordValidation.errors.join('. '));
      passwordInput.focus();
      return;
    }

    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering... ⭐';
    }

    try {
      // Attempt registration via API
      const data = await RB.fetchPostUnauthenticated('/api/auth/register', { 
        email, 
        password,
        displayName 
      });

      if (data.success) {
        // Registration successful - attempt auto-login
        this.showRegistrationSuccess(data, email, password);
      } else {
        // Handle registration errors
        this.handleRegistrationFailure(data);
      }
    } catch (error) {
      console.error('Registration error:', error);
      // If it's an ApiError, try to extract error data for handling
      if (error instanceof ApiError && error.body) {
        this.handleRegistrationFailure(error.body);
      } else {
        this.showRegistrationError('Connection error. Please try again.');
      }
    } finally {
      // Re-enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register! ⭐';
      }
    }
  }

  /**
   * Show registration error
   */
  showRegistrationError(message) {
    const errorDiv = document.getElementById('register-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.className = 'login-error error-message';
    }
  }

  /**
   * Show registration success message and attempt auto-login
   */
  async showRegistrationSuccess(data, email, password) {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    // Show success message with verification info
    let message = data.message || 'Registration successful! Logging you in...';
    
    // Log verification token to console if provided (for development)
    if (data.verificationToken) {
      console.log('🔐 Verification token (dev mode):', data.verificationToken);
    }

    const successDiv = document.createElement('div');
    successDiv.className = 'login-error';
    successDiv.style.background = 'rgba(0, 255, 0, 0.2)';
    successDiv.style.border = '2px solid var(--color-success)';
    successDiv.style.color = 'var(--color-success)';
    successDiv.style.display = 'block';
    successDiv.style.whiteSpace = 'pre-line';
    successDiv.textContent = message;

    // Replace form with success message
    const form = registerForm.querySelector('#registration-form');
    if (form) {
      form.style.display = 'none';
    }

    registerForm.insertBefore(successDiv, registerForm.firstChild);

    // Attempt auto-login immediately
    try {
      const loginData = await RB.fetchPostUnauthenticated('/api/auth/login', { email, password });
      
      if (loginData.success) {
        // Auto-login successful - proceed to app
        registerForm.remove();
        this.hide();
        
        // Store JWT tokens if provided
        if (loginData.accessToken) {
          localStorage.setItem('access_token', loginData.accessToken);
        }
        if (loginData.refreshToken) {
          localStorage.setItem('refresh_token', loginData.refreshToken);
        }
        
        // Store user info
        if (loginData.user) {
          localStorage.setItem('user_email', loginData.user.email);
          if (loginData.user.id) {
            localStorage.setItem('user_id', loginData.user.id);
          }
          if (loginData.user.displayName) {
            localStorage.setItem('user_display_name', loginData.user.displayName);
          }
          if (loginData.user.role) {
            localStorage.setItem('user_role', loginData.user.role);
          }
          if (loginData.user.emailVerified !== undefined) {
            localStorage.setItem('user_email_verified', loginData.user.emailVerified.toString());
          }
        }
        
        // Emit login success event
        eventBus.emit('auth:loginSuccess', { user: loginData.user, tokens: { accessToken: loginData.accessToken, refreshToken: loginData.refreshToken } });
        return; // Exit early - user is logged in
      }
    } catch (error) {
      console.log('Auto-login after registration failed, showing login form:', error);
      // Auto-login failed - fall through to show login form
    }

    // Auto-login failed - show login form but hide registration link
    setTimeout(() => {
      this.showLoginForm(false); // false = hide registration link
      const loginEmailInput = document.getElementById('login-email');
      if (loginEmailInput) {
        loginEmailInput.value = email;
      }
      registerForm.remove();
    }, 2000);
  }

  /**
   * Handle registration failure
   */
  handleRegistrationFailure(data) {
    let errorMessage = data.message || 'Registration failed. Please try again.';

    if (data.error === 'EMAIL_ALREADY_EXISTS') {
      errorMessage = 'This email address is already registered. Try logging in instead.';
    } else if (data.error === 'PASSWORD_INVALID') {
      errorMessage = data.message || 'Password does not meet requirements.';
    } else if (data.error === 'MISSING_FIELDS') {
      errorMessage = 'Please fill in all required fields.';
    }

    this.showRegistrationError(errorMessage);
  }
}

