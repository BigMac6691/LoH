/**
 * HomePage - Main home page after login
 */

export class HomePage {
  constructor() {
    this.container = null;
  }

  /**
   * Initialize and show the home page
   */
  init() {
    this.createHomePage();
    this.show();
  }

  /**
   * Create the home page DOM structure
   */
  createHomePage() {
    this.container = document.createElement('div');
    this.container.id = 'home-page';
    this.container.className = 'home-page';
    
    // Get user info from localStorage
    const userEmail = localStorage.getItem('user_email') || 'Commander';
    const userId = localStorage.getItem('user_id');
    
    this.container.innerHTML = `
      <div class="home-content">
        <div class="home-header">
          <h1 class="home-title">HOME</h1>
          <div class="home-subtitle">Welcome back, ${userEmail}!</div>
        </div>
        
        <div class="home-main">
          <p class="home-text">You have successfully logged in.</p>
          <p class="home-text">This is your home page. More features coming soon!</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
  }

  /**
   * Show the home page
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Hide the home page
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

