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
    const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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

    // If validation passes, simulate login success (for this demo)
    alert('Login realizado com sucesso! Email: ' + email);
    form.reset();
  });