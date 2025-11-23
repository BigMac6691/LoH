/**
 * MenuView - Base class for all menu view components
 * Provides common functionality for components displayed in the home page menu
 */
export class MenuView {
  constructor(homePage) {
    this.homePage = homePage;
  }

  /**
   * Display a status message in the home page status component
   * @param {string} message - Message to display
   * @param {string} type - Message type: 'info', 'success', 'error', 'warning' (default: 'info')
   */
  displayStatusMessage(message, type = 'info') {
    if (this.homePage && this.homePage.postStatusMessage) {
      this.homePage.postStatusMessage(message, type);
    } else {
      // Fallback to alert if homePage is not available
      alert(message);
    }
  }
}

