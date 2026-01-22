document.addEventListener('DOMContentLoaded', function () {
    const laboratorioBtn = document.querySelector('.menu-button.laboratorio');
    const auditorioBtn = document.querySelector('.menu-button.auditorio');
    const arquivosBtn = document.querySelector('.menu-button.arquivos');
    const catalogoBtn = document.querySelector('.menu-button.catalogo');

    if (laboratorioBtn) {
        laboratorioBtn.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.setItem('tipoReserva', 'laboratorio');
            window.location.href = '/calendario.html';
        });
    } else {
        console.warn('Elemento .menu-button.laboratorio não encontrado.');
    }

    if (auditorioBtn) {
        auditorioBtn.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.setItem('tipoReserva', 'auditorio');
            window.location.href = '/calendario.html';
        });
    } else {
        console.warn('Elemento .menu-button.auditorio não encontrado.');
    }

    if (arquivosBtn) {
        arquivosBtn.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.setItem('tipoReserva', 'arquivos');
            window.location.href = '/calendario.html';
        });
    } else {
        console.warn('Elemento .menu-button.arquivos não encontrado.');
    }

    if (catalogoBtn) {
        catalogoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = '/catalogo.html';
        });
    } else {
        console.warn('Elemento .menu-button.catalogo não encontrado.');
    }
});