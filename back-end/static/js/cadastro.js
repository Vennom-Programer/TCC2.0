document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('cadastroForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;

        if (!nome || !email || !senha) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        // Exemplo de envio dos dados (pode ser adaptado para sua API)
        fetch('/api/cadastro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        })
            .then(res => res.json())
            .then(data => {
                if (data.sucesso) {
                    alert('Cadastro realizado com sucesso!');
                    form.reset();
                } else {
                    alert('Erro ao cadastrar: ' + (data.mensagem || 'Tente novamente.'));
                }
            })
            .catch(() => alert('Erro de conexão. Tente novamente.'));
    });
});

const facebookBtn = document.getElementById('facebookCadastro');
const emailBtn = document.getElementById('emailCadastro');
const emailFields = document.getElementById('emailFields');

if (facebookBtn && emailBtn && emailFields) {
    facebookBtn.addEventListener('click', function () {
        // Redireciona para o fluxo de autenticação do Facebook
        window.location.href = '/auth/facebook';
    });

    emailBtn.addEventListener('click', function () {
        // Exibe os campos de cadastro por email
        emailFields.style.display = 'block';
        emailBtn.style.display = 'none';
        facebookBtn.style.display = 'none';
    });
}