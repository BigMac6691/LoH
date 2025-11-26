/**
 * VictoryDialog - Dialog shown when player wins the game
 * Extends BaseDialog for common dialog functionality
 */
import { BaseDialog } from './BaseDialog.js';

export class VictoryDialog extends BaseDialog {
  constructor() {
    super();
    this.player = null;
  }

  /**
   * Create the victory dialog DOM element
   * @param {Object} player - Player information
   */
  create(player) {
    this.player = player;

    this.dialog = document.createElement('div');
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: rgba(20, 20, 40, 0.98);
      border: 3px solid #ffd700;
      border-radius: 20px;
      box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
      backdrop-filter: blur(20px);
      z-index: 3000;
      padding: 40px;
      text-align: center;
      font-family: 'Courier New', monospace;
      color: #ffffff;
      display: none;
    `;

    const title = document.createElement('h1');
    title.textContent = '🏆 VICTORY! 🏆';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #ffd700;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    `;

    const message = document.createElement('p');
    message.textContent = `Congratulations ${player.name}! You have conquered the galaxy!`;
    message.style.cssText = `
      margin: 20px 0;
      color: #ffffff;
      font-size: 18px;
      line-height: 1.6;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'All opponents have been defeated!';
    subtitle.style.cssText = `
      margin: 10px 0 30px 0;
      color: #ffd700;
      font-size: 14px;
      font-style: italic;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      padding: 12px 30px;
      background: rgba(255, 215, 0, 0.2);
      border: 2px solid #ffd700;
      border-radius: 8px;
      color: #ffd700;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: bold;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 215, 0, 0.4)';
      closeButton.style.transform = 'scale(1.05)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 215, 0, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    this.dialog.appendChild(title);
    this.dialog.appendChild(message);
    this.dialog.appendChild(subtitle);
    this.dialog.appendChild(closeButton);

    document.body.appendChild(this.dialog);

    // Setup keyboard handlers
    this.setupKeyboardHandlers();
  }

  /**
   * Show the victory dialog
   * @param {Object} player - Player information
   */
  show(player) {
    if (!this.dialog) {
      this.create(player);
    } else if (player && player !== this.player) {
      // Update player info if different
      this.player = player;
      const message = this.dialog.querySelector('p');
      if (message) {
        message.textContent = `Congratulations ${player.name}! You have conquered the galaxy!`;
      }
    }

    super.show();
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
    this.dialog = null;
    this.player = null;
  }
}

