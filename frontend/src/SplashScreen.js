/**
 * SplashScreen - Loading screen that appears while assets load
 * Shows a cartoon-style loading animation, then a continue button once assets are ready
 */
import { ApiRequest } from './events/Events.js';
import { eventBus } from './eventBus.js';

export class SplashScreen
{
   constructor()
   {
      this.container = null;
      this.loadingAnimation = null;
      this.continueButton = null;
      this.isVisible = false;

      eventBus.on('system:systemReady', this.handleSystemReady.bind(this));

      this.createSplashScreen();
   }

   handleSystemReady(event)
   {
      console.log('🔐 SplashScreen: System ready');
      this.showContinueButton();
   }

   createSplashScreen()
   {
      this.container = document.createElement('div');
      this.container.id = 'splash-screen';
      this.container.className = 'splash-screen';

      // Create main content wrapper
      const content = document.createElement('div');
      content.className = 'splash-content';

      // Create logo/title area with cartoon style
      const logoArea = document.createElement('div');
      logoArea.className = 'splash-logo';
      logoArea.innerHTML = 
      `
      <div class="splash-title">⚔️ LoH ⚔️</div>
      <div class="splash-subtitle">Lords of Hyperspace</div>
      `;

      // Loading animation (shown while assets load)
      this.loadingAnimation = document.createElement('div');
      this.loadingAnimation.className = 'splash-loading';
      this.loadingAnimation.innerHTML = 
      `
      <div class="loading-rocket">🚀</div>
      <div class="loading-text">Preparing for launch...</div>
      <div class="loading-bar">
        <div class="loading-bar-fill"></div>
      </div>
      `;

      content.appendChild(logoArea);
      content.appendChild(this.loadingAnimation);

      this.container.appendChild(content);
      document.body.appendChild(this.container);
   }

   showContinueButton()
   {
      if (!this.continueButton)
      {
         this.continueButton = document.createElement('button');
         this.continueButton.id = 'continue-to-login-btn';
         this.continueButton.className = 'btn btn-primary btn-continue';
         this.continueButton.textContent = 'Continue to Login/Register';
         this.continueButton.style.cssText = `
            margin-top: 30px;
            padding: 15px 30px;
            font-size: 18px;
            cursor: pointer;
         `;
         
         this.continueButton.addEventListener('click', () =>
         {
            eventBus.emit('ui:showScreen', new ApiRequest('ui:showScreen', 'login'));
         });

         const content = this.container.querySelector('.splash-content');
         if (content)
         {
            // Hide loading animation
            if (this.loadingAnimation)
            {
               this.loadingAnimation.style.opacity = '0';
               this.loadingAnimation.style.transform = 'translateY(-20px)';
               setTimeout(() => { this.loadingAnimation.style.display = 'none'; }, 300);
            }

            // Show continue button with animation
            content.appendChild(this.continueButton);
            this.continueButton.style.opacity = '0';
            this.continueButton.style.transform = 'translateY(20px)';
            setTimeout(() =>
            {
               this.continueButton.style.transition = 'all 0.5s ease-out';
               this.continueButton.style.opacity = '1';
               this.continueButton.style.transform = 'translateY(0)';
            }, 100);
         }
      }
   }

   show()
   {
      if (this.container)
      {
         this.container.style.display = 'flex';
         this.isVisible = true;
      }
   }

   hide()
   {
      if (this.container)
      {
         this.container.style.opacity = '0';
         setTimeout(() =>
         {
            this.container.style.display = 'none';
            this.isVisible = false;
         }, 500);
      }
   }

   dispose()
   {
      eventBus.off('system:systemReady', this.handleSystemReady.bind(this));
   }
}
