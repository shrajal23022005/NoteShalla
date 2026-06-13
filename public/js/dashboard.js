document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  if (!state.user) {
    window.location.href = '/login.html';
    return;
  }

  const welcomeEl = document.getElementById('welcome-user');
  if (welcomeEl) {
    welcomeEl.innerText = `Hello ${state.user.name}`;
  }

  initTabs();
  await loadDashboardStats();
  await loadUploadedNotes();

  document.getElementById('add-funds-btn')?.addEventListener('click', () => {
    document.getElementById('funds-modal').style.display = 'flex';
  });

  document.getElementById('cancel-funds')?.addEventListener('click', () => {
    document.getElementById('funds-modal').style.display = 'none';
  });

  document.getElementById('confirm-funds')?.addEventListener('click', addFunds);
});

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function formatPrice(value) {
  const price = Number(value || 0);
  return price.toFixed(2);
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-link');

  tabs.forEach((tab) => {
    tab.addEventListener('click', async (e) => {
      e.preventDefault();

      document.querySelectorAll('.tab-link').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'profile-tab') await loadDashboardStats();
      if (targetId === 'uploaded-tab') await loadUploadedNotes();
      if (targetId === 'purchased-tab') await loadPurchasedNotes();
      if (targetId === 'wishlist-tab') await loadWishlist();
      if (targetId === 'transactions-tab') await loadTransactions();
    });
  });
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/user/stats', {
      credentials: 'include'
    });

    const data = await res.json();

    if (res.ok) {
      const wallet = parseFloat(data.stats.walletBalance) || 0;
      const earnings = parseFloat(data.stats.totalEarnings) || 0;

      document.getElementById('stat-wallet').innerText = `$${wallet.toFixed(2)}`;
      document.getElementById('stat-earnings').innerText = `$${earnings.toFixed(2)}`;
      document.getElementById('stat-uploads').innerText = data.stats.totalUploads || 0;
      document.getElementById('stat-purchases').innerText = data.stats.totalPurchased || 0;

      if (state.user) {
        state.user.wallet_balance = wallet;
        await updateNavbar();
      }
    }
  } catch (err) {
    showToast('Error loading stats', 'error');
  }
}

async function loadUploadedNotes() {
  try {
    const res = await fetch('/api/user/uploaded-notes', {
      credentials: 'include'
    });

    const data = await res.json();
    const list = document.getElementById('uploaded-list');

    list.innerHTML = '';

    if (!data.notes || data.notes.length === 0) {
      list.innerHTML = '<p>You have not uploaded any notes.</p>';
      return;
    }

    data.notes.forEach((note) => {
      const el = document.createElement('div');
      el.className = 'list-item';

      const noteId = encodeURIComponent(note.id);

      el.innerHTML = `
        <div>
          <h4>
            <a href="/note.html?id=${noteId}" style="color:white;">
              ${escapeHTML(note.title)}
            </a>
          </h4>
          <small style="color:var(--text-muted)">
            Price: $${formatPrice(note.price)} | Sales: ${escapeHTML(note.sales_count || 0)}
          </small>
        </div>
      `;

      list.appendChild(el);
    });
  } catch (err) {
    showToast('Error loading uploaded notes', 'error');
  }
}

async function loadPurchasedNotes() {
  try {
    const res = await fetch('/api/user/purchased-notes', {
      credentials: 'include'
    });

    const data = await res.json();
    const list = document.getElementById('purchased-list');

    list.innerHTML = '';

    if (!data.notes || data.notes.length === 0) {
      list.innerHTML = '<p>You have not purchased any notes.</p>';
      return;
    }

    data.notes.forEach((note) => {
      const el = document.createElement('div');
      el.className = 'list-item';

      const noteId = encodeURIComponent(note.id);

      el.innerHTML = `
        <div>
          <h4>
            <a href="/note.html?id=${noteId}" style="color:white;">
              ${escapeHTML(note.title)}
            </a>
          </h4>
          <small style="color:var(--text-muted)">
            Author: ${escapeHTML(note.seller_name || 'Unknown')}
          </small>
        </div>
        <div class="action-btns">
          <a href="/api/notes/${noteId}/download" class="btn btn-outline" style="font-size:0.8rem" target="_blank">
            Download PDF
          </a>
        </div>
      `;

      list.appendChild(el);
    });
  } catch (err) {
    showToast('Error loading purchased notes', 'error');
  }
}

async function loadWishlist() {
  try {
    const res = await fetch('/api/user/wishlist', {
      credentials: 'include'
    });

    const data = await res.json();
    const list = document.getElementById('wishlist-list');

    list.innerHTML = '';

    if (!data.notes || data.notes.length === 0) {
      list.innerHTML = '<p>Your wishlist is empty.</p>';
      return;
    }

    data.notes.forEach((note) => {
      const el = document.createElement('div');
      el.className = 'list-item';

      const noteId = encodeURIComponent(note.id);

      el.innerHTML = `
        <div>
          <h4>
            <a href="/note.html?id=${noteId}" style="color:white;">
              ${escapeHTML(note.title)}
            </a>
          </h4>
          <small style="color:var(--text-muted)">
            Price: $${formatPrice(note.price)}
          </small>
        </div>
        <div class="action-btns">
          <button class="btn btn-primary" style="font-size:0.8rem" data-view-id="${noteId}">
            View
          </button>
          <button class="btn btn-outline remove-wishlist-btn" style="font-size:0.8rem; border-color:var(--danger); color:var(--danger)" data-note-id="${noteId}">
            Remove
          </button>
        </div>
      `;

      el.querySelector('[data-view-id]')?.addEventListener('click', () => {
        window.location.href = `/note.html?id=${noteId}`;
      });

      el.querySelector('.remove-wishlist-btn')?.addEventListener('click', () => {
        removeFromWishlist(note.id);
      });

      list.appendChild(el);
    });
  } catch (err) {
    showToast('Error loading wishlist', 'error');
  }
}

window.removeFromWishlist = async (noteId) => {
  try {
    const res = await fetch(`/api/user/wishlist/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (res.ok) {
      showToast('Removed from wishlist');
      await loadWishlist();
    }
  } catch (err) {
    showToast('Error removing', 'error');
  }
};

async function loadTransactions() {
  try {
    const res = await fetch('/api/user/transactions', {
      credentials: 'include'
    });

    const data = await res.json();
    const tbody = document.getElementById('transactions-list');

    tbody.innerHTML = '';

    if (!data.transactions || data.transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:10px;">No transactions found.</td></tr>';
      return;
    }

    data.transactions.forEach((tx) => {
      const isPurchase = Number(tx.buyer_id) === Number(state.user.id);
      const type = isPurchase
        ? '<span style="color:var(--danger)">Purchase</span>'
        : '<span style="color:var(--success)">Sale</span>';

      const sign = isPurchase ? '-' : '+';
      const date = tx.created_at
        ? new Date(tx.created_at).toLocaleDateString()
        : '';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--glass-border)';

      tr.innerHTML = `
        <td style="padding: 10px;">#${escapeHTML(tx.id)}</td>
        <td style="padding: 10px;">${escapeHTML(tx.note_title || 'N/A')}</td>
        <td style="padding: 10px;">${type}</td>
        <td style="padding: 10px;">${sign}$${formatPrice(tx.amount)}</td>
        <td style="padding: 10px;">${escapeHTML(date)}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast('Error loading transactions', 'error');
  }
}

async function addFunds() {
  const amount = document.getElementById('dummy-amount').value;

  try {
    const res = await fetch('/api/transactions/add-funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (res.ok) {
      showToast(data.message);
      document.getElementById('funds-modal').style.display = 'none';

      await checkAuth();
      await updateNavbar();
      await loadDashboardStats();
    } else {
      showToast(data.error || 'Failed to add funds', 'error');
    }
  } catch (err) {
    showToast('Error', 'error');
  }
}