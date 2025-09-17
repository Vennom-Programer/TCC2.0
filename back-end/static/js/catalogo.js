// Controle de modo de acesso
const adminModeBtn = document.getElementById('adminMode');
const userModeBtn = document.getElementById('userMode');
const body = document.body;

// Verificar se já existe um modo salvo
const savedMode = localStorage.getItem('catalogMode');
if (savedMode === 'user') {
    body.classList.remove('admin-mode');
}

adminModeBtn.addEventListener('click', () => {
    const adminPassword = prompt("Digite a senha de administrador:");
    if (adminPassword === "admin123") {
        body.classList.add('admin-mode');
        localStorage.setItem('catalogMode', 'admin');
    } else {
        alert("Senha incorreta. Acesso negado.");
    }
});

userModeBtn.addEventListener('click', () => {
    body.classList.remove('admin-mode');
    localStorage.setItem('catalogMode', 'user');
});

// Adicionar eventos para os botões de editar e excluir já presentes no HTML
function adicionarEventosAcoes() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            alert("Funcionalidade de edição ativada (apenas administrador)");
        });
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            alert("Funcionalidade de exclusão ativada (apenas administrador)");
        });
    });
}

// Funcionalidade de pesquisa
document.querySelector('.search-box input').addEventListener('keyup', function() {
    const searchText = this.value.toLowerCase();
    const rows = document.querySelectorAll('.catalog-table tbody tr');
    rows.forEach(row => {
        const name = row.querySelector('td:first-child').textContent.toLowerCase();
        if (name.includes(searchText)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

// Simular adição de recurso (apenas para demonstração)
document.getElementById('addResource').addEventListener('click', () => {
    alert("Funcionalidade de adicionar recurso ativada (apenas administrador)");
});

// Adicionar eventos aos botões ao abrir a página
document.addEventListener('DOMContentLoaded', adicionarEventosAcoes);