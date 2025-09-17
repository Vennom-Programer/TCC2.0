const form = document.getElementById('loginForm');
const errorDiv = document.getElementById('error');

form.addEventListener('submit', function(e) {
  e.preventDefault();
  errorDiv.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email) {
    errorDiv.textContent = 'Por favor, informe seu e-mail.';
    form.email.focus();
    return;
  }
  // Basic email pattern check
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    errorDiv.textContent = 'Por favor, informe um e-mail válido.';
    form.email.focus();
    return;
  }
  if (!password) {
    errorDiv.textContent = 'Por favor, informe sua senha.';
    form.password.focus();
    return;
  }

  // Lógica de login real: se o backend retornar sucesso, salvar login
  // Aqui, simulação: se não houver erro, salva login
  // Em produção, use resposta do backend!
  localStorage.setItem('usuarioLogado', email);
  alert('Login realizado com sucesso! Email: ' + email);
  form.reset();
});