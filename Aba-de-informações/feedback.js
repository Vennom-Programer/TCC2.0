// Sample students data
const students = [
    { id: 's1', name: 'João Silva' },
    { id: 's2', name: 'Maria Oliveira' },
    { id: 's3', name: 'Lucas Pereira' },
    { id: 's4', name: 'Ana Souza' },
    { id: 's5', name: 'Carlos Santos' }
  ];

  const studentSelect = document.getElementById('studentSelect');
  const observationText = document.getElementById('observationText');
  const observationForm = document.getElementById('observationForm');
  const observationsList = document.getElementById('observationsList');

  // Populate student select options
  function populateStudents() {
    students.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = s.name;
      studentSelect.appendChild(option);
    });
  }

  // Get observations from localStorage
  function getObservations() {
    const stored = localStorage.getItem('studentObservations');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  // Save observations to localStorage
  function saveObservations(obsArray) {
    localStorage.setItem('studentObservations', JSON.stringify(obsArray));
  }

  // Render observations list
  function renderObservations() {
    const observations = getObservations();
    if (observations.length === 0) {
      observationsList.innerHTML = '<p style="color:#666;">Nenhuma observação adicionada ainda.</p>';
      return;
    }
    // Sort newest first
    observations.sort((a,b) => b.timestamp - a.timestamp);
    const fragment = document.createDocumentFragment();
    observationsList.innerHTML = '';
    observations.forEach(obs => {
      const student = students.find(s => s.id === obs.studentId);
      const div = document.createElement('div');
      div.className = 'obs-item';
      const dateStr = new Date(obs.timestamp).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
      div.innerHTML = `<strong>${student ? student.name : 'Aluno Desconhecido'}</strong>
                       <small>${dateStr}</small>
                       <p>${escapeHtml(obs.text)}</p>`;
      fragment.appendChild(div);
    });
    observationsList.appendChild(fragment);
  }

  // Escape HTML for safety
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Form submission handler
  observationForm.addEventListener('submit', e => {
    e.preventDefault();
    const studentId = studentSelect.value;
    const text = observationText.value.trim();
    if (!studentId || !text) return;

    const observations = getObservations();
    observations.push({
      studentId,
      text,
      timestamp: Date.now()
    });

    saveObservations(observations);
    renderObservations();

    // Reset form
    observationForm.reset();
    studentSelect.focus();
  });

  // Initialization
  populateStudents();
  renderObservations();

  // Tabs navigation (with only one tab now, but scalable)
  const tabs = document.querySelectorAll('nav.tabs button');
  const panels = document.querySelectorAll('main.content > section');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panelId = tab.getAttribute('aria-controls');
      panels.forEach(panel => {
        panel.hidden = panel.id !== panelId;
      });
    });
  });
  // Hide all panels except active on load
  panels.forEach(panel => {
    const tab = document.querySelector(`nav.tabs button[aria-controls="${panel.id}"]`);
    panel.hidden = !(tab && tab.classList.contains('active'));
  });