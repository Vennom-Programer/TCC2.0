// Verificar se as informações do usuário estão disponíveis
if (typeof userInfo === 'undefined') {
    console.error('Informações do usuário não disponíveis');
    var userInfo = {
        is_admin: false,
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
const isRealAdmin = userInfo.is_admin;


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
// FUNÇÕES PARA CARREGAR ITENS DO BANCO
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
    if (!resourcesTable) {
        console.error('Elemento resourcesTable não encontrado');
        return;
    }
    
    // Limpar tabela
    resourcesTable.innerHTML = '';
    
    if (itens.length === 0) {
        const colCount = document.querySelector('thead tr').cells.length;
        resourcesTable.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px;">Nenhum item cadastrado</td></tr>`;
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
        ` : '';
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.Nome || ''}</td>
            <td>${item.quantidade || 0}</td>
            <td>${item.classificacao || ''}</td>
            <td>${item.localizacao || ''}</td>
            <td>${item.descricao || 'Sem descrição'}</td>
            <td>${item.especificacoestec || 'N/A'}</td>
            ${acoes}
        `;
        
        resourcesTable.appendChild(row);
    });
    
    // Adicionar eventos aos botões se for admin
    if (isRealAdmin) {
        adicionarEventosBotoes();
    }
}

// =============================================
// FUNÇÃO PARA EXCLUIR ITEM VIA API
// =============================================

async function excluirItem(itemId, itemName) {
    if (!confirm(`Tem certeza que deseja excluir o item "${itemName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        console.log(`Tentando excluir item ID: ${itemId}`);
        
        const response = await fetch(`/api/itens/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            console.log('Item excluído com sucesso:', data.message);
            alert('Item excluído com sucesso!');
            
            // Recarregar a tabela para refletir a exclusão
            await carregarItensDoBanco();
        } else {
            console.error('Erro ao excluir item:', data.error);
            alert(`Erro ao excluir item: ${data.error}`);
        }
    } catch (error) {
        console.error('Erro na requisição de exclusão:', error);
        alert('Erro de conexão ao tentar excluir item');
    }
}

// =============================================
// FUNÇÃO PARA ADICIONAR EVENTOS AOS BOTÕES
// =============================================

function adicionarEventosBotoes() {
    if (!isRealAdmin) return;
    
    // Eventos para botões de edição
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');
            
            // Preencher modal de edição (se existir)
            if (editName && editQuantity && editId && editDescription) {
                editName.value = cells[1].textContent; // Nome está na segunda coluna
                editQuantity.value = cells[2].textContent; // Quantidade na terceira
                editId.value = this.getAttribute('data-id');
                editDescription.value = cells[5].textContent; // Descrição na sexta
                
                currentEditRow = row;
                if (editModal) editModal.style.display = 'flex';
            }
        });
    });
    
    // Eventos para botões de exclusão
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');
            const itemName = cells[1].textContent; // Nome está na segunda coluna
            const itemId = this.getAttribute('data-id');
            
            await excluirItem(itemId, itemName);
        });
    });
}

// =============================================
// INICIALIZAÇÃO E CONFIGURAÇÕES
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
            // Modo admin ativado automaticamente baseado na role do banco
            body.classList.add('admin-mode');
            localStorage.setItem('catalogMode', 'admin');
            alert("Modo administrador ativado!");
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
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const name = cells[1].textContent.toLowerCase(); // Nome na segunda coluna
                    const quantity = cells[2].textContent.toLowerCase(); // Quantidade na terceira
                    const classification = cells[3] ? cells[3].textContent.toLowerCase() : '';
                    const location = cells[4] ? cells[4].textContent.toLowerCase() : '';
                    const description = cells[5] ? cells[5].textContent.toLowerCase() : '';
                    const specs = cells[6] ? cells[6].textContent.toLowerCase() : '';
                    
                    if (name.includes(searchText) || classification.includes(searchText) || 
                        location.includes(searchText) || description.includes(searchText) ||
                        specs.includes(searchText) || quantity.includes(searchText)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    }

    // Configurar eventos baseado no tipo de usuário
    if (isRealAdmin) {
        console.log('Configurando eventos para admin');
        configurarEventosAdmin();
    } else {
        console.log('Usuário não é admin - funcionalidades limitadas');
        // Garantir que elementos admin-only estão escondidos
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(element => {
            element.style.display = 'none';
        });
        
        // Esconder controles de acesso
        const accessControl = document.querySelector('.access-control');
        if (accessControl) {
            accessControl.style.display = 'none';
        }
        
        // Esconder botão de adicionar recurso
        const addResource = document.querySelector('.add-resource');
        if (addResource) {
            addResource.style.display = 'none';
        }
    }
}

// Configurar eventos administrativos
function configurarEventosAdmin() {
    // Abrir modal de adição
    if (addResourceBtn && addModal) {
        addResourceBtn.addEventListener('click', () => {
            // Limpar o formulário
            if (addName) addName.value = '';
            if (addQuantity) addQuantity.value = '1';
            if (addDescription) addDescription.value = '';
            
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
                    const itemId = editId.value;
                    const updatedData = {
                        nome: editName.value,
                        quantidade: editQuantity.value,
                        descricao: editDescription.value
                    };

                    console.log('Atualizando item:', itemId, updatedData);

                    // Fazer chamada API para atualizar no banco
                    const response = await fetch(`/api/itens/${itemId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedData)
                    });

                    const data = await response.json();

                    if (data.success) {
                        console.log('Item atualizado com sucesso:', data.message);

                        // Atualizar visualmente apenas se a API foi bem-sucedida
                        const cells = currentEditRow.querySelectorAll('td');
                        cells[1].textContent = editName.value; // Nome
                        cells[2].textContent = editQuantity.value; // Quantidade
                        cells[5].textContent = editDescription.value; // Descrição

                        alert("Recurso atualizado com sucesso!");
                        closeModal();
                    } else {
                        console.error('Erro ao atualizar item:', data.error);
                        alert(`Erro ao atualizar recurso: ${data.error}`);
                    }
                } catch (error) {
                    console.error('Erro na requisição de atualização:', error);
                    alert("Erro de conexão ao atualizar recurso");
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

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', inicializarCatalogo);