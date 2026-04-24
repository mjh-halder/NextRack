import { marked } from 'marked';
import { carbonIconToString, CarbonIcon } from '../icons';
import Search16 from '@carbon/icons/es/search/16.js';

const ICON_SEARCH = carbonIconToString(Search16 as CarbonIcon);

function loadMd(m: any): string {
    if (typeof m === 'string') return m;
    if (m && typeof m.default === 'string') return m.default;
    return '';
}

const gettingStartedMd = loadMd(require('./content/getting-started.md'));
const componentsMd = loadMd(require('./content/components.md'));
const connectionsMd = loadMd(require('./content/connections.md'));
const linkTypesMd = loadMd(require('./content/link-types.md'));

interface DocTopic {
    id: string;
    title: string;
    content: string;
}

const TOPICS: DocTopic[] = [
    { id: 'getting-started', title: 'Getting Started', content: gettingStartedMd },
    { id: 'components', title: 'Components', content: componentsMd },
    { id: 'connections', title: 'Connections', content: connectionsMd },
    { id: 'link-types', title: 'Link Types', content: linkTypesMd },
];

let rootEl: HTMLDivElement | null = null;
let currentTopicId = TOPICS[0].id;
let filterTerm = '';

function renderSidebar(): string {
    const filtered = TOPICS.filter(t =>
        t.title.toLowerCase().includes(filterTerm.toLowerCase())
    );

    const items = filtered.map(t => {
        const active = t.id === currentTopicId ? ' nr-kb__nav-item--selected' : '';
        return `<button class="nr-kb__nav-item${active}" data-topic="${t.id}" type="button">${t.title}</button>`;
    }).join('');

    return `
        <div class="nr-kb__search">
            <span class="nr-kb__search-icon">${ICON_SEARCH}</span>
            <input class="nr-kb__search-input" type="text" placeholder="Filter topics\u2026"
                   value="${filterTerm}" aria-label="Filter topics" />
        </div>
        <nav class="nr-kb__nav-list" aria-label="Knowledge base topics">${items}</nav>
    `;
}

function renderContent(): string {
    const topic = TOPICS.find(t => t.id === currentTopicId);
    if (!topic) return '<p>Topic not found.</p>';
    return marked.parse(topic.content) as string;
}

function render(): void {
    if (!rootEl) return;
    rootEl.innerHTML = `
        <aside class="nr-kb__side-nav">${renderSidebar()}</aside>
        <main class="nr-kb__content">${renderContent()}</main>
    `;
    bindEvents();
}

function bindEvents(): void {
    if (!rootEl) return;

    const input = rootEl.querySelector('.nr-kb__search-input') as HTMLInputElement | null;
    if (input) {
        input.addEventListener('input', () => {
            filterTerm = input.value;
            render();
            const next = rootEl!.querySelector('.nr-kb__search-input') as HTMLInputElement | null;
            if (next) {
                next.focus();
                next.setSelectionRange(next.value.length, next.value.length);
            }
        });
    }

    rootEl.querySelectorAll<HTMLButtonElement>('.nr-kb__nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTopicId = btn.dataset.topic!;
            render();
        });
    });
}

export function navigateToTopic(topicId: string): void {
    if (TOPICS.some(t => t.id === topicId)) {
        currentTopicId = topicId;
        render();
    }
}

export function initKnowledgeBase(el: HTMLDivElement): void {
    rootEl = el;
    render();
}
