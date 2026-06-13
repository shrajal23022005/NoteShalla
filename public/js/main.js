// Global State
const state = {
  user: null,
  notes: [],
  toastContainer: null
};

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

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initToast();
  await checkAuth();
  await updateNavbar();

  if (document.getElementById('home-notes-grid')) {
    loadNotes();
    document.getElementById('search-btn')?.addEventListener('click', loadNotes);
  }

  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('signup-form')?.addEventListener('submit', handleSignup);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
});

// Toast Notifications
function initToast() {
  state.toastContainer = document.createElement('div');
  state.toastContainer.id = 'toast-container';
  document.body.appendChild(state.toastContainer);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  state.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Auth Handlers
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
    } else {
      state.user = null;
    }
  } catch (err) {
    console.error(err);
    state.user = null;
  }
}

async function updateNavbar() {
  const guestLinks = document.querySelectorAll('.guest-only');
  const authLinks = document.querySelectorAll('.auth-only');
  const walletDisplay = document.getElementById('wallet-display');

  if (state.user) {
    guestLinks.forEach((el) => {
      el.style.display = 'none';
    });

    authLinks.forEach((el) => {
      el.style.display = 'inline-block';
    });

    if (walletDisplay) {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        const data = await res.json();
        const wallet = parseFloat(data.user?.wallet_balance || 0).toFixed(2);

        walletDisplay.innerText = `Wallet: $${wallet}`;
        walletDisplay.style.display = 'inline-block';
      } catch (err) {
        walletDisplay.innerText = `Wallet: $${parseFloat(state.user.wallet_balance || 0).toFixed(2)}`;
        walletDisplay.style.display = 'inline-block';
      }
    }
  } else {
    guestLinks.forEach((el) => {
      el.style.display = 'inline-block';
    });

    authLinks.forEach((el) => {
      el.style.display = 'none';
    });

    if (walletDisplay) {
      walletDisplay.style.display = 'none';
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      state.user = data.user;
      showToast('Logged in successfully!');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

async function handleSignup(e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Account created! Please log in.');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    } else {
      showToast(data.error || 'Signup failed', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

async function handleLogout(e) {
  if (e) e.preventDefault();

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    state.user = null;
    await updateNavbar();
    window.location.href = '/';
  } catch (err) {
    console.error(err);
  }
}

// Notes loading
async function loadNotes() {
  const grid = document.getElementById('home-notes-grid');

  if (!grid) return;

  grid.innerHTML = '<div class="loader"></div>';

  const searchInput = document.getElementById('search-input');
  const query = searchInput ? searchInput.value.trim() : '';

  try {
    const res = await fetch(`/api/notes?search=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (res.ok) {
      state.notes = data.notes || [];
      renderNotes(state.notes, grid);
    } else {
      grid.innerHTML = '<p>Error loading notes.</p>';
    }
  } catch (err) {
    grid.innerHTML = '<p>Error loading notes.</p>';
  }
}

function renderNotes(notes, container) {
  container.innerHTML = '';

  if (!notes || notes.length === 0) {
    container.innerHTML = '<p style="text-align:center; width:100%">No notes found.</p>';
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement('a');
    card.href = `/note.html?id=${encodeURIComponent(note.id)}`;
    card.className = 'note-card glass-panel';

    const shortDescription = note.description
      ? String(note.description).substring(0, 60)
      : '';

    card.innerHTML = `
      <div class="badges">
        <span class="badge">${escapeHTML(note.level || 'Beginner')}</span>
        <span class="badge">${escapeHTML(note.language || 'English')}</span>
      </div>
      <h3>${escapeHTML(note.title)}</h3>
      <div class="subject">${escapeHTML(note.subject)}</div>
      <p style="color:var(--text-muted); font-size:0.9rem">${escapeHTML(shortDescription)}...</p>
      <div class="price">$${formatPrice(note.price)}</div>
    `;

    container.appendChild(card);
  });
}

async function refreshUser() {
  await checkAuth();
  await updateNavbar();
}