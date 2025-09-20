document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('cadastroForm');
    if (!form) return;

      form.addEventListener('submit', function (e) {
          const mensagemDiv = document.getElementById('mensagem');
          const nome = document.getElementById('nome').value.trim();
          const email = document.getElementById('email').value.trim();
          const senha = document.getElementById('senha').value;
          const numeroDaMatricula = document.getElementById('numeroDaMatricula').value;
        // role radios may be present only when an admin is creating the user
    const roleInputs = document.getElementsByName('role');
        let selectedRole = null;
        if (roleInputs && roleInputs.length) {
            for (let i = 0; i < roleInputs.length; i++) {
                if (roleInputs[i].checked) {
                    selectedRole = roleInputs[i].value;
                    break;
                }
            }
            if (!selectedRole) {
                e.preventDefault();
                mensagemDiv.textContent = 'Por favor, selecione o tipo de usuário (ADM ou Professor).';
                mensagemDiv.style.color = 'red';
                return;
            }
            // admin password visibility is handled by radio change listener as well; ensure state here too
            const adminAuth = document.getElementById('admin-auth');
            if (adminAuth) {
                adminAuth.style.display = (selectedRole === 'adm') ? 'block' : 'none';
            }
        }


        // If creating an ADM, ensure admin password field is provided
        if (selectedRole === 'adm') {
            const adminPass = document.getElementById('admin_password');
            if (!adminPass || !adminPass.value) {
                e.preventDefault();
                mensagemDiv.textContent = 'Por favor, confirme a senha do ADM para criar outro ADM.';
                mensagemDiv.style.color = 'red';
                return;
            }
        }

        if (!nome || !email || !senha || !numeroDaMatricula) {
            e.preventDefault();
            mensagemDiv.textContent = 'Por favor, preencha todos os campos.';
            mensagemDiv.style.color = 'red';
            return;
        }
        mensagemDiv.textContent = '';
    });

    // Toggle admin password input immediately when admin radio is selected
    const roleInputsLive = document.getElementsByName('role');
    if (roleInputsLive && roleInputsLive.length) {
        const adminAuth = document.getElementById('admin-auth');
        for (let i = 0; i < roleInputsLive.length; i++) {
            roleInputsLive[i].addEventListener('change', function () {
                if (!adminAuth) return;
                adminAuth.style.display = (this.value === 'adm' && this.checked) ? 'block' : 'none';
            });
        }
    }
});

// Mostrar pop-up quando ?success=1 estiver presente na URL
document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
        const createdRole = params.get('role');
        if (createdRole) {
            showModal('Cadastro realizado com sucesso! Conta criada como: ' + createdRole + '. Você pode fazer o login.');
        } else {
            showModal('Cadastro realizado com sucesso! Você pode fazer o login.');
        }
        // Remover o parâmetro da URL sem recarregar a página
        const url = new URL(window.location);
        url.searchParams.delete('success');
        url.searchParams.delete('role');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === 'exists') {
        showModal('Erro: já existe um usuário com esse e-mail.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === 'name_exists') {
        showModal('Erro: já existe um usuário cadastrado com esse nome completo.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === 'matricula_exists') {
        showModal('Erro: esse número de matrícula já está cadastrado.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === 'forbidden') {
        showModal('Ação não autorizada: apenas administradores podem criar outros usuários ou atribuir papéis.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === '1') {
        showModal('Erro ao cadastrar. Tente novamente mais tarde.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
    if (params.get('error') === 'admin_auth_failed') {
        showModal('Autenticação do ADM falhou: senha incorreta.');
        const url = new URL(window.location);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
    }
});

