document.addEventListener('DOMContentLoaded', () => {
  const addNewNoteButton = document.getElementById('addNewNoteButton');
  const noteListDiv = document.getElementById('noteList');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const selectedNoteDisplay = document.getElementById('selectedNoteDisplay');
  const displayNoteTitle = document.getElementById('displayNoteTitle');
  const editNoteTitleInput = document.getElementById('editNoteTitleInput');
  const editContent = document.getElementById('editContent');
  const renderedContent = document.getElementById('renderedContent');
  const deleteNoteButton = document.getElementById('deleteNoteButton');
  const searchInput = document.getElementById('searchInput');

  // Initialize Markdown-it
  const md = new markdownit();

  // Store the original text renderer
  const defaultTextRender = md.renderer.rules.text || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // Override the default text renderer to handle direct image links
  md.renderer.rules.text = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const text = token.content;
    const imageRegex = /(.*)(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))$/i; // Added $ to match end of string

    if (imageRegex.test(text)) {
      // 获取 match group[1]
      const groups = imageRegex.exec(text);
      const altText = groups[1].trim(); // Get the text before the image URL
      const imageUrl = groups[2]; // Get the image URL
      if (altText) {
        // If there is alt text, render it as a link with the image URL as the href
        return `<p>${altText}</p><img src="${imageUrl}" alt="">`;
      }
      // If the text is a direct image URL, render it as an image
      return `<img src="${text}" alt="">`;
    }

    // Otherwise, use the default text renderer
    return defaultTextRender(tokens, idx, options, env, self);
  };

  

  

  // Remote SQL API Endpoints (replace with your actual endpoints)
  // const SQL_API_ENDPOINT = 'https://stirring-faun-45b7f8.netlify.app/';
  const SQL_API_ENDPOINT = 'https://php-run-js-post.netlify.app/';
  const DATABASE_URL = 'http://emuyobzniv.ccccocccc.cc';

  let allNotes = []; // Store all notes for internal linking and display
  let currentSelectedNoteId = null; // Track the currently selected note ID
  let editorContentChanged = false; // Flag to track if editor content has changed
  let editorTitleChanged = false; // Flag to track if editor title has changed

  // Helper functions to show/hide loading overlay
  function showLoading() {
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  // Function to execute SQL queries against the remote API
  async function executeSql(sql, args = []) {
    showLoading(); // Show loading before executing SQL
    try {
      const requestBody = {
        url: DATABASE_URL,
        sql: sql,
      };
      if (args.length > 0) {
        requestBody.args = args;
      }

      const response = await fetch(SQL_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          return result.data; // Return the 'data' array from the successful response
        } else {
          throw new Error(result.message || 'SQL execution failed with unknown error.');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || response.statusText);
      }
    } catch (error) {
      console.error('Error executing SQL:', error);
      throw error;
    } finally {
      hideLoading(); // Hide loading after SQL execution (success or failure)
    }
  }

  // Function to display notes in the sidebar and handle selection
  function displayNotes(notesToRender) {
    noteListDiv.innerHTML = ''; // Clear current list
    
    if (notesToRender.length === 0) {
      noteListDiv.textContent = 'No notes yet. Add one!';
      selectedNoteDisplay.innerHTML = '<p>Select a note from the sidebar or add a new one.</p>';
      displayNoteTitle.textContent = '';
      editNoteTitleInput.value = '';
      editContent.value = '';
      renderedContent.innerHTML = '';
      currentSelectedNoteId = null;
      return;
    }

    notesToRender.forEach(note => {
      const noteItemDiv = document.createElement('div');
      noteItemDiv.className = 'note-item';
      noteItemDiv.dataset.noteId = note.id; // Store note ID

      const titleElement = document.createElement('h3');
      titleElement.textContent = note.title || 'Untitled Note';

      const contentSnippetElement = document.createElement('p');
      contentSnippetElement.textContent = note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''); // Show snippet

      noteItemDiv.appendChild(titleElement);
      noteItemDiv.appendChild(contentSnippetElement);

      noteItemDiv.addEventListener('click', () => {
        selectNote(note.id);
      });

      noteListDiv.appendChild(noteItemDiv);
    });

    // Automatically select the first note if available or re-select current
    if (notesToRender.length > 0) {
      if (currentSelectedNoteId && notesToRender.some(note => note.id === currentSelectedNoteId)) {
        selectNote(currentSelectedNoteId);
      } else {
        selectNote(notesToRender[0].id);
      }
    }
  }

  // Function to display a single selected note
  function selectNote(noteId) {
    const selectedNote = allNotes.find(note => note.id === noteId);
    if (selectedNote) {
      // Save current note content if changed before switching
      if (currentSelectedNoteId && editorContentChanged) {
        saveNoteContentChanges(currentSelectedNoteId, editContent.value);
      }
      // Save current note title if changed before switching
      if (currentSelectedNoteId && editorTitleChanged) {
        saveNoteTitleChanges(currentSelectedNoteId, editNoteTitleInput.value);
      }

      currentSelectedNoteId = noteId; // Update current selected note ID

      // Remove 'selected' class from previously selected note
      const currentSelected = document.querySelector('.note-item.selected');
      if (currentSelected) {
        currentSelected.classList.remove('selected');
      }

      // Add 'selected' class to the new selected note
      const newSelected = document.querySelector(`.note-item[data-note-id="${noteId}"]`);
      if (newSelected) {
        newSelected.classList.add('selected');
      }

      // Display title in view mode initially
      displayNoteTitle.textContent = selectedNote.title || 'Untitled Note';
      editNoteTitleInput.value = selectedNote.title || 'Untitled Note';
      displayNoteTitle.classList.remove('hidden');
      editNoteTitleInput.classList.add('hidden');

      // Display content in rendered view initially
      renderedContent.innerHTML = md.render(selectedNote.content);
      editContent.value = selectedNote.content; // Populate editor with raw content
      renderedContent.classList.remove('hidden');
      editContent.classList.add('hidden');

      editorContentChanged = false; // Reset content change flag
      editorTitleChanged = false; // Reset title change flag

      // Re-attach internal link handlers after rendering
      renderedContent.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) { 
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTitle = href.substring(1); 
            const targetNote = allNotes.find(note => note.title === targetTitle);
            if (targetNote) {
              selectNote(targetNote.id);
            } else {
              alert(`Note with title "${targetTitle}" not found.`);
            }
          });
        }
      });

    } else {
      selectedNoteDisplay.innerHTML = '<p>Note not found.</p>';
      displayNoteTitle.textContent = '';
      editNoteTitleInput.value = '';
      editContent.value = '';
      renderedContent.innerHTML = '';
      currentSelectedNoteId = null;
    }
  }

  // Function to save content changes to the currently selected note
  async function saveNoteContentChanges(idToUpdate, newContent) {
    const selectedNote = allNotes.find(note => note.id === idToUpdate);
    if (!selectedNote) return; 

    if (selectedNote.content === newContent && !editorContentChanged) {
      return; 
    }

    const updatedTitle = selectedNote.title; // Title is not edited here
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);

    try {
      await executeSql(
        'UPDATE notes SET title = ?, content = ?, mtime = ? WHERE id = ?',
        [updatedTitle, newContent, currentTimeInSeconds, idToUpdate]
      );
      selectedNote.content = newContent;
      selectedNote.mtime = currentTimeInSeconds;
      editorContentChanged = false; // Reset change flag after saving
      // No need to call displayNotes() here, as it will be called by initApp or search
    } catch (error) {
      alert(`Failed to update note content: ${error.message}`);
    }
  }

  // Function to save title changes to the currently selected note
  async function saveNoteTitleChanges(idToUpdate, newTitle) {
    const selectedNote = allNotes.find(note => note.id === idToUpdate);
    if (!selectedNote) return; 

    if (selectedNote.title === newTitle && !editorTitleChanged) {
      return; 
    }

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);

    try {
      await executeSql(
        'UPDATE notes SET title = ?, mtime = ? WHERE id = ?',
        [newTitle, currentTimeInSeconds, idToUpdate]
      );
      selectedNote.title = newTitle;
      selectedNote.mtime = currentTimeInSeconds;
      editorTitleChanged = false; // Reset change flag after saving
      // No need to call displayNotes() here, as it will be called by initApp or search
    } catch (error) {
      alert(`Failed to update note title: ${error.message}`);
    }
  }

  // Event listener for adding a new note
  addNewNoteButton.addEventListener('click', async () => {
    // Save current note content if changed before creating new
    if (currentSelectedNoteId && editorContentChanged) {
      await saveNoteContentChanges(currentSelectedNoteId, editContent.value);
    }
    // Save current note title if changed before creating new
    if (currentSelectedNoteId && editorTitleChanged) {
      await saveNoteTitleChanges(currentSelectedNoteId, editNoteTitleInput.value);
    }

    const newNoteTitle = 'Untitled Note';
    const newNoteContent = '';
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);

    try {
      const result = await executeSql(
        'INSERT INTO notes (title, content, ctime, mtime) VALUES (?, ?, ?, ?)',
        [newNoteTitle, newNoteContent, currentTimeInSeconds, currentTimeInSeconds]
      );
      // Re-fetch all notes to update the allNotes array and then display
      await initApp(); 
      const newNoteId = result && result.insertId ? result.insertId : null; 
      if (newNoteId) {
        selectNote(newNoteId); // Select the newly created note
      } else if (allNotes.length > 0) {
        selectNote(allNotes[0].id); // Fallback: select the newest note
      }
    } catch (error) {
      alert(`Failed to add new note: ${error.message}`);
    }
  });

  // Function to delete a note from remote storage
  deleteNoteButton.addEventListener('click', async () => {
    if (!currentSelectedNoteId) return; // No note selected
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }
    try {
      await executeSql(
        'DELETE FROM notes WHERE id = ?',
        [currentSelectedNoteId]
      );
      currentSelectedNoteId = null; // Reset selected note
      await initApp(); // Re-fetch all notes to update the allNotes array and then display
    } catch (error) {
      alert(`Failed to delete note: ${error.message}`);
    }
  });

  // Event listener for editor content changes
  editContent.addEventListener('input', () => {
    editorContentChanged = true;
  });

  // Event listener for editor blur (auto-save and switch to rendered view)
  editContent.addEventListener('blur', async () => {
    if (currentSelectedNoteId && editorContentChanged) {
      await saveNoteContentChanges(currentSelectedNoteId, editContent.value);
    }
    // Switch to rendered view after blur, if not currently editing title
    if (document.activeElement !== editNoteTitleInput) {
      renderedContent.innerHTML = md.render(editContent.value); // Render current content
      renderedContent.classList.remove('hidden');
      editContent.classList.add('hidden');
      // Re-attach internal link handlers after rendering
      renderedContent.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) { 
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTitle = href.substring(1); 
            const targetNote = allNotes.find(note => note.title === targetTitle);
            if (targetNote) {
              selectNote(targetNote.id);
            } else {
              alert(`Note with title "${targetTitle}" not found.`);
            }
          });
        }
      });
    }
  });

  // Event listener for double-clicking on rendered content (switch to edit mode)
  renderedContent.addEventListener('dblclick', async () => { // Added async
    if (currentSelectedNoteId) {
      // Re-fetch the note from the server
      try {
        const remoteNote = await executeSql(
          'SELECT id, title, content, ctime, mtime FROM notes WHERE id = ?',
          [currentSelectedNoteId]
        );

        if (remoteNote && remoteNote.length > 0) {
          const fetchedNote = remoteNote[0];
          const localNote = allNotes.find(note => note.id === currentSelectedNoteId);

          if (localNote) {
            // Compare content and modification time
            if (fetchedNote.content !== localNote.content || fetchedNote.mtime > localNote.mtime) {
              console.log('Remote note is newer or different. Updating local content.');
              localNote.content = fetchedNote.content;
              localNote.mtime = fetchedNote.mtime;
              editContent.value = fetchedNote.content; // Update editor with remote content
              editorContentChanged = false; // Reset flag as content is now synced with remote
              alert('Note updated from server due to newer version or content difference.');
            } else {
              console.log('Local note is up-to-date or newer. Using local content.');
            }
          }
        }
      } catch (error) {
        console.error('Failed to re-fetch note on double-click:', error);
        alert(`Failed to re-fetch note: ${error.message}. Using local version.`);
      }

      renderedContent.classList.add('hidden');
      editContent.classList.remove('hidden');
      editContent.focus();
    }
  });

  // Event listener for pressing Ctrl+Enter in the editor (auto-save and switch to rendered view)
  editContent.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (currentSelectedNoteId && editorContentChanged) {
        await saveNoteContentChanges(currentSelectedNoteId, editContent.value);
      }
      // Switch to rendered view after saving
      renderedContent.innerHTML = md.render(editContent.value); // Render current content
      renderedContent.classList.remove('hidden');
      editContent.classList.add('hidden');
      // Re-attach internal link handlers after rendering
      renderedContent.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) { 
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTitle = href.substring(1); 
            const targetNote = allNotes.find(note => note.title === targetTitle);
            if (targetNote) {
              selectNote(targetNote.id);
            } else {
              alert(`Note with title "${targetTitle}" not found.`);
            }
          });
        }
      });
    }
  });

  // Event listener for clicking on the display title (switch to edit mode)
  displayNoteTitle.addEventListener('click', () => {
    if (currentSelectedNoteId) {
      displayNoteTitle.classList.add('hidden');
      editNoteTitleInput.classList.remove('hidden');
      editNoteTitleInput.focus();
      editNoteTitleInput.select(); // Select all text for easy editing
    }
  });

  // Event listener for title input changes
  editNoteTitleInput.addEventListener('input', () => {
    editorTitleChanged = true;
  });

  // Event listener for title input blur (auto-save and switch to display view)
  editNoteTitleInput.addEventListener('blur', async () => {
    if (currentSelectedNoteId && editorTitleChanged) {
      await saveNoteTitleChanges(currentSelectedNoteId, editNoteTitleInput.value);
    }
    // Switch back to display view
    displayNoteTitle.textContent = editNoteTitleInput.value || 'Untitled Note';
    displayNoteTitle.classList.remove('hidden');
    editNoteTitleInput.classList.add('hidden');
  });

  // Event listener for pressing Enter in title input (auto-save and switch to display view)
  editNoteTitleInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (currentSelectedNoteId && editorTitleChanged) {
        await saveNoteTitleChanges(currentSelectedNoteId, editNoteTitleInput.value);
      }
      // Switch back to display view
      displayNoteTitle.textContent = editNoteTitleInput.value || 'Untitled Note';
      displayNoteTitle.classList.remove('hidden');
      editNoteTitleInput.classList.add('hidden');
    }
  });

  // Search functionality
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (query === '') {
      displayNotes(allNotes); // Show all notes if search is empty
      return;
    }

    const filteredNotes = allNotes.filter(note => {
      const title = note.title ? note.title.toLowerCase() : '';
      const content = note.content ? note.content.toLowerCase() : '';

      // Check for direct match
      if (title.includes(query) || content.includes(query)) {
        return true;
      }

      // Check for Pinyin match (title and content) without spaces
      const titlePinyin = pinyinPro.pinyin(title, { toneType: 'none', type: 'array' }).join('').toLowerCase();
      const contentPinyin = pinyinPro.pinyin(content, { toneType: 'none', type: 'array' }).join('').toLowerCase();

      if (titlePinyin.includes(query) || contentPinyin.includes(query)) {
        return true;
      }

      // Check for Pinyin first letter match (title and content) without spaces
      const titlePinyinFirstLetter = pinyinPro.pinyin(title, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
      const contentPinyinFirstLetter = pinyinPro.pinyin(content, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();

      if (titlePinyinFirstLetter.includes(query) || contentPinyinFirstLetter.includes(query)) {
        return true;
      }

      return false;
    });
    displayNotes(filteredNotes);
  });

  // Initial application setup function
  async function initApp() {
    try {
      allNotes = await executeSql(
        'SELECT id, title, content, ctime, mtime FROM notes ORDER BY ctime DESC'
      );
      displayNotes(allNotes);
    } catch (error) {
      noteListDiv.textContent = `Failed to load notes: ${error.message}`;
      selectedNoteDisplay.innerHTML = `<p>Failed to load notes: ${error.message}</p>`;
    }
  }

  // Function to handle image paste
  editContent.addEventListener('paste', async (event) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        event.preventDefault(); // Prevent default paste behavior

        const file = items[i].getAsFile();
        if (file) {
          showLoading();
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64Image = e.target.result.split(',')[1]; // Get base64 part
            const fileName = `pasted_image_${Date.now()}.${file.name.split('.').pop()}`; // Generate a unique file name

            try {
              // Upload the image
              const result = await executeSql(
                'INSERT INTO t_file (name, content) VALUES (?, ?)',
                [fileName, base64Image]
              );

              // Assuming the result contains the path or ID to construct the URL
              // This part needs to be adjusted based on your actual server response
              // For now, let's assume the server returns the full URL or a path that can be appended
              // to a base URL. Based on shot/shot_and_save.sh, it seems to be a direct path.
              const imageUrl = `https://cheerful-dodol-07eb0f.netlify.app/edge/decode/${fileName}`; // Construct the URL

              const markdownImage = `![${fileName}](${imageUrl})`;
              const currentContent = editContent.value;
              const start = editContent.selectionStart;
              const end = editContent.selectionEnd;

              editContent.value = currentContent.substring(0, start) + markdownImage + currentContent.substring(end);
              editorContentChanged = true; // Mark content as changed
              hideLoading();
            } catch (error) {
              alert(`Failed to upload image: ${error.message}`);
              hideLoading();
            }
          };
          reader.readAsDataURL(file);
          return; // Only handle the first image found
        }
      }
    }
  });

  // Initial display of notes when the page loads
  initApp();
});
