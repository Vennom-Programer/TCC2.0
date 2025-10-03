// Verificar se as informações do usuário estão disponíveis
if (typeof userInfo === 'undefined') {
    console.error('Informações do usuário não disponíveis');
    var userInfo = {
        isAdmin: false,
        email: '',
        nome: '',
        role: ''
    };
}

console.log('Inicializando catálogo para usuário:', userInfo);

// Controle de modo de acesso baseado no banco de dados
const adminModeBtn = document.getElementById('adminMode');
const userModeBtn = document.getElementById('userMode');
const body = document.body;

// Verificar se usuário é admin real (do banco de dados)
const isRealAdmin = userInfo.isAdmin;

// Elementos dos modais (apenas para admins)
const editModal = isRealAdmin ? document.getElementById('editModal') : null;
const addModal = isRealAdmin ? document.getElementById('addModal') : null;
const closeBtns = isRealAdmin ? document.querySelectorAll('.close-btn') : [];
const cancelEditBtn = isRealAdmin ? document.getElementById('cancelEdit') : null;
const cancelAddBtn = isRealAdmin ? document.getElementById('cancelAdd') : null;
const saveEditBtn = isRealAdmin ? document.getElementById('saveEdit') : null;
const saveAddBtn = isRealAdmin ? document.getElementById('saveAdd') : null;
const addResourceBtn = isRealAdmin ? document.getElementById('addResource') : null;

// Campos do formulário (apenas para admins)
const editName = isRealAdmin ? document.getElementById('edit-name') : null;
const editQuantity = isRealAdmin ? document.getElementById('edit-quantity') : null;
const editId = isRealAdmin ? document.getElementById('edit-id') : null;
const editDescription = isRealAdmin ? document.getElementById('edit-description') : null;

const addName = isRealAdmin ? document.getElementById('add-name') : null;
const addQuantity = isRealAdmin ? document.getElementById('add-quantity') : null;
const addDescription = isRealAdmin ? document.getElementById('add-description') : null;

// Tabela
const resourcesTable = document.getElementById('resourcesTable');

// Variável para armazenar a linha sendo editada
let currentEditRow = null;

// Inicialização baseada no tipo de usuário
function inicializarCatalogo() {
    console.log('Inicializando catálogo, usuário é admin:', isRealAdmin);
    
    // Configurar controles de acesso apenas para admins reais
    if (isRealAdmin && adminModeBtn && userModeBtn) {
        console.log('Configurando controles de acesso para admin');
        
        // Verificar modo salvo apenas se for admin real
        const savedMode = localStorage.getItem('catalogMode');
        if (savedMode === 'admin') {
            body.classList.add('admin-mode');
        }

        adminModeBtn.addEventListener('click', () => {
            const adminPassword = prompt("Digite a senha de administrador:");
            if (adminPassword === "admin123") {
                body.classList.add('admin-mode');
                localStorage.setItem('catalogMode', 'admin');
                alert("Modo administrador ativado!");
            } else {
                alert("Senha incorreta. Acesso negado.");
            }
        });

        userModeBtn.addEventListener('click', () => {
            body.classList.remove('admin-mode');
            localStorage.setItem('catalogMode', 'user');
            alert("Modo usuário ativado!");
        });
    } else {
        console.log('Usuário não é admin - escondendo controles de acesso');
        // Esconder controles de acesso se não for admin
        const accessControl = document.querySelector('.access-control');
        if (accessControl) {
            accessControl.style.display = 'none';
        }
        
        // Garantir que modo usuário está ativo
        body.classList.remove('admin-mode');
        localStorage.setItem('catalogMode', 'user');
    }

    // Configurar funcionalidade de pesquisa (disponível para todos)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            const searchText = this.value.toLowerCase();
            const rows = resourcesTable.querySelectorAll('tr');
            
            // Pular a primeira linha (cabeçalho)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                const name = cells[0].textContent.toLowerCase();
                const id = cells[2].textContent.toLowerCase();
                const description = cells[3].textContent.toLowerCase();
                
                if (name.includes(searchText) || id.includes(searchText) || description.includes(searchText)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    // Configurar eventos apenas para admins reais
    if (isRealAdmin) {
        console.log('Configurando eventos para admin');
        configurarEventosAdmin();
    } else {
        console.log('Usuário não é admin - funcionalidades limitadas');
        // Remover coluna de ações se existir para não-admins
        const actionHeaders = document.querySelectorAll('th.admin-only');
        actionHeaders.forEach(header => {
            header.style.display = 'none';
        });
    }
}

// Configurar eventos administrativos
function configurarEventosAdmin() {
    // Abrir modal de edição
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');
            
            // Preencher o modal com os dados atuais
            editName.value = cells[0].textContent;
            editQuantity.value = cells[1].textContent;
            editId.value = cells[2].textContent;
            editDescription.value = cells[3].textContent;
            
            // Armazenar a linha sendo editada
            currentEditRow = row;
            
            // Exibir o modal
            editModal.style.display = 'flex';
        });
    });
    
    // Abrir modal de adição
    addResourceBtn.addEventListener('click', () => {
        // Limpar o formulário
        addName.value = '';
        addQuantity.value = '1';
        addDescription.value = '';
        
        // Exibir o modal
        addModal.style.display = 'flex';
    });
    
    // Fechar modais
    const closeModal = () => {
        if (editModal) editModal.style.display = 'none';
        if (addModal) addModal.style.display = 'none';
        currentEditRow = null;
    };
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
    if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeModal);
    
    // Salvar edição
    saveEditBtn.addEventListener('click', () => {
        if (currentEditRow) {
            const cells = currentEditRow.querySelectorAll('td');
            cells[0].textContent = editName.value;
            cells[1].textContent = editQuantity.value;
            cells[2].textContent = editId.value;
            cells[3].textContent = editDescription.value;
            
            alert("Recurso atualizado com sucesso!");
            closeModal();
        }
    });
    
    // Salvar novo recurso
    saveAddBtn.addEventListener('click', () => {
        if (addName.value && addQuantity.value) {
            // Criar nova linha na tabela
            const newRow = document.createElement('tr');
            const newId = 'temp-' + Date.now(); // ID temporário
            
            newRow.innerHTML = `
                <td>${addName.value}</td>
                <td>${addQuantity.value}</td>
                <td>${newId}</td>
                <td>${addDescription.value || 'Sem descrição'}</td>
                <td class="actions admin-only">
                    <button class="btn btn-edit" data-id="${newId}">Editar</button>
                    <button class="btn btn-delete" data-id="${newId}">Excluir</button>
                </td>
            `;
            
            // Adicionar a nova linha à tabela (antes da última linha se existir mensagem de vazio)
            const emptyRow = resourcesTable.querySelector('tr td[colspan]');
            if (emptyRow) {
                emptyRow.closest('tr').remove();
            }
            resourcesTable.appendChild(newRow);
            
            // Adicionar eventos aos novos botões
            adicionarEventosBotoes();
            
            alert("Recurso adicionado com sucesso!");
            closeModal();
        } else {
            alert("Por favor, preencha pelo menos o nome e quantidade.");
        }
    });
    
    // Adicionar eventos para os botões de excluir existentes
    adicionarEventosBotoes();
    
    // Fechar modal clicando fora dele
    window.addEventListener('click', (e) => {
        if (editModal && e.target === editModal) closeModal();
        if (addModal && e.target === addModal) closeModal();
    });
}

// Função para adicionar eventos aos botões (apenas para admin)
function adicionarEventosBotoes() {
    if (!isRealAdmin) return;
    
    document.querySelectorAll('.btn-edit').forEach(btn => {
        // Remover event listeners existentes para evitar duplicação
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        // Remover event listeners existentes para evitar duplicação
        btn.replaceWith(btn.cloneNode(true));
    });
    
    // Adicionar novos event listeners
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');
            
            editName.value = cells[0].textContent;
            editQuantity.value = cells[1].textContent;
            editId.value = cells[2].textContent;
            editDescription.value = cells[3].textContent;
            
            currentEditRow = row;
            editModal.style.display = 'flex';
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const name = row.querySelector('td:first-child').textContent;
            if (confirm(`Tem certeza que deseja excluir o recurso "${name}"?`)) {
                row.remove();
                
                // Se não houver mais linhas, adicionar mensagem de vazio
                if (resourcesTable.querySelectorAll('tr').length <= 1) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = '<td colspan="5">Nenhum item encontrado.</td>';
                    resourcesTable.appendChild(emptyRow);
                }
                
                alert("Recurso excluído com sucesso!");
            }
        });
    });
}

// Passar informações do usuário para o JavaScript
        const userInfo = {
            isAdmin: `{% if user and user.is_admin %}true{% else %}false{% endif %}`,
            email: "{{ user.email if user else '' }}",
            nome: "{{ user.nome if user else '' }}",
            role: "{{ user.role if user else '' }}"
        };
        
        console.log('Informações do usuário:', userInfo);
        
        // Inicializar modo admin baseado no banco de dados
        document.addEventListener('DOMContentLoaded', function() {
            if (userInfo.isAdmin) {
                console.log('Usuário é administrador - ativando modo admin');
                document.body.classList.add('admin-mode');
                localStorage.setItem('catalogMode', 'admin');
            } else {
                console.log('Usuário não é administrador - modo usuário');
                document.body.classList.remove('admin-mode');
                localStorage.setItem('catalogMode', 'user');
                
                // Esconder elementos admin-only
                const adminElements = document.querySelectorAll('.admin-only');
                adminElements.forEach(el => {
                    el.style.display = 'none';
                });
            }
        });
        document.addEventListener('DOMContentLoaded', function () {
    const saveBtn = document.querySelector('.form-actions .btn-primary');
    const cancelBtn = document.querySelector('.form-actions .btn-secondary');
    const form = document.querySelector('form[action="/cadastroItem.html"]');

    // Elementos das categorias
    const categoriaBtns = document.querySelectorAll('.categoria-btn');
    const subcategoriasEquipamento = document.getElementById('subcategorias-equipamento');
    const subcategoriasEspaco = document.getElementById('subcategorias-espaco');
    const selectEquipamento = document.getElementById('item-type-equipamento');
    const selectEspaco = document.getElementById('item-type-espaco');
    const hiddenCategoria = document.getElementById('categoria-selecionada');

    // Variável para controlar a categoria selecionada
    let categoriaSelecionada = '';

    // Event listeners para os botões de categoria
    categoriaBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove a classe active de todos os botões
            categoriaBtns.forEach(b => b.classList.remove('active'));
            
            // Adiciona a classe active ao botão clicado
            this.classList.add('active');
            
            // Obtém a categoria selecionada
            categoriaSelecionada = this.getAttribute('data-categoria');
            hiddenCategoria.value = categoriaSelecionada;
            
            // Esconde todas as subcategorias
            subcategoriasEquipamento.classList.add('hidden');
            subcategoriasEspaco.classList.add('hidden');
            
            // Desabilita todos os selects primeiro
            selectEquipamento.disabled = true;
            selectEspaco.disabled = true;
            selectEquipamento.removeAttribute('required');
            selectEspaco.removeAttribute('required');
            
            // Mostra a subcategoria correspondente e habilita o select
            if (categoriaSelecionada === 'equipamento') {
                subcategoriasEquipamento.classList.remove('hidden');
                selectEquipamento.disabled = false;
                selectEquipamento.setAttribute('required', 'required');
            } else if (categoriaSelecionada === 'espaco') {
                subcategoriasEspaco.classList.remove('hidden');
                selectEspaco.disabled = false;
                selectEspaco.setAttribute('required', 'required');
            }
        });
    });

    // Validação do formulário
    if (form) {
        form.addEventListener('submit', function(e) {
            if (!categoriaSelecionada) {
                e.preventDefault();
                alert('Por favor, selecione o tipo de item (Equipamento ou Espaço)');
                return false;
            }
            
            // Valida se uma subcategoria foi selecionada
            if (categoriaSelecionada === 'equipamento' && !selectEquipamento.value) {
                e.preventDefault();
                alert('Por favor, selecione o tipo de equipamento');
                return false;
            }
            
            if (categoriaSelecionada === 'espaco' && !selectEspaco.value) {
                e.preventDefault();
                alert('Por favor, selecione o tipo de espaço');
                return false;
            }
            
            // Garante que apenas o select correto seja enviado
            if (categoriaSelecionada === 'equipamento') {
                selectEspaco.disabled = true;
                // Move o valor para o select principal se necessário
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'item-type';
                hiddenInput.value = selectEquipamento.value;
                form.appendChild(hiddenInput);
                selectEquipamento.disabled = true;
            } else if (categoriaSelecionada === 'espaco') {
                selectEquipamento.disabled = true;
                // Move o valor para o select principal se necessário
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'item-type';
                hiddenInput.value = selectEspaco.value;
                form.appendChild(hiddenInput);
                selectEspaco.disabled = true;
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function (e) {
            window.location.href = '/index.html';
        });
    }
});

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', inicializarCatalogo);