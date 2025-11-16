/**
 * UTClock - Displays current UTC time, updating every second
 */
export class UTClock {
  constructor(container) {
    this.container = container;
    this.intervalId = null;
  }

  /**
   * Initialize and start the UTC clock
   */
  init() {
    this.updateTime();
    // Update every second
    this.intervalId = setInterval(() => this.updateTime(), 1000);
  }

  /**
   * Update the displayed time
   */
  updateTime() {
    if (!this.container) return;

    const now = new Date();
    const utcTime = now.toISOString();
    // Format: UTC: YYYY-MM-DD HH:MM:SS
    const formatted = utcTime.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    
    this.container.textContent = formatted;
  }

  /**
   * Clean up interval on dispose
   */
  dispose() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

