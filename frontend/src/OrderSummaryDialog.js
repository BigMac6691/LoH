import { BaseDialog } from './BaseDialog.js';
import { getOrderSummaryRows } from './utils/orderSummary.js';
import { eventBus } from './eventBus.js';
import { RB, ApiError } from './utils/RequestBuilder.js';

/**
 * OrderSummaryDialog - Displays a sortable summary of orders for the current turn.
 */
export class OrderSummaryDialog extends BaseDialog
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

      this.columns = [
         {key: 'starName', label: 'Star Name', type: 'text', visible: true, filterType: 'text', sortable: true, filterable: true},
         {key: 'orderType', label: 'Order Type', type: 'text', visible: true, filterType: 'picklist', sortable: true, filterable: true},
         {key: 'industry', label: 'Industry', type: 'number', visible: true, filterType: 'range', sortable: true, filterable: true},
         {key: 'research', label: 'Research', type: 'number', visible: true, filterType: 'range', sortable: true, filterable: true},
         {key: 'build', label: 'Build', type: 'number', visible: true, filterType: 'range', sortable: true, filterable: true},
         {key: 'move', label: 'Move', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
         {key: 'destination', label: 'Destination', type: 'text', visible: true, filterType: 'text', sortable: true, filterable: true},
         {key: 'actions', label: 'Actions', type: 'text', visible: true, filterType: null, sortable: false, filterable: false},
      ];

      this.orderTypeOptions = [
         {value: 'build', label: 'Build'},
         {value: 'move', label: 'Move'},
         {value: 'auto_build', label: 'Auto Build'},
         {value: 'auto_move', label: 'Auto Move'},
         {value: '---', label: '---'}
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
   }

   /**
    * Create dialog DOM structure.
    */
   createDialog()
   {
      this.dialog = document.createElement('div');
      this.dialog.className = 'order-dialog dialog-base';
      this.dialog.style.width = '1000px';
      this.dialog.style.maxWidth = '90vw';

      const header = document.createElement('div');
      header.className = 'dialog-header';

      const title = document.createElement('h2');
      title.className = 'dialog-title';
      title.textContent = 'Order Summary';

      const controls = document.createElement('div');
      controls.className = 'order-header-controls';

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'order-refresh-btn';
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
      content.className = 'order-dialog-content';

      this.tableContainer = document.createElement('div');
      this.tableContainer.className = 'order-table-container';

      this.table = document.createElement('table');
      this.table.className = 'order-table';

      this.thead = document.createElement('thead');
      this.table.appendChild(this.thead);
      this.buildTableHeader();

      this.tableBody = document.createElement('tbody');
      this.table.appendChild(this.tableBody);

      this.emptyState = document.createElement('div');
      this.emptyState.className = 'order-empty-state';
      this.emptyState.textContent = 'No orders to display.';

      this.tableContainer.appendChild(this.table);
      this.tableContainer.appendChild(this.emptyState);
      content.appendChild(this.tableContainer);

      const footer = document.createElement('div');
      footer.className = 'order-dialog-footer';
      footer.textContent = 'Click a column header to sort. Click refresh to pull the latest data.';

      this.dialog.appendChild(header);
      this.dialog.appendChild(content);
      this.dialog.appendChild(footer);

      document.body.appendChild(this.dialog);

      this.filterMenu = document.createElement('div');
      this.filterMenu.className = 'order-filter-menu';
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
      headerRow.className = 'order-table-header-row';

      this.columns.forEach((column) =>
      {
         const th = document.createElement('th');
         th.scope = 'col';
         th.className = `order-table-header ${column.sortable ? 'order-sortable' : ''} ${column.filterable ? 'order-filterable' : ''} ${column.key === 'actions' ? 'order-header-actions order-header-center' : ''}`;
         th.dataset.key = column.key;

         if (column.key === 'actions')
         {
            // Actions column - no sort/filter, just label
            th.textContent = column.label;
         }
         else
         {
            const headerContent = document.createElement('span');
            headerContent.className = 'order-header-content';

            if (column.sortable || column.filterable)
            {
               const iconsContainer = document.createElement('span');
               iconsContainer.className = 'order-header-icons';

               if (column.sortable)
               {
                  const sortIndicator = document.createElement('span');
                  sortIndicator.className = 'order-sort-indicator';
                  sortIndicator.textContent = '';
                  iconsContainer.appendChild(sortIndicator);
               }

               if (column.filterable)
               {
                  const filterBtn = document.createElement('button');
                  filterBtn.type = 'button';
                  filterBtn.className = 'order-filter-btn';
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
            label.className = 'order-header-label';
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
               th.classList.add('order-header-filtered');
            }

            const indicator = th.querySelector('.order-sort-indicator');
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
    * Handle sort requests for a specific column.
    * @param {string} columnKey - Column key to sort by.
    */
   handleSort(columnKey)
   {
      const columnConfig = this.columns.find(column => column.key === columnKey);
      if (!columnConfig || columnConfig.sortable === false)
      {
         return;
      }

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
    * Update header sort indicators based on current sort state.
    */
   updateHeaderSortIndicators()
   {
      this.headerCells.forEach(({element, indicator}, key) =>
      {
         if (!indicator)
         {
            return;
         }

         if (key === this.sortColumn)
         {
            indicator.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
            element.classList.add('order-sorted');
         }
         else
         {
            indicator.textContent = '';
            element.classList.remove('order-sorted');
         }
      });
   }

   /**
    * Fetch latest data and render.
    */
   async refreshData()
   {
      if (!this.currentGameId || !this.currentTurnId || !this.currentPlayerId)
      {
         console.warn('📋 OrderSummaryDialog: Cannot refresh - missing game, turn, or player data');
         return;
      }

      try
      {
         this.rows = await getOrderSummaryRows(this.currentGameId, this.currentTurnId, this.currentPlayerId);
         this.renderRows();
         this.updateHeaderSortIndicators();
      }
      catch (error)
      {
         console.error('📋 OrderSummaryDialog: Failed to refresh orders', error);
         this.rows = [];
         this.renderRows();
      }
   }

   /**
    * Get filtered and sorted rows.
    * @returns {Array<Object>} Filtered and sorted rows
    */
   getFilteredAndSortedRows()
   {
      let filtered = this.rows;

      // Apply filters
      if (Object.keys(this.activeFilters).length > 0)
      {
         filtered = filtered.filter((row) => this.shouldIncludeRow(row));
      }

      // Group by star first to maintain grouping when sorting
      const rowsByStar = new Map();
      filtered.forEach((row) =>
      {
         const starId = row.starId;
         if (!rowsByStar.has(starId))
         {
            rowsByStar.set(starId, []);
         }
         rowsByStar.get(starId).push(row);
      });

      // Sort rows within each star group
      rowsByStar.forEach((starRows) =>
      {
         starRows.sort((a, b) =>
         {
            const aValue = a[this.sortColumn];
            const bValue = b[this.sortColumn];

            if (aValue === null || aValue === undefined)
            {
               return 1;
            }
            if (bValue === null || bValue === undefined)
            {
               return -1;
            }

            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string')
            {
               comparison = aValue.localeCompare(bValue);
            }
            else if (typeof aValue === 'number' && typeof bValue === 'number')
            {
               comparison = aValue - bValue;
            }
            else
            {
               comparison = String(aValue).localeCompare(String(bValue));
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
         });
      });

      // Sort star groups by the first row's sort column value (or starName if sorting by starName)
      const sortedStars = Array.from(rowsByStar.entries()).sort(([starIdA, rowsA], [starIdB, rowsB]) =>
      {
         // If sorting by starName, use starName for comparison
         if (this.sortColumn === 'starName')
         {
            const comparison = rowsA[0].starName.localeCompare(rowsB[0].starName);
            return this.sortDirection === 'asc' ? comparison : -comparison;
         }

         // Otherwise, use the sort column value from the first row of each group
         const aValue = rowsA[0][this.sortColumn];
         const bValue = rowsB[0][this.sortColumn];

         if (aValue === null || aValue === undefined)
         {
            return 1;
         }
         if (bValue === null || bValue === undefined)
         {
            return -1;
         }

         let comparison = 0;
         if (typeof aValue === 'string' && typeof bValue === 'string')
         {
            comparison = aValue.localeCompare(bValue);
         }
         else if (typeof aValue === 'number' && typeof bValue === 'number')
         {
            comparison = aValue - bValue;
         }
         else
         {
            comparison = String(aValue).localeCompare(String(bValue));
         }

         return this.sortDirection === 'asc' ? comparison : -comparison;
      });

      // Flatten back to array, maintaining star grouping
      const result = [];
      sortedStars.forEach(([starId, starRows]) =>
      {
         result.push(...starRows);
      });

      return result;
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
         const value = row[columnKey];

         if (filter.type === 'text')
         {
            const searchText = filter.value.toLowerCase();
            const rowValue = String(value || '').toLowerCase();
            if (!rowValue.includes(searchText))
            {
               return false;
            }
         }
         else if (filter.type === 'picklist')
         {
            if (!filter.values || filter.values.length === 0)
            {
               continue;
            }
            if (!filter.values.includes(value))
            {
               return false;
            }
         }
         else if (filter.type === 'range')
         {
            const numValue = Number(value);
            if (isNaN(numValue))
            {
               return false;
            }
            if (filter.min !== undefined && numValue < filter.min)
            {
               return false;
            }
            if (filter.max !== undefined && numValue > filter.max)
            {
               return false;
            }
         }
      }

      return true;
   }

   /**
    * Render table rows from current data.
    */
   renderRows()
   {
      if (!this.tableBody)
      {
         return;
      }

      this.tableBody.innerHTML = '';

      const rows = this.getFilteredAndSortedRows();
      if (!rows.length)
      {
         this.table.setAttribute('aria-hidden', 'true');
         this.emptyState.style.display = 'flex';
         return;
      }

      this.table.removeAttribute('aria-hidden');
      this.emptyState.style.display = 'none';

      // Group consecutive rows by star to calculate rowspan
      // After sorting, we need to identify groups of consecutive rows with the same starId
      const renderedStars = new Set();
      let currentStarGroup = null;
      let currentStarGroupRows = [];

      rows.forEach((row, index) =>
      {
         const starId = row.starId;
         const isNewStarGroup = currentStarGroup === null || currentStarGroup !== starId;

         if (isNewStarGroup)
         {
            // Render previous star group if any
            if (currentStarGroupRows.length > 0)
            {
               this.renderStarGroup(currentStarGroupRows, renderedStars);
            }

            // Start new star group
            currentStarGroup = starId;
            currentStarGroupRows = [row];
         }
         else
         {
            // Add to current star group
            currentStarGroupRows.push(row);
         }
      });

      // Render final star group
      if (currentStarGroupRows.length > 0)
      {
         this.renderStarGroup(currentStarGroupRows, renderedStars);
      }
   }

   /**
    * Render a group of rows for a single star
    * @param {Array<Object>} starRows - Rows for this star
    * @param {Set<string>} renderedStars - Set of stars that have been rendered
    */
   renderStarGroup(starRows, renderedStars)
   {
      const starId = starRows[0].starId;
      const isFirstRowForStar = !renderedStars.has(starId);
      const rowSpan = starRows.length;

      if (isFirstRowForStar)
      {
         renderedStars.add(starId);
      }

      starRows.forEach((row, index) =>
      {
         const tr = document.createElement('tr');
         tr.className = 'order-table-row';

         const isFirstRow = index === 0;

         this.columns.forEach((column) =>
         {
            if (column.key === 'starName' && !isFirstRow)
            {
               // Skip star name cell for subsequent rows (rowspan handles it)
               return;
            }

            const td = document.createElement('td');
            td.className = `order-cell order-cell-${column.type}`;

            if (column.key === 'starName')
            {
               // Only render star name in first row, with rowspan
               td.textContent = row.starName || '';
               td.rowSpan = rowSpan;
               td.className += ' order-cell-star-name order-cell-vertically-centered';
               // Apply owner color to star name
               if (row.starNameColor)
               {
                  td.style.color = row.starNameColor;
               }
            }
            else if (column.key === 'orderType')
            {
               td.textContent = this.getOrderTypeDisplay(row.orderType);
            }
            else if (column.key === 'industry')
            {
               td.textContent = row.industry !== null && row.industry !== undefined ? this.formatIndustryValue(row.industry, row) : '—';
               td.className += ' order-cell-number';
            }
            else if (column.key === 'research')
            {
               td.textContent = row.research !== null && row.research !== undefined ? this.formatIndustryValue(row.research, row) : '—';
               td.className += ' order-cell-number';
            }
            else if (column.key === 'build')
            {
               td.textContent = row.build !== null && row.build !== undefined ? this.formatIndustryValue(row.build, row) : '—';
               td.className += ' order-cell-number';
            }
            else if (column.key === 'move')
            {
               this.renderMoveCell(td, row);
            }
            else if (column.key === 'destination')
            {
               td.textContent = row.destination || '—';
               // Apply owner color to destination star name
               if (row.destination && row.destinationColor)
               {
                  td.style.color = row.destinationColor;
               }
               else if (!row.destination)
               {
                  // Reset to default color for '—'
                  td.style.color = '';
               }
            }
            else if (column.key === 'actions')
            {
               this.renderActionsCell(td, row);
            }
            else
            {
               td.textContent = row[column.key] || '';
            }

            tr.appendChild(td);
         });

         this.tableBody.appendChild(tr);
      });
   }

   /**
    * Get order type display label
    * @param {string} orderType - Order type
    * @returns {string} Display label
    */
   getOrderTypeDisplay(orderType)
   {
      if (!orderType || orderType === '---')
      {
         return '---';
      }

      const labels = {
         'build': 'Build',
         'move': 'Move',
         'auto_build': 'Auto Build',
         'auto_move': 'Auto Move'
      };

      return labels[orderType] || orderType;
   }

   /**
    * Format industry value (percentage or actual value)
    * @param {number} value - Value to format
    * @param {Object} row - Row data
    * @returns {string} Formatted value
    */
   formatIndustryValue(value, row)
   {
      if (value === null || value === undefined)
      {
         return '—';
      }

      // Check if this is a standing order (percentage)
      const isStandingOrder = row.order && row.order.payload && row.order.payload.fromStandingOrder;
      if (isStandingOrder && value <= 100)
      {
         return `${value}%`;
      }

      return value.toLocaleString();
   }

   /**
    * Render move cell with ship list or "Auto"
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    */
   renderMoveCell(cell, row)
   {
      cell.className += ' order-cell-move';

      if (!row.move)
      {
         cell.textContent = '—';
         return;
      }

      const {shipIds, isAuto, isEmpty} = row.move;

      if (isAuto && isEmpty)
      {
         cell.textContent = 'Auto';
         return;
      }

      if (!shipIds || shipIds.length === 0)
      {
         cell.textContent = '—';
         return;
      }

      // Create scrollable container that shows up to 5 ships at a time
      // maxHeight is set in CSS to 8.4em
      const container = document.createElement('div');
      container.className = 'order-move-ship-list';
      container.style.overflowY = 'auto';
      container.style.overflowX = 'hidden';

      // Show all ships in the list
      shipIds.forEach((shipId) =>
      {
         const shipItem = document.createElement('div');
         shipItem.className = 'order-move-ship-item';
         // Show only last 5 characters of ship ID
         const shortId = String(shipId).slice(-5);
         shipItem.textContent = `Ship-${shortId}`;
         container.appendChild(shipItem);
      });

      cell.appendChild(container);
   }

   /**
    * Render actions cell with cancel button
    * @param {HTMLTableCellElement} cell - Cell element
    * @param {Object} row - Row data
    */
   renderActionsCell(cell, row)
   {
      cell.className += ' order-cell-actions';

      if (!row.order || !row.order.id)
      {
         cell.textContent = '—';
         return;
      }

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'order-action-btn order-cancel-btn';
      cancelButton.textContent = 'Cancel';
      cancelButton.dataset.orderId = row.order.id;
      cancelButton.addEventListener('click', (event) =>
      {
         event.stopPropagation();
         this.handleCancelOrder(row.order.id);
      });

      cell.appendChild(cancelButton);
   }

   /**
    * Handle cancel order action
    * @param {string} orderId - Order ID to cancel
    */
   async handleCancelOrder(orderId)
   {
      if (!this.currentGameId || !this.currentPlayerId)
      {
         console.error('📋 OrderSummaryDialog: Cannot cancel order - missing gameId or playerId');
         alert('Error: Cannot cancel order - missing game or player information');
         return;
      }

      if (!confirm('Are you sure you want to cancel this order?'))
      {
         return;
      }

      try
      {
         const result = await RB.fetchDelete(`/api/orders/${orderId}?gameId=${this.currentGameId}&playerId=${this.currentPlayerId}`);
         console.log('📋 OrderSummaryDialog: Order cancelled successfully:', result);

         // Refresh data to update the table
         await this.refreshData();

      }
      catch (error)
      {
         console.error('📋 OrderSummaryDialog: Error cancelling order', error);
         alert(`Error cancelling order: ${error.message}`);
      }
   }

   /**
    * Toggle filter menu for a column
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
    * Position filter menu relative to anchor
    */
   positionFilterMenu()
   {
      if (!this.filterMenuAnchor || !this.filterMenu)
      {
         return;
      }

      const anchorRect = this.filterMenuAnchor.getBoundingClientRect();
      const menuRect = this.filterMenu.getBoundingClientRect();
      const dialogRect = this.dialog.getBoundingClientRect();

      let top = anchorRect.bottom + 5;
      let left = anchorRect.left;

      // Adjust if menu would go off screen
      if (left + menuRect.width > dialogRect.right)
      {
         left = dialogRect.right - menuRect.width - 10;
      }

      this.filterMenu.style.top = `${top - dialogRect.top}px`;
      this.filterMenu.style.left = `${left - dialogRect.left}px`;
   }

   /**
    * Close filter menu
    */
   closeFilterMenu()
   {
      this.filterMenu.style.display = 'none';
      this.activeFilterColumnKey = null;
      this.filterMenuAnchor = null;
      document.removeEventListener('click', this.handleFilterMenuDocumentClick);
   }

   /**
    * Handle document click to close filter menu
    * @param {MouseEvent} event - Click event
    */
   handleFilterMenuDocumentClick = (event) =>
   {
      if (!this.filterMenu.contains(event.target) && !this.filterMenuAnchor?.contains(event.target))
      {
         this.closeFilterMenu();
      }
   };

   /**
    * Render filter menu
    */
   renderFilterMenu()
   {
      if (!this.activeFilterColumnKey)
      {
         return;
      }

      const column = this.columns.find(col => col.key === this.activeFilterColumnKey);
      if (!column || !column.filterable)
      {
         return;
      }

      this.filterMenu.innerHTML = '';

      const title = document.createElement('div');
      title.className = 'order-filter-title';
      title.textContent = `Filter ${column.label}`;
      this.filterMenu.appendChild(title);

      const content = document.createElement('div');
      content.className = 'order-filter-content';

      if (column.filterType === 'text')
      {
         this.renderTextFilter(content, column);
      }
      else if (column.filterType === 'picklist')
      {
         this.renderPicklistFilter(content, column);
      }
      else if (column.filterType === 'range')
      {
         this.renderRangeFilter(content, column);
      }

      this.filterMenu.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'order-filter-actions';

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'order-filter-clear-btn';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () =>
      {
         delete this.activeFilters[column.key];
         this.buildTableHeader();
         this.renderRows();
         this.closeFilterMenu();
      });

      actions.appendChild(clearBtn);
      this.filterMenu.appendChild(actions);
   }

   /**
    * Render text filter
    * @param {HTMLElement} container - Container element
    * @param {Object} column - Column configuration
    */
   renderTextFilter(container, column)
   {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'order-filter-text';
      input.placeholder = 'Enter text...';
      input.value = this.activeFilters[column.key]?.value || '';

      const applyFilter = () =>
      {
         const value = input.value.trim();
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
         this.buildTableHeader();
         this.renderRows();
      };

      input.addEventListener('input', applyFilter);
      container.appendChild(input);
   }

   /**
    * Render picklist filter
    * @param {HTMLElement} container - Container element
    * @param {Object} column - Column configuration
    */
   renderPicklistFilter(container, column)
   {
      if (column.key !== 'orderType')
      {
         return;
      }

      const currentFilter = this.activeFilters[column.key];
      const selectedValues = currentFilter?.values || [];

      this.orderTypeOptions.forEach((option) =>
      {
         const item = document.createElement('div');
         item.className = 'order-filter-picklist-item';

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.id = `filter-${column.key}-${option.value}`;
         checkbox.value = option.value;
         checkbox.checked = selectedValues.includes(option.value);

         checkbox.addEventListener('change', () =>
         {
            const nextValues = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
               .map(cb => cb.value);

            if (nextValues.length === 0)
            {
               delete this.activeFilters[column.key];
            }
            else
            {
               this.activeFilters[column.key] = {
                  type: 'picklist',
                  values: nextValues
               };
            }
            this.buildTableHeader();
            this.renderRows();
         });

         const label = document.createElement('label');
         label.htmlFor = checkbox.id;
         label.textContent = option.label;

         item.appendChild(checkbox);
         item.appendChild(label);
         container.appendChild(item);
      });
   }

   /**
    * Render range filter
    * @param {HTMLElement} container - Container element
    * @param {Object} column - Column configuration
    */
   renderRangeFilter(container, column)
   {
      const currentFilter = this.activeFilters[column.key];
      const min = currentFilter?.min ?? '';
      const max = currentFilter?.max ?? '';

      const wrapper = document.createElement('div');
      wrapper.className = 'order-filter-range';

      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.className = 'order-filter-range-input';
      minInput.placeholder = 'Min';
      minInput.value = min;

      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.className = 'order-filter-range-input';
      maxInput.placeholder = 'Max';
      maxInput.value = max;

      const applyFilter = () =>
      {
         const minValue = minInput.value.trim() ? Number(minInput.value) : undefined;
         const maxValue = maxInput.value.trim() ? Number(maxInput.value) : undefined;

         if (minValue === undefined && maxValue === undefined)
         {
            delete this.activeFilters[column.key];
         }
         else
         {
            this.activeFilters[column.key] = {
               type: 'range',
               min: minValue,
               max: maxValue
            };
         }
         this.buildTableHeader();
         this.renderRows();
      };

      minInput.addEventListener('input', applyFilter);
      maxInput.addEventListener('input', applyFilter);

      wrapper.appendChild(minInput);
      wrapper.appendChild(maxInput);
      container.appendChild(wrapper);
   }

   /**
    * Show the dialog and refresh data
    */
   async show()
   {
      // Get current context
      const context = eventBus.getContext();
      this.currentGameId = context?.gameId || this.currentGameId;
      this.currentPlayerId = context?.playerId || this.currentPlayerId; // Use playerId, not user (user is user_id)

      // Get current turn if not already set
      if (!this.currentTurnId && this.currentGameId)
      {
         try
         {
            const result = await RB.fetchGet(`/api/games/${this.currentGameId}/turn/open`);
            if (result.success && result.turn)
            {
               this.currentTurnId = result.turn.id;
            }
         }
         catch (error)
         {
            // 404 is acceptable - no open turn exists
            if (error instanceof ApiError && error.status === 404)
            {
               console.warn('📋 OrderSummaryDialog: No open turn found');
            }
            else
            {
               console.error('📋 OrderSummaryDialog: Failed to get current turn', error);
            }
         }
      }

      super.show();
      await this.refreshData();
   }

   /**
    * Hide the dialog
    */
   hide()
   {
      this.closeFilterMenu();
      super.hide();
   }
}
