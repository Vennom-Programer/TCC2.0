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

// =============================================
// NOVAS FUNÇÕES PARA CARREGAR ITENS DO BANCO
// =============================================

// Carregar itens do banco de dados
async function carregarItensDoBanco() {
    try {
        console.log('Carregando itens do banco de dados...');
        
        const response = await fetch('/api/catalogo/itens');
        const data = await response.json();
        
        if (data.success) {
            console.log('Itens carregados:', data.itens);
            preencherTabela(data.itens);
        } else {
            console.error('Erro ao carregar itens:', data.error);
            alert('Erro ao carregar itens do catálogo');
        }
    } catch (error) {
        console.error('Erro ao carregar itens:', error);
        alert('Erro de conexão ao carregar itens');
    }
}

// Preencher a tabela com os itens
function preencherTabela(itens) {
    const tbody = resourcesTable.querySelector('tbody');
    
    if (!tbody) {
        console.error('Elemento tbody não encontrado');
        return;
    }
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    if (itens.length === 0) {
        const colCount = resourcesTable.querySelector('thead tr').cells.length;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px;">Nenhum item cadastrado</td></tr>`;
        return;
    }
    
    // Adicionar cada item na tabela
    itens.forEach(item => {
        const row = document.createElement('tr');
        
        // Determinar ações baseado no tipo de usuário
        const acoes = isRealAdmin ? `
            <td class="actions admin-only">
                <button class="btn btn-edit" data-id="${item.id}">Editar</button>
                <button class="btn btn-delete" data-id="${item.id}">Excluir</button>
            </td>
        ` : '<td class="actions">-</td>';
        
        row.innerHTML = `
            <td>${item.Nome || ''}</td>
            <td>${item.quantidade || 0}</td>
            <td>${item.classificacao || ''}</td>
            <td>${item.localizacao || ''}</td>
            <td>${item.descricao || 'Sem descrição'}</td>
            <td>${item.especificacoestec || 'N/A'}</td>
            ${acoes}
        `;
        
        tbody.appendChild(row);
    });
    
    // Adicionar eventos aos botões se for admin
    if (isRealAdmin) {
        adicionarEventosBotoes();
    }
}

// =============================================
// FUNÇÕES ORIGINAIS MODIFICADAS
// =============================================

// Inicialização baseada no tipo de usuário
async function inicializarCatalogo() {
    console.log('Inicializando catálogo, usuário é admin:', isRealAdmin);
    
    // Carregar itens do banco de dados
    await carregarItensDoBanco();
    
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
            const rows = resourcesTable.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const name = cells[0].textContent.toLowerCase();
                const quantity = cells[1].textContent.toLowerCase();
                const classification = cells[2] ? cells[2].textContent.toLowerCase() : '';
                const location = cells[3] ? cells[3].textContent.toLowerCase() : '';
                const description = cells[4] ? cells[4].textContent.toLowerCase() : '';
                const specs = cells[5] ? cells[5].textContent.toLowerCase() : '';
                
                if (name.includes(searchText) || classification.includes(searchText) || 
                    location.includes(searchText) || description.includes(searchText) ||
                    specs.includes(searchText) || quantity.includes(searchText)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
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
        
        const actionCells = document.querySelectorAll('td.admin-only');
        actionCells.forEach(cell => {
            cell.style.display = 'none';
        });
    }
}

// Configurar eventos administrativos
function configurarEventosAdmin() {
    // Abrir modal de adição
    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', () => {
            // Limpar o formulário
            addName.value = '';
            addQuantity.value = '1';
            addDescription.value = '';
            
            // Exibir o modal
            addModal.style.display = 'flex';
        });
    }
    
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
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            if (currentEditRow) {
                try {
                    // Aqui você implementaria a atualização no banco
                    const itemId = editId.value;
                    const updatedData = {
                        nome: editName.value,
                        quantidade: editQuantity.value,
                        descricao: editDescription.value
                    };
                    
                    // TODO: Implementar chamada API para atualizar no banco
                    console.log('Atualizando item:', itemId, updatedData);
                    
                    // Atualizar visualmente
                    const cells = currentEditRow.querySelectorAll('td');
                    cells[0].textContent = editName.value;
                    cells[1].textContent = editQuantity.value;
                    cells[4].textContent = editDescription.value;
                    
                    alert("Recurso atualizado com sucesso!");
                    closeModal();
                } catch (error) {
                    console.error('Erro ao atualizar item:', error);
                    alert("Erro ao atualizar recurso");
                }
            }
        });
    }
    
    // Salvar novo recurso
    if (saveAddBtn) {
        saveAddBtn.addEventListener('click', async () => {
            if (addName.value && addQuantity.value) {
                try {
                    // TODO: Implementar chamada API para adicionar no banco
                    const newItem = {
                        nome: addName.value,
                        quantidade: addQuantity.value,
                        descricao: addDescription.value
                    };
                    
                    console.log('Adicionando novo item:', newItem);
                    
                    // Recarregar itens do banco
                    await carregarItensDoBanco();
                    
                    alert("Recurso adicionado com sucesso!");
                    closeModal();
                } catch (error) {
                    console.error('Erro ao adicionar item:', error);
                    alert("Erro ao adicionar recurso");
                }
            } else {
                alert("Por favor, preencha pelo menos o nome e quantidade.");
            }
        });
    }
    
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
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Adicionar novo event listener
        newBtn.addEventListener('click', function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');
            
            editName.value = cells[0].textContent;
            editQuantity.value = cells[1].textContent;
            editId.value = this.getAttribute('data-id');
            editDescription.value = cells[4].textContent;
            
            currentEditRow = row;
            editModal.style.display = 'flex';
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        // Remover event listeners existentes para evitar duplicação
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Adicionar novo event listener
        newBtn.addEventListener('click', async function() {
            const row = this.closest('tr');
            const name = row.querySelector('td:first-child').textContent;
            const itemId = this.getAttribute('data-id');
            
            if (confirm(`Tem certeza que deseja excluir o recurso "${name}"?`)) {
                try {
                    // TODO: Implementar chamada API para excluir do banco
                    console.log('Excluindo item:', itemId);
                    
                    // Remover visualmente
                    row.remove();
                    
                    // Recarregar itens se necessário
                    await carregarItensDoBanco();
                    
                    alert("Recurso excluído com sucesso!");
                } catch (error) {
                    console.error('Erro ao excluir item:', error);
                    alert("Erro ao excluir recurso");
                }
            }
        });
    });
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', inicializarCatalogo);