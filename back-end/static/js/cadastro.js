document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('cadastroForm');
    if (!form) return;

    // Função para verificar constantemente o tipo de usuário logado
    function verificarTipoUsuario() {
        // Esta função pode ser expandida para fazer uma requisição ao servidor
        // e verificar o role do usuário atual em tempo real
        console.log('Verificando tipo de usuário...');
        
        // Por enquanto, vamos verificar se há um usuário logado na sessão
        // Em uma implementação real, você faria uma chamada AJAX para o servidor
        const usuarioLogado = sessionStorage.getItem('usuario_logado');
        const usuarioRole = sessionStorage.getItem('usuario_role');
        
        return {
            logado: !!usuarioLogado,
            role: usuarioRole
        };
    }

    // Aplicar restrições baseadas no tipo de usuário
    function aplicarRestricoesUsuario() {
        const usuarioInfo = verificarTipoUsuario();
        const roleInputsContainer = document.getElementById('role-selection');
        const adminAuthContainer = document.getElementById('admin-auth');
        
        if (roleInputsContainer) {
            if (!usuarioInfo.logado || usuarioInfo.role !== 'adm') {
                // Usuário não logado ou não é ADM - esconder seleção de role
                roleInputsContainer.style.display = 'none';
                
                // Definir role padrão como professor
                const professorRadio = document.querySelector('input[value="professor"]');
                if (professorRadio) {
                    professorRadio.checked = true;
                }
            } else {
                // Usuário é ADM - mostrar seleção de role
                roleInputsContainer.style.display = 'block';
            }
        }
        
        // Esconder campo de senha ADM inicialmente
        if (adminAuthContainer) {
            adminAuthContainer.style.display = 'none';
        }
    }

    // Aplicar restrições quando a página carregar
    aplicarRestricoesUsuario();

    // Verificar periodicamente (a cada 5 segundos) se o status mudou
    setInterval(aplicarRestricoesUsuario, 5000);

    form.addEventListener('submit', function (e) {
        const mensagemDiv = document.getElementById('mensagem');
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const numeroDaMatricula = document.getElementById('numeroDaMatricula').value;
        
        // Verificar novamente o tipo de usuário no momento do submit
        const usuarioInfo = verificarTipoUsuario();
        
        // Verificar role radios apenas se o usuário for ADM
        const roleInputs = document.getElementsByName('role');
        let selectedRole = null;
        
        if (usuarioInfo.logado && usuarioInfo.role === 'adm') {
            // Apenas ADMs podem ver e selecionar roles
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
            
            // admin password visibility
            const adminAuth = document.getElementById('admin-auth');
            if (adminAuth) {
                adminAuth.style.display = (selectedRole === 'adm') ? 'block' : 'none';
            }
        } else {
            // Usuário não ADM - definir role padrão como professor
            selectedRole = 'professor';
        }

        // Se criando um ADM, garantir que o usuário atual é ADM e que a senha ADM foi fornecida
        if (selectedRole === 'adm') {
            if (!usuarioInfo.logado || usuarioInfo.role !== 'adm') {
                e.preventDefault();
                mensagemDiv.textContent = 'Apenas administradores podem criar contas de ADM.';
                mensagemDiv.style.color = 'red';
                return;
            }
            
            const adminPass = document.getElementById('admin_password');
            if (!adminPass || !adminPass.value) {
                e.preventDefault();
                mensagemDiv.textContent = 'Por favor, confirme a senha do ADM para criar outro ADM.';
                mensagemDiv.style.color = 'red';
                return;
            }
        }

        // Validações básicas de campos obrigatórios
        if (!nome || !email || !senha || !numeroDaMatricula) {
            e.preventDefault();
            mensagemDiv.textContent = 'Por favor, preencha todos os campos.';
            mensagemDiv.style.color = 'red';
            return;
        }

        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            e.preventDefault();
            mensagemDiv.textContent = 'Por favor, insira um email válido.';
            mensagemDiv.style.color = 'red';
            return;
        }

        // Validação de senha (mínimo 6 caracteres)
        if (senha.length < 6) {
            e.preventDefault();
            mensagemDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
            mensagemDiv.style.color = 'red';
            return;
        }

        mensagemDiv.textContent = '';
    });

    // Toggle admin password input quando admin radio é selecionado
    const roleInputsLive = document.getElementsByName('role');
    if (roleInputsLive && roleInputsLive.length) {
        const adminAuth = document.getElementById('admin-auth');
        for (let i = 0; i < roleInputsLive.length; i++) {
            roleInputsLive[i].addEventListener('change', function () {
                if (!adminAuth) return;
                
                // Verificar se o usuário atual tem permissão para criar ADM
                const usuarioInfo = verificarTipoUsuario();
                if (this.value === 'adm' && this.checked) {
                    if (usuarioInfo.logado && usuarioInfo.role === 'adm') {
                        adminAuth.style.display = 'block';
                    } else {
                        this.checked = false;
                        const professorRadio = document.querySelector('input[value="professor"]');
                        if (professorRadio) {
                            professorRadio.checked = true;
                        }
                        alert('Apenas administradores podem criar contas de ADM.');
                    }
                } else {
                    adminAuth.style.display = 'none';
                }
            });
        }
    }

    // Adicionar validação em tempo real para melhor UX
    const campos = ['nome', 'email', 'senha', 'numeroDaMatricula'];
    campos.forEach(campo => {
        const elemento = document.getElementById(campo);
        if (elemento) {
            elemento.addEventListener('input', function() {
                const mensagemDiv = document.getElementById('mensagem');
                if (this.value.trim()) {
                    this.style.borderColor = '#ccc';
                    mensagemDiv.textContent = '';
                }
            });
        }
    });
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

// Função para mostrar modal (se não existir)
function showModal(message) {
    alert(message); // Substitua por sua implementação de modal personalizada
}

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('cadastroForm');
    if (!form) return;

    // Função para verificar o usuário atual via API
    async function verificarUsuarioAtual() {
        try {
            const response = await fetch('/api/usuario/atual');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erro ao verificar usuário:', error);
            return { logado: false };
        }
    }

    // Aplicar restrições baseadas no tipo de usuário
    async function aplicarRestricoesUsuario() {
        const usuarioInfo = await verificarUsuarioAtual();
        const roleInputsContainer = document.getElementById('role-selection');
        const adminAuthContainer = document.getElementById('admin-auth');
        const tituloPagina = document.querySelector('h1');
        
        // Atualizar interface baseada no tipo de usuário
        if (roleInputsContainer) {
            if (!usuarioInfo.logado || usuarioInfo.role !== 'adm') {
                // Usuário não logado ou não é ADM - esconder seleção de role
                roleInputsContainer.style.display = 'none';
                
                // Definir role padrão como professor
                const professorRadio = document.querySelector('input[value="professor"]');
                if (professorRadio) {
                    professorRadio.checked = true;
                }
                
                // Atualizar título da página
                if (tituloPagina) {
                    tituloPagina.textContent = 'Cadastro de Usuário - Professor';
                }
            } else {
                // Usuário é ADM - mostrar seleção de role
                roleInputsContainer.style.display = 'block';
                
                // Atualizar título da página
                if (tituloPagina) {
                    tituloPagina.textContent = 'Cadastro de Usuário - Administrador';
                }
            }
        }
        
        // Esconder campo de senha ADM inicialmente
        if (adminAuthContainer) {
            adminAuthContainer.style.display = 'none';
        }
        
        return usuarioInfo;
    }

    // Aplicar restrições quando a página carregar
    aplicarRestricoesUsuario();

    // Verificar periodicamente (a cada 3 segundos) se o status mudou
    setInterval(aplicarRestricoesUsuario, 3000);

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const mensagemDiv = document.getElementById('mensagem');
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const numeroDaMatricula = document.getElementById('numeroDaMatricula').value;
        
        // Verificar novamente o tipo de usuário no momento do submit
        const usuarioInfo = await verificarUsuarioAtual();
        
        // Verificar role radios apenas se o usuário for ADM
        const roleInputs = document.getElementsByName('role');
        let selectedRole = null;
        
        if (usuarioInfo.logado && usuarioInfo.role === 'adm') {
            // Apenas ADMs podem ver e selecionar roles
            for (let i = 0; i < roleInputs.length; i++) {
                if (roleInputs[i].checked) {
                    selectedRole = roleInputs[i].value;
                    break;
                }
            }
            if (!selectedRole) {
                mensagemDiv.textContent = 'Por favor, selecione o tipo de usuário (ADM ou Professor).';
                mensagemDiv.style.color = 'red';
                return;
            }
        } else {
            // Usuário não ADM - definir role padrão como professor
            selectedRole = 'professor';
        }

        // Validações
        if (!nome || !email || !senha || !numeroDaMatricula) {
            mensagemDiv.textContent = 'Por favor, preencha todos os campos.';
            mensagemDiv.style.color = 'red';
            return;
        }

        // Se tentando criar ADM, verificar permissões
        if (selectedRole === 'adm') {
            if (!usuarioInfo.logado || usuarioInfo.role !== 'adm') {
                mensagemDiv.textContent = 'Apenas administradores podem criar contas de ADM.';
                mensagemDiv.style.color = 'red';
                return;
            }
            
            const adminPass = document.getElementById('admin_password');
            if (!adminPass || !adminPass.value) {
                mensagemDiv.textContent = 'Por favor, confirme a senha do ADM para criar outro ADM.';
                mensagemDiv.style.color = 'red';
                return;
            }
        }

        // Se todas as validações passarem, submeter o formulário
        form.submit();
    });

    // Resto do código permanece igual...
});