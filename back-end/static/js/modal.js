// Simple modal utility
(function () {
  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'app-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '20px';
    box.style.borderRadius = '6px';
    box.style.maxWidth = '90%';
    box.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

    const message = document.createElement('div');
    message.id = 'app-modal-message';
    message.style.marginBottom = '12px';

    const btn = document.createElement('button');
    btn.textContent = 'Fechar';
    btn.addEventListener('click', function () {
      document.body.removeChild(modal);
    });

    box.appendChild(message);
    box.appendChild(btn);
    modal.appendChild(box);
    return modal;
  }

  window.showModal = function (text) {
    // ensure no duplicate
    if (document.getElementById('app-modal')) return;
    const modal = createModal();
    modal.querySelector('#app-modal-message').textContent = text;
    document.body.appendChild(modal);
  };
})();
