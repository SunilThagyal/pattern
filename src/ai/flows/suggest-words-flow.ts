
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
  count: z.number().min(1).max(10).default(5).describe('The number of words to suggest.'), // Changed default and max
  maxWordLength: z.number().min(3).optional().describe('Optional maximum length for the suggested words.'),
});
export type SuggestWordsInput = z.infer<typeof SuggestWordsInputSchema>;

const SuggestWordsOutputSchema = z.array(z.string()).min(1).describe("An array of distinct, simple, drawable common nouns representing physical objects.");
export type SuggestWordsOutput = z.infer<typeof SuggestWordsOutputSchema>;


export async function suggestWords(input: SuggestWordsInput): Promise<SuggestWordsOutput> {
  return suggestWordsFlow(input);
}

const suggestWordsPrompt = ai.definePrompt({
  name: 'suggestWordsPrompt',
  input: {schema: SuggestWordsInputSchema},
  output: {schema: SuggestWordsOutputSchema},
  prompt: `You are an assistant for a drawing guessing game. Your task is to provide exactly {{count}} unique, simple, common English words that represent real-world, tangible, physical objects (e.g., apple, house, tree, guitar, car, umbrella, chair, book, sun, moon, flower, banana, clock, shoe).
These words should be easy to visualize and draw, and suitable for all ages.
{{#if maxWordLength}}The words should be no longer than {{maxWordLength}} characters.{{/if}}
Critically, AVOID ALL of the following types of words:
- Abstract concepts (e.g., "love", "idea", "dream", "justice")
- Verbs or actions (e.g., "running", "thinking", "jump")
- Proper nouns or specific named entities (e.g., "Eiffel Tower", "Paris", "iPhone")
- Very complex, obscure, or overly specific items (e.g., "electron microscope", "mitochondria").
- Plural words if singular is more common and drawable. Prefer singular (e.g., "apple" instead of "apples").
- Words that are hard to draw or distinguish visually.
Do NOT include any of the following words in your suggestions, as they have been used recently in this game session: [{{#if previouslyUsedWords.length}}{{#each previouslyUsedWords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}].
The {{count}} words you provide must be distinct from each other and from the excluded list.
Respond ONLY with a JSON array of {{count}} strings. For example, if count is 5, respond with: ["word1", "word2", "word3", "word4", "word5"]
Ensure the response strictly matches this JSON array format and contains exactly {{count}} strings.`,
});

const suggestWordsFlow = ai.defineFlow(
  {
    name: 'suggestWordsFlow',
    inputSchema: SuggestWordsInputSchema,
    outputSchema: SuggestWordsOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);
      if (output && output.length === input.count) {
        let filteredOutput = output.filter(word => word && word.trim().length > 0 && /^[a-zA-Z]+$/.test(word.trim())); // Ensure words are alphanumeric
        if (input.maxWordLength) {
            filteredOutput = filteredOutput.filter(word => word.length <= input.maxWordLength!);
        }
        const distinctWords = Array.from(new Set(filteredOutput.map(w => w.toLowerCase()))).map(lw => filteredOutput.find(w => w.toLowerCase() === lw)!);

        if (distinctWords.length >= input.count) {
            return distinctWords.slice(0, input.count) as SuggestWordsOutput;
        } else {
            console.warn(`Gemini returned ${distinctWords.length} distinct valid words, expected ${input.count}. Output:`, output, "Filtered:", filteredOutput, "Distinct:", distinctWords);
            const fallbacks = ["Guitar", "Apple", "Car", "Umbrella", "Chair", "Book", "Tree", "Sun", "Moon", "Flower", "Banana", "Clock", "Shoe", "Key", "Door", "Hat", "Cup", "Fish", "Star", "House"];
            let finalWords = [...distinctWords];
            for (const fb of fallbacks) {
                if (finalWords.length >= input.count) break;
                if (!finalWords.map(w=>w.toLowerCase()).includes(fb.toLowerCase()) &&
                    !(input.previouslyUsedWords.map(w=>w.toLowerCase()).includes(fb.toLowerCase())) &&
                    (input.maxWordLength ? fb.length <= input.maxWordLength : true)
                    ) {
                    finalWords.push(fb);
                }
            }
            const finalPads = ["Box", "Pen", "Lamp", "Desk", "Mouse"];
            let padIdx = 0;
            while(finalWords.length < input.count){
                const padWord = finalPads[padIdx % finalPads.length] + (finalWords.length > 0 && padIdx > 2 ? finalWords.length.toString() : "");
                 if (!finalWords.map(w=>w.toLowerCase()).includes(padWord.toLowerCase())) {
                    finalWords.push(padWord);
                 } else {
                    finalWords.push(padWord + "X");
                 }
                padIdx++;
            }
            return finalWords.slice(0, input.count) as SuggestWordsOutput;
        }
      }
      console.error('Gemini did not return the expected number of words or format. Received:', output);
      return ["Desk", "Lamp", "Mouse", "Keyboard", "Screen"].slice(0, input.count) as SuggestWordsOutput;
    } catch (error) {
      console.error("Error in suggestWordsFlow:", error);
      return ["Chair", "Table", "Screen", "Pen", "Cup"].slice(0, input.count) as SuggestWordsOutput;
    }
  }
);
