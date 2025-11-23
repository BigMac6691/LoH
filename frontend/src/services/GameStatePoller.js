/**
 * GameStatePoller - Polls server for game state updates as fallback when WebSocket unavailable
 * Polls every 30 seconds to check if a new turn is available
 */

import { eventBus } from '../eventBus.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';

export class GameStatePoller {
  constructor() {
    this.pollInterval = null;
    this.pollIntervalMs = 30000; // 30 seconds
    this.currentGameId = null;
    this.currentTurnNumber = null;
    this.isPolling = false;
  }

  /**
   * Start polling for game state updates
   * @param {string} gameId - Game ID to poll
   * @param {number} currentTurnNumber - Current turn number
   */
  startPolling(gameId, currentTurnNumber) {
    if (this.isPolling && this.currentGameId === gameId) {
      console.log('🔄 GameStatePoller: Already polling for this game');
      return;
    }

    // Stop any existing polling
    this.stopPolling();

    this.currentGameId = gameId;
    this.currentTurnNumber = currentTurnNumber;
    this.isPolling = true;

    console.log(`🔄 GameStatePoller: Starting polling for game ${gameId} (current turn: ${currentTurnNumber})`);

    // Poll immediately, then set interval
    this.poll();

    this.pollInterval = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    this.currentGameId = null;
    this.currentTurnNumber = null;
    console.log('🔄 GameStatePoller: Stopped polling');
  }

  /**
   * Perform a single poll
   */
  async poll() {
    if (!this.currentGameId) {
      return;
    }

    try {
      const result = await RB.fetchGet(`/api/games/${this.currentGameId}/turn/open`);
      
      if (result.success && result.turn) {
        const newTurnNumber = result.turn.number;
        
        // Check if turn number has changed
        if (this.currentTurnNumber !== null && newTurnNumber !== this.currentTurnNumber) {
          console.log(`🔄 GameStatePoller: Turn number changed from ${this.currentTurnNumber} to ${newTurnNumber}, refreshing game state`);
          
          // Verify we're still viewing this game
          const context = eventBus.getContext();
          if (context.gameId === this.currentGameId) {
            // Emit event to refresh game state
            eventBus.emit('game:startGame', { gameId: this.currentGameId });
          } else {
            console.log('🔄 GameStatePoller: Game ID mismatch, stopping polling');
            this.stopPolling();
          }
        } else {
          // Update current turn number
          this.currentTurnNumber = newTurnNumber;
        }
      }
    } catch (error) {
      console.error('🔄 GameStatePoller: Error polling game state:', error);
    }
  }

  /**
   * Update the current turn number (called when game state is refreshed)
   * @param {number} turnNumber - New turn number
   */
  updateTurnNumber(turnNumber) {
    this.currentTurnNumber = turnNumber;
  }
}

// Export singleton instance
export const gameStatePoller = new GameStatePoller();

