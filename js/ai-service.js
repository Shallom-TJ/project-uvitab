/* =========================================================
   VU NOTES — Client AI Service Integration
   Connects to Supabase Edge Functions / AI Assistant
   
   SECURITY NOTE:
   Zero private API keys are stored in client code.
   Requests are authenticated via Supabase session tokens
   and routed to Supabase Edge Functions.
   ========================================================= */

const AIService = (() => {
  let _conversationHistory = [];

  /**
   * Send a message to the AI academic assistant.
   * Routes securely to Supabase Edge Function `chatWithAI`
   * with intelligent academic fallback if the function is not yet deployed.
   * 
   * @param {string} message - User query or prompt
   * @param {object} [context] - Academic context (course, faculty, resource)
   * @returns {Promise<{ reply: string, timestamp: string }>}
   */
  async function sendMessage(message, context = {}) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error("Please enter a non-empty message.");
    }

    const trimmedMsg = message.trim();
    const config = window._SUPABASE_CONFIG || {};
    const supabaseUrl = config.url || 'https://wnxzqewpjanebtniadmj.supabase.co';
    const anonKey = config.anonKey || '';

    // Try calling Supabase Edge Function if available
    try {
      let authToken = anonKey;
      if (window.supabaseClient) {
        const { data } = await window.supabaseClient.auth.getSession();
        if (data && data.session && data.session.access_token) {
          authToken = data.session.access_token;
        }
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/chatWithAI`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: trimmedMsg,
          conversationHistory: _conversationHistory.slice(-8),
          context: context
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || "No response received from AI service.";
        _recordHistory(trimmedMsg, reply);
        return { reply, timestamp: data.timestamp || new Date().toISOString() };
      }
    } catch (networkErr) {
      console.warn("Supabase Edge Function not reachable, using local academic responder:", networkErr.message);
    }

    // Graceful local academic responder fallback (for offline or pre-edge-function state)
    const fallbackReply = _generateAcademicFallback(trimmedMsg, context);
    _recordHistory(trimmedMsg, fallbackReply);
    return {
      reply: fallbackReply,
      timestamp: new Date().toISOString()
    };
  }

  function _recordHistory(userMsg, modelReply) {
    _conversationHistory.push({ role: 'user', content: userMsg });
    _conversationHistory.push({ role: 'model', content: modelReply });
    if (_conversationHistory.length > 20) {
      _conversationHistory = _conversationHistory.slice(-20);
    }
  }

  function _generateAcademicFallback(query, context) {
    const qLower = query.toLowerCase();
    const course = context.course || 'your course';

    if (qLower.includes('exam') || qLower.includes('revision') || qLower.includes('past paper')) {
      return `For ${course} exam preparation at Victoria University Uganda:\n1. Review all approved lecture notes in the course folder.\n2. Work through the past examination papers and model answers.\n3. Book a peer tutor session under the Tutors tab if you need guided clarification on complex topics.`;
    }

    if (qLower.includes('upload') || qLower.includes('share') || qLower.includes('notes')) {
      return `To share materials for ${course}:\nClick the 'Upload Notes' button in the navigation bar. Ensure your file is an approved academic format (PDF, DOCX, PPTX), select your faculty and course code, and submit. All notes undergo student and admin moderation before being published.`;
    }

    if (qLower.includes('tutor') || qLower.includes('help') || qLower.includes('booking')) {
      return `To connect with a verified peer tutor:\nVisit the 'Find Tutors' tab to browse available student tutors by course, rating, and hourly rate. You can request a session, choose your preferred time slot, and manage your booking directly in the workspace.`;
    }

    return `Hello! I am your Victoria University Academic Assistant for ${course}. You can ask me about study strategies, course resources, past paper revision, or finding a peer tutor to assist with your coursework.`;
  }

  function clearHistory() {
    _conversationHistory = [];
  }

  function getHistory() {
    return [..._conversationHistory];
  }

  return {
    sendMessage,
    clearHistory,
    getHistory
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIService };
}
