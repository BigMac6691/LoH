/**
 * PlayerManager - Handles player creation, validation, and assignment
 */
export class PlayerManager {
  constructor() {
    this.players = [];
    this.availableColors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA0DD', // Plum
      '#FFB347', // Orange
      '#98D8C8', // Mint
      '#F7DC6F', // Gold
      '#BB8FCE', // Purple
      '#85C1E9', // Sky Blue
      '#F8C471', // Peach
      '#82E0AA', // Light Green
      '#F1948A', // Light Red
      '#85C1E9'  // Light Blue
    ];
    this.usedColors = new Set();
  }

  /**
   * Add a new player
   * @param {string} name - Player name
   * @param {string} color - Player color (hex)
   * @param {Object} mapModel - Map model data
   * @param {boolean} ai - Whether player is AI controlled (optional)
   * @returns {Object|null} Player object or null if validation fails
   */
  addPlayer(name, color, mapModel, ai = false) {
    // Validate player name
    if (!this.isValidPlayerName(name)) {
      return { success: false, error: 'Invalid player name' };
    }

    // Validate color
    if (!this.isValidPlayerColor(color)) {
      return { success: false, error: 'Invalid player color' };
    }

    // Check if name already exists (case-insensitive)
    if (this.hasPlayerWithName(name)) {
      return { success: false, error: 'Player name already exists' };
    }

    // Check if color is too similar to existing players
    if (this.isColorTooSimilar(color)) {
      return { success: false, error: 'Color too similar to existing players' };
    }

    // Find available sector
    const sector = this.findAvailableSector(mapModel);
    if (!sector) {
      return { success: false, error: 'No available sectors with stars' };
    }

    // Create player object
    const player = {
      id: this.players.length,
      name: name.trim(),
      color: color,
      sector: sector,
      star: null,
      score: 0,
      ai: ai
    };

    // Assign player to a random star in their sector
    const assignedStar = this.assignPlayerToStar(player, sector);
    if (!assignedStar) {
      return { success: false, error: 'No available stars in sector' };
    }

    player.star = assignedStar;

    // Add player to list
    this.players.push(player);
    this.usedColors.add(color);

    return { success: true, player: player };
  }

  /**
   * Validate player name
   * @param {string} name - Player name
   * @returns {boolean} True if valid
   */
  isValidPlayerName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) return false;
    
    // Allow letters, numbers, spaces, and common punctuation
    const validNameRegex = /^[a-zA-Z0-9\s\-_\.]+$/;
    return validNameRegex.test(trimmedName);
  }

  /**
   * Validate player color
   * @param {string} color - Player color (hex)
   * @returns {boolean} True if valid
   */
  isValidPlayerColor(color) {
    if (!color || typeof color !== 'string') return false;
    
    // Check if it's a valid hex color
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    return hexColorRegex.test(color);
  }

  /**
   * Check if player name already exists (case-insensitive)
   * @param {string} name - Player name
   * @returns {boolean} True if name exists
   */
  hasPlayerWithName(name) {
    const normalizedName = name.trim().toLowerCase();
    return this.players.some(player => 
      player.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Check if color is too similar to existing players
   * @param {string} color - Player color (hex)
   * @returns {boolean} True if color is too similar
   */
  isColorTooSimilar(color) {
    const colorDistanceThreshold = 50;
    
    for (const usedColor of this.usedColors) {
      const distance = this.calculateColorDistance(color, usedColor);
      if (distance < colorDistanceThreshold) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate Euclidean distance between two colors in RGB space
   * @param {string} color1 - First color (hex)
   * @param {string} color2 - Second color (hex)
   * @returns {number} Color distance
   */
  calculateColorDistance(color1, color2) {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return Infinity;
    
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /**
   * Convert hex color to RGB object
   * @param {string} hex - Hex color string
   * @returns {Object|null} RGB object or null if invalid
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Find an available sector for a new player
   * @param {Object} mapModel - Map model data
   * @returns {Object|null} Available sector or null
   */
  findAvailableSector(mapModel) {
    const availableSectors = [];
    
    // Find all sectors that are not occupied and have stars
    for (const sector of mapModel.sectors.flat()) {
      if (sector.stars.length > 0 && !this.isSectorOccupied(sector)) {
        availableSectors.push(sector);
      }
    }
    
    // Return random sector if available
    if (availableSectors.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableSectors.length);
      return availableSectors[randomIndex];
    }
    
    return null;
  }

  /**
   * Check if a sector is already occupied by a player
   * @param {Object} sector - Sector to check
   * @returns {boolean} True if occupied
   */
  isSectorOccupied(sector) {
    return this.players.some(player => player.sector === sector);
  }

  /**
   * Assign player to a random star in their sector
   * @param {Object} player - Player object
   * @param {Object} sector - Sector object
   * @returns {Object|null} Assigned star or null
   */
  assignPlayerToStar(player, sector) {
    const availableStars = sector.stars.filter(star => !star.isOwned());
    
    if (availableStars.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableStars.length);
    const selectedStar = availableStars[randomIndex];
    
    // Set star resource level to 10
    selectedStar.setResourceValue(10);
    
    // Create an economy with industrial value and tech level of 10
    selectedStar.createEconomy({
      industrialValue: 10,
      techLevel: 10
    });
    
    // Mark star as owned by this player using Star class method
    selectedStar.assignOwner(player);
    
    return selectedStar;
  }

  /**
   * Get all players
   * @returns {Array} Array of player objects
   */
  getPlayers() {
    return this.players;
  }

  /**
   * Get available colors
   * @returns {Array} Array of available color hex strings
   */
  getAvailableColors() {
    return this.availableColors.filter(color => !this.usedColors.has(color));
  }

  /**
   * Remove a player
   * @param {number} playerId - Player ID to remove
   * @returns {boolean} True if player was removed
   */
  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;
    
    const player = this.players[playerIndex];
    
    // Remove player's star ownership
    if (player.star) {
      player.star.removeOwner();
    }
    
    // Remove color from used colors
    this.usedColors.delete(player.color);
    
    // Remove player from list
    this.players.splice(playerIndex, 1);
    
    // Reassign IDs
    this.players.forEach((p, index) => {
      p.id = index;
    });
    
    return true;
  }

  /**
   * Clear all players
   */
  clearPlayers() {
    // Reset all stars to unowned
    this.players.forEach(player => {
      if (player.star) {
        player.star.removeOwner();
      }
    });
    
    this.players = [];
    this.usedColors.clear();
  }

  /**
   * Get adjacent sectors for a given sector
   * @param {Object} sector - Sector to find neighbors for
   * @param {Array} sectors - 2D array of all sectors
   * @returns {Array} Array of adjacent sectors
   */
  getAdjacentSectors(sector, sectors) {
    const adjacent = [];
    const { row, col } = sector;
    const mapSize = sectors.length;
    
    // Check all 8 directions (including diagonals)
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],  // Top row
      [0, -1],           [0, 1],    // Middle row
      [1, -1],  [1, 0],  [1, 1]     // Bottom row
    ];
    
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (newRow >= 0 && newRow < mapSize && newCol >= 0 && newCol < mapSize) {
        adjacent.push(sectors[newRow][newCol]);
      }
    }
    
    return adjacent;
  }

  /**
   * Check if game can start (minimum players requirement)
   * @param {number} minPlayers - Minimum number of players required
   * @returns {boolean} True if game can start
   */
  canStartGame(minPlayers = 2) {
    return this.players.length >= minPlayers;
  }
} 