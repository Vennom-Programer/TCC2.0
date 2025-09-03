document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('cadastroForm');
    if (!form) return;

     form.addEventListener('submit', function (e) {
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const numeroDaMatricula = document.getElementById('numeroDaMatricula').value;
        const mensagemDiv = document.getElementById('mensagem');

        if (!nome || !email || !senha || !numeroDaMatricula) {
            e.preventDefault();
            mensagemDiv.textContent = 'Por favor, preencha todos os campos.';
            mensagemDiv.style.color = 'red';
            return;
        }
        mensagemDiv.textContent = '';
    });
});