let currentNote = null;
let hasPurchased = false;

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

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const noteId = urlParams.get('id');

  if (!noteId || Number.isNaN(Number(noteId))) {
    window.location.href = '/';
    return;
  }

  setTimeout(async () => {
    await fetchNoteDetails(noteId);
    await checkPurchaseStatus(noteId);
    await loadReviews(noteId);
    renderActionButtons();

    document
      .getElementById('wishlist-btn')
      ?.addEventListener('click', () => addToWishlist(noteId));

    document
      .getElementById('submit-review-btn')
      ?.addEventListener('click', () => submitReview(noteId));
  }, 300);
});

async function fetchNoteDetails(id) {
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!res.ok) {
      showToast('Note not found', 'error');
      return;
    }

    currentNote = data.note;

    document.getElementById('nd-title').innerText = currentNote.title || '';
    document.getElementById('nd-seller').innerText =
      `By ${currentNote.seller_name || 'Unknown'} | subject: ${currentNote.subject || 'N/A'}`;

    document.getElementById('nd-desc').innerText =
      currentNote.description || 'No description provided.';

    document.getElementById('sidebar-price').innerText =
      `$${formatPrice(currentNote.price)}`;

    const badgesEl = document.getElementById('nd-badges');
    badgesEl.innerHTML = `
      <span class="badge" style="background: var(--primary-color)">
        ${escapeHTML(currentNote.level || 'Beginner')}
      </span>
      <span class="badge" style="background: var(--secondary-color)">
        ${escapeHTML(currentNote.language || 'English')}
      </span>
    `;

    const tagsEl = document.getElementById('nd-tags');

    if (currentNote.tags && currentNote.tags.length > 0) {
      tagsEl.innerHTML = currentNote.tags
        .map((tag) => (
          `<span class="badge" style="border: 1px solid var(--text-muted)">#${escapeHTML(tag)}</span>`
        ))
        .join('');
    } else {
      tagsEl.innerText = 'No tags';
    }

    if (currentNote.preview_enabled) {
      document.getElementById('preview-section').style.display = 'block';
      document.getElementById('pdf-preview').src =
        `/api/notes/${encodeURIComponent(currentNote.id)}/preview`;
    }
  } catch (err) {
    showToast('Error fetching note', 'error');
  }
}

async function checkPurchaseStatus(noteId) {
  if (!state.user) return;

  try {
    const res = await fetch('/api/user/purchased-notes', {
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      hasPurchased = data.notes.some((n) => Number(n.id) === Number(noteId));
    }
  } catch (err) {
    console.error(err);
  }
}

function renderActionButtons() {
  const wrap = document.getElementById('action-wrapper');
  wrap.innerHTML = '';

  if (!currentNote) return;

  if (!state.user) {
    wrap.innerHTML =
      `<button class="btn btn-primary" onclick="window.location.href='/login.html'">Login to Buy</button>`;
    return;
  }

  const noteId = encodeURIComponent(currentNote.id);

  if (Number(state.user.id) === Number(currentNote.seller_id)) {
    wrap.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.2); padding: 1rem; border-radius: 8px; text-align: center; color: var(--success); font-weight: bold; margin-bottom: 1rem;">
        Is Your Note
      </div>
      <a href="/api/notes/${noteId}/download" target="_blank" class="btn btn-outline" style="text-align: center;">
        Download Full File
      </a>
    `;
  } else if (hasPurchased) {
    wrap.innerHTML = `
      <div style="background: rgba(6, 182, 212, 0.2); padding: 1rem; border-radius: 8px; text-align: center; color: var(--accent-color); font-weight: bold; margin-bottom: 1rem;">
        Purchased
      </div>
      <a href="/api/notes/${noteId}/download" target="_blank" class="btn btn-primary" style="text-align: center;">
        Download Complete PDF
      </a>
    `;

    document.getElementById('add-review-section').style.display = 'block';
  } else {
    wrap.innerHTML =
      `<button class="btn btn-primary" id="buy-btn" style="font-size: 1.2rem; padding: 1rem;">Buy Now</button>`;

    document.getElementById('buy-btn').addEventListener('click', handlePurchase);
  }
}

async function handlePurchase() {
  const btn = document.getElementById('buy-btn');
  btn.disabled = true;
  btn.innerText = 'Processing...';

  try {
    const res = await fetch('/api/transactions/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ noteId: currentNote.id })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Purchase successful!');
      hasPurchased = true;
      renderActionButtons();

      await checkAuth();
      await updateNavbar();
    } else {
      showToast(data.error || 'Purchase failed', 'error');
      btn.disabled = false;
      btn.innerText = 'Buy Now';
    }
  } catch (err) {
    showToast('Processing error', 'error');
    btn.disabled = false;
    btn.innerText = 'Buy Now';
  }
}

async function addToWishlist(noteId) {
  if (!state.user) {
    showToast('Please login to use wishlist', 'error');
    return;
  }

  try {
    const res = await fetch('/api/user/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ noteId })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Added to wishlist!');
    } else {
      showToast(data.error || 'Failed to add to wishlist', 'error');
    }
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function loadReviews(noteId) {
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(noteId)}/reviews`);

    if (!res.ok) return;

    const data = await res.json();
    const list = document.getElementById('reviews-list');

    list.innerHTML = '';

    document.getElementById('avg-rating').innerText =
      `★ ${formatPrice(data.average_rating)} / 5.0`;

    if (!data.reviews || data.reviews.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted)">No reviews yet.</p>';
      return;
    }

    data.reviews.forEach((review) => {
      const el = document.createElement('div');

      el.style.borderBottom = '1px solid var(--glass-border)';
      el.style.paddingBottom = '1rem';
      el.style.marginBottom = '1rem';

      const rating = Number(review.rating || 0);
      const date = review.created_at
        ? new Date(review.created_at).toLocaleDateString()
        : '';

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHTML(review.user_name || 'User')}</strong>
          <span style="color:var(--warning)">★ ${escapeHTML(rating)}/5</span>
        </div>
        <p style="margin-top:0.5rem; color:var(--text-muted)">
          ${escapeHTML(review.comment || '')}
        </p>
        <small style="color:rgba(255,255,255,0.3)">
          ${escapeHTML(date)}
        </small>
      `;

      list.appendChild(el);
    });
  } catch (err) {
    console.error(err);
  }
}

async function submitReview(noteId) {
  const rating = document.getElementById('rev-rating').value;
  const comment = document.getElementById('rev-comment').value;

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(noteId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rating, comment })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Review submitted!');
      document.getElementById('rev-comment').value = '';
      document.getElementById('add-review-section').style.display = 'none';
      await loadReviews(noteId);
    } else {
      showToast(data.error || 'Failed to submit review', 'error');
    }
  } catch (err) {
    showToast('Error', 'error');
  }
}