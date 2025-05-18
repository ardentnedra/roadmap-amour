// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm';

// Supabase config
const supabaseUrl = '...';
const supabaseKey = '...';
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const todoList = document.getElementById('todoList');
const addForm = document.getElementById('addTodoForm');
const newTitle = document.getElementById('newTitle');
const newCategory = document.getElementById('newCategory');
const filterInputs = document.querySelectorAll('.filters input');
const filterOrder = ['💄 Looks', '🧠 Attitude', '🎮 Jeux', '🌍 Public', '🔒 Privé', '📷 Contenu'];

let todos = [];
let filters = [];

// Sync helper
function syncLocalAndRender(remoteTodos) {
  const localMap = new Map(todos.map(todo => [todo.id, todo]));
  remoteTodos.forEach(remote => {
    localMap.set(remote.id, { ...localMap.get(remote.id), ...remote });
  });
  todos = Array.from(localMap.values());
  localStorage.setItem('todos', JSON.stringify(todos));
  renderTodos();
}

// Load todos
async function loadTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('checked', { ascending: false })
    .order('position', { ascending: true });

  if (!error) {
    syncLocalAndRender(data);
    updateProgressBar();
  } else {
    console.error('[Supabase Error]', error);
    const cached = localStorage.getItem('todos');
    if (cached) {
      todos = JSON.parse(cached);
      renderTodos();
    }
  }

  new Sortable(todoList, {
    animation: 150,
    delay: 200,
    delayOnTouchOnly: true,
    handle: '.todo-left',
    fallbackOnBody: true,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    
    onStart: (evt) => {
      evt.item.style.width = `${evt.item.offsetWidth}px`;
    },
    
    onEnd: async (evt) => {
      evt.item.style.width = '';  // nettoyage
      const items = [...todoList.children];
      for (let i = 0; i < items.length; i++) {
        const id = parseInt(items[i].dataset.id);
        await supabase.from('todos').update({ position: i }).eq('id', id);
        const todoIndex = todos.findIndex(t => t.id === id);
        if (todoIndex !== -1) todos[todoIndex].position = i;
      }
      localStorage.setItem('todos', JSON.stringify(todos));
    }
  });
}

// Render todos
function renderTodos() {
  todoList.innerHTML = '';
  const visible = todos
    .filter(todo => !activeFilter || todo.category === activeFilter)
    .sort((a, b) => a.position - b.position);

  visible.forEach(todo => {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.checked ? ' checked' : '');
    item.dataset.id = todo.id;
    item.setAttribute('role', 'listitem');

    const left = document.createElement('div');
    left.className = 'todo-left';

    // Création du conteneur pour checkbox + label
    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'checkbox-group';

    // checkbox avec ID unique
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `todo-${todo.id}`;
    checkbox.checked = todo.checked;
    checkbox.setAttribute('aria-label', `Marquer "${todo.title}" comme ${todo.checked ? 'non terminé' : 'terminé'}`);
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

    // Label associé
    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = `todo-${todo.id}`;
    checkboxLabel.className = 'visually-hidden';
    checkboxLabel.textContent = `Marquer "${todo.title}" comme ${todo.checked ? 'non terminé' : 'terminé'}`;

    checkboxGroup.appendChild(checkbox);
    checkboxGroup.appendChild(checkboxLabel);

    // label texte avec double clic
    const label = document.createElement('label');
    label.className = 'todo-label';
    label.textContent = todo.title;
    label.addEventListener('touchstart', () => enterEditMode(item, todo));
    label.addEventListener('dblclick', () => enterEditMode(item, todo));

    // badge
    const badge = document.createElement('div');
    badge.className = 'todo-badge';
    badge.textContent = todo.category;

    // bloc texte + badge
    const textBlock = document.createElement('div');
    textBlock.className = 'todo-text-block';
    textBlock.appendChild(label);
    textBlock.appendChild(badge);

    // assemblage
    left.appendChild(checkboxGroup);
    left.appendChild(textBlock);
    
    item.appendChild(left);

    // Ajouter le bouton de suppression
    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = () => deleteTodo(todo.id);
    
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    
    todoList.appendChild(item);
  });
  
  updateProgressBar(); // Ajout de l'appel ici
}

// Fonction utilitaire pour l'édition
function enterEditMode(todoItem, todo) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = todo.title;
  input.className = 'edit-input';

  const label = todoItem.querySelector('.todo-label');
  label.replaceWith(input);
  
  // Focus automatique
  setTimeout(() => input.focus(), 0);
  

  input.addEventListener('blur', async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== todo.title) {
      const { error } = await supabase
        .from('todos')
        .update({ title: newTitle })
        .eq('id', todo.id);
      if (!error) {
        todo.title = newTitle;
        localStorage.setItem('todos', JSON.stringify(todos));
      }
    }
    renderTodos();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
}

// Update todo
async function toggleTodo(id, checked) {
  const item = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (item) item.classList.add('updating');

  // 🔔 Joue le son si on coche (pas décoche)
  if (checked) {
    const ding = document.getElementById('checkSound');
    if (ding) {
      ding.volume = 0.2;
      ding.currentTime = 0;
      ding.play();
    }

    // 💖 Animation douce
    item.classList.add('pulse');
    setTimeout(() => item.classList.remove('pulse'), 400);
  }

  todos = todos.map(todo => todo.id === id ? { ...todo, checked } : todo);
  localStorage.setItem('todos', JSON.stringify(todos));
  renderTodos();
  updateProgressBar();

  const { error } = await supabase.from('todos').update({ checked }).eq('id', id);
  if (error) console.error(error);

  if (item) item.classList.remove('updating');
}


// Modification de la fonction de suppression pour soft delete
async function deleteTodo(id) {
  const confirmDelete = confirm("Supprimer cette tâche ?");
  if (!confirmDelete) return;

  const delSound = document.getElementById('deleteSound');
if (delSound) {
  delSound.volume = 0.3;
  delSound.currentTime = 0;
  delSound.play();
}

  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erreur lors de la suppression.");
    return;
  }

  const item = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (item) {
    item.classList.add('fade-out');
    setTimeout(() => {
      todos = todos.filter(todo => todo.id !== id);
      localStorage.setItem('todos', JSON.stringify(todos));
      renderTodos();
      updateProgressBar();
    }, 500); // doit correspondre au CSS
  } else {
    todos = todos.filter(todo => todo.id !== id);
    localStorage.setItem('todos', JSON.stringify(todos));
    renderTodos();
    updateProgressBar();
  }
}

// Add todo
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = newTitle.value.trim();
  const category = newCategory.value;
  if (!title) return;

  const { data, error } = await supabase.from('todos').insert([{ title, category, checked: false, score: 0 }]).select();
  if (!error && data.length > 0) {
    todos.push(data[0]);
    localStorage.setItem('todos', JSON.stringify(todos));
    renderTodos();
    updateProgressBar(); // Ajout ici après l'ajout
    newTitle.value = '';
  } else {
    console.error(error);
  }
});

// Filter
let activeFilter = null;

document.querySelectorAll('.filter-btn').forEach(button => {
  button.addEventListener('click', () => {
    const category = button.dataset.category;

    if (activeFilter === category) {
      activeFilter = null; // Désactive si déjà actif
      button.classList.remove('active');
    } else {
      activeFilter = category;
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    }

    renderTodos();
  });
});

// Realtime sync (optimisé)
supabase.channel('todos-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, ({ eventType, new: newTodo, old: oldTodo }) => {
    if (eventType === 'INSERT') {
      todos.push(newTodo);
    } else if (eventType === 'UPDATE') {
      todos = todos.map(todo => todo.id === newTodo.id ? newTodo : todo);
    } else if (eventType === 'DELETE') {
      todos = todos.filter(todo => todo.id !== oldTodo.id);
    }
    localStorage.setItem('todos', JSON.stringify(todos));
    renderTodos();
    updateProgressBar(); // Ajout ici après les changements en temps réel
  })
  .subscribe();

  // Scroll to top functionality
window.addEventListener("scroll", function () {
  const btn = document.getElementById("scrollToTopBtn");
  if (window.scrollY > 300) {
    btn.classList.add("show");
  } else {
    btn.classList.remove("show");
  }
});

document.getElementById("scrollToTopBtn").addEventListener("click", function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Ajout de la nouvelle fonction
function updateProgressBar() {
  const allTodos = document.querySelectorAll('.todo-item');
  const checkedTodos = document.querySelectorAll('.todo-item.checked');

  const total = allTodos.length;
  const completed = checkedTodos.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');

  if (progressText && progressFill) {
    // Messages et couleurs selon l'avancement
    if (total === 0) {
      progressText.textContent = "Ajoutez vos premiers objectifs ! ✨";
      progressFill.style.backgroundColor = '#95a5a6';
    } else if (percent === 100) {
      progressText.textContent = "🎉 Tous les objectifs sont accomplis, bravo !";
      progressFill.style.backgroundColor = '#ff6b81';

      if (!document.getElementById('celebration')) {
        const burst = document.createElement('div');
        burst.id = 'celebration';
        burst.innerHTML = '💖';
        burst.style.position = 'fixed';
        burst.style.top = '50%';
        burst.style.left = '50%';
        burst.style.fontSize = '5rem';
        burst.style.transform = 'translate(-50%, -50%) scale(1)';
        burst.style.opacity = '1';
        burst.style.transition = 'transform 1s ease-out, opacity 1s ease-out';
        document.body.appendChild(burst);
        
        setTimeout(() => {
          burst.style.transform = 'translate(-50%, -50%) scale(2)';
          burst.style.opacity = '0';
        }, 100);

        setTimeout(() => {
          burst.remove();
        }, 2000);
      }
    } else if (percent >= 75) {
      progressText.textContent = `${completed}/${total} objectifs accomplis ! Presque fini 🌟`;
      progressFill.style.backgroundColor = '#ff9f43';
    } else if (percent >= 50) {
      progressText.textContent = `${completed}/${total} objectifs accomplis ! Continue 💪`;
      progressFill.style.backgroundColor = '#ffa502';
    } else {
      progressText.textContent = `${completed}/${total} objectifs accomplis 💖`;
      progressFill.style.backgroundColor = '#2ed573';
    }

    progressFill.style.width = `${percent}%`;

    // Effet "bump"
    progressFill.classList.add('bump');
    setTimeout(() => progressFill.classList.remove('bump'), 300);
  }
}

// Améliorer la gestion du cache et de l'historique
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Restauration depuis le cache
    loadTodos();
  }
});

// Nettoyer avant la navigation
window.addEventListener('pagehide', () => {
  // Sauvegarder l'état
  localStorage.setItem('scrollPosition', window.scrollY);
});

// Restaurer la position après chargement
document.addEventListener('DOMContentLoaded', () => {
  const scrollPos = localStorage.getItem('scrollPosition');
  if (scrollPos) {
    window.scrollTo(0, parseInt(scrollPos));
    localStorage.removeItem('scrollPosition');
  }
});

// Theme management
function applyTheme(theme) {
  document.body.className = theme;
  
  // Mise à jour du bouton actif
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function initThemes() {
  // Charger le thème sauvegardé
  const savedTheme = localStorage.getItem('selectedTheme');
  if (savedTheme) {
    applyTheme(savedTheme);
  }

  // Gestion des clics sur les boutons de thème
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      localStorage.setItem('selectedTheme', theme);
    });
  });
}

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', initThemes);

loadTodos();

