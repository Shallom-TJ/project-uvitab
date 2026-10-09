/**
 * Core AI Chat Flow powered by Google Genkit
 * Handles chat messaging with conversation history and academic context.
 */

const { getGenkitInstance } = require('../config');
const { getSystemPrompt } = require('../prompts/systemPrompts');

/**
 * Handles an AI chat request using Google Genkit
 * 
 * @param {object} params
 * @param {string} params.apiKey - Google AI secret key
 * @param {string} params.message - Current user query
 * @param {Array<{role: string, content: string}>} [params.conversationHistory] - Previous chat messages
 * @param {object} [params.context] - Course, faculty, or topic context
 * @param {string} params.userId - Firebase Auth UID
 * @param {string} params.userRole - User role (student, admin, superadmin)
 * @returns {Promise<{ reply: string, timestamp: string, status: string }>}
 */
async function handleAIChat({ apiKey, message, conversationHistory, context, userId, userRole }) {
  const { ai, z } = await getGenkitInstance(apiKey);

  const systemInstruction = getSystemPrompt({
    role: userRole,
    course: context && context.course,
    faculty: context && context.faculty,
  });

  // Prepare messages array for conversation history
  const historyMessages = [];
  if (Array.isArray(conversationHistory)) {
    for (const item of conversationHistory.slice(-10)) {
      if (item && item.role && item.content) {
        historyMessages.push({
          role: item.role === 'user' ? 'user' : 'model',
          content: [{ text: String(item.content) }]
        });
      }
    }
  }

  // Define chat flow in Genkit
  const chatFlow = ai.defineFlow(
    {
      name: 'academicChatFlow',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        reply: z.string(),
      }),
    },
    async (input) => {
      const allMessages = [
        ...historyMessages,
        {
          role: 'user',
          content: [{ text: input.message }]
        }
      ];

      const response = await ai.generate({
        system: systemInstruction,
        messages: allMessages,
        config: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        }
      });

      const replyText =
        response.text ||
        (response.candidates && response.candidates[0]?.message?.content?.[0]?.text) ||
        'No response generated.';

      return { reply: replyText };
    }
  );

  const result = await chatFlow({ message });

  return {
    reply: result.reply,
    timestamp: new Date().toISOString(),
    status: 'success'
  };
}

module.exports = {
  handleAIChat
};
