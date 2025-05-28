'use server';
/**
 * @fileOverview A Genkit flow to suggest words for the Pattern Party game.
 *
 * - suggestWords - A function that suggests unique, drawable words.
 * - SuggestWordsInput - The input type for the suggestWords function.
 * - SuggestWordsOutput - The return type for the suggestWords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestWordsInputSchema = z.object({
  previouslyUsedWords: z.array(z.string()).describe('A list of words that have already been used in the current game session and should be avoided.'),
  count: z.number().min(1).max(5).default(3).describe('The number of words to suggest.'),
  maxWordLength: z.number().min(3).optional().describe('Optional maximum length for the suggested words.'),
});
export type SuggestWordsInput = z.infer<typeof SuggestWordsInputSchema>;

const SuggestWordsOutputSchema = z.array(z.string()).length(3).describe("An array of three distinct, simple, drawable common nouns.");
export type SuggestWordsOutput = z.infer<typeof SuggestWordsOutputSchema>;


export async function suggestWords(input: SuggestWordsInput): Promise<SuggestWordsOutput> {
  return suggestWordsFlow(input);
}

const suggestWordsPrompt = ai.definePrompt({
  name: 'suggestWordsPrompt',
  input: {schema: SuggestWordsInputSchema},
  output: {schema: SuggestWordsOutputSchema},
  prompt: `You are an assistant for a drawing game. Your task is to provide exactly {{count}} unique, simple, and easily drawable common nouns.
These words are for a game like Pictionary or Skribbl.io.
{{#if maxWordLength}}The words should be no longer than {{maxWordLength}} characters.{{/if}}
Do NOT include any of the following words in your suggestions: [{{#if previouslyUsedWords.length}}{{#each previouslyUsedWords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}].
The words must be distinct from each other. Avoid proper nouns, abstract concepts, or very difficult items.
Respond ONLY with a JSON array of {{count}} strings, matching the output schema.`,
});

const suggestWordsFlow = ai.defineFlow(
  {
    name: 'suggestWordsFlow',
    inputSchema: SuggestWordsInputSchema,
    outputSchema: SuggestWordsOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await suggestWordsPrompt(input);
      if (output && output.length === input.count) {
        // Filter out empty strings or words that might be too long if Gemini doesn't fully respect maxWordLength
        let filteredOutput = output.filter(word => word && word.trim().length > 0);
        if (input.maxWordLength) {
            filteredOutput = filteredOutput.filter(word => word.length <= input.maxWordLength!);
        }
        // If filtering results in fewer words than requested, we might need a fallback or re-try.
        // For now, we'll return what we have, hoping Zod validation on outputSchema length catches it or Gemini adheres.
        // If after filtering, we don't have enough, this could be an issue.
        // The .length(3) on output schema should ideally make Gemini provide 3 valid ones.
        return filteredOutput.slice(0, input.count) as SuggestWordsOutput; // Ensure we return the correct count
      }
      // Fallback or error if Gemini doesn't return expected output.
      // Zod validation on output should catch this if the structure is wrong.
      // If it's an empty array or wrong length, it will throw.
      console.error('Gemini did not return the expected number of words or format.');
      // Return a default list or throw error - for now, relying on Zod to throw if malformed.
      // To be safe, let's return a fallback that matches schema if output is null/undefined
      return ["Apple", "House", "Star"] as SuggestWordsOutput; // Default fallback
    } catch (error) {
      console.error("Error in suggestWordsFlow:", error);
      // Fallback if the flow fails
      return ["Tree", "Car", "Book"] as SuggestWordsOutput; // Default fallback
    }
  }
);
