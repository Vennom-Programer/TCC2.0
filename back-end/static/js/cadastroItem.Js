document.addEventListener('DOMContentLoaded', function () {
    const saveBtn = document.querySelector('.form-actions .btn-primary');
    const cancelBtn = document.querySelector('.form-actions .btn-secondary');
    const form = document.querySelector('form[action="/cadastroItem.html"]');

    // Ensure save button allows normal form submission (no JS preventDefault)
    if (saveBtn && form) {
        // If any custom validation is needed, attach here. For now, let the browser submit.
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function (e) {
            // Navigate back to the index page
            window.location.href = '/index.html';
        });
    }
});