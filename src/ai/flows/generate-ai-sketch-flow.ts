
'use server';
/**
 * @fileOverview A Genkit flow to generate an AI sketch for a given word.
 *
 * - generateAISketch - A function that generates a sketch, with DeepSeek as fallback.
 * - GenerateAISketchInput - The input type for the generateAISketch function.
 * - GenerateAISketchOutput - The return type for the generateAISketch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAISketchInputSchema = z.object({
  chosenWord: z.string().describe('The word for which to generate a sketch.'),
});
export type GenerateAISketchInput = z.infer<typeof GenerateAISketchInputSchema>;

const GenerateAISketchOutputSchema = z.object({
  imageDataUri: z.string().describe(
    "The generated sketch as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."
  ),
});
export type GenerateAISketchOutput = z.infer<typeof GenerateAISketchOutputSchema>;

export async function generateAISketch(input: GenerateAISketchInput): Promise<GenerateAISketchOutput> {
  return generateAISketchFlow(input);
}

const generateAISketchFlow = ai.defineFlow(
  {
    name: 'generateAISketchFlow',
    inputSchema: GenerateAISketchInputSchema,
    outputSchema: GenerateAISketchOutputSchema,
  },
  async (input) => {
    const commonPromptText = `Create a simple, minimalistic black-and-white line sketch of a '${input.chosenWord}' suitable for a Pictionary-style guessing game. Do not include any text or letters in the image. The sketch should be clear, easy to understand, and serve as a good base for a player to trace or add to. Focus on iconic representation.`;
    console.log(`[generateAISketchFlow] START for word: "${input.chosenWord}". Prompt: "${commonPromptText}"`);

    try {
      // Attempt 1: Gemini
      console.log(`[generateAISketchFlow] Attempting Gemini for "${input.chosenWord}"...`);
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: commonPromptText,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        },
      });

      if (media && media.url) {
        console.log(`[generateAISketchFlow] Gemini success for "${input.chosenWord}".`);
        return { imageDataUri: media.url };
      }
      console.warn(`[generateAISketchFlow] Gemini did not return image data for word "${input.chosenWord}". Media object:`, JSON.stringify(media));
      throw new Error('Gemini failed to return image data (media.url was missing or falsy).');

    } catch (geminiError: any) {
      console.error(`[generateAISketchFlow] Gemini ERROR for word "${input.chosenWord}". Attempting fallback to DeepSeek.`);
      console.error('[generateAISketchFlow] Gemini Raw Error Object:', geminiError);
      console.error('[generateAISketchFlow] Gemini Error Type:', typeof geminiError);
      console.error('[generateAISketchFlow] Gemini Error IsInstanceof Error:', geminiError instanceof Error);
      if (geminiError instanceof Error) {
        console.error('[generateAISketchFlow] Gemini Error Message:', geminiError.message);
        console.error('[generateAISketchFlow] Gemini Error Stack:', geminiError.stack);
      }
      try {
        console.error('[generateAISketchFlow] Gemini Error JSON.stringify:', JSON.stringify(geminiError, Object.getOwnPropertyNames(geminiError)));
      } catch (e) {
        console.error('[generateAISketchFlow] Could not JSON.stringify Gemini error object.');
      }
      
      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

      if (!DEEPSEEK_API_KEY) {
        console.error("[generateAISketchFlow] DeepSeek API key (DEEPSEEK_API_KEY) not configured in .env. Cannot fallback.");
        throw new Error('AI sketch generation failed (Gemini failed, DeepSeek API key missing). Please check server logs.');
      }

      try {
        console.log(`[generateAISketchFlow] Attempting DeepSeek for "${input.chosenWord}"...`);
        const deepSeekModel = "deepseek-image"; 

        const response = await fetch('https://api.deepseek.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            prompt: commonPromptText,
            model: deepSeekModel,
            n: 1,
            size: '512x512', 
            response_format: 'b64_json', 
          }),
        });

        if (!response.ok) {
          let errorBody = "Could not retrieve error body from DeepSeek.";
          try {
            errorBody = await response.text();
          } catch (e) { /* ignore if .text() fails trying to get error body */ }
          console.error(`[generateAISketchFlow] DeepSeek API ERROR for word "${input.chosenWord}": ${response.status} ${response.statusText}.`);
          console.error('[generateAISketchFlow] DeepSeek Response Body:', errorBody);
          throw new Error(`DeepSeek API request failed with status ${response.status}. See server logs for response body.`);
        }

        const data = await response.json();

        if (data.data && data.data[0] && data.data[0].b64_json) {
          const imageDataUri = `data:image/png;base64,${data.data[0].b64_json}`;
          console.log(`[generateAISketchFlow] DeepSeek success for "${input.chosenWord}".`);
          return { imageDataUri };
        } else {
          console.error(`[generateAISketchFlow] DeepSeek response did not contain expected image data for "${input.chosenWord}".`);
          console.error('[generateAISketchFlow] DeepSeek Response Data:', JSON.stringify(data));
          throw new Error('DeepSeek failed to return valid image data in the expected format. Check server logs for response data.');
        }
      } catch (deepSeekError: any) {
        console.error(`[generateAISketchFlow] DeepSeek Fallback ERROR for word "${input.chosenWord}".`);
        console.error('[generateAISketchFlow] DeepSeek Fallback Raw Error Object:', deepSeekError);
        console.error('[generateAISketchFlow] DeepSeek Fallback Error Type:', typeof deepSeekError);
        console.error('[generateAISketchFlow] DeepSeek Fallback Error IsInstanceof Error:', deepSeekError instanceof Error);
        if (deepSeekError instanceof Error) {
            console.error('[generateAISketchFlow] DeepSeek Fallback Error Message:', deepSeekError.message);
            console.error('[generateAISketchFlow] DeepSeek Fallback Error Stack:', deepSeekError.stack);
        }
        try {
            console.error('[generateAISketchFlow] DeepSeek Fallback Error JSON.stringify:', JSON.stringify(deepSeekError, Object.getOwnPropertyNames(deepSeekError)));
        } catch (e) {
            console.error('[generateAISketchFlow] Could not JSON.stringify DeepSeek Fallback error object.');
        }
        throw new Error('AI sketch generation failed. Both Gemini and DeepSeek attempts failed. Please check server logs for specific API error details from each service.');
      }
    }
  }
);

