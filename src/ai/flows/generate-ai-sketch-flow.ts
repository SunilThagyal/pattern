
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

    try {
      // Attempt 1: Gemini
      console.log(`Attempting to generate sketch for "${input.chosenWord}" with Gemini...`);
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
        console.log(`Sketch for "${input.chosenWord}" generated successfully with Gemini.`);
        return { imageDataUri: media.url };
      }
      console.warn('Gemini did not return image data. Media object:', JSON.stringify(media));
      throw new Error('Gemini failed to return image data.'); // Trigger fallback

    } catch (geminiError: any) {
      console.error(`Error with Gemini for word "${input.chosenWord}", attempting fallback to DeepSeek:`, geminiError.message || geminiError);
      
      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

      if (!DEEPSEEK_API_KEY) {
        console.error("DeepSeek API key (DEEPSEEK_API_KEY) not configured in .env. Cannot fallback.");
        throw new Error('AI sketch generation failed (Gemini failed, DeepSeek API key missing).');
      }

      try {
        console.log(`Attempting to generate sketch for "${input.chosenWord}" with DeepSeek...`);
        // Using a common placeholder model name for DeepSeek Image API.
        // You might need to adjust this if DeepSeek uses a different model identifier.
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
            size: '512x512', // A common reasonable size
            response_format: 'b64_json', // Requesting base64 encoded image
          }),
        });

        if (!response.ok) {
          let errorBody = "Could not retrieve error body.";
          try {
            errorBody = await response.text();
          } catch (e) { /* ignore */ }
          console.error(`DeepSeek API error for word "${input.chosenWord}": ${response.status} ${response.statusText}`, errorBody);
          throw new Error(`DeepSeek API request failed with status ${response.status}.`);
        }

        const data = await response.json();

        if (data.data && data.data[0] && data.data[0].b64_json) {
          const imageDataUri = `data:image/png;base64,${data.data[0].b64_json}`;
          console.log(`Sketch for "${input.chosenWord}" generated successfully with DeepSeek.`);
          return { imageDataUri };
        } else {
          console.error(`DeepSeek response did not contain expected image data for "${input.chosenWord}":`, JSON.stringify(data));
          throw new Error('DeepSeek failed to return valid image data.');
        }
      } catch (deepSeekError: any) {
        console.error(`Error with DeepSeek fallback for word "${input.chosenWord}":`, deepSeekError.message || deepSeekError);
        throw new Error('AI sketch generation failed (Gemini and DeepSeek attempts both failed).');
      }
    }
  }
);
