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

      this.columns = [
         {key: 'name', label: 'Star Name', type: 'text', headerClass: 'summary-header-center'},
         {key: 'ownerName', label: 'Owner', type: 'text', headerClass: 'summary-header-center'},
         {key: 'resource', label: '⚒', type: 'number'},
         {key: 'industryCapacity', label: '🏭', type: 'number'},
         {key: 'researchLevel', label: '🧪', type: 'number'},
         {key: 'availablePoints', label: '💰', type: 'number'},
         {key: 'shipCount', label: '🚀', type: 'number'},
      ];

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

      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.hide());

      controls.appendChild(refreshButton);
      controls.appendChild(closeBtn);

      header.appendChild(title);
      header.appendChild(controls);

      const content = document.createElement('div');
      content.className = 'summary-dialog-content';

      this.tableContainer = document.createElement('div');
      this.tableContainer.className = 'summary-table-container';

      this.table = document.createElement('table');
      this.table.className = 'summary-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      this.columns.forEach((column) =>
      {
         const th = document.createElement('th');
         th.scope = 'col';
         th.textContent = column.label;
         th.dataset.key = column.key;
         th.className = 'summary-table-header';
         if (column.headerClass)
         {
            th.classList.add(column.headerClass);
         }
         th.tabIndex = 0;
         th.setAttribute('role', 'button');
         th.setAttribute('aria-label', `Sort by ${column.label}`);

         const indicator = document.createElement('span');
         indicator.className = 'summary-sort-indicator';
         th.appendChild(indicator);

         th.addEventListener('click', () => this.handleSort(column.key));
         th.addEventListener('keydown', (event) =>
         {
            if (event.key === 'Enter' || event.key === ' ')
            {
               event.preventDefault();
               this.handleSort(column.key);
            }
         });

         this.headerCells.set(column.key, {element: th, indicator});
         headerRow.appendChild(th);
      });

      // Actions column (not sortable)
      const actionsHeader = document.createElement('th');
      actionsHeader.className = 'summary-table-header summary-actions-header';
      actionsHeader.textContent = 'Actions';
      headerRow.appendChild(actionsHeader);

      thead.appendChild(headerRow);
      this.table.appendChild(thead);

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

      this.setupDragHandlers(header);
      this.setupActionHandlers();
   }

   /**
    * Handle sort requests for a specific column.
    * @param {string} columnKey - Column key to sort by.
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
    * Fetch latest data and render.
    */
   refreshData()
   {
      try
      {
         this.rows = getStarSummaryRows();
         this.rowLookup.clear();
         this.rows.forEach((row) =>
         {
            if (row && row.starId !== undefined)
            {
               this.rowLookup.set(String(row.starId), row);
            }
         });
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

      const rows = this.getSortedRows();
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
            if (column.type === 'number' && typeof value === 'number')
            {
               td.textContent = value.toLocaleString();
            }
            else if (column.key === 'name')
            {
               const nameSpan = document.createElement('span');
               nameSpan.textContent = value ?? '';
               nameSpan.style.color = row.ownerColor || '#FFFFFF';
               nameSpan.style.fontWeight = '600';
               td.appendChild(nameSpan);
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
            indicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
         }
         else
         {
            element.classList.remove('summary-header-sorted');
            indicator.textContent = '';
         }
      });
   }

   /**
    * Return rows sorted per current state.
    * @returns {Array<Object>}
    */
   getSortedRows()
   {
      const sortableColumn = this.columns.find((column) => column.key === this.sortColumn);
      if (!sortableColumn)
      {
         return [...this.rows];
      }

      const sorted = [...this.rows];
      sorted.sort((a, b) =>
      {
         const valueA = a[this.sortColumn];
         const valueB = b[this.sortColumn];

         if (sortableColumn.type === 'number')
         {
            const numberA = typeof valueA === 'number' ? valueA : Number(valueA) || 0;
            const numberB = typeof valueB === 'number' ? valueB : Number(valueB) || 0;
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

   /**
    * Override show to refresh data each time dialog opens.
    */
   show()
   {
      this.refreshData();
      super.show();
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

