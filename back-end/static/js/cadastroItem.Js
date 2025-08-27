document.getElementsByClassName('btn btn-secondary')[0].addEventListener('click', function() {
    window.location.href = 'index.html';
});

document.getElementsByClassName('btn btn-primary')[0].addEventListener('click', function(event) {
    event.preventDefault();
    // Add your form submission logic here
    alert('Item cadastrado com sucesso!');
});

