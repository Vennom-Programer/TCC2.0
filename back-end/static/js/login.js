const form = document.getElementById('loginForm');
const errorDiv = document.getElementById('error');

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (errorDiv) errorDiv.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const role = form.role ? form.role.value : null;

  if (!role) {
    if (errorDiv) errorDiv.textContent = 'Por favor, selecione se você é ADM ou Professor.';
    return;
  }

  if (!email) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe seu e-mail.';
    form.email.focus();
    return;
  }
  // Basic email pattern check
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe um e-mail válido.';
    form.email.focus();
    return;
  }
  if (!password) {
    if (errorDiv) errorDiv.textContent = 'Por favor, informe sua senha.';
    form.password.focus();
    return;
  }

  // Em uma implementação real, envie role junto ao backend para autenticação.
  // Aqui apenas salvamos role e email localmente após validações.
  localStorage.setItem('usuarioLogado', email);
  localStorage.setItem('usuarioRole', role);
  if (window.showModal) {
    showModal('Login realizado com sucesso!\nEmail: ' + email + '\nRole: ' + role);
  } else {
    alert('Login realizado com sucesso! Email: ' + email + '\nRole: ' + role);
  }
  form.reset();
});