import { BaseDialog } from './BaseDialog.js';
import { IndustryDialog } from './IndustryDialog.js';
import { MoveDialog } from './MoveDialog.js';
import { getStarSummaryRows } from './utils/starSummary.js';

/**
 * SummaryDialog - Displays a sortable summary of known stars.
 */
export class SummaryDialog extends BaseDialog
{
   constructor()
   {
      super();

      this.rows = [];
      this.sortColumn = 'name';
      this.sortDirection = 'asc';
      this.headerCells = new Map();
      this.rowLookup = new Map();
      this.industryDialogInstance = null;
      this.moveDialogInstance = null;
      this.draggedColumnKey = null;
      this.activeFilters = {};
      this.activeFilterColumnKey = null;
      this.filterMenu = null;
      this.filterMenuAnchor = null;
      this.ownerOptions = [];

      this.allColumns = [
         {key: 'name', label: 'Star Name', type: 'text', headerClass: 'summary-header-center', visible: true, filterType: 'text'},
         {key: 'ownerName', label: 'Owner', type: 'text', headerClass: 'summary-header-center', visible: true, filterType: 'owners'},
         {key: 'resource', label: '⚒', type: 'number', visible: true, filterType: 'range', maskForNonOwner: true},
         {key: 'industryCapacity', label: '🏭', type: 'number', visible: true, filterType: 'range', maskForNonOwner: true},
         {key: 'researchLevel', label: '🧪', type: 'number', visible: true, filterType: 'range', maskForNonOwner: true},
         {key: 'availablePoints', label: '💰', type: 'number', visible: true, filterType: 'range', maskForNonOwner: true},
         {key: 'shipCount', label: '🚀', type: 'number', visible: true, filterType: 'range', maskForNonOwner: true},
         {key: 'adjacentStars', label: '⭐', type: 'text', visible: true, filterType: null, maskForNonOwner: false, sortable: false, filterable: false},
      ];
      this.columns = this.allColumns.filter(column => column.visible);

      this.createDialog();
      this.setupKeyboardHandlers();
   }

   /**
    * Create dialog DOM structure.
    */
   createDialog()
   {
      this.dialog = document.createElement('div');
      this.dialog.className = 'summary-dialog dialog-base';
      this.dialog.style.width = '900px';
      this.dialog.style.maxWidth = '90vw';

      const header = document.createElement('div');
      header.className = 'dialog-header';

      const title = document.createElement('h2');
      title.className = 'dialog-title';
      title.textContent = 'Star Summary';

      const controls = document.createElement('div');
      controls.className = 'summary-header-controls';

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'summary-refresh-btn';
      refreshButton.textContent = 'Refresh';
      refreshButton.addEventListener('click', () => this.refreshData());

      this.columnToggleWrapper = document.createElement('div');
      this.columnToggleWrapper.className = 'summary-column-toggle-wrapper';

      this.columnToggleButton = document.createElement('button');
      this.columnToggleButton.type = 'button';
      this.columnToggleButton.className = 'summary-column-toggle-btn';
      this.columnToggleButton.textContent = 'Columns ▾';
      this.columnToggleButton.addEventListener('click', (event) =>
      {
         event.stopPropagation();
         this.toggleColumnMenu();
      });

      this.columnMenu = document.createElement('div');
      this.columnMenu.className = 'summary-column-menu';
      this.renderColumnMenu();

      this.columnToggleWrapper.appendChild(this.columnToggleButton);
      this.columnToggleWrapper.appendChild(this.columnMenu);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.hide());

      controls.appendChild(refreshButton);
      controls.appendChild(this.columnToggleWrapper);
      controls.appendChild(closeBtn);

      header.appendChild(title);
      header.appendChild(controls);

      const content = document.createElement('div');
      content.className = 'summary-dialog-content';

      this.tableContainer = document.createElement('div');
      this.tableContainer.className = 'summary-table-container';

      this.table = document.createElement('table');
      this.table.className = 'summary-table';

      this.thead = document.createElement('thead');
      this.table.appendChild(this.thead);
      this.buildTableHeader();

      this.tableBody = document.createElement('tbody');
      this.table.appendChild(this.tableBody);

      this.emptyState = document.createElement('div');
      this.emptyState.className = 'summary-empty-state';
      this.emptyState.textContent = 'No stars to display.';

      this.tableContainer.appendChild(this.table);
      this.tableContainer.appendChild(this.emptyState);
      content.appendChild(this.tableContainer);

      const footer = document.createElement('div');
      footer.className = 'summary-dialog-footer';
      footer.textContent = 'Click a column header to sort. Click refresh to pull the latest data.';

      this.dialog.appendChild(header);
      this.dialog.appendChild(content);
      this.dialog.appendChild(footer);

      document.body.appendChild(this.dialog);

      this.filterMenu = document.createElement('div');
      this.filterMenu.className = 'summary-filter-menu';
      this.filterMenu.addEventListener('click', (event) => event.stopPropagation());
      this.dialog.appendChild(this.filterMenu);

      this.setupDragHandlers(header);
      this.setupActionHandlers();
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
    * Fetch latest data and render.
    */
   refreshData()
   {
      try
      {
         this.rows = getStarSummaryRows();
         this.rowLookup.clear();
         const ownerMap = new Map();
         this.rows.forEach((row) =>
         {
            if (row && row.starId !== undefined)
            {
               this.rowLookup.set(String(row.starId), row);
            }
            const optionKey = row.ownerId ?? 'neutral';
            if (!ownerMap.has(optionKey))
            {
               ownerMap.set(optionKey,
               {
                  id: row.ownerId,
                  key: optionKey,
                  label: row.ownerName || 'Neutral'
               });
            }
         });
         if (!ownerMap.has('neutral'))
         {
            ownerMap.set('neutral',
            {
               id: null,
               key: 'neutral',
               label: 'Neutral'
            });
         }
         this.ownerOptions = Array.from(ownerMap.values()).sort((a, b) => a.label.localeCompare(b.label));

         const ownerFilter = this.activeFilters.ownerName;
         if (ownerFilter && ownerFilter.type === 'owners')
         {
            const validKeys = new Set(this.ownerOptions.map(option => option.key));
            const nextValues = new Set(
               Array.from(ownerFilter.values || []).filter(value => validKeys.has(value))
            );

            if (nextValues.size === 0 || nextValues.size === validKeys.size)
            {
               delete this.activeFilters.ownerName;
            }
            else
            {
               ownerFilter.values = nextValues;
            }
         }
      }
      catch (error)
      {
         console.error('📊 SummaryDialog: Failed to build star summary rows', error);
         this.rows = [];
      }

      this.renderRows();
      this.updateHeaderSortIndicators();
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

      rows.forEach((row) =>
      {
         const tr = document.createElement('tr');
         tr.className = 'summary-table-row';

         this.columns.forEach((column) =>
         {
            const td = document.createElement('td');
            td.className = column.type === 'number' ? 'summary-cell summary-cell-number' : 'summary-cell';

            const value = row[column.key];
         if (column.key === 'adjacentStars')
         {
            this.renderAdjacentStarsCell(td, value);
            }
            else if (column.type === 'number' && typeof value === 'number')
            {
               if (column.maskForNonOwner && !row.isOwnedByCurrentPlayer)
               {
                  td.textContent = '?';
               }
               else
               {
                  td.textContent = value.toLocaleString();
               }
            }
            else if (column.type === 'number')
            {
               td.textContent = column.maskForNonOwner && !row.isOwnedByCurrentPlayer ? '?' : '';
            }
            else if (column.key === 'name')
            {
               const nameContainer = document.createElement('span');
               nameContainer.className = 'summary-name-container';

               const nameSpan = document.createElement('span');
               nameSpan.className = 'summary-name-text';
               nameSpan.textContent = value ?? '';
               nameSpan.style.color = row.ownerColor || '#FFFFFF';
               nameSpan.style.fontWeight = '600';
               nameContainer.appendChild(nameSpan);

               // Debug logging (remove after verification)
               if (row.hasStandingBuildOrders || row.hasStandingMoveOrders)
               {
                  console.log(`📊 Rendering star ${row.starId} (${value}):`, {
                     hasStandingBuildOrders: row.hasStandingBuildOrders,
                     hasStandingMoveOrders: row.hasStandingMoveOrders
                  });
               }

               if (row.hasStandingBuildOrders)
               {
                  const buildIcon = document.createElement('span');
                  buildIcon.className = 'summary-standing-icon summary-standing-build';
                  buildIcon.textContent = '🔧';
                  nameContainer.appendChild(buildIcon);
               }

               if (row.hasStandingMoveOrders)
               {
                  const moveIcon = document.createElement('span');
                  moveIcon.className = 'summary-standing-icon summary-standing-move';
                  moveIcon.textContent = '➡️';
                  nameContainer.appendChild(moveIcon);
               }

               td.appendChild(nameContainer);
            }
            else
            {
               td.textContent = value ?? '';
            }

            tr.appendChild(td);
         });

         const actionsCell = document.createElement('td');
         actionsCell.className = 'summary-cell summary-actions-cell';

         if (row.isOwnedByCurrentPlayer)
         {
            const buildButton = document.createElement('button');
            buildButton.type = 'button';
            buildButton.className = 'summary-action-btn summary-build-btn';
            buildButton.dataset.starId = String(row.starId);
            buildButton.textContent = 'Build';

            const moveButton = document.createElement('button');
            moveButton.type = 'button';
            moveButton.className = 'summary-action-btn summary-move-btn';
            moveButton.dataset.starId = String(row.starId);
            moveButton.textContent = 'Move';

            actionsCell.appendChild(buildButton);
            actionsCell.appendChild(moveButton);
         }
         tr.appendChild(actionsCell);

         this.tableBody.appendChild(tr);
      });
   }

   /**
    * Update header sort indicators based on current sort state.
    */
   updateHeaderSortIndicators()
   {
      this.headerCells.forEach(({element, indicator}, key) =>
      {
         if (key === this.sortColumn)
         {
            element.classList.add('summary-header-sorted');
            if (indicator)
            {
               indicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
            }
         }
         else
         {
            element.classList.remove('summary-header-sorted');
            if (indicator)
            {
               indicator.textContent = '';
            }
         }
      });
   }

   /**
    * Return rows sorted per current state.
    * @returns {Array<Object>}
    */
   getFilteredAndSortedRows()
   {
      const filtered = this.rows.filter(row => this.shouldIncludeRow(row));

      const sortableColumn = this.columns.find((column) => column.key === this.sortColumn && column.sortable !== false);
      if (!sortableColumn)
      {
         const fallbackColumn = this.columns.find(column => column.sortable !== false);
         if (fallbackColumn)
         {
            this.sortColumn = fallbackColumn.key;
            this.sortDirection = 'asc';
            return this.getFilteredAndSortedRows();
         }
         return filtered;
      }

      const sorted = [...filtered];
      sorted.sort((a, b) =>
      {
         let valueA = a[this.sortColumn];
         let valueB = b[this.sortColumn];

         if (sortableColumn.type === 'number')
         {
            if (sortableColumn.maskForNonOwner)
            {
               if (!a.isOwnedByCurrentPlayer)
               {
                  valueA = Number.NaN;
               }
               if (!b.isOwnedByCurrentPlayer)
               {
                  valueB = Number.NaN;
               }
            }

            const numberA = typeof valueA === 'number' ? valueA : Number(valueA);
            const numberB = typeof valueB === 'number' ? valueB : Number(valueB);
            const validA = Number.isFinite(numberA);
            const validB = Number.isFinite(numberB);

            if (!validA && !validB)
            {
               return 0;
            }
            if (!validA)
            {
               return 1;
            }
            if (!validB)
            {
               return -1;
            }

            return this.sortDirection === 'asc' ? numberA - numberB : numberB - numberA;
         }

         const stringA = (valueA ?? '').toString().toLowerCase();
         const stringB = (valueB ?? '').toString().toLowerCase();

         if (stringA === stringB)
         {
            return 0;
         }

         if (this.sortDirection === 'asc')
         {
            return stringA > stringB ? 1 : -1;
         }

         return stringA < stringB ? 1 : -1;
      });

      return sorted;
   }

   shouldIncludeRow(row)
   {
      for (const [columnKey, filter] of Object.entries(this.activeFilters))
      {
         if (!filter)
         {
            continue;
         }

         switch (filter.type)
         {
            case 'text':
            {
               const value = (row[columnKey] ?? '').toString().toLowerCase();
               if (!value.includes(filter.value))
               {
                  return false;
               }
               break;
            }
            case 'owners':
            {
               const ownerKey = row.ownerId ?? 'neutral';
               if (!filter.values || !filter.values.has(ownerKey))
               {
                  return false;
               }
               break;
            }
            case 'range':
            {
               const columnConfig = this.allColumns.find(col => col.key === columnKey);
               const requiresOwnership = columnConfig?.maskForNonOwner;

               if (requiresOwnership && !row.isOwnedByCurrentPlayer)
               {
                  return false;
               }

               const rawValue = row[columnKey];
               if (rawValue === null || rawValue === undefined)
               {
                  return false;
               }

               const numericValue = Number(rawValue);
               if (!Number.isFinite(numericValue))
               {
                  return false;
               }

               if (filter.min !== null && filter.min !== undefined && numericValue < filter.min)
               {
                  return false;
               }
               if (filter.max !== null && filter.max !== undefined && numericValue > filter.max)
               {
                  return false;
               }
               break;
            }
            default:
               break;
         }
      }

      return true;
   }

   /**
    * Override show to refresh data each time dialog opens.
    */
   show()
   {
      this.refreshData();
      super.show();
   }

   hide()
   {
      if (this.columnMenu && this.columnMenu.classList.contains('open'))
      {
         this.columnMenu.classList.remove('open');
         document.removeEventListener('click', this.handleDocumentClick);
      }

      super.hide();
   }

   /**
    * Build or rebuild the table header.
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

      this.columns.forEach((column, index) =>
      {
         const th = document.createElement('th');
         th.scope = 'col';
         th.dataset.key = column.key;
         th.className = 'summary-table-header';
         if (column.headerClass)
         {
            th.classList.add(column.headerClass);
         }
         th.draggable = true;

         const isSortable = column.sortable !== false;
         const isFilterable = column.filterType && column.filterable !== false;

         if (isSortable)
         {
            th.tabIndex = 0;
            th.setAttribute('role', 'button');
            th.setAttribute('aria-label', `Sort by ${column.label}`);
         }
         else
         {
            th.tabIndex = -1;
         }

         const headerContent = document.createElement('span');
         headerContent.className = 'summary-header-content';

         let indicator = null;
         let filterButton = null;
         let hasIcons = false;

         if (isSortable)
         {
            indicator = document.createElement('span');
            indicator.className = 'summary-sort-indicator';
            hasIcons = true;
         }

         if (isFilterable)
         {
            filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = 'summary-filter-btn';
            filterButton.innerHTML = '⚙︎';
            filterButton.setAttribute('aria-label', `Filter ${column.label}`);
            filterButton.addEventListener('click', (event) =>
            {
               event.stopPropagation();
               this.toggleFilterMenu(column.key, filterButton);
            });
            hasIcons = true;
         }

         if (hasIcons)
         {
            const iconGroup = document.createElement('span');
            iconGroup.className = 'summary-header-icons';
            if (indicator)
            {
               iconGroup.appendChild(indicator);
            }
            if (filterButton)
            {
               iconGroup.appendChild(filterButton);
            }
            headerContent.appendChild(iconGroup);
         }

         const labelSpan = document.createElement('span');
         labelSpan.className = 'summary-header-label';
         labelSpan.textContent = column.label;
         headerContent.appendChild(labelSpan);

         th.appendChild(headerContent);

         if (filterButton && this.activeFilters[column.key])
         {
            th.classList.add('summary-header-filtered');
            filterButton.classList.add('active');
         }

         if (filterButton && this.activeFilterColumnKey === column.key && this.filterMenu?.classList.contains('open'))
         {
            this.filterMenuAnchor = filterButton;
            this.positionFilterMenu(filterButton);
         }

         if (isSortable)
         {
            th.addEventListener('click', (event) =>
            {
               if (event.target === filterButton)
               {
                  return;
               }
               this.handleSort(column.key);
            });
            th.addEventListener('keydown', (event) =>
            {
               if (event.key === 'Enter' || event.key === ' ')
               {
                  event.preventDefault();
                  this.handleSort(column.key);
               }
            });
         }

         th.addEventListener('dragstart', (event) => this.handleHeaderDragStart(event, column.key));
         th.addEventListener('dragover', (event) => this.handleHeaderDragOver(event));
         th.addEventListener('dragleave', (event) => this.handleHeaderDragLeave(event));
         th.addEventListener('drop', (event) => this.handleHeaderDrop(event, column.key, index));
         th.addEventListener('dragend', () => this.handleHeaderDragEnd());

         this.headerCells.set(column.key, {element: th, indicator});
         headerRow.appendChild(th);
      });

      const actionsHeader = document.createElement('th');
      actionsHeader.className = 'summary-table-header summary-actions-header';
      actionsHeader.textContent = 'Actions';
      headerRow.appendChild(actionsHeader);

      this.thead.appendChild(headerRow);
      this.updateHeaderSortIndicators();
   }

   handleHeaderDragStart(event, columnKey)
   {
      this.draggedColumnKey = columnKey;
      if (event.dataTransfer)
      {
         event.dataTransfer.effectAllowed = 'move';
         event.dataTransfer.setData('text/plain', columnKey);
      }
   }

   handleHeaderDragOver(event)
   {
      event.preventDefault();
      if (event.currentTarget instanceof HTMLElement)
      {
         event.currentTarget.classList.add('summary-header-drag-over');
      }
      if (event.dataTransfer)
      {
         event.dataTransfer.dropEffect = 'move';
      }
   }

   handleHeaderDragLeave(event)
   {
      if (event.currentTarget instanceof HTMLElement)
      {
         event.currentTarget.classList.remove('summary-header-drag-over');
      }
   }

   handleHeaderDrop(event, targetColumnKey, targetVisibleIndex)
   {
      event.preventDefault();
      if (event.currentTarget instanceof HTMLElement)
      {
         event.currentTarget.classList.remove('summary-header-drag-over');
      }

      const sourceKey = this.draggedColumnKey || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : null);
      if (!sourceKey || sourceKey === targetColumnKey)
      {
         return;
      }

      const sourceVisibleIndex = this.columns.findIndex(column => column.key === sourceKey);
      if (sourceVisibleIndex === -1 || targetVisibleIndex === -1 || sourceVisibleIndex === targetVisibleIndex)
      {
         return;
      }

      const sourceAllIndex = this.allColumns.findIndex(column => column.key === sourceKey);
      const targetAllIndex = this.allColumns.findIndex(column => column.key === targetColumnKey);

      if (sourceAllIndex === -1 || targetAllIndex === -1)
      {
         return;
      }

      const [movedColumn] = this.allColumns.splice(sourceAllIndex, 1);
      this.allColumns.splice(targetAllIndex, 0, movedColumn);

      this.columns = this.allColumns.filter(column => column.visible);

      this.buildTableHeader();
      this.renderRows();
   }

   handleHeaderDragEnd()
   {
      this.draggedColumnKey = null;
      this.headerCells.forEach(({element}) =>
      {
         element.classList.remove('summary-header-drag-over');
      });
   }

   toggleFilterMenu(columnKey, anchorElement)
   {
      if (!this.filterMenu || !anchorElement)
      {
         return;
      }

      if (this.columnMenu && this.columnMenu.classList?.contains('open'))
      {
         this.columnMenu.classList.remove('open');
         document.removeEventListener('click', this.handleColumnMenuDocumentClick);
      }

      if (this.activeFilterColumnKey === columnKey && this.filterMenu.classList.contains('open'))
      {
         this.closeFilterMenu();
         return;
      }

      this.activeFilterColumnKey = columnKey;
      this.filterMenuAnchor = anchorElement;
      this.renderFilterMenu();

      this.filterMenu.style.visibility = 'hidden';
      this.filterMenu.classList.add('open');
      this.positionFilterMenu(anchorElement);
      this.filterMenu.style.visibility = '';

      document.addEventListener('click', this.handleFilterMenuDocumentClick);
   }

   positionFilterMenu(anchorElement)
   {
      if (!this.filterMenu || !anchorElement || !this.dialog)
      {
         return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const dialogRect = this.dialog.getBoundingClientRect();

      const menuWidth = this.filterMenu.offsetWidth || this.filterMenu.getBoundingClientRect().width || 0;
      const menuHeight = this.filterMenu.offsetHeight || this.filterMenu.getBoundingClientRect().height || 0;

      let top = anchorRect.bottom - dialogRect.top + 6;
      const maxTop = dialogRect.height - menuHeight - 8;
      top = Math.min(Math.max(top, 0), Math.max(maxTop, 0));

      let left = anchorRect.right - dialogRect.left - menuWidth;
      left = Math.max(0, left);
      const maxLeft = dialogRect.width - menuWidth - 8;
      left = Math.min(left, Math.max(maxLeft, 0));

      this.filterMenu.style.top = `${top}px`;
      this.filterMenu.style.left = `${left}px`;
   }

   closeFilterMenu()
   {
      if (!this.filterMenu)
      {
         return;
      }

      this.filterMenu.classList.remove('open');
      document.removeEventListener('click', this.handleFilterMenuDocumentClick);
      this.activeFilterColumnKey = null;
      this.filterMenuAnchor = null;
   }

   handleFilterMenuDocumentClick = (event) =>
   {
      if (!this.filterMenu || !this.filterMenuAnchor)
      {
         return;
      }

      if (!this.filterMenu.contains(event.target) && event.target !== this.filterMenuAnchor)
      {
         this.closeFilterMenu();
      }
   };

   renderFilterMenu()
   {
      if (!this.filterMenu || !this.activeFilterColumnKey)
      {
         return;
      }

      const column = this.allColumns.find(col => col.key === this.activeFilterColumnKey);
      if (!column)
      {
         this.filterMenu.innerHTML = '';
         return;
      }

      this.filterMenu.innerHTML = '';

      const title = document.createElement('div');
      title.className = 'summary-filter-title';
      title.textContent = `Filter: ${column.label}`;
      this.filterMenu.appendChild(title);

      const content = document.createElement('div');
      content.className = 'summary-filter-content';
      this.filterMenu.appendChild(content);

      const controls = document.createElement('div');
      controls.className = 'summary-filter-actions';
      this.filterMenu.appendChild(controls);

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'summary-filter-clear-btn';
      clearButton.textContent = 'Clear';
      clearButton.addEventListener('click', () =>
      {
         delete this.activeFilters[column.key];
         this.closeFilterMenu();
         this.buildTableHeader();
         this.renderRows();
      });
      controls.appendChild(clearButton);

      switch (column.filterType)
      {
         case 'text':
            this.renderTextFilter(content, column);
            break;
         case 'owners':
            this.renderOwnerFilter(content, column);
            break;
         case 'range':
            this.renderRangeFilter(content, column);
            break;
         default:
            content.textContent = 'No filters available for this column.';
            break;
      }
   }

   renderTextFilter(container, column)
   {
      const wrapper = document.createElement('div');
      wrapper.className = 'summary-filter-text';

      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search star names';
      input.value = this.activeFilters[column.key]?.value || '';
      input.addEventListener('input', () =>
      {
         const value = input.value.trim().toLowerCase();
         if (value.length === 0)
         {
            delete this.activeFilters[column.key];
         }
         else
         {
            this.activeFilters[column.key] = {
               type: 'text',
               value
            };
         }
         this.positionFilterMenu(this.filterMenuAnchor);
         this.buildTableHeader();
         this.renderRows();
      });

      wrapper.appendChild(input);
      container.appendChild(wrapper);
   }

   renderOwnerFilter(container, column)
   {
      const wrapper = document.createElement('div');
      wrapper.className = 'summary-filter-owners';

      if (!this.ownerOptions.length)
      {
         const empty = document.createElement('div');
         empty.className = 'summary-filter-empty';
         empty.textContent = 'No owners available.';
         wrapper.appendChild(empty);
         container.appendChild(wrapper);
         return;
      }

      const currentFilter = this.activeFilters[column.key];
      const selectedKeys = currentFilter?.values
         ? new Set(currentFilter.values)
         : new Set(this.ownerOptions.map(option => option.key));

      this.ownerOptions.forEach((option) =>
      {
         const item = document.createElement('label');
         item.className = 'summary-filter-owner-item';

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.checked = selectedKeys.has(option.key);

         checkbox.addEventListener('change', () =>
         {
            const nextValues = new Set(selectedKeys);
            if (checkbox.checked)
            {
               nextValues.add(option.key);
            }
            else
            {
               nextValues.delete(option.key);
            }

            if (nextValues.size === this.ownerOptions.length)
            {
               delete this.activeFilters[column.key];
            }
            else
            {
               this.activeFilters[column.key] = {
                  type: 'owners',
                  values: nextValues
               };
            }
            this.renderFilterMenu();
            this.positionFilterMenu(this.filterMenuAnchor);
            this.buildTableHeader();
            this.renderRows();
         });

         const label = document.createElement('span');
         label.textContent = option.label;

         item.appendChild(checkbox);
         item.appendChild(label);
         wrapper.appendChild(item);
      });

      container.appendChild(wrapper);
   }

   renderRangeFilter(container, column)
   {
      const wrapper = document.createElement('div');
      wrapper.className = 'summary-filter-range';

      const currentFilter = this.activeFilters[column.key] || {};

      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.placeholder = 'Min';
      minInput.step = '1';
      minInput.value = currentFilter.min ?? '';

      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.placeholder = 'Max';
      maxInput.step = '1';
      maxInput.value = currentFilter.max ?? '';

      const applyFilter = () =>
      {
         const rawMin = minInput.value;
         const rawMax = maxInput.value;

         const minValue = rawMin !== '' ? Number(rawMin) : null;
         const maxValue = rawMax !== '' ? Number(rawMax) : null;

         const normalizedMin = Number.isFinite(minValue) ? minValue : null;
         const normalizedMax = Number.isFinite(maxValue) ? maxValue : null;

         if (normalizedMin === null && normalizedMax === null)
         {
            delete this.activeFilters[column.key];
         }
         else
         {
            this.activeFilters[column.key] = {
               type: 'range',
               min: normalizedMin,
               max: normalizedMax
            };
         }

         this.positionFilterMenu(this.filterMenuAnchor);
         this.buildTableHeader();
         this.renderRows();
      };

      minInput.addEventListener('input', applyFilter);
      maxInput.addEventListener('input', applyFilter);

      wrapper.appendChild(minInput);
      wrapper.appendChild(maxInput);
      container.appendChild(wrapper);
   }

   renderAdjacentStarsCell(cell, connectedIds)
   {
      const mapModel = window.globalMapModel || window.mapGenerator?.mapModel || null;
      const starIds = Array.isArray(connectedIds) ? connectedIds : [];

      if (starIds.length === 0)
      {
         const empty = document.createElement('div');
         empty.textContent = '—';
         empty.className = 'summary-adjacent-line summary-adjacent-line-empty';
         cell.appendChild(empty);
         cell.classList.add('summary-adjacent-cell');
         return;
      }

      starIds.forEach((adjacentId) =>
      {
         let label = `Star ${adjacentId}`;

         if (mapModel && typeof mapModel.getStarById === 'function')
         {
            const adjacentStar = mapModel.getStarById(adjacentId);
            if (adjacentStar && typeof adjacentStar.getName === 'function')
            {
               label = adjacentStar.getName() || label;
            }
         }

         const line = document.createElement('div');
         line.className = 'summary-adjacent-line';
         line.textContent = label;
         cell.appendChild(line);
      });

      cell.classList.add('summary-adjacent-cell');
   }

   toggleColumnMenu()
   {
      if (!this.columnMenu)
      {
         return;
      }

      const willOpen = !this.columnMenu.classList.contains('open');
      if (willOpen)
      {
         this.columnMenu.classList.add('open');
         document.addEventListener('click', this.handleColumnMenuDocumentClick);
      }
      else
      {
         this.columnMenu.classList.remove('open');
         document.removeEventListener('click', this.handleColumnMenuDocumentClick);
      }
   }

   handleColumnMenuDocumentClick = (event) =>
   {
      if (!this.columnMenu || !this.columnToggleWrapper)
      {
         return;
      }

      if (!this.columnToggleWrapper.contains(event.target))
      {
         this.columnMenu.classList.remove('open');
         document.removeEventListener('click', this.handleColumnMenuDocumentClick);
      }
   };

   renderColumnMenu()
   {
      if (!this.columnMenu)
      {
         return;
      }

      this.columnMenu.innerHTML = '';
      this.allColumns.forEach((column) =>
      {
         const item = document.createElement('label');
         item.className = 'summary-column-menu-item';

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.checked = column.visible;
         checkbox.dataset.key = column.key;

         checkbox.addEventListener('click', (event) =>
         {
            event.stopPropagation();
         });

         checkbox.addEventListener('change', () =>
         {
            const currentlyVisible = this.allColumns.filter(col => col.visible).length;
            if (!checkbox.checked && currentlyVisible <= 1)
            {
               checkbox.checked = true;
               return;
            }

            column.visible = checkbox.checked;
            this.columns = this.allColumns.filter(col => col.visible);

            if (!this.columns.find(col => col.key === this.sortColumn && col.sortable !== false))
            {
               const fallbackColumn = this.columns.find(col => col.sortable !== false);
               if (fallbackColumn)
               {
                  this.sortColumn = fallbackColumn.key;
                  this.sortDirection = 'asc';
               }
               else
               {
                  this.sortColumn = null;
               }
            }

            if (!column.visible && this.activeFilterColumnKey === column.key)
            {
               this.closeFilterMenu();
               delete this.activeFilters[column.key];
            }

            this.buildTableHeader();
            this.renderRows();
            this.renderColumnMenu();
         });

         const label = document.createElement('span');
         label.textContent = column.label;

         item.appendChild(checkbox);
         item.appendChild(label);
         this.columnMenu.appendChild(item);
      });
   }

   /**
    * Set up action button event delegation.
    */
   setupActionHandlers()
   {
      if (!this.tableBody)
      {
         return;
      }

      this.tableBody.addEventListener('click', (event) =>
      {
         const target = event.target;
         if (!(target instanceof HTMLElement))
         {
            return;
         }

         if (!target.classList.contains('summary-action-btn'))
         {
            return;
         }

         const starId = target.dataset.starId;
         if (!starId)
         {
            return;
         }

         const row = this.rowLookup.get(starId);
         const star = row?.star ?? this.getStarById(starId);

         if (!star)
         {
            console.warn('📊 SummaryDialog: Star not found for action', starId);
            return;
         }

         if (target.classList.contains('summary-build-btn'))
         {
            this.openIndustryDialog(star);
         }
         else if (target.classList.contains('summary-move-btn'))
         {
            this.openMoveDialog(star);
         }
      });
   }

   /**
    * Lookup a star instance by identifier.
    * @param {string} starId - Star identifier.
    * @returns {import('@loh/shared').Star|null}
    */
   getStarById(starId)
   {
      const mapModel = window.globalMapModel || window.mapGenerator?.mapModel;
      if (!mapModel || typeof mapModel.getStarById !== 'function')
      {
         return null;
      }

      let star = mapModel.getStarById(starId);
      if (!star)
      {
         const numericId = Number(starId);
         if (!Number.isNaN(numericId))
         {
            star = mapModel.getStarById(numericId);
         }
      }

      return star || null;
   }

   /**
    * Resolve and cache an IndustryDialog instance.
    * @returns {IndustryDialog|null}
    */
   getIndustryDialog()
   {
      if (this.industryDialogInstance)
      {
         return this.industryDialogInstance;
      }

      const radialMenuDialog = window.mapGenerator?.radialMenu?.industryDialog;
      if (radialMenuDialog)
      {
         this.industryDialogInstance = radialMenuDialog;
         return this.industryDialogInstance;
      }

      try
      {
         this.industryDialogInstance = new IndustryDialog();
      }
      catch (error)
      {
         console.error('📊 SummaryDialog: Failed to create IndustryDialog', error);
         this.industryDialogInstance = null;
      }

      return this.industryDialogInstance;
   }

   /**
    * Resolve and cache a MoveDialog instance.
    * @returns {MoveDialog|null}
    */
   getMoveDialog()
   {
      if (this.moveDialogInstance)
      {
         return this.moveDialogInstance;
      }

      const radialMenuDialog = window.mapGenerator?.radialMenu?.moveDialog;
      if (radialMenuDialog)
      {
         this.moveDialogInstance = radialMenuDialog;
         return this.moveDialogInstance;
      }

      try
      {
         this.moveDialogInstance = new MoveDialog();
      }
      catch (error)
      {
         console.error('📊 SummaryDialog: Failed to create MoveDialog', error);
         this.moveDialogInstance = null;
      }

      return this.moveDialogInstance;
   }

   /**
    * Open the Industry dialog for a star.
    * @param {import('@loh/shared').Star} star - Target star.
    */
   openIndustryDialog(star)
   {
      const dialog = this.getIndustryDialog();
      if (!dialog || typeof dialog.show !== 'function')
      {
         console.warn('📊 SummaryDialog: Industry dialog unavailable');
         return;
      }

      dialog.show(star);
   }

   /**
    * Open the Move dialog for a star.
    * @param {import('@loh/shared').Star} star - Target star.
    */
   openMoveDialog(star)
   {
      const dialog = this.getMoveDialog();
      if (!dialog || typeof dialog.show !== 'function')
      {
         console.warn('📊 SummaryDialog: Move dialog unavailable');
         return;
      }

      dialog.show(star);
   }
}

