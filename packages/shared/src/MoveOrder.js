/**
 * MoveOrder - Represents a fleet movement order
 * Contains origin star, destination star, and selected ship IDs
 */
export class MoveOrder {
  /**
   * Create a new MoveOrder instance
   * @param {Object} options - MoveOrder configuration options
   * @param {string} options.originStarId - ID of the origin star
   * @param {string} options.destStarId - ID of the destination star
   * @param {Array<string>} options.selectedShipIds - Array of selected ship IDs
   */
  constructor(options = {}) {
    this.originStarId = options.originStarId || null;
    this.destStarId = options.destStarId || null;
    this.selectedShipIds = options.selectedShipIds || [];
  }

  /**
   * Get the origin star ID
   * @returns {string|null} Origin star ID
   */
  getOriginStarId() {
    return this.originStarId;
  }

  /**
   * Set the origin star ID
   * @param {string} starId - Origin star ID
   */
  setOriginStarId(starId) {
    this.originStarId = starId;
  }

  /**
   * Get the destination star ID
   * @returns {string|null} Destination star ID
   */
  getDestStarId() {
    return this.destStarId;
  }

  /**
   * Set the destination star ID
   * @param {string} starId - Destination star ID
   */
  setDestStarId(starId) {
    this.destStarId = starId;
  }

  /**
   * Get the selected ship IDs
   * @returns {Array<string>} Array of selected ship IDs
   */
  getSelectedShipIds() {
    return [...this.selectedShipIds]; // Return a copy
  }

  /**
   * Set the selected ship IDs
   * @param {Array<string>} shipIds - Array of ship IDs
   */
  setSelectedShipIds(shipIds) {
    this.selectedShipIds = [...(shipIds || [])]; // Store a copy
  }

  /**
   * Add a ship ID to the selection
   * @param {string} shipId - Ship ID to add
   */
  addShipId(shipId) {
    if (shipId && !this.selectedShipIds.includes(shipId)) {
      this.selectedShipIds.push(shipId);
    }
  }

  /**
   * Remove a ship ID from the selection
   * @param {string} shipId - Ship ID to remove
   */
  removeShipId(shipId) {
    const index = this.selectedShipIds.indexOf(shipId);
    if (index !== -1) {
      this.selectedShipIds.splice(index, 1);
    }
  }

  /**
   * Check if a ship ID is selected
   * @param {string} shipId - Ship ID to check
   * @returns {boolean} True if ship is selected
   */
  isShipSelected(shipId) {
    return this.selectedShipIds.includes(shipId);
  }

  /**
   * Get the number of selected ships
   * @returns {number} Number of selected ships
   */
  getSelectedCount() {
    return this.selectedShipIds.length;
  }

  /**
   * Clear all selected ships
   */
  clearSelection() {
    this.selectedShipIds = [];
  }

  /**
   * Check if this move order is valid
   * @returns {boolean} True if valid
   */
  isValid() {
    return this.originStarId && 
           this.destStarId && 
           this.originStarId !== this.destStarId &&
           this.selectedShipIds.length > 0;
  }

  /**
   * Get a summary of this move order
   * @returns {Object} Move order summary
   */
  getSummary() {
    return {
      originStarId: this.originStarId,
      destStarId: this.destStarId,
      selectedShipIds: this.getSelectedShipIds(),
      selectedCount: this.getSelectedCount(),
      isValid: this.isValid()
    };
  }

  /**
   * Create a copy of this move order
   * @returns {MoveOrder} New MoveOrder instance
   */
  clone() {
    return new MoveOrder({
      originStarId: this.originStarId,
      destStarId: this.destStarId,
      selectedShipIds: this.getSelectedShipIds()
    });
  }
}
