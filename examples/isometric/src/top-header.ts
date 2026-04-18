/**
 * Top application header — shell only.
 *
 * Connected actions dispatch 'nextrack:header-action' events; system-designer.ts
 * handles the ones it can reach (file-new, file-open, file-save, edit-delete).
 * All other menu items are present but currently no-ops — marked below.
 */

interface MenuItem {
    label: string;
    action: string;
    shortcut?: string;
}

interface MenuGroup {
    label: string;
    items: MenuItem[];
}

const MENUS: MenuGroup[] = [
    {
        label: 'File',
        items: [
            { label: 'New',      action: 'file-new',     shortcut: '⌘N' },
            { label: 'Open…',    action: 'file-open',    shortcut: '⌘O' },
            { label: 'Save',     action: 'file-save',    shortcut: '⌘S' },
            { label: 'Save As…', action: 'file-save-as', shortcut: '⇧⌘S' }, // placeholder
            { label: 'Export SVG', action: 'file-export-svg' },
        ],
    },
    {
        label: 'Edit',
        items: [
            { label: 'Undo',   action: 'edit-undo',   shortcut: '⌘Z' },
            { label: 'Redo',   action: 'edit-redo',   shortcut: '⇧⌘Z' },
            { label: 'Delete', action: 'edit-delete', shortcut: '⌦'  },
        ],
    },
    {
        label: 'View',
        items: [
            { label: 'Zoom In',       action: 'view-zoom-in',     shortcut: '⌘+' }, // placeholder
            { label: 'Zoom Out',      action: 'view-zoom-out',    shortcut: '⌘−' }, // placeholder
            { label: 'Fit to Screen', action: 'view-fit',         shortcut: '⌘0' }, // placeholder
            { label: 'Move to Center', action: 'view-center'                     },
            { label: 'Toggle Grid',   action: 'view-toggle-grid'                 }, // placeholder
        ],
    },
    {
        label: 'Model',
        items: [
            { label: 'Adjust Grid Size', action: 'model-adjust-grid' },
            { label: 'Add Zone',         action: 'model-add-zone'    }, // placeholder
            { label: 'Validate',         action: 'model-validate'    }, // placeholder
        ],
    },
    {
        label: 'Help',
        items: [
            { label: 'Shortcuts', action: 'help-shortcuts', shortcut: '?' }, // placeholder
            { label: 'About',     action: 'help-about'                     }, // placeholder
        ],
    },
    {
        label: 'Admin',
        items: [
            { label: 'Set as Default', action: 'admin-set-default' },
        ],
    },
];

function dispatchAction(action: string) {
    document.dispatchEvent(
        new CustomEvent('nextrack:header-action', { detail: { action } })
    );
}

// Currently open menu — only one open at a time
let activeMenu: { btn: HTMLButtonElement; dropdown: HTMLElement } | null = null;

function closeActiveMenu() {
    if (!activeMenu) return;
    activeMenu.dropdown.hidden = true;
    activeMenu.btn.setAttribute('aria-expanded', 'false');
    activeMenu = null;
}

function openMenu(btn: HTMLButtonElement, dropdown: HTMLElement) {
    if (activeMenu) closeActiveMenu();
    dropdown.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    activeMenu = { btn, dropdown };
    (dropdown.querySelector<HTMLElement>('[role="menuitem"]'))?.focus();
}

function buildMenuBar(): HTMLElement {
    const bar = document.createElement('nav');
    bar.className = 'nr-header-menubar';
    bar.setAttribute('aria-label', 'Application menu');
    bar.setAttribute('role', 'menubar');

    for (const group of MENUS) {
        const item = document.createElement('div');
        item.className = 'nr-hmenu-item';
        item.setAttribute('role', 'none');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-hmenu-btn';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = group.label;

        const dropdown = document.createElement('ul');
        dropdown.className = 'nr-hmenu-dropdown';
        dropdown.setAttribute('role', 'menu');
        dropdown.hidden = true;

        for (const entry of group.items) {
            const li = document.createElement('li');
            li.setAttribute('role', 'none');

            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.className = 'nr-hmenu-action';
            actionBtn.setAttribute('role', 'menuitem');

            const labelSpan = document.createElement('span');
            labelSpan.textContent = entry.label;
            actionBtn.appendChild(labelSpan);

            if (entry.shortcut) {
                const sc = document.createElement('span');
                sc.className = 'nr-hmenu-shortcut';
                sc.textContent = entry.shortcut;
                sc.setAttribute('aria-hidden', 'true');
                actionBtn.appendChild(sc);
            }

            actionBtn.addEventListener('click', () => {
                closeActiveMenu();
                dispatchAction(entry.action);
            });

            // Arrow key navigation within the dropdown
            actionBtn.addEventListener('keydown', (e: KeyboardEvent) => {
                const siblings = Array.from(
                    dropdown.querySelectorAll<HTMLElement>('[role="menuitem"]')
                );
                const idx = siblings.indexOf(actionBtn);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    siblings[(idx + 1) % siblings.length]?.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    siblings[(idx - 1 + siblings.length) % siblings.length]?.focus();
                } else if (e.key === 'Escape') {
                    closeActiveMenu();
                    btn.focus();
                }
            });

            li.appendChild(actionBtn);
            dropdown.appendChild(li);
        }

        btn.addEventListener('click', () => {
            if (!dropdown.hidden) closeActiveMenu();
            else openMenu(btn, dropdown);
        });

        btn.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (dropdown.hidden) openMenu(btn, dropdown);
                else dropdown.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
            } else if (e.key === 'Escape') {
                closeActiveMenu();
            }
        });

        item.appendChild(btn);
        item.appendChild(dropdown);
        bar.appendChild(item);
    }

    return bar;
}

/**
 * Initialise the top header.
 * @param headerEl   The #top-header element from index.html
 * @param designNameEl  The existing #design-name element whose text is mirrored here
 */
export function initTopHeader(
    headerEl: HTMLElement,
    designNameEl: HTMLElement,
): void {
    // Left region: app name + document name + dirty indicator
    const left = document.createElement('div');
    left.className = 'nr-header-left';

    const appName = document.createElement('span');
    appName.className = 'nr-header-app-name';
    appName.textContent = 'Xyronos';

    const docName = document.createElement('span');
    docName.className = 'nr-header-doc-name';
    docName.id = 'header-doc-name';
    // Hidden until a document is opened/created
    docName.hidden = true;

    // Dirty indicator — placeholder: not wired to graph change tracking yet
    const dirty = document.createElement('span');
    dirty.className = 'nr-header-dirty';
    dirty.id = 'header-dirty';
    dirty.textContent = '●';
    dirty.title = 'Unsaved changes';
    dirty.hidden = true;

    left.appendChild(appName);
    left.appendChild(docName);
    left.appendChild(dirty);

    // Mirror the existing designNameEl content into the header doc name slot.
    // MutationObserver avoids any coupling to system-designer internals.
    const syncDocName = () => {
        const name = designNameEl.textContent?.trim() ?? '';
        docName.textContent = name;
        docName.hidden = name.length === 0;
    };
    new MutationObserver(syncDocName).observe(designNameEl, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    syncDocName(); // sync initial state

    headerEl.appendChild(left);
    headerEl.appendChild(buildMenuBar());

    // Close any open menu when clicking outside the header
    document.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
            if (activeMenu && !headerEl.contains(e.target as Node)) {
                closeActiveMenu();
            }
        },
        true,
    );
}
