/**
 * Firebase Cloud Functions Entrypoint
 * Secure AI Backend powered by Google Genkit for VU Notes
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Declare secret parameter for Cloud Secret Manager
// Must be configured in Firebase CLI: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const { handleAIChat } = require('./ai/flows/chatFlow');

/**
 * Callable Firebase Cloud Function: chatWithAI
 * Securely invoked by authenticated client web apps.
 * 
 * Features:
 * - Server-side secret resolution (zero API keys exposed to frontend)
 * - Automatic Firebase Auth verification (supports signed-in and anonymous visitors)
 * - Input validation and character limit protection
 * - Clear, structured error handling
 */
exports.chatWithAI = onCall(
  {
    cors: true,
    secrets: [geminiApiKey],
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    // 1. Authentication check
    // Allows signed-in users and authenticated anonymous visitor sessions
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication required. You must have an active session (including anonymous visitor session) to use the AI assistant.'
      );
    }

    const data = request.data || {};
    const message = data.message;
    const conversationHistory = data.conversationHistory;
    const context = data.context;

    // 2. Validate input
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new HttpsError(
        'invalid-argument',
        'Missing input: The "message" field is required and must be a non-empty string.'
      );
    }

    if (message.length > 4000) {
      throw new HttpsError(
        'invalid-argument',
        'Message exceeds maximum length of 4,000 characters.'
      );
    }

    // 3. Verify Secret Configuration
    let apiKey = '';
    try {
      apiKey = geminiApiKey.value();
    } catch (e) {
      // Fallback to process.env if running in local emulator or container
      apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    }

    if (!apiKey) {
      console.error('Configuration Error: GEMINI_API_KEY secret is not configured.');
      throw new HttpsError(
        'failed-precondition',
        'AI backend service is not configured yet. The GEMINI_API_KEY secret must be set via Firebase CLI: firebase functions:secrets:set GEMINI_API_KEY'
      );
    }

    // 4. Execute Genkit Flow
    try {
      const userRole = request.auth.token?.role || (request.auth.token?.admin ? 'admin' : 'student');
      const response = await handleAIChat({
        apiKey,
        message: message.trim(),
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        context: context || {},
        userId: request.auth.uid,
        userRole
      });

      return response;
    } catch (err) {
      console.error('AI Flow Execution Error:', err);

      // Handle common API error states
      const errMsg = (err && err.message) ? err.message : String(err);

      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
        throw new HttpsError(
          'permission-denied',
          'AI Service Error: The configured GEMINI_API_KEY is invalid. Please check your Gemini API key.'
        );
      }

      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded')) {
        throw new HttpsError(
          'resource-exhausted',
          'AI Service is currently busy or has reached its rate limit. Please try again in a few moments.'
        );
      }

      if (errMsg.includes('not configured')) {
        throw new HttpsError('failed-precondition', errMsg);
      }

      throw new HttpsError(
        'internal',
        'An error occurred while generating the AI response. Please try again later.'
      );
    }
  }
);
