feather.replace();

// DOM Elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptionOutput = document.getElementById('transcriptionOutput');
const manualInput = document.getElementById('manualInput');
const compareButton = document.getElementById('compareButton');
const comparisonSection = document.getElementById('comparisonSection');
const comparisonResult = document.getElementById('comparisonResult');
const clearTranscriptionButton = document.getElementById('clearTranscriptionButton');
const clearManualInputButton = document.getElementById('clearManualInputButton');
const historyList = document.getElementById('historyList');
const audioSection = document.getElementById('audioSection');
const audioPlayer = document.getElementById('audioPlayer');
const deleteAudioBtn = document.getElementById('deleteAudioBtn');
const openAboutBtn = document.getElementById('openAboutBtn');
const aboutModal = document.getElementById('aboutModal');
const closeAbout = document.getElementById('closeAbout');
const darkModeToggle = document.getElementById('darkModeToggle');
const toggleSettingsButton = document.getElementById('toggleSettings');
const settingsPanel = document.getElementById('settingsPanel');
const timer = document.getElementById('timer');
const transcriptionWordCount = document.getElementById('transcriptionWordCount');
const manualWordCount = document.getElementById('manualWordCount');
const copyTranscriptionBtn = document.getElementById('copyTranscriptionBtn');
const downloadTranscriptionBtn = document.getElementById('downloadTranscriptionBtn');
const copyComparisonBtn = document.getElementById('copyComparisonBtn');
const notesInput = document.getElementById('notesInput');

// Custom Table elements
const customTable = document.getElementById('customTable');
const addRowBtn = document.getElementById('addRowBtn');
const removeRowBtn = document.getElementById('removeRowBtn');
const addColBtn = document.getElementById('addColBtn');
const removeColBtn = document.getElementById('removeColBtn');

let mediaRecorder, stream;
let audioChunks = [];
let transcribedText = "";
let audioBlob = null;
let history = [];
let recordingStartTime = null;
let processingStartTime = null;
let recordingTimerInterval = null;

// DARK MODE - persisted
function initDarkMode() {
  if(localStorage.getItem('theme') === 'dark'){
    document.documentElement.classList.add('dark');
    darkModeToggle.checked = true;
  } else {
    document.documentElement.classList.remove('dark');
    darkModeToggle.checked = false;
  }
}
initDarkMode();

darkModeToggle.onchange = function() {
  if(this.checked){
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme','dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme','light');
  }
};

// Toggle Settings Panel
toggleSettingsButton.onclick = () => {
  settingsPanel.style.display = (settingsPanel.style.display === 'block') ? 'none' : 'block';
};

// Timer helpers
function startTimer(){
  recordingStartTime = Date.now();
  timer.textContent = "Recording: 0.00s";
  recordingTimerInterval = setInterval(() => {
    const elapsed = ((Date.now() - recordingStartTime) / 1000).toFixed(2);
    timer.textContent = `Recording: ${elapsed}s`;
  }, 100);
}
function stopTimer(){
  clearInterval(recordingTimerInterval);
}

// UI helpers
function updateUIForRecording(isRecording){
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  compareButton.disabled = true;
  compareButton.classList.add('opacity-50', 'cursor-not-allowed');
  compareButton.setAttribute('aria-disabled', 'true');
  comparisonSection.classList.add('hidden');
  if(isRecording) {
    statusDiv.innerHTML = '<span data-feather="mic"></span> Recording... Press <b>Stop</b> when finished.';
    transcriptionOutput.innerHTML = '<p class="text-gray-400 dark:text-gray-500 italic select-text">Your final transcription will appear here.</p>';
    updateTranscriptionWordCount();
    feather.replace();
  }
}

function displayAudioPlayer(blob) {
  audioSection.style.display = "flex";
  audioPlayer.src = URL.createObjectURL(blob);
  audioPlayer.load();
}

deleteAudioBtn.onclick = function(){
  audioSection.style.display = "none";
  audioPlayer.src = "";
  audioBlob = null;
};

// Word count
function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}
function updateTranscriptionWordCount() {
  const text = transcriptionOutput.innerText || "";
  transcriptionWordCount.textContent = "Words: " + countWords(text);
}
function updateManualWordCount() {
  manualWordCount.textContent = "Words: " + countWords(manualInput.value);
}

// Set transcription with updating word count and text
function setTranscriptionText(text) {
  transcriptionOutput.innerHTML = `<p>${text || '<span class="text-gray-400 dark:text-gray-500 italic">No speech detected.</span>'}</p>`;
  transcribedText = text;
  updateTranscriptionWordCount();
}

// History rendering
function addToHistory(transcript, manual, score) {
  history.unshift({ transcript, manual, score, timestamp: new Date().toLocaleTimeString() });
  if(history.length > 8) history.pop();
  renderHistory();
}
function renderHistory(){
  if(!history.length){
    historyList.innerHTML = '<li class="text-gray-400 dark:text-gray-500 italic select-text">No past transcriptions yet.</li>';
    return;
  }
  historyList.innerHTML = "";
  for(const entry of history){
    historyList.innerHTML += `<li tabindex="0" class="py-1 px-2 border-l-4 border-violet-300 dark:border-violet-600 mb-1 rounded bg-gray-50 dark:bg-gray-700 shadow-sm select-text focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
      <span class="font-semibold text-violet-700 dark:text-violet-300">${entry.score}%</span>
      &mdash; <span class="text-xs text-gray-500 dark:text-gray-400 select-text">${entry.timestamp}</span><br/>
      <span class="text-gray-700 dark:text-gray-100 select-text">${entry.transcript}</span>
    </li>`;
  }
}

// Recording logic
async function startRecording() {
  startTimer();
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    updateUIForRecording(true);
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, {mimeType: 'audio/webm'});
    mediaRecorder.ondataavailable = e => e.data.size > 0 && audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      stopTimer();
      audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
      displayAudioPlayer(audioBlob);
      processingStartTime = Date.now();
      timer.textContent = "Processing transcription...";
      sendAudioToServer(audioBlob);
    };
    mediaRecorder.start();
  } catch(err){
    statusDiv.innerHTML = '<span data-feather="alert-triangle"></span> Error: Could not access microphone.';
    statusDiv.classList.remove('processing-indicator');
    updateUIForRecording(false);
    feather.replace();
  }
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive'){
    mediaRecorder.stop();
    updateUIForRecording(false);
    statusDiv.innerHTML = '<span data-feather="loader"></span> Processing audio...';
    statusDiv.classList.add('processing-indicator');
    feather.replace();
  }
}

async function sendAudioToServer(audioBlob){
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  try {
    const response = await fetch('/transcribe', { method: 'POST', body: formData });
    transcriptionOutput.innerHTML = '';
    if(response.ok){
      const data = await response.json();
      const newText = data.transcription ? data.transcription.trim() : "";
      setTranscriptionText(newText);
      if(newText){
        compareButton.disabled = false;
        compareButton.classList.remove('opacity-50', 'cursor-not-allowed');
        compareButton.setAttribute('aria-disabled', 'false');
      } else {
        compareButton.disabled = true;
        compareButton.classList.add('opacity-50', 'cursor-not-allowed');
        compareButton.setAttribute('aria-disabled', 'true');
      }
    } else {
      const errorData = await response.json();
      appendError(transcriptionOutput, "Server Error: " + errorData.error);
      setTranscriptionText('');
    }
  } catch {
    appendError(transcriptionOutput, "Network Error: Could not connect.");
    setTranscriptionText('');
  } finally {
    const elapsedTime = ((Date.now() - processingStartTime)/1000).toFixed(2);
    timer.textContent = `Processing Time: ${elapsedTime}s`;
    statusDiv.innerHTML = '<span data-feather="check-circle"></span> Ready! Press Start to record again.';
    statusDiv.classList.remove('processing-indicator');
    feather.replace();
  }
}

// Comparison logic
compareButton.onclick = () => {
  const manualText = manualInput.value.trim();
  if(!transcribedText || !manualText){
    alert("Please enter both transcribed and manual text.");
    return;
  }
  comparisonSection.classList.remove('hidden');
  const distance = levenshteinDistance(transcribedText.toLowerCase(), manualText.toLowerCase());
  const maxLength = Math.max(transcribedText.length, manualText.length);
  const similarity = maxLength ? ((maxLength - distance) / maxLength)*100 : 0;

  const transcribedWords = transcribedText.split(/\s+/);
  const manualWords = manualText.split(/\s+/);

  let highlightedHtml = "";
  for(let i=0; i < Math.max(transcribedWords.length, manualWords.length); i++){
    const tWord = transcribedWords[i];
    const mWord = manualWords[i];
    if(tWord === mWord) highlightedHtml += `<span class="match">${mWord || ''}</span> `;
    else if(mWord && !tWord) highlightedHtml += `<span class="insertion">${mWord}</span> `;
    else if(tWord && !mWord) highlightedHtml += `<span class="mismatch">${tWord}</span> `;
    else if(tWord && mWord) highlightedHtml += `<span class="mismatch">${tWord}</span> <span class="insertion">(${mWord})</span> `;
  }
  comparisonResult.innerHTML = `
    <div class="mb-2">
      <span class="inline-flex items-center bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 font-semibold px-3 py-1 rounded-lg gap-2 select-text">
        <span data-feather="percent"></span>Score: <span class="font-extrabold text-lg">${similarity.toFixed(2)}%</span>
      </span>
    </div>
    <div class="p-2 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg leading-relaxed select-text">${highlightedHtml}</div>
  `;
  addToHistory(transcribedText, manualText, similarity.toFixed(2));
  feather.replace();
};
// Levenshtein distance
function levenshteinDistance(a,b){
  const m = Array(b.length+1).fill(null).map(() => Array(a.length+1).fill(null));
  for(let i=0; i <= a.length; i++) m[0][i] = i;
  for(let j=0; j <= b.length; j++) m[j][0] = j;
  for(let j=1; j <= b.length; j++){
    for(let i=1; i <= a.length; i++){
      const indicator = a[i-1] === b[j-1] ? 0 : 1;
      m[j][i] = Math.min(m[j][i-1] + 1, m[j-1][i] + 1, m[j-1][i-1] + indicator);
    }
  }
  return m[b.length][a.length];
}

function appendError(el, msg){
  el.innerHTML = `<p class="text-red-600 font-bold flex items-center gap-1 select-text"><span data-feather="alert-triangle"></span>${msg}</p>`;
  feather.replace();
}

// Clear buttons behaviour
clearTranscriptionButton.onclick = () => {
  setTranscriptionText("");
  compareButton.disabled = true;
  compareButton.classList.add('opacity-50', 'cursor-not-allowed');
  compareButton.setAttribute('aria-disabled', 'true');
  comparisonSection.classList.add('hidden');
  updateTranscriptionWordCount();
};
clearManualInputButton.onclick = () => {
  manualInput.value = "";
  updateManualWordCount();
  comparisonSection.classList.add('hidden');
  compareButton.disabled = true;
  compareButton.classList.add('opacity-50', 'cursor-not-allowed');
  compareButton.setAttribute('aria-disabled', 'true');
};

// Update manual word count and enable compare button if conditions met
manualInput.addEventListener('input', () => {
  updateManualWordCount();
  let enabled = manualInput.value.trim() && transcribedText;
  compareButton.disabled = !enabled;
  compareButton.classList.toggle('opacity-50', !enabled);
  compareButton.classList.toggle('cursor-not-allowed', !enabled);
  compareButton.setAttribute('aria-disabled', !enabled ? 'true' : 'false');
});

// Start and stop recording buttons
startButton.onclick = startRecording;
stopButton.onclick = stopRecording;

// About modal open/close events
openAboutBtn.onclick = () => {
  aboutModal.classList.remove('opacity-0', 'pointer-events-none');
  aboutModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    aboutModal.querySelector('div').classList.remove('opacity-0', 'scale-95');
  }, 10);
};
closeAbout.onclick = () => {
  aboutModal.querySelector('div').classList.add('opacity-0', 'scale-95');
  setTimeout(() => {
    aboutModal.classList.add('opacity-0', 'pointer-events-none');
    aboutModal.setAttribute('aria-hidden', 'true');
  }, 200);
};
aboutModal.addEventListener('click', (e) => {
  if(e.target === aboutModal) {
    closeAbout.onclick();
  }
});

// Copy & Download Buttons
copyTranscriptionBtn.onclick = () => {
  if(!transcribedText.trim()) return alert("No transcription to copy.");
  navigator.clipboard.writeText(transcribedText).then(() => alert("Transcription copied to clipboard!"));
};

downloadTranscriptionBtn.onclick = () => {
  if(!transcribedText.trim()) return alert("No transcription to download.");
  const blob = new Blob([transcribedText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transcription.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

copyComparisonBtn.onclick = () => {
  const compText = comparisonResult.innerText.trim();
  if(!compText) return alert("No comparison result to copy.");
  navigator.clipboard.writeText(compText).then(() => alert("Comparison result copied to clipboard!"));
};

// Notes persistence in localStorage
const NOTES_STORAGE_KEY = 'whisperAnalyzerNotes';
function loadNotes() {
  const saved = localStorage.getItem(NOTES_STORAGE_KEY);
  if(saved) notesInput.value = saved;
}
function saveNotes() {
  localStorage.setItem(NOTES_STORAGE_KEY, notesInput.value);
}
loadNotes();
notesInput.addEventListener('input', saveNotes);

// CUSTOM TABLE IMPLEMENTATION
// Initialize table with 3x3
let tableRowCount = 3;
let tableColCount = 3;

function createCell(row, col){
  const td = document.createElement('td');
  td.contentEditable = "true";
  td.className = "editable-cell";
  td.dataset.row = row;
  td.dataset.col = col;
  td.addEventListener('paste', e => {
    // Prevent paste styling
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  return td;
}

function renderTable(){
  const tbody = customTable.querySelector("tbody");
  tbody.innerHTML = "";
  for(let r=0; r < tableRowCount; r++){
    const tr = document.createElement('tr');
    for(let c=0; c < tableColCount; c++){
      tr.appendChild(createCell(r,c));
    }
    tbody.appendChild(tr);
  }
}
renderTable();

// Add row
addRowBtn.onclick = () => {
  tableRowCount++;
  renderTable();
};
// Remove row
removeRowBtn.onclick = () => {
  if(tableRowCount > 1) {
    tableRowCount--;
    renderTable();
  }
};
// Add col
addColBtn.onclick = () => {
  tableColCount++;
  renderTable();
};
// Remove col
removeColBtn.onclick = () => {
  if(tableColCount > 1){
    tableColCount--;
    renderTable();
  }
};

// Initialize word counts on load
updateTranscriptionWordCount();
updateManualWordCount();