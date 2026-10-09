/* =========================================================
   VU NOTES — Client AI Service Integration
   Connects securely to Firebase Cloud Functions (Genkit)
   
   SECURITY NOTE:
   No API keys are included or used here. All communication
   is routed through the secure Firebase Callable Function
   `chatWithAI`, which validates caller authentication and
   accesses the server-side GEMINI_API_KEY secret.
   ========================================================= */

const AIService = (() => {
  let _conversationHistory = [];

  /**
   * Send a message to the secure Firebase Genkit AI backend.
   * Uses Firebase Callable Functions to automatically attach user authentication.
   * 
   * @param {string} message - User query or prompt
   * @param {object} [context] - Optional academic context (course, faculty, etc.)
   * @returns {Promise<{ reply: string, timestamp: string }>}
   */
  async function sendMessage(message, context = {}) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error("Please enter a non-empty message.");
    }

    if (typeof firebase === 'undefined') {
      throw new Error("Firebase SDK is not loaded. Check your internet connection.");
    }

    // Ensure functions SDK is loaded
    if (!firebase.functions) {
      throw new Error("Firebase Functions SDK is not loaded. Please include firebase-functions-compat.js.");
    }

    try {
      const functions = firebase.functions();
      const chatCallable = functions.httpsCallable('chatWithAI');

      const result = await chatCallable({
        message: message.trim(),
        conversationHistory: _conversationHistory.slice(-8),
        context: context
      });

      const data = result.data || {};
      const reply = data.reply || "No response received from AI service.";

      // Record in local session history
      _conversationHistory.push({ role: 'user', content: message.trim() });
      _conversationHistory.push({ role: 'model', content: reply });

      return {
        reply,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch (err) {
      console.error("AI Service error:", err);
      let userMessage = err.message || "Failed to communicate with AI service.";

      // Friendly mapping of Firebase Functions error codes
      if (err.code === 'unauthenticated') {
        userMessage = "You must be signed in (or have an active visitor session) to use the AI assistant.";
      } else if (err.code === 'failed-precondition') {
        userMessage = "The AI backend service is not configured yet. The GEMINI_API_KEY secret must be set via Firebase CLI.";
      } else if (err.code === 'resource-exhausted') {
        userMessage = "The AI service is currently busy. Please wait a few seconds and try again.";
      } else if (err.code === 'permission-denied') {
        userMessage = "AI service access denied: " + (err.message || 'Check your configuration.');
      } else if (err.code === 'not-found') {
        userMessage = "The AI Cloud Function is not deployed yet on this Firebase project.";
      }

      throw new Error(userMessage);
    }
  }

  /**
   * Reset local in-memory session conversation history.
   */
  function clearHistory() {
    _conversationHistory = [];
  }

  /**
   * Get copy of conversation history.
   */
  function getHistory() {
    return [..._conversationHistory];
  }

  return {
    sendMessage,
    clearHistory,
    getHistory
  };
})();

// Export for module or global environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIService };
}
