import { BaseDialog } from './BaseDialog.js';
import { getShipSummaryRows } from './utils/shipSummary.js';
import { getShipDisplayName } from './utils/shipGrouping.js';
import { eventBus } from './eventBus.js';
import { RB } from './utils/RequestBuilder.js';

/**
 * ShipSummaryDialog - Displays a summary of ships at all stars.
 */
export class ShipSummaryDialog extends BaseDialog
{
   constructor()
   {
      super();

      this.rows = [];
      this.sortColumn = 'starName';
      this.sortDirection = 'asc';
      this.headerCells = new Map();
      this.activeFilters = {};
      this.activeFilterColumnKey = null;
      this.filterMenu = null;
      this.filterMenuAnchor = null;
      this.currentGameId = null;
      this.currentTurnId = null;
      this.currentPlayerId = null;
      this.selectedDestinations = new Map(); // starId -> selected destination starId
      this.renderedStars = new Set(); // Track which stars have been rendered (for rowspan)

      this.columns = [
         {key: 'starName', label: 'Star Name', type: 'text', visible: true, filterType: 'text', sortable: true, filterable: true},
         {key: 'freeShips', label: 'Free Ships', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
         {key: 'destination', label: 'Destination', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
         {key: 'type', label: 'Type', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
         {key: 'cancel', label: 'Cancel', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
         {key: 'movingShips', label: 'Moving Ships', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
      ];

      this.createDialog();
      this.setupEventListeners();
   }

   /**
    * Setup event listeners
    */
   setupEventListeners()
   {
      // Listen for game loaded event to get current turn
      eventBus.on('game:gameLoaded', (context, eventData) =>
      {
         if (eventData.success && eventData.details)
         {
            this.currentGameId = eventData.details.gameId;
            this.currentPlayerId = context?.playerId || eventBus.getContext()?.playerId; // Use playerId, not user (user is user_id)
            if (eventData.details.currentTurn)
            {
               this.currentTurnId = eventData.details.currentTurn.id;
            }
         }
      });

      // Listen for order updates
      eventBus.on('order:build.submitSuccess', () => this.refreshData());
      eventBus.on('order:move.submitSuccess', () => this.refreshData());
   }

   /**
    * Create dialog DOM structure.
    */
   createDialog()
   {
      this.dialog = document.createElement('div');
      this.dialog.className = 'ship-dialog dialog-base';
      this.dialog.style.width = '1200px';
      this.dialog.style.maxWidth = '90vw';

      const header = document.createElement('div');
      header.className = 'dialog-header';

      const title = document.createElement('h2');
      title.className = 'dialog-title';
      title.textContent = 'Ship Summary';

      const controls = document.createElement('div');
      controls.className = 'ship-header-controls';

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'ship-refresh-btn';
      refreshButton.textContent = 'Refresh';
      refreshButton.addEventListener('click', () => this.refreshData());

      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.hide());

      controls.appendChild(refreshButton);
      controls.appendChild(closeBtn);

      header.appendChild(title);
      header.appendChild(controls);

      const content = document.createElement('div');
      content.className = 'ship-dialog-content';

      this.tableContainer = document.createElement('div');
      this.tableContainer.className = 'ship-table-container';

      this.table = document.createElement('table');
      this.table.className = 'ship-table';

      this.thead = document.createElement('thead');
      this.table.appendChild(this.thead);
      this.buildTableHeader();

      this.tableBody = document.createElement('tbody');
      this.table.appendChild(this.tableBody);

      this.emptyState = document.createElement('div');
      this.emptyState.className = 'ship-empty-state';
      this.emptyState.textContent = 'No ships to display.';

      this.tableContainer.appendChild(this.table);
      this.tableContainer.appendChild(this.emptyState);
      content.appendChild(this.tableContainer);

      const footer = document.createElement('div');
      footer.className = 'ship-dialog-footer';
      footer.textContent = 'Click a column header to sort. Select a destination to see moving ships.';

      this.dialog.appendChild(header);
      this.dialog.appendChild(content);
      this.dialog.appendChild(footer);

      document.body.appendChild(this.dialog);

      this.filterMenu = document.createElement('div');
      this.filterMenu.className = 'ship-filter-menu';
      this.filterMenu.addEventListener('click', (event) => event.stopPropagation());
      this.dialog.appendChild(this.filterMenu);

      this.setupDragHandlers(header);
   }

   /**
    * Build table header with sortable and filterable columns.
    */
   buildTableHeader()
   {
      if (!this.thead)
      {
         return;
      }

      this.thead.innerHTML = '';
      this.headerCells.clear();

      const headerRow = document.createElement('tr');
      headerRow.className = 'ship-table-header-row';

      this.columns.forEach((column) =>
      {
         const th = document.createElement('th');
         th.scope = 'col';
         th.className = `ship-table-header ${column.sortable ? 'ship-sortable' : ''} ${column.filterable ? 'ship-filterable' : ''} ${!column.sortable && !column.filterable ? 'ship-header-center' : ''}`;
         th.dataset.key = column.key;

         if (!column.sortable && !column.filterable)
         {
            // Non-sortable/filterable columns - just label
            th.textContent = column.label;
         }
         else
         {
            const headerContent = document.createElement('span');
            headerContent.className = 'ship-header-content';

            if (column.sortable || column.filterable)
            {
               const iconsContainer = document.createElement('span');
               iconsContainer.className = 'ship-header-icons';

               if (column.sortable)
               {
                  const sortIndicator = document.createElement('span');
                  sortIndicator.className = 'ship-sort-indicator';
                  sortIndicator.textContent = '';
                  iconsContainer.appendChild(sortIndicator);
               }

               if (column.filterable)
               {
                  const filterBtn = document.createElement('button');
                  filterBtn.type = 'button';
                  filterBtn.className = 'ship-filter-btn';
                  filterBtn.textContent = '⚙︎';
                  filterBtn.setAttribute('aria-label', `Filter ${column.label}`);
                  filterBtn.addEventListener('click', (event) =>
                  {
                     event.stopPropagation();
                     this.toggleFilterMenu(column.key, filterBtn);
                  });
                  iconsContainer.appendChild(filterBtn);
               }

               headerContent.appendChild(iconsContainer);
            }

            const label = document.createElement('span');
            label.className = 'ship-header-label';
            label.textContent = column.label;
            headerContent.appendChild(label);

            th.appendChild(headerContent);

            if (column.sortable)
            {
               th.addEventListener('click', () => this.handleSort(column.key));
               th.setAttribute('tabIndex', '0');
               th.setAttribute('role', 'button');
               th.setAttribute('aria-label', `Sort by ${column.label}`);
               th.addEventListener('keydown', (event) =>
               {
                  if (event.key === 'Enter' || event.key === ' ')
                  {
                     event.preventDefault();
                     this.handleSort(column.key);
                  }
               });
            }

            if (this.activeFilters[column.key])
            {
               th.classList.add('ship-header-filtered');
            }

            const indicator = th.querySelector('.ship-sort-indicator');
            if (indicator)
            {
               this.headerCells.set(column.key, {element: th, indicator: indicator});
            }
         }

         headerRow.appendChild(th);
      });

      this.thead.appendChild(headerRow);
      this.updateHeaderSortIndicators();
   }

   /**
    * Update sort indicators in header cells.
    */
   updateHeaderSortIndicators()
   {
      this.headerCells.forEach(({element, indicator}, columnKey) =>
      {
         if (columnKey === this.sortColumn)
         {
            indicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
            element.classList.add('ship-sorted');
         }
         else
         {
            indicator.textContent = '';
            element.classList.remove('ship-sorted');
         }
      });
   }

   /**
    * Handle column sorting.
    * @param {string} columnKey - Column key to sort by
    */
   handleSort(columnKey)
   {
      if (this.sortColumn === columnKey)
      {
         this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      }
      else
      {
         this.sortColumn = columnKey;
         this.sortDirection = 'asc';
      }

      this.renderRows();
      this.updateHeaderSortIndicators();
   }

   /**
    * Get filtered and sorted rows.
    * @returns {Array} Filtered and sorted rows
    */
   getFilteredAndSortedRows()
   {
      let filtered = this.rows;

      // Apply filters
      filtered = filtered.filter((row) => this.shouldIncludeRow(row));

      // Apply sorting
      filtered.sort((a, b) =>
      {
         const valueA = a[this.sortColumn];
         const valueB = b[this.sortColumn];

         if (valueA === valueB)
         {
            return 0;
         }

         if (valueA === null || valueA === undefined)
         {
            return 1;
         }

         if (valueB === null || valueB === undefined)
         {
            return -1;
         }

         if (this.sortColumn === 'starName')
         {
            const stringA = String(valueA).toLowerCase();
            const stringB = String(valueB).toLowerCase();
            return this.sortDirection === 'asc' 
               ? (stringA < stringB ? -1 : 1)
               : (stringA > stringB ? -1 : 1);
         }

         // Default to string comparison
         const stringA = String(valueA).toLowerCase();
         const stringB = String(valueB).toLowerCase();
         return this.sortDirection === 'asc' 
            ? (stringA < stringB ? -1 : 1)
            : (stringA > stringB ? -1 : 1);
      });

      return filtered;
   }

   /**
    * Check if a row should be included based on active filters.
    * @param {Object} row - Row data
    * @returns {boolean} True if row should be included
    */
   shouldIncludeRow(row)
   {
      for (const [columnKey, filter] of Object.entries(this.activeFilters))
      {
         if (!filter)
         {
            continue;
         }

         if (columnKey === 'starName' && filter.type === 'text')
         {
            const filterText = filter.value?.toLowerCase() || '';
            const rowValue = String(row.starName || '').toLowerCase();
            if (!rowValue.includes(filterText))
            {
               return false;
            }
         }
      }

      return true;
   }

   /**
    * Render table rows.
    */
   renderRows()
   {
      if (!this.tableBody)
      {
         return;
      }

      this.tableBody.innerHTML = '';
      this.renderedStars.clear();

      const filteredRows = this.getFilteredAndSortedRows();

      if (filteredRows.length === 0)
      {
         this.emptyState.style.display = 'block';
         return;
      }

      this.emptyState.style.display = 'none';

      filteredRows.forEach((row) =>
      {
         const destinations = row.destinations || [];
         const destinationCount = destinations.length > 0 ? destinations.length : 1;

         // Create one row per destination (or one row if no destinations)
         for (let destIndex = 0; destIndex < destinationCount; destIndex++)
         {
            const isFirstRowForStar = destIndex === 0;
            const dest = destinations.length > 0 ? destinations[destIndex] : null;

            const tr = document.createElement('tr');
            tr.className = 'ship-table-row';

            this.columns.forEach((column) =>
            {
               // Skip star name and free ships cells for subsequent destination rows
               if ((column.key === 'starName' || column.key === 'freeShips') && !isFirstRowForStar)
               {
                  return;
               }

               const td = document.createElement('td');
               td.className = `ship-cell ship-cell-${column.type}`;

               if (column.key === 'starName')
               {
                  td.textContent = row.starName || '';
                  if (destinationCount > 1)
                  {
                     td.rowSpan = destinationCount;
                  }
                  td.className += ' ship-cell-star-name ship-cell-vertically-centered';
                  if (row.starNameColor)
                  {
                     td.style.color = row.starNameColor;
                  }
               }
               else if (column.key === 'freeShips')
               {
                  this.renderFreeShipsCell(td, row);
                  if (destinationCount > 1)
                  {
                     td.rowSpan = destinationCount;
                  }
               }
               else if (column.key === 'destination')
               {
                  this.renderDestinationCell(td, row, dest);
               }
               else if (column.key === 'type')
               {
                  this.renderTypeCell(td, row, dest);
               }
               else if (column.key === 'cancel')
               {
                  this.renderCancelCell(td, row, dest);
               }
               else if (column.key === 'movingShips')
               {
                  this.renderMovingShipsCell(td, row, dest);
               }

               tr.appendChild(td);
            });

            this.tableBody.appendChild(tr);
         }
      });
   }

   /**
    * Render free ships cell.
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    */
   renderFreeShipsCell(cell, row)
   {
      cell.className += ' ship-cell-free-ships';

      const freeShips = row.freeShips || [];
      if (freeShips.length === 0)
      {
         cell.textContent = '—';
         return;
      }

      // Create scrollable container that shows up to 5 ships at a time
      // maxHeight is set in CSS to 8.4em
      const container = document.createElement('div');
      container.className = 'ship-list-container';
      container.style.overflowY = 'auto';
      container.style.overflowX = 'hidden';

      freeShips.forEach((ship) =>
      {
         const shipItem = this.createShipItem(ship);
         container.appendChild(shipItem);
      });

      cell.appendChild(container);
   }

   /**
    * Create a ship item element with name, power, and damage bar.
    * @param {Object} ship - Ship object
    * @returns {HTMLElement} Ship item element
    */
   createShipItem(ship)
   {
      const shipItem = document.createElement('div');
      shipItem.className = 'ship-item';

      // Ship name - use format "Ship-{last 5 chars}" to match OrderSummaryDialog
      const shipName = document.createElement('span');
      shipName.className = 'ship-item-name';
      const shipId = ship.id || ship.getId?.() || 'Unknown';
      const shortId = String(shipId).slice(-5);
      shipName.textContent = `Ship-${shortId}`;
      shipItem.appendChild(shipName);

      // Ship power with lightning bolt symbol
      const shipPower = document.createElement('span');
      shipPower.className = 'ship-item-power';
      const power = ship.power || ship.getPower?.() || 0;
      shipPower.textContent = ` ⚡${power}`;
      shipItem.appendChild(shipPower);

      // Damage bar
      const damageBar = this.createDamageBar(ship);
      shipItem.appendChild(damageBar);

      return shipItem;
   }

   /**
    * Create a damage bar element.
    * @param {Object} ship - Ship object
    * @returns {HTMLElement} Damage bar element
    */
   createDamageBar(ship)
   {
      const power = ship.power || ship.getPower?.() || 0;
      const damage = ship.damage || ship.getDamage?.() || 0;
      const hp = ship.hp !== undefined ? ship.hp : Math.max(0, power - damage);
      const healthPercentage = power > 0 ? (hp / power) * 100 : 100;

      const damageBarContainer = document.createElement('span');
      damageBarContainer.className = 'ship-damage-bar-container';

      const damageBar = document.createElement('span');
      damageBar.className = 'ship-damage-bar';
      damageBar.style.display = 'inline-block';
      damageBar.style.width = '60px';
      damageBar.style.height = '8px';
      damageBar.style.background = 'var(--bg-light)';
      damageBar.style.border = '1px solid var(--border-secondary)';
      damageBar.style.borderRadius = '3px';
      damageBar.style.position = 'relative';
      damageBar.style.overflow = 'hidden';
      damageBar.style.verticalAlign = 'middle';

      const healthBar = document.createElement('span');
      healthBar.className = 'ship-health-bar';
      healthBar.style.display = 'block';
      healthBar.style.width = `${healthPercentage}%`;
      healthBar.style.height = '100%';
      healthBar.style.background = healthPercentage > 50 
         ? '#00ff00' 
         : healthPercentage > 25 
            ? '#ffff00' 
            : '#ff0000';
      healthBar.style.transition = 'width 0.3s ease';

      damageBar.appendChild(healthBar);
      damageBarContainer.appendChild(damageBar);

      return damageBarContainer;
   }

   /**
    * Render destination cell.
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    * @param {Object|null} dest - Destination object for this row
    */
   renderDestinationCell(cell, row, dest)
   {
      cell.className += ' ship-cell-destination';

      if (!dest)
      {
         cell.textContent = '—';
         return;
      }

      // Get selected destination for this star
      const selectedDestId = this.selectedDestinations.get(row.starId);

      const destItem = document.createElement('div');
      destItem.className = 'ship-destination-item';
      if (dest.starId === selectedDestId)
      {
         destItem.classList.add('ship-destination-selected');
      }

      const destName = document.createElement('span');
      destName.className = 'ship-destination-name';
      destName.textContent = dest.starName || '';
      if (dest.starNameColor)
      {
         destName.style.color = dest.starNameColor;
      }
      destItem.appendChild(destName);

      // Add move indicator if there are ships moving to this destination
      if (dest.moveCount > 0)
      {
         const moveIndicator = document.createElement('span');
         moveIndicator.className = 'ship-destination-move-indicator';
         moveIndicator.textContent = ` ➡️ ${dest.moveCount}`;
         destItem.appendChild(moveIndicator);
      }

      // Make destination clickable
      destItem.style.cursor = 'pointer';
      destItem.addEventListener('click', () =>
      {
         this.handleDestinationSelect(row.starId, dest.starId);
      });

      cell.appendChild(destItem);
   }

   /**
    * Handle destination selection.
    * @param {string} starId - Source star ID
    * @param {string} destinationStarId - Destination star ID
    */
   handleDestinationSelect(starId, destinationStarId)
   {
      const currentSelection = this.selectedDestinations.get(starId);
      if (currentSelection === destinationStarId)
      {
         // Deselect if clicking the same destination
         this.selectedDestinations.delete(starId);
      }
      else
      {
         // Select new destination
         this.selectedDestinations.set(starId, destinationStarId);
      }

      // Re-render to update moving ships column
      this.renderRows();
   }

   /**
    * Render type cell.
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    * @param {Object|null} dest - Destination object for this row
    */
   renderTypeCell(cell, row, dest)
   {
      cell.className += ' ship-cell-type';

      if (!dest)
      {
         cell.textContent = '—';
         return;
      }

      cell.textContent = dest.isStanding ? 'Auto' : 'Manual';
   }

   /**
    * Render cancel cell.
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    * @param {Object|null} dest - Destination object for this row
    */
   renderCancelCell(cell, row, dest)
   {
      cell.className += ' ship-cell-cancel';

      if (!dest || dest.moveCount === 0)
      {
         cell.textContent = '—';
         return;
      }

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'ship-cancel-btn';
      cancelButton.textContent = 'Cancel';
      cancelButton.addEventListener('click', (event) =>
      {
         event.stopPropagation();
         // Cancel either regular order or standing order
         if (dest.isStanding)
         {
            this.handleCancelStandingMove(dest.sourceStarId);
         }
         else if (dest.orderId)
         {
            this.handleCancelMove(dest.orderId);
         }
      });

      cell.appendChild(cancelButton);
   }

   /**
    * Handle cancel move order.
    * @param {string} orderId - Order ID to cancel
    */
   async handleCancelMove(orderId)
   {
      if (!this.currentGameId || !this.currentPlayerId)
      {
         console.error('🚢 ShipSummaryDialog: Cannot cancel order - missing gameId or playerId');
         alert('Error: Cannot cancel order - missing game or player information');
         return;
      }

      if (!confirm('Are you sure you want to cancel this move order?'))
      {
         return;
      }

      try
      {
         const response = await fetch(`/api/orders/${orderId}?gameId=${this.currentGameId}&playerId=${this.currentPlayerId}`, {
            method: 'DELETE',
            headers: RB.getHeadersForGet()
         });

         if (!response.ok)
         {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to cancel order');
         }

         const result = await response.json();
         console.log('🚢 ShipSummaryDialog: Order cancelled successfully:', result);

         // Refresh data to update the table
         await this.refreshData();

      }
      catch (error)
      {
         console.error('🚢 ShipSummaryDialog: Error cancelling order', error);
         alert(`Error cancelling order: ${error.message}`);
      }
   }

   /**
    * Handle cancel standing move order.
    * @param {string} starId - Source star ID
    */
   async handleCancelStandingMove(starId)
   {
      if (!this.currentGameId || !this.currentPlayerId)
      {
         console.error('🚢 ShipSummaryDialog: Cannot cancel standing order - missing gameId or playerId');
         alert('Error: Cannot cancel standing order - missing game or player information');
         return;
      }

      if (!confirm('Are you sure you want to cancel this standing move order?'))
      {
         return;
      }

      try
      {
         // Get current standing orders to preserve industry orders
         const getResponse = await fetch(`/api/orders/standing/${starId}?gameId=${this.currentGameId}`, {
            headers: RB.getHeadersForGet()
         });
         if (!getResponse.ok)
         {
            throw new Error('Failed to get standing orders');
         }

         const getResult = await getResponse.json();
         const currentStandingOrders = getResult.standingOrders || {};

         // Remove move standing order but keep industry orders
         // Build new object with all properties, setting move to null to delete it
         const updatedStandingOrders = { ...currentStandingOrders };
         updatedStandingOrders.move = null; // Set to null to signal deletion

         // Update standing orders - backend will remove null properties
         const updateResponse = await fetch('/api/orders/standing', {
            method: 'POST',
            headers: RB.getHeaders(),
            body: JSON.stringify({
               gameId: this.currentGameId,
               starId: starId,
               playerId: this.currentPlayerId,
               standingOrders: updatedStandingOrders
            })
         });

         if (!updateResponse.ok)
         {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || 'Failed to cancel standing order');
         }

         const result = await updateResponse.json();
         console.log('🚢 ShipSummaryDialog: Standing order cancelled successfully:', result);

         // Refresh data to update the table
         await this.refreshData();

      }
      catch (error)
      {
         console.error('🚢 ShipSummaryDialog: Error cancelling standing order', error);
         alert(`Error cancelling standing order: ${error.message}`);
      }
   }

   /**
    * Render moving ships cell.
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    * @param {Object|null} dest - Destination object for this row
    */
   renderMovingShipsCell(cell, row, dest)
   {
      cell.className += ' ship-cell-moving-ships';

      // Get selected destination for this star
      const selectedDestId = this.selectedDestinations.get(row.starId);
      
      // Only show moving ships if this destination is selected
      if (!dest || dest.starId !== selectedDestId || !dest.movingShips || dest.movingShips.length === 0)
      {
         cell.textContent = '—';
         return;
      }

      // Create scrollable container that shows up to 5 ships at a time
      // maxHeight is set in CSS to 8.4em
      const container = document.createElement('div');
      container.className = 'ship-list-container';
      container.style.overflowY = 'auto';
      container.style.overflowX = 'hidden';

      dest.movingShips.forEach((ship) =>
      {
         const shipItem = this.createShipItem(ship);
         container.appendChild(shipItem);
      });

      cell.appendChild(container);
   }

   /**
    * Toggle filter menu for a column.
    * @param {string} columnKey - Column key
    * @param {HTMLElement} anchor - Anchor element
    */
   toggleFilterMenu(columnKey, anchor)
   {
      if (this.activeFilterColumnKey === columnKey && this.filterMenu.style.display !== 'none')
      {
         this.closeFilterMenu();
         return;
      }

      this.activeFilterColumnKey = columnKey;
      this.filterMenuAnchor = anchor;
      this.renderFilterMenu();
      this.positionFilterMenu();
      this.filterMenu.style.display = 'block';

      // Close menu when clicking outside
      setTimeout(() =>
      {
         document.addEventListener('click', this.handleFilterMenuDocumentClick);
      }, 0);
   }

   /**
    * Close filter menu.
    */
   closeFilterMenu()
   {
      this.filterMenu.style.display = 'none';
      this.activeFilterColumnKey = null;
      this.filterMenuAnchor = null;
      document.removeEventListener('click', this.handleFilterMenuDocumentClick);
   }

   /**
    * Handle filter menu document click.
    * @param {Event} event - Click event
    */
   handleFilterMenuDocumentClick = (event) =>
   {
      if (!this.filterMenu.contains(event.target) && !this.filterMenuAnchor?.contains(event.target))
      {
         this.closeFilterMenu();
      }
   };

   /**
    * Position filter menu relative to anchor.
    */
   positionFilterMenu()
   {
      if (!this.filterMenuAnchor)
      {
         return;
      }

      const rect = this.filterMenuAnchor.getBoundingClientRect();
      this.filterMenu.style.position = 'fixed';
      this.filterMenu.style.top = `${rect.bottom + 5}px`;
      this.filterMenu.style.left = `${rect.left}px`;
      this.filterMenu.style.zIndex = '10000';
   }

   /**
    * Render filter menu.
    */
   renderFilterMenu()
   {
      if (!this.activeFilterColumnKey)
      {
         return;
      }

      const column = this.columns.find((col) => col.key === this.activeFilterColumnKey);
      if (!column || !column.filterType)
      {
         return;
      }

      this.filterMenu.innerHTML = '';

      const title = document.createElement('div');
      title.className = 'ship-filter-title';
      title.textContent = `Filter ${column.label}`;
      this.filterMenu.appendChild(title);

      const content = document.createElement('div');
      content.className = 'ship-filter-content';

      if (column.filterType === 'text')
      {
         this.renderTextFilter(content, column);
      }

      this.filterMenu.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'ship-filter-actions';

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'ship-filter-clear-btn';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () =>
      {
         delete this.activeFilters[column.key];
         this.closeFilterMenu();
         this.renderRows();
      });

      actions.appendChild(clearBtn);
      this.filterMenu.appendChild(actions);
   }

   /**
    * Render text filter.
    * @param {HTMLElement} container - Container element
    * @param {Object} column - Column definition
    */
   renderTextFilter(container, column)
   {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ship-filter-text';
      input.placeholder = 'Enter text to search...';
      input.value = this.activeFilters[column.key]?.value || '';

      input.addEventListener('input', (event) =>
      {
         const value = event.target.value.trim();
         if (value)
         {
            this.activeFilters[column.key] = {
               type: 'text',
               value: value
            };
         }
         else
         {
            delete this.activeFilters[column.key];
         }

         this.renderRows();
      });

      container.appendChild(input);
   }

   /**
    * Refresh data from server.
    */
   async refreshData()
   {
      console.log('🚢 ShipSummaryDialog: refreshData called with:', {
         gameId: this.currentGameId,
         turnId: this.currentTurnId,
         playerId: this.currentPlayerId
      });
      
      if (!this.currentGameId || !this.currentTurnId || !this.currentPlayerId)
      {
         console.warn('🚢 ShipSummaryDialog: Missing gameId, turnId, or playerId', {
            gameId: this.currentGameId,
            turnId: this.currentTurnId,
            playerId: this.currentPlayerId
         });
         return;
      }

      try
      {
         console.log('🚢 ShipSummaryDialog: Calling getShipSummaryRows...');
         this.rows = await getShipSummaryRows(this.currentGameId, this.currentTurnId, this.currentPlayerId);
         console.log('🚢 ShipSummaryDialog: Received', this.rows.length, 'rows from getShipSummaryRows');
         console.log('🚢 ShipSummaryDialog: Rows data:', this.rows);
         this.renderRows();
      }
      catch (error)
      {
         console.error('🚢 ShipSummaryDialog: Error refreshing data', error);
      }
   }

   /**
    * Show dialog.
    */
   async show()
   {
      // Get current context
      const context = eventBus.getContext();
      this.currentGameId = context?.gameId || this.currentGameId;
      this.currentPlayerId = context?.playerId || this.currentPlayerId; // Use playerId, not user (user is user_id)

      console.log('🚢 ShipSummaryDialog: show() called, context:', context);
      console.log('🚢 ShipSummaryDialog: Current IDs before fetch:', {
         gameId: this.currentGameId,
         turnId: this.currentTurnId,
         playerId: this.currentPlayerId
      });

      // Get current turn if not already set
      if (!this.currentTurnId && this.currentGameId)
      {
         try
         {
            console.log('🚢 ShipSummaryDialog: Fetching current turn from:', `/api/games/${this.currentGameId}/turn/open`);
            const response = await fetch(`/api/games/${this.currentGameId}/turn/open`, {
               headers: RB.getHeadersForGet()
            });
            if (response.ok)
            {
               const result = await response.json();
               if (result.success && result.turn)
               {
                  this.currentTurnId = result.turn.id;
                  console.log('🚢 ShipSummaryDialog: Fetched current turn ID:', this.currentTurnId);
               }
               else
               {
                  console.warn('🚢 ShipSummaryDialog: No turn found in response:', result);
               }
            }
            else
            {
               console.error('🚢 ShipSummaryDialog: Failed to get current turn:', response.statusText);
            }
         }
         catch (error)
         {
            console.error('🚢 ShipSummaryDialog: Error fetching current turn', error);
         }
      }

      console.log('🚢 ShipSummaryDialog: Final IDs:', {
         gameId: this.currentGameId,
         turnId: this.currentTurnId,
         playerId: this.currentPlayerId
      });

      super.show();
      await this.refreshData();
   }

   /**
    * Hide dialog.
    */
   hide()
   {
      this.closeFilterMenu();
      super.hide();
   }
}

