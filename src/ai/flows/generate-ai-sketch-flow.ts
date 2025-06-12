
'use server';
/**
 * @fileOverview A Genkit flow to generate an AI sketch for a given word.
 *
 * - generateAISketch - A function that generates a sketch.
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
    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', // Specific model for image generation
        prompt: `Create a simple, minimalistic black-and-white line sketch of a '${input.chosenWord}' suitable for a Pictionary-style guessing game. Do not include any text or letters in the image. The sketch should be clear, easy to understand, and serve as a good base for a player to trace or add to. Focus on iconic representation.`,
        config: {
          responseModalities: ['TEXT', 'IMAGE'], // Must provide both
          safetySettings: [ // Added safety settings
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        },
      });

      if (media && media.url) {
        return { imageDataUri: media.url };
      } else {
        console.error('AI did not return image data. Media object:', media);
        throw new Error('AI failed to generate sketch image data.');
      }
    } catch (error) {
      console.error("Error in generateAISketchFlow (original error):", error);
      // Consider a default fallback image data URI if needed, or rethrow.
      throw new Error('Failed to generate AI sketch due to an internal error.');
    }
  }
);

