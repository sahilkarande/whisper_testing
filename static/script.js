// DOM Elements
const startButton = document.getElementById("startButton")
const stopButton = document.getElementById("stopButton")
const statusDiv = document.getElementById("status")
const statusIndicator = document.getElementById("status-indicator")
const transcriptionOutput = document.getElementById("transcriptionOutput")
const clearTranscriptionButton = document.getElementById("clearTranscriptionButton")
const historyList = document.getElementById("historyList")
const audioSection = document.getElementById("audioSection")
const audioPlayer = document.getElementById("audioPlayer")
const deleteAudioBtn = document.getElementById("deleteAudioBtn")
const openAboutBtn = document.getElementById("openAboutBtn")
const aboutModal = document.getElementById("aboutModal")
const closeAbout = document.getElementById("closeAbout")
const darkModeToggle = document.getElementById("darkModeToggle")

// Timer Elements
const recordingTimer = document.getElementById("recordingTimer")
const processingTimer = document.getElementById("processingTimer")
const totalRecordingTime = document.getElementById("totalRecordingTime")
const totalProcessingTime = document.getElementById("totalProcessingTime")
const sessionsCompleted = document.getElementById("sessionsCompleted")
const transcriptionsSaved = document.getElementById("transcriptionsSaved")

// Word Count Elements
const transcriptionWordCount = document.getElementById("transcriptionWordCount")

// Action Buttons
const copyTranscriptionBtn = document.getElementById("copyTranscriptionBtn")
const downloadTranscriptionBtn = document.getElementById("downloadTranscriptionBtn")
const notesInput = document.getElementById("notesInput")

// New Submit Elements
const submitTranscriptionBtn = document.getElementById("submitTranscriptionBtn")
const successMessage = document.getElementById("successMessage")
const closeSuccessMessage = document.getElementById("closeSuccessMessage")

// Global Variables
let mediaRecorder = null
let stream = null
let audioChunks = []
let transcribedText = ""
let audioBlob = null
const history = []

// Timer Variables
let recordingStartTime = null
let processingStartTime = null
let recordingTimerInterval = null
let processingTimerInterval = null
let currentRecordingTime = 0
let currentProcessingTime = 0

// Session Statistics
let sessionStats = {
  totalRecordingTimeMs: 0,
  totalProcessingTimeMs: 0,
  sessionsCompleted: 0,
  transcriptionsSaved: 0,
}

// State Variables
let isRecording = false
let isProcessing = false
let isSubmitting = false

// Initialize timer displays
recordingTimer.textContent = "0:00"
processingTimer.textContent = "0:00"

// Load session stats from localStorage
function loadSessionStats() {
  const saved = localStorage.getItem("therapyConnectStats")
  if (saved) {
    try {
      sessionStats = JSON.parse(saved)
    } catch (e) {
      console.error("Failed to load session stats:", e)
    }
  }
  updateSessionStatsDisplay()
}

// Save session stats to localStorage
function saveSessionStats() {
  localStorage.setItem("therapyConnectStats", JSON.stringify(sessionStats))
}

// Update session stats display
function updateSessionStatsDisplay() {
  totalRecordingTime.textContent = formatTime(sessionStats.totalRecordingTimeMs)
  totalProcessingTime.textContent = formatTime(sessionStats.totalProcessingTimeMs)
  sessionsCompleted.textContent = sessionStats.sessionsCompleted.toString()
  transcriptionsSaved.textContent = sessionStats.transcriptionsSaved.toString()
}

// Format time in MM:SS format
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// Format time with milliseconds for current timers
function formatTimeWithMs(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const ms = Math.floor((milliseconds % 1000) / 10)
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
}

// Dark Mode Management
function initDarkMode() {
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}

initDarkMode()

darkModeToggle.addEventListener("click", () => {
  if (document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.remove("dark")
    localStorage.setItem("theme", "light")
  } else {
    document.documentElement.classList.add("dark")
    localStorage.setItem("theme", "dark")
  }
})

// Recording Timer Functions
function startRecordingTimer() {
  recordingStartTime = Date.now()
  currentRecordingTime = 0
  recordingTimer.textContent = "0:00.00"

  recordingTimerInterval = setInterval(() => {
    if (recordingStartTime) {
      currentRecordingTime = Date.now() - recordingStartTime
      recordingTimer.textContent = formatTimeWithMs(currentRecordingTime)
    }
  }, 100)
}

function stopRecordingTimer() {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval)
    recordingTimerInterval = null
  }

  if (currentRecordingTime > 0) {
    sessionStats.totalRecordingTimeMs += currentRecordingTime
    saveSessionStats()
    updateSessionStatsDisplay()
  }
}

// Processing Timer Functions
function startProcessingTimer() {
  processingStartTime = Date.now()
  currentProcessingTime = 0
  processingTimer.textContent = "0:00.00"

  processingTimerInterval = setInterval(() => {
    if (processingStartTime) {
      currentProcessingTime = Date.now() - processingStartTime
      processingTimer.textContent = formatTimeWithMs(currentProcessingTime)
    }
  }, 100)
}

function stopProcessingTimer() {
  if (processingTimerInterval) {
    clearInterval(processingTimerInterval)
    processingTimerInterval = null
  }

  if (currentProcessingTime > 0) {
    sessionStats.totalProcessingTimeMs += currentProcessingTime
    sessionStats.sessionsCompleted += 1
    saveSessionStats()
    updateSessionStatsDisplay()
  }
}

// Reset current timers
function resetCurrentTimers() {
  recordingTimer.textContent = "0:00"
  processingTimer.textContent = "0:00"
  currentRecordingTime = 0
  currentProcessingTime = 0
}

// UI Helper Functions
function updateStatus(message, type = "ready") {
  statusDiv.innerHTML = message

  // Update status indicator
  statusIndicator.className = `w-3 h-3 rounded-full animate-pulse`

  switch (type) {
    case "recording":
      statusIndicator.classList.add("bg-red-500")
      break
    case "processing":
      statusIndicator.classList.add("bg-yellow-500")
      break
    case "error":
      statusIndicator.classList.add("bg-red-600")
      break
    default:
      statusIndicator.classList.add("bg-green-400")
  }

  // Replace feather icons
  if (window.feather) {
    window.feather.replace()
  }
}

function updateUIForRecording(recording) {
  isRecording = recording

  startButton.disabled = recording
  stopButton.disabled = !recording

  if (recording) {
    startButton.classList.add("opacity-50", "cursor-not-allowed")
    stopButton.classList.remove("opacity-50", "cursor-not-allowed")
    updateStatus('<span data-feather="mic"></span> Recording... Press <b>Stop</b> when finished.', "recording")
  } else {
    startButton.classList.remove("opacity-50", "cursor-not-allowed")
    stopButton.classList.add("opacity-50", "cursor-not-allowed")
    if (!isProcessing) {
      updateStatus('<span data-feather="check-circle"></span> Ready! Press Start to record again.', "ready")
    }
  }

  // Update button states
  updateSubmitButtonState()
}

function updateUIForProcessing(processing) {
  isProcessing = processing

  if (processing) {
    updateStatus('<span data-feather="loader"></span> Processing audio...', "processing")
    // Disable all buttons during processing
    startButton.disabled = true
    startButton.classList.add("opacity-50", "cursor-not-allowed")
  } else {
    startButton.disabled = false
    startButton.classList.remove("opacity-50", "cursor-not-allowed")
  }

  updateSubmitButtonState()
}

function displayAudioPlayer(blob) {
  audioSection.classList.remove("hidden")
  const audioUrl = URL.createObjectURL(blob)
  audioPlayer.src = audioUrl
  audioPlayer.load()
}

// Submit Button State Management
function updateSubmitButtonState() {
  if (!submitTranscriptionBtn) {
    console.warn("Submit button not found")
    return
  }

  const enabled = transcribedText && transcribedText.trim() && !isRecording && !isProcessing && !isSubmitting
  submitTranscriptionBtn.disabled = !enabled
  submitTranscriptionBtn.classList.toggle("opacity-50", !enabled)
  submitTranscriptionBtn.classList.toggle("cursor-not-allowed", !enabled)
}

// Success Message Functions
function showSuccessMessage() {
  successMessage.classList.remove("hidden")
  successMessage.classList.add("animate-slideUp")

  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideSuccessMessage()
  }, 5000)

  if (window.feather) {
    window.feather.replace()
  }
}

function hideSuccessMessage() {
  successMessage.classList.add("hidden")
  successMessage.classList.remove("animate-slideUp")
}

// Submit Transcription Function
async function submitTranscription() {
  if (!transcribedText || !transcribedText.trim()) {
    alert("No transcription to submit.")
    return
  }

  isSubmitting = true
  updateSubmitButtonState()

  // Update button text to show loading
  const originalContent = submitTranscriptionBtn.innerHTML
  submitTranscriptionBtn.innerHTML = `
    <div class="relative flex items-center gap-2">
      <span data-feather="loader" class="w-4 h-4 animate-spin"></span>
      <span>Submitting...</span>
    </div>
  `

  if (window.feather) {
    window.feather.replace()
  }

  try {
    const submissionData = {
      transcription: transcribedText,
      timestamp: new Date().toISOString(),
      wordCount: countWords(transcribedText),
      notes: notesInput.value.trim(),
      recordingTime: formatTime(currentRecordingTime),
      processingTime: formatTime(currentProcessingTime),
      sessionId: Date.now().toString(),
    }

    console.log("Submitting transcription:", submissionData)

    const response = await fetch("/submit-transcription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submissionData),
    })

    if (response.ok) {
      const result = await response.json()
      console.log("Submission successful:", result)

      // Update stats
      sessionStats.transcriptionsSaved += 1
      saveSessionStats()
      updateSessionStatsDisplay()

      // Show success message
      showSuccessMessage()

      // Add to history with submission info
      addToHistory(transcribedText, true)
    } else {
      const errorData = await response.json().catch(() => ({ error: "Unknown server error" }))
      console.error("Submission failed:", errorData)
      alert(`Submission failed: ${errorData.error}`)
    }
  } catch (error) {
    console.error("Network error during submission:", error)
    alert("Network error: Could not submit transcription. Please check your connection.")
  } finally {
    isSubmitting = false

    // Restore button content
    submitTranscriptionBtn.innerHTML = originalContent

    updateSubmitButtonState()

    if (window.feather) {
      window.feather.replace()
    }
  }
}

// Word Count Functions
function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length
}

function updateTranscriptionWordCount() {
  const text = transcriptionOutput.innerText || ""
  transcriptionWordCount.textContent = "Words: " + countWords(text)
}

function setTranscriptionText(text) {
  if (text && text.trim()) {
    transcriptionOutput.innerHTML = `<p class="text-gray-800 dark:text-gray-200 select-text">${text}</p>`
    transcribedText = text
  } else {
    transcriptionOutput.innerHTML =
      '<p class="text-gray-400 dark:text-gray-500 italic flex items-center gap-2"><span data-feather="mic-off" class="w-4 h-4"></span>No speech detected or transcription failed.</p>'
    transcribedText = ""
  }
  updateTranscriptionWordCount()
  updateSubmitButtonState()

  if (window.feather) {
    window.feather.replace()
  }
}

// History Management
function addToHistory(transcript, isSubmitted = false) {
  const historyEntry = {
    transcript,
    timestamp: new Date().toLocaleTimeString(),
    recordingTime: formatTime(currentRecordingTime),
    processingTime: formatTime(currentProcessingTime),
    isSubmitted: isSubmitted,
  }

  history.unshift(historyEntry)
  if (history.length > 8) history.pop()
  renderHistory()
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML =
      '<li class="text-gray-400 dark:text-gray-500 italic select-text">No past transcriptions yet.</li>'
    return
  }

  historyList.innerHTML = ""
  for (const entry of history) {
    const listItem = document.createElement("li")
    listItem.className = "history-item"

    const submittedBadge = entry.isSubmitted
      ? '<span class="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full"><span data-feather="check" class="w-3 h-3"></span>Saved</span>'
      : ""

    listItem.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-2">
          ${submittedBadge}
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400 select-text">${entry.timestamp}</span>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-100 select-text truncate mb-2">${entry.transcript.substring(0, 60)}${entry.transcript.length > 60 ? "..." : ""}</p>
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1">
          <span data-feather="mic" class="w-3 h-3"></span>
          ${entry.recordingTime}
        </span>
        <span class="flex items-center gap-1">
          <span data-feather="cpu" class="w-3 h-3"></span>
          ${entry.processingTime}
        </span>
      </div>
    `
    historyList.appendChild(listItem)
  }

  // Replace feather icons in history
  if (window.feather) {
    window.feather.replace()
  }
}

// Recording Functions
async function startRecording() {
  console.log("Starting recording...")

  // Hide any existing success messages
  hideSuccessMessage()

  try {
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Your browser doesn't support audio recording")
    }

    console.log("Browser supports getUserMedia")

    // Request microphone access with more detailed logging
    console.log("Requesting microphone access...")
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    })

    console.log("Microphone access granted, stream:", stream)
    console.log("Audio tracks:", stream.getAudioTracks())

    // Reset audio chunks and timers
    audioChunks = []
    resetCurrentTimers()

    // Create MediaRecorder with better error handling
    let options = { mimeType: "audio/webm;codecs=opus" }

    // Test different mime types and log which one works
    const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"]

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType
        console.log("Using supported mimeType:", mimeType)
        break
      }
    }

    if (!options.mimeType) {
      console.warn("No supported mimeType found, using default")
      options = {}
    }

    mediaRecorder = new MediaRecorder(stream, options)
    console.log("MediaRecorder created successfully with mimeType:", mediaRecorder.mimeType)

    // Set up event handlers
    mediaRecorder.ondataavailable = (event) => {
      console.log("Data available:", event.data.size, "bytes")
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      console.log("Recording stopped, processing audio...")
      stopRecordingTimer()

      if (audioChunks.length === 0) {
        console.error("No audio data recorded")
        updateStatus('<span data-feather="alert-triangle"></span> No audio data recorded. Please try again.', "error")
        updateUIForRecording(false)
        return
      }

      // Create blob from chunks
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" })
      console.log("Audio blob created:", audioBlob.size, "bytes")

      // Display audio player
      displayAudioPlayer(audioBlob)

      // Start processing
      updateUIForProcessing(true)
      startProcessingTimer()

      // Send to server
      await sendAudioToServer(audioBlob)
    }

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error)
      updateStatus('<span data-feather="alert-triangle"></span> Recording error: ' + event.error.message, "error")
      updateUIForRecording(false)
      stopRecordingTimer()
    }

    // Start recording
    mediaRecorder.start(1000) // Collect data every second
    console.log("MediaRecorder started")

    // Update UI and start timer
    updateUIForRecording(true)
    startRecordingTimer()
  } catch (err) {
    console.error("Error starting recording:", err)
    let errorMessage = "Error: Could not access microphone."

    if (err.name === "NotAllowedError") {
      errorMessage = "Error: Microphone access denied. Please allow microphone access and try again."
    } else if (err.name === "NotFoundError") {
      errorMessage = "Error: No microphone found. Please connect a microphone and try again."
    } else if (err.name === "NotSupportedError") {
      errorMessage = "Error: Your browser doesn't support audio recording."
    }

    updateStatus(`<span data-feather="alert-triangle"></span> ${errorMessage}`, "error")
    updateUIForRecording(false)
  }
}

function stopRecording() {
  console.log("Stopping recording...")

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop()
    console.log("MediaRecorder stopped")
  }

  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop()
      console.log("Track stopped:", track.kind)
    })
    stream = null
  }

  updateUIForRecording(false)
}

async function sendAudioToServer(audioBlob) {
  console.log("Sending audio to server...")
  console.log("Audio blob size:", audioBlob.size, "bytes")
  console.log("Audio blob type:", audioBlob.type)

  if (audioBlob.size === 0) {
    console.error("Audio blob is empty!")
    updateStatus('<span data-feather="alert-triangle"></span> Error: No audio data to send.', "error")
    return
  }

  const formData = new FormData()

  // Determine file extension based on blob type
  let filename = "recording.webm"
  if (audioBlob.type.includes("mp4")) {
    filename = "recording.mp4"
  } else if (audioBlob.type.includes("wav")) {
    filename = "recording.wav"
  } else if (audioBlob.type.includes("mpeg")) {
    filename = "recording.mp3"
  }

  console.log("Using filename:", filename)
  formData.append("audio", audioBlob, filename)

  try {
    console.log("Making request to /transcribe...")
    console.log("Request URL:", window.location.origin + "/transcribe")

    const response = await fetch("/transcribe", {
      method: "POST",
      body: formData,
    })

    console.log("Response received:")
    console.log("Status:", response.status)
    console.log("Status Text:", response.statusText)
    console.log("Headers:", Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const data = await response.json()
      console.log("Transcription response:", data)

      const newText = data.transcription ? data.transcription.trim() : ""
      setTranscriptionText(newText)

      if (newText) {
        updateStatus('<span data-feather="check-circle"></span> Transcription completed successfully!', "ready")
      } else {
        updateStatus('<span data-feather="info"></span> No speech detected in the recording.', "ready")
      }
    } else {
      const errorData = await response.json().catch(() => ({ error: "Unknown server error" }))
      console.error("Server error:", errorData)
      updateStatus(`<span data-feather="alert-triangle"></span> Server Error: ${errorData.error}`, "error")
      setTranscriptionText("")
    }
  } catch (error) {
    console.error("Network error:", error)
    updateStatus(
      '<span data-feather="wifi-off"></span> Network Error: Could not connect to server. Please check your connection.',
      "error",
    )
    setTranscriptionText("")
  } finally {
    updateUIForProcessing(false)
    stopProcessingTimer()
  }
}

// Copy and Download Functions
function copyToClipboard(text, successMessage) {
  if (!text || !text.trim()) {
    alert("Nothing to copy.")
    return
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Show success message in a more user-friendly way
        showTemporaryMessage(successMessage, "success")
      })
      .catch((err) => {
        console.error("Failed to copy:", err)
        // Fallback method
        fallbackCopyTextToClipboard(text, successMessage)
      })
  } else {
    // Fallback for older browsers
    fallbackCopyTextToClipboard(text, successMessage)
  }
}

function fallbackCopyTextToClipboard(text, successMessage) {
  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.style.position = "fixed"
  textArea.style.left = "-999999px"
  textArea.style.top = "-999999px"
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  try {
    const successful = document.execCommand("copy")
    if (successful) {
      showTemporaryMessage(successMessage, "success")
    } else {
      showTemporaryMessage("Failed to copy to clipboard.", "error")
    }
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err)
    showTemporaryMessage("Failed to copy to clipboard.", "error")
  }

  document.body.removeChild(textArea)
}

function downloadText(text, filename) {
  if (!text || !text.trim()) {
    alert("Nothing to download.")
    return
  }

  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showTemporaryMessage("File downloaded successfully!", "success")
  } catch (error) {
    console.error("Download failed:", error)
    showTemporaryMessage("Failed to download file.", "error")
  }
}

function showTemporaryMessage(message, type = "info") {
  // Create a temporary message element
  const messageEl = document.createElement("div")
  messageEl.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`

  if (type === "success") {
    messageEl.className += " bg-green-500 text-white"
  } else if (type === "error") {
    messageEl.className += " bg-red-500 text-white"
  } else {
    messageEl.className += " bg-blue-500 text-white"
  }

  messageEl.textContent = message
  document.body.appendChild(messageEl)

  // Animate in
  setTimeout(() => {
    messageEl.classList.remove("translate-x-full")
  }, 10)

  // Animate out and remove
  setTimeout(() => {
    messageEl.classList.add("translate-x-full")
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
    }, 300)
  }, 3000)
}

// Notes Management
const NOTES_STORAGE_KEY = "therapyConnectNotes"

function loadNotes() {
  const saved = localStorage.getItem(NOTES_STORAGE_KEY)
  if (saved) notesInput.value = saved
}

function saveNotes() {
  localStorage.setItem(NOTES_STORAGE_KEY, notesInput.value)
}

// Event Listeners
startButton.addEventListener("click", startRecording)
stopButton.addEventListener("click", stopRecording)

// Submit button event listener
submitTranscriptionBtn.addEventListener("click", submitTranscription)

// Success message close button
closeSuccessMessage.addEventListener("click", hideSuccessMessage)

clearTranscriptionButton.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Clear button clicked")
  setTranscriptionText("")
  hideSuccessMessage()
  showTemporaryMessage("Transcription cleared", "info")
})

deleteAudioBtn.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Delete audio button clicked")

  // Hide audio section
  audioSection.classList.add("hidden")

  // Clean up audio player
  if (audioPlayer.src) {
    try {
      URL.revokeObjectURL(audioPlayer.src)
    } catch (error) {
      console.warn("Failed to revoke audio URL:", error)
    }
  }
  audioPlayer.src = ""
  audioPlayer.load()

  // Clear audio blob
  audioBlob = null

  showTemporaryMessage("Audio recording deleted", "info")
})

// Modal Events - Improved with better error handling
openAboutBtn.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Opening about modal...")

  const modal = document.getElementById("aboutModal")
  const modalContent = document.getElementById("aboutModalContent")

  if (!modal || !modalContent) {
    console.error("Modal elements not found")
    return
  }

  // Show modal
  modal.classList.remove("opacity-0", "pointer-events-none")
  modal.classList.add("opacity-100", "pointer-events-auto")

  // Animate modal content
  setTimeout(() => {
    modalContent.classList.remove("opacity-0", "scale-95")
    modalContent.classList.add("opacity-100", "scale-100")
  }, 10)

  // Replace feather icons
  if (window.feather) {
    window.feather.replace()
  }
})

closeAbout.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Closing about modal...")
  closeModal()
})

// Function to close modal
function closeModal() {
  const modal = document.getElementById("aboutModal")
  const modalContent = document.getElementById("aboutModalContent")

  if (!modal || !modalContent) {
    console.error("Modal elements not found")
    return
  }

  // Animate modal content out
  modalContent.classList.remove("opacity-100", "scale-100")
  modalContent.classList.add("opacity-0", "scale-95")

  // Hide modal after animation
  setTimeout(() => {
    modal.classList.remove("opacity-100", "pointer-events-auto")
    modal.classList.add("opacity-0", "pointer-events-none")
  }, 200)
}

// Close modal when clicking outside
aboutModal.addEventListener("click", (e) => {
  if (e.target === aboutModal) {
    closeModal()
  }
})

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("aboutModal")
    if (modal && !modal.classList.contains("pointer-events-none")) {
      closeModal()
    }
  }
})

// Copy and Download Events
copyTranscriptionBtn.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Copy button clicked, transcribed text:", transcribedText)
  copyToClipboard(transcribedText, "Transcription copied to clipboard!")
})

downloadTranscriptionBtn.addEventListener("click", (e) => {
  e.preventDefault()
  console.log("Download button clicked, transcribed text:", transcribedText)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
  downloadText(transcribedText, `transcription_${timestamp}.txt`)
})

// Notes Events
notesInput.addEventListener("input", saveNotes)

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Space bar to start/stop recording (when not typing in inputs)
  if (e.code === "Space" && !e.target.matches("input, textarea")) {
    e.preventDefault()
    if (isRecording) {
      stopRecording()
    } else if (!isProcessing) {
      startRecording()
    }
  }

  // Escape to stop recording
  if (e.code === "Escape" && isRecording) {
    stopRecording()
  }

  // Enter to submit transcription (when not typing in inputs)
  if (e.code === "Enter" && e.ctrlKey && !e.target.matches("input, textarea")) {
    e.preventDefault()
    if (!submitTranscriptionBtn.disabled) {
      submitTranscription()
    }
  }
})

// Test microphone access on page load
async function testMicrophoneAccess() {
  try {
    console.log("Testing microphone access...")

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("getUserMedia not supported")
      updateStatus(
        '<span data-feather="alert-triangle"></span> Your browser does not support audio recording.',
        "error",
      )
      return false
    }

    // Test if we can get microphone permissions
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter((device) => device.kind === "audioinput")

    console.log("Available audio input devices:", audioInputs.length)

    if (audioInputs.length === 0) {
      console.error("No audio input devices found")
      updateStatus(
        '<span data-feather="alert-triangle"></span> No microphone found. Please connect a microphone.',
        "error",
      )
      return false
    }

    console.log("Microphone test passed")
    return true
  } catch (error) {
    console.error("Microphone test failed:", error)
    updateStatus('<span data-feather="alert-triangle"></span> Microphone access test failed: ' + error.message, "error")
    return false
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Initializing Therapy Connect...")

  loadNotes()
  loadSessionStats()
  updateTranscriptionWordCount()
  renderHistory()
  updateSubmitButtonState()

  // Test microphone access
  await testMicrophoneAccess()

  // Initialize feather icons
  if (window.feather) {
    window.feather.replace()
  }

  console.log("Therapy Connect initialized successfully")
})

// Check server health on load
fetch("/health")
  .then((response) => response.json())
  .then((data) => {
    console.log("Server health:", data)
    if (!data.model_loaded) {
      updateStatus(
        '<span data-feather="alert-triangle"></span> Warning: Whisper model not loaded. Transcription may not work.',
        "error",
      )
    }
  })
  .catch((error) => {
    console.error("Could not check server health:", error)
    updateStatus('<span data-feather="wifi-off"></span> Warning: Could not connect to server.', "error")
  })
