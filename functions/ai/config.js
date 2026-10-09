/**
 * Genkit Configuration & Initialization Module
 * Configures Google Genkit with the Google AI (Gemini) plugin.
 */

let cachedInstance = null;

/**
 * Initializes and returns a cached Genkit instance using the provided or environment secret API key.
 * 
 * @param {string} [apiKey] - Google GenAI API key from Firebase Secret Manager
 * @returns {Promise<{ ai: import('genkit').Genkit, z: import('zod').z }>}
 */
async function getGenkitInstance(apiKey) {
  if (cachedInstance) {
    return cachedInstance;
  }

  const resolvedKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please set the secret using: firebase functions:secrets:set GEMINI_API_KEY"
    );
  }

  let genkitModule, googleAIModule, zodModule;

  try {
    genkitModule = require('genkit');
  } catch (e) {
    genkitModule = await import('genkit');
  }

  try {
    googleAIModule = require('@genkit-ai/googleai');
  } catch (e) {
    googleAIModule = await import('@genkit-ai/googleai');
  }

  try {
    zodModule = require('zod');
  } catch (e) {
    zodModule = await import('zod');
  }

  const genkit = genkitModule.genkit || genkitModule.default?.genkit || genkitModule;
  const googleAI = googleAIModule.googleAI || googleAIModule.default?.googleAI || googleAIModule;
  const z = zodModule.z || zodModule.default?.z || zodModule;

  const ai = genkit({
    plugins: [googleAI({ apiKey: resolvedKey })],
    model: 'googleai/gemini-1.5-flash',
  });

  cachedInstance = { ai, z };
  return cachedInstance;
}

module.exports = {
  getGenkitInstance
};
