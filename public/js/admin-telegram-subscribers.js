/**
 * AdminTelegramSubscribers — the "who is on my Telegram bot" view.
 *
 * Lists every row in telegram_subscribers (active and inactive) with the
 * linked app account when one exists, so Telegram-only followers are finally
 * visible and can be matched to (or invited into) paying accounts.
 *
 * Data: GET /api/admin/subscribers (flat JSON {success, total, active, linked,
 * subscribers}). Actions: POST /api/admin/manual-link {email, chatId},
 * POST /api/admin/manual-unlink {email}, POST /api/admin/remove-telegram-user
 * {chatId}. All values from Telegram are untrusted — everything is rendered
 * with textContent, never markup.
 */
window.AdminTelegramSubscribers = (function () {
  'use strict';

  let subscribers = [];
  let filterText = '';
  let loaded = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function fmtDate(value) {
    if (!value) return '—';
    return window.DateFormatter ? window.DateFormatter.format(value) : String(value);
  }

  async function fetchSubscribers() {
    const response = await fetch('/api/admin/subscribers');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to load subscribers');
    return data;
  }

  function displayName(s) {
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ');
    return name || (s.username ? '@' + s.username : 'Unknown');
  }

  function matchesFilter(s) {
    if (!filterText) return true;
    const hay = [s.first_name, s.last_name, s.username, s.chat_id, s.linked_email, s.referral_source]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(filterText);
  }

  function renderStats(container, data) {
    container.replaceChildren();
    const stats = [
      ['Subscribers', data.total],
      ['Active', data.active],
      ['Linked to an account', data.linked],
      ['Telegram-only', data.active - data.linked]
    ];
    stats.forEach(([label, value]) => {
      const card = el('div', 'metric-card');
      const content = el('div', 'metric-content');
      content.appendChild(el('div', 'metric-title', label));
      content.appendChild(el('div', 'metric-value data-value', String(Math.max(0, value))));
      card.appendChild(content);
      container.appendChild(card);
    });
  }

  function renderTable(container) {
    container.replaceChildren();

    const visible = subscribers.filter(matchesFilter);
    if (visible.length === 0) {
      container.appendChild(el('p', 'text-secondary',
        subscribers.length === 0
          ? 'Nobody has messaged the bot yet. Subscribers appear here the moment they send /start.'
          : 'No subscribers match the search.'));
      return;
    }

    const table = el('table', 'data-table');
    const thead = el('thead');
    const headRow = el('tr');
    ['Subscriber', 'Username', 'Chat ID', 'Type', 'Source', 'Subscribed', 'Last active', 'Status', 'App account', 'Actions']
      .forEach(h => headRow.appendChild(el('th', null, h)));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    visible.forEach(s => {
      const row = el('tr');
      row.appendChild(el('td', null, displayName(s)));
      row.appendChild(el('td', null, s.username ? '@' + s.username : '—'));
      row.appendChild(el('td', 'data-value', s.chat_id));
      row.appendChild(el('td', null, s.subscription_type || 'all'));
      row.appendChild(el('td', null, s.referral_source || '—'));
      row.appendChild(el('td', null, fmtDate(s.subscribed_at)));
      row.appendChild(el('td', null, fmtDate(s.last_activity)));

      const statusTd = el('td');
      statusTd.appendChild(el('span', 'sa-badge ' + (s.is_active ? 'sa-badge--gain' : ''), s.is_active ? 'Active' : 'Inactive'));
      row.appendChild(statusTd);

      const linkedTd = el('td');
      if (s.linked_email) {
        linkedTd.appendChild(el('span', null, s.linked_email));
      } else {
        linkedTd.appendChild(el('span', 'text-secondary', 'Not linked'));
      }
      row.appendChild(linkedTd);

      const actionsTd = el('td');
      if (s.linked_email) {
        const unlinkBtn = el('button', 'btn-secondary btn-small', 'Unlink');
        unlinkBtn.type = 'button';
        unlinkBtn.addEventListener('click', () => unlinkSubscriber(s));
        actionsTd.appendChild(unlinkBtn);
      } else {
        const linkBtn = el('button', 'btn-secondary btn-small', 'Link to account');
        linkBtn.type = 'button';
        linkBtn.addEventListener('click', () => linkSubscriber(s));
        actionsTd.appendChild(linkBtn);
      }
      if (s.is_active) {
        const removeBtn = el('button', 'btn-secondary btn-small', 'Deactivate');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => removeSubscriber(s));
        actionsTd.appendChild(removeBtn);
      }
      row.appendChild(actionsTd);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    const wrap = el('div', 'table-card');
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  async function linkSubscriber(s) {
    const email = prompt(`Link ${displayName(s)} (chat ${s.chat_id}) to which app account email?`);
    if (!email) return;
    try {
      const response = await fetch('/api/admin/manual-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), chatId: s.chat_id })
      });
      const data = await response.json();
      if (data.success) {
        window.showNotification(data.message || 'Linked', 'success');
        refresh();
      } else {
        window.showNotification(data.error || 'Link failed', 'error');
      }
    } catch (error) {
      window.showNotification('Link failed: ' + error.message, 'error');
    }
  }

  async function unlinkSubscriber(s) {
    if (!confirm(`Unlink ${s.linked_email} from ${displayName(s)}?`)) return;
    try {
      const response = await fetch('/api/admin/manual-unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: s.linked_email })
      });
      const data = await response.json();
      if (data.success) {
        window.showNotification(data.message || 'Unlinked', 'success');
        refresh();
      } else {
        window.showNotification(data.error || 'Unlink failed', 'error');
      }
    } catch (error) {
      window.showNotification('Unlink failed: ' + error.message, 'error');
    }
  }

  async function removeSubscriber(s) {
    if (!confirm(`Deactivate ${displayName(s)}? They stop receiving broadcasts until they /start the bot again.`)) return;
    try {
      const response = await fetch('/api/admin/remove-telegram-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: s.chat_id })
      });
      const data = await response.json();
      if (data.success) {
        window.showNotification(data.message || 'Deactivated', 'success');
        refresh();
      } else {
        window.showNotification(data.error || 'Deactivate failed', 'error');
      }
    } catch (error) {
      window.showNotification('Deactivate failed: ' + error.message, 'error');
    }
  }

  function renderScaffold(page) {
    page.replaceChildren();

    const header = el('div', 'tab-header');
    header.appendChild(el('h2', null, 'Telegram subscribers'));
    header.appendChild(el('p', 'text-secondary',
      'Everyone who has messaged the bot — matched against app accounts where a link exists.'));
    page.appendChild(header);

    const statsGrid = el('div', 'metrics-grid');
    statsGrid.id = 'tg-subs-stats';
    page.appendChild(statsGrid);

    const controls = el('div', 'table-header');
    const search = el('input', 'form-input');
    search.type = 'search';
    search.placeholder = 'Search name, username, chat id, email…';
    search.id = 'tg-subs-search';
    search.addEventListener('input', () => {
      filterText = search.value.trim().toLowerCase();
      renderTable(document.getElementById('tg-subs-table'));
    });
    controls.appendChild(search);

    const refreshBtn = el('button', 'btn-secondary', 'Refresh');
    refreshBtn.type = 'button';
    refreshBtn.addEventListener('click', refresh);
    controls.appendChild(refreshBtn);
    page.appendChild(controls);

    const tableHost = el('div');
    tableHost.id = 'tg-subs-table';
    tableHost.appendChild(el('p', 'text-secondary', 'Loading…'));
    page.appendChild(tableHost);
  }

  async function refresh() {
    const statsHost = document.getElementById('tg-subs-stats');
    const tableHost = document.getElementById('tg-subs-table');
    if (!statsHost || !tableHost) return;
    try {
      const data = await fetchSubscribers();
      subscribers = data.subscribers || [];
      renderStats(statsHost, data);
      renderTable(tableHost);
    } catch (error) {
      tableHost.replaceChildren(el('p', 'text-secondary', 'Could not load subscribers: ' + error.message));
    }
  }

  function init() {
    const page = document.getElementById('telegram-page');
    if (!page) return;
    if (!loaded) {
      renderScaffold(page);
      loaded = true;
    }
    refresh();
  }

  return { init, refresh };
})();
