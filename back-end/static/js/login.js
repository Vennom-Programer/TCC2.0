const form = document.getElementById('loginForm');
const errorDiv = document.getElementById('error');

form.addEventListener('submit', function(e) {
  // Perform client-side validation, then allow normal POST so server verifies role against DB
  if (errorDiv) errorDiv.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const role = form.role ? form.role.value : null;

  if (!role) {
    if (errorDiv) errorDiv.textContent = 'Por favor, selecione se você é ADM ou Professor.';
    e.preventDefault();
    return;
  }

  if (!email) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe seu e-mail.';
    form.email.focus();
    e.preventDefault();
    return;
  }
  // Basic email pattern check
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe um e-mail válido.';
    form.email.focus();
    e.preventDefault();
    return;
  }
  if (!password) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe sua senha.';
    form.password.focus();
    e.preventDefault();
    return;
  }

  // Do not store role/email locally here; submit the form and let the server validate role from DB.
  // The server will return to the login page with an error message in case of mismatch.
  // Allow the form to submit normally (no preventDefault).
});