document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!state.user) {
            window.location.href = '/login.html';
        }
    }, 200);

    const form = document.getElementById('upload-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('upload-btn');
            const originalText = btn.innerText;
            btn.innerText = 'Uploading...';
            btn.disabled = true;

            const formData = new FormData();
            formData.append('title', document.getElementById('up-title').value);
            formData.append('subject', document.getElementById('up-subject').value);
            formData.append('level', document.getElementById('up-level').value);
            formData.append('language', document.getElementById('up-language').value);
            formData.append('price', document.getElementById('up-price').value);
            formData.append('description', document.getElementById('up-desc').value);
            formData.append('tags', document.getElementById('up-tags').value);
            formData.append('preview_enabled', document.getElementById('up-preview').checked);
            
            const fileInput = document.getElementById('up-file');
            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            }

            try {
                const res = await fetch('/api/notes', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if (res.ok) {
                    showToast('Note uploaded successfully!');
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 1500);
                } else {
                    showToast(data.error || 'Upload failed', 'error');
                }
            } catch (err) {
                showToast('Network error', 'error');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});
